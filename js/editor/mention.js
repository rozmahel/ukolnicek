/* Úkolníček – Nabídka „@“ (datum, odkaz na stránku nebo předmět) a zpětné odkazy „Odkazuje sem“
   Odkaz v textu: <a class="mention" data-page="id"> nebo <a class="mention" data-subj="id">, text je kopie názvu
   (při vykreslení se obnoví podle aktuálního názvu). Datum se vloží jako text „12. 10.“, takže z úkolu hned je termín. */
import { $, clamp, DAYS_FULL, esc, norm, plain } from '../core.js';
import { S } from '../state.js';
import { parseDue } from '../dates.js';
import { flatPages, pIcon, pTitle } from '../pages.js';
import { isIndex, subjLabel, subjList } from '../school.js';
import { caretOffset, caretRect, deleteOffsets } from './caret.js';
import { closeModal, openModal, placePop } from '../ui.js';

let men={open:false};
const crumbsOf=pg=>{ const out=[pg]; let p=S.pages[pg.parent]; while(p&&out.length<8){ out.unshift(p); p=S.pages[p.parent]; } return out; };
const dLabel=d=>`${d.getDate()}. ${d.getMonth()+1}.`;
const addDays=n=>{ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return d; };

/* položky podle napsaného textu za @ */
function items(q){
  const nq=norm(q.trim()), out=[], cur=S.view&&S.view.pageId;
  /* termíny */
  const dates=[['Dnes',addDays(0)],['Zítra',addDays(1)],['Pozítří',addDays(2)]];
  for(let i=3;i<=8;i++){ const d=addDays(i); dates.push([DAYS_FULL[(d.getDay()+6)%7],d]); }
  dates.push(['Za týden',addDays(7)]);
  const m=q.trim().match(/^(\d{1,2})\.?\s?(\d{1,2})?\.?$/);
  /* napsané datum (12.10, 12. 10.) – rok stejně jako u termínů v úkolech */
  if(m){ const d=parseDue(`${m[1]}. ${m[2]||new Date().getMonth()+1}.`); if(d) out.push({k:'date',d,label:dLabel(d),sub:`${DAYS_FULL[(d.getDay()+6)%7]} ${d.getFullYear()}`}); }
  dates.filter(([l])=>!nq||norm(l).startsWith(nq)||norm('datum termin').includes(nq)).slice(0,nq?4:5).forEach(([l,d])=>out.push({k:'date',d,label:l,sub:dLabel(d)}));
  if(!nq||norm('vybrat datum kalendar').includes(nq)) out.push({k:'pick',label:'Vybrat datum…',sub:'kalendář'});
  /* stránky */
  flatPages().map(({p})=>p).filter(p=>p.id!==cur&&(!nq||norm(pTitle(p)).includes(nq))).slice(0,nq?6:3)
    .forEach(p=>{ const r=crumbsOf(p); out.push({k:'page',id:p.id,label:pTitle(p),sub:r.length>1?r.slice(0,-1).map(pTitle).join(' › '):'stránka',ic:pIcon(p)}); });
  /* předměty z Indexu */
  if(isIndex()) subjList().filter(su=>!nq||norm(subjLabel(su)).includes(nq)).slice(0,nq?5:2)
    .forEach(su=>out.push({k:'subj',id:su.id,label:subjLabel(su),sub:'předmět',color:su.color}));
  return out;
}
const HEAD={date:'Termín',pick:'Termín',page:'Stránky',subj:'Předměty'};

function openMention(el,start){ men={open:true,el,start,idx:0,list:items('')}; draw(); }
function closeMention(){ if(men.open){ men.open=false; const p=$('#mention'); if(p) p.remove(); } }
function query(){
  if(!men.el||!document.contains(men.el)) return null;
  const t=men.el.textContent, off=caretOffset(men.el);
  if(t[men.start]!=='@'||off<=men.start) return null;
  return t.slice(men.start+1,off);
}
function update(){
  const q=query(); if(q==null||q.length>30){ closeMention(); return; }
  men.list=items(q);
  if(!men.list.length&&/\s$/.test(q)){ closeMention(); return; }
  men.idx=clamp(men.idx,0,Math.max(0,men.list.length-1)); draw();
}
function draw(){
  let p=$('#mention');
  if(!p){ p=document.createElement('div'); p.id='mention'; p.className='pop men-pop'; p.setAttribute('role','listbox'); document.body.appendChild(p);
    p.addEventListener('mousedown',e=>e.preventDefault());
    p.addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b) choose(men.list[+b.dataset.i]); });
  }
  let h='', last='';
  men.list.forEach((it,i)=>{
    const g=HEAD[it.k]; if(g!==last){ h+=`<div class="pop-h">${g}</div>`; last=g; }
    const ic=it.k==='page'?it.ic:it.k==='subj'?`<span class="ti-dot hl-${esc(it.color||'purple')}"></span>`:it.k==='pick'?'📅':'🗓';
    h+=`<button class="pop-item ${i===men.idx?'act':''}" data-i="${i}" role="option"><span class="pi-ic">${ic}</span><span>${esc(it.label)}<small>${esc(it.sub||'')}</small></span></button>`;
  });
  p.innerHTML=h||'<div class="empty" style="padding:10px">Nic nenalezeno</div>';
  const rc=caretRect()||men.el.getBoundingClientRect();
  placePop(p,{left:rc.left,right:rc.right,top:rc.top,bottom:rc.bottom});
  const act=p.querySelector('.act'); if(act) act.scrollIntoView({block:'nearest'});
}
/* vloží uzel na místo kurzoru a za něj mezeru; změna se uloží přes událost input */
function insertNode(el,node){
  const s=getSelection(); if(!s.rangeCount) return;
  const r=s.getRangeAt(0), sp=document.createTextNode(' ');
  r.insertNode(sp); r.insertNode(node);
  const nr=document.createRange(); nr.setStartAfter(sp); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
  el.dispatchEvent(new Event('input',{bubbles:true}));
}
function mentionEl(kind,id,label){
  const a=document.createElement('a'); a.className='mention'; a.setAttribute(kind==='page'?'data-page':'data-subj',id);
  a.setAttribute('contenteditable','false'); a.textContent=label; return a;
}
function choose(it){
  if(!it) return closeMention();
  const el=men.el, off=caretOffset(el); deleteOffsets(el,men.start,Math.max(men.start,off)); closeMention();
  el.focus({preventScroll:true});
  if(it.k==='date'){ document.execCommand('insertText',false,dLabel(it.d)+' '); return; }
  if(it.k==='pick'){ pickDate(el); return; }
  insertNode(el,mentionEl(it.k,it.id,it.label));
}
function pickDate(el){
  const s=getSelection(), saved=s.rangeCount?s.getRangeAt(0).cloneRange():null;
  const m=openModal('Vybrat datum',`<form class="m-body" id="mdf"><div class="fld"><label for="md-d">Datum</label><input id="md-d" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="m-actions"><span class="sp"></span><button type="button" class="btn" data-close>Zrušit</button><button type="submit" class="btn pri">Vložit</button></div></form>`);
  setTimeout(()=>{ const i=$('#md-d',m); i.focus(); try{ i.showPicker(); }catch(_){} },30);
  $('#mdf',m).addEventListener('submit',e=>{
    e.preventDefault(); const v=$('#md-d',m).value; closeModal(); if(!v||!document.contains(el)) return;
    const [y,mo,d]=v.split('-').map(Number), auto=parseDue(`${d}. ${mo}.`);
    el.focus({preventScroll:true}); if(saved){ const ss=getSelection(); ss.removeAllRanges(); ss.addRange(saved); }
    /* rok se připíše, jen když by se bez něj termín vyložil jinak */
    document.execCommand('insertText',false,`${d}. ${mo}.${auto&&auto.getFullYear()===y?'':' '+y} `);
  });
}
function mentionKey(e){
  if(!men.open) return false;
  if(!men.el||!document.contains(men.el)){ closeMention(); return false; }
  const n=Math.max(1,men.list.length);
  if(e.key==='ArrowDown'){ e.preventDefault(); men.idx=(men.idx+1)%n; draw(); return true; }
  if(e.key==='ArrowUp'){ e.preventDefault(); men.idx=(men.idx-1+n)%n; draw(); return true; }
  if(e.key==='Enter'||e.key==='Tab'){ if(!men.list.length){ closeMention(); return false; } e.preventDefault(); choose(men.list[men.idx]); return true; }
  if(e.key==='Escape'){ e.preventDefault(); closeMention(); return true; }
  return false;
}
/* volá se z události input v editoru */
function mentionInput(e,t){
  if(men.open){ update(); return; }
  if(e.inputType==='insertText'&&e.data==='@'){ const off=caretOffset(t), before=t.textContent.slice(0,off-1); if(!before||/\s$/.test(before)) openMention(t,off-1); }
}
document.addEventListener('mousedown',e=>{ if(men.open&&!e.target.closest('#mention')) closeMention(); });

/* text odkazu podle aktuálního názvu (volá sanitize při vykreslení i ukládání) */
function mentionLabel(kind,id){
  if(kind==='page'){ const p=S.pages[id]; return p?pTitle(p):null; }
  const su=S.subjects&&S.subjects[id]; return su?subjLabel(su):null;
}

/* ---- zpětné odkazy ---- */
function htmlsOf(b){ if(b.type==='table') return (b.rows||[]).flatMap(r=>r.cells.flatMap(c=>c.lines.map(l=>l.html||''))); return [b.html||'']; }
/* bloky na jiných stránkách, které odkazují na stránku nebo předmět (odkaz na podstránku od rodiče se nepočítá) */
function mentionsOf(kind,id){
  const attr=`data-${kind}="${id}"`, out=[];
  Object.values(S.pages).forEach(p=>{
    if(kind==='page'&&p.id===id) return;
    (p.blocks||[]).forEach(b=>{
      const blockLink=kind==='page'&&b.type==='page'&&b.pageId===id&&(S.pages[id]||{}).parent!==p.id;
      if(blockLink||htmlsOf(b).some(h=>h.includes(attr))) out.push({pg:p,b});
    });
  });
  return out;
}
function snippet(b){
  if(b.type==='page') return 'Odkaz na stránku';
  const t=htmlsOf(b).map(h=>plain(h).trim()).filter(Boolean).join(' · ')||'…'; return t.length>110?t.slice(0,110)+'…':t;
}
function backlinksHtml(pg){
  const list=mentionsOf('page',pg.id); if(!list.length) return '';
  const by=new Map(); list.forEach(x=>{ if(!by.has(x.pg.id)) by.set(x.pg.id,[]); by.get(x.pg.id).push(x); });
  return `<section class="backlinks" aria-label="Odkazuje sem"><div class="bl-h">Odkazuje sem <span>${list.length}</span></div>`
    +[...by.values()].map(xs=>`<div class="bl-pg"><div class="bl-t">${pIcon(xs[0].pg)}<span>${esc(crumbsOf(xs[0].pg).map(pTitle).join(' › '))}</span></div>`
      +xs.slice(0,5).map(x=>`<button class="bl-it" data-act="goto-blk" data-p="${x.pg.id}" data-b="${x.b.id}">${esc(snippet(x.b))}</button>`).join('')+'</div>').join('')
    +'</section>';
}

export { backlinksHtml, mentionInput, mentionKey, mentionLabel, mentionsOf };
