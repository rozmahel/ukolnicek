/* Úkolníček – Šablony stránek a převody typů bloků */
import { $, esc, IC, norm, TEXT_TYPES } from '../core.js';
import { calloutDef, S } from '../state.js';
import { savePage } from '../store.js';
import { createPage, flatPages, newBlock, newTable, pIcon, pTitle } from '../pages.js';
import { subjAsH1, subjLabel } from '../school.js';
import { isBlank } from '../sanitize.js';
import { focusBlock, focusLine } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { go } from '../router.js';
import { isHeading, rerenderBlocks } from './render.js';
import { closePop, openPop } from '../ui.js';
import { codeNorm } from './code.js';
import { insertTpl, tplList } from '../templates.js';

/* ---- šablony (/šablona): seznam, data a vložení jsou v js/templates.js ---- */
/* b = blok, na jehož místě se šablona vloží (prázdný se nahradí, jinak pod něj) */
function applyTemplate(pg,id,b){ insertTpl(pg,id,b); }
function openTemplatePicker(anchor,cb){
  const l=tplList();
  openPop(anchor,`<div class="pop-h">Šablona</div>`+(l.length?l.map(t=>`<button class="pop-item" data-v="${esc(t.id)}"><span class="pi-ic">${IC.tpl}</span>${esc(t.name)}</button>`).join(''):'<div class="empty">Zatím žádné šablony.</div>'),cb);
}

/* ---- conversions ---- */
/* Číslovaný seznam vzniklý zkratkou „1. “: zapamatuje se, co uživatel napsal. Když ho vrátí na text (Backspace na začátku,
   nebo „Převést na → Text“), „1. “ zůstane v textu a zkratka se v tomhle bloku už číslovaný seznam znovu nevyrobí.
   Jen v paměti stránky, do dat se nic nezapisuje. */
const typedNum=new Map(), numOff=new Set();
const rememberTypedNum=(id,s)=>typedNum.set(id,s.replace(/[\s ]+$/,'')+' ');
const numShortcutOff=id=>numOff.has(id);
/* Zkratka právě použitá („- “, „# “, „> “, „```“…): Backspace hned potom ji vrátí na napsaný text.
   Platí jen do další klávesy, kliknutí nebo jiné úpravy (lastSc se maže v events.js). Jen v paměti. */
let lastSc=null;
const noteShortcut=(key,pre,type,extra)=>{ lastSc=Object.assign({key,pre:String(pre).replace(/ /g,' '),type},extra||{}); };
const clearShortcut=()=>{ lastSc=null; };
const takeShortcut=(key,type)=>{ const s=lastSc; lastSc=null; return s&&s.key===key&&s.type===type?s:null; };
/* vrací počet znaků „1. “ vrácených do textu (kam dát kurzor) */
function setType(pg,b,k,backToText){
  if(!TEXT_TYPES.includes(k)) return 0;
  let kept=0;
  if(backToText&&b.type==='num'&&k==='p'){
    numOff.add(b.id);
    const pre=typedNum.get(b.id); typedNum.delete(b.id);
    if(pre){ b.html=esc(pre)+(b.html||''); kept=pre.length; }
  }
  b.type=k; if(k!=='todo') delete b.done; if(!isHeading(k)) delete b.collapsed;
  if(k==='callout'){ const d=calloutDef(); if(!b.color) b.color=d.color; if(b.icon==null) b.icon=d.icon; }   /* výchozí z Nastavení → Formát */
  if(k==='code') b.html=codeNorm(b.html);   /* v kódu není žádné formátování, odkazy ani rovnice */
  return kept;
}
function insertTypeAt(pg,bi,k,replace,title){
  const b=pg.blocks[bi];
  if(k==='page'){
    const child=createPage(pg.id,title?{title}:null);
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
/* /podstránka: nabídne odkaz na už vytvořenou stránku (hledání podle názvu), první řádek založí novou podstránku
   (s napsaným textem jako názvem). onPick(id) = existující stránka, onPick(null, název) = nová. */
function openPagePicker(anchor,pg,onPick){
  const pages=flatPages().filter(x=>x.p.id!==pg.id);
  const p=openPop(anchor,`<input class="inp sp-q" placeholder="Hledat stránku nebo napsat název nové…" aria-label="Hledat stránku" autocomplete="off"><div class="sp-list" role="listbox"></div>`,v=>{ if(v==='*new') onPick(null,q.value.trim()); else if(S.pages[v]) onPick(v); });
  p.classList.add('subj-pick','page-pick');
  const q=$('.sp-q',p); let idx=0, items=[];
  const draw=()=>{
    const t=q.value.trim(), nq=norm(t); items=['*new'];
    let h=`<button class="pop-item sp-it ${idx===0?'act':''}" data-v="*new" role="option"><span class="pi-ic">${IC.plus}</span><span class="sp-t">Nová podstránka${t?` <b>${esc(t)}</b>`:''}</span></button>`;
    const l=pages.filter(x=>!nq||norm(pTitle(x.p)).includes(nq));
    if(l.length) h+='<div class="pop-h">Odkaz na stránku</div>'+l.map(({p:pp,depth})=>{ const i=items.push(pp.id)-1;
      return `<button class="pop-item sp-it ${i===idx?'act':''}" data-v="${pp.id}" role="option"${!nq&&depth?` style="padding-left:${8+depth*14}px"`:''}>${pIcon(pp)}<span class="sp-t">${esc(pTitle(pp))}</span></button>`; }).join('');
    $('.sp-list',p).innerHTML=h;
    const act=$('.sp-it.act',p); if(act) act.scrollIntoView({block:'nearest'});
  };
  q.addEventListener('input',()=>{ idx=0; draw(); });
  q.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); idx=(idx+(e.key==='ArrowDown'?1:-1)+items.length)%items.length; draw(); }
    else if(e.key==='Enter'){ e.preventDefault(); const v=items[idx]; closePop(); if(v==='*new') onPick(null,q.value.trim()); else onPick(v); }
  });
  draw(); setTimeout(()=>q.focus({preventScroll:true}),0);
  return p;
}
/* odkaz na existující stránku (stránka zůstává ve stromu, kde je) */
function insertPageLinkAt(pg,bi,id,replace){
  const nb=newBlock('page',{pageId:id});
  if(replace) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
  const ni=pg.blocks.indexOf(nb);
  let next=pg.blocks[ni+1];
  if(!next||next.type!=='p'||!isBlank(next.html)){ next=newBlock('p'); pg.blocks.splice(ni+1,0,next); }
  savePage(pg); rerenderBlocks(); focusBlock(next.id,0);
}
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

export { applyTemplate, clearShortcut, insertPageLinkAt, insertSubjAt, insertTypeAt, noteShortcut, numShortcutOff, openPagePicker, openTemplatePicker, rememberTypedNum, setType, subjToH1, takeShortcut, toSubject };
