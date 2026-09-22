/**
 * 세특 작성 도우미 v3 — 예시 관리
 *
 * 예시는 결과 품질에 가장 크게 작용하는 입력입니다.
 * 동시에 가장 위험한 입력이기도 합니다. 예시가 기재요령을 어기면
 * AI가 그 표현을 그대로 따라 쓰기 때문입니다. 그래서 예시도 검증합니다.
 */

/** 현재(또는 지정) 시트가 어떤 활동의 예시 시트인지 */
function activityOfExampleSheet_(name) {
  var acts = getActivities_();
  for (var i = 0; i < acts.length; i++) if (acts[i].exSheet === name) return acts[i];
  return null;
}

/** 예시 시트를 고른다. 현재 시트가 예시/입력 시트면 그 활동을 쓰고, 아니면 물어본다. */
function pickExampleActivity_(title) {
  var cur = ss_().getActiveSheet().getName();
  var act = activityOfExampleSheet_(cur) || activityOfSheet_(cur);
  if (act) return act;
  var acts = getActivities_();
  if (!acts.length) { ui_().alert(APP.MENU, '먼저 활동을 만드세요.', ui_().ButtonSet.OK); return null; }
  if (acts.length === 1) return acts[0];
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_(title || '활동 선택', '어느 활동인가요? 번호를 입력하세요.\n\n' + list);
  if (ans === null) return null;
  var a = acts[Number(ans) - 1];
  if (!a) { ui_().alert('번호가 올바르지 않습니다.'); return null; }
  return a;
}

/** 예시 시트의 마지막 데이터 행 (비어 있으면 DATA_ROW - 1) */
function lastExampleRow_(sheet) {
  var last = sheet.getLastRow();
  return last < APP.DATA_ROW ? APP.DATA_ROW - 1 : last;
}

/* ------------------------------------------------------------ 칸 늘리기 */
function addExampleRows() {
  var act = pickExampleActivity_('예시 칸 늘리기');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다: ' + act.exSheet, ui_().ButtonSet.OK); return; }
  var ans = promptText_('예시 칸 늘리기', '몇 칸을 더 만들까요? (1~10)\n\n현재 ' +
    readExampleRows_(act).length + '개가 채워져 있습니다.');
  if (ans === null) return;
  var n = Math.max(1, Math.min(10, Number(ans) || 3));
  var cols = parseColumns(act.columns);
  writeExampleRows_(s, cols, [], lastExampleRow_(s) + 1, n);
  ss_().setActiveSheet(s);
  toast_(n + '칸을 추가했습니다.', act.name);
}

/* -------------------------------------------------------------- 검증 */
function validateExamples() {
  var act = pickExampleActivity_('예시 검증');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cValid) {
    ui_().alert(APP.MENU,
      '이 예시 시트에는 [검증] 열이 없습니다.\n메뉴 [예시 시트 구조 복구]를 먼저 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var limit = charsFor_(act) * 3;
  var rows = readExampleRows_(act);
  if (!rows.length) { toast_('채워진 예시가 없습니다.'); return; }

  var bad = 0, warn = 0;
  rows.forEach(function (e) {
    var v = validateResult(e.result, limit, PRESET_BANNED, PRESET_FORMAT_RULES);
    s.getRange(e.row, cValid).setValue(formatIssues(v));
    if (!v.ok) bad++;
    else if (v.issues.length) warn++;
  });

  var used = Math.min(rows.length, EXAMPLE_MAX);
  var promptBytes = byteLen(readExamples_(act));
  var msg = '예시 ' + rows.length + '개 검증 완료.\n' +
    '· 수정 필요 ' + bad + '개 / 확인 권장 ' + warn + '개\n\n' +
    '프롬프트에 들어가는 예시: ' + used + '개 (' + promptBytes.toLocaleString() + '바이트)';
  if (rows.length > EXAMPLE_MAX) {
    msg += '\n※ 앞에서부터 ' + EXAMPLE_MAX + '개만 프롬프트에 들어갑니다.';
  }
  if (bad) {
    msg += '\n\n⚠ 예시에 남아 있는 위반 표현은 AI가 그대로 따라 씁니다. 먼저 고쳐 주세요.';
  }
  ss_().setActiveSheet(s);
  ui_().alert('예시 검증 — ' + act.name, msg, ui_().ButtonSet.OK);
}

/* ------------------------------------------------- 구조 복구 (구버전 시트) */
function repairExampleSheet() {
  var act = pickExampleActivity_('예시 시트 구조 복구');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }
  var cols = parseColumns(act.columns);
  var keep = readExampleRows_(act).map(function (e) {
    return { values: e.values, result: e.result };
  });
  s.clear();
  s.setFrozenRows(0);
  exampleLayout_(s, act.name, cols);
  writeExampleRows_(s, cols, keep, APP.DATA_ROW, Math.max(EXAMPLE_ROWS_DEFAULT, keep.length));
  ss_().setActiveSheet(s);
  toast_('구조를 복구했습니다. 예시 ' + keep.length + '개 보존.', act.name);
}

/* --------------------------------------------------- AI 로 예시 더 만들기 */
function generateMoreExamples() {
  var act = pickExampleActivity_('예시 더 만들기');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }

  var existing = readExampleRows_(act);
  var ans = promptText_('예시 더 만들기 (AI)',
    '몇 개를 더 만들까요? (1~5)\n\n' +
    '현재 채워진 예시: ' + existing.length + '개\n' +
    (existing.length ? '기존 예시의 톤을 따라가되 소재와 수준이 겹치지 않게 만듭니다.'
                     : '기존 예시가 없으면 활동 개요만 보고 만듭니다. 한 개라도 직접 써 두면 결과가 훨씬 좋아집니다.'));
  if (ans === null) return;
  var want = Math.max(1, Math.min(5, Number(ans) || 2));

  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  if (providerOf_(model) === 'subscription') {
    ui_().alert(APP.MENU,
      '예시 생성에는 API 키가 필요합니다.\n[⚙️ 설정]의 활동용 모델을 ' + DEFAULT_MODEL + ' 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.',
      ui_().ButtonSet.OK);
    return;
  }

  toast_('예시 ' + want + '개 생성 중…', act.name);
  var made;
  try {
    made = suggestExamples_(act, existing, want, model);
  } catch (e) {
    ui_().alert(APP.MENU, '생성 실패: ' + e.message, ui_().ButtonSet.OK);
    return;
  }
  if (!made.length) { ui_().alert(APP.MENU, 'AI 응답에서 예시를 찾지 못했습니다. 다시 시도해 보세요.', ui_().ButtonSet.OK); return; }

  var cols = parseColumns(act.columns);
  writeExampleRows_(s, cols, made, lastExampleRow_(s) + 1, made.length);
  ss_().setActiveSheet(s);

  // 만들어진 예시도 바로 검증해 둔다
  try { validateExamplesQuiet_(act); } catch (e) {}

  ui_().alert('예시 더 만들기 — ' + act.name,
    made.length + '개를 추가했습니다.\n\n' +
    '※ AI가 만든 초안입니다. 실제 학생 활동과 맞지 않는 내용이 섞일 수 있으니\n' +
    '   내용을 본인 수업에 맞게 고친 뒤 쓰세요. [검증] 칸도 함께 확인하세요.',
    ui_().ButtonSet.OK);
}

/** 알림 없이 검증만 다시 적는다 */
function validateExamplesQuiet_(act) {
  var s = sh_(act.exSheet);
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cValid) return;
  var limit = charsFor_(act) * 3;
  readExampleRows_(act).forEach(function (e) {
    s.getRange(e.row, cValid).setValue(formatIssues(validateResult(e.result, limit, PRESET_BANNED, PRESET_FORMAT_RULES)));
  });
}

/**
 * AI에게 예시를 요청한다.
 * @return [{values:[], result:''}]
 */
function suggestExamples_(act, existing, want, model) {
  var recs = getRecordTypes_(), subs = getSubjects_(), com = getCommon_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var sub = findByKey(subs, act.subjectKey) || findByKey(subs, '공통');
  var cols = parseColumns(act.columns);
  var chars = charsFor_(act);

  var sys = [
    '당신은 학교생활기록부 특기사항 예시를 만드는 조수입니다.',
    '교사가 AI에게 보여 줄 "모범 예시"를 만드는 것이 임무입니다.',
    '',
    '# 출력 형식',
    '반드시 아래 JSON 하나만 출력한다. 설명·머리말·코드펜스를 붙이지 않는다.',
    '{"examples":[{"values":["항목1값","항목2값"],"result":"특기사항 예문"}]}',
    '- examples 는 정확히 ' + want + '개.',
    '- values 는 아래 입력 항목과 같은 순서, 같은 개수의 문자열 배열.',
    '- result 는 그 자료로 쓴 특기사항 본문 한 문단.',
    '',
    '# 입력 항목 (순서 고정)',
    cols.join(' | '),
    '',
    '# 대상 기록',
    rec.name + ' — ' + chars + '자(' + (chars * 3) + '바이트) 이내',
    rec.view || '',
    '',
    '# 활동',
    (act.name || '') + (act.desc ? ' — ' + act.desc : ''),
    '',
    '# 교과·영역 관점',
    (sub ? sub.comp : ''),
    '',
    '# result 가 지켜야 할 규칙',
    com.WRITING_RULES || '',
    '',
    com.NEIS_RULES || '',
    '',
    '# 다양성',
    '- ' + want + '개가 서로 다른 소재와 다른 수준을 다루도록 한다.',
    (rec.useGrade
      ? '- 성취수준이 높은 학생, 중간인 학생, 아직 부족한 학생이 고루 섞이게 한다. 부족한 경우도 노력한 지점과 성장 가능성을 담아 긍정적으로 쓴다.'
      : '- 적극적으로 주도한 경우, 묵묵히 맡은 몫을 해낸 경우, 시행착오를 겪은 경우가 섞이게 한다.'),
    '- 기존 예시와 소재가 겹치지 않게 한다.',
    '- values 는 교사가 실제로 적어 넣을 법한 길이로 짧게 쓴다. 한 항목당 한두 문장.'
  ].join('\n');

  var user;
  if (existing.length) {
    var shown = existing.slice(0, 3).map(function (e, i) {
      var parts = [];
      cols.forEach(function (c, ci) { if (e.values[ci]) parts.push(c + ': ' + e.values[ci]); });
      return '## 기존 예시' + (i + 1) + ' 입력\n' + parts.join('\n') + '\n## 기존 예시' + (i + 1) + ' 결과\n' + e.result;
    }).join('\n\n');
    user = '아래는 교사가 이미 써 둔 예시다. 이 톤과 문체를 그대로 따라가되, 소재와 수준이 겹치지 않는 새 예시 ' +
           want + '개를 만들어라.\n\n' + shown;
  } else {
    user = '기존 예시가 없다. 위 활동 설명과 입력 항목만 보고 예시 ' + want + '개를 만들어라.';
  }

  var raw = callWithBackup_(sys, user, model).text;
  var obj = parseJsonLoose_(raw);
  var arr = (obj && Array.isArray(obj.examples)) ? obj.examples
          : (Array.isArray(obj) ? obj : []);
  var limit = chars * 3;
  var out = [];
  arr.forEach(function (e) {
    if (!e || !e.result) return;
    var vals = Array.isArray(e.values) ? e.values : [];
    var norm = [];
    for (var c = 0; c < cols.length; c++) norm.push(String(vals[c] || '').trim());
    var res = cleanResult_(e.result);
    if (byteLen(res) > limit) res = trimToBytes(res, limit);
    out.push({ values: norm, result: res });
  });
  return out.slice(0, want);
}
