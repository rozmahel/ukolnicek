/* Úkolníček – Stav aplikace v paměti (S) a výchozí nastavení */
import { COLORS, lsGet } from './core.js';

/* ================= state ================= */
/* školní režim (settings.school) ve výchozím stavu chybí = vypnuto; settings.noIndex=true schová Index (jen ve školním režimu);
   settings.index z verze 2.6 se už nepoužívá */
function defaultSettings(){return {name:'Úkolníček',semesterStart:'',showWeekend:false,dayStart:7,dayEnd:20,miniCal:true,miniCalWeeks:true,showHidden:true,hourScale:1};}
const S={ready:false,pages:{},events:{},subjects:{},semesters:{},trash:{},maps:{},settings:defaultSettings(),view:lsGet('uk-view',{kind:'today'}),weekOffset:0,calOffset:0,taskFilter:'open',archMode:false,trashMode:false,expanded:lsGet('uk-exp',{}),pop:null,popParent:null,modal:null};
/* výchozí zvýrazněný blok pro nově vložené bloky (od 4.16.0): settings.callout = {color?, icon?} jen s tím, co se liší
   od výchozího; icon '' = bez ikony. Návrat na výchozí klíč odstraní, otisk dat se pak nezmění. */
const CALLOUT_DEF={color:'purple',icon:'💡'};
function calloutDef(){
  const c=S.settings.callout||{};
  return {color:COLORS.includes(c.color)?c.color:CALLOUT_DEF.color,icon:typeof c.icon==='string'?c.icon.slice(0,8):CALLOUT_DEF.icon};
}
function setCalloutDef(k,v){
  const c=Object.assign({},S.settings.callout||{}); if(v===CALLOUT_DEF[k]) delete c[k]; else c[k]=v;
  if(Object.keys(c).length) S.settings.callout=c; else delete S.settings.callout;
}
/* výchozí mezery bloků podle typu (Nastavení → Formát, od 4.29.0): settings.spDef = {typ:{t?,b?}} jen s nastavenými
   hodnotami (px při 100 %, 0 – 48); chybí = mezera z CSS. Vlastní mezera bloku (b.spT/b.spB) má přednost. */
const SPD_KEY=['t','b'];
function spDefOf(type,k){
  const o=S.settings.spDef&&S.settings.spDef[type], v=o&&o[SPD_KEY[k]];
  return v!=null&&v!==''&&Number.isFinite(+v)&&+v>=0&&+v<=48?Math.round(+v):null;
}
function setSpDef(type,k,v){
  const all=Object.assign({},S.settings.spDef||{}), o=Object.assign({},all[type]||{});
  if(v==null) delete o[SPD_KEY[k]]; else o[SPD_KEY[k]]=Math.round(Math.min(48,Math.max(0,+v)));
  if(Object.keys(o).length) all[type]=o; else delete all[type];
  if(Object.keys(all).length) S.settings.spDef=all; else delete S.settings.spDef;
}
const MONTHS_NOM=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
const IS_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
const LOCK_KEY=IS_MAC?'⌘⇧L':'Ctrl+Shift+L';
const SEARCH_KEY=IS_MAC?'⌘K':'Ctrl K';

export { calloutDef, defaultSettings, IS_MAC, LOCK_KEY, MONTHS_NOM, S, SEARCH_KEY, setCalloutDef, setSpDef, spDefOf };
