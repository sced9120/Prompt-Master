/* 설치 경로 통합 테스트 (node test/install.test.js)
   가짜 스프레드시트 위에서 실제 코드를 처음부터 끝까지 돌린다.
   구글이 막는 규칙(병합 셀을 가르는 열 고정 등)은 가짜도 똑같이 막는다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();

function boot() {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const names = ctx => ctx.__ss.getSheets().map(s => s.getName());

const EXPECTED = ['🚀 시작하기', '📖 사용법', '⚙️ 설정', '👤 학생명단', '🗂 활동목록',
                  '🧩 기록종류', '📚 교과영역', '📐 공통규칙', '✅ 검토'];

console.log('\n[처음 설치 — 한 번 누르면 전부 생겨야 한다]');
const A = boot();
let firstErr = null;
try { A.installCore_(); } catch (e) { firstErr = e; }
t('첫 실행에서 예외 없음', () => ok(!firstErr, firstErr && firstErr.message));
t('필요한 시트가 한 번에 모두 생김', () => {
  const missing = EXPECTED.filter(n => names(A).indexOf(n) < 0);
  ok(!missing.length, '빠진 시트: ' + missing.join(', ') + '\n현재: ' + names(A).join(', '));
});
t('학생명단 헤더가 반/번호/이름/성취수준', () => {
  const s = A.__ss.getSheetByName('👤 학생명단');
  ok(s, '학생명단 시트 없음');
  const h = s.getRange(2, 1, 1, 4).getValues()[0];
  ok(h.join('|') === '반|번호|이름|성취수준', '헤더: ' + h.join('|'));
});
t('기록종류 6개가 읽힘', () => ok(A.getRecordTypes_().length === 6, '개수 ' + A.getRecordTypes_().length));
t('교과영역 10개가 읽힘', () => ok(A.getSubjects_().length === 10, '개수 ' + A.getSubjects_().length));
t('공통규칙 5개가 읽힘', () => ok(Object.keys(A.getCommon_()).length === 5));
t('안내 배너가 데이터로 읽히지 않음(유령 행 없음)', () => {
  ok(A.getRecordTypes_().every(r => r.key.length < 10), '이상한 키: ' + A.getRecordTypes_().map(r => r.key).join(','));
  ok(A.getActivities_().length === 0, '활동이 없어야 하는데 ' + A.getActivities_().length + '개');
});
t('시작하기 탭이 맨 앞', () => ok(names(A)[0] === '🚀 시작하기', '맨 앞: ' + names(A)[0]));

console.log('\n[여러 번 눌러도 안전해야 한다]');
t('두 번째 실행도 예외 없음', () => A.installCore_());
t('시트가 늘어나지 않음', () => {
  const before = names(A).length; A.installCore_();
  ok(names(A).length === before, before + ' → ' + names(A).length);
});

console.log('\n[온보딩 흐름]');
t('명단 붙여넣기 해석 — 탭/공백/쉼표 섞여도', () => {
  const rows = A.parseRoster_('반\t번호\t이름\n1\t1\t김하늘\n1  2  박서준\n1,3,이유나,2\n\n2반 1번 최민준');
  ok(rows.length === 4, '읽은 수 ' + rows.length + ' ' + JSON.stringify(rows));
  ok(rows[2][3] === 2, '성취수준 ' + rows[2][3]);
});
t('명단 저장 → 명단 시트에 반영', () => {
  A.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준\n1\t3\t이유나');
  ok(A.getRoster_().length === 3, '명단 ' + A.getRoster_().length + '명');
});
t('명단이 생기면 onOpen 안내가 멈춤', () => ok(A.needsOnboarding_() === false));

console.log('\n[활동 만들기 — 열 고정이 있는 시트]');
let made = null;
t('활동 생성 예외 없음', () => {
  made = A.createActivity_({
    key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통',
    columns: '탐구 주제|선정 이유|분석 방법|알게 된 점',
    desc: '공공데이터 탐구', examples: [{ values: ['a', 'b', 'c', 'd'], result: '자료를 분석함.' }]
  });
});
t('입력·예시 시트가 생김', () => {
  ok(made && A.__ss.getSheetByName(made.inSheet), '입력 시트 없음');
  ok(A.__ss.getSheetByName(made.exSheet), '예시 시트 없음');
});
t('입력 시트에 명단이 동기화됨', () => {
  const s = A.__ss.getSheetByName(made.inSheet);
  ok(s.getRange(4, 3).getValue() === '김하늘', '4행 이름: ' + s.getRange(4, 3).getValue());
});
t('입력 시트에서 반·번호·이름이 고정됨', () => {
  const f = A.__ss.getSheetByName(made.inSheet).__frozen;
  ok(f.cols === 3 && f.rows === 3, JSON.stringify(f));
});
t('예시가 읽히고 프롬프트에 들어감', () => {
  const act = A.getActivity_('탐구');
  ok(A.readExampleRows_(act).length === 1, '예시 ' + A.readExampleRows_(act).length);
  ok(/## 예시1 결과/.test(A.promptFor_(act)), '프롬프트에 예시 없음');
});
t('활동목록에 한 줄 추가됨', () => ok(A.getActivities_().length === 1));

console.log('\n[최종취합 — 열 고정이 있는 시트]');
t('취합 시트 생성 예외 없음', () => A.buildCompileCore_());
t('기록종류별 취합 시트가 생김', () => ok(A.__ss.getSheetByName('📦 취합 ▸동아리'), '없음: ' + names(A).join(', ')));
t('취합 시트에서 반·번호·이름이 고정됨', () => {
  const f = A.__ss.getSheetByName('📦 취합 ▸동아리').__frozen;
  ok(f.cols === 3, JSON.stringify(f));
});

console.log('\n[예시 칸 늘리기 / 구조 복구]');
t('예시 칸 3줄 추가', () => {
  const s = A.__ss.getSheetByName(made.exSheet);
  const before = s.getLastRow();
  A.writeExampleRows_(s, A.parseColumns(A.getActivity_('탐구').columns), [], A.lastExampleRow_(s) + 1, 3);
  ok(s.getLastRow() >= before + 3 || s.getRange(before + 3, 1).getValue() !== '', '줄 수 ' + before + ' → ' + s.getLastRow());
});

console.log('\n[지난번 버그로 반쯤 설치된 파일도 한 번에 복구되는가]');
t('활동목록이 헤더만 있는 상태에서 설치 → 전부 생김', () => {
  const B = boot();
  // 초판 버그 상태 재현: 기록종류·교과영역·공통규칙은 있고, 활동목록은 헤더까지만, 학생명단 없음
  B.buildStart(); B.buildConfig(); B.buildRecordTypes(); B.buildSubjects(); B.buildCommonRules();
  const al = B.__ss.insertSheet('🗂 활동목록');
  al.getRange(1, 1, 1, 11).merge();
  al.getRange(2, 1, 1, 3).setValues([['활동키', '활동명', '기록종류']]);
  B.installCore_();
  const missing = EXPECTED.filter(n => names(B).indexOf(n) < 0);
  ok(!missing.length, '빠진 시트: ' + missing.join(', '));
  ok(B.getActivities_().length === 0, '유령 활동 ' + B.getActivities_().length);
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
