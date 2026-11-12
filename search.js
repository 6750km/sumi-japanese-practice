'use strict';
window.SumiSearch = (() => {
  const cache=new WeakMap();
  function normalizeReading(value){
    return [...String(value??'').normalize('NFKC').toLowerCase()]
      .map(c=>c.codePointAt(0)>=0x30a1&&c.codePointAt(0)<=0x30f6?String.fromCodePoint(c.codePointAt(0)-0x60):c).join('')
      .replace(/[’‘ʼ]/g,"'").replace(/[.\-\s]/g,'')
      .replace(/[ōô]/g,'ou').replace(/[ūû]/g,'uu').replace(/[āâ]/g,'aa').replace(/[īî]/g,'ii').replace(/[ēê]/g,'ee')
      .replace(/ou|oo/g,'ō').replace(/aa/g,'ā').replace(/ii/g,'ī').replace(/uu/g,'ū').replace(/ee/g,'ē');
  }
  function terms(query){
    return String(query??'').normalize('NFKC').replace(/small\s+tsu/gi,'small-tsu').replace(/long\s+vowel/gi,'long-vowel')
      .split(/[\s,;、，・·/]+/u).filter(Boolean)
      .flatMap(term=>/^\p{Script=Han}+$/u.test(term)?[...term]:[term]).map(normalizeReading).filter(Boolean);
  }
  function text(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е');}
  function entry(character){
    if(cache.has(character))return cache.get(character);
    let records;
    if(character.script==='kanji')records=['on','kun'].flatMap(type=>window.SumiReadings.pairs(character,type)).map(r=>({...r,aliases:new Set([normalizeReading(r.kana),normalizeReading(r.romaji)].filter(Boolean))}));
    else{
      const special=character.char==='っ'||character.char==='ッ'||character.char==='ー';
      const roman=window.SumiReadings.primary(character);
      const aliases=[character.char,roman];
      if(!special)aliases.push(character.romaji);
      if(character.char==='を'||character.char==='ヲ')aliases.push('o','wo');
      if(character.char==='ぢ'||character.char==='ヂ')aliases.push('di');
      if(character.char==='づ'||character.char==='ヅ')aliases.push('du');
      records=[{kana:character.char,romaji:roman,aliases:new Set(aliases.map(normalizeReading).filter(Boolean))}];
    }
    const aliases=new Set([normalizeReading(character.char),...records.flatMap(r=>[...r.aliases])]);
    if(character.frequency)aliases.add(String(character.frequency));
    const value={records,aliases,meaning:text([character.meaning,character.meaningEn].filter(Boolean).join(' '))};
    cache.set(character,value);return value;
  }
  function matches(character,query,mode='reading'){
    if(!String(query??'').trim())return true;
    const e=entry(character);
    if(mode==='meaning')return text(query).trim().split(/\s+/u).filter(Boolean).every(word=>e.meaning.includes(word));
    return terms(query).some(term=>e.aliases.has(term));
  }
  function matchedReadings(character,query){
    const wanted=new Set(terms(query));return [...new Set(entry(character).records.filter(r=>[...r.aliases].some(a=>wanted.has(a))).map(r=>r.romaji))];
  }
  function displayReading(character,query,mode='reading'){
    const matched=mode==='reading'&&String(query??'').trim()?matchedReadings(character,query):[];
    return matched.length?matched.join(' / '):window.SumiReadings.primary(character);
  }
  return Object.freeze({matches,matchedReadings,displayReading,normalizeReading});
})();
