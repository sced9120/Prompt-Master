/**
 * 세특 작성 도우미 v3 — 🧪 체험 예시 채우기 · 지우기
 *
 * 처음 보는 선생님이 30초 만에 "채워진 모습"을 보게 한다.
 *   · 가상 학생 3명(강하늘 · 윤바다 · 서가람), 바로 쓰기 활동 하나([체험 예시]), 예시 2편, 고칠 곳이 있는 초안 한 편
 *   · 메모 양을 학생마다 다르게 해서, 메모를 많이 적을수록 결과가 길고 구체적이 되는 것을 보게 한다
 *   · 실제 학생 자료와 섞이지 않게 명단이 비었거나 체험 학생만 있을 때만 채운다
 *   · 지우기는 체험이 만든 것(활동 · 시트 · 체험 학생)만 지운다. 선생님이 더한 학생과 활동은 그대로
 */

var DEMO_PROP = 'DEMO';
var DEMO_KEY = '체험예시';
var DEMO_NAME = '체험 예시';
var DEMO_BYTES = 600;   // 과세특 한 칸(1500바이트) 가운데 이 활동의 몫 — 활동별 바이트 한도가 어떻게 보이는지도 함께

/** 가상 학생 — 연수 슬라이드의 실습 명단과 같다 */
var DEMO_STUDENTS = [
  { cls: '1', no: '1', name: '강하늘' },
  { cls: '1', no: '2', name: '윤바다' },
  { cls: '1', no: '3', name: '서가람' }
];

/**
 * 관찰 메모 — 일부러 양을 다르게 했다. 결과의 길이와 내용이 메모를 따라가는지 비교해 보게.
 *   강하늘: 관찰 사실 다섯 가지(예시만큼) · 윤바다: 세 가지 · 서가람: 한 줄
 */
var DEMO_MEMOS = {
  '강하늘': '10/7 일차함수 모둠 발표. 칠판에 그래프를 직접 그려 기울기를 1시간에 늘어나는 양으로 설명. ' +
            '친구가 기울기가 음수면 어떻게 되냐고 묻자 물탱크에서 물이 빠지는 예로 바꿔 다시 설명. ' +
            '발표 뒤 받은 질문 4개와 답을 모둠 기록지에 정리해 올림. 다음 시간 다른 모둠 발표에서 축 이름에 단위가 빠진 것을 짚어 줌.',
  '윤바다': '1학기 일차방정식에서 이항할 때 부호를 자주 틀림. 2학기부터 오답 노트에 틀린 까닭을 한 줄씩 적어 매주 냄. ' +
            '10월부터 오답 노트에서 고른 질문을 들고 쉬는 시간에 찾아옴.',
  '서가람': '교통 자료로 일차함수 모델 세우다 단위 다른 것 찾아 고침.'
};

/** 일부러 고칠 곳을 넣은 초안 — [검증] 칸이 무엇을 짚는지 보여 준다(평서형 어미 · AI 투 · 띄어쓰기) */
var DEMO_DRAFT = {
  name: '강하늘',
  text: '일차함수 단원 모둠 발표에서 그래프를 직접 그려 기울기가 변화율이라는 점을 설명했다. ' +
        '이를 통해 수학적 의사소통 역량에 있어서 깊은 이해를 보여줌. ' +
        '친구의 질문에 예를 바꾸어 다시 설명하며 같은 개념을 다른 방식으로 표현할수 있음.'
};

/**
 * 예시 2편 — 메모에 관찰 사실이 대여섯 가지 있어야 결과가 이만큼 나온다는 것을 보여 준다.
 * 결과에는 메모에 있는 사실만 쓴다(검사에 걸리지 않는 글).
 */
var DEMO_EXAMPLES = [
  { values: ['9/12 삼각비 건물 높이 재기(4인 모둠). 모둠마다 값이 3~5m씩 차이 남 → 다른 모둠 기록지와 비교하자고 먼저 제안. ' +
             '각도기 대는 눈높이, 기준점(모서리/창틀)이 모둠마다 달랐음을 찾음. 눈높이 1.5m를 안 더한 모둠도 있다고 짚음. ' +
             '기준 맞춰 다시 재니 차이 1m 안. 발표: 값보다 재는 방법부터 맞춰야 한다고 정리. 10월 통계 단원 설문 만들 때도 문항 기준부터 맞추자고 함.'],
    result: '삼각비를 활용한 건물 높이 재기 모둠 활동에서 모둠마다 값이 3m 넘게 차이 나자 다른 모둠의 기록지와 비교해 보자고 먼저 제안함. ' +
            '각도를 재는 눈높이와 기준점이 모둠마다 달랐고 눈높이를 더하지 않은 모둠도 있음을 찾아내 기준을 하나로 맞춘 뒤 다시 재어 차이를 1m 안으로 줄임. ' +
            '발표에서 측정값보다 재는 방법을 먼저 맞춰야 한다고 정리했고, 통계 단원에서 설문 문항을 만들 때에도 기준부터 맞추자고 제안함.' },
  { values: ['수열 첫 주 형성평가 규칙 찾기 문항 대부분 못 풂. 짝이 알려 준 대로 이웃한 두 항의 차를 표로 적기 시작. ' +
             '3주 차에 등차수열 일반항을 스스로 세움. 첫째항, 공차를 바꾼 문제 3개를 만들어 짝에게 냄. ' +
             '단원 마무리 형성평가에서 같은 유형 대부분 해결. 풀이 설명 시키면 처음엔 답만 말함 → 후반엔 표를 가리키며 순서대로 설명.'],
    result: '수열 단원 초반에는 규칙 찾기 문항을 대부분 해결하지 못했으나 짝 활동에서 이웃한 두 항의 차를 표로 적는 방법을 익혀 쓰기 시작함. ' +
            '3주 차에는 등차수열의 일반항을 스스로 세웠고 첫째항과 공차를 바꾼 문제 세 개를 직접 만들어 짝에게 풀게 함. ' +
            '단원을 마칠 무렵에는 같은 유형의 문항을 대부분 해결했으며, 처음에는 답만 말하던 설명이 표를 짚어 가며 풀이 순서대로 이어지게 됨.' }
];

function demoNames_() { return DEMO_STUDENTS.map(function (s) { return s.name; }); }

/** 명단에 체험 학생 말고 다른 학생이 있는지 */
function demoRosterState_() {
  var roster = [];
  try { roster = getRoster_(); } catch (e) {}
  var names = demoNames_();
  var others = roster.filter(function (st) { return names.indexOf(String(st.name).trim()) < 0; });
  return { count: roster.length, others: others.length, roster: roster };
}

/** 시작하기 창 · 메뉴에서 쓰는 상태 */
function demoState_() {
  var saved = null;
  try { saved = JSON.parse(PropertiesService.getDocumentProperties().getProperty(DEMO_PROP) || 'null'); } catch (e) {}
  var filled = !!saved;
  try { if (!filled && getActivity_(DEMO_KEY)) filled = true; } catch (e) {}
  var rs = { others: 0 };
  try { rs = demoRosterState_(); } catch (e) {}
  return { filled: filled, canFill: !filled && !rs.others, inSheet: saved && saved.inSheet || sheetNameIn_(DEMO_KEY) };
}

/**
 * 체험 예시 채우기
 * @return {{inSheet:string, exSheet:string, roster:string, students:number}}
 */
function demoFill() {
  if (!sh_(APP.SH.ACTIVITY) || !sh_(APP.SH.ROSTER) || !sh_(APP.SH.RECORD)) installCore_();
  if (getActivity_(DEMO_KEY)) throw new Error('체험 예시가 이미 들어 있습니다. [' + sheetNameIn_(DEMO_KEY) + '] 시트를 보세요.');
  var rs = demoRosterState_();
  if (rs.others) {
    throw new Error('학생 명단에 체험 학생이 아닌 학생이 ' + rs.others + '명 있어서 체험 예시를 넣지 않았습니다. ' +
                    '실제 학생 자료와 섞이지 않게, 체험은 명단이 빈 새 사본에서 해 보세요.');
  }
  var rosterAdded = false;
  if (rs.count < DEMO_STUDENTS.length) {
    rosterSave({ rows: DEMO_STUDENTS.map(function (s) { return [s.cls, s.no, s.name]; }), mode: 'class' });
    rosterAdded = true;
  }

  var made = createActivity_({
    key: DEMO_KEY, name: DEMO_NAME, recordKey: '과세특', subjectKey: '수학', bytes: DEMO_BYTES,
    columns: [QUICK_COLUMN], desc: '일차함수로 실생활 자료를 모델링하는 모둠 탐구', mode: '바로쓰기',
    examples: DEMO_EXAMPLES
  });

  var s = sh_(made.inSheet);
  var cMemo = colOf_(s, APP.HEAD_ROW, QUICK_COLUMN), cAi = colOf_(s, APP.HEAD_ROW, 'AI 결과'), cV = colOf_(s, APP.HEAD_ROW, '검증');
  var last = s.getLastRow();
  if (last >= APP.DATA_ROW) {
    var names = s.getRange(APP.DATA_ROW, 3, last - APP.DATA_ROW + 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      var nm = String(names[i][0]).trim(), r = APP.DATA_ROW + i;
      if (DEMO_MEMOS[nm]) s.getRange(r, cMemo).setValue(DEMO_MEMOS[nm]);
      if (nm === DEMO_DRAFT.name) {
        s.getRange(r, cAi).setValue(DEMO_DRAFT.text);
        if (cV) s.getRange(r, cV).setValue(formatIssues(inspect_(DEMO_DRAFT.text, DEMO_BYTES)));
      }
    }
  }
  PropertiesService.getDocumentProperties().setProperty(DEMO_PROP, JSON.stringify({
    key: DEMO_KEY, inSheet: made.inSheet, exSheet: made.exSheet, roster: rosterAdded ? 'added' : 'kept', at: new Date().toISOString()
  }));
  ss_().setActiveSheet(s);
  return { inSheet: made.inSheet, exSheet: made.exSheet, roster: rosterAdded ? 'added' : 'kept', students: DEMO_STUDENTS.length };
}

/**
 * 체험 예시 지우기 — 체험 활동(시트 2개 · 활동목록 줄)과 명단의 체험 학생만
 * @return {{sheets:string[], activity:boolean, students:number}}
 */
function demoClear() {
  var dp = PropertiesService.getDocumentProperties();
  var saved = null;
  try { saved = JSON.parse(dp.getProperty(DEMO_PROP) || 'null'); } catch (e) {}
  var out = { sheets: [], activity: false, students: 0 };
  var act = sh_(APP.SH.ACTIVITY) ? getActivity_(DEMO_KEY) : null;
  var sheets = [sheetNameIn_(DEMO_KEY), sheetNameEx_(DEMO_KEY)];
  if (act) sheets = sheets.concat([act.inSheet, act.exSheet]);
  sheets.filter(function (n, i) { return n && sheets.indexOf(n) === i; }).forEach(function (n) {
    var s = sh_(n);
    if (s) { ss_().deleteSheet(s); out.sheets.push(n); }
  });
  if (act) { shRequire_(APP.SH.ACTIVITY).deleteRow(act.__row); out.activity = true; }
  try { refreshActivityValidation_(); } catch (e) {}

  // 명단: 체험이 넣은 학생만 뺀다(선생님이 더한 학생은 그대로)
  if (sh_(APP.SH.ROSTER)) {
    var names = demoNames_();
    var roster = getRoster_();
    var rest = roster.filter(function (st) { return names.indexOf(String(st.name).trim()) < 0; });
    out.students = roster.length - rest.length;
    if (out.students && (!saved || saved.roster === 'added' || !rest.length)) {
      var mode = rosterMode_();
      writeRosterSheet_(rest.map(function (st) { return { year: st.year, cls: st.clsRaw, no: st.no, name: st.name, level: st.grade }; }), mode);
      try { syncRosterAll_(); } catch (e) {}
    } else out.students = 0;
  }
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  dp.deleteProperty(DEMO_PROP);
  var start = sh_(APP.SH.START);
  if (start) ss_().setActiveSheet(start);
  return out;
}

/* ------------------------------------------------------- 메뉴 */
function menuDemoFill() {
  try {
    var r = demoFill();
    toast_('체험 예시를 넣었습니다 → [' + r.inSheet + ']. 강하늘 줄의 [검증] 칸부터 보세요. 메모 양이 학생마다 달라 결과 길이도 달라집니다.', APP.MENU, 10);
  } catch (e) { ui_().alert(APP.MENU, e.message, ui_().ButtonSet.OK); }
}

function menuDemoClear() {
  if (!demoState_().filled) { ui_().alert(APP.MENU, '지울 체험 예시가 없습니다.', ui_().ButtonSet.OK); return; }
  var c = ui_().alert(APP.MENU,
    '체험 예시를 지웁니다.\n\n· [' + sheetNameIn_(DEMO_KEY) + '] · [' + sheetNameEx_(DEMO_KEY) + '] 시트와 활동목록의 [' + DEMO_KEY + '] 줄\n' +
    '· 학생 명단의 체험 학생(' + demoNames_().join(', ') + ')\n\n선생님이 만든 활동과 학생은 그대로 둡니다. 계속할까요?',
    ui_().ButtonSet.YES_NO);
  if (c !== ui_().Button.YES) return;
  var r = demoClear();
  toast_('체험 예시를 지웠습니다 (시트 ' + r.sheets.length + '개 · 체험 학생 ' + r.students + '명).', APP.MENU, 6);
}
