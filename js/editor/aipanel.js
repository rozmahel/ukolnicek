/* Úkolníček – AI: panel vpravo s chatem nad celou stránkou (✦ v horní liště stránky).
   Nahoře napevno kontext stránky (pg.aiCtx, dědí se), pod ním případný výběr (změny jen ve vybraných blocích), konverzace a pole na psaní.
   AI dostane stránku jako řádky „@ID typ | HTML“ (aipSerialize); rovnice, odkazy, zmínky a obrázky v textu jsou značky ⟦n|text⟧ a musí zůstat.
   Změny vrací v bloku [ZMĚNY] (aipParse): @ID = nový obsah bloku, +ID = nový blok za ID (+^ na začátek), -ID = smazat.
   Změny se jen ukážou ve stránce (.aip-chg přímo v #blocks, starý blok .aip-hid nebo přeškrtnutý .aip-old) a jdou po jedné odmítnout.
   Data se změní až tlačítkem Použít: jedno savePage = jeden krok ⌘Z; blok změněný mezitím se přeskočí.
   Konverzace se neukládá a na jiné stránce začne znovu. Otevření a šířka panelu jen v zařízení (uk-aip, uk-aip-w).
   AIQ = {pgId, msgs:[{role:'user'|'ai', text, raw, state, err, chg}], ctrl, sel:[ID]|null, last:ID|null, min}
   chg = {list:[{k, op:'set'|'add'|'del', id, b, old, txt, off, el}], cut, bad, state:'wait'|'done'|'drop'} */
import { $, clamp, clone, esc, IC, lsGet, lsSet, plain, plural, simpleUi, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { setTypingNow } from './history.js';
import { curPage, newBlock, pTitle } from '../pages.js';
import { sanitize } from '../sanitize.js';
import { focusBlock } from './caret.js';
import { hiddenMask, isHeading, keepVisible, onBlocksRendered, renderBlock, rerenderBlocks, sectionEnd } from './render.js';
import { toast } from '../ui.js';
import { cleanBlock, mdToBlocks } from './markdown.js';
import { AI_CTX_MAX, AI_PROVIDERS, aiAsk, aiCfg, aiConfigured, aiCtxOf, aiDefault, aiErrText, aiMaxChars, aiModel } from '../ai.js';
import { aiChatSystem } from '../ai/actions.js';
import { aiClose } from './aiedit.js';
import { bselIds, clearBsel } from './multisel.js';

const AIP_EDIT=['p','h1','h2','h3','bullet','num','todo','quote','callout'];
const AIP_HIST=10;            /* kolik předchozích výměn jde s dotazem */
let AIQ=null, OPEN=!!lsGet('uk-aip',false), PM=null;   /* PM = vybraný poskytovatel a model {id, model}, jen do zavření aplikace */
let el=null;
const AIP_X='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const AIP_UNDO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

const aipBox=()=>$('#blocks');
const aipOn=()=>OPEN&&!simpleUi()&&S.view.kind==='page'&&!!S.pages[S.view.pageId]&&aiConfigured().length>0;
const aipNarrow=()=>matchMedia('(max-width:860px)').matches;
const aipBlk=(n)=>n===1?'blok':n>1&&n<5?'bloky':'bloků';

/* ---- stránka → text pro AI ---- */
function aipTok(html,toks){
  const t=document.createElement('template'); t.innerHTML=String(html||'').replace(/\n/g,' ');
  t.content.querySelectorAll('span.eq,a,img').forEach(n=>{
    const lb=n.tagName==='IMG'?'obrázek':n.classList.contains('eq')?'$'+n.textContent+'$':n.textContent;
    toks.push(n.outerHTML);
    n.replaceWith(document.createTextNode(`⟦${toks.length}|${String(lb).replace(/[⟦⟧|\n]/g,' ').trim().slice(0,60)}⟧`));
  });
  return t.innerHTML;
}
function aipRo(b){
  const cut=s=>{ s=String(s||'').replace(/\s+/g,' ').trim(); return s.length>300?s.slice(0,300)+'…':s; };
  if(b.type==='image') return b.draw?'kresba':'obrázek';
  if(b.type==='table') return 'tabulka: '+cut((b.rows||[]).map(r=>(r.cells||[]).map(c=>(c.lines||[]).map(l=>plain(l.html)).join(' ')).join(' | ')).join(' / '));
  if(b.type==='eq') return 'rovnice: $'+cut(b.html)+'$';
  if(b.type==='code') return 'kód: '+cut(plain(String(b.html||'').replace(/<br\s*\/?>/gi,' ')));
  if(b.type==='divider') return 'oddělovač';
  if(b.type==='page'){ const p=S.pages[b.pageId]; return 'podstránka: '+cut(p?pTitle(p):''); }
  if(b.type==='subj') return 'předmět: '+cut(plain(b.html));
  return b.type+': '+cut(plain(b.html));
}
/* bloky ve sbalených sekcích AI vůbec nedostane (vis = viditelné ID, fold = sbalené nadpisy) */
function aipSerialize(pg){
  const toks=[], own={}, lines=[], bl=pg.blocks||[], hid=hiddenMask(bl), vis=new Set(), fold=new Set();
  for(const [i,b] of bl.entries()){
    if(hid[i]) continue;
    vis.add(b.id); if(isHeading(b.type)&&b.collapsed) fold.add(b.id);
    if(AIP_EDIT.includes(b.type)){
      const n0=toks.length, h=aipTok(b.html,toks);
      own[b.id]=toks.slice(n0).map((_,i)=>n0+i+1);
      lines.push(`@${b.id} ${b.type==='todo'&&b.done?'done':b.type}${b.level?'.'+b.level:''} | ${h}`);
    } else lines.push(`@${b.id} ! ${aipRo(b)}`);
  }
  return {text:lines.join('\n'),toks,own,vis,fold};
}
/* text bloku bez značek (porovnání, jestli AI měnila i slova) */
function aipTxt(h){ const t=document.createElement('template'); t.innerHTML=String(h||'').replace(/<br\s*\/?>/gi,' '); return (t.content.textContent||'').replace(/\s+/g,' ').trim(); }
const aipNums=h=>[...String(h).matchAll(/⟦(\d+)(?:\|[^⟧]*)?⟧/g)].map(m=>+m[1]);

/* ---- odpověď AI → zpráva a změny ---- */
function aipSplit(raw){ const i=raw.indexOf('[ZMĚNY]'); return {msg:(i<0?raw:raw.slice(0,i)).replace(/```\s*$/,'').trim(),body:i<0?null:raw.slice(i+7)}; }
function aipParse(raw,pg,ser,allow){
  const {msg,body}=aipSplit(raw); if(body==null) return {msg,chg:null};
  const j=body.indexOf('[/ZMĚNY]'), cut=j<0; let lines=(cut?body:body.slice(0,j)).split('\n');
  if(cut) lines.pop();   /* poslední řádek useknuté odpovědi může být neúplný */
  const ok=new Set(allow||[]), may=id=>ser.vis.has(id)&&(!allow||ok.has(id));
  const byId=new Map(pg.blocks.map((b,i)=>[b.id,{b,i}]));
  const untok=h=>sanitize(String(h).replace(/⟦(\d+)(?:\|[^⟧]*)?⟧/g,(m,n)=>ser.toks[+n-1]||''));
  const list=[]; let bad=0;
  for(let ln of lines){
    ln=ln.trim(); if(!ln||/^```/.test(ln)) continue;
    let m=ln.match(/^-\s*([^\s|]+)$/);
    if(m){
      const x=byId.get(m[1]); if(!x||!AIP_EDIT.includes(x.b.type)||!may(m[1])||ser.fold.has(m[1])){ bad++; continue; }   /* sbalený nadpis nejde smazat (skryté bloky by se přesunuly) */
      for(let i=list.length-1;i>=0;i--) if(list[i].id===m[1]&&list[i].op!=='add') list.splice(i,1);
      list.push({op:'del',id:m[1],old:JSON.stringify(x.b)}); continue;
    }
    m=ln.match(/^([@+])\s*([^\s|]+)\s+([a-z0-9]+)(?:\.(\d))?\s*\|\s?(.*)$/);
    if(!m){ bad++; continue; }
    const [,op,id,t0,lv,h]=m, t=t0==='done'?'todo':t0;
    if(!AIP_EDIT.includes(t)){ bad++; continue; }
    const nums=aipNums(h);
    if(op==='@'){
      const x=byId.get(id); if(!x||!AIP_EDIT.includes(x.b.type)||!may(id)||(ser.fold.has(id)&&t!==x.b.type)){ bad++; continue; }   /* sbalený nadpis si nechá typ */
      const own=ser.own[id]||[]; if(nums.length!==own.length||own.some(n=>!nums.includes(n))){ bad++; continue; }   /* rovnice, odkazy a zmínky musí zůstat */
      const nb=clone(x.b); nb.type=t; nb.html=untok(h);
      if(t==='todo'&&t0==='done') nb.done=true; else delete nb.done;
      if(+lv) nb.level=Math.min(4,+lv); else delete nb.level;
      if(JSON.stringify(nb)===JSON.stringify(x.b)) continue;
      for(let i=list.length-1;i>=0;i--) if(list[i].id===id&&list[i].op!=='add') list.splice(i,1);
      const oldTok=aipTok(x.b.html,[]), newTok=String(h).replace(/⟦(\d+)\|[^⟧]*⟧/g,'⟦$1⟧');
      list.push({op:'set',id,b:nb,old:JSON.stringify(x.b),txt:aipTxt(oldTok.replace(/⟦(\d+)\|[^⟧]*⟧/g,''))!==aipTxt(newTok.replace(/⟦\d+⟧/g,''))});
    } else {
      if(nums.length||(id==='^'?!!allow:!byId.has(id)||!may(id))){ bad++; continue; }
      const nb=newBlock(t,{html:sanitize(h)});
      if(t0==='done') nb.done=true; if(+lv) nb.level=Math.min(4,+lv);
      if(!plain(nb.html).trim()&&t==='p'){ bad++; continue; }
      list.push({op:'add',id,b:nb});
    }
  }
  /* pořadí podle stránky: u každého bloku nejdřív jeho změna, pak bloky vložené za něj */
  const pos=c=>c.id==='^'?-1:byId.get(c.id).i;
  list.forEach((c,i)=>{ c.k=i; c.ord=pos(c)*2+(c.op==='add'?1:0); });
  list.sort((a,b)=>a.ord-b.ord||a.k-b.k); list.forEach((c,i)=>{ c.k=i; });
  return {msg,chg:list.length||bad||cut?{list,cut,bad,state:list.length?'wait':'done'}:null};
}
const aipPending=()=>AIQ&&AIQ.msgs.map(m=>m.chg).find(c=>c&&c.state==='wait');

/* ---- náhled změn ve stránce ---- */
function aipChgEl(c,pg){
  const d=document.createElement('div'); d.className='aip-chg op-'+c.op; d.contentEditable='false'; d.dataset.k=c.k;
  let inner='';
  if(c.op==='del') inner='<span class="aip-lbl">Odstraní se</span>';
  else { const i=c.op==='set'?pg.blocks.findIndex(b=>b.id===c.id):0, bl=c.op==='set'?pg.blocks.map(b=>b.id===c.id?c.b:b):[c.b];
    inner='<div class="aip-blk" inert>'+renderBlock(c.b,Math.max(0,i),bl).replace(/ contenteditable="true"/g,'').replace(/ draggable="true"/g,'')+'</div>'; }
  d.innerHTML=inner+`<button type="button" class="aip-x aip-ic" data-aipx="${c.k}" title="Odmítnout tuto změnu" aria-label="Odmítnout tuto změnu">${AIP_X}</button>`;
  return d;
}
function aipPlace(){
  const box=aipBox(); if(!box) return;
  box.querySelectorAll(':scope > .aip-hid,:scope > .aip-old').forEach(n=>n.classList.remove('aip-hid','aip-old'));
  const ch=aipPending(), pg=curPage();
  const all=AIQ?AIQ.msgs.flatMap(m=>m.chg?m.chg.list:[]):[];
  all.forEach(c=>{ if(c.el&&(!ch||!ch.list.includes(c)||c.off)) c.el.remove(); });
  if(!ch||!pg||pg.id!==AIQ.pgId||box.hidden) return;
  const at=id=>box.querySelector(`:scope > .blk[data-id="${CSS.escape(id)}"]`);
  const tail={};   /* poslední prvek za blokem (jeho změna, vložené bloky) */
  for(const c of ch.list){
    if(c.off) continue;
    const old=c.id==='^'?null:at(c.id);
    if(c.id!=='^'&&!old){ if(c.el) c.el.remove(); c.hidden=true; continue; }   /* blok ve sbalené sekci */
    c.hidden=false;
    if(!c.el) c.el=aipChgEl(c,pg);
    if(c.op!=='add') old.classList.add(c.op==='set'&&!c.txt?'aip-hid':'aip-old');
    let prev=tail[c.id];
    if(!prev&&old){ prev=old; if(c.op==='add'&&prev.nextElementSibling&&prev.nextElementSibling.classList.contains('hidden-count')) prev=prev.nextElementSibling; }
    if(prev){ if(prev.nextElementSibling!==c.el) prev.after(c.el); }
    else if(box.firstElementChild!==c.el) box.prepend(c.el);
    tail[c.id]=c.el;
  }
}

/* ---- panel ---- */
function aipBuild(){
  el=document.createElement('aside'); el.className='aip'; el.id='aip'; el.setAttribute('aria-label','AI');
  el.innerHTML=`<div class="aip-grip" title="Tažením se mění šířka"></div>
    <div class="aip-head"><span class="aip-t"><span class="ai-ic" aria-hidden="true">${IC.spark}</span><span class="aip-pt"></span></span><select class="aip-pm" aria-label="Model" hidden></select>
      <button type="button" class="icon-btn aip-mx" data-aip="min" aria-label="Zobrazit stránku" title="Zobrazit stránku">${IC.chevD}</button><button type="button" class="icon-btn aip-ic" data-aip="close" aria-label="Zavřít" title="Zavřít">${AIP_X}</button></div>
    <div class="aip-ctx"><textarea class="aip-cta" rows="1" maxlength="${AI_CTX_MAX}" placeholder="Kontext, např. Jsi odborník na stavební materiály." aria-label="Kontext pro AI"></textarea><div class="aip-cn"></div></div>
    <div class="aip-sel" hidden></div>
    <div class="aip-log" aria-live="polite"></div>
    <div class="aip-ed" hidden></div>
    <form class="aip-in"><div class="aip-qw"><textarea class="aip-q" rows="1" aria-label="Zpráva pro AI" enterkeyhint="send"></textarea><span class="aip-ph" aria-hidden="true">Otázka nebo co změnit…</span></div><button type="submit" class="aip-send" aria-label="Odeslat" title="Odeslat (Enter)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg></button></form>`;
  $('#app').appendChild(el);
  const app=$('#app'); app.style.setProperty('--aip-w',clamp(+lsGet('uk-aip-w',360)||360,280,720)+'px');
  el.addEventListener('click',aipClick);
  el.addEventListener('pointerdown',()=>aipSelSync(),true);   /* výběr ve stránce si přečíst dřív, než ho zruší klik do panelu */
  const q=$('.aip-q',el), cta=$('.aip-cta',el);
  q.addEventListener('input',()=>aipGrow(q,160));
  q.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); aipSend(); }
    else if(e.key==='Escape'){ e.preventDefault(); if(AIQ&&AIQ.ctrl) AIQ.ctrl.abort(); else q.blur(); }
  });
  $('.aip-in',el).addEventListener('submit',e=>{ e.preventDefault(); aipSend(); });
  let tm=null;
  cta.addEventListener('keydown',e=>e.stopPropagation());
  cta.addEventListener('input',()=>{
    aipGrow(cta,120); const pg=AIQ&&S.pages[AIQ.pgId]; if(!pg||LOCK) return;
    if(cta.value.trim()) pg.aiCtx=cta.value; else delete pg.aiCtx;   /* prázdný kontext se do dat nezapisuje */
    aipCtxNote(); clearTimeout(tm); tm=setTimeout(()=>savePage(pg),400);
  });
  $('.aip-pm',el).addEventListener('change',e=>{ const [id,model]=e.target.value.split('|'); PM={id,model}; });
  /* šířka tažením za levý okraj */
  const g=$('.aip-grip',el);
  g.addEventListener('pointerdown',e=>{
    if(aipNarrow()) return; e.preventDefault(); g.setPointerCapture(e.pointerId); el.classList.add('drag');
    const mv=ev=>{ app.style.setProperty('--aip-w',clamp(innerWidth-ev.clientX,280,Math.max(280,Math.min(720,innerWidth-520)))+'px'); };
    const up=()=>{ g.removeEventListener('pointermove',mv); el.classList.remove('drag'); lsSet('uk-aip-w',parseInt(app.style.getPropertyValue('--aip-w'))||360); };
    g.addEventListener('pointermove',mv); g.addEventListener('pointerup',up,{once:true}); g.addEventListener('pointercancel',up,{once:true});
  });
}
function aipGrow(t,max){ t.style.height='auto'; t.style.height=Math.min(max,t.scrollHeight+2)+'px'; if(t.parentNode.classList.contains('aip-qw')) t.parentNode.classList.toggle('has-t',!!t.value); }

/* zobrazení podle pohledu: jinde než na stránce schované, na jiné stránce nová konverzace */
function aipView(){
  const on=aipOn(); $('#app').classList.toggle('aip-on',on);
  if(!on){ if(el) el.hidden=true; aipHl(); aipPlace(); return; }
  if(!el) aipBuild();
  el.hidden=false;
  const pg=S.pages[S.view.pageId];
  if(!AIQ||AIQ.pgId!==pg.id){ if(AIQ&&AIQ.ctrl) AIQ.ctrl.abort(); if(AIQ) aipDropAll(); AIQ={pgId:pg.id,msgs:[],sel:null,last:null,min:false}; aipDraw(); }
  else aipHead();
  el.classList.toggle('min',!!AIQ.min&&aipNarrow());
}
function aipHead(){
  const pg=S.pages[AIQ.pgId]; if(!pg||!el) return;
  $('.aip-pt',el).textContent=pTitle(pg)||'Bez názvu';
  const cta=$('.aip-cta',el); if(document.activeElement!==cta){ cta.value=pg.aiCtx||''; }
  cta.readOnly=LOCK; aipGrow(cta,120); aipCtxNote();
  const opts=aiConfigured().flatMap(id=>AI_PROVIDERS[id].models.map(([m,n])=>[id+'|'+m,AI_PROVIDERS[id].name+' '+n]));
  const s=$('.aip-pm',el); s.hidden=opts.length<2;
  if(PM&&!aiConfigured().includes(PM.id)) PM=null;
  const cur=PM?PM.id+'|'+PM.model:aiDefault()+'|'+aiModel(aiDefault());
  s.innerHTML=opts.map(([v,n])=>`<option value="${esc(v)}"${v===cur?' selected':''}>${esc(n)}</option>`).join('');
}
function aipCtxNote(){
  const pg=AIQ&&S.pages[AIQ.pgId], n=el&&$('.aip-cn',el); if(!pg||!n) return;
  const par=aiCtxOf(S.pages[pg.parent]);
  n.textContent=par.text&&!(pg.aiCtx||'').trim()?`Platí kontext ze stránky „${pTitle(par.from)}“: ${par.text.slice(0,120)}${par.text.length>120?'…':''}`:'';
}
function aipDraw(){ if(!el||!AIQ) return; aipHead(); aipSelDraw(); aipLog(); aipEd(); aipPlace(); }

/* vybraný text zůstane ve stránce zvýrazněný, i když je kurzor v panelu */
function aipHl(){
  try{ if(!window.CSS||!CSS.highlights||!window.Highlight) return;
    if(AIQ&&AIQ.sel&&AIQ.rng&&el&&!el.hidden) CSS.highlights.set('aip-sel',new Highlight(AIQ.rng)); else CSS.highlights.delete('aip-sel'); }catch(_){}
}
function aipSelDraw(){
  aipHl();
  const s=$('.aip-sel',el), n=AIQ.sel?AIQ.sel.length:0; s.hidden=!n;
  s.innerHTML=n?`<span>Jen ve výběru: ${n} ${aipBlk(n)}</span><button type="button" class="aip-ic" data-aip="unsel" aria-label="Zrušit výběr" title="Zrušit výběr">${AIP_X}</button>`:'';
}
function aipMd(t){ const bl=mdToBlocks(t).map(cleanBlock); return bl.map((b,i)=>renderBlock(b,i,bl)).join('').replace(/ contenteditable="true"/g,'').replace(/ draggable="true"/g,''); }
function aipLog(){
  const log=$('.aip-log',el); const end=log.scrollHeight-log.scrollTop-log.clientHeight<40;
  log.innerHTML=AIQ.msgs.length?AIQ.msgs.map((m,i)=>{
    if(m.role==='user') return `<div class="aip-m u">${esc(m.text)}</div>`;
    let st='', acts='';
    const ch=m.chg, n=ch?ch.list.filter(c=>!c.off).length:0;
    if(m.state==='run') st=`<span class="ai-dot" aria-hidden="true"></span>${m.raw&&m.raw.includes('[ZMĚNY]')?'Připravuju změny…':'Píšu…'}`;
    else if(m.state==='err') st=esc(aiErrText(m.err))+` <button type="button" class="linkbtn" data-aip="again" data-i="${i}">Zkusit znovu</button>`;
    else if(m.state==='stop') st='Zastaveno.';
    else if(ch&&ch.state==='done'&&ch.applied!=null) st=`Použito: ${ch.applied} ${plural(ch.applied,'změna','změny','změn')}.`;
    else if(ch&&ch.state==='drop') st='Změny zrušené.';
    else if(ch&&!ch.list.length) st='Žádná platná změna.';
    if(m.state==='done'&&m.text&&!ch) acts=`<div class="aip-acts"><button type="button" data-aip="ins" data-i="${i}" data-lock>Vložit pod</button><button type="button" data-aip="copy" data-i="${i}">Kopírovat</button></div>`;
    return `<div class="aip-m a">${m.text?`<div class="aip-md">${aipMd(m.text)}</div>`:''}${st?`<div class="aip-st">${st}</div>`:''}${acts}</div>`;
  }).join(''):'<div class="aip-empty">Vidím celou stránku. Stačí se zeptat nebo napsat, co v ní změnit.</div>';
  if(end) log.scrollTop=log.scrollHeight;
}
function aipEd(){
  const box=$('.aip-ed',el), ch=aipPending();
  box.hidden=!ch; el.classList.toggle('has-ed',!!ch);
  if(!ch){ box.innerHTML=''; el.classList.remove('min'); return; }
  const on=ch.list.filter(c=>!c.off).length;
  const row=c=>{ const t=plain((c.op==='del'?JSON.parse(c.old):c.b).html||'').trim()||'(prázdný řádek)';
    return `<div class="aip-r${c.off?' off':''}" data-aip="go" data-k="${c.k}"><span class="aip-op">${c.op==='add'?'+':c.op==='del'?'−':'✎'}</span><span class="aip-rt">${esc(t.slice(0,70))}</span>${c.txt?'<span class="aip-tag" title="Mění i text, ne jen formátování">text</span>':''}${c.hidden?'<span class="aip-tag">skryté</span>':''}<button type="button" class="aip-rx aip-ic" data-aipx="${c.k}" aria-label="${c.off?'Vrátit změnu':'Odmítnout změnu'}" title="${c.off?'Vrátit':'Odmítnout'}">${c.off?AIP_UNDO:AIP_X}</button></div>`; };
  box.innerHTML=`<div class="aip-eh"><b>Změní ${on} ${aipBlk(on)}</b><span class="sp"></span><button type="button" class="pri" data-aip="apply" data-lock${on?'':' disabled'} title="⌘↵">Použít</button><button type="button" data-aip="drop">Zavřít</button><button type="button" class="aip-mx" data-aip="min">${AIQ.min?'Chat':'Stránka'}</button></div>`
    +(ch.cut?'<div class="aip-note">Odpověď je useknutá, část změn chybí.</div>':'')+(ch.bad?`<div class="aip-note">${ch.bad} ${plural(ch.bad,'návrh nešel','návrhy nešly','návrhů nešlo')} použít.</div>`:'')
    +`<div class="aip-rs">${ch.list.map(row).join('')}</div>`;
}

/* ---- výběr ve stránce → změny jen tam ---- */
/* kind: 'bsel' = změnil se výběr celých bloků; výběr mimo bloky (panel, nadpis stránky) nic nemění */
function aipSelSync(kind){
  if(!AIQ||!el||el.hidden) return;
  const pg=curPage(); if(!pg||pg.id!==AIQ.pgId) return;
  const ids=bselIds(); let sel=AIQ.sel, rng=AIQ.rng;
  if(ids&&ids.length){ sel=ids; rng=null; }
  else if(kind==='bsel'){ sel=null; rng=null; }
  else {
    const s=getSelection(), box=aipBox();
    if(box&&s.rangeCount){
      const r=s.getRangeAt(0);
      if(box.contains(r.commonAncestorContainer)){
        const els=[...box.children].filter(n=>n.classList.contains('blk')&&r.intersectsNode(n));
        if(r.collapsed){ sel=null; rng=null; if(els[0]) AIQ.last=els[0].dataset.id; }
        else if(els.length){ sel=els.map(n=>n.dataset.id); rng=r.cloneRange(); }
      }
    }
  }
  if(JSON.stringify(sel)!==JSON.stringify(AIQ.sel)||rng!==AIQ.rng){ AIQ.sel=sel; AIQ.rng=rng; aipSelDraw(); }
}

/* ---- dotaz ---- */
async function aipSend(again){
  if(!AIQ) return;
  const q=$('.aip-q',el), pg=S.pages[AIQ.pgId]; if(!pg) return;
  let text=again!=null?AIQ.msgs[again-1]&&AIQ.msgs[again-1].text:q.value.trim();
  if(!text) return;
  if(navigator.onLine===false) return toast('AI potřebuje připojení k internetu.');
  if(AIQ.ctrl) AIQ.ctrl.abort();
  aiClose(); aipDropAll();
  if(again!=null) AIQ.msgs.splice(again-1);
  const ser=aipSerialize(pg), allow=AIQ.sel&&AIQ.sel.length?AIQ.sel.filter(id=>ser.vis.has(id)):null;
  const prov=PM&&aiConfigured().includes(PM.id)?PM.id:aiDefault(), max=aiMaxChars(prov);
  if(ser.text.length>max-6000){ toast(allow?'Stránka je na AI moc dlouhá.':'Stránka je na AI moc dlouhá, pomůže vybrat jen její část.'); return; }
  /* předchozí výměny (bez textu stránky, ten jde jen s posledním dotazem) */
  const hist=[]; AIQ.msgs.forEach((m,i)=>{ const a=AIQ.msgs[i+1];
    if(m.role==='user'&&a&&a.role==='ai'&&a.state==='done'){ const ch=a.chg, n=ch?ch.list.length:0;
      hist.push({role:'user',text:m.text},{role:'ai',text:(a.text||'')+(n?`\n[Navrhl jsem ${n} ${plural(n,'změnu','změny','změn')} – ${ch.state==='drop'?'uživatel je zrušil':ch.applied!=null?'uživatel jich použil '+ch.applied:'zatím nepoužité'}]`:'')}); } });
  const user=`Stránka „${pTitle(pg)||'Bez názvu'}“:\n<<<\n${ser.text}\n>>>\n\n${allow?'Vybrané bloky: '+allow.join(', ')+'\n\n':''}Uživatel: ${text}`;
  const um={role:'user',text}, am={role:'ai',text:'',raw:'',state:'run'};
  AIQ.msgs.push(um,am); if(again==null){ q.value=''; aipGrow(q,160); }
  const ctrl=AIQ.ctrl=new AbortController(), me=AIQ; let t=0;
  aipLog(); aipEd();
  try{
    const r=await aiAsk({action:'chat',provider:prov,model:PM&&PM.id===prov?PM.model:undefined,text:ser.text,user,history:hist.slice(-AIP_HIST*2),
      system:aiChatSystem({style:aiCfg().style,lang:aiCfg().lang,ctx:aiCtxOf(pg).text||undefined,allow}),maxTokens:16000,signal:ctrl.signal,
      onText:s=>{ if(AIQ!==me||ctrl.signal.aborted) return; am.raw=s; am.text=aipSplit(s).msg; const n=Date.now(); if(n-t>150){ t=n; aipLog(); } }});
    if(AIQ!==me||ctrl.signal.aborted) return;
    am.raw=r.text; am.state='done';
  }catch(e){
    if(AIQ!==me) return;
    if(e&&e.name==='AbortError') am.state=am.raw.trim()?'done':'stop';
    else { am.state='err'; am.err=e; }
  }
  if(AIQ.ctrl===ctrl) AIQ.ctrl=null;
  if(am.state==='done'){
    const cur=S.pages[AIQ.pgId]; const p=cur?aipParse(am.raw,cur,ser,allow):{msg:am.text,chg:null};
    am.text=p.msg; am.chg=p.chg;
    if(p.chg&&p.chg.state==='wait'&&aipNarrow()) AIQ.min=true;
  }
  aipLog(); aipEd(); aipPlace(); el.classList.toggle('min',!!AIQ.min&&aipNarrow()&&!!aipPending());
  const first=aipPending()&&aipPending().list.find(c=>c.el&&!c.off); if(first&&!aipNarrow()) first.el.scrollIntoView({block:'nearest'});
}
function aipDropAll(){ if(!AIQ) return; AIQ.msgs.forEach(m=>{ if(m.chg&&m.chg.state==='wait') m.chg.state='drop'; }); aipPlace(); if(el) aipEd(); }

/* ---- použití změn: jedno savePage ---- */
function aipApply(){
  const ch=aipPending(); if(!ch) return;
  if(LOCK) return toast('Zamčeno: změny jde použít po odemčení.');
  const pg=S.pages[AIQ.pgId]; if(!pg) return;
  let skip=0; const now=id=>pg.blocks.find(b=>b.id===id);
  const on=ch.list.filter(c=>{ if(c.off) return false;
    if(c.op==='add') return c.id==='^'||!!now(c.id);
    const b=now(c.id); if(!b||JSON.stringify(b)!==c.old){ skip++; return false; } return true; });
  if(!on.length){ if(skip) toast('Text se mezitím změnil. Stačí to zkusit znovu.'); return; }
  on.filter(c=>c.op==='set').forEach(c=>{ const i=pg.blocks.findIndex(b=>b.id===c.id); pg.blocks[i]=clone(c.b); });
  const adds=new Map(); on.filter(c=>c.op==='add').forEach(c=>{ if(!adds.has(c.id)) adds.set(c.id,[]); adds.get(c.id).push(clone(c.b)); });
  /* za sbalený nadpis se vkládá až za jeho skryté bloky */
  adds.forEach((bl,id)=>{ const i=id==='^'?-1:pg.blocks.findIndex(b=>b.id===id), a=pg.blocks[i]; pg.blocks.splice(a&&isHeading(a.type)&&a.collapsed?sectionEnd(pg.blocks,i):i+1,0,...bl); });
  const del=new Set(on.filter(c=>c.op==='del').map(c=>c.id)); pg.blocks=pg.blocks.filter(b=>!del.has(b.id));
  if(!pg.blocks.length) pg.blocks.push(newBlock('p'));
  ch.state='done'; ch.applied=on.length; ch.list.forEach(c=>{ if(c.el) c.el.remove(); });
  setTypingNow(false); savePage(pg); rerenderBlocks();
  AIQ.min=false; if(el) el.classList.remove('min');
  aipLog(); aipEd();
  if(skip) toast(`${skip} ${plural(skip,'změna se nepoužila','změny se nepoužily','změn se nepoužilo')}: blok se mezitím změnil.`);
}
/* odpověď vložit do stránky: pod výběr, pod blok s kurzorem, jinak na konec */
function aipInsert(i){
  const m=AIQ.msgs[i]; if(!m||!m.text) return;
  if(LOCK) return toast('Zamčeno: odpověď jde vložit po odemčení.');
  const pg=S.pages[AIQ.pgId]; if(!pg) return;
  const nb=mdToBlocks(m.text).map(cleanBlock); if(!nb.length) return;
  const ref=(AIQ.sel&&AIQ.sel[AIQ.sel.length-1])||AIQ.last; let at=ref?pg.blocks.findIndex(b=>b.id===ref):-1;
  if(at<0) at=pg.blocks.length; else { const a=pg.blocks[at]; at=isHeading(a.type)&&a.collapsed?sectionEnd(pg.blocks,at):at+1; keepVisible(pg.blocks,at); }
  pg.blocks.splice(at,0,...nb);
  if(!pg.blocks[at+nb.length]) pg.blocks.push(newBlock('p'));
  setTypingNow(false); savePage(pg); rerenderBlocks();
  const lt=[...nb].reverse().find(b=>TEXT_TYPES.includes(b.type)); if(lt){ focusBlock(lt.id,'end'); AIQ.last=lt.id; }
}

function aipClick(e){
  const x=e.target.closest('[data-aipx]');
  if(x&&el.contains(x)){ e.stopPropagation(); aipToggle(+x.dataset.aipx); return; }
  const b=e.target.closest('[data-aip]'); if(!b) return;
  const v=b.dataset.aip, i=+b.dataset.i;
  if(v==='close') aipOpen(false);
  else if(v==='min'){ AIQ.min=!AIQ.min; el.classList.toggle('min',AIQ.min&&aipNarrow()); aipEd(); }
  else if(v==='unsel'){ AIQ.sel=null; AIQ.rng=null; clearBsel(); aipSelDraw(); }
  else if(v==='apply') aipApply();
  else if(v==='drop'){ aipDropAll(); aipLog(); }
  else if(v==='again') aipSend(i);
  else if(v==='ins') aipInsert(i);
  else if(v==='copy'){ const m=AIQ.msgs[i]; if(m) navigator.clipboard.writeText(m.text).then(()=>toast('Zkopírováno.'),()=>{}); }
  else if(v==='go'){ const ch=aipPending(), c=ch&&ch.list[+b.dataset.k]; if(c&&c.el&&!c.off){ if(aipNarrow()){ AIQ.min=true; el.classList.add('min'); aipEd(); } c.el.scrollIntoView({block:'center',behavior:'smooth'}); c.el.classList.remove('flash'); void c.el.offsetWidth; c.el.classList.add('flash'); } }
}
function aipToggle(k){ const ch=aipPending(), c=ch&&ch.list[k]; if(!c) return; c.off=!c.off; aipPlace(); aipEd(); }

function aipOpen(on){
  OPEN=on==null?!OPEN:!!on; lsSet('uk-aip',OPEN);
  if(!OPEN){ if(AIQ&&AIQ.ctrl) AIQ.ctrl.abort(); aipDropAll(); if(AIQ) aipLog(); }
  aipView();
  const b=$('.ai-ctx-btn'); if(b) b.classList.toggle('on',OPEN);
  if(OPEN&&el&&!aipNarrow()) $('.aip-q',el).focus();
  else if(OPEN&&el) setTimeout(()=>$('.aip-q',el).focus(),50);
}
const aipIsOpen=()=>OPEN;

export function initAiPanel(){
  document.addEventListener('uk-view',aipView);
  matchMedia('(max-width:860px)').addEventListener('change',aipView);   /* v úzkém okně (jednoduchý režim) je panel schovaný, stav zůstává */
  onBlocksRendered(()=>{ if(AIQ&&curPage()&&curPage().id===AIQ.pgId) aipPlace(); });
  document.addEventListener('selectionchange',()=>aipSelSync());
  document.addEventListener('uk-bsel',()=>aipSelSync('bsel'));
  /* ve stránce: × u změny ji odmítne */
  $('#view').addEventListener('click',e=>{ const x=e.target.closest('.aip-chg [data-aipx]'); if(x){ e.stopPropagation(); e.preventDefault(); aipToggle(+x.dataset.aipx); } },true);
  $('#view').addEventListener('mousedown',e=>{ if(e.target.closest('.aip-chg')) e.preventDefault(); },true);
  /* ⌘↵ použije změny, kdekoli kromě otevřeného okna */
  document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&aipPending()&&!S.modal){ e.preventDefault(); e.stopPropagation(); aipApply(); } },true);
  addEventListener('resize',()=>{ if(el&&AIQ) el.classList.toggle('min',!!AIQ.min&&aipNarrow()); });
  document.addEventListener('uk-lock',()=>{ if(el&&AIQ) aipHead(); });
}

export { aipIsOpen, aipOpen };
