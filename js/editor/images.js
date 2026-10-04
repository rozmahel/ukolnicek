/* Úkolníček – Obrázky: vložení, zmenšení, zarovnání, velikost */
import { $, $$, clamp, esc, TEXT_TYPES } from '../core.js';
import { S } from '../state.js';
import { LOCK } from '../lock.js';
import { IMGURL, savePage } from '../store.js';
import { curPage, newBlock } from '../pages.js';
import { imgSrc, isBlank, isBlankEl } from '../sanitize.js';
import { focusBlock, focusEl } from './caret.js';
import { ctxOf, rerenderBlocks } from './render.js';
import { hideCellbar, hideFmt } from './toolbar.js';
import { closePop, openModal, openPop, placePop, toast } from '../ui.js';

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
    IMGURL.set(id,URL.createObjectURL(pr.blob));
    return {id,name,nw:pr.nw};
  }catch(e){ toast(e&&e.code==='decode'?'Tenhle formát obrázku se nepodařilo načíst. Ulož ho jako JPG nebo PNG.':(e&&e.name==='QuotaExceededError'?'Úložiště v zařízení je plné.':'Obrázek se nepodařilo uložit do zařízení.')); return null; }
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
  if(!host||!document.contains(host)){ toast('Obrázek se nepodařilo vložit, místo mezitím zmizelo. Zkus to znovu.'); return; }
  const inCell=!!host.closest('td');
  const img=document.createElement('img'); img.className='im '+(inCell?'al-center':'al-left'); img.setAttribute('data-img',im.id); img.setAttribute('data-name',im.name); img.src=imgSrc(im.id,im.name); img.alt=''; img.draggable=false;
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

function imgAlign(){ if(!imgSel) return 'center'; if(imgSel.kind==='block') return imgSel.x.b.align||'center'; const m=imgSel.img.className.match(/al-(\w+)/); return m?m[1]:'inline'; }
function imgContainerW(){ if(!imgSel) return 600; if(imgSel.kind==='block') return ($('#blocks')||{}).clientWidth||700; const td=imgSel.img.closest('td'); return Math.max(60,(td?td.clientWidth-16:imgSel.host.clientWidth)); }
function placeFrame(){
  if(!imgSel) return;
  if(!document.contains(imgSel.img)){ hideImgSel(); closePop(); return; }
  const r=imgSel.img.getBoundingClientRect();
  Object.assign(frame.style,{left:(r.left-2)+'px',top:(r.top-2)+'px',width:(r.width+4)+'px',height:(r.height+4)+'px'});
  frame.classList.toggle('rz-left',imgAlign()==='right'); frame.hidden=false;
}
function hideImgSel(){ imgSel=null; frame.hidden=true; }
function selectImage(img){
  const x=ctxOf(img); if(!x) return;
  hideFmt(); hideCellbar();
  const kind=img.classList.contains('bimg')?'block':'inline';
  imgSel={img,kind,x,host:kind==='inline'?img.closest('.txt'):null};
  placeFrame(); openImgTools();
}
function applyImgWidth(w,commit){
  if(!imgSel) return;
  w=Math.round(clamp(w,48,imgContainerW()));
  if(imgSel.kind==='block'){ imgSel.x.b.w=w; imgSel.img.closest('.blk').style.setProperty('--w',w+'px'); if(commit) savePage(imgSel.x.pg); }
  else { imgSel.img.setAttribute('width',w); if(commit) imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
function applyImgAlign(al){
  if(!imgSel) return;
  if(imgSel.kind==='block'){ const blk=imgSel.img.closest('.blk'); blk.classList.remove('al-left','al-center','al-right'); blk.classList.add('al-'+al); imgSel.x.b.align=al; savePage(imgSel.x.pg); }
  else { imgSel.img.className='im al-'+al; imgSel.host.dispatchEvent(new Event('input',{bubbles:true})); }
}
function openImgTools(){
  const al=imgAlign(), kind=imgSel.kind, cw=imgContainerW(), cur=imgSel.img.getBoundingClientRect().width;
  const sizes=[['25','Malý',.25],['50','Střední',.5],['75','Velký',.75],['100','Celá šířka',1]];
  const h=`<div class="pop-h">Zarovnání</div><div class="it-row">
      <button class="${al==='left'?'on':''}" data-v="al:left">⇤ Vlevo</button><button class="${al==='center'?'on':''}" data-v="al:center">Na střed</button><button class="${al==='right'?'on':''}" data-v="al:right">Vpravo ⇥</button>${kind==='inline'?`<button class="${al==='inline'?'on':''}" data-v="al:inline">V řádku</button>`:''}</div>
    <p class="note" style="padding:0 8px 4px">${kind==='block'?'Vlevo a vpravo: text dalších bloků obteče obrázek.':'Vlevo a vpravo: text obteče obrázek.'}</p>
    <div class="pop-h">Velikost</div><div class="it-row">${sizes.map(([k,l,f])=>`<button class="${Math.abs(cur-cw*f)<8?'on':''}" data-v="sz:${f}">${l}</button>`).join('')}</div>
    <p class="note" style="padding:0 8px 4px">Nebo táhni za roh obrázku.</p>
    <div class="pop-sep"></div><div class="it-row">${kind==='block'?`<button data-v="cap">${imgSel.x.b.caption||imgSel.x.b.capOn?'Upravit popisek':'Přidat popisek'}</button>`:''}<button data-v="open">Zvětšit</button>${LOCK?'':'<button class="danger" data-v="del">Smazat</button>'}</div>`;
  openPop(imgSel.img,h,(v,btn,p)=>{
    if(!imgSel) return;
    if(v.startsWith('al:')){ applyImgAlign(v.slice(3)); $$('[data-v^="al:"]',p).forEach(b=>b.classList.toggle('on',b===btn)); requestAnimationFrame(()=>{ placeFrame(); placePop(p,imgSel.img.getBoundingClientRect()); }); return true; }
    if(v.startsWith('sz:')){ applyImgWidth(imgContainerW()*parseFloat(v.slice(3)),true); $$('[data-v^="sz:"]',p).forEach(b=>b.classList.toggle('on',b===btn)); requestAnimationFrame(()=>{ placeFrame(); placePop(p,imgSel.img.getBoundingClientRect()); }); return true; }
    if(v==='open'){ const src=imgSel.img.src; const cap=kind==='block'?imgSel.x.b.caption:''; hideImgSel(); const mm=openModal('',`<div class="m-head"><span></span><button class="icon-btn" data-close aria-label="Zavřít">×</button></div><div class="lb"><img id="lb-img" alt="">${cap?`<p>${esc(cap)}</p>`:''}</div>`,'lbm'); $('#lb-img',mm).src=src; return; }
    if(v==='cap'){ const {x}=imgSel; x.b.capOn=true; savePage(x.pg); hideImgSel(); rerenderBlocks(); const c=$(`#blocks .blk[data-id="${x.b.id}"] .cap`); focusEl(c,'end'); return; }
    if(v==='del'&&!LOCK){
      if(kind==='block'){ const {x}=imgSel; const bi=x.pg.blocks.indexOf(x.b); if(bi<0) return; x.pg.blocks.splice(bi,1); savePage(x.pg); hideImgSel(); rerenderBlocks(); toast('Obrázek smazán','Vrátit',()=>{ x.pg.blocks.splice(Math.min(bi,x.pg.blocks.length),0,x.b); savePage(x.pg); rerenderBlocks(); }); }
      else { const host=imgSel.host; imgSel.img.remove(); hideImgSel(); host.dispatchEvent(new Event('input',{bubbles:true})); }
    }
  });
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
}

export { handleImageFiles, hideImgSel, imgSel, pickImageBlock, pickImageInline, placeFrame, rangeFromPoint, selectImage };
