/* Úkolníček – Levý panel: menu, strom projektů, mini kalendář */
import { $, DAYS, DAYS_FULL, esc, ICONS } from './core.js';
import { MONTHS_NOM, S } from './state.js';
import { LOCK } from './lock.js';
import { savePage, updateSaving } from './store.js';
import { isoWeek, mondayOf, parseD, weekInfo, weekNo, weeksBetween, ymd } from './dates.js';
import { curPage, kids, pIcon, pTitle } from './pages.js';
import { isIndex, isSchool } from './school.js';
import { renderPage } from './editor/render.js';
import { shownTasks } from './views/tasks.js';
import { updateSyncUI } from './sync/sync.js';

/* ================= sidebar ================= */
function renderSidebar(){
  const side=$('#side'); const wk=weekInfo(new Date());
  const open=shownTasks().filter(t=>!t.done).length;
  const v=S.view;
  const nav=(k,label,extra='')=>`<button class="nv ${v.kind===k?'on':''}" data-act="nav" data-v="${k}">${ICONS[k]}<span>${label}</span>${extra}</button>`;
  const tree=(pid,d)=>kids(pid).map(p=>{
    const ch=kids(p.id).length, open=S.expanded[p.id]!==false;
    return `<div class="ti ${v.kind==='page'&&v.pageId===p.id?'on':''}" style="--d:${d}">
      <button class="ti-tog ${ch?'':'none'} ${open?'open':''}" data-act="tog" data-id="${p.id}" aria-label="${open?'Sbalit':'Rozbalit'}"></button>
      <button class="ti-main" data-act="open" data-id="${p.id}">${pIcon(p)}<span class="ti-t">${esc(pTitle(p))}</span></button>
      <span class="ti-acts"><button class="icon-btn" data-act="page-menu" data-id="${p.id}" aria-label="Možnosti" data-popanchor>⋯</button><button class="icon-btn" data-act="new-sub" data-id="${p.id}" aria-label="Přidat podstránku">+</button></span>
    </div>${ch&&open?tree(p.id,d+1):''}`;
  }).join('');
  const school=isSchool();
  side.innerHTML=`
    <div class="ws"><div class="ws-name">${esc(S.settings.name||'Úkolníček')}</div>
      ${!S.ready||!school?'':wk?`<div class="ws-week"><b>${wk.n}.</b> týden výuky · ${wk.parity}</div>`:`<button class="linkbtn" data-act="settings">Nastav začátek semestru</button>`}
      ${S.ready&&S.settings.miniCal?renderMiniCal():''}</div>
    <nav class="nav">
      ${nav('today','Dnes')}
      ${school?(isIndex()?nav('index','Index'):'')+nav('schedule','Rozvrh'):''}
      ${nav('tasks','Úkoly',open?`<span class="badge">${open}</span>`:'')}
      <button class="nv" data-act="search">${ICONS.search}<span>Hledat</span><kbd>⌘K</kbd></button>
    </nav>
    <div class="sec-h"><span>Projekty</span><button class="icon-btn" data-act="new-page" aria-label="Nový projekt">+</button></div>
    <div class="tree">${Object.keys(S.pages).length?tree(null,0):`<div class="tree-empty">Zatím žádné projekty.<br><button class="linkbtn" data-act="new-page">Vytvořit první projekt</button></div>`}</div>
    <div class="syncbar" id="sync-box"></div>
    <div class="side-foot"><button class="nv" data-act="settings">${ICONS.settings}<span>Nastavení</span></button><span id="save-state"></span></div>`;
  updateSaving(); updateSyncUI();
}

/* mini kalendář v bočním panelu: měsíc, dny v týdnu a (volitelně) číslo týdne v roce;
   týden výuky (jen ve školním režimu) je v řádku nad kalendářem a v bublině po najetí na číslo */
function renderMiniCal(){
  const now=new Date(), base=new Date(now.getFullYear(),now.getMonth()+S.calOffset,1);
  const y=base.getFullYear(), mo=base.getMonth();
  const start=mondayOf(base), weeks=weeksBetween(start,new Date(y,mo+1,0))+1;
  const school=isSchool(), sem=school&&!!parseD(S.settings.semesterStart), today=ymd(now), wk=S.settings.miniCalWeeks!==false;
  let h=`<div class="mc" aria-label="Kalendář">
    <div class="mc-h"><button class="mc-nav" data-act="mc-prev" aria-label="Předchozí měsíc">‹</button><button class="mc-t ${S.calOffset?'':'cur'}" data-act="mc-now" title="Zpět na tento měsíc">${MONTHS_NOM[mo]} ${y}</button><button class="mc-nav" data-act="mc-next" aria-label="Další měsíc">›</button></div>
    <div class="mc-g ${wk?'':'nowk'}">${wk?'<span class="mc-wk mc-dh" title="Kalendářní týden v roce">KT</span>':''}${DAYS.map((d,i)=>`<span class="mc-dh ${i>4?'we':''}">${d}</span>`).join('')}`;
  for(let w=0;w<weeks;w++){
    const mon=new Date(start); mon.setDate(start.getDate()+w*7);
    if(wk){
      const kt=isoWeek(mon), n=sem?weekNo(mon):null, cur=weeksBetween(now,mon)===0;
      h+=`<span class="mc-wk ${cur?'cur':''}" title="${kt}. týden v roce${n>=1&&n<=20?` · ${n}. týden výuky (${n%2?'lichý':'sudý'})`:''}">${kt}</span>`;
    }
    for(let i=0;i<7;i++){
      const d=new Date(mon); d.setDate(mon.getDate()+i);
      const cls=`mc-d ${d.getMonth()===mo?'':'out'} ${ymd(d)===today?'today':''} ${i>4?'we':''}`, tt=`${DAYS_FULL[i]} ${d.getDate()}. ${d.getMonth()+1}.`;
      /* klik na den otevře týden v rozvrhu (jen ve školním režimu) */
      h+=school?`<button class="${cls}" data-act="mc-day" data-date="${ymd(d)}" title="${tt} · otevřít v rozvrhu">${d.getDate()}</button>`:`<span class="${cls} nolink" title="${tt}">${d.getDate()}</span>`;
    }
  }
  return h+'</div></div>';
}


/* ---- přesouvání projektů tažením myší (na dotyk zůstává menu ⋯ Posunout nahoru/dolů) ----
   puštění nad položkou = před ni, pod polovinou = za ni, na stejnou úroveň jako ona */
let td=null, tdJust=0;
function tdClear(){ document.querySelectorAll('.ti.drop-before,.ti.drop-after,.ti.ti-dragging').forEach(x=>x.classList.remove('drop-before','drop-after','ti-dragging')); document.body.classList.remove('tree-drag'); }
const isInside=(id,anc)=>{ let p=S.pages[id]; for(let n=0;p&&n<50;n++){ if(p.id===anc) return true; p=S.pages[p.parent]; } return false; };
function tdTarget(x,y,drag){
  const el=document.elementFromPoint(x,y), it=el&&el.closest&&el.closest('#side .ti'); if(!it) return null;
  const id=$('.ti-main',it).dataset.id; if(isInside(id,drag)) return null;   /* sám na sebe ani do vlastních podstránek ne */
  const rc=it.getBoundingClientRect(); return {it,id,after:y>rc.top+rc.height/2};
}
function initTreeDrag(){
  const side=$('#side');
  side.addEventListener('pointerdown',e=>{
    td=null; if(LOCK||e.button!==0||e.pointerType!=='mouse') return;
    const it=e.target.closest('.ti'); if(!it||e.target.closest('.ti-acts,.ti-tog')) return;
    td={id:$('.ti-main',it).dataset.id,it,x:e.clientX,y:e.clientY,on:false};
  });
  document.addEventListener('pointermove',e=>{
    if(!td) return; if(!(e.buttons&1)){ td=null; tdClear(); return; }
    if(!td.on){ if(Math.hypot(e.clientX-td.x,e.clientY-td.y)<6) return; td.on=true; td.it.classList.add('ti-dragging'); document.body.classList.add('tree-drag'); }
    e.preventDefault();
    document.querySelectorAll('.ti.drop-before,.ti.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));
    const t=tdTarget(e.clientX,e.clientY,td.id); if(t) t.it.classList.add(t.after?'drop-after':'drop-before');
  });
  document.addEventListener('pointerup',e=>{
    if(!td) return; const d=td; td=null; if(!d.on) return;
    tdJust=Date.now(); const t=tdTarget(e.clientX,e.clientY,d.id); tdClear(); if(!t) return;
    const pg=S.pages[d.id], tg=S.pages[t.id]; if(!pg||!tg) return;
    const par=tg.parent||null, moved=(pg.parent||null)!==par;
    const sib=kids(par).filter(x=>x.id!==pg.id); let i=sib.findIndex(x=>x.id===tg.id); if(t.after) i++;
    sib.splice(i,0,pg); pg.parent=par;
    sib.forEach((x,k)=>{ if(x.order!==k+1||x===pg){ x.order=k+1; savePage(x,0); } });
    renderSidebar(); if(moved&&curPage()===pg) renderPage(pg);
  });
  /* klik hned po puštění neotevírá projekt */
  side.addEventListener('click',e=>{ if(Date.now()-tdJust<250){ e.stopPropagation(); e.preventDefault(); } },true);
}

/* levý panel na mobilu (vysouvací) */
function openSide(){ $('#side').classList.add('open'); $('#scrim').classList.add('open'); }
function closeSide(){ $('#side').classList.remove('open'); $('#scrim').classList.remove('open'); }

export { closeSide, initTreeDrag, openSide, renderSidebar };
