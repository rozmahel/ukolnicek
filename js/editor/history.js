/* Úkolníček – Zpět / znovu pro každou stránku */
import { $, TEXT_TYPES } from '../core.js';
import { savePage } from '../store.js';
import { curPage } from '../pages.js';
import { focusEl } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { renderPage } from './render.js';
import { closeSlash } from './slash.js';
import { hideCellbar, hideFmt } from './toolbar.js';
import { closePop, toast } from '../ui.js';
import { hideImgSel } from './images.js';

/* undo / redo */
const HIST=new Map(); let typingNow=false, histMute=false; function setTypingNow(v){ typingNow=v; }
function snap(pg){ return JSON.stringify({title:pg.title||'',icon:pg.icon||'',color:pg.color||'',wide:!!pg.wide,props:pg.props||[],blocks:pg.blocks||[]}); }
function hist(pg){ let h=HIST.get(pg.id); if(!h){ h={undo:[],redo:[],last:snap(pg),t:0,t0:0,typing:false}; HIST.set(pg.id,h); } return h; }
function recordHistory(pg){
  if(histMute) return;
  const h=HIST.get(pg.id); if(!h){ hist(pg); return; }
  const cur=snap(pg); if(cur===h.last) return;
  const now=Date.now();
  const coalesce=typingNow&&h.typing&&now-h.t<1500&&now-h.t0<5000;
  if(!coalesce){ h.undo.push(h.last); if(h.undo.length>200) h.undo.shift(); h.t0=now; }
  h.redo=[]; h.last=cur; h.t=now; h.typing=typingNow;
  updateUndoBtns();
}
function updateUndoBtns(){
  const pg=curPage(), u=$('#undo-btn'), r=$('#redo-btn'); if(!u||!r) return;
  const h=pg&&HIST.get(pg.id);
  u.disabled=!(h&&h.undo.length); r.disabled=!(h&&h.redo.length);
}
function applySnap(pg,str,before){
  const o=JSON.parse(str);
  Object.assign(pg,{title:o.title,icon:o.icon,color:o.color,wide:o.wide,props:o.props,blocks:o.blocks});
  histMute=true; savePage(pg,300); histMute=false;
  const st=$('#main').scrollTop; closePop(); closeSlash(); hideFmt(); hideCellbar(); hideImgSel();
  renderSidebar(); renderPage(pg); $('#main').scrollTop=st;
  const old=JSON.parse(before).blocks||[]; const oldMap=new Map(old.map(b=>[b.id,JSON.stringify(b)]));
  const ch=pg.blocks.find(b=>oldMap.get(b.id)!==JSON.stringify(b));
  if(ch){ const el=$(`#blocks .blk[data-id="${ch.id}"]`); if(el){ const t=$('.txt',el); if(t&&TEXT_TYPES.includes(ch.type)) focusEl(t,'end'); const r=el.getBoundingClientRect(); if(r.top<80||r.bottom>innerHeight-40) el.scrollIntoView({block:'center'}); el.classList.add('flash'); } }
}
function undo(){ const pg=curPage(); if(!pg) return; const h=hist(pg); if(!h.undo.length) return toast('Není co vracet.'); const cur=snap(pg); const prev=h.undo.pop(); h.redo.push(cur); h.last=prev; h.typing=false; applySnap(pg,prev,cur); updateUndoBtns(); }
function redo(){ const pg=curPage(); if(!pg) return; const h=hist(pg); if(!h.redo.length) return; const cur=snap(pg); const nx=h.redo.pop(); h.undo.push(cur); h.last=nx; h.typing=false; applySnap(pg,nx,cur); updateUndoBtns(); }

export { hist, HIST, recordHistory, redo, setTypingNow, undo, updateUndoBtns };
