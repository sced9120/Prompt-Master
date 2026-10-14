/**
 * 세특 작성 도우미 v3 — ✍️ 바로 쓰기 시트
 *
 * 활동을 설계하지 않고(입력 항목·예시 없이) 바로 쓰고 싶을 때.
 *   · 학생마다 [관찰 메모] 한 칸에 자유롭게 적고 → [생성] 하면 AI 초안 (키가 없으면 복사·붙여넣기)
 *   · 또는 [최종본]에 직접 쓰면 → [검증]이 바로 금지어·형식·맞춤법을 검사
 * 속은 보통 활동과 똑같아서 생성·검사·최종취합·검토가 모두 그대로 된다(프롬프트 모드 '바로쓰기').
 * 기록종류·교과마다 몇 개든 만들 수 있다.
 */

var QUICK_COLUMN = '관찰 메모';

/** 시험 생성·안내에 쓰는 보기 메모 (실제 학생 자료가 아님) */
var SAMPLE_MEMO = {
  '과세특': '이차함수 단원에서 그래프 이동을 모둠원에게 설명함. 처음에는 꼭짓점 좌표를 헷갈렸으나 표를 그려 비교한 뒤 스스로 규칙을 찾아냄. 발표 뒤 받은 질문에 예를 들어 다시 설명함.',
  '개세특': '수업 중 모르는 낱말을 따로 적어 두고 쉬는 시간에 사전으로 찾아 정리하는 습관이 있음. 학기 말에는 정리한 낱말장을 친구들과 나누어 봄.',
  '자율': '학급 환경 개선 회의에서 분리배출 표시판 만들기를 제안하고 역할을 나눔. 2주 동안 표시판을 고쳐 가며 붙였고 학급 분리배출이 눈에 띄게 나아짐.',
  '동아리': '과학 실험 동아리에서 식물 성장과 빛의 색 관계를 실험함. 변인 통제가 어려워 실험을 두 번 다시 설계했고, 결과 발표에서 한계와 개선점을 말함.',
  '진로': '진로 탐색 시간에 간호사 직업 인터뷰 자료를 읽고 하루 일과를 정리함. 관심 분야를 노인 돌봄으로 좁히고 필요한 역량을 스스로 표로 만듦.',
  '행발': '맡은 청소 구역을 끝까지 책임지고 정리함. 친구가 어려워할 때 먼저 다가가 도와주는 모습이 자주 보임. 수업 시간 집중력이 학기 초보다 좋아짐.'
};

function openQuickSheetDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Quick').setWidth(560).setHeight(640);
  ui_().showModalDialog(html, '✍️ 바로 쓰기 · 📄 보고서 시트 추가');
}

function quickContext() {
  if (!sh_(APP.SH.RECORD) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var recs = getRecordTypes_(), subs = getSubjects_();
  var n = 1;
  while (getActivity_('바로쓰기' + n) || sh_(sheetNameIn_('바로쓰기' + n))) n++;
  var m = 1;
  while (getActivity_('보고서' + m) || sh_(sheetNameIn_('보고서' + m))) m++;
  var roster = 0;
  try { roster = getRoster_().length; } catch (e) {}
  return {
    records: recs.map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }),
    subjects: subs.map(function (s) { return { key: s.key, name: s.name, kind: s.kind }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    suggestName: '바로쓰기' + n, suggestReport: '보고서' + m, rosterCount: roster
  };
}

/**
 * @param {{kind?:string, name:string, recordKey:string, subjectKey:string, chars?:number, desc?:string}} p  kind '보고서'면 보고서 시트
 * @return {{inSheet:string, name:string}}
 */
function createQuickSheet(p) {
  if (p && p.kind === '보고서') return createReportSheet(p);
  var name = safeKey_(p.name) || ('바로쓰기' + Date.now() % 1000);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, p.recordKey) || recs[0];
  var made = createActivity_({
    key: name, name: name, recordKey: rec.key,
    subjectKey: p.subjectKey || (rec.key === '과세특' ? cfg_('기본 교과영역', '공통') : '공통'),
    chars: Number(p.chars) || 0, columns: [QUICK_COLUMN], desc: String(p.desc || '').trim(),
    mode: '바로쓰기', noExamples: true
  });
  var s = sh_(made.inSheet);
  if (s) ss_().setActiveSheet(s);
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { inSheet: made.inSheet, name: name };
}

/** 이 활동이 바로 쓰기 시트인지 */
function isQuickActivity_(act) { return !!act && act.mode === '바로쓰기'; }
