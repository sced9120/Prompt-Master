/**
 * 세특 작성 도우미 v3 — 🔒 개인정보 · 보안 안내와 동의 (처음 한 번)
 *
 * 학생 자료를 AI 로 보내기 전에, 쓰는 선생님이 데이터가 어디에 있고 어디로 가는지 읽고 항목마다 확인하게 한다.
 *   · 동의는 실행하는 사람의 구글 계정(UserProperties)에 남는다 — 사본을 공유받은 선생님도 각자 한 번 한다.
 *   · 안내 글이 바뀌면 CONSENT_VERSION 을 올린다. 예전 판에 동의한 선생님은 다시 확인한다.
 *   · 동의 전에는 AI 호출(callAI_)과 생성 · 키 없이(복사 · 붙여넣기)를 막고 이 창을 연다. 시트 정리 · 명단 · 검사는 그대로 쓴다.
 * 무엇을 막고 무엇을 허용하는지는 docs/PRIVACY.md 와 같아야 한다.
 */

var CONSENT_VERSION = '2026.11';
var CONSENT_PROP = 'CONSENT';

/** 항목마다 체크해야 동의할 수 있다 — [제목, 풀어쓴 설명] */
var CONSENT_ITEMS = [
  ['학생 자료는 이 스프레드시트에 저장됩니다',
   '명단 · 관찰 메모 · 결과는 선생님 구글 드라이브의 이 파일에만 있습니다. 만든이(개발자)의 서버로는 아무것도 보내지 않습니다. 시트를 공유하면 공유받은 사람도 학생 자료를 볼 수 있으니, 공유는 학교 지침대로 합니다.'],
  ['AI로는 학생 자료 본문만 갑니다',
   '생성할 때 반 · 번호 · 이름은 빼고(⚙️ 설정의 학생 이름 마스킹 = TRUE, 끄지 마세요) 관찰 메모 · 보고서 본문만 고른 AI 회사로 보냅니다. 본문 안에 직접 쓴 이름 · 학번은 가려지지 않습니다.'],
  ['본문에 민감한 정보를 쓰지 않습니다',
   '주민등록번호 · 연락처 · 주소, 가정 형편 · 가족 관계, 건강 · 진단, 상담 · 징계 · 학교폭력 이력은 메모 칸에도 쓰지 않습니다. 세특에 들어갈 수 없는 내용은 입력하지도 않는 것이 원칙입니다.'],
  ['AI 회사의 데이터 정책을 확인했습니다',
   'API 키를 쓰면 그 회사(Google · OpenAI · Anthropic)의 API 약관을 따릅니다. 무료 등급은 입력을 서비스 개선에 쓸 수 있다고 적힌 경우가 있으니, 학교 계정 Gemini(Education)나 학습에 쓰지 않는 유료 등급을 권합니다. 키는 선생님 구글 계정에만 저장되고 사본으로 넘어가지 않습니다.'],
  ['AI 결과는 초안이고, 최종 판단은 제가 합니다',
   '2026 학교생활기록부 기재요령은 AI가 만든 글을 그대로 입력하지 말라고 합니다. 결과는 읽고 사실을 확인해 [최종본]에 고쳐 쓴 뒤 나이스에 입력합니다.'],
  ['학교 · 교육청의 정보보안 지침을 따릅니다',
   '학교 개인정보 처리방침과 정보보안 지침에서 외부 AI · 클라우드 사용이 허용되는지 확인했고, 그 범위에서 씁니다.']
];

function consentRecord_() {
  try { return JSON.parse(PropertiesService.getUserProperties().getProperty(CONSENT_PROP) || 'null'); } catch (e) { return null; }
}

/** 지금 판에 동의했는지 */
function consentOk_() {
  var r = consentRecord_();
  return !!(r && r.v === CONSENT_VERSION);
}

/** 시작하기 창 · 동의 창에서 쓰는 상태 */
function consentState() {
  var r = consentRecord_();
  return { ok: consentOk_(), version: CONSENT_VERSION, at: r && r.at || '', old: !!(r && r.v !== CONSENT_VERSION),
           items: CONSENT_ITEMS, masked: maskName_() };
}

/**
 * 동의 — 모든 항목을 체크해야 한다
 * @param {{checked:boolean[]}} p
 */
function consentAgree(p) {
  var c = (p && p.checked) || [];
  if (c.length !== CONSENT_ITEMS.length || c.some(function (x) { return x !== true; })) {
    throw new Error('항목을 모두 읽고 체크해 주세요.');
  }
  var at = new Date().toISOString();
  PropertiesService.getUserProperties().setProperty(CONSENT_PROP, JSON.stringify({ v: CONSENT_VERSION, at: at }));
  return consentState();
}

/** 동의 철회 — 다시 동의할 때까지 AI 를 부르지 않는다 */
function consentWithdraw() {
  PropertiesService.getUserProperties().deleteProperty(CONSENT_PROP);
  return consentState();
}

var CONSENT_NEED_MSG = '학생 자료를 AI로 보내기 전에 [🔒 개인정보 · 보안 안내]를 읽고 동의해 주세요. 메뉴 [①②③ 준비] › [🔒 개인정보 · 보안 안내와 동의] 또는 시작하기 창 맨 위에서 엽니다.';

/** AI 를 부르기 전 — 동의가 없으면 멈춘다 */
function requireConsent_() {
  if (!consentOk_()) throw new Error(CONSENT_NEED_MSG);
}

/** @param {boolean=} back  동의한 뒤 시작하기 창으로 돌아갈지 */
function openConsentDialog(back) {
  var t = HtmlService.createTemplateFromFile('UI_Consent');
  t.back = back === true;
  ui_().showModalDialog(t.evaluate().setWidth(700).setHeight(640), '🔒 개인정보 · 보안 안내와 동의');
}
