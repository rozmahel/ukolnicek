/* Úkolníček – AI v editoru: ✦ u výběru (lišta formátu, výběr přes víc bloků i výběr celých bloků), /shrnutí a /ai.
   Výsledek je vždy jen náhled na místě (.ai-prev přímo v #blocks): nahrazované bloky přeškrtnuté (.ai-old), nové zvýrazněné.
   Data se změní až tlačítkem Použít / Vložit: jedno savePage = jeden krok ⌘Z. Překreslení stránky náhled vrátí na místo (aiPlace).
   AP = {pgId, action, kind:'inline'|'blocks'|'insert', ids, snap, after, blank, inline:{id,a,b,html,lead,trail}, src, prompt,
         text, state:'ask'|'run'|'done'|'stop'|'err', err, provider, again, ctrl, el} */
import { $, $$, esc, plain, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { setTypingNow } from './history.js';
import { curPage, newBlock, pTitle } from '../pages.js';
import { isBlank, sanitize } from '../sanitize.js';
import { focusBlock, nodeAt } from './caret.js';
import { isHeading, keepVisible, onBlocksRendered, renderBlock, rerenderBlocks, sectionEnd } from './render.js';
import { slash } from './slash.js';
import { hideFmt } from './toolbar.js';
import { openPop, toast } from '../ui.js';
import { blockMd, cleanBlock, htmlToMd, mdToBlocks } from './markdown.js';
import { AI_ERR, AI_PROVIDERS, aiAsk, aiConfigured, aiCtxOf, aiDefault, aiErrText, aiMaxChars, aiUsable } from '../ai.js';
import { AI_ACTIONS, AI_MENU, aiNoIssues } from '../ai/actions.js';
import { aipIsOpen } from './aipanel.js';
import { clearBsel } from './multisel.js';

let AP=null;
const AI_KEEP=new Set(['image','subj','page']);   /* při nahrazení zůstanou na místě a AI je nedostane */
const AI_INL=['p','h1','h2','h3','bullet','num','todo','quote','callout'];
const aiTxtOf=id=>$(`#blocks > .blk[data-id="${id}"] > .row > .txt`);
const aiIsList=t=>t==='bullet'||t==='num'||t==='todo';

/* bloky → markdown pro AI (seznamy bez prázdných řádků), obrázky a kresby se vynechají */
function aiMd(bl){
  const out=[]; let prev=null;
  for(const b of bl){
    if(b.type==='image') continue;
    const s=blockMd(b); if(s==null||!String(s).trim()) continue;
    if(out.length) out.push(prev&&aiIsList(prev.type)&&aiIsList(b.type)?'\n':'\n\n');
    out.push(s); prev=b;
  }
  return out.join('');
}
const aiParse=text=>mdToBlocks(text).map(cleanBlock);
function aiInlineHtml(text){ return mdToBlocks(text).filter(b=>AI_INL.includes(b.type)).map(b=>sanitize(b.html)).filter(x=>plain(x).trim()).join(' '); }

/* výběr textu → {kind:'inline'} (část jednoho bloku) nebo {kind:'blocks', ids} (celé bloky, kterých se výběr dotýká) */
function aiCapture(){
  const pg=curPage(), s=getSelection(), box=$('#blocks'); if(!pg||!box||!s.rangeCount||s.isCollapsed) return null;
  const r=s.getRangeAt(0); if(!box.contains(r.commonAncestorContainer)) return null;
  const els=$$('#blocks > .blk').filter(el=>r.intersectsNode(el)); if(!els.length) return null;
  if(els.length===1){
    const b=pg.blocks.find(x=>x.id===els[0].dataset.id), t=b&&aiTxtOf(b.id);
    if(t&&b.type!=='code'&&t.contains(r.startContainer)&&t.contains(r.endContainer)){
      const pre=document.createRange(); pre.selectNodeContents(t); pre.setEnd(r.startContainer,r.startOffset);
      const sel=r.toString(), a=pre.toString().length, e=a+sel.length, all=t.textContent;
      if(all.slice(0,a).trim()||all.slice(e).trim()){
        const d=document.createElement('div'); d.appendChild(r.cloneContents());
        return {kind:'inline',pgId:pg.id,inline:{id:b.id,a,b:e,html:b.html,lead:/^\s/.test(sel)?' ':'',trail:/\s$/.test(sel)?' ':''},text:htmlToMd(sanitize(d.innerHTML),' ')};
      }
    }
  }
  return {kind:'blocks',pgId:pg.id,ids:els.map(el=>el.dataset.id)};
}
/* menu ✦: akce nad výběrem */
function aiMenu(anchor,sel,at){
  if(!sel) return;
  if(!aiUsable()) return toast(LOCK?'Zamčeno: AI jde použít po odemčení.':navigator.onLine===false?'AI potřebuje připojení k internetu.':AI_ERR.none);
  openPop(anchor,`<div class="pop-h">AI</div>`+AI_MENU.map(k=>`<button class="pop-item" data-v="${k}"><span class="pi-ic">✦</span>${AI_ACTIONS[k].label}</button>`).join(''),k=>aiRun(k,sel),at);
}

function aiRun(action,sel){
  aiClose();
  const pg=S.pages[sel.pgId]; if(!pg) return;
  const A=AI_ACTIONS[action]||{}, ap={pgId:pg.id,action,again:0,text:'',state:'run',src:''};
  if(sel.kind==='inline'){
    if(A.insert){ ap.kind='insert'; ap.after=sel.inline.id; } else { ap.kind='inline'; ap.inline=sel.inline; }
    ap.src=sel.text;
  } else if(sel.kind==='blocks'){
    const bl=sel.ids.map(id=>pg.blocks.find(b=>b.id===id)).filter(Boolean);
    if(A.insert){ ap.kind='insert'; ap.after=sel.ids[sel.ids.length-1]; ap.src=aiMd(bl); }
    else { const rep=bl.filter(b=>!AI_KEEP.has(b.type)); ap.kind='blocks'; ap.ids=rep.map(b=>b.id); ap.src=aiMd(rep); ap.snap=JSON.stringify(rep); }
  } else Object.assign(ap,sel);
  if(action!=='write'&&!String(ap.src).trim()) return toast('Ve výběru není text pro AI.');
  if(ap.src.length>aiMaxChars()) return toast('Výběr je na AI moc dlouhý. Vyber menší část.');
  AP=ap; getSelection().removeAllRanges(); clearBsel(); hideFmt(); aiPlace();
  if(ap.state==='run') aiGo(); else { const q=$('.ai-q',ap.el); if(q) q.focus(); }
}
async function aiGo(){
  const ap=AP; if(!ap) return;
  if(ap.ctrl) ap.ctrl.abort();
  const ctrl=ap.ctrl=new AbortController();
  ap.state='run'; ap.text=''; ap.err=null; aiDraw();
  let t=0;
  try{
    const r=await aiAsk({action:ap.action,ctx:aiCtxOf(S.pages[ap.pgId]).text||undefined,text:ap.src,prompt:ap.prompt,inline:ap.kind==='inline',provider:ap.provider||undefined,again:ap.again,signal:ctrl.signal,
      onText:s=>{ if(AP!==ap||ctrl.signal.aborted) return; ap.text=s; const n=Date.now(); if(n-t>120){ t=n; aiDrawOut(); } }});
    if(AP!==ap||ctrl.signal.aborted) return;
    ap.text=r.text; ap.state='done';
  }catch(e){
    if(AP!==ap) return;
    if(e&&e.name==='AbortError') ap.state=ap.text.trim()?'done':'stop';
    else { ap.state='err'; ap.err=e; }
  }
  aiDraw();
}
function aiStop(){ if(AP&&AP.ctrl) AP.ctrl.abort(); }
function aiClose(back){
  const ap=AP; if(!ap) return; AP=null;
  if(ap.ctrl) ap.ctrl.abort();
  if(ap.el) ap.el.remove();
  $$('#blocks .ai-old,#blocks .ai-hide').forEach(e=>e.classList.remove('ai-old','ai-hide'));
  try{ if(window.CSS&&CSS.highlights) CSS.highlights.delete('ai-old'); }catch(_){}
  if(back&&ap.blank&&curPage()&&curPage().id===ap.pgId) focusBlock(ap.blank,0);
}

/* ---- vykreslení náhledu ---- */
function aiPreviewHtml(ap){
  if(ap.kind==='inline') return `<div class="ai-inl">${aiInlineHtml(ap.text)}</div>`;
  const nb=aiParse(ap.text);
  return nb.map((b,i)=>renderBlock(b,i,nb)).join('').replace(/ contenteditable="true"/g,'').replace(/ draggable="true"/g,'');
}
function aiDrawOut(){ const ap=AP; if(!ap||!ap.el) return; const o=$('.ai-out',ap.el); o.innerHTML=ap.text?aiPreviewHtml(ap):''; }
function aiDraw(){
  const ap=AP; if(!ap||!ap.el) return;
  aiDrawOut();
  const again='<button type="button" data-ai="again">Zkusit znovu</button>', x='<button type="button" data-ai="x" title="Esc">Zrušit</button>';
  let msg='', btn='';
  if(ap.state==='ask'){ btn='<button type="button" class="pri" data-ai="go">Napsat</button>'+x; }
  else if(ap.state==='run'){ msg='<span class="ai-dot" aria-hidden="true"></span>Píšu…'; btn='<button type="button" data-ai="stop">Zastavit</button>'; }
  else if(ap.state==='done'&&AI_ACTIONS[ap.action]&&AI_ACTIONS[ap.action].check){
    /* Ověřit nic nemění: hlavní je Zavřít, připomínky jde případně vložit pod text */
    btn=(aiNoIssues(ap.text)?'':'<button type="button" data-ai="ok" title="⌘↵">Vložit pod text</button>')+again+'<button type="button" class="pri" data-ai="x" title="Esc">Zavřít</button>';
  }
  else if(ap.state==='done'){ btn=`<button type="button" class="pri" data-ai="ok" title="⌘↵">${ap.kind==='insert'?'Vložit':'Použít'}</button>`+again+x; }
  else if(ap.state==='stop'){ msg='Zastaveno.'; btn=again+x; }
  else {
    const cur=ap.provider||aiDefault(), other=ap.err&&['limit','credit','busy','key','model'].includes(ap.err.code)&&aiConfigured().find(id=>id!==cur);
    msg=esc(aiErrText(ap.err)); btn=(other?`<button type="button" data-ai="other" data-p="${other}">Zkusit ${esc(AI_PROVIDERS[other].name)}</button>`:'')+again+x;
  }
  $('.ai-bar',ap.el).innerHTML=`<span class="ai-msg" role="status">${msg}</span>${btn}`;
  ap.el.classList.toggle('busy',ap.state==='run');
}
function aiBuild(ap){
  const el=document.createElement('div'); el.className='ai-prev'+(ap.kind==='insert'?' ins':''); el.contentEditable='false';
  el.innerHTML=(ap.state==='ask'?`<div class="ai-ask"><span class="ai-ic" aria-hidden="true">✦</span><input class="ai-q" type="text" placeholder="Co napsat?" aria-label="Co napsat?" enterkeyhint="go" autocomplete="off"></div>`:'')
    +'<div class="ai-out" inert></div><div class="ai-bar"></div>';
  el.addEventListener('mousedown',e=>{ if(e.target.closest('button')) e.preventDefault(); });
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-ai]'); if(!b||AP!==ap) return; const v=b.dataset.ai;
    if(v==='x') aiClose(true); else if(v==='stop') aiStop(); else if(v==='ok') aiApply();
    else if(v==='go') aiAskGo(); else if(v==='again'){ ap.again++; aiGo(); }
    else if(v==='other'){ ap.provider=b.dataset.p; aiGo(); }
  });
  el.addEventListener('keydown',e=>{
    if(!e.target.classList.contains('ai-q')) return;
    e.stopPropagation();
    if(e.key==='Enter'&&!e.isComposing){ e.preventDefault(); aiAskGo(); }
    else if(e.key==='Escape'){ e.preventDefault(); aiClose(true); }
  });
  return el;
}
function aiAskGo(){
  const ap=AP; if(!ap) return; const q=$('.ai-q',ap.el), v=q?q.value.trim():'';
  if(!v){ if(q) q.focus(); return; }
  ap.prompt=v; if(q) q.blur(); aiGo();
}
/* náhled na místo: za poslední nahrazovaný blok, za blok s /ai a /shrnutí, za blok s výběrem */
function aiPlace(){
  const ap=AP; if(!ap) return;
  const box=$('#blocks'), pg=curPage();
  if(!pg||pg.id!==ap.pgId||!box||box.hidden){ aiClose(); return; }
  const at=id=>box.querySelector(`:scope > .blk[data-id="${id}"]`);
  if(ap.kind==='blocks') ap.ids.forEach(id=>{ const el=at(id); if(el) el.classList.add('ai-old'); });
  if(ap.blank){ const el=at(ap.blank); if(el) el.classList.add('ai-hide'); }
  const ids=ap.kind==='blocks'?ap.ids:[ap.kind==='inline'?ap.inline.id:(ap.blank||ap.after)];
  let anchor=null; for(let i=ids.length-1;i>=0&&!anchor;i--) anchor=at(ids[i]);
  const first=!ap.el; if(first) ap.el=aiBuild(ap);
  if(anchor){ let prev=anchor; if(prev.nextElementSibling&&prev.nextElementSibling.classList.contains('hidden-count')) prev=prev.nextElementSibling;
    if(ap.el.previousElementSibling!==prev||ap.el.parentNode!==box) prev.after(ap.el); }
  else if(ap.el.parentNode!==box) box.appendChild(ap.el);
  if(first) aiDraw();
  if(ap.kind==='inline'&&window.CSS&&CSS.highlights&&window.Highlight){
    const t=aiTxtOf(ap.inline.id), b=pg.blocks.find(x=>x.id===ap.inline.id);
    try{ if(t&&b&&b.html===ap.inline.html){ const [n1,o1]=nodeAt(t,ap.inline.a),[n2,o2]=nodeAt(t,ap.inline.b), r=document.createRange(); r.setStart(n1,o1); r.setEnd(n2,o2); CSS.highlights.set('ai-old',new Highlight(r)); } }catch(_){}
  }
  if(first){ const rc=ap.el.getBoundingClientRect(); if(rc.bottom>innerHeight-20||rc.top<70) ap.el.scrollIntoView({block:'nearest'}); }
}

/* ---- použití výsledku: jedna změna stránky ---- */
function aiApply(){
  const ap=AP; if(!ap||ap.state!=='done'||!ap.text.trim()) return;
  if(aiNoIssues(ap.text)&&AI_ACTIONS[ap.action]&&AI_ACTIONS[ap.action].check){ aiClose(true); return; }
  if(LOCK) return toast('Zamčeno: výsledek AI jde použít po odemčení.');
  const pg=S.pages[ap.pgId]; if(!pg){ aiClose(); return; }
  const changed=()=>toast('Text se mezitím změnil. Zkus to znovu.');
  let focusId=null, pos='end', nb=null;
  if(ap.kind==='inline'){
    const b=pg.blocks.find(x=>x.id===ap.inline.id), t=b&&aiTxtOf(b.id);
    if(!b||!t||b.html!==ap.inline.html) return changed();
    const html=aiInlineHtml(ap.text); if(!html) return;
    const [n1,o1]=nodeAt(t,ap.inline.a),[n2,o2]=nodeAt(t,ap.inline.b), r=document.createRange(); r.setStart(n1,o1); r.setEnd(n2,o2); r.deleteContents();
    const tpl=document.createElement('template'); tpl.innerHTML=ap.inline.lead+html+ap.inline.trail;
    const len=tpl.content.textContent.length; r.insertNode(tpl.content);
    b.html=sanitize(t.innerHTML); focusId=b.id; pos=ap.inline.a+len;
  } else {
    nb=aiParse(ap.text); if(!nb.length) return;
    if(ap.kind==='blocks'){
      const cur=ap.ids.map(id=>pg.blocks.find(b=>b.id===id)).filter(Boolean);
      if(JSON.stringify(cur)!==ap.snap) return changed();
      const base=Math.min(...cur.map(b=>b.level||0)); if(base>0) nb.forEach(b=>{ b.level=Math.min(4,(b.level||0)+base); });
      const drop=new Set(cur.map(b=>b.id)), at=pg.blocks.findIndex(b=>drop.has(b.id));
      pg.blocks=pg.blocks.filter(b=>!drop.has(b.id)); pg.blocks.splice(at,0,...nb);
    } else {
      const bi=ap.blank?pg.blocks.findIndex(b=>b.id===ap.blank):-1; let at;
      if(bi>=0&&TEXT_TYPES.includes(pg.blocks[bi].type)&&isBlank(pg.blocks[bi].html)){ pg.blocks.splice(bi,1); at=bi; }
      else { const ai=pg.blocks.findIndex(b=>b.id===ap.after); if(ai<0) at=pg.blocks.length; else { const a=pg.blocks[ai]; at=isHeading(a.type)&&a.collapsed?sectionEnd(pg.blocks,ai):ai+1; keepVisible(pg.blocks,at); } }
      pg.blocks.splice(at,0,...nb);
    }
    const last=nb[nb.length-1], li=pg.blocks.indexOf(last);
    if(!pg.blocks[li+1]) pg.blocks.push(newBlock('p'));   /* na konci stránky zůstane prázdný řádek na psaní */
    const lt=[...nb].reverse().find(b=>TEXT_TYPES.includes(b.type)); focusId=lt?lt.id:null;
  }
  setTypingNow(false); aiClose(); savePage(pg); rerenderBlocks();
  if(focusId) focusBlock(focusId,pos);
}

/* ---- lomítkové menu: /ai a /shrnutí (b = blok, ve kterém se psalo) ---- */
function aiSlash(k,pg,b){
  const bi=pg.blocks.indexOf(b); if(bi<0) return;
  const blank=TEXT_TYPES.includes(b.type)&&isBlank(b.html)?b.id:null, rest=pg.blocks.filter(x=>x!==b), max=aiMaxChars();
  const title=pTitle(pg);
  if(k==='ai'){
    let src=(title?'# '+title+'\n\n':'')+aiMd(rest); if(src.length>max-4000) src=src.slice(0,max-4000);
    aiRun('write',{kind:'insert',pgId:pg.id,after:b.id,blank,src,state:'ask'});
    return;
  }
  /* shrnutí: vždy celá stránka */
  const body=aiMd(rest), src=(title?'# '+title+'\n\n':'')+body;
  if(!body.trim()) return toast('Na stránce zatím není co shrnout.');
  if(src.length>max) return toast('Stránka je na AI moc dlouhá. Shrň vybranou část přes ✦.');
  aiRun('pagesum',{kind:'insert',pgId:pg.id,after:b.id,blank,src,state:'run'});
}

/* ---- ✦ v horní liště stránky: otevře panel s chatem (kontext je nahoře v panelu) ---- */
function aiCtxBtn(pg){
  const c=aiCtxOf(pg), t='AI: chat nad stránkou'+(c.text?' · kontext: '+c.text.slice(0,60)+(c.text.length>60?'…':''):'');
  return `<button class="icon-btn ai-ctx-btn${aipIsOpen()?' on':''}" data-act="ai-ctx" title="${esc(t)}" aria-label="AI: chat nad stránkou"><svg viewBox="0 0 24 24"><path d="M12 3.5c.6 4.4 3.1 6.9 7.5 7.5-4.4.6-6.9 3.1-7.5 7.5-.6-4.4-3.1-6.9-7.5-7.5 4.4-.6 6.9-3.1 7.5-7.5z"/></svg></button>`;
}

export function initAi(){
  onBlocksRendered(aiPlace);
  /* Esc zavře náhled, ⌘↵ / Ctrl+↵ použije výsledek */
  document.addEventListener('keydown',e=>{
    if(!AP||S.modal) return;
    if(e.key==='Escape'&&!e.isComposing&&!S.pop&&!slash.open){ e.preventDefault(); e.stopPropagation(); aiClose(true); return; }
    if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&AP.state==='done'){ e.preventDefault(); e.stopPropagation(); aiApply(); }
  },true);
}

export { aiCapture, aiClose, aiCtxBtn, aiMenu, aiSlash };
