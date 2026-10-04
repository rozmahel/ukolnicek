/* Úkolníček – Práce s kurzorem v editovatelném textu */
import { $ } from '../core.js';
import { isBlankEl, sanitize } from '../sanitize.js';

/* ================= caret helpers ================= */
function nodeAt(el,off){
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let n,acc=0,last=null;
  while((n=w.nextNode())){ const L=n.nodeValue.length; if(acc+L>=off) return [n,off-acc]; acc+=L; last=n; }
  return last?[last,last.nodeValue.length]:[el,0];
}
function setCaret(el,off){ const [n,o]=nodeAt(el,off); const r=document.createRange(); r.setStart(n,o); r.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
function caretOffset(el){ const s=getSelection(); if(!s.rangeCount) return 0; const r=s.getRangeAt(0); if(!el.contains(r.startContainer)&&r.startContainer!==el) return 0; const pre=document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer,r.startOffset); return pre.toString().length; }
function isCollapsed(){ const s=getSelection(); return s.rangeCount&&s.isCollapsed; }
function deleteOffsets(el,a,b){ const [n1,o1]=nodeAt(el,a),[n2,o2]=nodeAt(el,b); const r=document.createRange(); r.setStart(n1,o1); r.setEnd(n2,o2); r.deleteContents(); }
function splitAtCaret(el){
  const s=getSelection(); const r=s.getRangeAt(0); r.deleteContents();
  const tail=document.createRange(); tail.selectNodeContents(el); tail.setStart(r.startContainer,r.startOffset);
  const d=document.createElement('div'); d.appendChild(tail.extractContents());
  if(isBlankEl(el)) el.innerHTML='';
  return (d.textContent||d.querySelector('img'))?sanitize(d.innerHTML):'';
}
function caretAtStart(el){
  if(!isCollapsed()) return false; const r=getSelection().getRangeAt(0); const pre=document.createRange(); pre.selectNodeContents(el);
  try{ pre.setEnd(r.startContainer,r.startOffset); }catch(_){ return false; }
  return pre.toString().length===0&&!pre.cloneContents().querySelector('img');
}
function caretAtEnd(el){
  if(!isCollapsed()) return false; const r=getSelection().getRangeAt(0); const post=document.createRange(); post.selectNodeContents(el);
  try{ post.setStart(r.endContainer,r.endOffset); }catch(_){ return false; }
  return post.toString().length===0&&!post.cloneContents().querySelector('img');
}
function caretRect(){ const s=getSelection(); if(!s.rangeCount) return null; const r=s.getRangeAt(0).cloneRange(); r.collapse(true); const rc=r.getClientRects()[0]; return rc&&rc.height?rc:null; }
function lineH(el){ return parseFloat(getComputedStyle(el).lineHeight)||22; }
function onFirstLine(el){ const rc=caretRect(); if(!rc) return true; return rc.top-el.getBoundingClientRect().top<lineH(el)*.9; }
function onLastLine(el){ const rc=caretRect(); if(!rc) return true; return el.getBoundingClientRect().bottom-rc.bottom<lineH(el)*.9; }
function focusEl(el,pos){ if(!el) return; el.focus({preventScroll:true}); const len=el.textContent.length; setCaret(el,pos==='end'?len:pos==='start'||pos==null?0:Math.min(pos,len)); const r=el.getBoundingClientRect(); if(r.bottom>innerHeight-40||r.top<60) el.scrollIntoView({block:'center'}); }
function focusBlock(id,pos){ focusEl($(`#blocks .blk[data-id="${id}"] .txt`),pos); }
function focusLine(bid,r,c,l,pos){ focusEl($(`#blocks .blk[data-id="${bid}"] td[data-r="${r}"][data-c="${c}"] .ln[data-l="${l}"] .txt`),pos); }

export { caretAtEnd, caretAtStart, caretOffset, caretRect, deleteOffsets, focusBlock, focusEl, focusLine, onFirstLine, onLastLine, splitAtCaret };
