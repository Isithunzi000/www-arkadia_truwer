// arkadia_truwer v1.0.10 | 12-09-2026
(function () {
  'use strict';

  if (window.__arkadia_truwer_loaded__) return;
  window.__arkadia_truwer_loaded__ = true;

  if (typeof Input === 'undefined') return;

  var EXT_VERSION  = '1.0.10';
  var EXT_DATE     = '12-09-2026';
  var UPDATE_URL   = 'https://isithunzi000.github.io/www-arkadia_truwer/index.json';

  // =========================================================================
  // CONSTANTS
  // =========================================================================

  var STYLE_ID          = 'tw-truwer-style';
  var PAUSE_RE          = /^\/pauza(?:\s+(\d+(?:\.\d+)?))?$/i;
  var SAVE_DEBOUNCE_MS  = 300;
  var STATUS_TTL_MS     = 4000;
  var COUNTDOWN_TICK_MS = 200;

  var LS_LIB_BASE         = 'truwer.library';
  var LS_CURRENT_CHAR_KEY = 'currentCharacter';
  var LS_AUTOCURSOR_KEY   = 'truwer.autocursor';
  var LS_COMMON_CHAR      = '__wspolne';
  var LS_MODE_KEY         = 'truwer.mode';
  var LS_POS_KEY          = 'truwer.pos';
  var LS_SIZE_KEY         = 'truwer.size';
  var LS_DOCK_WIDTH_KEY   = 'truwer.dockWidth';
  var LS_THEME_KEY        = 'truwer.theme';

  var DEFAULT_FLOAT_W   = 360;
  var DEFAULT_FLOAT_H   = 600;
  var DEFAULT_DOCK_W    = 320;
  var MIN_PANEL_W       = 240;
  var MIN_PANEL_H       = 300;
  var MAX_DOCK_RATIO    = 0.5;
  var Z_PANEL           = 99998;
  var Z_UPDATE          = 99999;

  // =========================================================================
  // STATE
  // =========================================================================

  var library    = [];
  var view       = 'library';
  var mode       = 'edit';
  var currentId  = null;
  var importOpen = false;
  var selectedIds = [];
  // B8 (D27): pamiec typu paska "Dodaj krok" - zmienna modulowa (NIE LS),
  // reset do "cmd" przy openScene/newScene.
  var lastAddType = 'cmd';
  // Fala E: "Zapisz jako..." light - nazwa pliku zbiorczego (pole obok
  // Pobierz JSON/TXT) i id sceny z otwartym inline-formem (NIE LS).
  var saveAsName = '';
  var saveAsId = null;

  var cursor     = 0;
  var playBuffer = '';
  var sending    = false;
  var autoCursor = false;
  var helpReturn = { view: 'library', mode: 'edit' };

  var panelEl      = null;
  var panelMode    = null;
  var rootEl       = null;
  var contentEl    = null;
  var statusEl     = null;
  var currentStepEl  = null;
  var countdownSpan  = null;
  var importTitleEl  = null;
  var importTextEl   = null;

  var saveTimer    = null;
  var statusTimer  = null;
  var pauseTimer   = null;

  // =========================================================================
  // SMALL HELPERS
  // =========================================================================

  function genId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function numOr(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }

  function fmtNum(n) { return String(n); }

  function fmtDate(ms) {
    var d = new Date(ms);
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    return p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear() +
           ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  function safeName(s) {
    var out = (s || 'scena').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    return out || 'scena';
  }

  // Paritet z Mudletem (core.exportSelectedAs): rozszerzenie doklejane
  // madrze - tylko gdy nazwa nie konczy sie na docelowe (case-insensitive,
  // po safeName). Inne rozszerzenie zostaje i dostaje doklejone docelowe
  // (rozszerzenie wg przycisku).
  function withExt(base, ext) {
    return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : base + ext;
  }

  function baseName(name) {
    var stripped = (name || '').replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '');
    return stripped || 'Importowana scena';
  }

  function isJson(text, name) {
    return /\.json$/i.test(name || '') || text.trim().startsWith('{');
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function btn(label, on, cls, title) {
    if (cls === undefined) cls = 'tr-btn';
    var b = el('button', cls, label);
    b.type = 'button';
    if (title) b.title = title;
    b.addEventListener('click', on);
    return b;
  }

  function addOpt(sel, value, label) {
    var o = el('option', undefined, label);
    o.value = value;
    sel.appendChild(o);
  }

  function splitVariants(t) {
    return t.split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 0; });
  }

  function pickVariant(t) {
    var v = splitVariants(t);
    if (v.length === 0) return t.trim();
    return v[Math.floor(Math.random() * v.length)];
  }

  // =========================================================================
  // PARSING / SERIALIZATION
  // =========================================================================

  function krokiFromDsl(text) {
    var out = [];
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var pm = line.match(PAUSE_RE);
      if (pm) {
        out.push({ typ: 'pauza', sekundy: pm[1] !== undefined ? parseFloat(pm[1]) : undefined });
        continue;
      }
      if (line.startsWith('#')) {
        out.push({ typ: 'nota', tekst: line.slice(1).replace(/^\s/, '') });
        continue;
      }
      out.push({ typ: 'cmd', tekst: line });
    }
    return out;
  }

  function dslFromKroki(kroki) {
    return kroki.map(function (k) {
      if (k.typ === 'pauza') return k.sekundy !== undefined ? '/pauza ' + fmtNum(k.sekundy) : '/pauza';
      if (k.typ === 'nota') return '# ' + k.tekst;
      return k.tekst;
    }).join('\n');
  }

  function normKrok(k) {
    if (!k || typeof k !== 'object') return null;
    if (k.typ === 'pauza') {
      var s = typeof k.sekundy === 'number' && isFinite(k.sekundy) && k.sekundy >= 0 ? k.sekundy : undefined;
      return { typ: 'pauza', sekundy: s };
    }
    if (k.typ === 'nota') return { typ: 'nota', tekst: k.tekst == null ? '' : String(k.tekst) };
    return { typ: 'cmd', tekst: k.tekst == null ? '' : String(k.tekst) };
  }

  function normScene(o) {
    if (!o || typeof o !== 'object') return null;
    var now = Date.now();
    var kroki = Array.isArray(o.kroki)
      ? o.kroki.map(normKrok).filter(function (x) { return x !== null; })
      : [];
    return {
      id: typeof o.id === 'string' && o.id ? o.id : genId(),
      tytul: typeof o.tytul === 'string' ? o.tytul : 'Scena',
      opis: typeof o.opis === 'string' ? o.opis : '',
      utworzono: numOr(o.utworzono, now),
      zmodyfikowano: numOr(o.zmodyfikowano, now),
      kroki: kroki
    };
  }

  function sceneFromDsl(text, title) {
    var now = Date.now();
    return { id: genId(), tytul: title, opis: '', utworzono: now, zmodyfikowano: now, kroki: krokiFromDsl(text) };
  }

  function sceneFromJson(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('bad json');
    var now = Date.now();
    var kroki = Array.isArray(obj.kroki)
      ? obj.kroki.map(normKrok).filter(function (x) { return x !== null; })
      : [];
    return {
      id: genId(),
      tytul: typeof obj.tytul === 'string' ? obj.tytul : 'Importowana scena',
      opis: typeof obj.opis === 'string' ? obj.opis : '',
      utworzono: numOr(obj.utworzono, now),
      zmodyfikowano: numOr(obj.zmodyfikowano, now),
      kroki: kroki
    };
  }

  function jsonFromScene(s) {
    return JSON.stringify({
      format: 'truwer-scene',
      wersja: 1,
      tytul: s.tytul,
      opis: s.opis,
      utworzono: s.utworzono,
      zmodyfikowano: s.zmodyfikowano,
      kroki: s.kroki
    }, null, 2);
  }

  // =========================================================================
  // STORAGE
  // =========================================================================

  function charKey() {
    var c = '';
    try { c = localStorage.getItem(LS_CURRENT_CHAR_KEY) || ''; } catch (e) { c = ''; }
    c = c.trim();
    return LS_LIB_BASE + '.' + (c || LS_COMMON_CHAR);
  }

  function loadLibrary() {
    try {
      var raw = localStorage.getItem(charKey());
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map(normScene).filter(function (x) { return x !== null; });
    } catch (e) { return []; }
  }

  function saveLibrary() {
    try {
      localStorage.setItem(charKey(), JSON.stringify(library));
    } catch (e) {
      showStatus('Błąd zapisu biblioteki.', 'error');
    }
  }

  function scheduleSave() {
    if (saveTimer !== null) { try { window.clearTimeout(saveTimer); } catch (e) {} }
    saveTimer = window.setTimeout(function () { saveTimer = null; saveLibrary(); }, SAVE_DEBOUNCE_MS);
  }

  function flushSave() {
    if (saveTimer !== null) {
      try { window.clearTimeout(saveTimer); } catch (e) {}
      saveTimer = null;
      saveLibrary();
    }
  }

  function loadPrefs() {
    try {
      var v = localStorage.getItem(LS_AUTOCURSOR_KEY);
      autoCursor = v === null ? true : v === '1';
    } catch (e) { autoCursor = true; }
  }

  function saveAuto() {
    try { localStorage.setItem(LS_AUTOCURSOR_KEY, autoCursor ? '1' : '0'); } catch (e) {}
  }

  function loadMode() {
    try { return localStorage.getItem(LS_MODE_KEY) || 'float'; } catch (e) { return 'float'; }
  }

  function saveMode(m) {
    try { localStorage.setItem(LS_MODE_KEY, m); } catch (e) {}
  }

  function loadPos() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_POS_KEY) || 'null');
      if (v && typeof v.x === 'number' && typeof v.y === 'number') return v;
    } catch (e) {}
    return { x: Math.max(0, window.innerWidth - 380), y: 60 };
  }

  function savePos(x, y) {
    try { localStorage.setItem(LS_POS_KEY, JSON.stringify({ x: x, y: y })); } catch (e) {}
  }

  function loadSize() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_SIZE_KEY) || 'null');
      if (v && typeof v.w === 'number' && typeof v.h === 'number') return v;
    } catch (e) {}
    return { w: DEFAULT_FLOAT_W, h: DEFAULT_FLOAT_H };
  }

  function saveSize(w, h) {
    try { localStorage.setItem(LS_SIZE_KEY, JSON.stringify({ w: w, h: h })); } catch (e) {}
  }

  function loadDockWidth() {
    try {
      var v = parseInt(localStorage.getItem(LS_DOCK_WIDTH_KEY) || '0', 10);
      return v > 0 ? v : DEFAULT_DOCK_W;
    } catch (e) { return DEFAULT_DOCK_W; }
  }

  function saveDockWidth(w) {
    try { localStorage.setItem(LS_DOCK_WIDTH_KEY, String(w)); } catch (e) {}
  }

  function loadTheme() {
    try { return localStorage.getItem(LS_THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
  }

  function saveTheme(t) {
    try { localStorage.setItem(LS_THEME_KEY, t); } catch (e) {}
  }

  // =========================================================================
  // SCENE HELPERS
  // =========================================================================

  function currentScene() {
    for (var i = 0; i < library.length; i++) { if (library[i].id === currentId) return library[i]; }
    return null;
  }

  function touch(s) { s.zmodyfikowano = Date.now(); }

  function firstPlayable(kroki, from) {
    for (var i = Math.max(0, from); i < kroki.length; i++) { if (kroki[i].typ !== 'nota') return i; }
    return kroki.length;
  }

  function prevPlayable(kroki, from) {
    for (var i = Math.min(kroki.length - 1, from); i >= 0; i--) { if (kroki[i].typ !== 'nota') return i; }
    return -1;
  }

  function primeBuffer(s) {
    var k = s.kroki[cursor];
    playBuffer = k && k.typ === 'cmd' ? pickVariant(k.tekst) : '';
  }

  // =========================================================================
  // DOWNLOAD / FILE PICK
  // =========================================================================

  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = el('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 0);
      return true;
    } catch (e) { showStatus('Błąd eksportu pliku.', 'error'); return false; }
  }

  function pickFile(onText) {
    var inp = el('input');
    inp.type = 'file';
    inp.accept = '.txt,.json,application/json,text/plain';
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (f) {
        var fr = new FileReader();
        fr.onload = function () { onText(String(fr.result || ''), f.name); };
        fr.onerror = function () { showStatus('Błąd odczytu pliku.', 'error'); };
        fr.readAsText(f);
      }
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  }

  // =========================================================================
  // ACTIONS
  // =========================================================================

  function onNewScene() {
    var now = Date.now();
    lastAddType = 'cmd'; // B8: reset typu paska przy wejsciu
    var s = { id: genId(), tytul: 'Nowa scena', opis: '', utworzono: now, zmodyfikowano: now, kroki: [] };
    library.push(s);
    saveLibrary();
    openScene(s.id, 'edit');
  }

  function openScene(id, m) {
    currentId = id;
    view = 'scene';
    importOpen = false;
    lastAddType = 'cmd'; // B8: reset typu paska przy wejsciu
    if (m === 'play') {
      mode = 'play';
      var s = currentScene();
      if (s) { cursor = firstPlayable(s.kroki, 0); primeBuffer(s); }
    } else {
      mode = 'edit';
    }
    render();
  }

  function goLibrary() {
    flushSave();
    stopPauseTimer();
    view = 'library';
    render();
  }

  function duplicateScene(id) {
    var s = null;
    for (var i = 0; i < library.length; i++) { if (library[i].id === id) { s = library[i]; break; } }
    if (!s) return;
    var now = Date.now();
    var copy = {
      id: genId(), tytul: (s.tytul || 'Scena') + ' (kopia)',
      opis: s.opis, utworzono: now, zmodyfikowano: now,
      kroki: s.kroki.map(function (k) { return Object.assign({}, k); })
    };
    library.push(copy);
    saveLibrary();
    render();
    showStatus('Utworzono kopię.', 'success');
  }

  function deleteScene(id) {
    var s = null;
    for (var i = 0; i < library.length; i++) { if (library[i].id === id) { s = library[i]; break; } }
    if (!s) return;
    var ok = typeof window.confirm === 'function'
      ? window.confirm('Usunąć scenę: ' + (s.tytul || '(bez tytułu)') + ' ?')
      : true;
    if (!ok) return;
    library = library.filter(function (x) { return x.id !== id; });
    var selIdx = selectedIds.indexOf(id);
    if (selIdx >= 0) selectedIds.splice(selIdx, 1);
    if (currentId === id) { currentId = null; view = 'library'; }
    saveLibrary();
    render();
    showStatus('Usunięto scenę.', 'success');
  }

  function exportScene(s, fmt) {
    var name = safeName(s.tytul) + (fmt === 'json' ? '.json' : '.txt');
    var ok = fmt === 'json'
      ? download(name, jsonFromScene(s), 'application/json')
      : download(name, dslFromKroki(s.kroki), 'text/plain');
    if (ok) showStatus('Pobrano: ' + name, 'success');
  }

  // Fala E: "Zapisz jako..." per scena - jak exportScene(s, 'json'), ale
  // z wlasna nazwa z inline-formu (puste = domyslna z tytulu; safeName).
  function exportSceneAs(s, nameRaw) {
    var base = safeName((nameRaw || '').trim() || s.tytul);
    var name = withExt(base, '.json');
    saveAsId = null;
    if (download(name, jsonFromScene(s), 'application/json')) showStatus('Pobrano: ' + name, 'success');
    render();
  }

  function importScenes(text, dslTitle, jsonName) {
    if (!isJson(text, jsonName)) return [sceneFromDsl(text, dslTitle)];
    var parsed = JSON.parse(text);
    var arr;
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sceny)) {
      arr = parsed.sceny;
    } else {
      arr = [parsed];
    }
    return arr.map(sceneFromJson);
  }

  function onImportText(text, name) {
    try {
      var scenes = importScenes(text, baseName(name), name);
      if (scenes.length === 0) { showStatus('Pusty import.', 'error'); return; }
      for (var i = 0; i < scenes.length; i++) library.push(scenes[i]);
      saveLibrary();
      if (scenes.length === 1) {
        openScene(scenes[0].id, 'edit');
      } else {
        selectedIds = [];
        view = 'library';
        render();
      }
      showStatus(scenes.length === 1 ? 'Zaimportowano scenę.' : 'Zaimportowano sceny: ' + scenes.length + '.', 'success');
    } catch (e) { showStatus('Błąd importu pliku.', 'error'); }
  }

  function onImportFromPanel() {
    var text = importTextEl ? importTextEl.value : '';
    var title = importTitleEl ? importTitleEl.value.trim() : '';
    if (!text.trim()) { showStatus('Pusty import.', 'error'); return; }
    try {
      var scenes = importScenes(text, title || 'Importowana scena', '');
      if (scenes.length === 0) { showStatus('Pusty import.', 'error'); return; }
      if (scenes.length === 1 && title) scenes[0].tytul = title;
      for (var i = 0; i < scenes.length; i++) library.push(scenes[i]);
      saveLibrary();
      importOpen = false;
      if (scenes.length === 1) {
        openScene(scenes[0].id, 'edit');
      } else {
        selectedIds = [];
        view = 'library';
        render();
      }
      showStatus(scenes.length === 1 ? 'Zaimportowano scenę.' : 'Zaimportowano sceny: ' + scenes.length + '.', 'success');
    } catch (e) { showStatus('Błąd importu.', 'error'); }
  }

  // Editor step ops
  function addStep(s, typ) {
    var k;
    if (typ === 'pauza') k = { typ: 'pauza', sekundy: undefined };
    else if (typ === 'nota') k = { typ: 'nota', tekst: '' };
    else k = { typ: 'cmd', tekst: '' };
    s.kroki.push(k);
    touch(s); saveLibrary(); render();
  }

  function insertStep(s, pos) {
    s.kroki.splice(pos, 0, { typ: 'cmd', tekst: '' });
    touch(s); saveLibrary(); render();
  }

  function dupStep(s, i) {
    s.kroki.splice(i + 1, 0, Object.assign({}, s.kroki[i]));
    touch(s); saveLibrary(); render();
  }

  function removeStep(s, i) {
    var ok = typeof window.confirm === 'function' ? window.confirm('Usunąć ten krok?') : true;
    if (!ok) return;
    s.kroki.splice(i, 1);
    touch(s); saveLibrary(); render();
  }

  function moveStep(s, i, dir) {
    var j = i + dir;
    if (j < 0 || j >= s.kroki.length) return;
    var tmp = s.kroki[i]; s.kroki[i] = s.kroki[j]; s.kroki[j] = tmp;
    touch(s); saveLibrary(); render();
  }

  function changeType(s, i, typ) {
    var old = s.kroki[i];
    var oldText = old.typ === 'cmd' || old.typ === 'nota' ? old.tekst : '';
    var nk;
    if (typ === 'pauza') nk = { typ: 'pauza', sekundy: undefined };
    else if (typ === 'nota') nk = { typ: 'nota', tekst: oldText };
    else nk = { typ: 'cmd', tekst: oldText };
    s.kroki[i] = nk;
    touch(s); saveLibrary(); render();
  }

  // Fala C: walidacja sekund hardened 1:1 z truwer.xml (core.setStepSekundy;
  // D24 + F16-C). Pusty/biale -> undefined (sukces bez statusu); przecinek
  // normalizowany do kropki; sztywny wzorzec cyfry[.cyfry] odrzuca litery,
  // notacje e/hex, wiodace plusy i wielokropki; sufit 3600 s (1 h). Odrzut
  // NIE zmienia wartosci - tylko status error; sukces zwraca true (zapis
  // robi wywolujacy).
  function setStepSekundy(k, txt) {
    txt = String(txt);
    if (/^\s*$/.test(txt)) { k.sekundy = undefined; return true; }
    var norm = txt.replace(/,/g, '.');
    if (!(/^\s*\d+\.?\d*\s*$/.test(norm) || /^\s*\.\d+\s*$/.test(norm))) {
      showStatus('Sekundy: tylko liczby (np. 5 albo 2.5).', 'error');
      return false;
    }
    var v = parseFloat(norm.replace(/^\s+/, '').replace(/\s+$/, ''));
    if (v > 3600) {
      showStatus('Sekundy: maksimum 3600 (1 h).', 'error');
      return false;
    }
    k.sekundy = v;
    return true;
  }

  // Player ops
  function doSend(btnEl) {
    var text = playBuffer.trim();
    if (!text) { showStatus('Pusta komenda.', 'error'); return; }
    if (sending) return;
    sending = true;
    btnEl.disabled = true;
    try {
      if (window.client && typeof window.client.sendCommand === 'function') {
        var _ec = window.client.echoCommand;
        window.client.echoCommand = function () {};
        try { window.client.sendCommand(text, false); }
        finally { window.client.echoCommand = _ec; }
      } else {
        _origInput(text);
      }
    } catch (e) {
      showStatus('Błąd wysłania komendy.', 'error');
    } finally {
      sending = false;
    }
    advance();
  }

  function advance() {
    var s = currentScene();
    if (!s) return;
    stopPauseTimer();
    cursor = firstPlayable(s.kroki, cursor + 1);
    primeBuffer(s);
    render();
  }

  function back() {
    var s = currentScene();
    if (!s) return;
    stopPauseTimer();
    // F18-C: Wstecz bez ruchu (pierwszy krok) mowi, nie milczy.
    var oldCursor = cursor;
    var target = cursor >= s.kroki.length ? s.kroki.length - 1 : cursor - 1;
    var p = prevPlayable(s.kroki, target);
    cursor = p < 0 ? firstPlayable(s.kroki, 0) : p;
    if (s.kroki.length > 0 && cursor === oldCursor) showStatus('To już pierwszy krok.', 'info');
    primeBuffer(s);
    render();
  }

  function stop() {
    var s = currentScene();
    if (!s) return;
    stopPauseTimer();
    cursor = firstPlayable(s.kroki, 0);
    primeBuffer(s);
    render();
  }

  // =========================================================================
  // PAUSE TIMER
  // =========================================================================

  function stopPauseTimer() {
    if (pauseTimer !== null) { try { window.clearInterval(pauseTimer); } catch (e) {} pauseTimer = null; }
    countdownSpan = null;
  }

  function startPauseTimer(seconds) {
    if (pauseTimer !== null) { try { window.clearInterval(pauseTimer); } catch (e) {} pauseTimer = null; }
    var totalMs = seconds * 1000;
    var start = Date.now();
    var tick = function () {
      var rem = Math.max(0, totalMs - (Date.now() - start));
      if (countdownSpan) countdownSpan.textContent = (rem / 1000).toFixed(1) + 's';
      if (rem <= 0) {
        if (pauseTimer !== null) { try { window.clearInterval(pauseTimer); } catch (e) {} pauseTimer = null; }
        if (countdownSpan) countdownSpan.classList.add('tr-ready');
        if (autoCursor) advance();
      }
    };
    tick();
    pauseTimer = window.setInterval(tick, COUNTDOWN_TICK_MS);
  }

  // =========================================================================
  // STATUS
  // =========================================================================

  function showStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'tr-status' + (kind === 'error' ? ' tr-c-error' : kind === 'success' ? ' tr-c-ok' : '');
    if (statusTimer !== null) { try { window.clearTimeout(statusTimer); } catch (e) {} }
    statusTimer = window.setTimeout(function () {
      statusTimer = null;
      if (statusEl) { statusEl.textContent = ''; statusEl.className = 'tr-status'; }
    }, STATUS_TTL_MS);
  }

  // =========================================================================
  // BULK OPS
  // =========================================================================

  function selectedScenes() {
    return library.filter(function (s) { return selectedIds.indexOf(s.id) >= 0; });
  }

  function toggleSelected(id) {
    var idx = selectedIds.indexOf(id);
    if (idx >= 0) selectedIds.splice(idx, 1);
    else selectedIds.push(id);
    render();
  }

  function selectAll(scenes) {
    var allSel = scenes.length > 0 && scenes.every(function (s) { return selectedIds.indexOf(s.id) >= 0; });
    selectedIds = [];
    if (!allSel) selectedIds = scenes.map(function (s) { return s.id; });
    render();
  }

  function bulkStamp() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  function bulkJson(scenes) {
    return JSON.stringify({
      format: 'truwer-scenes', wersja: 1,
      sceny: scenes.map(function (s) {
        return { format: 'truwer-scene', wersja: 1, tytul: s.tytul, opis: s.opis,
                 utworzono: s.utworzono, zmodyfikowano: s.zmodyfikowano, kroki: s.kroki };
      })
    }, null, 2);
  }

  function bulkTxt(scenes) {
    return scenes.map(function (s) {
      return '=== ' + (s.tytul || '(bez tytułu)') + ' ===\n' + dslFromKroki(s.kroki);
    }).join('\n\n');
  }

  function exportScenesBulk(fmt) {
    var scenes = selectedScenes();
    // F15-A/F18-C: przyciski zawsze aktywne - status mowi, co zrobic.
    if (scenes.length === 0) { showStatus('Najpierw zaznacz sceny.', 'info'); return; }
    var stamp = bulkStamp();
    // Fala E: "Zapisz jako..." - wlasna nazwa z pola obok przyciskow;
    // puste = domyslna ze stemplem; nazwa przez safeName (ASCII).
    var base = safeName((saveAsName || '').trim() || ('truwer-sceny-' + stamp));
    var name = withExt(base, fmt === 'json' ? '.json' : '.txt');
    var ok = fmt === 'json'
      ? download(name, bulkJson(scenes), 'application/json')
      : download(name, bulkTxt(scenes), 'text/plain');
    if (ok) showStatus('Pobrano: ' + name, 'success');
  }

  function deleteSelected() {
    var scenes = selectedScenes();
    // F18-C: puste zaznaczenie - od razu status, bez pytania o zero scen.
    if (scenes.length === 0) { showStatus('Najpierw zaznacz sceny.', 'info'); return; }
    var ok = typeof window.confirm === 'function'
      ? window.confirm('Usunąć zaznaczone sceny: ' + scenes.length + ' ?')
      : true;
    if (!ok) return;
    var ids = scenes.map(function (s) { return s.id; });
    library = library.filter(function (s) { return ids.indexOf(s.id) < 0; });
    if (currentId && ids.indexOf(currentId) >= 0) { currentId = null; view = 'library'; }
    selectedIds = [];
    saveLibrary();
    render();
    showStatus('Usunięto sceny: ' + scenes.length + '.', 'success');
  }

  // =========================================================================
  // RENDERING HELPERS
  // =========================================================================

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function initGrow(ta) {
    ta.rows = 1;
    window.requestAnimationFrame(function () { autoGrow(ta); });
  }

  function commitKeys(elm, onEnter) {
    elm.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault(); ev.stopPropagation();
        if (onEnter) onEnter(); else elm.blur();
      } else if (ev.key === 'Escape') {
        ev.preventDefault(); ev.stopPropagation(); elm.blur();
      }
    });
  }

  function openHelp() {
    flushSave(); stopPauseTimer();
    if (view !== 'help') helpReturn = { view: view, mode: mode };
    view = 'help';
    render();
  }

  function closeHelp() {
    view = helpReturn.view; mode = helpReturn.mode; render();
  }

  function helpBtn() {
    return btn('Pomoc', openHelp, 'tr-icon-btn', 'Pomoc: jak korzystać z truwera.');
  }

  function viewModeBtnCls(target) {
    return 'tr-icon-btn' + (target === mode ? ' tr-active' : '');
  }

  function buildSceneHeader(s) {
    var head = el('div', 'tr-head');
    var top = el('div', 'tr-row');
    top.appendChild(btn('Biblioteka', goLibrary, 'tr-icon-btn', 'Wróć do listy scen.'));
    top.appendChild(el('div', 'tr-spacer'));
    top.appendChild(helpBtn());
    head.appendChild(top);

    var modeRow = el('div', 'tr-row');
    modeRow.appendChild(el('span', 'tr-hint', 'Tryb:'));
    modeRow.appendChild(btn('Edycja', function () {
      if (mode !== 'edit') { mode = 'edit'; stopPauseTimer(); render(); }
    }, viewModeBtnCls('edit'), 'Tryb edycji: dodawaj i zmieniaj kroki sceny.'));
    modeRow.appendChild(btn('Odtwarzanie', function () {
      if (mode !== 'play') {
        mode = 'play';
        cursor = firstPlayable(s.kroki, 0);
        primeBuffer(s);
        render();
      }
    }, viewModeBtnCls('play'), 'Tryb odgrywania: wysyłaj kroki sceny po kolei.'));
    head.appendChild(modeRow);
    return head;
  }

  function activateStep(i) {
    var s = currentScene();
    if (!s) return;
    if (i < 0 || i >= s.kroki.length) return;
    if (s.kroki[i].typ === 'nota') return;
    stopPauseTimer();
    cursor = i;
    primeBuffer(s);
    render();
  }

  function render() {
    stopPauseTimer();
    if (!contentEl) return;
    contentEl.innerHTML = '';
    if (view === 'help') renderHelp();
    else if (view === 'library') renderLibrary();
    else renderScene();
  }

  function renderScene() {
    var s = currentScene();
    if (!s) { view = 'library'; renderLibrary(); return; }
    if (mode === 'play') renderPlay(s);
    else renderEdit(s);
  }

  function renderLibrary() {
    if (!contentEl) return;
    var wrap = el('div', 'tr-view');

    var bar = el('div', 'tr-row');
    bar.appendChild(btn('Nowa scena', onNewScene, 'tr-btn', 'Utwórz nową, pustą scenę i otwórz ją do edycji.'));
    bar.appendChild(btn('Importuj plik', function () { pickFile(onImportText); }, 'tr-icon-btn',
      'Wczytaj scenę z pliku: .txt (lista komend) lub .json (pełna scena lub pakiet scen).'));
    bar.appendChild(btn(importOpen ? 'Anuluj import' : 'Importuj tekst', function () {
      importOpen = !importOpen; render();
    }, 'tr-icon-btn', importOpen ? 'Zamknij panel importu.' : 'Wklej JSON lub tekst sceny, aby ją zaimportować.'));
    bar.appendChild(el('div', 'tr-spacer'));
    bar.appendChild(helpBtn());
    wrap.appendChild(bar);

    if (importOpen) wrap.appendChild(buildImportPanel());

    if (library.length === 0) {
      var empty = el('div', 'tr-scroll');
      empty.appendChild(el('div', 'tr-empty', 'Brak zapisanych scen. Utwórz nową lub zaimportuj.'));
      wrap.appendChild(empty);
      contentEl.appendChild(wrap);
      return;
    }

    var items = library.slice().sort(function (a, b) { return b.zmodyfikowano - a.zmodyfikowano; });
    var selCount = items.filter(function (s) { return selectedIds.indexOf(s.id) >= 0; }).length;
    var allSel = selCount === items.length;

    var bulk = el('div', 'tr-row tr-bulk');
    bulk.appendChild(btn(allSel ? 'Odznacz wszystkie' : 'Zaznacz wszystkie',
      function () { selectAll(items); }, 'tr-icon-btn',
      allSel ? 'Odznacz wszystkie sceny.' : 'Zaznacz wszystkie sceny.'));
    bulk.appendChild(el('span', 'tr-hint', 'zaznaczone: ' + selCount + '/' + items.length));
    bulk.appendChild(el('div', 'tr-spacer'));
    // Fala E: "Zapisz jako..." zbiorczo - wlasna nazwa (puste = domyslna
    // ze stemplem; rozszerzenie dokleja przycisk JSON/TXT).
    var nameInp = el('input', 'tr-input tr-bulk-name');
    nameInp.type = 'text';
    nameInp.placeholder = 'truwer-sceny-' + bulkStamp();
    nameInp.value = saveAsName;
    nameInp.title = 'Nazwa pliku zbiorczego (opcjonalna; puste = domyślna). Rozszerzenie dokleja przycisk.';
    nameInp.addEventListener('input', function () { saveAsName = nameInp.value; });
    commitKeys(nameInp);
    bulk.appendChild(nameInp);
    var dJson = btn('Pobierz JSON', function () { exportScenesBulk('json'); }, 'tr-icon-btn',
      'Pobierz zaznaczone sceny jako jeden plik .json (re-importowalny).');
    var dTxt = btn('Pobierz TXT', function () { exportScenesBulk('txt'); }, 'tr-icon-btn',
      'Pobierz zaznaczone sceny jako jeden plik .txt (do odczytu).');
    var dDel = btn('Usuń zaznaczone', deleteSelected, 'tr-icon-btn tr-btn-danger',
      'Usuń zaznaczone sceny (z potwierdzeniem).');
    // F15-A: przyciski zbiorcze zawsze aktywne - status mowi, co zrobic.
    bulk.appendChild(dJson); bulk.appendChild(dTxt); bulk.appendChild(dDel);
    wrap.appendChild(bulk);

    var list = el('div', 'tr-scroll');
    for (var i = 0; i < items.length; i++) list.appendChild(buildLibRow(items[i]));
    wrap.appendChild(list);
    contentEl.appendChild(wrap);
  }

  function buildImportPanel() {
    var p = el('div', 'tr-panel');
    var ti = el('input', 'tr-input');
    ti.placeholder = 'Tytuł (opcjonalnie)';
    importTitleEl = ti;
    commitKeys(ti, function () { onImportFromPanel(); });
    var ta = el('textarea', 'tr-textarea');
    ta.placeholder = 'Wklej JSON lub tekst (komendy, /pauza, /pauza N, # notatki)';
    ta.rows = 6;
    importTextEl = ta;
    var row = el('div', 'tr-row');
    row.appendChild(btn('Importuj', onImportFromPanel, 'tr-btn', 'Zaimportuj wklejoną zawartość.'));
    p.appendChild(ti); p.appendChild(ta); p.appendChild(row);
    return p;
  }

  function buildLibRow(s) {
    var row = el('div', 'tr-item');
    if (selectedIds.indexOf(s.id) >= 0) row.classList.add('tr-item-sel');

    var head = el('div', 'tr-item-head');
    var cb = el('input', 'tr-item-check');
    cb.type = 'checkbox';
    cb.checked = selectedIds.indexOf(s.id) >= 0;
    cb.title = 'Zaznacz scenę do operacji zbiorczych.';
    (function (sid) {
      cb.addEventListener('change', function () { toggleSelected(sid); });
    })(s.id);
    head.appendChild(cb);
    head.appendChild(el('div', 'tr-item-title', s.tytul || '(bez tytułu)'));
    row.appendChild(head);

    var metaTxt = fmtDate(s.zmodyfikowano) + ' | ' + (s.opis ? s.opis + ' | ' : '') + 'kroki: ' + s.kroki.length;
    row.appendChild(el('div', 'tr-item-meta', metaTxt));

    var acts = el('div', 'tr-item-acts');
    (function (sid) {
      acts.appendChild(btn('Edycja', function () { openScene(sid, 'edit'); }, 'tr-icon-btn', 'Otwórz tę scenę do edycji.'));
      acts.appendChild(btn('Odtwarzaj', function () { openScene(sid, 'play'); }, 'tr-icon-btn', 'Otwórz tę scenę do odgrywania (prompter).'));
      acts.appendChild(btn('Powiel', function () { duplicateScene(sid); }, 'tr-icon-btn', 'Utwórz kopię tej sceny.'));
    })(s.id);
    (function (sc) {
      acts.appendChild(btn('JSON', function () { exportScene(sc, 'json'); }, 'tr-icon-btn', 'Zapisz scenę do pliku .json (pełna, bezstratna kopia).'));
      acts.appendChild(btn('TXT', function () { exportScene(sc, 'txt'); }, 'tr-icon-btn', 'Zapisz scenę do pliku .txt (prosty tekst).'));
      acts.appendChild(btn('Zapisz jako…', function () { saveAsId = sc.id; render(); }, 'tr-icon-btn', 'Zapisz tę scenę jako .json pod własną nazwą.'));
    })(s);
    (function (sid) {
      acts.appendChild(btn('Usuń', function () { deleteScene(sid); }, 'tr-icon-btn tr-btn-danger', 'Usuń tę scenę (z potwierdzeniem).'));
    })(s.id);
    row.appendChild(acts);

    // Fala E: inline-form "Zapisz jako..." (nazwa + Zapisz/Anuluj).
    if (saveAsId === s.id) {
      var form = el('div', 'tr-saveas');
      var nameInp = el('input', 'tr-input tr-saveas-name');
      nameInp.type = 'text';
      nameInp.value = safeName(s.tytul);
      nameInp.placeholder = safeName(s.tytul);
      nameInp.title = 'Nazwa pliku (bez rozszerzenia; safeName obcina polskie znaki).';
      commitKeys(nameInp);
      form.appendChild(nameInp);
      (function (sc, inp) {
        form.appendChild(btn('Zapisz', function () { exportSceneAs(sc, inp.value); }, 'tr-btn',
          'Pobierz scenę jako .json pod podaną nazwą.'));
        form.appendChild(btn('Anuluj', function () {
          saveAsId = null;
          showStatus('Zapis anulowany.', 'info');
          render();
        }, 'tr-btn', 'Przerwij zapis pod własną nazwą (bez pobierania).'));
      })(s, nameInp);
      row.appendChild(form);
    }
    return row;
  }

  function renderEdit(s) {
    if (!contentEl) return;
    var wrap = el('div', 'tr-view');
    wrap.appendChild(buildSceneHeader(s));

    var tit = el('input', 'tr-input');
    tit.value = s.tytul;
    tit.placeholder = 'Tytuł';
    tit.addEventListener('input', function () { s.tytul = tit.value; touch(s); scheduleSave(); });
    commitKeys(tit);
    wrap.appendChild(tit);

    var op = el('input', 'tr-input');
    op.value = s.opis;
    op.placeholder = 'Opis (opcjonalny):';
    op.addEventListener('input', function () { s.opis = op.value; touch(s); scheduleSave(); });
    commitKeys(op);
    wrap.appendChild(op);

    // A4: dwie linie hintu wzorca Mudleta (truwer.ed.hint / truwer.ed.hint2).
    wrap.appendChild(el('div', 'tr-hint',
      'warianty komendy: a|b|c — prompter wylosuje jedną. Pauza: /pauza lub /pauza N.'));
    wrap.appendChild(el('div', 'tr-hint',
      'Notatka: wiersz typu notatka (nie wysyłana).'));

    var list = el('div', 'tr-scroll');
    if (s.kroki.length === 0) {
      list.appendChild(el('div', 'tr-empty', 'Brak kroków. Dodaj poniżej.'));
    } else {
      for (var i = 0; i < s.kroki.length; i++) list.appendChild(buildEditRow(s, s.kroki[i], i));
    }
    wrap.appendChild(list);

    var addbar = el('div', 'tr-row');
    var sel = el('select', 'tr-select');
    addOpt(sel, 'cmd', 'komenda');
    addOpt(sel, 'pauza', 'pauza');
    addOpt(sel, 'nota', 'notatka');
    sel.title = 'Wybierz typ kroku do dodania.';
    sel.value = lastAddType; // B8: pamiec typu paska
    addbar.appendChild(sel);
    (function (sc, selectEl) {
      addbar.appendChild(btn('Dodaj krok', function () {
        lastAddType = selectEl.value; // B8: zapamietaj wybor (re-render go przywroci)
        addStep(sc, selectEl.value);
      }, 'tr-btn', 'Dodaj nowy krok na końcu sceny.'));
    })(s, sel);
    wrap.appendChild(addbar);
    contentEl.appendChild(wrap);
  }

  function buildLineEditor(placeholder, value, onChange) {
    var inp = el('textarea', 'tr-textarea tr-grow tr-line');
    inp.value = value;
    inp.placeholder = placeholder;
    inp.addEventListener('input', function () {
      var v = inp.value.replace(/[\r\n]+/g, ' ');
      if (v !== inp.value) inp.value = v;
      onChange(v);
      autoGrow(inp);
    });
    commitKeys(inp);
    initGrow(inp);
    return inp;
  }

  function buildEditRow(s, k, i) {
    var row = el('div', 'tr-erow');

    var sel = el('select', 'tr-select');
    addOpt(sel, 'cmd', 'komenda');
    addOpt(sel, 'pauza', 'pauza');
    addOpt(sel, 'nota', 'notatka');
    sel.value = k.typ;
    sel.title = 'Zmień typ kroku: komenda, pauza lub notatka.';
    (function (sc, idx) {
      sel.addEventListener('change', function () { changeType(sc, idx, sel.value); });
    })(s, i);
    row.appendChild(sel);

    if (k.typ === 'cmd') {
      (function (kk) {
        row.appendChild(buildLineEditor('komenda (warianty: a|b|c)', kk.tekst, function (v) {
          kk.tekst = v; touch(s); scheduleSave();
        }));
      })(k);
    } else if (k.typ === 'pauza') {
      row.appendChild(el('span', 'tr-hint', 'PAUZA'));
      var inp = el('input', 'tr-input tr-num');
      // Fala C: text + inputMode zamiast type=number (walidacja w
      // setStepSekundy; type=number gubi wpisy posrednie jak "2,").
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
      inp.value = k.sekundy !== undefined ? String(k.sekundy) : '';
      inp.placeholder = 'sek (opc.)';
      (function (kk) {
        inp.addEventListener('input', function () {
          if (setStepSekundy(kk, inp.value)) { touch(s); scheduleSave(); }
        });
      })(k);
      commitKeys(inp);
      row.appendChild(inp);
    } else {
      (function (kk) {
        row.appendChild(buildLineEditor('notatka (nie wysyłana)', kk.tekst, function (v) {
          kk.tekst = v; touch(s); scheduleSave();
        }));
      })(k);
    }

    var acts = el('div', 'tr-erow-acts');
    (function (sc, idx) {
      acts.appendChild(btn('^', function () { moveStep(sc, idx, -1); }, 'tr-icon-btn', 'Przeniesie krok wyżej.'));
      acts.appendChild(btn('v', function () { moveStep(sc, idx, 1); }, 'tr-icon-btn', 'Przeniesie krok niżej.'));
      acts.appendChild(btn('Wstaw', function () { insertStep(sc, idx + 1); }, 'tr-icon-btn', 'Wstaw nową komendę poniżej tego kroku.'));
      acts.appendChild(btn('Powiel', function () { dupStep(sc, idx); }, 'tr-icon-btn', 'Powiel ten krok.'));
      acts.appendChild(btn('X', function () { removeStep(sc, idx); }, 'tr-icon-btn tr-btn-danger', 'Usuń ten krok.'));
    })(s, i);
    row.appendChild(acts);
    return row;
  }

  function stepLabel(k) {
    if (k.typ === 'cmd') return k.tekst || '(pusta komenda)';
    if (k.typ === 'pauza') return 'PAUZA' + (k.sekundy ? ' ' + fmtNum(k.sekundy) + 's' : '');
    return '# ' + k.tekst;
  }

  // Fala D (F16-B): didaskalia kroku - ciagly blok notatek stojacych
  // BEZPOSREDNIO przed krokiem pod kursorem (konwencja: notatka tuz przed
  // krokiem opisuje TEN krok, np. "poczekaj na reakcje"). Kursor 0-based
  // wskazuje NASTEPNY krok; schodzimy od cursor-1 w dol, dopoki trafia
  // sie notatki; kolejnosc chronologiczna (najstarsza pierwsza). Straz
  // konca sceny jest w renderze (rdzen zwraca blok tez dla cursor==total).
  function didaskalia(s, cursor) {
    var out = [];
    var i = cursor - 1;
    while (i >= 0) {
      var k = s.kroki[i];
      if (!k || k.typ !== 'nota') break;
      out.unshift(k.tekst || '');
      i--;
    }
    return out;
  }

  // fitText jak w truwer.xml: ciecie po znakach (UTF-8-aware), gdy za
  // dlugie: pierwsze maxChars-3 znakow + "...".
  function fitText(s, maxChars) {
    s = String(s == null ? '' : s);
    var chars = Array.from(s);
    if (chars.length <= maxChars) return s;
    return chars.slice(0, maxChars - 3).join('') + '...';
  }

  function renderPlay(s) {
    if (!contentEl) return;
    var total = s.kroki.length;
    var wrap = el('div', 'tr-view');
    wrap.appendChild(buildSceneHeader(s));

    var ctl = el('div', 'tr-row');
    var auto = el('label', 'tr-check');
    auto.title = 'Gdy odliczanie pauzy się skończy, prompter sam pokaże następny krok. Nie wysyła żadnej komendy.';
    var cb = el('input');
    cb.type = 'checkbox'; cb.checked = autoCursor;
    cb.addEventListener('change', function () { autoCursor = cb.checked; saveAuto(); });
    auto.appendChild(cb);
    auto.appendChild(el('span', undefined, 'Po pauzie przejdź dalej'));
    ctl.appendChild(auto);
    var prog = el('span', 'tr-prog');
    var pos = cursor >= total ? total : cursor + 1;
    prog.textContent = total ? 'krok ' + pos + '/' + total : 'brak kroków';
    ctl.appendChild(prog);
    wrap.appendChild(ctl);

    wrap.appendChild(el('div', 'tr-hint', 'Kliknij krok, aby go aktywować'));

    var list = el('div', 'tr-scroll');
    currentStepEl = null;
    for (var i = 0; i < s.kroki.length; i++) {
      var k = s.kroki[i];
      var cls = 'tr-step' +
        (i === cursor ? ' tr-step-current' : '') +
        (k.typ === 'nota' ? ' tr-step-note' : '') +
        (k.typ === 'pauza' ? ' tr-step-pause' : '') +
        (k.typ !== 'nota' ? ' tr-step-click' : '');
      var stp = el('div', cls, stepLabel(k));
      (function (idx) {
        if (k.typ !== 'nota') stp.addEventListener('click', function () { activateStep(idx); });
      })(i);
      if (i === cursor) currentStepEl = stp;
      list.appendChild(stp);
    }
    if (total === 0) list.appendChild(el('div', 'tr-empty', 'Brak kroków.'));
    wrap.appendChild(list);

    wrap.appendChild(buildPlayPanel(s));

    var nav = el('div', 'tr-row');
    nav.appendChild(btn('Wstecz', back, 'tr-icon-btn', 'Przejdź do poprzedniego kroku (bez wysyłania).'));
    nav.appendChild(btn('Dalej', advance, 'tr-icon-btn', 'Przejdź do następnego kroku (bez wysyłania).'));
    nav.appendChild(btn('Na początek', stop, 'tr-icon-btn', 'Wróć do pierwszego kroku sceny.'));
    wrap.appendChild(nav);

    contentEl.appendChild(wrap);

    if (currentStepEl) {
      var target = currentStepEl;
      window.requestAnimationFrame(function () {
        try { target.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      });
    }
  }

  function buildPlayPanel(s) {
    var panel = el('div', 'tr-panel');
    var total = s.kroki.length;
    if (cursor >= total) {
      panel.appendChild(el('div', 'tr-big', total ? 'Koniec sceny' : 'Brak kroków'));
      return panel;
    }
    // Fala D (F16-B/F18-E): didaskalia biezacego kroku - notatki tuz przed
    // nim. Straz konca sceny jest wyzej (early return). Max 2 linie z
    // prefiksem "» "; przy 3+ druga konczy sie " …". Nieklikalne.
    var did = didaskalia(s, cursor);
    if (did.length > 0) {
      var dp = el('div', 'tr-did');
      for (var di = 0; di < Math.min(2, did.length); di++) {
        var dt = '» ' + fitText(did[di], 60);
        if (di === 1 && did.length > 2) dt += ' …';
        dp.appendChild(el('div', 'tr-did-line', dt));
      }
      panel.appendChild(dp);
    }
    var k = s.kroki[cursor];
    if (k.typ === 'cmd') {
      panel.appendChild(el('div', 'tr-hint', 'do wysłania (Enter = wyślij):'));
      var inp = el('textarea', 'tr-textarea tr-grow tr-line');
      inp.value = playBuffer;
      inp.title = 'Treść, która pójdzie do gry. Możesz ją zmienić przed wysłaniem. Enter wysyła.';
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/[\r\n]+/g, ' ');
        if (v !== inp.value) inp.value = v;
        playBuffer = v;
        autoGrow(inp);
      });
      initGrow(inp);
      panel.appendChild(inp);

      var row = el('div', 'tr-row');
      if (splitVariants(k.tekst).length > 1) {
        row.appendChild(btn('Losuj ponownie', function () {
          playBuffer = pickVariant(k.tekst);
          inp.value = playBuffer;
          autoGrow(inp);
          inp.focus();
        }, 'tr-icon-btn', 'Wylosuj inny wariant tej komendy.'));
      }
      var sendBtn = el('button', 'tr-btn tr-primary');
      sendBtn.type = 'button';
      sendBtn.textContent = 'Wyślij';
      sendBtn.title = 'Wyślij tę linię do gry i przejdź do następnego kroku.';
      var doSendNow = function () {
        playBuffer = inp.value.replace(/[\r\n]+/g, ' ');
        doSend(sendBtn);
      };
      sendBtn.addEventListener('click', doSendNow);
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); doSendNow(); }
        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); inp.blur(); }
      });
      row.appendChild(sendBtn);
      panel.appendChild(row);
    } else if (k.typ === 'pauza') {
      var line = el('div', 'tr-pauseline');
      line.appendChild(el('span', 'tr-big', 'PAUZA'));
      if (k.sekundy !== undefined && k.sekundy > 0) {
        var cd = el('span', 'tr-countdown', fmtNum(k.sekundy) + 's');
        countdownSpan = cd;
        line.appendChild(cd);
        startPauseTimer(k.sekundy);
      } else {
        line.appendChild(el('span', 'tr-hint', 'kliknij Dalej'));
      }
      panel.appendChild(line);
    }
    return panel;
  }

  function helpContent(box) {
    var h = function (t) { box.appendChild(el('div', 'tr-help-h', t)); };
    var p = function (t) { box.appendChild(el('div', 'tr-help-p', t)); };
    var ul = function (items) {
      var u = el('ul', 'tr-help-ul');
      for (var i = 0; i < items.length; i++) u.appendChild(el('li', 'tr-help-li', items[i]));
      box.appendChild(u);
    };

    box.appendChild(el('div', 'tr-help-title', 'Truwer - asystent odgrywania scen'));

    p('Truwer pozwala przygotować scenę (listę kroków z komend gry) i odegrać ją we własnym tempie, krok po kroku. Każdą linię wysyłasz ręcznie - plugin nigdy nie wysyła nic sam. Tempo ustalasz Ty.');

    h('Otwieranie (rozszerzenie Chrome)');
    ul([
      '/truwer              - otwórz/zamknij (ostatni tryb)',
      '/truwer float        - tryb pływający / toggle',
      '/truwer left         - dok lewy / toggle',
      '/truwer right        - dok prawy / toggle',
      '/truwer help         - tę pomoc',
      '/truwer pomoc        - tę pomoc'
    ]);

    h('Biblioteka i tryby');
    ul([
      'Biblioteka to lista Twoich scen, osobna dla każdej postaci. Tu tworzysz, importujesz, otwierasz, odgrywasz, eksportujesz i usuwasz sceny.',
      'Otwarta scena ma dwa tryby, przełączane w wierszu Tryb: Edycja (budujesz i zmieniasz kroki) oraz Odtwarzanie (odgrywasz scenę).',
      'Powiel tworzy kopię sceny w bibliotece (tytuł z dopiskiem "(kopia)").'
    ]);

    // A10 (fala D): operacje zbiorcze
    h('Operacje zbiorcze');
    ul([
      'Checkbox przy scenie zaznacza ją do operacji zbiorczych; pasek nad listą pokazuje licznik zaznaczonych.',
      'Pobierz JSON/TXT eksportuje wszystkie zaznaczone sceny jednym plikiem; Usuń zaznaczone usuwa je (z potwierdzeniem).',
      'Przyciski zbiorcze są zawsze aktywne - przy pustym zaznaczeniu przypominają, co zrobić.'
    ]);

    h('Rodzaje kroków');
    ul([
      'Komenda - zwykła komenda gry (np. usmiechnij sie, albo długi opis przez powiedz ...). Wysyłana dosłownie. Może być długa - kilka, kilkanaście zdań.',
      'Pauza - przerwa z odliczaniem, jako podpowiedź tempa. Sama nic nie wysyła. Może mieć liczbę sekund.',
      'Notatka - tekst tylko dla Ciebie. Nigdy nie jest wysyłana; prompter ją pomija. Notatka tuż przed krokiem to jego didaskalia: prompter pokazuje ją nad polem kroku (bursztyn).',
      'Mowę pisz przez powiedz <tekst>, nie przez \'<tekst>\' - apostrof sprawia, że klient pokazuje echo wypowiedzi; powiedz tego nie robi, a efekt w grze jest identyczny.'
    ]);

    h('Warianty komendy (znak |)');
    ul([
      'W jednej komendzie możesz podać kilka wersji oddzielonych znakiem |. Przy odgrywaniu prompter wylosuje jedną z nich.',
      'Przykład: usmiechnij sie|skin glowa - czasem wyśle usmiechnij sie, czasem skin glowa.',
      'W prompterze Losuj ponownie wybiera inną wersję.'
    ]);

    // A10 (fala D): szczegoly edytora
    h('Edytor (szczegóły)');
    ul([
      'Typ kroku zmieniasz selectem na wierszu kroku (komenda, pauza, notatka) - tekst przechodzi na nowy typ, o ile się da.',
      'Wstaw dodaje nową komendę poniżej kroku, Powiel kopiuje krok, a strzałki przesuwają go wyżej/niżej.',
      'Usuwanie kroku wymaga potwierdzenia. Sekundy pauzy wpisuj liczbą (np. 5 albo 2.5), maksimum 3600.',
      'Pasek Dodaj krok pamięta ostatnio wybrany typ do czasu wyjścia ze sceny.'
    ]);

    h('Odgrywanie (prompter)');
    ul([
      'Widzisz listę kroków, aktywny jest podświetlony. Kliknij dowolną linię, aby ustawić ją jako aktywną (tak też wracasz, by coś powtórzyć).',
      'Nad przyciskami jest pole do wysłania - dokładnie to, co pójdzie do gry. Możesz je zmienić przed wysłaniem. Trwałe zmiany rób w trybie Edycja.',
      'Wyślij (lub Enter w polu) wysyła linię i przechodzi do następnego kroku. Wstecz i Dalej poruszają się bez wysyłania. Na początek wraca do pierwszego kroku.',
      'Pauza: leci odliczanie. Przy włączonym Po pauzie przejdź dalej prompter sam pokaże następny krok po skończonym odliczaniu (nadal nic nie wysyła).'
    ]);

    h('Import i eksport');
    ul([
      'Importuj plik: wczytaj scenę z .txt (lista komend) lub .json (pełna scena z tytułem i opisem albo pakiet scen).',
      'Eksport zbiorczy JSON zapisuje pakiet scen, który wczytasz z powrotem przez Importuj plik.',
      'Importuj tekst: wklej zawartość bezpośrednio.',
      'Format tekstu: każda linia to jedna komenda; /pauza lub /pauza N to pauza; linia zaczynająca się od # to notatka.',
      'Eksport: JSON (pełna, bezstratna kopia) lub TXT (prosty tekst).',
      'Import jest dosłowny. Natywne pieśni truwerskie używają komend z wiodącym /, a klient rezerwuje / dla aliasów - takie komendy trzeba pozbawić / (w trybie Edycja), żeby trafiły do gry.'
    ]);

    // Fala E: "Zapisz jako..." (uzupelnienie A10)
    h('Zapisz jako…');
    ul([
      'Zbiorczo: pole nazwy obok Pobierz JSON/TXT - wpisz własną nazwę pliku (puste = domyślna truwer-sceny-<data>). Rozszerzenie (.json/.txt) dokleja przycisk - tylko gdy nazwa jeszcze go nie ma (bez dubla).',
      'Per scena: Zapisz jako… w wierszu sceny zapisuje ją jako .json pod nazwą, którą podasz (domyślnie z tytułu).',
      'Nazwy plików są oczyszczane do ASCII (polskie znaki zamieniane na _) - tak działa pobieranie przeglądarki.',
      'Anuluj w formularzu przerywa zapis bez pobierania.'
    ]);

    h('Ważne');
    ul(['Plugin nigdy nie wysyła komend samodzielnie. Każda wysyłka to Twój świadomy klik. To wymóg regulaminu Arkadii.']);
  }

  function renderHelp() {
    if (!contentEl) return;
    var wrap = el('div', 'tr-view');
    var top = el('div', 'tr-row');
    top.appendChild(btn('Powrót', closeHelp, 'tr-icon-btn', 'Wróć do poprzedniego widoku.'));
    wrap.appendChild(top);
    var box = el('div', 'tr-scroll tr-help');
    helpContent(box);
    wrap.appendChild(box);
    contentEl.appendChild(wrap);
  }

  // =========================================================================
  // STYLE
  // =========================================================================

  var STYLE_CSS =
    '.tw-panel{display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;border:1px solid var(--tw-border);border-radius:4px;font-family:monospace;font-size:13px;}' +
    '.tw-panel[data-theme="dark"]{' +
      '--tw-bg:#1a1a1a;--tw-bg2:#242424;--tw-bg3:#2e2e2e;' +
      '--tw-border:#3a3a3a;--tw-border2:#444;' +
      '--tw-text:#e0e0e0;--tw-text2:#aaa;--tw-text3:#777;' +
      '--tw-accent:#4a9eff;--tw-accent-bg:#1a3a5c;--tw-accent-bg-h:#1e4a70;--tw-accent-h:#5aaeff;' +
      '--tw-danger:#ff5555;--tw-danger-bg:#3a1a1a;--tw-danger-bg-h:#4a2020;' +
      '--tw-warn:#ffaa33;--tw-ok:#55cc55;' +
      '--tw-ctrl-bg:#2a2a2a;--tw-ctrl-h:#353535;}' +
    '.tw-panel[data-theme="light"]{' +
      '--tw-bg:#f5f5f5;--tw-bg2:#ebebeb;--tw-bg3:#e0e0e0;' +
      '--tw-border:#ccc;--tw-border2:#bbb;' +
      '--tw-text:#1a1a1a;--tw-text2:#555;--tw-text3:#888;' +
      '--tw-accent:#1a6acc;--tw-accent-bg:#ddeeff;--tw-accent-bg-h:#cce4ff;--tw-accent-h:#0a5abb;' +
      '--tw-danger:#cc2222;--tw-danger-bg:#ffeeee;--tw-danger-bg-h:#ffdddd;' +
      '--tw-warn:#cc7700;--tw-ok:#228822;' +
      '--tw-ctrl-bg:#e8e8e8;--tw-ctrl-h:#d8d8d8;}' +
    '.tw-header{display:flex;align-items:center;gap:4px;padding:4px 6px;background:var(--tw-bg2);border-bottom:1px solid var(--tw-border);flex:0 0 auto;user-select:none;}' +
    '.tw-header-title{font-size:11px;color:var(--tw-text3);margin-left:2px;flex:1 1 auto;overflow:hidden;white-space:nowrap;}' +
    '.tw-hbtn{padding:2px 6px;border:1px solid var(--tw-border2);border-radius:3px;background:var(--tw-ctrl-bg);color:var(--tw-text2);cursor:pointer;font-size:11px;font-family:monospace;line-height:1.4;}' +
    '.tw-hbtn:hover{background:var(--tw-ctrl-h);}' +
    '.tw-hbtn.tw-active{border-color:var(--tw-accent);color:var(--tw-accent);}' +
    '.tw-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;background:var(--tw-bg);overflow:hidden;}' +
    '.tw-resize-e{position:absolute;top:0;right:0;width:5px;height:100%;cursor:ew-resize;z-index:1;}' +
    '.tw-resize-w{position:absolute;top:0;left:0;width:5px;height:100%;cursor:ew-resize;z-index:1;}' +
    '.tw-resize-s{position:absolute;bottom:0;left:0;width:100%;height:5px;cursor:ns-resize;z-index:1;}' +
    '.tw-resize-se{position:absolute;bottom:0;right:0;width:10px;height:10px;cursor:se-resize;z-index:2;}' +
    '.tw-dock-resize{position:absolute;top:0;width:5px;height:100%;cursor:ew-resize;z-index:1;background:transparent;}' +
    '.tr-root{display:flex;flex-direction:column;gap:0.4rem;flex:1 1 auto;min-height:0;min-width:0;box-sizing:border-box;padding:0.6rem;}' +
    '.tr-content{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;gap:0.4rem;}' +
    '.tr-view{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;gap:0.4rem;}' +
    '.tr-row{display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;}' +
    '.tr-grow{flex:1;min-width:0;}' +
    '.tr-scroll{flex:1 1 auto;min-height:4rem;overflow-y:auto;border:1px solid var(--tw-border);border-radius:0.25rem;padding:0.4rem;display:flex;flex-direction:column;gap:0.35rem;}' +
    '.tr-input,.tr-select,.tr-textarea{padding:0.3rem 0.5rem;border:1px solid var(--tw-border2);border-radius:0.25rem;background-color:var(--tw-bg2);color:var(--tw-text);font-size:13px;box-sizing:border-box;font-family:monospace;}' +
    '.tr-input::placeholder,.tr-textarea::placeholder{color:var(--tw-text3);}' +
    '.tr-input:focus,.tr-select:focus,.tr-textarea:focus{border-color:var(--tw-accent);outline:none;}' +
    '.tr-select option{background-color:var(--tw-bg2);color:var(--tw-text);}' +
    '.tr-textarea{resize:vertical;min-height:5rem;width:100%;font-family:monospace;}' +
    '.tr-num{width:7rem;flex:0 0 auto;}' +
    '.tr-btn{padding:0.3rem 0.75rem;border:none;border-radius:0.25rem;background-color:var(--tw-accent-bg);color:var(--tw-accent);cursor:pointer;font-size:13px;font-family:monospace;}' +
    '.tr-btn:hover:not(:disabled){background-color:var(--tw-accent-bg-h);}' +
    '.tr-btn:disabled{opacity:0.5;cursor:default;}' +
    '.tr-primary{font-weight:600;}' +
    '.tr-icon-btn{padding:0.2rem 0.5rem;border:1px solid var(--tw-border2);border-radius:0.25rem;background-color:var(--tw-ctrl-bg);color:var(--tw-text);cursor:pointer;font-size:12px;line-height:1.2;font-family:monospace;}' +
    '.tr-icon-btn:hover:not(:disabled){background-color:var(--tw-ctrl-h);}' +
    '.tr-icon-btn:disabled{opacity:0.5;cursor:default;}' +
    '.tr-btn-danger{background-color:var(--tw-danger-bg);color:var(--tw-danger);border-color:var(--tw-danger);}' +
    '.tr-btn-danger:hover:not(:disabled){background-color:var(--tw-danger-bg-h);}' +
    '.tr-active{border-color:var(--tw-accent);color:var(--tw-accent);}' +
    '.tr-item{display:flex;flex-direction:column;gap:0.2rem;border:1px solid var(--tw-border);border-radius:0.25rem;padding:0.4rem;}' +
    '.tr-item-title{font-size:13px;font-weight:600;color:var(--tw-text);overflow-wrap:anywhere;}' +
    '.tr-item-meta{font-size:11px;color:var(--tw-text2);}' +
    '.tr-item-acts{display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.2rem;}' +
    // Fala E: "Zapisz jako..." - inline-form w wierszu + pole nazwy zbiorczej
    '.tr-saveas{display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.25rem;padding:0.3rem 0.45rem;border:1px dashed var(--tw-border);border-radius:0.25rem;}' +
    '.tr-saveas .tr-input{flex:1 1 12rem;}' +
    '.tr-bulk-name{width:11rem;}' +
    '.tr-erow{display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;}' +
    '.tr-erow-acts{display:flex;gap:0.25rem;margin-left:auto;}' +
    '.tr-panel{display:flex;flex-direction:column;gap:0.4rem;border:1px solid var(--tw-border);border-radius:0.25rem;padding:0.4rem;}' +
    '.tr-step{font-size:12px;padding:0.2rem 0.35rem;border-radius:0.2rem;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--tw-text);}' +
    '.tr-step-current{background-color:var(--tw-accent-bg);color:var(--tw-accent);border:1px solid var(--tw-accent);}' +
    '.tr-step-note{color:#e0b85c;font-style:italic;}' +
    // Fala D (F18-E, V3.2): panel didaskalii - tlo LITERALNIE #2b2517 i
    // lewy pasek 3 px LITERALNIE #e0b85c (wzorzec Mudleta STYLE.didPanel
    // wygrywa ze zmiennymi motywu); tekst bursztyn+kursywa jak notatki.
    '.tr-did{background-color:#2b2517;border-left:3px solid #e0b85c;border-radius:0.2rem;padding:0.3rem 0.45rem;display:flex;flex-direction:column;gap:0.15rem;}' +
    '.tr-did-line{font-size:12px;color:#e0b85c;font-style:italic;white-space:pre-wrap;overflow-wrap:anywhere;}' +
    '.tr-step-pause{color:var(--tw-text2);}' +
    '.tr-big{font-size:14px;font-weight:600;color:var(--tw-text);}' +
    '.tr-pauseline{display:flex;align-items:center;gap:0.5rem;}' +
    '.tr-countdown{font-size:14px;font-weight:600;color:var(--tw-warn);}' +
    '.tr-ready{color:var(--tw-accent);}' +
    '.tr-prog{font-size:12px;color:var(--tw-text2);margin-left:auto;}' +
    '.tr-hint{font-size:11px;color:var(--tw-text3);}' +
    '.tr-empty{font-size:12px;color:var(--tw-text3);text-align:center;padding:0.6rem;}' +
    '.tr-check{display:inline-flex;align-items:center;gap:0.3rem;font-size:12px;color:var(--tw-text2);cursor:pointer;}' +
    '.tr-status{font-size:12px;min-height:1rem;color:var(--tw-text2);}' +
    '.tr-c-error{color:var(--tw-danger);}' +
    '.tr-c-ok{color:var(--tw-ok);}' +
    '.tr-spacer{flex:1 1 auto;}' +
    '.tr-head{display:flex;flex-direction:column;gap:0.4rem;}' +
    '.tr-step-click{cursor:pointer;}' +
    '.tr-step-click:hover{background-color:var(--tw-ctrl-h);}' +
    '.tr-help{gap:0.3rem;}' +
    '.tr-help-title{font-size:15px;font-weight:600;color:var(--tw-text);margin-bottom:0.3rem;}' +
    '.tr-help-h{font-size:13px;font-weight:600;color:var(--tw-accent);margin-top:0.5rem;}' +
    '.tr-help-p{font-size:12px;color:var(--tw-text);line-height:1.4;}' +
    '.tr-help-ul{margin:0.2rem 0 0.2rem 1rem;padding:0;}' +
    '.tr-help-li{font-size:12px;color:var(--tw-text2);line-height:1.4;margin-bottom:0.2rem;}' +
    '.tr-line{min-height:1.9rem;resize:none;overflow:hidden;width:auto;white-space:pre-wrap;overflow-wrap:anywhere;}' +
    '.tr-cmd{font-family:monospace;padding:1px 6px;border:1px solid var(--tw-border);border-radius:4px;}' +
    '.tr-bulk{border-bottom:1px solid var(--tw-border);padding-bottom:0.4rem;}' +
    '.tr-item-head{display:flex;align-items:center;gap:0.4rem;}' +
    '.tr-item-head .tr-item-title{flex:1 1 auto;min-width:0;}' +
    '.tr-item-check{flex:0 0 auto;}' +
    '.tr-item-sel{border-color:var(--tw-accent);}' +
    '.tr-btn:disabled,.tr-icon-btn:disabled{opacity:0.45;cursor:default;}' +
    '.tr-footer{text-align:right;margin-top:0.4rem;color:var(--tw-text3);font-size:11px;opacity:0.7;}';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = STYLE_CSS;
    (document.head || document.body).appendChild(st);
  }

  function removeStyle() {
    var st = document.getElementById(STYLE_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  // =========================================================================
  // PANEL MANAGEMENT
  // =========================================================================

  function dockClient(side, w) {
    var client = document.getElementById('client');
    if (!client) return;
    if (side === 'left') {
      client.style.marginLeft  = w + 'px';
      client.style.width       = 'calc(100% - ' + w + 'px)';
      client.style.marginRight = '';
    } else {
      client.style.marginRight = w + 'px';
      client.style.width       = 'calc(100% - ' + w + 'px)';
      client.style.marginLeft  = '';
    }
  }

  function undockClient() {
    var client = document.getElementById('client');
    if (!client) return;
    client.style.marginLeft  = '';
    client.style.marginRight = '';
    client.style.width       = '';
  }

  function applyPanelStyle(m, w) {
    if (!panelEl) return;
    w = w || loadDockWidth();
    if (m === 'float') {
      var pos = loadPos();
      var sz  = loadSize();
      panelEl.style.cssText = 'position:fixed;left:' + pos.x + 'px;top:' + pos.y + 'px;' +
        'width:' + sz.w + 'px;height:' + sz.h + 'px;z-index:' + Z_PANEL + ';';
      undockClient();
    } else if (m === 'left') {
      panelEl.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:100vh;z-index:' + Z_PANEL + ';';
      dockClient('left', w);
    } else {
      panelEl.style.cssText = 'position:fixed;right:0;top:0;width:' + w + 'px;height:100vh;z-index:' + Z_PANEL + ';';
      dockClient('right', w);
    }
    panelMode = m;
  }

  function buildPanel() {
    var theme = loadTheme();
    var p = el('div', 'tw-panel');
    p.setAttribute('data-theme', theme);

    // Header
    var hdr = el('div', 'tw-header');

    var mLeft = el('button', 'tw-hbtn', '\u25e7');
    mLeft.title = 'Dok lewy';
    mLeft.addEventListener('click', function () { headerModeClick('left'); });

    var mRight = el('button', 'tw-hbtn', '\u25e8');
    mRight.title = 'Dok prawy';
    mRight.addEventListener('click', function () { headerModeClick('right'); });

    var mFloat = el('button', 'tw-hbtn', '\u229e');
    mFloat.title = 'Tryb pływający';
    mFloat.addEventListener('click', function () { headerModeClick('float'); });

    function updateHeaderActive(m) {
      mLeft.classList.toggle('tw-active', m === 'left');
      mRight.classList.toggle('tw-active', m === 'right');
      mFloat.classList.toggle('tw-active', m === 'float');
    }
    updateHeaderActive(loadMode());

    var origHeaderModeClick = headerModeClick;
    // wrap to also update active state
    mLeft.addEventListener('click', function () { updateHeaderActive('left'); });
    mRight.addEventListener('click', function () { updateHeaderActive('right'); });
    mFloat.addEventListener('click', function () { updateHeaderActive('float'); });

    var themeBtn = el('button', 'tw-hbtn', theme === 'dark' ? '\u2600' : '\u263d');
    themeBtn.title = 'Przełącz motyw';
    themeBtn.addEventListener('click', function () {
      var t = p.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      p.setAttribute('data-theme', t);
      themeBtn.textContent = t === 'dark' ? '\u2600' : '\u263d';
      saveTheme(t);
    });

    var closeBtn = el('button', 'tw-hbtn', '\u00d7');
    closeBtn.title = 'Zamknij';
    closeBtn.addEventListener('click', function () { closePanel(); });

    hdr.appendChild(mLeft);
    hdr.appendChild(mRight);
    hdr.appendChild(mFloat);
    hdr.appendChild(el('div', 'tw-header-title', 'Truwer - asystent odgrywania scen'));
    hdr.appendChild(themeBtn);
    hdr.appendChild(closeBtn);
    p.appendChild(hdr);

    // Body
    var body = el('div', 'tw-body');

    rootEl    = el('div', 'tr-root');
    rootEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ev.stopPropagation(); });
    contentEl = el('div', 'tr-content');
    statusEl  = el('div', 'tr-status');
    var footer = el('div', 'tr-footer', 'v' + EXT_VERSION + ' | ' + EXT_DATE);
    rootEl.appendChild(contentEl);
    rootEl.appendChild(statusEl);
    rootEl.appendChild(footer);
    body.appendChild(rootEl);
    p.appendChild(body);

    panelEl = p;

    // Drag (float header)
    hdr.style.cursor = 'default';
    hdr.addEventListener('mousedown', function (e) {
      if (panelMode !== 'float') return;
      if (e.target !== hdr && e.target !== hdr.querySelector('.tw-header-title')) return;
      e.preventDefault();
      var startX = e.clientX - panelEl.offsetLeft;
      var startY = e.clientY - panelEl.offsetTop;
      var onMove = function (ev) {
        var x = Math.max(0, Math.min(ev.clientX - startX, window.innerWidth - panelEl.offsetWidth));
        var y = Math.max(0, Math.min(ev.clientY - startY, window.innerHeight - panelEl.offsetHeight));
        panelEl.style.left = x + 'px';
        panelEl.style.top  = y + 'px';
      };
      var onUp = function (ev) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        savePos(panelEl.offsetLeft, panelEl.offsetTop);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    hdr.style.cursor = 'grab';

    // Resize float: SE corner
    var rSe = el('div', 'tw-resize-se');
    p.style.position = 'relative';
    rSe.addEventListener('mousedown', function (e) {
      if (panelMode !== 'float') return;
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var startW = panelEl.offsetWidth, startH = panelEl.offsetHeight;
      var onMove = function (ev) {
        var w = Math.max(MIN_PANEL_W, Math.min(startW + ev.clientX - startX, window.innerWidth * 0.9));
        var h = Math.max(MIN_PANEL_H, Math.min(startH + ev.clientY - startY, window.innerHeight * 0.9));
        panelEl.style.width  = w + 'px';
        panelEl.style.height = h + 'px';
      };
      var onUp = function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveSize(panelEl.offsetWidth, panelEl.offsetHeight);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    p.appendChild(rSe);

    // Resize dock: left side when right-dock, right side when left-dock
    var rDock = el('div', 'tw-dock-resize');
    rDock.addEventListener('mousedown', function (e) {
      if (panelMode === 'float') return;
      e.preventDefault();
      var startX = e.clientX;
      var startW = panelEl.offsetWidth;
      var onMove = function (ev) {
        var maxW = Math.floor(window.innerWidth * MAX_DOCK_RATIO);
        var w;
        if (panelMode === 'left') {
          w = Math.max(MIN_PANEL_W, Math.min(startW + ev.clientX - startX, maxW));
        } else {
          w = Math.max(MIN_PANEL_W, Math.min(startW - (ev.clientX - startX), maxW));
        }
        panelEl.style.width = w + 'px';
        dockClient(panelMode, w);
      };
      var onUp = function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveDockWidth(panelEl.offsetWidth);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    p.appendChild(rDock);

    // Position dock resize handle dynamically
    function updateDockResizeHandle() {
      if (panelMode === 'left') {
        rDock.style.cssText = 'position:absolute;top:0;right:0;width:5px;height:100%;cursor:ew-resize;z-index:1;';
      } else if (panelMode === 'right') {
        rDock.style.cssText = 'position:absolute;top:0;left:0;width:5px;height:100%;cursor:ew-resize;z-index:1;';
      } else {
        rDock.style.cssText = 'display:none;';
      }
      rSe.style.display = panelMode === 'float' ? '' : 'none';
    }

    // Expose update fn on panelEl
    p._updateResizeHandles = updateDockResizeHandle;

    return p;
  }

  function openPanel(m) {
    if (panelEl) return;
    injectStyle();
    library = loadLibrary();
    if (currentId && !library.find(function (s) { return s.id === currentId; })) {
      currentId = null; view = 'library';
    }
    buildPanel();
    document.body.appendChild(panelEl);
    applyPanelStyle(m);
    if (panelEl._updateResizeHandles) panelEl._updateResizeHandles();
    render();
  }

  function closePanel() {
    if (!panelEl) return;
    flushSave();
    stopPauseTimer();
    undockClient();
    if (panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
    panelEl   = null;
    panelMode = null;
    rootEl    = null;
    contentEl = null;
    statusEl  = null;
    currentStepEl = null;
    countdownSpan = null;
    importTitleEl = null;
    importTextEl  = null;
    removeStyle();
  }

  function switchMode(m) {
    if (!panelEl) return;
    applyPanelStyle(m);
    if (panelEl._updateResizeHandles) panelEl._updateResizeHandles();
    // update header active state
    var btns = panelEl.querySelectorAll('.tw-hbtn');
    // btns[0]=left [1]=right [2]=float
    if (btns.length >= 3) {
      btns[0].classList.toggle('tw-active', m === 'left');
      btns[1].classList.toggle('tw-active', m === 'right');
      btns[2].classList.toggle('tw-active', m === 'float');
    }
  }

  function panelToggle() {
    var m = loadMode();
    if (panelEl && panelMode === m) { closePanel(); }
    else if (!panelEl) { openPanel(m); }
    else { switchMode(m); }
  }

  function panelSetMode(m) {
    saveMode(m);
    if (panelEl && panelMode === m) { closePanel(); }
    else if (!panelEl) { openPanel(m); }
    else { switchMode(m); }
  }

  function headerModeClick(m) {
    saveMode(m);
    if (panelMode !== m) switchMode(m);
  }

  function panelOpenHelp() {
    if (!panelEl) {
      openPanel(loadMode());
      view = 'help';
      render();
    } else {
      openHelp();
    }
  }

  // =========================================================================
  // PRINT TO TERMINAL
  // =========================================================================

  function printToTerminal(lines) {
    try {
      if (typeof Output !== 'undefined' && typeof Text !== 'undefined') {
        var text = ['', '', '---'].concat(lines).concat(['---', '', '']).join('\n');
        Output.send(Text.parse_patterns(text));
      }
    } catch (e) {}
  }

  // =========================================================================
  // UPDATE CHECK
  // =========================================================================

  function versionNewer(remote, local) {
    var r = String(remote).split('.').map(Number);
    var l = String(local).split('.').map(Number);
    var len = Math.max(r.length, l.length);
    for (var i = 0; i < len; i++) {
      var a = r[i] || 0, b = l[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return false;
  }

  function showUpdateNotification(version, zipUrl) {
    if (window.__arkadia_update_active__) {
      document.addEventListener('arkadia_update_dismissed', function handler() {
        document.removeEventListener('arkadia_update_dismissed', handler);
        showUpdateNotification(version, zipUrl);
      }, { once: true });
      return;
    }
    if (document.getElementById('arkadia-truwer-update')) return;
    window.__arkadia_update_active__ = true;

    function dismiss() {
      overlay.remove();
      window.__arkadia_update_active__ = false;
      document.dispatchEvent(new CustomEvent('arkadia_update_dismissed'));
    }

    var overlay = document.createElement('div');
    overlay.id = 'arkadia-truwer-update';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'z-index:' + Z_UPDATE + ';display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.6);';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1a1a1a;border:2px solid #555;border-radius:8px;' +
      'padding:28px 36px;font-family:monospace;color:#e0e0e0;text-align:center;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.8);max-width:420px;width:90%;';

    var title = document.createElement('div');
    title.textContent = 'arkadia_truwer';
    title.style.cssText = 'font-size:20px;font-weight:bold;color:#fff;margin-bottom:10px;';

    var msg = document.createElement('div');
    msg.textContent = 'Dostępna nowa wersja ' + version;
    msg.style.cssText = 'font-size:16px;color:#bbb;margin-bottom:6px;';

    var sub = document.createElement('div');
    sub.textContent = 'Pobierz ZIP, rozpakuj do tego samego folderu, odśwież rozszerzenie.';
    sub.style.cssText = 'font-size:12px;color:#888;margin-bottom:24px;';

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    var link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Pobierz';
    link.style.cssText = 'background:#2a6496;color:#fff;padding:10px 28px;' +
      'border-radius:4px;text-decoration:none;font-size:15px;cursor:pointer;';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      fetch(zipUrl)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'arkadia_truwer.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
          setTimeout(function () { dismiss(); }, 300);
        })
        .catch(function () {
          window.open(zipUrl);
          setTimeout(function () { dismiss(); }, 300);
        });
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.textContent = 'Później';
    dismissBtn.style.cssText = 'background:#333;border:1px solid #555;color:#aaa;' +
      'padding:10px 20px;border-radius:4px;font-size:15px;cursor:pointer;font-family:monospace;';
    dismissBtn.onclick = function () { dismiss(); };

    row.appendChild(link);
    row.appendChild(dismissBtn);
    box.appendChild(title);
    box.appendChild(msg);
    box.appendChild(sub);
    box.appendChild(row);
    overlay.appendChild(box);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) dismiss();
    });

    document.body.appendChild(overlay);
  }

  // =========================================================================
  // INIT
  // =========================================================================

  loadPrefs();
  library = loadLibrary();
  view    = 'library';
  mode    = 'edit';

  var _origInput = Input.send;
  Input.send = function (cmd) {
    var t = (cmd || '').trim();
    var m = t.match(/^\/truwer(?:\s+(help|pomoc|left|right|float))?$/i);
    if (m) {
      var arg = m[1] ? m[1].toLowerCase() : null;
      if (arg === 'help' || arg === 'pomoc') {
        printToTerminal([
          'Truwer v' + EXT_VERSION + ' | ' + EXT_DATE,
          '',
          'Komendy:',
          '  /truwer              - otworz/zamknij (ostatni tryb)',
          '  /truwer float        - tryb plywajacy / toggle',
          '  /truwer left         - dok lewy / toggle',
          '  /truwer right        - dok prawy / toggle',
          '  /truwer help         - ta pomoc',
          '  /truwer pomoc        - ta pomoc',
          '',
          'Sceny per postac, edytor krokow, prompter z reczna wysylka.',
          'Plugin nigdy nie wysyla komend samodzielnie.'
        ]);
      } else if (arg === 'left' || arg === 'right' || arg === 'float') {
        panelSetMode(arg);
      } else {
        panelToggle();
      }
      return;
    }
    _origInput(cmd);
  };

  setTimeout(function () {
    fetch(UPDATE_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.version && versionNewer(data.version, EXT_VERSION)) {
          var zipFile = data.zip || ('arkadia_truwer_' + String(data.version).replace(/\./g, '_') + '.zip');
          showUpdateNotification(data.version, 'https://isithunzi000.github.io/www-arkadia_truwer/' + zipFile);
        }
      })
      .catch(function () {});
  }, 1000);

})();
