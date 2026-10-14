/**
 * 세특 작성 도우미 v3 — 🧪 세특 프롬프트 공방 (시트 안에서 열기)
 *
 * 웹 공방(web/prompt-studio.html)과 같은 파일이 UI_Studio.html 로 들어온다(tools/build-studio.js 가 만듦).
 * 시트 안에서 열면 페이지가 studioContext() 로 이 시트의 [🧩 기록종류]·[📚 교과영역]·[📐 공통규칙]·[📏 기재요령]을 받아 쓰고,
 * 복사·붙여넣기 대신 [활동 시트 만들기]·[교과영역에 저장](subjectSave)으로 바로 시트에 넣는다.
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
  var info = currentPackInfo_();
  return {
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
 * @param {{name:string, recordKey:string, subjectKey:string, bytes:number, columns:string[], desc?:string, exIn?:string, exOut?:string}} p
 * @return {{inSheet:string, exSheet:string, message:string}}
 */
function studioCreateActivity(p) {
  p = p || {};
  var name = String(p.name || '').trim();
  if (!name) throw new Error('활동 이름을 적어 주세요.');
  var cols = validateColumns_(p.columns);
  var examples = [];
  if (String(p.exOut || '').trim()) examples.push({ values: exampleValuesFrom(cols, p.exIn), result: cleanResult_(p.exOut) });
  var made = createActivity_({
    key: name, name: name, recordKey: p.recordKey, subjectKey: p.subjectKey,
    bytes: Number(p.bytes) || 0, columns: cols, desc: String(p.desc || '').trim(), examples: examples
  });
  return {
    inSheet: made.inSheet, exSheet: made.exSheet,
    message: '[' + made.inSheet + '] 시트를 만들었습니다' + (examples.length ? ' (예시 1편은 [' + made.exSheet + ']에)' : '') + '.'
  };
}

/** 만든 시트로 가기 */
function studioOpenSheet(name) {
  var s = sh_(String(name || ''));
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + name);
  ss_().setActiveSheet(s);
  return true;
}
