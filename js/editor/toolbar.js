/* Úkolníček – Lišta formátování nad označeným textem a lišta typu řádku v buňce */
import { $, $$, clamp, COLOR_CZ, COLORS, IC } from '../core.js';
import { savePage } from '../store.js';
import { unwrap } from '../sanitize.js';
import { caretOffset, focusLine } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { drawSlash, slash } from './slash.js';
import { hasFiles, viewEl } from './events.js';
import { toast } from '../ui.js';
import { openLinkDialog } from './links.js';
import { hideImgSel, imgSel, pickImageInline, placeFrame } from './images.js';
import { aiUsable } from '../ai.js';
import { aiCapture, aiMenu } from './aiedit.js';
import { eqFromSelection } from './math.js';
import { crossDelete, fmtCrossBar } from './multisel.js';

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
/* Zrušit formátování (4.21.0): vlastní úprava DOM místo execCommand('removeFormat'), které se v prohlížečích chová různě
   a zvýraznění (mark) ani kód neruší. Výběr se vyjme, uvnitř se rozbalí formát, formátovací předci kolem výběru
   se v místě výběru rozdělí a výběr se vloží mezi ně. Odkazy, zmínky a rovnice zůstanou. */
const FMT_TAGS=new Set(['B','STRONG','I','EM','U','S','STRIKE','DEL','MARK','CODE','FONT','SUB','SUP']);
const isFmt=n=>n&&n.nodeType===1&&(FMT_TAGS.has(n.tagName)||n.tagName==='SPAN'&&!n.classList.contains('eq'));
function unwrapEl(el){ const p=el.parentNode; while(el.firstChild) p.insertBefore(el.firstChild,el); el.remove(); }
function clearRange(r,host){
  if(!r||r.collapsed||!host||!host.contains(r.commonAncestorContainer)) return false;
  const frag=r.extractContents();
  [...frag.querySelectorAll('*')].reverse().forEach(el=>{ if(isFmt(el)) unwrapEl(el); });
  let node=r.startContainer, off=r.startOffset;
  if(node.nodeType===3){ const tail=node.splitText(off); node=tail.parentNode; off=[...node.childNodes].indexOf(tail); }
  while(node!==host&&isFmt(node)&&host.contains(node)){
    const tail=node.cloneNode(false); while(node.childNodes[off]) tail.appendChild(node.childNodes[off]);
    const par=node.parentNode, idx=[...par.childNodes].indexOf(node);
    par.insertBefore(tail,node.nextSibling); off=idx+1; node=par;
  }
  const first=frag.firstChild, last=frag.lastChild;
  node.insertBefore(frag,node.childNodes[off]||null);
  [...host.querySelectorAll('*')].reverse().forEach(el=>{ if(isFmt(el)&&!el.textContent&&!el.querySelector('img,br')) el.remove(); });
  if(first&&last&&first.isConnected&&last.isConnected){ const s=getSelection(), nr=document.createRange(); nr.setStartBefore(first); nr.setEndAfter(last); s.removeAllRanges(); s.addRange(nr); }
  return true;
}
function clearSel(){
  const s=getSelection(); if(!s.rangeCount) return;
  const r=s.getRangeAt(0), n=r.commonAncestorContainer, host=(n.nodeType===1?n:n.parentElement).closest('.txt');
  if(clearRange(r,host)) host.dispatchEvent(new Event('input',{bubbles:true}));
}
/* Vložit z lišty: obsah schránky se pošle jako běžné vložení (stejná obsluha jako ⌘V: řádky na bloky, obrázky, bloky z Úkolníčku) */
async function pasteFromBar(){
  const dt=new DataTransfer();
  try{
    if(navigator.clipboard.read){
      for(const it of await navigator.clipboard.read()) for(const ty of it.types){
        const bl=await it.getType(ty);
        if(ty.startsWith('image/')) dt.items.add(new File([bl],'obrázek.'+(ty.split('/')[1]||'png'),{type:ty}));
        else if(ty==='text/plain'||ty==='text/html') dt.setData(ty,await bl.text());
      }
    } else dt.setData('text/plain',await navigator.clipboard.readText());
  }catch(_){ toast('Prohlížeč nedovolil číst schránku. Vložit jde pomocí ⌘V.'); return; }
  crossDelete();
  const s=getSelection(), n=s.rangeCount&&s.focusNode, t=n&&(n.nodeType===1?n:n.parentElement).closest('.txt, #page-title, .pk, .pv, .cap');
  if(!t) return;
  hideFmt();
  const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});
  if(ev.clipboardData) t.dispatchEvent(ev); else document.execCommand('insertText',false,dt.getData('text/plain'));
}
let fmtT=null;
const TOUCH=matchMedia('(pointer:coarse)');

function updateFmt(){
  const s=getSelection();
  if(!s.rangeCount||s.isCollapsed){ hideFmt(); return; }
  const n=s.anchorNode; const el=n&&(n.nodeType===1?n:n.parentElement); const host=el&&el.closest('.txt');
  /* výběr přes víc bloků: celá lišta kromě odkazu a rovnice (ty patří do jednoho bloku) */
  const multi=!!host&&document.body.classList.contains('xsel')&&!!host.closest('#blocks')&&!host.contains(s.focusNode);
  if(!host||!host.closest('#doc')||(!multi&&(host.closest('.b-code')||!host.contains(s.focusNode)))){ hideFmt(); return; }
  fmt.classList.toggle('multi',multi); fmt.classList.toggle('no-ai',!aiUsable());
  const rc=s.getRangeAt(0).getBoundingClientRect(); if(!rc.width&&!rc.height){ hideFmt(); return; }
  fmt.hidden=false; hideCellbar();
  const w=fmt.offsetWidth,h=fmt.offsetHeight;
  if(!TOUCH.matches){
    /* počítač: lišta u kurzoru (konec výběru), ✦ jako první tlačítko hned pod ním; výběr zpět nahoru → nad řádek */
    const back=selBack(s), fr=selEndRect(s,back)||rc;
    let top=back?fr.top-h-6:fr.bottom+6;
    if(top+h>innerHeight-8) top=fr.top-h-6; if(top<8) top=fr.bottom+6;
    fmt.style.left=clamp(fr.left-14,8,innerWidth-w-8)+'px'; fmt.style.top=top+'px';
    return;
  }
  fmt.style.left=clamp(rc.left+rc.width/2-w/2,8,innerWidth-w-8)+'px';
  {
    /* telefon: nad výběrem je systémová nabídka (Kopírovat, Vyjmout…), naše lišta jde pod výběr, za úchyty výběru.
       Když se pod výběr nevejde (klávesnice), dá se nad systémovou nabídku. */
    const vv=window.visualViewport, bottom=vv?vv.offsetTop+vv.height:innerHeight, below=rc.bottom+34;
    fmt.style.top=(below+h<=bottom-8?below:Math.max(8,rc.top-h-64))+'px';
  }
}
/* poloha kurzoru na konci výběru (tam, kde se pustila myš) */
function selEndRect(s,back){
  try{
    /* kurzor v textu: přesná poloha */
    if(s.focusNode&&s.focusNode.nodeType===3){
      const c=document.createRange(); c.setStart(s.focusNode,s.focusOffset); c.collapse(true);
      const r=c.getClientRects()[0]; if(r&&r.height) return r;
    }
    /* výběr dotažený až za konec textu (kurzor mimo text): konec posledního vybraného řádku */
    const rs=[...s.getRangeAt(0).getClientRects()].filter(r=>r.width>1&&r.height>1);
    const r=back?rs[0]:rs[rs.length-1];
    if(r) return back?{left:r.left,right:r.left,top:r.top,bottom:r.bottom}:{left:r.right,right:r.right,top:r.top,bottom:r.bottom};
  }catch(_){}
  return null;
}
function selBack(s){
  if(s.anchorNode===s.focusNode) return s.focusOffset<s.anchorOffset;
  return !!(s.anchorNode&&s.focusNode&&(s.anchorNode.compareDocumentPosition(s.focusNode)&Node.DOCUMENT_POSITION_PRECEDING));
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
  /* lišta buňky (od 4.20.0): jen ikony, název v bublině */
  cellbar.innerHTML=[['p',IC.textT,'Text'],['bullet',IC.bullets,'Odrážka'],['todo',IC.todo,'Úkol'],['img',IC.image,'Obrázek'],['link',IC.link,'Odkaz']].map(([k,ic,t])=>`<button data-lt="${k}" title="${t}" aria-label="${t}">${ic}</button>`).join('');
  fmt.innerHTML=`<button data-f="ai" class="fmt-ai" aria-label="AI" title="AI: opravit, přeformulovat, shrnout…">${IC.spark}</button><span class="sep fmt-ai"></span><button data-f="bold" aria-label="Tučně"><b>B</b></button><button data-f="italic" aria-label="Kurzíva"><i>I</i></button><button data-f="underline" aria-label="Podtržení"><u>U</u></button><button data-f="strikeThrough" aria-label="Přeškrtnutí"><s>S</s></button><button data-f="link" aria-label="Odkaz" title="Udělat z textu odkaz">${IC.link}</button><button data-f="eq" aria-label="Rovnice" title="Udělat z textu rovnici (LaTeX, ⌘⇧E)">∑</button><span class="sep"></span>${COLORS.map(c=>`<button class="sw hl-${c}" data-f="hl-${c}" aria-label="Zvýraznit: ${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}<span class="sep"></span><button data-f="clear" aria-label="Zrušit formátování" title="Zrušit formátování (tučné, kurzíva, zvýraznění…)">${IC.clearFmt}</button><button data-f="copy" class="fmt-clip" aria-label="Kopírovat" title="Kopírovat (⌘C)">${IC.clip}</button><button data-f="paste" class="fmt-clip" aria-label="Vložit" title="Vložit (⌘V)">${IC.paste}</button><button data-f="del" class="fmt-clip danger" aria-label="Odstranit" title="Odstranit (⌫)">${IC.trash}</button>`;
  fmt.addEventListener('mousedown',e=>e.preventDefault());
  fmt.addEventListener('click',e=>{
    const b=e.target.closest('[data-f]'); if(!b) return; const f=b.dataset.f;
    if(f==='ai'){
      const sel=aiCapture(), s=getSelection(), fn=s.focusNode, fe=fn&&(fn.nodeType===1?fn:fn.parentElement);
      const at={rect:b.getBoundingClientRect(),follow:fe&&fe.closest('#blocks > .blk')};
      hideFmt(); aiMenu(b,sel,at); return;
    }
    if(f==='link'){ const s=getSelection(); if(!s.rangeCount) return; const r=s.getRangeAt(0); const n=r.commonAncestorContainer; const host=(n.nodeType===1?n:n.parentElement).closest('.txt'); if(host){ hideFmt(); openLinkDialog(host,r.cloneRange(),true); } return; }
    if(f==='eq'){ hideFmt(); eqFromSelection(); return; }
    if(f==='copy'){ document.execCommand('copy'); toast('Zkopírováno'); return; }
    if(f==='del'){ if(!crossDelete()) document.execCommand('delete'); hideFmt(); return; }
    if(f==='paste'){ pasteFromBar(); return; }
    if(fmt.classList.contains('multi')){
      if(f.startsWith('hl-')) fmtCrossBar(null,()=>applyMark(f));
      else if(f==='clear') fmtCrossBar(null,clearSel);
      else fmtCrossBar(f);
      updateFmt(); return;
    }
    if(f.startsWith('hl-')) applyMark(f);
    else if(f==='clear') clearSel();
    else document.execCommand(f);
    updateFmt();
  });
  /* tažení výběru v textu: lišta formátu pustí myš skrz (body.mdrag v controls.css) */
  $('#view').addEventListener('mousedown',e=>{ if(e.button===0) document.body.classList.add('mdrag'); });
  document.addEventListener('mouseup',()=>document.body.classList.remove('mdrag'));
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
  $('#main').addEventListener('scroll',()=>{ $('#main').classList.toggle('scrolled',$('#main').scrollTop>4); placeFrame(); if(!fmt.hidden) updateFmt(); if(slash.open) drawSlash(); if(cellTarget&&!cellbar.hidden) showCellbar(cellTarget); },{passive:true});
}

export { applyMark, hideCellbar, hideFmt, showCellbar };
