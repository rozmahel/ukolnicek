/* Úkolníček – Přepínání pohledů (Dnes, Index, Rozvrh, Úkoly, stránka) */
import { $, lsSet } from './core.js';
import { S } from './state.js';
import { Store } from './store.js';
import { pTitle } from './pages.js';
import { isIndex, isSchool } from './school.js';
import { closeSide, renderSidebar } from './sidebar.js';
import { renderPage } from './editor/render.js';
import { hideCellbar, hideFmt } from './editor/toolbar.js';
import { closePop } from './ui.js';
import { renderSchedule } from './views/schedule.js';
import { renderIndex } from './views/subjects.js';
import { renderTasks } from './views/tasks.js';
import { renderToday } from './views/today.js';
import { hideImgSel } from './editor/images.js';

/* ================= routing ================= */
function go(view){
  Store.flushAll();
  S.view=view; lsSet('uk-view',view);
  closeSide(); closePop(); hideFmt(); hideCellbar(); hideImgSel();
  renderSidebar(); renderMain();
  $('#main').scrollTop=0;
}
function renderMain(){
  const v=S.view, view=$('#view');
  if(!S.ready){ view.innerHTML='<div class="loading">Načítám tvoje stránky…</div>'; return; }
  let title='Úkolníček';
  if(v.kind==='page'){
    const pg=S.pages[v.pageId];
    if(!pg){ S.view={kind:'today'}; return renderMain(); }
    renderPage(pg); title=pTitle(pg);
  } else if((v.kind==='schedule'&&!isSchool())||(v.kind==='index'&&!isIndex())){ S.view={kind:'today'}; lsSet('uk-view',S.view); return renderMain(); }   /* jen ve školním režimu (Index jen když není vypnutý) */
  else if(v.kind==='schedule'){ renderSchedule(); title='Rozvrh'; }
  else if(v.kind==='tasks'){ renderTasks(); title='Úkoly'; }
  else if(v.kind==='index'){ renderIndex(); title='Index'; }
  else { renderToday(); title='Dnes'; }
  $('#tb-t').textContent=title;
}

export { go, renderMain };
