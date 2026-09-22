/**
 * 세특 작성 도우미 v3 — 학생 명단 동기화
 * 명단 시트의 (학년)/반/번호/이름/성취수준을 모든 활동 입력 시트와 최종취합에 반영.
 * 이미 입력된 학생 데이터는 반·번호를 키로 보존하고, 키가 바뀌면 이름으로 한 번 더 찾는다.
 * 명단은 붙여넣기·엑셀·CSV 파일 어느 것으로도 넣을 수 있다(해석은 14_RosterParse.gs).
 */

/** 명단 방식: 명단 시트 머리글 첫 칸이 '학년'이면 'grade', 아니면 'class' */
function rosterMode_() {
  var s = sh_(APP.SH.ROSTER);
  if (!s || s.getLastRow() < 2) return 'class';
  return String(s.getRange(2, 1).getValue()).trim() === '학년' ? 'grade' : 'class';
}

/** 활동·취합·검토 시트의 첫 열 머리글 */
function classHead_(mode) { return (mode || rosterMode_()) === 'grade' ? '학년-반' : '반'; }

/**
 * 명단 읽기 — 머리글 이름으로 열을 찾으므로 [반·번호]·[학년·반·번호] 어느 방식이든 읽힌다.
 * cls 는 활동 시트 A열에 쓰는 표시값(학년 방식이면 "2-3"), id 는 "A열-번호".
 */
function getRoster_() {
  var s = shRequire_(APP.SH.ROSTER);
  var last = s.getLastRow();
  if (last < 3) return [];
  var width = Math.max(s.getLastColumn(), 4);
  var head = s.getRange(2, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  var ix = function (n) { return head.indexOf(n); };
  var iY = ix('학년'), iC = ix('반'), iN = ix('번호'), iName = ix('이름'), iL = ix('성취수준');
  if (iC < 0 || iN < 0 || iName < 0) { iY = -1; iC = 0; iN = 1; iName = 2; iL = 3; }   // 머리글이 지워진 옛 명단
  var v = s.getRange(3, 1, last - 2, width).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var year = iY >= 0 ? String(v[i][iY]).trim() : '';
    var clsRaw = v[i][iC], no = v[i][iN];
    if (!String(clsRaw).trim() && !String(no).trim()) continue;
    var cls = classLabel(year, clsRaw);
    var st = { year: year, clsRaw: clsRaw, cls: cls, no: no, name: v[i][iName],
               grade: iL >= 0 ? v[i][iL] : '', id: String(cls).trim() + '-' + String(no).trim() };
    st.label = studentLabel({ year: year, cls: clsRaw, no: no, name: st.name });
    out.push(st);
  }
  return out;
}

/* --------------------------------------------------------- 명단 불러오기 */
/** 메뉴 ③ — 파일·붙여넣기로 명단 넣기 */
function openRosterDialog(fromOnboard) {
  var t = HtmlService.createTemplateFromFile('UI_Roster');
  t.fromOnboard = !!fromOnboard;
  ui_().showModalDialog(t.evaluate().setWidth(720).setHeight(660), '학생 명단 불러오기');
}

function rosterDialogContext() {
  var cnt = 0;
  try { cnt = getRoster_().length; } catch (e) {}
  return { mode: rosterMode_(), count: cnt, head: ROSTER_HEAD, masked: maskName_() };
}

/**
 * 미리 보기 — 저장하지 않는다
 * @param {{rows?:Array<Array>, text?:string, mode:string}} p  파일에서 읽은 표(rows) 또는 붙여넣은 글(text)
 */
function rosterPreview(p) {
  var rows = p.rows || rosterTextToRows(p.text || '');
  var r = parseRosterRows(rows, p.mode || 'auto');
  var detected = (p.mode && p.mode !== 'auto') ? parseRosterRows(rows, 'auto').mode : r.mode;
  return {
    mode: r.mode, detected: detected, header: r.header, count: r.students.length,
    labels: r.students.slice(0, 300).map(studentLabel),
    students: r.students.slice(0, 300), skipped: r.skipped.slice(0, 20), skippedCount: r.skipped.length,
    warnings: r.warnings.slice(0, 10)
  };
}

/** 저장 — 명단 시트를 통째로 바꾸고 모든 활동 시트에 반영한다 */
function rosterSave(p) {
  var rows = p.rows || rosterTextToRows(p.text || '');
  var r = parseRosterRows(rows, p.mode || 'auto');
  if (!r.students.length) {
    throw new Error('명단을 알아보지 못했습니다. ' + (r.mode === 'grade' ? '학년, 반, 번호, 이름' : '반, 번호, 이름') +
                    ' 순서로 한 줄에 한 명씩 넣거나, 양식 파일을 내려받아 채워 주세요.');
  }
  writeRosterSheet_(r.students, r.mode);
  var n = syncRosterAll_();
  return { count: r.students.length, mode: r.mode, synced: n, warnings: r.warnings };
}

/** 명단 시트 다시 쓰기 (방식이 바뀌면 머리글과 열 수도 바뀐다) */
function writeRosterSheet_(students, mode) {
  var s = shOrCreate_(APP.SH.ROSTER);
  var head = ROSTER_HEAD[mode] || ROSTER_HEAD['class'];
  var n = head.length, W = 5;
  ensureCols_(s, W);
  var last = s.getLastRow();
  if (last >= 2) s.getRange(2, 1, last - 1, W).clearContent();
  s.getRange(2, 1, 1, W).setBackground(null).setFontColor(null);
  s.getRange(3, 1, Math.max(s.getMaxRows() - 2, 1), W).clearDataValidations().setBackground(null);
  s.getRange(2, 1, 1, n).setValues([head]);
  styleHeader_(s, 2, n);
  var need = 2 + students.length + 50;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  if (students.length) {
    s.getRange(3, 1, students.length, n).setValues(students.map(function (st) { return rosterRowOf(st, mode); }));
  }
  s.getRange(3, 1, students.length + 50, n).setBackground(APP.COLORS.input);
  s.getRange(3, n, students.length + 50, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4', '5'], true).setAllowInvalid(true).build());
  (mode === 'grade' ? [60, 60, 60, 110, 100] : [70, 70, 110, 100]).forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
  rosterBanner_(s, mode);
}

function rosterBanner_(s, mode) {
  var n = (ROSTER_HEAD[mode] || ROSTER_HEAD['class']).length;
  banner_(s, Math.max(n, 5), '👤 학생명단 — ' + (mode === 'grade' ? '학년·반·번호 방식 (동아리·방과후)' : '반·번호 방식'),
    '메뉴 ③ [학생 명단 불러오기]에서 엑셀 양식을 내려받아 채운 뒤 파일을 올리면 한 번에 들어옵니다. ' +
    '여기서 직접 고쳤다면 메뉴 ③ 아래 [학생 명단 동기화]를 누르세요. 성취수준(1~5)은 과세특에만 쓰이며 비워 둬도 됩니다.');
}

/** 모든 활동 시트·취합 시트·검토 시트에 명단 반영. 반영한 활동 시트 수 */
function syncRosterAll_() {
  var roster = getRoster_();
  var done = 0;
  getActivities_().forEach(function (a) {
    if (a.inSheet && sh_(a.inSheet)) { syncRosterInto_(sh_(a.inSheet), roster); done++; }
  });
  if (compileSheets_().length) { try { buildCompileCore_(); } catch (e) {} }
  var rv = sh_(APP.SH.REVIEW);
  if (rv) { try { rv.getRange(3, 1).setValue(classHead_()); rv.getRange(4, 1).setNumberFormat('@'); } catch (e) {} }
  return done;
}

function syncRoster() {
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단] 시트에 학생을 먼저 입력하세요.\n(메뉴 ③ 학생 명단 불러오기)', ui_().ButtonSet.OK); return; }
  var done = syncRosterAll_();
  toast_('학생 ' + roster.length + '명 → 활동 시트 ' + done + '개 동기화 완료', APP.MENU);
}

/**
 * 시트의 A~D열(반/번호/이름/성취수준)을 명단에 맞춰 재배치.
 * 기존 행은 "반-번호"로 매칭해 E열 이후 내용을 그대로 따라 옮긴다.
 */
function syncRosterInto_(sheet, roster) {
  var head = APP.HEAD_ROW, first = APP.DATA_ROW;
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 4) return;

  var existing = {}, byName = {}, nameCount = {};
  if (lastRow >= first) {
    var vals = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getValues();
    var forms = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getFormulas();
    for (var i = 0; i < vals.length; i++) {
      var id = String(vals[i][0]).trim() + '-' + String(vals[i][1]).trim();
      if (id === '-') continue;
      var row = [];
      for (var c = 0; c < lastCol; c++) row.push(forms[i][c] ? forms[i][c] : vals[i][c]);
      existing[id] = row;
      var nm = String(vals[i][2]).trim();
      if (nm) { nameCount[nm] = (nameCount[nm] || 0) + 1; byName[nm] = row; }
    }
  }

  var out = [], used = {};
  roster.forEach(function (st) {
    var row = existing[st.id];
    // 명단 방식을 바꿨거나 반이 바뀌어 id 가 달라져도, 이름이 한 명뿐이면 그 학생 자료를 따라 옮긴다
    var nm = String(st.name).trim();
    if (!row && nm && nameCount[nm] === 1 && !used[nm]) row = byName[nm];
    if (row) used[nm] = true;
    row = row ? row.slice() : [];
    while (row.length < lastCol) row.push('');
    row[0] = st.cls; row[1] = st.no; row[2] = st.name; row[3] = st.grade;
    out.push(row);
  });
  sheet.getRange(head, 1).setValue(classHead_());

  var needRows = first + out.length - 1;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows() + 5);
  if (lastRow >= first) sheet.getRange(first, 1, Math.max(lastRow - first + 1, out.length), lastCol).clearContent();
  // "2-3" 이 날짜(2월 3일)로 바뀌지 않도록 첫 열은 글자 서식
  sheet.getRange(first, 1, Math.max(out.length, 1), 1).setNumberFormat('@');
  if (out.length) sheet.getRange(first, 1, out.length, lastCol).setValues(out);

  applyRowFormat_(sheet, out.length);
}

/** 데이터 영역 서식·체크박스·수식을 다시 입힌다 */
function applyRowFormat_(sheet, nRows) {
  if (!nRows) return;
  var first = APP.DATA_ROW, head = APP.HEAD_ROW;
  var cGen = colOf_(sheet, head, '생성');
  var cModel = colOf_(sheet, head, '모델');
  var cAi = colOf_(sheet, head, 'AI 결과');
  var cFinal = colOf_(sheet, head, '최종본');
  var cBytes = colOf_(sheet, head, '바이트');
  var cValid = colOf_(sheet, head, '검증');

  if (cGen) {
    sheet.getRange(first, cGen, nRows, 1).insertCheckboxes();
    var blanks = [];
    var cur = sheet.getRange(first, cGen, nRows, 1).getValues();
    for (var i = 0; i < nRows; i++) blanks.push([cur[i][0] === true]);
    sheet.getRange(first, cGen, nRows, 1).setValues(blanks);
  }
  if (cModel) sheet.getRange(first, cModel, nRows, 1).setDataValidation(modelValidation_());
  if (cAi) sheet.getRange(first, cAi, nRows, 1).setBackground(APP.COLORS.output).setWrap(true).setVerticalAlignment('top');
  if (cFinal) sheet.getRange(first, cFinal, nRows, 1).setBackground(APP.COLORS.paste).setWrap(true).setVerticalAlignment('top');
  if (cBytes && cFinal) {
    var f = [];
    for (var r = 0; r < nRows; r++) {
      var a1 = sheet.getRange(first + r, cFinal).getA1Notation();
      f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
    }
    sheet.getRange(first, cBytes, nRows, 1).setFormulas(f);
  }
  if (cValid) sheet.getRange(first, cValid, nRows, 1).setWrap(true).setVerticalAlignment('top').setFontSize(9);
  sheet.setRowHeights(first, nRows, 84);
}
