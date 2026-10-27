/* Úkolníček – Tabulky: šířka sloupce a výška řádku tažením okraje buňky (myš/pero, ne prst; se zámkem ne).
   Tažením mění jen ten jeden sloupec, ostatní si nechají šířku a posunou se – celá tabulka se zúží nebo rozšíří.
   Data: b.cw = šířky všech sloupců v px (nastaví se při prvním tažení podle toho, jak tabulka zrovna vypadá),
   b.rh = výšky řádků v px (null = podle obsahu). Tabulka bez tažení data nemění. Dvojklik na okraji vrátí výchozí. */
import { clamp, clone, simpleUi } from '../core.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { COL_DEF, COL_MIN, colW, ctxOf, rerenderBlocks } from './render.js';

const EDGE=5, ROW_MIN=24;
let hot=null, rsz=null;

/* je ukazatel na pravém/spodním okraji buňky? (levý/horní okraj = okraj sousední buňky) */
function hit(e){
  if(LOCK||e.pointerType==='touch'||simpleUi()) return null;   /* v jednoduchém režimu jen psaní do buněk */
  const td=e.target.closest&&e.target.closest('.tbl td'); if(!td) return null;
  const rc=td.getBoundingClientRect(), tr=td.parentElement;
  if(rc.right-e.clientX<=EDGE) return {td,k:'c'};
  if(e.clientX-rc.left<=EDGE&&td.previousElementSibling) return {td:td.previousElementSibling,k:'c'};
  if(rc.bottom-e.clientY<=EDGE) return {td,k:'r'};
  if(e.clientY-rc.top<=EDGE&&tr.previousElementSibling) return {td:tr.previousElementSibling.children[td.cellIndex]||tr.previousElementSibling.firstElementChild,k:'r'};
  return null;
}
function mark(h){
  if(hot&&(!h||hot.td!==h.td||hot.k!==h.k)){ hot.td.classList.remove('rs-c','rs-r'); hot=null; }
  if(h&&!hot){ h.td.classList.add(h.k==='c'?'rs-c':'rs-r'); hot=h; }
}
/* pevné šířky: když tabulka ještě nemá colgroup, změří sloupce a vytvoří ho (jen v DOM; do dat až po puštění) */
function fixCols(tbl){
  let cg=tbl.querySelector('colgroup');
  if(!cg){
    const ws=[...tbl.rows[0].cells].map(c=>Math.round(c.getBoundingClientRect().width));
    cg=document.createElement('colgroup'); ws.forEach(w=>{ const col=document.createElement('col'); col.style.width=w+'px'; cg.appendChild(col); });
    tbl.insertBefore(cg,tbl.firstChild); tbl.classList.add('fixw');
  }
  const ws=[...cg.children].map(c=>parseFloat(c.style.width)||COL_DEF);
  tbl.style.width=ws.reduce((a,v)=>a+v,0)+'px';
  return {cg,ws};
}

function down(e){
  if(e.button!==0) return;
  const h=hit(e); if(!h) return;
  const x=ctxOf(h.td); if(!x||x.b.type!=='table') return;
  e.preventDefault(); e.stopPropagation();
  const tbl=h.td.closest('table'), tr=h.td.parentElement;
  rsz={k:h.k,x0:e.clientX,y0:e.clientY,tbl,tr,c:h.td.cellIndex,r:tr.rowIndex,pg:x.pg,b:x.b};
  if(h.k==='c'){ const f=fixCols(tbl); rsz.ws=f.ws; rsz.cg=f.cg; rsz.w0=f.ws[rsz.c]; }
  else { rsz.h0=tr.getBoundingClientRect().height; rsz.h=rsz.h0; }
  document.body.classList.add(h.k==='c'?'tbl-rsz-c':'tbl-rsz-r');
  try{ e.target.setPointerCapture(e.pointerId); }catch(_){}
}
function move(e){
  if(!rsz){ mark(hit(e)); return; }
  e.preventDefault();
  if(rsz.k==='c'){
    const w=Math.round(Math.max(COL_MIN,rsz.w0+e.clientX-rsz.x0)); rsz.ws[rsz.c]=w;
    rsz.cg.children[rsz.c].style.width=w+'px'; rsz.tbl.style.width=rsz.ws.reduce((a,v)=>a+v,0)+'px';
  } else {
    rsz.h=Math.round(Math.max(ROW_MIN,rsz.h0+e.clientY-rsz.y0)); rsz.tr.style.height=rsz.h+'px';
  }
}
function up(){
  if(!rsz) return;
  const d=rsz; rsz=null; document.body.classList.remove('tbl-rsz-c','tbl-rsz-r'); mark(null);
  const {b,pg}=d; let changed=false;
  if(d.k==='c'){
    const cw=d.ws.map(colW), old=Array.isArray(b.cw)?b.cw:null;
    if(!old||cw.length!==old.length||cw.some((v,i)=>v!==old[i])){ b.cw=cw; changed=true; }
  } else {
    /* menší než obsah = řádek podle obsahu */
    const real=Math.round(d.tr.getBoundingClientRect().height), rh=Array.isArray(b.rh)?clone(b.rh):[];
    while(rh.length<b.rows.length) rh.push(null);
    const v=d.h<real-1?null:clamp(d.h,ROW_MIN,2000);
    if((rh[d.r]??null)!==v){ rh[d.r]=v; changed=true; }
    while(rh.length&&rh[rh.length-1]==null) rh.pop();
    if(rh.length) b.rh=rh; else delete b.rh;
  }
  if(changed) savePage(pg);
  rerenderBlocks();
}
/* dvojklik na okraji: sloupec zpět na výchozí šířku / řádek zpět podle obsahu */
function dbl(e){
  const h=hit(e); if(!h) return;
  const x=ctxOf(h.td); if(!x||x.b.type!=='table') return;
  e.preventDefault();
  const b=x.b;
  if(h.k==='c'){ if(!Array.isArray(b.cw)) return; b.cw[h.td.cellIndex]=COL_DEF; }
  else { if(!Array.isArray(b.rh)) return; b.rh[h.td.parentElement.rowIndex]=null; while(b.rh.length&&b.rh[b.rh.length-1]==null) b.rh.pop(); if(!b.rh.length) delete b.rh; }
  savePage(x.pg); rerenderBlocks();
}

export function initTableSize(){
  document.addEventListener('pointerdown',down,true);
  document.addEventListener('pointermove',move,true);
  document.addEventListener('pointerup',up,true);
  document.addEventListener('pointercancel',up,true);
  document.addEventListener('dblclick',dbl,true);
}
