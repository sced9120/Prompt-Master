/**
 * 세특 작성 도우미 v3 — 시트 접근 공통 라이브러리
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function ui_() { return SpreadsheetApp.getUi(); }
/**
 * 실패해도 흐름을 멈추지 않을 곳의 오류를 실행 기록에 남긴다([확장 프로그램] > [Apps Script] > [실행]).
 * 비밀값은 가리고 적는다. 그냥 삼키면 실제 환경에서 무엇이 왜 안 됐는지 알 길이 없다.
 */
function logSoft_(where, e) {
  try { console.warn('[' + where + '] ' + redactSecrets(e && e.message ? e.message : e)); } catch (x) {}
}
function toast_(msg, title, secs) { try { ss_().toast(msg, title || APP.MENU, secs || 6); } catch (e) {} }

/** 시트 가져오기(없으면 null) */
function sh_(name) { return ss_().getSheetByName(name); }

/** 시트 가져오기(없으면 생성) */
function shOrCreate_(name) {
  var s = sh_(name);
  if (!s) s = ss_().insertSheet(name);
  return s;
}

/** 시트 필수 — 없으면 안내 후 예외 */
function shRequire_(name) {
  var s = sh_(name);
  if (!s) throw new Error('[' + name + '] 시트가 없습니다. 메뉴 > 처음 설치/복구 를 실행하세요.');
  return s;
}

/** 표 읽기: headerRow 기준으로 [{헤더:값}] 배열 반환 */
function readTable_(sheet, headerRow) {
  headerRow = headerRow || 1;
  var last = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (last <= headerRow || lastCol === 0) return [];
  var values = sheet.getRange(headerRow, 1, last - headerRow + 1, lastCol).getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = {}, empty = true;
    for (var c = 0; c < head.length; c++) {
      if (!head[c]) continue;
      row[head[c]] = values[r][c];
      if (String(values[r][c]).trim() !== '') empty = false;
    }
    if (empty) continue;
    row.__row = headerRow + r;
    out.push(row);
  }
  return out;
}

/** 설정 시트에서 값 읽기 (A=키, B=값) */
function cfg_(key, dflt) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) return dflt;
  var v = s.getRange(1, 1, s.getLastRow(), 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) {
      var val = v[i][1];
      return (val === '' || val === null) ? dflt : val;
    }
  }
  return dflt;
}

function cfgBool_(key, dflt) {
  var v = cfg_(key, null);
  if (v === null) return dflt;
  return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '예';
}

/** 기록종류 목록 */
function getRecordTypes_() {
  var s = shRequire_(APP.SH.RECORD);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['키'] || '').trim(),
      name: String(r['기록 항목명'] || '').trim(),
      chars: Number(r['글자수'] || 500),
      useGrade: r['성취수준 사용'] === true || String(r['성취수준 사용']).toUpperCase() === 'TRUE',
      role: String(r['역할'] || ''),
      goal: String(r['목표'] || ''),
      view: String(r['서술 관점'] || ''),
      note: String(r['비고'] || ''),
      rules: String(r['기재 주의'] || '')
    };
  }).filter(function (r) { return r.key; });
}

/** 교과·영역 목록 */
function getSubjects_() {
  var s = shRequire_(APP.SH.SUBJECT);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['키'] || '').trim(),
      name: String(r['표시명'] || '').trim(),
      kind: String(r['분류'] || '').trim(),
      role: String(r['역할 표현'] || ''),
      comp: String(r['역량·서술 관점'] || '')
    };
  }).filter(function (r) { return r.key; });
}

/** 공통규칙 맵 */
function getCommon_() {
  var s = shRequire_(APP.SH.COMMON);
  var map = {};
  readTable_(s, 2).forEach(function (r) {
    var k = String(r['키'] || '').trim();
    if (k) map[k] = String(r['내용'] || '');
  });
  return map;
}

/** 활동 목록 */
function getActivities_() {
  var s = shRequire_(APP.SH.ACTIVITY);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['활동키'] || '').trim(),
      name: String(r['활동명'] || '').trim(),
      recordKey: String(r['기록종류'] || '').trim(),
      subjectKey: String(r['교과영역'] || '').trim(),
      bytes: Number(r['바이트 한도'] || 0) || (Number(r['글자수'] || 0) || 0) * 3,   // 예전 시트는 [글자수]
      columns: String(r['입력 항목'] || ''),
      desc: String(r['활동 개요'] || ''),
      mode: String(r['프롬프트 모드'] || '자동'),
      custom: String(r['직접 작성 프롬프트'] || ''),
      amount: String(r['분량 맞추기'] || '').trim(),
      inSheet: String(r['입력 시트'] || '').trim(),
      exSheet: String(r['예시 시트'] || '').trim(),
      __row: r.__row
    };
  }).filter(function (a) { return a.key; });
}

function getActivity_(key) {
  var list = getActivities_();
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return null;
}

/** 활동 1건에 대한 완성 프롬프트 */
function promptFor_(act, examples) {
  var recs = getRecordTypes_(), subs = getSubjects_(), com = getCommon_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var sub = findByKey(subs, act.subjectKey) || findByKey(subs, '공통') || subs[0];
  var useStyle = styleOn_();
  if (!useStyle) com.STYLE_CARD = '';
  if (com.AVOID_RULES === undefined) com.AVOID_RULES = AVOID_RULES_DEFAULT;   // 칸이 없는 예전 시트도 (비워 두면 끔)
  return buildPrompt({
    activity: act, record: rec, subject: sub, common: com,
    examples: examples === undefined ? readExamples_(act) : examples,
    styleSamples: useStyle ? readStyleSamples_() : '',
    years: Number(cfg_('교사 경력(년)', 15))
  });
}

/** [⚙️ 설정] 내 문체 적용 (없으면 켬) */
function styleOn_() { return cfgBool_('내 문체 적용', true); }

/** 학생 자료 바로 뒤에 붙일 문체 카드 (꺼 두었거나 카드가 없으면 '') */
function styleTail_() {
  if (!styleOn_()) return '';
  try { return styleTail(getCommon_().STYLE_CARD || ''); } catch (e) { return ''; }
}

/**
 * AI 에게 보낼 입력 항목 — 보고서 시트는 [보고서] 원문 대신 확인된 요점과 관찰 메모만 보낸다
 * (긴 원문이 예시를 덮지 않게).
 * @return {Array<{name:string, i:number}>}  i = 입력 항목 안에서의 위치
 */
function modelCols_(act) {
  var cols = parseColumns(act.columns);
  return cols.map(function (c, i) { return { name: c, i: i }; })
    .filter(function (x) { return !(act.mode === '보고서' && x.name === REPORT_COL); });
}

/** 한 학생의 입력값 → AI 에게 보낼 자료 한 덩어리 */
function blockFor_(act, values, grade) {
  var mc = modelCols_(act);
  return buildStudentBlock(mc.map(function (x) { return x.name; }),
    mc.map(function (x) { var v = values[x.i]; return x.name === POINTS_COL ? String(v || '').replace(/\s*\n\s*/g, ' / ') : v; }),
    { grade: grade });
}

/** 활동의 바이트 한도(활동값 > 기록종류 글자수×3). 기록종류 한도를 넘지 않는다 */
function bytesFor_(act) {
  return activityBytes(act, findByKey(getRecordTypes_(), act.recordKey));
}

/** 바이트 한도를 한글 글자 수로(안내 문구용) */
function charsFor_(act) { return Math.floor(bytesFor_(act) / 3); }

/** 예시 시트에서 채워진 예시들을 객체 배열로 읽기 */
function readExampleRows_(act) {
  var out = [];
  if (!act.exSheet) return out;
  var s = sh_(act.exSheet);
  if (!s) return out;
  var cols = parseColumns(act.columns);
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return out;
  var cResult = colOf_(s, APP.HEAD_ROW, '결과') || (1 + cols.length + 1);
  var vals = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, cResult).getValues();
  for (var i = 0; i < vals.length; i++) {
    var result = String(vals[i][cResult - 1] || '').trim();
    if (!result) continue;
    var values = [];
    for (var c = 0; c < cols.length; c++) values.push(String(vals[i][1 + c] || '').trim());
    out.push({ row: APP.DATA_ROW + i, values: values, result: result });
  }
  return out;
}

/** 예시 시트에서 예시 합본(프롬프트용 문자열) 읽기 */
function readExamples_(act) {
  var mc = modelCols_(act);
  var rows = readExampleRows_(act);
  var cap = typeof EXAMPLE_MAX === 'number' ? EXAMPLE_MAX : 8;
  var out = [];
  for (var i = 0; i < rows.length && i < cap; i++) {
    var parts = [];
    for (var k = 0; k < mc.length; k++) {
      var v = rows[i].values[mc[k].i];
      if (v) parts.push(mc[k].name + ': ' + v.replace(/\s*\n\s*/g, mc[k].name === POINTS_COL ? ' / ' : ' '));
    }
    out.push('## 예시' + (i + 1) + ' 입력\n' + parts.join('\n') +
             '\n## 예시' + (i + 1) + ' 결과\n' + rows[i].result);
  }
  return out.join('\n\n');
}

/** 헤더 행에서 특정 헤더의 열 번호(1-based). 없으면 0 */
function colOf_(sheet, headerRow, name) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) return 0;
  var head = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === name) return i + 1;
  }
  return 0;
}

/** 시트 보호 없이 서식만 입히는 헬퍼 */
function styleHeader_(sheet, row, lastCol, bg) {
  sheet.getRange(row, 1, 1, lastCol)
    .setBackground(bg || '#37474f').setFontColor('#ffffff')
    .setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(row, 40);
}

/**
 * 시트 머리말 규칙 — 구글 시트의 두 가지 제약을 피한다.
 *   1) 병합된 셀을 가르는 열 고정은 금지된다.
 *      → 왼쪽 열을 고정하는 시트는 splitBanner_ 로 [고정 구역]과 [나머지]를 따로 병합한다.
 *   2) 기존 병합과 일부만 겹치는 병합은 금지된다.
 *      → 병합하기 전에 그 행의 병합을 먼저 푼다(unmergeRow_).
 * 옛 번호 v3.0.0 초판은 1번을 어겨서 [처음 설치]가 시트를 하나씩만 만들고 멈췄다.
 */
function unmergeRow_(sheet, row) {
  sheet.getRange(row, 1, 1, sheet.getMaxColumns()).breakApart();
}

function ensureCols_(sheet, n) {
  var max = sheet.getMaxColumns();
  if (max < n) sheet.insertColumnsAfter(max, n - max);
}

/** 1행 전체에 제목+안내문 (열 고정을 쓰지 않는 시트용) */
function banner_(sheet, lastCol, title, note) {
  var n = Math.max(lastCol, 1);
  ensureCols_(sheet, n);
  unmergeRow_(sheet, 1);
  var rng = sheet.getRange(1, 1, 1, n);
  rng.merge().setBackground('#eceff1').setWrap(true).setVerticalAlignment('middle');
  var text = note ? (title + '\n' + note) : title;
  var cell = sheet.getRange(1, 1);
  try {
    var rt = SpreadsheetApp.newRichTextValue().setText(text)
      .setTextStyle(0, title.length, SpreadsheetApp.newTextStyle()
        .setBold(true).setFontSize(13).setForegroundColor('#263238').build());
    if (note) {
      rt.setTextStyle(title.length, text.length, SpreadsheetApp.newTextStyle()
        .setBold(false).setFontSize(10).setForegroundColor('#546e7a').build());
    }
    cell.setRichTextValue(rt.build());
  } catch (e) {
    cell.setValue(text).setFontSize(11);    // 서식이 실패해도 설치는 계속된다
  }
  sheet.setRowHeight(1, note ? 62 : 34);
}

/**
 * 왼쪽 열을 고정하는 시트용 1행 머리말.
 * [A~고정열] 에 제목, [그다음~끝] 에 안내문을 각각 병합한다. 고정 경계를 가르지 않는다.
 */
function splitBanner_(sheet, frozenCols, lastCol, title, note) {
  ensureCols_(sheet, lastCol);
  unmergeRow_(sheet, 1);
  sheet.getRange(1, 1, 1, frozenCols).merge()
    .setValue(title).setBackground('#dfe8e0').setFontColor('#1b3a2a')
    .setFontWeight('bold').setFontSize(12).setWrap(true).setVerticalAlignment('middle');
  if (lastCol > frozenCols) {
    sheet.getRange(1, frozenCols + 1, 1, lastCol - frozenCols).merge()
      .setValue(note).setBackground('#eceff1').setFontSize(10)
      .setWrap(true).setVerticalAlignment('middle');
  }
  sheet.setRowHeight(1, 62);
}

function noteRow_(sheet, row, lastCol, text) {
  var n = Math.max(lastCol, 1);
  ensureCols_(sheet, n);
  unmergeRow_(sheet, row);
  var r = sheet.getRange(row, 1, 1, n);
  r.merge().setValue(text).setBackground('#eceff1').setFontSize(10)
    .setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(row, 46);
}

/** 학생 이름 마스킹 여부 */
function maskName_() { return cfgBool_('학생 이름 마스킹', true); }
