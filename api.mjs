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
export function lookupPrompt(word,app,extra,mode) {
  const languages=[...new Set([app,extra])].filter(x=>!['en','off'].includes(x));
  const schema={word:'fully vocalized Arabic',transliteration:'Latin transliteration',partOfSpeech:'verb | noun | adjective | adverb | preposition | particle | pronoun | other',grammarNote:'English grammar note or empty',root:['ك','ت','ب'],rootGloss:'English root idea',wazn:{pattern:'Arabic morphological pattern',note:'English pattern explanation'},meaning:{en:'English meaning',ar:'simple fully vocalized Arabic definition'},examples:[{ar:'vocalized Arabic sentence',en:'English translation'},{ar:'vocalized Arabic sentence',en:'English translation'}],forms:mode==='fast'?[]:['related Arabic forms without particles or pronouns'],synonyms:mode==='fast'?[]:[{ar:'vocalized Arabic',en:'English gloss'}],antonyms:mode==='fast'?[]:[{ar:'vocalized Arabic',en:'English gloss'}],verb:null,note:'English usage note or empty',trans:Object.fromEntries(languages.map(l=>[l,TRANSLATION]))};
  return `You are an expert Arabic teacher. Analyze only the first Arabic word: ${word}.
Return ONLY one complete JSON object with these exact machine keys: ${JSON.stringify(schema)}.
Fully vocalize ALL Arabic including definitions and examples. Accurate wazn for the actual inflected word, empty only if none. Root has 3 or 4 letters; particles/loanwords may have []. English canonical fields are for storage. In trans supply ${languages.map(l=>l+' = '+DESCRIPTIONS[l]).join('; ')}. Translate the SAME sense, all metadata and examples/synonyms/antonyms in EXACTLY the original order, with identical array lengths. Include empty metadata keys; no English explanations in localized objects except proper names.
${mode==='fast'?'FAST: forms/synonyms/antonyms empty arrays; grammarNote and note empty; verb null. Keep brief.':`DEEP: up to 25 useful related forms, 3–5 real synonyms and 0–3 antonyms. For a verb in any tense/person, verb={"form":"I–X or Quadriliteral","pattern":"past and present pattern","dictionaryForm":"past he","presentForm":"present he","masdar":"verbal noun","masdarWazn":"pattern","inputTense":"past | present | subjunctive | jussive | imperative | passivePast | passivePresent","inputPerson":"English person description","inputMatch":{"index":0,"tense":"past"},"conjugation":[]}. inputMatch indices use: ${PRONOUNS.map((p,i)=>i+' '+p).join(', ')}. Do not generate conjugations here. For nonverbs verb=null.`}
If meaningless return {"error":"invalid input"}.`;
}
export const reversePrompt=(query,app,extra)=>`A learner typed: ${query}. It may be in any language. Give 3–5 natural Modern Standard Arabic equivalents, most common first. Past he-form for verbs. Fully vocalize Arabic; never invent words. Return ONLY JSON: {"results":[{"ar":"vocalized Arabic","transliteration":"Latin","partOfSpeech":"verb | noun | adjective | other","en":"English meaning","main":"meaning in ${DESCRIPTIONS[app]}","tx":"meaning in ${DESCRIPTIONS[extra]||'English'}"}]}. If meaningless return {"error":"invalid input"}.`;
export function rootsPrompt(d,app,extra) {
  const fields={ar:'fully vocalized Arabic',partOfSpeech:'verb | noun | adjective | other',wazn:'Arabic morphological pattern',en:'short English gloss'};
  if(app!=='en')fields.main='short meaning in '+DESCRIPTIONS[app];if(!['off','en'].includes(extra))fields.tx='short meaning in '+DESCRIPTIONS[extra];
  return `Arabic root: ${list(d.root).join(' ')}. Exclude ${d.word}. List 8–12 attested common Modern Standard Arabic words from this root; fewer if necessary, never invent words. Fully vocalize Arabic. Every word must have every requested language. Return exactly one complete JSON object: ${JSON.stringify({words:[fields]})}. Exact machine keys, double-quoted strings, no Markdown, commentary or trailing commas. Empty words only if none suitable.`;
}
export const conjugationPrompt=verb=>`Expert Arabic teacher: full conjugation of ${verb}. Return ONLY {"conjugation":[{"past":"...","present":"...","subjunctive":"...","jussive":"...","imperative":"...","passivePast":"...","passivePresent":"..."}]}. EXACTLY 14 rows in this order: ${PRONOUNS.map((p,i)=>i+' '+p).join(', ')}. Fully vocalize Arabic; verb alone, no pronoun. Imperative only rows 6–11, empty elsewhere. Empty passive if intransitive. Check weak, doubled and hamzated forms carefully.`;
export function translationPrompt(d,language) {
  const source={root:d.rootGloss,meaning:d.meaning?.en,partOfSpeech:d.partOfSpeech,grammarNote:d.grammarNote,waznNote:d.wazn?.note,note:d.note,inputPerson:d.verb?.inputPerson,...Object.fromEntries(['examples','synonyms','antonyms'].map(k=>[k,list(d[k]).map(x=>({ar:x.ar,en:x.en}))]))};
  return `Translate all explanatory content into ${DESCRIPTIONS[language]}. Arabic word ${d.word}. Return ONLY JSON shaped like ${JSON.stringify(TRANSLATION)}. Preserve the exact sense and ordering. Use exactly ${list(d.examples).length} examples, ${list(d.synonyms).length} synonyms and ${list(d.antonyms).length} antonyms, no additions. Include every metadata key even if empty. Translate naturally, not transliteration. Source: ${JSON.stringify(source)}`;
}
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
