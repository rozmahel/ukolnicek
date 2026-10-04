/* Úkolníček – Menu bloku, tabulky, ikony stránky a stránky v levém panelu */
import { $, $$, CALLOUT_IC, clone, COLOR_CZ, COLORS, EMOJI, esc, plain, rid, TEXT_TYPES, TYPE_ICON, TYPE_LABEL } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { createPage, curPage, deletePage, emptyCell, kids } from '../pages.js';
import { gotoSubject, isIndex, openSubjPicker, subjBlockText, subjLabel } from '../school.js';
import { focusBlock } from './caret.js';
import { renderSidebar } from '../sidebar.js';
import { go } from '../router.js';
import { defaultEnd, hLevel, isHeading, renderPage, rerenderBlocks } from './render.js';
import { setType, subjToH1, toSubject } from './blocks.js';
import { closePop, openPop, toast } from '../ui.js';

/* ================= menus ================= */
function openBlockMenu(anchor,pg,b){
  let h='';
  if(LOCK){
    /* zamčeno: u zvýrazněného bloku jde jen změnit ikonu a barvu, nic se nepřesouvá ani nemaže */
    if(b.type!=='callout') return;
    h=`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>
      <div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
    openPop(anchor,h,v=>{ if(v.startsWith('color:')) b.color=v.slice(6); else if(v.startsWith('icon:')) b.icon=v.slice(5); savePage(pg); rerenderBlocks(); });
    return;
  }
  if(TEXT_TYPES.includes(b.type)) h+=`<div class="pop-h">Převést na</div>`+TEXT_TYPES.map(k=>`<button class="pop-item ${b.type===k?'act':''}" data-v="type:${k}"><span class="pi-ic">${TYPE_ICON[k]}</span>${TYPE_LABEL[k]}</button>`).join('')
    +(b.type==='h1'&&isIndex()?`<button class="pop-item" data-v="tosubj"><span class="pi-ic">${TYPE_ICON.subj}</span><span>Předmět…<small>Nadpis nahradí předmět z Indexu</small></span></button>`:'');
  if(b.type==='subj'){
    const su=S.subjects[b.subj];
    h+=`<div class="pop-h">Předmět</div>${isIndex()?`${su?'<button class="pop-item" data-v="subj-ix"><span class="pi-ic">🎓</span>Otevřít v Indexu</button>':''}<button class="pop-item" data-v="subj-pick"><span class="pi-ic">⇄</span>${su?'Změnit předmět…':'Vybrat předmět…'}</button>`:''}<button class="pop-item" data-v="subj-h1"><span class="pi-ic">H1</span><span>Převést na nadpis H1<small>S názvem předmětu, bez vazby na Index</small></span></button>`;
  }
  if(b.type==='callout'){
    h+=`<div class="pop-h">Ikona</div><div class="swatches">${CALLOUT_IC.map(ic=>`<button class="pop-item" style="width:auto;padding:4px 6px;font-size:17px" data-v="icon:${ic}">${ic}</button>`).join('')}</div>`;
    h+=`<div class="pop-h">Barva</div><div class="swatches">${COLORS.map(c=>`<button class="sw hl-${c} ${b.color===c?'on':''}" data-v="color:${c}" aria-label="${COLOR_CZ[c]}" title="${COLOR_CZ[c]}"></button>`).join('')}</div>`;
  }
  if(b.type==='table') h+=`<div class="pop-h">Tabulka</div><button class="pop-item" data-v="hrow"><span class="pi-ic">${b.hrow?'✓':''}</span>První řádek jako záhlaví</button><button class="pop-item" data-v="hcol"><span class="pi-ic">${b.hcol?'✓':''}</span>První sloupec jako záhlaví</button>`;
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
    if(sec) h+=`${h?'<div class="pop-sep"></div>':''}<div class="pop-h">Sbalování sekce</div>`+sec;
  }
  h+=`${h?'<div class="pop-sep"></div>':''}<button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">↓</span>Posunout dolů</button><button class="pop-item" data-v="dup"><span class="pi-ic">⧉</span>Duplikovat</button><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
  openPop(anchor,h,v=>{
    const bi=pg.blocks.indexOf(b); if(bi<0) return;
    if(v==='tosubj'||v==='subj-pick'){ openSubjPicker(anchor,su=>toSubject(pg,b,su),b.subj); return true; }
    if(v==='subj-ix'){ gotoSubject(b.subj); return; }
    if(v==='subj-h1'){ subjToH1(pg,b); return; }
    if(v.startsWith('type:')){ setType(pg,b,v.slice(5)); }
    else if(v.startsWith('color:')) b.color=v.slice(6);
    else if(v.startsWith('icon:')) b.icon=v.slice(5);
    else if(v.startsWith('until:')){ const hb=pg.blocks.find(q=>q.id===v.slice(6)); if(hb){ hb.until=b.id; delete hb.untilVis; } }
    else if(v.startsWith('untilv:')){ const hb=pg.blocks.find(q=>q.id===v.slice(7)); if(hb){ hb.until=b.id; hb.untilVis=true; } }
    else if(v.startsWith('until-x:')){ const hb=pg.blocks.find(q=>q.id===v.slice(8)); if(hb){ delete hb.until; delete hb.untilVis; } }
    else if(v==='hrow') b.hrow=!b.hrow;
    else if(v==='hcol') b.hcol=!b.hcol;
    else if(v==='up'&&bi>0){ pg.blocks.splice(bi,1); pg.blocks.splice(bi-1,0,b); }
    else if(v==='down'&&bi<pg.blocks.length-1){ pg.blocks.splice(bi,1); pg.blocks.splice(bi+1,0,b); }
    else if(v==='dup'){ const c=clone(b); c.id=rid(); pg.blocks.splice(bi+1,0,c); }
    else if(v==='del'){
      pg.blocks.splice(bi,1); savePage(pg); rerenderBlocks();
      toast('Blok smazán','Vrátit',()=>{ pg.blocks.splice(Math.min(bi,pg.blocks.length),0,b); savePage(pg); rerenderBlocks(); });
      return;
    }
    savePage(pg); rerenderBlocks();
    if(TEXT_TYPES.includes(b.type)) focusBlock(b.id,'end');
  });
}
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
  const h=`<button class="pop-item" data-v="sub"><span class="pi-ic">+</span>Přidat podstránku</button><button class="pop-item" data-v="up"><span class="pi-ic">↑</span>Posunout nahoru</button><button class="pop-item" data-v="down"><span class="pi-ic">↓</span>Posunout dolů</button>${pg.parent?'<button class="pop-item" data-v="top"><span class="pi-ic">⇤</span>Přesunout na nejvyšší úroveň</button>':''}<button class="pop-item" data-v="dup"><span class="pi-ic">⧉</span>Duplikovat</button><div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">×</span>Smazat</button>`;
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
    if(v==='del') deletePage(pg.id);
  });
}

export { openBlockMenu, openIconPop, openPageMenu, openSubjBlockMenu, openTableMenu };
