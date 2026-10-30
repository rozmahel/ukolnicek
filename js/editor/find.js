/* Úkolníček – Hledání na stránce (⌘F, od 4.23.0)
   Lišta nahoře vpravo nad stránkou: pole, „3 / 12“, předchozí/další a ×. Bez ztmavení, do textu se nic nezapisuje
   (zvýraznění přes CSS Highlight API: uk-find = všechny shody, uk-find-cur = aktuální). Platí pro živou stránku v #main
   (v rozdělení aktivní polovina) a pro náhled stránky v koši; zůstává při přechodu na jinou stránku, zavírá ho jen × nebo Esc.
   Shody ve sbalených sekcích se nerozbalují: zvýrazní se sbalený nadpis (.find-fold), po rozbalení se ukážou shody v něm. */
import { $, $$, clamp, IC, norm, plain } from '../core.js';
import { S } from '../state.js';
import { subjBlockText } from '../school.js';
import { hiddenMask, onBlocksRendered } from './render.js';

const HOSTS='.page-title, .blk .txt, .blk .sj-t, .blk .sj-plain';
const F={on:false,q:'',hits:[],cur:0,bar:null,t:0};
const fbHlOk=()=>!!(window.CSS&&CSS.highlights&&typeof Highlight==='function');

/* text bloku pro hledání (i v datech skrytých bloků a v celém hledání) */
function blockText(b){
  if(b.type==='subj') return subjBlockText(b);
  if(b.type==='table') return (b.rows||[]).map(r=>r.cells.map(c=>c.lines.map(l=>plain(l.html)).join(' ')).join(' ')).join(' ');
  return plain(b.html);
}
const fbFindable=()=>S.view.kind==='page'||S.view.kind==='trash';
function fbCurPg(){ const v=S.view; return v.kind==='page'?S.pages[v.pageId]:v.kind==='trash'&&S.trash[v.id]?S.trash[v.id].pages[0]:null; }

/* všechny výskyty q v textových uzlech prvku (porovnání bez diakritiky a velikosti písmen) */
function fbRangesIn(host,q){
  const map=[]; let n='';
  const w=document.createTreeWalker(host,NodeFilter.SHOW_TEXT,{acceptNode:t=>t.parentElement.closest('.eq')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  for(let t=w.nextNode();t;t=w.nextNode()){ const s=t.nodeValue; for(let i=0;i<s.length;i++){ const c=norm(s[i]); for(let k=0;k<c.length;k++){ n+=c[k]; map.push([t,i]); } } }
  const out=[]; let i=n.indexOf(q);
  while(i>=0&&q){ const a=map[i], b=map[i+q.length-1], r=document.createRange(); r.setStart(a[0],a[1]); r.setEnd(b[0],b[1]+1); out.push(r); i=n.indexOf(q,i+q.length); }
  return out;
}
function fbCollect(){
  const main=$('#main'), q=norm(F.q.trim()); F.hits=[];
  $$('.find-fold',main||document).forEach(e=>e.classList.remove('find-fold'));
  if(!main||!q||!fbFindable()) return;
  for(const h of $$(HOSTS,main)){ if(h.closest('.ai-prev,.aip-chg')) continue; fbRangesIn(h,q).forEach(r=>F.hits.push(r)); }
  /* sbalené sekce: shoda ve skrytém bloku označí nejbližší viditelný sbalený nadpis nad ním */
  const pg=fbCurPg(), bl=pg&&pg.blocks||[], hid=hiddenMask(bl,{});
  bl.forEach((b,i)=>{
    if(!hid[i]||!norm(blockText(b)).includes(q)) return;
    for(let j=i-1;j>=0;j--) if(!hid[j]&&bl[j].collapsed){ const el=main.querySelector(`.blk[data-id="${bl[j].id}"]`); if(el) el.classList.add('find-fold'); break; }
  });
}
function fbPaint(scroll){
  const n=F.hits.length; F.cur=n?clamp(F.cur,0,n-1):0;
  if(F.bar) $('.fb-n',F.bar).textContent=F.q.trim()?(n?`${F.cur+1} / ${n}`:'0'):'';
  if(F.bar) F.bar.classList.toggle('none',!!F.q.trim()&&!n);
  if(!fbHlOk()) return;
  if(!n){ CSS.highlights.delete('uk-find'); CSS.highlights.delete('uk-find-cur'); return; }
  CSS.highlights.set('uk-find',new Highlight(...F.hits)); CSS.highlights.set('uk-find-cur',new Highlight(F.hits[F.cur]));
  if(scroll){
    const main=$('#main'), rc=F.hits[F.cur].getBoundingClientRect(); if(!main||!rc.height) return;
    const mr=main.getBoundingClientRect(), pb=$('.pagebar'), top=pb?Math.max(mr.top,pb.getBoundingClientRect().bottom):mr.top;
    if(rc.top<top+8||rc.bottom>mr.bottom-8) main.scrollTop+=rc.top-(top+mr.bottom)/2+rc.height/2;
  }
}
/* po překreslení nebo psaní: shody znovu, aktuální zůstane nejbližší původní */
function fbRefresh(){
  if(!F.on) return;
  if(!fbFindable()){ fbClearHl(); if(F.bar) F.bar.hidden=true; return; }
  if(F.bar){ F.bar.hidden=false; fbPlace(); }
  const old=F.hits[F.cur]; let y=null; try{ y=old&&old.startContainer.isConnected?old.getBoundingClientRect().top:null; }catch(_){}
  fbCollect();
  if(y!=null&&F.hits.length){ let best=0,d=Infinity; F.hits.forEach((r,i)=>{ const dd=Math.abs(r.getBoundingClientRect().top-y); if(dd<d){ d=dd; best=i; } }); F.cur=best; }
  fbPaint(false);
}
function fbClearHl(){ if(fbHlOk()){ CSS.highlights.delete('uk-find'); CSS.highlights.delete('uk-find-cur'); } $$('.find-fold').forEach(e=>e.classList.remove('find-fold')); }
function fbPlace(){
  const b=F.bar, main=$('#main'); if(!b||!main) return;
  const mr=main.getBoundingClientRect(), pb=$('.pagebar'), top=pb&&pb.offsetParent?pb.getBoundingClientRect().bottom:mr.top;
  b.style.top=Math.round(top+8)+'px'; b.style.right=Math.round(innerWidth-mr.right+16)+'px';
}
function fbBuild(){
  const b=document.createElement('div'); b.className='findbar'; b.setAttribute('role','search');
  b.innerHTML=`<input class="fb-q" type="text" placeholder="Hledat na stránce" aria-label="Hledat na stránce" autocomplete="off" spellcheck="false"><span class="fb-n" aria-live="polite"></span>
    <button type="button" class="icon-btn" data-fb="prev" title="Předchozí (⇧Enter)" aria-label="Předchozí">${IC.up}</button><button type="button" class="icon-btn" data-fb="next" title="Další (Enter)" aria-label="Další">${IC.down}</button><button type="button" class="icon-btn" data-fb="x" title="Zavřít (Esc)" aria-label="Zavřít">${IC.x}</button>`;
  document.body.appendChild(b);
  const inp=$('.fb-q',b);
  inp.addEventListener('input',()=>{ F.q=inp.value; F.cur=0; fbCollect(); fbPaint(true); });
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){ e.preventDefault(); fbStep(e.shiftKey?-1:1); }
    else if(e.key==='Escape'){ e.preventDefault(); findClose(); }
    else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){ e.preventDefault(); inp.select(); }
  });
  b.addEventListener('mousedown',e=>{ if(e.target.closest('[data-fb]')) e.preventDefault(); });
  b.addEventListener('click',e=>{ const x=e.target.closest('[data-fb]'); if(!x) return; const v=x.dataset.fb; if(v==='x') findClose(); else fbStep(v==='prev'?-1:1); });
  return b;
}
function fbStep(d){ const n=F.hits.length; if(!n) return; F.cur=(F.cur+d+n)%n; fbPaint(true); }

/* otevře lištu; q = hledaný text (z celého hledání), at = ID bloku, na jehož první shodu se skočí */
function findOpen(q,at){
  if(!fbFindable()) return false;
  F.on=true; if(!F.bar) F.bar=fbBuild();
  F.bar.hidden=false; fbPlace();
  const inp=$('.fb-q',F.bar);
  if(q!=null){ F.q=q; inp.value=q; }
  fbCollect(); F.cur=0;
  if(at){ const el=$(`#main .blk[data-id="${at}"]`); const i=el?F.hits.findIndex(r=>el.contains(r.startContainer)):-1; if(i>=0) F.cur=i; }
  fbPaint(true);
  if(q==null){ inp.focus(); inp.select(); }
  return true;
}
function findClose(){ F.on=false; fbClearHl(); if(F.bar){ F.bar.remove(); F.bar=null; } F.hits=[]; }

export function initFind(){
  onBlocksRendered(()=>{ if(F.on) fbRefresh(); });
  document.addEventListener('uk-view',()=>{ if(F.on) setTimeout(fbRefresh,0); });
  document.addEventListener('input',e=>{ if(!F.on||!e.target.closest||!e.target.closest('#main')) return; clearTimeout(F.t); F.t=setTimeout(fbRefresh,200); },true);
  addEventListener('resize',()=>{ if(F.on) fbPlace(); });
}

export { blockText, findOpen };
