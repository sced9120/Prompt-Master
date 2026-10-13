/**
 * 세특 작성 도우미 v3 — AI 앱용 지침 내보내기
 *
 * 시트가 조립한 규칙(프롬프트)을 다른 AI 앱에 "한 번 저장해 두는" 형태로 내보낸다.
 *   · Gemini Gem / ChatGPT GPT·프로젝트 / Claude 프로젝트 지침 — 붙여 넣을 글
 *   · Claude 스킬 — SKILL.md 를 담은 zip (claude.ai 설정 › 기능 › 스킬 에서 올림)
 * 학생 자료는 들어가지 않는다. 규칙(기록종류·교과·공통규칙·기재요령·예시)만 담는다.
 * 예시 시트에 실제 학생 글을 넣었다면 내보내기 전에 지우거나 [예시 넣지 않기]를 고른다.
 */

function openExportDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Export').setWidth(760).setHeight(640);
  ui_().showModalDialog(html, 'AI 앱용 지침 내보내기 — Gem · 프로젝트 · 스킬');
}

function exportContext() {
  var acts = getActivities_();
  var cur = ss_().getActiveSheet().getName(), pick = '';
  acts.forEach(function (a) { if (a.inSheet === cur || a.exSheet === cur) pick = a.key; });
  return {
    activities: acts.map(function (a) { return { key: a.key, name: a.name, recordKey: a.recordKey }; }),
    pick: pick || (acts[0] ? acts[0].key : '')
  };
}

/** @param {{key:string, examples?:boolean}} p */
function exportFor(p) {
  var acts = getActivities_();
  var idx = -1;
  acts.forEach(function (a, i) { if (a.key === p.key) idx = i; });
  if (idx < 0) throw new Error('활동을 찾을 수 없습니다.');
  var act = acts[idx];
  var rec = findByKey(getRecordTypes_(), act.recordKey) || {};
  var system = promptFor_(act, p.examples === false ? '' : undefined);
  var name = skillName(act.recordKey, idx + 1);
  return {
    gem: buildGemText(system), name: name,
    skill: buildSkillMd({ name: name, activity: act.name, record: rec.name || act.recordKey, system: system,
                          notice: AI_NOTICE_2026, rulesId: currentPackInfo_().id }),
    examples: readExampleRows_(act).length
  };
}

/** Claude 스킬 zip (폴더/SKILL.md) — 화면에서 내려받을 수 있게 base64 로 */
function exportSkillZip(p) {
  var r = exportFor(p);
  var blob = Utilities.newBlob(r.skill, 'text/markdown', r.name + '/SKILL.md');
  var zip = Utilities.zip([blob], r.name + '.zip');
  return { file: r.name + '.zip', b64: Utilities.base64Encode(zip.getBytes()) };
}
