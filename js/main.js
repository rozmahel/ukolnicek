/* Úkolníček – Start aplikace: globální kliknutí a klávesy, spuštění, Service Worker, upozornění při zavírání */
import { $, $$, clamp, esc, lsGet, lsSet } from './core.js';
import { S } from './state.js';
import { applyLock, LOCK, toggleLock } from './lock.js';
import { initStore, isDirty, META, savePage, saveSettings, Store } from './store.js';
import { redo, undo } from './editor/history.js';
import { fmtTime, fromMin, parseD, weeksBetween, ymd } from './dates.js';
import { createPage, curPage, emptyCell, newBlock, pTitle, revealBlock } from './pages.js';
import { isSchool } from './school.js';
import { isBlank } from './sanitize.js';
import { focusBlock, focusEl, focusLine } from './editor/caret.js';
import { closeSide, openSide, renderSidebar } from './sidebar.js';
import { go, renderMain } from './router.js';
import { ctxOf, renderPage, rerenderBlocks, rerenderProps } from './editor/render.js';
import { applyTemplate } from './editor/blocks.js';
import { openSlash, slash } from './editor/slash.js';
import { initEvents } from './editor/events.js';
import { initToolbar } from './editor/toolbar.js';
import { closeModal, closePop, initUi, openModal, toast } from './ui.js';
import { openBlockMenu, openIconPop, openPageMenu, openSubjBlockMenu, openTableMenu } from './editor/menus.js';
import { initSchedule, openEventLocked, openEventModal, weekDates } from './views/schedule.js';
import { initIndex, ixAction, openIndexView, openSemModal, openSubjectModal } from './views/subjects.js';
import { openTaskProjects, setTaskHidden, taskByKey, toggleTask } from './views/tasks.js';
import { openSearch } from './views/search.js';
import { applyFontScale, applyTheme, initSettings, openSettings } from './views/settings.js';
import { openSyncMenu, Sync } from './sync/sync.js';
import { openLinkPop } from './editor/links.js';
import { initImages, selectImage } from './editor/images.js';

/* posluchače ostatních modulů; pořadí je stejné jako dřív v jednom souboru app.js (na pořadí registrace záleží) */
initStore(); initEvents(); initToolbar(); initUi(); initSchedule(); initSettings(); initImages(); initIndex();

/* ================= global actions ================= */
document.addEventListener('click',e=>{
  if(e.target.closest('.pop,.modal,#fmt,#cellbar,#slash,#imgframe')) return;
  const lk=e.target.closest&&e.target.closest('a.lnk');
  if(lk){
    if(!lk.closest('[contenteditable="true"]')) return; /* mimo editor (Úkoly) se otevře normálně v nové kartě */
    e.preventDefault();
    if(e.metaKey||e.ctrlKey){ window.open(lk.href,'_blank','noopener'); return; }
    openLinkPop(lk); return;
  }
  const im=e.target.closest&&e.target.closest('#doc .txt img.im, #doc .bimg'); if(im){ selectImage(im); return; }
  const col=e.target.classList&&e.target.classList.contains('sg-col')?e.target:null;
  if(col){
    if(LOCK) return;   /* zamčeno: klik do prázdného místa nic nevytvoří */
    const sg=$('#sg'); const h0=+sg.dataset.h0; const y=e.clientY-col.getBoundingClientRect().top;
    const hh=+sg.dataset.hh||52;
    const s=clamp(Math.round((h0*60+Math.floor(y/hh*2)/2*60)),0,23*60);
    openEventModal(null,{day:+col.dataset.day,date:col.dataset.date,start:fromMin(s),end:fromMin(Math.min(s+110,23*60+59))});
    return;
  }
  const a=e.target.closest('[data-act]'); if(!a) return;
  const act=a.dataset.act, pg=curPage();
  /* zamčeno: nic, co mění strukturu stránky */
  if(LOCK&&['add-after','row-menu','col-menu','add-row','add-col','prop-add','prop-del','tpl'].includes(act)) return;
  switch(act){
    case 'lock': toggleLock(); break;
    case 'mc-prev': S.calOffset--; renderSidebar(); break;
    case 'mc-next': S.calOffset++; renderSidebar(); break;
    case 'mc-now': S.calOffset=0; renderSidebar(); break;
    case 'mc-day': { if(!isSchool()) break; const d=parseD(a.dataset.date); S.weekOffset=weeksBetween(new Date(),d); if(!S.settings.showWeekend&&(d.getDay()===0||d.getDay()===6)) toast('Víkend se v rozvrhu nezobrazuje. Zapneš ho v Nastavení.'); go({kind:'schedule'}); break; }
    case 'ev-par': { const ev=S.events[a.dataset.id]; if(!ev) break; const d=parseD(a.dataset.date);
      openEventModal(null,{day:(d.getDay()+6)%7,date:ev.repeat==='count'?ev.date:a.dataset.date,start:ev.start,end:ev.end,repeat:ev.repeat,count:ev.count||4}); break; }
    case 'nav': go({kind:a.dataset.v}); break;
    case 'menu': $('#side').classList.contains('open')?closeSide():openSide(); break;
    case 'search': closeSide(); openSearch(); break;
    case 'settings': closeSide(); openSettings(); break;
    case 'open': go({kind:'page',pageId:a.dataset.id}); break;
    case 'tog': S.expanded[a.dataset.id]=S.expanded[a.dataset.id]===false; lsSet('uk-exp',S.expanded); renderSidebar(); break;
    case 'new-page': { const p=createPage(null); renderSidebar(); go({kind:'page',pageId:p.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); break; }
    case 'new-sub': { const p=createPage(a.dataset.id); renderSidebar(); go({kind:'page',pageId:p.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); break; }
    case 'page-menu': { const p=S.pages[a.dataset.id]; if(p) openPageMenu(a,p); break; }
    case 'icon': if(pg) openIconPop(a,pg); break;
    case 'tpl': if(pg) applyTemplate(pg,a.dataset.v); break;
    case 'sync-menu': openSyncMenu(a); break;
    case 'sync-up': Sync.upload(); break;
    case 'sync-down': Sync.download(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'wide': if(pg){ pg.wide=!pg.wide; savePage(pg,0); renderPage(pg); } break;
    case 'prop-add': if(pg){ pg.props=pg.props||[]; pg.props.push({k:'',v:''}); savePage(pg); rerenderProps(); focusEl($$('#props .pk').pop(),0); } break;
    case 'prop-del': if(pg){ pg.props.splice(+a.dataset.i,1); savePage(pg); rerenderProps(); } break;
    case 'check': { const x=ctxOf(a); if(!x) break; x.b.done=!x.b.done; a.classList.toggle('on',x.b.done); a.setAttribute('aria-checked',x.b.done); a.parentElement.querySelector('.txt').classList.toggle('done',x.b.done); savePage(x.pg,300); renderSidebar(); break; }
    case 'lcheck': { const x=ctxOf(a); if(!x||!x.line) break; x.line.done=!x.line.done; a.classList.toggle('on',x.line.done); a.closest('.ln').classList.toggle('done',x.line.done); savePage(x.pg,300); renderSidebar(); break; }
    case 'collapse': { const x=ctxOf(a); if(!x) break; x.b.collapsed=!x.b.collapsed; savePage(x.pg); rerenderBlocks(); break; }
    case 'add-after': { const x=ctxOf(a); if(!x) break; const nb=newBlock('p',{level:x.b.level||0}); x.pg.blocks.splice(x.bi+1,0,nb); savePage(x.pg); rerenderBlocks(); const el=$(`#blocks .blk[data-id="${nb.id}"] .txt`); focusEl(el,0); openSlash(el,nb.id,0,'plus'); break; }
    case 'blk-menu': { const x=ctxOf(a); if(x) openBlockMenu(a,x.pg,x.b); break; }
    case 'subj-blk': { const x=ctxOf(a); if(x&&x.b.type==='subj') openSubjBlockMenu(a,x.pg,x.b); break; }
    case 'row-menu': case 'col-menu': { const x=ctxOf(a); if(x&&x.b.type==='table') openTableMenu(a,x.pg,x.b,act==='row-menu'?'row':'col',act==='row-menu'?x.r:x.c); break; }
    case 'add-row': { const x=ctxOf(a); if(!x) break; const cols=x.b.rows[0].cells.length; x.b.rows.push({cells:Array.from({length:cols},()=>emptyCell())}); savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,x.b.rows.length-1,0,0,0); break; }
    case 'add-col': { const x=ctxOf(a); if(!x) break; x.b.rows.forEach(r=>r.cells.push(emptyCell())); savePage(x.pg); rerenderBlocks(); focusLine(x.b.id,0,x.b.rows[0].cells.length-1,0,0); break; }
    case 'tail': if(pg){ const last=pg.blocks[pg.blocks.length-1]; if(last&&last.type==='p'&&isBlank(last.html)) focusBlock(last.id,0); else { const nb=newBlock('p'); pg.blocks.push(nb); savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); } } break;
    case 'wk-prev': S.weekOffset--; renderMain(); break;
    case 'wk-next': S.weekOffset++; renderMain(); break;
    case 'wk-today': S.weekOffset=0; renderMain(); break;
    case 'ev-add': { const d=weekDates()[0]; const today=new Date(); const inWeek=weekDates().find(x=>ymd(x)===ymd(today)); const dd=inWeek||d; openEventModal(null,{day:(dd.getDay()+6)%7,date:ymd(dd)}); break; }
    case 'day-add': openEventModal(null,{day:+a.dataset.day,date:a.dataset.date}); break;
    case 'ev': { const ev=S.events[a.dataset.id]; if(!ev) break; if(LOCK) openEventLocked(a,ev); else openEventModal(ev); break; }   /* zamčeno: jen skok na předmět */
    case 'tfilter': S.taskFilter=a.dataset.v; renderMain(); break;
    case 'task-check': toggleTask(a.dataset.k); break;
    case 'goto-task': { const t=taskByKey(a.dataset.k); if(t) revealBlock(t.pg.id,t.b.id,false); break; }
    case 'goto-sec': revealBlock(a.dataset.p,a.dataset.b,true); break;
    case 'subj': { const su=S.subjects[a.dataset.id]; if(su) openSubjectModal(su); break; }
    case 'subj-new': openSubjectModal(null,a.dataset.sem?{sem:a.dataset.sem}:null); break;
    case 'ix-notes': case 'ix-evs': case 'ix-tasks': case 'ix-link': ixAction(act,a); break;
    case 'ix-view': openIndexView(); break;
    case 'sem-new': openSemModal(null); break;
    case 'sem-edit': { const sm=S.semesters[a.dataset.id]; if(sm) openSemModal(sm); break; }
    case 't-projs': openTaskProjects(a); break;
    case 't-showall': if(S.settings.taskHidden){ delete S.settings.taskHidden; saveSettings(); renderSidebar(); renderMain(); } break;
    case 't-hide': { const r=S.pages[a.dataset.id]; if(!r) break; setTaskHidden(r.id,true);
      toast(`„${pTitle(r)}“ je v Úkolech skrytý.`,'Vrátit',()=>setTaskHidden(r.id,false)); break; }
  }
});
document.addEventListener('keydown',e=>{
  if(!(e.metaKey||e.ctrlKey)||e.altKey) return;
  if(e.shiftKey&&e.code==='KeyL'){ e.preventDefault(); e.stopPropagation(); if(!S.modal) toggleLock(); return; }
  const k=e.key.toLowerCase(); if(k!=='z'&&k!=='y') return;
  if(S.view.kind!=='page'||S.modal) return;
  if(e.target.closest&&e.target.closest('input,textarea,select,.pop')) return;
  e.preventDefault(); e.stopPropagation();
  if(k==='y'||e.shiftKey) redo(); else undo();
},true);
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); openSearch(); return; }
  if(e.key==='Escape'){ if(slash.open) return; if(S.pop){ closePop(); return; } if(S.modal){ closeModal(); return; } closeSide(); }
});
setInterval(()=>{ if(S.ready&&!S.modal&&(S.view.kind==='schedule'||S.view.kind==='today')&&!document.activeElement.closest?.('#view input')) { const st=$('#main').scrollTop; renderMain(); $('#main').scrollTop=st; } },60000);

/* ================= boot ================= */
applyTheme(); applyFontScale();
applyLock();
renderSidebar();
Store.init();
let reloading=false;
/* Vývoj na localhostu: bez Service Workeru, aby se každá změna projevila po obyčejném obnovení stránky.
   Offline režim jde i tady vyzkoušet: v konzoli localStorage.setItem('uk-dev-sw','true') a obnovit. */
const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&!lsGet('uk-dev-sw',false);
if(DEV){
  if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
  if(window.caches) caches.keys().then(ks=>ks.filter(k=>k.startsWith('ukolnicek-')).forEach(k=>caches.delete(k))).catch(()=>{});
}
else if('serviceWorker' in navigator&&location.protocol!=='file:'){
  /* Nová verze se nasadí sama: hned po spuštění / návratu do appky (prvních 20 s),
     nebo když appku schováš či přepneš jinam. Když zrovna píšeš nebo máš otevřený dialog,
     ukáže se jen lišta „Obnovit“, aby ti reload nesmazal rozepsané. */
  let fresh=Date.now(), pending=null;
  const typing=()=>{ const a=document.activeElement; return !!a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  const apply=w=>w.postMessage('skipWaiting');
  const offer=w=>{
    pending=w;
    if(Sync.busy||Sync.checking){ setTimeout(()=>offer(w),1500); return; }   /* nepřerušit stahování z Disku */
    if(Date.now()-fresh<20000&&!S.modal&&!typing()) return apply(w);
    const bar=$('#upd'); if(!bar) return; bar.hidden=false; $('#upd-btn').onclick=()=>apply(w);
  };
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      if(reg.waiting&&navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound',()=>{ const w=reg.installing; if(w) w.addEventListener('statechange',()=>{ if(w.state==='installed'&&navigator.serviceWorker.controller) offer(w); }); });
      document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){ fresh=Date.now(); reg.update().catch(()=>{}); } });
      setInterval(()=>reg.update().catch(()=>{}),3600000);
    }).catch(e=>console.warn('SW',e));
  });
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'&&pending) apply(pending); });
  navigator.serviceWorker.addEventListener('controllerchange',async()=>{ if(reloading) return; reloading=true; try{ await Store.flush(); }catch(_){} location.reload(); });
}

/* Upozornění při zavírání: jen když je Disk nastavený a jsou tu změny, které na něm nejsou.
   Prohlížeč ukáže vlastní dialog (vlastní tlačítka do něj dát nejde); když zvolíš „Zůstat“,
   nabídne Úkolníček rovnou nahrání. */
window.addEventListener('beforeunload',e=>{
  if(reloading) return;
  const dirty=isDirty();
  if(!dirty||DriveSync.state()==='off'||Sync.busy) return;
  try{ Store.flush(); }catch(_){}
  e.preventDefault(); e.returnValue='';
  setTimeout(()=>{
    if(S.modal) return;
    const m=openModal('Neuložené změny',`<div class="m-body">
      <p>V tomto zařízení máš změny, které nejsou na Disku${META.changedAt?' (poslední úprava '+esc(fmtTime(META.changedAt))+')':''}.</p>
      <div class="m-actions"><span class="sp"></span><button type="button" class="btn" data-close>Teď ne</button><button type="button" class="btn pri" id="lv-up">Nahrát na Disk</button></div></div>`);
    $('#lv-up',m).addEventListener('click',()=>{ closeModal(); Sync.upload(); });
  },300);
});
