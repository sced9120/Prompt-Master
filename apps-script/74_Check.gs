/**
 * 세특 작성 도우미 v3 — 맞춤법 · 금지어 검사 (사이드바)
 *
 * 선생님이 직접 쓴 글, 다듬은 최종본, 다른 데서 가져온 글을 붙여 넣고 바로 검사한다.
 *   · 규칙 검사(늘): 바이트 · 2026 기재 금지어 · 어미·특수문자 · 맞춤법/띄어쓰기 — AI 를 부르지 않는다
 *   · AI 맞춤법 검사 · 근거 확인(키가 있을 때): 고칠 곳을 목록으로 받아 골라서 고친다
 *   · 키가 없으면: Gemini 앱에 붙여 넣을 검사 요청문을 복사해 준다
 * 시트의 셀을 골라 [선택한 셀 가져오기] → 고친 뒤 [그 셀에 다시 넣기] 로 돌려놓을 수 있다.
 */

function openCheckSidebar() {
  try { autoRulesCheck_(); } catch (e) {}
  try { autoUpdateCheck_(); } catch (e) {}
  var html = HtmlService.createHtmlOutputFromFile('UI_Check').setTitle('🔍 맞춤법 · 금지어 검사');
  ui_().showSidebar(html);
}

function checkContext() {
  var recs = [];
  try { recs = getRecordTypes_().map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }); } catch (e) {}
  if (!recs.length) recs = PRESET_RECORD_TYPES.map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; });
  // 바이트 한도를 따로 정한(한 칸을 나눠 쓰는) 활동은 검사 한도로도 고를 수 있게
  var acts = [];
  try {
    var rs = getRecordTypes_();
    getActivities_().forEach(function (a) {
      var rec = findByKey(rs, a.recordKey);
      if (!rec) return;
      var b = activityBytes(a, rec);
      if (b < rec.chars * 3) acts.push({ key: a.key, name: a.name, bytes: b });
    });
  } catch (e) {}
  var model = '';
  try { model = apiModelForChecks_(); } catch (e) {}
  return {
    records: recs, activities: acts, model: model, polishSystem: POLISH_SYSTEM, rules: currentPackInfo_(), aiNotice: AI_NOTICE_2026,
    account: accountInfo_(), spellSystem: SPELL_SYSTEM, groundSystem: GROUND_SYSTEM
  };
}

/** 규칙 검사 — @param {{text:string, bytes?:number, chars?:number}} p  bytes(활동 한도)가 있으면 그것, 없으면 chars×3 */
function checkTextNow(p) {
  var limit = Math.round(Number(p && p.bytes) || (Number(p && p.chars) || 500) * 3);
  var v = inspect_(String((p && p.text) || ''), limit);
  return { bytes: v.bytes, limit: limit, chars: Math.floor(limit / 3), ok: v.ok, issues: v.issues };
}

/** AI 맞춤법 검사 — 고칠 목록과 고친 글 */
function aiSpellCheck(p) {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없어 AI 맞춤법 검사를 할 수 없습니다. 아래 [Gemini 앱에서 검사 — 요청 복사]를 쓰세요.');
  var text = String((p && p.text) || '').trim();
  if (!text) throw new Error('검사할 글이 없습니다.');
  usageReset_();
  var res = callWithBackup_(SPELL_SYSTEM, '# 글\n' + text, model, { json: true });
  var changes = parseSpellResult(res.text, text);
  return { changes: changes, fixed: applyChanges(text, changes), model: res.model, usage: usageText_() };
}

/**
 * 🪶 AI 투 다듬기 — 규칙에 걸린 번역투·상투어·되풀이만 고칠 곳으로 제안(의미 · 사실은 그대로). 고칠지는 선생님이 고른다.
 * @param {{text:string, bytes?:number}} p
 */
function aiPolish(p) {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없어 AI 다듬기를 할 수 없습니다. [Gemini 앱에서 다듬기 — 요청 복사]를 쓰세요.');
  var text = String((p && p.text) || '').trim();
  if (!text) throw new Error('다듬을 글이 없습니다.');
  var hits = inspect_(text, Number(p && p.bytes) || 1500).issues.filter(function (x) { return /^AI 투/.test(x.label); });
  usageReset_();
  var res = callWithBackup_(POLISH_SYSTEM, buildPolishUser(text, hits), model, { json: true });
  var changes = parseSpellResult(res.text, text);
  return { changes: changes, hits: hits.length, fixed: applyChanges(text, changes), model: res.model, usage: usageText_() };
}

/** 키 없이 다듬기 — Gemini 앱에 붙여 넣을 요청문(걸린 표현 목록 포함) */
function polishRequest(p) {
  var text = String((p && p.text) || '').trim();
  if (!text) throw new Error('다듬을 글이 없습니다.');
  var hits = inspect_(text, Number(p && p.bytes) || 1500).issues.filter(function (x) { return /^AI 투/.test(x.label); });
  return POLISH_SYSTEM.replace(/JSON 하나만 출력한다\.[\s\S]*$/, '고칠 곳을 "원문 구절 → 고친 구절 (이유)" 목록으로 보여 주고, 끝에 고친 글 전체를 한 번 보여 준다.') +
    '\n\n' + buildPolishUser(text, hits);
}

/** AI 근거 확인 — 학생 자료에 없는 구절 */
function aiGroundCheck(p) {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없어 자동 근거 확인을 할 수 없습니다. [Gemini 앱에서 근거 확인 — 요청 복사]를 쓰세요.');
  if (!String((p && p.source) || '').trim()) throw new Error('학생 자료(관찰 메모·입력 항목)를 함께 넣어 주세요.');
  usageReset_();
  var list = groundCheck_(p.source, p.text, model);
  return { list: list, model: model, usage: usageText_() };
}

/** 지금 선택한 셀의 글 (+ 그 시트의 기록 항목을 짐작해 글자수를 맞춘다) */
function readActiveCell() {
  var r = SpreadsheetApp.getActiveRange();
  if (!r) throw new Error('먼저 시트에서 셀 하나를 선택하세요.');
  var s = r.getSheet();
  var c = s.getRange(r.getRow(), r.getColumn());
  var name = s.getName(), recordKey = '', activityKey = '';
  try {
    var act = activityOfSheet_(name);
    if (act) { recordKey = act.recordKey; activityKey = act.key; }
    else if (recordKeyOfCompile_(name)) recordKey = recordKeyOfCompile_(name);
  } catch (e) {}
  return { sheet: name, a1: c.getA1Notation(), text: String(c.getValue() === null ? '' : c.getValue()), recordKey: recordKey, activityKey: activityKey };
}

/** 가져왔던 바로 그 셀에 다시 넣는다 */
function writeBackCell(p) {
  var s = sh_(p.sheet);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + p.sheet);
  var c = s.getRange(p.a1);
  if (c.getFormula()) throw new Error('수식이 든 셀(' + p.a1 + ')에는 넣지 않습니다. [최종본] 칸에 넣어 주세요.');
  c.setValue(String(p.text || ''));
  try { recheckOnEdit_({ range: c }); } catch (e) {}   // 스크립트가 쓴 값은 onEdit 이 안 돌아서 직접 다시 검사
  SpreadsheetApp.flush();
  return '✓ ' + p.sheet + ' ' + p.a1 + ' 에 넣었습니다.';
}
