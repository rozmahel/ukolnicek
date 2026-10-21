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
  p._fol={x:rc.left,y:rc.top,pl:x,pt:y};   /* při posunu stránky jede bublina s tlačítkem, ze kterého se otevřela */
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
  t.innerHTML=`<span>${esc(msg)}</span>${actLabel?`<button class="t-act">${esc(actLabel)}</button>`:''}<button class="x" aria-label="Zavřít oznámení">×</button>`;
  document.body.appendChild(t);
  const hide=()=>{ clearTimeout(toastT); t.classList.add('gone'); setTimeout(()=>t.remove(),180); };
  if(act) t.querySelector('.t-act').addEventListener('click',()=>{ act(); t.remove(); });
  /* zavřít: křížkem, klepnutím na text nebo přejetím prstem dolů */
  t.addEventListener('click',e=>{ if(!e.target.closest('.t-act')) hide(); });
  let y0=null;
  t.addEventListener('touchstart',e=>{ y0=e.touches[0].clientY; },{passive:true});
  t.addEventListener('touchmove',e=>{ if(y0==null) return; const dy=e.touches[0].clientY-y0; if(dy>0) t.style.translate=`0 ${dy}px`; if(dy>40){ y0=null; hide(); } },{passive:true});
  t.addEventListener('touchend',()=>{ y0=null; t.style.translate=''; });
  toastT=setTimeout(hide,act?7000:4000);
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initUi(){
  document.addEventListener('mousedown',e=>{
    const inFrame=e.target.closest&&e.target.closest('#imgframe');
    if(S.pop&&!inFrame&&!S.pop.contains(e.target)&&!(S.popAnchor&&S.popAnchor.contains(e.target))) closePop();
    if(imgSel&&!inFrame&&e.target!==imgSel.img&&!(S.pop&&S.pop.contains(e.target))) hideImgSel();
    if(slash.open&&!e.target.closest('#slash')&&e.target!==slash.el) closeSlash();
  },true);
  document.addEventListener('scroll',()=>{
    const p=S.pop, a=S.popAnchor, f=p&&p._fol; if(!f||!a||!a.isConnected||!a.closest('#main')) return;
    const r=a.getBoundingClientRect(), top=$('#main').getBoundingClientRect().top;
    if(r.bottom<top||r.top>innerHeight){ closePop(); return; }
    p.style.top=(f.pt+r.top-f.y)+'px'; p.style.left=(f.pl+r.left-f.x)+'px';
  },true);
}

export { closeModal, closePop, openModal, openPop, placePop, toast };
