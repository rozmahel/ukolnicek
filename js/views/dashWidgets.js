/* Úkolníček – Dnes: další widgety (Týden, Kalendář, Rychlý úkol, Studium, Stránka, Vzhled, Zálohy).
   Každý widget je funkce (velikost s/m/l, kontext ctxNow z today.js, id widgetu, nastavení o) → {title, sub, btn, body}.
   Stav, který se neukládá (vybraný den, posun měsíce/týdne), drží DW_UI podle id widgetu. */
import { $, DAYS, DAYS_FULL, esc, lsGet, lsSet, plain, plural } from '../core.js';
import { S } from '../state.js';
import { applySkin, skinOf, SKINS } from '../theme.js';
import { DATA_REV, isDirty, META, savePage, saveSettings } from '../store.js';
import { eventsOnDate, fmtTime, mondayOf, shortDate, toMin, ymd } from '../dates.js';
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
const DW_IC_EV='<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const DW_IC_T='<svg viewBox="0 0 24 24" fill="none" stroke="var(--hl-orange-fg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/></svg>';
function dwTile(d,lbl,on){
  const e=dwEvs(d).length, t=dwTasksOn(d).length;
  const ln=(ic,n,a,b,c)=>`<span class="wk-ln">${ic}<b>${n}</b> ${plural(n,a,b,c)}</span>`;
  return `<div class="wk-tile ${on?'on':''}"><span class="wk-dd"><span>${lbl}</span><b>${d.getDate()}</b></span><span class="wk-ls">${e?ln(DW_IC_EV,e,'hodina','hodiny','hodin'):''}${t?ln(DW_IC_T,t,'úkol','úkoly','úkolů'):''}${e||t?'':'<span class="wk-nil">volno</span>'}</span></div>`;
}
function wWeek(s,c,id){
  const u=dwUi(id), mon=dwAdd(mondayOf(c.now),7*(u.wk||0)), days=[0,1,2,3,4,5,6].map(i=>dwAdd(mon,i)), today=ymd(c.now);
  /* malý: dvě dlaždice, dnes a zítra (počet hodin a úkolů) */
  if(s==='s'){ const t=dwAdd(c.now,1);
    return {title:'Týden',body:`<div class="wk-tiles">${dwTile(c.now,'Dnes',true)}${dwTile(t,DAYS[(t.getDay()+6)%7],false)}</div>`}; }
  const nav=`<div class="dw-navs">${dwBtn(id,'wk',-1,'‹','Předchozí týden')}${u.wk?dwBtn(id,'wk',0,'•','Tento týden'):''}${dwBtn(id,'wk',1,'›','Další týden')}</div>`;
  const title=u.wk?`Týden ${shortDate(days[0])} – ${shortDate(days[6])}`:'Tento týden';
  if(s==='m'){
    const sel=u.day&&days.some(d=>ymd(d)===u.day)?u.day:(days.some(d=>ymd(d)===today)?today:ymd(days[0]));
    const strip=days.map((d,i)=>{ const k=ymd(d), e=dwEvs(d).length, t=dwTasksOn(d).length;
      return `<button class="wk-d ${k===today?'today':''} ${k===sel?'sel':''} ${i>4?'we':''}" data-act="wg-ui" data-w="${esc(id)}" data-k="day" data-v="${k}" aria-pressed="${k===sel}"><span class="dn">${DAYS[i]}</span><b>${d.getDate()}</b><i class="dots">${e?'<span class="e"></span>':''}${t?'<span class="t"></span>':''}</i></button>`; }).join('');
    const sd=days.find(d=>ymd(d)===sel);
    return {title,btn:nav,body:`<div class="wk-strip">${strip}</div>${dwDayList(sd)}`};
  }
  return {title,btn:nav,body:days.map(d=>{ const evs=dwEvs(d), ts=dwTasksOn(d), k=ymd(d);
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
      cells+=`<button class="${cls}" data-act="wg-ui" data-w="${esc(id)}" data-k="day" data-v="${k}"><span class="cn">${d.getDate()}</span>${items.slice(0,3).join('')}${items.length>3?`<span class="cmore">+${items.length-3}</span>`:''}</button>`;
    } else cells+=`<button class="${cls}" data-act="wg-ui" data-w="${esc(id)}" data-k="day" data-v="${k}" aria-label="${dwDayName(d)} ${shortDate(d)}: ${dwSummary(d)}"><span class="cn">${d.getDate()}</span><i class="dots">${evs.length?'<span class="e"></span>':''}${ts.length?'<span class="t"></span>':''}</i></button>`;
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
  const inp=`<div class="qk"><input class="qk-in" data-w="${esc(id)}" data-p="${pg.id}" placeholder="Nový úkol…" aria-label="Nový úkol do stránky ${esc(pTitle(pg))}" enterkeyhint="done"><button class="btn pri qk-add" data-act="wg-qadd" data-w="${esc(id)}" aria-label="Přidat úkol">＋</button></div>`;
  const where=`<button class="qk-pg" data-act="open" data-id="${pg.id}">${pIcon(pg)}<span>${esc(pTitle(pg))}</span></button>`;
  return {body:inp+`<div class="qk-note">do ${where}</div>`};
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
  const head=`<button class="st-sum" data-act="nav" data-v="index"><div class="wg-stat"><b>${fmtNum(got)}</b> / ${fmtNum(target)} kr.</div><span class="bar"><i style="width:${pct}%"></i></span><div class="wg-sub">${list.filter(subjDone).length} z ${list.length} předmětů splněno${av!=null?` · ⌀ ${fmtAvg(av)}`:''}</div></button>`;
  const title=s==='s'?'Studium':`Studium · ${sem.name||'Semestr'}`;
  if(s==='s') return {title,sub:esc(sem.name||''),body:head};
  if(s==='m'){
    const miss=list.filter(su=>!subjDone(su)).map(su=>{ const p=subjPoints(su);
      const open=p!=null&&p<eMin&&partsOpen(su);   /* zkouška apod. ještě bez bodů: zatím se nedá říct, že je to pod hranicí */
      const why=su.end==='z'?'chybí zápočet':p==null?'zatím bez bodů':open?`zatím ${fmtNum(p)} b`:p<eMin?`${fmtNum(p)} b, pod hranicí na E`:'chybí zápočet';
      return `<button class="st-row" data-act="wg-subj" data-id="${su.id}"><span class="ti-dot hl-${esc(su.color||'purple')}"></span><span class="nm">${esc(subjLabel(su))}</span><small class="${p!=null&&p<eMin&&su.end!=='z'&&!open?'late':''}">${why}</small></button>`; });
    return {title,body:head+(miss.length?`<div class="wg-grp">Ještě chybí<span>${miss.length}</span></div>${miss.join('')}`:'<div class="empty">Všechno v semestru je splněné.</div>')};
  }
  const rows=list.map(su=>{ const p=subjPoints(su), mx=subjMax(su);
    return `<tr data-act="wg-subj" data-id="${su.id}"><td><span class="ti-dot hl-${esc(su.color||'purple')}"></span>${esc(subjLabel(su))}</td><td class="num">${su.end==='z'?'':p==null?'–':`${fmtNum(p)}${mx?` / ${fmtNum(mx)}`:''}`}</td><td>${gradeChip(su)}</td><td class="num">${fmtNum(subjCr(su))} kr.</td><td class="num">${subjDone(su)?'✓':''}</td></tr>`; }).join('');
  return {title,btn:'<button class="btn" data-act="nav" data-v="index">Index</button>',body:head+(list.length?`<div class="st-tw"><table class="st-tab"><thead><tr><th>Předmět</th><th class="num">Body</th><th>Známka</th><th class="num">Kredity</th><th class="num">Splněno</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">V semestru zatím nejsou předměty.</div>')};
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
  if(s==='s') return {title:`${pg.icon?pg.icon+' ':''}${pTitle(pg)}`,body:`<button class="st-sum" data-act="open" data-id="${pg.id}">${ts.length?`<div class="wg-stat"><b>${ts.length-dn}</b> ${plural(ts.length-dn,'úkol zbývá','úkoly zbývají','úkolů zbývá')}</div><span class="bar"><i style="width:${Math.round(dn/ts.length*100)}%"></i></span><div class="wg-sub">${dn} z ${ts.length} hotovo</div>`:`<div class="wg-sub">Upraveno ${esc(dwAgo(pg.updated)||'–')}</div>`}</button>`};
  return {title:`${pg.icon?pg.icon+' ':''}${pTitle(pg)}`,sub:pg.updated?`Upraveno ${esc(dwAgo(pg.updated))}`:'',btn,body:`<div class="pv">${dwPreview(pg,40)}</div>`};
}

/* ================= Vzhled: motiv, den/noc, velikost textu ================= */
const LK_MODES=[['auto','Auto'],['light','☀︎ Den'],['dark','☾ Noc']];
const LK_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LK_MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const lkSeg=(k,list,cur)=>`<div class="seg lk-seg">${list.map(([v,l])=>`<button class="${String(v)===String(cur)?'on':''}" data-act="wg-do" data-v="${k}:${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join('')}</div>`;
function wLook(s){
  const skin=skinOf(), mode=lsGet('uk-theme','auto'), f=+lsGet('uk-fs',1), fs=FS_STEPS.includes(f)?f:1;
  const skins=`<div class="lk-skins">${SKINS.map(([id,nm])=>`<button class="lk-skin ${id===skin?'on':''}" data-act="wg-do" data-v="skin:${id}" title="${nm}" aria-label="Motiv ${nm}" aria-pressed="${id===skin}"><span class="skin-sw" data-sk="${id}" aria-hidden="true"><b>Aa</b><i></i><i></i><i></i></span></button>`).join('')}</div>`;
  const modeH=lkSeg('mode',LK_MODES,mode);
  /* malý (poloviční): jen světlý a tmavý režim; při „Auto“ svítí ten, který je právě vidět */
  if(s==='s'){ const cur=mode==='light'||mode==='dark'?mode:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
    const b=(v,ic,l)=>`<button class="lk-md ${cur===v?'on':''}" data-act="wg-do" data-v="mode:${v}" aria-pressed="${cur===v}">${ic}<span>${l}</span></button>`;
    return {body:`<div class="lk-two" role="group" aria-label="Světlý nebo tmavý režim">${b('light',LK_SUN,'Světlý')}${b('dark',LK_MOON,'Tmavý')}</div>`}; }
  if(s==='m') return {title:'Vzhled',body:`<div class="lk">${skins}${modeH}</div>`};
  return {title:'Vzhled',body:`<div class="lk lk-l">${skins}<div class="lk-row"><span>Režim</span>${modeH}</div><div class="lk-row"><span>Text</span>${lkSeg('fs',FS_STEPS.map(v=>[v,Math.round(v*100)+' %']),fs)}</div></div>`};
}

/* ================= Zálohy: export, import, Disk ================= */
let dzFiles=null, dzAt=0, dzBusy=false;
function dzLoad(){
  if(dzBusy) return; dzBusy=true;
  window.DriveSync.list().then(f=>{ dzFiles=f||[]; }).catch(()=>{ dzFiles=dzFiles||[]; })
    .finally(()=>{ dzAt=Date.now(); dzBusy=false; if(S.view.kind==='today') renderMain(); });
}
const fmtDur=ms=>{ const s=ms/1000; return (s<10?s.toFixed(1).replace('.',','):String(Math.round(s)))+' s'; };
function wData(s){
  const D=window.DriveSync, ds=D&&D.clientId()?D.state():'off';
  const st=ds==='off'?'Disk nepřipojen':ds==='expired'?'Přihlášení k Disku vypršelo':META.lastUpload?`Nahráno ${esc(dwAgo(META.lastUpload))}`:'Zatím nenahráno';
  const stat=`<div class="dz-st ${ds==='ok'?'':'off'}">☁ ${st}${ds==='ok'&&isDirty()?' · <b>změny čekají</b>':''}</div>`;
  const file=`<div class="dz-row"><button class="btn" data-act="wg-do" data-v="exp">Export</button><label class="btn">Import<input type="file" class="dz-imp" accept=".json,application/json" hidden></label></div>`;
  /* malý (poloviční): stav Disku a pod ním Export a Import napůl */
  if(s==='s') return {body:`<div class="dz dz-s">${stat}<div class="dz-two"><button class="btn" data-act="wg-do" data-v="exp">Export</button><label class="btn">Import<input type="file" class="dz-imp" accept=".json,application/json" hidden></label></div></div>`};
  const drive=`<div class="dz-row">${ds==='ok'?'<button class="btn" data-act="wg-do" data-v="up">↑ Nahrát</button><button class="btn" data-act="wg-do" data-v="dl">Zálohy na Disku</button>':'<button class="btn" data-act="wg-do" data-v="drive">Připojit Disk</button>'}</div>`;
  const main=`<div class="dz">${stat}${drive}${file}</div>`;
  if(s==='m') return {title:'Zálohy',body:main};
  const dur=META.lastUpDur>0?`<div class="dz-dur"><b>${fmtDur(META.lastUpDur)}</b><span>trvalo poslední nahrání</span></div>`:'';
  let list='';
  if(ds==='ok'){
    if(!dzBusy&&(!dzAt||Date.now()-dzAt>6e5||(META.lastUpload||0)>dzAt)) dzLoad();
    list=dzFiles==null?'<div class="empty">Načítám…</div>':dzFiles.length?dzFiles.slice(0,6).map(f=>`<button class="dz-v" data-act="wg-do" data-v="dl"><span>${esc(fmtTime(Date.parse(f.createdTime)))}</span><small>${f.size?Math.max(1,Math.round(f.size/1024))+' kB':''}</small></button>`).join(''):'<div class="empty">Na Disku nic není.</div>';
  }
  return {title:'Zálohy',body:`<div class="dz-cols"><div>${main}${dur}</div><div class="dz-list"><div class="wg-grp">Na Disku</div>${list||'<div class="empty">Disk nepřipojen.</div>'}</div></div>`};
}
/* tlačítka ve Vzhledu a Zálohách */
function wgDo(a){
  const [k,v]=String(a.dataset.v).split(':');
  if(k==='skin'){ if(skinOf()===v) return; if(v==='default') delete S.settings.theme; else S.settings.theme=v; saveSettings(); applySkin(); renderMain(); }
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

export { quickAdd, wCal, wData, wgDo, wgUi, wLook, wPage, wQuick, wStudy, wWeek };
