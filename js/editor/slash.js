/* Úkolníček – Nabídka „/“ a markdownové zkratky (# , - , [] …) */
import { $, clamp, norm, SLASH, TEXT_TYPES, TYPE_ICON, TYPE_LABEL } from '../core.js';
import { savePage } from '../store.js';
import { curPage, newBlock } from '../pages.js';
import { isIndex, openSubjPicker } from '../school.js';
import { isBlank, isBlankEl, sanitize } from '../sanitize.js';
import { caretOffset, caretRect, deleteOffsets, focusBlock, focusLine } from './caret.js';
import { rerenderBlocks } from './render.js';
import { insertSubjAt, insertTypeAt, setType } from './blocks.js';
import { placePop } from '../ui.js';
import { openLinkDialog } from './links.js';
import { pickImageBlock, pickImageInline } from './images.js';

/* ---- slash menu ---- */
let slash={open:false};
/* položky nabídky; „Předmět“ jen ve školním režimu se zapnutým Indexem */
const slashItems=()=>SLASH.filter(it=>!it.school||isIndex());
function openSlash(el,bid,start,mode){ slash={open:true,el,bid,start,mode,idx:0,items:slashItems()}; drawSlash(); }
function closeSlash(){ if(slash.open){ slash.open=false; const p=$('#slash'); if(p) p.remove(); } }
function slashQuery(){
  if(!slash.el||!document.contains(slash.el)) return null;
  const t=slash.el.textContent, off=caretOffset(slash.el);
  if(slash.mode==='plus') return t.slice(0,off);
  if(t[slash.start]!=='/'||off<=slash.start) return null;
  return t.slice(slash.start+1,off);
}
function updateSlash(){
  const q=slashQuery(); if(q==null||q.length>24){ closeSlash(); return; }
  const nq=norm(q.trim());
  slash.items=slashItems().filter(it=>!nq||norm(TYPE_LABEL[it.k]+' '+it.kw).includes(nq));
  if(!slash.items.length&&/\s$/.test(q)){ closeSlash(); return; }
  slash.idx=clamp(slash.idx,0,Math.max(0,slash.items.length-1));
  drawSlash();
}
function drawSlash(){
  let p=$('#slash');
  if(!p){ p=document.createElement('div'); p.id='slash'; p.className='pop'; p.setAttribute('role','listbox'); document.body.appendChild(p);
    p.addEventListener('mousedown',e=>e.preventDefault());
    p.addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b) chooseSlash(slash.items[+b.dataset.i]); });
  }
  p.innerHTML=slash.items.length?`<div class="pop-h">Bloky</div>`+slash.items.map((it,i)=>`<button class="pop-item ${i===slash.idx?'act':''}" data-i="${i}" role="option"><span class="pi-ic">${TYPE_ICON[it.k]}</span><span>${TYPE_LABEL[it.k]}<small>${it.hint}</small></span></button>`).join(''):`<div class="empty" style="padding:10px">Nic nenalezeno</div>`;
  const rc=caretRect()||slash.el.getBoundingClientRect();
  placePop(p,{left:rc.left,right:rc.right,top:rc.top,bottom:rc.bottom});
  const act=p.querySelector('.act'); if(act) act.scrollIntoView({block:'nearest'});
}
function chooseSlash(it){
  if(!it) return closeSlash();
  const el=slash.el, off=caretOffset(el), from=slash.mode==='plus'?0:slash.start;
  deleteOffsets(el,from,Math.max(from,off));
  closeSlash();
  const pg=curPage(); const bi=pg.blocks.findIndex(b=>b.id===slash.bid); if(bi<0) return;
  const b=pg.blocks[bi]; b.html=isBlankEl(el)?'':sanitize(el.innerHTML);
  if(it.k==='link'){ const s=getSelection(); openLinkDialog(el,s.rangeCount?s.getRangeAt(0).cloneRange():null); return; }
  if(it.k==='subj'){
    /* výběr předmětu z Indexu; prázdný řádek se nahradí blokem předmětu, jinak se vloží pod něj */
    savePage(pg);
    openSubjPicker(el,su=>{ const i=pg.blocks.indexOf(b); if(i<0) return; insertSubjAt(pg,i,su,isBlank(b.html)); });
    return;
  }
  if(it.k==='image'){
    if(b.type==='p'&&isBlank(b.html)){ savePage(pg); pickImageBlock(pg.id,b.id,true); }
    else { const s=getSelection(); pickImageInline(el,s.rangeCount?s.getRangeAt(0).cloneRange():null); }
    return;
  }
  insertTypeAt(pg,bi,it.k,isBlank(b.html));
}
function slashKey(e){
  if(!slash.open) return false;
  if(!slash.el||!document.contains(slash.el)){ closeSlash(); return false; }
  if(e.key==='ArrowDown'){ e.preventDefault(); slash.idx=(slash.idx+1)%Math.max(1,slash.items.length); drawSlash(); return true; }
  if(e.key==='ArrowUp'){ e.preventDefault(); slash.idx=(slash.idx-1+slash.items.length)%Math.max(1,slash.items.length); drawSlash(); return true; }
  if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); chooseSlash(slash.items[slash.idx]); return true; }
  if(e.key==='Escape'){ e.preventDefault(); closeSlash(); return true; }
  return false;
}

/* ---- markdown shortcuts ---- */
const MD=[[/^###[\s ]/,'h3'],[/^##[\s ]/,'h2'],[/^#[\s ]/,'h1'],[/^[-*•][\s ]/,'bullet'],[/^\[[\s ]?\][\s ]/,'todo'],[/^1[.)][\s ]/,'num'],[/^>[\s ]/,'quote'],[/^![\s ]/,'callout']];
function mdBlock(x,t){
  const txt=t.textContent;
  if(txt==='---'){ const pg=x.pg; x.b.type='divider'; x.b.html=''; let next=pg.blocks[x.bi+1]; if(!next||!TEXT_TYPES.includes(next.type)){ next=newBlock('p'); pg.blocks.splice(x.bi+1,0,next);} savePage(pg); rerenderBlocks(); focusBlock(next.id,0); return true; }
  if(x.b.type!=='p') return false;
  for(const [re,k] of MD){ const m=txt.match(re); if(m&&caretOffset(t)===m[0].length){ deleteOffsets(t,0,m[0].length); x.b.html=sanitize(t.innerHTML); setType(x.pg,x.b,k); savePage(x.pg); rerenderBlocks(); focusBlock(x.b.id,0); return true; } }
  return false;
}
function mdLine(x,t){
  if(x.line.t!=='p') return false;
  const txt=t.textContent; let k=null,m;
  if((m=txt.match(/^[-*•][\s ]/))) k='bullet'; else if((m=txt.match(/^\[[\s ]?\][\s ]/))) k='todo';
  if(!k||caretOffset(t)!==m[0].length) return false;
  deleteOffsets(t,0,m[0].length); x.line.html=sanitize(t.innerHTML); x.line.t=k; savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l,0); return true;
}

export { closeSlash, drawSlash, mdBlock, mdLine, openSlash, slash, slashKey, updateSlash };
