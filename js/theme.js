/* Úkolníček – Barevný motiv (Výchozí / Papír / Les / Mlha / Šípek / Levandule) a písmo
   Motiv je v datech jako settings.theme ('paper' | 'forest' | 'mist' | 'rose' | 'lavender'); u Výchozího klíč v datech vůbec není (ukládá se až po první změně).
   Neznámá hodnota (třeba z novější verze) se chová jako Výchozí a v datech zůstane beze změny.
   Na <html> se motiv projeví atributem data-skin (barvy jsou v css/themes.css). Je nezávislý na režimu světlý/tmavý/auto,
   ten je jen v zařízení (localStorage 'uk-theme') a řeší ho applyTheme v views/settings.js. */
import { lsGet } from './core.js';
import { S } from './state.js';

const SKINS=[['default','Výchozí'],['paper','Papír'],['forest','Les'],['mist','Mlha'],['rose','Šípek'],['lavender','Levandule']];
const skinOf=(st=S.settings)=>{ const t=st&&st.theme; return SKINS.some(s=>s[0]===t&&t!=='default')?t:'default'; };
/* písmo zvlášť od motivu (od 4.8.0): settings.font, chybí = „Podle motivu“ (písmo motivu). Neznámá hodnota = Podle motivu.
   Na <html> atribut data-font, písma v css/themes.css; kopie 'uk-font' v localStorage jen kvůli startu (index.html). */
const FONTS=[['auto','Podle motivu'],['onest','Onest'],['plex','IBM Plex Sans'],['system','Systémové'],['newsreader','Newsreader'],['literata','Literata'],['sserif','Source Serif']];
const fontOf=(st=S.settings)=>{ const t=st&&st.font; return FONTS.some(f=>f[0]===t&&t!=='auto')?t:'auto'; };
function setFont(v){ if(fontOf()===v) return false; if(v==='auto') delete S.settings.font; else S.settings.font=v; return true; }
function setSkin(v){ if(skinOf()===v) return false; if(v==='default') delete S.settings.theme; else S.settings.theme=v; return true; }

/* barva lišty prohlížeče = pozadí aktuálního vzhledu (motiv × režim), čte se přímo z CSS */
function syncThemeColor(){
  const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if(bg) document.querySelectorAll('meta[name="theme-color"]').forEach(mt=>mt.setAttribute('content',bg));
}

/* nastaví motiv podle dat. Kopie v localStorage ('uk-skin') slouží jen tomu, aby se motiv nastavil hned při startu,
   než se načtou data (viz skript v index.html); do dat ani do otisku se nepočítá. */
function applySkin(){
  const k=skinOf(), root=document.documentElement;
  if(k==='default') root.removeAttribute('data-skin'); else root.setAttribute('data-skin',k);
  try{ if(k==='default') localStorage.removeItem('uk-skin'); else localStorage.setItem('uk-skin',JSON.stringify(k)); }catch(_){}
  const fo=fontOf();
  if(fo==='auto') root.removeAttribute('data-font'); else root.setAttribute('data-font',fo);
  try{ if(fo==='auto') localStorage.removeItem('uk-font'); else localStorage.setItem('uk-font',JSON.stringify(fo)); }catch(_){}
  syncThemeColor();
}

/* tlačítko světlý/tmavý vedle zámku: ukazuje, kam se přepne (v tmavém slunce, ve světlém měsíc).
   Režim 'auto' se bere podle systému; klik uloží výslovně opačný režim (jen v zařízení, 'uk-theme'). */
function isDarkNow(){
  const t=lsGet('uk-theme','auto');
  if(t==='dark') return true; if(t==='light') return false;
  try{ return matchMedia('(prefers-color-scheme: dark)').matches; }catch(_){ return false; }
}
const SUN='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>';
const MOON='<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
function modeAttrs(){ const d=isDarkNow(), t=d?'Světlý režim':'Tmavý režim'; return {d,t,ic:d?SUN:MOON}; }
function modeBtn(){ const m=modeAttrs(); return `<button class="icon-btn mode-btn" data-act="mode" title="${m.t}" aria-label="${m.t}">${m.ic}</button>`; }
function syncModeBtns(){ const m=modeAttrs(); document.querySelectorAll('.mode-btn').forEach(b=>{ b.innerHTML=m.ic; b.title=m.t; b.setAttribute('aria-label',m.t); }); }

export { applySkin, fontOf, FONTS, isDarkNow, modeBtn, setFont, setSkin, skinOf, SKINS, syncModeBtns, syncThemeColor };
