/* Úkolníček – Výběr přes víc bloků: (1) textu tažením myši, (2) celých bloků (Esc, Shift+klik, tažení z okraje)
   Každý blok je samostatné editovatelné pole a prohlížeč by výběr nepustil ven z bloku.
   Když myš při tažení přejede do jiného bloku, bloky se na chvíli přepnou na needitovatelné,
   výběr pak jde přes celou stránku. Při dalším kliknutí nebo psaní se vše vrátí. */
import { $, $$, clamp, clone, esc, plain, rid, TEXT_TYPES, TYPE_ICON, TYPE_LABEL } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { curPage, newBlock, pTitle } from '../pages.js';
import { subjLabel } from '../school.js';
import { sanitize } from '../sanitize.js';
import { caretOffset, focusBlock, focusEl } from './caret.js';
import { ctxOf, isHeading, keepVisible, rerenderBlocks, sectionEnd } from './render.js';
import { setType } from './blocks.js';
import { openPop, toast } from '../ui.js';
import { rangeFromPoint } from './images.js';
import { aiUsable } from '../ai.js';
import { aiMenu } from './aiedit.js';
import { fragText, htmlToCode } from './code.js';
import { textToEq } from './math.js';

let xs=null;      /* rozběhnutý tah: {host, node, off, on} */
let active=false; /* bloky jsou přepnuté na needitovatelné */

const topBlk=el=>{ const b=el&&el.closest&&el.closest('#blocks > .blk'); return b||null; };
const mainTxt=blk=>blk&&$(':scope > .row > .txt',blk);

function startCross(){
  active=true; document.body.classList.add('xsel');
  $$('#blocks .txt[contenteditable="true"]').forEach(t=>t.setAttribute('contenteditable','false'));
}
function endCross(){
  if(!active) return; active=false; document.body.classList.remove('xsel');
  $$('#blocks .txt[contenteditable="false"]').forEach(t=>t.setAttribute('contenteditable','true'));
}
/* bod výběru pod myší; mimo text se přichytí na začátek/konec nejbližšího bloku */
function pointAt(x,y,down){
  const r=rangeFromPoint(x,y);
  if(r&&r.startContainer&&r.startContainer.parentElement&&r.startContainer.parentElement.closest('#blocks .txt')) return [r.startContainer,r.startOffset];
  const blks=$$('#blocks > .blk'); if(!blks.length) return null;
  let best=blks[0];
  for(const b of blks){ const rc=b.getBoundingClientRect(); if(rc.top<=y) best=b; else break; }
  const rc=best.getBoundingClientRect(), t=mainTxt(best)||best, end=down||y>rc.top+rc.height/2;
  return [t,end?t.childNodes.length:0];
}
function curRange(){ const s=getSelection(); return s.rangeCount&&!s.isCollapsed?s.getRangeAt(0):null; }
/* bloky, kterých se výběr dotýká, s vybranou částí textu */
function picked(range){
  const pg=curPage(); if(!pg) return [];
  return $$('#blocks > .blk').filter(el=>range.intersectsNode(el)).map(el=>{
    const b=pg.blocks.find(x=>x.id===el.dataset.id); if(!b) return null;
    const t=mainTxt(el); let part=null;
    if(t&&TEXT_TYPES.includes(b.type)){
      part=document.createRange(); part.selectNodeContents(t);
      if(t.contains(range.startContainer)||t===range.startContainer) part.setStart(range.startContainer,range.startOffset);
      if(t.contains(range.endContainer)||t===range.endContainer) part.setEnd(range.endContainer,range.endOffset);
    }
    return {el,b,t,part};
  }).filter(Boolean);
}
const fragHtml=r=>{ const d=document.createElement('div'); d.appendChild(r.cloneContents()); return sanitize(d.innerHTML); };
/* prostý text s odrážkami a zaškrtávátky; vložení zpět do Úkolníčku z nich udělá stejné bloky */
function toClipboard(items){
  const txt=[], html=[]; let list=null;
  const close=()=>{ if(list){ html.push(`</${list}>`); list=null; } };
  items.forEach(({el,b,part})=>{
    const ind='  '.repeat(b.level||0);
    if(b.type==='table'){
      close(); const rowsTxt=b.rows.map(r=>r.cells.map(c=>c.lines.map(l=>{ const d=document.createElement('div'); d.innerHTML=l.html; return d.textContent; }).join(' / ')).join('\t'));
      txt.push(...rowsTxt); html.push('<table>'+b.rows.map(r=>'<tr>'+r.cells.map(c=>'<td>'+c.lines.map(l=>sanitize(l.html)).join('<br>')+'</td>').join('')+'</tr>').join('')+'</table>'); return;
    }
    if(b.type==='subj'){ close(); const su=S.subjects&&S.subjects[b.subj], s=su?subjLabel(su):plain(b.html).trim(); txt.push('# '+s); html.push(`<h1>${esc(s)}</h1>`); return; }
    if(b.type==='page'){ close(); const s=pTitle(S.pages[b.pageId]); txt.push(ind+s); html.push(`<p>${esc(s)}</p>`); return; }
    /* obrázek, kresba a oddělovač mají v textu jen zástupný zápis; v Úkolníčku se vloží celé (viz rememberClip) */
    if(b.type==='image'){ close(); const s=`[${b.draw?'Kresba':'Obrázek'}${b.caption?': '+plain(b.caption):''}]`; txt.push(s); html.push(`<p>${esc(s)}</p>`); return; }
    if(b.type==='divider'){ close(); txt.push('---'); html.push('<hr>'); return; }
    if(!TEXT_TYPES.includes(b.type)) return;
    if(b.type==='code'){ close(); const c=part?fragText(part.cloneContents()):htmlToCode(b.html); txt.push(c); html.push(`<pre>${esc(c)}</pre>`); return; }
    /* část textu (výběr textem), nebo celý blok (výběr bloků) */
    const s=part?part.toString():plain(b.html||''), h=part?fragHtml(part):sanitize(b.html||'');
    if(b.type==='bullet'||b.type==='num'){
      const tag=b.type==='bullet'?'ul':'ol'; if(list!==tag){ close(); html.push(`<${tag}>`); list=tag; }
      const mk=b.type==='bullet'?'- ':(((el&&$('.mk.num',el))||{}).textContent||'1.').trim()+' ';
      txt.push(ind+mk+s); html.push(`<li>${h}</li>`); return;
    }
    close();
    if(b.type==='quote'){ txt.push(ind+'> '+s); html.push(`<blockquote>${h}</blockquote>`); return; }
    if(b.type==='todo'){ txt.push(ind+(b.done?'[x] ':'[ ] ')+s); html.push(`<p>${b.done?'☑':'☐'} ${h}</p>`); return; }
    const hm=/^h([1-3])$/.exec(b.type); if(hm){ txt.push('#'.repeat(+hm[1])+' '+s); html.push(`<h${hm[1]}>${h}</h${hm[1]}>`); return; }
    txt.push(ind+s); html.push(`<p>${h}</p>`);
  });
  close();
  return {text:txt.join('\n'),html:html.join('')};
}
/* výběr celého textu jednoho bloku (nadpis, odrážka, úkol…): kopíruje se i typ bloku */
function wholeBlock(r){
  const n=r.commonAncestorContainer, t=(n.nodeType===1?n:n.parentElement)?.closest('.txt'); if(!t) return null;
  const el=topBlk(t); if(!el||mainTxt(el)!==t) return null;
  const pg=curPage(), b=pg&&pg.blocks.find(x=>x.id===el.dataset.id);
  if(!b||!TEXT_TYPES.includes(b.type)||['p','code','callout'].includes(b.type)||!t.textContent.trim()) return null;
  const pre=document.createRange(); pre.selectNodeContents(t); pre.setEnd(r.startContainer,r.startOffset);
  const post=document.createRange(); post.selectNodeContents(t); post.setStart(r.endContainer,r.endOffset);
  return pre.toString().trim()||post.toString().trim()?null:{el,b,t,part:null};
}
/* Vnitřní schránka bloků: když kopie obsahuje obrázek, kresbu, tabulku, oddělovač, rovnici, podstránku nebo předmět,
   uloží se celé bloky v zařízení ('uk-clip', jen tady, mimo data). Vložení v Úkolníčku (i na jinou stránku) je pozná
   podle stejného textu ve schránce a vloží je jako bloky; obrázky a kresby sdílí stejný soubor (jako u Duplikovat). */
const CLIP_KEY='uk-clip';
function rememberClip(items,c){
  const blocks=items.map(({b,part})=>{ const o=clone(b); if(part&&TEXT_TYPES.includes(b.type)) o.html=fragHtml(part); return o; });
  try{
    if(blocks.some(b=>!TEXT_TYPES.includes(b.type))) localStorage.setItem(CLIP_KEY,JSON.stringify({text:c.text,blocks}));
    else localStorage.removeItem(CLIP_KEY);
  }catch(_){}
}
const normClip=s=>String(s||'').replace(/\r/g,'').trim();
export function clipBlocks(dt){
  let c=null; try{ c=JSON.parse(localStorage.getItem(CLIP_KEY)||'null'); }catch(_){}
  if(!c||!Array.isArray(c.blocks)||!c.blocks.length||normClip(dt.getData('text/plain'))!==normClip(c.text)) return null;
  return c.blocks.filter(b=>b&&typeof b==='object'&&typeof b.type==='string');
}
/* vloží bloky z vnitřní schránky pod blok s kurzorem (prázdný řádek nahradí) */
export function pasteBlocks(t,blocks){
  const x=ctxOf(t); if(!x||!blocks.length) return;
  if(LOCK&&blocks.some(b=>!TEXT_TYPES.includes(b.type))){ toast('Zamčeno: obrázky a další bloky jde vložit po odemčení.'); return; }
  const pg=x.pg, map=new Map(), copies=blocks.map(b=>{ const c=clone(b); c.id=rid(); map.set(b.id,c.id); return c; });
  copies.forEach(c=>{ if(c.until&&map.has(c.until)) c.until=map.get(c.until); else { delete c.until; delete c.untilVis; } });
  const blank=TEXT_TYPES.includes(x.b.type)&&x.b.type!=='code'&&!t.textContent.trim();
  let at;
  if(blank){ at=x.bi; pg.blocks.splice(x.bi,1); }
  else { at=isHeading(x.b.type)&&x.b.collapsed?sectionEnd(pg.blocks,x.bi):x.bi+1; keepVisible(pg.blocks,at); }
  pg.blocks.splice(at,0,...copies);
  let nx=pg.blocks[at+copies.length], last=copies[copies.length-1];
  const pos=TEXT_TYPES.includes(last.type)?'end':0;
  if(!TEXT_TYPES.includes(last.type)){ if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); pg.blocks.splice(at+copies.length,0,nx); } last=nx; }
  savePage(pg); rerenderBlocks(); focusBlock(last.id,pos);
}
/* příznak pro vložení zpět do Úkolníčku: i jeden řádek se vloží jako blok svého typu */
export const UK_CLIP='application/x-ukolnicek-blocks';
const setClip=(e,c,items)=>{ if(items) rememberClip(items,c); e.clipboardData.setData('text/plain',c.text); e.clipboardData.setData('text/html',c.html); try{ e.clipboardData.setData(UK_CLIP,'1'); }catch(_){} };
/* smazání výběru: první blok si nechá text před výběrem, k němu se připojí zbytek posledního bloku */
function deleteSel(items){
  const pg=curPage(); if(!pg||!items.length) return;
  if(LOCK){ toast('Zamčeno: mazat přes víc bloků jde po odemčení.'); return; }
  const first=items[0], last=items[items.length-1], firstTxt=!!first.part;
  let tail='', pos=0;
  if(last!==first&&last.part){ const r=document.createRange(); r.selectNodeContents(last.t); r.setStart(last.part.endContainer,last.part.endOffset); tail=fragHtml(r); }
  const drop=new Set(items.slice(firstTxt?1:0).map(i=>i.b.id));
  if(firstTxt){ first.part.deleteContents(); pos=first.t.textContent.length; first.b.html=sanitize(first.t.innerHTML)+tail; }
  else if(last.part&&tail){ drop.delete(last.b.id); last.b.html=tail; }
  pg.blocks=pg.blocks.filter(b=>!drop.has(b.id));
  if(!pg.blocks.length) pg.blocks.push(newBlock('p'));
  endCross(); savePage(pg); rerenderBlocks();
  const keep=firstTxt?first.b:(last.part&&tail?last.b:null);
  if(keep){ const t=$(`#blocks .blk[data-id="${keep.id}"] .txt`); if(t) focusEl(t,pos); }
}

/* ================= výběr celých bloků ================= */
let bs=null;          /* {a: kotva, f: konec} – ID viditelných bloků */
let band=null, bandJust=0;
const visEls=()=>$$('#blocks > .blk');
const visIds=()=>visEls().map(x=>x.dataset.id);
const bar=document.createElement('div'); bar.id='bselbar'; bar.className='bselbar'; bar.hidden=true;
/* rozsah v datech; sbalený nadpis na konci bere i svou schovanou sekci */
function bRange(){
  const pg=curPage(); if(!pg||!bs) return null;
  const vis=visIds(), ia=vis.indexOf(bs.a), ifo=vis.indexOf(bs.f); if(ia<0||ifo<0) return null;
  const lo=Math.min(ia,ifo), hi=Math.max(ia,ifo);
  const i0=pg.blocks.findIndex(b=>b.id===vis[lo]); let i1=pg.blocks.findIndex(b=>b.id===vis[hi]); if(i0<0||i1<0) return null;
  const last=pg.blocks[i1]; if(isHeading(last.type)&&last.collapsed) i1=sectionEnd(pg.blocks,i1)-1;
  return {pg,i0,i1,lo,hi,vis,ids:vis.slice(lo,hi+1)};
}
function markSel(){
  $$('#blocks .blk.bsel').forEach(x=>x.classList.remove('bsel'));
  const r=bRange(); if(!r){ clearBsel(); return; }
  r.ids.forEach(id=>{ const el=$(`#blocks > .blk[data-id="${id}"]`); if(el) el.classList.add('bsel'); });
  drawBar(r); document.dispatchEvent(new Event('uk-bsel'));
}
function selectBlocks(a,f){
  endCross(); const ae=document.activeElement; if(ae&&ae!==document.body&&ae.closest&&ae.closest('#view')) ae.blur();
  getSelection().removeAllRanges(); bs={a,f:f||a}; document.body.classList.add('bmode'); markSel();
}
function clearBsel(){
  if(!bs&&bar.hidden) return; bs=null; document.body.classList.remove('bmode'); document.dispatchEvent(new Event('uk-bsel'));
  $$('#blocks .blk.bsel').forEach(x=>x.classList.remove('bsel')); bar.hidden=true;
}
function drawBar(r){
  const n=r.ids.length, cnt=n===1?'1 blok':n<5?`${n} bloky`:`${n} bloků`;
  /* smazat vybrané bloky jde i se zámkem: výběr je záměrný a ⌘Z je vrátí */
  bar.innerHTML=`<span class="bs-n">${cnt}</span>`+(aiUsable()?'<button data-b="ai" class="bs-ai" data-popanchor title="AI: opravit, přeformulovat, shrnout…">✦ AI</button>':'')+(LOCK?'':`<button data-b="type" data-popanchor>Převést na ▾</button><button data-b="dup" title="⌘D">Duplikovat</button>`)
    +`<button data-b="copy" title="⌘C">Kopírovat</button><button data-b="del" class="danger" title="⌫">Smazat</button><button data-b="x" class="bs-x" aria-label="Zrušit výběr" title="Esc">×</button>`;
  bar.hidden=false; placeBar();
}
function placeBar(){
  if(bar.hidden) return; const el=$('#blocks > .blk.bsel'); if(!el){ bar.hidden=true; return; }
  const rc=el.getBoundingClientRect(), doc=$('#doc').getBoundingClientRect(), h=bar.offsetHeight||36;
  const top=rc.top-h-8<64?Math.min(innerHeight-h-8,($$('#blocks > .blk.bsel').pop().getBoundingClientRect().bottom+8)):rc.top-h-8;
  bar.style.top=Math.max(8,top)+'px'; bar.style.left=clamp(doc.left+60,8,innerWidth-bar.offsetWidth-8)+'px';
}
const blockItems=r=>r.pg.blocks.slice(r.i0,r.i1+1).map(b=>({b,el:$(`#blocks > .blk[data-id="${b.id}"]`),part:null}));
function after(fn){ return (...a)=>{ const r=bRange(); if(!r) return clearBsel(); return fn(r,...a); }; }
const guard=msg=>{ if(LOCK){ toast(msg||'Zamčeno: bloky jde přesouvat, mazat a měnit po odemčení.'); return true; } return false; };
const delBlocks=after(r=>{
  r.pg.blocks.splice(r.i0,r.i1-r.i0+1); if(!r.pg.blocks.length) r.pg.blocks.push(newBlock('p'));
  savePage(r.pg); clearBsel(); rerenderBlocks();
  const prev=r.vis[r.lo-1]||r.vis[r.hi+1], t=prev&&$(`#blocks .blk[data-id="${prev}"] .txt`), any=$('#blocks .txt');
  if(t) focusEl(t,r.vis[r.lo-1]?'end':'start'); else if(any) focusEl(any,'start');
});
const dupBlocks=after(r=>{
  if(guard()) return;
  const map=new Map(), copies=r.pg.blocks.slice(r.i0,r.i1+1).map(b=>{ const c=clone(b); c.id=rid(); map.set(b.id,c.id); return c; });
  copies.forEach(c=>{ if(c.until&&map.has(c.until)) c.until=map.get(c.until); });
  r.pg.blocks.splice(r.i1+1,0,...copies); savePage(r.pg); rerenderBlocks();
  bs={a:map.get(r.ids[0]),f:map.get(r.ids[r.ids.length-1])}; markSel();
});
const indentBlocks=after((r,d)=>{
  if(guard()) return;
  r.pg.blocks.slice(r.i0,r.i1+1).forEach(b=>{ if(b.type!=='image') b.level=clamp((b.level||0)+d,0,4); });
  savePage(r.pg); rerenderBlocks(); markSel();
});
const typeBlocks=after((r,k)=>{
  if(guard()) return;
  r.pg.blocks.slice(r.i0,r.i1+1).forEach(b=>{ if(!TEXT_TYPES.includes(b.type)) return; if(k==='eq'){ if(plain(b.html).trim()) textToEq(b); } else setType(r.pg,b,k); });
  if(k==='eq'&&r.i1===r.pg.blocks.length-1&&r.pg.blocks[r.i1].type==='eq') r.pg.blocks.push(newBlock('p'));
  savePage(r.pg); rerenderBlocks(); markSel();
});
/* posun o jeden viditelný blok nahoru/dolů (přes sbalenou sekci skočí celý) */
function moveRange(pg,i0,i1,lo,hi,vis,dir){
  const tgtId=dir<0?vis[lo-1]:vis[hi+1]; if(!tgtId) return false;
  const part=pg.blocks.splice(i0,i1-i0+1); let t=pg.blocks.findIndex(b=>b.id===tgtId);
  if(dir>0){ const tb=pg.blocks[t]; t=isHeading(tb.type)&&tb.collapsed?sectionEnd(pg.blocks,t):t+1; }
  pg.blocks.splice(t,0,...part); savePage(pg); rerenderBlocks(); return true;
}
const moveBlocks=after((r,dir)=>{ if(guard()) return; if(moveRange(r.pg,r.i0,r.i1,r.lo,r.hi,r.vis,dir)){ markSel(); const el=$('#blocks > .blk.bsel'); if(el){ const rc=el.getBoundingClientRect(); if(rc.top<70||rc.bottom>innerHeight-40) el.scrollIntoView({block:'center'}); placeBar(); } } });
async function copyBlocks(r){ return copyItems(blockItems(r)); }
async function copyItems(items){
  const c=toClipboard(items); rememberClip(items,c);
  try{ await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([c.text],{type:'text/plain'}),'text/html':new Blob([c.html],{type:'text/html'})})]); }
  catch(_){ try{ await navigator.clipboard.writeText(c.text); }catch(__){ return toast('Kopírování se nepovedlo. Zkus ⌘C.'); } }
  toast('Zkopírováno');
}
/* ⋮⋮ menu bloku: patří blok do výběru víc celých bloků? Pak se akce z menu použijí na všechny vybrané */
/* ID vybraných celých bloků (i obsah sbalené sekce) pro panel AI, jinak null */
export function bselIds(){ const r=bs&&bRange(); return r?r.pg.blocks.slice(r.i0,r.i1+1).map(b=>b.id):null; }
export function bselCount(id){ const r=bs&&bRange(); return r&&r.ids.length>1&&r.ids.includes(id)?r.ids.length:0; }
export const bulk={type:k=>typeBlocks(k),indent:d=>indentBlocks(d),move:d=>moveBlocks(d),dup:()=>dupBlocks(),del:()=>delBlocks(),copy:()=>{ const r=bRange(); if(r) copyBlocks(r); }};
export function copyOne(b){ return copyItems([{b,el:$(`#blocks > .blk[data-id="${b.id}"]`),part:null}]); }
/* Esc v textu vybere celý blok, ⌥⇧↑/↓ posune blok, ⌘A podruhé vybere všechny bloky (volá events.js) */
export function blockEsc(e,t){
  const blk=topBlk(t); if(!blk) return false;
  if(e.key==='Escape'&&!e.isComposing){ e.preventDefault(); e.stopPropagation(); selectBlocks(blk.dataset.id); return true; }
  if(e.altKey&&e.shiftKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){
    e.preventDefault(); if(guard()) return true;
    const pg=curPage(), vis=visIds(), k=vis.indexOf(blk.dataset.id), i0=pg.blocks.findIndex(b=>b.id===blk.dataset.id); if(i0<0) return true;
    let i1=i0; const b=pg.blocks[i0]; if(isHeading(b.type)&&b.collapsed) i1=sectionEnd(pg.blocks,i0)-1;
    const off=caretOffset(t), inCell=t.classList.contains('cell-txt');
    if(moveRange(pg,i0,i1,k,k,vis,e.key==='ArrowUp'?-1:1)&&!inCell) focusBlock(b.id,off);
    return true;
  }
  if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='a'){
    const s=getSelection(); if(t.textContent.length&&s.toString().length<t.textContent.length) return false;
    e.preventDefault(); const v=visIds(); if(v.length) selectBlocks(v[0],v[v.length-1]); return true;
  }
  return false;
}

export function initMultiSel(){
  const view=$('#view');
  document.body.appendChild(bar);
  bar.addEventListener('mousedown',e=>e.preventDefault());
  bar.addEventListener('click',e=>{
    const b=e.target.closest('[data-b]'); if(!b) return; const v=b.dataset.b, r=bRange(); if(!r) return clearBsel();
    if(v==='ai'){ const sel={kind:'blocks',pgId:r.pg.id,ids:r.pg.blocks.slice(r.i0,r.i1+1).map(x=>x.id)}; aiMenu(b,sel); return; }
    if(v==='x') clearBsel(); else if(v==='del') delBlocks(); else if(v==='dup') dupBlocks(); else if(v==='copy') copyBlocks(r);
    else if(v==='type') openPop(b,`<div class="pop-h">Převést na</div>`+[...TEXT_TYPES,'eq'].map(k=>`<button class="pop-item" data-v="${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join(''),k=>typeBlocks(k));
  });
  $('#main').addEventListener('scroll',()=>{ if(bs) placeBar(); band&&band.on&&bandMove(band.lx,band.ly); },{passive:true});
  addEventListener('resize',()=>{ if(bs) placeBar(); });
  /* po kliknutí za tažením rámečku se nic neotevře ani nepřidá */
  view.addEventListener('click',e=>{ if(Date.now()-bandJust<250){ e.stopPropagation(); e.preventDefault(); } },true);
  view.addEventListener('mousedown',e=>{
    if(e.button!==0) return;
    /* Shift+klik: výběr bloků od aktuálního (nebo vybraného) bloku po kliknutý */
    if(e.shiftKey){
      const blk=topBlk(e.target), ae=document.activeElement, from=bs?bs.a:(ae&&ae.closest&&topBlk(ae)?topBlk(ae).dataset.id:null);
      if(blk&&from&&from!==blk.dataset.id){ e.preventDefault(); selectBlocks(from,blk.dataset.id); return; }
    }
    /* klik na ⋮⋮ u vybraného bloku výběr nezruší; výběr textu přes víc bloků se změní na výběr celých bloků */
    const grip=e.target.closest&&e.target.closest('#blocks > .blk .g-drag'), gb=grip&&topBlk(grip);
    if(gb){
      if(bselCount(gb.dataset.id)) return;
      const rg=active&&curRange(), its=rg?picked(rg):[];
      if(its.length>1&&its.some(i=>i.el===gb)){ selectBlocks(its[0].el.dataset.id,its[its.length-1].el.dataset.id); return; }
    }
    clearBsel();
    /* tažení z prázdného místa (okraj, mezera mezi bloky): rámeček vybírá celé bloky */
    if(!e.shiftKey&&$('#doc')&&!e.target.closest('.txt,.cap,button,a,input,textarea,select,img,.tbl-wrap,[contenteditable],.pop,.backlinks,.pagebar,.doc-head,.tpl,.ai-prev,.aip-chg')){
      band={x:e.clientX,y:e.clientY,st:$('#main').scrollTop,on:false,lx:e.clientX,ly:e.clientY};
    }
  });
  document.addEventListener('mousemove',e=>{ if(band){ if(!(e.buttons&1)){ endBand(); return; } bandMove(e.clientX,e.clientY); } });
  document.addEventListener('mouseup',()=>{ if(band) endBand(); });
  view.addEventListener('mousedown',e=>{
    endCross(); xs=null;
    if(e.button!==0||e.shiftKey||e.detail>1) return;
    const t=e.target.closest&&e.target.closest('#blocks > .blk > .row > .txt'); if(!t) return;
    const p=pointAt(e.clientX,e.clientY); if(!p) return;
    xs={host:t,node:p[0],off:p[1]};
  });
  document.addEventListener('mousemove',e=>{
    if(!xs) return; if(!(e.buttons&1)){ xs=null; return; }
    if(!active){
      const over=document.elementFromPoint(e.clientX,e.clientY), blk=topBlk(over);
      if(!blk||blk===topBlk(xs.host)) return;
      startCross();
    }
    const p=pointAt(e.clientX,e.clientY); if(!p) return;
    try{ getSelection().setBaseAndExtent(xs.node,xs.off,p[0],p[1]); }catch(_){}
  });
  document.addEventListener('mouseup',()=>{ xs=null; });
  document.addEventListener('copy',e=>{
    if(bs&&!e.target.closest?.('input,textarea')){ const br=bRange(); if(!br) return; const it=blockItems(br), c=toClipboard(it); e.preventDefault(); setClip(e,c,it); return; }
    const r=curRange(); if(!r) return;
    if(!active){ const one=wholeBlock(r); if(!one) return; e.preventDefault(); setClip(e,toClipboard([one]),[one]); return; }
    const it=picked(r), c=toClipboard(it); e.preventDefault(); setClip(e,c,it);
  });
  document.addEventListener('cut',e=>{
    if(bs){ const br=bRange(); if(!br) return; e.preventDefault(); if(guard()) return; const it=blockItems(br), c=toClipboard(it); rememberClip(it,c); e.clipboardData.setData('text/plain',c.text); e.clipboardData.setData('text/html',c.html); delBlocks(); return; }
    const r=active&&curRange(); if(!r) return;
    const items=picked(r), c=toClipboard(items); rememberClip(items,c); e.preventDefault();
    e.clipboardData.setData('text/plain',c.text); e.clipboardData.setData('text/html',c.html);
    deleteSel(items);
  });
  /* klávesy ve výběru celých bloků */
  document.addEventListener('keydown',e=>{
    if(!bs||S.modal||(e.target.closest&&e.target.closest('input,textarea,select,.pop'))) return;
    const k=e.key, mod=e.metaKey||e.ctrlKey, r=bRange(); if(!r){ clearBsel(); return; }
    const stop=()=>{ e.preventDefault(); e.stopPropagation(); };
    if(['Shift','Alt','Meta','Control'].includes(k)) return;
    if(mod&&['c','x'].includes(k.toLowerCase())) return;   /* kopírování a vyjmutí řeší události copy/cut */
    if(k==='Escape'){ stop(); clearBsel(); return; }
    if(k==='ArrowUp'||k==='ArrowDown'){
      stop(); const dir=k==='ArrowUp'?-1:1;
      if(e.altKey&&e.shiftKey||mod&&e.shiftKey){ moveBlocks(dir); return; }
      const i=r.vis.indexOf(bs.f), n=r.vis[clamp(i+dir,0,r.vis.length-1)];
      if(e.shiftKey) bs.f=n; else bs={a:n,f:n};
      markSel(); const el=$(`#blocks > .blk[data-id="${bs.f}"]`); if(el) el.scrollIntoView({block:'nearest'}); placeBar(); return;
    }
    if(k==='Enter'){ stop(); const id=r.ids[0]; clearBsel(); const t=$(`#blocks > .blk[data-id="${id}"] .txt`); if(t) focusEl(t,'end'); return; }
    if(k==='Backspace'||k==='Delete'){ stop(); delBlocks(); return; }
    if(k==='Tab'){ stop(); indentBlocks(e.shiftKey?-1:1); return; }
    if(mod&&k.toLowerCase()==='d'){ stop(); dupBlocks(); return; }
    if(mod&&!e.altKey&&(e.code==='BracketLeft'||e.code==='BracketRight')){ stop(); indentBlocks(e.code==='BracketLeft'?-1:1); return; }
    if(mod&&k.toLowerCase()==='a'){ stop(); bs={a:r.vis[0],f:r.vis[r.vis.length-1]}; markSel(); return; }
    clearBsel();   /* cokoli jiného (⌘Z, psaní) výběr zruší */
  },true);
  /* klávesy ve výběru přes víc bloků: mazání smaže výběr, Esc ho zruší, psaní nejdřív vrátí editaci */
  document.addEventListener('keydown',e=>{
    if(!active) return;
    if(e.metaKey||e.ctrlKey||['Shift','Alt','Meta','Control'].includes(e.key)) return;
    if(e.key==='Backspace'||e.key==='Delete'){ const r=curRange(); e.preventDefault(); if(r) deleteSel(picked(r)); else endCross(); return; }
    if(e.key==='Escape'){ e.preventDefault(); getSelection().removeAllRanges(); endCross(); return; }
    if(/^Arrow/.test(e.key)&&e.shiftKey) return;
    const s=getSelection(), n=s.focusNode, host=n&&(n.nodeType===1?n:n.parentElement), t=host&&host.closest&&host.closest('#blocks .txt');
    endCross(); if(t){ e.preventDefault(); focusEl(t,'end'); }
  },true);
}

function bandMove(x,y){
  const m=$('#main'), mr=m.getBoundingClientRect();
  band.lx=x; band.ly=y;
  if(!band.on){ if(Math.abs(x-band.x)+Math.abs(y-band.y)<7) return; band.on=true; band.el=document.createElement('div'); band.el.className='band'; document.body.appendChild(band.el); }
  /* u okraje se stránka posouvá */
  if(y<mr.top+30) m.scrollTop-=14; else if(y>mr.bottom-30) m.scrollTop+=14;
  const y0=band.y-(m.scrollTop-band.st), top=Math.min(y0,y), bot=Math.max(y0,y);
  Object.assign(band.el.style,{left:Math.min(band.x,x)+'px',top:top+'px',width:Math.abs(x-band.x)+'px',height:(bot-top)+'px'});
  const hit=visEls().filter(el=>{ const rc=el.getBoundingClientRect(); return rc.bottom>top&&rc.top<bot; });
  if(hit.length){ if(!bs) selectBlocks(hit[0].dataset.id,hit[hit.length-1].dataset.id); else { bs={a:hit[0].dataset.id,f:hit[hit.length-1].dataset.id}; markSel(); } }
  else clearBsel();
}
function endBand(){ if(band&&band.on){ bandJust=Date.now(); if(band.el) band.el.remove(); } band=null; }

export { clearBsel };
