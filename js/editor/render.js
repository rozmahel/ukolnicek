/* Úkolníček – Vykreslení stránky a bloků (včetně tabulek a sbalování nadpisů) */
import { $, esc, PH, plain, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { applyLock } from '../lock.js';
import { IMGURL } from '../store.js';
import { hist, updateUndoBtns } from './history.js';
import { curPage, pIcon, pTitle } from '../pages.js';
import { isSchool, subjBlockText, subjLabel } from '../school.js';
import { imgSrc, isBlank, sanitize } from '../sanitize.js';
import { hideImgSel, imgSel } from './images.js';

/* ================= page editor ================= */
/* blok předmětu (/předmět) se chová jako nadpis H1: sbaluje se a ukončí ho další H1 nebo předmět */
function isHeading(t){ return t==='h1'||t==='h2'||t==='h3'||t==='subj'; }
function hLevel(t){ return t==='subj'?1:isHeading(t)?+t[1]:0; }
function numLabel(blocks,i){
  const lv=blocks[i].level||0; let n=1;
  for(let j=i-1;j>=0;j--){ const b=blocks[j], l=b.level||0; if(l>lv) continue; if(l<lv) break; if(b.type==='num') n++; else break; }
  return lv%2?('abcdefghijklmnopqrstuvwxyz'[(n-1)%26]+'.'):n+'.';
}
function renderPage(pg){
  const crumbs=[]; let p=S.pages[pg.parent];
  while(p){ crumbs.unshift(p); p=S.pages[p.parent]; }
  const isEmpty=(pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html)&&!(pg.props||[]).length&&(!pg.blocks[0]||TEXT_TYPES.includes(pg.blocks[0].type));
  $('#view').innerHTML=`
  <article class="doc ${pg.wide?'wide':''}" id="doc" data-page="${pg.id}">
    <div class="pagebar">
      <div class="crumbs">${crumbs.map(c=>`<button data-act="open" data-id="${c.id}">${esc(c.icon||'')} ${esc(pTitle(c))}</button><span>/</span>`).join('')}<span>${esc(pg.icon||'')} ${esc(pTitle(pg))}</span></div>
      <div class="pb-acts">${pg.icon?'':`<button class="ghost-btn" data-act="icon" data-popanchor>☺ Ikona</button>`}<button class="ghost-btn" data-act="prop-add">＋ Vlastnost</button><button class="ghost-btn" data-act="wide">${pg.wide?'↤ Užší':'↔ Celá šířka'}</button>
        <span class="pb-sep"></span>
        <button class="icon-btn" id="undo-btn" data-act="undo" title="Zpět (⌘Z)" aria-label="Zpět"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>
        <button class="icon-btn" id="redo-btn" data-act="redo" title="Znovu (⇧⌘Z)" aria-label="Znovu"><svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>
        <button class="icon-btn lock-btn" id="lock-btn" data-act="lock"></button>
      </div>
    </div>
    <div class="doc-head">
      <div class="title-row">${pg.icon?`<button class="page-icon" data-act="icon" data-popanchor aria-label="Změnit ikonu">${esc(pg.icon)}</button>`:''}<h1 class="page-title" id="page-title" contenteditable="true" spellcheck="false" data-ph="Bez názvu">${esc(pg.title)}</h1></div>
      <div class="props" id="props">${renderProps(pg)}</div>
    </div>
    ${isEmpty?`<div class="tpl"><span>Začít šablonou:</span><button data-act="tpl" data-v="subject">Předmět</button><button data-act="tpl" data-v="weeks">Přehled týdnů</button><button data-act="tpl" data-v="info">Obecné informace</button></div>`:''}
    <div class="blocks" id="blocks">${renderBlocks(pg)}</div>
    <div class="doc-tail" data-act="tail"></div>
  </article>`;
  hist(pg); updateUndoBtns(); applyLock();
}
function renderProps(pg){
  const props=pg.props||[];
  if(!props.length) return '';
  return props.map((pr,i)=>`<div class="prop" data-i="${i}"><div class="pk" contenteditable="true" data-ph="Vlastnost" spellcheck="false">${esc(pr.k)}</div><div class="pv" contenteditable="true" data-ph="Prázdné">${esc(pr.v)}</div><button class="icon-btn" data-act="prop-del" data-i="${i}" aria-label="Odebrat vlastnost">×</button></div>`).join('')+`<div><button class="add-prop" data-act="prop-add">＋ Přidat vlastnost</button></div>`;
}
function defaultEnd(bl,i){ const hl=hLevel(bl[i].type); for(let j=i+1;j<bl.length;j++){ const l=hLevel(bl[j].type); if(l&&l<=hl) return j; } return bl.length; }
function sectionEnd(bl,i){
  const b=bl[i]; let end=defaultEnd(bl,i);
  /* „sbalovat až sem“: blok b.until se schová taky, s untilVis zůstane vidět (jen u oddělovače) */
  if(b.until){ const k=bl.findIndex(x=>x.id===b.until); if(k>i) end=b.untilVis?k:k+1; }
  return end;
}
function renderBlocks(pg){
  const bl=pg.blocks||[]; const hidden=new Array(bl.length).fill(false); const counts={};
  for(let i=0;i<bl.length;i++){
    if(hidden[i]||!hLevel(bl[i].type)||!bl[i].collapsed) continue;
    const e=sectionEnd(bl,i); let n=0; for(let j=i+1;j<e;j++){ if(!hidden[j]){ hidden[j]=true; n++; } } counts[bl[i].id]=n;
  }
  let out='';
  bl.forEach((b,i)=>{
    if(hidden[i]) return;
    out+=renderBlock(b,i,bl);
    const n=counts[b.id]; if(n&&S.settings.showHidden!==false) out+=`<div class="hidden-count">${n} ${n===1?'skrytý blok':n<5?'skryté bloky':'skrytých bloků'}</div>`;
  });
  return out;
}
function renderBlock(b,i,bl){
  const lv=b.level||0; let inner;
  if(b.type==='divider') inner='<div class="divider"><hr></div>';
  else if(b.type==='table') inner=renderTable(b);
  else if(b.type==='image') inner=`<figure class="imgfig"><img class="bimg ${IMGURL.has(b.img)?'':'missing'}" src="${esc(imgSrc(b.img,b.name))}" alt="${esc(b.caption||'')}" draggable="false">${(b.caption||b.capOn)?`<figcaption class="cap" contenteditable="true" data-ph="Popisek obrázku">${esc(b.caption||'')}</figcaption>`:''}</figure>`;
  else if(b.type==='subj') inner=renderSubjHead(b);
  else if(b.type==='page'){ const p=S.pages[b.pageId]; inner=`<button class="pagelink" data-act="open" data-id="${esc(b.pageId)}">${p?pIcon(p):'<span class="pl-ic">↗</span>'}<span class="pl-t">${esc(pTitle(p))}</span></button>`; }
  else{
    let mk='';
    if(b.type==='bullet') mk=`<span class="mk bullet" aria-hidden="true">${['•','◦','▪'][lv%3]}</span>`;
    else if(b.type==='num') mk=`<span class="mk num">${numLabel(bl,i)}</span>`;
    else if(b.type==='todo') mk=`<button class="mk check ${b.done?'on':''}" data-act="check" role="checkbox" aria-checked="${!!b.done}" aria-label="Hotovo"></button>`;
    else if(isHeading(b.type)) mk=`<button class="mk caret ${b.collapsed?'closed':''}" data-act="collapse" aria-label="${b.collapsed?'Rozbalit sekci':'Sbalit sekci'}"></button>`;
    else if(b.type==='callout') mk=`<button class="mk callout-ic" data-act="blk-menu" data-popanchor aria-label="Změnit ikonu a barvu">${esc(b.icon||'💡')}</button>`;
    inner=`<div class="row">${mk}<div class="txt t-${b.type} ${b.type==='todo'&&b.done?'done':''}" contenteditable="true" data-ph="${PH[b.type]||''}">${sanitize(b.html)}</div></div>`;
  }
  const extra=b.type==='image'?` al-${b.align||'center'}`:b.type==='subj'?` hl-${esc((S.subjects[b.subj]||{}).color||'gray')}`:'';
  return `<div class="blk b-${b.type} ${b.type==='callout'?'hl-'+(b.color||'purple'):''}${extra}" data-id="${b.id}" style="--lv:${b.type==='image'?0:lv}${b.type==='image'?`;--w:${+b.w||480}px`:''}">
    <div class="gut"><button class="g-add" data-act="add-after" aria-label="Přidat blok pod">+</button><button class="g-drag" data-act="blk-menu" data-popanchor draggable="true" aria-label="Přetáhni, nebo klikni pro menu">⋮⋮</button></div>${inner}</div>`;
}
/* nadpis s předmětem z Indexu: text se nepíše ručně, bere se živě z Indexu */
function renderSubjHead(b){
  const su=S.subjects[b.subj], caret=`<button class="mk caret ${b.collapsed?'closed':''}" data-act="collapse" aria-label="${b.collapsed?'Rozbalit sekci':'Sbalit sekci'}"></button>`;
  if(!isSchool()) return `<div class="row">${caret}<div class="t-h1 sj-plain">${esc(subjBlockText(b))}</div></div>`;   /* klasické poznámky: obyčejný nadpis */
  if(!su) return `<div class="row">${caret}<button class="sj-h sj-lost" data-act="subj-blk" data-popanchor title="Vybrat jiný předmět"><span class="sj-t">Smazaný předmět</span>${plain(b.html).trim()?`<small>${esc(plain(b.html).trim())}</small>`:''}</button></div>`;
  /* vlastní emoji místo tečky a formát celého nadpisu (kurzíva, podtržení, přeškrtnutí, zvýraznění) */
  let t=`${su.code?`<b>${esc(su.code)}</b>`:''}${su.code&&su.name?' ':''}${esc(su.name||'')}`;
  if(b.it) t=`<i>${t}</i>`; if(b.un) t=`<u>${t}</u>`; if(b.st) t=`<s>${t}</s>`; if(b.hl) t=`<mark class="hl-${esc(b.hl)}">${t}</mark>`;
  return `<div class="row">${caret}<button class="sj-h" data-act="subj-blk" data-popanchor title="${esc(subjLabel(su))} · předmět z Indexu">${b.icon?`<span class="sj-ic" aria-hidden="true">${esc(b.icon)}</span>`:'<span class="sj-dot" aria-hidden="true"></span>'}<span class="sj-t">${t}</span></button></div>`;
}
function renderTable(b){
  let h=`<div class="tbl-wrap"><table class="tbl ${b.hrow?'hrow':''} ${b.hcol?'hcol':''}"><tbody>`;
  b.rows.forEach((row,r)=>{
    h+='<tr>';
    row.cells.forEach((cell,c)=>{
      h+=`<td data-r="${r}" data-c="${c}">${c===0?`<button class="rh" data-act="row-menu" data-popanchor aria-label="Možnosti řádku">⋮</button>`:''}${r===0?`<button class="ch" data-act="col-menu" data-popanchor aria-label="Možnosti sloupce">⋯</button>`:''}${cell.lines.map((ln,l)=>{
        const mk=ln.t==='bullet'?'<span class="mk bullet" aria-hidden="true">•</span>':ln.t==='todo'?`<button class="mk check ${ln.done?'on':''}" data-act="lcheck" role="checkbox" aria-checked="${!!ln.done}" aria-label="Hotovo"></button>`:'';
        return `<div class="ln l-${ln.t} ${ln.t==='todo'&&ln.done?'done':''}" data-l="${l}">${mk}<div class="txt cell-txt" contenteditable="true">${sanitize(ln.html)}</div></div>`;
      }).join('')}</td>`;
    });
    h+='</tr>';
  });
  return h+`</tbody></table></div><div class="tbl-tools"><button data-act="add-row">＋ Řádek</button><button data-act="add-col">＋ Sloupec</button></div>`;
}
function rerenderBlocks(){ const pg=curPage(); if(!pg) return; if(imgSel) hideImgSel(); const el=$('#blocks'); if(el) el.innerHTML=renderBlocks(pg); const tpl=$('.tpl'); if(tpl&&!((pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html))) tpl.remove(); }
function rerenderProps(){ const pg=curPage(); if(pg) $('#props').innerHTML=renderProps(pg); }

function ctxOf(el){
  const pg=curPage(); if(!pg) return null;
  const blkEl=el.closest('.blk'); if(!blkEl) return null;
  const bi=pg.blocks.findIndex(b=>b.id===blkEl.dataset.id); if(bi<0) return null;
  const b=pg.blocks[bi]; const td=el.closest('td');
  if(td&&b.type==='table'){
    const r=+td.dataset.r,c=+td.dataset.c,cell=b.rows[r].cells[c];
    const lnEl=el.closest('.ln'); const l=lnEl?+lnEl.dataset.l:0;
    return {pg,b,bi,blkEl,r,c,cell,l,line:cell.lines[l],td};
  }
  return {pg,b,bi,blkEl};
}

export { ctxOf, defaultEnd, hLevel, isHeading, renderPage, rerenderBlocks, rerenderProps, sectionEnd };
