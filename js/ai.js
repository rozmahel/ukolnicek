/* Úkolníček – AI asistent: jediné rozhraní pro zbytek aplikace (UI nezná konkrétní poskytovatele).
   Kontext stránky: pg.aiCtx (jen když je vyplněný), dědí se na podstránky (aiCtxOf).
   Nastavení je v datech jako settings.ai = {provider, models:{id:model}, keys:{id:klíč}, style, lang}; zapíše se až první změnou
   (bez AI se tvar dat nemění). Při kolizi verzí se bere jako celek (merge.js slévá nastavení po klíčích, ai je jeden klíč).
   Poskytovatelé: js/ai/providers/*.js se stejným tvarem {id, name, models, needsKey, free, maxChars, buildRequest, parseStream, mapError, cost}. */
import { clone } from './core.js';
import { S } from './state.js';
import { LOCK } from './lock.js';
import { saveSettings } from './store.js';
import { aiClean, aiSystem, aiUserMsg } from './ai/actions.js';
import { ANTHROPIC } from './ai/providers/anthropic.js';
import { GEMINI } from './ai/providers/gemini.js';
import { AiError } from './ai/sse.js';
import { aiLog } from './ai/stats.js';

const AI_PROVIDERS={gemini:GEMINI,anthropic:ANTHROPIC};
const AI_ORDER=['gemini','anthropic'];
const AI_ERR={none:'AI není nastavená. Klíč se přidává v Nastavení → AI.',key:'Neplatný API klíč (Nastavení → AI).',credit:'Došel kredit u poskytovatele.',
  limit:'Limit na dnes vyčerpán.',model:'Model neexistuje. Jiný se vybírá v Nastavení → AI.',net:'Bez spojení s poskytovatelem. Stačí to zkusit znovu.',
  busy:'Poskytovatel je přetížený. Stačí to zkusit za chvíli.',blocked:'Poskytovatel odpověď zablokoval.',long:'Text je na AI moc dlouhý.',empty:'AI nevrátila žádný text.',other:'Nepovedlo se.'};
const aiErrText=e=>AI_ERR[e&&e.code]||AI_ERR.other;

const aiCfg=()=>S.settings.ai||{};
const aiKey=id=>String((aiCfg().keys||{})[id]||'').trim();
const aiConfigured=()=>AI_ORDER.filter(id=>aiKey(id));
const aiReady=()=>aiConfigured().length>0;
/* ✦ se ukáže jen s nastaveným poskytovatelem, odemčeno a online */
const aiUsable=()=>aiReady()&&!LOCK&&navigator.onLine!==false;
function aiDefault(){ const c=aiCfg(), l=aiConfigured(); return l.includes(c.provider)?c.provider:l[0]||null; }
function aiModel(id){ const m=String((aiCfg().models||{})[id]||'').trim(); return m||AI_PROVIDERS[id].models[0][0]; }
/* kontext pro AI: vlastní na stránce (pg.aiCtx), jinak zděděný od nejbližší nadřazené stránky; {text, from} */
const AI_CTX_MAX=2000;
function aiCtxOf(pg){
  for(let p=pg,i=0;p&&i<50;p=S.pages[p.parent],i++){ const t=String(p.aiCtx||'').trim(); if(t) return {text:t.slice(0,AI_CTX_MAX),from:p}; }
  return {text:'',from:null};
}
const aiMaxChars=id=>(AI_PROVIDERS[id||aiDefault()]||GEMINI).maxChars;
/* změna nastavení: prázdné části se vynechají, prázdné settings.ai zmizí */
function aiUpdate(fn){
  const a=clone(S.settings.ai||{}); fn(a);
  ['keys','models'].forEach(k=>{ if(a[k]){ Object.keys(a[k]).forEach(x=>{ if(!String(a[k][x]||'').trim()) delete a[k][x]; }); if(!Object.keys(a[k]).length) delete a[k]; } });
  Object.keys(a).forEach(k=>{ if(a[k]==null||a[k]==='') delete a[k]; });
  if(Object.keys(a).length) S.settings.ai=a; else delete S.settings.ai;
  saveSettings();
}

/* jeden dotaz (chat v panelu: o.system, o.user a o.history = [{role:'user'|'ai', text}]): onText(celý text zatím) při streamování; vrací {text, usage, cost, provider, model}; chyby jako AiError, zrušení AbortError */
async function aiAsk(o){
  const id=o.provider||aiDefault(); if(!id||!AI_PROVIDERS[id]) throw new AiError('none');
  const P=AI_PROVIDERS[id], model=o.model||aiModel(id), key=o.key||aiKey(id);
  if(P.needsKey&&!key) throw new AiError('none');
  if((o.text||'').length>P.maxChars) throw new AiError('long');
  if(navigator.onLine===false) throw new AiError('net');
  const c=aiCfg(), msg={system:o.system||aiSystem(o.action,{inline:o.inline,style:c.style,lang:c.lang,ctx:o.ctx}),user:o.user!=null?o.user:aiUserMsg(o.action,o),history:o.history};
  const req=P.buildRequest(msg,{model,key,maxTokens:o.maxTokens});
  let res;
  try{ res=await fetch(req.url,Object.assign({},req.init,{signal:o.signal})); }
  catch(e){ if(e&&e.name==='AbortError') throw e; throw new AiError('net'); }
  if(!res.ok){ let body=''; try{ body=await res.text(); }catch(_){} throw new AiError(P.mapError(res.status,body),body.slice(0,300)); }
  let text=''; const usage={in:0,out:0};
  try{
    for await (const ch of P.parseStream(res)){
      if(ch.text){ text+=ch.text; if(o.onText) o.onText(text); }
      if(ch.usage){ if(ch.usage.in!=null) usage.in=ch.usage.in; if(ch.usage.out!=null) usage.out=ch.usage.out; }
    }
  }catch(e){ if(e instanceof AiError||(e&&e.name==='AbortError')) throw e; throw new AiError('net'); }
  text=aiClean(text);
  const cost=P.cost(usage,model);
  aiLog({t:Date.now(),provider:id,model,action:o.action,in:usage.in,out:usage.out,cost:cost||0});
  if(!text) throw new AiError('empty');
  return {text,usage,cost,provider:id,model};
}
/* zkušební dotaz z Nastavení (s klíčem a modelem z formuláře) */
async function aiVerify(id,key,model){
  try{ return await aiAsk({action:'verify',provider:id,key,model,maxTokens:256}); }
  catch(e){ if(e&&e.code==='empty') return {text:''}; throw e; }   /* odpověď přišla, jen prázdná (model přemýšlel) = klíč funguje */
}
const aiProviders=()=>AI_ORDER.map(id=>AI_PROVIDERS[id]);

export { AI_CTX_MAX, AI_ERR, AI_PROVIDERS, aiAsk, aiCfg, aiConfigured, aiCtxOf, aiDefault, aiErrText, aiKey, aiMaxChars, aiModel, aiProviders, aiUpdate, aiUsable, aiVerify };
