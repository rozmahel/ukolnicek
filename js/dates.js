/* Úkolníček – Data a časy: týdny výuky, opakování v rozvrhu, termíny úkolů z textu */
import { pad } from './core.js';
import { S } from './state.js';

/* ================= dates ================= */
const parseD=s=>{ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
function mondayOf(d){ const x=sod(d); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function weekNo(d){ const st=parseD(S.settings.semesterStart); if(!st) return null; return Math.round((mondayOf(d)-mondayOf(st))/(7*864e5))+1; }
function weekInfo(d){ const n=weekNo(d); if(n==null) return null; return {n,odd:n%2!==0,parity:n%2!==0?'lichý':'sudý'}; }
const toMin=t=>{ const [h,m]=(t||'0:0').split(':').map(Number); return h*60+(m||0); };
const fromMin=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const shortDate=d=>`${d.getDate()}. ${d.getMonth()+1}.`;
function isoWeek(d){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dn=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-dn); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil(((t-y0)/864e5+1)/7); }
const weeksBetween=(a,b)=>Math.round((mondayOf(b)-mondayOf(a))/(7*864e5));
/* pevný počet opakování: kolikátá hodina to je (1…count), jinak 0 */
function occIndex(ev,d){
  if(ev.repeat!=='count'||!ev.date) return 0;
  const k=weeksBetween(parseD(ev.date),d);
  return k>=0&&k<(+ev.count||1)?k+1:0;
}
function eventsOnDate(d){
  const wd=(d.getDay()+6)%7, n=weekNo(d), key=ymd(d);
  return Object.values(S.events).filter(ev=>{
    if(ev.repeat==='once') return ev.date===key;
    if(+ev.day!==wd) return false;
    if(ev.repeat==='count') return occIndex(ev,d)>0;
    if(ev.repeat==='odd') return n!=null&&n%2!==0;
    if(ev.repeat==='even') return n!=null&&n%2===0;
    return true;
  }).sort((a,b)=>toMin(a.start)-toMin(b.start));
}
function acadYear(mo){
  const base=parseD(S.settings.semesterStart)||new Date(); const by=base.getFullYear(), bm=base.getMonth()+1;
  if(bm>=8) return mo>=8?by:by+1;
  return by;
}
function parseDue(txt){
  const m=String(txt).match(/(?:^|[^\d.,])(\d{1,2})\.\s?(\d{1,2})(?![\d\p{L}])\.?(?:\s?(\d{4}))?/u);
  if(!m) return null;
  const d=+m[1],mo=+m[2]; if(d<1||d>31||mo<1||mo>12) return null;
  const y=m[3]?+m[3]:acadYear(mo); const dt=new Date(y,mo-1,d);
  return dt.getMonth()===mo-1?dt:null;
}
function relDay(dt){
  const n=Math.round((sod(dt)-sod(new Date()))/864e5);
  if(n===0) return 'dnes'; if(n===1) return 'zítra'; if(n===-1) return 'včera';
  if(n>1) return `za ${n} ${n<5?'dny':'dní'}`;
  return `před ${-n} dny`;
}
function dueChip(dt,done){
  const n=Math.round((sod(dt)-sod(new Date()))/864e5);
  const cls=done?'':n<0?'late':n===0?'today':n<=3?'soon':'';
  return `<span class="chip ${cls}" title="${shortDate(dt)}${dt.getFullYear()}">${shortDate(dt)} · ${relDay(dt)}</span>`;
}

function fmtTime(ts){ if(!ts) return ''; const d=new Date(ts); const t=`${d.getHours()}:${pad(d.getMinutes())}`; return sod(d).getTime()===sod(new Date()).getTime()?t:`${shortDate(d)} ${t}`; }

export { dueChip, eventsOnDate, fmtTime, fromMin, isoWeek, mondayOf, occIndex, parseD, parseDue, shortDate, sod, toMin, weekInfo, weekNo, weeksBetween, ymd };
