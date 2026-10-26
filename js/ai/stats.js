/* Úkolníček – AI: statistiky dotazů jen v tomto zařízení ('uk-ai-stats', ne v datech, takže nemění otisk dat).
   log = záznamy posledních AI_KEEP_DAYS dní {t, provider, model, action, in, out, cost}; starší se sloučí po dnech do days.
   since = od kdy se počítá útrata (tlačítko Vynulovat v Nastavení → AI). */
import { lsGet, lsSet } from '../core.js';
import { ymd } from '../dates.js';

const AI_STATS_KEY='uk-ai-stats', AI_KEEP_DAYS=30;
function aiStatsAll(){
  const v=lsGet(AI_STATS_KEY,null);
  return v&&Array.isArray(v.log)&&Array.isArray(v.days)?v:{log:[],days:[],since:0};
}
function aiLog(rec){
  const s=aiStatsAll(); s.log.push(rec);
  const lim=Date.now()-AI_KEEP_DAYS*864e5, keep=[];
  for(const r of s.log){
    if(r.t>=lim){ keep.push(r); continue; }
    const d=ymd(new Date(r.t));
    let g=s.days.find(x=>x.d===d&&x.provider===r.provider&&x.model===r.model);
    if(!g){ g={d,provider:r.provider,model:r.model,n:0,in:0,out:0,cost:0}; s.days.push(g); }
    g.n++; g.in+=r.in||0; g.out+=r.out||0; g.cost+=r.cost||0;
  }
  s.log=keep; lsSet(AI_STATS_KEY,s);
}
/* útrata v dolarech od posledního vynulování */
function aiSpent(){
  const s=aiStatsAll(), d0=s.since?ymd(new Date(s.since)):'';
  return s.log.filter(r=>r.t>=(s.since||0)).reduce((a,r)=>a+(r.cost||0),0)+s.days.filter(g=>g.d>=d0).reduce((a,g)=>a+(g.cost||0),0);
}
function aiSpentReset(){ const s=aiStatsAll(); s.since=Date.now(); lsSet(AI_STATS_KEY,s); }

export { aiLog, aiSpent, aiSpentReset };
