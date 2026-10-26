/* Úkolníček – AI: prompty akcí a popis formátu Úkolníčku, společné pro všechny poskytovatele.
   Formát odpovídá převodu Markdownu na bloky (mdToBlocks v js/editor/markdown.js): co tam není, AI nemá používat. */

const AI_SUM='Shrň text velmi stručně do odrážek "- ". Shrnutí musí být výrazně kratší než původní text. Každá odrážka je jedno heslo nebo krátká věta s tím nejdůležitějším (pojmy, vzorce, termíny, čísla). Žádný nadpis, úvod, závěr, vnořené odrážky ani souvislý text.';
const AI_ACTIONS={
  fix:{label:'Opravit',task:'Oprav pravopis, gramatiku, interpunkci a překlepy. Neměň význam, slova ani styl víc, než je nutné. Zachovej stejné bloky a značky. Když není co opravit, vrať text beze změny.',keep:true},
  check:{label:'Ověřit',task:'Zkontroluj věcnou správnost textu: fakta, čísla, jednotky, vzorce, definice a odborné pojmy. Text nepřepisuj. Vypiš jen chybná nebo sporná místa, každé jako odrážku ve tvaru: - „krátká citace z textu“ – co je špatně a jak to má správně být. Pravopis a styl neřeš. Když si nejsi jistý, napiš, že je to sporné, a proč. Když je vše v pořádku, vrať jen: Bez připomínek.',insert:true,check:true},
  rephrase:{label:'Přeformulovat',task:'Přeformuluj text srozumitelněji a plynuleji. Zachovej význam, všechna fakta, čísla a strukturu bloků.',vary:true,keep:true},
  shorten:{label:'Zkrátit',task:'Zkrať text zhruba na polovinu. Zachovej podstatné informace, čísla a strukturu.',vary:true,keep:true},
  expand:{label:'Rozvést',task:'Rozveď text: doplň vysvětlení, souvislosti a příklady. Nové informace jen obecně známé a ověřitelné, nic si nevymýšlej. Zachovej strukturu, můžeš přidat odrážky.',vary:true},
  summary:{label:'Shrnout',task:AI_SUM,insert:true,vary:true,brief:true},
  translate:{label:'Přeložit',task:'Přelož text. Když je česky nebo slovensky, přelož ho do angličtiny, jinak do češtiny. Zachovej strukturu bloků a formátování.',lang:false,keep:true},
  pagesum:{label:'Shrnutí',task:AI_SUM,insert:true,vary:true,brief:true},
  write:{label:'AI',task:'Napiš to, co uživatel zadá. Text stránky je jen podklad a kontext; když se zadání týká stránky, vycházej jen z něj.',insert:true,vary:true},
  verify:{label:'Ověření',task:'Odpověz jen slovem OK.'}
};
const AI_MENU=['fix','check','rephrase','shorten','expand','summary','translate'];
const AI_STYLES=[['study','Studijní'],['formal','Formální'],['brief','Stručný']];
const AI_LANGS=[['cs','Čeština'],['en','Angličtina']];
const AI_STYLE_TXT={study:'Piš věcně a srozumitelně jako dobré studijní poznámky.',formal:'Piš spisovně a formálně.',brief:'Piš co nejstručněji, bez zbytečných slov.'};

/* formát Úkolníčku: jen značky, které převod na bloky zná */
const AI_FORMAT=`Odpověď piš v Markdownu a používej jen tyto značky (každá se změní na blok poznámky):
- odstavec = obyčejný text, odstavce odděl prázdným řádkem
- # Nadpis 1, ## Nadpis 2, ### Nadpis 3 (hlubší nadpisy nepoužívej)
- "- " odrážka, "1. " číslovaný seznam, vnoření o dvě mezery
- "- [ ] " úkol (zaškrtávací políčko), "- [x] " hotový úkol; termín úkolu piš do textu jako den a měsíc s tečkami, např. "- [ ] Odevzdat protokol 12. 11."
- "> " citace; zvýrazněný rámeček "> [!NOTE]", "> [!TIP]", "> [!IMPORTANT]", "> [!WARNING]" nebo "> [!CAUTION]" a pod ním "> text"
- tabulka | A | B | s řádkem | --- | --- |
- --- oddělovač, \`\`\` blok kódu \`\`\`
- vzorce v LaTeXu: $…$ v textu, $$…$$ na samostatném řádku
- v textu **tučně**, *kurzíva*, ~~přeškrtnutí~~, ==zvýraznění==, \`kód\`, [text](https://adresa)
Když jde o seznam, úkoly nebo strukturu, použij odpovídající značky, ne souvislý text. Úkoly vždy jako "- [ ] ". Nepoužívej HTML, obrázky ani poznámky pod čarou.`;
const AI_INLINE=`Výsledek se vloží doprostřed odstavce: vrať jen text na jeden odstavec bez nadpisů, odrážek a prázdných řádků. Formátování v textu (**tučně**, *kurzíva*, $…$) zachovej.`;

function aiSystem(action,o){
  const A=AI_ACTIONS[action]||AI_ACTIONS.write;
  if(action==='verify') return A.task;
  const lang=A.lang===false?'':o.lang==='en'?'Odpovídej anglicky.':'Odpovídej česky.';
  return ['Jsi pomocník v poznámkové aplikaci Úkolníček (školní poznámky a úkoly).',lang,
    'Nic nevymýšlej mimo poskytnutý text a obecně známá fakta.',
    'Vrať jen samotný výsledek: žádný úvod ani závěr (např. „Zde je shrnutí:“), žádné komentáře, celý výsledek neobaluj do ```.',
    A.brief||A.check?AI_STYLE_TXT.brief:AI_STYLE_TXT[o.style]||AI_STYLE_TXT.study,
    o.ctx?'Kontext od uživatele (role, obor, druh poznámek), řiď se jím:\n<<<\n'+o.ctx+'\n>>>'+(A.keep?'\nKontext ti pomáhá jen se správnými odbornými pojmy. Obsah ani fakta kvůli němu neměň.':''):'',
    'Úkol: '+A.task, o.inline?AI_INLINE:AI_FORMAT].filter(Boolean).join('\n');
}
function aiUserMsg(action,o){
  const A=AI_ACTIONS[action]||AI_ACTIONS.write;
  if(action==='verify') return 'Ping';
  const parts=[];
  if(action==='write') parts.push('Zadání: '+String(o.prompt||'').trim());
  if(o.text&&o.text.trim()) parts.push((action==='write'?'Text stránky (kontext):':'Text:')+'\n<<<\n'+o.text.trim()+'\n>>>');
  if(A.brief&&o.text){ const [n,w]=aiSumSize(o.text); parts.push(`Shrnutí: nejvýš ${n} odrážek a nejvýš ${w} slov celkem.`); }
  if(o.again&&A.vary) parts.push('Napiš jinou variantu než minule.');
  return parts.join('\n\n');
}
/* rozsah shrnutí podle délky textu: zhruba čtvrtina slov, 2–8 odrážek */
function aiSumSize(t){
  const w=(String(t).match(/\S+/g)||[]).length;
  return [w<60?2:w<150?3:w<400?5:w<1000?6:8, Math.max(10,Math.min(160,Math.round(w/4)))];
}
/* odstraní obal ``` kolem celé odpovědi a úvodní frázi, kterou modely občas přidají */
function aiClean(t){
  t=String(t||'').replace(/\r\n?/g,'\n').trim();
  const m=t.match(/^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n```$/i); if(m) t=m[1].trim();
  t=t.replace(/^(zde je|tady je|here is)[^\n]{0,60}:\s*\n+/i,'');
  return t;
}

const aiNoIssues=t=>/^bez připomínek\.?$/i.test(String(t||'').trim());

export { AI_ACTIONS, AI_LANGS, AI_MENU, AI_STYLES, aiClean, aiNoIssues, aiSystem, aiUserMsg };
