/* Úkolníček – Hledání (⌘K) */
import { $, clamp, esc, norm, plain } from '../core.js';
import { S } from '../state.js';
import { pIcon, pTitle } from '../pages.js';
import { subjBlockText } from '../school.js';
import { go } from '../router.js';
import { closeModal, openModal } from '../ui.js';

/* ================= search ================= */
function openSearch(){
  const m=openModal('',`<input class="q-in" id="q" placeholder="Hledat stránky a poznámky…" autocomplete="off" aria-label="Hledat"><div class="q-res" id="qres"></div>`);
  let idx=0, res=[];
  const draw=()=>{
    const q=norm($('#q',m).value.trim());
    res=Object.values(S.pages).map(p=>{
      const tt=norm(pTitle(p)); let snip='', score=0;
      if(!q) score=1; else if(tt.includes(q)) score=3;
      else { const txt=(p.blocks||[]).map(b=>b.type==='subj'?subjBlockText(b):b.type==='table'?(b.rows||[]).map(r=>r.cells.map(c=>c.lines.map(l=>plain(l.html)).join(' ')).join(' ')).join(' '):plain(b.html)).join(' · ')+' '+(p.props||[]).map(x=>x.k+' '+x.v).join(' ');
        const i=norm(txt).indexOf(q); if(i>=0){ score=2; snip=txt.slice(Math.max(0,i-30),i+60); } }
      return {p,score,snip};
    }).filter(r=>r.score).sort((a,b)=>b.score-a.score).slice(0,12);
    idx=clamp(idx,0,Math.max(0,res.length-1));
    $('#qres',m).innerHTML=res.length?res.map((r,i)=>`<button class="q-item ${i===idx?'act':''}" data-i="${i}">${pIcon(r.p)}<span>${esc(pTitle(r.p))}${r.snip?`<small>…${esc(r.snip)}…</small>`:''}</span></button>`).join(''):`<div class="empty" style="padding:14px">Nic nenalezeno.</div>`;
  };
  draw();
  $('#q',m).addEventListener('input',()=>{ idx=0; draw(); });
  $('#q',m).addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); idx++; draw(); } else if(e.key==='ArrowUp'){ e.preventDefault(); idx--; draw(); }
    else if(e.key==='Enter'&&res[idx]){ e.preventDefault(); closeModal(); go({kind:'page',pageId:res[idx].p.id}); }
  });
  $('#qres',m).addEventListener('click',e=>{ const b=e.target.closest('[data-i]'); if(b){ closeModal(); go({kind:'page',pageId:res[+b.dataset.i].p.id}); } });
  setTimeout(()=>$('#q',m).focus(),20);
}

export { openSearch };
