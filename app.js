'use strict';
const datasets={kanji:window.KANJI_DATA,hiragana:window.KANA_DATA.hiragana,katakana:window.KANA_DATA.katakana};
const scriptNames={kanji:'Кандзи',hiragana:'Хирагана',katakana:'Катакана'};
let script='kanji',data=datasets.kanji;
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
let learned=new Set(),storageAvailable=true;
try{const saved=JSON.parse(localStorage.getItem('sumi-progress-v1')||'[]');if(Array.isArray(saved)){const valid=new Set(Object.values(datasets).flat().map(k=>k.char));learned=new Set(saved.filter(c=>valid.has(c)));}}catch{storageAvailable=false;}
let current=0,stroke=0,group='all',points=[],pointer=null,animation=null;
let libraryPage=0,sheetPage=0,sheetsOpen=false,quiz=null,quizAnswered=false,quizHeard=false;
const LIBRARY_SIZE=24,SHEET_SIZE=40;
const selections=Object.fromEntries(Object.entries(datasets).map(([key,items])=>[key,new Set(items.slice(0,1).map(k=>k.char))]));
const searchCache=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const length=ps=>ps.slice(1).reduce((s,p,i)=>s+distance(p,ps[i]),0);
function svgElement(tag,attrs){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);return el;}
function makePath(d){return svgElement('path',{d});}
function resample(ps,count=40){const cumulative=[0];for(let i=1;i<ps.length;i++)cumulative.push(cumulative[i-1]+distance(ps[i-1],ps[i]));const total=cumulative.at(-1);if(!total)return Array.from({length:count},()=>ps[0]);let j=1;return Array.from({length:count},(_,i)=>{const target=total*i/(count-1);while(j<cumulative.length-1&&cumulative[j]<target)j++;const t=(target-cumulative[j-1])/(cumulative[j]-cumulative[j-1]||1);return{x:ps[j-1].x+(ps[j].x-ps[j-1].x)*t,y:ps[j-1].y+(ps[j].y-ps[j-1].y)*t};});}
function samplePath(d){const p=makePath(d);const len=p.getTotalLength();return Array.from({length:60},(_,i)=>{const pt=p.getPointAtLength(len*i/59);return{x:pt.x,y:pt.y};});}
function compareStroke(input,expected){
 if(input.length<3||length(input)<3)return 'Проведи всю черту одним движением';
 const start=distance(input[0],expected[0]),end=distance(input.at(-1),expected.at(-1));
 const reversed=distance(input[0],expected.at(-1))+distance(input.at(-1),expected[0]);
 if(distance(expected[0],expected.at(-1))>1&&reversed<start+end)return 'Веди черту от точки в показанном направлении';
 if(start>12)return 'Начни с зелёной точки — порядок черт важен';
 if(end>13)return 'Доведи черту до конца подсказки';
 const ratio=length(input)/length(expected);
 if(ratio<.6||ratio>1.85)return 'Попробуй провести черту плавнее, вдоль контура';
 const a=resample(input),b=resample(expected);
 // Dynamic time warping allows natural changes of drawing speed while preserving direction.
 const dp=Array.from({length:41},()=>Array(41).fill(Infinity));dp[0][0]=0;
 for(let i=1;i<=40;i++)for(let j=1;j<=40;j++)dp[i][j]=distance(a[i-1],b[j-1])+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
 if(dp[40][40]/40>8)return 'Держись ближе к контуру. Можно попробовать ещё раз';
 return null;
}
function feedback(text,type=''){ $('feedback').textContent=text;$('feedback').className='feedback '+type; }
function updateProgress(){const n=data.filter(k=>learned.has(k.char)).length;$('dailyProgress').textContent=`${n} из ${data.length} изучено`;$('collectionCount').textContent=data.length;}
function normalized(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[.・]/g,'');}
function searchText(k){if(!searchCache.has(k))searchCache.set(k,normalized([k.char,k.meaning,k.meaningEn,k.on,k.kun,k.onRomaji,k.kunRomaji,k.romaji,SumiReadings.primary(k),k.frequency].join(' ')));return searchCache.get(k);}
function matchesSearch(k,query){return query.trim().split(/\s+/).filter(Boolean).every(term=>searchText(k).includes(normalized(term)));}
function libraryEntries(){const progress=$('progressFilter').value;return data.map((k,i)=>({k,i})).filter(({k})=>(group==='all'||k.group===group)&&(progress==='all'||(progress==='done')===learned.has(k.char))&&matchesSearch(k,$('librarySearch').value));}
function paginate(entries,page,size){const pages=Math.max(1,Math.ceil(entries.length/size));const safe=Math.max(0,Math.min(page,pages-1));return{items:entries.slice(safe*size,(safe+1)*size),page:safe,pages};}
function renderLibrary(){
 const entries=libraryEntries(),view=paginate(entries,libraryPage,LIBRARY_SIZE);libraryPage=view.page;
 $('kanjiGrid').replaceChildren(...view.items.map(({k,i})=>{const b=document.createElement('button');b.className='kanji-button'+(i===current?' selected':'')+(learned.has(k.char)?' done':'');const glyph=document.createElement('span');glyph.className='tile-char';glyph.lang='ja';glyph.textContent=k.char;const roman=document.createElement('small');roman.className='tile-romaji';roman.lang='en';roman.textContent=SumiReadings.primary(k);b.append(glyph,roman);b.title=`${k.char} — ${SumiReadings.summary(k)} — ${k.meaning}`;b.setAttribute('aria-label',`${k.char} — ${SumiReadings.summary(k)} — ${k.meaning}${learned.has(k.char)?', изучено':''}`);b.setAttribute('aria-pressed',String(i===current));b.onclick=()=>{selectKanji(i);if(matchMedia('(max-width:820px)').matches)$('board').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};return b;}));
 $('libraryResult').textContent=entries.length?`Найдено: ${entries.length}`:'Ничего не найдено. Попробуй другой запрос.';
 $('libraryPage').textContent=`${view.page+1} / ${view.pages}`;$('libraryPrev').disabled=view.page===0;$('libraryNext').disabled=view.page===view.pages-1;
}
function cancelAnimation(){if(animation){animation.cancel();animation=null;}}
function clearPointer(){if(pointer!==null&&$('board').hasPointerCapture(pointer))$('board').releasePointerCapture(pointer);pointer=null;points=[];$('ink').setAttribute('d','');}
function renderReadingPairs(target,items){target.replaceChildren(...items.map(item=>{const row=document.createElement('span');row.className='reading-pair';const kana=document.createElement('span');kana.lang='ja';kana.textContent=item.kana;const latin=document.createElement('span');latin.lang='en';latin.className='reading-latin';latin.textContent=item.romaji;row.append(kana,latin);return row;}));if(!items.length)target.textContent='—';}
function selectKanji(i){
 if(!data[i])return;window.SumiAudio.cancel();cancelAnimation();clearPointer();current=i;stroke=0;renderLibrary();renderBoard();const k=data[current];
 $('bigChar').textContent=k.char;$('currentRomaji').textContent=SumiReadings.summary(k);$('readingHelp').hidden=script!=='kanji';$('meaning').textContent=k.meaning;$('meaningEn').textContent=k.meaningEn||'';$('meaningEn').hidden=!k.meaningEn;
 const n=k.paths.length;$('groupTag').textContent=`${k.frequency?'Частотность №'+k.frequency:k.group} · ${n} ${n%10===1&&n%100!==11?'черта':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'черты':'черт'}`;
 $('detailLabel').textContent=script==='kanji'?'ЗНАКОМЬСЯ С КАНДЗИ':'ЗНАКОМЬСЯ СО ЗНАКОМ';
 $('onLabel').textContent=script==='kanji'?'ОНЪЁМИ':'КАК ЧИТАЕТСЯ';$('kunLabel').textContent=script==='kanji'?'КУНЪЁМИ':'ПАРА В АЗБУКЕ';
 renderReadingPairs($('onReading'),script==='kanji'?SumiReadings.pairs(k,'on'):[{kana:k.char,romaji:SumiReadings.primary(k)}]);
 const cp=k.char.codePointAt(0);const pair=script==='hiragana'&&cp>=0x3041&&cp<=0x3096?String.fromCodePoint(cp+0x60):script==='katakana'&&cp>=0x30a1&&cp<=0x30f6?String.fromCodePoint(cp-0x60):'—';
 renderReadingPairs($('kunReading'),script==='kanji'?SumiReadings.pairs(k,'kun'):pair==='—'?[]:[{kana:pair,romaji:SumiReadings.primary(k)}]);
 $('position').textContent=`${String(i+1).padStart(2,'0')} / ${data.length}`;
 $('listen').textContent='▶ Прослушать';$('audioCard').hidden=script==='kanji';$('audioNote').textContent=k.audioNote||'Слушай японский слог и повторяй вслух.';updateAudioStatus();
 feedback('Начни с зелёной точки и веди по линии');
}
function renderBoard(){
 cancelAnimation();const k=data[current];$('ghost').replaceChildren(...k.paths.map(makePath));$('ghost').style.visibility=$('outline').checked?'visible':'hidden';$('accepted').replaceChildren(...k.paths.slice(0,stroke).map(makePath));$('hint').replaceChildren();$('startMarker').replaceChildren();$('ink').setAttribute('d','');
 if(stroke<k.paths.length){$('hint').append(makePath(k.paths[stroke]));const p=samplePath(k.paths[stroke])[0];$('startMarker').append(svgElement('circle',{cx:p.x,cy:p.y,r:3.5,class:'start-dot'}));const text=svgElement('text',{x:p.x,y:p.y+1.2,'text-anchor':'middle',class:'start-number'});text.textContent=stroke+1;$('startMarker').append(text);}
 $('strokeDots').replaceChildren(...k.paths.map((_,i)=>{const dot=document.createElement('span');dot.className='stroke-dot'+(i<stroke?' complete':i===stroke?' current':'');return dot;}));
 const complete=stroke===k.paths.length;$('strokeCount').textContent=complete?`Готово: ${stroke} из ${k.paths.length}`:`Черта ${stroke+1} из ${k.paths.length}`;$('next').disabled=!complete;$('showHint').disabled=complete;
}
function localPoint(event){const r=$('board').getBoundingClientRect();return{x:(event.clientX-r.left)/r.width*109,y:(event.clientY-r.top)/r.height*109};}
function appendPoints(event){const events=event.getCoalescedEvents?.()||[];for(const e of events.length?events:[event]){const p=localPoint(e);if(!points.length||distance(points.at(-1),p)>.25)points.push(p);} $('ink').setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '));}
$('board').addEventListener('pointerdown',e=>{if(pointer!==null||stroke>=data[current].paths.length||e.button!==0)return;e.preventDefault();cancelAnimation();const hint=$('hint').querySelector('path');if(hint){hint.style.strokeDasharray='';hint.style.strokeDashoffset='';}pointer=e.pointerId;points=[];$('board').setPointerCapture(pointer);appendPoints(e);});
$('board').addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();appendPoints(e);}});
$('board').addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;appendPoints(e);const drawn=points.slice();clearPointer();const error=compareStroke(drawn,samplePath(data[current].paths[stroke]));if(error){feedback(error,'error');return;}stroke++;renderBoard();if(stroke===data[current].paths.length){learned.add(data[current].char);try{localStorage.setItem('sumi-progress-v1',JSON.stringify([...learned]));}catch{storageAvailable=false;}updateProgress();renderLibrary();feedback(storageAvailable?'Отлично! Знак получился. Давай следующий?':'Отлично! Знак получился. Браузер не разрешил сохранить прогресс.','success');}else feedback('Получилось! Теперь следующая черта','success');});
$('board').addEventListener('pointercancel',clearPointer);$('board').addEventListener('lostpointercapture',()=>{if(pointer!==null)clearPointer();});
$('restart').onclick=()=>selectKanji(current);
$('next').onclick=()=>{const candidates=libraryEntries().map(x=>x.i);if(candidates.length)selectKanji(candidates[(candidates.indexOf(current)+1)%candidates.length]);};
$('outline').onchange=()=>$('ghost').style.visibility=$('outline').checked?'visible':'hidden';
$('showHint').onclick=()=>{if(stroke>=data[current].paths.length)return;clearPointer();cancelAnimation();const p=$('hint').querySelector('path'),len=p.getTotalLength();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)animation=p.animate([{strokeDasharray:`${len} ${len}`,strokeDashoffset:len},{strokeDasharray:`${len} ${len}`,strokeDashoffset:0}],{duration:1100,iterations:2,easing:'ease-in-out'});feedback('Следуй от точки к концу линии одним движением');};
function populateGroups(){
 $('groupFilter').replaceChildren();const all=new Option('Все группы','all');$('groupFilter').add(all);
 for(const name of new Set(data.map(k=>k.group)))$('groupFilter').add(new Option(name,name));
 $('groupFilter').value=group;
}
function setTab(sheets){sheetsOpen=sheets;$('practicePanel').hidden=sheets;$('sheetsPanel').hidden=!sheets;$('listeningPanel').hidden=sheets||script==='kanji';$('practiceTab').classList.toggle('active',!sheets);$('sheetsTab').classList.toggle('active',sheets);$('practiceTab').setAttribute('aria-pressed',String(!sheets));$('sheetsTab').setAttribute('aria-pressed',String(sheets));clearPointer();SumiAudio.cancel();}
$('brandHome').onclick=event=>{event.preventDefault();switchScript('kanji');setTab(false);};
$('practiceTab').onclick=()=>setTab(false);$('sheetsTab').onclick=()=>setTab(true);
function switchScript(nextScript){
 if(!datasets[nextScript])return;clearPointer();cancelAnimation();SumiAudio.cancel();script=nextScript;data=datasets[script];group=script==='kanji'?'all':'Основные';libraryPage=0;sheetPage=0;
 $('librarySearch').value='';$('sheetSearch').value='';$('progressFilter').value='all';
 document.querySelectorAll('.script-button').forEach(b=>{const active=b.dataset.script===script;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $('scriptDescription').textContent=script==='kanji'?'1000 частотных кандзи по KANJIDIC2 · газетный корпус Mainichi Shimbun':`${scriptNames[script]} · 46 основных знаков, озвончённые и малые формы · письмо и звучание`;
 $('libraryTitle').textContent=script==='kanji'?'Выбери кандзи':'Выбери знак';$('librarySearch').placeholder=script==='kanji'?'日, nichi, день…':script==='hiragana'?'あ, shi, слог…':'ア, shi, слог…';
 populateGroups();updateProgress();renderSheetChoices();selectKanji(0);setTab(sheetsOpen);if(script!=='kanji')newQuiz();
}
for(const b of document.querySelectorAll('.script-button'))b.onclick=()=>switchScript(b.dataset.script);
$('librarySearch').oninput=()=>{libraryPage=0;renderLibrary();};$('groupFilter').onchange=()=>{group=$('groupFilter').value;libraryPage=0;renderLibrary();};$('progressFilter').onchange=()=>{libraryPage=0;renderLibrary();};
$('libraryPrev').onclick=()=>{libraryPage--;renderLibrary();};$('libraryNext').onclick=()=>{libraryPage++;renderLibrary();};
function sheetEntries(){return data.filter(k=>matchesSearch(k,$('sheetSearch').value));}
function pageWord(count){return count%10===1&&count%100!==11?'страница':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'страницы':'страниц';}
function renderSheetChoices(){
 const selected=selections[script],view=paginate(sheetEntries(),sheetPage,SHEET_SIZE);sheetPage=view.page;
 $('sheetChoices').replaceChildren(...view.items.map(k=>{const b=document.createElement('button');b.className='sheet-choice';b.setAttribute('aria-pressed',String(selected.has(k.char)));b.setAttribute('aria-label',`${k.char} — ${k.meaning}`);const c=document.createElement('span');c.lang='ja';c.textContent=k.char;const reading=document.createElement('strong');reading.className='choice-reading';reading.lang='en';reading.textContent=SumiReadings.primary(k);const text=document.createElement('small');text.textContent=k.meaning;b.append(c,reading,text);b.onclick=()=>{if(selected.has(k.char))selected.delete(k.char);else selected.add(k.char);renderSheetChoices();};return b;}));
 $('selectedSheetChips').replaceChildren(...data.filter(k=>selected.has(k.char)).map(k=>{const b=document.createElement('button');b.textContent=`${k.char} ×`;b.setAttribute('aria-label',`Убрать ${k.char} из прописей`);b.onclick=()=>{selected.delete(k.char);renderSheetChoices();};return b;}));
 $('sheetPage').textContent=`${view.page+1} / ${view.pages}`;$('sheetPrev').disabled=view.page===0;$('sheetNext').disabled=view.page===view.pages-1;
 $('sheetCount').textContent=`Выбрано: ${selected.size} · ${selected.size} ${pageWord(selected.size)} A4`;$('downloadSheet').disabled=selected.size===0;
}
$('sheetSearch').oninput=()=>{sheetPage=0;renderSheetChoices();};$('sheetPrev').onclick=()=>{sheetPage--;renderSheetChoices();};$('sheetNext').onclick=()=>{sheetPage++;renderSheetChoices();};
$('sheetSelectVisible').onclick=()=>{const view=paginate(sheetEntries(),sheetPage,SHEET_SIZE);view.items.forEach(k=>selections[script].add(k.char));renderSheetChoices();};$('sheetClear').onclick=()=>{selections[script].clear();renderSheetChoices();};
function worksheetSvg(k,mode){return SumiWorksheets.svg(k,mode);}
function worksheetHTML(characters){return SumiWorksheets.html(characters);}
function downloadWorksheet(characters){SumiWorksheets.download(characters);}
$('currentSheet').onclick=()=>downloadWorksheet([data[current]]);$('downloadSheet').onclick=()=>downloadWorksheet(data.filter(k=>selections[script].has(k.char)));
function updateAudioStatus(){
 const state=SumiAudio.status(),k=data[current],select=$('voiceChoice');
 const signature=state.voices.map(v=>v.id).join('\n');
 if(select.dataset.signature!==signature){select.replaceChildren(new Option('Автоматически',''),...state.voices.map(v=>new Option(v.name+(v.local?'':' · онлайн'),v.id)));select.dataset.signature=signature;}
 select.value=state.selected;select.disabled=!state.ready;
 $('voiceStatus').textContent=state.message;$('listen').disabled=script==='kanji'||!state.ready||!k?.speech;$('quizPlay').disabled=!state.ready;
}
SumiAudio.subscribe(updateAudioStatus);
$('voiceChoice').onchange=()=>{SumiAudio.setVoice($('voiceChoice').value);$('listen').textContent='▶ Прослушать';};
$('listen').onclick=()=>{const k=data[current];SumiAudio.speak(k.speech,{rate:Number($('speechRate').value),onStart:()=>{$('listen').textContent='◼ Звучит…';$('voiceStatus').textContent=`Слушай: ${k.romaji}`;},onEnd:()=>{$('listen').textContent='↻ Ещё раз';$('voiceStatus').textContent=`Слог ${k.romaji}. Если ты его не слышишь, выбери другой голос выше.`;},onError:message=>{$('listen').textContent='▶ Повторить';$('voiceStatus').textContent=message;}});};
function shuffled(items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function newQuiz(){
 SumiAudio.cancel();const entries=data.filter(k=>k.group==='Основные'&&k.speech);if(!entries.length)return;
 quiz=entries[Math.floor(Math.random()*entries.length)];quizAnswered=false;quizHeard=false;
 const alternatives=shuffled(entries.filter(k=>k.romaji!==quiz.romaji)).slice(0,3);$('quizChoices').replaceChildren(...shuffled([quiz,...alternatives]).map(k=>{const b=document.createElement('button');b.lang='ja';b.textContent=k.char;b.disabled=true;b.setAttribute('aria-label',`Знак ${k.char}`);b.onclick=()=>{if(quizAnswered||!quizHeard)return;if(k.char===quiz.char){quizAnswered=true;b.classList.add('correct');$('quizFeedback').textContent=`Верно! ${quiz.char} — ${quiz.romaji}.`;for(const other of $('quizChoices').children)other.disabled=true;}else{b.classList.add('incorrect');b.disabled=true;$('quizFeedback').textContent='Попробуй ещё раз. Можно прослушать слог повторно.';}};return b;}));
 $('quizFeedback').textContent='Нажми «Слушать слог», затем выбери знак.';updateAudioStatus();
}
$('quizPlay').onclick=()=>{if(!quiz)return;SumiAudio.speak(quiz.speech,{rate:Number($('speechRate').value),onStart:()=>{quizHeard=true;$('quizFeedback').textContent='Какой знак ты услышала?';if(!quizAnswered)for(const b of $('quizChoices').children)if(!b.classList.contains('incorrect'))b.disabled=false;},onError:message=>{$('quizFeedback').textContent=message;}});};$('quizNext').onclick=newQuiz;
window.addEventListener('pagehide',()=>SumiAudio.cancel());
populateGroups();updateProgress();renderSheetChoices();selectKanji(0);
