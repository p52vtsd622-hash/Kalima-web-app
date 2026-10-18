import {VERSION,LANGS,NATIVE,RTL,clone,text,list,object,normalize,extraLanguages,translator,project,Store,SuggestionDeck,searchSaved,shuffle,csv,normalizeData} from './core.mjs';
import {ask,parseJSON,rootRequest,rootsPrompt,lookupPrompt,reversePrompt,translationPrompt,conjugationPrompt,PRONOUNS,TENSES,ApiError,errorMessage} from './api.mjs';
import {el,arabic,prose,button,row,card,icon,iconButton,section,loading,sectionError,openSheet,closeSheet,choiceSheet,setTranslator,swipe,animateWord,wordSnapshot,cancelWordMotion,reduced} from './ui.mjs';
import {navigation} from './motion.mjs';
import {loadCorpus,corpusMatches,corpusReference} from './corpus.mjs';

const $=s=>document.querySelector(s),content=$('#content'),query=$('#query');
const [catalogs,words]=await Promise.all([fetch('./ui-translations.json').then(r=>r.json()),fetch('./suggestions.json').then(r=>r.json())]);
let store;
try{store=new Store(localStorage);}catch {store=new Store({getItem:()=>null,setItem:()=>{throw Error();}});store.errors.push('kalima_saved_v1');}
let t=translator(catalogs,store.prefs.appLanguage);setTranslator(t);
const deck=new SuggestionDeck(words,store.get('kalima_last_suggestion_v1'));
const state={tab:'lookup',result:null,candidates:null,query:'',searchMode:'ar',depth:'deep',focused:false,loading:false,error:null,generation:0,controllers:new Set(),sections:new Map(),filter:'',scroll:{},source:null,highlight:null,practice:null,practiceMode:'flash',busyGrade:false};
const pendingSections=new Map();
const settings=()=>({access:store.prefs.access,key:store.get('kalima_gemini_key_v1'),model:store.get('kalima_gemini_model_v1')||'gemini-2.5-flash',proxy:store.get('kalima_proxy_v1')||globalThis.KALIMA_PROXY||'https://kalima.wyp44cctp8.workers.dev'});
function notify(message) {
  const box=$('#notice');box.hidden=!message;box.replaceChildren();
  if(message)box.append(el('span',{text:message}),button('Dismiss',()=>notify(null),'quiet'));
  $('#announcer').textContent=message?t(message):'';
}
function storageAction(fn) {try{return fn();}catch(e){notify(catalogs.en[e.message]?e.message:"Couldn't save your words. Free some space on the phone and try again.");return false;}}
function haptic(){if(store.prefs.haptics&&typeof navigator.vibrate==='function')navigator.vibrate(8);}
function invalidate() {cancelWordMotion();state.generation++;state.controllers.forEach(c=>c.abort());state.controllers.clear();pendingSections.clear();state.loading=false;}
function saveData(data) {if(store.saved.some(e=>e.id===data.word))storageAction(()=>store.updateData(data));}
function actionController() {const c=new AbortController();state.controllers.add(c);return c;}
function finishController(c){state.controllers.delete(c);}
function applyPrefs(patch) {
  const next={...store.prefs,...patch};if(!extraLanguages(next.appLanguage).includes(next.lang))next.lang='off';
  store.savePrefs(next);invalidate();t=translator(catalogs,next.appLanguage);setTranslator(t);state.practice=null;state.error=null;
  sync();render();
}
const selectNav=navigation(tab=>switchTab(tab));
function sync() {
  const app=store.prefs.appLanguage;
  document.documentElement.lang=app;document.documentElement.dir=RTL.has(app)?'rtl':'ltr';
  const dark=store.prefs.theme==='dark'||store.prefs.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]').content=dark?'#161718':'#F8F6F0';
  const pill=$('#save-pill'),saved=state.result&&store.saved.some(e=>e.id===state.result.word);
  pill.textContent=t(saved?'Saved':'Save');pill.classList.toggle('selected',!!saved);pill.classList.toggle('saved',!!saved);pill.disabled=!state.result||state.loading;
  pill.setAttribute('aria-label',t(!state.result?'Look up a word first':saved?'Remove saved word':'Save word'));
  $('#search-pill').textContent=t(state.searchMode==='rev'?'Reverse':'Ar Word');$('#search-pill').classList.toggle('selected',state.searchMode!=='rev');
  $('#depth-pill').textContent=t(state.depth==='fast'?'Fast':'Deep');$('#language-pill').textContent=NATIVE[store.prefs.lang]||t('Off');
  $('#language-pill').setAttribute('aria-label',t('Extra translation')+': '+t(LANGS[store.prefs.lang]||'Off'));
  query.classList.toggle('reverse',state.searchMode==='rev');query.dir=state.searchMode==='rev'?(RTL.has(app)?'rtl':'ltr'):'rtl';query.lang=state.searchMode==='rev'?app:'ar';
  query.placeholder=t(state.searchMode==='rev'?'Find Arabic for...':'Type an Arabic word…');$('#query-label').textContent=t('Search');$('#submit').setAttribute('aria-label',t('Search'));$('#submit').disabled=!query.value.trim()||state.loading;
  const title=state.tab==='lookup'?(state.result?'Translations':'Kalima'):({saved:'Saved words',practice:'Practice',settings:'Settings',history:'Recent searches'})[state.tab];
  $('#title').textContent=t(title);$('#clear').textContent=t('Clear');$('#clear').hidden=state.tab!=='lookup'||!(state.query||state.result||state.loading||state.error||state.candidates);
  $('#history').setAttribute('aria-label',t('Recent searches'));
  $('#pills').hidden=state.focused&&state.tab==='lookup';
  for(const b of document.querySelectorAll('#navigation>button'))b.setAttribute('aria-label',t(({lookup:'Lookup',saved:'Saved words',practice:'Practice',settings:'Settings'})[b.dataset.tab]));
  selectNav(state.tab);renderUndo();
}
function renderUndo() {
  const box=$('#undo'),change=store.undo.at(-1);box.hidden=!change;box.replaceChildren();if(!change)return;
  box.append(el('span',{text:change.type==='history'?'Recent searches cleared':`Removed ${change.entry.id}`}),button('Undo',()=>{
    const restored=storageAction(()=>store.undoLast());if(!restored)return;haptic();
    if(restored.type==='saved'){state.filter='';state.highlight=restored.entry.id;switchTab('saved');requestAnimationFrame(()=>content.querySelector('[data-id="'+CSS.escape(restored.entry.id)+'"]')?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'}));}
    else render();setTimeout(()=>{state.highlight=null;content.querySelectorAll('.highlight').forEach(n=>n.classList.remove('highlight'));},1600);notify('Removal undone');
  },'quiet'),button('Dismiss',()=>{store.undo=[];renderUndo();},'quiet'));
}
function blurSearch(){state.focused=false;query.blur();}
function refreshSuggestion(){deck.refresh();try{localStorage.setItem('kalima_last_suggestion_v1',deck.at(0).arabic);}catch{}}
function switchTab(tab,push=true) {
  if(state.tab!==tab){state.scroll[state.tab]=content.scrollTop;if(tab==='lookup')refreshSuggestion();}
  blurSearch();state.tab=tab;
  if(push&&history.state?.tab!==tab)history.pushState({tab},'');
  sync();render(true);haptic();
}
function render(restore=false) {
  const scroll=restore?(state.scroll[state.tab]||0):content.scrollTop;
  let body;
  if(state.tab==='saved')body=savedScreen();else if(state.tab==='history')body=historyScreen();else if(state.tab==='practice')body=practiceScreen();else if(state.tab==='settings')body=settingsScreen();else body=lookupScreen();
  content.replaceChildren(body);content.scrollTop=scroll;sync();renderCompact();
}
function incoming(node){node.classList.add('incoming');return node;}
function clear() {invalidate();blurSearch();state.query='';query.value='';state.result=null;state.candidates=null;state.error=null;state.source=null;state.sections.clear();refreshSuggestion();state.tab='lookup';content.scrollTop=0;render();}
function toggleSave() {
  const d=state.result;if(!d)return;
  const saved=store.saved.some(e=>e.id===d.word);
  const success=storageAction(()=>saved?store.remove(d.word):store.add(d));
  if(success&&!saved){haptic();$('#save-pill').classList.remove('celebrate');void $('#save-pill').offsetWidth;$('#save-pill').classList.add('celebrate');}
  sync();
}
function lookupScreen() {
  const body=el('div',{});
  if(state.focused)return focusedSearch();
  if(state.loading)return el('div',{},loading(state.searchMode==='rev'?'Finding Arabic matches…':'Analysing this word…'),button('Stop',()=>{invalidate();state.error=null;render();},'quiet'));
  if(state.error)return el('div',{},sectionError(state.error,()=>runLookup()),button('Clear',clear,'quiet'));
  if(state.candidates)return el('div',{},el('h2',{text:`Arabic for "${state.query}"`}),state.candidates.length?state.candidates.map(candidateCard):el('p',{text:'No Arabic matches found.'}));
  if(state.result)return resultScreen(state.result);
  body.append(suggestionCard());
  const due=store.saved.filter(e=>e.due<=Date.now()).length;
  if(due)body.append(el('button',{type:'button',class:'card continuation',onclick:()=>{state.practiceMode='flash';state.practice=null;switchTab('practice');}},el('span',{text:'Continue learning'}),el('strong',{text:`Review ${due} ${due===1?'word':'words'}`})));
  else if(store.recent.length)body.append(card(el('h2',{text:'Recent searches'}),el('div',{class:'word-list'},store.recent.slice(0,3).map(w=>button(w,()=>openWord(w))))));
  return incoming(body);
}
function suggestionCard() {
  const word=deck.at(deck.position),node=card();node.classList.add('suggestion');node.dataset.testid='suggestion';
  const display=el('div',{},button('',()=>openWord(word.arabic),'suggestion-word',{'aria-label':'Study word'}),el('p',{class:'label',text:word.kind}));display.querySelector('button').append(arabic(word.arabic));
  const move=delta=>{deck.move(delta);try{localStorage.setItem('kalima_last_suggestion_v1',deck.at(deck.position).arabic);}catch{}render();content.querySelector('.suggestion-word')?.classList.add(delta>0?'slide-next':'slide-prev');};
  node.append(el('p',{class:'label',text:'Suggested word'}),display,el('div',{class:'suggestion-actions'},iconButton('previous','Previous suggestion',()=>move(-1)),iconButton('listen','Listen',()=>speak(word.arabic)),button('Study word',()=>openWord(word.arabic),'primary'),iconButton('next','Next suggestion',()=>move(1))));
  swipe(display,x=>{if(Math.abs(x)>45)move(x<0?1:-1);});
  return node;
}
function focusedSearch() {
  const body=el('div',{}),empty=!state.query.trim();
  body.append(row(el('h2',{class:'grow',text:empty?'Recent searches':'Saved matches'}),button('Close',()=>{blurSearch();render();},'quiet')),
    el('p',{class:'muted',text:store.prefs.appLanguage==='ar'?'Arabic':`Arabic + ${LANGS[store.prefs.appLanguage]}`}),el('p',{class:'muted',text:`Extra: ${LANGS[store.prefs.lang]||'Off'}`}));
  if(empty){if(!store.recent.length)body.append(el('p',{text:'Your recent searches will appear here.'}));
    for(const w of store.recent.slice(0,5))body.append(el('button',{class:'card',onclick:()=>openWord(w)},arabic(w)));
    if(store.recent.length)body.append(button('Clear recent searches',()=>{storageAction(()=>store.clearHistory());render();},'quiet'));
  }else {const matches=searchSaved(store.saved,state.query);
    if(!matches.length)body.append(el('p',{text:'No saved matches. Use Search to look up this word.'}));
    for(const e of matches)body.append(el('button',{class:'card',onclick:()=>openSaved(e)},arabic(e.data.word),prose(shortMeaning(e.data),store.prefs.appLanguage)));
  }
  return body;
}
async function runLookup() {
  const value=query.value.trim().replace(/\s+/g,' ').slice(0,80);if(!value){notify('Type a word first.');return;}
  if(state.searchMode==='ar'&&!/[\u0621-\u064a]/.test(value)){notify('Type an Arabic word, or switch to Reverse Search.');return;}
  invalidate();blurSearch();state.tab='lookup';state.query=value;state.loading=true;state.error=null;state.result=null;state.candidates=null;state.sections.clear();state.source=null;content.scrollTop=0;render();
  const generation=state.generation,controller=actionController(),app=store.prefs.appLanguage,extra=store.prefs.lang;
  try {
    const prompt=state.searchMode==='rev'?reversePrompt(value,app,extra):lookupPrompt(value.slice(0,60),app,extra,state.depth);
    const data=parseJSON(await ask(prompt,settings(),controller.signal));if(generation!==state.generation)return;
    if(state.searchMode==='rev'){state.candidates=list(data.results).filter(x=>text(x.ar)&&text(x.en));}
    else {
      if(!text(data.meaning?.en)||!/[\u0621-\u064a]/.test(text(data.word)||value))throw new ApiError('invalid_json');
      data.word=text(data.word)||value;state.result=normalizeData(data);storageAction(()=>store.saveRecent(data.word));
    }
  }catch(e){if(generation===state.generation)state.error=e.code==='cancelled'?null:errorMessage(e);}
  finally{finishController(controller);if(generation===state.generation){state.loading=false;render();}}
}
function candidateCard(item) {
  const app=store.prefs.appLanguage,extra=store.prefs.lang;
  return el('button',{class:'card',onclick:()=>openWord(item.ar)},arabic(item.ar),item.transliteration&&app!=='ar'?prose(item.transliteration,'en','muted'):null,
    prose(app==='en'?item.en:item.main||'',app),extra!=='off'?prose(extra==='en'?item.en:item.tx||'',extra,'trans'):null);
}
function openWord(word) {
  const cached=store.saved.find(e=>e.id===word||e.data.word===word);if(cached){openSaved(cached);return;}
  state.searchMode='ar';query.value=word;runLookup();
}
function openSaved(entry,source) {
  source=wordSnapshot(source);
  const origin=state.tab!=='lookup'?{tab:state.tab,id:entry.id,scroll:content.scrollTop,filter:state.filter}:null;
  if(origin)state.source=origin;
  invalidate();blurSearch();state.result=clone(entry.data);state.error=null;state.candidates=null;state.query=entry.data.word;query.value=state.query;state.searchMode='ar';state.tab='lookup';state.sections.clear();
  if(history.state?.tab!=='lookup')history.pushState({tab:'lookup'},'');
  render();content.scrollTop=0;if(source)requestAnimationFrame(()=>animateWord(source,content.querySelector('.hero-word'),entry.data.word));
}
function returnToSource() {
  if(!state.source)return;const origin=state.source,source=wordSnapshot(content.querySelector('.hero-word')),value=state.result?.word;state.filter=origin.filter;state.scroll[origin.tab]=origin.scroll;switchTab(origin.tab);state.source=null;
  const target=content.querySelector(`[data-id="${CSS.escape(origin.id)}"] .arabic`);if(target)requestAnimationFrame(()=>animateWord(source,target,value));
}
function shortMeaning(d) {return text(project(d,store.prefs.appLanguage).data.meaning?.en).split(/[;\n]|\.\s/)[0].trim().slice(0,160);}
function resultScreen(d) {
  const app=store.prefs.appLanguage,extra=store.prefs.lang,{data:v,translation:tx,missing}=project(d,app,extra),body=el('div',{});
  const hero=el('section',{class:'hero'},state.source?button('Back',returnToSource,'quiet'):null,arabic(d.word,'hero-word'),d.transliteration&&app!=='ar'?prose(d.transliteration,'en','muted'):null,
    row(v.partOfSpeech?el('span',{class:'tag',text:v.partOfSpeech}):null,iconButton('listen','Listen',()=>speak(d.word))));body.append(hero);
  const meanings=card(el('h2',{text:'Meaning'}));
  if(app!=='ar'&&v.meaning?.en)meanings.append(el('p',{class:'label',text:LANGS[app]}),prose(v.meaning.en,app,'meaning'));
  if(d.meaning?.ar)meanings.append(el('p',{class:'label',text:'Arabic'}),arabic(d.meaning.ar));
  if(extra!=='off'&&tx.meaning)meanings.append(el('div',{class:'trans'},el('p',{class:'label',text:LANGS[extra]}),prose(tx.meaning,extra,'meaning')));
  body.append(meanings);
  for(const language of missing){const slot=card(el('p',{text:`Download the ${LANGS[language]} explanation for this word.`}),button(`Download ${LANGS[language]}`,()=>loadTranslation(language,slot),'quiet'));body.append(slot);}
  if(d.meaning?.tx)body.append(card(el('p',{text:'This older Android word has a translation with no language label. Which language is it?'}),button('Translation language',()=>choiceSheet('Translation language','',Object.keys(LANGS).filter(l=>l!=='ar').map(l=>({value:l,label:LANGS[l],native:NATIVE[l]})),null,l=>{state.result=normalizeData(d,l);saveData(state.result);render();}),'quiet')));
  if(v.grammarNote)body.append(section('Grammar',prose(v.grammarNote,app),'grammar',state.sections));
  body.append(card(el('h2',{text:'Wazn'}),arabic(d.wazn?.pattern||'—'),v.wazn?.note?prose(v.wazn.note,app):null));
  if(list(d.root).length)body.append(card(el('h2',{text:'Root'}),arabic(d.root.join(' – '),'root-letters'),v.rootGloss?prose(v.rootGloss,app):null,extra!=='off'&&tx.root?prose(tx.root,extra,'trans'):null));
  else body.append(card(el('p',{text:'No root: this may be a particle or a loanword.'})));
  if(list(d.examples).length)body.append(section('In a sentence',list(v.examples).map((example,i)=>card(arabic(example.ar),example.en?prose(example.en,app):null,extra!=='off'&&tx.examples?.[i]?prose(tx.examples[i],extra,'trans'):null,iconButton('listen','Listen to sentence',()=>speak(example.ar)))),'examples',state.sections));
  body.append(section('Examples in texts',null,'texts',state.sections,slot=>showCorpora(d,slot)));
  if(d.verb)body.append(verbSection(d,v));
  if(list(d.root).length)body.append(section('Words from this root',null,'roots',state.sections,slot=>showRoots(d,slot)));
  for(const [key,title] of [['synonyms','Synonyms'],['antonyms','Antonyms']])body.append(section(title,list(v[key]).length?list(v[key]).map((x,i)=>el('button',{class:'card',onclick:()=>openWord(x.ar)},arabic(x.ar),x.en?prose(x.en,app):null,extra!=='off'&&tx[key]?.[i]?prose(tx[key][i],extra,'trans'):null)):el('p',{text:'None found.'}),key,state.sections));
  if(list(d.forms).length)body.append(section('Related forms',el('div',{class:'word-list'},d.forms.map(w=>button(w,()=>openWord(w)))),'forms',state.sections));
  if(v.note)body.append(section('Usage note',prose(v.note,app),'note',state.sections));
  return incoming(body);
}
async function loadTranslation(language,slot) {
  const d=state.result,generation=state.generation,controller=actionController();slot.replaceChildren(loading(`Adding the ${LANGS[language]} explanation…`));
  try{
    const result=parseJSON(await ask(translationPrompt(d,language),settings(),controller.signal));
    if(!text(result.meaning)||['examples','synonyms','antonyms'].some(k=>!Array.isArray(result[k])||result[k].length!==list(d[k]).length||result[k].some(x=>typeof x!=='string')))throw new ApiError('invalid_json');
    if(generation!==state.generation)return;
    const next=clone(d);next.trans={...object(next.trans),[language]:result};if(language==='ar'&&!next.meaning?.ar)next.meaning={...object(next.meaning),ar:result.meaning};state.result=next;saveData(next);render();
  }catch(e){if(generation===state.generation)slot.replaceChildren(sectionError(e.code==='invalid_json'?'The translation was incomplete. Try again.':errorMessage(e),()=>loadTranslation(language,slot)));}
  finally{finishController(controller);}
}
async function showRoots(d,slot) {
  const app=store.prefs.appLanguage,extra=store.prefs.lang,key=`rootWords_${app}_${extra}`,generation=state.generation;
  const display=words=>slot.replaceChildren(words.length?el('div',{},words.map(candidateCard)):el('p',{text:'No other common words found.'}));
  if(Array.isArray(d.extras?.[key])){display(d.extras[key]);return;}
  if(pendingSections.has('roots'))return;const controller=actionController();pendingSections.set('roots',true);slot.replaceChildren(loading('Finding words from this root…'));
  try {
    const words=await rootRequest(attempt=>ask(rootsPrompt(d,app,extra)+(attempt?'\nReturn complete JSON with all requested keys; no surrounding text.':''),settings(),controller.signal),d.word,app,extra,controller.signal);
    if(generation!==state.generation)return;
    d.extras={...object(d.extras),[key]:words};saveData(d);display(words);
  }catch(e){if(generation===state.generation)slot.replaceChildren(sectionError(errorMessage(e),()=>showRoots(d,slot)));}
  finally{finishController(controller);if(generation===state.generation)pendingSections.delete('roots');}
}
function verbSection(d,v) {
  const app=store.prefs.appLanguage,nodes=[];
  for(const [key,label] of [['dictionaryForm','Dictionary form (he, past)'],['presentForm','Present (he)'],['masdar','Masdar (verbal noun)'],['masdarWazn','Masdar wazn']])if(d.verb[key])nodes.push(card(el('p',{class:'label',text:label}),arabic(d.verb[key]),iconButton('listen','Listen',()=>speak(d.verb[key]))));
  if(d.verb.form)nodes.unshift(el('p',{text:`Form ${d.verb.form}`}));if(v.verb.inputPerson)nodes.push(prose(v.verb.inputPerson,app));
  const tableSlot=el('div',{});nodes.push(tableSlot);
  if(list(d.verb.conjugation).length===14)tableSlot.append(conjugationTable(d));else tableSlot.append(button('Show 14×7 conjugations',()=>loadConjugations(d,tableSlot),'quiet'));
  return section('Verb details',nodes,'verb',state.sections);
}
async function loadConjugations(d,slot) {
  if(pendingSections.has('conjugations'))return;pendingSections.set('conjugations',true);
  const generation=state.generation,controller=actionController();slot.replaceChildren(loading('Loading the 14-form conjugation table…'));
  try {
    const result=parseJSON(await ask(conjugationPrompt(d.verb.dictionaryForm||d.word),settings(),controller.signal));
    if(!Array.isArray(result.conjugation)||result.conjugation.length!==14||result.conjugation.some(x=>!x||typeof x!=='object'||!text(x.past).trim()||!text(x.present).trim()||Object.keys(TENSES).some(k=>!Object.hasOwn(x,k))))throw new ApiError('invalid_json');
    if(generation!==state.generation)return;d.verb.conjugation=result.conjugation;saveData(d);slot.replaceChildren(conjugationTable(d));
  }catch(e){if(generation===state.generation)slot.replaceChildren(sectionError(e.code==='invalid_json'?'The conjugation table was incomplete. Try again.':errorMessage(e),()=>loadConjugations(d,slot)));}
  finally{finishController(controller);if(generation===state.generation)pendingSections.delete('conjugations');}
}
function conjugationTable(d) {
  const columns=Object.keys(TENSES),table=el('table',{},el('caption',{class:'sr-only',text:'All 14 forms · tap a form to listen'}),el('thead',{},el('tr',{},el('th',{scope:'col',text:'Who'}),columns.map(k=>el('th',{scope:'col',text:TENSES[k]})))));
  table.append(el('tbody',{},PRONOUNS.map((p,i)=>el('tr',{class:[3,6,9,12].includes(i)?'group-start':''},el('th',{scope:'row',lang:'ar',raw:p}),columns.map(k=>{
    const raw=text(d.verb.conjugation[i]?.[k]),valid=raw.trim()&&raw.toLowerCase()!=='null',matched=d.verb.inputMatch?.index===i&&d.verb.inputMatch?.tense===k;
    return el('td',{class:matched?'matched':''},valid?el('button',{type:'button',lang:'ar',raw:raw,'aria-label':t('Listen')+': '+raw,onclick:()=>speak(raw)}):el('span',{raw:'—'}));
  })))));
  return el('div',{},el('p',{class:'muted',text:'Swipe horizontally to see all forms'}),el('div',{class:'table-wrap',tabindex:'0','aria-label':'Conjugation table'},table));
}
async function showCorpora(d,slot) {
  const generation=state.generation;slot.replaceChildren(loading('Searching the bundled Quran and Nahj al-Balagha texts…'));
  try {const corpora=await Promise.all([loadCorpus('quran'),loadCorpus('nahj')]);if(generation!==state.generation)return;slot.replaceChildren(...corpora.map(c=>corpusSection(c,d)));}
  catch {if(generation===state.generation)slot.replaceChildren(sectionError('The bundled texts could not be opened.',()=>showCorpora(d,slot)));}
}
function corpusSection(c,d) {
  const isQ=c.name==='quran',matches=corpusMatches(c,d),body=el('section',{},el('h3',{text:isQ?'In the Quran':'In Nahj al-Balagha'}));
  body.append(el('p',{class:'muted',text:matches.length?`Found in ${matches.length} ${isQ?'verses':'passages'}. Matches use spelling and may include a different word with the same letters.`:isQ?'No verse found containing this word or its forms.':'No passage found containing this word or its forms.'}));
  const results=el('div',{});let shown=0;const more=button('Show more',()=>next(),'quiet');
  function next(){for(const match of matches.slice(shown,shown+3))results.append(corpusCard(c,match));shown+=3;more.hidden=shown>=matches.length;}
  next();body.append(results,more,el('p',{class:'credit',text:isQ?'Text: Tanzil Project (tanzil.net), Uthmani, version 1.1 (CC BY 3.0). The text is shown unchanged.':'Arabic text from the Alhassanain Network edition of Nahj al-Balagha, compiled by ash-Sharif ar-Radi. Numbering follows that edition.'}));return body;
}
function corpusCard(c,match) {
  const tokens=c.index.toks[match.u],hits=new Set(match.toks),ref=corpusReference(c,match.u),node=card();let full=false;
  const quote=el('p',{class:'quote'+(c.name==='nahj'?' nahj':''),lang:'ar',dir:'rtl'}),start=Math.max(0,(match.toks[0]||0)-14),end=Math.min(tokens.length,start+42);
  function paint(){quote.replaceChildren();if(!full&&start>0)quote.append('… ');tokens.slice(full?0:start,full?tokens.length:end).forEach((token,i)=>{const index=i+(full?0:start);quote.append(hits.has(index)?el('mark',{raw:token}):token,' ');});if(!full&&end<tokens.length)quote.append(' …');}
  paint();node.append(quote,el('p',{class:'source-ref',raw:(ref.key?t(ref.key)+' ':'')+ref.number}));
  if(start>0||end<tokens.length){const toggle=button(c.name==='quran'?'Show the full verse':'Show the full passage',()=>{full=!full;paint();toggle.textContent=t(full?'Show less':c.name==='quran'?'Show the full verse':'Show the full passage');},'quiet');node.append(toggle);}
  return node;
}
function renderCompact() {
  const box=$('#compact'),show=state.tab==='lookup'&&state.result&&!state.focused&&content.scrollTop>180;box.hidden=!show;if(!show){box.replaceChildren();return;}
  box.replaceChildren(arabic(state.result.word),iconButton('listen','Listen',()=>speak(state.result.word)),button('Back to top',()=>content.scrollTo({top:0,behavior:reduced()?'auto':'smooth'}),'quiet'));
}
content.addEventListener('scroll',renderCompact,{passive:true});

function savedScreen() {
  const body=el('div',{}),filter=el('input',{class:'field-input',type:'search',placeholder:'Filter saved words…','aria-label':'Filter saved words…',value:state.filter}),rows=el('div',{});
  const fill=()=>{const matches=state.filter.trim()?searchSaved(store.saved,state.filter,10000):store.saved;
    rows.replaceChildren(...(!store.saved.length?[el('p',{text:'No saved words yet. Look up a word and tap Save.'})]:!matches.length?[el('p',{text:'No saved words match that filter.'})]:matches.map(e=>wordRow(e,false))));};
  filter.addEventListener('input',()=>{state.filter=filter.value;fill();});fill();body.append(filter,rows,backupActions());return body;
}
function historyScreen() {
  const body=el('div',{},el('h2',{text:'Recent searches'}));
  if(!store.recent.length)body.append(el('p',{text:'Your recent searches will appear here.'}));
  for(const word of store.recent){const entry=store.saved.find(e=>e.id===word);body.append(wordRow(entry||{id:word,data:{word}},true));}
  if(store.recent.length)body.append(button('Clear recent searches',()=>{storageAction(()=>store.clearHistory());render();},'quiet'));return body;
}
function wordRow(entry,historyOnly) {
  const node=card(),word=arabic(entry.data.word);node.classList.add('list-row');node.dataset.id=entry.id;if(state.highlight===entry.id)node.classList.add('highlight');
  let held=false;
  const open=()=>held?(held=false):historyOnly&&!store.saved.some(e=>e.id===entry.id)?openWord(entry.id):openSaved(entry,word);
  const main=el('button',{type:'button',class:'open-word',onclick:open},word,entry.data.transliteration&&store.prefs.appLanguage!=='ar'?prose(entry.data.transliteration,'en','muted'):null,prose(shortMeaning(entry.data),store.prefs.appLanguage));
  node.append(main,row(button('Preview',()=>preview(entry,historyOnly),'quiet'),iconButton('listen','Listen',()=>speak(entry.id)),!historyOnly?button('Remove',()=>remove(entry.id),'quiet danger'):null));
  let timer,start;main.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{timer=null;held=true;preview(entry,historyOnly);},500);});
  main.addEventListener('pointermove',e=>{if(start&&(Math.abs(e.clientX-start.x)>8||Math.abs(e.clientY-start.y)>8)){clearTimeout(timer);timer=null;}});
  for(const event of ['pointerup','pointercancel','pointerleave'])main.addEventListener(event,()=>{clearTimeout(timer);});
  main.addEventListener('contextmenu',e=>{e.preventDefault();clearTimeout(timer);held=true;preview(entry,historyOnly);});
  return node;
}
function remove(id) {
  const before=new Map([...content.querySelectorAll('[data-id]')].map(n=>[n.dataset.id,n.getBoundingClientRect().top]));
  if(!storageAction(()=>store.remove(id)))return;render();
  if(!reduced())for(const n of content.querySelectorAll('[data-id]')){const delta=before.get(n.dataset.id)-n.getBoundingClientRect().top;if(Number.isFinite(delta)&&delta)n.animate([{transform:`translateY(${delta}px)`},{transform:'none'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});}
}
function preview(entry,historyOnly) {
  blurSearch();const app=store.prefs.appLanguage,{data:v,translation:tx}=project(entry.data,app,store.prefs.lang);
  const body=[arabic(entry.id,'preview-word'),v.meaning?.en?prose(v.meaning.en,app):null,entry.data.meaning?.ar?arabic(entry.data.meaning.ar):null,tx.meaning?prose(tx.meaning,store.prefs.lang,'trans'):null,
    row(button('Study word',()=>{closeSheet(()=>historyOnly?openWord(entry.id):openSaved(entry));},'primary'),iconButton('listen','Listen',()=>speak(entry.id)),!historyOnly?button('Remove',()=>{if(storageAction(()=>store.remove(entry.id))){closeSheet();render();}},'quiet danger'):null)];
  openSheet('Preview word',body.filter(Boolean));
}
function backupActions() {
  const file=el('input',{type:'file',accept:'.json,application/json',hidden:true,'aria-label':'Import backup'});
  file.addEventListener('change',async()=>{const selected=file.files?.[0];if(!selected)return;
    try{if(selected.size>20*1024*1024)throw Error('This backup is too large (maximum 20 MB).');const result=store.import(await selected.text());state.practice=null;render();notify(`Imported ${result.added} new words; updated ${result.updated} existing words. Your review progress was kept.`);}
    catch(e){notify(catalogs.en[e.message]?e.message:"Couldn't open that backup.");}finally{file.value='';}
  });
  return card(row(button('Export backup',()=>download('kalima-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json',store.export()),'quiet'),button('Export CSV',()=>download('kalima-words.csv','text/csv;charset=utf-8',csv(store.saved)),'quiet'),button('Import backup',()=>file.click(),'quiet')),file,
    el('p',{class:'muted',text:'Backups include saved words, translations, downloaded conjugations and review progress. Imports keep your existing words and progress. Account details are not included.'}));
}
function download(name,type,value) {
  try{const url=URL.createObjectURL(new Blob([value],{type})),link=el('a',{href:url,download:name});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('File saved.');}
  catch{notify("Couldn't save that file. Choose another location and try again.");}
}
function speak(value) {
  if(!('speechSynthesis'in window)){notify("Arabic pronunciation isn't available yet. Check the Arabic voice in your phone's text-to-speech settings.");return;}
  try{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(value);utterance.lang='ar';const voice=speechSynthesis.getVoices().find(v=>/^ar/i.test(v.lang));if(voice)utterance.voice=voice;utterance.onerror=()=>notify("Arabic pronunciation isn't available yet. Check the Arabic voice in your phone's text-to-speech settings.");speechSynthesis.speak(utterance);}
  catch{notify("Arabic pronunciation isn't available yet. Check the Arabic voice in your phone's text-to-speech settings.");}
}

function practiceEntries(){return store.saved.filter(e=>text(project(e.data,store.prefs.appLanguage).data.meaning?.en).trim());}
function practiceScreen() {
  const body=el('div',{});
  if(!store.saved.length)return el('div',{},el('p',{text:'Save some words first, then practice them here.'}),button('Go to Lookup',()=>switchTab('lookup'),'primary'));
  if(!practiceEntries().length)return el('div',{},el('p',{text:'Translation not downloaded'}),button('Go to Lookup',()=>switchTab('lookup'),'primary'));
  body.append(el('p',{class:'counter',text:`${store.saved.length} saved · ${store.saved.filter(e=>e.due<=Date.now()).length} due now`}),row(...['flash','quiz'].map(mode=>button(mode==='flash'?'Flashcards':'Quiz',()=>{state.practiceMode=mode;state.practice=null;render();},state.practiceMode===mode?'primary':''))));
  if(!state.practice)startPractice(false);
  const p=state.practice;
  if(state.practiceMode==='quiz')return renderQuiz(body,p);
  if(!p.queue.length)return el('div',{},body,el('p',{text:'Nothing is due right now. Come back later, or practice everything anyway.'}),button('Practice all words',()=>{startPractice(true);render();},'primary'));
  if(p.index>=p.queue.length)return el('div',{},body,el('p',{text:`Session finished. Words reviewed: ${p.reviewed}.`}),button('Start again',()=>{startPractice(true);render();},'primary'));
  const entry=store.saved.find(e=>e.id===p.queue[p.index]);if(!entry){p.index++;return practiceScreen();}
  const {data:v,translation:tx}=project(entry.data,store.prefs.appLanguage,store.prefs.lang),scene=el('div',{class:'flash-scene'}),inner=el('div',{class:'flash-inner'+(p.flipped?' flipped':'')}),front=el('button',{type:'button',class:'flash-face front','aria-label':'Reveal meaning',onclick:()=>flip(true)},arabic(entry.id),el('p',{class:'muted',text:'Tap to reveal the meaning'})),back=el('button',{type:'button',class:'flash-face back','aria-label':'Show Arabic',onclick:()=>flip(false)},arabic(entry.id),prose(v.meaning?.en||'',store.prefs.appLanguage),store.prefs.lang!=='off'&&tx.meaning?prose(tx.meaning,store.prefs.lang):null);
  inner.append(front,back);scene.append(inner);
  function flip(value){p.flipped=value;inner.classList.toggle('flipped',value);front.tabIndex=value?-1:0;back.tabIndex=value?0:-1;front.setAttribute('aria-hidden',String(value));back.setAttribute('aria-hidden',String(!value));renderActions();}
  const actions=row(iconButton('listen','Listen',()=>speak(entry.id))),progress=el('div',{class:'practice-progress','aria-hidden':'true'},el('span',{style:`width:${100*p.index/p.queue.length}%`}));
  function grade(correct){if(state.busyGrade)return false;state.busyGrade=true;
    try {store.grade(entry.id,correct);if(!correct)p.queue.push(entry.id);p.index++;p.reviewed++;p.flipped=false;render();return true;}
    catch {notify("Couldn't save your words. Free some space on the phone and try again.");return false;}
    finally{state.busyGrade=false;}
  }
  function renderActions(){actions.replaceChildren(iconButton('listen','Listen',()=>speak(entry.id)),...(p.flipped?[button('Again',()=>grade(false)),button('Got it',()=>grade(true),'primary')]:[button('Reveal meaning',()=>flip(true),'primary')]));}
  renderActions();front.tabIndex=p.flipped?-1:0;back.tabIndex=p.flipped?0:-1;front.setAttribute('aria-hidden',String(p.flipped));back.setAttribute('aria-hidden',String(!p.flipped));
  swipe(scene,x=>{if(Math.abs(x)>=scene.clientWidth*.28&&p.flipped){if(grade(x>0))return;}scene.style.transition=reduced()?'none':'transform .35s cubic-bezier(.2,1.4,.5,1)';scene.style.transform='';scene.style.boxShadow='';},x=>{scene.style.transition='none';scene.style.transform=`translateX(${x}px) rotate(${reduced()?0:x/60}deg)`;scene.style.boxShadow=reduced()?'':`0 ${Math.min(Math.abs(x)/10,16)}px 30px #0002`;},()=>p.flipped&&!state.busyGrade);
  body.append(el('p',{class:'counter',text:`Card ${p.index+1} of ${p.queue.length}`}),progress,scene,actions);return body;
}
function startPractice(all) {
  state.practice={queue:shuffle(practiceEntries().filter(e=>state.practiceMode==='quiz'||all||e.due<=Date.now())).map(e=>e.id),index:0,reviewed:0,flipped:false,score:0,question:null};
  if(state.practiceMode==='quiz')state.practice.queue=state.practice.queue.slice(0,10);
}
function renderQuiz(body,p) {
  if(practiceEntries().length<2)return el('div',{},body,el('p',{text:'Save at least 2 words to take a quiz.'}));
  if(p.index>=p.queue.length)return el('div',{},body,el('p',{text:`Score: ${p.score} out of ${p.queue.length}`}),button('New quiz',()=>{startPractice(true);render();},'primary'));
  const entry=store.saved.find(e=>e.id===p.queue[p.index]);if(!entry){p.index++;return practiceScreen();}
  if(!p.question)p.question={toMeaning:Math.random()<.5,options:shuffle([entry.id,...shuffle(practiceEntries().filter(e=>e.id!==entry.id)).slice(0,3).map(e=>e.id)]),answered:false,choice:null};
  const q=p.question;body.append(el('p',{class:'counter',text:`Question ${p.index+1} of ${p.queue.length}`}),q.toMeaning?arabic(entry.id,'hero-word'):prose(shortMeaning(entry.data),store.prefs.appLanguage,'meaning'),el('p',{text:q.toMeaning?'What does this mean?':'Which Arabic word is this?'}));
  for(const id of q.options){const e=store.saved.find(e=>e.id===id);if(!e)continue;const option=el('button',{type:'button',class:'option'+(q.answered&&id===entry.id?' correct':q.answered&&q.choice===id?' wrong':''),disabled:q.answered,onclick:()=>{
    if(q.answered)return;
    try{store.grade(entry.id,id===entry.id);q.answered=true;q.choice=id;if(id===entry.id)p.score++;render();}
    catch{notify("Couldn't save your words. Free some space on the phone and try again.");}
  }},q.toMeaning?prose(shortMeaning(e.data),store.prefs.appLanguage):arabic(id));body.append(option);}
  if(q.answered)body.append(button('Next',()=>{p.index++;p.question=null;render();},'primary'));return body;
}

function settingsScreen() {
  const body=el('div',{}),group=(title,...items)=>el('section',{class:'settings-group'},el('h2',{text:title}),card(items));
  const valueRow=(label,value,action)=>el('button',{type:'button',class:'value-row',onclick:action},el('span',{text:label}),el('span',{class:'value',text:value}));
  body.append(group('General',valueRow('App language',LANGS[store.prefs.appLanguage],()=>choiceSheet('App language','Change all menus, messages and explanations.',Object.keys(LANGS).map(value=>({value,label:LANGS[value],native:NATIVE[value]})),store.prefs.appLanguage,value=>applyPrefs({appLanguage:value}))),
    valueRow('Appearance',({light:'Light',dark:'Dark',system:'System'})[store.prefs.theme],()=>choiceSheet('Appearance','',Object.entries({system:'System',light:'Light',dark:'Dark'}).map(([value,label])=>({value,label})),store.prefs.theme,value=>applyPrefs({theme:value}))),
    el('label',{class:'value-row'},el('span',{},el('span',{text:'Haptic feedback'}),el('p',{class:'muted',text:typeof navigator.vibrate==='function'?'Small taps for navigation, saving and Undo.':'Haptic feedback is not supported by this browser.'})),el('input',{type:'checkbox',checked:store.prefs.haptics,disabled:typeof navigator.vibrate!=='function',onchange:e=>{storageAction(()=>applyPrefs({haptics:e.target.checked}));}}))));
  const key=el('input',{class:'field-input',type:'password',autocomplete:'off',placeholder:store.get('kalima_gemini_key_v1')?'Replace saved key':'Paste your key','aria-label':'Personal Gemini key'});
  const keyDetails=section('Personal Gemini key',[el('p',{class:'muted',text:'Kalima works without a key. Add your own if shared access reaches its limit.'}),key,row(button('Save key',()=>{
    if(!key.value.trim())return;try{localStorage.setItem('kalima_gemini_key_v1',key.value.trim());applyPrefs({access:'own'});notify('Personal key saved and enabled.');}catch{notify("Couldn't save your words. Free some space on the phone and try again.");}
  },'quiet'),button('Remove key',()=>{try{localStorage.removeItem('kalima_gemini_key_v1');applyPrefs({access:'shared'});notify('Personal key removed. Kalima will use shared access.');}catch{notify("Couldn't save your words. Free some space on the phone and try again.");}},'quiet')),
    store.get('kalima_gemini_key_v1')?el('label',{class:'value-row'},el('span',{text:'Use my personal key'}),el('input',{type:'checkbox',checked:store.prefs.access==='own',onchange:e=>storageAction(()=>applyPrefs({access:e.target.checked?'own':'shared'}))})):null],'key',state.sections);body.append(keyDetails,group('Your words and backups',backupActions()));
  const model=el('input',{class:'field-input',value:settings().model,'aria-label':'Gemini model'}),proxy=el('input',{class:'field-input',type:'url',value:settings().proxy,'aria-label':'Shared server address'});
  body.append(section('Advanced',[el('label',{class:'field'},el('span',{text:'Gemini model'}),model),el('label',{class:'field'},el('span',{text:'Shared server address'}),proxy),row(button('Save configuration',()=>{
    if(!/^https:\/\//i.test(proxy.value.trim())){notify('Use a secure server address starting with https://.');return;}
    try{localStorage.setItem('kalima_gemini_model_v1',model.value.trim()||'gemini-2.5-flash');localStorage.setItem('kalima_proxy_v1',proxy.value.trim());notify('Configuration saved.');}catch{notify("Couldn't save your words. Free some space on the phone and try again.");}
  },'quiet'),button('Restore defaults',()=>{try{localStorage.removeItem('kalima_gemini_model_v1');localStorage.removeItem('kalima_proxy_v1');render();notify('Default configuration restored.');}catch{notify("Couldn't save your words. Free some space on the phone and try again.");}},'quiet'))],'advanced',state.sections));
  body.append(group('About',el('p',{raw:'Kalima · '+VERSION}),button('Check for updates',()=>checkWebUpdate(true),'quiet'),button('Install on your Home Screen',installHelp,'quiet'),el('p',{class:'muted',text:"Pronunciation uses your phone's Arabic voice. New lookups need internet; saved words and practice work offline."})));
  return body;
}
function installHelp(){openSheet('Install on your Home Screen',el('p',{text:'On iPhone: open Kalima in Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if shown. On Android, use Install app in your browser menu.'}));}

$('#clear').addEventListener('click',clear);$('#save-pill').addEventListener('click',toggleSave);$('#history').addEventListener('click',()=>switchTab('history'));
$('#search-pill').addEventListener('click',()=>choiceSheet('Search','',[{value:'ar',label:'Arabic word'},{value:'rev',label:'Reverse search'}],state.searchMode,value=>{state.searchMode=value;sync();}));
$('#depth-pill').addEventListener('click',()=>choiceSheet('Search depth','Choose how much detail to request.',[{value:'fast',label:'Fast'},{value:'deep',label:'Deep'}],state.depth,value=>{state.depth=value;sync();}));
$('#language-pill').addEventListener('click',()=>choiceSheet('Extra translation','Add a translation alongside Arabic and your app language.',[...extraLanguages(store.prefs.appLanguage).map(value=>({value,label:LANGS[value],native:NATIVE[value]})),{value:'off',label:'Off'}],store.prefs.lang,value=>applyPrefs({lang:value})));
$('#search-form').addEventListener('submit',event=>{event.preventDefault();runLookup();});
query.addEventListener('input',()=>{state.query=query.value;$('#submit').disabled=!query.value.trim()||state.loading;if(state.focused&&state.tab==='lookup')render();else sync();});
query.addEventListener('focus',()=>{if(state.tab==='lookup'){state.focused=true;render();}});
query.addEventListener('blur',()=>{if(!state.focused)return;setTimeout(()=>{if(document.activeElement!==query){state.focused=false;render();}},120);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.focused){blurSearch();render();}});
history.replaceState({tab:'lookup'},'');window.addEventListener('popstate',event=>{if($('#sheet').open){closeSheet();return;}const tab=event.state?.tab||'lookup';switchTab(tab,false);});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',sync);
function viewport(){const vv=window.visualViewport;if(vv&&vv.scale===1){document.documentElement.style.setProperty('--app-height',vv.height+'px');document.documentElement.style.setProperty('--app-top',vv.offsetTop+'px');}else{document.documentElement.style.setProperty('--app-height','100dvh');document.documentElement.style.setProperty('--app-top','0px');}}
window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);viewport();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){updateOffered=false;refreshSuggestion();if(state.tab==='lookup'&&!state.result&&!state.loading&&!state.candidates&&!state.focused)render();checkWebUpdate(false);}});
window.addEventListener('pageshow',event=>{if(event.persisted){refreshSuggestion();if(state.tab==='lookup'&&!state.result)render();}});

let registration=null,updateOffered=false,updateAccepted=false,pendingUpdate=null;
$('#sheet').addEventListener('close',()=>{if(pendingUpdate){const worker=pendingUpdate;pendingUpdate=null;offerUpdate(worker);}});
async function checkWebUpdate(manual=false) {
  if(!('serviceWorker'in navigator)){if(manual)notify('Web updates are unavailable in this browser.');return;}
  try{registration=registration||await navigator.serviceWorker.getRegistration();if(!registration){if(manual)notify('Open the hosted app to check for updates.');return;}await registration.update();if(registration.waiting)offerUpdate(registration.waiting,manual);else if(manual)notify('Kalima is up to date on this device.');}catch{if(manual)notify("Couldn't check for updates. Try again when you're online.");}
}
function offerUpdate(worker,manual=false) {
  if(manual)updateOffered=false;
  if(updateOffered)return;if($('#sheet').open){pendingUpdate=worker;return;}updateOffered=true;
  const later=()=>closeSheet();openSheet('A Kalima update is available',[el('p',{text:'A new web version is ready. Your saved words and review progress will be kept.'}),row(button('Later',later,'quiet'),button('Update',()=>{updateAccepted=true;worker.postMessage({type:'ACTIVATE_UPDATE'});},'primary'))]);
}
if('serviceWorker'in navigator&&['https:','http:'].includes(location.protocol)){
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;if(reg.waiting)offerUpdate(reg.waiting);reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(worker);});});}).catch(()=>{});
  let reload=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reload&&updateAccepted){reload=true;location.reload();}});
}
sync();render();if(store.errors.includes('kalima_saved_v1'))notify("Your saved words couldn't be opened. Restore a backup if needed.");
// Stable, read-only diagnostics for browser smoke tests and support.
globalThis.KalimaApp={version:VERSION,get appLanguage(){return store.prefs.appLanguage;},get savedCount(){return store.saved.length;}};
