/**
 * 세특 작성 도우미 v3 — 🧪 세특 프롬프트 공방 (시트 안에서 열기)
 *
 * 웹 공방(web/prompt-studio.html)과 같은 파일이 UI_Studio.html 로 들어온다(tools/build-studio.js 가 만듦).
 * 시트 안에서 열면 페이지가 studioContext() 로 이 시트의 [🧩 기록종류]·[📚 교과영역]·[📐 공통규칙]·[📏 기재요령]을 받아 쓰고,
 * 복사·붙여넣기 대신 [활동 시트 만들기]·[교과영역에 저장](subjectSave)으로 바로 시트에 넣는다.
 * [AI로 칸 채우기]는 API 키가 있으면 studioDesign() 이 바로 부르고(17_Design.gs), 없으면 페이지가 요청문 복사로 한다.
 *
 * 시트는 프롬프트 글을 저장하지 않는다 — 활동의 재료(입력 항목·개요·바이트·예시)만 저장하고, 생성할 때마다 같은 엔진이
 * 다시 조립한다. 그래야 기재요령 규칙판·공통규칙·교과영역이 바뀌면 모든 활동이 저절로 따라간다.
 * GitHub 나 다른 사이트에 들어갈 필요가 없고, 사본마다 그대로 따라간다.
 */

function openStudio() {
  if (!sh_(APP.SH.RECORD) || !sh_(APP.SH.SUBJECT) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Studio').setWidth(1120).setHeight(780);
  ui_().showModalDialog(html, '🧪 세특 프롬프트 공방');
}

/** 페이지가 쓸 이 시트의 기록종류·교과·공통규칙·기재요령 규칙 */
function studioContext() {
  var com = getCommon_(), common = {};
  ['WRITING_RULES', 'NEIS_RULES', 'BYTE_RULE', 'GRADE_RULE', 'INSTRUCTION'].forEach(function (k) {
    if (String(com[k] || '').trim()) common[k] = com[k];
  });
  common.AVOID_RULES = com.AVOID_RULES === undefined ? AVOID_RULES_DEFAULT : String(com.AVOID_RULES);   // 비워 두었으면 공방에서도 뺀다
  var info = currentPackInfo_();
  var model = '';
  try { model = apiModelForChecks_(); } catch (e) {}
  return {
    model: model,
    records: getRecordTypes_(),
    subjects: getSubjects_(),
    common: common,
    rules: rulesAll_(),
    rulesId: info.id,
    activities: getActivities_().map(function (a) { return a.name; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    years: Number(cfg_('교사 경력(년)', 15)) || 15,
    version: APP.VERSION
  };
}

/**
 * 공방에서 설계한 활동을 이 시트에 만든다 (입력 시트 + 예시 시트 + 명단).
 * @param {{name:string, recordKey:string, subjectKey:string, bytes:number, columns:string[], desc?:string, amount?:string,
 *          examples?:Array<{in?:string, out:string}>, exIn?:string, exOut?:string}} p  (exIn/exOut 은 예시 한 편이던 옛 번호 v3.8.1 페이지)
 * @return {{inSheet:string, exSheet:string, message:string}}
 */
function studioCreateActivity(p) {
  p = p || {};
  var name = String(p.name || '').trim();
  if (!name) throw new Error('활동 이름을 적어 주세요.');
  var cols = validateColumns_(p.columns);
  var given = Array.isArray(p.examples) ? p.examples : [{ in: p.exIn, out: p.exOut }];
  var examples = given.filter(function (e) { return e && String(e.out || '').trim(); }).slice(0, EXAMPLE_MAX)
    .map(function (e) { return { values: exampleValuesFrom(cols, e.in), result: cleanResult_(e.out) }; });
  var made = createActivity_({
    key: name, name: name, recordKey: p.recordKey, subjectKey: p.subjectKey,
    bytes: Number(p.bytes) || 0, columns: cols, desc: String(p.desc || '').trim(), amount: p.amount, examples: examples
  });
  return {
    inSheet: made.inSheet, exSheet: made.exSheet,
    message: '[' + made.inSheet + '] 시트를 만들었습니다' + (examples.length ? ' (예시 ' + examples.length + '편은 [' + made.exSheet + ']에)' : '') + '.'
  };
}

/** 만든 시트로 가기 */
function studioOpenSheet(name) {
  var s = sh_(String(name || ''));
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + name);
  ss_().setActiveSheet(s);
  return true;
}

/**
 * [AI로 칸 채우기] — 공방 왼쪽의 예시 결과로 활동 개요 · 입력 항목 · 예시 학생 자료를 거꾸로 채운 제안 (저장은 안 함)
 * @param {{recordKey:string, subjectKey:string, name?:string, desc?:string, columns?:string[], bytes?:number,
 *          examples:Array<{in?:string, out:string}>}} p
 */
function studioDesign(p) {
  p = p || {};
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없습니다. [요청문 복사]로 Gemini 앱에서 만들어 답을 붙여 넣으세요.');
  var ex = (p.examples || []).filter(function (e) { return e && String(e.out || '').trim(); });
  if (!ex.length) throw new Error('왼쪽 [예시]의 결과 칸에 "이렇게 나왔으면" 하는 세특을 한 편 이상 넣어 주세요.');
  var recs = getRecordTypes_(), subs = getSubjects_();
  var rec = findByKey(recs, p.recordKey) || recs[0];
  var sub = findByKey(subs, p.subjectKey) || findByKey(subs, '공통');
  usageReset_();
  var res = callWithBackup_(DESIGN_SYSTEM, buildDesignUser({
    record: rec, subject: sub, name: p.name, desc: p.desc, columns: p.columns, bytes: p.bytes, examples: ex
  }), model);
  var d = parseDesignAnswer(res.text, ex.length);
  if (!d.columns.length) throw new Error('AI 답을 읽지 못했습니다(입력 항목 없음). 한 번 더 누르거나 [요청문 복사]로 해 보세요.');
  return { design: d, model: res.model, usage: usageText_() };
}
