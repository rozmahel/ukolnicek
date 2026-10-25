/* Úkolníček – Dnes: další widgety (Týden, Kalendář, Rychlý úkol, Studium, Stránka, Vzhled, Zálohy).
   Každý widget je funkce (velikost s/m/l, kontext ctxNow z today.js, id widgetu, nastavení o) → {title, sub, btn, body}.
   Stav, který se neukládá (vybraný den, posun měsíce/týdne), drží DW_UI podle id widgetu. */
import { $, DAYS, DAYS_FULL, esc, lsGet, lsSet, plain, plural } from '../core.js';
import { S } from '../state.js';
import { applySkin, fontOf, FONTS, isDarkNow, setFont, setSkin, skinOf, SKINS } from '../theme.js';
import { DATA_REV, isDirty, META, savePage, saveSettings } from '../store.js';
import { eventsOnDate, fmtTime, isoWeek, mondayOf, shortDate, toMin, ymd } from '../dates.js';
import { isArchived, newBlock, pIcon, pTitle } from '../pages.js';
import { isSchool, semList, subjBlockText, subjLabel, subjsOf } from '../school.js';
import { sanitize } from '../sanitize.js';
import { renderSidebar } from '../sidebar.js';
import { renderMain } from '../router.js';
import { hiddenMask } from '../editor/render.js';
import { toast } from '../ui.js';
import { evColor, evTitle } from './schedule.js';
import { fmtAvg, fmtNum, gradeChip, GRADES, partsOpen, subjCr, subjDone, subjMax, subjPoints, wavg } from './subjects.js';
import { allTasks, taskRow } from './tasks.js';
import { applyFontScale, applyTheme, exportData, FS_STEPS, importFile, openSettings } from './settings.js';
import { Sync } from '../sync/sync.js';
import { fmtSec, UpLog } from '../sync/uplog.js';

const DW_UI={};
const DW_MONTHS=['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
const dwUi=id=>DW_UI[id]||(DW_UI[id]={});
const dwAdd=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const dwDayName=d=>DAYS_FULL[(d.getDay()+6)%7];
const dwEvs=d=>isSchool()?eventsOnDate(d).slice().sort((a,b)=>toMin(a.start)-toMin(b.start)):[];
/* nesplněné úkoly s termínem podle dne (drží se, dokud se data nezmění) */
let dwTm=null, dwTmRev=-1;
function dwTaskMap(){
  if(dwTm&&dwTmRev===DATA_REV) return dwTm;
  dwTm=new Map(); allTasks().forEach(t=>{ if(t.done||!t.due) return; const k=ymd(t.due); if(!dwTm.has(k)) dwTm.set(k,[]); dwTm.get(k).push(t); });
  dwTmRev=DATA_REV; return dwTm;
}
const dwTasksOn=d=>dwTaskMap().get(ymd(d))||[];
const dwCount=(n,a,b,c)=>`${n} ${plural(n,a,b,c)}`;
function dwSummary(d){
  const e=dwEvs(d).length, t=dwTasksOn(d).length, p=[];
  if(e) p.push(dwCount(e,'hodina','hodiny','hodin')); if(t) p.push(dwCount(t,'úkol','úkoly','úkolů'));
  return p.join(' · ')||'volno';
}
/* krátký řádek hodiny (týden, kalendář) */
const dwEvLine=ev=>`<button class="dw-ev hl-${esc(evColor(ev))}" data-act="ev" data-id="${ev.id}"><span class="t">${esc(ev.start)}</span><span class="n">${esc(evTitle(ev))}</span>${ev.place?`<small>${esc(ev.place)}</small>`:''}</button>`;
function dwDayList(d){
  const evs=dwEvs(d), ts=dwTasksOn(d);
  return `<div class="dw-dl"><div class="dw-dl-h">${dwDayName(d).replace(/^./,x=>x.toUpperCase())} ${shortDate(d)}</div>${evs.map(dwEvLine).join('')}${ts.map(t=>taskRow(t,true)).join('')}${evs.length||ts.length?'':'<div class="empty">Nic naplánováno.</div>'}</div>`;
}
const dwBtn=(id,k,v,lbl,aria)=>`<button class="navbtn dw-nav" data-act="wg-ui" data-w="${esc(id)}" data-k="${k}" data-v="${v}" aria-label="${aria}">${lbl}</button>`;

/* ================= Týden ================= */
/* krátký kód hodiny v týdnu: barevný čtvereček + zkratka (+ čas, když je místo) */
const dwCode=ev=>`<button class="wk-c hl-${esc(evColor(ev))}" data-act="ev" data-id="${ev.id}" title="${esc(`${ev.start} – ${ev.end} ${evTitle(ev)}`)}"><i></i><b>${esc(evTitle(ev))}</b><span>${esc(ev.start)}</span></button>`;
const dwTk=n=>n?`<span class="wk-n">${dwCount(n,'úkol','úkoly','úkolů')}</span>`:'';
function wWeek(s,c,id){
  const u=dwUi(id), mon=dwAdd(mondayOf(c.now),7*(u.wk||0)), days=[0,1,2,3,4,5,6].map(i=>dwAdd(mon,i)), today=ymd(c.now);
  /* malý: dnes a zítra, každý řádek hodiny a počet úkolů */
  if(s==='s'){ const t=dwAdd(c.now,1);
    const day=(d,lbl,on)=>{ const evs=dwEvs(d), n=dwTasksOn(d).length;
      return `<div class="wk-sd ${on?'today':''}"><div class="wk-sh"><b>${lbl}</b><span>${DAYS[(d.getDay()+6)%7].toLowerCase()} ${d.getDate()}.</span></div><div class="wk-sl">${evs.map(dwCode).join('')}${dwTk(n)}${evs.length||n?'':'<span class="wk-nil">volno</span>'}</div></div>`; };
    return {title:'Týden',body:day(c.now,'Dnes',true)+day(t,'Zítra',false)}; }
  const nav=`<div class="dw-navs">${dwBtn(id,'wk',-1,'‹','Předchozí týden')}${u.wk?dwBtn(id,'wk',0,'•','Tento týden'):''}${dwBtn(id,'wk',1,'›','Další týden')}</div>`;
  const title=`Týden ${isoWeek(days[0])}`;
  /* střední: sedm řádků, den – hodiny – počet úkolů */
  if(s==='m') return {title,sub:u.wk?`${shortDate(days[0])} – ${shortDate(days[6])}`:'',btn:nav,body:days.map((d,i)=>{ const k=ymd(d), evs=dwEvs(d), n=dwTasksOn(d).length;
    return `<div class="wk-r ${k===today?'today':''} ${i>4?'we':''} ${k<today?'past':''}"><span class="dn">${DAYS[i]}</span><b class="dd">${d.getDate()}</b><span class="wk-cs">${evs.map(dwCode).join('')||'<span class="wk-nil">volno</span>'}</span>${dwTk(n)}</div>`; }).join('')};
  return {title,sub:u.wk?`${shortDate(days[0])} – ${shortDate(days[6])}`:'',btn:nav,body:days.map(d=>{ const evs=dwEvs(d), ts=dwTasksOn(d), k=ymd(d);
    return `<div class="wk-day ${k===today?'today':''} ${k<today?'past':''}"><div class="wk-dh">${dwDayName(d)} <span>${shortDate(d)}</span></div>${evs.map(dwEvLine).join('')}${ts.map(t=>taskRow(t,true)).join('')}${evs.length||ts.length?'':'<div class="wk-free">volno</div>'}</div>`; }).join('')};
}

/* ================= Kalendář ================= */
function wCal(s,c,id){
  const u=dwUi(id), base=new Date(c.now.getFullYear(),c.now.getMonth()+(u.m||0),1), today=ymd(c.now);
  const start=mondayOf(base), dim=new Date(base.getFullYear(),base.getMonth()+1,0).getDate(), weeks=Math.ceil((((base.getDay()+6)%7)+dim)/7);
  const inMonth=d=>d.getMonth()===base.getMonth();
  const sel=u.day&&inMonth(new Date(u.day+'T12:00'))?u.day:(u.m?ymd(base):today);
  const nav=`<div class="dw-navs">${dwBtn(id,'m',-1,'‹','Předchozí měsíc')}${u.m?dwBtn(id,'m',0,'•','Tento měsíc'):''}${dwBtn(id,'m',1,'›','Další měsíc')}</div>`;
  const title=`${DW_MONTHS[base.getMonth()]} ${base.getFullYear()}`;
  let cells='';
  for(let i=0;i<weeks*7;i++){ const d=dwAdd(start,i), k=ymd(d), evs=dwEvs(d), ts=dwTasksOn(d);
    const cls=`cal-d ${inMonth(d)?'':'out'} ${k===today?'today':''} ${k===sel?'sel':''} ${i%7>4?'we':''}`;
    if(s==='l'){
      const items=[...evs.map(ev=>`<span class="ci hl-${esc(evColor(ev))}"><i></i>${esc(ev.start)} ${esc(evTitle(ev))}</span>`),...ts.map(t=>`<span class="ci ct">☐ ${esc(plain(t.html).trim().slice(0,40))}</span>`)];
      cells+=`<button class="${cls}" data-act="wg-ui" data-w="${esc(id)}" data-k="day" data-v="${k}"><span class="cn"><i>${d.getDate()}</i></span>${items.slice(0,3).join('')}${items.length>3?`<span class="cmore">+${items.length-3}</span>`:''}</button>`;
    } else cells+=`<button class="${cls}" data-act="wg-ui" data-w="${esc(id)}" data-k="day" data-v="${k}" aria-label="${dwDayName(d)} ${shortDate(d)}: ${dwSummary(d)}"><span class="cn"><i>${d.getDate()}</i></span><i class="dots">${evs.length?'<span class="e"></span>':''}${ts.length?'<span class="t"></span>':''}</i></button>`;
  }
  const grid=`<div class="cal cal-${s}"><div class="cal-g">${DAYS.map((x,i)=>`<span class="cal-dh ${i>4?'we':''}">${x}</span>`).join('')}${cells}</div></div>`;
  const sd=new Date(sel+'T12:00');
  if(s==='s') return {title,btn:nav,body:grid+`<div class="cal-sum"><b>${DAYS[(sd.getDay()+6)%7]} ${shortDate(sd)}</b> ${dwSummary(sd)}</div>`};
  if(s==='m') return {title,btn:nav,body:`<div class="cal-mw">${grid}${dwDayList(sd)}</div>`};
  return {title,btn:nav,body:grid};
}

/* ================= Rychlý úkol ================= */
const dwPageOk=pid=>{ const p=pid&&S.pages[pid]; return p&&!isArchived(p)?p:null; };
function dwPickMsg(id,what){ return `<div class="empty">${what}<div style="margin-top:8px"><button class="btn" data-act="wg-opts" data-w="${esc(id)}">Vybrat stránku</button></div></div>`; }
function wQuick(s,c,id,o){
  const pg=dwPageOk(o&&o.page);
  /* obě velikosti jsou poloviční, bez nadpisu */
  if(!pg) return {body:`<div class="qk-pick"><button class="btn" data-act="wg-opts" data-w="${esc(id)}">Vybrat stránku pro úkoly</button></div>`};
  /* řádek jako úkol ve stránce: čtvereček, pole, vpravo kam se úkol zapíše a ＋ */
  const where=`<button class="qk-pg" data-act="open" data-id="${pg.id}" title="Otevřít stránku">do: <span>${esc(pTitle(pg))}</span></button>`;
  return {body:`<div class="qk"><span class="qk-box" aria-hidden="true"></span><input class="qk-in" data-w="${esc(id)}" data-p="${pg.id}" placeholder="Nový úkol…" aria-label="Nový úkol do stránky ${esc(pTitle(pg))}" enterkeyhint="done">${where}<button class="icon-btn qk-add" data-act="wg-qadd" data-w="${esc(id)}" aria-label="Přidat úkol" title="Přidat (Enter)">＋</button></div>`};
}
function quickAdd(id){
  const inp=$(`.wg[data-wg="${id}"] .qk-in`); if(!inp) return;
  const txt=inp.value.trim(), pg=dwPageOk(inp.dataset.p); if(!txt||!pg) return;
  const bl=pg.blocks||(pg.blocks=[]), b=newBlock('todo',{html:esc(txt)});
  /* na konec stránky (před prázdné řádky); kdyby tam byl ve sbalené sekci, tak na začátek */
  let at=bl.length; while(at>0&&bl[at-1].type==='p'&&!plain(bl[at-1].html).trim()) at--;
  bl.splice(at,0,b); if(hiddenMask(bl)[at]){ bl.splice(at,1); bl.unshift(b); }
  savePage(pg); renderSidebar(); renderMain();
  toast(`Úkol přidán do „${pTitle(pg)}“.`);
  setTimeout(()=>{ const i=$(`.wg[data-wg="${id}"] .qk-in`); if(i) i.focus(); },30);
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing||!e.target.classList||!e.target.classList.contains('qk-in')) return;
  e.preventDefault(); quickAdd(e.target.dataset.w);
});

/* ================= společné: jak dávno ================= */
function dwAgo(ts){
  if(!ts) return ''; const m=Math.round((Date.now()-ts)/6e4);
  if(m<1) return 'právě teď'; if(m<60) return `před ${m} min`; if(m<24*60) return `před ${Math.round(m/60)} h`;
  return fmtTime(ts);
}

/* ================= Studium (Index) ================= */
const dwNum=v=>{ const n=parseFloat(String(v??'').replace(',','.')); return isFinite(n)?n:0; };
function wStudy(s,c,id,o){
  const sems=semList(), sem=(o&&o.sem&&S.semesters[o.sem])||sems.find(x=>!x.hidden)||sems[0];
  if(!sem) return {title:'Studium',body:`<div class="empty">V Indexu zatím není semestr. <button class="linkbtn" data-act="nav" data-v="index">Otevřít Index</button></div>`};
  const list=subjsOf(sem.id), got=list.filter(subjDone).reduce((a,su)=>a+subjCr(su),0), enr=list.reduce((a,su)=>a+subjCr(su),0), target=dwNum(sem.target)||enr, av=wavg(list);
  const pct=target?Math.min(100,Math.round(got/target*100)):0, eMin=GRADES.find(g=>g[0]==='E')[1];
  const left=list.filter(su=>!subjDone(su)).length;
  const kv=(k,v)=>`<span class="kv"><span>${k}</span><b>${v}</b></span>`;
  const head=`<button class="st-sum st-kv" data-act="nav" data-v="index">${kv('Kredity',`<span class="wg-stat">${fmtNum(got)} z ${fmtNum(target)}</span>`)}<span class="bar"><i style="width:${pct}%"></i></span>${av!=null?kv('Průměr',fmtAvg(av)):''}${kv('Chybí',left?dwCount(left,'předmět','předměty','předmětů'):'nic')}</button>`;
  const title='Studium', ibtn='<button class="btn" data-act="nav" data-v="index">Index</button>';
  if(s==='s') return {title,sub:esc(sem.name||''),btn:ibtn,body:head};
  if(s==='m'){
    const miss=list.filter(su=>!subjDone(su)).map(su=>{ const p=subjPoints(su);
      const open=p!=null&&p<eMin&&partsOpen(su);   /* zkouška apod. ještě bez bodů: zatím se nedá říct, že je to pod hranicí */
      const why=su.end==='z'?'chybí zápočet':p==null?'zatím bez bodů':open?`zatím ${fmtNum(p)} b`:p<eMin?`${fmtNum(p)} b, pod hranicí na E`:'chybí zápočet';
      return `<button class="st-row" data-act="wg-subj" data-id="${su.id}"><span class="ti-dot hl-${esc(su.color||'purple')}"></span><span class="nm">${esc(subjLabel(su))}</span><small class="${p!=null&&p<eMin&&su.end!=='z'&&!open?'late':''}">${why}</small></button>`; });
    return {title,sub:esc(sem.name||''),btn:ibtn,body:head+(miss.length?`<div class="wg-grp">Ještě chybí</div>${miss.join('')}`:'')};
  }
  const rows=list.map(su=>{ const p=subjPoints(su), mx=subjMax(su);
    return `<tr data-act="wg-subj" data-id="${su.id}"><td><span class="ti-dot hl-${esc(su.color||'purple')}"></span>${esc(subjLabel(su))}</td><td class="num">${su.end==='z'?'':p==null?'–':`${fmtNum(p)}${mx?` / ${fmtNum(mx)}`:''}`}</td><td>${gradeChip(su)}</td><td class="num">${fmtNum(subjCr(su))} kr.</td><td class="num">${subjDone(su)?'✓':''}</td></tr>`; }).join('');
  return {title,sub:esc(sem.name||''),btn:ibtn,body:head+(list.length?`<div class="st-tw"><table class="st-tab"><thead><tr><th>Předmět</th><th class="num">Body</th><th>Známka</th><th class="num">Kredity</th><th class="num">Splněno</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">V semestru zatím nejsou předměty.</div>')};
}

/* ================= Stránka (náhled) ================= */
function dwPreview(pg,max){
  const bl=pg.blocks||[], hid=hiddenMask(bl); let out='', n=0, num=0;
  for(let i=0;i<bl.length;i++){
    if(hid[i]) continue; const b=bl[i], lv=b.level||0, st=lv?` style="padding-left:${16+lv*18}px"`:'';
    if(b.type!=='num') num=0;
    const h=sanitize(b.html||'');
    let r='';
    if(/^h[123]$/.test(b.type)) r=plain(b.html).trim()?`<div class="pv-${b.type}">${h}</div>`:'';
    else if(b.type==='subj') r=`<div class="pv-h1">${esc(subjBlockText(b))}</div>`;
    else if(b.type==='todo') r=`<div class="pv-todo ${b.done?'done':''}"${st}><button class="mk check ${b.done?'on':''}" data-act="task-check" data-k="${esc(pg.id+'|'+b.id)}" role="checkbox" aria-checked="${!!b.done}" aria-label="Hotovo"></button><span>${h||'&nbsp;'}</span></div>`;
    else if(b.type==='bullet') r=`<div class="pv-li"${st}><span class="pv-mk">•</span><span>${h}</span></div>`;
    else if(b.type==='num') r=`<div class="pv-li"${st}><span class="pv-mk">${++num}.</span><span>${h}</span></div>`;
    else if(b.type==='callout') r=`<div class="pv-callout hl-${esc(b.color||'purple')}"><span>${esc(b.icon||'💡')}</span><span>${h}</span></div>`;
    else if(b.type==='quote') r=`<div class="pv-quote">${h}</div>`;
    else if(b.type==='code') r=`<pre class="pv-code">${h}</pre>`;
    else if(b.type==='divider') r='<hr class="pv-hr">';
    else if(b.type==='table') r=`<div class="pv-meta">▦ Tabulka · ${dwCount((b.rows||[]).length,'řádek','řádky','řádků')}</div>`;
    else if(b.type==='image') r=`<div class="pv-meta">🖼 ${esc(b.caption||b.name||'Obrázek')}</div>`;
    else if(b.type==='eq') r=`<div class="pv-meta mono">∑ ${esc(b.tex||plain(b.html)||'Rovnice')}</div>`;
    else if(b.type==='page'){ const p=S.pages[b.pageId]; r=p?`<button class="pv-link" data-act="open" data-id="${p.id}">${pIcon(p)}${esc(pTitle(p))}</button>`:''; }
    else r=plain(b.html).trim()?`<div class="pv-p"${st}>${h}</div>`:'';
    if(!r) continue;
    if(n>=max) return out+`<button class="wg-more linkbtn" data-act="open" data-id="${pg.id}">Pokračovat na stránce…</button>`;
    out+=r; n++;
  }
  return out||'<div class="empty">Stránka je prázdná.</div>';
}
function wPage(s,c,id,o){
  const pg=dwPageOk(o&&o.page);
  if(!pg) return {title:'Stránka',body:dwPickMsg(id,'Vyber stránku, kterou tu chceš mít.')};
  const ts=allTasks().filter(t=>t.pg.id===pg.id), dn=ts.filter(t=>t.done).length;
  const btn=`<button class="btn" data-act="open" data-id="${pg.id}">Otevřít</button>`;
  if(s==='s') return {title:`${pg.icon?pg.icon+' ':''}${pTitle(pg)}`,btn,body:`<button class="st-sum" data-act="open" data-id="${pg.id}">${ts.length?`<div class="wg-stat"><b>${dwCount(ts.length-dn,'úkol zbývá','úkoly zbývají','úkolů zbývá')}</b></div>`:''}<div class="wg-sub">upraveno ${esc(dwAgo(pg.updated)||'–')}</div></button>`};
  return {title:`${pg.icon?pg.icon+' ':''}${pTitle(pg)}`,sub:pg.updated?`Upraveno ${esc(dwAgo(pg.updated))}`:'',btn,body:`<div class="pv">${dwPreview(pg,40)}</div>`};
}

/* ================= Vzhled: motiv, den/noc, velikost textu ================= */
const LK_MODES=[['auto','Auto'],['light','Světlý'],['dark','Tmavý']];
const lkSeg=(k,list,cur)=>`<div class="seg lk-seg">${list.map(([v,l])=>`<button class="${String(v)===String(cur)?'on':''}" data-act="wg-do" data-v="${k}:${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join('')}</div>`;
function wLook(s){
  const skin=skinOf(), font=fontOf(), mode=lsGet('uk-theme','auto'), f=+lsGet('uk-fs',1), fs=FS_STEPS.includes(f)?f:1;
  const skNm=SKINS.find(x=>x[0]===skin)[1], foNm=FONTS.find(x=>x[0]===font)[1];
  /* malý (poloviční): čtyři tlačítka, klik přepne na další možnost */
  if(s==='s'){
    const q=(k,l,v,t)=>`<button class="lk-q" data-act="wg-do" data-v="cyc:${k}" title="${esc(t)}" aria-label="${esc(t)}"><span>${l}</span><b>${esc(v)}</b></button>`;
    const dk=isDarkNow();
    return {body:`<div class="lk-four">${q('skin','Motiv',skNm,`Motiv: ${skNm}, klikem další`)}${q('font','Písmo',font==='auto'?'podle motivu':foNm,`Písmo: ${foNm}, klikem další`)}${q('mode','Režim',dk?'Tmavý':'Světlý',dk?'Tmavý režim, přepnout na světlý':'Světlý režim, přepnout na tmavý')}${q('fs','Text',`${Math.round(fs*100)} %`,`Velikost textu ${Math.round(fs*100)} %, klikem další`)}</div>`};
  }
  const skins=`<div class="lk-skins">${SKINS.map(([id,nm])=>`<button class="lk-skin ${id===skin?'on':''}" data-act="wg-do" data-v="skin:${id}" title="${nm}" aria-label="Motiv ${nm}" aria-pressed="${id===skin}"><span class="skin-sw" data-sk="${id}" aria-hidden="true"><b>Aa</b><i></i><i></i><i></i></span></button>`).join('')}</div>`;
  const fonts=`<div class="lk-fonts">${FONTS.map(([id,nm])=>`<button class="lk-fnt ${id===font?'on':''}" data-act="wg-do" data-v="font:${id}" title="${nm}" aria-label="Písmo ${nm}" aria-pressed="${id===font}">${id==='auto'?'<small>Auto</small>':`<b data-fnt="${id}">Aa</b>`}</button>`).join('')}</div>`;
  const modeH=lkSeg('mode',LK_MODES,mode);
  if(s==='m') return {title:'Vzhled',body:`<div class="lk">${skins}${fonts}${lkSeg('mode',LK_MODES,mode).replace('lk-seg','lk-seg lk-m-seg')}</div>`};
  const row=(l,h)=>`<div class="lk-row"><span>${l}</span>${h}</div>`;
  return {title:'Vzhled',body:`<div class="lk lk-l">${row('Motiv',skins)}${row('Písmo',fonts)}${row('Režim',modeH)}${row('Text',lkSeg('fs',FS_STEPS.map(v=>[v,Math.round(v*100)+' %']),fs))}</div>`};
}

/* ================= Zálohy: export, import, Disk ================= */
let dzFiles=null, dzAt=0, dzBusy=false;
function dzLoad(){
  if(dzBusy) return; dzBusy=true;
  window.DriveSync.list().then(f=>{ dzFiles=f||[]; return UpLog.load().then(()=>UpLog.harvest(dzFiles)); }).catch(()=>{ dzFiles=dzFiles||[]; })
    .finally(()=>{ dzAt=Date.now(); dzBusy=false; if(S.view.kind==='today') renderMain(); });
}
const DZ_SVG=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const DZ_CLOUD=DZ_SVG('<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z"/>'), DZ_UP=DZ_SVG('<path d="M12 19V5M6 11l6-6 6 6"/>'), DZ_DN=DZ_SVG('<path d="M12 5v14M6 13l6 6 6-6"/>');
const fmtDur=ms=>{ const s=ms/1000; return (s<10?s.toFixed(1).replace('.',','):String(Math.round(s)))+' s'; };
function wData(s){
  const D=window.DriveSync, ds=D&&D.clientId()?D.state():'off';
  const st=ds==='off'?'Disk nepřipojen':ds==='expired'?'Přihlášení k Disku vypršelo':META.lastUpload?`Nahráno ${esc(dwAgo(META.lastUpload))}`:'Zatím nenahráno';
  const stat=`<div class="dz-st ${ds==='ok'?'':'off'}">${DZ_CLOUD}<span>${st}${ds==='ok'&&isDirty()?' · <b>změny čekají</b>':''}</span></div>`;
  /* malý (poloviční): stav Disku a pod ním Export a Import napůl */
  const links=`<div class="dz-links"><button class="btn-text" data-act="wg-do" data-v="exp">Export</button><label class="btn-text">Import<input type="file" class="dz-imp" accept=".json,application/json" hidden></label></div>`;
  if(s==='s') return {body:`<div class="dz dz-s">${stat}${links}</div>`};
  const drive=`<div class="dz-two">${ds==='ok'?`<button class="btn" data-act="wg-do" data-v="up">${DZ_UP}Nahrát</button><button class="btn" data-act="wg-do" data-v="dl">${DZ_DN}Stáhnout</button>`:'<button class="btn" data-act="wg-do" data-v="drive">Připojit Disk</button>'}</div>`;
  const main=`<div class="dz">${stat}${drive}${links}</div>`;
  if(s==='m') return {title:'Zálohy',body:main};
  const dur=META.lastUpDur>0?`<div class="dz-dur"><b>${fmtDur(META.lastUpDur)}</b><span>trvalo poslední nahrání</span></div>`:'';
  let list='';
  if(ds==='ok'){
    if(!dzBusy&&(!dzAt||Date.now()-dzAt>6e5||(META.lastUpload||0)>dzAt)) dzLoad();
    list=dzFiles==null?'<div class="empty">Načítám…</div>':dzFiles.length?dzFiles.slice(0,6).map(f=>`<button class="dz-v" data-act="wg-do" data-v="dl"><span>${esc(fmtTime(Date.parse(f.createdTime)))}</span><small>${UpLog.durOf(f)?`<span class="dz-dv">${fmtSec(UpLog.durOf(f))}</span>`:''}${f.size?Math.max(1,Math.round(f.size/1024))+' kB':''}</small></button>`).join(''):'<div class="empty">Na Disku nic není.</div>';
  }
  return {title:'Zálohy',body:`<div class="dz-cols"><div>${main}${dur}</div><div class="dz-list"><div class="wg-grp">Na Disku</div>${list||'<div class="empty">Disk nepřipojen.</div>'}</div></div>`};
}
/* ================= Nahrávání na Disk: spojnicový graf, jeden bod = jedno nahrání =================
   střední = posledních UP_M nahrání rovnoměrně přes celou šířku; velký = všechna nahrání (UP_STEP px na bod),
   posouvá se do stran, začíná u nejnovějších, dny jsou odlišené pruhy s datem dole.
   Dva grafy pod sebou (čas a velikost) se stejnými body, každý svou stupnicí. */
let upReady=false, upScroll=null;   /* upScroll: null = drží se u nejnovějších (vpravo) */
const UP_M=100, UP_STEP=3.2, UP_MAX=3000;   /* body těsně u sebe (od 4.7.0 pětkrát hustěji) */
const fmtKb=b=>{ const k=b/1024; return (k<10?k.toFixed(1).replace('.',','):String(Math.round(k)))+' kB'; };
document.addEventListener('scroll',e=>{ const el=e.target; if(!el||!el.classList||!el.classList.contains('up-sc')) return;
  upScroll=el.scrollLeft+el.clientWidth>=el.scrollWidth-4?null:el.scrollLeft; },true);
function wUploads(s){
  const title='Nahrávání na Disk';
  if(!upReady){ UpLog.load().then(()=>{ upReady=true; if(S.view.kind==='today') renderMain(); }); return {title,body:'<div class="empty">Načítám…</div>'}; }
  const all=UpLog.all();
  if(!all.length) return {title,body:'<div class="empty">Zatím nic nenahráno.</div>'};
  const big=s==='l', list=all.slice(-(big?UP_MAX:UP_M)), n=list.length;
  const X=i=>(i+.5)/n*100;
  const tip=e=>`${shortDate(new Date(e.t))} ${fmtTime(e.t).split(' ').pop()} · ${fmtSec(e.ms)} · ${fmtKb(e.b)}${e.dev?` · ${e.dev}`:''}`;
  /* dny: začátek (index prvního nahrání) a počet */
  const days=[]; list.forEach((e,i)=>{ const k=ymd(new Date(e.t)); if(!days.length||days[days.length-1].k!==k) days.push({k,i,d:new Date(e.t),c:0}); days[days.length-1].c++; });
  const bands=days.map((d,j)=>`<b class="up-day${j%2?' odd':''}" style="left:${d.i/n*100}%;width:${d.c/n*100}%"></b>`).join('');
  const chart=(k,fmt,label)=>{
    const max=Math.max(...list.map(e=>e[k]))||1, Y=v=>96-v/max*90;
    const pts=list.map((e,i)=>`${X(i).toFixed(3)},${Y(e[k]).toFixed(2)}`).join(' ');
    return `<div class="up-ch"><div class="up-h"><span>${label}</span><span>nejvíc <b>${fmt(max)}</b></span></div>
      <div class="up-plot">${bands}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>${list.map((e,i)=>`<i style="left:${X(i)}%;top:${Y(e[k])}%" title="${esc(tip(e))}"></i>`).join('')}</div></div>`;
  };
  const today=ymd(new Date()), dl=d=>d.k===today?'dnes':shortDate(d.d);
  const charts=chart('ms',fmtSec,'Čas nahrání')+chart('b',fmtKb,'Velikost zálohy');
  if(!big) return {title,sub:`posledních ${n}`,body:`<div class="up">${charts}<div class="up-x"><span>${dl(days[0])}</span><span>${dl(days[days.length-1])}</span></div></div>`};
  requestAnimationFrame(()=>{ const el=document.querySelector('.wg-uploads .up-sc'); if(el) el.scrollLeft=upScroll==null?el.scrollWidth:upScroll; });
  /* popisky dní jen tam, kde se nepřekrývají (den s jedním nahráním je úzký) */
  let last=-1e9; const xl=days.map(d=>{ const px=d.i*UP_STEP; if(px-last<52) return ''; last=px; return `<span style="left:${d.i/n*100}%">${dl(d)}</span>`; }).join('');
  return {title,sub:`${n}×`,body:`<div class="up up-l"><div class="up-sc"><div class="up-in" style="width:${n*UP_STEP}px">${charts}<div class="up-xl">${xl}</div></div></div></div>`};
}
/* tlačítka ve Vzhledu a Zálohách */
function wgDo(a){
  const [k,v]=String(a.dataset.v).split(':');
  if(k==='skin'){ if(!setSkin(v)) return; saveSettings(); applySkin(); renderMain(); }
  else if(k==='font'){ if(!setFont(v)) return; saveSettings(); applySkin(); renderMain(); }
  else if(k==='cyc'){   /* malý Vzhled: další možnost v pořadí */
    const nx=(list,cur)=>list[(list.indexOf(cur)+1)%list.length];
    if(v==='skin'){ setSkin(nx(SKINS.map(x=>x[0]),skinOf())); saveSettings(); applySkin(); }
    else if(v==='font'){ setFont(nx(FONTS.map(x=>x[0]),fontOf())); saveSettings(); applySkin(); }
    else if(v==='mode'){ lsSet('uk-theme',isDarkNow()?'light':'dark'); applyTheme(); }
    else if(v==='fs'){ const f=+lsGet('uk-fs',1); lsSet('uk-fs',nx(FS_STEPS,FS_STEPS.includes(f)?f:1)); applyFontScale(); }
    renderMain();
  }
  else if(k==='mode'){ lsSet('uk-theme',v); applyTheme(); renderMain(); }
  else if(k==='fs'){ lsSet('uk-fs',+v); applyFontScale(); renderMain(); }
  else if(k==='exp') exportData();
  else if(k==='up') Sync.upload();
  else if(k==='dl') Sync.openDownload();
  else if(k==='drive') openSettings('drive');
}
document.addEventListener('change',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('dz-imp')) return;
  const f=t.files&&t.files[0]; t.value=''; if(f) importFile(f);
});

/* klik na ‹ › a dny v Týdnu a Kalendáři (stav se neukládá) */
function wgUi(a){
  const u=dwUi(a.dataset.w), k=a.dataset.k, v=a.dataset.v;
  if(k==='day') u.day=v;
  else if(k==='m'||k==='wk'){ u[k]=+v===0?0:(u[k]||0)+(+v); u.day=null; }
  renderMain();
}

export { quickAdd, wCal, wData, wgDo, wgUi, wLook, wPage, wQuick, wStudy, wUploads, wWeek };
