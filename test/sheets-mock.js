/**
 * 구글 스프레드시트 흉내 (테스트 전용)
 *
 * 실제 SpreadsheetApp 을 Node 에서 돌릴 수 없어서, 설치 경로를 끝까지 실행해 보기 위한
 * 최소한의 가짜를 만든다. 핵심은 "구글이 실제로 막는 규칙"을 똑같이 막는 것이다.
 *
 *   · 병합된 셀을 가르는 행/열 고정 → 예외
 *   · 고정 경계를 가로지르는 병합 → 예외
 *   · setValues 의 행·열 개수가 범위와 다르면 → 예외
 *   · 존재하지 않는 메서드를 부르면 → 예외 (오타를 잡는다)
 *
 * v3.0.0 초판에서 "처음 설치를 여러 번 눌러야 시트가 하나씩 생기고 학생명단은 끝내
 * 안 생기는" 문제가 있었는데, 원인이 첫 번째 규칙이었다. 이 가짜로 그 증상을 재현했다.
 */

function colToA(c) { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
function aToCol(a) { let n = 0; for (const ch of a) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function parseA1(a1) {
  const m = String(a1).match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) throw new Error('mock: A1 표기를 해석하지 못함 ' + a1);
  const c1 = aToCol(m[1]), r1 = +m[2];
  const c2 = m[3] ? aToCol(m[3]) : c1, r2 = m[4] ? +m[4] : r1;
  return [r1, c1, r2 - r1 + 1, c2 - c1 + 1];
}

/** 알 수 없는 메서드는 예외 — 실제 Apps Script 에도 없는 이름을 부르는 오타를 잡는다 */
function strict(obj, label) {
  return new Proxy(obj, {
    get(t, k) {
      if (k in t || typeof k === 'symbol' || k === 'then' || k === 'toJSON') return t[k];
      throw new Error('mock: ' + label + '.' + String(k) + ' 는 구현되지 않았거나 존재하지 않는 메서드');
    }
  });
}

function makeSheet(ss, name) {
  const vals = new Map();    // "r,c" -> 값
  const forms = new Map();   // "r,c" -> 수식
  const merges = [];
  let frozenRows = 0, frozenCols = 0, maxRows = 1000, maxCols = 26;
  const key = (r, c) => r + ',' + c;

  const images = [];
  const sheet = {
    __images: images,
    __notesMap: new Map(),
    insertImage(blob, col, row, ox, oy) {
      const img = { blob, col, row, ox: ox || 0, oy: oy || 0, script: '', alt: '', w: 0, h: 0 };
      const api = strict({
        assignScript(fn) { img.script = fn; return api; }, getScript: () => img.script,
        setAltTextTitle(t) { img.alt = t; return api; }, setAltTextDescription() { return api; },
        setWidth(w) { img.w = w; return api; }, setHeight(h) { img.h = h; return api; },
        remove() { const i = images.indexOf(api); if (i >= 0) images.splice(i, 1); },
        __img: img
      }, 'OverGridImage');
      images.push(api); return api;
    },
    getImages: () => images.slice(),
    getActiveRange: () => { const r = ss.__activeRange; return r && r.getSheet().getName() === name ? r : null; },
    getMaxColumns: () => maxCols,
    insertColumnsAfter(after, n) { maxCols += n; return proxy; },
    __merges: merges, __vals: vals,
    get __frozen() { return { rows: frozenRows, cols: frozenCols }; },
    getName: () => name,
    getParent: () => ss,
    getLastRow() { let m = 0; for (const k of vals.keys()) m = Math.max(m, +k.split(',')[0]); for (const k of forms.keys()) m = Math.max(m, +k.split(',')[0]); return m; },
    getLastColumn() { let m = 0; for (const k of vals.keys()) m = Math.max(m, +k.split(',')[1]); for (const k of forms.keys()) m = Math.max(m, +k.split(',')[1]); return m; },
    getMaxRows: () => maxRows,
    insertRowsAfter(after, n) { maxRows += n; return proxy; },
    clear() { vals.clear(); forms.clear(); return proxy; },          // 실제처럼 병합은 남긴다
    setFrozenRows(n) {
      for (const m of merges) if (m.r1 <= n && m.r2 > n)
        throw new Error("You can't freeze rows which contain only part of a merged cell.");
      frozenRows = n; return proxy;
    },
    setFrozenColumns(n) {
      for (const m of merges) if (m.c1 <= n && m.c2 > n)
        throw new Error("You can't freeze columns which contain only part of a merged cell.");
      frozenCols = n; return proxy;
    },
    appendRow(row) { const r = sheet.getLastRow() + 1; row.forEach((v, i) => { if (v !== '' && v != null) vals.set(key(r, i + 1), v); }); return proxy; },
    deleteRow(r) {
      const nv = new Map();
      for (const [k, v] of vals) { const [rr, cc] = k.split(',').map(Number); if (rr < r) nv.set(k, v); else if (rr > r) nv.set(key(rr - 1, cc), v); }
      vals.clear(); for (const [k, v] of nv) vals.set(k, v); return proxy;
    },
    setColumnWidth() { return proxy; }, setRowHeight() { return proxy; }, setRowHeights() { return proxy; },
    setHiddenGridlines() { return proxy; }, setConditionalFormatRules() { return proxy; },
    getRange(a, b, c, d) {
      let r1, c1, nr, nc;
      if (typeof a === 'string') [r1, c1, nr, nc] = parseA1(a);
      else { r1 = a; c1 = b; nr = c || 1; nc = d || 1; }
      if (r1 < 1 || c1 < 1 || nr < 1 || nc < 1) throw new Error('mock: 잘못된 범위 ' + [r1, c1, nr, nc]);
      if (r1 + nr - 1 > maxRows) throw new Error('mock: 범위가 시트 행 수(' + maxRows + ')를 넘음');
      if (c1 + nc - 1 > maxCols) throw new Error('The coordinates of the range are outside the dimensions of the sheet. (열 ' + (c1 + nc - 1) + ' > ' + maxCols + ')');
      return makeRange(sheet, proxy, r1, c1, nr, nc, vals, forms, merges, () => ({ frozenRows, frozenCols }));
    }
  };
  const proxy = strict(sheet, 'Sheet(' + name + ')');
  return proxy;
}

function makeRange(sheet, sheetProxy, r1, c1, nr, nc, vals, forms, merges, frozen) {
  const key = (r, c) => r + ',' + c;
  const each = fn => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fn(r1 + i, c1 + j, i, j); };
  const range = {
    getRow: () => r1, getColumn: () => c1, getNumRows: () => nr, getNumColumns: () => nc,
    getSheet: () => sheetProxy,
    getA1Notation: () => colToA(c1) + r1 + ((nr > 1 || nc > 1) ? ':' + colToA(c1 + nc - 1) + (r1 + nr - 1) : ''),
    getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = vals.get(key(r1 + i, c1 + j)); row.push(v === undefined ? '' : v); } out.push(row); } return out; },
    getValue() { const v = vals.get(key(r1, c1)); return v === undefined ? '' : v; },
    getDisplayValue() { const v = vals.get(key(r1, c1)); return v === undefined ? '' : String(v); },
    activate() { sheetProxy.getParent().setActiveSheet(sheetProxy); sheetProxy.getParent().__setActiveRange(proxy); return proxy; },
    getFormula() { return forms.get(key(r1, c1)) || ''; },
    getNote() { return sheet.__notesMap.get(key(r1, c1)) || ''; },
    setNote(n) { each((r, c) => { if (n) sheet.__notesMap.set(key(r, c), String(n)); else sheet.__notesMap.delete(key(r, c)); }); return proxy; },
    getNotes() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(sheet.__notesMap.get(key(r1 + i, c1 + j)) || ''); out.push(row); } return out; },
    setNotes(arr) {
      if (arr.length !== nr || arr.some(r => r.length !== nc)) throw new Error('mock: setNotes 크기 불일치');
      each((r, c, i, j) => { const n = arr[i][j]; if (n) sheet.__notesMap.set(key(r, c), String(n)); else sheet.__notesMap.delete(key(r, c)); }); return proxy;
    },
    getFormulas() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(forms.get(key(r1 + i, c1 + j)) || ''); out.push(row); } return out; },
    setValues(arr) {
      if (!Array.isArray(arr) || arr.length !== nr || arr.some(r => !Array.isArray(r) || r.length !== nc))
        throw new Error('The number of rows/columns in the data does not match the range. 범위 ' + nr + 'x' + nc + ' / 데이터 ' + arr.length + 'x' + (arr[0] || []).length);
      each((r, c, i, j) => {
        const v = arr[i][j];
        if (typeof v === 'string' && v.charAt(0) === '=') { forms.set(key(r, c), v); vals.delete(key(r, c)); }
        else { forms.delete(key(r, c)); if (v === '' || v == null) vals.delete(key(r, c)); else vals.set(key(r, c), v); }
      });
      return proxy;
    },
    setValue(v) { each((r, c) => { forms.delete(key(r, c)); if (v === '' || v == null) vals.delete(key(r, c)); else vals.set(key(r, c), v); }); return proxy; },
    setFormula(f) { each((r, c) => { forms.set(key(r, c), f); vals.delete(key(r, c)); }); return proxy; },
    setFormulas(arr) {
      if (arr.length !== nr || arr.some(r => r.length !== nc)) throw new Error('mock: setFormulas 크기 불일치');
      each((r, c, i, j) => { forms.set(key(r, c), arr[i][j]); vals.delete(key(r, c)); }); return proxy;
    },
    clearContent() { each((r, c) => { vals.delete(key(r, c)); forms.delete(key(r, c)); }); return proxy; },
    insertCheckboxes() { each((r, c) => { const k = key(r, c); if (!vals.has(k)) vals.set(k, false); }); return proxy; },
    setRichTextValue(rt) { vals.set(key(r1, c1), rt.text); return proxy; },
    merge() {
      const r2 = r1 + nr - 1, c2 = c1 + nc - 1, f = frozen();
      if (f.frozenCols && c1 <= f.frozenCols && c2 > f.frozenCols) throw new Error("You can't merge frozen and non-frozen columns.");
      if (f.frozenRows && r1 <= f.frozenRows && r2 > f.frozenRows) throw new Error("You can't merge frozen and non-frozen rows.");
      for (let i = merges.length - 1; i >= 0; i--) {
        const m = merges[i];
        const overlap = !(m.r2 < r1 || m.r1 > r2 || m.c2 < c1 || m.c1 > c2);
        const inside = m.r1 >= r1 && m.r2 <= r2 && m.c1 >= c1 && m.c2 <= c2;
        if (overlap && !inside) throw new Error('You must select all cells in a merged range to merge or unmerge them.');
        if (overlap) merges.splice(i, 1);
      }
      merges.push({ r1, c1, r2, c2 }); return proxy;
    },
    breakApart() {
      const r2 = r1 + nr - 1, c2 = c1 + nc - 1;
      for (let i = merges.length - 1; i >= 0; i--) {
        const m = merges[i];
        const overlap = !(m.r2 < r1 || m.r1 > r2 || m.c2 < c1 || m.c1 > c2);
        const inside = m.r1 >= r1 && m.r2 <= r2 && m.c1 >= c1 && m.c2 <= c2;
        if (overlap && !inside) throw new Error('You must select all cells in a merged range to merge or unmerge them.');
        if (overlap) merges.splice(i, 1);
      }
      return proxy;
    }
  };
  ['setBackground', 'setFontColor', 'setFontWeight', 'setFontSize', 'setWrap', 'setVerticalAlignment',
   'setDataValidation', 'setNumberFormat', 'setHorizontalAlignment', 'clearDataValidations'].forEach(m => { range[m] = () => proxy; });
  const proxy = strict(range, 'Range(' + range.getA1Notation() + ')');
  return proxy;
}

function makeSpreadsheet() {
  const sheets = [];
  let active = null;
  const toasts = [];
  const ss = {
    __toasts: toasts,
    __activeRange: null,
    __setActiveRange(r) { ss.__activeRange = r; },
    getId: () => ss.__id || 'CURRENT_SHEET_ID_0000000000000',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/' + (ss.__id || 'CURRENT_SHEET_ID_0000000000000') + '/edit',
    __id: '',
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    getSheets: () => sheets.slice(),
    insertSheet(n) {
      if (ss.getSheetByName(n)) throw new Error('A sheet with the name "' + n + '" already exists.');
      const s = makeSheet(proxy, n); sheets.push(s); active = s; return s;
    },
    deleteSheet(s) { const i = sheets.indexOf(s); if (i >= 0) sheets.splice(i, 1); },
    getActiveSheet: () => active || sheets[0],
    setActiveSheet(s) { active = s; return s; },
    moveActiveSheet(pos) { const i = sheets.indexOf(active); sheets.splice(i, 1); sheets.splice(pos - 1, 0, active); },
    toast(m) { toasts.push(m); }
  };
  const proxy = strict(ss, 'Spreadsheet');
  proxy.insertSheet('시트1');           // 새 스프레드시트의 기본 시트
  return proxy;
}

function builder(fields, build) {
  const b = {}; const st = {};
  fields.forEach(f => { b[f] = (...a) => { st[f] = a; return b; }; });
  b.build = () => build(st);
  return b;
}

function makeGlobals() {
  const ss = makeSpreadsheet();
  const fetchBox = { calls: [], handler: () => { throw new Error('mock: 네트워크 없음'); } };
  const props = () => { const m = new Map(); return {
    getProperty: k => (m.has(k) ? m.get(k) : null), setProperty: (k, v) => { m.set(k, String(v)); },
    deleteProperty: k => { m.delete(k); }, deleteAllProperties: () => m.clear() }; };
  const docProps = props(), userProps = props();
  const alerts = [];
  const ui = {
    alert: (...a) => { alerts.push(a.join(' | ')); return 'OK'; },
    prompt: () => ({ getSelectedButton: () => 'CANCEL', getResponseText: () => '' }),
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
    Button: { OK: 'OK', YES: 'YES', NO: 'NO', CANCEL: 'CANCEL' },
    createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addSubMenu: () => m, addToUi: () => m }; return m; },
    showModalDialog() {}, showModelessDialog() {}, showSidebar() {}
  };
  const templates = [];
  const triggers = [];
  const drive = { files: {}, folders: {} };
  const out = () => { const o = { setWidth() { return o; }, setHeight() { return o; }, setTitle() { return o; } }; return o; };
  const blob = (bytes, type, name) => ({ getBytes: () => bytes, getName: () => name, getContentType: () => type,
                                        getDataAsString: () => Buffer.from(bytes).toString('utf8') });
  return {
    __ss: ss, __alerts: alerts, __docProps: docProps, __userProps: userProps, __templates: templates,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getActiveRange: () => ss.__activeRange,
      getUi: () => ui,
      flush() {},
      newDataValidation: () => builder(['requireValueInList', 'setAllowInvalid', 'setHelpText'], st => ({ list: st.requireValueInList })),
      newRichTextValue: () => builder(['setText', 'setTextStyle'], st => ({ text: st.setText[0] })),
      newTextStyle: () => builder(['setBold', 'setFontSize', 'setForegroundColor'], st => st),
      newConditionalFormatRule: () => builder(['whenNumberGreaterThan', 'setBackground', 'setRanges'], st => st)
    },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getDocumentProperties: () => docProps, getUserProperties: () => userProps },
    Session: { getActiveUser: () => ({ getEmail: () => 'teacher@example.com' }), getScriptTimeZone: () => 'Asia/Seoul' },
    Utilities: {
      formatDate: () => '9/21', sleep() {},
      newBlob: (data, type, name) => blob(typeof data === 'string' ? Array.from(Buffer.from(data, 'utf8')) : data, type, name),
      base64Decode: s => Array.from(Buffer.from(s, 'base64')),
      base64Encode: b => Buffer.from(b).toString('base64'),
      zip: (blobs, name) => blob(Array.from(Buffer.from('PK' + blobs.map(b => b.getName()).join('|'))), 'application/zip', name),
      // docx·hwpx 시험용: 가짜 드라이브 파일에 entries {이름: XML} 을 넣어 두면 그대로 풀어 준다
      unzip: (b) => Object.keys(b.__entries || {}).map(n => blob(Array.from(Buffer.from(b.__entries[n], 'utf8')), 'text/xml', n))
    },
    // 트리거는 만들고 지운 것을 기억한다(설문지 제출 트리거 시험)
    __triggers: triggers,
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger(t) { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: (fn) => {
        const st = {}, b = {};
        ['forSpreadsheet', 'onEdit', 'onFormSubmit'].forEach(f => { b[f] = (...x) => { st[f] = x; return b; }; });
        b.create = () => { const t = { fn, kind: st.onFormSubmit ? 'formSubmit' : 'edit', getHandlerFunction: () => fn }; triggers.push(t); return t; };
        return b;
      },
      getOAuthToken: () => 'test-token',
      AuthMode: { FULL: 'FULL' },
      requireScopes() {}
    },
    // 가짜 드라이브 — 시험이 __drive.files / __drive.folders 에 넣는다
    __drive: drive,
    DriveApp: {
      getFileById(id) {
        const f = drive.files[id];
        if (!f) throw new Error('No item with the given ID could be found');
        return {
          getName: () => f.name, getMimeType: () => f.mime, getSize: () => (f.size || (f.bytes ? f.bytes.length : 100)), getId: () => id,
          getBlob: () => {
            const b = blob(f.bytes || Array.from(Buffer.from(f.text || '', 'utf8')), f.mime, f.name);
            b.__entries = f.entries; b.setContentType = () => b; return b;
          },
          getAs: (mime) => blob(Array.from(Buffer.from('%PDF-from-' + f.name)), mime, f.name + '.pdf')
        };
      },
      getFolderById(id) {
        const fo = drive.folders[id];
        if (!fo) throw new Error('No folder');
        return { getFiles: () => { let i = 0; return { hasNext: () => i < fo.length, next: () => { const id2 = fo[i++]; return { getName: () => drive.files[id2].name, getId: () => id2 }; } }; } };
      }
    },
    HtmlService: {
      createHtmlOutputFromFile: () => out(),
      createHtmlOutput: () => out(),
      createTemplateFromFile: (file) => { const t = { file, evaluate: () => out() }; templates.push(t); return t; }
    },
    // 가짜 인터넷 — 테스트가 __fetch.handler 를 바꿔 끼운다. 기본은 "연결 안 됨"
    __fetch: fetchBox,
    UrlFetchApp: {
      fetch(url, opt) {
        fetchBox.calls.push({ url, opt });
        const r = fetchBox.handler(url, opt || {});
        return { getResponseCode: () => r.code, getContentText: () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
                 // xlsx 내려받기 시험용: r.entries {경로: XML} 를 그대로 zip 처럼 풀어 준다
                 getBlob: () => { const b = blob(Array.from(Buffer.from('PK')), 'application/octet-stream', 'x.xlsx'); b.__entries = r.entries || {}; b.setContentType = () => b; return b; } };
      }
    },
    console
  };
}

module.exports = { makeGlobals };
