/* Úkolníček – Stránky (projekty a podstránky): strom, vytvoření, smazání, skok na blok */
import { $, COLORS, esc, lsSet, rid } from './core.js';
import { S } from './state.js';
import { noteFold, savePage } from './store.js';
import { renderSidebar } from './sidebar.js';
import { go, renderMain } from './router.js';
import { isHeading, rerenderBlocks, sectionEnd } from './editor/render.js';
import { toast } from './ui.js';
import { trashPage } from './trash.js';

/* ================= pages helpers ================= */
const curPage=()=>S.view.kind==='page'?S.pages[S.view.pageId]:null;
const byOrder=(a,b)=>(a.order||0)-(b.order||0)||String(a.title).localeCompare(b.title);
/* podstránky v levém panelu: archivované stránky (s příznakem archived) se v běžném stromu nezobrazují */
const kidsAll=pid=>Object.values(S.pages).filter(p=>(p.parent||null)===(pid||null)).sort(byOrder);
const kids=pid=>kidsAll(pid).filter(p=>!p.archived);
function descendants(id){ let out=[]; kidsAll(id).forEach(k=>{ out.push(k.id); out=out.concat(descendants(k.id)); }); return out; }
/* stránka je v archivu, když má příznak ona nebo některá nadřazená stránka */
function isArchived(p){ for(let n=0;p&&n<50;n++){ if(p.archived) return true; p=S.pages[p.parent]; } return false; }
/* kořeny archivu: stránky s příznakem, nejnověji archivované nahoře */
const archRoots=()=>Object.values(S.pages).filter(p=>p.archived).sort((a,b)=>(b.archived||0)-(a.archived||0)||byOrder(a,b));
function archivePage(id){
  const pg=S.pages[id]; if(!pg||pg.archived) return;
  pg.archived=Date.now(); savePage(pg,0);
  const inView=S.view.kind==='page'&&(S.view.pageId===id||descendants(id).includes(S.view.pageId));
  if(inView&&!S.archMode) go({kind:'today'}); else { renderSidebar(); renderMain(); }
  toast(`„${pTitle(pg)}“ přesunuto do archivu`,'Vrátit',()=>{ delete pg.archived; savePage(pg,0); renderSidebar(); renderMain(); });
}
function unarchivePage(id){
  const pg=S.pages[id]; if(!pg) return;
  delete pg.archived;
  /* podstránka archivovaného projektu (nebo stránka bez rodiče) se vrací na nejvyšší úroveň */
  if(pg.parent&&(!S.pages[pg.parent]||isArchived(S.pages[pg.parent]))){ pg.parent=null; const sib=kids(null).filter(x=>x!==pg); pg.order=(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1; }
  savePage(pg,0);
  if(S.archMode&&!archRoots().length) S.archMode=false;
  renderSidebar(); renderMain();
  toast(`„${pTitle(pg)}“ obnoveno z archivu`);
}
function flatPages(pid=null,depth=0,out=[]){ kids(pid).forEach(p=>{ out.push({p,depth}); flatPages(p.id,depth+1,out); }); return out; }
const pTitle=p=>p?(p.title||'Bez názvu'):'Smazaná stránka';
const pIcon=p=>p&&p.icon?`<span class="ti-ic">${esc(p.icon)}</span>`:`<span class="ti-ic"><span class="ti-dot hl-${esc((p&&p.color)||'gray')}"></span></span>`;
function newBlock(type='p',extra){ return Object.assign({id:rid(),type,html:''},extra||{}); }
function emptyCell(){ return {lines:[{t:'p',html:''}]}; }
function newTable(r=3,c=3){ return newBlock('table',{rows:Array.from({length:r},()=>({cells:Array.from({length:c},()=>emptyCell())})),hrow:false,hcol:false}); }
function createPage(parent,opts){
  const sib=kids(parent||null);
  const pg=Object.assign({id:rid(),title:'',icon:'',color:COLORS[Object.keys(S.pages).length%COLORS.length],parent:parent||null,order:(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1,props:[],blocks:[newBlock('p')]},opts||{});
  S.pages[pg.id]=pg; savePage(pg,0);
  if(parent){ S.expanded[parent]=true; lsSet('uk-exp',S.expanded); }
  return pg;
}

/* smazání = přesun do koše i s podstránkami (trash.js) */
function deletePage(id){ if(S.pages[id]) trashPage(id,[id,...descendants(id)]); }

/* otevře stránku, rozbalí sekce nad blokem (a u nadpisu i jeho sekci) a doskroluje k němu */
function revealBlock(pageId,blockId,openSelf,quiet){   /* quiet: bez bliknutí bloku (hledání ho zvýrazní samo) */
  const pg=S.pages[pageId]; if(!pg) return toast('Stránka už neexistuje.');
  const bl=pg.blocks, idx=bl.findIndex(b=>b.id===blockId); if(idx<0) return toast('Blok už na stránce není.');
  go({kind:'page',pageId});
  let opened=false;
  for(let i=idx-1;i>=0;i--){ if(isHeading(bl[i].type)&&bl[i].collapsed&&sectionEnd(bl,i)>idx){ bl[i].collapsed=false; noteFold(bl[i]); opened=true; } }
  if(openSelf&&bl[idx].collapsed){ bl[idx].collapsed=false; noteFold(bl[idx]); opened=true; }
  if(opened) savePage(pg);
  rerenderBlocks();
  setTimeout(()=>{ const el=$(`#blocks .blk[data-id="${blockId}"]`); if(el){ el.scrollIntoView({block:openSelf?'start':'center'}); if(!quiet) el.classList.add('flash'); } },30);
}

export { archivePage, archRoots, createPage, curPage, deletePage, emptyCell, flatPages, isArchived, kids, kidsAll, newBlock, newTable, pIcon, pTitle, revealBlock, unarchivePage };
