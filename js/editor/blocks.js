/* Úkolníček – Šablony stránek a převody typů bloků */
import { $, esc, TEXT_TYPES } from '../core.js';
import { savePage } from '../store.js';
import { createPage, newBlock, newTable } from '../pages.js';
import { subjAsH1, subjLabel } from '../school.js';
import { isBlank } from '../sanitize.js';
import { focusBlock, focusLine } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { go } from '../router.js';
import { isHeading, renderPage, rerenderBlocks } from './render.js';

/* ---- templates ---- */
function applyTemplate(pg,k){
  const tx=(type,html,extra)=>newBlock(type,Object.assign({html:html||''},extra||{}));
  if(k==='subject'){
    pg.icon=pg.icon||'📘';
    pg.props=[{k:'Garant',v:''},{k:'Kredity',v:''},{k:'Ukončení',v:''}];
    const t=newTable(4,3); t.hrow=true;
    ['Test','Termín','Body'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    pg.blocks=[tx('h2','Úkoly'),tx('todo',''),tx('h2','Body a testy'),t,tx('h2','Poznámky'),tx('p','')];
  } else if(k==='weeks'){
    pg.icon=pg.icon||'🗓️'; pg.wide=true;
    const t=newTable(4,6); t.hcol=true;
    ['','1. týden','2. týden','3. týden','4. týden','Zkouškový'].forEach((x,i)=>t.rows[0].cells[i].lines[0].html=x);
    t.hrow=true;
    [['purple','První měsíc'],['green','Druhý měsíc'],['blue','Třetí měsíc']].forEach(([c,x],i)=>t.rows[i+1].cells[0].lines[0].html=`<mark class="hl-${c}">${x}</mark>`);
    pg.blocks=[t,tx('p','')];
  } else {
    pg.icon=pg.icon||'📌';
    pg.blocks=[tx('h2','Kontakty'),tx('bullet',''),tx('h2','Důležité odkazy a pravidla'),tx('bullet',''),tx('h2','Termíny zkoušek'),tx('todo','')];
  }
  savePage(pg,0); renderSidebar(); renderPage(pg);
}

/* ---- conversions ---- */
function setType(pg,b,k){
  if(!TEXT_TYPES.includes(k)) return;
  b.type=k; if(k!=='todo') delete b.done; if(!isHeading(k)) delete b.collapsed;
  if(k==='callout'){ b.color=b.color||'purple'; b.icon=b.icon||'💡'; }
}
function insertTypeAt(pg,bi,k,replace){
  const b=pg.blocks[bi];
  if(k==='page'){
    const child=createPage(pg.id);
    const link=newBlock('page',{pageId:child.id});
    if(replace) pg.blocks.splice(bi,1,link); else pg.blocks.splice(bi+1,0,link);
    savePage(pg,0); renderSidebar();
    go({kind:'page',pageId:child.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30);
    return;
  }
  if(k==='divider'||k==='table'){
    const nb=k==='table'?newTable():newBlock('divider');
    if(replace) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
    const ni=pg.blocks.indexOf(nb);
    let next=pg.blocks[ni+1];
    if(!next||!TEXT_TYPES.includes(next.type)){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
    savePage(pg); rerenderBlocks();
    if(k==='table') focusLine(nb.id,0,0,0,0); else focusBlock(next.id,0);
    return;
  }
  if(replace){ setType(pg,b,k); savePage(pg); rerenderBlocks(); focusBlock(b.id,'end'); }
  else { const nb=newBlock('p',{level:b.level||0}); setType(pg,nb,k); pg.blocks.splice(bi+1,0,nb); savePage(pg); rerenderBlocks(); focusBlock(nb.id,0); }
}

/* blok předmětu (/předmět): nahradí prázdný řádek, nebo se vloží pod něj; pod ním je vždy řádek na psaní */
function insertSubjAt(pg,bi,su,replace){
  const nb=newBlock('subj',{subj:su.id,html:esc(subjLabel(su))});
  if(replace) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
  const ni=pg.blocks.indexOf(nb);
  let next=pg.blocks[ni+1];
  if(!next||next.type!=='p'||!isBlank(next.html)){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
  savePage(pg); rerenderBlocks(); focusBlock(next.id,0);
}
/* nadpis H1 → blok předmětu (sbalení zůstane) */
function toSubject(pg,b,su){ b.type='subj'; b.subj=su.id; b.html=esc(subjLabel(su)); delete b.done; savePage(pg); rerenderBlocks(); }
/* blok předmětu → obyčejný nadpis H1 s názvem předmětu */
function subjToH1(pg,b){ subjAsH1(b); savePage(pg); rerenderBlocks(); focusBlock(b.id,'end'); }

export { applyTemplate, insertSubjAt, insertTypeAt, setType, subjToH1, toSubject };
