/* Úkolníček – Rovnice (LaTeX přes KaTeX ve složce lib/katex, načítá se až když je na stránce nějaká rovnice)
   - v textu: <span class="eq" contenteditable="false">TeX</span>. Zdroj TeX je obyčejný text uvnitř, takže ho najde hledání,
     starší verze ho ukáží jako text a pozice kurzoru (počítané z textContent) se vykreslením nemění.
     Vykreslená rovnice je ve shadow DOM, mimo text bloku.
   - na samostatném řádku: blok typu 'eq', TeX je v b.html (escapovaný text); ve starší verzi se z něj stane odstavec s TeX textem.
   - vložení: /rovnice (v prázdném řádku blok, jinak do textu), ∑ v liště formátu (z označeného textu), ⌘⇧E, psaní $…$
   - úprava: klik na rovnici otevře okénko s polem pro TeX a náhledem; Enter = hotovo, Esc = zrušit, prázdná = smazat */
import { $, esc, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { savePage } from '../store.js';
import { newBlock } from '../pages.js';
import { focusBlock } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { closePop, placePop } from '../ui.js';

const BASE='lib/katex/';
let loading=null;
function loadKatex(){
  if(window.katex) return Promise.resolve(window.katex);
  if(loading) return loading;
  loading=new Promise((res,rej)=>{
    const l=document.createElement('link'); l.rel='stylesheet'; l.href=BASE+'katex.min.css'; document.head.appendChild(l);
    const s=document.createElement('script'); s.src=BASE+'katex.min.js';
    s.onload=()=>res(window.katex); s.onerror=()=>{ loading=null; s.remove(); rej(new Error('katex')); };
    document.head.appendChild(s);
  });
  return loading;
}
function toHtml(tex,display){
  if(!tex.trim()) return `<span class="ph">${display?'Prázdná rovnice – klikni a napiš ji':'rovnice'}</span>`;
  try{ return window.katex.renderToString(tex,{displayMode:!!display,throwOnError:false,strict:false,output:'html',errorColor:'var(--danger)'}); }
  catch(_){ return `<span class="err">${esc(tex)}</span>`; }
}
const SHADOW_CSS='<link rel="stylesheet" href="'+BASE+'katex.min.css"><style>:host{white-space:nowrap}.katex{font-size:1.08em}.ph{color:var(--muted);font-style:italic;font-size:.9em;padding:0 3px;border:1px dashed var(--line);border-radius:4px}.err{color:var(--danger);font-family:var(--f-mono)}</style><span class="k"></span>';
/* rovnice v textu: vykreslení do shadow DOM (text uvnitř zůstává TeX) */
function drawInline(el,tex){
  if(!window.katex) return;
  const sh=el.shadowRoot||el.attachShadow({mode:'open'});
  if(!sh.querySelector('.k')) sh.innerHTML=SHADOW_CSS;
  sh.querySelector('.k').innerHTML=toHtml(tex==null?el.textContent:tex,false);
}
function drawBlock(el,tex){ if(!window.katex) return; el.innerHTML=toHtml(tex,true); el.dataset.r='1'; }
const texOf=el=>el.classList.contains('eqb')?(el.dataset.tex||''):el.textContent;
/* najde nevykreslené rovnice v pohledu a vykreslí je (KaTeX se případně nejdřív načte) */
function mathPass(root=$('#view')){
  if(!root) return;
  const inl=[...root.querySelectorAll('span.eq')].filter(e=>!e.shadowRoot), blk=[...root.querySelectorAll('.eqb:not([data-r])')];
  if(!inl.length&&!blk.length) return;
  if(!window.katex){ loadKatex().then(()=>mathPass(root),()=>{}); return; }
  inl.forEach(e=>drawInline(e)); blk.forEach(e=>drawBlock(e,e.dataset.tex||''));
}

/* ---- vložení rovnice do textu ---- */
function insertEq(host,range,tex,silent){
  const sp=document.createElement('span'); sp.className='eq'; sp.setAttribute('contenteditable','false'); sp.textContent=tex||'';
  let r=range; if(!r||!host.contains(r.startContainer)){ r=document.createRange(); r.selectNodeContents(host); r.collapse(false); }
  if(!r.collapsed) r.deleteContents();
  r.insertNode(sp);
  /* kurzor za rovnici; při vložení z nabídky se na konci textu přidá mezera (při psaní $…$ ne, mezeru napíšeš sám) */
  let after=sp.nextSibling;
  if(!silent&&(!after||(after.nodeType===3&&!after.nodeValue))){ after=document.createTextNode(' '); sp.after(after); }
  const nr=document.createRange(); if(after&&after.nodeType===3&&after.nodeValue) nr.setStart(after,after.nodeValue[0]===' '&&!silent?1:0); else nr.setStartAfter(sp); nr.collapse(true);
  host.focus({preventScroll:true}); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
  mathPass(host);
  if(!silent) host.dispatchEvent(new Event('input',{bubbles:true}));
  return sp;
}
/* ∑ v liště formátu nebo ⌘⇧E: označený text se stane rovnicí; bez výběru se vloží prázdná a otevře se úprava */
function eqFromSelection(){
  const s=getSelection(); if(!s.rangeCount) return;
  const r=s.getRangeAt(0), n=r.commonAncestorContainer, host=(n.nodeType===1?n:n.parentElement).closest('.txt');
  if(!host||!host.closest('#doc')) return;
  const tex=r.toString().replace(/\s+/g,' ').trim();
  const sp=insertEq(host,r.cloneRange(),tex);
  if(!tex) openEqEditor(sp,true);
}
/* psaní $…$ v textu: po druhém $ se z obsahu stane rovnice (např. $v_0$; obsah nesmí začínat ani končit mezerou, takže „$5 a $6“ zůstane textem) */
function dollarInput(t){
  const s=getSelection(); if(!s.rangeCount||!s.isCollapsed) return false;
  const r=s.getRangeAt(0), n=r.startContainer; if(n.nodeType!==3||!t.contains(n)) return false;
  const m=n.nodeValue.slice(0,r.startOffset).match(/(^|[\s(\[{"„'“])\$([^\s$](?:[^$]*[^\s$\\])?)\$$/);
  if(!m) return false;
  const rr=document.createRange(); rr.setStart(n,r.startOffset-m[2].length-2); rr.setEnd(n,r.startOffset);
  insertEq(t,rr,m[2],true);
  return true;
}

/* ---- okénko pro úpravu ---- */
const COARSE=matchMedia('(pointer:coarse)');
function openEqEditor(el,fresh){
  if(!el||!document.contains(el)) return;
  const isBlock=el.classList.contains('eqb'), orig=texOf(el);
  closePop();
  const p=document.createElement('div'); p.className='pop eq-pop'; p.setAttribute('role','dialog'); p.setAttribute('aria-label','Upravit rovnici');
  p.innerHTML=`<div class="pop-h">${isBlock?'Rovnice na samostatném řádku':'Rovnice v textu'} · LaTeX</div>
    <textarea class="eq-in" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="např. E = mc^2, \\frac{a}{b}, 5\\,\\text{m/s}"></textarea>
    <div class="eq-prev" aria-live="polite"></div>
    <p class="note">Enter = hotovo · Shift+Enter = nový řádek · Esc = zrušit</p>
    <div class="it-row">${LOCK?'':'<button type="button" class="danger" data-v="del">Odebrat</button>'}<span class="sp"></span><button type="button" class="on" data-v="ok">Hotovo</button></div>`;
  document.body.appendChild(p);
  const ta=$('.eq-in',p), prev=$('.eq-prev',p);
  ta.value=orig;
  const place=()=>{
    if(COARSE.matches){ const vv=window.visualViewport; p.style.left='8px'; p.style.right='8px'; p.style.top=((vv?vv.offsetTop:0)+8)+'px'; p.style.maxWidth='none'; }
    else placePop(p,el.getBoundingClientRect());
  };
  let state='open', byKey=false;   /* zavřeno klávesou nebo tlačítkem: kurzor se vrátí za rovnici */
  const show=()=>{
    const tex=ta.value;
    loadKatex().then(()=>{ prev.innerHTML=toHtml(tex,true); if(isBlock) drawBlock(el,tex); else drawInline(el,tex); },()=>{ prev.textContent='Rovnice se nepodařilo načíst (lib/katex).'; });
  };
  show(); place();
  S.pop=p; S.popAnchor=el;
  setTimeout(()=>{ ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); },20);
  ta.addEventListener('input',()=>{ ta.style.height='auto'; ta.style.height=Math.min(160,ta.scrollHeight)+'px'; show(); });
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); byKey=true; closePop(); }
    else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); state='cancel'; byKey=true; closePop(); }
  });
  p.addEventListener('mousedown',e=>{ if(!e.target.closest('textarea')) e.preventDefault(); });
  p.addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(!b) return; if(b.dataset.v==='del') ta.value=''; byKey=true; closePop(); });
  /* okénko zavře cokoli (Hotovo, Enter, klik vedle, Esc); uloží se jednou při zavření */
  const mo=new MutationObserver(()=>{ if(document.body.contains(p)) return; mo.disconnect(); finish(state==='cancel'?orig:ta.value); });
  mo.observe(document.body,{childList:true});
  function finish(tex){
    tex=tex.replace(/\r/g,'');
    if(!document.contains(el)) return;
    if(isBlock){
      const x=ctxOf(el); if(!x) return;
      if(!tex.trim()&&!(state==='cancel'&&!fresh)){ x.b.type='p'; x.b.html=''; savePage(x.pg); rerenderBlocks(); focusBlock(x.b.id,0); return; }
      if(tex===orig&&!fresh){ drawBlock(el,tex); if(byKey) nextText(x); return; }
      x.b.html=esc(tex); el.dataset.tex=tex; drawBlock(el,tex); savePage(x.pg);
      if(fresh||byKey) nextText(x);
      return;
    }
    const host=el.closest('.txt');
    if(!tex.trim()){
      if(state==='cancel'&&!fresh&&orig.trim()){ drawInline(el,orig); if(byKey) caretAfter(el); return; }
      const nx=el.nextSibling; if(nx&&nx.nodeType===3&&nx.nodeValue===' ') nx.remove();
      const at=document.createRange(); at.setStartBefore(el); at.collapse(true);
      el.remove(); if(host) host.dispatchEvent(new Event('input',{bubbles:true}));
      if(byKey&&host){ host.focus({preventScroll:true}); const s=getSelection(); s.removeAllRanges(); s.addRange(at); }
      return;
    }
    el.textContent=tex; drawInline(el,tex);
    const grew=byKey&&caretAfter(el);
    if((tex!==orig||grew)&&host) host.dispatchEvent(new Event('input',{bubbles:true}));
  }
}

/* blok rovnice zavřený Enterem: psaní pokračuje v řádku pod ní */
function nextText(x){ const nx=x.pg.blocks[x.pg.blocks.indexOf(x.b)+1]; if(nx&&TEXT_TYPES.includes(nx.type)) focusBlock(nx.id,0); }
/* kurzor hned za rovnici v textu. Když za ní na konci řádku nic není, přidá se mezera,
   jinak by se za needitovatelnou rovnici kurzor nedostal. Vrací true, když se mezera přidala. */
const isEmptyTail=n=>{ while(n){ if(!(n.nodeType===3&&!n.nodeValue)&&n.nodeName!=='BR') return false; n=n.nextSibling; } return true; };
function caretAfter(el){
  const host=el&&el.isConnected&&el.closest('.txt'); if(!host||host.getAttribute('contenteditable')!=='true') return false;
  let nx=el.nextSibling, added=false;
  while(nx&&nx.nodeType===3&&!nx.nodeValue){ const d=nx; nx=nx.nextSibling; d.remove(); }
  const r=document.createRange();
  if(isEmptyTail(nx)){ const sp=document.createTextNode(' '); el.after(sp); r.setStart(sp,1); added=true; }
  else if(nx.nodeType===3) r.setStart(nx,nx.nodeValue===' '&&isEmptyTail(nx.nextSibling)?1:0);   /* mezera na konci řádku: kurzor za ni */
  else r.setStartAfter(el);
  r.collapse(true); host.focus({preventScroll:true});
  const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  return added;
}
/* rovnice hned za kurzorem (nebo kurzor omylem uvnitř skrytého TeXu rovnice) */
function eqAtCaret(){
  const s=getSelection(); if(!s.rangeCount||!s.isCollapsed) return null;
  const {startContainer:n,startOffset:o}=s.getRangeAt(0);
  const inEq=(n.nodeType===1?n:n.parentElement)?.closest('span.eq'); if(inEq) return inEq;
  if(n.nodeType===3&&o<n.nodeValue.length) return null;
  let nx=n.nodeType===3?n.nextSibling:n.childNodes[o]||null;
  while(nx&&nx.nodeType===3&&!nx.nodeValue) nx=nx.nextSibling;
  return nx&&nx.nodeType===1&&nx.matches('span.eq')?nx:null;
}

/* blok rovnice: /rovnice v prázdném řádku (blok se převede a hned se otevře úprava) */
function toEqBlock(pg,b){
  b.type='eq'; b.html=''; delete b.done; delete b.collapsed;
  /* pod rovnicí je vždy řádek na psaní (jako u oddělovače) */
  const i=pg.blocks.indexOf(b), nx=pg.blocks[i+1];
  if(!nx||!TEXT_TYPES.includes(nx.type)) pg.blocks.splice(i+1,0,newBlock('p'));
  savePage(pg); rerenderBlocks();
  const el=$(`#blocks .blk[data-id="${b.id}"] .eqb`); if(el) openEqEditor(el,true);
}

/* posluchače: rovnice se vykreslí, kdykoli se v pohledu objeví (stránka, překreslení bloků, Úkoly) */
export function initMath(){
  const v=$('#view'); if(!v) return;
  new MutationObserver(()=>mathPass(v)).observe(v,{childList:true,subtree:true});
  /* klik vpravo od rovnice na stejném řádku: kurzor za ni (prohlížeč ho jinak nechá před ní) */
  v.addEventListener('click',e=>{
    const t=e.target.closest&&e.target.closest('#doc .txt'); if(!t||e.target.closest('.eq')||t.getAttribute('contenteditable')!=='true') return;
    const s=getSelection(); if(!s.rangeCount||!s.isCollapsed) return;
    let best=null;
    t.querySelectorAll('span.eq').forEach(q=>{ const rs=q.getClientRects(), rc=rs[rs.length-1]; if(rc&&e.clientY>=rc.top-3&&e.clientY<=rc.bottom+3&&e.clientX>=rc.right-1&&(!best||rc.right>best.r)) best={q,r:rc.right}; });
    if(!best) return;
    const cur=s.getRangeAt(0), aft=document.createRange(); aft.setStartAfter(best.q);
    const c=best.q.contains(cur.startContainer)?-1:cur.compareBoundaryPoints(Range.START_TO_START,aft);
    if(c>0||(c===0&&!isEmptyTail(best.q.nextSibling))) return;
    caretAfter(best.q);
  });
  /* → před rovnicí ji přeskočí; End / ⌘→ skončí až za rovnicí na konci řádku */
  v.addEventListener('keydown',e=>{
    if(!e.target.closest||!e.target.closest('#doc .txt')||e.shiftKey||e.altKey) return;
    if(e.key==='ArrowRight'&&!e.metaKey&&!e.ctrlKey){ const q=eqAtCaret(); if(q){ e.preventDefault(); caretAfter(q); } return; }
    if(e.key==='End'||(e.key==='ArrowRight'&&e.metaKey)) setTimeout(()=>{ const q=eqAtCaret(); if(q&&isEmptyTail(q.nextSibling)) caretAfter(q); },0);
  });
}

export { dollarInput, eqFromSelection, insertEq, openEqEditor, toEqBlock };
