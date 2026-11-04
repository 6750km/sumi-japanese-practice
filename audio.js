'use strict';
window.SumiAudio = (() => {
  const synth = window.speechSynthesis;
  const supported = Boolean(synth && window.SpeechSynthesisUtterance);
  const listeners = new Set();
  let voices = [], active = null, timer = null, selected = '';
  try { selected = localStorage.getItem('sumi-voice-v1') || ''; } catch {}
  const key = v => `${v.voiceURI}|${v.name}|${v.lang}`;
  const chosen = () => voices.find(v => key(v) === selected) || null;
  function status() {
    const voice = chosen();
    return { supported, ready: voices.length > 0, local: voice ? voice.localService : voices.every(v => v.localService),
      name: voice?.name || 'Автоматически', selected: voice ? selected : '',
      voices: voices.map(v => ({id:key(v), name:v.name, local:v.localService})),
      message: !supported ? 'Этот браузер не поддерживает озвучку.' : !voices.length ? 'Японский голос загружается или недоступен. Добавь японский голос в настройках речи устройства и обнови страницу.' : voice ? `Голос: ${voice.name}${voice.localService ? '' : ' · нужен интернет'}` : 'Японский голос выберет браузер. Если тихо, попробуй другой голос в списке.' };
  }
  function emit() { listeners.forEach(fn => fn(status())); }
  function refresh() {
    if (!supported) return;
    try { voices = synth.getVoices().filter(v => /^ja(?:[-_]|$)/i.test(v.lang)); } catch { voices = []; }
    emit();
  }
  function cancel() {
    clearTimeout(timer); timer = null;
    const wasActive = active !== null; active = null;
    if (supported && (wasActive || synth.speaking || synth.pending)) synth.cancel();
  }
  function setVoice(id) {
    cancel(); selected = voices.some(v => key(v) === id) ? id : '';
    try { localStorage.setItem('sumi-voice-v1', selected); } catch {}
    emit();
  }
  function speak(text, {rate=.9,onStart,onEnd,onError}={}) {
    refresh();
    if (!text || !voices.length) { onError?.(text ? status().message : 'У этого знака нет самостоятельного звука.'); return false; }
    cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    active = utterance;
    utterance.lang = 'ja-JP';
    // Let Chrome/iOS select the language voice by default. A named voice is opt-in.
    const voice = chosen(); if (voice) utterance.voice = voice;
    utterance.volume = 1; utterance.pitch = 1;
    utterance.rate = Math.max(.6,Math.min(1.2,Number(rate)||.9));
    utterance.onstart = () => { if(active===utterance){clearTimeout(timer);onStart?.();} };
    utterance.onend = () => { if(active===utterance){clearTimeout(timer);active=null;onEnd?.();} };
    utterance.onerror = event => { if(active===utterance){clearTimeout(timer);active=null;onError?.(event.error==='not-allowed'?'Браузер заблокировал звук. Нажми кнопку ещё раз.':'Этот голос не смог произнести слог. Выбери другой японский голос в списке.');} };
    timer = setTimeout(()=>{if(active===utterance){cancel();onError?.('Голос не начал звучать. Попробуй другой голос в списке; проверь громкость и устройство вывода.');}},6000);
    try {
      // A cancelled queue can remain paused in Chrome; resume in the same user gesture.
      if(synth.paused)synth.resume();
      synth.speak(utterance);
      if(synth.paused)synth.resume();
      return true;
    } catch { cancel();onError?.('Не удалось запустить звук. Попробуй другой голос.');return false; }
  }
  if(supported){synth.addEventListener('voiceschanged',refresh);refresh();}
  return {status,speak,cancel,refresh,setVoice,subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);}};
})();
