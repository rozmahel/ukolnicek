/* Úkolníček – Rozdělená obrazovka (4.17.0): dvě stránky vedle sebe. Stav jen v zařízení (uk-split), do dat se nic nezapisuje.
   Horní lišta (.pagebar) je při rozdělení jen jedna: #split-bar nad oběma polovinami, patří aktivní stránce (spBar ji přesune z #doc),
   náhled lištu nemá, takže obě poloviny mají stejné rozložení a po kliknutí se nic neposune.
   Aktivní polovina je vždy živý editor #main (všechny zkratky, zámek, AI panel a Zpět/Znovu fungují beze změny).
   Druhá polovina .split-ghost je náhled stejné šablony (pageHtml) bez id a bez úprav. Klik do ní = go() na její stránku:
   spSync() pak prohodí aktivní stranu (#main se přesune přes CSS order) a předchozí stránku vykreslí jako náhled.
   V rozdělení jsou jen stránky; jiný pohled (Dnes, Úkoly…) rozdělení zavře. */
import { $, clamp, lsGet, lsSet } from './core.js';
import { S } from './state.js';
import { go, noteScroll, renderMain, scrollOf } from './router.js';
import { blockList, onBlocksRendered, pageHtml } from './editor/render.js';
import { toast } from './ui.js';
import { mathPass } from './editor/math.js';

const SP_WIDE=matchMedia('(min-width:861px)');
const SP_MIN=320, SP_HW=7;   /* nejmenší šířka poloviny a šířka táhla (px) */
const SP_X='<span class="pb-sep split-sep"></span><button class="icon-btn split-x" title="Zavřít aktivní polovinu" aria-label="Zavřít aktivní polovinu">×</button>';
let SP=lsGet('uk-split',null); if(!SP||typeof SP!=='object') SP={on:false};
let spGhost=null, spHandle=null, spBarEl=null, spHtml='', spGid=null, spT=null;
const spOth=s=>s==='L'?'R':'L';
const spSave=()=>lsSet('uk-split',SP);
const spRatio=()=>{ const r=+SP.r; return r>=.05&&r<=.95?r:.5; };
function spOn(){ return !!SP.on; }

/* naposledy otevřená stránka v projektu (kořenové stránce), jen v zařízení */
function spRoot(id){ let p=S.pages[id]; while(p&&p.parent&&S.pages[p.parent]) p=S.pages[p.parent]; return p?p.id:null; }
function spNoteLast(id){ const r=spRoot(id); if(!r) return; const m=lsGet('uk-proj-last',{})||{}; if(m[r]===id) return; m[r]=id; lsSet('uk-proj-last',m); }
function spLastIn(rootId){ const id=(lsGet('uk-proj-last',{})||{})[rootId]; const p=S.pages[id]; return p&&!p.archived&&spRoot(id)===rootId?id:rootId; }

/* Otevřít vpravo / vlevo z menu ⋯ (projekt = jeho naposledy otevřená stránka) */
function spOpen(side,pg){
  if(!SP_WIDE.matches) return;
  const id=pg.parent?pg.id:spLastIn(pg.id), cur=S.view.kind==='page'?S.view.pageId:null;
  if(!SP.on){
    if(!cur){ go({kind:'page',pageId:id}); return; }   /* vedle Dnes, Úkolů… se nerozděluje: stránka se otevře normálně */
    if(cur===id){ toast('Tahle stránka už je otevřená.'); return; }
    SP={on:true,r:SP.r,act:side,[side]:id,[spOth(side)]:cur}; spSave();
  } else if(id!==SP.L&&id!==SP.R&&SP.act!==side){ SP[side]=id; spSave(); }   /* nahradí náhled; spSync pak přepne aktivní stranu */
  go({kind:'page',pageId:id});
}
/* po každém vykreslení pohledu (renderMain) */
function spSync(){
  const v=S.view;
  if(v.kind==='page') spNoteLast(v.pageId);
  if(SP.on&&v.kind!=='page'){ SP.on=false; spSave(); }
  if(SP.on){
    const id=v.pageId;
    if(id!==SP[SP.act]){
      if(id===SP[spOth(SP.act)]) SP.act=spOth(SP.act);   /* stejná stránka v obou nejde: přepne na polovinu, kde už je */
      else SP[SP.act]=id;
      spSave();
    }
    if(!S.pages[SP[spOth(SP.act)]]){ SP.on=false; spSave(); }   /* druhá stránka mezitím smazaná */
  }
  spLayout(); spRender(); spBar();
}
function spLayout(){
  const panes=$('#panes'), main=$('#main'); if(!panes||!main) return;
  panes.classList.toggle('split',!!SP.on);
  if(!SP.on){
    if(spGhost){ spGhost.remove(); spHandle.remove(); spGhost=spHandle=null; spHtml=''; spGid=null; }
    main.classList.remove('sp-l','sp-r');
    if(spBarEl){   /* lišta zpátky do stránky */
      const pb=spBarEl.querySelector('.pagebar'), doc=$('#doc');
      if(pb&&doc&&pb.dataset.page===doc.dataset.page){ pb.querySelectorAll('.split-x,.split-sep').forEach(e=>e.remove()); doc.prepend(pb); }
      spBarEl.remove(); spBarEl=null;
    }
    return;
  }
  if(!spGhost) spMake();
  panes.style.setProperty('--sr',spRatio());
  main.classList.toggle('sp-l',SP.act==='L'); main.classList.toggle('sp-r',SP.act==='R');
  spGhost.classList.toggle('sp-l',SP.act==='R'); spGhost.classList.toggle('sp-r',SP.act==='L');
}
/* jedna horní lišta nad oběma polovinami: lišta živé stránky se po každém vykreslení přesune do #split-bar */
function spBar(){
  if(!SP.on||!spBarEl) return;
  if(!SP_WIDE.matches){ spBarEl.replaceChildren(); return; }   /* úzké okno: lišta zůstane ve stránce */
  const doc=$('#doc'), pb=doc&&doc.querySelector(':scope > .pagebar');
  if(pb){ pb.dataset.page=doc.dataset.page; pb.querySelector('.pb-acts').insertAdjacentHTML('beforeend',SP_X); spBarEl.replaceChildren(pb); }
}
/* náhled druhé stránky; znovu jen když se jeho HTML změnilo (přejmenování, odkazy @, zpětné odkazy, data z jiného okna…) */
function spRender(){
  if(!SP.on||!spGhost) return;
  const id=SP[spOth(SP.act)], pg=S.pages[id]; if(!pg) return;
  const h=pageHtml(pg,null,blockList(pg));
  if(h===spHtml&&id===spGid) return;
  const top=id===spGid?spGhost.scrollTop:scrollOf(id), v=spGhost.firstElementChild;
  spHtml=h; spGid=id; v.innerHTML=h;
  v.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
  v.querySelectorAll('[contenteditable]').forEach(e=>e.setAttribute('contenteditable','false'));
  v.querySelectorAll('[draggable]').forEach(e=>e.removeAttribute('draggable'));
  v.querySelectorAll('button,a,[tabindex]').forEach(e=>e.setAttribute('tabindex','-1'));
  const pb=v.querySelector('.pagebar'); if(pb) pb.remove();   /* lišta je jen jedna, nad oběma polovinami */
  mathPass(v);
  spGhost.scrollTop=top;
}
function spMake(){
  const panes=$('#panes');
  spHandle=document.createElement('div'); spHandle.className='split-h'; spHandle.setAttribute('role','separator'); spHandle.setAttribute('aria-orientation','vertical');
  spHandle.title='Táhni pro změnu poměru, dvojklik = 50 : 50';
  spGhost=document.createElement('section'); spGhost.className='split-ghost'; spGhost.setAttribute('aria-label','Druhá polovina, klikni pro úpravy');
  spGhost.innerHTML='<div class="sg-view"></div>';
  spBarEl=document.createElement('div'); spBarEl.id='split-bar';
  panes.append(spHandle,spGhost,spBarEl);   /* lišta v DOM až za #main: $('#undo-btn') apod. najdou při vykreslení nejdřív novou lištu */   /* v DOM za #main: dotazy na třídy najdou nejdřív živou stránku */
  spGhost.addEventListener('scroll',()=>{ if(spGid) noteScroll(spGid,spGhost.scrollTop); },{passive:true});
  spHandle.addEventListener('pointerdown',spDrag);
  spHandle.addEventListener('dblclick',()=>{ SP.r=.5; spSave(); spLayout(); });
}
/* táhlo: poměr levé poloviny, každá aspoň SP_MIN px */
function spDrag(e){
  if(e.button!==0) return;
  e.preventDefault(); spHandle.setPointerCapture(e.pointerId); document.body.classList.add('split-drag');
  const panes=$('#panes'), rc=panes.getBoundingClientRect(), w=rc.width-SP_HW;
  const mv=ev=>{ if(w<2*SP_MIN) return; const l=clamp(ev.clientX-rc.left-SP_HW/2,SP_MIN,w-SP_MIN); SP.r=+(l/w).toFixed(4); panes.style.setProperty('--sr',SP.r); };
  const up=()=>{ spHandle.removeEventListener('pointermove',mv); spHandle.removeEventListener('pointerup',up); spHandle.removeEventListener('pointercancel',up); document.body.classList.remove('split-drag'); spSave(); };
  spHandle.addEventListener('pointermove',mv); spHandle.addEventListener('pointerup',up); spHandle.addEventListener('pointercancel',up);
}
/* klik do náhledu = aktivní polovina; kurzor se dá tam, kam se kliklo */
function spActivate(x,y){
  const id=SP[spOth(SP.act)]; noteScroll(id,spGhost.scrollTop,true);
  go({kind:'page',pageId:id});
  if(x==null||!document.caretRangeFromPoint) return;
  requestAnimationFrame(()=>{
    const r=document.caretRangeFromPoint(x,y); if(!r) return;
    const n=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement;
    const ed=n&&n.closest&&n.closest('#doc [contenteditable="true"]'); if(!ed) return;
    ed.focus({preventScroll:true}); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  });
}
/* × v aktivní polovině: druhá stránka se roztáhne přes celé okno */
function spCloseActive(){
  const id=SP[spOth(SP.act)]; if(spGhost) noteScroll(id,spGhost.scrollTop,true);
  SP.on=false; spSave(); go({kind:'page',pageId:id});
}
export function initSplit(){
  onBlocksRendered(spBar);
  document.addEventListener('uk-change',()=>{ if(!SP.on) return; clearTimeout(spT); spT=setTimeout(spRender,300); });
  document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('#split-bar .split-x')){ e.preventDefault(); spCloseActive(); } });
  /* náhled nejde upravovat: události z něj se zastaví dřív, než je uvidí zbytek aplikace (posluchače na document) */
  const inG=e=>spGhost&&e.target instanceof Node&&spGhost.contains(e.target);
  ['pointerdown','mousedown','mouseup','dblclick','contextmenu','dragstart','auxclick'].forEach(t=>window.addEventListener(t,e=>{
    if(!inG(e)) return; e.stopPropagation(); if(t!=='pointerdown') e.preventDefault();
  },true));
  window.addEventListener('click',e=>{
    if(!inG(e)) return; e.stopPropagation(); e.preventDefault();
    spActivate(e.clientX,e.clientY);
  },true);
  /* úzké okno: jen aktivní polovina (CSS); po rozšíření se náhled dokreslí */
  SP_WIDE.addEventListener('change',()=>{ if(SP.on&&S.view.kind==='page'){ spHtml=''; renderMain(); } });
}

export { spOpen, spSync };
