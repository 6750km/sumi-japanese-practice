'use strict';

// One selected character always produces one full A4 practice page.
window.SumiWorksheets = (() => {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function startPoint(pathData) {
    if (typeof samplePath === 'function') return samplePath(pathData)[0];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    return path.getPointAtLength(0);
  }

  function svg(character, mode = 'model') {
    const paths = Array.isArray(character.paths) ? character.paths : [];
    const outlines = mode === 'empty' ? '' : paths.map(path => `<path d="${escapeHTML(path)}"/>`).join('');
    const numbers = mode === 'model' ? paths.map((path, index) => {
      const point = startPoint(path);
      return `<text x="${Math.max(4, point.x - 4)}" y="${Math.max(6, point.y - 4)}">${index + 1}</text>`;
    }).join('') : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109" aria-hidden="true"><path d="M54.5 0V109M0 54.5H109M0 0L109 109M109 0L0 109" fill="none" stroke="#d7d7d7" stroke-width=".55" stroke-dasharray="2 2"/><g fill="none" stroke="${mode === 'model' ? '#222' : '#bdbdbd'}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${outlines}</g><g font-family="Arial,sans-serif" font-size="6" fill="#444">${numbers}</g></svg>`;
  }

  function shortText(value, limit = 90) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
  }

  function shortReadings(value) {
    const readings = (Array.isArray(value) ? value : String(value ?? '').split(/[・,;\s]+/)).filter(Boolean);
    const selection = readings.slice(0, 4).join('・');
    return shortText(selection + (readings.length > 4 ? '…' : ''), 54);
  }

  function describe(character) {
    if (character.romaji) return `Звучание: ${shortText(character.romaji, 54)}`;
    return [character.on ? `Он: ${shortReadings(character.on)}` : '', character.kun ? `Кун: ${shortReadings(character.kun)}` : ''].filter(Boolean).join(' · ');
  }

  function pageWord(count) {
    const lastTwo = count % 100, last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'страниц';
    return last === 1 ? 'страница' : last >= 2 && last <= 4 ? 'страницы' : 'страниц';
  }

  function attribution(character) {
    const strokes = 'Контуры и производные контуры: KanjiVG © Ulrich Apel · CC BY-SA 3.0 · https://kanjivg.tagaini.net';
    const license = 'https://creativecommons.org/licenses/by-sa/3.0/';
    if (character.script === 'hiragana' || character.script === 'katakana') return `${strokes}<br>${license}`;
    return `${strokes}<br>Чтения и значения: EDRDG / KANJIDIC2. Переводы и комбинированные прописи: CC BY-SA 4.0<br>Лицензии: ${license} · https://creativecommons.org/licenses/by-sa/4.0/`;
  }

  function scriptName(character) {
    const names = { kanji: 'Кандзи', hiragana: 'Хирагана', katakana: 'Катакана' };
    return names[character.script] || 'Кандзи';
  }

  function page(character, index, count) {
    // Three model cells, ten tracing cells and 59 independent practice cells.
    const modes = Array.from({ length: 72 }, (_, cell) => {
      if (cell === 0 || cell === 8 || cell === 16) return 'model';
      if (cell < 8 || (cell > 8 && cell < 12)) return 'trace';
      return 'empty';
    });
    const cells = modes.map(mode => `<div class="cell ${mode}">${svg(character, mode)}</div>`).join('');
    const primaryMeaning = shortText(String(character.meaning ?? '').split(/[;,，；]/)[0], 90);
    const title = [character.char, primaryMeaning].filter(Boolean).join(' — ');
    return `<section class="paper" aria-label="${escapeHTML(title)}"><header><div class="character-heading"><div class="eyebrow">СУМИ / ${escapeHTML(scriptName(character))}</div><h1>${escapeHTML(title)}</h1><p class="readings">${escapeHTML(describe(character))} <span>· Черт: ${Array.isArray(character.paths) ? character.paths.length : 0}</span></p></div><div class="name">Имя: __________________<br>Дата: __________________</div></header><p class="instruction">Следуй порядку черт в образце, обведи бледные знаки и продолжи самостоятельно.<br>Один знак — целая страница практики. Не спеши: сначала форма, потом скорость.</p><div class="cells">${cells}</div><div class="legend">Тёмный знак — образец с порядком черт · Бледный — обводка · Пустая клетка — самостоятельное письмо</div><footer><span>${attribution(character)}</span><span class="page-number">${index + 1} / ${count}</span></footer></section>`;
  }

  function html(characters) {
    const entries = Array.from(characters || []);
    if (!entries.length) throw new Error('Выбери хотя бы один знак для прописей.');
    const pages = entries.map((character, index) => page(character, index, entries.length)).join('');
    const count = entries.length;
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Суми — прописи, страниц: ${count}</title><style>
@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#e9ece5}.toolbar{padding:17px 20px;text-align:center;background:#e2ead8;font-size:12px;line-height:1.7}.toolbar button{display:block;margin:0 auto 9px;padding:12px 24px;background:#466638;color:#fff;border:0;border-radius:7px;font-size:15px;cursor:pointer}.paper{width:210mm;min-height:297mm;margin:20px auto;padding:14mm;background:#fff;break-after:page;page-break-after:always}.paper:last-child{break-after:auto;page-break-after:auto}header{display:flex;justify-content:space-between;align-items:flex-start;gap:7mm;border-bottom:1px solid #555;padding-bottom:3mm;height:30mm}.character-heading{flex:1;min-width:0}.eyebrow{font-size:8px;letter-spacing:1.3px;color:#555;margin-bottom:1.5mm}h1{font-size:20px;font-weight:500;line-height:1.25;margin:0 0 2mm;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.readings{font-size:9px;line-height:1.4;margin:0;max-width:130mm;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.name{font-size:9px;line-height:2;white-space:nowrap;padding-top:1mm}.instruction{font-size:10px;line-height:1.6;margin:3mm 0}.cells{width:176mm;margin:0 auto;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));border-top:1px solid #888;border-left:1px solid #888}.cell{aspect-ratio:1;border-right:1px solid #888;border-bottom:1px solid #888;min-width:0;break-inside:avoid;page-break-inside:avoid}.cell svg{display:block;width:100%;height:100%}.legend{font-size:8px;line-height:1.6;color:#555;margin-top:2mm}footer{display:flex;justify-content:space-between;align-items:flex-end;gap:5mm;border-top:1px solid #aaa;padding-top:2mm;margin-top:3mm;font-size:6.5px;line-height:1.35;color:#555}.page-number{white-space:nowrap;font-size:9px}@media print{body{background:#fff}.toolbar{display:none}.paper{width:182mm;min-height:269mm;margin:0;padding:0;box-shadow:none}header,.instruction,.cells,.legend,footer{break-inside:avoid;page-break-inside:avoid}}@media screen and (max-width:820px){.paper{margin:14px 0}body{overflow-x:auto}}
</style></head><body><div class="toolbar"><button type="button" onclick="window.print()">Печать / PDF</button><div>${count} ${pageWord(count)} · Каждый знак на отдельном полном листе A4.<br>В окне печати выбери A4, масштаб 100% и выключи колонтитулы. Для PDF выбери «Сохранить как PDF».</div></div><main>${pages}</main></body></html>`;
  }

  function download(characters) {
    const entries = Array.from(characters || []);
    const content = html(entries);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const code = entries[0].char ? entries[0].char.codePointAt(0).toString(16) : 'list';
    link.download = `sumi-propisi-${entries.length}-${code}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return Object.freeze({ svg, html, download });
})();
