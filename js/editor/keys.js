/* Úkolníček – Klávesy v blocích a v buňkách tabulky (Enter, Backspace, Tab, šipky) */
import { $$, clamp, esc, LIST_TYPES, plain, TEXT_TYPES } from '../core.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { emptyCell, newBlock } from '../pages.js';
import { isBlank, isBlankEl, sanitize } from '../sanitize.js';
import { caretAtEnd, caretAtStart, caretOffset, focusBlock, focusEl, focusLine, onFirstLine, onLastLine, splitAtCaret } from './caret.js';
import { isHeading, keepVisible, rerenderBlocks, sectionEnd } from './render.js';
import { setType, takeShortcut } from './blocks.js';
import { lineAround, navFrom } from './images.js';
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
/* bloky, které Backspace ani Delete z vedlejšího řádku nesmažou */
const SOLID=['divider','page','subj','eq','image'];
/* smaže prázdný řádek vedle pevného bloku a kurzor dá do nejbližšího textu nad (up) nebo pod pevnými bloky */
function dropBlank(pg,bi,el,up){
  for(let n=up?el.previousElementSibling:el.nextElementSibling;n;n=up?n.previousElementSibling:n.nextElementSibling){
    if(!n.classList.contains('blk')) continue;
    const q=pg.blocks.find(z=>z.id===n.dataset.id); if(!q||SOLID.includes(q.type)) continue;
    if(!n.querySelector('.txt')) return;
    pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks();
    const ts=$$(`#blocks .blk[data-id="${q.id}"] .txt`); focusEl(up?ts.pop():ts[0],up?'end':0); return;
  }
}
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
    keepVisible(pg.blocks,at); pg.blocks.splice(at,0,nb);
    savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); return;
  }
  if(e.key==='Backspace'&&caretAtStart(t)){
    /* hned po zkratce („- “, „# “, „---“…) vrátí Backspace napsaný text */
    const sc=takeShortcut(b.id,b.type==='p'?'divider':b.type);
    if(sc&&sc.type==='divider'){
      const d=pg.blocks.find(q=>q.id===sc.div);
      if(d&&d.type==='divider'){ e.preventDefault(); d.type='p'; d.html='---'; if(sc.made&&isBlankEl(t)) pg.blocks.splice(pg.blocks.indexOf(b),1); savePage(pg); rerenderBlocks(); focusBlock(d.id,3); return; }
    } else if(sc&&sc.type!=='num'){
      e.preventDefault(); setType(pg,b,'p'); b.html=esc(sc.pre)+(isBlankEl(t)?'':(b.html||'')); savePage(pg); rerenderBlocks(); focusBlock(b.id,sc.pre.length); return;
    }
    if(b.type!=='p'){ e.preventDefault(); const kept=setType(pg,b,'p',true); savePage(pg); rerenderBlocks(); focusBlock(b.id,kept); return; }   /* číslovaný seznam ze zkratky „1. “ vrátí „1. “ do textu */
    if((b.level||0)>0){ e.preventDefault(); b.level--; savePage(pg); rerenderBlocks(); focusBlock(b.id,0); return; }
    const prevEl=blkEl.previousElementSibling&&blkEl.previousElementSibling.classList.contains('blk')?blkEl.previousElementSibling:(blkEl.previousElementSibling&&blkEl.previousElementSibling.previousElementSibling);
    if(!prevEl||!prevEl.classList||!prevEl.classList.contains('blk')) return;
    const pi=pg.blocks.findIndex(q=>q.id===prevEl.dataset.id); const prev=pg.blocks[pi]; if(!prev) return;
    e.preventDefault();
    /* oddělovač, podstránka, předmět, rovnice, obrázek a kresba Backspacem nezmizí (jen přes ⋮⋮ → Odstranit nebo výběr);
       prázdný řádek pod nimi se smaže a kurzor skočí na konec textu nad nimi */
    if(SOLID.includes(prev.type)){ if(isBlankEl(t)) dropBlank(pg,bi,blkEl,true); return; }
    if(prev.type==='table'||prev.type==='code'){ if(isBlankEl(t)){ pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks(); const last=$$(`#blocks .blk[data-id="${prev.id}"] .txt`).pop(); focusEl(last,'end'); } return; }
    const len=plain(prev.html).length; prev.html=(prev.html||'')+(b.html||''); pg.blocks.splice(bi,1);
    savePage(pg); rerenderBlocks(); focusBlock(prev.id,len); return;
  }
  if(e.key==='Delete'&&b.type!=='code'&&caretAtEnd(t)){
    const nextEl=blkEl.nextElementSibling; if(!nextEl||!nextEl.classList.contains('blk')) return;
    const ni=pg.blocks.findIndex(q=>q.id===nextEl.dataset.id); const nx=pg.blocks[ni];
    if(nx&&SOLID.includes(nx.type)){ e.preventDefault(); if(isBlankEl(t)) dropBlank(pg,bi,blkEl,false); return; }
    if(!nx||!TEXT_TYPES.includes(nx.type)||nx.type==='code') return;
    e.preventDefault(); const len=t.textContent.length; b.html=sanitize(t.innerHTML)+(nx.html||''); pg.blocks.splice(ni,1); savePage(pg); rerenderBlocks(); focusBlock(b.id,len); return;
  }
  if(e.key==='Tab'){
    e.preventDefault(); const off=caretOffset(t);
    b.level=clamp((b.level||0)+(e.shiftKey?-1:1),0,4); savePage(pg); rerenderBlocks(); focusBlock(b.id,off); return;
  }
  if((e.key==='ArrowUp'&&onFirstLine(t))||(e.key==='ArrowDown'&&onLastLine(t))){
    if(e.shiftKey) return;
    if(navFrom(t,e.key==='ArrowUp')) e.preventDefault();   /* cestou se zastaví i na obrázku (vybere ho) */
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
    const sc=takeShortcut(`${b.id}:${r}:${c}:${l}`,line.t);
    if(sc){ e.preventDefault(); line.t='p'; delete line.done; line.html=esc(sc.pre)+(isBlankEl(t)?'':(line.html||'')); savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,sc.pre.length); return; }
    if(line.t!=='p'){ e.preventDefault(); line.t='p'; delete line.done; savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l,0); return; }
    if(l>0){ e.preventDefault(); const prev=cell.lines[l-1]; const len=plain(prev.html).length; prev.html=(prev.html||'')+(line.html||''); cell.lines.splice(l,1); savePage(pg); rerenderBlocks(); focusLine(b.id,r,c,l-1,len); }
    return;
  }
  /* šipky nahoru/dolů: do buňky nad/pod (stejný sloupec), z prvního/posledního řádku ven z tabulky;
     když nad/pod tabulkou nic není, vznikne nový prázdný řádek */
  if((e.key==='ArrowUp'&&l===0&&onFirstLine(t))||(e.key==='ArrowDown'&&l===cell.lines.length-1&&onLastLine(t))){
    if(e.shiftKey||hasMod(e)) return;
    e.preventDefault();
    const up=e.key==='ArrowUp', nr=r+(up?-1:1);
    if(nr>=0&&nr<b.rows.length){ const nc=b.rows[nr].cells[c]; focusLine(b.id,nr,c,up?nc.lines.length-1:0,up?'end':0); return; }
    const blk=t.closest('#blocks > .blk'); if(blk&&navFrom(blk,up)) return;
    if(!LOCK) lineAround(b.id,up);
    return;
  }
  if(e.key==='Tab'){
    e.preventDefault();
    const cols=b.rows[0].cells.length, rows=b.rows.length; let idx=r*cols+c+(e.shiftKey?-1:1);
    if(idx>=rows*cols&&!LOCK){ b.rows.push({cells:Array.from({length:cols},()=>emptyCell())}); savePage(pg); rerenderBlocks(); }
    idx=clamp(idx,0,b.rows.length*cols-1);
    focusLine(b.id,Math.floor(idx/cols),idx%cols,0,'end'); return;
  }
}

export { blockKeys, lineKeys };
