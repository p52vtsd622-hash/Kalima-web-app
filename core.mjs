export const VERSION = '0.8-web.1';
export const LANGS = {en:'English',ar:'Arabic',ur:'Urdu',fa:'Farsi',tr:'Turkish',ru:'Russian',fr:'French'};
export const NATIVE = {en:'English',ar:'العربية',ur:'اردو',fa:'فارسی',tr:'Türkçe',ru:'Русский',fr:'Français'};
export const RTL = new Set(['ar','ur','fa']);
export const clone = value => JSON.parse(JSON.stringify(value));
export const text = value => typeof value === 'string' ? value : '';
export const list = value => Array.isArray(value) ? value : [];
export const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function normalize(value) {
  return text(value).toLocaleLowerCase('en').normalize('NFD').replace(/[\p{M}\p{Cf}ـ]/gu,'')
    .replace(/[ىی]/g,'ي').replace(/ک/g,'ك').replace(/ٱ/g,'ا').replace(/\s+/g,' ').trim();
}
export const extraLanguages = app => Object.keys(LANGS).filter(x => x !== 'ar' && x !== app);
export function translator(catalogs, language) {
  const table = catalogs[language] || {};
  const templates = Object.entries(table).filter(([k]) => /\{\d+\}/.test(k)).map(([k,v]) => [
    new RegExp('^'+k.split(/\{\d+\}/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('(.*?)')+'$','s'), v]);
  return source => {
    if (language === 'en' || !source) return source;
    if (Object.hasOwn(table, source)) return table[source];
    for (const [pattern, value] of templates) {
      const match = source.match(pattern);
      if (match) return value.replace(/\{(\d+)\}/g,(_,i)=>table[match[+i+1]] || match[+i+1] || '');
    }
    return source;
  };
}
function legacyFields(d, field, root) {
  return {meaning:text(d.meaning?.[field]),root:text(d[root]),...Object.fromEntries(
    ['examples','synonyms','antonyms'].map(k=>[k,list(d[k]).map(x=>text(x?.[field]))]))};
}
export function normalizeData(input, knownLanguage) {
  const d = clone(object(input));
  d.meaning = object(d.meaning); d.trans = object(d.trans);
  if ((d.meaning.ur || d.rootGlossUr || ['examples','synonyms','antonyms'].some(k=>list(d[k]).some(x=>x?.ur))) && !d.trans.ur)
    d.trans.ur = legacyFields(d,'ur','rootGlossUr');
  const legacy = d.meaning.tx || d.rootGlossTx || ['examples','synonyms','antonyms'].some(k=>list(d[k]).some(x=>x?.tx));
  if (legacy && knownLanguage && LANGS[knownLanguage] && !d.trans[knownLanguage]) d.trans[knownLanguage] = legacyFields(d,'tx','rootGlossTx');
  if (!legacy || knownLanguage) {
    delete d.meaning.tx; delete d.rootGlossTx;
    for (const k of ['examples','synonyms','antonyms']) for (const x of list(d[k])) if (x && typeof x==='object') delete x.tx;
  }
  delete d.meaning.ur; delete d.rootGlossUr;
  for (const k of ['examples','synonyms','antonyms']) for (const x of list(d[k])) if (x && typeof x==='object') delete x.ur;
  if (d.extras?.rootWords) { d.extras.rootWords_ur = d.extras.rootWords.map(x=>({...x,tx:x.tx||x.ur||''})); delete d.extras.rootWords; }
  return d;
}
export function normalizeEntry(input) {
  const e = clone(object(input)); const d = object(e.data);
  const id = text(e.id) || text(d.word);
  if (!id.trim() || !text(d.word).trim()) throw Error('This isn\'t a Kalima backup.');
  e.id=id; e.data=normalizeData(d);
  if (list(e.conjs).length && e.data.verb) e.data.verb.conjugation=clone(e.conjs);
  delete e.conjs;
  e.addedAt = Number(e.addedAt || e.added) || Date.now(); e.added=e.addedAt;
  e.box=Math.max(0,Math.min(5,Number(e.box)||0));e.due=Math.max(0,Number(e.due)||0);
  return e;
}
export function decodeBackup(raw) {
  if (new TextEncoder().encode(raw).length > 20*1024*1024) throw Error('This backup is too large (maximum 20 MB).');
  const parsed=JSON.parse(raw);
  if (!Array.isArray(parsed) && ((parsed.app && parsed.app!=='kalima') || (parsed.version||1)>2)) throw Error('This isn\'t a Kalima backup.');
  const rows=Array.isArray(parsed)?parsed:parsed.words;
  if (!Array.isArray(rows) || rows.length>10000) throw Error('This isn\'t a Kalima backup.');
  return rows.map(normalizeEntry);
}
export function mergeEntry(existing, incoming) {
  const out=clone(existing), d=out.data, src=incoming.data;
  d.trans=object(d.trans);
  if (text(d.meaning?.en)===text(src.meaning?.en)) for (const lang of Object.keys(LANGS)) {
    const t=src.trans?.[lang]; if (!t || d.trans[lang]) continue;
    const aligned={meaning:text(t.meaning),root:d.rootGloss===src.rootGloss?text(t.root):''};
    for (const k of ['partOfSpeech','grammarNote','note','waznNote','inputPerson']) {
      const original=x=>k==='waznNote'?x.wazn?.note:k==='inputPerson'?x.verb?.inputPerson:x[k];
      if (original(d)===original(src)) aligned[k]=text(t[k]);
    }
    for (const k of ['examples','synonyms','antonyms']) aligned[k]=list(d[k]).map(target=>{
      const i=list(src[k]).findIndex(x=>x.ar===target.ar && x.en===target.en);return i>=0?text(t[k]?.[i]):'';
    });
    d.trans[lang]=aligned;
  }
  if (d.verb && !list(d.verb.conjugation).length && d.verb.dictionaryForm===src.verb?.dictionaryForm) d.verb.conjugation=clone(list(src.verb?.conjugation));
  d.extras={...object(src.extras),...object(d.extras)};
  return out;
}
export function project(d, app='en', extra='off') {
  const p=object(d.trans?.[app]), tx=extra==='en'?{meaning:d.meaning?.en,root:d.rootGloss,
    ...Object.fromEntries(['examples','synonyms','antonyms'].map(k=>[k,list(d[k]).map(x=>text(x.en))]))}:object(d.trans?.[extra]);
  const v=clone(d);
  if (app!=='en') {
    v.meaning={...object(v.meaning),en:app==='ar'?text(d.meaning?.ar):text(p.meaning)};
    v.partOfSpeech=text(p.partOfSpeech)||text(d.partOfSpeech);
    v.rootGloss=text(p.root);v.grammarNote=text(p.grammarNote);v.note=text(p.note);
    v.wazn={...object(v.wazn),note:text(p.waznNote)};
    if (v.verb) v.verb.inputPerson=text(p.inputPerson);
    for (const k of ['examples','synonyms','antonyms']) v[k]=list(v[k]).map((x,i)=>({...x,en:app==='ar'?'':text(p[k]?.[i])}));
  }
  return {data:v,translation:tx,missing:[app,extra].filter((x,i,a)=>a.indexOf(x)===i && !['en','off'].includes(x) && !(x==='ar'?d.meaning?.ar:d.trans?.[x]?.meaning))};
}
export function searchSaved(rows, query, limit=6) {
  const q=normalize(query); if (!q) return [];
  return rows.map((e,i)=>{
    const d=e.data, ar=normalize(d.word), fields=[e.id,d.word,d.transliteration,...Object.values(object(d.meaning)),...Object.values(object(d.trans)).map(t=>t?.meaning)].map(normalize).filter(Boolean);
    const rank=ar===q?0:ar.startsWith(q)?1:fields.some(x=>x.startsWith(q))?2:fields.some(x=>x.split(' ').some(t=>t.startsWith(q)))?3:fields.some(x=>x.includes(q))?4:99;
    return {e,i,rank};
  }).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,limit).map(x=>x.e);
}
export class SuggestionDeck {
  constructor(words, previous='', random=Math.random) { this.words=words;this.last=previous;this.random=random;this.refresh(); }
  refresh() { this.history=new Map();this.pool=[];this.position=0;this.at(0); }
  at(position) {
    if (!this.history.has(position)) {
      if (!this.pool.length) this.pool=shuffle(this.words,this.random);
      const excluded=[this.last,this.history.get(position-1)?.arabic,this.history.get(position+1)?.arabic];
      let i=this.pool.findIndex(w=>!excluded.includes(w.arabic));
      if (i<0) { const w=this.words.find(w=>!excluded.includes(w.arabic));this.pool.push(w);i=this.pool.length-1; }
      const word=this.pool.splice(i,1)[0];this.history.set(position,word);this.last=word.arabic;
    }
    return this.history.get(position);
  }
  move(delta) { this.position+=delta;return this.at(this.position); }
}
export function shuffle(array, random=Math.random) { const a=array.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
export function graded(entry, correct, now=Date.now()) { const e=clone(entry);e.box=correct?Math.min(e.box+1,5):0;e.due=now+[0,1,3,7,14,30][e.box]*86400000;return e; }
export class Store {
  constructor(storage) {
    this.storage=storage;this.undo=[];this.errors=[];
    try {const rows=this.read('kalima_saved_v1',[]);if(!Array.isArray(rows))throw Error();this.saved=rows.map(normalizeEntry);}
    catch {this.saved=[];this.errors.push('kalima_saved_v1');}
    const recent=this.read('kalima_recent_v1',[]);this.recent=list(recent).filter(x=>typeof x==='string').slice(0,8);
    this.prefs={appLanguage:'en',lang:'off',theme:'system',haptics:false,...object(this.read('kalima_prefs_v1',{}))};
    if (!LANGS[this.prefs.appLanguage]) this.prefs.appLanguage='en';
    if (!extraLanguages(this.prefs.appLanguage).includes(this.prefs.lang)) this.prefs.lang='off';
    if (!['system','light','dark'].includes(this.prefs.theme)) this.prefs.theme='system';
    this.prefs.access=this.prefs.access==='own' && this.get('kalima_gemini_key_v1')?'own':'shared';
  }
  get(key) { try{return this.storage.getItem(key)||'';}catch{ return ''; } }
  read(key,fallback) { try {const raw=this.storage.getItem(key);return raw?JSON.parse(raw):fallback;}catch {this.errors.push(key);return fallback;} }
  write(key,value) { if (key==='kalima_saved_v1'&&this.errors.includes(key)) throw Error("Your saved words couldn't be opened. Restore a backup if needed.");this.storage.setItem(key,JSON.stringify(value));this.errors=this.errors.filter(k=>k!==key); }
  saveRows(next) { this.write('kalima_saved_v1',next);this.saved=next; }
  savePrefs(next) { this.write('kalima_prefs_v1',next);this.prefs=next; }
  saveRecent(word) { const next=[word,...this.recent.filter(w=>w!==word)].slice(0,8);this.write('kalima_recent_v1',next);this.recent=next; }
  add(d) { const existing=this.saved.find(e=>e.id===d.word);if(existing)return false;
    this.saveRows([{id:d.word,added:Date.now(),addedAt:Date.now(),box:0,due:0,data:normalizeData(d)},...this.saved]);return true; }
  remove(id) { const entry=this.saved.find(e=>e.id===id);if(!entry)return false;
    const index=this.saved.indexOf(entry);this.saveRows(this.saved.filter(e=>e.id!==id));this.undo.push({type:'saved',entry:clone(entry),index});return true; }
  clearHistory() { if(!this.recent.length)return;const old=this.recent.slice();this.write('kalima_recent_v1',[]);this.recent=[];this.undo.push({type:'history',words:old}); }
  undoLast() { const change=this.undo.at(-1);if(!change)return null;
    if(change.type==='saved') {const next=this.saved.slice();if(!next.some(e=>e.id===change.entry.id))next.splice(Math.min(change.index,next.length),0,change.entry);this.saveRows(next);}
    else {const next=[...new Set([...this.recent,...change.words])].slice(0,8);this.write('kalima_recent_v1',next);this.recent=next;}
    this.undo.pop();return change;
  }
  updateData(d) { const next=this.saved.map(e=>e.id===d.word?{...e,data:clone(d)}:e);this.saveRows(next); }
  grade(id, correct) { const entry=this.saved.find(e=>e.id===id);if(!entry)throw Error('The file could not be saved.');const next=graded(entry,correct);this.saveRows(this.saved.map(e=>e.id===id?next:e)); }
  import(raw) { const incoming=decodeBackup(raw), next=this.saved.map(clone);let count=0;
    for(const entry of incoming){const i=next.findIndex(e=>e.id===entry.id);if(i<0){next.push(entry);count++;}else next[i]=mergeEntry(next[i],entry);}
    // A validated backup can recover an unreadable store; keep its bytes until this write succeeds.
    if(this.errors.includes('kalima_saved_v1')){this.storage.setItem('kalima_saved_v1',JSON.stringify(next));this.saved=next;this.errors=this.errors.filter(k=>k!=='kalima_saved_v1');}
    else this.saveRows(next);return {added:count,updated:incoming.length-count};
  }
  export() {return JSON.stringify({app:'kalima',version:2,exported:new Date().toISOString(),words:this.saved},null,2);}
}
export function csv(rows) {
  const values=[['Arabic','Transliteration','Root','Part of speech','Wazn','English','Urdu','Persian','Turkish','Russian','French','Arabic definition','Example (Arabic)','Example (English)'],...rows.map(e=>{
    const d=e.data;return [d.word,d.transliteration,list(d.root).join(' '),d.partOfSpeech,d.wazn?.pattern,d.meaning?.en,...['ur','fa','tr','ru','fr'].map(l=>d.trans?.[l]?.meaning),d.meaning?.ar,d.examples?.[0]?.ar,d.examples?.[0]?.en];})];
  return '\uFEFF'+values.map(row=>row.map(v=>'"'+text(v).replace(/[\r\n]/g,' ').replaceAll('"','""')+'"').join(',')).join('\r\n');
}
