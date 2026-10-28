/* Úkolníček – Kreslení (/kreslit)
   Kresba je obrázkový blok s příznakem draw:1. Obrázek je soubor SVG ve stejném úložišti jako ostatní obrázky
   (v zařízení i na Disku podle ID), v hlavním JSONu je jen odkaz. Starší verze ho ukáže jako obyčejný obrázek.
   - v SVG je v <metadata id="uk-draw"> i seznam tahů (JSON) pro další úpravy; při otevření se jen ten načte
     a zkontroluje, surové SVG se do stránky nikdy nevkládá (obrázek v <img> neumí spustit skript)
   - každá uložená úprava = nový soubor s novým ID, starý zůstane bez odkazu (z Disku ho smaže ↑ jako smazaný obrázek)
   - kreslí se ve „světových“ souřadnicích; plátno je ukazuje přes posun a měřítko (view), aby se starší kresba vešla
   - v tmavém režimu se papír i barvy převrací filtrem (css/draw.css), uložený soubor je vždy denní */
import { $, $$, clamp, IC, lsGet, lsSet, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { IMGURL, savePage } from '../store.js';
import { curPage, newBlock } from '../pages.js';
import { isBlank } from '../sanitize.js';
import { focusBlock } from './caret.js';
import { rerenderBlocks } from './render.js';
import { closeModal, closePop, toast } from '../ui.js';
import { noteRatio } from './images.js';

const INK=['#111111','#1f5fd1','#d23b3b','#2b8a3e','#e8740c','#7b3fc4','#8a5a2b','#868e96'];
const HLC=['#ffd43b','#8ce99a','#faa2c1','#74c0fc','#ffa94d'];
const TOOLS={p:{n:'Pero',min:1,max:10,w:2.5},f:{n:'Fix',min:2,max:18,w:5},h:{n:'Zvýrazňovač',min:8,max:44,w:20}};
const HL_A=.38, PAD=14, ER=11, MAX_PTS=20000;
const BGS=[['none','Bez pozadí'],['lines','Linky'],['dots','Tečky'],['grid','Čtverečky']];
const CMS=[['auto','Oříznout na kresbu'],['full','Celé plátno'],['custom','Vlastní ořez']];
/* piktogramy v ⋯ (text je jen v bublině po najetí myši) */
const PIC={
  none:'<rect x="4" y="4" width="16" height="16" rx="2"/>',
  lines:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 14.5h16"/>',
  dots:'<rect x="4" y="4" width="16" height="16" rx="2"/><g fill="currentColor" stroke="none"><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="15" cy="15" r="1.1"/></g>',
  grid:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16"/>',
  auto:'<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 14c2-4 4 2 8-4"/>',
  full:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 14c2-4 4 2 8-4"/>',
  custom:'<path d="M7 3v14h14"/><path d="M3 7h14v14"/>'
};
const pic=k=>`<svg viewBox="0 0 24 24">${PIC[k]}</svg>`;
const GAP={lines:28,dots:24,grid:24};
const DRW_IC={
  p:'<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.2L16 5a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.2 18.8z"/><path d="M14.5 6.5l3 3"/></svg>',
  f:'<svg viewBox="0 0 24 24"><path d="M7 21l-2-2 1.5-4.5L15 6l3 3-8.5 8.5z"/><path d="M15 6l1.8-1.8a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L18 9"/></svg>',
  h:'<svg viewBox="0 0 24 24"><path d="M9 15l-3 3v2h4l2-3"/><path d="M9 15l3 3 8-8-3-3z"/><path d="M4 21h16" opacity=".5"/></svg>',
  crop:'<svg viewBox="0 0 24 24"><path d="M7 3v14h14"/><path d="M3 7h14v14"/></svg>',
  e:'<svg viewBox="0 0 24 24"><path d="M8 20h12"/><path d="M5.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 19H9z"/><path d="M10 11l4 4"/></svg>',
  undo:'<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo:'<svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>'
};

/* ---------- data kresby ---------- */
const r1=v=>Math.round(v*10)/10;
const HEX=/^#[0-9a-f]{6}$/i;
/* kontrola dat z metadat SVG (soubor mohl přijít z Disku): jen čísla, známé typy a barvy, rozumné limity */
function validData(d){
  if(!d||typeof d!=='object'||d.v!==1||!Array.isArray(d.s)||d.s.length>MAX_PTS) return null;
  const num=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e6;
  const out={bg:BGS.some(b=>b[0]===d.bg)?d.bg:'none',crop:d.crop!==false,view:null,s:[]};
  if(Array.isArray(d.view)&&d.view.length===4&&d.view.every(num)&&d.view[2]>0&&d.view[3]>0) out.view=d.view.slice();
  if(out.crop&&Array.isArray(d.box)&&d.box.length===4&&d.box.every(num)&&d.box[2]>0&&d.box[3]>0) out.box=d.box.slice();   /* vlastní ořez */
  let total=0;
  for(const st of d.s){
    if(!st||!TOOLS[st.t]||!HEX.test(st.c||'')||!num(st.w)||st.w<.3||st.w>80||!Array.isArray(st.p)) return null;
    if(st.p.length<2||st.p.length%2||!st.p.every(num)) return null;
    total+=st.p.length; if(total>MAX_PTS*4) return null;
    const o={t:st.t,c:st.c.toLowerCase(),w:st.w,p:st.p.slice()};
    if(st.r!=null){ if(!Array.isArray(st.r)||st.r.length!==st.p.length/2||!st.r.every(v=>num(v)&&v>=0&&v<=1)) return null; o.r=st.r.slice(); }
    out.s.push(o);
  }
  return out;
}
async function readDrawing(id){
  const url=IMGURL.get(id); if(!url) return null;
  try{
    const txt=await (await fetch(url)).text();
    const m=txt.match(/<metadata id="uk-draw">([\s\S]*?)<\/metadata>/); if(!m) return null;
    return validData(JSON.parse(m[1]));
  }catch(_){ return null; }
}
/* cesta tahu: body vyhlazené kvadratickými křivkami přes středy úseků */
function pathD(p,a,b){
  const X=i=>r1(p[2*i]), Y=i=>r1(p[2*i+1]);
  if(a===b) return `M${X(a)} ${Y(a)}l0.01 0`;
  if(b===a+1) return `M${X(a)} ${Y(a)}L${X(b)} ${Y(b)}`;
  let d=`M${X(a)} ${Y(a)}`;
  for(let i=a+1;i<b;i++) d+=`Q${X(i)} ${Y(i)} ${r1((p[2*i]+p[2*i+2])/2)} ${r1((p[2*i+1]+p[2*i+3])/2)}`;
  return d+`L${X(b)} ${Y(b)}`;
}
/* tah jako úseky se stejnou tloušťkou (pero se stylusem mění tloušťku podle přítlaku) */
function runs(st){
  if(st._r) return st._r;
  const n=st.p.length/2;
  if(!st.r) return (st._r=[[pathD(st.p,0,n-1),st.w]]);
  const q=v=>Math.max(.4,Math.round(st.w*(.35+.95*v)*4)/4);
  if(n<2) return (st._r=[[pathD(st.p,0,0),q(st.r[0])]]);
  const out=[]; let start=0, cur=q((st.r[0]+st.r[1])/2);
  for(let i=2;i<n;i++){ const w=q((st.r[i-1]+st.r[i])/2); if(w!==cur){ out.push([pathD(st.p,start,i-1),cur]); start=i-1; cur=w; } }
  out.push([pathD(st.p,start,n-1),cur]);
  return (st._r=out);
}
const maxW=st=>st.r?st.w*1.3:st.w;
function bbox(list){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  list.forEach(st=>{ const h=maxW(st)/2; for(let i=0;i<st.p.length;i+=2){ x0=Math.min(x0,st.p[i]-h); x1=Math.max(x1,st.p[i]+h); y0=Math.min(y0,st.p[i+1]-h); y1=Math.max(y1,st.p[i+1]+h); } });
  return x0===Infinity?null:{x:x0,y:y0,w:x1-x0,h:y1-y0};
}
/* zjednodušení tahu (Ramer–Douglas–Peucker); přítlak jde s body */
function simplify(p,r,eps){
  const n=p.length/2; if(n<3) return {p,r};
  const keep=new Uint8Array(n); keep[0]=keep[n-1]=1;
  const stack=[[0,n-1]];
  while(stack.length){
    const [a,b]=stack.pop(); const ax=p[2*a],ay=p[2*a+1],bx=p[2*b],by=p[2*b+1], dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1e-9;
    let md=0, mi=-1;
    for(let i=a+1;i<b;i++){ const d=Math.abs(dy*p[2*i]-dx*p[2*i+1]+bx*ay-by*ax)/L; if(d>md){ md=d; mi=i; } }
    if(mi>=0&&md>eps){ keep[mi]=1; stack.push([a,mi],[mi,b]); }
  }
  const np=[], nr=r?[]:null;
  for(let i=0;i<n;i++) if(keep[i]){ np.push(r1(p[2*i]),r1(p[2*i+1])); if(nr) nr.push(Math.round(r[i]*100)/100); }
  return {p:np,r:nr};
}

/* ---------- SVG (vždy denní barvy) ---------- */
function patternSvg(bg){
  if(bg==='lines') return `<pattern id="bg" patternUnits="userSpaceOnUse" x="0" y="0" width="${GAP.lines}" height="${GAP.lines}"><path d="M0 ${GAP.lines-.5}H${GAP.lines}" stroke="#d5dae1" stroke-width="1"/></pattern>`;
  if(bg==='dots') return `<pattern id="bg" patternUnits="userSpaceOnUse" x="0" y="0" width="${GAP.dots}" height="${GAP.dots}"><circle cx="${GAP.dots/2}" cy="${GAP.dots/2}" r="1.3" fill="#bcc3cc"/></pattern>`;
  if(bg==='grid') return `<pattern id="bg" patternUnits="userSpaceOnUse" x="0" y="0" width="${GAP.grid}" height="${GAP.grid}"><path d="M${GAP.grid-.5} 0V${GAP.grid}M0 ${GAP.grid-.5}H${GAP.grid}" stroke="#dde2e8" stroke-width="1" fill="none"/></pattern>`;
  return '';
}
function strokeSvg(st){
  const hl=st.t==='h';
  return runs(st).map(([d,w])=>`<path d="${d}" stroke="${st.c}" stroke-width="${w}"${hl?` stroke-opacity="${HL_A}" stroke-linecap="butt"`:''}/>`).join('');
}
function buildSvg(data,box){
  const meta=JSON.stringify({v:1,bg:data.bg,crop:data.crop,view:data.view.map(r1),...(data.box?{box:data.box.map(r1)}:{}),s:data.s.map(st=>Object.assign({t:st.t,c:st.c,w:st.w,p:st.p},st.r?{r:st.r}:{}))})
    .replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const vb=[box.x,box.y,box.w,box.h].map(r1).join(' ');
  const ordered=[...data.s.filter(s=>s.t==='h'),...data.s.filter(s=>s.t!=='h')];   /* zvýrazňovač pod perem a fixou */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.round(box.w)}" height="${Math.round(box.h)}">`
    +`<metadata id="uk-draw">${meta}</metadata>`
    +(data.bg!=='none'?`<defs>${patternSvg(data.bg)}</defs>`:'')
    +`<rect x="${r1(box.x)}" y="${r1(box.y)}" width="${r1(box.w)}" height="${r1(box.h)}" fill="#ffffff"/>`
    +(data.bg!=='none'?`<rect x="${r1(box.x)}" y="${r1(box.y)}" width="${r1(box.w)}" height="${r1(box.h)}" fill="url(#bg)"/>`:'')
    +`<g fill="none" stroke-linecap="round" stroke-linejoin="round">${ordered.map(strokeSvg).join('')}</g></svg>`;
}

/* ---------- editor ---------- */
let E=null;   /* otevřený editor */
const prefs=()=>{ const v=lsGet('uk-draw',null); return Object.assign({tool:'p',p:{c:INK[0],w:TOOLS.p.w},f:{c:INK[1],w:TOOLS.f.w},h:{c:HLC[0],w:TOOLS.h.w},sm:.5,bg:'none',cm:'auto'},v&&typeof v==='object'?v:{}); };
const savePrefs=()=>{ if(E) lsSet('uk-draw',E.pf); };

/* otevře editor: nová kresba (target={pgId, blockId, replace}) nebo úprava existující (target={pgId, blockId, edit:true}) */
async function openDraw(target){
  if(E) return;
  let data=null, oldVw=0;
  if(target.edit){
    const pg=S.pages[target.pgId], b=pg&&pg.blocks.find(x=>x.id===target.blockId); if(!b) return;
    if(!IMGURL.has(b.img)) return toast('Kresba v tomhle zařízení ještě není. Stáhne se z Disku (↓).');
    data=await readDrawing(b.img);
    if(!data) return toast('Kresbu se nepodařilo načíst pro úpravy.');
    const bb=data.crop?bbox(data.s):null; oldVw=data.box?data.box[2]:data.crop?(bb?bb.w+2*PAD:0):(data.view?data.view[2]:0);
  }
  closePop();
  const pf=prefs(); if(pf.tool==='crop') pf.tool='p';
  const cm=data?(data.box?'custom':data.crop?'auto':'full'):(pf.cm==='full'||pf.crop===false?'full':'auto');
  E={target,pf,strokes:data?data.s:[],bg:data?data.bg:pf.bg,cm,box:data&&data.box?{x:data.box[0],y:data.box[1],w:data.box[2],h:data.box[3]}:null,oldView:data&&data.view,oldVw,hist:[],hi:0,
     view:{s:1,ox:0,oy:0},cur:null,pen:false,changed:false,er:null,ptr:null};
  E.hist=[E.strokes.slice()];
  const ov=document.createElement('div'); ov.className='drw-ov';
  ov.innerHTML=`<div class="drw" role="dialog" aria-modal="true" aria-label="Kreslení">
    <div class="drw-bar">
      <div class="drw-grp">${['p','f','h'].map(t=>`<button class="drw-b" data-d="tool" data-t="${t}" title="${TOOLS[t].n}" aria-label="${TOOLS[t].n}">${DRW_IC[t]}</button>`).join('')}<button class="drw-b" data-d="tool" data-t="e" title="Guma (maže celé tahy)" aria-label="Guma">${DRW_IC.e}</button><button class="drw-b" data-d="tool" data-t="crop" title="Vlastní ořez (tažením rámečku)" aria-label="Vlastní ořez">${DRW_IC.crop}</button></div>
      <div class="drw-grp"><button class="drw-b drw-col" data-d="col" title="Barva" aria-label="Barva"><span class="drw-sw"></span></button><button class="drw-b drw-wid" data-d="wid" title="Tloušťka" aria-label="Tloušťka"><span class="drw-dot"></span></button></div>
      <div class="drw-grp"><button class="drw-b" data-d="undo" title="Zpět (⌘Z)" aria-label="Zpět">${DRW_IC.undo}</button><button class="drw-b" data-d="redo" title="Znovu (⇧⌘Z)" aria-label="Znovu">${DRW_IC.redo}</button><button class="drw-b drw-more" data-d="more" title="Pozadí, vyhlazení, ořez" aria-label="Další volby">${IC.more}</button></div>
      <span class="drw-sp"></span>
      <div class="drw-grp drw-end"><button class="btn" data-d="cancel">Zavřít</button><button class="btn pri" data-d="done" title="Enter">Uložit</button></div>
    </div>
    <div class="drw-wrap"><div class="drw-stage"><canvas class="cv-bg"></canvas><canvas class="cv-hl"></canvas><canvas class="cv-live"></canvas><canvas class="cv-ink"></canvas></div><div class="drw-crop" hidden><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div>
    <div class="drw-pop" hidden></div>
  </div>`;
  document.body.appendChild(ov);
  closeModal(); S.modal=ov; E.ov=ov;
  E.stage=$('.drw-stage',ov); E.pop=$('.drw-pop',ov); E.crEl=$('.drw-crop',ov);
  E.cv={bg:$('.cv-bg',ov),hl:$('.cv-hl',ov),live:$('.cv-live',ov),ink:$('.cv-ink',ov)};
  fitView(true); drawAll(); syncBar();
  ov.addEventListener('click',onBarClick);
  E.pop.addEventListener('input',onPopInput);
  E.pop.addEventListener('change',onPopInput);
  const st=E.stage;
  st.addEventListener('pointerdown',onDown);
  st.addEventListener('pointermove',onMove);
  st.addEventListener('pointerup',onUp);
  st.addEventListener('pointercancel',onUp);
  st.addEventListener('pointerleave',()=>{ if(E&&E.ptr==null) clearLive(); });
  st.addEventListener('contextmenu',e=>e.preventDefault());
  E.ro=new ResizeObserver(()=>{ if(E){ fitView(false); drawAll(); } }); E.ro.observe(st);
  placeCrop();
  addEventListener('keydown',onKey,true);
}
function closeDraw(){
  if(!E) return;
  removeEventListener('keydown',onKey,true);
  if(E.ro) E.ro.disconnect();
  const ov=E.ov; E=null;
  if(S.modal===ov) closeModal(); else ov.remove();
}
/* velikost plátna a posun/měřítko: kresba zůstane na místě, a když se do okna nevejde, zmenší se a vystředí */
function fitView(first){
  const rc=E.stage.getBoundingClientRect(), cw=Math.max(50,rc.width), ch=Math.max(50,rc.height), dpr=Math.min(3,window.devicePixelRatio||1);
  E.cw=cw; E.ch=ch; E.dpr=dpr;
  Object.values(E.cv).forEach(c=>{ c.width=Math.round(cw*dpr); c.height=Math.round(ch*dpr); });
  if(!first) return;
  let b=bbox(E.strokes);
  const extra=E.box?E.box:E.oldView&&E.cm==='full'?{x:E.oldView[0],y:E.oldView[1],w:E.oldView[2],h:E.oldView[3]}:null;
  if(extra){ const o=extra; b=b?{x:Math.min(b.x,o.x),y:Math.min(b.y,o.y),w:Math.max(b.x+b.w,o.x+o.w)-Math.min(b.x,o.x),h:Math.max(b.y+b.h,o.y+o.h)-Math.min(b.y,o.y)}:o; }
  if(!b||(b.x>=0&&b.y>=0&&b.x+b.w<=cw&&b.y+b.h<=ch)){ E.view={s:1,ox:0,oy:0}; return; }
  const s=Math.min(1,(cw-40)/b.w,(ch-40)/b.h);
  E.view={s,ox:(cw-b.w*s)/2-b.x*s,oy:(ch-b.h*s)/2-b.y*s};
}
const cvCtx=c=>{ const x=c.getContext('2d'); const v=E.view; x.setTransform(E.dpr*v.s,0,0,E.dpr*v.s,E.dpr*v.ox,E.dpr*v.oy); return x; };
function clearCv(c){ const x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,c.width,c.height); }
function paintStroke(x,st){
  const hl=st.t==='h';
  x.strokeStyle=st.c; x.lineJoin='round'; x.lineCap=hl?'butt':'round'; x.globalAlpha=hl?HL_A:1;
  runs(st).forEach(([d,w])=>{ x.lineWidth=w; x.stroke(new Path2D(d)); });
  x.globalAlpha=1;
}
function drawBg(){
  const c=E.cv.bg; clearCv(c); if(E.bg==='none') return;
  const x=cvCtx(c), v=E.view, g=GAP[E.bg];
  const wx0=-v.ox/v.s, wy0=-v.oy/v.s, wx1=(E.cw-v.ox)/v.s, wy1=(E.ch-v.oy)/v.s;
  const sx=Math.floor(wx0/g)*g, sy=Math.floor(wy0/g)*g;
  x.lineWidth=1;
  if(E.bg==='dots'){ x.fillStyle='#bcc3cc'; for(let y=sy;y<wy1;y+=g) for(let xx=sx;xx<wx1;xx+=g){ x.beginPath(); x.arc(xx+g/2,y+g/2,1.3,0,7); x.fill(); } return; }
  x.strokeStyle=E.bg==='lines'?'#d5dae1':'#dde2e8'; x.beginPath();
  for(let y=sy;y<wy1;y+=g){ x.moveTo(wx0,y+g-.5); x.lineTo(wx1,y+g-.5); }
  if(E.bg==='grid') for(let xx=sx;xx<wx1;xx+=g){ x.moveTo(xx+g-.5,wy0); x.lineTo(xx+g-.5,wy1); }
  x.stroke();
}
function drawLayers(){
  clearCv(E.cv.hl); clearCv(E.cv.ink);
  const xh=cvCtx(E.cv.hl), xi=cvCtx(E.cv.ink);
  E.strokes.forEach(st=>paintStroke(st.t==='h'?xh:xi,st));
}
function drawAll(){ drawBg(); drawLayers(); clearLive(); placeCrop(); }
function clearLive(){ clearCv(E.cv.live); }

/* ---------- kreslení ---------- */
/* tlačítko na boku pera (S Pen apod.) nebo guma na konci pera: dokud je stisknuté, kreslí guma */
const penErase=e=>e.pointerType==='pen'&&((e.buttons&2)||(e.buttons&32)||e.button===2||e.button===5);
const toWorld=e=>{ const rc=E.stage.getBoundingClientRect(), v=E.view; return [(e.clientX-rc.left-v.ox)/v.s,(e.clientY-rc.top-v.oy)/v.s]; };
function onDown(e){
  if(!E||E.ptr!=null) return;
  if(e.pointerType==='pen') E.pen=true;
  if(E.pen&&e.pointerType==='touch') return;          /* se stylusem prsty a dlaň nekreslí */
  if(e.pointerType==='mouse'&&e.button!==0) return;
  e.preventDefault(); hidePop();
  try{ E.stage.setPointerCapture(e.pointerId); }catch(_){}
  E.ptr=e.pointerId;
  const [x,y]=toWorld(e);
  if(E.pf.tool==='crop'){ cropDown(e,x,y); return; }
  if(E.pf.tool==='e'||penErase(e)){ E.er={hit:false}; eraseAt(x,y); showEraser(x,y); return; }
  const t=E.pf.tool, o=E.pf[t];
  E.cur={t,c:o.c,w:o.w,p:[x,y],r:e.pointerType==='pen'&&t==='p'?[e.pressure||.5]:null,raw:[x,y]};
  E.cv.live.style.zIndex=t==='h'?3:5;
  queueLive();
}
function onMove(e){
  if(!E) return;
  if(E.ptr==null){ if((E.pf.tool==='e'||penErase(e))&&e.pointerType!=='touch'){ const [x,y]=toWorld(e); clearLive(); showEraser(x,y); } else if(e.pointerType==='pen'&&!E.cur) clearLive(); return; }
  if(e.pointerId!==E.ptr) return;
  e.preventDefault();
  if(E.cr){ cropMove(...toWorld(e)); return; }
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[]; const list=evs.length?evs:[e];
  if(E.er){ list.forEach(ev=>{ const [x,y]=toWorld(ev); eraseAt(x,y); }); const [x,y]=toWorld(e); clearLive(); showEraser(x,y); return; }
  const c=E.cur; if(!c) return;
  const k=1-.8*E.pf.sm;                 /* vyhlazení během tahu: nový bod se jen přiblíží k pozici pera */
  list.forEach(ev=>{
    const [x,y]=toWorld(ev), n=c.p.length;
    c.raw=[x,y];
    if(Math.hypot(x-c.p[n-2],y-c.p[n-1])*E.view.s<.6) return;
    c.p.push(c.p[n-2]+(x-c.p[n-2])*k,c.p[n-1]+(y-c.p[n-1])*k);
    if(c.r) c.r.push(ev.pressure||.5);
  });
  if(c.p.length>MAX_PTS) onUp(e); else queueLive();
}
function onUp(e){
  if(!E||e.pointerId!==E.ptr) return;
  E.ptr=null;
  if(E.cr){ E.cr=null; E.changed=true; return; }
  if(E.er){ const hit=E.er.hit; E.er=null; clearLive(); if(hit) pushHist(); return; }
  const c=E.cur; E.cur=null; clearLive(); if(!c) return;
  const n=c.p.length; if(Math.hypot(c.raw[0]-c.p[n-2],c.raw[1]-c.p[n-1])>.5){ c.p.push(c.raw[0],c.raw[1]); if(c.r) c.r.push(c.r[c.r.length-1]); }
  if(c.t==='h'&&c.p.length<4) return;
  const sm=simplify(c.p,c.r,(.2+1.6*E.pf.sm)/E.view.s);
  const st={t:c.t,c:c.c,w:c.w,p:sm.p}; if(sm.r) st.r=sm.r;
  E.strokes.push(st); pushHist();
  paintStroke(cvCtx(st.t==='h'?E.cv.hl:E.cv.ink),st);
}
let liveRaf=0;
function queueLive(){ if(!liveRaf) liveRaf=requestAnimationFrame(()=>{ liveRaf=0; if(!E||!E.cur) return; clearLive(); const c=E.cur; const tmp={t:c.t,c:c.c,w:c.w,p:c.p.concat(c.raw),r:c.r?c.r.concat(c.r[c.r.length-1]):null}; const x=cvCtx(E.cv.live); paintStroke(x,tmp); }); }
function showEraser(x,y){ const c=cvCtx(E.cv.live); E.cv.live.style.zIndex=5; c.lineWidth=1/E.view.s; c.strokeStyle='#868e96'; c.beginPath(); c.arc(x,y,ER/E.view.s,0,7); c.stroke(); }
/* guma: smaže celé tahy, kterých se dotkne */
function eraseAt(x,y){
  const r=ER/E.view.s; let any=false;
  E.strokes=E.strokes.filter(st=>{
    const lim=r+maxW(st)/2, p=st.p;
    for(let i=0;i<p.length;i+=2){
      const ax=p[i],ay=p[i+1], bx=i+2<p.length?p[i+2]:ax, by=i+2<p.length?p[i+3]:ay;
      const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy, t=L?clamp(((x-ax)*dx+(y-ay)*dy)/L,0,1):0;
      if(Math.hypot(ax+t*dx-x,ay+t*dy-y)<=lim){ any=true; return false; }
    }
    return true;
  });
  if(any){ E.er.hit=true; drawLayers(); }
}
function pushHist(){ E.hist=E.hist.slice(0,E.hi+1); E.hist.push(E.strokes.slice()); E.hi=E.hist.length-1; E.changed=true; syncBar(); }
function drawUndo(d){ const i=E.hi+d; if(i<0||i>=E.hist.length) return; E.hi=i; E.strokes=E.hist[i].slice(); E.changed=true; drawLayers(); syncBar(); }

/* ---------- lišta a bubliny ---------- */
function syncBar(){
  const ov=E.ov, t=E.pf.tool, o=E.pf[t];
  $$('[data-d="tool"]',ov).forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  const col=$('.drw-col',ov), wid=$('.drw-wid',ov);
  col.disabled=wid.disabled=t==='e'||t==='crop';
  E.stage.classList.toggle('cropping',t==='crop'); placeCrop();
  if(o){ $('.drw-sw',ov).style.background=o.c; const dot=$('.drw-dot',ov), px=clamp(o.w*(t==='h'?.45:1),2,18); dot.style.width=dot.style.height=px+'px'; dot.style.background=t==='h'?o.c:'currentColor'; }
  $('[data-d="undo"]',ov).disabled=E.hi<=0; $('[data-d="redo"]',ov).disabled=E.hi>=E.hist.length-1;
  $('[data-d="done"]',ov).disabled=!E.strokes.length;
}
function hidePop(){ if(E&&E.pop){ E.pop.hidden=true; E.pop.dataset.k=''; } }
function showPop(btn,k,html){
  const p=E.pop; if(!p.hidden&&p.dataset.k===k){ hidePop(); return; }
  p.innerHTML=html; p.dataset.k=k; p.hidden=false;
  const br=btn.getBoundingClientRect(), dr=E.ov.firstElementChild.getBoundingClientRect();
  const left=clamp(br.left-dr.left,8,dr.width-p.offsetWidth-8);
  p.style.left=left+'px'; p.style.top=(br.bottom-dr.top+6)+'px';
}
function colorPop(btn){
  const t=E.pf.tool, list=t==='h'?HLC:INK, cur=E.pf[t].c;
  showPop(btn,'col',`<div class="drw-sws">${list.map(c=>`<button class="drw-swb ${c===cur?'on':''}" data-d="c" data-c="${c}" aria-label="Barva"><span style="background:${c}"></span></button>`).join('')}</div>`);
}
function widthPop(btn){
  const t=E.pf.tool, T=TOOLS[t];
  showPop(btn,'wid',`<label class="drw-row"><span>Tloušťka</span><input type="range" min="${T.min}" max="${T.max}" step="${t==='p'?.5:1}" value="${E.pf[t].w}" data-in="w"></label>`);
}
function morePop(btn){
  const seg=(list,cur,d)=>`<div class="seg drw-seg">${list.map(([k,l])=>`<button class="${cur===k?'on':''}" data-d="${d}" data-v="${k}" title="${l}" aria-label="${l}">${pic(k)}</button>`).join('')}</div>`;
  showPop(btn,'more',`<div class="drw-lbl">Pozadí</div>${seg(BGS,E.bg,'bg')}
    <div class="drw-lbl">Ořez</div>${seg(CMS,E.cm,'cm')}
    <label class="drw-row"><span>Vyhlazení</span><input type="range" min="0" max="1" step=".1" value="${E.pf.sm}" data-in="sm"></label>`);
}
function askDiscard(btn){
  showPop(btn,'ask',`<div class="drw-lbl">Zahodit změny v kresbě?</div><div class="drw-ask"><button class="btn" data-d="keep">Pokračovat</button><button class="btn danger" data-d="discard">Zahodit</button></div>`);
}
function onBarClick(e){
  if(!E) return;
  const b=e.target.closest('[data-d]'); if(!b||b.disabled) return;
  const d=b.dataset.d;
  if(d==='tool'){ if(b.dataset.t==='crop') startCrop(); E.pf.tool=b.dataset.t; savePrefs(); hidePop(); clearLive(); syncBar(); return; }
  if(d==='cm'){ setCropMode(b.dataset.v); $$('[data-d="cm"]',E.pop).forEach(x=>x.classList.toggle('on',x===b)); return; }
  if(d==='col') return colorPop(b);
  if(d==='wid') return widthPop(b);
  if(d==='more') return morePop(b);
  if(d==='c'){ E.pf[E.pf.tool].c=b.dataset.c; savePrefs(); hidePop(); syncBar(); return; }
  if(d==='bg'){ E.bg=b.dataset.v; E.pf.bg=E.bg; E.changed=true; savePrefs(); $$('[data-d="bg"]',E.pop).forEach(x=>x.classList.toggle('on',x===b)); drawBg(); return; }
  if(d==='undo'||d==='redo'){ hidePop(); drawUndo(d==='undo'?-1:1); return; }
  if(d==='cancel') return cancel(b);
  if(d==='keep') return hidePop();
  if(d==='discard') return closeDraw();
  if(d==='done') return finish();
}
function onPopInput(e){
  const k=e.target.dataset.in; if(!k||!E) return;
  if(k==='w'){ E.pf[E.pf.tool].w=+e.target.value; syncBar(); }
  else if(k==='sm') E.pf.sm=+e.target.value;
  savePrefs();
}
function cancel(btn){
  if(E.changed&&(E.strokes.length||E.target.edit)) return askDiscard(btn||$('[data-d="cancel"]',E.ov));
  closeDraw();
}
function onKey(e){
  if(!E) return;
  const mod=e.metaKey||e.ctrlKey;
  if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); if(!E.pop.hidden) hidePop(); else cancel(); return; }
  if(mod&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.stopPropagation(); drawUndo(e.shiftKey?1:-1); return; }
  if(mod&&e.key.toLowerCase()==='y'){ e.preventDefault(); e.stopPropagation(); drawUndo(1); return; }
  if(e.key==='Enter'&&!e.isComposing&&!e.shiftKey&&!e.altKey){ e.preventDefault(); e.stopPropagation(); if(E.pop.dataset.k!=='ask') finish(); return; }
  if(e.target.closest&&e.target.closest('input')) return;
  if(mod) { e.stopPropagation(); return; }   /* ⌘S, ⌘K… v kreslení nic nedělají */
  e.stopPropagation();
}

/* ---------- vlastní ořez: rámeček v souřadnicích kresby ----------
   táhnutí mimo rámeček nakreslí nový, uvnitř ho posune, za roh změní velikost */
const MIN_CROP=24;
function startCrop(){
  if(!E.box){
    const b=bbox(E.strokes), v=visibleRect();
    E.box=b?{x:b.x-PAD,y:b.y-PAD,w:b.w+2*PAD,h:b.h+2*PAD}:{x:v[0]+v[2]*.2,y:v[1]+v[3]*.2,w:v[2]*.6,h:v[3]*.6};
  }
  if(E.cm!=='custom'){ E.cm='custom'; E.changed=true; }
}
function setCropMode(m){
  if(m==='custom'){ startCrop(); E.pf.tool='crop'; }
  else { E.cm=m; E.pf.cm=m; E.changed=true; if(E.pf.tool==='crop') E.pf.tool='p'; }
  savePrefs(); syncBar();
}
function cropDown(e,x,y){
  const b=E.box, s=E.view.s, tol=16/s;
  let mode='new', corner='';
  if(b){
    const near=(px,py)=>Math.abs(x-px)<=tol&&Math.abs(y-py)<=tol;
    if(near(b.x,b.y)) corner='nw'; else if(near(b.x+b.w,b.y)) corner='ne'; else if(near(b.x,b.y+b.h)) corner='sw'; else if(near(b.x+b.w,b.y+b.h)) corner='se';
    if(corner) mode='size'; else if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h) mode='move';
  }
  E.cr={mode,corner,x0:x,y0:y,b0:b?Object.assign({},b):null};
  if(mode==='new') E.box={x,y,w:0,h:0};
  E.cm='custom'; placeCrop();
}
function cropMove(x,y){
  const c=E.cr, m=MIN_CROP/E.view.s;
  if(c.mode==='move'){ E.box=Object.assign({},c.b0,{x:c.b0.x+x-c.x0,y:c.b0.y+y-c.y0}); }
  else {
    let x0,y0,x1,y1;
    if(c.mode==='new'){ x0=c.x0; y0=c.y0; x1=x; y1=y; }
    else { x0=c.b0.x; y0=c.b0.y; x1=c.b0.x+c.b0.w; y1=c.b0.y+c.b0.h; if(c.corner[1]==='w') x0=x; else x1=x; if(c.corner[0]==='n') y0=y; else y1=y; }
    const lx=Math.min(x0,x1), ly=Math.min(y0,y1);
    E.box={x:lx,y:ly,w:Math.max(m,Math.abs(x1-x0)),h:Math.max(m,Math.abs(y1-y0))};
  }
  placeCrop();
}
function placeCrop(){
  if(!E||!E.crEl) return;
  const el=E.crEl, b=E.box, on=E.cm==='custom'&&b;
  el.hidden=!on; if(!on) return;
  const v=E.view;
  Object.assign(el.style,{left:(b.x*v.s+v.ox)+'px',top:(b.y*v.s+v.oy)+'px',width:(b.w*v.s)+'px',height:(b.h*v.s)+'px'});
  el.classList.toggle('act',E.pf.tool==='crop');
}

/* ---------- uložení ---------- */
function visibleRect(){ const v=E.view; return [-v.ox/v.s,-v.oy/v.s,E.cw/v.s,E.ch/v.s]; }
async function finish(){
  if(!E||!E.strokes.length) return;
  const view=visibleRect();
  const custom=E.cm==='custom'&&E.box;
  const data={bg:E.bg,crop:E.cm!=='full',view,s:E.strokes};
  let box;
  if(custom){ box=Object.assign({},E.box); data.box=[box.x,box.y,box.w,box.h]; }
  else if(E.cm!=='full'){ const b=bbox(E.strokes); box={x:b.x-PAD,y:b.y-PAD,w:b.w+2*PAD,h:b.h+2*PAD}; }
  else box={x:view[0],y:view[1],w:view[2],h:view[3]};
  const svg=buildSvg(data,box), blob=new Blob([svg],{type:'image/svg+xml'});
  let id;
  try{ id=await Local.putImage(blob,'Kresba'); IMGURL.set(id,URL.createObjectURL(blob)); noteRatio(id,box.w,box.h); }
  catch(e){ toast(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné.':'Kresbu se nepodařilo uložit do zařízení.'); return; }
  const {target,oldVw}=E; closeDraw();
  const pg=S.pages[target.pgId]; if(!pg) return toast('Stránka mezitím zmizela, kresba se nevložila.');
  const cw=($('#blocks')||{clientWidth:700}).clientWidth||700;
  let bi=pg.blocks.findIndex(b=>b.id===target.blockId), nb;
  if(target.edit){
    const b=pg.blocks[bi]; if(!b) return toast('Blok s kresbou mezitím zmizel.');
    const w=+b.w||Math.min(box.w,cw);
    b.img=id; b.w=Math.round(clamp(oldVw?w*box.w/oldVw:Math.min(box.w,cw),48,Math.max(48,cw)));
    savePage(pg); if(curPage()===pg) rerenderBlocks();
    return;
  }
  if(bi<0) bi=pg.blocks.length-1;
  nb=newBlock('image',{img:id,name:'Kresba',w:Math.round(Math.min(box.w,cw)),align:'center',caption:'',draw:1});
  const cur=pg.blocks[bi];
  if(target.replace&&cur&&cur.type==='p'&&isBlank(cur.html)) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
  const ni=pg.blocks.indexOf(nb); let nx=pg.blocks[ni+1];
  if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); pg.blocks.splice(ni+1,0,nx); }
  savePage(pg);
  if(curPage()===pg){ rerenderBlocks(); focusBlock(nx.id,0); }
}

/* klik na kresbu ve stránce */
function editDrawing(img){
  const blk=img.closest('.blk[data-id]'), pg=curPage(); if(!blk||!pg) return;
  openDraw({pgId:pg.id,blockId:blk.dataset.id,edit:true});
}

export { editDrawing, openDraw };
