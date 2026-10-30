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

/* ------------------------------------------------ 💎 Gem 으로 쓰기 (Gemini 앱 · 구독 · 학교 계정) */
/**
 * Gemini 앱을 쓰는 선생님의 길: 활동의 규칙을 Gem 에 한 번 저장해 두고, Gem 에서 쓴 글을 시트에 붙여 넣어 검사한다.
 * 시트 안에서는 키 없이(복사·붙여넣기)와 같다 — ⑥ 창의 [학생 자료만 복사 (Gem 사용 시)]가 Gem 용으로 짧게 복사한다.
 */
var GEM_SHEET_NOTE = '💎 Gem 시트 — ① 이 시트의 Gem 지침(만들 때 창에 나옴, 메뉴 ⑧ [AI 앱용 지침 내보내기]에서도)을 Gemini의 새 Gem [안내]에 붙여 넣어 Gem을 만듭니다. ' +
  '② Gem 대화에 학생 메모를 넣어 쓰고, 받은 글을 그 학생 줄의 [최종본]에 붙여 넣으면 [검증]이 바로 검사합니다. ' +
  '③ 여러 명이면 [관찰 메모]에 적고 [생성] 체크 → 메뉴 ⑥ → [학생 자료만 복사 (Gem 사용 시)] → Gem 답을 창에 붙여 넣기.';

function gemOn_() {
  try { return PropertiesService.getUserProperties().getProperty('GEM_WAY') === '1'; } catch (e) { return false; }
}

/** 시작하기 2단계 [Gemini 앱 Gem으로] — 키 없이 쓰기로 맞추고, Gem 안내를 보이게 표시해 둔다 */
function onboardUseGem() {
  var r = onboardUseManual();
  try { PropertiesService.getUserProperties().setProperty('GEM_WAY', '1'); } catch (e) {}
  r.status = onboardStatus();
  r.message = 'Gem으로 쓰기로 시작합니다. ④에서 첫 활동을 만들면 ⑤에서 그 활동의 Gem 지침을 복사할 수 있습니다.';
  return r;
}

/** 활동 하나의 Gem 지침 — 시작하기 · 💎 Gem 시트 · 내보내기 창이 같이 쓴다 */
function gemFor(key) {
  var r = exportFor({ key: key });
  return { gem: r.gem, name: r.name, examples: r.examples };
}
