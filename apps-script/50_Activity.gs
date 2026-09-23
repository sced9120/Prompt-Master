/**
 * 세특 작성 도우미 v3 — 활동 추가 / 복제 / 삭제 / 시트 생성
 */

var EXAMPLE_ROWS_DEFAULT = 3;   // 새 활동을 만들 때 준비되는 빈 예시 칸
var EXAMPLE_MAX = 8;            // 프롬프트에 넣을 예시 최대 개수

function sheetNameIn_(key) { return key + APP.SUFFIX.IN; }
function sheetNameEx_(key) { return key + APP.SUFFIX.EX; }

/** 시트 이름에 못 쓰는 문자 제거 */
function safeKey_(raw) {
  return String(raw || '').replace(/[\[\]\*\/\\\?:']/g, '').trim().slice(0, 20);
}

/** 시스템이 쓰는 열 이름 — 입력 항목이나 활동명으로 쓸 수 없습니다 */
var RESERVED_NAMES = ['반', '번호', '이름', '성취수준', '생성', '모델', 'AI 결과', '최종본',
                      '바이트', '검증', '합본', '합본 바이트', '압축', 'AI 압축결과', '예시번호'];

/**
 * 활동 생성 (마법사·직접추가 공용)
 * def = {key, name, recordKey, subjectKey, chars, columns, desc, examples:[{values:[],result:''}]}
 */
function createActivity_(def) {
  var key = safeKey_(def.key || def.name);
  if (!key) throw new Error('활동키가 비었습니다.');
  if (getActivity_(key)) throw new Error('이미 같은 활동키가 있습니다: ' + key);
  if (sh_(sheetNameIn_(key)) || sh_(sheetNameEx_(key))) throw new Error('같은 이름의 시트가 이미 있습니다: ' + key);

  var name = String(def.name || key).trim();
  if (RESERVED_NAMES.indexOf(name) >= 0) {
    throw new Error('"' + name + '"은(는) 시스템이 쓰는 이름이라 활동명으로 쓸 수 없습니다. 다른 이름을 쓰세요.');
  }
  getActivities_().forEach(function (a) {
    if (a.name === name) throw new Error('같은 활동명이 이미 있습니다: ' + name + ' (최종취합에서 구분되지 않습니다)');
  });

  var cols = validateColumns_(def.columns);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, def.recordKey) || recs[0];
  var chars = Number(def.chars || 0) || rec.chars;

  var inSheet = buildActivityInputSheet_(key, name, cols, rec);
  var exSheet = buildActivityExampleSheet_(key, name, cols, def.examples || []);

  var s = shRequire_(APP.SH.ACTIVITY);
  var row = [key, name, rec.key, def.subjectKey || cfg_('기본 교과영역', '공통'),
             chars, cols.join('|'), def.desc || '', '자동', '',
             inSheet.getName(), exSheet.getName()];
  s.appendRow(row);
  refreshActivityValidation_();

  try { syncRosterInto_(inSheet, getRoster_()); } catch (e) {}
  return { key: key, inSheet: inSheet.getName(), exSheet: exSheet.getName() };
}

function buildActivityInputSheet_(key, name, cols, rec) {
  return layoutInputSheet_(ss_().insertSheet(sheetNameIn_(key)), name, cols, rec);
}

/** 입력 시트의 머리말·헤더·폭·서식 (활동 만들 때와 입력 항목 바꿀 때 함께 씀) */
function layoutInputSheet_(s, name, cols, rec) {
  var head = ['반', '번호', '이름', '성취수준']
    .concat(cols)
    .concat(['생성', '모델', 'AI 결과', '최종본', '바이트', '검증']);
  head[0] = classHead_();                 // 학년·반·번호 방식이면 '학년-반'
  var n = head.length;

  splitBanner_(s, 3, n,
    '▶ ' + name + '\n' + rec.name + ' · ' + rec.chars + '자',
    '① 노란 칸에 학생 자료 입력  →  ② [모델] 선택  →  ③ [생성] 체크 또는 메뉴 ⑥ 체크된 행 생성  →  ' +
    '④ AI 결과를 확인하고 [최종본] 칸에 붙여넣어 다듬기  →  ⑤ 체크 해제(재호출·비용 방지)');
  s.getRange(2, 1).setValue('').setFontSize(8);
  s.setRowHeight(2, 8);

  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n);
  s.setFrozenRows(APP.HEAD_ROW);
  s.setFrozenColumns(3);

  // 폭
  s.setColumnWidth(1, 55); s.setColumnWidth(2, 55); s.setColumnWidth(3, 90); s.setColumnWidth(4, 80);
  for (var i = 0; i < cols.length; i++) s.setColumnWidth(5 + i, 230);
  var base = 4 + cols.length;
  s.setColumnWidth(base + 1, 60);   // 생성
  s.setColumnWidth(base + 2, 150);  // 모델
  s.setColumnWidth(base + 3, 420);  // AI 결과
  s.setColumnWidth(base + 4, 420);  // 최종본
  s.setColumnWidth(base + 5, 70);   // 바이트
  s.setColumnWidth(base + 6, 220);  // 검증

  s.getRange(APP.DATA_ROW, 5, 500, cols.length).setBackground(APP.COLORS.input)
    .setWrap(true).setVerticalAlignment('top');
  s.getRange(APP.DATA_ROW, 1, 500, 4).setBackground(APP.COLORS.lock);
  try { applyModelDropdown_(s, 500); } catch (e) {}   // 비워 두면 [⚙️ 설정]의 활동용 모델
  return s;
}

/**
 * 이미 만든 활동의 [입력 항목]·이름·개요 바꾸기.
 * 학생이 채워 둔 자료는 항목 이름으로 따라간다. 이름이 바뀐 항목은 새 항목으로 보고 비운다.
 * @param {string} key
 * @param {{name?:string, columns:(string|string[]), desc?:string}} p
 * @return {{kept:string[], added:string[], removed:string[], rows:number}}
 */
function updateActivity_(key, p) {
  var act = getActivity_(key);
  if (!act) throw new Error('활동을 찾을 수 없습니다: ' + key);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var oldCols = parseColumns(act.columns);
  var cols = validateColumns_(p.columns);
  var name = String(p.name || act.name).trim() || act.name;
  if (name !== act.name) {
    if (RESERVED_NAMES.indexOf(name) >= 0) throw new Error('"' + name + '"은(는) 시스템이 쓰는 이름이라 활동명으로 쓸 수 없습니다.');
    getActivities_().forEach(function (a) {
      if (a.key !== key && a.name === name) throw new Error('같은 활동명이 이미 있습니다: ' + name);
    });
  }
  var desc = p.desc === undefined ? act.desc : String(p.desc);

  var moved = { kept: [], added: [], removed: [] };
  cols.forEach(function (c) { (oldCols.indexOf(c) >= 0 ? moved.kept : moved.added).push(c); });
  oldCols.forEach(function (c) { if (cols.indexOf(c) < 0) moved.removed.push(c); });

  // 1) 입력 시트 — 학생별 자료를 항목 이름으로 옮겨 담는다
  var rows = 0;
  var inS = sh_(act.inSheet);
  if (inS) {
    var head = APP.HEAD_ROW, first = APP.DATA_ROW;
    var lastRow = inS.getLastRow(), lastCol = inS.getLastColumn();
    var oldHead = inS.getRange(head, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var ix = function (n) { return oldHead.indexOf(n); };
    var keep = ['생성', '모델', 'AI 결과', '최종본', '검증'];
    var data = lastRow >= first ? inS.getRange(first, 1, lastRow - first + 1, lastCol).getValues() : [];
    var out = data.map(function (r) {
      var row = [r[0], r[1], r[2], r[3]];
      cols.forEach(function (c) { var i = ix(c); row.push(i >= 0 ? r[i] : ''); });
      keep.forEach(function (h) { var i = ix(h); row.push(i >= 0 ? r[i] : (h === '생성' ? false : '')); });
      return row;
    }).filter(function (r) { return String(r[0]).trim() !== '' || String(r[2]).trim() !== ''; });
    rows = out.length;

    inS.clear();
    layoutInputSheet_(inS, name, cols, rec);
    if (out.length) {
      var n = 4 + cols.length + 6;
      ensureRows_(inS, first + out.length - 1);
      inS.getRange(first, 1, out.length, 1).setNumberFormat('@');
      // [바이트]는 수식이라 비워 두고 applyRowFormat_ 이 다시 넣는다
      var write = out.map(function (r) {
        return r.slice(0, 4 + cols.length + 4).concat(['', r[4 + cols.length + 4]]);
      });
      inS.getRange(first, 1, out.length, n).setValues(write);
      applyRowFormat_(inS, out.length);
    }
  }

  // 2) 예시 시트 — 같은 방식으로 옮긴다
  var exS = sh_(act.exSheet);
  if (exS) {
    var exHead = exS.getRange(APP.HEAD_ROW, 1, 1, exS.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var exRows = [];
    var exLast = exS.getLastRow();
    if (exLast >= APP.DATA_ROW) {
      exS.getRange(APP.DATA_ROW, 1, exLast - APP.DATA_ROW + 1, exHead.length).getValues().forEach(function (r) {
        var values = cols.map(function (c) { var i = exHead.indexOf(c); return i >= 0 ? String(r[i] || '') : ''; });
        var ri = exHead.indexOf('결과');
        var result = ri >= 0 ? String(r[ri] || '').trim() : '';
        if (result || values.some(String)) exRows.push({ values: values, result: result });
      });
    }
    exS.clear();
    exampleLayout_(exS, name, cols);
    writeExampleRows_(exS, cols, exRows, APP.DATA_ROW, Math.max(EXAMPLE_ROWS_DEFAULT, exRows.length));
  }

  // 3) 활동목록 줄
  var list = shRequire_(APP.SH.ACTIVITY);
  var lh = list.getRange(2, 1, 1, list.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var set = function (colName, v) {
    var c = lh.indexOf(colName);
    if (c >= 0) list.getRange(act.__row, c + 1).setValue(v);
  };
  set('활동명', name);
  set('입력 항목', cols.join('|'));
  set('활동 개요', desc);

  // 4) 최종취합 시트의 활동 이름 열도 갱신
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { kept: moved.kept, added: moved.added, removed: moved.removed, rows: rows,
           inSheet: act.inSheet, exSheet: act.exSheet, name: name };
}

/** 입력 항목 검사 — 만들 때와 바꿀 때 같은 규칙 */
function validateColumns_(columns) {
  var cols = Array.isArray(columns) ? columns.map(function (c) { return String(c).trim(); }).filter(String) : parseColumns(columns);
  if (!cols.length) throw new Error('입력 항목을 1개 이상 적어 주세요.');
  if (cols.length > 12) throw new Error('입력 항목은 12개 이하로 해 주세요.');
  var seen = {};
  cols.forEach(function (c) {
    if (RESERVED_NAMES.indexOf(c) >= 0) throw new Error('입력 항목에 "' + c + '"은(는) 쓸 수 없습니다. 시스템이 쓰는 이름입니다.');
    if (seen[c]) throw new Error('입력 항목이 중복됩니다: ' + c);
    seen[c] = 1;
  });
  return cols;
}

function ensureRows_(sheet, need) {
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows() + 5);
}

function buildActivityExampleSheet_(key, name, cols, examples) {
  var s = ss_().insertSheet(sheetNameEx_(key));
  exampleLayout_(s, name, cols);
  var rows = Math.max(EXAMPLE_ROWS_DEFAULT, (examples || []).length);
  writeExampleRows_(s, cols, examples || [], APP.DATA_ROW, rows);
  return s;
}

/** 예시 시트의 머리말·헤더·폭 (구조가 깨졌을 때 복구용으로도 씀) */
function exampleLayout_(s, name, cols) {
  var head = ['예시번호'].concat(cols).concat(['결과', '바이트', '검증']);
  var n = head.length;
  banner_(s, n, '▶ ' + name + ' 예시',
    '모범 예시를 채울수록 AI 결과의 톤과 구조가 안정됩니다. 왼쪽에는 학생 자료를, [결과] 칸에는 선생님이 직접 쓴 문장을 넣으세요. ' +
    '비워 두어도 동작합니다. 칸이 모자라면 메뉴 [예시 칸 늘리기], 초안이 필요하면 [예시 더 만들기(AI)], ' +
    '써 놓은 예시가 기재요령에 걸리는지는 [예시 검증]으로 확인하세요.');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n, '#455a64');
  s.setFrozenRows(APP.HEAD_ROW);
  s.setColumnWidth(1, 70);
  for (var i = 0; i < cols.length; i++) s.setColumnWidth(2 + i, 230);
  s.setColumnWidth(n - 2, 440);  // 결과
  s.setColumnWidth(n - 1, 70);   // 바이트
  s.setColumnWidth(n, 220);      // 검증
  return n;
}

/**
 * 예시 행을 채우고 서식을 입힌다.
 * @param startRow 쓰기 시작 행, count 행 수
 */
function writeExampleRows_(s, cols, examples, startRow, count) {
  var n = 1 + cols.length + 3;
  var cResult = 1 + cols.length + 1;
  var need = startRow + count - 1;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 2);

  var firstNo = startRow - APP.DATA_ROW + 1;
  var rows = [];
  for (var e = 0; e < count; e++) {
    var ex = examples[e];
    var r = [firstNo + e];
    for (var c = 0; c < cols.length; c++) r.push(ex && ex.values ? (ex.values[c] || '') : '');
    r.push(ex ? (ex.result || '') : '');
    rows.push(r);
  }
  s.getRange(startRow, 1, count, cResult).setValues(rows)
    .setWrap(true).setVerticalAlignment('top');
  s.getRange(startRow, 2, count, cols.length).setBackground(APP.COLORS.input);
  s.getRange(startRow, cResult, count, 1).setBackground(APP.COLORS.output);

  var f = [];
  for (var i = 0; i < count; i++) {
    var a1 = s.getRange(startRow + i, cResult).getA1Notation();
    f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
  }
  s.getRange(startRow, cResult + 1, count, 1).setFormulas(f);
  s.getRange(startRow, cResult + 2, count, 1)
    .setWrap(true).setVerticalAlignment('top').setFontSize(9);
  s.setRowHeights(startRow, count, 96);
  return n;
}

/* --------------------------------------------------------- 직접 추가 UI */
function addActivityDialog() {
  var ui = ui_();
  var name = promptText_('활동 만들기 (1/4)', '활동 이름을 입력하세요.\n예) 수학탐구저널, 실험보고서, 전기전자 동아리 탐구');
  if (name === null) return;

  var recs = getRecordTypes_();
  var recList = recs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' (' + r.name + ', ' + r.chars + '자)'; }).join('\n');
  var recAns = promptText_('활동 만들기 (2/4)', '어떤 기록인가요? 번호를 입력하세요.\n\n' + recList);
  if (recAns === null) return;
  var rec = recs[Number(recAns) - 1];
  if (!rec) { ui.alert('번호가 올바르지 않습니다.'); return; }

  var subs = getSubjects_();
  var subList = subs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' — ' + r.name; }).join('\n');
  var subAns = promptText_('활동 만들기 (3/4)', '어느 교과·영역인가요? 번호를 입력하세요.\n창체·행발이면 "공통"을 고르세요.\n\n' + subList);
  if (subAns === null) return;
  var sub = subs[Number(subAns) - 1];
  if (!sub) { ui.alert('번호가 올바르지 않습니다.'); return; }

  var cols = promptText_('활동 만들기 (4/4)',
    '학생에게 받을 자료 항목을 쉼표로 나열하세요.\n예) 탐구주제, 선정이유, 탐구과정, 알게된점, 한계와 개선점');
  if (cols === null) return;

  try {
    var r = createActivity_({ key: name, name: name, recordKey: rec.key, subjectKey: sub.key, columns: cols, desc: '' });
    ui.alert(APP.MENU, '활동을 만들었습니다.\n\n입력 시트: ' + r.inSheet + '\n예시 시트: ' + r.exSheet +
      '\n\n[🗂 활동목록] 시트의 [활동 개요] 칸에 한두 줄 설명을 적으면 결과가 더 좋아집니다.', ui.ButtonSet.OK);
    ss_().setActiveSheet(sh_(r.inSheet));
  } catch (e) { ui.alert(APP.MENU, '오류: ' + e.message, ui.ButtonSet.OK); }
}

function promptText_(title, msg) {
  var res = ui_().prompt(title, msg, ui_().ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui_().Button.OK) return null;
  return res.getResponseText().trim();
}

/* ------------------------------------------------------------- 복제/삭제 */
function duplicateActivityDialog() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('복제할 활동이 없습니다.'); return; }
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_('활동 복제', '복제할 활동 번호를 입력하세요.\n\n' + list);
  if (ans === null) return;
  var src = acts[Number(ans) - 1];
  if (!src) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  var newName = promptText_('활동 복제', '새 활동 이름을 입력하세요.');
  if (!newName) return;
  try {
    var exs = readExampleRows_(src).map(function (e) {
      return { values: e.values, result: e.result };
    });
    var r2 = createActivity_({
      key: newName, name: newName, recordKey: src.recordKey, subjectKey: src.subjectKey,
      chars: src.chars, columns: src.columns, desc: src.desc, examples: exs
    });
    ui_().alert(APP.MENU, '복제 완료: ' + r2.inSheet, ui_().ButtonSet.OK);
  } catch (e) { ui_().alert(APP.MENU, '오류: ' + e.message, ui_().ButtonSet.OK); }
}

function deleteActivityDialog() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('삭제할 활동이 없습니다.'); return; }
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_('활동 삭제', '삭제할 활동 번호를 입력하세요.\n\n' + list);
  if (ans === null) return;
  var a = acts[Number(ans) - 1];
  if (!a) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  var c = ui_().alert(APP.MENU,
    '[' + a.key + '] 활동과 시트 2개(' + a.inSheet + ', ' + a.exSheet + ')를 삭제합니다.\n' +
    '입력한 학생 자료와 생성 결과도 함께 사라집니다. 되돌릴 수 없습니다.\n\n계속할까요?',
    ui_().ButtonSet.YES_NO);
  if (c !== ui_().Button.YES) return;
  [a.inSheet, a.exSheet].forEach(function (n) { var s = sh_(n); if (s) ss_().deleteSheet(s); });
  shRequire_(APP.SH.ACTIVITY).deleteRow(a.__row);
  toast_('삭제 완료: ' + a.key);
}

/* --------------------------------------------------------- 프롬프트 확인 */
function previewPrompt() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('먼저 활동을 만드세요.'); return; }
  var cur = ss_().getActiveSheet().getName();
  var target = null;
  acts.forEach(function (a) { if (a.inSheet === cur || a.exSheet === cur) target = a; });
  if (!target) {
    var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key; }).join('\n');
    var ans = promptText_('프롬프트 미리보기', '활동 번호를 입력하세요.\n\n' + list);
    if (ans === null) return;
    target = acts[Number(ans) - 1];
    if (!target) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  }
  var p = promptFor_(target);
  var tok = estimateTokens(p);
  var batchN = Math.max(1, Math.min(10, Number(cfg_('한 번에 묶을 학생 수', 5)) || 1));
  var costLine = '규칙 부분 약 ' + fmtNum_(tok) + '토큰(추정)' +
    (batchN > 1 ? ' · 학생 ' + batchN + '명씩 묶어 보내므로 학생 1명당 약 ' + fmtNum_(Math.round(tok / batchN)) + '토큰' : ' · 학생마다 이만큼 보냄') +
    ' · 생각 줄이기 ' + (cfgBool_('생각 줄이기', true) ? '켜짐' : '꺼짐');
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:8px">' +
    '<div style="color:#555;margin-bottom:8px">활동 <b>' + escHtml_(target.key) + '</b> · ' +
    byteLen(p) + '바이트 · ' + escHtml_(costLine) + '</div>' +
    '<textarea style="width:100%;height:520px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;' +
    'border:1px solid #ccd;border-radius:6px;padding:10px" readonly>' + escHtml_(p) + '</textarea>' +
    '<p style="color:#777;font-size:12px">이 프롬프트는 [기록종류]·[교과영역]·[공통규칙]·[활동목록]에서 자동 조립됩니다. ' +
    '바꾸고 싶은 문장이 있으면 해당 시트를 고치면 모든 활동에 반영됩니다.</p></div>')
    .setWidth(820).setHeight(660);
  ui_().showModalDialog(html, '프롬프트 미리보기 — ' + target.name);
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
