// Literal port of Android 0.9 Prompts.kt. English canonical storage is unchanged.
const DESC={en:'English',ar:'fully vocalized Modern Standard Arabic',ur:'natural Urdu in Urdu script',fa:'natural Iranian Persian in Persian script',tr:'standard Turkish',ru:'standard Russian',fr:'standard French'};
const ORDER='0 هُوَ, 1 هُمَا (masc. dual), 2 هُمْ, 3 هِيَ, 4 هُمَا (fem. dual), 5 هُنَّ, 6 أَنْتَ, 7 أَنْتُمَا (masc.), 8 أَنْتُمْ, 9 أَنْتِ, 10 أَنْتُمَا (fem.), 11 أَنْتُنَّ, 12 أَنَا, 13 نَحْنُ';
const SHAPE='{"root":"root meaning","meaning":"meaning","partOfSpeech":"localized part of speech","grammarNote":"localized grammar note or empty","waznNote":"localized pattern explanation or empty","note":"localized usage note or empty","inputPerson":"localized person description or empty","examples":["translated example"],"synonyms":["translated gloss"],"antonyms":["translated gloss"]}';
export function lookupPrompt(word,app,extra,mode){
  const requested=[...new Set([app,extra])].filter(x=>!['en','off'].includes(x)),translations=requested.map(x=>JSON.stringify(x)+':'+SHAPE).join(',');
  return `You are an expert Arabic teacher. Analyze this Arabic word: ${word}.
Return ONLY JSON. Keep these machine keys exactly; canonical English fields are for storage, not the interface:
{"word":"fully vocalized Arabic","transliteration":"Latin transliteration","partOfSpeech":"verb | noun | adjective | adverb | preposition | particle | pronoun | other","grammarNote":"English gender/plural note or empty","root":["ك","ت","ب"],"rootGloss":"English root idea","wazn":{"pattern":"ف ع ل morphological pattern","note":"English pattern description"},"meaning":{"en":"English meaning","ar":"simple Arabic definition"},"examples":[{"ar":"Arabic sentence","en":"English translation"},{"ar":"Arabic sentence","en":"English translation"}],
"forms": ${mode==='fast'?'[]':'["related Arabic forms without attached particles or pronouns"]'},
"synonyms": ${mode==='fast'?'[]':'[{"ar":"Arabic","en":"English gloss"}]'},
"antonyms": ${mode==='fast'?'[]':'[{"ar":"Arabic","en":"English gloss"}]'},
"verb":null,"note":"English ambiguity/usage note or empty","trans":{${translations}}}
Fully vocalize ALL Arabic, including examples and definitions. Give an accurate wazn for every inflected word; use an empty pattern only for words without a pattern. Root has 3 letters or 4 for quadriliterals; particles/loanwords may have [].
For trans: ${requested.map(x=>x+' = '+DESC[x]).join('; ')}. Every trans object must translate the SAME sense, root idea, metadata, examples, synonyms and antonyms in the exact same order as canonical fields. Arrays must have identical lengths. Include all metadata keys, even when empty. No English explanations inside these objects except unavoidable proper names.
${mode==='fast'?'FAST MODE: forms, synonyms, antonyms must be []; verb must be null; grammarNote and note must be empty. Keep short.':`DEEP MODE: give up to 25 useful related forms, 3–5 synonyms and 0–3 real antonyms. For a verb in ANY tense/person, set verb to {"form":"I–X or Quadriliteral","pattern":"past and present pattern","dictionaryForm":"past he","presentForm":"present he","masdar":"verbal noun","masdarWazn":"pattern","inputTense":"past | present | subjunctive | jussive | imperative | passivePast | passivePresent","inputPerson":"English person description","inputMatch":{"index":0,"tense":"past"},"conjugation":[]}. inputMatch uses the 14-pronoun order ${ORDER}. Do not generate conjugations here. For nonverbs keep verb null.`}
If meaningless return {"error":"invalid input"}. Analyze only the first word if several are given.`;
}
export const reversePrompt=(word,app,extra)=>`A learner typed: ${word}. It may be in any language. Give 3 to 5 natural Modern Standard Arabic equivalents, most common first. For verbs use the past he-form. Fully vocalize Arabic. Do not invent words.
Return ONLY JSON: {"results":[{"ar":"vocalized Arabic","transliteration":"Latin transliteration","partOfSpeech":"verb | noun | adjective | other","en":"English meaning","main":"meaning in ${DESC[app]}","tx":"meaning in ${DESC[extra]||'English'}"}]}. If meaningless return {"error":"invalid input"}.`;
export function rootsPrompt(d,app,extra){
  const fields=['"ar":"fully vocalized Arabic word"','"partOfSpeech":"verb | noun | adjective | other"','"wazn":"Arabic morphological pattern"','"en":"short English gloss"'];
  if(app!=='en')fields.push('"main":"short meaning in '+DESC[app]+'"');if(!['off','en'].includes(extra))fields.push('"tx":"short meaning in '+DESC[extra]+'"');
  return `Arabic root: ${(d.root||[]).join(' ')}. Exclude this word: ${d.word}.
List 8 to 12 attested, common Modern Standard Arabic words from this root. Give fewer if necessary; never invent a word. Fully vocalize each Arabic word. Use short dictionary glosses, not sentences. English is canonical storage; also supply every requested localized meaning.
Return exactly one complete JSON object with this schema: {"words":[{${fields.join(',')}}]}.
Keep these machine keys exactly. Use double-quoted JSON strings, no Markdown, commentary or trailing commas. Every entry must contain all requested keys. Return {"words":[]} only if there are no suitable words.`;
}
export const conjugationPrompt=verb=>[
  'You are an expert Arabic teacher. Provide the full 14-pronoun conjugation for the Arabic verb: '+verb,'','Reply with ONLY one JSON object in exactly this shape:','{',
  '  "conjugation": [ { "past": "...", "present": "...", "subjunctive": "...", "jussive": "...", "imperative": "...", "passivePast": "...", "passivePresent": "..." } ]','}','','Rules:',
  '- The array must contain exactly 14 items in this order: '+ORDER+'.','- Give the verb only, without the pronoun.',
  '- "passivePast" and "passivePresent": the passive voice. If the verb is intransitive and doesn\'t take a passive, use "" for all items.',
  '- "imperative": only fill it for 2nd person (indices 6-11); use "" for others.',
  '- Fully vocalize (tashkeel) all Arabic text. Take extra care with hollow, defective, doubled and hamzated verbs.'
].join('\n');
export function translationPrompt(d,language){
  const numbered=a=>(a||[]).map((x,i)=>(i+1)+'. '+x).join('\n');
  return `Translate all explanatory content into ${DESC[language]}. Arabic word: ${d.word}.
Return ONLY JSON shaped like ${SHAPE}.
Use exactly ${(d.examples||[]).length} examples, ${(d.synonyms||[]).length} synonyms and ${(d.antonyms||[]).length} antonyms in the original order. Natural translations, not transliteration. Include every metadata key even if empty. Fully vocalize Arabic. Do not add examples or change the sense.
root: ${d.rootGloss||''}
meaning: ${d.meaning?.en||''}
partOfSpeech: ${d.partOfSpeech||''}
grammarNote: ${d.grammarNote||''}
waznNote: ${d.wazn?.note||''}
note: ${d.note||''}
inputPerson: ${d.verb?.inputPerson||''}
examples:
${numbered((d.examples||[]).map(x=>x.en))}
synonyms:
${numbered((d.synonyms||[]).map(x=>x.ar+' = '+x.en))}
antonyms:
${numbered((d.antonyms||[]).map(x=>x.ar+' = '+x.en))}`;
}
