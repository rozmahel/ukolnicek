/* Úkolníček – Porovnání a spojení dvou verzí dat („Ponechat obě“), zachování kurzoru */
import { $, clone, rid } from '../core.js';
import { S } from '../state.js';
import { canon } from '../store.js';
import { caretOffset, focusEl } from '../editor/caret.js';
import { deviceName } from './sync.js';

/* ---- spojení dvou verzí („Ponechat obě“) ----
   B = poslední verze společná s Diskem (když je k dispozici, pozná se, kde se co změnilo).
   Co se změnilo jen na jedné straně, převezme se; co se změnilo na obou, zůstane dvakrát (tvoje jako kopie). */
function pageSig(p){ if(!p) return ''; const c=clone(p); delete c.updated; (c.blocks||[]).forEach(b=>{ delete b.collapsed; }); return canon(c); }
function evSig(e){ return e?canon(e):''; }
/* ---- jedna stránka změněná na obou stranách: spojení po blocích (se společným základem B) ----
   vlastnosti stránky po položkách; bloky podle ID: změněný jen na jedné straně se převezme, smazaný na jedné
   a nezměněný na druhé zmizí, změněný na obou různě zůstane dvakrát (verze z Disku / jiného okna a pod ní tvoje kopie).
   Pořadí podle strany, která pořadí měnila. Vrací {page,copies}, nebo null, když se na obou změnila stejná vlastnost stránky. */
const blkSig=b=>{ if(!b) return ''; const c=clone(b); delete c.collapsed; return canon(c); };
function mergePage(L,R,B){
  const out=clone(R);
  for(const k of new Set([...Object.keys(L),...Object.keys(R),...Object.keys(B)])){
    if(k==='blocks'||k==='updated'||k==='id') continue;
    const l=canon(L[k]), r=canon(R[k]), b=canon(B[k]);
    if(l===r||l===b) continue;
    if(r===b){ if(L[k]===undefined) delete out[k]; else out[k]=clone(L[k]); continue; }
    return null;
  }
  const bl=L.blocks||[], br=R.blocks||[], bb=B.blocks||[];
  const mL=new Map(bl.map(x=>[x.id,x])), mR=new Map(br.map(x=>[x.id,x])), mB=new Map(bb.map(x=>[x.id,x]));
  const keep=new Map(), extra=new Map(); let copies=0;
  new Set([...mL.keys(),...mR.keys()]).forEach(id=>{
    const l=mL.get(id), r=mR.get(id), b=mB.get(id), sb=blkSig(b);
    if(l&&r){
      const sl=blkSig(l), sr=blkSig(r);
      if(sl===sr||sl===sb) keep.set(id,r);
      else if(sr===sb) keep.set(id,l);
      else { keep.set(id,r); const c=clone(l); c.id=rid(); delete c.until; delete c.untilVis; extra.set(id,c); copies++; }
      return;
    }
    const v=l||r;
    if(b&&blkSig(v)===sb) return;   /* smazaný na druhé straně, tady beze změny */
    keep.set(id,v);                 /* nový, nebo změněný a na druhé straně smazaný: zůstane */
  });
  const common=bb.map(x=>x.id).filter(id=>mL.has(id)&&mR.has(id)), cs=new Set(common);
  const ord=a=>a.map(x=>x.id).filter(id=>cs.has(id)).join(','), oB=common.join(',');
  const [pri,sec]=ord(br)===oB&&ord(bl)!==oB?[bl,br]:[br,bl];
  const seq=pri.map(x=>x.id).filter(id=>keep.has(id)), inSeq=new Set(seq);
  sec.forEach((x,i)=>{
    if(!keep.has(x.id)||inSeq.has(x.id)) return;
    let at=0; for(let j=i-1;j>=0;j--){ const p=seq.indexOf(sec[j].id); if(p>=0){ at=p+1; break; } }
    seq.splice(at,0,x.id); inSeq.add(x.id);
  });
  out.blocks=[]; seq.forEach(id=>{ out.blocks.push(clone(keep.get(id))); if(extra.has(id)) out.blocks.push(extra.get(id)); });
  const ids=new Set(out.blocks.map(x=>x.id));
  out.blocks.forEach(x=>{ if(x.until&&!ids.has(x.until)){ delete x.until; delete x.untilVis; } });
  out.updated=Math.max(L.updated||0,R.updated||0);
  return {page:out,copies};
}
function syncDiff(L,R,B){
  const out={here:[],drive:[],both:[],differ:[],copies:0};
  const name=(k,lv,rv,inBase)=>{
    const v=lv||rv; const t=k==='trash'?'🗑 '+((v.pages&&v.pages[0]&&v.pages[0].title)||'Bez názvu'):k==='pages'?(v.icon?v.icon+' ':'')+(v.title||'Bez názvu'):k==='subjects'?'🎓 '+[v.code,v.name].filter(Boolean).join(' '):k==='semesters'?'📅 '+(v.name||'Semestr'):'🗓️ '+(v.title||'Bez názvu')+(v.start?' '+v.start:'');
    if(lv&&rv) return t;
    if(inBase==null) return t+(lv?' (jen tady)':' (jen na Disku)');
    return t+(inBase?(lv?' (na Disku smazáno)':' (tady smazáno)'):(lv?' (nové tady)':' (nové na Disku)'));
  };
  [['pages',pageSig],['events',evSig],['subjects',evSig],['semesters',evSig],['trash',evSig]].forEach(([k,sig])=>{
    const l=L[k]||{}, r=R[k]||{}, b=B?(B[k]||{}):null;
    new Set([...Object.keys(l),...Object.keys(r)]).forEach(id=>{
      const lv=l[id], rv=r[id], sl=sig(lv), sr=sig(rv); if(sl===sr) return;
      if(b){
        const sb=sig(b[id]);
        if(sl===sb){ out.drive.push(name(k,lv,rv,!!b[id])); return; }
        if(sr===sb){ out.here.push(name(k,lv,rv,!!b[id])); return; }
        out.both.push(name(k,lv,rv,!!b[id]));
        if(k==='pages'&&lv&&rv&&b[id]){ const m=mergePage(lv,rv,b[id]); out.copies+=m?m.copies:1; return; }
        if(lv&&rv&&k!=='semesters'&&k!=='trash') out.copies++; return;
      }
      out.differ.push(name(k,lv,rv,null)); if(lv&&rv&&k!=='semesters'&&k!=='trash') out.copies++;
    });
  });
  const ls=L.settings||{}, rs=R.settings||{};
  if(canon(ls)!==canon(rs)){
    const bs=B&&B.settings; const ch=k=>canon(ls[k])!==canon(bs[k]), cr=k=>canon(rs[k])!==canon(bs[k]);
    const keys=[...new Set([...Object.keys(ls),...Object.keys(rs)])].filter(k=>canon(ls[k])!==canon(rs[k]));
    if(!bs) out.differ.push('⚙️ Nastavení');
    else { const h=keys.some(ch), d=keys.some(cr); (h&&d?out.both:h?out.here:out.drive).push('⚙️ Nastavení'); }
  }
  return out;
}
function mergeData(L,R,B){
  const dev=deviceName(), out={pages:{},events:{},settings:{},subjects:{},semesters:{},trash:{}}; let copies=0;
  [['pages',pageSig],['events',evSig],['subjects',evSig],['semesters',evSig],['trash',evSig]].forEach(([k,sig])=>{
    const l=L[k]||{}, r=R[k]||{}, b=B?(B[k]||{}):null;
    new Set([...Object.keys(l),...Object.keys(r)]).forEach(id=>{
      const lv=l[id], rv=r[id], sl=sig(lv), sr=sig(rv);
      if(sl===sr){ out[k][id]=clone(lv||rv); return; }
      if(b){
        const sb=sig(b[id]);
        if(sl===sb){ if(rv) out[k][id]=clone(rv); return; }   /* změněno (nebo smazáno) jen na Disku */
        if(sr===sb){ if(lv) out[k][id]=clone(lv); return; }   /* změněno (nebo smazáno) jen tady */
        if(k==='pages'&&lv&&rv&&b[id]){ const m=mergePage(lv,rv,b[id]); if(m){ out[k][id]=m.page; copies+=m.copies; return; } }   /* změněno na obou: po blocích */
      }
      if(rv) out[k][id]=clone(rv);
      if(!lv) return;
      if(!rv){ out[k][id]=clone(lv); return; }               /* smazané na jedné straně a změněné na druhé: ponechat */
      if(k==='semesters'||k==='trash') return;               /* semestr a položka koše zůstanou jen jednou (verze z Disku) */
      const c=clone(lv); c.id=rid(); copies++;
      if(k==='subjects') c.name=(lv.name||lv.code||'Předmět')+' (kopie – '+dev+')';
      else c.title=(lv.title||'Bez názvu')+' (kopie – '+dev+')';
      if(k==='pages'){ c.order=(lv.order||0)+.5; const ids=new Map(); (c.blocks||[]).forEach(bl=>{ const n=rid(); ids.set(bl.id,n); bl.id=n; });
        (c.blocks||[]).forEach(bl=>{ if(bl.until){ if(ids.has(bl.until)) bl.until=ids.get(bl.until); else { delete bl.until; delete bl.untilVis; } } }); }   /* „sbalovat až sem“ ukazuje na bloky kopie */
      out[k][c.id]=c;
    });
  });
  /* stránka smazaná do koše na jedné straně a upravená na druhé zůstala: vrátí se z koše i její podstránky */
  Object.values(out.trash).forEach(t=>{
    if(!out.pages[t.id]) return;
    (t.pages||[]).forEach(p=>{ if(!out.pages[p.id]) out.pages[p.id]=clone(p); });
    delete out.trash[t.id];
  });
  Object.values(out.trash).forEach(t=>{ t.pages=(t.pages||[]).filter(p=>!out.pages[p.id]); if(!t.pages.length) delete out.trash[t.id]; });
  /* podstránky stránky, která zmizela, přesunout na nejvyšší úroveň */
  Object.values(out.pages).forEach(p=>{ if(p.parent&&!out.pages[p.parent]) p.parent=null; });
  /* nastavení po položkách: změněné na Disku se převezme, jinak zůstane to z tohoto zařízení */
  const ls=L.settings||{}, rs=R.settings||{}, bs=B?(B.settings||{}):null;
  new Set([...Object.keys(ls),...Object.keys(rs)]).forEach(key=>{
    const v=(bs&&canon(ls[key])===canon(bs[key]))?rs[key]:ls[key];
    if(v!==undefined) out.settings[key]=clone(v);
  });
  return {data:out,copies};
}
/* kurzor a posunutí stránky přežijí překreslení po stažení */
function keepFocus(){
  const main=$('#main'), k={st:main?main.scrollTop:0,page:S.view.kind==='page'?S.view.pageId:null};
  const a=document.activeElement, doc=$('#doc');
  if(!a||!doc||!doc.contains(a)) return k;
  if(a.id==='page-title'){ k.title=true; k.off=caretOffset(a); return k; }
  const blk=a.closest&&a.closest('.blk[data-id]');
  if(blk&&a.classList.contains('txt')&&!a.classList.contains('cell-txt')){ k.id=blk.dataset.id; k.off=caretOffset(a); }
  return k;
}
function restoreFocus(k){
  if(!k) return;
  const main=$('#main'); if(main) main.scrollTop=k.st;
  if(!k.page||S.view.kind!=='page'||S.view.pageId!==k.page) return;
  if(k.title){ const t=$('#page-title'); if(t) focusEl(t,k.off); return; }
  if(k.id){ const el=$(`#blocks .blk[data-id="${k.id}"] .txt:not(.cell-txt)`); if(el) focusEl(el,k.off); }
}

export { keepFocus, mergeData, restoreFocus, syncDiff };
