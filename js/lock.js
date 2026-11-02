/* Úkolníček – Zámek rozložení (⌘⇧L) – pamatuje si ho každé zařízení zvlášť */
import { $$, lsGet, lsSet } from './core.js';
import { LOCK_KEY, S } from './state.js';
import { renderMain } from './router.js';
import { closeSlash } from './editor/slash.js';
import { closePop, toast } from './ui.js';
import { hideImgSel } from './editor/images.js';

/* ================= zámek: každá stránka a karta zvlášť (od 4.29.0), jen v zařízení =================
   uk-locks = {'p:<ID stránky>':true, today:true, index:true…}; LOCK = zámek právě otevřeného pohledu (nastavuje syncLock
   z renderMain). Dřívější jeden zámek uk-lock se při prvním spuštění převede: zamčené jsou pak všechny stránky i karty. */
const lockKey=v=>!v?'today':v.kind==='page'?'p:'+v.pageId:v.kind;
let LOCKS=lsGet('uk-locks',null), LOCK=false, lockMig=false;
if(!LOCKS||typeof LOCKS!=='object'){ LOCKS={}; lockMig=!!lsGet('uk-lock',false); }
function lockMigrate(){
  if(!lockMig||!S.ready) return; lockMig=false;
  ['today','index','schedule','tasks','mindmap'].forEach(k=>LOCKS[k]=true);
  Object.keys(S.pages).forEach(id=>LOCKS['p:'+id]=true);
  lsSet('uk-locks',LOCKS); try{ localStorage.removeItem('uk-lock'); }catch(_){}
}
const pageLocked=id=>!!LOCKS['p:'+id];
/* po změně pohledu (renderMain): zámek podle otevřené stránky nebo karty */
function syncLock(){
  lockMigrate();
  const on=!!LOCKS[lockKey(S.view)]; if(on===LOCK) return false;
  LOCK=on; closeSlash(); hideImgSel(); applyLock(); return true;
}
function lockSvg(on){ return `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2.2"/>${on?'<path d="M8 11V8a4 4 0 0 1 8 0v3"/>':'<path d="M8 11V8a4 4 0 0 1 7.6-1.8"/>'}</svg>`; }
function applyLock(){
  document.body.classList.toggle('locked',LOCK);
  const t=(LOCK?'Odemknout':'Zamknout')+` (${LOCK_KEY})`;
  const ta=document.getElementById('src-ed'); if(ta) ta.readOnly=LOCK;   /* zdroj stránky: zamčeno = jen čtení */
  document.dispatchEvent(new Event('uk-lock'));
  $$('.lock-btn').forEach(b=>{ b.classList.toggle('on',LOCK); b.innerHTML=lockSvg(LOCK); b.setAttribute('aria-pressed',String(LOCK)); b.title=t; b.setAttribute('aria-label',t); });
}
function toggleLock(){
  const k=lockKey(S.view); LOCK=!LOCK;
  if(LOCK) LOCKS[k]=true; else delete LOCKS[k];
  /* zapomenout zámky stránek, které už neexistují (ani v koši) */
  Object.keys(LOCKS).forEach(x=>{ if(x.startsWith('p:')&&!S.pages[x.slice(2)]&&!(S.trash&&S.trash[x.slice(2)])) delete LOCKS[x]; });
  lsSet('uk-locks',LOCKS); closePop(); hideImgSel(); closeSlash(); applyLock();
  if(S.view.kind==='schedule'||S.view.kind==='today'||S.view.kind==='mindmap') renderMain();
  const kde=S.view.kind==='page'?'na této stránce':'na této kartě';
  toast(LOCK?`Zamčeno ${kde}: přidávání, přesouvání a odstraňování je schované. Psát a zaškrtávat jde dál.`:`Odemčeno ${kde}.`);
}

export { applyLock, LOCK, pageLocked, syncLock, toggleLock };
