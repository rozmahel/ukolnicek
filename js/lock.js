/* Úkolníček – Zámek rozložení (⌘⇧L) – pamatuje si ho každé zařízení zvlášť */
import { $$, lsGet, lsSet } from './core.js';
import { LOCK_KEY, S } from './state.js';
import { renderMain } from './router.js';
import { closeSlash } from './editor/slash.js';
import { closePop, toast } from './ui.js';
import { hideImgSel } from './editor/images.js';

/* ================= zámek (globální, pamatuje si ho zařízení) ================= */
let LOCK=!!lsGet('uk-lock',false);
function lockSvg(on){ return `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2.2"/>${on?'<path d="M8 11V8a4 4 0 0 1 8 0v3"/>':'<path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>'}</svg>`; }
function applyLock(){
  document.body.classList.toggle('locked',LOCK);
  const t=(LOCK?'Odemknout':'Zamknout')+` (${LOCK_KEY})`;
  $$('.lock-btn').forEach(b=>{ b.classList.toggle('on',LOCK); b.innerHTML=lockSvg(LOCK); b.setAttribute('aria-pressed',String(LOCK)); b.title=t; b.setAttribute('aria-label',t); });
}
function toggleLock(){
  LOCK=!LOCK; lsSet('uk-lock',LOCK); closePop(); hideImgSel(); closeSlash(); applyLock();
  if(S.view.kind==='schedule') renderMain();
  toast(LOCK?'Zamčeno: nic se nepřidá, nepřesune ani nesmaže omylem. Psát, zaškrtávat a upravovat můžeš dál.':'Odemčeno: můžeš zase přidávat, přesouvat a mazat.');
}

export { applyLock, LOCK, toggleLock };
