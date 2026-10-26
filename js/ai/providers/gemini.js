/* Úkolníček – AI: adaptér Google Gemini (REST, streamování SSE). Klíč jde v hlavičce x-goog-api-key, nikdy v URL. */
import { AiError, aiJson, aiSse } from '../sse.js';

const GEMINI={
  id:'gemini', name:'Gemini', needsKey:true, free:true,
  models:[['gemini-3-flash-preview','Flash'],['gemini-3.1-flash-lite','Flash-Lite']],
  maxChars:200000,
  keyUrl:'https://aistudio.google.com/apikey',
  info:'Zdarma v bezplatné úrovni s denním limitem, bez platební karty. Text z bezplatné úrovně může Google použít ke zlepšování svých služeb.',
  buildRequest(m,o){
    const gen={maxOutputTokens:o.maxTokens||8192};
    if(/^gemini-3/.test(o.model)) gen.thinkingConfig={thinkingLevel:'low'};
    return {url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(o.model)}:streamGenerateContent?alt=sse`,
      init:{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':o.key},
        body:JSON.stringify({systemInstruction:{parts:[{text:m.system}]},contents:[...(m.history||[]).map(h=>({role:h.role==='ai'?'model':'user',parts:[{text:h.text}]})),{role:'user',parts:[{text:m.user}]}],generationConfig:gen})}};
  },
  async *parseStream(res){
    let any=false, blocked=false;
    for await (const ev of aiSse(res)){
      const j=aiJson(ev.data); if(!j) continue;
      if(j.error) throw new AiError(GEMINI.mapError(j.error.code||500,JSON.stringify(j)));
      const c=(j.candidates||[])[0];
      const txt=c&&c.content&&(c.content.parts||[]).filter(p=>!p.thought&&p.text).map(p=>p.text).join('');
      if(txt){ any=true; yield {text:txt}; }
      if(c&&/SAFETY|BLOCKLIST|PROHIBITED|RECITATION/.test(c.finishReason||'')) blocked=true;
      if(j.promptFeedback&&j.promptFeedback.blockReason) blocked=true;
      const u=j.usageMetadata; if(u) yield {usage:{in:u.promptTokenCount||0,out:(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0)}};
    }
    if(!any&&blocked) throw new AiError('blocked');
  },
  mapError(status,body){
    const b=String(body||'');
    if(/API_KEY_INVALID|API key not valid|API_KEY/.test(b)||status===401||status===403) return 'key';
    if(status===429||/RESOURCE_EXHAUSTED|quota/i.test(b)) return 'limit';
    if(status===404||/not found|is not supported/i.test(b)) return 'model';
    if(status===503||status===500) return 'busy';
    return 'other';
  },
  cost(){ return 0; }   /* bezplatná úroveň */
};

export { GEMINI };
