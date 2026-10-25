/* Úkolníček – Stránka Dnes: nástěnka z widgetů
   Rozložení (pořadí, sloupec, velikost, které widgety) je zvlášť pro počítač (settings.dashPc) a telefon (settings.dashMob).
   Dokud ho uživatel nezmění, nic se neukládá a platí výchozí rozložení. Každý widget má tři velikosti s jiným obsahem. */
import { $, $$, clamp, DAYS, DAYS_FULL, esc, MONTHS, pad, plural } from '../core.js';
import { S } from '../state.js';
import { modeBtn } from '../theme.js';
import { applyLock, LOCK } from '../lock.js';
import { saveSettings } from '../store.js';
import { eventsOnDate, isoWeek, shortDate, sod, toMin, weekInfo } from '../dates.js';
import { flatPages, pIcon, pTitle } from '../pages.js';
import { isIndex, isSchool, semList } from '../school.js';
import { renderMain } from '../router.js';
import { closePop, openPop } from '../ui.js';
import { evColor, evRow, evTitle } from './schedule.js';
import { allTasks, taskRow } from './tasks.js';
import { wCal, wData, wLook, wPage, wQuick, wStudy, wUploads, wWeek } from './dashWidgets.js';

/* ================= widgety a rozložení ================= */
const SIZES=['s','m','l'], SIZE_CZ={s:'Malý',m:'Střední',l:'Velký'};
/* w = šířka ve sloupcích, h = pevná výška v půlřádcích (1 = poloviční widget, víc = obsah se uvnitř posouvá),
   sizes = jen některé velikosti (uložená zrušená velikost se ukáže jako nejbližší povolená) */
const WG={
  clock:{name:'Hodiny',ic:'🕒',desc:'Čas, datum a týden',w:{s:1,m:1,l:2},h:{s:1},sz:{s:'Čas a datum',m:'Čas, datum a týden',l:'Ručičky, datum a týden'}},
  sched:{free:true,name:'Dnes v rozvrhu',ic:'📅',school:true,desc:'Dnešní hodiny',w:{s:1,m:2,l:2},h:{s:1},sz:{s:'Jen probíhající nebo další hodina',m:'Hodiny, které dnes ještě budou',l:'Všechny dnešní hodiny s průběhem'}},
  tomorrow:{free:true,name:'Zítra',ic:'🌅',school:true,desc:'Hodiny na zítra',w:{s:1,m:2,l:2},h:{s:1},sz:{s:'Počet hodin a od kdy do kdy',m:'Seznam zítřejších hodin',l:'Seznam, a když je zítra volno, další den s výukou'}},
  deadlines:{free:true,name:'Blížící se termíny',ic:'⏰',desc:'Úkoly s datem',opts:'proj',w:{s:1,m:2,l:2},h:{m:4,l:5},sz:{s:'Počty: po termínu, dnes, do týdne',m:'Úkoly na 14 dní',l:'Úkoly na 30 dní rozdělené podle doby'}},
  status:{free:true,name:'Stav úkolů',ic:'📊',desc:'Hotové úkoly podle sekcí',w:{s:1,m:2,l:4},h:{s:1},sz:{s:'Celkový průběh',m:'Průběh po sekcích',l:'Rozpracované sekce ve dvou sloupcích, hotové zvlášť'}},
  week:{name:'Týden',ic:'🗓️',desc:'Hodiny a úkoly den po dni',w:{s:1,m:2,l:2},h:{l:5},sz:{s:'Dnes a zítra v kostce',m:'Pás sedmi dní, klikem den rozbalíš',l:'Celý týden den po dni'}},
  calendar:{name:'Kalendář',ic:'📆',desc:'Měsíc s hodinami a úkoly',w:{s:1,m:2,l:4},sz:{s:'Malý měsíc s tečkami',m:'Měsíc a vedle vybraný den',l:'Velký měsíc s názvy v políčkách'}},
  quick:{name:'Rychlý úkol',ic:'✏️',multi:true,opts:'page',desc:'Zapíšeš úkol bez otevírání stránky',sizes:['s','m'],w:{s:1,m:2},h:{s:1,m:1},sz:{s:'Řádek na zápis',m:'Širší řádek na zápis'}},
  study:{name:'Studium',ic:'🎓',school:true,index:true,opts:'sem',desc:'Kredity a co v semestru chybí',w:{s:1,m:2,l:4},sz:{s:'Kredity a průměr',m:'K tomu předměty, kterým něco chybí',l:'Všechny předměty semestru s body a známkou'}},
  page:{free:true,name:'Stránka',ic:'📃',multi:true,opts:'page',desc:'Náhled vybrané stránky',sizes:['s','l'],w:{s:1,l:2},sz:{s:'Název a kolik úkolů zbývá',l:'Náhled stránky'}},
  look:{name:'Vzhled',ic:'🎨',desc:'Motiv, písmo, den/noc a velikost textu',w:{s:1,m:1,l:2},h:{s:1},sz:{s:'Motiv, písmo, režim a text na klik',m:'Motiv, písmo a den/noc',l:'Motiv, písmo, den/noc a velikost textu'}},
  data:{name:'Zálohy',ic:'🗂️',desc:'Export, import a zálohy na Disku',w:{s:1,m:1,l:2},h:{s:1},sz:{s:'Export a import',m:'K tomu nahrání na Disk',l:'K tomu seznam záloh na Disku'}},
  uploads:{name:'Nahrávání na Disk',ic:'📈',desc:'Jak dlouho trvá nahrání a jak velké jsou zálohy',sizes:['m','l'],w:{m:2,l:4},sz:{m:'Posledních 20 nahrání',l:'Všechna nahrání'}},
};
/* id widgetu = typ (clock, page…), další kusy stejného typu mají id typ-xxxxxx */
const typeOf=id=>String(id).split('-')[0];
const wgDef=id=>WG[typeOf(id)];
const sizesOf=id=>wgDef(id).sizes||SIZES;
/* zrušená velikost → nejbližší povolená (střední → velká, velká → největší povolená) */
const fitSize=(id,s)=>{ const al=sizesOf(id); if(al.includes(s)) return s; return s==='m'&&al.includes('l')?'l':al[al.length-1]; };
const MQ=matchMedia('(max-width:860px)');
const isMob=()=>MQ.matches;
const layKey=mob=>mob?'dashMob':'dashPc';
function defLayout(mob,school){
  /* id:velikost:sloupec */
  const L=(...a)=>a.map(x=>{ const [id,s,c]=x.split(':'); return {id,s,c:+c}; });
  if(mob) return school?L('clock:s:0','status:s:1','sched:m:0','tomorrow:m:0','deadlines:m:0'):L('clock:s:0','status:s:1','deadlines:m:0');
  return school?L('clock:s:0','sched:m:1','tomorrow:s:3','status:s:0','deadlines:m:0'):L('clock:s:0','deadlines:m:1','status:s:3');   /* termíny vlevo pod hodinami: volné místo zůstane vpravo, ne uprostřed stránky */
}
function readLayout(mob){
  const raw=S.settings[layKey(mob)];
  if(!Array.isArray(raw)) return defLayout(mob,isSchool());
  const seen=new Set();
  return raw.filter(x=>x&&wgDef(x.id)&&!seen.has(x.id)&&seen.add(x.id)).map(x=>({id:x.id,s:fitSize(x.id,SIZES.includes(x.s)?x.s:'m'),c:Number.isInteger(x.c)&&x.c>=0?x.c:null,o:x.o&&typeof x.o==='object'?x.o:null}));
}
/* sloupec se ořízne, aby se widget vešel; c=null se doplní z posledního vykreslení */
function writeLayout(mob,list){
  S.settings[layKey(mob)]=list.map(x=>{ let c=x.c==null&&lastC[x.id]?lastC[x.id].base:x.c; const o={id:x.id,s:x.s};
    if(c!=null) o.c=clamp(Math.round(c),0,baseCols(mob)-baseW(x.id,x.s,mob));
    if(x.o&&Object.keys(x.o).length) o.o=x.o; return o; });
  saveSettings();
}
/* widgety, které se teď ukazují (školní jen ve školním režimu; ze sestavy ale nemizí) */
const avail=id=>{ const w=wgDef(id); return !!w&&(!w.school||isSchool())&&(!w.index||isIndex()); };

/* ================= pomocné ================= */
const hm=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const byStart=a=>a.slice().sort((x,y)=>toMin(x.start)-toMin(y.start));
const hDur=m=>`${Math.floor(m/60)}:${pad(m%60)}`;
const wgEvMeta=ev=>[`${ev.start} – ${ev.end}`,ev.place].filter(Boolean).map(esc).join(' · ');
const dayDiff=(d,t0)=>Math.round((sod(d)-t0)/864e5);
function clockFace(){
  let ticks=''; for(let i=0;i<12;i++){ const a=i*30*Math.PI/180, r1=i%3?43:39, r2=46; ticks+=`<line x1="${(50+r1*Math.sin(a)).toFixed(1)}" y1="${(50-r1*Math.cos(a)).toFixed(1)}" x2="${(50+r2*Math.sin(a)).toFixed(1)}" y2="${(50-r2*Math.cos(a)).toFixed(1)}" class="${i%3?'tk':'tk tk-b'}"/>`; }
  return `<svg class="clk-face" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" class="rim"/>${ticks}
    <line x1="50" y1="50" x2="50" y2="27" class="hh" data-clk="h"/><line x1="50" y1="50" x2="50" y2="15" class="mh" data-clk="m"/><line x1="50" y1="56" x2="50" y2="12" class="sh" data-clk="sec"/><circle cx="50" cy="50" r="2.6" class="pin"/></svg>`;
}
/* hodiny běží samy každou sekundu (zbytek Dnes se překresluje jednou za minutu) */
function tick(){
  const els=$$('[data-clk]'); if(!els.length) return;
  const d=new Date(), h=d.getHours(), m=d.getMinutes(), s=d.getSeconds();
  els.forEach(el=>{ const k=el.dataset.clk;
    if(k==='hm') el.textContent=hm(d); else if(k==='s') el.textContent=':'+pad(s);
    else { const deg=k==='h'?(h%12)*30+m/2:k==='m'?m*6+s/10:s*6; el.setAttribute('transform',`rotate(${deg} 50 50)`); } });
}
setInterval(tick,1000);

/* ================= obsah widgetů ================= */
function ctxNow(){
  const now=new Date(), t0=+sod(now), nm=now.getHours()*60+now.getMinutes(), wd=(now.getDay()+6)%7, school=isSchool();
  const tasks=allTasks();
  return {now,t0,nm,wd,school,wi:school?weekInfo(now):null,tasks,
    evs:school?byStart(eventsOnDate(now)):[],
    tm:(()=>{ const d=new Date(now); d.setDate(d.getDate()+1); return d; })()};
}
/* datum bez roku a bez čárky: „pátek 23. října“ */
const dayDate=d=>`${DAYS_FULL[(d.getDay()+6)%7]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
/* datum je v nadpisu Dnes, hodiny pod časem ukážou, co je teď a co bude dál (ve školním režimu), jinak týden */
function clockNext(c){
  const {evs,nm,school,now}=c;
  if(!school) return [dayDate(now),`${isoWeek(now)}. týden`,false];
  const cur=evs.find(ev=>toMin(ev.start)<=nm&&nm<toMin(ev.end)), next=evs.find(ev=>toMin(ev.start)>nm);
  if(cur) return [`teď ${esc(evTitle(cur))}`,next?`${esc(evTitle(next))} za ${fmtIn(toMin(next.start)-nm)}`:`ještě ${fmtIn(toMin(cur.end)-nm)}`,!!next];
  if(next) return ['teď volno',`${esc(evTitle(next))} za ${fmtIn(toMin(next.start)-nm)}`,true];
  return [evs.length?'dnes už nic':'dnes volno',`${isoWeek(now)}. týden`,false];
}
function wClock(s,c){
  const [a,b,soon]=clockNext(c);
  const time=`<div class="clk-t"><span data-clk="hm">${hm(c.now)}</span><span class="clk-sec" data-clk="s">:${pad(c.now.getSeconds())}</span></div>`;
  if(s==='s') return {body:`<div class="clk clk-s">${time}<div class="clk-d${soon?' soon':''}">${soon?b:a}</div></div>`};
  const info=`<div class="clk-d">${a}</div><div class="clk-w${soon?' soon':''}">${b}</div>`;
  if(s==='m') return {body:`<div class="clk clk-m">${time}${info}</div>`};
  return {body:`<div class="clk clk-l">${clockFace()}<div>${time}${info}</div></div>`};
}
/* „za 48 min“, „za 1 h 20 min“ */
const fmtIn=m=>m<60?`${m} min`:`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`;
/* dnešní hodiny na vodorovné ose: minulé potlumené, probíhající a další s obrysem, červená čára = teď */
function tlAxis(evs,nm){
  const a=Math.min(...evs.map(ev=>toMin(ev.start))), b=Math.max(...evs.map(ev=>toMin(ev.end)));
  let h0=Math.floor(a/60), h1=Math.ceil(b/60); if(h1-h0<4) h1=Math.min(24,h0+4); if(h1-h0<4) h0=Math.max(0,h1-4);
  const span=(h1-h0)*60, X=m=>clamp((m-h0*60)/span*100,0,100), step=h1-h0>7?2:1;
  /* dvě hodiny ve stejný čas jdou pod sebe */
  const lane=[], ends=[];
  evs.forEach((ev,i)=>{ let k=ends.findIndex(e=>e<=toMin(ev.start)); if(k<0){ k=ends.length; ends.push(0); } ends[k]=toMin(ev.end); lane[i]=k; });
  let ticks=''; for(let h=Math.ceil(h0/step)*step;h<=h1;h+=step) ticks+=`<span class="tl-tk" style="left:${X(h*60).toFixed(2)}%"><i>${h}</i></span>`;
  const blocks=evs.map((ev,i)=>{ const s0=toMin(ev.start), e0=toMin(ev.end), st=e0<=nm?'past':s0<=nm?'now-ev':'up';
    return `<button class="tl-ev hl-${esc(evColor(ev))} ${st}" data-act="ev" data-id="${ev.id}" style="left:${X(s0).toFixed(2)}%;width:${(X(e0)-X(s0)).toFixed(2)}%;top:${lane[i]*30}px" title="${esc(`${ev.start} – ${ev.end} ${evTitle(ev)}${ev.place?' · '+ev.place:''}`)}"><i></i><span>${esc(evTitle(ev))}</span></button>`; }).join('');
  const now=nm>=h0*60&&nm<=h1*60?`<span class="tl-now" style="left:${X(nm).toFixed(2)}%"></span>`:'';
  return `<div class="tl" style="--lanes:${ends.length}"><div class="tl-ticks">${ticks}</div><div class="tl-row">${blocks}${now}</div></div>`;
}
function wSched(s,c){
  const {evs,nm,now}=c, btn='<button class="btn" data-act="nav" data-v="schedule">Rozvrh</button>';
  const cur=evs.find(ev=>toMin(ev.start)<=nm&&nm<toMin(ev.end)), next=evs.find(ev=>toMin(ev.start)>nm);
  const prog=ev=>Math.round((nm-toMin(ev.start))/Math.max(1,toMin(ev.end)-toMin(ev.start))*100);
  /* probíhající, nebo další hodina jako jeden řádek: čas, název, místo, kdy */
  const when=ev=>ev===cur?`ještě ${fmtIn(toMin(cur.end)-nm)}`:`za ${fmtIn(toMin(ev.start)-nm)}`;
  const focus=cur||next;
  /* malý (poloviční): jen probíhající, nebo další hodina, bez nadpisu */
  if(s==='s'){
    if(!evs.length) return {body:'<div class="empty">Dnes nic v rozvrhu.</div>'};
    if(!focus) return {body:'<div class="empty">Na dnes máš hotovo.</div>'};
    return {body:`<button class="wg-big hl-${esc(evColor(focus))}" data-act="ev" data-id="${focus.id}"><span class="wb-lbl"><span>${focus===cur?'Teď':'Další hodina'}</span><em>${when(focus)}</em></span><b>${esc(evTitle(focus))}</b><small>${wgEvMeta(focus)}</small>${focus===cur?`<span class="bar"><i style="width:${prog(cur)}%"></i></span>`:''}</button>`};
  }
  if(!evs.length) return {title:'Dnes v rozvrhu',btn,body:'<div class="empty">Dnes nemáš v rozvrhu nic.</div>'};
  const axis=tlAxis(evs,nm);
  /* střední: osa a pod ní probíhající nebo další hodina */
  if(s==='m'){
    const ln=focus?`<button class="tl-next" data-act="ev" data-id="${focus.id}"><span class="t">${esc(focus.start)} – ${esc(focus.end)}</span><b>${esc(evTitle(focus))}</b><small>${esc(focus.place||'')}</small><em>${when(focus)}</em></button>`:'<div class="empty">Na dnes máš hotovo.</div>';
    return {title:'Dnes v rozvrhu',btn,body:axis+ln};
  }
  /* velký: osa a pod ní všechny hodiny, minulé potlumené, u probíhající průběh */
  const rows=evs.map(ev=>{ let r=evRow(ev,now).replace('class="ev-row',`class="ev-row ${ev===cur?'now-ev':toMin(ev.end)<=nm?'past':''}`);
    if(ev===cur) r=r.replace(/<\/button>$/,`<span class="ev-prog"><i style="width:${prog(ev)}%"></i></span></button>`);
    return r; }).join('');
  return {title:'Dnes v rozvrhu',btn,body:axis+`<div class="tl-list">${rows}</div>`};
}
function wTomorrow(s,c){
  const {tm}=c, evT=byStart(eventsOnDate(tm)), n=evT.length;
  const span=n?`${esc(evT[0].start)} – ${esc(evT[n-1].end)}`:'';
  if(s==='s') return {title:'Zítra',body:n?`<div class="wg-pad"><div class="wg-stat"><b>${n} ${plural(n,'hodina','hodiny','hodin')}</b> ${span}</div></div>`:'<div class="empty">Zítra volno.</div>'};
  if(s==='m') return {title:'Zítra',body:n?evT.map(ev=>evRow(ev,tm)).join(''):'<div class="empty">Zítra volno.</div>'};
  if(n) return {title:'Zítra',sub:`${DAYS_FULL[(tm.getDay()+6)%7]} · ${n} ${plural(n,'hodina','hodiny','hodin')} · ${span}`,body:evT.map(ev=>evRow(ev,tm)).join('')};
  /* zítra volno: najít nejbližší další den s výukou (do dvou týdnů) */
  for(let i=1;i<=14;i++){ const d=new Date(tm); d.setDate(d.getDate()+i); const l=byStart(eventsOnDate(d));
    if(l.length) return {title:'Zítra volno',sub:`Další výuka: ${DAYS_FULL[(d.getDay()+6)%7]} ${shortDate(d)}`,body:l.map(ev=>evRow(ev,d)).join('')}; }
  return {title:'Zítra',body:'<div class="empty">Zítra volno a v příštích dvou týdnech taky nic.</div>'};
}
/* úkol s termínem: místo štítku jen krátké datum vpravo („dnes“, „zítra“, „po 26. 10.“), po termínu červeně */
function dlRow(t){
  const n=dayDiff(t.due,sod(new Date())), d=t.due;
  const lbl=n===0?'dnes':n===1?'zítra':`${DAYS[(d.getDay()+6)%7].toLowerCase()} ${shortDate(d)}`;
  return taskRow(t,true).replace(/<span class="chip[^"]*"([^>]*)>[^<]*<\/span>/,`<span class="dl-d${n<0?' late':n===0?' today':''}"$1>${lbl}</span>`);
}
function wDeadlines(s,c,id,o){
  const pr=o&&o.proj&&S.pages[o.proj]?o.proj:null;
  const {tasks,t0}=c, open=tasks.filter(t=>!t.done&&t.due&&(!pr||t.root.id===pr)).sort((a,b)=>(a.due-b.due)||(a.i-b.i));
  const btn='<button class="btn" data-act="nav" data-v="tasks">Úkoly</button>';
  const hint='<div class="empty">Na příštích 14 dní nic.</div>';
  if(s==='s'){
    const late=open.filter(t=>dayDiff(t.due,t0)<0).length, tod=open.filter(t=>dayDiff(t.due,t0)===0).length, wk=open.filter(t=>{ const n=dayDiff(t.due,t0); return n>0&&n<=7; }).length;
    const row=(lbl,n,cls)=>`<button class="dl-n ${n&&cls?cls:''}" data-act="nav" data-v="tasks"><b>${n}</b><span>${lbl}</span></button>`;
    return {title:'Termíny',btn,body:`<div class="dl-ns">${row('po termínu',late,'late')}${row('dnes',tod,'today')}${row('do 7 dní',wk,'')}</div>`};
  }
  /* střední: 14 dní, velký: 30 dní; obojí po skupinách (po termínu, dnes, …) */
  const G=s==='m'?[['Po termínu',n=>n<0],['Dnes',n=>n===0],['Tento týden',n=>n>0&&n<=7],['Později',n=>n>7&&n<=14]]
    :[['Po termínu',n=>n<0],['Dnes',n=>n===0],['Zítra',n=>n===1],['Do konce týdne',n=>n>1&&n<=7],['Později',n=>n>7&&n<=30]];
  const body=G.map(([lbl,f],i)=>{ const l=open.filter(t=>f(dayDiff(t.due,t0))); return l.length?`<div class="wg-grp${i?'':' late'}">${lbl}</div>${l.map(dlRow).join('')}`:''; }).join('');
  return {title:'Termíny',sub:s==='l'?'Na příštích 30 dní':'',btn,body:body||(s==='l'?hint.replace('14','30'):hint)};
}
function wStatus(s,c){
  const {tasks,school}=c, subj=[];
  flatPages().forEach(({p})=>{ const secs=[]; tasks.filter(t=>t.pg.id===p.id).forEach(t=>{ let x=secs.find(y=>y.sec===t.sec); if(!x){ const su=t.subj&&S.subjects[t.subj]; x={p,sec:t.sec,key:t.key,total:0,done:0,color:su?su.color:''}; secs.push(x);} x.total++; if(t.done) x.done++; }); subj.push(...secs); });
  const title=`Stav úkolů${s==='s'?'':` podle ${school?'předmětů':'nadpisů'}`}`;
  if(!tasks.length) return s==='s'?{body:'<div class="empty">Zatím žádné úkoly.</div>'}:{title,body:'<div class="empty">Zatím žádné úkoly. Na libovolné stránce napiš <b>[]</b> a mezeru.</div>'};
  const item=({p,sec,key,total,done,color})=>`<button class="subj hl-${esc(color||p.color||'gray')}" data-act="goto-task" data-k="${esc(key)}">${sec?'<span class="ti-ic"><span class="ti-dot"></span></span>':pIcon(p)}<span class="nm">${esc(sec||pTitle(p))}</span><span class="n">${done}/${total}</span><span class="bar"><i style="width:${Math.round(done/total*100)}%"></i></span></button>`;
  if(s==='s'){
    const done=tasks.filter(t=>t.done).length, pct=Math.round(done/tasks.length*100), wip=subj.filter(x=>x.done<x.total).length;
    return {body:`<button class="st-sum st-half" data-act="nav" data-v="tasks"><span class="st-top"><span class="wg-stat"><b>${done} z ${tasks.length}</b> hotovo</span><span class="st-n">${wip?`${wip} ${plural(wip,'sekce','sekce','sekcí')}`:'nic rozpracovaného'}</span></span><span class="bar"><i style="width:${pct}%"></i></span></button>`};
  }
  if(s==='m') return {title,body:subj.map(item).join('')};
  const wip=subj.filter(x=>x.done<x.total), fin=subj.filter(x=>x.done===x.total);
  return {title,body:`${wip.length?`<div class="st-grid">${wip.map(item).join('')}</div>`:'<div class="empty">Všechno hotovo.</div>'}${fin.length?`<div class="st-fin"><span>Hotovo:</span> ${fin.map(x=>`<button class="linkbtn" data-act="goto-task" data-k="${esc(x.key)}">${esc(x.sec||pTitle(x.p))}</button>`).join(', ')}</div>`:''}`};
}
const RENDER={clock:wClock,sched:wSched,tomorrow:wTomorrow,deadlines:wDeadlines,status:wStatus,week:wWeek,calendar:wCal,quick:wQuick,study:wStudy,page:wPage,look:wLook,data:wData,uploads:wUploads};

const GRIP='<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';
function wgHtml({id,s,o},c){
  const t=typeOf(id), r=RENDER[t](s,c,id,o||{});
  /* filtr projektu u termínů ukáže v podtitulku */
  if(t==='deadlines'&&o&&o.proj&&S.pages[o.proj]) r.sub=`Jen ${esc(pTitle(S.pages[o.proj]))}`;
  const fh=WG[t].h&&WG[t].h[s];
  return `<section class="card wg sz-${s} wg-${t}${fh?fh===1?' half':' fixh':''}" data-wg="${esc(id)}">
    <button class="wg-grip" data-act="wg-menu" title="Táhni pro přesun, klikni pro velikost" aria-label="${esc(WG[t].name)}: velikost, přesun, odebrání">${GRIP}</button>
    ${r.title?`<div class="card-h"><div><h2>${esc(r.title)}</h2>${r.sub?`<div class="wg-h-sub">${r.sub}</div>`:''}</div>${r.btn||''}</div>`:''}
    <div class="card-body">${r.body}</div></section>`;
}

/* ================= rozložení: vlastní sloupce =================
   Každý widget má sloupec (c, počítáno zleva od 0) a šířku podle velikosti (WG[id].w).
   Widgety se skládají v pořadí z rozložení, každý ve svých sloupcích co nejvýš, pod to, co tam už je.
   Změna jednoho widgetu tak pohne jen widgety pod ním ve stejných sloupcích, ostatní zůstanou.
   Mřížka má v širokém zobrazení vždy 4 sloupce (sloupec aspoň MIN_COL; když widgety přesahují okno, posouvá se do stran), v úzkém 2. Posuny jsou animované. */
const baseCols=mob=>mob?2:4;
const baseW=(id,s,mob)=>{ const w=wgDef(id).w[s]; return mob?Math.min(w,2):w; };
/* šířka sloupce: v širokém zobrazení aspoň MIN_COL; mřížka je široká jen po nejpravější použitý sloupec,
   takže posuvník do stran se ukáže, jen když widgety opravdu přesahují okno */
const MIN_COL=200;
/* „deska“ (4.11.0): widgety k sobě přiléhají bez mezer, list kolem má okraj 1 px z každé strany */
const SHEET_B=2;
function geom(){
  const g=$('#wg-grid'); if(!g) return null;
  const sc=g.parentElement, cs=sc&&getComputedStyle(sc), room=(sc?sc.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight):g.clientWidth)-SHEET_B;
  const mob=isMob(), cols=mob?2:4, gap=0;
  const fs=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'))||1;
  const colW=mob?(room-gap)/2:Math.max(MIN_COL*fs,(room-gap*3)/4);
  return {g,mob,cols,gap,colW,room};
}
/* rozložení → sloupce a šířky v aktuální mřížce (počítačové rozložení v úzkém okně se složí do 2 sloupců) */
function effItems(list,cols,mob){
  const deg=cols<baseCols(mob);
  return list.map(x=>{ const bw=baseW(x.id,x.s,mob), w=deg?(bw>=2?cols:1):Math.min(bw,cols);
    const c=x.c==null?null:deg?(w>=cols?0:x.c>=2?1:0):clamp(x.c,0,cols-w);
    return {id:x.id,c,w}; });
}
/* skládání: c=null (starší uložené rozložení) = sloupec, kde je nejvíc místa nahoře */
function place(items,cols,H,gap){
  const sky=Array(cols).fill(0), P={};
  items.forEach(it=>{
    let c=it.c;
    if(c==null){ let by=Infinity; for(let k=0;k+it.w<=cols;k++){ const y=Math.max(...sky.slice(k,k+it.w)); if(y<by){ by=y; c=k; } } }
    c=clamp(c,0,cols-it.w);
    const y=Math.max(...sky.slice(c,c+it.w)); P[it.id]={c,w:it.w,y};
    for(let k=c;k<c+it.w;k++) sky[k]=y+(H[it.id]||0)+gap;
  });
  P.$h=Math.max(0,...sky)-gap; return P;
}
/* výška widgetu: násobky půl řádku (řádek = ROW_S), takže widgety vedle sebe i pod sebou lícují.
   WG.h = pevný počet půlřádků (1 = poloviční widget, dva pod sebou mají výšku jednoho řádku; víc = obsah se posouvá uvnitř).
   Ostatní mají aspoň celý řádek podle obsahu; seznamy (WG.free) ve středním a velkém přesně podle obsahu. */
const ROW_S=184;
function snapH(el,id,s,gap){
  el.style.height='';
  const D=wgDef(id), fix=D.h&&D.h[s];
  const fs=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'))||1, R=(ROW_S*fs-gap)/2;
  if(fix){ const H=Math.round(fix*R+(fix-1)*gap); el.style.height=H+'px'; return H; }
  const h=el.offsetHeight;
  if(D.free&&s!=='s') return h;
  const k=Math.max(2,Math.ceil((h+gap)/(R+gap)-.01));
  const H=Math.round(k*R+(k-1)*gap); el.style.height=H+'px'; return H;
}
const lastPos={}, lastC={};
let natH={};   /* výšky widgetů před protažením (pro výpočet místa při tažení) */
let lastGridH=0;   /* výška mřížky z minula: nová mřížka ji má hned, aby prohlížeč neposunul stránku nahoru */   /* poslední poloha (kvůli plynulému přesunu po překreslení) a sloupec v základní mřížce */
function layoutGrid(listOverride){
  const G=geom(); if(!G||G.room<=0) return; const {g,mob,cols,gap,colW,room}=G;
  const list=(listOverride||readLayout(mob)).filter(x=>avail(x.id));
  const items=effItems(list,cols,mob), cards=new Map($$('#wg-grid > .wg').map(w=>[w.dataset.wg,w]));
  items.forEach(it=>{ const el=cards.get(it.id); if(el){ const wp=(it.w*colW+(it.w-1)*gap)+'px'; if(el.style.width!==wp) el.style.width=wp; } });
  const sz={}; list.forEach(x=>{ sz[x.id]=x.s; });
  const H={}; items.forEach(it=>{ const el=cards.get(it.id); H[it.id]=el?snapH(el,it.id,sz[it.id],gap):0; });
  const P=place(items,cols,H,gap), fresh=!g.classList.contains('anim'), sc=baseCols(mob)/cols;
  const to=[];
  items.forEach(it=>{ const el=cards.get(it.id); if(!el) return; const p=P[it.id], x=Math.round(p.c*(colW+gap)), y=p.y;
    if(fresh){ const o=lastPos[it.id]; el.style.transform=`translate(${o?o.x:x}px,${o?o.y:y}px)`; }
    to.push([el,x,y]); lastPos[it.id]={x,y}; lastC[it.id]={c:p.c,w:p.w,base:p.c*sc}; });
  g.style.height=P.$h+'px'; lastGridH=P.$h;
  /* deska bez děr: widget se protáhne dolů až k widgetu pod ním ve stejných sloupcích (poslední až ke spodku listu) */
  const fin={};
  items.forEach(it=>{ const el=cards.get(it.id), p=P[it.id]; if(!el||!p) return; let to=P.$h;
    items.forEach(o=>{ const q=P[o.id]; if(o.id!==it.id&&q&&q.y>p.y&&q.c<p.c+p.w&&p.c<q.c+q.w&&q.y<to) to=q.y; });
    const h=Math.max(H[it.id]||0,Math.round(to-p.y)); fin[it.id]=h; const hh=h+'px'; if(el.style.height!==hh) el.style.height=hh;
    el.dataset.nh=H[it.id]||0; });   /* data-nh = výška před protažením */
  natH=H;
  fillHoles(g,items.map(it=>P[it.id]&&fin[it.id]!=null?{c:P[it.id].c,w:P[it.id].w,y:P[it.id].y,h:fin[it.id]}:null).filter(Boolean),cols,colW,P.$h);
  const right=Math.max(0,...items.map(it=>P[it.id]?P[it.id].c+P[it.id].w:0)), need=right*colW+Math.max(0,right-1)*gap;
  const gw=mob||need<=room+1?'':Math.ceil(need)+'px'; if(g.style.width!==gw) g.style.width=gw;
  if(fresh){ void g.offsetWidth; g.classList.add('anim'); }
  to.forEach(([el,x,y])=>{ el.style.transform=`translate(${x}px,${y}px)`; });
}
/* místa, kam se žádný widget nedostal (vedle širokého widgetu pod úzkým), dostanou prázdnou buňku se stejnými čarami,
   takže deska je vždy celý obdélník rozdělený čarami */
function fillHoles(g,rects,cols,colW,total){
  g.querySelectorAll(':scope > .wg-fill').forEach(x=>x.remove());
  const gaps=[];
  for(let k=0;k<cols;k++){
    const iv=rects.filter(r=>r.c<=k&&k<r.c+r.w).map(r=>[r.y,r.y+r.h]).sort((a,b)=>a[0]-b[0]);
    let y=0; iv.forEach(([a,b])=>{ if(a-y>2) gaps.push({k,y0:y,y1:a}); y=Math.max(y,b); });
    if(total-y>2) gaps.push({k,y0:y,y1:total});
  }
  /* sousední sloupce se stejnou dírou = jedna širší buňka */
  gaps.sort((a,b)=>a.y0-b.y0||a.y1-b.y1||a.k-b.k);
  const out=[]; gaps.forEach(gp=>{ const l=out[out.length-1]; if(l&&l.y0===gp.y0&&l.y1===gp.y1&&l.k+l.n===gp.k) l.n++; else out.push({k:gp.k,n:1,y0:gp.y0,y1:gp.y1}); });
  out.forEach(f=>{ const d=document.createElement('div'); d.className='wg-fill'; d.setAttribute('aria-hidden','true');
    Object.assign(d.style,{left:Math.round(f.k*colW)+'px',top:f.y0+'px',width:Math.round(f.n*colW)+'px',height:(f.y1-f.y0)+'px'}); g.appendChild(d); });
}
let ro=null, roRaf=0, fontsDone=false;
function watchGrid(){
  if(ro) ro.disconnect(); ro=null;
  const g=$('#wg-grid'); if(!g) return;
  ro=new ResizeObserver(()=>{ cancelAnimationFrame(roRaf); roRaf=requestAnimationFrame(()=>layoutGrid(drag&&drag.on?drag.list:null)); });
  ro.observe(g); if(g.parentElement) ro.observe(g.parentElement); $$('#wg-grid > .wg').forEach(w=>ro.observe(w));
}

/* ================= stránka ================= */
function renderToday(){
  const school=isSchool();
  if(!Object.keys(S.pages).length&&(!school||!Object.keys(S.events).length)){
    if(ro){ ro.disconnect(); ro=null; }
    /* prázdná aplikace: krátká věta a tlačítko, žádná „úvodní stránka“ */
    $('#view').innerHTML=`<div class="view"><div class="welcome"><h1>Zatím tu nic není</h1><p class="muted">${school?'Založ první projekt, třeba pro semestr, a piš do něj poznámky a úkoly. Hodiny si zapíšeš do rozvrhu.':'Založ první projekt a piš do něj poznámky a úkoly. Rozvrh a Index zapneš v Nastavení jako školní režim.'}</p><div class="m-actions"><button class="btn pri" data-act="new-page">＋ Nový projekt</button>${school?'<button class="btn" data-act="nav" data-v="schedule">Otevřít rozvrh</button>':''}</div></div></div>`;
    return;
  }
  const c=ctxNow(), mob=isMob(), main=$('#main'), st=main?main.scrollTop:0;
  $$('#wg-grid > .wg.fixh').forEach(w=>{ const b=w.querySelector('.card-body'); if(b) inScroll[scrKey(w)]=b.scrollTop; });
  const list=readLayout(mob).filter(x=>avail(x.id));
  /* datum je v hodinách, nahoře jen nástroje: Přidat widget | zámek, den/noc */
  /* nadpis = dnešní datum, vedle týden (ve školním režimu i týden výuky) */
  const wi=c.wi, wk=`${isoWeek(c.now)}. týden${c.school&&wi?` · ${wi.n}. týden výuky, ${wi.parity}`:''}`;
  const head=`<div class="v-head dash-head"><div class="dash-title"><h1 class="v-title">${DAYS_FULL[(c.now.getDay()+6)%7].replace(/^./,x=>x.toUpperCase())} ${c.now.getDate()}. ${MONTHS[c.now.getMonth()]}</h1><span>${wk}</span></div>
    <div class="v-tools"><button class="btn btn-text wg-addbtn" data-act="wg-add"><span aria-hidden="true">＋</span> Přidat widget</button><span class="dash-sep" aria-hidden="true"></span><button class="icon-btn lock-btn" data-act="lock"></button>${modeBtn()}</div></div>`;
  $('#view').innerHTML=`<div class="view dash">${head}
    <div class="wg-scroll"><div class="wg-grid" id="wg-grid" style="height:${lastGridH}px">${list.map(x=>wgHtml(x,c)).join('')}</div></div>
    ${list.length?'':`<div class="empty dash-empty">Na Dnes teď nic není. Odemkni zámek a přidej widget tlačítkem <b>Přidat widget</b>.</div>`}
  </div>`;
  applyLock(); tick(); layoutGrid(); watchGrid(); keepInScroll();
  if(document.fonts&&!fontsDone) document.fonts.ready.then(()=>{ fontsDone=true; layoutGrid(); });
  if(main&&main.scrollTop!==st) main.scrollTop=st;   /* překreslení (velikost, ‹ ›) nemá posouvat stránku */
}
/* seznamy s pevnou výškou (termíny, týden) si při překreslení (každou minutu) drží posun;
   velký Týden poprvé odjede na dnešek */
const inScroll={};
const scrKey=w=>w.dataset.wg+':'+[...w.classList].find(x=>x.startsWith('sz-'));
function keepInScroll(){
  $$('#wg-grid > .wg.fixh').forEach(w=>{ const b=w.querySelector('.card-body'), k=scrKey(w); if(!b) return;
    if(inScroll[k]!=null){ b.scrollTop=inScroll[k]; return; }
    const t=b.querySelector('.wk-day.today'); if(t) b.scrollTop=t.offsetTop-b.offsetTop;
    inScroll[k]=b.scrollTop; });
}
MQ.addEventListener('change',()=>{ if(S.ready&&S.view.kind==='today'){ closePop(); renderMain(); } });

/* ================= úpravy rozložení ================= */
/* menu na Dnes jede při posouvání stránky s tlačítkem, které ho otevřelo
   (po překreslení si tlačítko najde znovu podle widgetu); když tlačítko zmizí z obrazovky, menu se zavře */
let popTrack=null;
function dashPop(anchor,h,fn){
  const p=openPop(anchor,h,fn), r=anchor.getBoundingClientRect(), w=anchor.closest('.wg');
  p.classList.add('dash-pop');
  popTrack={p,wid:w?w.dataset.wg:null,add:anchor.classList.contains('wg-addbtn'),y:r.top,x:r.left,pt:parseFloat(p.style.top)||0,pl:parseFloat(p.style.left)||0};
  return p;
}
document.addEventListener('scroll',()=>{
  const t=popTrack; if(!t) return;
  if(S.pop!==t.p){ popTrack=null; return; }
  const a=t.add?$('.dash .wg-addbtn'):t.wid?$(`.wg[data-wg="${t.wid}"] .wg-grip`):null;
  if(!a){ closePop(); popTrack=null; return; }
  const r=a.getBoundingClientRect(), m=$('#main'), top=m?m.getBoundingClientRect().top:0;
  if(r.bottom<top||r.top>innerHeight){ closePop(); popTrack=null; return; }
  t.p.style.top=(t.pt+r.top-t.y)+'px'; t.p.style.left=(t.pl+r.left-t.x)+'px';
},true);

function openWidgetAdd(anchor){
  if(LOCK) return;
  const mob=isMob(), have=new Set(readLayout(mob).map(x=>x.id));
  const miss=Object.keys(WG).filter(t=>(WG[t].multi||!have.has(t))&&avail(t));
  const stored=Array.isArray(S.settings[layKey(mob)]);
  const h=`<div class="pop-h">Přidat na Dnes</div>
    ${miss.length?miss.map(t=>`<button class="pop-item" data-v="add:${t}"><span>${esc(WG[t].name)}${WG[t].multi&&have.has(t)?' (další)':''}<small>${esc(WG[t].desc)}</small></span></button>`).join(''):'<p class="note" style="padding:4px 8px 8px">Všechny widgety už na Dnes jsou.</p>'}
    ${stored?`<div class="pop-sep"></div><button class="pop-item" data-v="reset"><span>Výchozí rozložení<small>Jen pro tuto šířku okna, druhé rozložení se nezmění</small></span></button>`:''}`;
  dashPop(anchor,h,v=>{
    if(v==='reset'){ delete S.settings[layKey(mob)]; saveSettings(); renderMain(); return; }
    const t=v.slice(4); if(!WG[t]) return;
    const id=have.has(t)?t+'-'+Math.random().toString(36).slice(2,8):t;
    /* nový widget na konec, do sloupce, kde je nejvíc místa (c=null → dopočítá se a uloží) */
    const l=readLayout(mob); l.forEach(x=>{ if(x.c==null&&lastC[x.id]) x.c=lastC[x.id].base; });
    l.push({id,s:t==='clock'||t==='look'||t==='data'?'s':'m',c:null}); S.settings[layKey(mob)]=l; renderMain(); writeLayout(mob,readLayout(mob));
    setTimeout(()=>{ const el=$(`.wg[data-wg="${id}"]`); if(el){ el.scrollIntoView({block:'nearest'}); el.classList.add('flash'); if(WG[t].opts==='page') openWidgetOpts(el); } },30);
  });
}
let dragEnd=0;
/* sousedé ve stejných sloupcích (pro Výš / Níž) */
function colNeighbour(L,id,dir){
  const V=L.filter(y=>avail(y.id)), j=V.findIndex(y=>y.id===id), me=lastC[id]; if(j<0||!me) return null;
  const over=o=>{ const p=lastC[o.id]; return p&&p.c<me.c+me.w&&me.c<p.c+p.w; };
  if(dir<0){ for(let k=j-1;k>=0;k--) if(over(V[k])) return V[k]; }
  else for(let k=j+1;k<V.length;k++) if(over(V[k])) return V[k];
  return null;
}
function openWidgetMenu(anchor){
  if(LOCK||Date.now()-dragEnd<350) return;
  const w=anchor.closest('.wg'); if(!w) return;
  const id=w.dataset.wg, mob=isMob(), l=readLayout(mob), it=l.find(x=>x.id===id); if(!it) return;
  const G=geom(), me=lastC[id]||{c:0,w:1}, cols=G?G.cols:baseCols(mob);
  const up=colNeighbour(l,id,-1), down=colNeighbour(l,id,1);
  const D=wgDef(id);
  const h=`<div class="pop-h">${esc(D.name)}</div>
    <div class="wg-sizes" role="radiogroup" aria-label="Velikost">${sizesOf(id).map(s=>`<button class="${it.s===s?'on':''}" data-v="${s}" role="radio" aria-checked="${it.s===s}" title="${esc(D.sz[s])}">${SIZE_CZ[s]}</button>`).join('')}</div>
    <div class="wg-sz-note">${esc(D.sz[it.s])}</div>
    <div class="pop-sep"></div>
    <div class="wg-moves"><span>Posunout</span>
      <button data-v="up" ${up?'':'disabled'} title="Výš" aria-label="Posunout výš">↑</button>
      <button data-v="down" ${down?'':'disabled'} title="Níž" aria-label="Posunout níž">↓</button>
      <button data-v="left" ${me.c>0?'':'disabled'} title="Doleva" aria-label="Posunout doleva">←</button>
      <button data-v="right" ${me.c+me.w<cols?'':'disabled'} title="Doprava" aria-label="Posunout doprava">→</button>
    </div>
    ${D.opts?`<button class="pop-item" data-v="opts">${esc(OPT_CZ[D.opts])}…</button>`:''}
    <button class="pop-item danger" data-v="del">Odebrat z Dnes</button>`;
  dashPop(anchor,h,v=>{
    if(v==='opts'){ setTimeout(()=>openWidgetOpts(w),0); return; }
    const L=readLayout(mob), x=L.find(y=>y.id===id); if(!x) return;
    L.forEach(y=>{ if(y.c==null&&lastC[y.id]) y.c=lastC[y.id].base; });   /* zafixovat sloupce, ať se nic nepřeskládá */
    const step=baseCols(mob)/cols;
    if(sizesOf(id).includes(v)){ if(x.s===v) return; x.s=v; }
    else if(v==='del') L.splice(L.indexOf(x),1);
    else if(v==='left'||v==='right') x.c=(x.c||0)+(v==='left'?-step:step);
    else if(v==='up'||v==='down'){ const o=colNeighbour(L,id,v==='up'?-1:1); if(!o) return; const a=L.indexOf(x), b=L.findIndex(y=>y.id===o.id); L[a]=L[b]; L[b]=x; }
    else return;
    writeLayout(mob,L); renderMain();
    if(v==='up'||v==='down'||v==='left'||v==='right'){ setTimeout(()=>{ const g=$(`.wg[data-wg="${id}"] .wg-grip`); if(g) openWidgetMenu(g); },320); }
  });
}

/* ================= nastavení widgetu (⚙) =================
   Uloží se do položky rozložení jako o (page = stránka, proj = projekt, sem = semestr). */
const OPT_CZ={page:'Vybrat stránku',proj:'Jen jeden projekt',sem:'Který semestr'};
function openWidgetOpts(anchor){
  const w=anchor.closest&&anchor.closest('.wg')||(anchor.dataset&&$(`.wg[data-wg="${anchor.dataset.w}"]`)); if(!w) return;
  const id=w.dataset.wg, D=wgDef(id), mob=isMob(), it=readLayout(mob).find(x=>x.id===id); if(!it||!D.opts) return;
  const o=it.o||{}, pages=flatPages();
  const pick=(v,cur,ic,label,depth)=>`<button class="pop-item ${cur?'on':''}" data-v="${esc(v)}" role="menuitemradio" aria-checked="${!!cur}" style="${depth?`padding-left:${8+depth*14}px`:''}"><span class="pi-ic">${cur?'✓':esc(ic)}</span><span class="nm">${esc(label)}</span></button>`;
  const none='<p class="note" style="padding:4px 8px 8px">Zatím žádné stránky.</p>';
  let h=`<div class="pop-h">${esc(D.name)} · ${esc(OPT_CZ[D.opts])}</div>`;
  if(D.opts==='page') h+=pages.length?pages.map(({p,depth})=>pick(p.id,o.page===p.id,p.icon||'·',pTitle(p),depth)).join(''):none;
  else if(D.opts==='proj') h+=pick('*',!o.proj,'◉','Všechny projekty',0)+'<div class="pop-sep"></div>'+pages.filter(x=>!x.depth).map(({p})=>pick(p.id,o.proj===p.id,p.icon||'·',pTitle(p),0)).join('');
  else if(D.opts==='sem'){ const sl=semList(); h+=pick('*',!o.sem,'◉','Aktuální (nejnovější viditelný)',0)+(sl.length?'<div class="pop-sep"></div>':'')+sl.map(sm=>pick(sm.id,o.sem===sm.id,'🎓',sm.name||'Semestr',0)).join(''); }
  dashPop(w.querySelector('.wg-grip')||w,h,v=>{
    const L=readLayout(mob), x=L.find(y=>y.id===id); if(!x) return;
    L.forEach(y=>{ if(y.c==null&&lastC[y.id]) y.c=lastC[y.id].base; });
    const no=Object.assign({},x.o||{});
    if(D.opts==='page') no.page=v;
    else if(D.opts==='proj'){ if(v==='*') delete no.proj; else no.proj=v; }
    else if(D.opts==='sem'){ if(v==='*') delete no.sem; else no.sem=v; }
    x.o=no; writeLayout(mob,L); renderMain();
  });
}

/* ================= přesouvání tažením za ⋮⋮ (myš i prst) =================
   Kopie widgetu jede za kurzorem. Na jeho původním místě je obrys, který se posouvá tam, kam se widget po puštění vloží;
   ostatní widgety mu plynule uhnou. Sloupec určuje levý okraj kopie, pořadí její výška. Esc tažení zruší. */
let drag=null;
function dragTarget(gx,gy){
  const G=geom(); if(!G) return null; const {g,mob,cols,gap,colW}=G, gr=g.getBoundingClientRect();
  const id=drag.w.dataset.wg, me=drag.orig.find(x=>x.id===id), rest=drag.orig.filter(x=>x.id!==id), vis=rest.filter(x=>avail(x.id));
  const w=effItems([me],cols,mob)[0].w, c=clamp(Math.round((gx-gr.left)/(colW+gap)),0,cols-w), ry=gy-gr.top;
  const H={}; $$('#wg-grid > .wg').forEach(el=>{ H[el.dataset.wg]=natH[el.dataset.wg]||el.offsetHeight; });
  let best=null;
  for(let i=0;i<=vis.length;i++){
    const items=effItems(vis,cols,mob); items.splice(i,0,{id,c,w});
    const d=Math.abs(place(items,cols,H,gap)[id].y-ry);
    if(!best||d<best.d-.5) best={d,i};
  }
  const nl=rest.map(x=>Object.assign({},x)), at=best.i<vis.length?nl.findIndex(x=>x.id===vis[best.i].id):nl.length;
  nl.splice(at,0,Object.assign({},me,{c:c*(baseCols(mob)/cols)}));
  return {key:best.i+':'+c,list:nl};
}
function startDrag(){
  const w=drag.w, r=w.getBoundingClientRect(), gh=w.cloneNode(true), mob=isMob();
  gh.classList.add('wg-ghost'); gh.removeAttribute('data-wg'); gh.removeAttribute('style'); gh.querySelectorAll('[data-clk]').forEach(x=>x.removeAttribute('data-clk'));
  Object.assign(gh.style,{width:r.width+'px',height:r.height+'px',left:r.left+'px',top:r.top+'px'});
  document.body.appendChild(gh);
  const L=readLayout(mob); L.forEach(y=>{ if(y.c==null&&lastC[y.id]) y.c=lastC[y.id].base; });
  Object.assign(drag,{on:true,gh,mob,dx:drag.x-r.left,dy:drag.y-r.top,l0:r.left,t0:r.top,orig:L,list:L,key:''});
  w.classList.add('wg-drag'); document.body.classList.add('dash-dragging'); closePop();
}
function endWgDrag(save){
  const d=drag; drag=null; if(!d||!d.on) return;
  document.body.classList.remove('dash-dragging'); dragEnd=Date.now();
  const id=d.w.dataset.wg, moved=save&&d.list!==d.orig;
  if(!moved) layoutGrid();
  /* kopie doklouže na nové místo, pak se rozložení uloží */
  const g=$('#wg-grid'), p=lastPos[id];
  if(g&&p){ const gr=g.getBoundingClientRect(); d.gh.style.transition='transform .2s cubic-bezier(.2,.8,.2,1)'; d.gh.style.transform=`translate(${gr.left+p.x-d.l0}px,${gr.top+p.y-d.t0}px)`; }
  setTimeout(()=>{ d.gh.remove(); d.w.classList.remove('wg-drag'); if(moved){ writeLayout(d.mob,d.list); renderMain(); } },200);
}
document.addEventListener('pointerdown',e=>{
  const g=e.target.closest&&e.target.closest('.wg-grip'); if(!g||LOCK||e.button>0||drag) return;
  drag={w:g.closest('.wg'),x:e.clientX,y:e.clientY,on:false};
  try{ g.setPointerCapture(e.pointerId); }catch(_){}
});
document.addEventListener('pointermove',e=>{
  if(!drag) return;
  if(!drag.on){ if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6) return; startDrag(); }
  e.preventDefault();
  const gx=e.clientX-drag.dx, gy=e.clientY-drag.dy;
  drag.gh.style.transform=`translate(${gx-drag.l0}px,${gy-drag.t0}px) rotate(1deg)`;
  const main=$('#main'); if(main){ if(e.clientY<70) main.scrollBy(0,-14); else if(e.clientY>innerHeight-70) main.scrollBy(0,14); }
  const t=dragTarget(gx,gy); if(!t||t.key===drag.key) return;
  drag.key=t.key;
  const same=t.list.map(x=>x.id+x.c).join()===drag.orig.map(x=>x.id+x.c).join();
  drag.list=same?drag.orig:t.list; layoutGrid(drag.list);
},{passive:false});
document.addEventListener('pointerup',()=>{ if(drag&&!drag.on) drag=null; else endWgDrag(true); });
document.addEventListener('pointercancel',()=>{ if(drag&&!drag.on) drag=null; else endWgDrag(false); });
addEventListener('keydown',e=>{ if(drag&&drag.on&&e.key==='Escape') endWgDrag(false); });

export { openWidgetAdd, openWidgetMenu, openWidgetOpts, renderToday };
