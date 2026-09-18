/**
 * 세특 작성 도우미 v3 — 학생 명단 동기화
 * 명단 시트의 반/번호/이름/성취수준을 모든 활동 입력 시트와 최종취합에 반영.
 * 이미 입력된 학생 데이터는 반·번호를 키로 보존한다.
 */

function getRoster_() {
  var s = shRequire_(APP.SH.ROSTER);
  var last = s.getLastRow();
  if (last < 3) return [];
  var v = s.getRange(3, 1, last - 2, 4).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var cls = String(v[i][0]).trim(), no = String(v[i][1]).trim();
    if (!cls && !no) continue;
    out.push({ cls: v[i][0], no: v[i][1], name: v[i][2], grade: v[i][3], id: cls + '-' + no });
  }
  return out;
}

function syncRoster() {
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단] 시트에 학생을 먼저 입력하세요.', ui_().ButtonSet.OK); return; }
  var acts = getActivities_();
  var done = 0;
  acts.forEach(function (a) {
    if (a.inSheet && sh_(a.inSheet)) { syncRosterInto_(sh_(a.inSheet), roster); done++; }
  });
  if (compileSheets_().length) { try { buildCompileCore_(); } catch (e) {} }
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

  var existing = {};
  if (lastRow >= first) {
    var vals = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getValues();
    var forms = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getFormulas();
    for (var i = 0; i < vals.length; i++) {
      var id = String(vals[i][0]).trim() + '-' + String(vals[i][1]).trim();
      if (id === '-') continue;
      var row = [];
      for (var c = 0; c < lastCol; c++) row.push(forms[i][c] ? forms[i][c] : vals[i][c]);
      existing[id] = row;
    }
  }

  var out = [];
  roster.forEach(function (st) {
    var row = existing[st.id];
    if (!row) { row = []; for (var c = 0; c < lastCol; c++) row.push(''); }
    row[0] = st.cls; row[1] = st.no; row[2] = st.name; row[3] = st.grade;
    out.push(row);
  });

  var needRows = first + out.length - 1;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows() + 5);
  if (lastRow >= first) sheet.getRange(first, 1, Math.max(lastRow - first + 1, out.length), lastCol).clearContent();
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
  if (cModel) {
    sheet.getRange(first, cModel, nRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(modelChoices_(), true).build());
  }
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
