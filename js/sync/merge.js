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
function syncDiff(L,R,B){
  const out={here:[],drive:[],both:[],differ:[],copies:0};
  const name=(k,lv,rv,inBase)=>{
    const v=lv||rv; const t=k==='pages'?(v.icon?v.icon+' ':'')+(v.title||'Bez názvu'):k==='subjects'?'🎓 '+[v.code,v.name].filter(Boolean).join(' '):k==='semesters'?'📅 '+(v.name||'Semestr'):'🗓️ '+(v.title||'Bez názvu')+(v.start?' '+v.start:'');
    if(lv&&rv) return t;
    if(inBase==null) return t+(lv?' (jen tady)':' (jen na Disku)');
    return t+(inBase?(lv?' (na Disku smazáno)':' (tady smazáno)'):(lv?' (nové tady)':' (nové na Disku)'));
  };
  [['pages',pageSig],['events',evSig],['subjects',evSig],['semesters',evSig]].forEach(([k,sig])=>{
    const l=L[k]||{}, r=R[k]||{}, b=B?(B[k]||{}):null;
    new Set([...Object.keys(l),...Object.keys(r)]).forEach(id=>{
      const lv=l[id], rv=r[id], sl=sig(lv), sr=sig(rv); if(sl===sr) return;
      if(b){
        const sb=sig(b[id]);
        if(sl===sb){ out.drive.push(name(k,lv,rv,!!b[id])); return; }
        if(sr===sb){ out.here.push(name(k,lv,rv,!!b[id])); return; }
        out.both.push(name(k,lv,rv,!!b[id])); if(lv&&rv&&k!=='semesters') out.copies++; return;
      }
      out.differ.push(name(k,lv,rv,null)); if(lv&&rv&&k!=='semesters') out.copies++;
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
  const dev=deviceName(), out={pages:{},events:{},settings:{},subjects:{},semesters:{}}; let copies=0;
  [['pages',pageSig],['events',evSig],['subjects',evSig],['semesters',evSig]].forEach(([k,sig])=>{
    const l=L[k]||{}, r=R[k]||{}, b=B?(B[k]||{}):null;
    new Set([...Object.keys(l),...Object.keys(r)]).forEach(id=>{
      const lv=l[id], rv=r[id], sl=sig(lv), sr=sig(rv);
      if(sl===sr){ out[k][id]=clone(lv||rv); return; }
      if(b){
        const sb=sig(b[id]);
        if(sl===sb){ if(rv) out[k][id]=clone(rv); return; }   /* změněno (nebo smazáno) jen na Disku */
        if(sr===sb){ if(lv) out[k][id]=clone(lv); return; }   /* změněno (nebo smazáno) jen tady */
      }
      if(rv) out[k][id]=clone(rv);
      if(!lv) return;
      if(!rv){ out[k][id]=clone(lv); return; }               /* smazané na jedné straně a změněné na druhé: ponechat */
      if(k==='semesters') return;                            /* semestr zůstane jen jednou (verze z Disku) */
      const c=clone(lv); c.id=rid(); copies++;
      if(k==='subjects') c.name=(lv.name||lv.code||'Předmět')+' (kopie – '+dev+')';
      else c.title=(lv.title||'Bez názvu')+' (kopie – '+dev+')';
      if(k==='pages'){ c.order=(lv.order||0)+.5; const ids=new Map(); (c.blocks||[]).forEach(bl=>{ const n=rid(); ids.set(bl.id,n); bl.id=n; });
        (c.blocks||[]).forEach(bl=>{ if(bl.until){ if(ids.has(bl.until)) bl.until=ids.get(bl.until); else { delete bl.until; delete bl.untilVis; } } }); }   /* „sbalovat až sem“ ukazuje na bloky kopie */
      out[k][c.id]=c;
    });
  });
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
