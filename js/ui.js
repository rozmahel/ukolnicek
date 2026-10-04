/* Úkolníček – Bubliny (popovery), dialogová okna a oznámení (toast) */
import { $, clamp, esc } from './core.js';
import { S } from './state.js';
import { closeSlash, slash } from './editor/slash.js';
import { Sync } from './sync/sync.js';
import { hideImgSel, imgSel } from './editor/images.js';

/* ================= popovers, modal, toast ================= */
function placePop(p,rc){
  const w=p.offsetWidth,h=p.offsetHeight;
  let x=clamp(rc.left,8,innerWidth-w-8), y=rc.bottom+6;
  if(y+h>innerHeight-8) y=Math.max(8,rc.top-h-6);
  p.style.left=x+'px'; p.style.top=y+'px';
}
function openPop(anchor,html,handler){
  closePop();
  const p=document.createElement('div'); p.className='pop'; p.innerHTML=html; document.body.appendChild(p);
  placePop(p,anchor.getBoundingClientRect());
  p.addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(b){ const keep=handler(b.dataset.v,b,p); if(keep!==true) closePop(); } });
  S.pop=p; S.popAnchor=anchor; return p;
}
function closePop(){ if(S.pop){ S.pop.remove(); S.pop=null; S.popAnchor=null; } }

function openModal(title,body,cls){
  closeModal(); closePop();
  const ov=document.createElement('div'); ov.className='ov';
  ov.innerHTML=`<div class="modal ${cls||''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">${title?`<div class="m-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Zavřít">×</button></div>`:''}${body}</div>`;
  document.body.appendChild(ov);
  ov.addEventListener('mousedown',e=>{ if(e.target===ov) closeModal(); });
  ov.addEventListener('click',e=>{ if(e.target.closest('[data-close]')) closeModal(); });
  S.modal=ov; return ov.firstElementChild;
}
function closeModal(){ if(S.modal){ S.modal.remove(); S.modal=null; if(Sync.pending) setTimeout(()=>Sync.resume(),0); } }
let toastT=null;
function toast(msg,actLabel,act){
  let t=$('.toast'); if(t) t.remove(); clearTimeout(toastT);
  t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status');
  t.innerHTML=`<span>${esc(msg)}</span>${actLabel?`<button>${esc(actLabel)}</button>`:''}`;
  document.body.appendChild(t);
  if(act) t.querySelector('button').addEventListener('click',()=>{ act(); t.remove(); });
  toastT=setTimeout(()=>t.remove(),act?7000:4000);
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initUi(){
  document.addEventListener('mousedown',e=>{
    const inFrame=e.target.closest&&e.target.closest('#imgframe');
    if(S.pop&&!inFrame&&!S.pop.contains(e.target)&&!(S.popAnchor&&S.popAnchor.contains(e.target))) closePop();
    if(imgSel&&!inFrame&&e.target!==imgSel.img&&!(S.pop&&S.pop.contains(e.target))) hideImgSel();
    if(slash.open&&!e.target.closest('#slash')&&e.target!==slash.el) closeSlash();
  },true);
}

export { closeModal, closePop, openModal, openPop, placePop, toast };
