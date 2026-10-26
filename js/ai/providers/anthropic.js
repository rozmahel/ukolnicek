/* Úkolníček – AI: adaptér Anthropic Claude (Messages API, streamování SSE). Placené předplaceným kreditem v Anthropic Console. */
/* ceny v $ za milion tokenů; Haiku má do 100 000 tokenů vstupu nižší sazbu */
import { AiError, aiJson, aiSse } from '../sse.js';

const CLAUDE_PRICE=[[/haiku/,u=>u.in>100000?[0.5,2.5]:[0.1,0.5]],[/sonnet/,()=>[2,10]]];
const ANTHROPIC={
  id:'anthropic', name:'Claude', needsKey:true, free:false,
  models:[['claude-haiku-5-5','Haiku 5.5'],['claude-sonnet-5-5','Sonnet 5.5']],
  maxChars:300000,
  keyUrl:'https://console.anthropic.com/settings/keys',
  info:'Placené předplaceným kreditem, zvlášť od předplatného Claude Pro. Haiku je velmi levný. Anthropic text z API nepoužívá k učení modelů.',
  buildRequest(m,o){
    return {url:'https://api.anthropic.com/v1/messages',
      init:{method:'POST',headers:{'content-type':'application/json','x-api-key':o.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:o.model,max_tokens:o.maxTokens||4096,system:m.system,messages:[...(m.history||[]).map(h=>({role:h.role==='ai'?'assistant':'user',content:h.text})),{role:'user',content:m.user}],stream:true})}};
  },
  async *parseStream(res){
    for await (const ev of aiSse(res)){
      const j=aiJson(ev.data); if(!j) continue;
      if(j.type==='error'||ev.event==='error'){ const e=j.error||{}; throw new AiError(ANTHROPIC.mapError(e.type==='overloaded_error'?529:e.type==='rate_limit_error'?429:400,JSON.stringify(j))); }
      if(j.type==='message_start'&&j.message&&j.message.usage) yield {usage:{in:j.message.usage.input_tokens||0}};
      if(j.type==='content_block_delta'&&j.delta&&j.delta.type==='text_delta') yield {text:j.delta.text};
      if(j.type==='message_delta'&&j.usage) yield {usage:{out:j.usage.output_tokens||0}};
    }
  },
  mapError(status,body){
    const b=String(body||'');
    if(status===401||/authentication_error|invalid x-api-key/i.test(b)) return 'key';
    if(/credit balance|billing/i.test(b)) return 'credit';
    if(status===429) return 'limit';
    if(status===404||/not_found_error/.test(b)) return 'model';
    if(status===529||status===500||/overloaded/i.test(b)) return 'busy';
    if(status===403) return 'key';
    return 'other';
  },
  cost(u,model){ const p=CLAUDE_PRICE.find(([re])=>re.test(model)); if(!p) return null; const [i,o]=p[1](u); return ((u.in||0)*i+(u.out||0)*o)/1e6; }
};

export { ANTHROPIC };
