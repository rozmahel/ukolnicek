/* Úkolníček – Stránka Dnes */
import { $, DAYS_FULL, esc, MONTHS } from '../core.js';
import { S } from '../state.js';
import { eventsOnDate, sod, toMin, weekInfo } from '../dates.js';
import { flatPages, pIcon, pTitle } from '../pages.js';
import { isSchool } from '../school.js';
import { evRow } from './schedule.js';
import { allTasks, taskRow } from './tasks.js';

/* ================= today ================= */
function renderToday(){
  const now=new Date(), wi=weekInfo(now);
  const evs=eventsOnDate(now); const tm=new Date(now); tm.setDate(tm.getDate()+1); const evT=eventsOnDate(tm);
  const tasks=allTasks(); const t0=sod(now);
  const upcoming=tasks.filter(t=>!t.done&&t.due&&(t.due-t0)/864e5<=14).sort((a,b)=>a.due-b.due);
  const school=isSchool();
  /* stav úkolů po stránkách a nadpisech (H1 nebo blok předmětu) */
  const subj=[]; flatPages().forEach(({p})=>{ const secs=[]; tasks.filter(t=>t.pg.id===p.id).forEach(t=>{ let s=secs.find(x=>x.sec===t.sec); if(!s){ const su=t.subj&&S.subjects[t.subj]; s={p,sec:t.sec,key:t.key,total:0,done:0,color:su?su.color:''}; secs.push(s);} s.total++; if(t.done) s.done++; }); subj.push(...secs); });
  const nm=now.getHours()*60+now.getMinutes();
  const wd=(now.getDay()+6)%7;
  if(!Object.keys(S.pages).length&&(!school||!Object.keys(S.events).length)){
    $('#view').innerHTML=school
      ?`<div class="view"><div class="welcome"><div class="eyebrow">Úkolníček</div><h1>Tvůj školní sešit na jednom místě</h1><p class="muted">Projekty pro semestry a poznámky s úkoly a tabulkami, týdenní rozvrh a přehled termínů. Začni prvním projektem nebo si vyplň rozvrh.</p><div class="m-actions" style="justify-content:center"><button class="btn pri" data-act="new-page">＋ Nový projekt</button><button class="btn" data-act="nav" data-v="schedule">Otevřít rozvrh</button></div></div></div>`
      :`<div class="view"><div class="welcome"><div class="eyebrow">Úkolníček</div><h1>Poznámky a úkoly na jednom místě</h1><p class="muted">Projekty a podstránky s poznámkami, úkoly a tabulkami a přehled termínů. Rozvrh a Index předmětů zapneš v Nastavení jako školní režim.</p><div class="m-actions" style="justify-content:center"><button class="btn pri" data-act="new-page">＋ Nový projekt</button></div></div></div>`;
    return;
  }
  const deadlines=`<section class="card"><div class="card-h"><h2>Blížící se termíny</h2><button class="btn" data-act="nav" data-v="tasks">Všechny úkoly</button></div>
          <div class="card-body">${upcoming.length?upcoming.map(t=>taskRow(t,true)).join(''):'<div class="empty">Na příštích 14 dní nic. Datum jako <span class="mono">5.10.</span> v textu úkolu se tu ukáže samo.</div>'}</div></section>`;
  const status=subj.length?`<section class="card"><div class="card-h"><h2>Stav úkolů podle ${school?'předmětů':'nadpisů'}</h2></div><div class="card-body">${subj.map(({p,sec,key,total,done,color})=>`<button class="subj hl-${esc(color||p.color||'gray')}" data-act="goto-task" data-k="${esc(key)}">${sec?'<span class="ti-ic"><span class="ti-dot"></span></span>':pIcon(p)}<span class="nm">${esc(sec||pTitle(p))}</span><span class="n">${done}/${total}</span><span class="bar"><i style="width:${Math.round(done/total*100)}%"></i></span></button>`).join('')}</div></section>`:'';
  const head=`<div class="v-head"><div><div class="eyebrow">${DAYS_FULL[wd]}${school&&wi?` · ${wi.n}. týden výuky (${wi.parity})`:''}</div><h1 class="v-title">${now.getDate()}. ${MONTHS[now.getMonth()]}</h1></div></div>`;
  /* klasické poznámky: bez rozvrhu, jen termíny a stav úkolů */
  if(!school){ $('#view').innerHTML=`<div class="view">${head}<div class="cards">${deadlines}${status||'<span></span>'}</div></div>`; return; }
  $('#view').innerHTML=`<div class="view">
    ${head}
    <div class="cards">
      <div style="display:grid;gap:18px">
        <section class="card"><div class="card-h"><h2>Dnes v rozvrhu</h2><button class="btn" data-act="nav" data-v="schedule">Rozvrh</button></div>
          <div class="card-body">${evs.length?evs.map(ev=>evRow(ev,now).replace('class="ev-row',`class="ev-row ${toMin(ev.start)<=nm&&nm<toMin(ev.end)?'now-ev':''}`)).join(''):'<div class="empty">Dnes nemáš v rozvrhu nic.</div>'}</div></section>
        <section class="card"><div class="card-h"><h2>Zítra</h2></div>
          <div class="card-body">${evT.length?evT.map(ev=>evRow(ev,tm)).join(''):'<div class="empty">Zítra volno.</div>'}</div></section>
      </div>
      <div style="display:grid;gap:18px">
        ${deadlines}
        ${status}
      </div>
    </div></div>`;
}

export { renderToday };
