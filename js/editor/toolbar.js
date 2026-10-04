/* Úkolníček – Lišta formátování nad označeným textem a lišta typu řádku v buňce */
import { $, $$, clamp, COLOR_CZ, COLORS } from '../core.js';
import { savePage } from '../store.js';
import { unwrap } from '../sanitize.js';
import { caretOffset, focusLine } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { drawSlash, slash } from './slash.js';
import { hasFiles, viewEl } from './events.js';
import { openLinkDialog } from './links.js';
import { hideImgSel, imgSel, pickImageInline, placeFrame } from './images.js';

/* ---- format toolbar ---- */
const fmt=$('#fmt');

function applyMark(cls){
  const s=getSelection(); if(!s.rangeCount||s.isCollapsed) return;
  const r=s.getRangeAt(0); const ca=r.commonAncestorContainer; const caEl=ca.nodeType===1?ca:ca.parentElement;
  const host=caEl.closest('.txt'); if(!host) return;
  const anc=caEl.closest('mark');
  if(anc&&host.contains(anc)){ if(cls) anc.className=cls; else unwrap(anc); }
  else{
    const frag=r.extractContents(); frag.querySelectorAll('mark').forEach(unwrap);
    if(cls){ const m=document.createElement('mark'); m.className=cls; m.appendChild(frag); r.insertNode(m); const nr=document.createRange(); nr.selectNodeContents(m); s.removeAllRanges(); s.addRange(nr); }
    else r.insertNode(frag);
  }
  host.dispatchEvent(new Event('input',{bubbles:true}));
}
let fmtT=null;

function updateFmt(){
  const s=getSelection();
  if(!s.rangeCount||s.isCollapsed){ hideFmt(); return; }
  const n=s.anchorNode; const el=n&&(n.nodeType===1?n:n.parentElement); const host=el&&el.closest('.txt');
  if(!host||!host.closest('#doc')||!host.contains(s.focusNode)){ hideFmt(); return; }
  const rc=s.getRangeAt(0).getBoundingClientRect(); if(!rc.width&&!rc.height){ hideFmt(); return; }
  fmt.hidden=false; hideCellbar();
  const w=fmt.offsetWidth,h=fmt.offsetHeight;
  fmt.style.left=clamp(rc.left+rc.width/2-w/2,8,innerWidth-w-8)+'px';
  fmt.style.top=(rc.top-h-8<8?rc.bottom+8:rc.top-h-8)+'px';
}
function hideFmt(){ fmt.hidden=true; }

/* ---- table cell line-type bar ---- */
const cellbar=$('#cellbar'); let cellTarget=null;

function showCellbar(t){
  const x=ctxOf(t); if(!x||!x.line){ hideCellbar(); return; }
  cellTarget=t; cellbar.hidden=false;
  $$('button',cellbar).forEach(b=>b.classList.toggle('on',b.dataset.lt===x.line.t));
  if(!cellbar.hidden&&imgSel) hideImgSel();
  const rc=x.td.getBoundingClientRect(); const w=cellbar.offsetWidth;
  cellbar.style.left=clamp(rc.right-w,8,innerWidth-w-8)+'px';
  cellbar.style.top=Math.max(8,rc.top-cellbar.offsetHeight-4)+'px';
}
function hideCellbar(){ cellbar.hidden=true; cellTarget=null; }

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initToolbar(){
  fmt.innerHTML=`<button data-f="bold" aria-label="Tučně"><b>B</b></button><button data-f="italic" aria-label="Kurzíva"><i>I</i></button><button data-f="underline" aria-label="Podtržení"><u>U</u></button><button data-f="strikeThrough" aria-label="Přeškrtnutí"><s>S</s></button><button data-f="link" aria-label="Odkaz" title="Udělat z textu odkaz">🔗</button><span class="sep"></span>${COLORS.map(c=>`<button class="sw hl-${c}" data-f="hl-${c}" aria-label="Zvýraznit: ${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}<span class="sep"></span><button data-f="clear" aria-label="Zrušit formátování" title="Zrušit formátování">⌫</button>`;
  fmt.addEventListener('mousedown',e=>e.preventDefault());
  fmt.addEventListener('click',e=>{
    const b=e.target.closest('[data-f]'); if(!b) return; const f=b.dataset.f;
    if(f==='link'){ const s=getSelection(); if(!s.rangeCount) return; const r=s.getRangeAt(0); const n=r.commonAncestorContainer; const host=(n.nodeType===1?n:n.parentElement).closest('.txt'); if(host){ hideFmt(); openLinkDialog(host,r.cloneRange(),true); } return; }
    if(f.startsWith('hl-')) applyMark(f);
    else if(f==='clear'){ document.execCommand('removeFormat'); applyMark(null); }
    else document.execCommand(f);
    updateFmt();
  });
  document.addEventListener('selectionchange',()=>{ clearTimeout(fmtT); fmtT=setTimeout(updateFmt,80); });
  cellbar.addEventListener('mousedown',e=>e.preventDefault());
  cellbar.addEventListener('click',e=>{
    const b=e.target.closest('[data-lt]'); if(!b||!cellTarget) return;
    if(b.dataset.lt==='link'){ const s=getSelection(); openLinkDialog(cellTarget,s.rangeCount&&cellTarget.contains(s.getRangeAt(0).startContainer)?s.getRangeAt(0).cloneRange():null,!s.isCollapsed); return; }
    if(b.dataset.lt==='img'){ const s=getSelection(); pickImageInline(cellTarget,s.rangeCount&&cellTarget.contains(s.getRangeAt(0).startContainer)?s.getRangeAt(0).cloneRange():null); return; }
    const x=ctxOf(cellTarget); if(!x||!x.line) return;
    const off=caretOffset(cellTarget);
    x.line.t=b.dataset.lt; if(x.line.t!=='todo') delete x.line.done;
    savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l,off);
  });
  document.addEventListener('dragover',e=>{ if(hasFiles(e)) e.preventDefault(); });
  document.addEventListener('drop',e=>{ if(hasFiles(e)) e.preventDefault(); });
  viewEl.addEventListener('error',e=>{ if(e.target.tagName==='IMG') e.target.classList.add('broken'); },true);
  $('#main').addEventListener('scroll',()=>{ $('#main').classList.toggle('scrolled',$('#main').scrollTop>4); placeFrame(); if(!fmt.hidden) updateFmt(); if(slash.open) drawSlash(); },{passive:true});
}

export { applyMark, hideCellbar, hideFmt, showCellbar };
