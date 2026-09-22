/* 학생 명단 — 반·번호 / 학년·반·번호, 파일·붙여넣기 해석 (node test/roster.test.js) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');
const R = require('../apps-script/14_RosterParse.gs');

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
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), (m || '') + ' 기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a));
const P = (rows, mode) => R.parseRosterRows(rows, mode);
const T = (text, mode) => R.parseRosterRows(R.rosterTextToRows(text), mode);
const brief = r => r.students.map(s => [s.year, s.cls, s.no, s.name, s.level]);

console.log('\n[반·번호 — 예전처럼]');
t('머리글 + 탭·빈칸·쉼표·"2반 1번" 섞임', () => {
  const r = T('반\t번호\t이름\n1\t1\t김하늘\n1  2  박서준\n1,3,이유나,2\n\n2반 1번 최민준', 'class');
  eq(brief(r), [['', 1, 1, '김하늘', ''], ['', 1, 2, '박서준', ''], ['', 1, 3, '이유나', 2], ['', 2, 1, '최민준', '']]);
});
t('머리글 없이 순서대로', () => eq(brief(T('3 1 김하늘 2\n3 2 박서준', 'class')), [['', 3, 1, '김하늘', 2], ['', 3, 2, '박서준', '']]));
t('성취수준이 1~5가 아니면 비우고 알림', () => {
  const r = T('1 1 김하늘 7', 'class');
  eq(r.students[0].level, ''); ok(r.warnings.some(w => /성취수준/.test(w)), r.warnings.join());
});

console.log('\n[학년·반·번호 — 동아리]');
t('머리글: 학년 반 번호 이름 성취수준', () => {
  const r = P([['학년', '반', '번호', '이름', '성취수준'], ['2', '3', '15', '김하늘', '1'], ['1', '2', '7', '박서준', '']], 'grade');
  eq(brief(r), [['1', 2, 7, '박서준', ''].map((v, i) => i === 0 ? 1 : v), [2, 3, 15, '김하늘', 1]]);
});
t('머리글 없이 숫자 세 개 + 이름', () => eq(brief(T('2 3 15 김하늘\n1 2 7 박서준 3', 'grade')), [[1, 2, 7, '박서준', 3], [2, 3, 15, '김하늘', '']]));
t('"2학년 3반 15번 김하늘" 같은 글', () => eq(brief(T('2학년 3반 15번 김하늘', 'grade')), [[2, 3, 15, '김하늘', '']]));
t('학번 칸(20315) → 2학년 3반 15번', () => {
  const r = P([['학번', '성명'], ['20315', '김하늘'], ['10207', '박서준']], 'auto');
  eq(r.mode, 'grade'); eq(brief(r), [[1, 2, 7, '박서준', ''], [2, 3, 15, '김하늘', '']]);
});
t('머리글 없는 학번 줄', () => eq(brief(T('20315 김하늘\n10207 박서준 2', 'auto')), [[1, 2, 7, '박서준', 2], [2, 3, 15, '김하늘', '']]));
t('학년·반·번호가 겹치면 경고', () => {
  const r = T('2 3 15 김하늘\n2 3 15 박서준', 'grade');
  ok(r.warnings.some(w => /두 번/.test(w)), r.warnings.join());
});
t('학년이 비면 경고', () => {
  const r = P([['학년', '반', '번호', '이름'], ['', '3', '15', '김하늘']], 'grade');
  ok(r.warnings.some(w => /학년이 비어/.test(w)), r.warnings.join());
});

console.log('\n[자동 판별 · 나이스 명렬표 모양]');
t('머리글에 학년이 있으면 학년 방식', () => eq(P([['학년', '반', '번호', '성명']], 'auto').mode, 'grade'));
t('머리글에 학년이 없으면 반 방식', () => eq(P([['반', '번호', '이름']], 'auto').mode, 'class'));
t('위에 제목 줄이 있고 열 순서가 달라도', () => {
  const r = P([['2026학년도 과학탐구반 명단'], [''], ['번호', '성명', '반', '학년', '비고'], ['15', '김하늘', '3', '2', '부장']], 'auto');
  eq(r.mode, 'grade'); eq(brief(r), [[2, 3, 15, '김하늘', '']]);
});
t('양식의 예시 줄은 건너뜀', () => {
  const r = P([['반', '번호', '이름', '성취수준'], ['1', '1', '예시학생1', ''], ['1', '2', '김하늘', '']], 'class');
  eq(r.students.length, 1); ok(r.skipped.some(s => /예시/.test(s.reason)), JSON.stringify(r.skipped));
});
t('이름 없는 줄은 이유와 함께 건너뜀', () => {
  const r = P([['반', '번호', '이름'], ['1', '1', '']], 'class');
  eq(r.students.length, 0); eq(r.skipped[0].reason, '이름 없음');
});
t('학년·반·번호 순으로 정렬', () => eq(brief(T('2 1 1 가\n1 3 2 나\n1 3 1 다', 'grade')).map(x => x[3]), ['다', '나', '가']));

console.log('\n[시트에 쓰는 모양]');
t('명단 시트 한 줄', () => {
  eq(R.rosterRowOf({ year: 2, cls: 3, no: 15, name: '김하늘', level: 1 }, 'grade'), [2, 3, 15, '김하늘', 1]);
  eq(R.rosterRowOf({ year: '', cls: 3, no: 15, name: '김하늘', level: '' }, 'class'), [3, 15, '김하늘', '']);
});
t('활동 시트 A열 표시: 반 방식 3, 학년 방식 2-3', () => { eq(R.classLabel('', 3), 3); eq(R.classLabel(2, 3), '2-3'); });
t('사람이 읽는 이름표', () => eq(R.studentLabel({ year: 2, cls: 3, no: 15, name: '김하늘' }), '2학년 3반 15번 김하늘'));

/* ------------------------------------------------------ 가짜 시트 위에서 */
console.log('\n[처음 설치 — 기본은 반·번호]');
const A = boot();
A.installCore_();
t('명단 시트 머리글이 반/번호/이름/성취수준', () => {
  const s = A.__ss.getSheetByName('👤 학생명단');
  eq(s.getRange(2, 1, 1, 4).getValues()[0], ['반', '번호', '이름', '성취수준']);
  eq(A.rosterMode_(), 'class');
});

console.log('\n[반·번호 명단 → 활동 → 학년·반·번호로 바꾸기]');
let made;
t('반·번호 명단 저장', () => {
  const r = A.rosterSave({ text: '3 1 김하늘\n3 2 박서준', mode: 'class' });
  eq(r.count, 2); eq(A.getRoster_().map(s => s.id), ['3-1', '3-2']);
});
t('활동을 만들고 학생 자료를 적어 둠', () => {
  made = A.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통',
    columns: '탐구 주제', desc: '', examples: [] });
  const s = A.__ss.getSheetByName(made.inSheet);
  eq(s.getRange(3, 1).getValue(), '반', '첫 열 머리글');
  s.getRange(4, 5).setValue('기후 자료');
  s.getRange(5, 5).setValue('교통량');
});
t('학년·반·번호 명단으로 바꾸면 명단 시트 머리글이 바뀜', () => {
  const r = A.rosterSave({ rows: [['학년', '반', '번호', '이름'], ['2', '3', '1', '김하늘'], ['1', '5', '9', '박서준'], ['2', '1', '4', '이유나']], mode: 'grade' });
  eq(r.mode, 'grade'); eq(r.synced, 1);
  const s = A.__ss.getSheetByName('👤 학생명단');
  eq(s.getRange(2, 1, 1, 5).getValues()[0], ['학년', '반', '번호', '이름', '성취수준']);
  eq(A.rosterMode_(), 'grade');
});
t('활동 시트 첫 열이 "학년-반"이 되고 A열에 2-3 처럼 들어감', () => {
  const s = A.__ss.getSheetByName(made.inSheet);
  eq(s.getRange(3, 1).getValue(), '학년-반');
  const ids = A.getRoster_().map(x => x.id);
  eq(ids, ['1-5-9', '2-1-4', '2-3-1']);
  eq(s.getRange(4, 1, 3, 3).getValues().map(r => r.join('|')), ['1-5|9|박서준', '2-1|4|이유나', '2-3|1|김하늘']);
});
t('반·번호가 바뀌어도 이름으로 찾아 학생 자료가 따라옴', () => {
  const s = A.__ss.getSheetByName(made.inSheet);
  const byName = {}; s.getRange(4, 1, 3, 5).getValues().forEach(r => { byName[r[2]] = r[4]; });
  eq(byName['김하늘'], '기후 자료'); eq(byName['박서준'], '교통량'); eq(byName['이유나'], '');
});
t('취합 시트도 학년-반으로', () => {
  A.buildCompileCore_();
  const c = A.__ss.getSheetByName('📦 취합 ▸동아리');
  eq(c.getRange(3, 1).getValue(), '학년-반');
  eq(c.getRange(4, 1).getValue(), '1-5');
});
t('관찰 기록 앱의 학생 이름표', () => {
  const lab = A.observeContext().students.map(s => s.label);
  ok(lab.indexOf('2학년 3반 1번 김하늘') >= 0, lab.join(', '));
});
t('설치/복구를 다시 눌러도 학년 방식 명단은 그대로', () => {
  A.installCore_();
  eq(A.rosterMode_(), 'grade'); eq(A.getRoster_().length, 3);
});
t('다시 반·번호로 돌아가도 자료 보존', () => {
  A.rosterSave({ text: '3 1 김하늘\n3 2 박서준', mode: 'class' });
  const s = A.__ss.getSheetByName(made.inSheet);
  eq(s.getRange(3, 1).getValue(), '반');
  const byName = {}; s.getRange(4, 1, 2, 5).getValues().forEach(r => { byName[r[2]] = r[4]; });
  eq(byName['김하늘'], '기후 자료');
});

console.log('\n[미리 보기]');
t('선택한 방식과 명단이 다르면 알려 줌', () => {
  const r = A.rosterPreview({ rows: [['학년', '반', '번호', '이름'], ['2', '3', '1', '김하늘']], mode: 'class' });
  eq(r.detected, 'grade');
});
t('저장하지 않음', () => {
  const before = A.getRoster_().length;
  A.rosterPreview({ text: '1 1 가\n1 2 나\n1 3 다', mode: 'class' });
  eq(A.getRoster_().length, before);
});
t('알아볼 수 없는 명단은 저장을 거절', () => {
  let err = null; try { A.rosterSave({ text: '안녕하세요', mode: 'class' }); } catch (e) { err = e; }
  ok(err && /알아보지 못했습니다/.test(err.message), err && err.message);
});

console.log('\n[시작하기 — 붙여넣기 + 방식]');
t('시작하기에서 학년 방식으로 저장', () => {
  const B = boot(); B.installCore_();
  const st = B.onboardSaveRoster('2 3 15 김하늘\n1 2 7 박서준', 'grade');
  eq(st.rosterCount, 2); eq(st.rosterMode, 'grade');
});
t('시작하기 미리 보기 예시가 사람이 읽는 모양', () => {
  const B = boot(); B.installCore_();
  const p = B.onboardPreviewRoster('20315 김하늘', 'auto');
  eq(p.sample[0], '2학년 3반 15번 김하늘'); eq(p.mode, 'grade');
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
