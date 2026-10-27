/* Úkolníček – Hlídání textu psaného se zapnutým Caps Lockem
   Otisk Caps Locku: slovo začíná malým a pokračuje velkými („aHOJ“, vznikne se Shiftem při zapnutém Caps Locku).
   Čistě velký úsek („JÁ JSEM MAREK“) se označí, jen když ho prohlížeč viděl psát se zapnutým Caps Lockem.
   Podtržení přes CSS Custom Highlight API (do HTML bloku se nic nevkládá, data se nemění).
   Kurzor v podtrženém úseku ukáže bublinu: prohodit velikost písmen / nechat.
   Volba `uk-caps` a seznam „nechat“ `uk-caps-ok` jsou jen v zařízení. */
import { clamp, lsGet, lsSet, simpleUi } from '../core.js';
import { caretOffset, focusEl } from './caret.js';

const HL='uk-caps', OK_KEY='uk-caps-ok', OK_MAX=200;
const SKIP='a, .eq, code, .mention, [contenteditable="false"]';   /* odkazy, rovnice, kód, zmínky */
const EXC=new Set(['mRNA','tRNA','rRNA','kVAR','mAh']);
const isLo=c=>c!==c.toUpperCase(), isUp=c=>c!==c.toLowerCase();
const allUp=w=>w===w.toUpperCase()&&w!==w.toLowerCase();
const capsOn=()=>lsGet('uk-caps',true)!==false&&!simpleUi();   /* v jednoduchém režimu (úzké okno) vypnuté */
const ok=()=>{ const v=lsGet(OK_KEY,[]); return Array.isArray(v)?v:[]; };

let entries=[];        /* {el, bid, range, text} */
let reg=null;          /* Highlight */
let pop=null, popFor=null, scanT=null;
let capsKey=false, capsEl=null;   /* poslední písmeno: Caps Lock zapnutý, v kterém poli */
const seen=new Map();             /* pole (bid) → úseky napsané se zapnutým Caps Lockem */

const bidOf=el=>{ const b=el.closest('.blk'); const ln=el.closest('.ln'), td=el.closest('td');
  return (b?b.dataset.id:'')+(ln&&td?`:${td.dataset.r}:${td.dataset.c}:${ln.dataset.l}`:''); };

/* úseky k podtržení v jednom poli: [{a,b,text}] v indexech řetězce s mapou na textové uzly */
function textMap(el){
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); const parts=[]; let s='', n, gap=false;
  while((n=w.nextNode())){
    const p=n.parentElement; if(p&&p!==el&&p.closest(SKIP)&&el.contains(p.closest(SKIP))){ gap=true; continue; }
    if(gap){ s+='\n'; gap=false; }
    parts.push({n,at:s.length}); s+=n.nodeValue;
  }
  return {s,parts};
}
/* off = pozice kurzoru, když se právě píše se zapnutým Caps Lockem (jinak -1) */
function findRuns(s,off,seenSet){
  const words=[]; const re=/\p{L}+/gu; let m;
  while((m=re.exec(s))){ const w=m[0];
    const inv=w.length>=2&&isLo(w[0])&&allUp(w.slice(1))&&!EXC.has(w);
    words.push({a:m.index,b:m.index+w.length,w,k:inv?'I':allUp(w)?'U':'O'}); }
  const runs=[]; let cur=null;
  const close=()=>{ if(cur){ runs.push(cur); cur=null; } };
  for(const x of words){
    if(x.k==='O'){ close(); continue; }
    if(cur&&(x.a-cur.b>4||s.slice(cur.b,x.a).includes('\n'))) close();
    if(!cur) cur={a:x.a,b:x.b,ws:[]};
    cur.b=x.b; cur.ws.push(x);
  }
  close();
  return runs.filter(r=>{
    r.text=s.slice(r.a,r.b);
    if(r.ws.some(x=>x.k==='I'&&x.w.length>=4)) return true;
    if(seenSet&&[...seenSet].some(t=>r.text.includes(t))) return true;
    if(off<r.a||off>r.b+1) return false;
    r.caps=r.ws.some(x=>x.k==='I')||(r.ws.length>=2&&r.ws.some(x=>x.w.length>=4));
    return r.caps;
  });
}
function rangeOf(parts,a,b){
  const at=i=>{ let p=parts[0]; for(const q of parts){ if(q.at<=i) p=q; else break; } return [p.n,clamp(i-p.at,0,p.n.nodeValue.length)]; };
  const r=document.createRange(); const [n1,o1]=at(a), [n2,o2]=at(b); r.setStart(n1,o1); r.setEnd(n2,o2); return r;
}

/* pole podle bid (blok, případně řádek v buňce tabulky) */
function elOf(bid){ const [id,r,c,l]=bid.split(':'); const b=document.querySelector(`#blocks .blk[data-id="${CSS.escape(id)}"]`); if(!b) return null;
  return r==null?b.querySelector('.txt'):b.querySelector(`td[data-r="${r}"][data-c="${c}"] .ln[data-l="${l}"] .txt`); }
/* blok překreslený (Enter, ⌘Z…) dostane nové uzly: podtržení se v něm najde znovu */
function prune(){
  const lost=new Set();
  entries=entries.filter(e=>{ const live=e.el.isConnected&&!e.range.collapsed&&e.el.contains(e.range.startContainer); if(!live&&!e.el.isConnected) lost.add(e.bid); return live; });
  lost.forEach(bid=>{ const el=elOf(bid); if(el) scan(el,true); });
}
function paint(){
  if(!reg){ reg=new Highlight(); CSS.highlights.set(HL,reg); }
  reg.clear(); entries.forEach(e=>reg.add(e.range));
}
function scan(el,quiet){
  if(!el||!el.isConnected||el.closest('.b-code')) return;
  const {s,parts}=textMap(el), bid=bidOf(el), okSet=new Set(ok());
  /* caret v aktuálním poli: úsek, který se právě píše se zapnutým Caps Lockem */
  const caps=capsKey&&capsEl===el, off=caps&&document.activeElement===el?caretOffset(el):-1;
  let ss=seen.get(bid);
  const runs=parts.length?findRuns(s,caps?off:-1,ss):[];
  entries=entries.filter(e=>e.el!==el&&e.bid!==bid);
  runs.forEach(r=>{
    if(r.caps){ if(!ss){ ss=new Set(); seen.set(bid,ss); } ss.add(r.text); }
    if(okSet.has(bid+'|'+r.text)) return;
    entries.push({el,bid,range:rangeOf(parts,r.a,r.b),text:r.text});
  });
  paint(); if(!quiet) capsPlace();
}

/* ---- bublina ---- */
const IC_SWAP='<svg viewBox="0 0 44 24" aria-hidden="true"><text x="3" y="18" class="cp-lo">a</text><text x="30" y="18" class="cp-up">A</text><path d="M14 9.5q8-6 16 0"/><path d="M27.5 6.2l2.6 3.4-4.2.6"/><path d="M30 14.5q-8 6-16 0"/><path d="M16.5 17.8l-2.6-3.4 4.2-.6"/></svg>';
const IC_KEEP='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M6.4 6.4l11.2 11.2"/></svg>';   /* zákaz = nechat beze změny */
function ensurePop(){
  if(pop) return pop;
  pop=document.createElement('div'); pop.className='pop caps-pop'; pop.id='caps-pop'; pop.hidden=true;
  pop.innerHTML=`<button type="button" class="cp-b cp-swap" data-cv="swap" title="Opravit" aria-label="Opravit (prohodit velká a malá písmena)">${IC_SWAP}</button><button type="button" class="cp-b" data-cv="keep" title="Nechat" aria-label="Nechat beze změny">${IC_KEEP}</button>`;
  /* kurzor ani klávesnice na telefonu nesmí z textu odejít */
  const hold=e=>{ if(e.target.closest('.cp-b')) e.preventDefault(); };
  pop.addEventListener('pointerdown',hold); pop.addEventListener('mousedown',hold);
  pop.addEventListener('click',e=>{ const b=e.target.closest('[data-cv]'); if(!b||!popFor) return; b.dataset.cv==='swap'?swap(popFor):keep(popFor); });
  document.body.appendChild(pop); return pop;
}
function capsHide(){ if(pop) pop.hidden=true; popFor=null; }
function current(){
  const sel=getSelection(); if(!sel.rangeCount||!sel.isCollapsed) return null;
  const n=sel.anchorNode, o=sel.anchorOffset;
  return entries.find(e=>e.el.contains(n)&&e.range.comparePoint(n,o)===0)||null;
}
function capsPlace(){
  prune(); paint(); const e=current(); if(!e){ capsHide(); return; }
  const p=ensurePop(); popFor=e; p.hidden=false;
  const rs=[...e.range.getClientRects()].filter(r=>r.width||r.height); if(!rs.length){ capsHide(); return; }
  const sel=getSelection(), cr=sel.rangeCount?sel.getRangeAt(0).getClientRects()[0]:null;
  const rc=(cr&&rs.find(r=>cr.top<r.bottom&&cr.bottom>r.top))||rs[rs.length-1];
  const w=p.offsetWidth, h=p.offsetHeight;
  let y=rc.bottom+6; if(y+h>innerHeight-8) y=Math.max(8,rc.top-h-6);
  p.style.left=clamp(rc.right-w,8,innerWidth-w-8)+'px'; p.style.top=y+'px';
}

/* ---- akce ---- */
const flip=c=>{ const u=c.toUpperCase(), l=c.toLowerCase(); const r=c===u?l:u; return r.length===1?r:c; };   /* ß → SS by změnilo délku */
function swap(e){
  const el=e.el, r=e.range; if(!el.isConnected) return capsHide();
  const had=document.activeElement===el, off=had?caretOffset(el):null;
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let n;
  const list=[]; while((n=w.nextNode())) if(r.intersectsNode(n)) list.push(n);
  list.forEach(t=>{ const p=t.parentElement; if(p&&p!==el&&p.closest(SKIP)&&el.contains(p.closest(SKIP))) return;
    const a=t===r.startContainer?r.startOffset:0, b=t===r.endContainer?r.endOffset:t.nodeValue.length;
    const v=t.nodeValue, nv=v.slice(0,a)+[...v.slice(a,b)].map(flip).join('')+v.slice(b); if(nv!==v) t.nodeValue=nv; });
  entries=entries.filter(x=>x!==e); seen.delete(e.bid);
  capsKey=false; capsHide(); paint();
  if(had) focusEl(el,off);
  /* uložit jako samostatný krok historie (⌘Z vrátí jedním krokem), stejnou cestou jako psaní */
  el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:''}));
}
function keep(e){
  const l=ok().filter(k=>k!==e.bid+'|'+e.text); l.push(e.bid+'|'+e.text); lsSet(OK_KEY,l.slice(-OK_MAX));
  entries=entries.filter(x=>x!==e); capsHide(); paint();
}

function initCaps(){
  if(!window.CSS||!CSS.highlights||typeof Highlight!=='function') return;
  const view=document.getElementById('view'); if(!view) return;
  view.addEventListener('keydown',e=>{
    const t=e.target; if(!t.classList||!t.classList.contains('txt')||e.key.length!==1||e.metaKey||e.ctrlKey) return;
    if(e.getModifierState) { capsKey=e.getModifierState('CapsLock'); capsEl=t; }
  },true);
  view.addEventListener('input',e=>{
    const t=e.target; if(!capsOn()||!t.classList||!t.classList.contains('txt')||!e.inputType) return;
    clearTimeout(scanT); scanT=setTimeout(()=>scan(t),300);
  });
  let raf=0; const upd=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ if(simpleUi()){ if(entries.length||popFor) capsOff(); return; } if(entries.length) capsPlace(); else if(popFor) capsHide(); }); };
  document.addEventListener('selectionchange',upd);
  document.addEventListener('scroll',upd,true);
  addEventListener('resize',upd);
}
function capsOff(){ entries=[]; if(reg) reg.clear(); capsHide(); }

export { capsOff, initCaps };
