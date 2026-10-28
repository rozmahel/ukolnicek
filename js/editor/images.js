/* Úkolníček – Obrázky: vložení, zmenšení, zarovnání, velikost */
import { $, $$, clamp, esc, IC, lsGet, lsSet, simpleUi, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { IMGURL, savePage } from '../store.js';
import { curPage, newBlock } from '../pages.js';
import { imgSrc, isBlank, isBlankEl } from '../sanitize.js';
import { focusBlock, focusEl } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { hideCellbar, hideFmt } from './toolbar.js';
import { closePop, openModal, openPop, placePop, toast } from '../ui.js';
import { openBlockMenu } from './menus.js';
import { editDrawing } from './draw.js';

/* ================= images ================= */
const IMG_OK=/^image\/(png|jpeg|gif|webp)$/;
function pickFile(){
  return new Promise(res=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/png,image/jpeg,image/gif,image/webp,image/heic,.heic'; inp.hidden=true;
    document.body.appendChild(inp);
    inp.addEventListener('change',()=>{ res(inp.files[0]||null); inp.remove(); });
    inp.addEventListener('cancel',()=>{ res(null); inp.remove(); });
    inp.click();
  });
}
async function loadBitmap(file){
  try{ return await createImageBitmap(file); }
  catch(e){ return await new Promise((res,rej)=>{ const u=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ URL.revokeObjectURL(u); res(im); }; im.onerror=e=>{ URL.revokeObjectURL(u); rej(e); }; im.src=u; }); }
}
async function prepImage(file,MAX){
  const ok=IMG_OK.test(file.type); let bmp;
  try{ bmp=await loadBitmap(file); }catch(e){ if(ok) return {blob:file,nw:0}; throw {code:'decode'}; }
  const nw=bmp.width,nh=bmp.height;
  if(ok&&(file.type==='image/gif'||(file.size<2.5e6&&Math.max(nw,nh)<=MAX))) return {blob:file,nw,nh};
  const sc=Math.min(1,MAX/Math.max(nw,nh)); const c=document.createElement('canvas'); c.width=Math.round(nw*sc); c.height=Math.round(nh*sc);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  const type=file.type==='image/png'&&file.size<6e6?'image/png':'image/jpeg';
  const blob=await new Promise(r=>c.toBlob(r,type,.86));
  return {blob:blob||file,nw:c.width,nh:c.height};
}
async function uploadImage(file){
  try{
    const pr=await prepImage(file,2400);
    const name=String(file.name||'obrázek').slice(0,100);
    const id=await Local.putImage(pr.blob,name);
    IMGURL.set(id,URL.createObjectURL(pr.blob)); noteRatio(id,pr.nw,pr.nh);
    return {id,name,nw:pr.nw};
  }catch(e){ toast(e&&e.code==='decode'?'Tenhle formát obrázku se nepodařilo načíst. Pomůže ho uložit jako JPG nebo PNG.':(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné.':'Obrázek se nepodařilo uložit do zařízení.')); return null; }
}
async function pickImageBlock(pgId,blockId,replace,file){
  file=file||await pickFile(); if(!file) return;
  const im=await uploadImage(file); if(!im) return;
  const pg=S.pages[pgId]; if(!pg) return;
  let bi=pg.blocks.findIndex(b=>b.id===blockId); if(bi<0) bi=pg.blocks.length-1;
  const cw=($('#blocks')||{clientWidth:700}).clientWidth||700;
  const nb=newBlock('image',{img:im.id,name:im.name,w:Math.round(Math.min(im.nw||560,cw,560)),align:'center',caption:''});
  if(replace&&pg.blocks[bi]&&isBlank(pg.blocks[bi].html)&&TEXT_TYPES.includes(pg.blocks[bi].type)) pg.blocks.splice(bi,1,nb); else pg.blocks.splice(bi+1,0,nb);
  const ni=pg.blocks.indexOf(nb); let nx=pg.blocks[ni+1];
  if(!nx||!TEXT_TYPES.includes(nx.type)){ nx=newBlock('p'); pg.blocks.splice(ni+1,0,nx); }
  savePage(pg,0);
  if(curPage()===pg){ rerenderBlocks(); focusBlock(nx.id,0); }
}
async function pickImageInline(host,range,file){
  file=file||await pickFile(); if(!file) return;
  const im=await uploadImage(file); if(!im) return;
  insertInline(host,range,im);
}
function insertInline(host,range,im){
  if(!host||!document.contains(host)){ toast('Obrázek se nepodařilo vložit, místo mezitím zmizelo. Stačí to zkusit znovu.'); return; }
  const inCell=!!host.closest('td');
  const img=document.createElement('img'); img.className='im '+(inCell?'al-center':'al-inline'); img.setAttribute('data-img',im.id); img.setAttribute('data-name',im.name); img.src=imgSrc(im.id,im.name); img.alt=''; img.draggable=false;
  img.setAttribute('width',Math.round(Math.min(im.nw||240,inCell?220:240)));
  let r=range; if(!r||!host.contains(r.startContainer)){ r=document.createRange(); r.selectNodeContents(host); r.collapse(false); }
  r.insertNode(img);
  host.focus({preventScroll:true});
  const nr=document.createRange(); nr.setStartAfter(img); nr.collapse(true); const s=getSelection(); s.removeAllRanges(); s.addRange(nr);
  host.dispatchEvent(new Event('input',{bubbles:true}));
}
async function handleImageFiles(files,host,range){
  const x=ctxOf(host); if(!x) return;
  if(!x.line&&x.b.type==='p'&&isBlankEl(host)){
    for(const f of files){ await pickImageBlock(x.pg.id,x.b.id,true,f); }
    return;
  }
  for(const f of files){ const im=await uploadImage(f); if(im) insertInline(host,range,im); range=null; }
}
function rangeFromPoint(x,y){
  if(document.caretRangeFromPoint) return document.caretRangeFromPoint(x,y);
  if(document.caretPositionFromPoint){ const p=document.caretPositionFromPoint(x,y); if(!p) return null; const r=document.createRange(); r.setStart(p.offsetNode,p.offset); r.collapse(true); return r; }
  return null;
}

/* image selection, tools and resizing */
let imgSel=null;
const frame=document.createElement('div');

/* poměr stran obrázku se pamatuje jen v zařízení (uk-img-ar): obrázek má výšku hned, ještě než se načte,
   takže stránka při překreslení neskáče; do dat se nic nezapisuje */
const AR=new Map(Object.entries(lsGet('uk-img-ar',{})||{}));
let arT=null;
function noteRatio(id,w,h){
  if(!id||!(w>0)||!(h>0)) return; const r=Math.round(w/h*1e4)/1e4; if(AR.get(id)===r) return;
  AR.set(id,r); clearTimeout(arT); arT=setTimeout(()=>lsSet('uk-img-ar',Object.fromEntries(AR)),400);
}
function applyRatio(root){
  if(!root||!root.querySelectorAll) return;
  root.querySelectorAll('img.bimg[data-bimg]').forEach(im=>{ const r=AR.get(im.getAttribute('data-bimg')); if(r) im.style.aspectRatio='auto '+r; });
}

function imgAlign(){ if(!imgSel) return 'center'; if(imgSel.kind==='block') return imgSel.x.b.align||'center'; const m=imgSel.img.className.match(/al-(\w+)/); return m?m[1]:'inline'; }
/* nw = bez obtékání: obrázek vlevo/vpravo na vlastním řádku */
function imgNw(){ if(!imgSel) return false; return imgSel.kind==='block'?!!imgSel.x.b.nw:imgSel.img.classList.contains('nw'); }
const isFloat=()=>{ const al=imgAlign(); return (al==='left'||al==='right')&&!imgNw(); };
const FLOAT_MAX=.6;   /* obtékaný obrázek zabere nejvýš 60 % šířky, aby vedle zbylo místo na text */
function imgContainerW(){ if(!imgSel) return 600; if(imgSel.kind==='block') return ($('#blocks')||{}).clientWidth||700; const td=imgSel.img.closest('td'); return Math.max(60,(td?td.clientWidth-16:imgSel.host.clientWidth)); }
function placeFrame(){
  if(!imgSel) return;
  if(!document.contains(imgSel.img)){ hideImgSel(); closePop(); return; }
  const r=imgSel.img.getBoundingClientRect();
  Object.assign(frame.style,{left:(r.left-2)+'px',top:(r.top-2)+'px',width:(r.width+4)+'px',height:(r.height+4)+'px'});
  frame.classList.toggle('rz-left',imgAlign()==='right'); frame.hidden=false;
}
function hideImgSel(){ if(imgSel){ const blk=imgSel.img.closest('.blk'); if(blk) blk.classList.remove('isel'); } imgSel=null; frame.hidden=true; }
/* klik na obrázek i kresbu: rámeček (a u obrázku v textu nabídka); quiet = jen rámeček (výběr klávesnicí, true posune stránku),
   'frame' = jen rámeček pro roztažení (klik myší, od 4.20.0: nabídka je v ⋮⋮ a na pravém tlačítku); from = blok, odkud se přišlo */
function selectImage(img,quiet,from){
  const x=ctxOf(img); if(!x) return;
  hideFmt(); hideCellbar(); if(quiet!=='hold') closePop(); if(imgSel) hideImgSel();
  const kind=img.classList.contains('bimg')?'block':'inline';
  if(kind==='block'){
    const a=document.activeElement; if(a&&a!==document.body&&a.blur) a.blur();
    getSelection().removeAllRanges();
    const blk=img.closest('.blk'); if(blk) blk.classList.add('isel');
  }
  imgSel={img,kind,x,host:kind==='inline'?img.closest('.txt'):null,from:from||null};
  placeFrame();
  if(quiet){ const r=img.getBoundingClientRect(), m=$('#main'); if(m&&(r.top<70||r.bottom>innerHeight-30)) m.scrollTop+=r.top<70?r.top-90:r.bottom-innerHeight+50; placeFrame(); }
  else if(quiet!=='frame'&&quiet!=='hold') openImgTools();
}
function applyImgWidth(w,commit){
  if(!imgSel) return;
  const cw=imgContainerW(); w=Math.round(clamp(w,48,imgSel.kind==='block'&&isFloat()?cw*FLOAT_MAX:cw));
  if(imgSel.kind==='block'){ imgSel.x.b.w=w; imgSel.img.closest('.blk').style.setProperty('--w',w+'px'); if(commit) savePage(imgSel.x.pg); }
  else { imgSel.img.setAttribute('width',w); if(commit) imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
function applyImgAlign(al,nw){
  if(!imgSel) return;
  if(nw===undefined) nw=imgNw();
  if(imgSel.kind==='block'){ const blk=imgSel.img.closest('.blk'), b=imgSel.x.b; blk.classList.remove('al-left','al-center','al-right'); blk.classList.add('al-'+al); blk.classList.toggle('nw',!!nw); b.align=al; if(nw) b.nw=1; else delete b.nw; savePage(imgSel.x.pg); }
  else { imgSel.img.className='im al-'+al+(nw&&(al==='left'||al==='right')?' nw':''); imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
/* stažení obrázku do zařízení (původní název souboru, přípona podle skutečného formátu) */
const EXT={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg'};
async function downloadImage(id,name){
  const url=IMGURL.get(id); if(!url) return toast('Obrázek v tomhle zařízení ještě není. Stáhne se z Disku (↓).');
  try{
    const blob=await (await fetch(url)).blob(), ext=EXT[blob.type];
    let fn=String(name||'obrázek').replace(/[\\/:*?"<>|]+/g,'_').trim()||'obrázek';
    if(ext&&!new RegExp('\\.'+(ext==='jpg'?'jpe?g':ext)+'$','i').test(fn)) fn=fn.replace(/\.(png|jpe?g|gif|webp|heic|heif)$/i,'')+'.'+ext;
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
  }catch(e){ toast('Obrázek se nepodařilo stáhnout.'); }
}
const imgIdName=sel=>sel.kind==='block'?[sel.x.b.img,sel.x.b.name]:[sel.img.getAttribute('data-img'),sel.img.getAttribute('data-name')];

/* rozvržení jako ve Wordu: obtékat vlevo/vpravo (Čtverec), vlevo/na střed/vpravo bez obtékání (Nahoře a dole), v řádku s textem */
const LAY={wl:['left',0,'Obtékat vlevo'],l:['left',1,'Vlevo, bez obtékání'],c:['center',0,'Na střed'],r:['right',1,'Vpravo, bez obtékání'],wr:['right',0,'Obtékat vpravo'],in:['inline',0,'V řádku s textem']};
const LN=(x1,x2,y)=>`<path d="M${x1} ${y}H${x2}"/>`;
const LAY_IC={
  wl:`<rect x="2" y="3" width="10" height="9" rx="1"/>${LN(15,26,4)}${LN(15,26,8)}${LN(15,26,12)}${LN(2,26,16.5)}`,
  l:`${LN(2,26,2.5)}<rect x="2" y="5.5" width="10" height="8.5" rx="1"/>${LN(2,26,17.5)}`,
  c:`${LN(2,26,2.5)}<rect x="9" y="5.5" width="10" height="8.5" rx="1"/>${LN(2,26,17.5)}`,
  r:`${LN(2,26,2.5)}<rect x="16" y="5.5" width="10" height="8.5" rx="1"/>${LN(2,26,17.5)}`,
  wr:`<rect x="16" y="3" width="10" height="9" rx="1"/>${LN(2,13,4)}${LN(2,13,8)}${LN(2,13,12)}${LN(2,26,16.5)}`,
  in:`${LN(2,26,3.5)}${LN(2,8,14)}<rect x="10" y="7" width="8" height="7" rx="1"/>${LN(20,26,14)}`
};
function curLay(){ const al=imgAlign(), nw=imgNw(); if(al==='inline') return 'in'; if(al==='center') return 'c'; return al==='left'?(nw?'l':'wl'):(nw?'r':'wr'); }
function markTools(p){
  if(!imgSel||!p) return;
  const cur=curLay(), cw=imgContainerW(), w=imgSel.img.getBoundingClientRect().width;
  $$('[data-v^="lay:"]',p).forEach(b=>b.classList.toggle('on',b.dataset.v==='lay:'+cur));
  $$('[data-v^="sz:"]',p).forEach(b=>b.classList.toggle('act',Math.abs(w-cw*parseFloat(b.dataset.v.slice(3)))<8));
  requestAnimationFrame(()=>{ placeFrame(); if(imgSel&&S.popAnchor===imgSel.img) placePop(p,imgSel.img.getBoundingClientRect()); });
}
/* obrázek z textu na samostatný blok: obtékaný jde před odstavec (text ho obteče), jinak tam, kde v textu byl */
function inlineToBlock(al,nw){
  const {img,host,x}=imgSel; if(!x||x.line) return;
  const pre=document.createRange(); pre.selectNodeContents(host); pre.setEndBefore(img);
  const atStart=!pre.toString().trim()&&!pre.cloneContents().querySelector('img');
  const cw=($('#blocks')||{clientWidth:700}).clientWidth||700;
  let w=+img.getAttribute('width')||Math.round(img.getBoundingClientRect().width)||240;
  const flt=al!=='center'&&!nw; if(flt) w=Math.min(w,Math.round(cw*.5));
  const nb=newBlock('image',{img:img.getAttribute('data-img'),name:img.getAttribute('data-name')||'',w:Math.round(clamp(w,48,cw)),align:al,caption:''}); if(nw) nb.nw=1;
  img.remove(); x.b.html=isBlankEl(host)?'':host.innerHTML;
  const pg=x.pg, bi=pg.blocks.indexOf(x.b); pg.blocks.splice(flt||atStart?bi:bi+1,0,nb);
  savePage(pg); hideImgSel(); closePop(); rerenderBlocks();
  const im=$(`#blocks .blk[data-id="${nb.id}"] .bimg`); if(im) selectImage(im);
}
/* nový prázdný řádek nad / pod obrázkem (Enter, ⇧Enter u vybraného obrázku, tlačítka ↵) */
function lineAround(id,before){
  const pg=curPage(); if(!pg) return; const bi=pg.blocks.findIndex(b=>b.id===id); if(bi<0) return;
  const blankP=b=>b&&b.type==='p'&&isBlank(b.html)&&!b.level;
  let nb=before?(blankP(pg.blocks[bi-1])&&pg.blocks[bi-1]):(blankP(pg.blocks[bi+1])&&pg.blocks[bi+1]);
  if(!nb){ nb=newBlock('p'); pg.blocks.splice(before?bi:bi+1,0,nb); savePage(pg); }
  closePop(); hideImgSel(); rerenderBlocks(); focusBlock(nb.id,0);
}
/* smazání vybraného blokového obrázku; kurzor se vrátí tam, odkud se obrázek vybral, jinak k nejbližšímu textu */
function deleteSelected(back){
  if(!imgSel||imgSel.kind!=='block'||LOCK) return;
  const {x,from}=imgSel, pg=x.pg, bi=pg.blocks.indexOf(x.b); if(bi<0) return;
  pg.blocks.splice(bi,1); savePage(pg); hideImgSel(); closePop(); rerenderBlocks();
  toast('Obrázek odstraněn','Vrátit',()=>{ pg.blocks.splice(Math.min(bi,pg.blocks.length),0,x.b); savePage(pg); rerenderBlocks(); });
  const txt=b=>b&&TEXT_TYPES.includes(b.type);
  if(from&&pg.blocks.some(b=>b.id===from)){ const fi=pg.blocks.findIndex(b=>b.id===from); focusBlock(from,fi<bi?'end':0); return; }
  const prev=[...pg.blocks.slice(0,bi)].reverse().find(txt), next=pg.blocks.slice(bi).find(txt);
  if(back&&prev) focusBlock(prev.id,'end'); else if(next) focusBlock(next.id,0); else if(prev) focusBlock(prev.id,'end');
}
/* šipkami mezi textem a obrázky: zastávky jsou nadpis stránky, textová pole bloků a blokové obrázky (v pořadí stránky) */
function navFrom(el,up){
  const stops=$$('#page-title, #blocks .txt, #blocks > .b-image .bimg').filter(s=>s!==el&&!el.contains(s));
  const pos=s=>el.compareDocumentPosition(s);
  const tgt=up?stops.filter(s=>pos(s)&Node.DOCUMENT_POSITION_PRECEDING).pop():stops.find(s=>pos(s)&Node.DOCUMENT_POSITION_FOLLOWING);
  if(!tgt) return false;
  if(tgt.classList.contains('bimg')){ const fb=el.closest&&el.closest('#blocks > .blk'); selectImage(tgt,true,fb&&!fb.classList.contains('b-image')?fb.dataset.id:null); }
  else focusEl(tgt,up?'end':'start');
  return true;
}

/* nabídka obrázku (od 4.20.0): řada rozvržení bez rámečků a položky s ikonou; blokový obrázek ji má v menu ⋮⋮ (menus.js),
   obrázek v textu nebo v buňce přes openImgTools (pravé tlačítko, na dotyk klepnutí) */
function imgMenuHtml(img){
  const kind=img.classList.contains('bimg')?'block':'inline', inCell=kind==='inline'&&!!img.closest('td'), isDraw=img.classList.contains('bdraw'), x=ctxOf(img);
  const keys=inCell?['in','wl','c','wr']:['wl','l','c','r','wr'].concat(kind==='inline'?['in']:[]);
  const it=(v,ic,t)=>`<button class="pop-item" data-v="${v}"><span class="pi-ic">${ic}</span>${t}</button>`;
  /* jednoduchý režim: obrázky jsou pod sebou přes celou šířku, rozvržení jen v plném editoru */
  const lay=simpleUi()?'':`<div class="bm-row lay-row">${keys.map(k=>`<button class="bm-ic lay-b" data-v="lay:${k}" title="${LAY[k][2]}" aria-label="${LAY[k][2]}"><svg viewBox="0 0 28 20" aria-hidden="true">${LAY_IC[k]}</svg></button>`).join('')}</div><div class="pop-sep"></div>`;
  const b=kind==='block'&&x?x.b:null;
  return lay+(isDraw&&!LOCK?it('draw',IC.edit,'Upravit kresbu'):'')
    +(b&&!LOCK?it('cap',IC.caption,b.caption||b.capOn?'Upravit popisek':'Přidat popisek'):'')
    +(simpleUi()||LOCK?'':it('sz:1',IC.wide,'Celá šířka'))
    +it('open',IC.resize,'Zvětšit')+it('dl',IC.download,'Stáhnout');
}
function markImgMenu(img,p){ if(!imgSel||imgSel.img!==img) selectImage(img,'hold'); markTools(p); }
/* akce z nabídky; vrací true, když má nabídka zůstat otevřená */
function imgMenuAct(img,v,p){
  if(!imgSel||imgSel.img!==img) selectImage(img,'hold');
  if(!imgSel) return;
  const kind=imgSel.kind, inCell=kind==='inline'&&!!imgSel.img.closest('td');
  if(v==='draw'){ const im=imgSel.img; hideImgSel(); setTimeout(()=>editDrawing(im),0); return; }
  if(v.startsWith('lay:')){
    const k=v.slice(4), [al,nw]=LAY[k];
    if(kind==='inline'&&!inCell&&k!=='in'){ inlineToBlock(al,!!nw); return; }
    if(k==='in'){ applyImgAlign('inline',false); markTools(p); return true; }
    applyImgAlign(al,!!nw);
    if(kind==='block'&&isFloat()){ const cw=imgContainerW(); if((+imgSel.x.b.w||480)>cw*FLOAT_MAX) applyImgWidth(cw*.5,true); }
    markTools(p); return true;
  }
  if(v.startsWith('sz:')){
    const f=parseFloat(v.slice(3));
    if(kind==='block'&&isFloat()&&f>FLOAT_MAX) applyImgAlign(imgAlign(),true);   /* velký obrázek: obtékání se vypne, zůstane na své straně */
    applyImgWidth(imgContainerW()*f,true); markTools(p); return true;
  }
  if(v==='dl'){ const [id,name]=imgIdName(imgSel); downloadImage(id,name); return true; }
  if(v==='open'){ const src=imgSel.img.src; const cap=kind==='block'?imgSel.x.b.caption:''; const [dlId,dlName]=imgIdName(imgSel); hideImgSel(); const mm=openModal('',`<div class="m-head"><span></span><span class="lb-acts"><button class="btn" data-lbdl>Stáhnout</button><button class="icon-btn" data-close aria-label="Zavřít">${IC.x}</button></span></div><div class="lb"><img id="lb-img" alt="">${cap?`<p>${esc(cap)}</p>`:''}</div>`,'lbm'); $('#lb-img',mm).src=src; $('[data-lbdl]',mm).addEventListener('click',()=>downloadImage(dlId,dlName)); return; }
  if(v==='cap'){ const {x}=imgSel; x.b.capOn=true; savePage(x.pg); hideImgSel(); rerenderBlocks(); const c=$(`#blocks .blk[data-id="${x.b.id}"] .cap`); focusEl(c,'end'); return; }
  if(v==='del'&&!LOCK){
    if(kind==='block'){ deleteSelected(true); return; }
    const host=imgSel.host; imgSel.img.remove(); hideImgSel(); host.dispatchEvent(new Event('input',{bubbles:true}));
  }
}
/* obrázek v textu nebo v buňce: nabídka u obrázku (blokový obrázek ji má v ⋮⋮) */
function openImgTools(){
  const img=imgSel.img;
  if(imgSel.kind==='block'){ const pg=imgSel.x.pg, b=imgSel.x.b; openBlockMenu(img,pg,b); return; }
  const h=imgMenuHtml(img)+(LOCK?'':`<div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit</button>`);
  const pop=openPop(img,h,(v,btn,p)=>imgMenuAct(img,v,p));
  pop.classList.add('bm-pop'); markTools(pop);
}

/* posluchače a nastavení při startu (volá main.js ve stejném pořadí jako dřív) */
export function initImages(){
  frame.id='imgframe';
  frame.hidden=true;
  frame.innerHTML='<span class="rz" role="slider" aria-label="Změnit velikost obrázku"></span>';
  document.body.appendChild(frame);
  try{ document.execCommand('enableObjectResizing',false,false); }catch(_){}
  frame.querySelector('.rz').addEventListener('pointerdown',e=>{
    if(!imgSel) return; e.preventDefault(); e.stopPropagation();
    const rz=e.currentTarget; try{ rz.setPointerCapture(e.pointerId); }catch(_){}
    const startW=imgSel.img.getBoundingClientRect().width, sx=e.clientX, al=imgAlign(); let w=startW;
    const move=ev=>{ let dx=ev.clientX-sx; if(al==='right') dx=-dx; if(al==='center') dx*=2; w=startW+dx; applyImgWidth(w,false); placeFrame(); if(S.pop) placePop(S.pop,imgSel.img.getBoundingClientRect()); };
    const up=()=>{ rz.removeEventListener('pointermove',move); rz.removeEventListener('pointerup',up); rz.removeEventListener('pointercancel',up); applyImgWidth(w,true); placeFrame(); };
    rz.addEventListener('pointermove',move); rz.addEventListener('pointerup',up); rz.addEventListener('pointercancel',up);
  });
  window.addEventListener('resize',()=>placeFrame());
  /* načtený obrázek si zapamatuje poměr stran (jen v zařízení) */
  document.addEventListener('load',e=>{ const im=e.target; if(im&&im.tagName==='IMG'&&im.classList.contains('bimg')){ noteRatio(im.getAttribute('data-bimg'),im.naturalWidth,im.naturalHeight); applyRatio(im.parentElement); } },true);
  /* vybraný blokový obrázek a klávesnice: Enter = řádek pod, ⇧Enter = nad, Backspace/Delete = smazat, šipky = k textu, Esc = zrušit výběr */
  document.addEventListener('keydown',e=>{
    if(!imgSel||imgSel.kind!=='block'||e.isComposing||S.modal||e.metaKey||e.ctrlKey||e.altKey) return;
    const a=document.activeElement; if(a&&a!==document.body&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    const k=e.key;
    if(k==='Escape'){ e.preventDefault(); e.stopPropagation(); closePop(); hideImgSel(); return; }
    if(k==='Enter'){ e.preventDefault(); lineAround(imgSel.x.b.id,e.shiftKey); return; }
    if(k==='Backspace'||k==='Delete'){ e.preventDefault(); deleteSelected(k==='Backspace'); return; }
    if(/^Arrow(Up|Down|Left|Right)$/.test(k)){
      e.preventDefault(); const blk=imgSel.img.closest('.blk'), up=k==='ArrowUp'||k==='ArrowLeft'; closePop(); hideImgSel();
      if(blk&&!navFrom(blk,up)&&!up) lineAround(blk.dataset.id,false);
    }
  },true);
  /* úchyty ⋮⋮ a + u textu vedle obrázku vlevo: k začátku textu, ne až vlevo od obrázku */
  const gut=e=>{ const blk=e.target.closest&&e.target.closest('#blocks > .blk:not(.b-image)'); if(blk) placeGut(blk); };
  const v=$('#view'); if(v){ v.addEventListener('mouseover',gut); v.addEventListener('focusin',gut); }
}
function placeGut(blk){
  const br=blk.getBoundingClientRect(), top=br.top+4, bot=top+24; let gx=0;
  $$('#blocks > .b-image.al-left:not(.nw)').forEach(f=>{
    if(getComputedStyle(f).float!=='left') return;
    const r=f.getBoundingClientRect(); if(r.height&&r.top<bot&&r.bottom>top&&r.left<=br.left+4) gx=Math.max(gx,Math.round(r.right-br.left+22));
  });
  if(gx){ blk.style.setProperty('--gx',gx+'px'); blk.classList.add('bfl'); }
  else if(blk.classList.contains('bfl')){ blk.style.removeProperty('--gx'); blk.classList.remove('bfl'); }
}

export { applyRatio, handleImageFiles, hideImgSel, imgMenuAct, imgMenuHtml, imgSel, lineAround, markImgMenu, navFrom, noteRatio, pickImageBlock, pickImageInline, placeFrame, rangeFromPoint, selectImage };
