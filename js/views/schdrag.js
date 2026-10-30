/* Úkolníček – Rozvrh: přetažení a natažení hodiny, kopie s „duchem“, nová hodina tažením (od 4.23.0)
   Jen myší nebo perem na širokém okně a při odemčeném zámku (kontroluje se při každém stisku, ne při vykreslení).
   Opakovaná hodina se posouvá celá: mění se den a čas v týdnu; jednorázová dostane nové datum, „pevný počet týdnů“
   posune datum první hodiny o stejný počet dní. Přichytává se po SD_SNAP minutách.
   Každá změna jde vrátit (⌘Z v rozvrhu i „Vrátit“ v oznámení). Tvar dat se nemění. */
import { $, $$, clamp, clone, IC, rid, simpleUi } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { saveEvent } from '../store.js';
import { fromMin, parseD, toMin, ymd } from '../dates.js';
import { renderMain } from '../router.js';
import { openPop, toast } from '../ui.js';

const SD_SNAP=5, SD_MIN=10;
const SD={undo:[],copy:null,swallow:false,open:null,color:null};
const sdOff=()=>LOCK||simpleUi();
const sdSnap=m=>Math.round(m/SD_SNAP)*SD_SNAP;

/* uložení jedné hodiny (null = odstranit) s krokem zpět */
function sdCommit(id,next,msg){
  const before=S.events[id]?clone(S.events[id]):null;
  if(next) S.events[id]=next; else delete S.events[id];
  saveEvent(next||{id});
  SD.undo.push({id,before}); if(SD.undo.length>30) SD.undo.shift();
  renderMain();
  toast(msg,'Vrátit',sdUndo);
}
function sdUndo(){
  const u=SD.undo.pop(); if(!u) return false;
  if(u.before) S.events[u.id]=u.before; else delete S.events[u.id];
  saveEvent(u.before||{id:u.id}); renderMain(); return true;
}
/* místo v mřížce pod ukazatelem: sloupec dne a minuta (nepřichycená) */
function sdAt(sg,x,y){
  const cols=$$('.sg-col',sg); if(!cols.length) return null;
  let col=cols.find(c=>{ const r=c.getBoundingClientRect(); return x>=r.left&&x<r.right; });
  if(!col) col=x<cols[0].getBoundingClientRect().left?cols[0]:cols[cols.length-1];
  const r=col.getBoundingClientRect(), h0=+sg.dataset.h0, hh=+sg.dataset.hh||52;
  return {col,day:+col.dataset.day,date:col.dataset.date,min:h0*60+(y-r.top)/hh*60};
}
const sdLim=(sg,col)=>{ const h0=+sg.dataset.h0, hh=+sg.dataset.hh||52; return [h0*60,Math.min(24*60-1,h0*60+Math.round(col.offsetHeight/hh*60))]; };
const sdY=(sg,m)=>(m-(+sg.dataset.h0)*60)/60*(+sg.dataset.hh||52);
const sdTime=(s,e)=>`${fromMin(s)} – ${fromMin(e)}`;

/* nové umístění hodiny (celá série) */
function sdMoved(ev,day,date,s,e){
  const n=clone(ev); n.start=fromMin(s); n.end=fromMin(e);
  if(ev.repeat==='once'){ n.date=date; n.day=day; }
  else if(ev.repeat==='count'){ const d=parseD(ev.date)||parseD(date); d.setDate(d.getDate()+(day-(+ev.day||0))); n.date=ymd(d); n.day=day; }
  else n.day=day;
  return n;
}
function sdCopied(ev,day,date,s){
  const dur=toMin(ev.end)-toMin(ev.start), n=sdMoved(ev,day,date,s,Math.min(s+dur,24*60-1));
  n.id=rid(); if(ev.repeat==='count') n.date=date;
  return n;
}

/* ---- kopie: průhledný duch hodiny jede s myší, klik do mřížky ji tam vloží, Esc zruší ---- */
function sdCopyStart(ev){
  if(sdOff()) return false;
  SD.copy=clone(ev); document.body.classList.add('sch-copy');
  return true;
}
function sdCopyEnd(){ SD.copy=null; document.body.classList.remove('sch-copy'); $$('.sd-ghost').forEach(g=>g.remove()); }
function sdGhost(sg,e){
  const c=SD.copy, p=sdAt(sg,e.clientX,e.clientY); if(!c||!p) return null;
  const dur=toMin(c.end)-toMin(c.start), lim=sdLim(sg,p.col), s=clamp(sdSnap(p.min),lim[0],lim[1]-dur);
  let g=$('.sd-ghost',sg);
  if(!g){ g=document.createElement('div'); g.className='sd-ghost'; }
  if(g.parentElement!==p.col) p.col.appendChild(g);
  g.className=`sd-ghost hl-${SD.color?SD.color(c):'purple'}`;
  g.style.top=sdY(sg,s)+'px'; g.style.height=Math.max(22,sdY(sg,s+dur)-sdY(sg,s)-2)+'px';
  g.textContent=sdTime(s,s+dur);
  return {p,s};
}

/* ---- tažení: přesun hodiny, natažení za horní/spodní okraj, nová hodina na prázdném místě ---- */
function sdDown(e,sg){
  if(e.button!==0||e.pointerType==='touch'||sdOff()) return;
  if(SD.copy){   /* vložení kopie */
    const r=sdGhost(sg,e); if(!r) return;
    e.preventDefault(); SD.swallow=true; setTimeout(()=>{ SD.swallow=false; },400);
    const n=sdCopied(SD.copy,r.p.day,r.p.date,r.s); sdCopyEnd();
    sdCommit(n.id,n,'Hodina zkopírována'); return;
  }
  if(e.target.closest('.ev-add')) return;
  const rs=e.target.closest('.ev-rs'), evb=e.target.closest('.ev'), col=e.target.classList.contains('sg-col')?e.target:null;
  const w=(rs||evb)?(rs||evb).closest('.ev-w'):null, id=w&&w.querySelector('.ev').dataset.id, ev=id&&S.events[id];
  const mode=rs?(rs.classList.contains('t')?'top':'bot'):evb?'move':col?'new':null;
  if(!mode||(mode!=='new'&&!ev)) return;
  if(mode!=='move') e.preventDefault();
  const x0=e.clientX, y0=e.clientY, a0=sdAt(sg,x0,y0), s0=ev?toMin(ev.start):0, e0=ev?toMin(ev.end):0, grab=ev?a0.min-s0:0;
  let started=false, last=null, box=null;
  const mv=me=>{
    if(!started){
      if(mode==='move'||mode==='new'){ if(Math.hypot(me.clientX-x0,me.clientY-y0)<5) return; }
      started=true; document.body.classList.add('sch-drag'); if(w) w.classList.add('drag'); $$('.ghost',sg).forEach(g=>{ g.hidden=true; });
    }
    const p=sdAt(sg,me.clientX,me.clientY); if(!p) return;
    if(mode==='move'){
      const dur=e0-s0, lim=sdLim(sg,p.col), s=clamp(sdSnap(p.min-grab),lim[0],lim[1]-dur);
      if(w.parentElement!==p.col) p.col.appendChild(w);
      w.style.top=sdY(sg,s)+'px'; w.style.left='3px'; w.style.width='calc(100% - 6px)';
      w.dataset.time=sdTime(s,s+dur); last={day:p.day,date:p.date,s,e:s+dur};
    } else if(mode==='new'){
      const lim=sdLim(sg,a0.col), m1=clamp(sdSnap(a0.min),lim[0],lim[1]), m2=clamp(sdSnap(p.min),lim[0],lim[1]);
      let s=Math.min(m1,m2), en=Math.max(m1,m2); if(en-s<SD_MIN) en=Math.min(lim[1],s+SD_MIN);
      if(!box){ box=document.createElement('div'); box.className='sd-new'; a0.col.appendChild(box); }
      box.style.top=sdY(sg,s)+'px'; box.style.height=(sdY(sg,en)-sdY(sg,s))+'px'; box.textContent=sdTime(s,en);
      last={s,e:en};
    } else {
      const lim=sdLim(sg,w.parentElement); let s=s0, en=e0;
      if(mode==='top') s=clamp(sdSnap(p.min),lim[0],e0-SD_MIN); else en=clamp(sdSnap(p.min),s0+SD_MIN,lim[1]);
      w.style.top=sdY(sg,s)+'px'; w.style.height=Math.max(22,sdY(sg,en)-sdY(sg,s)-2)+'px';
      w.dataset.time=sdTime(s,en); last={s,e:en};
    }
  };
  const up=()=>{
    removeEventListener('pointermove',mv); removeEventListener('pointerup',up); removeEventListener('pointercancel',up);
    document.body.classList.remove('sch-drag');
    if(!started) return;   /* obyčejný klik: hodina se otevře, prázdné místo nabídne novou hodinu (main.js) */
    SD.swallow=true; setTimeout(()=>{ SD.swallow=false; },400);
    if(mode==='new'){ if(box) box.remove(); if(last&&SD.open) SD.open(null,{day:a0.day,date:a0.date,start:fromMin(last.s),end:fromMin(last.e)}); return; }
    if(!last){ renderMain(); return; }
    if(mode==='move'){
      if(last.day===(+ev.day||0)&&last.s===s0&&(ev.repeat!=='once'||last.date===ev.date)){ renderMain(); return; }
      sdCommit(id,sdMoved(ev,last.day,last.date,last.s,last.e),'Hodina přesunuta');
    } else {
      if(last.s===s0&&last.e===e0){ renderMain(); return; }
      const n=clone(ev); n.start=fromMin(last.s); n.end=fromMin(last.e); sdCommit(id,n,'Čas změněn');
    }
  };
  addEventListener('pointermove',mv); addEventListener('pointerup',up); addEventListener('pointercancel',up);
}
/* pravé tlačítko na hodině: Upravit, Kopírovat (duch), Odstranit */
function sdMenu(e,b){
  const ev=S.events[b.dataset.id]; if(!ev) return;
  e.preventDefault();
  const h=`<button class="pop-item" data-v="edit"><span class="pi-ic">${IC.edit}</span>Upravit</button><button class="pop-item" data-v="copy"><span class="pi-ic">${IC.copy}</span>Kopírovat</button><div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit</button>`;
  openPop(b,h,v=>{
    if(v==='edit'&&SD.open) SD.open(ev);
    else if(v==='copy') sdCopyStart(ev);
    else if(v==='del') sdCommit(ev.id,null,'Událost odstraněna');
  },{rect:{left:e.clientX,right:e.clientX,top:e.clientY,bottom:e.clientY}});
}
/* volá renderSchedule po každém vykreslení mřížky; open = formulář hodiny (openEventModal), color = evColor */
function sdBind(sg,open,color){
  SD.open=open; SD.color=color;
  sg.addEventListener('pointerdown',e=>sdDown(e,sg));
  sg.addEventListener('pointermove',e=>{ if(SD.copy&&!sdOff()) sdGhost(sg,e); });
  sg.addEventListener('contextmenu',e=>{ const b=e.target.closest('.ev'); if(b&&!sdOff()) sdMenu(e,b); });
}
export function initSchDrag(){
  /* klik hned po tažení (nebo vložení kopie) se nepočítá jako klik na hodinu ani do prázdného místa */
  addEventListener('click',e=>{ if(SD.swallow){ SD.swallow=false; e.stopPropagation(); e.preventDefault(); } },true);
  addEventListener('pointerdown',()=>{ SD.swallow=false; },true);   /* nový stisk = nový klik (když se cíl překreslil, klik po tažení vůbec nepřijde) */
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&SD.copy){ e.stopPropagation(); sdCopyEnd(); } },true);
  document.addEventListener('uk-view',()=>{ if(SD.copy&&S.view.kind!=='schedule') sdCopyEnd(); });
}

export { sdBind, sdCommit, sdCopyStart, sdUndo };
