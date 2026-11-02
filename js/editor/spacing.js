/* Úkolníček – mezery nad a pod blokem (od 4.28.0)
   Bublina s poli Nad / Pod a návratem k výchozím mezerám. Otevírá se z lišty výběru bloků (multisel.js)
   a z ⋮⋮ (menus.js) a platí pro všechny předané bloky.
   Data: b.spT / b.spB = px při velikosti textu 100 %, chybí = výchozí mezera typu bloku (do dat se nic nezapisuje).
   Vykreslení spNum v render.js, CSS na konci css/editor.css. */
import { $, clamp, IC } from '../core.js';
import { savePage } from '../store.js';
import { rerenderBlocks, SP_MAX, spNum } from './render.js';
import { openPop } from '../ui.js';

const SPC_STEP=2;
const SPC_KEY=['spT','spB'];
/* výchozí mezery při 100 %, když blok není vidět (sbalená sekce) nebo nejde změřit; ostatní typy 4 / 4 */
const SPC_DEF={h1:[24,4],h2:[20,4],h3:[16,4],subj:[24,4],callout:[6,6],image:[8,8],table:[0,6],divider:[15,15],page:[2,2],eq:[0,0]};

/* výchozí mezera bloku (k: 0 = nad, 1 = pod) v px při 100 %: okraj bloku + vnitřní okraj (--gi / --gb v editor.css) */
function spcDef(b,k){
  const el=$(`#blocks > .blk[data-id="${b.id}"]`);
  if(el&&!el.classList.contains(k?'spb':'spt')){
    const cs=getComputedStyle(el), g=parseFloat(cs.getPropertyValue(k?'--gb':'--gi'));
    const fs=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'))||1;
    if(Number.isFinite(g)) return Math.round(((parseFloat(k?cs.marginBottom:cs.marginTop)||0)+g)/fs);
  }
  const d=SPC_DEF[b.type]||[4,4];
  return k===0&&isHeadType(b.type)&&el&&!el.previousElementSibling?4:d[k];
}
const isHeadType=t=>t==='h1'||t==='h2'||t==='h3'||t==='subj';

/* hodnota a zástupný text pole: stejná vlastní hodnota u všech = číslo, jinak prázdné pole a šedě výchozí (nebo –, když se liší; první šipka nebo číslo je sjednotí) */
function spcField(blocks,k){
  const own=blocks.map(b=>spNum(b[SPC_KEY[k]]));
  if(own.every(v=>v!=null&&v===own[0])) return {val:String(own[0]),ph:''};
  if(own.some(v=>v!=null)) return {val:'',ph:'–'};
  const defs=blocks.map(b=>spcDef(b,k));
  return {val:'',ph:defs.every(v=>v===defs[0])?String(defs[0]):'–'};
}

/* anchor = tlačítko, pg = stránka, blocks = bloky z pg.blocks, at = poloha jako u openPop, after = po každé změně (výběr bloků se vrátí) */
function spcOpen(anchor,pg,blocks,at,after){
  if(!blocks.length) return null;
  const row=(k,lbl)=>`<div class="spc-row"><span class="spc-l">${lbl}</span>`
    +`<button data-v="${k}-" title="Menší" aria-label="${lbl}: menší">${IC.minus}</button>`
    +`<input class="spc-in" data-k="${k}" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="${lbl} (px)">`
    +`<span class="spc-u">px</span><button data-v="${k}+" title="Větší" aria-label="${lbl}: větší">${IC.plus}</button></div>`;
  const html=row(0,'Nad')+row(1,'Pod')+`<div class="pop-sep"></div><button class="pop-item" data-v="reset"><span class="pi-ic">${IC.restore}</span>Výchozí mezery</button>`;
  const commit=()=>{ savePage(pg); rerenderBlocks(); if(after) after(); };
  const fill=p=>p.querySelectorAll('.spc-in').forEach(inp=>{
    const f=spcField(blocks,+inp.dataset.k); inp.value=f.val; inp.placeholder=f.ph;
  });
  /* šipka: všem vybraným blokům stejná hodnota = horní blok ± 2 (při různých hodnotách se tím sjednotí a pole ukáže číslo) */
  const step=(k,d)=>{ const b0=blocks[0], cur=spNum(b0[SPC_KEY[k]]), v=clamp((cur==null?spcDef(b0,k):cur)+d,0,SP_MAX); blocks.forEach(b=>{ b[SPC_KEY[k]]=v; }); commit(); };
  const p=openPop(anchor,html,(v,btn,pop)=>{
    if(v==='reset'){ blocks.forEach(b=>{ delete b.spT; delete b.spB; }); commit(); }
    else { const k=+v[0]; if(k===0||k===1) step(k,v[1]==='+'?SPC_STEP:-SPC_STEP); }
    fill(pop); return true;
  },at);
  p.classList.add('spc-pop');
  p.addEventListener('mousedown',e=>{ if(e.target.closest('button')) e.preventDefault(); });   /* šipky nechají kurzor v poli */
  p.querySelectorAll('.spc-in').forEach(inp=>{
    const k=+inp.dataset.k;
    inp.addEventListener('input',()=>{
      const s=inp.value.replace(/\D/g,'').slice(0,2); if(s!==inp.value) inp.value=s;
      if(s==='') return;
      const v=clamp(+s,0,SP_MAX); blocks.forEach(b=>{ b[SPC_KEY[k]]=v; }); commit();
    });
    /* prázdné pole po úpravě = výchozí mezera na této straně */
    inp.addEventListener('change',()=>{ if(inp.value===''&&blocks.some(b=>b[SPC_KEY[k]]!=null)){ blocks.forEach(b=>{ delete b[SPC_KEY[k]]; }); commit(); } fill(p); });
    inp.addEventListener('blur',()=>setTimeout(()=>{ if(p.isConnected) fill(p); },0));
    inp.addEventListener('keydown',e=>{
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); step(k,e.key==='ArrowUp'?SPC_STEP:-SPC_STEP); const f=spcField(blocks,k); inp.value=f.val; inp.placeholder=f.ph; }
      else if(e.key==='Enter'){ e.preventDefault(); inp.blur(); }
    });
  });
  fill(p);
  /* z ⋮⋮ se bublina otevírá vedle menu; když se tam nevejde, vlevo od něj */
  if(at&&at.rect&&at.side){ const w=p.offsetWidth; if(at.rect.left+w>innerWidth-8) p.style.left=Math.max(8,at.side.left-w-4)+'px'; }
  return p;
}

export { spcOpen };
