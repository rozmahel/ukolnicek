/* Úkolníček – Hledání (⌘K): stránky, archiv a koš; hledání na stránce je v js/editor/find.js (⌘F) */
import { $, clamp, esc, norm } from '../core.js';
import { S } from '../state.js';
import { isArchived, pIcon, pTitle, revealBlock } from '../pages.js';
import { go } from '../router.js';
import { closeModal, openModal } from '../ui.js';
import { blockText, findOpen } from '../editor/find.js';

/* ================= search ================= */
/* proklik na shodu v textu: stránka se otevře a pokračuje se hledáním na stránce (⌘F lišta), u stránky v koši její náhled */
function openRes(r){
  closeModal();
  if(r.tr){ go({kind:'trash',id:r.tr}); if(r.q) setTimeout(()=>findOpen(r.raw),40); return; }
  if(r.bid) revealBlock(r.p.id,r.bid,false,true); else go({kind:'page',pageId:r.p.id});
  if(r.q) setTimeout(()=>findOpen(r.raw,r.bid),60);
}
/* stránky, archiv i koš (od 4.23.0); koš a archiv až za běžnými stránkami */
function searchPool(){
  const out=Object.values(S.pages).map(p=>({p,arch:isArchived(p)}));
  Object.values(S.trash||{}).forEach(t=>(t.pages||[]).forEach(p=>out.push({p,tr:t.id})));
  return out;
}
function openSearch(){
  const m=openModal('',`<input class="q-in" id="q" placeholder="Hledat stránky a poznámky…" autocomplete="off" aria-label="Hledat"><div class="q-res" id="qres"></div>`);
  let idx=0, res=[];
  const draw=()=>{
    const raw=$('#q',m).value.trim(), q=norm(raw);
    res=searchPool().map(({p,arch,tr})=>{
      const tt=norm(pTitle(p)); let snip='', score=0, bid=null;
      if(!q) score=tr?0:1; else if(tt.includes(q)) score=3;
      else {
        /* první blok, ve kterém text je: na něj se po otevření skočí */
        for(const b of (p.blocks||[])){
          const txt=blockText(b);
          const i=norm(txt).indexOf(q); if(i>=0){ score=2; bid=b.id; snip=txt.slice(Math.max(0,i-30),i+60); break; }
        }
        if(!score){ const txt=(p.props||[]).map(x=>x.k+' '+x.v).join(' '); const i=norm(txt).indexOf(q); if(i>=0){ score=2; snip=txt.slice(Math.max(0,i-30),i+60); } }
      }
      if(score&&arch) score-=.5;
      if(score&&tr) score-=.75;
      return {p,score,snip,bid,q,raw,arch,tr};
    }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
    idx=clamp(idx,0,Math.max(0,res.length-1));
    $('#qres',m).innerHTML=res.length?res.map((r,i)=>`<button class="q-item ${i===idx?'act':''}" data-i="${i}">${pIcon(r.p)}<span>${esc(pTitle(r.p))}${r.arch?' <em class="q-arch">archiv</em>':''}${r.tr?' <em class="q-arch">koš</em>':''}${r.snip?`<small>…${esc(r.snip)}…</small>`:''}</span></button>`).join(''):`<div class="empty">Nic nenalezeno.</div>`;
  };
  draw();
  $('#q',m).addEventListener('input',()=>{ idx=0; draw(); });
  $('#q',m).addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); idx++; draw(); } else if(e.key==='ArrowUp'){ e.preventDefault(); idx--; draw(); }
    else if(e.key==='Enter'&&res[idx]){ e.preventDefault(); openRes(res[idx]); }
  });
  $('#qres',m).addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b) openRes(res[+b.dataset.i]); });
  setTimeout(()=>$('#q',m).focus(),20);
}

export { openSearch };
