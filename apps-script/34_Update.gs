/**
 * 세특 작성 도우미 v3 — 🔄 새 버전 알림 · 이전 파일에서 가져오기
 *
 * 사본은 만든 날의 코드로 굳는다(CLAUDE.md "알려진 한계"). 그래서 업데이트는
 *   ① 새 버전이 나온 걸 알린다 — version.json(만든이의 GitHub)을 하루 한 번 읽는다
 *   ② 선생님이 /copy 링크로 새 사본을 만든다
 *   ③ 새 사본에서 [이전 파일에서 가져오기]에 예전 파일 링크를 붙여 넣으면 자료를 옮겨 온다
 * 의 세 걸음이다. 예전 파일은 지우지 않으므로 잘못 옮겨져도 되돌릴 수 있다.
 * 읽기는 xlsx 내보내기(drive.readonly) + 15_Update.gs 의 readXlsxParts — 새 권한이 필요 없다.
 */

var UPDATE_PROP_AT = 'UPDATE_CHECKED_AT';
var UPDATE_PROP_INFO = 'UPDATE_INFO';
var UPDATE_CHECK_HOURS = 24;

/* ---------------------------------------------------------- 새 버전 */
/** version.json 받기 → info 또는 null (조용히 실패) */
function fetchVersionInfo_() {
  try {
    var res = UrlFetchApp.fetch(UPDATE_URL + '?t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    var info = parseVersionInfo(res.getContentText());
    if (info) { try { PropertiesService.getDocumentProperties().setProperty(UPDATE_PROP_INFO, JSON.stringify(info)); } catch (e) {} }
    return info;
  } catch (e) { logSoft_('새 버전 받기', e); return null; }
}

/** 마지막으로 받아 둔 정보(네트워크 없이) */
function cachedVersionInfo_() {
  try { return parseVersionInfo(PropertiesService.getDocumentProperties().getProperty(UPDATE_PROP_INFO) || ''); } catch (e) { return null; }
}

/** 지금 상태 — force 면 바로 받아 온다 */
function updateStatus(force) {
  var info = force ? (fetchVersionInfo_() || cachedVersionInfo_()) : cachedVersionInfo_();
  var st = updateState(APP.VERSION, info);
  st.checked = !!info;
  st.fileUrl = '';
  try { st.fileUrl = ss_().getUrl(); } catch (e) {}
  return st;
}

/**
 * 하루 한 번 저절로 확인(시작하기 창 · 생성 · 검사 때). 새 버전이면 토스트 한 번.
 * 알림은 판마다 한 번만 — 같은 판을 계속 알리지 않는다.
 */
function autoUpdateCheck_() {
  try {
    var dp = PropertiesService.getDocumentProperties();
    var at = Number(dp.getProperty(UPDATE_PROP_AT) || 0);
    if (Date.now() - at < UPDATE_CHECK_HOURS * 3600000) return null;
    dp.setProperty(UPDATE_PROP_AT, String(Date.now()));
    var st = updateState(APP.VERSION, fetchVersionInfo_());
    if (st.available && dp.getProperty('UPDATE_TOLD') !== st.latest) {
      dp.setProperty('UPDATE_TOLD', st.latest);
      toast_('새 버전 ' + st.latest + ' 이(가) 나왔습니다. 메뉴 [도움말 · 부가 기능] > [🔄 새 버전 확인 · 이전 파일에서 가져오기]', APP.MENU);
    }
    return st;
  } catch (e) { logSoft_('새 버전 자동 확인', e); return null; }
}

/** 메뉴: 창 열기. tab = 'version' | 'import' */
function openUpdateDialog(tab) {
  var t = HtmlService.createTemplateFromFile('UI_Update');
  t.tab = tab === 'import' ? 'import' : 'version';
  ui_().showModalDialog(t.evaluate().setWidth(700).setHeight(680), '🔄 새 버전 · 이전 파일에서 가져오기');
}
function openImportDialog() { openUpdateDialog('import'); }

/* ------------------------------------------------- 예전 파일 읽기 */
/**
 * 예전 사본을 xlsx 로 내려받아 {시트 이름: 행 배열}.
 * docs 내보내기 주소를 먼저(드라이브 API 를 켜지 않아도 됨), 안 되면 Drive API 내보내기.
 */
function readOldBook_(id) {
  ensureDriveScope_();            // 처음 승인 때 드라이브 항목 체크를 풀었으면 여기서 다시 묻는다
  var token = ScriptApp.getOAuthToken();
  var urls = [
    'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(id) + '/export?format=xlsx',
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
      '/export?mimeType=' + encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ];
  var lastCode = 0;
  for (var i = 0; i < urls.length; i++) {
    var res = UrlFetchApp.fetch(urls[i], { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true, followRedirects: true });
    lastCode = res.getResponseCode();
    if (lastCode !== 200) continue;
    var blob = res.getBlob();
    var parts = {};
    try {
      Utilities.unzip(blob.setContentType('application/zip')).forEach(function (b) {
        if (/\.(xml|rels)$/.test(b.getName())) parts[b.getName()] = b.getDataAsString('UTF-8');
      });
    } catch (e) { continue; }
    if (parts['xl/workbook.xml'] || parts['/xl/workbook.xml']) return readXlsxParts(parts);
  }
  if (lastCode === 404 || lastCode === 403 || lastCode === 401) {
    throw new Error('그 파일을 열 수 없습니다. 지금 로그인한 계정의 파일인지, 링크가 맞는지 확인해 주세요. (' + lastCode + ')');
  }
  throw new Error('예전 파일을 내려받지 못했습니다' + (lastCode ? ' (' + lastCode + ')' : '') + '. 잠시 뒤 다시 해 보세요.');
}

/** 세특 도우미 파일인지 확인하고 요약 */
function summarizeOldBook_(book) {
  var A = APP.SH;
  if (!book[A.ACTIVITY] && !book[A.CONFIG]) {
    throw new Error('세특 작성 도우미 파일이 아닌 것 같습니다([🗂 활동목록]·[⚙️ 설정] 시트가 없음). 예전에 쓰던 세특 도우미 파일의 링크를 붙여 넣어 주세요.');
  }
  var ver = '';
  var cfg = book[A.CONFIG] || [];
  var m = String((cfg[0] || [])[0] || '').match(/v\d+\.\d+(?:\.\d+)?/);
  if (m) ver = m[0];
  var start = book[A.START] || [];
  if (!ver) { var m2 = String((start[0] || [])[0] || '').match(/v\d+\.\d+(?:\.\d+)?/); if (m2) ver = m2[0]; }
  var acts = book[A.ACTIVITY] ? tableOf(book[A.ACTIVITY], 1).rows.filter(function (r) { return String(r['활동키'] || '').trim(); }) : [];
  var roster = book[A.ROSTER] ? tableOf(book[A.ROSTER], 1).rows.filter(function (r) { return String(r['이름'] || '').trim() || String(r['번호'] || '').trim(); }) : [];
  var style = book[A.STYLE] ? tableOf(book[A.STYLE], 2).rows.filter(function (r) { return String(r[STYLE_HEAD[1]] || '').trim(); }).length : 0;
  return { version: ver, activities: acts.map(function (a) { return String(a['활동명'] || a['활동키']); }),
           roster: roster.length, style: style, sheets: Object.keys(book).length };
}

/** 창: 링크를 읽어 무엇이 옮겨질지 보여 준다(아무것도 바꾸지 않음) */
function importPreview(url) {
  var id = spreadsheetIdIn(url);
  if (!id) throw new Error('구글 시트 링크를 붙여 넣어 주세요. (https://docs.google.com/spreadsheets/d/… )');
  if (id === ss_().getId()) throw new Error('지금 열려 있는 이 파일의 링크입니다. 예전에 쓰던 다른 파일의 링크를 붙여 넣어 주세요.');
  var sum = summarizeOldBook_(readOldBook_(id));
  var mine = 0;
  try { mine = getActivities_().length; } catch (e) {}
  sum.current = APP.VERSION;
  // 판 번호를 v3.0.0 으로 다시 매기기 전의 파일(v3.8.x 등)은 번호가 더 커 보인다 — 화면에 '이전 번호'로 알린다
  sum.legacy = !!(sum.version && compareVersions(sum.version, APP.VERSION) > 0);
  sum.currentActivities = mine;
  return sum;
}

/* ------------------------------------------------------- 가져오기 */
/**
 * 예전 사본의 자료를 이 파일로 옮긴다. 여러 번 눌러도 이미 있는 활동은 건너뛴다.
 * @param {string} url  예전 파일 링크
 * @return {{lines:string[], notes:string[], report:Object}}
 */
function importFromOld(url) {
  var id = spreadsheetIdIn(url);
  if (!id) throw new Error('구글 시트 링크를 붙여 넣어 주세요.');
  if (id === ss_().getId()) throw new Error('지금 열려 있는 이 파일의 링크입니다.');
  var book = readOldBook_(id);
  summarizeOldBook_(book);

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('다른 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  var rep = { roster: 0, activities: [], skipped: [], compile: [], style: 0, settings: [], models: 0,
              records: [], subjects: [], common: [], rules: 0, extra: [], failed: [] };
  var step = function (label, fn) { try { fn(); } catch (e) { rep.failed.push(label + ' — ' + e.message); } };
  try {
    if (!sh_(APP.SH.ACTIVITY) || !sh_(APP.SH.RECORD) || !sh_(APP.SH.ROSTER)) {
      lock.releaseLock();
      installCore_();
      if (!lock.tryLock(30000)) throw new Error('다른 작업이 실행 중입니다.');
    }
    step('⚙️ 설정', function () { importConfig_(book, rep); });
    step('🧩 기록종류', function () { importKeyed_(book, APP.SH.RECORD, rep.records, PRESET_RECORD_TYPES,
      { '키': 'key', '기록 항목명': 'name', '성취수준 사용': 'useGrade', '역할': 'role', '목표': 'goal', '서술 관점': 'view', '비고': 'note' }); });
    step('📚 교과영역', function () { importKeyed_(book, APP.SH.SUBJECT, rep.subjects, PRESET_SUBJECTS,
      { '키': 'key', '표시명': 'name', '분류': 'kind', '역할 표현': 'role', '역량·서술 관점': 'comp' }); });
    step('📐 공통규칙', function () { importKeyed_(book, APP.SH.COMMON, rep.common, PRESET_COMMON,
      { '키': 'key', '제목': 'title', '내용': 'body' }, ['NEIS_RULES']); });
    step('👤 학생명단', function () { importRoster_(book, rep); });
    step('🗂 활동', function () { importActivities_(book, rep); });
    step('📦 최종취합', function () { importCompile_(book, rep); });
    step('✒️ 내 문체', function () { importStyle_(book, rep); });
    step('📏 우리 학교 규칙', function () { importRules_(book, rep); });
    step('그 밖의 시트', function () { importExtraSheets_(book, rep); });
    try { refreshActivityValidation_(); } catch (e) { logSoft_('가져오기 뒤 활동 정리', e); }
    try { refreshModelDropdowns_(); } catch (e) { logSoft_('가져오기 뒤 모델 목록', e); }
    try { orderSheets_(); } catch (e) { logSoft_('가져오기 뒤 시트 순서', e); }
  } finally { lock.releaseLock(); }

  var notes = [];
  var hasKey = PROVIDERS.some(function (p) { return !!getKey_(p); });
  if (!hasKey) notes.push('API 키는 파일이 아니라 계정에 저장되어 새 파일로 따라오지 않습니다. 키를 쓰셨다면 메뉴 ② [AI 연결 · 모델 설정]에서 한 번 더 넣어 주세요.');
  var oldForms = Object.keys(book).some(function (n) { return /설문|응답|Form Responses/i.test(n); });
  if (oldForms) notes.push('구글 설문지 연결과 자동 생성 켜기는 파일마다 따로라 옮겨지지 않습니다. 쓰셨다면 이 파일에서 한 번 더 연결해 주세요.');
  if (rep.skipped.length) notes.push('이미 같은 이름이 있어 건너뛴 활동: ' + rep.skipped.join(', '));
  notes.push('예전 파일은 그대로 있습니다. 잘 옮겨졌는지 확인한 뒤 필요 없으면 지우셔도 됩니다.');
  try { PropertiesService.getDocumentProperties().setProperty('IMPORTED_FROM', id); } catch (e) {}
  return { lines: importReportLines(rep), notes: notes, failed: rep.failed, report: rep };
}

/** [⚙️ 설정] 값(항목 줄)과 모델 목록에 직접 더한 모델 */
function importConfig_(book, rep) {
  var old = book[APP.SH.CONFIG];
  var s = sh_(APP.SH.CONFIG);
  if (!old || !s) return;
  var cur = {};
  var head = modelTableRow_(s);
  var lastSet = head ? head - 1 : s.getLastRow();
  if (lastSet >= 4) s.getRange(4, 1, lastSet - 3, 2).getValues().forEach(function (r) { var k = String(r[0]).trim(); if (k) cur[k] = r[1]; });
  var oldHead = -1;
  for (var i = 0; i < old.length; i++) {
    if (String((old[i] || [])[0]).trim() === MODEL_HEAD[0] && String((old[i] || [])[1]).trim() === MODEL_HEAD[1]) { oldHead = i; break; }
  }
  var end = oldHead >= 0 ? oldHead : old.length;
  for (var r = 3; r < end; r++) {
    var k = String((old[r] || [])[0] || '').trim(), v = (old[r] || [])[1];
    if (!k || !cur.hasOwnProperty(k) || v === '' || v === null || v === undefined) continue;
    if (sameText_(v, cur[k])) continue;
    setCfg_(k, v);
    rep.settings.push(k);
  }
  // 모델 목록 — 예전에 직접 적어 넣은 모델만 더한다(연결 확인 표시는 새로)
  if (oldHead >= 0 && head) {
    var have = readModelRowsAt_(s, head);
    var names = have.map(function (x) { return x.model; });
    var add = [];
    tableOf(old, oldHead).rows.forEach(function (row) {
      var m = normModel(row[MODEL_HEAD[0]]);
      if (!m || names.indexOf(m) >= 0 || m === MANUAL_MODEL || m === SUBSCRIPTION_MODEL) return;
      names.push(m);
      add.push({ model: m, level: String(row['수준'] || ''), memo: String(row['언제 쓰나'] || ''), company: String(row['회사'] || '자동') || '자동', status: '' });
    });
    if (add.length) { writeModelTable_(s, head, have.concat(add)); rep.models = add.length; }
  }
}

/**
 * 키 열이 있는 표 하나 합치기 — 예전에만 있는 줄은 맨 아래에, 고쳐 쓴 칸은 (새 파일이 아직 기본값이면) 예전 값으로.
 * @param {Object} fieldOf  {머리글: 프리셋 필드}
 * @param {string[]=} skipKeys  규칙판이 관리하는 줄(옮기지 않음)
 */
function importKeyed_(book, name, out, presetList, fieldOf, skipKeys) {
  var old = book[name], s = sh_(name);
  if (!old || !s) return;
  var curT = tableOf(s.getRange(1, 1, Math.max(s.getLastRow(), 2), Math.max(s.getLastColumn(), 1)).getValues(), 1);
  var oldT = tableOf(old, 1);
  var presets = {};
  (presetList || []).forEach(function (p) {
    var o = {};
    Object.keys(fieldOf).forEach(function (h) { if (p.hasOwnProperty(fieldOf[h])) o[h] = p[fieldOf[h]]; });
    presets[p.key] = o;
  });
  var cols = Object.keys(fieldOf).filter(function (h) { return h !== '키'; });
  var oldRows = oldT.rows.filter(function (r) { return (skipKeys || []).indexOf(String(r['키']).trim()) < 0; });
  var plan = mergeKeyed(oldRows, curT.rows, presets, '키', cols);
  var head = curT.head;
  plan.updates.forEach(function (u) {
    var row = curT.rows.filter(function (r) { return String(r['키']).trim() === u.key; })[0];
    var c = head.indexOf(u.col);
    if (row && c >= 0) { s.getRange(row.__i + 1, c + 1).setValue(u.value); if (out.indexOf(u.key) < 0) out.push(u.key + ' 고친 문구'); }
  });
  if (plan.appends.length) {
    var start = s.getLastRow() + 1;
    var rows = plan.appends.map(function (r) { return head.map(function (h) { return h && r.hasOwnProperty(h) ? r[h] : ''; }); });
    ensureRows_(s, start + rows.length);
    s.getRange(start, 1, rows.length, head.length).setValues(rows).setWrap(true).setVerticalAlignment('top');
    var cg = head.indexOf('성취수준 사용');
    if (cg >= 0) s.getRange(start, cg + 1, rows.length, 1).insertCheckboxes();
    plan.appends.forEach(function (r) { out.push(String(r['키']).trim() + ' 추가'); });
  }
}

/** 학생명단 — 예전 명단 그대로(반·번호 / 학년·반·번호) */
function importRoster_(book, rep) {
  var old = book[APP.SH.ROSTER];
  if (!old || old.length < 3) return;
  var rows = old.slice(1).filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  if (rows.length < 2) return;
  var r = parseRosterRows(rows, 'auto');
  if (!r.students.length) return;
  writeRosterSheet_(r.students, r.mode);
  rep.roster = r.students.length;
}

/** 활동 — 활동목록 줄 → 시트(입력·예시) 만들기 → 학생 줄(자료·AI 결과·최종본·검증) 채우기 */
function importActivities_(book, rep) {
  var old = book[APP.SH.ACTIVITY];
  if (!old) return;
  var list = tableOf(old, 1).rows.filter(function (r) { return String(r['활동키'] || '').trim(); });
  list.forEach(function (row) {
    var exRows = book[String(row['예시 시트'] || '').trim()] || null;
    var def = activityDefFromOld(row, exRows);
    if (getActivity_(def.key) || sh_(sheetNameIn_(def.key))) { rep.skipped.push(def.name); return; }
    var nameTaken = getActivities_().some(function (a) { return a.name === def.name; });
    if (nameTaken) { rep.skipped.push(def.name); return; }
    var made;
    try {
      made = createActivity_({
        key: def.key, name: def.name, recordKey: def.recordKey, subjectKey: def.subjectKey, bytes: def.bytes,
        columns: def.columns, desc: def.desc, mode: def.mode, amount: def.amount, examples: def.examples, noExamples: !def.exSheet
      });
    } catch (e) { rep.failed.push('활동 ' + def.name + ' — ' + e.message); return; }

    // 직접작성 모드와 프롬프트는 createActivity_ 가 받지 않으므로 줄에 바로 쓴다
    if (def.mode === '직접작성' || def.custom) {
      var act = getActivity_(made.key), ls = sh_(APP.SH.ACTIVITY);
      var lh = ls.getRange(2, 1, 1, ls.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      if (lh.indexOf('프롬프트 모드') >= 0 && def.mode === '직접작성') ls.getRange(act.__row, lh.indexOf('프롬프트 모드') + 1).setValue('직접작성');
      if (lh.indexOf('직접 작성 프롬프트') >= 0 && def.custom) ls.getRange(act.__row, lh.indexOf('직접 작성 프롬프트') + 1).setValue(def.custom);
    }

    var n = 0, inOld = book[def.inSheet], inS = sh_(made.inSheet);
    if (inOld && inS) n = fillStudentSheet_(inS, inOld);
    rep.activities.push({ name: def.name, rows: n, examples: def.examples.filter(function (e) { return e.result; }).length });
  });
}

/**
 * 학생 줄을 머리글 이름으로 옮겨 채운다(활동 입력·최종취합 공용).
 * 새 시트에 이미 있는 학생 줄(명단에서 채운 줄)은 지우고 예전 줄 순서대로 다시 쓴다.
 * @return {number} 옮긴 줄 수
 */
function fillStudentSheet_(s, oldRows) {
  var lastCol = s.getLastColumn();
  var head = s.getRange(APP.HEAD_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var out = remapStudentRows(oldRows, head, APP.HEAD_ROW - 1);
  if (!out.length) return 0;
  var first = APP.DATA_ROW, last = s.getLastRow();
  if (last >= first) s.getRange(first, 1, last - first + 1, lastCol).clearContent();
  ensureRows_(s, first + out.length);
  s.getRange(first, 1, out.length, 1).setNumberFormat('@');
  s.getRange(first, 1, out.length, head.length).setValues(out.map(function (r) {
    return r.map(function (v, i) { return i === 0 ? String(v) : v; });
  }));
  if (head.indexOf('생성') >= 0) applyRowFormat_(s, out.length);
  return out.length;
}

/** 최종취합 — 새로 모은 뒤, 예전에 다듬어 둔 [최종본]·[AI 압축결과]·[모델]을 학생별로 되돌려 놓는다 */
function importCompile_(book, rep) {
  var olds = Object.keys(book).filter(function (n) { return n.indexOf(APP.SH.COMPILE_PREFIX) === 0; });
  if (!olds.length || !getActivities_().length) return;
  try { buildCompileCore_(); } catch (e) { return; }
  olds.forEach(function (name) {
    var s = sh_(name);
    if (!s) return;
    var t = tableOf(book[name], APP.HEAD_ROW - 1);
    var byId = {};
    t.rows.forEach(function (r) { byId[studentKeyOf(r, t.head)] = r; });
    var lastCol = s.getLastColumn(), last = s.getLastRow();
    if (last < APP.DATA_ROW) return;
    var head = s.getRange(APP.HEAD_ROW, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var n = last - APP.DATA_ROW + 1;
    var vals = s.getRange(APP.DATA_ROW, 1, n, lastCol).getValues();
    var changed = false;
    ['최종본', 'AI 압축결과', '모델', '검증'].forEach(function (h) {
      var c = head.indexOf(h);
      if (c < 0 || t.head.indexOf(h) < 0) return;
      var col = vals.map(function (r) {
        var o = byId[String(r[0]).trim() + '-' + String(r[1]).trim()];
        var v = o ? o[h] : '';
        return [v !== '' && v !== undefined ? v : r[c]];
      });
      s.getRange(APP.DATA_ROW, c + 1, n, 1).setValues(col);
      changed = true;
    });
    if (changed) rep.compile.push(name.replace(APP.SH.COMPILE_PREFIX, '').trim());
  });
}

/** ✒️ 내 문체 — 예전에 붙여 넣은 세특(사용 체크 포함) */
function importStyle_(book, rep) {
  var old = book[APP.SH.STYLE], s = sh_(APP.SH.STYLE);
  if (!old || !s) return;
  var rows = tableOf(old, APP.HEAD_ROW - 1).rows.filter(function (r) { return String(r[STYLE_HEAD[1]] || '').trim(); });
  if (!rows.length) return;
  var have = [];
  if (s.getLastRow() >= APP.DATA_ROW) {
    have = s.getRange(APP.DATA_ROW, 2, s.getLastRow() - APP.DATA_ROW + 1, 1).getValues()
      .map(function (r) { return String(r[0]).trim(); }).filter(String);
  }
  var add = rows.filter(function (r) { return have.indexOf(String(r[STYLE_HEAD[1]]).trim()) < 0; });
  if (!add.length) return;
  var start = APP.DATA_ROW + have.length;
  ensureRows_(s, start + add.length);
  s.getRange(start, 1, add.length, STYLE_HEAD.length).setValues(add.map(function (r) {
    var use = r[STYLE_HEAD[0]];
    return [use === true || String(use).toUpperCase() === 'TRUE', r[STYLE_HEAD[1]], r[STYLE_HEAD[2]] || '', r[STYLE_HEAD[3]] || ''];
  }));
  s.getRange(start, 1, add.length, 1).insertCheckboxes();
  s.getRange(start, 2, add.length, 1).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
  rep.style = add.length;
}

/** 📏 기재요령 — 선생님이 더한 줄([출처]가 기재요령·맞춤법(기본)·AI 투(기본)이 아닌 줄)만 */
function importRules_(book, rep) {
  var old = book[APP.SH.RULES], s = sh_(APP.SH.RULES);
  if (!old || !s) return;
  var mine = old.slice(APP.DATA_ROW - 1).filter(function (r) {
    return (String(r[3] || '').trim() || String(r[2] || '').trim()) && !isBuiltinRow(r[6]);
  }).map(function (r) { var o = r.slice(0, RULES_HEAD.length); while (o.length < RULES_HEAD.length) o.push(''); return o; });
  if (!mine.length) return;
  var cur = readRuleRows_(s);
  var key = function (r) { return String(r[3]).trim() + '|' + String(r[2]).trim(); };
  var have = cur.map(key);
  var add = mine.filter(function (r) { return have.indexOf(key(r)) < 0; });
  if (!add.length) return;
  writeRuleRows_(s, cur.concat(add.map(function (r) { r[0] = r[0] === true || String(r[0]).toUpperCase() === 'TRUE' || r[0] === ''; return r; })));
  rep.rules = add.length;
}

/** 그 밖의 시트 — 이 도구가 만드는 시트가 아니고 내용이 있는 것만, 값으로 */
function importExtraSheets_(book, rep) {
  var sys = Object.keys(APP.SH).map(function (k) { return APP.SH[k]; });
  var actSheets = [];
  try { getActivities_().forEach(function (a) { actSheets.push(a.inSheet, a.exSheet); }); } catch (e) {}
  var oldActs = book[APP.SH.ACTIVITY] ? tableOf(book[APP.SH.ACTIVITY], 1).rows : [];
  oldActs.forEach(function (r) { actSheets.push(String(r['입력 시트'] || '').trim(), String(r['예시 시트'] || '').trim()); });
  Object.keys(book).forEach(function (name) {
    if (sys.indexOf(name) >= 0 || actSheets.indexOf(name) >= 0 || name.indexOf(APP.SH.COMPILE_PREFIX) === 0) return;
    if (/ ▸(입력|예시)$/.test(name) || sh_(name)) return;
    var rows = book[name];
    var filled = rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); }).length;
    if (!filled) return;
    var w = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([1]));
    var s = ss_().insertSheet(name);
    ensureCols_(s, w);
    ensureRows_(s, rows.length);
    s.getRange(1, 1, rows.length, w).setValues(rows.map(function (r) { var o = r.slice(); while (o.length < w) o.push(''); return o; }));
    rep.extra.push(name);
  });
}
