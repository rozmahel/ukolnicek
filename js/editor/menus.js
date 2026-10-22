/* Úkolníček – Menu bloku, tabulky, ikony stránky a stránky v levém panelu */
import { $, $$, CALLOUT_IC, clamp, clone, COLOR_CZ, COLORS, EMOJI, esc, plain, rid, TEXT_TYPES, TYPE_ICON, TYPE_LABEL } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { archivePage, createPage, curPage, deletePage, emptyCell, isArchived, kids, unarchivePage } from '../pages.js';
import { gotoSubject, isIndex, openSubjPicker, subjBlockText, subjLabel } from '../school.js';
import { focusBlock } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { go } from '../router.js';
import { defaultEnd, hLevel, isHeading, renderPage, rerenderBlocks } from './render.js';
import { setType, subjToH1, toSubject } from './blocks.js';
import { closePop, openPop, placePop, toast } from '../ui.js';
import { selectImage } from './images.js';
import { editDrawing } from './draw.js';
import { blockToEq, openEqEditor } from './math.js';
import { bselCount, bulk, copyOne } from './multisel.js';

/* ================= menus ================= */
/* typy zvýrazněného bloku (jako rámečky na GitHubu: > [!NOTE] …) = předvolba ikony a barvy, v datech nic navíc */
const CALLOUT_KINDS=[['💡','blue','Poznámka'],['✅','green','Tip'],['❗','purple','Důležité'],['⚠️','orange','Varování'],['🔴','red','Pozor']];
const kindsHtml=b=>`<div class="pop-h">Typ</div><div class="swatches co-kinds">${CALLOUT_KINDS.map(([ic,c,t],i)=>`<button class="pop-item co-kind hl-${c} ${b.icon===ic&&b.color===c?'on':''}" data-v="kind:${i}"><span>${ic}</span>${t}</button>`).join('')}</div>`;
const EQ_ITEM=`<button class="pop-item" data-v="type:eq"><span class="pi-ic">${TYPE_ICON.eq}</span><span>${TYPE_LABEL.eq}<small>Text bloku jako LaTeX</small></span></button>`;
const applyKind=(b,v)=>{ const k=CALLOUT_KINDS[+v.slice(5)]; if(k){ b.icon=k[0]; b.color=k[1]; } };
function openBlockMenu(anchor,pg,b){
  let h='';
  if(LOCK){
    /* zamčeno: u zvýrazněného bloku jde jen změnit ikonu a barvu, nic se nepřesouvá ani nemaže */
    if(b.type!=='callout') return;
    h=kindsHtml(b)+`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>
      <div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
    openPop(anchor,h,v=>{ if(v.startsWith('kind:')) applyKind(b,v); else if(v.startsWith('color:')) b.color=v.slice(6); else if(v.startsWith('icon:')) b.icon=v.slice(5); savePage(pg); rerenderBlocks(); });
    return;
  }
  /* nahoře řada čtverečků (posun, kopírovat, duplikovat, smazat); s výběrem víc bloků platí menu pro všechny */
  const multi=bselCount(b.id), noLvl=b.type==='image'&&!multi;
  const ib=(v,ic,t,dis)=>`<button class="bm-ic${v==='del'?' danger':''}" data-v="${v}" title="${t}" aria-label="${t}"${dis?' disabled':''}>${ic}</button>`;
  h+=`<div class="bm-row">${ib('up','↑','Posunout nahoru (⌥⇧↑)')}${ib('down','↓','Posunout dolů (⌥⇧↓)')}`
    +(noLvl?'':ib('left','←','Posunout doleva (⌘ú)',!multi&&!((b.level||0)>0))+ib('right','→','Posunout doprava (⌘))',!multi&&(b.level||0)>=4))
    +`${ib('copy',BM_SVG.copy,'Kopírovat')}${ib('dup',BM_SVG.dup,'Duplikovat')}${ib('del',BM_SVG.del,'Smazat')}</div>`;
  if(multi){
    h+=`<div class="pop-h">Vybrané bloky: ${multi}</div><div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('')+EQ_ITEM;
    const p=openPop(anchor,h,v=>{
      if(v.startsWith('type:')) bulk.type(v.slice(5));
      else if(v==='up'||v==='down') bulk.move(v==='up'?-1:1);
      else if(v==='left'||v==='right') bulk.indent(v==='left'?-1:1);
      else if(v==='copy'||v==='dup'||v==='del') bulk[v]();
    });
    p.classList.add('bm-pop'); placePop(p,anchor.getBoundingClientRect());
    return;
  }
  if(TEXT_TYPES.includes(b.type)) h+=`<div class="pop-sep"></div><div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item ${b.type===k?'act':''}" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('')+EQ_ITEM
    +(b.type==='h1'&&isIndex()?`<button class="pop-item" data-v="tosubj"><span class="pi-ic">${TYPE_ICON.subj}</span><span>Předmět…<small>Nadpis nahradí předmět z Indexu</small></span></button>`:'');
  if(b.type==='subj'){
    const su=S.subjects[b.subj];
    h+=`<div class="pop-sep"></div><div class="pop-h">Předmět</div>${isIndex()?`${su?'<button class="pop-item" data-v="subj-ix"><span class="pi-ic">🎓</span>Otevřít v Indexu</button>':''}<button class="pop-item" data-v="subj-pick"><span class="pi-ic">⇄</span>${su?'Změnit předmět…':'Vybrat předmět…'}</button>`:''}<button class="pop-item" data-v="subj-h1"><span class="pi-ic">H1</span><span>Převést na nadpis H1<small>S názvem předmětu, bez vazby na Index</small></span></button>`;
  }
  if(b.type==='callout'){
    h+=`<div class="pop-sep"></div>`+kindsHtml(b)+`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>`;
    h+=`<div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
  }
  if(b.type==='eq') h+=`<div class="pop-sep"></div><button class="pop-item" data-v="eq-edit"><span class="pi-ic">${TYPE_ICON.eq}</span>Upravit rovnici</button><button class="pop-item" data-v="eq-txt"><span class="pi-ic">T</span><span>Převést na text<small>Zdroj LaTeX jako obyčejný odstavec</small></span></button>`;
  if(b.type==='image'&&b.draw) h+=`<div class="pop-sep"></div><button class="pop-item" data-v="draw-edit"><span class="pi-ic">✎</span>Upravit kresbu</button><button class="pop-item" data-v="draw-size"><span class="pi-ic">⤢</span>Velikost a zarovnání</button>`;
  if(b.type==='table') h+=`<div class="pop-sep"></div><div class="pop-h">Tabulka</div><button class="pop-item" data-v="hrow"><span class="pi-ic">${b.hrow?'✓':''}</span>První řádek jako záhlaví</button><button class="pop-item" data-v="hcol"><span class="pi-ic">${b.hcol?'✓':''}</span>První sloupec jako záhlaví</button>`;
  {
    const bl=pg.blocks, xi=bl.indexOf(b); let sec='';
    for(let i=xi-1;i>=0;i--){
      const hb=bl[i]; if(!hLevel(hb.type)) continue;
      const inDef=defaultEnd(bl,i)>xi, isEnd=hb.until===b.id;
      if(!inDef&&!isEnd) continue;
      const raw=hb.type==='subj'?subjBlockText(hb):plain(hb.html).trim();
      const nm=esc(raw.slice(0,34)||'Nadpis')+(raw.length>34?'…':'');
      if(b.type==='divider'){
        /* u oddělovače jde vybrat, jestli se schová taky, nebo zůstane vidět */
        const inc=isEnd&&!hb.untilVis, vis=isEnd&&!!hb.untilVis;
        sec+=`<button class="pop-item ${inc?'act':''}" data-v="${inc?'until-x':'until'}:${hb.id}"><span class="pi-ic">${inc?'✓':'⤓'}</span><span>Sbalovat „${nm}“ až sem, včetně oddělovače<small>${inc?'Klikni pro zrušení (zpět po další nadpis)':'Oddělovač se schová spolu se sekcí'}</small></span></button>`
            +`<button class="pop-item ${vis?'act':''}" data-v="${vis?'until-x':'untilv'}:${hb.id}"><span class="pi-ic">${vis?'✓':'⤒'}</span><span>Sbalovat „${nm}“ po oddělovač<small>${vis?'Klikni pro zrušení (zpět po další nadpis)':'Oddělovač zůstane vidět'}</small></span></button>`;
        continue;
      }
      sec+=isEnd?`<button class="pop-item act" data-v="until-x:${hb.id}"><span class="pi-ic">✓</span><span>„${nm}“ se sbaluje až sem<small>Klikni pro zrušení (zpět po další nadpis)</small></span></button>`
               :`<button class="pop-item" data-v="until:${hb.id}"><span class="pi-ic">⤓</span><span>Sbalovat „${nm}“ až sem<small>Tento blok se schová, další zůstanou vidět</small></span></button>`;
    }
    if(isHeading(b.type)&&b.until){ sec+=`<button class="pop-item" data-v="until-x:${b.id}"><span class="pi-ic">↺</span><span>Sbalovat automaticky<small>Až po další nadpis stejné úrovně</small></span></button>`; }
    if(sec) h+=`<div class="pop-sep"></div><div class="pop-h">Sbalování sekce</div>`+sec;
  }
  const pop=openPop(anchor,h,v=>{
    const bi=pg.blocks.indexOf(b); if(bi<0) return;
    if(v==='copy'){ copyOne(b); return; }
    if(v==='tosubj'||v==='subj-pick'){ openSubjPicker(anchor,su=>toSubject(pg,b,su),b.subj); return true; }
    if(v==='subj-ix'){ gotoSubject(b.subj); return; }
    if(v==='subj-h1'){ subjToH1(pg,b); return; }
    if(v==='eq-edit'){ const el=$(`#blocks .blk[data-id="${b.id}"] .eqb`); if(el) setTimeout(()=>openEqEditor(el),0); return; }
    if(v==='draw-edit'||v==='draw-size'){ const im=$(`#blocks .blk[data-id="${b.id}"] .bimg`); if(im) setTimeout(()=>v==='draw-edit'?editDrawing(im):selectImage(im,true),0); return; }
    if(v==='eq-txt'){ b.type='p'; savePage(pg); rerenderBlocks(); focusBlock(b.id,'end'); return; }
    if(v==='type:eq'){ blockToEq(pg,b); return; }
    if(v.startsWith('type:')){ setType(pg,b,v.slice(5),true); }
    else if(v.startsWith('kind:')) applyKind(b,v);
    else if(v.startsWith('color:')) b.color=v.slice(6);
    else if(v.startsWith('icon:')) b.icon=v.slice(5);
    else if(v.startsWith('until:')){ const hb=pg.blocks.find(q=>q.id===v.slice(6)); if(hb){ hb.until=b.id; delete hb.untilVis; } }
    else if(v.startsWith('untilv:')){ const hb=pg.blocks.find(q=>q.id===v.slice(7)); if(hb){ hb.until=b.id; hb.untilVis=true; } }
    else if(v.startsWith('until-x:')){ const hb=pg.blocks.find(q=>q.id===v.slice(8)); if(hb){ delete hb.until; delete hb.untilVis; } }
    else if(v==='hrow') b.hrow=!b.hrow;
    else if(v==='hcol') b.hcol=!b.hcol;
    else if(v==='up'&&bi>0){ pg.blocks.splice(bi,1); pg.blocks.splice(bi-1,0,b); }
    else if(v==='down'&&bi<pg.blocks.length-1){ pg.blocks.splice(bi,1); pg.blocks.splice(bi+1,0,b); }
    else if(v==='left'||v==='right'){ if(b.type==='image') return; b.level=clamp((b.level||0)+(v==='left'?-1:1),0,4); }
    else if(v==='dup'){ const c=clone(b); c.id=rid(); pg.blocks.splice(bi+1,0,c); }
    else if(v==='del'){
      pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks();
      toast('Blok smazán','Vrátit',()=>{ pg.blocks.splice(Math.min(bi,pg.blocks.length),0,b); savePage(pg); rerenderBlocks(); });
      return;
    }
    savePage(pg); rerenderBlocks();
    if(TEXT_TYPES.includes(b.type)) focusBlock(b.id,'end');
  });
  pop.classList.add('bm-pop'); placePop(pop,anchor.getBoundingClientRect());
}
const BM_SVG={
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.5H7.5a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2H15"/><rect x="9" y="3" width="6" height="3.5" rx="1"/></svg>',
  dup:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><path d="M14 11.5v5M11.5 14h5"/></svg>',
  del:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7M9.5 7V4.5h5V7"/></svg>'
};
/* klik na nadpis předmětu: do Indexu, jiný předmět; odemčeno i vlastní emoji a formát nadpisu.
   Se skrytým Indexem jen formát nadpisu (a zamčeno nic). */
function openSubjBlockMenu(anchor,pg,b){
  const su=S.subjects[b.subj], ix=isIndex();
  if(!su){ if(ix) openSubjPicker(anchor,x=>toSubject(pg,b,x)); return; }
  if(!ix&&LOCK) return;
  const fmtBtn=(k,lbl,title)=>`<button class="sj-fb ${b[k]?'on':''}" data-v="f:${k}" title="${title}" aria-pressed="${!!b[k]}">${lbl}</button>`;
  const h=`<div class="pop-h">${esc(subjLabel(su))}</div>${ix?'<button class="pop-item" data-v="ix"><span class="pi-ic">🎓</span>Otevřít v Indexu</button><button class="pop-item" data-v="pick"><span class="pi-ic">⇄</span>Změnit předmět…</button>':''}`
    +(LOCK?'':`${ix?'<div class="pop-sep"></div>':''}<div class="pop-h">Formát nadpisu</div>
      <div class="sj-fmt">${fmtBtn('it','<i>I</i>','Kurzíva')}${fmtBtn('un','<u>U</u>','Podtržení')}${fmtBtn('st','<s>S</s>','Přeškrtnutí')}</div>
      <div class="pop-h">Zvýraznění</div><div class="swatches"><button class="sw sw-none ${b.hl?'':'on'}" data-v="h:" aria-label="Bez zvýraznění" title="Bez zvýraznění">∅</button>${COLORS.map(c=>`<button class="sw hl-${c} ${b.hl===c?'on':''}" data-v="h:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>
      <div class="pop-h">Ikona před názvem</div><div class="emoji-grid">${EMOJI.map(e=>`<button data-v="e:${e}" aria-label="${e}" class="${b.icon===e?'on':''}">${e}</button>`).join('')}</div>
      <div class="emoji-in"><input class="inp" id="sj-emoji" placeholder="Vlastní emoji" maxlength="8" aria-label="Vlastní emoji"><button class="btn" data-v="custom">Použít</button></div>
      ${b.icon?'<button class="pop-item" data-v="e:"><span class="pi-ic">×</span>Bez ikony</button>':''}`);
  const p=openPop(anchor,h,(v,btn,pop)=>{
    if(v==='ix'){ gotoSubject(su.id); return; }
    if(v==='pick'){ openSubjPicker(anchor,x=>toSubject(pg,b,x),b.subj); return true; }
    if(v.startsWith('f:')){ const k=v.slice(2); if(b[k]) delete b[k]; else b[k]=true; btn.classList.toggle('on',!!b[k]); btn.setAttribute('aria-pressed',String(!!b[k])); savePage(pg); rerenderBlocks(); return true; }
    if(v.startsWith('h:')){ const c=v.slice(2); if(c) b.hl=c; else delete b.hl; $$('.swatches .sw',pop).forEach(x=>x.classList.toggle('on',x===btn)); savePage(pg); rerenderBlocks(); return true; }
    if(v==='custom'){ const val=$('#sj-emoji',pop).value.trim(); if(!val) return true; b.icon=val; }
    else if(v.startsWith('e:')){ const e=v.slice(2); if(e) b.icon=e; else delete b.icon; }
    savePage(pg); rerenderBlocks();
  });
  const inp=$('#sj-emoji',p); if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); const val=inp.value.trim(); if(!val) return; b.icon=val; closePop(); savePage(pg); rerenderBlocks(); } });
}
function openTableMenu(anchor,pg,b,kind,idx){
  const h=kind==='row'
    ?`<button class="pop-item" data-v="above"><span class="pi-ic">↑</span>Vložit řádek nad</button><button class="pop-item" data-v="below"><span class="pi-ic">↓</span>Vložit řádek pod</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat řádek</button>`
    :`<button class="pop-item" data-v="left"><span class="pi-ic">←</span>Vložit sloupec vlevo</button><button class="pop-item" data-v="right"><span class="pi-ic">→</span>Vložit sloupec vpravo</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat sloupec</button>`;
  openPop(anchor,h,v=>{
    const cols=b.rows[0].cells.length;
    if(kind==='row'){
      if(v==='del'){ if(b.rows.length<=1) return toast('Tabulka musí mít aspoň jeden řádek.'); b.rows.splice(idx,1); }
      else b.rows.splice(v==='above'?idx:idx+1,0,{cells:Array.from({length:cols},()=>emptyCell())});
    } else {
      if(v==='del'){ if(cols<=1) return toast('Tabulka musí mít aspoň jeden sloupec.'); b.rows.forEach(r=>r.cells.splice(idx,1)); }
      else b.rows.forEach(r=>r.cells.splice(v==='left'?idx:idx+1,0,emptyCell()));
    }
    savePage(pg); rerenderBlocks();
  });
}
function openIconPop(anchor,pg){
  const h=`<div class="pop-h">Ikona</div><div class="emoji-grid">${EMOJI.map(e=>`<button data-v="e:${e}" aria-label="${e}">${e}</button>`).join('')}</div>
    <div class="emoji-in"><input class="inp" id="emoji-custom" placeholder="Vlastní emoji" maxlength="8" aria-label="Vlastní emoji"><button class="btn" data-v="custom">Použít</button></div>
    <div class="pop-h">Barva stránky</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${pg.color===c?'on':''}" data-v="c:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>
    <div class="pop-sep"></div><button class="pop-item" data-v="none"><span class="pi-ic">∅</span>Odebrat ikonu</button>`;
  openPop(anchor,h,(v,btn,p)=>{
    if(v.startsWith('e:')) pg.icon=v.slice(2);
    else if(v.startsWith('c:')){ pg.color=v.slice(2); savePage(pg); renderSidebar(); $$('.sw',p).forEach(s=>s.classList.toggle('on',s.dataset.v===v)); return true; }
    else if(v==='custom'){ const val=$('#emoji-custom',p).value.trim(); if(!val) return true; pg.icon=val; }
    else if(v==='none') pg.icon='';
    savePage(pg); renderSidebar(); renderPage(pg);
  });
}
function openPageMenu(anchor,pg){
  /* stránka v archivu: jen obnovit nebo smazat */
  if(isArchived(pg)){
    const h=`<button class="pop-item" data-v="unarch"><span class="pi-ic">↺</span>Obnovit z archivu</button><div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
    openPop(anchor,h,v=>{ if(v==='unarch') unarchivePage(pg.id); if(v==='del') deletePage(pg.id); });
    return;
  }
  const h=`<button class="pop-item" data-v="sub"><span class="pi-ic">+</span>Přidat podstránku</button><button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">↓</span>Posunout dolů</button>${pg.parent?'<button class="pop-item" data-v="top"><span class="pi-ic">⇤</span>Přesunout na nejvyšší úroveň</button>':''}<button class="pop-item" data-v="dup"><span class="pi-ic">⧉</span>Duplikovat</button><button class="pop-item" data-v="arch"><span class="pi-ic">▤</span>Archivovat</button><div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
  openPop(anchor,h,v=>{
    if(v==='sub'){ const c=createPage(pg.id); renderSidebar(); go({kind:'page',pageId:c.id}); setTimeout(()=>$('#page-title')&&$('#page-title').focus(),30); return; }
    if(v==='up'||v==='down'){
      const sib=kids(pg.parent||null); sib.forEach((s,i)=>{ if(s.order!==i+1){ s.order=i+1; savePage(s,0);} });
      const i=sib.indexOf(pg), j=v==='up'?i-1:i+1; if(j<0||j>=sib.length) return;
      const o=sib[j].order; sib[j].order=pg.order; pg.order=o; savePage(sib[j],0); savePage(pg,0); renderSidebar(); return;
    }
    if(v==='top'){ pg.parent=null; const sib=kids(null); pg.order=(sib.length?Math.max(...sib.map(s=>s.order||0)):0)+1; savePage(pg,0); renderSidebar(); if(curPage()===pg) renderPage(pg); return; }
    if(v==='dup'){
      const c=clone(pg); c.id=rid(); c.title=(pg.title||'Bez názvu')+' (kopie)'; c.order=(pg.order||0)+.5;
      const ids=new Map(); c.blocks.forEach(b=>{ const n=rid(); ids.set(b.id,n); b.id=n; }); c.blocks.forEach(b=>{ if(b.until) b.until=ids.get(b.until)||undefined; if(!b.until){ delete b.until; delete b.untilVis; } }); S.pages[c.id]=c; savePage(c,0); renderSidebar(); go({kind:'page',pageId:c.id}); return;
    }
    if(v==='arch'){ archivePage(pg.id); return; }
    if(v==='del') deletePage(pg.id);
  });
}

export { openBlockMenu, openIconPop, openPageMenu, openSubjBlockMenu, openTableMenu };
