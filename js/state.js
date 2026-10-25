/* Úkolníček – Stav aplikace v paměti (S) a výchozí nastavení */
import { lsGet } from './core.js';

/* ================= state ================= */
/* školní režim (settings.school) ve výchozím stavu chybí = vypnuto; settings.noIndex=true schová Index (jen ve školním režimu);
   settings.index z verze 2.6 se už nepoužívá */
function defaultSettings(){return {name:'Úkolníček',semesterStart:'',showWeekend:false,dayStart:7,dayEnd:20,miniCal:true,miniCalWeeks:true,showHidden:true,hourScale:1};}
const S={ready:false,pages:{},events:{},subjects:{},semesters:{},trash:{},maps:{},settings:defaultSettings(),view:lsGet('uk-view',{kind:'today'}),weekOffset:0,calOffset:0,taskFilter:'open',archMode:false,trashMode:false,expanded:lsGet('uk-exp',{}),pop:null,modal:null};
const MONTHS_NOM=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
const IS_MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
const LOCK_KEY=IS_MAC?'⌘⇧L':'Ctrl+Shift+L';
const SEARCH_KEY=IS_MAC?'⌘K':'Ctrl K';

export { defaultSettings, LOCK_KEY, MONTHS_NOM, S, SEARCH_KEY };
