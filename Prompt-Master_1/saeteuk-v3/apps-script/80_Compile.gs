/**
 * 세특 작성 도우미 v3 — 최종취합
 *
 * v2와 달라진 점: 취합 시트를 "기록종류별"로 나눕니다.
 * 과세특·동아리·자율·진로·행발은 나이스에서 서로 다른 칸에 들어가므로
 * 한 덩어리로 합치면 안 됩니다. 기록종류별로 합치고, 그 종류의 글자수에 맞춰 압축합니다.
 */

function compileSheetName_(recKey) { return APP.SH.COMPILE_PREFIX + recKey; }

function recordKeyOfCompile_(sheetName) {
  if (String(sheetName).indexOf(APP.SH.COMPILE_PREFIX) !== 0) return '';
  return String(sheetName).slice(APP.SH.COMPILE_PREFIX.length);
}

function compileSheets_() {
  return ss_().getSheets().filter(function (s) {
    return String(s.getName()).indexOf(APP.SH.COMPILE_PREFIX) === 0;
  });
}

function compileLimitOf_(sheetName) {
  var rec = findByKey(getRecordTypes_(), recordKeyOfCompile_(sheetName));
  return (rec ? rec.chars : 500) * 3;
}

/** 메뉴: 최종취합 시트 생성/갱신 */
function buildCompile() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert(APP.MENU, '먼저 활동을 만드세요.', ui_().ButtonSet.OK); return; }
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단]을 먼저 입력하세요.', ui_().ButtonSet.OK); return; }
  var made = buildCompileCore_();
  toast_('최종취합 갱신: ' + made.join(', '), APP.MENU);
}

/** 알림 없이 기록종류별 취합 시트를 갱신. 만들어진 기록종류 키 배열 반환 */
function buildCompileCore_() {
  var acts = getActivities_();
  var roster = getRoster_();
  if (!acts.length || !roster.length) return [];
  var byRec = {};
  acts.forEach(function (a) {
    if (!a.recordKey) return;
    (byRec[a.recordKey] = byRec[a.recordKey] || []).push(a);
  });
  var made = [];
  Object.keys(byRec).forEach(function (rk) {
    buildCompileFor_(rk, byRec[rk], roster);
    made.push(rk);
  });
  return made;
}

function buildCompileFor_(recKey, acts, roster) {
  var rec = findByKey(getRecordTypes_(), recKey);
  var limit = (rec ? rec.chars : 500) * 3;
  var name = compileSheetName_(recKey);
  var s = sh_(name);

  // 기존 [최종본] 보존
  var keepFinal = {};
  if (s) {
    var cF = colOf_(s, APP.HEAD_ROW, '최종본');
    if (cF && s.getLastRow() >= APP.DATA_ROW) {
      var cnt = s.getLastRow() - APP.DATA_ROW + 1;
      var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
      var fv = s.getRange(APP.DATA_ROW, cF, cnt, 1).getValues();
      for (var i = 0; i < cnt; i++) {
        var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
        if (String(fv[i][0]).trim()) keepFinal[id] = fv[i][0];
      }
    }
    s.clear();
    s.setFrozenRows(0);
    s.setFrozenColumns(0);
  } else {
    s = ss_().insertSheet(name);
  }

  var head = ['반', '번호', '이름', '성취수준']
    .concat(acts.map(function (a) { return a.name; }))
    .concat(['합본', '합본 바이트', '압축', '모델', 'AI 압축결과', '최종본', '바이트', '검증']);
  head[0] = classHead_();
  var n = head.length;

  splitBanner_(s, 3, n,
    '📦 ' + (rec ? rec.name : recKey) + '\n' + (rec ? rec.chars : 500) + '자(' + limit + '바이트)',
    '① 메뉴 ⑦ [최종취합 시트 생성/갱신]으로 활동 결과를 모읍니다  →  ② 합본이 한도를 넘는 학생만 [압축] 체크  →  ' +
    '③ 메뉴 ⑦ [최종 압축본 생성]  →  ④ [최종본] 칸에서 다듬어 나이스에 붙여넣기');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n, '#4e342e');
  s.setFrozenRows(APP.HEAD_ROW);
  s.setFrozenColumns(3);

  // 활동별 결과를 값으로 끌어오기
  var pulled = acts.map(function (a) { return pullResults_(a); });

  var rows = [];
  roster.forEach(function (st) {
    var r = [st.cls, st.no, st.name, st.grade];
    var texts = [];
    pulled.forEach(function (map) {
      var t = map[st.id] || '';
      r.push(t);
      if (t) texts.push(t);
    });
    var merged = texts.join(' ');
    r.push(merged);
    r.push(merged ? byteLen(merged) : '');
    r.push(false);                    // 압축 체크박스
    r.push('');                       // 모델
    r.push('');                       // AI 압축결과
    r.push(keepFinal[st.id] || (merged && byteLen(merged) <= limit ? merged : ''));
    r.push('');                       // 바이트(수식)
    r.push('');                       // 검증
    rows.push(r);
  });

  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, 1).setNumberFormat('@');
  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, n).setValues(rows);

  var base = 4 + acts.length;
  var cMerge = base + 1, cMB = base + 2, cChk = base + 3, cModel = base + 4,
      cAi = base + 5, cFinal = base + 6, cBytes = base + 7, cValid = base + 8;

  s.setColumnWidth(1, 55); s.setColumnWidth(2, 55); s.setColumnWidth(3, 90); s.setColumnWidth(4, 80);
  for (var i = 0; i < acts.length; i++) s.setColumnWidth(5 + i, 300);
  s.setColumnWidth(cMerge, 340); s.setColumnWidth(cMB, 80); s.setColumnWidth(cChk, 60);
  s.setColumnWidth(cModel, 150); s.setColumnWidth(cAi, 400); s.setColumnWidth(cFinal, 420);
  s.setColumnWidth(cBytes, 70); s.setColumnWidth(cValid, 220);

  if (rows.length) {
    s.getRange(APP.DATA_ROW, 1, rows.length, n).setWrap(true).setVerticalAlignment('top');
    s.getRange(APP.DATA_ROW, 1, rows.length, 4).setBackground(APP.COLORS.lock);
    s.getRange(APP.DATA_ROW, 5, rows.length, acts.length + 2).setBackground(APP.COLORS.lock);
    s.getRange(APP.DATA_ROW, cChk, rows.length, 1).insertCheckboxes();
    s.getRange(APP.DATA_ROW, cModel, rows.length, 1).setDataValidation(modelValidation_());
    s.getRange(APP.DATA_ROW, cAi, rows.length, 1).setBackground(APP.COLORS.output);
    s.getRange(APP.DATA_ROW, cFinal, rows.length, 1).setBackground(APP.COLORS.paste);
    var f = [];
    for (var r2 = 0; r2 < rows.length; r2++) {
      var a1 = s.getRange(APP.DATA_ROW + r2, cFinal).getA1Notation();
      f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
    }
    s.getRange(APP.DATA_ROW, cBytes, rows.length, 1).setFormulas(f);
    s.setRowHeights(APP.DATA_ROW, rows.length, 90);

    // 합본 바이트가 한도를 넘으면 붉게
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(limit)
      .setBackground(APP.COLORS.warn)
      .setRanges([s.getRange(APP.DATA_ROW, cMB, rows.length, 1)]).build();
    s.setConditionalFormatRules([rule]);
  }
}

/** 활동 입력 시트에서 "반-번호 → 최종본(없으면 AI 결과)" 맵 */
function pullResults_(act) {
  var map = {};
  var s = sh_(act.inSheet);
  if (!s || s.getLastRow() < APP.DATA_ROW) return map;
  var cAi = colOf_(s, APP.HEAD_ROW, 'AI 결과');
  var cFi = colOf_(s, APP.HEAD_ROW, '최종본');
  var cnt = s.getLastRow() - APP.DATA_ROW + 1;
  var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var ai = cAi ? s.getRange(APP.DATA_ROW, cAi, cnt, 1).getValues() : null;
  var fi = cFi ? s.getRange(APP.DATA_ROW, cFi, cnt, 1).getValues() : null;
  for (var i = 0; i < cnt; i++) {
    var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
    if (id === '-') continue;
    var t = fi ? String(fi[i][0] || '').trim() : '';
    if (!t && ai) t = String(ai[i][0] || '').trim();
    if (t.indexOf('⚠') === 0) t = '';
    map[id] = t;
  }
  return map;
}

/* ----------------------------------------------------------- 압축 생성 */
function compileChecked() {
  var s = ss_().getActiveSheet();
  var recKey = recordKeyOfCompile_(s.getName());
  if (!recKey) {
    var list = compileSheets_();
    if (list.length === 1) { s = list[0]; recKey = recordKeyOfCompile_(s.getName()); ss_().setActiveSheet(s); }
    else { ui_().alert(APP.MENU, '압축할 최종취합 시트를 연 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  }
  var rec = findByKey(getRecordTypes_(), recKey);
  var limit = (rec ? rec.chars : 500) * 3;

  var cChk = colOf_(s, APP.HEAD_ROW, '압축');
  var cMerge = colOf_(s, APP.HEAD_ROW, '합본');
  var cModel = colOf_(s, APP.HEAD_ROW, '모델');
  var cAi = colOf_(s, APP.HEAD_ROW, 'AI 압축결과');
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cChk || !cMerge) { ui_().alert(APP.MENU, '시트 구조가 올바르지 않습니다. 메뉴 ⑥으로 다시 생성하세요.', ui_().ButtonSet.OK); return; }

  var last = s.getLastRow();
  var cnt = last - APP.DATA_ROW + 1;
  if (cnt < 1) return;
  var chk = s.getRange(APP.DATA_ROW, cChk, cnt, 1).getValues();
  var rows = [];
  for (var i = 0; i < cnt; i++) if (chk[i][0] === true) rows.push(APP.DATA_ROW + i);
  if (!rows.length) { toast_('[압축] 체크된 행이 없습니다.'); return; }

  var defModel = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var system = compressPrompt_(rec);
  var okN = 0, errN = 0, leftN = 0, backupN = 0, t0 = Date.now();
  usageReset_();

  for (var k = 0; k < rows.length; k++) {
    var row = rows[k];
    if (Date.now() - t0 > RUN_BUDGET_MS) { leftN = rows.length - k; break; }
    var merged = String(s.getRange(row, cMerge).getValue() || '').trim();
    if (!merged) { s.getRange(row, cChk).setValue(false); continue; }
    var model = cModel ? String(s.getRange(row, cModel).getValue()).trim() : '';
    if (!model) model = defModel;
    toast_((k + 1) + '/' + rows.length + ' 압축 중…', APP.MENU);
    try {
      if (providerOf_(model) === 'subscription') {
        s.getRange(row, cAi).setFormula(subscriptionFormula_(system, merged));
        continue;
      }
      var res = callWithBackup_(system, merged, model);
      var txt = cleanResult_(res.text);
      if (byteLen(txt) > limit) txt = trimToBytes(txt, limit);
      s.getRange(row, cAi).setValue(txt);
      if (cValid) s.getRange(row, cValid).setValue(formatIssues(validateResult(txt, limit, PRESET_BANNED, PRESET_FORMAT_RULES)) +
        (res.backup ? '\n(예비 모델 ' + res.model + ' 로 생성)' : ''));
      if (res.backup) backupN++;
      s.getRange(row, cChk).setValue(false);
      okN++;
    } catch (e) {
      s.getRange(row, cAi).setValue('⚠ 실패: ' + e.message);
      s.getRange(row, cChk).setValue(false);
      errN++;
    }
    SpreadsheetApp.flush();
  }
  var done = '압축 완료 ' + okN + '건' + (errN ? ' / 실패 ' + errN + '건' : '') + (backupN ? ' / 예비 모델 ' + backupN + '건' : '');
  var used = usageText_();
  if (used) done += '\n' + used;
  if (leftN) {
    ui_().alert(APP.MENU, done + '\n\n실행 시간 제한(약 6분)에 가까워져 ' + leftN + '건을 남기고 멈췄습니다.\n' +
      '남은 행은 [압축] 체크가 그대로 있으니 한 번 더 실행하세요.', ui_().ButtonSet.OK);
  } else toast_(done, APP.MENU);
}

/** 압축용 프롬프트 (기록종류 규칙을 그대로 따름) */
function compressPrompt_(rec) {
  var com = getCommon_();
  var chars = rec ? rec.chars : 500;
  var bytes = chars * 3;
  var P = [];
  P.push('# 역할\n당신은 ' + (rec && rec.role ? rec.role.replace(/\{[^}]+\}/g, '').replace(/\s{2,}/g, ' ').trim() : '고등학교 교사') + '입니다.');
  P.push('# 과제\n여러 활동에서 작성된 특기사항 문장들이 주어진다. 이를 중복 없이 하나의 ' +
         (rec ? rec.name : '특기사항') + '으로 통합한다.\n' +
         '- 내용을 새로 지어내지 않는다. 주어진 문장에 있는 사실만 쓴다.\n' +
         '- 같은 역량이 반복되면 한 번으로 합치고, 서로 다른 장면은 살린다.\n' +
         '- 시간 순서 또는 역량의 흐름에 따라 자연스럽게 잇는다.');
  if (com.WRITING_RULES) P.push('# 서술 규칙\n' + com.WRITING_RULES);
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);
  P.push('# 분량\n- 반드시 ' + chars + '자(' + bytes + '바이트) 이내로 작성한다.\n' +
         '- ' + Math.round(bytes * 0.9) + '바이트 이상을 채운다.\n' + (com.BYTE_RULE || ''));
  P.push('# 출력\n통합된 특기사항 본문만 한 문단으로 출력한다. 설명이나 머리말을 붙이지 않는다.');
  return P.join('\n\n');
}
