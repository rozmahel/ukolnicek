/* Úkolníček – Klávesy v blocích a v buňkách tabulky (Enter, Backspace, Tab, šipky) */
import { $$, clamp, LIST_TYPES, plain, TEXT_TYPES } from '../core.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { emptyCell, newBlock } from '../pages.js';
import { isBlank, isBlankEl, sanitize } from '../sanitize.js';
import { caretAtEnd, caretAtStart, caretOffset, focusBlock, focusEl, focusLine, onFirstLine, onLastLine, splitAtCaret } from './caret.js';
import { isHeading, rerenderBlocks, sectionEnd } from './render.js';
import { setType } from './blocks.js';
import { caretPos, codeHtml, dedent, domText, insertCode, newLine } from './code.js';

/* ---- key handling ---- */
/* blok s kódem: Enter = nový řádek v bloku; Enter na prázdném posledním řádku (nebo ⌘Enter) vyjde pod blok; Tab odsadí o dvě mezery */
function codeKeys(e,x,t){
  const {pg,b,bi}=x;
  if(e.isComposing) return false;
  if(e.key==='Enter'){
    e.preventDefault();
    const cmd=e.metaKey||e.ctrlKey, text=domText(t), sel=getSelection();
    const exit=cmd||(sel.isCollapsed&&text.endsWith('\n')&&caretPos(t)===text.length);
    if(!exit){ newLine(t); return true; }
    const body=cmd?text:text.replace(/\n+$/,'');
    if(!body.trim()){ b.html=''; setType(pg,b,'p'); savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return true; }   /* nic nenapsáno: blok s kódem se vrátí na odstavec */
    b.html=codeHtml(body);
    let nx=pg.blocks[bi+1];
    if(!nx||nx.type!=='p'||!isBlank(nx.html)){ nx=newBlock('p',{level:b.level||0}); pg.blocks.splice(bi+1,0,nx); }
    savePage(pg); rerenderBlocks(); focusBlock(nx.id,0); return true;
  }
  if(e.key==='Tab'&&!hasMod(e)){ e.preventDefault(); if(e.shiftKey) dedent(t); else insertCode(t,'  '); return true; }
  return false;
}
const hasMod=e=>e.metaKey||e.ctrlKey||e.altKey;
function blockKeys(e,x,t){
  const {pg,b,bi,blkEl}=x;
  if(b.type==='code'&&codeKeys(e,x,t)) return;
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();
    if(isBlankEl(t)&&['bullet','num','todo','quote','callout'].includes(b.type)){
      if((b.level||0)>0) b.level--; else setType(pg,b,'p');
      savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return;
    }
    const off=caretOffset(t);
    const nt=LIST_TYPES.includes(b.type)?b.type:'p';
    if(off===0&&t.textContent.length){
      const nb=newBlock(nt,{level:b.level||0}); pg.blocks.splice(bi,0,nb);
      savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return;
    }
    const tail=splitAtCaret(t); b.html=sanitize(t.innerHTML);
    const nb=newBlock(nt,{html:tail,level:b.level||0});
    let at=bi+1;
    if(isHeading(b.type)&&b.collapsed) at=sectionEnd(pg.blocks,bi);
    pg.blocks.splice(at,0,nb);
    savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); return;
  }
  if(e.key==='Backspace'&&caretAtStart(t)){
    if(b.type!=='p'){ e.preventDefault(); const kept=setType(pg,b,'p',true); savePage(pg); rerenderBlocks(); focusBlock(b.id,kept); return; }   /* číslovaný seznam ze zkratky „1. “ vrátí „1. “ do textu */
    if((b.level||0)>0){ e.preventDefault(); b.level--; savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    const prevEl=blkEl.previousElementSibling&&blkEl.previousElementSibling.classList.contains('blk')?blkEl.previousElementSibling:(blkEl.previousElementSibling&&blkEl.previousElementSibling.previousElementSibling);
    if(!prevEl||!prevEl.classList||!prevEl.classList.contains('blk')) return;
    const pi=pg.blocks.findIndex(q=>q.id===prevEl.dataset.id); const prev=pg.blocks[pi]; if(!prev) return;
    e.preventDefault();
    /* oddělovač, odkaz na podstránku a blok předmětu se Backspacem smažou celé (jde vrátit ⌘Z) */
    if(['divider','page','subj','eq'].includes(prev.type)&&LOCK) return;
    if(['divider','page','subj','eq'].includes(prev.type)){ pg.blocks.splice(pi,1); savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    if(prev.type==='table'||prev.type==='image'||prev.type==='code'){ if(isBlankEl(t)){ pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks(); const last=$$(`#blocks .blk[data-id="${prev.id}"] .txt`).pop(); focusEl(last,'end'); } return; }
    const len=plain(prev.html).length; prev.html=(prev.html||'')+(b.html||''); pg.blocks.splice(bi,1);
    savePage(pg); rerenderBlocks(); focusBlock(prev.id,len); return;
  }
  if(e.key==='Delete'&&b.type!=='code'&&caretAtEnd(t)){
    const nextEl=blkEl.nextElementSibling; if(!nextEl||!nextEl.classList.contains('blk')) return;
    const ni=pg.blocks.findIndex(q=>q.id===nextEl.dataset.id); const nx=pg.blocks[ni];
    if(!nx||!TEXT_TYPES.includes(nx.type)||nx.type==='code') return;
    e.preventDefault(); const len=t.textContent.length; b.html=sanitize(t.innerHTML)+(nx.html||''); pg.blocks.splice(ni,1); savePage(pg); rerenderBlocks(); focusBlock(b.id,len); return;
  }
  if(e.key==='Tab'){
    e.preventDefault(); const off=caretOffset(t);
    b.level=clamp((b.level||0)+(e.shiftKey?-1:1),0,4); savePage(pg); rerenderBlocks(); focusBlock(b.id,off); return;
  }
  if((e.key==='ArrowUp'&&onFirstLine(t))||(e.key==='ArrowDown'&&onLastLine(t))){
    if(e.shiftKey) return;
    const all=$$('#page-title, #blocks .txt'); const i=all.indexOf(t); const tgt=all[e.key==='ArrowUp'?i-1:i+1];
    if(tgt){ e.preventDefault(); focusEl(tgt,e.key==='ArrowUp'?'end':'start'); }
  }
}
function lineKeys(e,x,t){
  const {pg,b,r,c,cell,l,line}=x;
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
    e.preventDefault();
    if(isBlankEl(t)&&line.t!=='p'){ line.t='p'; delete line.done; savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,0); return; }
    const tail=splitAtCaret(t); line.html=sanitize(t.innerHTML);
    cell.lines.splice(l+1,0,{t:line.t,html:tail});
    savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l+1,0); return;
  }
  if(e.key==='Backspace'&&caretAtStart(t)){
    if(line.t!=='p'){ e.preventDefault(); line.t='p'; delete line.done; savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,0); return; }
    if(l>0){ e.preventDefault(); const prev=cell.lines[l-1]; const len=plain(prev.html).length; prev.html=(prev.html||'')+(line.html||''); cell.lines.splice(l,1); savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l-1,len); }
    return;
  }
  if(e.key==='Tab'){
    e.preventDefault();
    const cols=b.rows[0].cells.length, rows=b.rows.length; let idx=r*cols+c+(e.shiftKey?-1:1);
    if(idx>=rows*cols){ b.rows.push({cells:Array.from({length:cols},()=>emptyCell())}); savePage(pg); rerenderBlocks(); }
    idx=clamp(idx,0,b.rows.length*cols-1);
    focusLine(b.id,Math.floor(idx/cols),idx%cols,0,'end'); return;
  }
}

export { blockKeys, lineKeys };
