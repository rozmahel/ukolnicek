/* Úkolníček – Myšlenková mapa: nekonečné plátno s bloky, texty, skupinami a čarami (podobně jako Canvas v Obsidianu).
   Data: S.maps = {ID: {id, title, order, nodes, edges}}; do dat se mapa dostane až první změnou (do té doby je to `draft`).
   Uzel {id, k:'card'|'text'|'group', x, y, w, h, text (card/text), label (group), color, page (propojený projekt), hid (nadpis H1 / předmět)}.
   Čára {id, from, to, end: chybí = šipka | 'both' | 'none', color, label}; strany se volí samy podle polohy bloků.
   Posun a přiblížení (uk-mm-v) a otevřená mapa (uk-mm-cur) jsou jen v zařízení.
   Export/import: formát JSON Canvas (.canvas) z Obsidianu. */
import { $, clamp, clone, downloadFile, esc, IC, lsGet, lsSet, norm, plain, plural, rid, simpleUi } from '../core.js';
import { S } from '../state.js';
import { modeBtn } from '../theme.js';
import { applyLock, LOCK } from '../lock.js';
import { Store } from '../store.js';
import { flatPages, pIcon, pTitle, revealBlock } from '../pages.js';
import { subjBlockText } from '../school.js';
import { go } from '../router.js';
import { closePop, openPop, toast } from '../ui.js';
import { TRASH_IC } from '../trash.js';

/* jen ke čtení: zámek, nebo jednoduchý režim (úzké okno = mapa jen k prohlížení a posunu) */
const mmRO=()=>LOCK||simpleUi();
const MM_COLORS=['red','orange','yellow','green','blue','purple'];
const COL_CZ={red:'Červená',orange:'Oranžová',yellow:'Žlutá',green:'Zelená',blue:'Modrá',purple:'Fialová'};
const TO_CANVAS={red:'1',orange:'2',yellow:'3',green:'4',blue:'5',purple:'6'};
const FROM_CANVAS={1:'red',2:'orange',3:'yellow',4:'green',5:'blue',6:'purple'};
const SIZE={card:[240,72],text:[240,40],group:[480,320]};
const ZMIN=.15, ZMAX=2.5, GRID=10, VKEY='uk-mm-v', CKEY='uk-mm-cur';
const MIC={
  text:'<svg viewBox="0 0 24 24"><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>',
  card:'<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="2"/></svg>',
  group:'<svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="13" rx="2" stroke-dasharray="3 2.4"/><path d="M4 3.2h7"/></svg>',
  line:'<svg viewBox="0 0 24 24"><circle cx="6" cy="17.5" r="2.2"/><circle cx="18" cy="6.5" r="2.2"/><path d="M7.8 16 16.2 8"/></svg>',
  fit:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  link:'<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  label:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6"/></svg>',
  dup:'<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></svg>',
  maps:'<svg viewBox="0 0 24 24"><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/></svg>',
  exp:'<svg viewBox="0 0 24 24"><path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16"/></svg>',
  imp:'<svg viewBox="0 0 24 24"><path d="M12 15V4"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16"/></svg>'
};

/* ---- stav ---- */
let M=null, draft=null, V=null;
let sel=new Set(), selE=null, editing=null, tool=null, lineFrom=null;
let undoS=[], redoS=[], clip=null, addN=0, addT=0;
let vp=null, stage=null, svg=null, G=null, P=null, lastTap=null, space=false, gz=1;
const ptrs=new Map(), sizes=new Map();

const f1=n=>Math.round(n*10)/10;
const snapv=v=>Math.round(v/GRID)*GRID;
const maps=()=>Object.values(S.maps||{}).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.title||'').localeCompare(String(b.title||''),'cs'));
function pickMap(){
  const m=(S.maps||{})[lsGet(CKEY,'')]||maps()[0];
  if(m) return m;
  if(!draft) draft={id:rid(),title:'Myšlenková mapa',nodes:[],edges:[]};
  return draft;
}
const node=id=>M.nodes.find(n=>n.id===id);
const nodeEl=id=>stage&&stage.querySelector(`.mm-n[data-id="${id}"]`);
/* změna mapy: koncept se do dat dostane až teď */
function touch(){
  if(!S.maps[M.id]){ M.order=Math.max(0,...maps().map(m=>m.order||0))+1; S.maps[M.id]=M; if(M===draft) draft=null; lsSet(CKEY,M.id); }
  Store.queue();
}

/* ---- zpět / znovu (jen v otevřené mapě, do jejího zavření) ---- */
const snapStr=()=>JSON.stringify({n:M.nodes,e:M.edges});
function mmSnap(){ undoS.push(snapStr()); if(undoS.length>100) undoS.shift(); redoS=[]; }
function restore(s){
  const d=JSON.parse(s); M.nodes=d.n; M.edges=d.e;
  sel=new Set([...sel].filter(id=>node(id))); if(selE&&!M.edges.some(e=>e.id===selE)) selE=null;
  touch(); mmDraw();
}
function mmUndo(){ const s=undoS.pop(); if(!s) return; redoS.push(snapStr()); restore(s); }
function mmRedo(){ const s=redoS.pop(); if(!s) return; undoS.push(snapStr()); restore(s); }

/* ---- posun a přiblížení: obrazovka = svět × z + (x, y) ---- */
function loadView(id){ const v=(lsGet(VKEY,{})||{})[id]; return v&&[v.x,v.y,v.z].every(Number.isFinite)?{x:v.x,y:v.y,z:clamp(v.z,ZMIN,ZMAX)}:null; }
let vT=null;
function saveView(){
  clearTimeout(vT); const id=M.id, v={x:Math.round(V.x),y:Math.round(V.y),z:+V.z.toFixed(3)};
  vT=setTimeout(()=>{ const all=lsGet(VKEY,{})||{}; all[id]=v; lsSet(VKEY,all); },300);
}
const vpSize=()=>({w:vp.clientWidth,h:vp.clientHeight});
function applyView(){
  if(!stage) return;
  stage.style.transform=`translate(${f1(V.x)}px,${f1(V.y)}px) scale(${V.z})`;
  const g=GRID*2*V.z; vp.style.backgroundSize=`${g}px ${g}px`; vp.style.backgroundPosition=`${f1(V.x)}px ${f1(V.y)}px`;
  vp.classList.toggle('far',V.z<.5);
  const zv=$('.mm-zv'); if(zv) zv.textContent=Math.round(V.z*100)+' %';
  mmPlaceBar();
}
function zoomAt(sx,sy,k){ const z=clamp(V.z*k,ZMIN,ZMAX), wx=(sx-V.x)/V.z, wy=(sy-V.y)/V.z; V.z=z; V.x=sx-wx*z; V.y=sy-wy*z; applyView(); saveView(); }
/* obálka uzlů ve světových souřadnicích (u skupiny i s nadpisem nad ní) */
function bounds(ids){
  let bb=null;
  ids.forEach(id=>{ const b=box(id); if(!b) return; if(node(id).k==='group'){ b.y-=34; b.h+=34; }
    bb=bb?{x:Math.min(bb.x,b.x),y:Math.min(bb.y,b.y),r:Math.max(bb.r,b.x+b.w),b:Math.max(bb.b,b.y+b.h)}:{x:b.x,y:b.y,r:b.x+b.w,b:b.y+b.h}; });
  return bb&&{x:bb.x,y:bb.y,w:bb.r-bb.x,h:bb.b-bb.y};
}
function mmFit(){
  const r=vpSize(), bb=bounds(M.nodes.map(n=>n.id));
  if(!bb){ V={x:Math.round(r.w/2-SIZE.card[0]/2),y:Math.round(r.h/2-SIZE.card[1]/2),z:1}; applyView(); return; }
  const pad=48, z=clamp(Math.min((r.w-pad*2)/bb.w,(r.h-pad*2)/bb.h,1),ZMIN,ZMAX);
  V={z,x:r.w/2-(bb.x+bb.w/2)*z,y:r.h/2-(bb.y+bb.h/2)*z}; applyView(); saveView();
}

/* ---- rozměry a geometrie čar ---- */
function measure(){ sizes.clear(); stage.querySelectorAll('.mm-n').forEach(el=>sizes.set(el.dataset.id,{w:el.offsetWidth,h:el.offsetHeight})); }
function box(id){ const n=node(id); if(!n) return null; const s=sizes.get(id); return {x:n.x,y:n.y,w:s?s.w:n.w,h:s?s.h:n.h}; }
const DIR={top:[0,-1],right:[1,0],bottom:[0,1],left:[-1,0]};
const anchor=(b,s)=>s==='top'?[b.x+b.w/2,b.y]:s==='bottom'?[b.x+b.w/2,b.y+b.h]:s==='left'?[b.x,b.y+b.h/2]:[b.x+b.w,b.y+b.h/2];
/* strany čáry podle toho, jestli jsou bloky víc vedle sebe, nebo nad sebou */
function sides(a,b){
  const dx=(b.x+b.w/2)-(a.x+a.w/2), dy=(b.y+b.h/2)-(a.y+a.h/2);
  const gx=Math.abs(dx)-(a.w+b.w)/2, gy=Math.abs(dy)-(a.h+b.h)/2;
  if(gx>gy) return dx>0?['right','left']:['left','right'];
  return dy>0?['bottom','top']:['top','bottom'];
}
function curve(p1,s1,p2,s2){
  const k=clamp(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])*.45,24,180);
  return {p1,p2,c1:[p1[0]+DIR[s1][0]*k,p1[1]+DIR[s1][1]*k],c2:s2?[p2[0]+DIR[s2][0]*k,p2[1]+DIR[s2][1]*k]:p2.slice()};
}
function edgeGeo(e){ const a=box(e.from), b=box(e.to); if(!a||!b) return null; const [s1,s2]=sides(a,b); return curve(anchor(a,s1),s1,anchor(b,s2),s2); }
function arrowAt(tip,from){
  let tx=tip[0]-from[0], ty=tip[1]-from[1]; const l=Math.hypot(tx,ty)||1; tx/=l; ty/=l;
  const L=11, W=5.5, bx=tip[0]-tx*L, by=tip[1]-ty*L;
  return {d:`M${f1(tip[0])} ${f1(tip[1])}L${f1(bx-ty*W)} ${f1(by+tx*W)}L${f1(bx+ty*W)} ${f1(by-tx*W)}Z`,base:[tip[0]-tx*(L-2),tip[1]-ty*(L-2)]};
}
function pathOf(g,end){
  const A2=end!=='none'?arrowAt(g.p2,g.c2):null, A1=end==='both'?arrowAt(g.p1,g.c1):null;
  const q1=A1?A1.base:g.p1, q2=A2?A2.base:g.p2;
  return {d:`M${f1(q1[0])} ${f1(q1[1])}C${f1(g.c1[0])} ${f1(g.c1[1])} ${f1(g.c2[0])} ${f1(g.c2[1])} ${f1(q2[0])} ${f1(q2[1])}`,ar:(A2?A2.d:'')+(A1?A1.d:'')};
}
const midOf=g=>[(g.p1[0]+3*g.c1[0]+3*g.c2[0]+g.p2[0])/8,(g.p1[1]+3*g.c1[1]+3*g.c2[1]+g.p2[1])/8];

/* ---- text bloku: malý Markdown (# nadpis, - odrážka, 1. seznam, - [ ] úkol, > citace, **tučně**, *kurzíva*, ==zvýraznění==, `kód`, odkazy) ---- */
function inl(s){
  return esc(s)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g,'$1<i>$2</i>')
    .replace(/==(.+?)==/g,'<mark>$1</mark>')
    .replace(/~~(.+?)~~/g,'<s>$1</s>')
    .replace(/\bhttps?:\/\/[^\s<]*[^\s<.,;:!?)]/g,u=>`<a class="mm-a" href="${u}" target="_blank" rel="noopener">${u}</a>`);
}
function md(text){
  let h='', list=null;
  const close=()=>{ if(list){ h+=`</${list}>`; list=null; } };
  String(text||'').split('\n').forEach((ln,i)=>{
    let m;
    if((m=ln.match(/^\s*[-*+] \[( |x|X)\] (.*)$/))){ if(list!=='ul'){ close(); h+='<ul>'; list='ul'; } const d=m[1]!==' ';
      h+=`<li class="mm-todo${d?' done':''}"><span class="mm-cb" data-li="${i}" role="checkbox" aria-checked="${d}"></span><span>${inl(m[2])}</span></li>`; }
    else if((m=ln.match(/^\s*[-*+] (.*)$/))){ if(list!=='ul'){ close(); h+='<ul>'; list='ul'; } h+=`<li>${inl(m[1])}</li>`; }
    else if((m=ln.match(/^\s*(\d+)[.)] (.*)$/))){ if(list!=='ol'){ close(); h+=`<ol start="${+m[1]}">`; list='ol'; } h+=`<li>${inl(m[2])}</li>`; }
    else { close();
      if((m=ln.match(/^(#{1,3}) (.*)$/))) h+=`<div class="mm-h${m[1].length}">${inl(m[2])}</div>`;
      else if((m=ln.match(/^> ?(.*)$/))) h+=`<blockquote>${inl(m[1])}</blockquote>`;
      else if(/^\s*(---|\*\*\*)\s*$/.test(ln)) h+='<hr>';
      else if(!ln.trim()) h+='<div class="mm-gap"></div>';
      else h+=`<p>${inl(ln)}</p>`;
    }
  });
  close(); return h;
}

/* ---- propojení s projektem / nadpisem H1 (i blok /předmět) ---- */
const isHead=b=>b.type==='h1'||b.type==='subj';
const headText=b=>b.type==='subj'?subjBlockText(b):(plain(b.html).trim()||'Bez názvu');
function linkInfo(n){
  if(!n.page) return null;
  const pg=S.pages[n.page]; if(!pg) return {gone:true};
  const bl=pg.blocks||[]; let i=-1;
  if(n.hid){ i=bl.findIndex(b=>b.id===n.hid); if(i<0) return {pg,gone:true}; }
  return {pg,b:i>=0?bl[i]:null,i};
}
/* náhled obsahu propojené sekce, když blok nemá vlastní text */
function preview(li){
  const bl=li.pg.blocks||[], out=[];
  for(let j=li.i+1;j<bl.length&&out.length<6;j++){
    const b=bl[j]; if(li.b&&isHead(b)) break;
    const t=b.type==='subj'?headText(b):b.html!=null?plain(b.html).trim():''; if(!t) continue;
    const pre=b.type==='todo'?(b.done?'☑ ':'☐ '):b.type==='bullet'||b.type==='num'?'• ':'';
    out.push(`<div class="${/^h[123]$/.test(b.type)||b.type==='subj'?'pv-h':''}${b.type==='todo'&&b.done?' pv-done':''}">${esc(pre+t)}</div>`);
  }
  return out.length?`<div class="mm-pv">${out.join('')}</div>`:'';
}
function linkHead(li){
  if(!li) return '';
  if(li.gone) return `<span class="mm-ln gone">${li.pg?esc(pTitle(li.pg))+' › ':''}nenalezeno</span>`;
  return `<span class="mm-ln" title="Otevřít">${pIcon(li.pg)}<span class="mm-lt">${esc(pTitle(li.pg))}${li.b?` <b>› ${esc(headText(li.b))}</b>`:''}</span><span class="mm-la" aria-hidden="true">${IC.pageLink}</span></span>`;
}
function followLink(id){
  const n=node(id), li=n&&linkInfo(n);
  if(!li||li.gone) return toast('Propojená stránka nebo nadpis už neexistuje.');
  if(li.b) revealBlock(li.pg.id,li.b.id,true); else go({kind:'page',pageId:li.pg.id});
}
function openLinkPicker(anchor,n){
  const items=[];
  flatPages().forEach(({p,depth})=>{ items.push({v:'p:'+p.id,p,depth,t:pTitle(p)}); (p.blocks||[]).forEach(b=>{ if(isHead(b)) items.push({v:'h:'+p.id+':'+b.id,p,b,depth,t:headText(b)}); }); });
  const pick=v=>{
    if(v==='none'){ if(!n.page) return; mmSnap(); delete n.page; delete n.hid; }
    else { const [t,pid,bid]=v.split(':'); if(!S.pages[pid]) return; mmSnap(); n.page=pid; if(t==='h') n.hid=bid; else delete n.hid; }
    touch(); mmDraw();
  };
  const pop=openPop(anchor,`<input class="inp sp-q" placeholder="Hledat projekt nebo nadpis…" aria-label="Hledat projekt nebo nadpis" autocomplete="off"><div class="sp-list" role="listbox"></div>`,v=>pick(v));
  pop.classList.add('subj-pick','page-pick','mm-pick');
  const q=$('.sp-q',pop); let idx=0, shown=[];
  const draw=()=>{
    const nq=norm(q.value.trim());
    shown=(n.page?[{v:'none'}]:[]).concat(items.filter(it=>!nq||norm(it.t).includes(nq)||(it.b&&norm(pTitle(it.p)).includes(nq))));
    idx=clamp(idx,0,Math.max(0,shown.length-1));
    $('.sp-list',pop).innerHTML=shown.map((it,i)=>it.v==='none'
      ?`<button class="pop-item sp-it danger${i===idx?' act':''}" data-v="none" role="option"><span class="pi-ic">${IC.x}</span><span class="sp-t">Zrušit propojení</span></button>`
      :`<button class="pop-item sp-it${i===idx?' act':''}${(it.b?n.hid===it.b.id:n.page===it.p.id&&!n.hid)?' cur':''}" data-v="${it.v}" role="option" style="padding-left:${8+(nq?0:it.depth*14)+(it.b&&!nq?18:0)}px">${it.b?'<span class="pi-ic mm-hash">#</span>':pIcon(it.p)}<span class="sp-t">${esc(it.t)}${it.b&&nq?` <small>${esc(pTitle(it.p))}</small>`:''}</span></button>`).join('')
      ||'<div class="empty">Nic nenalezeno.</div>';
    const a=$('.sp-it.act',pop); if(a) a.scrollIntoView({block:'nearest'});
  };
  q.addEventListener('input',()=>{ idx=0; draw(); });
  q.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(shown.length) idx=(idx+(e.key==='ArrowDown'?1:-1)+shown.length)%shown.length; draw(); }
    else if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); const it=shown[idx]; closePop(); if(it) pick(it.v); }
  });
  draw(); setTimeout(()=>q.focus({preventScroll:true}),0);
}

/* ---- vykreslení ---- */
function nodeHtml(n){
  const c=n.color?' c-'+n.color:'', s=sel.has(n.id)?' sel':'';
  const hd=['top','right','bottom','left'].map(sd=>`<i class="mm-hd" data-side="${sd}"></i>`).join('');
  if(n.k==='group') return `<div class="mm-n mm-group${c}${s}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px"><span class="mm-gl${n.label?'':' ph'}">${esc(n.label||'Skupina')}</span>${hd}<i class="mm-rz"></i></div>`;
  const li=n.k==='card'?linkInfo(n):null, txt=String(n.text||'').replace(/\s+$/,'');
  const body=txt?md(txt):li&&!li.gone?preview(li):'';
  return `<div class="mm-n mm-${n.k==='text'?'text':'card'}${c}${s}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;${n.k==='text'?'':`min-height:${n.h}px`}">${linkHead(li)}<div class="mm-tx">${body}</div>${hd}<i class="mm-rz"></i></div>`;
}
function drawEdges(){
  if(!stage) return;
  let h='', lb='';
  M.edges.forEach(e=>{
    const g=edgeGeo(e); if(!g) return;
    const p=pathOf(g,e.end), c=e.color?' c-'+e.color:'', s=e.id===selE?' sel':'';
    h+=`<g class="mm-e${c}${s}" data-e="${e.id}"><path class="hit" d="${p.d}"/><path class="ln" d="${p.d}"/>${p.ar?`<path class="ar" d="${p.ar}"/>`:''}</g>`;
    if(e.label){ const m=midOf(g); lb+=`<span class="mm-el${c}${s}" data-e="${e.id}" style="left:${f1(m[0])}px;top:${f1(m[1])}px">${esc(e.label)}</span>`; }
  });
  $('.mm-eg',svg).innerHTML=h; $('.mm-labels',stage).innerHTML=lb;
}
function mmDraw(){
  if(!stage||!stage.isConnected) return;
  $('.mm-groups',stage).innerHTML=M.nodes.filter(n=>n.k==='group').map(nodeHtml).join('');
  $('.mm-nodes',stage).innerHTML=M.nodes.filter(n=>n.k!=='group').map(nodeHtml).join('');
  measure(); drawEdges(); updateSel(); setToolUI();
  const em=$('.mm-empty',vp); if(em) em.hidden=M.nodes.length>0;
}
function posEl(n){ const el=nodeEl(n.id); if(el){ el.style.left=n.x+'px'; el.style.top=n.y+'px'; } }

/* ---- výběr a lišta nad vybraným ---- */
function updateSel(){
  if(!stage) return;
  stage.querySelectorAll('.mm-n').forEach(el=>el.classList.toggle('sel',sel.has(el.dataset.id)));
  stage.querySelectorAll('[data-e]').forEach(el=>el.classList.toggle('sel',el.dataset.e===selE));
  buildBar();
}
function buildBar(){
  const bar=vp&&$('.mm-selbar',vp); if(!bar) return;
  const ns=[...sel].map(node).filter(Boolean), e=selE&&M.edges.find(x=>x.id===selE);
  if(mmRO()||editing||(!ns.length&&!e)){ bar.hidden=true; bar.innerHTML=''; return; }
  const objs=e?[e]:ns, cur=objs.every(o=>o.color===objs[0].color)?objs[0].color:'?';
  let h=`<button class="mm-dot none${!cur?' on':''}" data-mb="col" data-c="" title="Bez barvy" aria-label="Bez barvy"></button>`
    +MM_COLORS.map(c=>`<button class="mm-dot c-${c}${cur===c?' on':''}" data-mb="col" data-c="${c}" title="${COL_CZ[c]}" aria-label="${COL_CZ[c]}"></button>`).join('')+'<span class="mm-bsep"></span>';
  if(e) h+=`<button class="mm-bb mm-dir" data-mb="end" title="Směr šipky" aria-label="Směr šipky">${e.end==='none'?'—':e.end==='both'?'↔':'→'}</button><button class="mm-bb" data-mb="elabel" title="Popisek čáry" aria-label="Popisek čáry">${MIC.label}</button>`;
  else {
    if(ns.length===1&&ns[0].k==='card') h+=`<button class="mm-bb${ns[0].page?' on':''}" data-mb="link" title="Propojit s projektem nebo nadpisem" aria-label="Propojit s projektem nebo nadpisem">${MIC.link}</button>`;
    if(ns.length===2) h+=`<button class="mm-bb" data-mb="join" title="Spojit čarou" aria-label="Spojit čarou">${MIC.line}</button>`;
    h+=`<button class="mm-bb" data-mb="dup" title="Duplikovat" aria-label="Duplikovat">${MIC.dup}</button>`;
  }
  h+=`<button class="mm-bb del" data-mb="del" title="Odstranit" aria-label="Odstranit">${TRASH_IC}</button>`;
  bar.innerHTML=h; bar.hidden=false; mmPlaceBar();
}
function mmPlaceBar(){
  const bar=vp&&$('.mm-selbar',vp); if(!bar||bar.hidden) return;
  let bb=null;
  if(selE){ const e=M.edges.find(x=>x.id===selE), g=e&&edgeGeo(e); if(g){ const m=midOf(g); bb={x:m[0],y:m[1]-10,w:0,h:20}; } }
  else bb=bounds([...sel]);
  if(!bb){ bar.hidden=true; return; }
  const r=vpSize(), bw=bar.offsetWidth, bh=bar.offsetHeight;
  const sx=bb.x*V.z+V.x, sy=bb.y*V.z+V.y, sw=bb.w*V.z, sh=bb.h*V.z;
  let top=sy-bh-10; if(top<6) top=sy+sh+10;
  bar.style.left=clamp(sx+sw/2-bw/2,6,Math.max(6,r.w-bw-6))+'px';
  bar.style.top=clamp(top,6,Math.max(6,r.h-bh-6))+'px';
}
function barClick(e){
  const b=e.target.closest('[data-mb]'); if(!b||mmRO()) return;
  const ed=selE&&M.edges.find(x=>x.id===selE), ns=[...sel].map(node).filter(Boolean);
  switch(b.dataset.mb){
    case 'col': { const c=b.dataset.c; mmSnap(); (ed?[ed]:ns).forEach(o=>{ if(c) o.color=c; else delete o.color; }); touch(); mmDraw(); break; }
    case 'end': if(ed){ mmSnap(); if(!ed.end) ed.end='both'; else if(ed.end==='both') ed.end='none'; else delete ed.end; touch(); mmDraw(); } break;
    case 'elabel': if(ed) editEdgeLabel(ed.id); break;
    case 'link': if(ns[0]) openLinkPicker(b,ns[0]); break;
    case 'join': if(ns.length===2) addEdge(ns[0].id,ns[1].id); break;
    case 'dup': duplicate(); break;
    case 'del': removeSel(); break;
  }
}

/* ---- úpravy ---- */
function newNode(k,x,y,extra){ const [w,h]=SIZE[k]; return Object.assign({id:rid(),k,x:Math.round(x),y:Math.round(y),w,h},k==='group'?{label:''}:{text:''},extra||{}); }
function addAt(k){
  if(mmRO()) return;
  const r=vpSize(), now=Date.now(); addN=now-addT<4000?addN+1:0; addT=now;
  let n; const inside=[...sel].filter(id=>node(id));
  if(k==='group'&&inside.length){ const bb=bounds(inside); n=newNode('group',snapv(bb.x-30),snapv(bb.y-30),{w:snapv(bb.w+60),h:snapv(bb.h+60)}); }
  else {
    const [w,h]=SIZE[k], cx=(r.w/2-V.x)/V.z, cy=(r.h/2-V.y)/V.z; const x=snapv(cx-w/2+addN*30); let y=snapv(cy-h/2+addN*30);
    /* nepřekrýt jiný blok: posunout níž na volné místo */
    const hits=()=>M.nodes.some(o=>{ if(o.k==='group') return false; const b=box(o.id); return x<b.x+b.w+20&&x+w+20>b.x&&y<b.y+b.h+20&&y+h+20>b.y; });
    for(let i=0;i<60&&hits();i++) y+=GRID*2;
    n=newNode(k,x,y);
  }
  mmSnap(); M.nodes.push(n); sel=new Set([n.id]); selE=null; touch(); mmDraw();
  if(k==='group') editGroupLabel(n.id,true); else startEdit(n.id,true);
}
function addEdge(a,b){
  if(!a||!b||a===b) return;
  const ex=M.edges.find(e=>(e.from===a&&e.to===b)||(e.from===b&&e.to===a));
  if(ex){ sel.clear(); selE=ex.id; updateSel(); return; }
  mmSnap(); const e={id:rid(),from:a,to:b}; M.edges.push(e); sel.clear(); selE=e.id; touch(); mmDraw();
}
function removeSel(){
  if(mmRO()) return; const ids=new Set(sel); if(!ids.size&&!selE) return;
  mmSnap();
  M.nodes=M.nodes.filter(n=>!ids.has(n.id)); M.edges=M.edges.filter(e=>e.id!==selE&&!ids.has(e.from)&&!ids.has(e.to));
  sel.clear(); selE=null; touch(); mmDraw();
  toast('Odstraněno.','Vrátit',()=>{ if(S.view.kind==='mindmap') mmUndo(); });
}
function cloneInto(ns,es,dx,dy){
  const map=new Map(), add=ns.map(n=>{ const c=clone(n); c.id=rid(); map.set(n.id,c.id); c.x+=dx; c.y+=dy; return c; });
  es.filter(e=>map.has(e.from)&&map.has(e.to)).forEach(e=>{ const c=clone(e); c.id=rid(); c.from=map.get(e.from); c.to=map.get(e.to); M.edges.push(c); });
  M.nodes.push(...add); sel=new Set(add.map(n=>n.id)); selE=null;
}
function duplicate(){
  if(mmRO()||!sel.size) return;
  const ns=[...sel].map(node).filter(Boolean); mmSnap(); cloneInto(ns,M.edges,30,30); touch(); mmDraw();
}
function toggleCheck(n,i){
  const L=String(n.text||'').split('\n'); if(!/\[( |x|X)\]/.test(L[i]||'')) return;
  mmSnap(); L[i]=L[i].replace(/\[( |x|X)\]/,m=>m==='[ ]'?'[x]':'[ ]'); n.text=L.join('\n'); touch(); mmDraw();
}
/* uzly, které se posunou s výběrem (i bloky ležící celé uvnitř vybrané skupiny) */
function moving(){
  const ids=new Set(sel);
  M.nodes.forEach(g=>{
    if(g.k!=='group'||!sel.has(g.id)) return; const gb=box(g.id);
    M.nodes.forEach(n=>{ if(n.id===g.id) return; const b=box(n.id); if(b.x>=gb.x&&b.y>=gb.y&&b.x+b.w<=gb.x+gb.w&&b.y+b.h<=gb.y+gb.h) ids.add(n.id); });
  });
  return ids;
}

/* ---- psaní do bloku, názvy skupin, popisky čar ---- */
function startEdit(id,created){
  const n=node(id), el=nodeEl(id); if(!n||n.k==='group'||!el) return;
  editing={id,orig:n.text||'',pre:created?null:snapStr(),created:!!created};
  el.classList.add('edit'); buildBar();
  const tx=$('.mm-tx',el); tx.innerHTML='<textarea class="mm-ta" rows="1" aria-label="Text bloku"></textarea>';
  const ta=tx.firstChild; ta.value=n.text||''; ta.placeholder=n.k==='text'?'Text':'Text…';
  const fit=()=>{ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; };
  fit(); ta.focus({preventScroll:true}); ta.setSelectionRange(ta.value.length,ta.value.length);
  ta.addEventListener('input',()=>{ n.text=ta.value; fit(); touch(); sizes.set(id,{w:el.offsetWidth,h:el.offsetHeight}); drawEdges(); });
  ta.addEventListener('keydown',e=>{
    if(e.key==='Escape'||(e.key==='Enter'&&(e.metaKey||e.ctrlKey))){ e.preventDefault(); ta.blur(); }
    else if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing) listEnter(e,ta);
  });
  ta.addEventListener('blur',endEdit);
}
/* Enter v seznamu pokračuje další položkou, v prázdné položce seznam ukončí */
function listEnter(e,ta){
  const v=ta.value, p=ta.selectionStart; if(p!==ta.selectionEnd) return;
  const ls=v.lastIndexOf('\n',p-1)+1, line=v.slice(ls,p);
  const m=line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) )/); if(!m) return;
  e.preventDefault();
  if(line.trim()===m[0].trim()&&!v.slice(p).split('\n')[0].trim()) ta.setRangeText('',ls,p,'end');
  else { let pre=m[2]; if(/\[[ xX]\]/.test(pre)) pre=pre.replace(/\[[xX]\]/,'[ ]'); else if(m[3]) pre=(+m[3]+1)+m[4]+' '; ta.setRangeText('\n'+m[1]+pre,p,p,'end'); }
  ta.dispatchEvent(new Event('input'));
}
function endEdit(){
  if(!editing||editing.group||editing.edge) return;
  const ed=editing; editing=null;
  const n=node(ed.id);
  if(n&&n.k==='text'&&!String(n.text||'').trim()){   /* prázdný text bez rámečku zmizí */
    M.nodes=M.nodes.filter(x=>x!==n); M.edges=M.edges.filter(e=>e.from!==n.id&&e.to!==n.id); sel.delete(n.id);
    if(ed.created) undoS.pop(); else if(ed.pre){ undoS.push(ed.pre); redoS=[]; }
    touch();
  } else if(n&&ed.pre&&(n.text||'')!==ed.orig){ undoS.push(ed.pre); if(undoS.length>100) undoS.shift(); redoS=[]; }
  mmDraw();
}
function editGroupLabel(id,created){
  const n=node(id), el=nodeEl(id), gl=el&&$('.mm-gl',el); if(!n||!gl) return;
  const pre=snapStr(), orig=n.label||'';
  editing={id,group:true}; buildBar();
  gl.classList.remove('ph'); gl.innerHTML='<input class="mm-gi" aria-label="Název skupiny" placeholder="Název skupiny">';
  const inp=gl.firstChild; inp.value=orig;
  const fit=()=>{ inp.style.width=Math.max(130,Math.min(420,inp.value.length*9+34))+'px'; };
  fit(); inp.focus({preventScroll:true}); inp.select();
  inp.addEventListener('input',fit);
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key==='Escape'){ e.preventDefault(); inp.blur(); } });
  inp.addEventListener('blur',()=>{
    if(!editing||editing.id!==id) return; editing=null;
    const v=inp.value.trim();
    if(v!==orig){ if(!created){ undoS.push(pre); redoS=[]; } n.label=v; touch(); }
    mmDraw();
  });
}
function editEdgeLabel(eid){
  const e=M.edges.find(x=>x.id===eid), g=e&&edgeGeo(e); if(!g) return;
  const m=midOf(g), pre=snapStr(), orig=e.label||'';
  editing={id:eid,edge:true}; buildBar();
  stage.querySelectorAll(`.mm-el[data-e="${eid}"]`).forEach(x=>x.remove());
  const inp=document.createElement('input'); inp.className='mm-li'; inp.value=orig; inp.placeholder='Popisek'; inp.setAttribute('aria-label','Popisek čáry');
  inp.style.left=f1(m[0])+'px'; inp.style.top=f1(m[1])+'px';
  $('.mm-labels',stage).appendChild(inp); inp.focus({preventScroll:true}); inp.select();
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key==='Escape'){ ev.preventDefault(); inp.blur(); } });
  inp.addEventListener('blur',()=>{
    if(!editing||editing.id!==eid) return; editing=null;
    const v=inp.value.trim();
    if(v!==orig){ undoS.push(pre); redoS=[]; if(v) e.label=v; else delete e.label; touch(); }
    mmDraw();
  });
}

/* ---- nástroj Čára (klik na dva bloky) a horní lišta ---- */
function setToolUI(){
  if(!vp) return;
  const b=$('.mm-bar [data-mm="line"]'); if(b) b.classList.toggle('on',tool==='line');
  vp.classList.toggle('tool-line',tool==='line');
  const h=$('.mm-hint'); if(h) h.textContent=tool==='line'?(lineFrom?'Kliknout na druhý blok':'Kliknout na první blok'):'';
  stage.querySelectorAll('.mm-n.from').forEach(x=>x.classList.remove('from'));
  const el=lineFrom&&nodeEl(lineFrom); if(el) el.classList.add('from');
}
function cancelTool(){ tool=null; lineFrom=null; setToolUI(); }
function lineClick(id){
  if(!lineFrom){ lineFrom=id; setToolUI(); return; }
  if(id===lineFrom) return;
  const a=lineFrom; cancelTool(); addEdge(a,id);
}
function toolClick(e){
  const b=e.target.closest('[data-mm]'); if(!b) return;
  const v=b.dataset.mm, r=vpSize();
  if(v==='zin'||v==='zout') return zoomAt(r.w/2,r.h/2,v==='zin'?1.2:1/1.2);
  if(v==='z100') return zoomAt(r.w/2,r.h/2,1/V.z);
  if(v==='fit') return mmFit();
  if(mmRO()) return;
  if(v==='line'){
    if(tool==='line') return cancelTool();
    const ns=[...sel].filter(id=>node(id));
    if(ns.length===2) return addEdge(ns[0],ns[1]);
    tool='line'; lineFrom=ns.length===1?ns[0]:null; setToolUI(); return;
  }
  cancelTool(); addAt(v);
}

/* ---- myš, prst, kolečko ----
   prázdné místo: tažení myší = výběr rámečkem, prstem / mezerníkem / prostředním tlačítkem = posun; kolečko = posun, ⌘/Ctrl + kolečko nebo dva prsty = přiblížení */
function wpt(e){ const r=vp.getBoundingClientRect(), sx=e.clientX-r.left, sy=e.clientY-r.top; return {sx,sy,x:(sx-V.x)/V.z,y:(sy-V.y)/V.z}; }
function mmDown(e){
  const t=e.target;
  if(t.closest('.mm-selbar,.mm-ta,.mm-gi,.mm-li')||e.button===2) return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){ startPinch(); return; }
  if(ptrs.size>2) return;
  const a=document.activeElement; if(a&&a!==document.body&&/^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur();
  closePop();
  try{ vp.setPointerCapture(e.pointerId); }catch(_){}
  const base={id:e.pointerId,x0:e.clientX,y0:e.clientY,moved:false,t,shift:e.shiftKey};
  const panReq=e.button===1||space;
  const nEl=!panReq&&t.closest('.mm-n'), eEl=!panReq&&t.closest('[data-e]');
  if(nEl){
    const id=nEl.dataset.id, n=node(id); if(!n) return;
    if(tool==='line'){ lineClick(id); return; }
    if(t.closest('.mm-hd')&&!mmRO()){ G=Object.assign(base,{type:'connect',from:id,side:t.closest('.mm-hd').dataset.side}); return; }
    if(t.closest('.mm-rz')&&!mmRO()){ const b=box(id); G=Object.assign(base,{type:'resize',nid:id,w0:n.w,h0:n.k==='card'?b.h:n.h}); return; }
    if(e.shiftKey){ if(sel.has(id)) sel.delete(id); else sel.add(id); } else if(!sel.has(id)) sel=new Set([id]);
    selE=null; updateSel();
    G=Object.assign(base,{type:'move',nid:id});
    return;
  }
  if(eEl){ if(tool==='line') cancelTool(); selE=eEl.dataset.e; sel.clear(); updateSel(); G=Object.assign(base,{type:'edge',eid:selE}); return; }
  if(tool==='line') cancelTool();
  if(panReq||e.pointerType==='touch'){ G=Object.assign(base,{type:'pan',vx:V.x,vy:V.y}); vp.classList.add('panning'); return; }
  G=Object.assign(base,{type:'marquee',p0:wpt(e),keep:e.shiftKey?new Set(sel):null});
}
function begin(g){
  if(g.type==='edge'||(g.type==='move'&&mmRO())){ g.type='pan'; g.vx=V.x; g.vy=V.y; vp.classList.add('panning'); return; }   /* zamčeno: tažením bloku se jen posouvá plátno */
  vp.classList.add('dragging');
  if(g.type==='move'){ mmSnap(); g.start=new Map([...moving()].map(id=>{ const n=node(id); return [id,{x:n.x,y:n.y}]; })); }
  else if(g.type==='resize') mmSnap();
  else if(g.type==='marquee'){ const q=document.createElement('div'); q.className='mm-mq'; vp.appendChild(q); g.q=q; }
}
function mmMove(e){
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(P){ pinchMove(); return; }
  const g=G; if(!g||e.pointerId!==g.id) return;
  const dx=e.clientX-g.x0, dy=e.clientY-g.y0;
  if(!g.moved){ if(Math.hypot(dx,dy)<4) return; g.moved=true; begin(g); }
  switch(g.type){
    case 'pan': V.x=g.vx+dx; V.y=g.vy+dy; applyView(); break;
    case 'move': {
      const wx=e.altKey?dx/V.z:snapv(dx/V.z), wy=e.altKey?dy/V.z:snapv(dy/V.z);
      g.start.forEach((s,id)=>{ const n=node(id); if(!n) return; n.x=Math.round(s.x+wx); n.y=Math.round(s.y+wy); posEl(n); });
      drawEdges(); break;
    }
    case 'resize': {
      const n=node(g.nid), el=nodeEl(g.nid); if(!n||!el) break;
      n.w=Math.max(n.k==='group'?120:80,snapv(g.w0+dx/V.z)); el.style.width=n.w+'px';
      if(n.k!=='text'){ n.h=Math.max(n.k==='group'?80:40,snapv(g.h0+dy/V.z)); el.style[n.k==='group'?'height':'minHeight']=n.h+'px'; }
      sizes.set(n.id,{w:el.offsetWidth,h:el.offsetHeight}); drawEdges(); break;
    }
    case 'connect': {
      const p=wpt(e), a=box(g.from); if(!a) break;
      const hit=document.elementFromPoint(e.clientX,e.clientY), tn=hit&&hit.closest('.mm-n');
      let tid=tn&&vp.contains(tn)?tn.dataset.id:null; if(tid===g.from) tid=null;
      stage.querySelectorAll('.mm-n.drop').forEach(x=>{ if(x.dataset.id!==tid) x.classList.remove('drop'); });
      if(tn&&tid) tn.classList.add('drop');
      const p1=anchor(a,g.side);
      let geo; if(tid){ const b=box(tid), s2=sides(a,b)[1]; geo=curve(p1,g.side,anchor(b,s2),s2); } else geo=curve(p1,g.side,[p.x,p.y],null);
      const pp=pathOf(geo,'arrow'); $('.mm-tmp',svg).setAttribute('d',pp.d+pp.ar); g.tid=tid; g.p=p; break;
    }
    case 'marquee': {
      const p=wpt(e), x0=Math.min(g.p0.x,p.x), y0=Math.min(g.p0.y,p.y), x1=Math.max(g.p0.x,p.x), y1=Math.max(g.p0.y,p.y);
      Object.assign(g.q.style,{left:x0*V.z+V.x+'px',top:y0*V.z+V.y+'px',width:(x1-x0)*V.z+'px',height:(y1-y0)*V.z+'px'});
      sel=new Set(g.keep||[]);
      M.nodes.forEach(n=>{ const b=box(n.id); const hit=n.k==='group'?b.x>=x0&&b.y>=y0&&b.x+b.w<=x1&&b.y+b.h<=y1:b.x<x1&&b.x+b.w>x0&&b.y<y1&&b.y+b.h>y0; if(hit) sel.add(n.id); });
      selE=null; stage.querySelectorAll('.mm-n').forEach(el=>el.classList.toggle('sel',sel.has(el.dataset.id))); break;
    }
  }
}
function mmUp(e){
  ptrs.delete(e.pointerId);
  if(P){ if(ptrs.size<2){ P=null; saveView(); } return; }
  const g=G; if(!g||e.pointerId!==g.id) return; G=null;
  vp.classList.remove('panning','dragging');
  if(e.type==='pointercancel'&&!g.moved) return;
  if(!g.moved){ tap(g,e); return; }
  switch(g.type){
    case 'pan': saveView(); break;
    case 'move': case 'resize': touch(); mmDraw(); break;
    case 'connect': {
      $('.mm-tmp',svg).setAttribute('d','');
      stage.querySelectorAll('.mm-n.drop').forEach(x=>x.classList.remove('drop'));
      if(g.tid){ addEdge(g.from,g.tid); break; }
      const a=box(g.from), p=g.p||wpt(e), p1=a&&anchor(a,g.side); if(!a||Math.hypot(p.x-p1[0],p.y-p1[1])<30) break;
      /* puštěno do prázdna: nový blok napojený na původní */
      const [w,h]=SIZE.card, s=g.side;
      const x=s==='left'?p.x-w:s==='right'?p.x:p.x-w/2, y=s==='top'?p.y-h:s==='bottom'?p.y:p.y-h/2;
      mmSnap(); const n=newNode('card',snapv(x),snapv(y)); M.nodes.push(n); M.edges.push({id:rid(),from:g.from,to:n.id});
      sel=new Set([n.id]); selE=null; touch(); mmDraw(); startEdit(n.id,true); break;
    }
    case 'marquee': if(g.q) g.q.remove(); updateSel(); break;
  }
}
/* klik bez posunu; dvojklik se pozná sám (kvůli zachycení ukazatele i na dotykových zařízeních) */
function tap(g,e){
  const t=g.t, now=Date.now(), key=g.type==='move'?'n:'+g.nid:g.type==='edge'?'e:'+g.eid:'0';
  const dbl=!!lastTap&&lastTap.k===key&&now-lastTap.t<420&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<14;
  lastTap=dbl?null:{k:key,t:now,x:e.clientX,y:e.clientY};
  if(g.type==='move'){
    const n=node(g.nid); if(!n) return;
    if(dbl){ if(n.k==='group') editGroupLabel(n.id); else startEdit(n.id); return; }
    const cb=t.closest('.mm-cb'); if(cb){ toggleCheck(n,+cb.dataset.li); return; }
    if(t.closest('.mm-ln')){ followLink(n.id); return; }
    const a=t.closest('a.mm-a'); if(a){ window.open(a.href,'_blank','noopener'); return; }
    if(!g.shift&&sel.size>1){ sel=new Set([n.id]); updateSel(); }
    return;
  }
  if(g.type==='edge'){ if(dbl) editEdgeLabel(g.eid); return; }
  if(g.type==='connect'||g.type==='resize') return;
  if(dbl&&!mmRO()){
    const p=wpt(e), [w,h]=SIZE.card;
    mmSnap(); const n=newNode('card',snapv(p.x-w/2),snapv(p.y-h/2)); M.nodes.push(n); sel=new Set([n.id]); selE=null; touch(); mmDraw(); startEdit(n.id,true); return;
  }
  if(!g.keep&&(sel.size||selE)){ sel.clear(); selE=null; updateSel(); }
}
function startPinch(){
  if(G){ if(G.q) G.q.remove(); G=null; }
  vp.classList.remove('panning','dragging');
  const [a,b]=[...ptrs.values()];
  P={d0:Math.hypot(b.x-a.x,b.y-a.y)||1,m0:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},V0:Object.assign({},V)};
}
function pinchMove(){
  const [a,b]=[...ptrs.values()]; if(!a||!b) return;
  const r=vp.getBoundingClientRect(), d=Math.hypot(b.x-a.x,b.y-a.y), m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const z=clamp(P.V0.z*d/P.d0,ZMIN,ZMAX), wx=(P.m0.x-r.left-P.V0.x)/P.V0.z, wy=(P.m0.y-r.top-P.V0.y)/P.V0.z;
  V.z=z; V.x=m.x-r.left-wx*z; V.y=m.y-r.top-wy*z; applyView();
}
function onWheel(e){
  e.preventDefault();
  const r=vp.getBoundingClientRect(), k=e.deltaMode===1?16:e.deltaMode===2?r.height:1;
  if(e.ctrlKey||e.metaKey) zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-clamp(e.deltaY*k,-25,25)*.01));
  else { V.x-=e.deltaX*k; V.y-=e.deltaY*k; applyView(); saveView(); }
}

/* ---- mapy: přepnutí, nová, přejmenování, ikona, smazání (tlačítko Mapy); export a import mají vlastní ikony ---- */
function openMapMenu(anchor){
  const all=maps(), saved=!!S.maps[M.id];
  const h=(all.length?all.map(m=>`<button class="pop-item${m.id===M.id?' act':''}" data-v="m:${m.id}"><span class="pi-ic">${m.icon?esc(m.icon):'<span class="mm-nodot"></span>'}</span>${esc(m.title||'Bez názvu')}</button>`).join('')+'<div class="pop-sep"></div>':'')
    +`<button class="pop-item" data-v="new"><span class="pi-ic">${IC.plus}</span>Nová mapa</button>`
    +`<button class="pop-item" data-v="ren"><span class="pi-ic">${IC.edit}</span>Přejmenovat</button>`
    +`<button class="pop-item" data-v="ico"><span class="pi-ic">${IC.smile}</span>Ikona</button>`
    +(saved&&!LOCK?`<div class="pop-sep"></div><button class="pop-item danger" data-v="del"><span class="pi-ic">${IC.trash}</span>Odstranit mapu</button>`:'');
  const focusTitle=()=>setTimeout(()=>{ const ti=$('#mm-title'); if(ti){ ti.focus(); ti.select(); } },0);
  openPop(anchor,h,v=>{
    if(v.startsWith('m:')){ lsSet(CKEY,v.slice(2)); renderMindmap(); return; }
    if(v==='new'){ const m={id:rid(),title:'Nová mapa',order:Math.max(0,...maps().map(x=>x.order||0))+1,nodes:[],edges:[]}; S.maps[m.id]=m; lsSet(CKEY,m.id); Store.queue(); renderMindmap(); focusTitle(); return; }
    if(v==='ren'){ focusTitle(); return; }
    if(v==='ico'){ setTimeout(()=>openMapIcon($('.mm-maps')),0); return; }
    if(v==='del'&&!LOCK){
      const back=clone(M), nm=M.title||'Bez názvu'; delete S.maps[M.id]; Store.queue(); renderMindmap();
      toast(`Mapa „${nm}“ je odstraněná.`,'Vrátit',()=>{ S.maps[back.id]=back; lsSet(CKEY,back.id); Store.queue(); if(S.view.kind==='mindmap') renderMindmap(); });
    }
  });
}
/* smajlík mapy: ukazuje se před názvem a v seznamu map */
function openMapIcon(anchor){
  if(!anchor) return;
  /* od 4.20.0: jedno pole pro emoji místo mřížky (jako u ikony stránky) */
  const h=`<div class="pop-h">Ikona mapy</div><div class="pop-acts"><input class="emoji-one" id="mm-emoji" maxlength="8" aria-label="Emoji" value="${esc(M.icon||'')}"><button class="pop-act" data-v="custom"><span>Použít</span></button><span class="sp"></span>${M.icon?'<button class="pop-act danger" data-v="none"><span>Odebrat</span></button>':''}</div>`;
  openPop(anchor,h,(v,b,p)=>{
    let ic;
    if(v.startsWith('e:')) ic=v.slice(2);
    else if(v==='custom'){ ic=$('#mm-emoji',p).value.trim().slice(0,8); if(!ic) return true; }
    else if(v==='none') ic='';
    else return true;
    if(ic) M.icon=ic; else delete M.icon;
    touch(); renderMindmap();
  });
}
function exportCanvas(){
  const lab=n=>{ const li=linkInfo(n); return li&&!li.gone?pTitle(li.pg)+(li.b?'#'+headText(li.b):''):''; };
  const nodes=[...M.nodes].sort((a,b)=>(a.k==='group'?0:1)-(b.k==='group'?0:1)).map(n=>{
    const b=box(n.id), o={id:n.id,x:Math.round(n.x),y:Math.round(n.y),width:Math.round(b.w),height:Math.round(b.h)};
    if(n.k==='group'){ o.type='group'; if(n.label) o.label=n.label; }
    else { let t=String(n.text||''); const l=n.k==='card'&&lab(n); if(l) t=`[[${l}]]`+(t?'\n\n'+t:''); if(n.k==='text'&&t&&!/^#/.test(t)) t='## '+t; o.type='text'; o.text=t; }
    if(n.color) o.color=TO_CANVAS[n.color]; return o;
  });
  const edges=M.edges.map(e=>{
    const a=box(e.from), b=box(e.to); if(!a||!b) return null; const [s1,s2]=sides(a,b);
    const o={id:e.id,fromNode:e.from,fromSide:s1,toNode:e.to,toSide:s2};
    if(e.end==='none') o.toEnd='none'; if(e.end==='both') o.fromEnd='arrow';
    if(e.color) o.color=TO_CANVAS[e.color]; if(e.label) o.label=e.label; return o;
  }).filter(Boolean);
  downloadFile((M.title||'Mapa').replace(/[\\/:*?"<>|]+/g,'-')+'.canvas',JSON.stringify({nodes,edges},null,'\t'));
}
/* soubor .canvas (JSON Canvas 1.0) → mapa; [[Stránka#Nadpis]] na začátku textu se propojí, když taková stránka existuje */
function fromCanvas(d,title){
  const ids=new Map(), num=(v,dv)=>Number.isFinite(+v)&&v!==null&&v!==''?Math.round(+v):dv;
  const findPage=s=>{ const k=norm(String(s).replace(/^.*\//,'').replace(/\.md$/i,'').trim()); return Object.values(S.pages).find(p=>norm(pTitle(p))===k); };
  const nodes=d.nodes.filter(o=>o&&typeof o==='object').map(o=>{
    const id=rid(); ids.set(o.id,id);
    const n={id,k:o.type==='group'?'group':'card',x:num(o.x,0),y:num(o.y,0),w:Math.max(40,num(o.width,240)),h:Math.max(30,num(o.height,72))};
    if(n.k==='group') n.label=String(o.label||'');
    else {
      let t=o.type==='file'?`[[${o.file||''}${o.subpath||''}]]`:o.type==='link'?String(o.url||''):String(o.text||'');
      const m=t.match(/^\[\[([^\]|#]+)(#([^\]|]+))?(\|[^\]]*)?\]\]\s*/), pg=m&&findPage(m[1]);
      if(pg){ n.page=pg.id; if(m[3]){ const h=(pg.blocks||[]).find(b=>isHead(b)&&norm(headText(b))===norm(m[3])); if(h) n.hid=h.id; } t=t.slice(m[0].length); }
      n.text=t;
    }
    const c=FROM_CANVAS[String(o.color)]; if(c) n.color=c;
    return n;
  });
  const edges=(Array.isArray(d.edges)?d.edges:[]).filter(e=>e&&ids.has(e.fromNode)&&ids.has(e.toNode)).map(e=>{
    const fe=e.fromEnd==='arrow', te=e.toEnd!=='none', back=fe&&!te;
    const o={id:rid(),from:ids.get(back?e.toNode:e.fromNode),to:ids.get(back?e.fromNode:e.toNode)};
    if(fe&&te) o.end='both'; else if(!fe&&!te) o.end='none';
    const c=FROM_CANVAS[String(e.color)]; if(c) o.color=c; if(e.label) o.label=String(e.label);
    return o;
  });
  return {id:rid(),title,order:Math.max(0,...maps().map(x=>x.order||0))+1,nodes,edges};
}
function importCanvas(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.canvas,.json,application/json';
  inp.addEventListener('change',async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    try{
      const d=JSON.parse(await f.text()); if(!d||!Array.isArray(d.nodes)) throw new Error('bad');
      const m=fromCanvas(d,f.name.replace(/\.(canvas|json)$/i,'')||'Mapa');
      S.maps[m.id]=m; lsSet(CKEY,m.id); Store.queue();
      if(S.view.kind==='mindmap') renderMindmap(); else go({kind:'mindmap'});
      toast(`Načteno: ${m.nodes.length} ${plural(m.nodes.length,'blok','bloky','bloků')}, ${m.edges.length} ${plural(m.edges.length,'čára','čáry','čar')}.`);
    }catch(_){ toast('Soubor se nepodařilo načíst. Je to .canvas z Obsidianu?'); }
  });
  inp.click();
}

/* ---- pohled ---- */
function renderMindmap(){
  const m=pickMap();
  if(!M||M.id!==m.id){ sel=new Set(); selE=null; undoS=[]; redoS=[]; tool=null; lineFrom=null; V=loadView(m.id); }
  M=m; editing=null; G=null; P=null; ptrs.clear();
  sel=new Set([...sel].filter(id=>node(id))); if(selE&&!M.edges.some(e=>e.id===selE)) selE=null;
  $('#view').innerHTML=`<div class="view mm-view">
    <div class="v-head"><div class="mm-tt">${M.icon?`<button class="mm-ico" title="Změnit ikonu" aria-label="Změnit ikonu">${esc(M.icon)}</button>`:''}<input class="v-title mm-title" id="mm-title" value="${esc(M.title||'')}" placeholder="Bez názvu" aria-label="Název mapy" spellcheck="false" autocomplete="off"></div>
      <div class="v-tools"><button class="btn btn-text mm-maps" aria-haspopup="true">${MIC.maps}<span>Mapy</span></button>
        <button class="icon-btn mm-io" data-io="imp" title="Importovat .canvas (Obsidian)" aria-label="Importovat .canvas">${MIC.imp}</button><button class="icon-btn mm-io" data-io="exp" title="Exportovat do .canvas" aria-label="Exportovat do .canvas">${MIC.exp}</button>
        <span class="dash-sep" aria-hidden="true"></span><button class="icon-btn lock-btn" data-act="lock"></button>${modeBtn()}</div></div>
    <div class="sheet mm-sheet">
      <div class="mm-bar" role="toolbar" aria-label="Vložit do mapy">
        <button class="mm-tb mm-add" data-mm="text" title="Text bez rámečku">${MIC.text}<span>Text</span></button>
        <button class="mm-tb mm-add" data-mm="card" title="Blok (nebo dvojklik do plátna)">${MIC.card}<span>Blok</span></button>
        <button class="mm-tb mm-add" data-mm="group" title="Skupina (obalí vybrané bloky)">${MIC.group}<span>Skupina</span></button>
        <button class="mm-tb mm-add" data-mm="line" title="Čára mezi dvěma bloky">${MIC.line}<span>Čára</span></button>
        <span class="mm-hint" aria-live="polite"></span><span class="sp"></span>
        <button class="mm-tb mm-z" data-mm="zout" title="Oddálit" aria-label="Oddálit">${IC.minus}</button><button class="mm-tb mm-zv" data-mm="z100" title="Zpět na 100 %">100 %</button><button class="mm-tb mm-z" data-mm="zin" title="Přiblížit" aria-label="Přiblížit">${IC.plus}</button><button class="mm-tb" data-mm="fit" title="Celá mapa" aria-label="Celá mapa">${MIC.fit}</button>
      </div>
      <div class="mm-vp">
        <div class="mm-stage"><div class="mm-groups"></div><svg class="mm-edges" aria-hidden="true"><g class="mm-eg"></g><path class="mm-tmp" d=""/></svg><div class="mm-nodes"></div><div class="mm-labels"></div></div>
        <div class="mm-empty">Dvojklik přidá blok</div>
        <div class="mm-selbar" hidden></div>
      </div>
    </div></div>`;
  vp=$('.mm-vp'); stage=$('.mm-stage',vp); svg=$('.mm-edges',vp);
  vp.addEventListener('pointerdown',mmDown);
  vp.addEventListener('pointermove',mmMove);
  vp.addEventListener('pointerup',mmUp);
  vp.addEventListener('pointercancel',mmUp);
  vp.addEventListener('wheel',onWheel,{passive:false});
  vp.addEventListener('gesturestart',e=>{ e.preventDefault(); gz=V.z; });
  vp.addEventListener('gesturechange',e=>{ e.preventDefault(); const r=vp.getBoundingClientRect(); zoomAt(e.clientX-r.left,e.clientY-r.top,gz*e.scale/V.z); });
  vp.addEventListener('click',e=>{ if(e.target.closest('a.mm-a')) e.preventDefault(); });
  $('.mm-selbar',vp).addEventListener('click',barClick);
  $('.mm-bar').addEventListener('click',toolClick);
  $('.mm-maps').addEventListener('click',e=>openMapMenu(e.currentTarget));
  const ico=$('.mm-ico'); if(ico) ico.addEventListener('click',()=>openMapIcon(ico));
  document.querySelectorAll('.mm-io').forEach(b=>b.addEventListener('click',()=>{ if(b.dataset.io==='imp') importCanvas(); else if(M.nodes.length) exportCanvas(); else toast('Mapa je prázdná.'); }));
  const ti=$('#mm-title');
  ti.addEventListener('input',()=>{ M.title=ti.value; touch(); });
  ti.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key==='Escape'){ e.preventDefault(); ti.blur(); } });
  ti.addEventListener('blur',()=>{ if(!ti.value.trim()&&S.maps[M.id]){ M.title='Bez názvu'; ti.value=M.title; touch(); } });
  const fresh=!V; if(fresh) V={x:0,y:0,z:1};
  mmDraw();
  if(fresh) mmFit(); else applyView();
  applyLock();
}

/* ---- klávesy a schránka (jen když je mapa otevřená a nepíše se do políčka) ---- */
function mmActive(){
  if(S.view.kind!=='mindmap'||!vp||!vp.isConnected||S.modal) return false;
  const a=document.activeElement; return !(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
}
function mmKey(e){
  if(!mmActive()||(S.pop&&e.key!=='Escape')) return;
  if(e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const mod=(e.metaKey||e.ctrlKey)&&!e.altKey, k=e.key.toLowerCase();
  if(e.key===' '&&!mod){ e.preventDefault(); if(!space){ space=true; vp.classList.add('pan'); } return; }
  if(mod&&(k==='z'||k==='y')){ e.preventDefault(); if(!mmRO()){ if(k==='y'||e.shiftKey) mmRedo(); else mmUndo(); } return; }
  if(mod&&k==='a'){ e.preventDefault(); sel=new Set(M.nodes.map(n=>n.id)); selE=null; updateSel(); return; }
  if(mod&&k==='d'){ e.preventDefault(); duplicate(); return; }
  if(mod&&(k==='='||k==='+'||k==='-'||k==='0')){ e.preventDefault(); const r=vpSize(); zoomAt(r.w/2,r.h/2,k==='0'?1/V.z:k==='-'?1/1.2:1.2); return; }
  if(mod||e.altKey) return;
  if(e.key==='Delete'||e.key==='Backspace'){ if(sel.size||selE){ e.preventDefault(); removeSel(); } return; }
  if(e.key==='Escape'){ if(tool) cancelTool(); else if(sel.size||selE){ sel.clear(); selE=null; updateSel(); } return; }
  if(e.key==='Enter'&&sel.size===1){ e.preventDefault(); const n=node([...sel][0]); if(n){ if(n.k==='group') editGroupLabel(n.id); else startEdit(n.id); } return; }
  if(e.key.startsWith('Arrow')&&sel.size&&!mmRO()){
    e.preventDefault(); const d=e.shiftKey?GRID*5:GRID;
    const dx=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0, dy=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0;
    if(!e.repeat) mmSnap();
    moving().forEach(id=>{ const n=node(id); n.x+=dx; n.y+=dy; posEl(n); }); touch(); drawEdges(); mmPlaceBar();
  }
}
function onClip(e,cut){
  if(!mmActive()||!sel.size) return;
  const ns=[...sel].map(node).filter(Boolean), ids=new Set(ns.map(n=>n.id));
  const txt=ns.filter(n=>n.k!=='group').map(n=>n.text||'').filter(Boolean).join('\n\n')||ns.map(n=>n.label||'').filter(Boolean).join('\n')||'(mapa)';
  clip={nodes:clone(ns),edges:clone(M.edges.filter(x=>ids.has(x.from)&&ids.has(x.to))),sig:txt,n:0};
  e.clipboardData.setData('text/plain',txt); e.preventDefault();
  if(cut) removeSel();
}
function onPaste(e){
  if(!mmActive()||mmRO()) return;
  const txt=(e.clipboardData&&e.clipboardData.getData('text/plain'))||'';
  if(clip&&txt===clip.sig){ e.preventDefault(); clip.n++; mmSnap(); cloneInto(clip.nodes,clip.edges,30*clip.n,30*clip.n); touch(); mmDraw(); return; }
  if(!txt.trim()) return;
  e.preventDefault();
  const r=vpSize(), w=clamp(Math.round(Math.sqrt(txt.length)*28),SIZE.card[0],480), cx=(r.w/2-V.x)/V.z, cy=(r.h/2-V.y)/V.z;
  mmSnap(); const n=newNode('card',snapv(cx-w/2),snapv(cy-40),{w,text:txt.replace(/\r\n?/g,'\n').trim()}); M.nodes.push(n); sel=new Set([n.id]); selE=null; touch(); mmDraw();
}
function initMindmap(){
  document.addEventListener('keydown',mmKey);
  document.addEventListener('keyup',e=>{ if(e.key===' '&&space){ space=false; if(vp) vp.classList.remove('pan'); } });
  window.addEventListener('blur',()=>{ space=false; if(vp) vp.classList.remove('pan'); });
  document.addEventListener('copy',e=>onClip(e,false));
  document.addEventListener('cut',e=>onClip(e,true));
  document.addEventListener('paste',onPaste);
}

export { initMindmap, renderMindmap };
