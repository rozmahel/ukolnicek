/* Úkolníček – Nastavení → AI: poskytovatelé (klíč, model, Ověřit, Smazat klíč), výchozí poskytovatel, styl a jazyk, útrata.
   Vše kromě útraty jde do settings.ai (přes aiUpdate v js/ai.js); útrata je ze statistik v zařízení (js/ai/stats.js). */
import { $, $$, esc } from '../core.js';
import { renderMain } from '../router.js';
import { toast } from '../ui.js';
import { aiCfg, aiConfigured, aiDefault, aiErrText, aiKey, aiModel, aiProviders, aiUpdate, aiVerify } from '../ai.js';
import { AI_LANGS, AI_STYLES } from '../ai/actions.js';
import { aiSpent, aiSpentReset } from '../ai/stats.js';

const AI_OWN='__own';
function aiPaneHtml(){
  const c=aiCfg(), def=aiDefault(), ready=aiConfigured();
  const pv=P=>{
    const key=aiKey(P.id), m=aiModel(P.id), preset=P.models.some(x=>x[0]===m);
    return `<div class="ai-pv" data-pv="${P.id}">
      <div class="ai-pv-h"><b>${esc(P.name)}</b><span class="ai-tag${P.free?' free':''}">${P.free?'zdarma':'placené'}</span><span class="sp"></span>
        ${key&&ready.length>1?`<label class="ai-def"><input type="radio" name="ai-def" value="${P.id}" ${def===P.id?'checked':''}> Výchozí</label>`:key?'<span class="note">Výchozí</span>':''}</div>
      <div class="ai-key"><input class="inp" type="password" data-ai-key value="${esc(key)}" placeholder="API klíč" autocomplete="off" spellcheck="false" aria-label="API klíč ${esc(P.name)}"><button type="button" class="btn" data-ai-eye>Zobrazit</button></div>
      <div class="ai-model"><select class="inp" data-ai-model aria-label="Model">${P.models.map(([v,l])=>`<option value="${esc(v)}" ${v===m?'selected':''}>${esc(l)}</option>`).join('')}<option value="${AI_OWN}" ${preset?'':'selected'}>Vlastní název…</option></select>
        <input class="inp" data-ai-own value="${preset?'':esc(m)}" placeholder="název modelu" spellcheck="false" aria-label="Vlastní název modelu" ${preset?'hidden':''}></div>
      <div class="m-actions"><button type="button" class="btn" data-ai-verify ${key?'':'disabled'}>Ověřit</button><button type="button" class="btn danger" data-ai-del ${key?'':'disabled'}>Smazat klíč</button><span class="note ai-vs" role="status"></span></div>
      <p class="note">${esc(P.info)} <a href="${P.keyUrl}" target="_blank" rel="noopener">Získat klíč</a></p>
    </div>`;
  };
  const spent=aiSpent(), seg=(id,opts,cur)=>`<div class="seg" id="${id}">${opts.map(([v,l])=>`<button type="button" class="${v===cur?'on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<p class="note">Volitelné, bez klíče se AI nikde neukáže. Klíč se přes Disk přenese do ostatních zařízení. AI nic nezmění bez tvého potvrzení.</p>
    ${aiProviders().map(pv).join('')}
    <h3 class="set-h">Odpovědi</h3>
    <div class="fld"><span class="lbl">Styl</span>${seg('ai-style',AI_STYLES,c.style||'study')}</div>
    <div class="fld"><span class="lbl">Jazyk</span>${seg('ai-lang',AI_LANGS,c.lang||'cs')}</div>
    ${aiKey('anthropic')||spent>0?`<div class="fld"><span class="lbl">Útrata v tomto zařízení</span><div class="m-actions"><b class="ai-spent">${spent.toFixed(spent<1?3:2).replace('.',',')} $</b><button type="button" class="btn" id="ai-reset" ${spent>0?'':'disabled'}>Vynulovat</button></div><p class="note">Spočítaná z tokenů podle ceníku. Přesný stav kreditu je v Anthropic Console.</p></div>`:''}`;
}
function aiPaneBind(pane){
  const draw=()=>{ pane.innerHTML=aiPaneHtml(); };
  draw();
  const pvOf=el=>el.closest('[data-pv]');
  pane.addEventListener('click',async e=>{
    const t=e.target;
    const eye=t.closest('[data-ai-eye]');
    if(eye){ const k=$('[data-ai-key]',pvOf(eye)); k.type=k.type==='password'?'text':'password'; eye.textContent=k.type==='password'?'Zobrazit':'Skrýt'; return; }
    const del=t.closest('[data-ai-del]');
    if(del){
      if(!del.classList.contains('arm')){ del.classList.add('arm'); del.textContent='Smazat ze všech zařízení?'; return; }
      const id=pvOf(del).dataset.pv;
      aiUpdate(a=>{ if(a.keys) delete a.keys[id]; if(a.models) delete a.models[id]; if(a.provider===id) delete a.provider; });
      draw(); toast('Klíč smazán. Po synchronizaci zmizí i z ostatních zařízení.'); return;
    }
    const ver=t.closest('[data-ai-verify]');
    if(ver){
      const box=pvOf(ver), id=box.dataset.pv, vs=$('.ai-vs',box);
      ver.disabled=true; vs.textContent='Ověřuji…'; vs.classList.remove('bad','good');
      try{ await aiVerify(id); vs.textContent='✓ Funguje'; vs.classList.add('good'); }
      catch(err){ vs.textContent=aiErrText(err); vs.classList.add('bad'); }
      ver.disabled=false; return;
    }
    const sb=t.closest('#ai-style [data-v],#ai-lang [data-v]');
    if(sb){ const k=sb.closest('#ai-style')?'style':'lang', v=sb.dataset.v, dflt=k==='style'?'study':'cs';
      aiUpdate(a=>{ if(v===dflt) delete a[k]; else a[k]=v; });
      $$('button',sb.parentElement).forEach(x=>x.classList.toggle('on',x===sb)); return; }
    if(t.id==='ai-reset'){ aiSpentReset(); draw(); }
  });
  pane.addEventListener('change',e=>{
    const t=e.target, box=pvOf(t), id=box&&box.dataset.pv;
    if(t.name==='ai-def'){ aiUpdate(a=>{ a.provider=t.value; }); return; }
    if(t.matches('[data-ai-key]')){ const v=t.value.trim(); aiUpdate(a=>{ a.keys=a.keys||{}; a.keys[id]=v; if(!v&&a.models) delete a.models[id]; }); draw(); renderMain(); return; }
    if(t.matches('[data-ai-model]')){
      const own=$('[data-ai-own]',box);
      if(t.value===AI_OWN){ own.hidden=false; own.focus(); return; }
      own.hidden=true; own.value=''; aiUpdate(a=>{ a.models=a.models||{}; a.models[id]=t.value; }); return;
    }
    if(t.matches('[data-ai-own]')){ const v=t.value.trim(); aiUpdate(a=>{ a.models=a.models||{}; a.models[id]=v; }); }
  });
}

export { aiPaneBind };
