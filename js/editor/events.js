/* Úkolníček – Události editoru: psaní, vkládání, přetahování bloků a obrázků */
import { $, $$, esc, plain, TEXT_TYPES } from '../core.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { setTypingNow } from './history.js';
import { curPage, newBlock, pTitle } from '../pages.js';
import { sanitize } from '../sanitize.js';
import { caretOffset, focusBlock, focusEl, focusLine, onLastLine, splitAtCaret } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { setType } from './blocks.js';
import { mdBlock, mdLine, openSlash, slash, slashKey, updateSlash } from './slash.js';
import { blockKeys, lineKeys } from './keys.js';
import { applyMark, hideCellbar, showCellbar } from './toolbar.js';
import { toast } from '../ui.js';
import { handleImageFiles, pickImageBlock, rangeFromPoint } from './images.js';
import { mentionInput, mentionKey } from './mention.js';
import { blockEsc, initMultiSel } from './multisel.js';

/* ---- document events ---- */
const viewEl=$('#view');

/* ---- drag & drop ---- */
let dragId=null;

const hasFiles=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');

function endDrag(){ dragId=null; $$('.drop-before,.drop-after,.dragging').forEach(x=>x.classList.remove('drop-before','drop-after','dragging')); }

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initEvents(){
  initMultiSel();
  viewEl.addEventListener('input',e=>{ setTypingNow(!!e.inputType&&!/^history/.test(e.inputType)); },true);
  document.addEventListener('input',()=>{ setTypingNow(false); });
  viewEl.addEventListener('input',e=>{
    const t=e.target; const pg=curPage(); if(!pg) return;
    if(t.id==='page-title'){
      if(t.innerHTML==='<br>') t.innerHTML='';
      pg.title=t.textContent.replace(/\s+/g,' ').trim(); savePage(pg);
      const it=$(`.ti-main[data-id="${pg.id}"] .ti-t`); if(it) it.textContent=pTitle(pg);
      $('#tb-t').textContent=pTitle(pg); return;
    }
    if(t.classList.contains('cap')){ const x=ctxOf(t); if(x){ x.b.caption=t.textContent; savePage(pg); } return; }
    if(t.classList.contains('pk')||t.classList.contains('pv')){
      const i=+t.closest('.prop').dataset.i; const pr=pg.props[i]; if(!pr) return;
      pr[t.classList.contains('pk')?'k':'v']=t.textContent; savePage(pg); return;
    }
    if(!t.classList.contains('txt')) return;
    if(t.innerHTML==='<br>') t.innerHTML='';
    const x=ctxOf(t); if(!x) return;
    const typed=e.inputType==='insertText';
    if(x.line){ x.line.html=t.innerHTML; if(typed&&mdLine(x,t)) return; mentionInput(e,t); savePage(pg); return; }
    x.b.html=t.innerHTML;
    if(typed&&mdBlock(x,t)) return;
    mentionInput(e,t);
    if(slash.open) updateSlash();
    else if(typed&&e.data==='/'){ const off=caretOffset(t); const before=t.textContent.slice(0,off-1); if(!before||/\s$/.test(before)) openSlash(t,x.b.id,off-1,'slash'); }
    savePage(pg);
  });
  viewEl.addEventListener('keydown',e=>{
    const t=e.target;
    if(slashKey(e)||mentionKey(e)) return;
    if(t.id==='page-title'){
      if(e.key==='Enter'||(e.key==='ArrowDown'&&onLastLine(t))){ e.preventDefault(); const pg=curPage(); if(!pg.blocks.length){ pg.blocks.push(newBlock('p')); rerenderBlocks(); } const first=$('#blocks .txt'); if(first) focusEl(first,'start'); else { pg.blocks.unshift(newBlock('p')); rerenderBlocks(); focusEl($('#blocks .txt'),0);} }
      return;
    }
    if(t.classList.contains('cap')){ if(e.key==='Enter'){ e.preventDefault(); const x=ctxOf(t); if(!x) return; let nx=x.pg.blocks[x.bi+1]; if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); x.pg.blocks.splice(x.bi+1,0,nx); savePage(x.pg); rerenderBlocks(); } focusBlock(nx.id,0); } return; }
    if(t.classList.contains('pk')||t.classList.contains('pv')){ if(e.key==='Enter'){ e.preventDefault(); if(t.classList.contains('pk')) focusEl(t.nextElementSibling,'end'); else t.blur(); } return; }
    if(!t.classList.contains('txt')) return;
    if(blockEsc(e,t)) return;
    if((e.metaKey||e.ctrlKey)&&!e.altKey){
      const k=e.key.toLowerCase();
      if(k==='b'||k==='i'||k==='u'){ e.preventDefault(); document.execCommand({b:'bold',i:'italic',u:'underline'}[k]); return; }
      if(k==='e'){ e.preventDefault(); applyMark('hl-purple'); return; }
    }
    const x=ctxOf(t); if(!x) return;
    if(x.line) lineKeys(e,x,t); else blockKeys(e,x,t);
  });
  viewEl.addEventListener('paste',e=>{
    const t=e.target.closest&&e.target.closest('.txt, #page-title, .pk, .pv, .cap'); if(!t) return;
    e.preventDefault();
    const imgs=[...(e.clipboardData.files||[])].filter(f=>f.type.startsWith('image/'));
    if(imgs.length&&t.classList.contains('txt')){ const s=getSelection(); handleImageFiles(imgs,t,s.rangeCount?s.getRangeAt(0).cloneRange():null); return; }
    const text=(e.clipboardData.getData('text/plain')||'').replace(/\r/g,'');
    if(!t.classList.contains('txt')||!text.includes('\n')){ document.execCommand('insertText',false,text.replace(/\n+/g,' ')); return; }
    const x=ctxOf(t); if(!x) return;
    const lines=text.split('\n').filter(s=>s.trim().length);
    if(!lines.length) return;
    const parse=raw=>{
      const ind=(raw.match(/^[\t ]*/)[0]).replace(/\t/g,'  ').length; let s=raw.trim(), type='p', done=false, m;
      if((m=s.match(/^\[([ xX]?)\]\s*/))){ type='todo'; done=/x/i.test(m[1]); s=s.slice(m[0].length); }
      else if((m=s.match(/^[☐☑✅✔]\s*/))){ type='todo'; done=m[0].trim()!=='☐'; s=s.slice(m[0].length); }
      else if((m=s.match(/^[-*•◦▪]\s+/))){ type='bullet'; s=s.slice(m[0].length); }
      else if((m=s.match(/^(#{1,3})\s+/))){ type='h'+m[1].length; s=s.slice(m[0].length); }
      else if((m=s.match(/^\d+[.)]\s+/))){ type='num'; s=s.slice(m[0].length); }
      return {type,done,html:esc(s),level:Math.min(4,Math.floor(ind/2))};
    };
    const tail=splitAtCaret(t);
    const first=parse(lines[0]);
    document.execCommand('insertText',false,plain(first.html));
    const rest=lines.slice(1).map(parse);
    const pg=x.pg;
    if(x.line){
      x.line.html=sanitize(t.innerHTML);
      const nl=rest.map(p=>({t:p.type==='todo'?'todo':p.type==='bullet'?'bullet':'p',html:p.html,done:p.done||undefined}));
      if(nl.length){ nl[nl.length-1].html+=tail; } else x.line.html+=tail;
      x.cell.lines.splice(x.l+1,0,...nl);
      savePage(pg); rerenderBlocks(); focusLine(x.b.id,x.r,x.c,x.l+nl.length,'end'); return;
    }
    x.b.html=sanitize(t.innerHTML);
    const nbs=rest.map(p=>{ const nb=newBlock('p',{html:p.html,level:p.level}); setType(pg,nb,p.type); if(p.type==='todo'&&p.done) nb.done=true; return nb; });
    if(nbs.length) nbs[nbs.length-1].html+=tail; else x.b.html+=tail;
    pg.blocks.splice(x.bi+1,0,...nbs);
    savePage(pg); rerenderBlocks();
    const last=nbs.length?nbs[nbs.length-1]:x.b; focusBlock(last.id,plain(last.html).length-plain(tail).length);
  });
  viewEl.addEventListener('focusin',e=>{
    const t=e.target;
    if(t.classList&&t.classList.contains('cell-txt')) showCellbar(t); else hideCellbar();
  });
  viewEl.addEventListener('focusout',()=>{
    setTimeout(()=>{
      const a=document.activeElement;
      if(!a||!a.classList||!a.classList.contains('cell-txt')) hideCellbar();
    },80);
  });
  viewEl.addEventListener('dragstart',e=>{
    const h=e.target.closest&&e.target.closest('.g-drag'); if(!h){ return; }
    if(LOCK){ e.preventDefault(); return; }
    const blk=h.closest('.blk'); dragId=blk.dataset.id;
    e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');
    try{ e.dataTransfer.setDragImage(blk,16,12); }catch(_){}
    requestAnimationFrame(()=>blk.classList.add('dragging'));
  });
  viewEl.addEventListener('dragover',e=>{
    if(!dragId&&hasFiles(e)&&$('#doc')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; return; }
    if(!dragId) return; const blk=e.target.closest('#blocks .blk'); if(!blk) return;
    e.preventDefault(); $$('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));
    const rc=blk.getBoundingClientRect(); blk.classList.add(e.clientY<rc.top+rc.height/2?'drop-before':'drop-after');
  });
  viewEl.addEventListener('drop',e=>{
    if(!dragId&&hasFiles(e)&&$('#doc')){
      e.preventDefault();
      const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||/\.(heic|heif)$/i.test(f.name));
      if(!files.length) return toast('Sem jde přetáhnout jen obrázek.');
      const host=e.target.closest&&e.target.closest('#doc .txt');
      if(host){ handleImageFiles(files,host,rangeFromPoint(e.clientX,e.clientY)); return; }
      const pg=curPage(); const blk=e.target.closest&&e.target.closest('#blocks .blk');
      const after=blk?blk.dataset.id:(pg.blocks.length?pg.blocks[pg.blocks.length-1].id:null);
      if(!after){ const nb=newBlock('p'); pg.blocks.push(nb); pickImageBlock(pg.id,nb.id,true,files[0]); return; }
      pickImageBlock(pg.id,after,false,files[0]); return;
    }
    if(!dragId) return; e.preventDefault();
    const tgt=$('.drop-before,.drop-after'); const pg=curPage();
    if(tgt&&pg&&tgt.dataset.id!==dragId){
      const after=tgt.classList.contains('drop-after');
      const from=pg.blocks.findIndex(b=>b.id===dragId); const [blk]=pg.blocks.splice(from,1);
      let to=pg.blocks.findIndex(b=>b.id===tgt.dataset.id); if(after) to++;
      pg.blocks.splice(to,0,blk); savePage(pg);
    }
    endDrag(); rerenderBlocks();
  });
  viewEl.addEventListener('dragend',endDrag);
}

export { hasFiles, viewEl };
