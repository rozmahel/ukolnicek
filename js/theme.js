/* Úkolníček – Barevný motiv (Výchozí / Papír / Les)
   Motiv je v datech jako settings.theme ('paper' | 'forest'); u Výchozího klíč v datech vůbec není (ukládá se až po první změně).
   Neznámá hodnota (třeba z novější verze) se chová jako Výchozí a v datech zůstane beze změny.
   Na <html> se motiv projeví atributem data-skin (barvy jsou v css/themes.css). Je nezávislý na režimu světlý/tmavý/auto,
   ten je jen v zařízení (localStorage 'uk-theme') a řeší ho applyTheme v views/settings.js. */
import { S } from './state.js';

const SKINS=[['default','Výchozí'],['paper','Papír'],['forest','Les']];
const skinOf=(st=S.settings)=>{ const t=st&&st.theme; return SKINS.some(s=>s[0]===t&&t!=='default')?t:'default'; };

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
  syncThemeColor();
}

export { applySkin, skinOf, SKINS, syncThemeColor };
