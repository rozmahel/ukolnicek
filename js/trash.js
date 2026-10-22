/* Úkolníček – Koš: smazané stránky (i s podstránkami) a projekty tu zůstanou 7 dní
   S.trash = {ID kořenové stránky: {id, at: čas smazání, pages: [kořen, podstránky…]}}
   V datech je jako samostatný klíč trash (jen když není prázdný), takže ho starší verze neukáže ani nevrátí mezi stránky. */
import { $, esc, plural } from './core.js';
import { S } from './state.js';
import { LOCK } from './lock.js';
import { savePage, Store } from './store.js';
import { kids, pIcon, pTitle } from './pages.js';
import { renderSidebar } from './sidebar.js';
import { go, renderMain } from './router.js';
import { renderBlocks } from './editor/render.js';
import { openPop, toast } from './ui.js';

const KEEP=7*864e5;
const trashItems=()=>Object.values(S.trash||{}).sort((a,b)=>(b.at||0)-(a.at||0));
/* kolik zbývá do smazání: „5 d“, poslední den v hodinách */
function leftTxt(t){
  const ms=Math.max(0,(t.at||0)+KEEP-Date.now());
  return ms>=864e5?Math.ceil(ms/864e5)+' d':Math.max(1,Math.ceil(ms/36e5))+' h';
}
function leftLong(t){
  const ms=Math.max(0,(t.at||0)+KEEP-Date.now()), d=Math.ceil(ms/864e5), h=Math.max(1,Math.ceil(ms/36e5));
  return ms>=864e5?`${d} ${plural(d,'den','dny','dní')}`:`${h} ${plural(h,'hodinu','hodiny','hodin')}`;
}
/* stránka (a její podstránky) do koše */
function trashPage(id,ids){
  const root=S.pages[id]; if(!root) return;
  S.trash[id]={id,at:Date.now(),pages:ids.map(i=>S.pages[i]).filter(Boolean)};
  ids.forEach(i=>{ delete S.pages[i]; });
  Store.queue();
  if(S.view.kind==='page'&&ids.includes(S.view.pageId)) go({kind:'today'}); else { renderSidebar(); renderMain(); }
  toast(`„${pTitle(root)}“ ${ids.length>1?`i s ${ids.length-1} ${plural(ids.length-1,'podstránkou','podstránkami','podstránkami')} `:''}přesunuto do koše`,'Zpět',()=>restoreTrash(id));
}
/* obnovení na původní místo; když nadřazená stránka už neexistuje, na konec projektů */
function restoreTrash(id,quiet){
  const t=S.trash[id]; if(!t) return;
  delete S.trash[id];
  const back=t.pages.filter(p=>!S.pages[p.id]);
  back.forEach(p=>{ S.pages[p.id]=p; });
  const root=S.pages[t.id];
  if(root&&back.includes(root)&&root.parent&&!S.pages[root.parent]){
    root.parent=null; const sib=kids(null).filter(x=>x!==root); root.order=(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1;
  }
  back.forEach(p=>savePage(p));
  Store.queue();
  if(S.trashMode&&!Object.keys(S.trash).length) S.trashMode=false;
  if(S.view.kind==='trash'&&S.view.id===id&&root){ S.trashMode=false; go({kind:'page',pageId:root.id}); }
  else { renderSidebar(); renderMain(); }
  if(!quiet) toast(`„${pTitle(root||t.pages[0])}“ obnoveno`);
}
function dropTrash(ids){
  ids.forEach(id=>{ delete S.trash[id]; });
  Store.queue();
  if(!Object.keys(S.trash).length) S.trashMode=false;
  if(S.view.kind==='trash'&&!S.trash[S.view.id]) go({kind:'today'}); else { renderSidebar(); renderMain(); }
}
/* položky starší než 7 dní zmizí (při spuštění a po návratu do aplikace, na kterémkoli zařízení) */
function purgeTrash(){
  const old=trashItems().filter(t=>Date.now()-(t.at||0)>KEEP).map(t=>t.id);
  if(!old.length) return 0;
  old.forEach(id=>{ delete S.trash[id]; });
  if(!Object.keys(S.trash).length) S.trashMode=false;
  Store.queue(); return old.length;
}

/* levý panel v koši */
function trashSidebar(){
  const list=trashItems();
  const row=t=>{ const p=t.pages[0], n=t.pages.length-1, on=S.view.kind==='trash'&&S.view.id===t.id;
    return `<div class="ti tr-it ${on?'on':''}" style="--d:0">
      <button class="ti-main" data-act="trash-open" data-id="${esc(t.id)}" title="${n?`+ ${n} ${plural(n,'podstránka','podstránky','podstránek')}`:''}">${pIcon(p)}<span class="ti-t">${esc(pTitle(p))}</span><span class="tr-left" title="Smaže se za ${leftLong(t)}">${leftTxt(t)}</span></button>
      <span class="tr-acts"><button class="icon-btn" data-act="trash-restore" data-id="${esc(t.id)}" title="Obnovit" aria-label="Obnovit">↺</button><button class="icon-btn tr-del" data-act="trash-del" data-id="${esc(t.id)}" title="Smazat trvale" aria-label="Smazat trvale">×</button></span>
    </div>`; };
  return `<div class="sec-h"><span>${TRASH_IC}Koš</span>${list.length?`<button class="linkbtn tr-empty" data-act="trash-empty" data-popanchor>Vysypat</button>`:''}</div>
    <div class="tree trash-tree">${list.length?list.map(row).join(''):`<div class="tree-empty">Koš je prázdný.<br>Smazané stránky tu zůstanou 7 dní.</div>`}</div>`;
}
const TRASH_IC='<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6 7l1 12.2a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7"/><path d="M10 11v6M14 11v6"/></svg>';

/* náhled stránky v koši: jen ke čtení, s tlačítkem Obnovit */
function renderTrashView(id){
  const t=S.trash[id]; if(!t) return false;
  const pg=t.pages[0], n=t.pages.length-1;
  const blocks=renderBlocks(pg).replace(/contenteditable="true"/g,'contenteditable="false"');
  $('#view').innerHTML=`<article class="doc ro-doc ${pg.wide?'wide':''}">
    <div class="arch-note tr-note">V koši, smaže se za ${leftLong(t)}.${n?` Obsahuje ${n} ${plural(n,'podstránku','podstránky','podstránek')}.`:''} <button class="linkbtn" data-act="trash-restore" data-id="${esc(id)}">Obnovit</button></div>
    <div class="doc-head"><div class="title-row">${pg.icon?`<span class="page-icon">${esc(pg.icon)}</span>`:''}<h1 class="page-title">${esc(pTitle(pg))}</h1></div></div>
    <div class="blocks ro-blocks" inert>${blocks}</div>
  </article>`;
  return true;
}
function askEmpty(anchor){
  const n=trashItems().length; if(!n||LOCK) return;
  openPop(anchor,`<div class="pop-h">Vysypat koš?</div><p class="note" style="padding:0 10px 6px;max-width:240px">${n} ${plural(n,'položka se smaže','položky se smažou','položek se smaže')} natrvalo.</p><button class="pop-item danger" data-v="go"><span class="pi-ic">×</span>Vysypat koš</button>`,v=>{ if(v==='go') dropTrash(trashItems().map(t=>t.id)); });
}
function trashAct(act,a){
  const id=a.dataset.id;
  switch(act){
    case 'trash': S.trashMode=true; S.archMode=false; renderSidebar(); return true;
    case 'trash-back': S.trashMode=false; if(S.view.kind==='trash') go({kind:'today'}); else renderSidebar(); return true;
    case 'trash-open': if(S.trash[id]) go({kind:'trash',id}); return true;
    case 'trash-restore': restoreTrash(id); return true;
    case 'trash-del': if(!LOCK) dropTrash([id]); return true;
    case 'trash-empty': askEmpty(a); return true;
  }
  return false;
}

export { purgeTrash, renderTrashView, TRASH_IC, trashAct, trashPage, trashSidebar };
