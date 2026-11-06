import {LANGS} from './core.mjs';
import {ApiError,parseJSON,errorMessage} from './api.mjs';
import {grammarPrompt,wordsPrompt} from './sentence-prompts.mjs';
export const sentenceKey=s=>s.normalize('NFC').replace(/[^\p{L}\p{N}]|ـ/gu,'');
const letters=s=>[...s].filter(c=>/\p{L}/u.test(c));
const isArabic=s=>typeof s==='string'&&/[ء-ي]/u.test(s)&&letters(s).every(c=>/\p{Script=Arabic}/u.test(c)||c==='ـ');
const fail=()=>{throw new ApiError('invalid_json');};
export function inputError(s){
 if(!s.trim())return 'Enter a complete Arabic sentence.';
 if(s.length>600||s.trim().split(/\s+/u).length>40)return 'Use up to 40 words and 600 characters.';
 if(!letters(sentenceKey(s)).length||letters(s).some(c=>c!=='ـ'&&!/\p{Script=Arabic}/u.test(c)))return 'Enter your sentence in Arabic.';
 return null;
}
export function parseGrammar(raw,sentence){
 const o=parseJSON(raw);
 if(o.status==='needs_context')throw new ApiError('sentence_context');
 if(o.status==='invalid_sentence')throw new ApiError('sentence_invalid');
 if(o.status!=='ok')fail();
 const rows=(name,required)=>{
  const a=o[name];if(!Array.isArray(a)||a.length>160||(required&&!a.length))fail();
  return a.filter(x=>!(name==='rows'&&typeof x?.text==='string'&&x.text.trim()&&!/[\p{L}\p{N}]/u.test(x.text))).map(x=>{
   if(!x||typeof x.text!=='string'||typeof x.analysis!=='string')fail();
   const numeric=/\p{N}/u.test(x.text)&&!/[\p{L}]/u.test(x.text);
   if((name==='rows'&&x.text.trim().split(/\s+/u).length!==1)||!(isArabic(x.text)||(name==='rows'&&numeric))||!isArabic(x.analysis)||x.analysis.length>3500)fail();
   return {text:x.text,analysis:x.analysis};
  });
 };
 const tokens=rows('rows',true);
 if(sentenceKey(tokens.map(x=>x.text).join(''))!==sentenceKey(sentence))fail();
 for(let i=0;i<tokens.length-1;i++){
  const v=tokens[i].analysis.replace(/[\u064b-\u065f\u0670]/g,''),n=tokens[i+1].analysis.replace(/[\u064b-\u065f\u0670]/g,'').trim();
  if(['الفاعل مستتر','الفاعل ضمير مستتر','فاعله ضمير مستتر'].some(s=>v.includes(s))&&!v.includes('ليس')&&/^(فاعل |الفاعل )/.test(n))throw new ApiError('grammar_conflict');
 }
 const clauses=rows('clauses',false);
 if(!isArabic(o.overview)||clauses.some(x=>!sentenceKey(sentence).includes(sentenceKey(x.text)))||!Array.isArray(o.alternatives)||o.alternatives.length>8||o.alternatives.some(x=>!isArabic(x)))fail();
 return {original:sentence,overview:o.overview,rows:tokens,clauses,alternatives:o.alternatives};
}
export function parseWords(raw,sentence,language){
 const o=parseJSON(raw);if(o.status==='needs_context')throw new ApiError('sentence_context');
 if(o.status!=='ok'||o.language!==language||!Array.isArray(o.items)||!o.items.length||o.items.length>80)fail();
 const script=['ar','fa','ur'].includes(language)?/\p{Script=Arabic}/u:language==='ru'?/\p{Script=Cyrillic}/u:/\p{Script=Latin}/u;
 const items=o.items.filter(x=>!(typeof x?.ar==='string'&&x.ar.trim()&&!/[\p{L}\p{N}]/u.test(x.ar))).map(x=>{
  if(!x||['ar','transliteration','meaning'].some(k=>typeof x[k]!=='string'))fail();
  const numeric=/\p{N}/u.test(x.ar)&&!/[\p{L}]/u.test(x.ar),latin=x.transliteration,meaning=x.meaning,ls=letters(meaning);
  if(!sentenceKey(x.ar)||x.ar.trim().split(/\s+/u).length>3||!latin.trim()||!(letters(latin).some(c=>/\p{Script=Latin}/u.test(c))||numeric&&/\p{N}/u.test(latin))||letters(latin).some(c=>!/[ʿʾʻʼ]/u.test(c)&&!/\p{Script=Latin}/u.test(c))||!meaning.trim()||meaning.length>1200)fail();
  if(!(numeric&&!ls.length&&/\p{N}/u.test(meaning))&&(!ls.length||ls.some(c=>!script.test(c)&&c!=='ـ')))fail();
  return {ar:x.ar,transliteration:latin,meaning};
 });
 if(sentenceKey(items.map(x=>x.ar).join(''))!==sentenceKey(sentence))fail();
 return {sentence,language,items};
}
const HISTORY='kalima_sentence_history_v1';
export class SentenceHistory {
 constructor(storage){this.storage=storage;this.items=[];this.undo=null;try{const raw=JSON.parse(storage.getItem(HISTORY)||'[]');if(Array.isArray(raw))this.items=[...new Set(raw.filter(s=>typeof s==='string').map(s=>s.trim()).filter(s=>!inputError(s)))].slice(0,60);}catch{}}
 commit(items){this.storage.setItem(HISTORY,JSON.stringify(items));this.items=items;}
 add(s){s=s.trim();if(inputError(s))return;const next=[s,...this.items.filter(x=>x!==s)].slice(0,60);if(JSON.stringify(next)!==JSON.stringify(this.items))this.commit(next);}
 clear(){const old=this.items.slice();this.commit([]);this.undo=old;}
 restore(){if(!this.undo)return;this.commit([...new Set([...this.items,...this.undo])].slice(0,60));this.undo=null;}
}
const fresh=()=>({result:null,loading:false,error:null,revision:0,controller:null});
export class SentenceSession {
 constructor(ask,onChange=()=>{},onCompleted=()=>{}){this.ask=ask;this.onChange=onChange;this.onCompleted=onCompleted;this.query='';this.submitted=null;this.grammar=fresh();this.words=fresh();this.cache=new Map();this.language='en';}
 stop(kind){const s=this[kind];s.revision++;s.controller?.abort();s.controller=null;s.loading=false;this.onChange();}
 edit(value){if(value===this.query)return;this.stop('grammar');this.stop('words');this.query=value;this.submitted=null;this.grammar.result=null;this.words.result=null;this.grammar.error=null;this.words.error=null;this.cache.clear();}
 clear(){this.edit('');this.stop('grammar');this.stop('words');this.submitted=null;this.grammar.result=null;this.words.result=null;this.grammar.error=null;this.words.error=null;this.cache.clear();}
 submit(language){this.stop('grammar');this.stop('words');this.grammar.result=null;this.words.result=null;this.grammar.error=inputError(this.query);this.words.error=null;if(this.grammar.error){this.onChange();return;}this.submitted=this.query.trim();this.cache.clear();this.request('grammar',language,true);this.request('words',language,true);}
 request(kind,language='en',force=false){
  if(!this.submitted||!LANGS[language])return;
  const s=this[kind];if(s.loading&&kind==='words'&&this.language===language&&!force)return;
  if(kind==='words'&&!force&&s.result?.language===language&&s.result.sentence===this.submitted)return;
  this.stop(kind);s.result=null;s.error=null;
  if(kind==='words'){this.language=language;if(!force&&this.cache.has(language)){s.result=this.cache.get(language);this.onChange();return;}}
  const sentence=this.submitted,revision=s.revision,controller=new AbortController();s.controller=controller;s.loading=true;this.onChange();
  const valid=()=>s.revision===revision&&!controller.signal.aborted&&this.submitted===sentence;
  (async()=>{try{
   let parsed,repair='';
   for(let attempt=0;attempt<2;attempt++){
    if(!valid())return;
    try{const raw=await this.ask((kind==='grammar'?grammarPrompt(sentence):wordsPrompt(sentence,language))+repair,controller.signal);if(!valid())return;parsed=kind==='grammar'?parseGrammar(raw,sentence):parseWords(raw,sentence,language);break;}
    catch(e){if(attempt||!['invalid_json','grammar_conflict'].includes(e.code))throw e;
     repair=kind==='words'?'\nRepair: return all original words in order with meanings entirely in the requested language.':e.code==='grammar_conflict'?'\nREPAIR: Your previous analysis assigned both a hidden subject and a following explicit فاعل to the same verb. Correct this contradiction. The following explicit noun is the sole subject. Do not invent another hidden pronoun, an alternative school, or say the subject governs the verb mood. Return the complete corrected JSON.':'\nREPAIR: Your previous reply was incomplete or changed the original letters/order. Return a complete JSON with every original word accounted for exactly once.';
    }
   }
   if(valid()){s.result=parsed;if(kind==='words')this.cache.set(language,parsed);this.onCompleted(sentence);}
  }catch(e){if(valid())s.error=e.code==='sentence_context'?'Enter a complete sentence rather than an isolated word.':e.code==='sentence_invalid'?'This sentence could not be parsed reliably. Check the wording or add vowel marks.':['invalid_json','grammar_conflict'].includes(e.code)?kind==='grammar'?'The grammar reply was incomplete. Try again.':'The word meanings were incomplete. Try again.':errorMessage(e);}
  finally{if(valid()){s.loading=false;s.controller=null;this.onChange();}}
  })();
 }
}
