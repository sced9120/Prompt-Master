/**
 * 세특 작성 도우미 v3 — 시트 접근 공통 라이브러리
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function ui_() { return SpreadsheetApp.getUi(); }
function toast_(msg, title) { try { ss_().toast(msg, title || APP.MENU, 6); } catch (e) {} }

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
      note: String(r['비고'] || '')
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
      chars: Number(r['글자수'] || 0) || 0,
      columns: String(r['입력 항목'] || ''),
      desc: String(r['활동 개요'] || ''),
      mode: String(r['프롬프트 모드'] || '자동'),
      custom: String(r['직접 작성 프롬프트'] || ''),
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
  return buildPrompt({
    activity: act, record: rec, subject: sub, common: com,
    examples: examples === undefined ? readExamples_(act) : examples,
    years: Number(cfg_('교사 경력(년)', 15))
  });
}

/** 활동의 글자수(활동값 > 기록종류 기본값) */
function charsFor_(act) {
  if (act.chars) return act.chars;
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  return rec ? rec.chars : 500;
}

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
  var cols = parseColumns(act.columns);
  var rows = readExampleRows_(act);
  var cap = typeof EXAMPLE_MAX === 'number' ? EXAMPLE_MAX : 8;
  var out = [];
  for (var i = 0; i < rows.length && i < cap; i++) {
    var parts = [];
    for (var c = 0; c < cols.length; c++) {
      if (rows[i].values[c]) parts.push(cols[c] + ': ' + rows[i].values[c].replace(/\n/g, ' '));
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
 * 1행에 제목과 안내문을 함께 넣는다.
 * 데이터 영역 아래에 안내문을 두면 readTable_ 이 그 줄을 데이터로 읽어
 * 유령 항목이 생기므로, 설정용 시트의 안내문은 반드시 1행에 둔다.
 */
function banner_(sheet, lastCol, title, note) {
  var text = note ? (title + '\n' + note) : title;
  var rng = sheet.getRange(1, 1, 1, Math.max(lastCol, 1));
  rng.merge().setBackground('#eceff1').setWrap(true).setVerticalAlignment('middle');
  var rt = SpreadsheetApp.newRichTextValue().setText(text)
    .setTextStyle(0, title.length, SpreadsheetApp.newTextStyle()
      .setBold(true).setFontSize(13).setForegroundColor('#263238').build());
  if (note) {
    rt.setTextStyle(title.length, text.length, SpreadsheetApp.newTextStyle()
      .setBold(false).setFontSize(10).setForegroundColor('#546e7a').build());
  }
  rng.setRichTextValue(rt.build());
  sheet.setRowHeight(1, note ? 62 : 34);
}

function noteRow_(sheet, row, lastCol, text) {
  var r = sheet.getRange(row, 1, 1, Math.max(lastCol, 1));
  r.merge().setValue(text).setBackground('#eceff1').setFontSize(10)
    .setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(row, 46);
}

/** 학생 이름 마스킹 여부 */
function maskName_() { return cfgBool_('학생 이름 마스킹', true); }
