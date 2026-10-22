/* Úkolníček – Vykreslení stránky a bloků (včetně tabulek a sbalování nadpisů) */
import { $, esc, PH, plain, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { modeBtn } from '../theme.js';
import { applyLock } from '../lock.js';
import { IMGURL } from '../store.js';
import { hist, updateUndoBtns } from './history.js';
import { curPage, isArchived, pIcon, pTitle } from '../pages.js';
import { isSchool, subjBlockText, subjLabel } from '../school.js';
import { imgSrc, isBlank, sanitize } from '../sanitize.js';
import { applyRatio, hideImgSel, imgSel } from './images.js';
import { codeNorm } from './code.js';
import { backlinksHtml } from './mention.js';
import { fitSource, flushSource, sourceHtml } from './source.js';

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
  flushSource(true);
  const src=sourceHtml(pg), items=src!=null?[]:blockList(pg);
  const crumbs=[]; let p=S.pages[pg.parent];
  while(p){ crumbs.unshift(p); p=S.pages[p.parent]; }
  const isEmpty=(pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html)&&!(pg.props||[]).length&&(!pg.blocks[0]||TEXT_TYPES.includes(pg.blocks[0].type));
  $('#view').innerHTML=`
  <article class="doc ${pg.wide?'wide':''}" id="doc" data-page="${pg.id}" spellcheck="true">
    <div class="pagebar">
      <div class="crumbs ${crumbs.length?'':'solo'}">${crumbs.map(c=>`<button data-act="open" data-id="${c.id}">${esc(c.icon||'')} ${esc(pTitle(c))}</button><span>/</span>`).join('')}<span>${esc(pg.icon||'')} ${esc(pTitle(pg))}</span></div>
      <div class="pb-acts">${pg.icon?'':`<button class="ghost-btn" data-act="icon" data-popanchor>☺ Ikona</button>`}<button class="ghost-btn" data-act="wide">${pg.wide?'↤ Užší':'↔ Celá šířka'}</button>
        <span class="pb-sep"></span>
        <button class="icon-btn" id="undo-btn" data-act="undo" title="Zpět (⌘Z)" aria-label="Zpět"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg></button>
        <button class="icon-btn" id="redo-btn" data-act="redo" title="Znovu (⇧⌘Z)" aria-label="Znovu"><svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg></button>
        <button class="icon-btn" id="md-btn" data-act="mdexport" title="Stáhnout stránku jako Markdown (.md)" aria-label="Stáhnout jako Markdown"><svg viewBox="0 0 24 24"><path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16"/></svg></button>
        <button class="icon-btn src-btn${src!=null?' on':''}" id="src-btn" data-act="source" title="${src!=null?'Zpět na bloky':'Zobrazit zdroj (Markdown)'}" aria-label="Zobrazit zdroj v Markdownu" aria-pressed="${src!=null}"><svg viewBox="0 0 24 24"><path d="m8.5 7-5 5 5 5"/><path d="m15.5 7 5 5-5 5"/></svg></button>
        <button class="icon-btn lock-btn" id="lock-btn" data-act="lock"></button>${modeBtn()}
      </div>
    </div>
    ${isArchived(pg)?`<div class="arch-note">Stránka je v archivu. Nezobrazuje se v projektech, Úkolech ani Dnes. <button class="linkbtn" data-act="unarchive" data-id="${pg.id}">Obnovit z archivu</button></div>`:''}
    <div class="doc-head">
      <div class="title-row">${pg.icon?`<button class="page-icon" data-act="icon" data-popanchor aria-label="Změnit ikonu">${esc(pg.icon)}</button>`:''}<h1 class="page-title" id="page-title" contenteditable="true" spellcheck="false" data-ph="Bez názvu">${esc(pg.title)}</h1></div>
      <div class="props" id="props">${renderProps(pg)}</div>
    </div>
    ${isEmpty&&src==null?`<div class="tpl"><span>Začít šablonou:</span><button data-act="tpl" data-v="subject">Předmět</button><button data-act="tpl" data-v="weeks">Přehled týdnů</button><button data-act="tpl" data-v="info">Obecné informace</button></div>`:''}
    ${src!=null?src+'<div class="blocks" id="blocks" hidden></div>':`<div class="blocks" id="blocks">${items.map(x=>x.h).join('')}</div>`}
    ${backlinksHtml(pg)}
    <div class="doc-tail" data-act="tail"></div>
  </article>`;
  if(src==null) tagBlocks($('#blocks'),items);
  hist(pg); updateUndoBtns(); applyLock(); if(src!=null) fitSource();
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
/* nový blok vkládaný na místo `at` by se jinak přidal na konec sbalené sekce (sekce sahá po další nadpis) a nebyl by vidět:
   taková sekce se ukončí svým posledním blokem („sbalovat až sem“), prázdná sbalená sekce se rozbalí. Volat před vložením. */
function keepVisible(bl,at){
  for(let h=0;h<at;h++){
    const b=bl[h]; if(!isHeading(b.type)||!b.collapsed) continue;
    if(sectionEnd(bl,h)!==at||(b.until&&!b.untilVis)) continue;
    if(at>h+1){ b.until=bl[at-1].id; delete b.untilVis; } else delete b.collapsed;
  }
}
/* které bloky jsou schované ve sbalených sekcích (používají to i Úkoly a Dnes) */
function hiddenMask(bl,counts){
  const hidden=new Array(bl.length).fill(false);
  for(let i=0;i<bl.length;i++){
    if(hidden[i]||!hLevel(bl[i].type)||!bl[i].collapsed) continue;
    const e=sectionEnd(bl,i); let n=0; for(let j=i+1;j<e;j++){ if(!hidden[j]){ hidden[j]=true; n++; } } if(counts) counts[bl[i].id]=n;
  }
  return hidden;
}
/* bloky stránky jako seznam {k: klíč, h: HTML}; každá položka má jeden kořenový prvek */
function blockList(pg){
  const bl=pg.blocks||[]; const counts={}; const hidden=hiddenMask(bl,counts);
  const out=[];
  bl.forEach((b,i)=>{
    if(hidden[i]) return;
    out.push({k:b.id,h:renderBlock(b,i,bl)});
    const n=counts[b.id]; if(n&&S.settings.showHidden!==false) out.push({k:'hc:'+b.id,h:`<div class="hidden-count">${n} ${n===1?'skrytý blok':n<5?'skryté bloky':'skrytých bloků'}</div>`});
  });
  return out;
}
function renderBlocks(pg){ return blockList(pg).map(x=>x.h).join(''); }
/* uzlům v #blocks si zapamatuje, z jakého HTML vznikly (pro patchBlocks) */
function tagBlocks(el,items){
  const ch=el.children; items.forEach((it,i)=>{ const n=ch[i]; if(n) n._uk={k:it.k,h:it.h,c:n.getAttribute('class')||'',s:n.getAttribute('style')||''}; });
  applyRatio(el); dirtyMo.disconnect(); dirtyMo.observe(el,{childList:true,subtree:true,characterData:true});
}
/* blok, ve kterém se od vykreslení měnil obsah (psaní, vložení…), se příště vždy vykreslí znovu */
const dirtyMo=new MutationObserver(markDirty);
function markDirty(recs){ for(const r of recs){ const n=r.target.nodeType===1?r.target:r.target.parentElement; const b=n&&n.closest&&n.closest('#blocks > *'); if(b&&b._uk) b._uk.d=1; } }
/* překreslí jen změněné bloky: nezměněné uzly (hlavně obrázky) zůstanou, takže se nic znovu nenačítá a stránka neskáče */
function patchBlocks(el,items){
  markDirty(dirtyMo.takeRecords());
  const old=new Map(); for(const n of el.children) if(n._uk) old.set(n._uk.k,n);
  const tpl=document.createElement('template'), main=$('#main'), top=main?main.scrollTop:0;
  const nodes=items.map(it=>{
    const o=old.get(it.k);
    if(o&&o._uk.h===it.h&&!o._uk.d){ old.delete(it.k); if(o.getAttribute('class')!==o._uk.c) o.setAttribute('class',o._uk.c); if((o.getAttribute('style')||'')!==o._uk.s) o.setAttribute('style',o._uk.s); return o; }
    tpl.innerHTML=it.h; const n=tpl.content.firstElementChild;
    n._uk={k:it.k,h:it.h,c:n.getAttribute('class')||'',s:n.getAttribute('style')||''}; applyRatio(n); return n;
  });
  const keep=new Set(nodes);
  [...el.children].forEach(n=>{ if(!keep.has(n)) n.remove(); });
  let ref=el.firstElementChild;
  nodes.forEach(n=>{ if(n===ref) ref=ref.nextElementSibling; else el.insertBefore(n,ref); });
  dirtyMo.takeRecords();
  if(main&&main.scrollTop!==top) main.scrollTop=top;
}
function renderBlock(b,i,bl){
  const lv=b.level||0; let inner;
  if(b.type==='divider') inner='<div class="divider"><hr></div>';
  else if(b.type==='table') inner=renderTable(b);
  else if(b.type==='image') inner=`<figure class="imgfig"><img class="bimg${b.draw?' bdraw':''} ${IMGURL.has(b.img)?'':'missing'}" data-bimg="${esc(b.img||'')}" src="${esc(imgSrc(b.img,b.name))}" alt="${esc(b.caption||'')}" draggable="false"><button class="ta ta-up" data-act="img-line" data-dir="up" title="Nový řádek nad" aria-label="Nový řádek nad obrázkem">↵</button><button class="ta ta-dn" data-act="img-line" title="Nový řádek pod" aria-label="Nový řádek pod obrázkem">↵</button>${(b.caption||b.capOn)?`<figcaption class="cap" contenteditable="true" data-ph="Popisek obrázku">${esc(b.caption||'')}</figcaption>`:''}</figure>`;
  else if(b.type==='subj') inner=renderSubjHead(b);
  else if(b.type==='eq'){ const tex=plain(b.html); inner=`<div class="eqb" data-tex="${esc(tex)}" role="button" tabindex="0" aria-label="Rovnice, klikni pro úpravu">${esc(tex)}</div>`; }
  else if(b.type==='page'){ const p=S.pages[b.pageId]; inner=`<button class="pagelink" data-act="open" data-id="${esc(b.pageId)}">${p?pIcon(p):'<span class="pl-ic">↗</span>'}<span class="pl-t">${esc(pTitle(p))}</span></button>`; }
  else{
    let mk='';
    if(b.type==='bullet') mk=`<span class="mk bullet" aria-hidden="true">${['•','◦','▪'][lv%3]}</span>`;
    else if(b.type==='num') mk=`<span class="mk num">${numLabel(bl,i)}</span>`;
    else if(b.type==='todo') mk=`<button class="mk check ${b.done?'on':''}" data-act="check" role="checkbox" aria-checked="${!!b.done}" aria-label="Hotovo"></button>`;
    else if(isHeading(b.type)) mk=`<button class="mk caret ${b.collapsed?'closed':''}" data-act="collapse" aria-label="${b.collapsed?'Rozbalit sekci':'Sbalit sekci'}"></button>`;
    else if(b.type==='callout') mk=`<button class="mk callout-ic" data-act="blk-menu" data-popanchor aria-label="Změnit ikonu a barvu">${esc(b.icon||'💡')}</button>`;
    inner=`<div class="row">${mk}<div class="txt t-${b.type} ${b.type==='todo'&&b.done?'done':''}" contenteditable="true" data-ph="${PH[b.type]||''}">${b.type==='code'?codeNorm(b.html):sanitize(b.html)}</div></div>`;
  }
  const extra=b.type==='image'?` al-${b.align||'center'}${b.nw?' nw':''}${b.draw?' is-draw':''}`:b.type==='subj'?` hl-${esc((S.subjects[b.subj]||{}).color||'gray')}`:'';
  return `<div class="blk b-${b.type} ${b.type==='callout'?'hl-'+(b.color||'purple'):''}${extra}${b.clr?' clr':''}" data-id="${b.id}" style="--lv:${b.type==='image'?0:lv}${b.type==='image'?`;--w:${+b.w||480}px`:''}">
    <div class="gut"><button class="g-add" data-act="add-after" aria-label="Přidat blok pod">+</button><button class="g-drag" data-act="blk-menu" data-popanchor draggable="true" aria-label="Přetáhni, nebo klikni pro menu">⋮⋮</button></div>${inner}</div>`;
}
/* nadpis s předmětem z Indexu: text se nepíše ručně, bere se živě z Indexu */
function renderSubjHead(b){
  const su=S.subjects[b.subj], caret=`<button class="mk caret ${b.collapsed?'closed':''}" data-act="collapse" aria-label="${b.collapsed?'Rozbalit sekci':'Sbalit sekci'}"></button>`;
  if(!isSchool()) return `<div class="row">${caret}<div class="t-h1 sj-plain">${esc(subjBlockText(b))}</div></div>`;   /* klasické poznámky: obyčejný nadpis */
  if(!su) return `<div class="row">${caret}<button class="sj-h sj-lost" data-act="subj-blk" data-popanchor title="Vybrat jiný předmět"><span class="sj-t">Smazaný předmět</span>${plain(b.html).trim()?`<small>${esc(plain(b.html).trim())}</small>`:''}</button></div>`;
  /* volitelné emoji před názvem a formát celého nadpisu (kurzíva, podtržení, přeškrtnutí, zvýraznění) */
  let t=`${su.code?`<b>${esc(su.code)}</b>`:''}${su.code&&su.name?' ':''}${esc(su.name||'')}`;
  if(b.it) t=`<i>${t}</i>`; if(b.un) t=`<u>${t}</u>`; if(b.st) t=`<s>${t}</s>`; if(b.hl) t=`<mark class="hl-${esc(b.hl)}">${t}</mark>`;
  return `<div class="row">${caret}<button class="sj-h" data-act="subj-blk" data-popanchor title="${esc(subjLabel(su))} · předmět z Indexu">${b.icon?`<span class="sj-ic" aria-hidden="true">${esc(b.icon)}</span>`:''}<span class="sj-t">${t}</span></button></div>`;
}
/* šířky sloupců (b.cw, px) a výšky řádků (b.rh, px, null = podle obsahu) nastavené tažením okraje; bez nich se tabulka roztáhne sama */
const COL_DEF=150, COL_MIN=40;
const colW=v=>{ v=Math.round(+v); return Number.isFinite(v)&&v>0?Math.min(2000,Math.max(COL_MIN,v)):COL_DEF; };
function renderTable(b){
  const cols=(b.rows[0]&&b.rows[0].cells.length)||0, cw=Array.isArray(b.cw)?Array.from({length:cols},(_,c)=>colW(b.cw[c])):null, rh=Array.isArray(b.rh)?b.rh:[];
  let h=`<div class="tbl-wrap"><table class="tbl ${b.hrow?'hrow':''} ${b.hcol?'hcol':''}${cw?' fixw':''}"${cw?` style="width:${cw.reduce((a,v)=>a+v,0)}px"`:''}>${cw?`<colgroup>${cw.map(w=>`<col style="width:${w}px">`).join('')}</colgroup>`:''}<tbody>`;
  b.rows.forEach((row,r)=>{
    const rhv=Math.round(+rh[r]);
    h+=rhv>0?`<tr style="height:${Math.min(2000,rhv)}px">`:'<tr>';
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
function rerenderBlocks(){ const pg=curPage(); if(!pg) return; if(imgSel) hideImgSel(); const el=$('#blocks'); if(el) patchBlocks(el,blockList(pg)); const tpl=$('.tpl'); if(tpl&&!((pg.blocks||[]).length<=1&&isBlank((pg.blocks[0]||{}).html))) tpl.remove(); }
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

export { COL_DEF, COL_MIN, colW, ctxOf, defaultEnd, hiddenMask, hLevel, isHeading, keepVisible, renderBlocks, renderPage, rerenderBlocks, rerenderProps, sectionEnd };
