import {list} from './core.mjs';
const pending=new Map();
export async function loadCorpus(name) {
  if(!pending.has(name))pending.set(name,fetch(name+'-data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    const units=name==='quran'?data.verses:data.p.map(x=>x[2]);
    const index=globalThis.KalimaSearch.buildIndex(units,name==='quran'?globalThis.KalimaSearch.quranVariants:globalThis.KalimaSearch.standardVariants);
    const cumulative=[];let sum=0;for(const n of data.counts||[]){cumulative.push(sum);sum+=n;}
    return {name,data,units,index,cumulative};
  }).catch(e=>{pending.delete(name);throw e;}));
  return pending.get(name);
}
export function corpusMatches(c,d) {
  const verb=d.verb,conjs=list(verb?.conjugation),verbForms=conjs.flatMap(x=>[x?.past,x?.present]).concat(verb?.dictionaryForm||'',verb?.presentForm||'').filter(Boolean);
  const forms=list(d.forms).concat(verb?.masdar||'',verb?'':d.word).filter(Boolean);
  return globalThis.KalimaSearch.rank(globalThis.KalimaSearch.findMatches(c.index,forms,[d.word],verbForms,!!verb),c.index);
}
export function corpusReference(c,index) {
  if(c.name==='quran'){let surah=0;while(surah+1<c.cumulative.length&&c.cumulative[surah+1]<=index)surah++;return {key:'',number:`${surah+1}:${index-c.cumulative[surah]+1}`};}
  const entry=c.data.p[index];return {key:({S:'Sermon',L:'Letter',H:'Wisdom'})[entry[0]]||['Sermon','Letter','Wisdom'][entry[0]]||c.data.kinds[entry[0]],number:String(entry[1])};
}
