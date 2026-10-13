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
  since: 'v3.3.0'
};

function openOcrGuide() {
  var t = HtmlService.createTemplateFromFile('UI_OcrGuide');
  t.links = JSON.stringify(DASHBOARD);
  ui_().showModalDialog(t.evaluate().setWidth(780).setHeight(660), '📄 스캔 문서 → 엑셀 사용 설명서 (업무 인수인계 대시보드)');
}
