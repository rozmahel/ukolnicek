/* Úkolníček – Přepínání pohledů (Dnes, Index, Rozvrh, Úkoly, Myšlenková mapa, stránka) */
import { $, lsGet, lsSet } from './core.js';
import { S } from './state.js';
import { Store } from './store.js';
import { isArchived, pTitle } from './pages.js';
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
import { spSync } from './split.js';
import { renderTrashView } from './trash.js';
import { renderMindmap } from './views/mindmap.js';

/* ================= místo na stránce (jen v zařízení, nezálohuje se) ================= */
const SCR_KEY='uk-scroll';
const scr=lsGet(SCR_KEY,{})||{};
let scrT=null, want=null, wantT=0, got=0, scrBound=false;
const scrPage=()=>S.view.kind==='page'?S.view.pageId:null;
function rememberScroll(now){
  const k=scrPage(), m=$('#main'); if(!k||!m||!S.ready||want!=null) return;
  const v=Math.round(m.scrollTop); if(v>0) scr[k]=v; else delete scr[k];
  clearTimeout(scrT); if(now) lsSet(SCR_KEY,scr); else scrT=setTimeout(()=>lsSet(SCR_KEY,scr),400);
}
/* místo na stránce pro druhou polovinu rozdělené obrazovky (js/split.js) */
function scrollOf(id){ return scr[id]||0; }
function noteScroll(id,v,now){ if(!id) return; v=Math.round(v||0); if(v>0) scr[id]=v; else delete scr[id]; clearTimeout(scrT); if(now) lsSet(SCR_KEY,scr); else scrT=setTimeout(()=>lsSet(SCR_KEY,scr),400); }
/* vrátí stránku tam, kde jsem z ní odešel; dokud se dočítají obrázky, chvíli to drží (pokud sám nescrolluju) */
function restoreScroll(){
  const m=$('#main'); if(!m) return;
  if(!scrBound){
    scrBound=true;
    m.addEventListener('scroll',()=>{ if(want!=null&&Date.now()-wantT<2000&&m.scrollTop===got) return; want=null; rememberScroll(); },{passive:true});
    const stop=()=>{ want=null; };
    ['wheel','touchstart','keydown','mousedown'].forEach(t=>m.addEventListener(t,stop,{passive:true}));
    $('#view').addEventListener('load',()=>{ if(want==null||Date.now()-wantT>2000||m.scrollTop!==got){ want=null; return; } m.scrollTop=want; got=m.scrollTop; },true);
  }
  const k=scrPage(), v=k&&scr[k]||0;
  m.scrollTop=v; got=m.scrollTop; want=v>0?v:null; wantT=Date.now();
}

/* ================= routing ================= */
function go(view){
  Store.flushAll();
  rememberScroll(true);
  S.view=view; lsSet('uk-view',view);
  if(view.kind==='page'&&isArchived(S.pages[view.pageId])) S.archMode=true;   /* archivovaná stránka (třeba z hledání): panel ukáže archiv */
  if(view.kind==='trash'){ S.trashMode=true; S.archMode=false; } else S.trashMode=false;
  closeSide(); closePop(); hideFmt(); hideCellbar(); hideImgSel();
  renderSidebar(); renderMain();
  restoreScroll();
}
function renderMain(){
  const v=S.view, view=$('#view');
  if(!S.ready){ view.innerHTML='<div class="loading">Načítám tvoje stránky…</div>'; return; }
  let title='Úkolníček';
  if(v.kind==='page'){
    const pg=S.pages[v.pageId];
    if(!pg){ S.view={kind:'today'}; return renderMain(); }
    renderPage(pg); title=pTitle(pg);
  } else if((v.kind==='schedule'&&!isSchool())||(v.kind==='index'&&!isIndex())||(v.kind==='mindmap'&&!S.settings.mindmap)){ S.view={kind:'today'}; lsSet('uk-view',S.view); return renderMain(); }   /* jen ve školním režimu (Index jen když není vypnutý) */
  else if(v.kind==='trash'){ if(!renderTrashView(v.id)){ S.view={kind:'today'}; lsSet('uk-view',S.view); return renderMain(); } title='Koš'; }
  else if(v.kind==='schedule'){ renderSchedule(); title='Rozvrh'; }
  else if(v.kind==='tasks'){ renderTasks(); title='Úkoly'; }
  else if(v.kind==='mindmap'){ renderMindmap(); title='Myšlenková mapa'; }
  else if(v.kind==='index'){ renderIndex(); title='Index'; }
  else { renderToday(); title='Dnes'; }
  $('#tb-t').textContent=title;
  spSync();   /* rozdělená obrazovka: druhá polovina, nebo zavřít (jen stránky) */
  document.dispatchEvent(new Event('uk-view'));   /* panel AI se schová mimo stránky a na jiné stránce začne znovu */
}

export { go, noteScroll, renderMain, restoreScroll, scrollOf };
