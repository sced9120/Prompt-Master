/**
 * 세특 작성 도우미 v3 — 함께 쓰면 좋은 도구 안내
 *
 * 업무 인수인계 대시보드(같은 만든이의 윈도우 프로그램)의 [스캔 문서 → 엑셀] 사용 설명서.
 * 손글씨 활동지·신청서를 스캔해 표로 만든 뒤 이 시트의 입력 칸에 붙여 넣는 흐름을 안내한다.
 * [🚀 시작하기] 시트의 버튼과 메뉴 [도움말 · 부가 기능]에서 연다.
 */

var DASHBOARD = {
  repo: 'https://github.com/sced9120/work-dashboard',
  latest: 'https://github.com/sced9120/work-dashboard/releases/latest',
  since: 'v3.3.0',
  // 대시보드가 배포 없이 OCR 지침을 바꾸는 곳(대시보드 전용 — Gem 은 97_OcrGem.gs 의 지침을 쓴다)
  catalog: 'https://raw.githubusercontent.com/sced9120/work-dashboard/main/remote/catalog.json'
};

function openOcrGuide() {
  var t = HtmlService.createTemplateFromFile('UI_OcrGuide');
  t.links = JSON.stringify(DASHBOARD);
  ui_().showModalDialog(t.evaluate().setWidth(780).setHeight(660), '📄 스캔 문서 → 엑셀 사용 설명서 (업무 인수인계 대시보드)');
}

/* ------------------------------------------- 📄 스캔 문서 → 표 Gem · Claude 스킬 (대시보드 없이) */
/**
 * Gem 전용 OCR 지침(97_OcrGem.gs — 학생 1명 = 1행, 반 · 번호 · 이름 · 양식 항목별 열)을 Gemini Gem [안내] · Claude 스킬로 내보낸다.
 * 대시보드의 원격 지침(remote/catalog.json "ocr.prompt")은 문서 전체를 옮기는 범용 지침이라 여기서는 쓰지 않는다.
 */
function ocrGemContext() {
  var text = buildOcrGemText();
  return { gem: text, chars: text.length, from: '학생 제출물 → 표 Gem 지침' };
}

/** 내려받기용 — Gem [지식]에 올릴 .txt 와 Claude 스킬 zip(폴더/SKILL.md) */
function ocrGemFiles() {
  var t = ocrGemContext().gem;
  var txt = Utilities.newBlob(t, 'text/plain', '스캔문서_표_지침.txt');
  var zip = Utilities.zip([Utilities.newBlob(buildOcrSkillMd(t), 'text/markdown', OCR_SKILL_NAME + '/SKILL.md')], OCR_SKILL_NAME + '.zip');
  return { txt: { file: txt.getName(), b64: Utilities.base64Encode(txt.getBytes()) },
           zip: { file: OCR_SKILL_NAME + '.zip', b64: Utilities.base64Encode(zip.getBytes()) } };
}