'use strict';
window.SumiReadings = (() => {
  const split = value => String(value || '').split('・').filter(Boolean);
  function pairs(character,type){const latin=split(character[type+'Romaji']);return split(character[type]).map((kana,index)=>({kana,romaji:latin[index]||''}));}
  function all(character){return [...new Set(['on','kun'].flatMap(type=>pairs(character,type).map(r=>r.romaji)).filter(Boolean))];}
  function primary(character){
    if(character.script==='kanji')return all(character)[0]||'—';
    if(character.char==='っ'||character.char==='ッ')return 'small tsu';
    if(character.char==='ー')return 'long vowel';
    if(character.char==='を'||character.char==='ヲ')return 'o (wo)';
    return character.romaji||'—';
  }
  function summary(character){if(character.script!=='kanji')return primary(character);const readings=all(character);return readings.slice(0,3).join(' · ')+(readings.length>3?' …':'');}
  return Object.freeze({pairs,all,primary,summary});
})();
