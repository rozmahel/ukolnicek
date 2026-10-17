/* Úkolníček – Dnes: další widgety (Týden, Kalendář, Rychlý úkol, Dnes v poznámkách, Stránky, Studium, Stránka).
   Každý widget je funkce (velikost s/m/l, kontext ctxNow z today.js, id widgetu, nastavení o) → {title, sub, btn, body}.
   Stav, který se neukládá (vybraný den, posun měsíce/týdne), drží DW_UI podle id widgetu. */
import { $, DAYS, DAYS_FULL, esc, plain, plural, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { DATA_REV, isDirty, META, savePage } from '../store.js';
import { eventsOnDate, fmtTime, mondayOf, parseDue, shortDate, toMin, ymd } from '../dates.js';
import { flatPages, isArchived, newBlock, pIcon, pTitle } from '../pages.js';
import { isSchool, semList, subjBlockText, subjLabel, subjsOf } from '../school.js';
import { sanitize } from '../sanitize.js';
import { renderSidebar } from '../sidebar.js';
import { renderMain } from '../router.js';
import { hiddenMask } from '../editor/render.js';
import { toast } from '../ui.js';
import { evColor, evTitle } from './schedule.js';
import { fmtNum, gradeChip, GRADES, subjCr, subjDone, subjMax, subjPoints, wavg } from './subjects.js';
import { allTasks, taskRow } from './tasks.js';

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
  if(e) p.push(dwCount(e,'hodina','hodiny','hodin')); if(t) p.push(dwCount(t,'termín','termíny','termínů'));
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
function wWeek(s,c,id){
  const u=dwUi(id), mon=dwAdd(mondayOf(c.now),7*(u.wk||0)), days=[0,1,2,3,4,5,6].map(i=>dwAdd(mon,i)), today=ymd(c.now);
  if(s==='s'){ const t=dwAdd(c.now,1);
    return {title:'Týden',body:`<div class="wk-sum"><div><b>Dnes</b><span>${dwSummary(c.now)}</span></div><div><b>Zítra</b><span>${dwSummary(t)}</span></div></div>`}; }
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
  return {title,btn:nav,body:grid+dwDayList(sd)};
}

/* ================= Rychlý úkol ================= */
const dwPageOk=pid=>{ const p=pid&&S.pages[pid]; return p&&!isArchived(p)?p:null; };
function dwPickMsg(id,what){ return `<div class="empty">${what}<div style="margin-top:8px"><button class="btn" data-act="wg-opts" data-w="${esc(id)}">Vybrat stránku</button></div></div>`; }
function wQuick(s,c,id,o){
  const pg=dwPageOk(o&&o.page);
  if(!pg) return {title:'Rychlý úkol',body:dwPickMsg(id,'Vyber stránku, kam se mají úkoly ukládat.')};
  const inp=`<div class="qk"><input class="qk-in" data-w="${esc(id)}" data-p="${pg.id}" placeholder="Nový úkol… (Enter)" aria-label="Nový úkol do stránky ${esc(pTitle(pg))}" enterkeyhint="done"><button class="btn pri qk-add" data-act="wg-qadd" data-w="${esc(id)}" aria-label="Přidat úkol">＋</button></div>`;
  const where=`<button class="qk-pg" data-act="open" data-id="${pg.id}">${pIcon(pg)}<span>${esc(pTitle(pg))}</span></button>`;
  if(s==='s') return {title:'Rychlý úkol',body:inp+`<div class="qk-note">do ${where}</div>`};
  const note=`<div class="qk-note">Uloží se do ${where}. Datum jako <span class="mono">5.10.</span> udělá termín.</div>`;
  if(s==='m') return {title:'Rychlý úkol',body:inp+note};
  const open=allTasks().filter(t=>t.pg.id===pg.id&&!t.done).slice(-5).reverse();
  return {title:'Rychlý úkol',body:inp+note+(open.length?`<div class="wg-grp">Nesplněné na stránce<span>${allTasks().filter(t=>t.pg.id===pg.id&&!t.done).length}</span></div>${open.map(t=>taskRow(t,false)).join('')}`:'')};
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

/* ================= Dnes v poznámkách ================= */
const DW_DATE_RE=/(?:^|[^\d.,])(\d{1,2})\.\s?(\d{1,2})(?![\d\p{L}])\.?(?:\s?(\d{4}))?/gu;
let dwMen=null, dwMenRev=-1;
function dwMentions(){
  if(dwMen&&dwMenRev===DATA_REV) return dwMen;
  dwMen=new Map();
  const put=(k,x)=>{ if(!dwMen.has(k)) dwMen.set(k,[]); const l=dwMen.get(k); if(!l.some(y=>y.b===x.b&&y.txt===x.txt)) l.push(x); };
  const scan=(pg,b,html,todo,done)=>{ const txt=plain(html).replace(/\s+/g,' ').trim(); if(!txt) return;
    for(const m of txt.matchAll(DW_DATE_RE)){ const d=parseDue(m[0]); if(d) put(ymd(d),{pg,b,txt,todo,done}); } };
  flatPages().forEach(({p:pg})=>{ const bl=pg.blocks||[], hid=hiddenMask(bl);
    bl.forEach((b,i)=>{ if(hid[i]) return;
      if(TEXT_TYPES.includes(b.type)) scan(pg,b,b.html,b.type==='todo',!!b.done);
      else if(b.type==='table') (b.rows||[]).forEach(r=>(r.cells||[]).forEach(cl=>(cl.lines||[]).forEach(ln=>scan(pg,b,ln.html,ln.t==='todo',!!ln.done)))); }); });
  dwMenRev=DATA_REV; return dwMen;
}
const dwMenRow=x=>`<button class="mn-row ${x.done?'done':''}" data-act="wg-goto" data-p="${x.pg.id}" data-b="${x.b.id}"><span class="mn-ic" aria-hidden="true">${x.todo?(x.done?'☑':'☐'):'¶'}</span><span class="mn-t">${esc(x.txt.length>160?x.txt.slice(0,157)+'…':x.txt)}</span><small>${esc(pTitle(x.pg))}${x.b.type==='table'?' · v tabulce':''}</small></button>`;
function wMentions(s,c){
  const M=dwMentions(), t=dwAdd(c.now,1), lt=M.get(ymd(c.now))||[], lz=M.get(ymd(t))||[];
  const empty=`<div class="empty">Dnešní datum (<span class="mono">${shortDate(c.now)}</span>) zatím v poznámkách není.</div>`;
  if(s==='s') return {title:'V poznámkách',body:lt.length?`<div class="wg-stat" style="padding:0 16px"><b>${lt.length}</b> ${plural(lt.length,'zmínka','zmínky','zmínek')} dneška</div>${dwMenRow(lt[0])}`:empty};
  if(s==='m') return {title:'Dnes v poznámkách',sub:`Kde je v textu ${shortDate(c.now)}`,body:lt.length?lt.map(dwMenRow).join(''):empty};
  return {title:'Dnes v poznámkách',sub:`Kde je v textu ${shortDate(c.now)} nebo ${shortDate(t)}`,
    body:`<div class="wg-grp">Dnes<span>${lt.length}</span></div>${lt.length?lt.map(dwMenRow).join(''):'<div class="empty">Nic.</div>'}<div class="wg-grp">Zítra<span>${lz.length}</span></div>${lz.length?lz.map(dwMenRow).join(''):'<div class="empty">Nic.</div>'}`};
}

/* ================= Stránky (připnuté a naposledy upravené) ================= */
function dwAgo(ts){
  if(!ts) return ''; const m=Math.round((Date.now()-ts)/6e4);
  if(m<1) return 'právě teď'; if(m<60) return `před ${m} min`; if(m<24*60) return `před ${Math.round(m/60)} h`;
  return fmtTime(ts);
}
function dwParentPath(p){ const par=p.parent&&S.pages[p.parent]; return par?pTitle(par):''; }
const dwPgRow=(p,meta)=>`<button class="pg-row" data-act="open" data-id="${p.id}">${pIcon(p)}<span class="pg-t">${esc(pTitle(p))}</span>${meta?`<small>${esc(meta)}</small>`:''}</button>`;
function wRecent(s,c,id,o){
  const pins=((o&&o.pins)||[]).map(dwPageOk).filter(Boolean);
  const pinSet=new Set(pins.map(p=>p.id));
  const rec=flatPages().map(x=>x.p).filter(p=>!pinSet.has(p.id)).sort((a,b)=>(b.updated||0)-(a.updated||0));
  if(!pins.length&&!rec.length) return {title:'Stránky',body:'<div class="empty">Zatím žádné stránky.</div>'};
  const pinH=pins.length?`<div class="wg-grp">Připnuté<span>${pins.length}</span></div>${pins.map(p=>dwPgRow(p,dwParentPath(p))).join('')}`:'';
  const recH=n=>`<div class="wg-grp">Naposledy upravené</div>${rec.slice(0,n).map(p=>dwPgRow(p,dwAgo(p.updated))).join('')}`;
  const pinBtn=`<button class="btn" data-act="wg-opts" data-w="${esc(id)}">Připnout</button>`;
  if(s==='s') return {title:'Stránky',body:[...pins,...rec].slice(0,4).map(p=>dwPgRow(p,'')).join('')};
  if(s==='m') return {title:'Stránky',btn:pins.length?'':pinBtn,body:pinH+recH(5)};
  return {title:'Stránky',btn:pinBtn,body:`<div class="pg-cols"><div>${pinH||'<div class="wg-grp">Připnuté</div><div class="empty">Stránky připneš tlačítkem Připnout.</div>'}</div><div>${recH(8)}</div></div>`};
}

/* ================= Studium (Index) ================= */
const dwNum=v=>{ const n=parseFloat(String(v??'').replace(',','.')); return isFinite(n)?n:0; };
function wStudy(s,c,id,o){
  const sems=semList(), sem=(o&&o.sem&&S.semesters[o.sem])||sems.find(x=>!x.hidden)||sems[0];
  if(!sem) return {title:'Studium',body:`<div class="empty">V Indexu zatím není semestr. <button class="linkbtn" data-act="nav" data-v="index">Otevřít Index</button></div>`};
  const list=subjsOf(sem.id), got=list.filter(subjDone).reduce((a,su)=>a+subjCr(su),0), enr=list.reduce((a,su)=>a+subjCr(su),0), target=dwNum(sem.target)||enr, av=wavg(list);
  const pct=target?Math.min(100,Math.round(got/target*100)):0, eMin=GRADES.find(g=>g[0]==='E')[1];
  const head=`<button class="st-sum" data-act="nav" data-v="index"><div class="wg-stat"><b>${fmtNum(got)}</b> / ${fmtNum(target)} kr.</div><span class="bar"><i style="width:${pct}%"></i></span><div class="wg-sub">${list.filter(subjDone).length} z ${list.length} předmětů splněno${av!=null?` · ⌀ ${fmtNum(av)}`:''}</div></button>`;
  const title=s==='s'?'Studium':`Studium · ${sem.name||'Semestr'}`;
  if(s==='s') return {title,sub:esc(sem.name||''),body:head};
  if(s==='m'){
    const miss=list.filter(su=>!subjDone(su)).map(su=>{ const p=subjPoints(su);
      const why=su.end==='z'?'chybí zápočet':p==null?'zatím bez bodů':p<eMin?`${fmtNum(p)} b, pod hranicí na E`:'chybí zápočet';
      return `<button class="st-row" data-act="wg-subj" data-id="${su.id}"><span class="ti-dot hl-${esc(su.color||'purple')}"></span><span class="nm">${esc(subjLabel(su))}</span><small class="${p!=null&&p<eMin&&su.end!=='z'?'late':''}">${why}</small></button>`; });
    return {title,body:head+(miss.length?`<div class="wg-grp">Ještě chybí<span>${miss.length}</span></div>${miss.join('')}`:'<div class="empty">Všechno v semestru je splněné. 🎉</div>')};
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
  return {title:`${pg.icon?pg.icon+' ':''}${pTitle(pg)}`,sub:pg.updated?`Upraveno ${esc(dwAgo(pg.updated))}`:'',btn,body:`<div class="pv">${dwPreview(pg,s==='m'?10:40)}</div>`};
}

/* ================= Disk (řádek pro hodiny) ================= */
function diskLine(){
  const D=window.DriveSync; if(!D||!D.clientId()) return '';
  const ts=Math.max(META.lastUpload||0,META.lastDownload||0,META.syncedAt||0);
  return `<div class="clk-w clk-disk">☁ ${ts?`Synchronizováno ${esc(dwAgo(ts))}`:'Zatím nesynchronizováno'}${isDirty()?' · <b>změny čekají na nahrání</b>':''}</div>`;
}

/* klik na ‹ › a dny v Týdnu a Kalendáři (stav se neukládá) */
function wgUi(a){
  const u=dwUi(a.dataset.w), k=a.dataset.k, v=a.dataset.v;
  if(k==='day') u.day=v;
  else if(k==='m'||k==='wk'){ u[k]=+v===0?0:(u[k]||0)+(+v); u.day=null; }
  renderMain();
}

export { diskLine, quickAdd, wCal, wgUi, wMentions, wPage, wQuick, wRecent, wStudy, wWeek };
