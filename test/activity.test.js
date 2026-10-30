/* 활동 — 입력 항목 직접 적기 · 나중에 바꾸기 (node test/activity.test.js) */
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
  ctx.installCore_();
  return ctx;
}
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), (m || '') + ' 기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a));
const head = (ctx, sheet) => ctx.__ss.getSheetByName(sheet).getRange(3, 1, 1, 20).getValues()[0].filter(String);
const throws = (fn, re) => { let e = null; try { fn(); } catch (x) { e = x; } ok(e && re.test(e.message), '예외: ' + (e && e.message)); };

console.log('\n[입력 항목 검사]');
const V = boot();
t('빈 항목은 거절', () => throws(() => V.validateColumns_(''), /1개 이상/));
t('쉼표·막대기·줄바꿈 어느 것으로 나눠도 됨', () => {
  eq(V.validateColumns_('주제, 과정 | 알게 된 점'), ['주제', '과정', '알게 된 점']);
  eq(V.validateColumns_(['주제 ', ' 과정', '']), ['주제', '과정']);
});
t('시스템이 쓰는 이름은 거절', () => throws(() => V.validateColumns_('주제, 최종본'), /최종본/));
t('같은 항목이 두 번이면 거절', () => throws(() => V.validateColumns_('주제, 주제'), /중복/));
t('13개 이상은 거절', () => throws(() => V.validateColumns_(Array.from({ length: 13 }, (_, i) => 'c' + i)), /12개/));

console.log('\n[AI 없이, 적은 항목 그대로 만들기]');
const A = boot();
A.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준');
let made;
t('wizardCreate 로 바로 만들기 (AI 호출 없음)', () => {
  A.__fetch.handler = () => { throw new Error('AI 를 부르면 안 됩니다'); };
  made = A.wizardCreate({ name: '데이터 탐구', key: '데이터 탐구', columns: ['탐구 주제', '선정 이유', '알게 된 점'],
                          desc: '공공데이터 탐구', recordKey: '동아리', subjectKey: '공통', examples: [] });
  ok(made.inSheet && made.exSheet, JSON.stringify(made));
});
t('입력 시트 열 머리글이 적은 그대로', () => {
  eq(head(A, made.inSheet), ['반', '번호', '이름', '성취수준', '탐구 주제', '선정 이유', '알게 된 점',
                             '생성', '모델', 'AI 결과', '최종본', '바이트', '검증']);
});
t('예시 시트도 같은 항목', () => eq(head(A, made.exSheet), ['예시번호', '탐구 주제', '선정 이유', '알게 된 점', '결과', '바이트', '검증']));
t('활동목록에 그대로 저장됨', () => {
  const act = A.getActivity_('데이터탐구') || A.getActivities_()[0];
  eq(A.parseColumns(act.columns), ['탐구 주제', '선정 이유', '알게 된 점']);
  eq(act.desc, '공공데이터 탐구');
});
t('명단이 입력 시트에 들어와 있음', () => {
  const s = A.__ss.getSheetByName(made.inSheet);
  eq(s.getRange(4, 3).getValue(), '김하늘');
});
t('입력 항목이 없으면 만들지 않음', () => throws(() => A.wizardCreate({ name: 'x', columns: [], recordKey: '동아리' }), /1개 이상/));

console.log('\n[AI 초안 — 적어 둔 항목은 AI가 바꾸지 못함]');
const B = boot();
B.setKey_('gemini', 'k');
t('AI가 다른 항목을 돌려줘도 선생님이 적은 항목이 남는다', () => {
  let sys = '';
  B.__fetch.handler = (url, opt) => {
    const p = JSON.parse(opt.payload);
    sys = p.systemInstruction.parts[0].text;
    return { code: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({
      name: 'AI가 붙인 이름', key: 'ai', columns: ['제멋대로', '바꾼 항목'], desc: '설명',
      examples: [{ values: ['가', '나', '다'], result: '자료를 분석하여 결론을 정리함.' }] }) }] } }] } };
  };
  const def = B.wizardSuggest({ text: '탐구 활동입니다', recordKey: '동아리', subjectKey: '공통',
                                columns: ['주제', '과정', '결과'], name: '내가 정한 이름', count: 1 });
  eq(def.columns, ['주제', '과정', '결과']);
  eq(def.name, '내가 정한 이름');
  ok(/그대로 출력한다/.test(sys) && /"주제"/.test(sys), '시스템 프롬프트에 고정 지시가 없음');
  eq(def.examples.length, 1); eq(def.examples[0].values.length, 3);
});
t('항목을 안 적으면 예전처럼 AI가 정함', () => {
  B.__fetch.handler = () => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({
    name: '실험 보고서', key: '실험', columns: ['가설', '설계', '결과'], desc: '', examples: [] }) }] } }] } });
  const def = B.wizardSuggest({ text: '실험을 합니다', recordKey: '과세특', subjectKey: '과학', count: 1 });
  eq(def.columns, ['가설', '설계', '결과']);
});

console.log('\n[나중에 입력 항목 바꾸기]');
const C = boot();
C.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준');
let m2;
t('활동을 만들고 자료·결과를 채워 둠', () => {
  m2 = C.wizardCreate({ name: '탐구', key: '탐구', columns: ['주제', '과정', '느낀 점'], desc: '탐구',
                        recordKey: '동아리', subjectKey: '공통',
                        examples: [{ values: ['기후', '자료 분석', '한계'], result: '자료를 분석함.' }] });
  const s = C.__ss.getSheetByName(m2.inSheet);
  s.getRange(4, 5, 1, 3).setValues([['기후 자료', '추세선 분석', '오차를 알게 됨']]);
  s.getRange(5, 5, 1, 3).setValues([['교통량', '표본 조사', '한계 인식']]);
  const cAi = C.colOf_(s, 3, 'AI 결과'), cFin = C.colOf_(s, 3, '최종본');
  s.getRange(4, cAi).setValue('AI 초안 문장.');
  s.getRange(4, cFin).setValue('최종 문장.');
});
let res;
t('이름 바꾸기 + 항목 순서 바꾸기 + 추가 + 삭제', () => {
  res = C.wizardApply({ key: '탐구', name: '데이터 탐구', columns: ['과정', '주제', '협업한 점'], desc: '바뀐 개요' });
  eq(res.kept.sort(), ['과정', '주제']); eq(res.added, ['협업한 점']); eq(res.removed, ['느낀 점']);
});
t('열 머리글이 새 항목으로', () => {
  eq(head(C, m2.inSheet), ['반', '번호', '이름', '성취수준', '과정', '주제', '협업한 점',
                           '생성', '모델', 'AI 결과', '최종본', '바이트', '검증']);
});
t('학생 자료가 항목 이름을 따라 옮겨짐', () => {
  const s = C.__ss.getSheetByName(m2.inSheet);
  eq(s.getRange(4, 1, 2, 7).getValues(), [[1, 1, '김하늘', '', '추세선 분석', '기후 자료', ''],
                                          [1, 2, '박서준', '', '표본 조사', '교통량', '']]);
});
t('AI 결과·최종본도 그대로', () => {
  const s = C.__ss.getSheetByName(m2.inSheet);
  eq(s.getRange(4, C.colOf_(s, 3, 'AI 결과')).getValue(), 'AI 초안 문장.');
  eq(s.getRange(4, C.colOf_(s, 3, '최종본')).getValue(), '최종 문장.');
});
t('예시도 항목을 따라 옮겨짐', () => {
  const act = C.getActivity_('탐구');
  const rows = C.readExampleRows_(act);
  eq(rows.length, 1);
  eq(rows[0].values, ['자료 분석', '기후', '']);
  eq(rows[0].result, '자료를 분석함.');
});
t('활동목록 줄과 프롬프트에 반영', () => {
  const act = C.getActivity_('탐구');
  eq(act.name, '데이터 탐구'); eq(act.desc, '바뀐 개요');
  eq(C.parseColumns(act.columns), ['과정', '주제', '협업한 점']);
  const p = C.promptFor_(act);
  ok(/과정\|주제\|협업한 점/.test(p), '프롬프트의 입력 형식이 안 바뀜');
});
t('취합 시트의 활동 이름도 바뀜', () => {
  C.buildCompileCore_();
  const c = C.__ss.getSheetByName('📦 취합 ▸동아리');
  ok(c.getRange(3, 1, 1, 12).getValues()[0].indexOf('데이터 탐구') >= 0, c.getRange(3, 1, 1, 12).getValues()[0].join('|'));
});
t('되돌려도 남아 있는 자료는 그대로', () => {
  C.wizardApply({ key: '탐구', name: '데이터 탐구', columns: ['주제', '과정'], desc: '' });
  const s = C.__ss.getSheetByName(m2.inSheet);
  eq(s.getRange(4, 5, 1, 2).getValues(), [['기후 자료', '추세선 분석']]);
});
t('잘못된 항목은 거절하고 시트를 건드리지 않음', () => {
  throws(() => C.wizardApply({ key: '탐구', columns: ['주제', '주제'] }), /중복/);
  throws(() => C.wizardApply({ key: '탐구', columns: ['주제', '모델'] }), /모델/);
  eq(head(C, m2.inSheet).slice(4, 6), ['주제', '과정']);
});
t('없는 활동이면 알려 줌', () => throws(() => C.wizardApply({ key: '없음', columns: ['가'] }), /찾을 수 없습니다/));
t('이름을 다른 활동과 같게 바꾸면 거절', () => {
  C.wizardCreate({ name: '다른 활동', key: '다른활동', columns: ['가'], recordKey: '동아리', subjectKey: '공통', examples: [] });
  throws(() => C.wizardApply({ key: '탐구', name: '다른 활동', columns: ['주제'] }), /같은 활동명/);
});

console.log('\n[마법사 창이 받는 자료]');
t('입력 항목 묶음과 기존 활동 목록을 함께 준다', () => {
  const c = C.wizardContext();
  ok(c.columnSets.length >= 5, '묶음 ' + c.columnSets.length);
  ok(c.columnSets.every(s => s.cols && s.cols.length >= 3), '묶음마다 항목 3개 이상');
  ok(c.activities.some(a => a.key === '탐구' && a.columns.length === 2), JSON.stringify(c.activities));
});
t('기록종류마다 어울리는 묶음이 있다', () => {
  const c = C.wizardContext();
  ['과세특', '동아리', '자율', '진로', '행발'].forEach(rk => {
    const n = c.columnSets.filter(s => !s.for.length || s.for.indexOf(rk) >= 0).length;
    ok(n >= 2, rk + ' 묶음 ' + n + '개');
  });
});

console.log('\n[시작하기에서도 직접 적기]');
t('적은 항목 그대로, AI 없이 만든다', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  D.__fetch.handler = () => { throw new Error('AI 를 부르면 안 됩니다'); };
  const r = D.onboardCreateActivity({ text: '독서 연계 활동', recordKey: '과세특', subjectKey: '수학',
                                      name: '독서 기록', columns: '읽은 책, 인상 깊은 내용, 교과 연결', direct: true });
  eq(head(D, r.made.inSheet).slice(4, 7), ['읽은 책', '인상 깊은 내용', '교과 연결']);
  eq(r.status.activities.length, 1);
});
t('항목 없이 직접 만들려 하면 알려 준다', () => {
  const D = boot();
  throws(() => D.onboardCreateActivity({ text: '설명', recordKey: '과세특', subjectKey: '수학', direct: true }), /입력 항목/);
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
