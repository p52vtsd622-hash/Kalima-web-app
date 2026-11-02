import {LANGS,extraLanguages,list,object,text,normalize} from './core.mjs';
const DESCRIPTIONS={...LANGS,ar:'fully vocalized Modern Standard Arabic',ur:'natural Urdu in Urdu script',fa:'natural Iranian Persian in Persian script'};
const TRANSLATION={root:'root meaning',meaning:'meaning',partOfSpeech:'localized part of speech',grammarNote:'localized grammar note or empty',waznNote:'localized pattern explanation or empty',note:'localized usage note or empty',inputPerson:'localized person description or empty',examples:['translated example'],synonyms:['translated gloss'],antonyms:['translated gloss']};
export const PRONOUNS=['هُوَ','هُمَا','هُمْ','هِيَ','هُمَا','هُنَّ','أَنْتَ','أَنْتُمَا','أَنْتُمْ','أَنْتِ','أَنْتُمَا','أَنْتُنَّ','أَنَا','نَحْنُ'];
export const TENSES={past:'Past',present:'Present',subjunctive:'Subjunctive',jussive:'Jussive',imperative:'Imperative',passivePast:'Passive past',passivePresent:'Passive present'};
export class ApiError extends Error {constructor(code){super(code);this.code=code;}}
export function errorMessage(e) {
  switch(e?.code){
    case 'cancelled':return 'Lookup stopped.';
    case 'key':return 'Check your personal key in Settings, or switch it off to use shared access.';
    case 'quota':return 'Shared limit reached. Try later or use a personal key in Settings.';
    case 'network':return "Couldn't connect. Check your internet connection and try again.";
    case 'model':return "That doesn't look like an Arabic word.";
    case 'configuration':return 'Restore the default server configuration under Advanced in Settings.';
    default:return "The reply couldn't be read. Try again.";
  }
}
export function containers(source) {
  const result=[];let start=-1,stack=[],quoted=false,escaped=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];if(start<0){if(c==='{'||c==='['){start=i;stack=[c];}continue;}
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;else if(c==='{'||c==='[')stack.push(c);else if(c==='}'||c===']'){
      if(stack.at(-1)!==(c==='}'?'{':'[')){start=-1;stack=[];quoted=false;escaped=false;}
      else {stack.pop();if(!stack.length){result.push(source.slice(start,i+1));start=-1;}}
    }
  }
  return result;
}
export function parseJSON(raw) {
  if(!text(raw).trim())throw new ApiError('empty');
  for(const part of containers(raw)){try {const j=JSON.parse(part);if(j.error)throw new ApiError('model');return j;}catch(e){if(e instanceof ApiError)throw e;}}
  throw new ApiError('invalid_json');
}
function findRootArray(j,depth=0) {
  if(Array.isArray(j))return j;
  for(const k of ['words','results','rootWords']){
    if(Array.isArray(j?.[k]))return j[k];
    if(typeof j?.[k]==='string'){try{const a=JSON.parse(j[k]);if(Array.isArray(a))return a;}catch{}}
  }
  if(depth<2)for(const k of ['data','result']){const a=findRootArray(j?.[k],depth+1);if(a)return a;}
  return null;
}
function equivalent(a,b) {
  const clean=x=>text(x).normalize('NFC').replace(/ـ/g,'').trim();a=clean(a);b=clean(b);
  return a===b || (!/[\u064b-\u0652]/.test(a)||!/[\u064b-\u0652]/.test(b)) && normalize(a)===normalize(b);
}
export function parseRoots(raw,word,app,extra) {
  if(!text(raw).trim())throw new ApiError('empty');
  for(const part of containers(raw)){
    let j;try{j=JSON.parse(part);}catch{continue;}
    if(j.error)throw new ApiError('model');
    const a=findRootArray(j);if(!a)continue;
    const seen=[word],out=[];
    for(const value of a){
      const x=object(value), ar=text(x.ar)||text(x.word), en=text(x.en),main=app==='en'?en:text(x.main),tx=extra==='en'?en:text(x.tx);
      if(!/[\u0621-\u064a]/.test(ar)||!en||!main||(extra!=='off'&&!tx)||seen.some(w=>equivalent(w,ar)))continue;
      seen.push(ar);out.push({ar,en,main,tx:extra==='off'?'':tx,partOfSpeech:text(x.partOfSpeech)||text(x.pos),wazn:text(x.wazn)||text(x.pattern),transliteration:text(x.transliteration)});
      if(out.length===12)break;
    }
    if(a.length&&!out.length)throw new ApiError('invalid_json');return out;
  }
  throw new ApiError('invalid_json');
}
export function abortableDelay(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new ApiError('cancelled'));return;}
    const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(finish,ms);
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new ApiError('cancelled'));};
    signal?.addEventListener('abort',abort,{once:true});
  });
}
export async function rootRequest(fetchReply,word,app,extra,signal,pause=abortableDelay) {
  for(let attempt=0;attempt<3;attempt++){
    if(signal?.aborted)throw new ApiError('cancelled');
    try{return parseRoots(await fetchReply(attempt),word,app,extra);}
    catch(e){if(!['invalid_json','empty'].includes(e.code)||attempt===2)throw e;}
    await pause(350*(attempt+1),signal);
  }
}
export {lookupPrompt,reversePrompt,rootsPrompt,conjugationPrompt,translationPrompt} from './native-prompts.mjs';
export async function ask(prompt,settings,signal,fetcher=fetch) {
  if(prompt.length>8000)throw new ApiError('invalid_json');
  if(signal?.aborted)throw new ApiError('cancelled');
  const controller=new AbortController(), abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,65000);
  try {
    const own=settings.access==='own' && settings.key;
    let address,body,headers={'Content-Type':'application/json'};
    if(own){address='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(settings.model||'gemini-2.5-flash')+':generateContent';headers['x-goog-api-key']=settings.key;body={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}};}
    else {address=settings.proxy||'https://kalima.wyp44cctp8.workers.dev';if(!/^https:\/\//i.test(address))throw new ApiError('configuration');body={prompt};}
    const response=await fetcher(address,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal,credentials:'omit'});
    if(!response.ok)throw new ApiError([401,403].includes(response.status)?'key':response.status===429?'quota':'network');
    const j=await response.json();const raw=own?j.candidates?.[0]?.content?.parts?.map(x=>text(x.text)).join('\n'):j.text;
    if(!text(raw).trim())throw new ApiError('empty');return raw;
  }catch(e){if(e instanceof ApiError)throw e;if(signal?.aborted)throw new ApiError('cancelled');throw new ApiError('network');}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
