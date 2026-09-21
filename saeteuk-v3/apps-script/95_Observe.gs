/**
 * 세특 작성 도우미 v3 — 수업/활동 관찰 기록
 * 시트 사이드바에서, 또는 웹앱으로 배포해 휴대폰에서 기록할 수 있습니다.
 * 기록은 해당 활동 입력 시트의 첫 번째 입력 항목 칸에 날짜와 함께 누적됩니다.
 */

function openObserve() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Observe').setTitle('관찰 기록');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** 웹앱 진입점 (배포 후 휴대폰에서 사용) */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('UI_Observe')
    .setTitle('관찰 기록')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function observeContext() {
  return {
    activities: getActivities_().map(function (a) {
      return { key: a.key, name: a.name, firstCol: parseColumns(a.columns)[0] || '관찰 내용' };
    }),
    students: getRoster_().map(function (s) {
      return { id: s.id, label: s.cls + '반 ' + s.no + '번 ' + (s.name || '') };
    })
  };
}

/**
 * 관찰 기록 저장
 * @param {Object} p {activityKey, studentId, text, append}
 */
function observeSave(p) {
  var act = getActivity_(p.activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var s = sh_(act.inSheet);
  if (!s) throw new Error('입력 시트를 찾을 수 없습니다.');
  var text = String(p.text || '').trim();
  if (!text) throw new Error('내용이 비었습니다.');

  var last = s.getLastRow();
  if (last < APP.DATA_ROW) throw new Error('학생 명단을 먼저 동기화하세요.');
  var cnt = last - APP.DATA_ROW + 1;
  var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var row = 0;
  for (var i = 0; i < cnt; i++) {
    if (String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim() === p.studentId) { row = APP.DATA_ROW + i; break; }
  }
  if (!row) throw new Error('명단에서 학생을 찾지 못했습니다. 메뉴 ③ 동기화를 실행하세요.');

  var cell = s.getRange(row, 5);   // 첫 번째 입력 항목
  var prev = String(cell.getValue() || '').trim();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d');
  var line = stamp + ' ' + text;
  cell.setValue(p.append === false || !prev ? line : prev + '\n' + line);
  return '저장했습니다 (' + act.name + ' · ' + p.studentId + ')';
}

function observeDeployHelp() {
  ui_().alert('수업관찰 웹앱 배포 안내',
    '수업 중 휴대폰으로 기록하고 싶을 때만 필요합니다. 시트 안에서만 쓸 거라면 [수업관찰 기록 열기]로 충분합니다.\n\n' +
    '1) 상단 [확장 프로그램] > [Apps Script]\n' +
    '2) 오른쪽 위 [배포] > [새 배포]\n' +
    '3) 유형 선택(톱니바퀴) > [웹 앱]\n' +
    '4) 실행 사용자: 나\n   액세스 권한: 나만 (또는 우리 학교 도메인)\n' +
    '5) [배포] > 나오는 URL을 휴대폰 홈 화면에 추가\n\n' +
    '※ 배포는 사본마다 한 번씩 직접 해야 하며, 사본을 복사해도 배포는 따라오지 않습니다.',
    ui_().ButtonSet.OK);
}
