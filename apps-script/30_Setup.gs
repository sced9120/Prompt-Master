/**
 * 세특 작성 도우미 v3 — 메뉴 · 초기 설치
 */

function onOpen() {
  var m = ui_().createMenu(APP.MENU);
  m.addItem('🚀 시작하기 (처음이면 여기)', 'openOnboard');
  m.addSeparator();
  m.addItem('① 처음 설치 / 구조 복구', 'installAll');
  m.addSeparator();
  m.addItem('② AI 연결 · 모델 설정', 'openApiDialog');
  m.addItem('   모델 연결 테스트', 'testAllModels');
  m.addSeparator();
  m.addItem('③ 학생 명단 불러오기 (엑셀·붙여넣기)', 'openRosterDialog');
  m.addItem('   학생 명단 동기화', 'syncRoster');
  m.addSeparator();
  m.addItem('④ 활동 만들기 (AI 마법사) ★', 'openWizard');
  m.addItem('   활동 직접 추가', 'addActivityDialog');
  m.addItem('   활동 복제', 'duplicateActivityDialog');
  m.addItem('   활동 삭제', 'deleteActivityDialog');
  m.addSeparator();
  m.addItem('⑤ 예시 더 만들기 (AI)', 'generateMoreExamples');
  m.addItem('   예시 칸 늘리기', 'addExampleRows');
  m.addItem('   예시 검증', 'validateExamples');
  m.addSeparator();
  m.addItem('⑥ 체크된 행 생성', 'generateChecked');
  m.addItem('   선택한 행만 생성', 'generateSelection');
  m.addItem('   자동 생성(체크 즉시) 켜기', 'enableAutoTrigger');
  m.addItem('   자동 생성 끄기', 'disableAutoTrigger');
  m.addSeparator();
  m.addItem('⑦ 최종취합 시트 생성/갱신', 'buildCompile');
  m.addItem('   최종 압축본 생성(체크된 행)', 'compileChecked');
  m.addSeparator();
  m.addItem('⑧ 프롬프트 미리보기', 'previewPrompt');
  m.addItem('   결과 전체 재검증', 'revalidateAll');
  m.addSeparator();
  var sub = ui_().createMenu('부가 기능');
  sub.addItem('구글폼 응답 동기화', 'syncFormResponses');
  sub.addItem('수업관찰 기록 열기', 'openObserve');
  sub.addItem('수업관찰 웹앱 배포 안내', 'observeDeployHelp');
  sub.addItem('예시 시트 구조 복구', 'repairExampleSheet');
  sub.addItem('사용법 시트 갱신', 'buildHelp');
  sub.addItem('시작하기 안내 다시 켜기', 'onboardReset');
  sub.addItem('버전 정보', 'showVersion');
  m.addSubMenu(sub);
  m.addToUi();

  // 아직 설정을 끝내지 않은 사본이면 [🚀 시작하기] 탭을 열어 준다.
  // 단순 트리거라 권한 승인 전에도 여기까지는 동작한다.
  try {
    if (needsOnboarding_()) {
      var st = sh_(APP.SH.START);
      if (st) ss_().setActiveSheet(st);
      ss_().toast('메뉴 [' + APP.MENU + '] > [🚀 시작하기] 를 눌러 시작하세요.', APP.MENU, 10);
    }
  } catch (e) {}
}

function showVersion() {
  ui_().alert(APP.MENU, '세특 작성 도우미 ' + APP.VERSION + '\n\n프롬프트 조립형 구조.\n교과·창체·행발을 한 틀로 지원합니다.', ui_().ButtonSet.OK);
}

/** 전체 설치 (여러 번 실행해도 안전 — 기존 데이터는 보존) */
function installAll() {
  try {
    installCore_();
  } catch (e) {
    ui_().alert(APP.MENU, e.message, ui_().ButtonSet.OK);
    return;
  }
  toast_('설치/복구 완료.', APP.MENU);
  ui_().alert(APP.MENU,
    '구조 설치가 끝났습니다.\n\n이어서 [🚀 시작하기]를 누르면 나머지를 단계별로 안내합니다.',
    ui_().ButtonSet.OK);
}

/**
 * 알림 없이 시트 구조만 만든다 (온보딩 팝업에서도 호출).
 * 단계마다 따로 실행해서, 하나가 실패해도 나머지는 끝까지 만든다.
 * 실패한 단계가 있으면 마지막에 모아서 알린다.
 */
function installCore_() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('다른 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  var steps = [
    ['🚀 시작하기', buildStart], ['⚙️ 설정', buildConfig], ['🧩 기록종류', buildRecordTypes],
    ['📚 교과영역', buildSubjects], ['📐 공통규칙', buildCommonRules], ['🗂 활동목록', buildActivityList],
    ['👤 학생명단', buildRoster], ['✅ 검토', buildReview], ['📖 사용법', buildHelp],
    ['시트 순서 정리', orderSheets_]
  ];
  var failed = [];
  try {
    steps.forEach(function (st) {
      try { st[1](); } catch (e) { failed.push('· ' + st[0] + ' — ' + e.message); }
    });
  } finally { lock.releaseLock(); }
  if (failed.length) {
    throw new Error('설치 중 일부를 만들지 못했습니다.\n\n' + failed.join('\n') +
      '\n\n나머지는 모두 만들었습니다. 이 창을 캡처해 제작자에게 보내 주세요.');
  }
}

function orderSheets_() {
  var order = [APP.SH.START, APP.SH.HELP, APP.SH.CONFIG, APP.SH.ROSTER, APP.SH.ACTIVITY,
               APP.SH.RECORD, APP.SH.SUBJECT, APP.SH.COMMON];
  var i = 1;
  order.forEach(function (n) {
    var s = sh_(n);
    if (s) { ss_().setActiveSheet(s); ss_().moveActiveSheet(i++); }
  });
  var h = sh_(APP.SH.START) || sh_(APP.SH.HELP);
  if (h) ss_().setActiveSheet(h);
}

/* ---------------------------------------------------------------- 설정 */
/**
 * [⚙️ 설정] 시트
 *   1~3행   머리말 · 안내 · 헤더
 *   4행~    항목 | 값 | 설명
 *   그 아래 🤖 모델 목록 표 (모델명 | 회사 | 수준 | 언제 쓰나 | 연결 확인)
 * 다시 실행해도 선생님이 바꾼 값과 모델 목록은 그대로 둔다.
 */
function buildConfig() {
  var s = shOrCreate_(APP.SH.CONFIG);
  var existing = {}, oldModels = null;
  var last = s.getLastRow();
  var tHead = modelTableRow_(s);
  if (last >= 4) {
    var endSet = tHead ? tHead - 1 : last;
    if (endSet >= 4) {
      s.getRange(4, 1, endSet - 3, 2).getValues().forEach(function (r) {
        var k = String(r[0]).trim();
        if (k && !existing.hasOwnProperty(k)) existing[k] = r[1];
      });
    }
  }
  if (tHead) oldModels = readModelRowsAt_(s, tHead);

  // v3.0.x → v3.1: 손대지 않은 옛 기본 모델은 새 기본값으로, [추가 모델]은 모델 목록으로 옮긴다
  Object.keys(OLD_DEFAULT_MODELS).forEach(function (k) {
    if (normModel(existing[k]) === OLD_DEFAULT_MODELS[k]) delete existing[k];
  });
  var extra = String(existing['추가 모델'] || '').split(',').map(normModel).filter(String);

  s.clear();
  s.getRange(1, 1, s.getMaxRows(), s.getMaxColumns()).breakApart().clearDataValidations();
  s.getRange('A1').setValue('⚙️ 설정  —  ' + APP.VERSION)
    .setFontSize(14).setFontWeight('bold');
  noteRow_(s, 2, MODEL_HEAD.length, 'API 키는 이 시트에 저장되지 않습니다. 메뉴 > ② AI 연결 · 모델 설정 에서 입력하며, 사용자 계정별로 따로 보관되어 사본을 공유해도 남에게 넘어가지 않습니다.');
  s.getRange(3, 1, 1, 3).setValues([['항목', '값', '설명']]);
  styleHeader_(s, 3, 3);

  var rows = [
    ['교사 경력(년)', 15, '프롬프트의 역할 문장에 쓰입니다. 숫자만.'],
    ['기본 교과영역', '수학', '새 활동을 만들 때 기본으로 선택되는 교과. [📚 교과영역] 시트의 키.'],
    ['활동용 모델', DEFAULT_MODEL, '활동별 세특 생성에 쓰는 모델. 아래 모델 목록에서 고르거나 직접 적으세요. Flash급이면 충분합니다.'],
    ['합본용 모델', DEFAULT_MODEL, '여러 활동을 한 편으로 압축할 때 쓰는 모델. 대개 활동용과 같아도 되고, 글자수를 잘 못 맞추면 한 단계 위 모델로.'],
    ['학생 이름 마스킹', true, 'TRUE면 학생 이름을 AI에 보내지 않습니다. 개인정보 보호 권장값.'],
    ['결과 자동검증', true, 'TRUE면 생성 직후 기재 금지사항·분량·어미를 자동 점검합니다.'],
    ['1회 최대 생성 건수', 25, '한 번에 처리할 최대 학생 수. 실행 시간(약 6분) 제한 때문에 넘치면 나눠서 처리합니다.'],
    ['예비 모델', '', '활동용·합본용 모델이 한도 초과·서버 오류 등으로 실패하면 이 모델로 한 번 더 시도합니다. 다른 회사 모델을 적어 두면 좋습니다(예: gpt-5.6-luna). 비우면 쓰지 않습니다.'],
    ['생각 줄이기', true, 'TRUE면 모델의 생각(추론) 단계를 줄여 더 빠르고 싸게 씁니다. 생각 토큰은 출력 요금으로 청구됩니다. 세특 품질에는 거의 영향이 없습니다.'],
    ['한 번에 묶을 학생 수', 5, '여러 학생을 한 번의 호출로 생성합니다. 규칙 부분을 한 번만 보내 비용과 호출 횟수가 줄어듭니다. 1이면 한 명씩(가장 꼼꼼, 가장 비쌈). 최대 10.']
  ];
  rows.forEach(function (r) { if (existing.hasOwnProperty(r[0])) r[1] = existing[r[0]]; });
  s.getRange(4, 1, rows.length, 3).setValues(rows);
  s.getRange(4, 1, rows.length, 1).setFontWeight('bold');
  s.getRange(4, 2, rows.length, 1).setBackground(APP.COLORS.input);
  s.getRange(4, 3, rows.length, 1).setFontColor('#666666').setWrap(true);

  // 🤖 모델 목록
  var note = 4 + rows.length + 1;
  var head = note + 1;
  noteRow_(s, note, MODEL_HEAD.length,
    '🤖 모델 목록 — 여기 적힌 이름이 모든 [모델] 드롭다운의 선택지가 됩니다. 새 이름을 직접 적어도 되고, ' +
    '메뉴 ② [AI 연결 · 모델 설정]에서 한 줄씩 연결 테스트를 하면 [연결 확인] 칸에 ✓/✗ 가 남습니다. ' +
    '최신 이름: Gemini ' + MODEL_LINKS.gemini + ' · OpenAI ' + MODEL_LINKS.openai + ' · Claude ' + MODEL_LINKS.anthropic);
  s.setRowHeight(note, 62);
  var models = (oldModels && oldModels.length) ? oldModels : presetModelRows_();
  extra.forEach(function (m) {
    if (!models.some(function (r) { return r.model === m; })) models.push({ model: m, company: '자동', level: '', memo: '직접 추가', status: '' });
  });
  writeModelTable_(s, head, models);
  applyConfigModelDropdown_();

  // 폭: A 항목/모델명 · B 값/수준 · C 설명/언제 쓰나(넓게) · D 회사 · E 연결 확인
  s.setColumnWidth(1, 190); s.setColumnWidth(2, 190); s.setColumnWidth(3, 460);
  s.setColumnWidth(4, 90); s.setColumnWidth(5, 230);
  s.setFrozenRows(3);
}

/* ------------------------------------------------------------ 기록종류 */
function buildRecordTypes() {
  var s = shOrCreate_(APP.SH.RECORD);
  if (s.getLastRow() > 2) return;   // 이미 있으면 보존
  s.clear();
  var head = ['키', '기록 항목명', '글자수', '성취수준 사용', '역할', '목표', '서술 관점', '비고'];
  banner_(s, head.length, '🧩 기록종류 — 항목별 기본 규칙',
    '⚠️ 글자수는 학년도마다 바뀝니다(2026학년도: 진로활동 700→500자, 행동특성 및 종합의견 500→300자). ' +
    '해당 연도 학교생활기록부 기재요령을 확인하고 이 표의 숫자를 고치세요. 숫자 하나만 고치면 프롬프트·검증·압축에 모두 반영됩니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_RECORD_TYPES.map(function (r) {
    return [r.key, r.name, r.chars, r.useGrade, r.role, r.goal, r.view, r.note];
  });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 4, rows.length, 1).insertCheckboxes();
  s.getRange(3, 1, rows.length, head.length).setWrap(true).setVerticalAlignment('top');
  [90, 220, 80, 110, 260, 320, 380, 220].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 교과영역 */
function buildSubjects() {
  var s = shOrCreate_(APP.SH.SUBJECT);
  if (s.getLastRow() > 2) return;
  s.clear();
  var head = ['키', '표시명', '분류', '역할 표현', '역량·서술 관점'];
  banner_(s, head.length, '📚 교과영역 — 교과별 역량과 관점',
    '새 교과는 맨 아래에 한 줄 추가하면 됩니다. 키는 짧고 유일하게(예: 화학, 지구과학). ' +
    '분류가 "교과"면 역할 문장에 교과명이 들어가고, "공통"이면 창체·행발용 일반 역량이 쓰입니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_SUBJECTS.map(function (r) { return [r.key, r.name, r.kind, r.role, r.comp]; });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 1, rows.length, head.length).setWrap(true).setVerticalAlignment('top');
  s.getRange(3, 3, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['교과', '공통'], true).build());
  [110, 220, 80, 200, 620].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 공통규칙 */
function buildCommonRules() {
  var s = shOrCreate_(APP.SH.COMMON);
  if (s.getLastRow() > 2) return;
  s.clear();
  var head = ['키', '제목', '내용'];
  banner_(s, head.length, '📐 공통규칙 — 모든 기록에 공통 적용',
    'A열(키)은 코드가 찾는 이름이라 수정하면 안 됩니다. C열(내용)만 고치세요. ' +
    '예: 우리 학교는 "~하였음" 어미를 쓴다 → WRITING_RULES 내용을 그렇게 바꾸면 모든 활동에 즉시 반영됩니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_COMMON.map(function (r) { return [r.key, r.title, r.body]; });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 1, rows.length, 2).setBackground(APP.COLORS.lock);
  s.getRange(3, 3, rows.length, 1).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
  s.setColumnWidth(1, 160); s.setColumnWidth(2, 180); s.setColumnWidth(3, 800);
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 활동목록 */
function buildActivityList() {
  var s = shOrCreate_(APP.SH.ACTIVITY);
  if (s.getLastRow() > 2) { refreshActivityValidation_(); return; }
  s.clear();
  var head = ['활동키', '활동명', '기록종류', '교과영역', '글자수', '입력 항목',
              '활동 개요', '프롬프트 모드', '직접 작성 프롬프트', '입력 시트', '예시 시트'];
  banner_(s, head.length, '🗂 활동목록 — 세특을 만들 활동의 정의',
    '직접 채우는 칸은 [활동명·기록종류·교과영역·입력 항목·활동 개요] 다섯 개뿐입니다. 프롬프트 본문은 엔진이 조립합니다. ' +
    '글자수를 비우면 기록종류 기본값이 쓰입니다. 통째로 직접 쓰려면 [프롬프트 모드]를 "직접작성"으로 바꾸고 I열에 작성하세요. ' +
    '새 활동은 메뉴 ④ 마법사로 만드는 것을 권장합니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  [110, 200, 100, 110, 80, 320, 340, 120, 300, 150, 150]
    .forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
  s.getRange(3, 1, 300, head.length).setWrap(true).setVerticalAlignment('top');
  refreshActivityValidation_();
}

/** 활동목록의 드롭다운을 현재 기록종류/교과영역으로 갱신 */
function refreshActivityValidation_() {
  var s = sh_(APP.SH.ACTIVITY);
  if (!s) return;
  var recKeys = getRecordTypes_().map(function (r) { return r.key; });
  var subKeys = getSubjects_().map(function (r) { return r.key; });
  var n = 300;
  if (recKeys.length) s.getRange(3, 3, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(recKeys, true).build());
  if (subKeys.length) s.getRange(3, 4, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(subKeys, true).build());
  s.getRange(3, 8, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['자동', '직접작성'], true).build());
}

/* -------------------------------------------------------------- 학생명단 */
function buildRoster() {
  var s = shOrCreate_(APP.SH.ROSTER);
  if (s.getLastRow() > 2) return;          // 이미 명단이 있으면 보존
  writeRosterSheet_([], rosterMode_());    // 머리글 방식(반·번호 / 학년·반·번호)은 그대로 둔다
}

/* ---------------------------------------------------------------- 검토 */
function buildReview() {
  var s = shOrCreate_(APP.SH.REVIEW);
  s.clear();
  s.getRange('A1').setValue('✅ 검토  —  반·번호·기록종류를 고르면 그 학생의 최종본을 불러옵니다. 나이스 입력 전 확인용.')
    .setFontSize(13).setFontWeight('bold');
  s.getRange(3, 1, 1, 5).setValues([['반', '번호', '기록종류', '이름', '최종본 (자동)']]);
  s.getRange(3, 1).setValue(classHead_());
  styleHeader_(s, 3, 5);
  s.getRange('A4:C4').setBackground(APP.COLORS.input);
  s.getRange('A4').setNumberFormat('@');   // "2-3"(학년-반)이 날짜로 바뀌지 않게

  var recKeys = getRecordTypes_().map(function (r) { return r.key; });
  if (recKeys.length) {
    s.getRange('C4').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(recKeys, true).build());
    s.getRange('C4').setValue(recKeys[0]);
  }

  var pre = APP.SH.COMPILE_PREFIX;
  var ind = function (suffix) { return 'INDIRECT("\'" & "' + pre + '" & $C$4 & "\'!' + suffix + '")'; };
  var pick = function (headerName) {
    return '=IFERROR(INDEX(FILTER(' + ind('$A:$BZ') + ', ' + ind('$A:$A') + '=$A$4, ' + ind('$B:$B') + '=$B$4), 1, ' +
           'MATCH("' + headerName + '", ' + ind('$3:$3') + ', 0)), "")';
  };
  s.getRange('D4').setFormula(pick('이름'));
  s.getRange('E4').setFormula(pick('최종본'));

  s.getRange('A6').setValue('▼ 아래 칸에서 고쳐 쓴 뒤, 값만 복사해 최종취합 시트의 [최종본] 칸에 붙여넣으세요.')
    .setFontColor('#555555').setFontWeight('bold');
  s.getRange('A7:D7').merge().setBackground(APP.COLORS.paste).setWrap(true).setVerticalAlignment('top');
  s.getRange('E7').setFormula('=IF($A$7="","",saeteukBytes($A$7)&"바이트")');
  s.setColumnWidth(1, 70); s.setColumnWidth(2, 70); s.setColumnWidth(3, 110);
  s.setColumnWidth(4, 110); s.setColumnWidth(5, 620);
  s.getRange('E4').setWrap(true).setVerticalAlignment('top');
  s.setRowHeight(4, 130); s.setRowHeight(7, 160);
}

/** 사용자 정의 함수: 바이트 수 */
function saeteukBytes(text) {
  if (text === null || text === undefined) return 0;
  if (Array.isArray(text)) return text.map(function (r) { return r.map(function (c) { return byteLen(c); }); });
  return byteLen(text);
}
