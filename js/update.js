/* Úkolníček – Aktualizace aplikace (Service Worker)
   - starší verze se nikdy nenasadí: sw.js ji odmítne nainstalovat a aplikace ji neaplikuje (verze z workeru přes zprávu 'version')
   - uk-ver-max (jen v zařízení) = nejnovější verze, kterou zařízení zná; když se přesto načte starší, sama si stáhne novou
   - „Zkontrolovat aktualizace“ v Nastavení: zjistí verzi na serveru (sw.js s ?check=, mimo mezipaměti) a novější hned nasadí */
import { lsGet, lsSet } from './core.js';
import { toast } from './ui.js';
import { APP_VERSION } from './views/settings.js';

let REG=null, force=false;
const vparts=v=>(String(v||'').match(/\d+/g)||[]).slice(0,3).map(Number);
/* >0 = a je novější než b */
function vcmp(a,b){ const x=vparts(a), y=vparts(b); for(let i=0;i<3;i++){ const d=(x[i]||0)-(y[i]||0); if(d) return d; } return 0; }
function noteVersion(v){ if(vcmp(v,lsGet('uk-ver-max',''))>0) lsSet('uk-ver-max',v); }
/* verze čekajícího workeru (starší sw.js bez odpovědi = '') */
function swVersion(w){
  return new Promise(res=>{
    try{ const ch=new MessageChannel(); const t=setTimeout(()=>res(''),1500); ch.port1.onmessage=e=>{ clearTimeout(t); res(String(e.data||'')); }; w.postMessage('version',[ch.port2]); }
    catch(_){ res(''); }
  });
}
/* smí se worker nasadit? starší verze ne; po ručním „Zkontrolovat“ se nasadí hned */
async function workerOk(w){
  const v=await swVersion(w);
  if(v&&vcmp(v,APP_VERSION)<0){ console.warn('Úkolníček: starší verze',v,'se nenasadí'); return {ok:false,now:false}; }
  if(v) noteVersion(v);
  const now=force; force=false;
  return {ok:true,now};
}
async function serverVersion(){
  const r=await fetch('sw.js?check='+Date.now(),{cache:'no-store'});
  const m=/VERSION\s*=\s*'ukolnicek-v([\d.]+)'/.exec(await r.text());
  return m?m[1]:'';
}
async function checkUpdate(quiet){
  if(!REG){ if(!quiet) toast(`Úkolníček ${APP_VERSION}. Aktualizace se tady nekontrolují (vývoj na localhostu nebo bez offline režimu).`); return; }
  if(!navigator.onLine){ if(!quiet) toast('Bez připojení. Aktualizace jde zkontrolovat až online.'); return; }
  let srv=''; try{ srv=await serverVersion(); }catch(_){}
  if(!srv){ if(!quiet) toast('Verzi na serveru se nepodařilo zjistit.'); return; }
  const c=vcmp(srv,APP_VERSION);
  if(c<=0){ noteVersion(APP_VERSION); if(!quiet) toast(c===0?`Toto je nejnovější verze ${APP_VERSION}.`:`Na serveru je zatím starší kopie (${srv}), zůstává ${APP_VERSION}.`); return; }
  noteVersion(srv); force=true;
  if(!quiet) toast(`Stahuji verzi ${srv}…`);
  /* server (CDN) může pár minut posílat starý sw.js: zkusit několikrát */
  for(let i=0;i<6&&force;i++){ try{ await REG.update(); }catch(_){} if(REG.installing||REG.waiting) return; await new Promise(r=>setTimeout(r,4000)); }
  if(force){ force=false; if(!quiet) toast(`Verze ${srv} se ještě nenačetla, server ji teprve rozesílá. Stačí to zkusit za pár minut.`); }
}
/* volá main.js po registraci workeru */
function initUpdates(reg){
  REG=reg; noteVersion(APP_VERSION);
  /* načetla se starší verze, než zařízení už zná: rovnou si stáhnout novou */
  if(vcmp(lsGet('uk-ver-max',''),APP_VERSION)>0) setTimeout(()=>checkUpdate(true),1500);
}

export { checkUpdate, initUpdates, workerOk };
