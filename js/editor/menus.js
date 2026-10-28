/* Úkolníček – Menu bloku, tabulky, ikony stránky a stránky v levém panelu */
import { $, $$, CALLOUT_IC, clamp, clone, COLOR_CZ, COLORS, esc, IC, plain, rid, simpleUi, TEXT_TYPES, TYPE_ICON, TYPE_LABEL } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { archivePage, createPage, curPage, deletePage, emptyCell, isArchived, kids, unarchivePage } from '../pages.js';
import { gotoSubject, isIndex, openSubjPicker, subjBlockText, subjLabel } from '../school.js';
import { focusBlock, focusEl } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { go } from '../router.js';
import { COL_DEF, defaultEnd, hLevel, isHeading, renderPage, rerenderBlocks } from './render.js';
import { setType, subjToH1, toSubject } from './blocks.js';
import { closePop, openPop, placePop, toast } from '../ui.js';
import { imgMenuAct, imgMenuHtml, LAY, LAY_IC, lineAround, markImgMenu } from './images.js';
import { editDrawing } from './draw.js';
import { blockToEq, openEqEditor } from './math.js';
import { bselCount, bulk, copyOne } from './multisel.js';
import { spOpen } from '../split.js';

/* ================= menus ================= */
/* typy zvýrazněného bloku (jako rámečky na GitHubu: > [!NOTE] …) = předvolba ikony a barvy, v datech nic navíc */
const CALLOUT_KINDS=[['💡','blue','Poznámka'],['✅','green','Tip'],['❗','purple','Důležité'],['⚠️','orange','Varování'],['🔴','red','Pozor']];
const kindsHtml=b=>`<div class="pop-h">Typ</div><div class="swatches co-kinds">${CALLOUT_KINDS.map(([ic,c,t],i)=>`<button class="pop-item co-kind hl-${c} ${b.icon===ic&&b.color===c?'on':''}" data-v="kind:${i}"><span>${ic}</span>${t}</button>`).join('')}</div>`;
const EQ_ITEM=`<button class="pop-item" data-v="type:eq"><span class="pi-ic">${TYPE_ICON.eq}</span><span>${TYPE_LABEL.eq}<small>Text bloku jako LaTeX</small></span></button>`;
const applyKind=(b,v)=>{ const k=CALLOUT_KINDS[+v.slice(5)]; if(k){ b.icon=k[0]; b.color=k[1]; } };
/* at = {rect, follow}: menu u kurzoru (pravé tlačítko na obrázku nebo kresbě, od 4.16.0) */
const tblLay=b=>b.align==='center'?'c':b.align==='right'?(b.wrap?'wr':'r'):(b.wrap?'wl':'l');
function openBlockMenu(anchor,pg,b,at){
  let h='';
  const pr=()=>at&&at.rect||anchor.getBoundingClientRect(), fol=at&&at.follow;
  if(LOCK&&b.type==='image'){
    /* zamčeno: u obrázku jen kopírovat, u kresby i upravit (kreslení jde i se zámkem) */
    h=`<div class="bm-row"><button class="bm-ic" data-v="copy" title="Kopírovat" aria-label="Kopírovat">${IC.clip}</button></div><div class="pop-sep"></div>`+(b.draw?`<button class="pop-item" data-v="draw-edit"><span class="pi-ic">${IC.edit}</span>Upravit kresbu</button>`:'')
      +`<button class="pop-item" data-v="open"><span class="pi-ic">${IC.resize}</span>Zvětšit</button><button class="pop-item" data-v="dl"><span class="pi-ic">${IC.download}</span>Stáhnout</button>`;
    const p=openPop(anchor,h,v=>{ if(v==='copy') copyOne(b); else if(v==='draw-edit'){ const im=$(`#blocks .blk[data-id="${b.id}"] .bimg`); if(im) setTimeout(()=>editDrawing(im),0); } else { const im=$(`#blocks .blk[data-id="${b.id}"] .bimg`); if(im) return imgMenuAct(im,v); } },at);
    p.classList.add('bm-pop'); placePop(p,pr(),fol); return;
  }
  if(LOCK){
    /* zamčeno: u zvýrazněného bloku jde jen změnit ikonu a barvu, nic se nepřesouvá ani nemaže */
    if(b.type!=='callout') return;
    h=kindsHtml(b)+`<div class="pop-h">Ikona</div><div class="swatches"><button class="pop-item co-noic" style="width:auto;padding:4px 6px;font-size:15px" data-v="icon:" title="Bez ikony" aria-label="Bez ikony">∅</button>${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>
      <div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
    openPop(anchor,h,v=>{ if(v.startsWith('kind:')) applyKind(b,v); else if(v.startsWith('color:')) b.color=v.slice(6); else if(v.startsWith('icon:')) b.icon=v.slice(5); savePage(pg); rerenderBlocks(); });
    return;
  }
  /* nahoře řada čtverečků (posun, kopírovat, duplikovat, smazat); s výběrem víc bloků platí menu pro všechny */
  const multi=bselCount(b.id), SIMPLE=simpleUi(), noLvl=b.type==='image'&&!multi||SIMPLE;   /* jednoduchý režim: jen nahoru/dolů, převést, smazat (+ kopírovat) */
  const ib=(v,ic,t,dis)=>`<button class="bm-ic${v==='del'?' danger':''}" data-v="${v}" title="${t}" aria-label="${t}"${dis?' disabled':''}>${ic}</button>`;
  h+=`<div class="bm-row">${ib('up',IC.up,'Posunout nahoru (⌥⇧↑)')}${ib('down',IC.down,'Posunout dolů (⌥⇧↓)')}`
    +(noLvl?'':ib('left',IC.left,'Posunout doleva (⌘ú)',!multi&&!((b.level||0)>0))+ib('right',IC.right,'Posunout doprava (⌘))',!multi&&(b.level||0)>=4))
    +`${ib('copy',IC.clip,'Kopírovat')}${ib('dup',IC.dup,'Duplikovat')}${ib('del',IC.trash,'Odstranit')}</div>`;
  /* netextové bloky (obrázek, kresba, tabulka, rovnice…): nový prázdný řádek nad / pod (od 4.21.1 místo tlačítek ↵ u bloku) */
  if(!multi&&!TEXT_TYPES.includes(b.type)) h+=`<div class="pop-sep"></div><button class="pop-item" data-v="line-up"><span class="pi-ic flip">${IC.newline}</span>Nový řádek nad</button><button class="pop-item" data-v="line-dn"><span class="pi-ic">${IC.newline}</span>Nový řádek pod</button>`;
  /* obrázek a kresba (od 4.20.0): pod řadou ikon rozvržení a položky z bývalé nabídky po kliknutí na obrázek */
  const im=b.type==='image'&&!multi?$(`#blocks .blk[data-id="${b.id}"] .bimg`):null;
  if(im) h+=`<div class="pop-sep"></div>`+imgMenuHtml(im);
  /* tabulka (od 4.21.0): rozvržení jako u obrázku (bez „v řádku s textem“) a popisek nad tabulkou */
  if(b.type==='table'&&!multi&&!SIMPLE){
    const cur=tblLay(b);
    h+=`<div class="pop-sep"></div><div class="bm-row lay-row">${['wl','l','c','r','wr'].map(k=>`<button class="bm-ic lay-b${k===cur?' on':''}" data-v="tlay:${k}" title="${LAY[k][2]}" aria-label="${LAY[k][2]}"><svg viewBox="0 0 28 20" aria-hidden="true">${LAY_IC[k]}</svg></button>`).join('')}</div>`
      +`<div class="pop-sep"></div><button class="pop-item" data-v="tcap"><span class="pi-ic">${IC.caption}</span>${b.caption||b.capOn?'Odebrat popisek':'Přidat popisek'}</button>`;
  }
  if(multi){
    h+=`<div class="pop-h">Vybrané bloky: ${multi}</div><div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('')+EQ_ITEM;
    const p=openPop(anchor,h,v=>{
      if(v.startsWith('type:')) bulk.type(v.slice(5));
      else if(v==='up'||v==='down') bulk.move(v==='up'?-1:1);
      else if(v==='left'||v==='right') bulk.indent(v==='left'?-1:1);
      else if(v==='copy'||v==='dup'||v==='del') bulk[v]();
    },at);
    p.classList.add('bm-pop'); placePop(p,pr(),fol);
    return;
  }
  if(TEXT_TYPES.includes(b.type)) h+=`<div class="pop-sep"></div><div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item ${b.type===k?'act':''}" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('')+EQ_ITEM
    +(b.type==='h1'&&isIndex()?`<button class="pop-item" data-v="tosubj"><span class="pi-ic">${TYPE_ICON.subj}</span><span>Předmět…<small>Nadpis nahradí předmět z Indexu</small></span></button>`:'');
  if(b.type==='subj'){
    const su=S.subjects[b.subj];
    h+=`<div class="pop-sep"></div><div class="pop-h">Předmět</div>${isIndex()?`${su?`<button class="pop-item" data-v="subj-ix"><span class="pi-ic">${IC.subject}</span>Otevřít v Indexu</button>`:''}<button class="pop-item" data-v="subj-pick"><span class="pi-ic">${IC.swap}</span>${su?'Změnit předmět…':'Vybrat předmět…'}</button>`:''}<button class="pop-item" data-v="subj-h1"><span class="pi-ic">H1</span><span>Převést na nadpis H1<small>S názvem předmětu, bez vazby na Index</small></span></button>`;
  }
  if(b.type==='callout'){
    h+=`<div class="pop-sep"></div>`+kindsHtml(b)+`<div class="pop-h">Ikona</div><div class="swatches"><button class="pop-item co-noic" style="width:auto;padding:4px 6px;font-size:15px" data-v="icon:" title="Bez ikony" aria-label="Bez ikony">∅</button>${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>`;
    h+=`<div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
  }
  if(b.type==='eq') h+=`<div class="pop-sep"></div><button class="pop-item" data-v="eq-edit"><span class="pi-ic">${TYPE_ICON.eq}</span>Upravit rovnici</button><button class="pop-item" data-v="eq-txt"><span class="pi-ic">T</span><span>Převést na text<small>Zdroj LaTeX jako obyčejný odstavec</small></span></button>`;
  if(!SIMPLE){ const xi=pg.blocks.indexOf(b), fl=pg.blocks.slice(0,xi).filter(q=>q.type==='image'&&(q.align==='left'||q.align==='right')&&!q.nw||q.type==='table'&&q.wrap&&q.align!=='center').pop();
    if(b.type!=='image'&&!(b.type==='table'&&b.wrap)&&(b.clr||fl)){ const w=fl&&fl.type==='table'?'tabulkou':'obrázkem';
      h+=`<div class="pop-sep"></div><button class="pop-item ${b.clr?'act':''}" data-v="clr"><span class="pi-ic">${b.clr?'✓':'⤓'}</span><span>Začít pod ${w}<small>${b.clr?'Zrušit kliknutím':'Ukončí obtékání, blok začne až pod '+w}</small></span></button>`; } }
  if(b.type==='table'&&!SIMPLE) h+=`<div class="pop-sep"></div><div class="pop-h">Tabulka</div><button class="pop-item" data-v="hrow"><span class="pi-ic">${b.hrow?'✓':''}</span>První řádek jako záhlaví</button><button class="pop-item" data-v="hcol"><span class="pi-ic">${b.hcol?'✓':''}</span>První sloupec jako záhlaví</button>`;
  if(!SIMPLE&&b.type!=='image'){
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
        sec+=`<button class="pop-item ${inc?'act':''}" data-v="${inc?'until-x':'until'}:${hb.id}"><span class="pi-ic">${inc?'✓':'⤓'}</span><span>Sbalovat „${nm}“ až sem, včetně oddělovače<small>${inc?'Zrušit kliknutím (zpět po další nadpis)':'Oddělovač se schová spolu se sekcí'}</small></span></button>`
            +`<button class="pop-item ${vis?'act':''}" data-v="${vis?'until-x':'untilv'}:${hb.id}"><span class="pi-ic">${vis?'✓':'⤒'}</span><span>Sbalovat „${nm}“ po oddělovač<small>${vis?'Zrušit kliknutím (zpět po další nadpis)':'Oddělovač zůstane vidět'}</small></span></button>`;
        continue;
      }
      sec+=isEnd?`<button class="pop-item act" data-v="until-x:${hb.id}"><span class="pi-ic">✓</span><span>„${nm}“ se sbaluje až sem<small>Zrušit kliknutím (zpět po další nadpis)</small></span></button>`
               :`<button class="pop-item" data-v="until:${hb.id}"><span class="pi-ic">${IC.foldTo}</span><span>Sbalovat „${nm}“ až sem<small>Tento blok se schová, další zůstanou vidět</small></span></button>`;
    }
    if(isHeading(b.type)&&b.until){ sec+=`<button class="pop-item" data-v="until-x:${b.id}"><span class="pi-ic">${IC.restore}</span><span>Sbalovat automaticky<small>Až po další nadpis stejné úrovně</small></span></button>`; }
    if(sec) h+=`<div class="pop-sep"></div><div class="pop-h">Sbalování sekce</div>`+sec;
  }
  const pop=openPop(anchor,h,v=>{
    const bi=pg.blocks.indexOf(b); if(bi<0) return;
    if(v==='copy'){ copyOne(b); return; }
    if(v==='line-up'||v==='line-dn'){ lineAround(b.id,v==='line-up'); return; }
    if(v==='tosubj'||v==='subj-pick'){ openSubjPicker(anchor,su=>toSubject(pg,b,su),b.subj); return true; }
    if(v==='subj-ix'){ gotoSubject(b.subj); return; }
    if(v==='subj-h1'){ subjToH1(pg,b); return; }
    if(v==='eq-edit'){ const el=$(`#blocks .blk[data-id="${b.id}"] .eqb`); if(el) setTimeout(()=>openEqEditor(el),0); return; }
    if(im&&/^(lay:|sz:|draw$|cap$|open$|dl$)/.test(v)) return imgMenuAct(im,v,pop);
    if(v.startsWith('tlay:')){
      const k=v.slice(5), al=LAY[k][0];
      if(al==='left') delete b.align; else b.align=al;
      if(k==='wl'||k==='wr') b.wrap=1; else delete b.wrap;
      savePage(pg); rerenderBlocks(); pop.querySelectorAll('[data-v^="tlay:"]').forEach(x=>x.classList.toggle('on',x.dataset.v===v));
      /* blok se překreslil: nabídka se přesune k novému úchytu ⋮⋮ (u starého, odpojeného by uskočila) */
      const ng=$(`#blocks > .blk[data-id="${b.id}"] > .gut .g-drag`);
      if(ng&&!at){ S.popAnchor=ng; placePop(pop,ng.getBoundingClientRect(),fol); }
      else placePop(pop,pr(),fol);
      return true;
    }
    if(v==='tcap'){
      if(b.caption||b.capOn){ delete b.caption; delete b.capOn; savePage(pg); rerenderBlocks(); return; }
      b.capOn=true; savePage(pg); rerenderBlocks(); const c=$(`#blocks .blk[data-id="${b.id}"] .tcap`); if(c) focusEl(c,'end'); return;
    }
    if(v==='eq-txt'){ b.type='p'; savePage(pg); rerenderBlocks(); focusBlock(b.id,'end'); return; }
    if(v==='type:eq'){ blockToEq(pg,b); return; }
    if(v.startsWith('type:')){ setType(pg,b,v.slice(5),true); }
    else if(v.startsWith('kind:')) applyKind(b,v);
    else if(v.startsWith('color:')) b.color=v.slice(6);
    else if(v.startsWith('icon:')) b.icon=v.slice(5);
    else if(v.startsWith('until:')){ const hb=pg.blocks.find(q=>q.id===v.slice(6)); if(hb){ hb.until=b.id; delete hb.untilVis; } }
    else if(v.startsWith('untilv:')){ const hb=pg.blocks.find(q=>q.id===v.slice(7)); if(hb){ hb.until=b.id; hb.untilVis=true; } }
    else if(v.startsWith('until-x:')){ const hb=pg.blocks.find(q=>q.id===v.slice(8)); if(hb){ delete hb.until; delete hb.untilVis; } }
    else if(v==='clr'){ if(b.clr) delete b.clr; else b.clr=1; }
    else if(v==='hrow') b.hrow=!b.hrow;
    else if(v==='hcol') b.hcol=!b.hcol;
    else if(v==='up'&&bi>0){ pg.blocks.splice(bi,1); pg.blocks.splice(bi-1,0,b); }
    else if(v==='down'&&bi<pg.blocks.length-1){ pg.blocks.splice(bi,1); pg.blocks.splice(bi+1,0,b); }
    else if(v==='left'||v==='right'){ if(b.type==='image') return; b.level=clamp((b.level||0)+(v==='left'?-1:1),0,4); }
    else if(v==='dup'){ const c=clone(b); c.id=rid(); pg.blocks.splice(bi+1,0,c); }
    else if(v==='del'){
      pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks();
      toast('Blok odstraněn','Vrátit',()=>{ pg.blocks.splice(Math.min(bi,pg.blocks.length),0,b); savePage(pg); rerenderBlocks(); });
      return;
    }
    savePage(pg); rerenderBlocks();
    if(TEXT_TYPES.includes(b.type)) focusBlock(b.id,'end');
  },at);
  pop.classList.add('bm-pop'); if(im) markImgMenu(im,pop); placePop(pop,pr(),fol);
}
/* klik na nadpis předmětu: do Indexu, jiný předmět; odemčeno i vlastní emoji a formát nadpisu.
   Se skrytým Indexem jen formát nadpisu (a zamčeno nic). */
function openSubjBlockMenu(anchor,pg,b){
  const su=S.subjects[b.subj], ix=isIndex();
  if(!su){ if(ix) openSubjPicker(anchor,x=>toSubject(pg,b,x)); return; }
  if(!ix&&LOCK) return;
  const fmtBtn=(k,lbl,title)=>`<button class="sj-fb ${b[k]?'on':''}" data-v="f:${k}" title="${title}" aria-pressed="${!!b[k]}">${lbl}</button>`;
  const h=`<div class="pop-h">${esc(subjLabel(su))}</div>${ix?`<button class="pop-item" data-v="ix"><span class="pi-ic">${IC.subject}</span>Otevřít v Indexu</button><button class="pop-item" data-v="pick"><span class="pi-ic">${IC.swap}</span>Změnit předmět…</button>`:''}`
    +(LOCK?'':`${ix?'<div class="pop-sep"></div>':''}<div class="pop-h">Formát nadpisu</div>
      <div class="sj-fmt">${fmtBtn('it','<i>I</i>','Kurzíva')}${fmtBtn('un','<u>U</u>','Podtržení')}${fmtBtn('st','<s>S</s>','Přeškrtnutí')}</div>
      <div class="pop-h">Zvýraznění</div><div class="swatches"><button class="sw sw-none ${b.hl?'':'on'}" data-v="h:" aria-label="Bez zvýraznění" title="Bez zvýraznění">∅</button>${COLORS.map(c=>`<button class="sw hl-${c} ${b.hl===c?'on':''}" data-v="h:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>
      ${emojiRow('sj-emoji',b.icon).replace('>Ikona<','>Ikona před názvem<').replace('data-v="none"','data-v="e:"')}`);
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
    ?`<button class="pop-item" data-v="above"><span class="pi-ic">${IC.up}</span>Vložit řádek nad</button><button class="pop-item" data-v="below"><span class="pi-ic">${IC.down}</span>Vložit řádek pod</button><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit řádek</button>`
    :`<button class="pop-item" data-v="left"><span class="pi-ic">${IC.left}</span>Vložit sloupec vlevo</button><button class="pop-item" data-v="right"><span class="pi-ic">${IC.right}</span>Vložit sloupec vpravo</button><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit sloupec</button>`;
  openPop(anchor,h,v=>{
    const cols=b.rows[0].cells.length;
    if(kind==='row'){
      if(v==='del'){ if(b.rows.length<=1) return toast('Tabulka musí mít aspoň jeden řádek.'); b.rows.splice(idx,1); if(Array.isArray(b.rh)) b.rh.splice(idx,1); }
      else { const at=v==='above'?idx:idx+1; b.rows.splice(at,0,{cells:Array.from({length:cols},()=>emptyCell())}); if(Array.isArray(b.rh)&&at<b.rh.length) b.rh.splice(at,0,null); }
    } else {
      if(v==='del'){ if(cols<=1) return toast('Tabulka musí mít aspoň jeden sloupec.'); b.rows.forEach(r=>r.cells.splice(idx,1)); if(Array.isArray(b.cw)) b.cw.splice(idx,1); }
      else { const at=v==='left'?idx:idx+1; b.rows.forEach(r=>r.cells.splice(at,0,emptyCell())); if(Array.isArray(b.cw)) b.cw.splice(at,0,COL_DEF); }
    }
    savePage(pg); rerenderBlocks();
  });
}
/* ikona a barva stránky (od 4.20.0): barvy nahoře, pod nimi jeden řádek s polem pro emoji, Použít a Odebrat */
const emojiRow=(id,cur)=>`<div class="pop-h">Ikona</div><div class="pop-acts"><input class="emoji-one" id="${id}" maxlength="8" aria-label="Emoji" value="${esc(cur||'')}"><button class="pop-act" data-v="custom"><span>Použít</span></button><span class="sp"></span>${cur?'<button class="pop-act danger" data-v="none"><span>Odebrat</span></button>':''}</div>`;
function openIconPop(anchor,pg){
  const h=`<div class="pop-h">Barva stránky</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${pg.color===c?'on':''}" data-v="c:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>
    <div class="pop-sep"></div>${emojiRow('emoji-custom',pg.icon)}`;
  const p=openPop(anchor,h,(v,btn,p)=>{
    if(v.startsWith('c:')){ pg.color=v.slice(2); savePage(pg); renderSidebar(); $$('.sw',p).forEach(s=>s.classList.toggle('on',s.dataset.v===v)); return true; }
    else if(v==='custom'){ const val=$('#emoji-custom',p).value.trim(); if(!val) return true; pg.icon=val; }
    else if(v==='none') pg.icon='';
    savePage(pg); renderSidebar(); renderPage(pg);
  });
  const inp=$('#emoji-custom',p); if(inp){ inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); const val=inp.value.trim(); if(!val) return; pg.icon=val; closePop(); savePage(pg); renderSidebar(); renderPage(pg); } }); inp.addEventListener('focus',()=>inp.select()); }
}
function openPageMenu(anchor,pg,at){   /* at = {rect}: menu u jiného místa než anchor (⋯ v bublině schovaného panelu) */
  /* stránka v archivu: jen obnovit nebo odstranit (se zámkem jen obnovit) */
  if(isArchived(pg)){
    const h=`<button class="pop-item" data-v="unarch"><span class="pi-ic">${IC.restore}</span>Obnovit z archivu</button>`+(LOCK?'':`<div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit</button>`);
    openPop(anchor,h,v=>{ if(v==='unarch') unarchivePage(pg.id); if(v==='del'&&!LOCK) deletePage(pg.id); },at);
    return;
  }
  /* rozdělená obrazovka (js/split.js): jen na širokém okně */
  const sp=matchMedia('(min-width:861px)').matches?`<button class="pop-item" data-v="spR"><span class="pi-ic">${IC.splitR}</span>Otevřít vpravo</button><button class="pop-item" data-v="spL"><span class="pi-ic">${IC.splitL}</span>Otevřít vlevo</button><div class="pop-sep"></div>`:'';
  const h=sp+`<button class="pop-item" data-v="sub"><span class="pi-ic">${IC.plus}</span>Přidat podstránku</button><button class="pop-item" data-v="up"><span class="pi-ic">${IC.up}</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">${IC.down}</span>Posunout dolů</button>${pg.parent?`<button class="pop-item" data-v="top"><span class="pi-ic">${IC.toTop}</span>Přesunout mezi projekty</button>`:''}<button class="pop-item" data-v="dup"><span class="pi-ic">${IC.copy}</span>Duplikovat</button><button class="pop-item" data-v="arch"><span class="pi-ic">${IC.archive}</span>Archivovat</button>`+(LOCK?'':`<div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit</button>`);
  openPop(anchor,h,v=>{
    if(v==='spR'||v==='spL'){ spOpen(v==='spR'?'R':'L',pg); return; }
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
    if(v==='del'&&!LOCK) deletePage(pg.id);
  },at);
}

export { CALLOUT_KINDS, openBlockMenu, openIconPop, openPageMenu, openSubjBlockMenu, openTableMenu };
