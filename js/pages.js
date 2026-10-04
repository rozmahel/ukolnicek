/* Úkolníček – Stránky (projekty a podstránky): strom, vytvoření, smazání, skok na blok */
import { $, clone, COLORS, esc, lsSet, rid } from './core.js';
import { S } from './state.js';
import { savePage, Store } from './store.js';
import { renderSidebar } from './sidebar.js';
import { go, renderMain } from './router.js';
import { isHeading, rerenderBlocks, sectionEnd } from './editor/render.js';
import { toast } from './ui.js';

/* ================= pages helpers ================= */
const curPage=()=>S.view.kind==='page'?S.pages[S.view.pageId]:null;
const kids=pid=>Object.values(S.pages).filter(p=>(p.parent||null)===(pid||null)).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.title).localeCompare(b.title));
function descendants(id){ let out=[]; kids(id).forEach(k=>{ out.push(k.id); out=out.concat(descendants(k.id)); }); return out; }
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

function deletePage(id){
  const ids=[id,...descendants(id)]; const backup=ids.map(i=>clone(S.pages[i])); const title=pTitle(S.pages[id]);
  ids.forEach(i=>{ delete S.pages[i]; }); Store.queue();
  if(S.view.kind==='page'&&ids.includes(S.view.pageId)) go({kind:'today'}); else { renderSidebar(); renderMain(); }
  toast(`Stránka „${title}“ smazána${ids.length>1?` i s ${ids.length-1} podstránkami`:''}`,'Vrátit',()=>{
    backup.forEach(p=>{ S.pages[p.id]=p; savePage(p,0); }); renderSidebar(); renderMain();
  });
}

/* otevře stránku, rozbalí sekce nad blokem (a u nadpisu i jeho sekci) a doskroluje k němu */
function revealBlock(pageId,blockId,openSelf){
  const pg=S.pages[pageId]; if(!pg) return toast('Stránka už neexistuje.');
  const bl=pg.blocks, idx=bl.findIndex(b=>b.id===blockId); if(idx<0) return toast('Blok už na stránce není.');
  go({kind:'page',pageId});
  let opened=false;
  for(let i=idx-1;i>=0;i--){ if(isHeading(bl[i].type)&&bl[i].collapsed&&sectionEnd(bl,i)>idx){ bl[i].collapsed=false; opened=true; } }
  if(openSelf&&bl[idx].collapsed){ bl[idx].collapsed=false; opened=true; }
  if(opened) savePage(pg);
  rerenderBlocks();
  setTimeout(()=>{ const el=$(`#blocks .blk[data-id="${blockId}"]`); if(el){ el.scrollIntoView({block:openSelf?'start':'center'}); el.classList.add('flash'); } },30);
}

export { createPage, curPage, deletePage, emptyCell, flatPages, kids, newBlock, newTable, pIcon, pTitle, revealBlock };
