/* 🖥️ 작성실 (node test/desk.test.js) */
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
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  ctx.installCore_();
  ctx.__g = g;
  return ctx;
}
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((m ? m + ' — ' : '') + '기대 ' + y + ' / 실제 ' + x); };
const gemOk = (text) => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: text || '확인' }] } }] } });

/** 두 반(1반 · 2반) 명단 + 교과 활동 하나 + 담임 시트 셋 */
function setup() {
  const B = boot();
  B.rosterSave({ text: '1 1 가나다\n1 2 라마바\n2 1 사아자\n2 2 차카타', mode: 'class' });
  B.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '과세특', subjectKey: '수학', columns: '탐구 주제|알게 된 점', examples: [] });
  return B;
}

console.log('\n[담임 · 교과 나누기]');
t('자율 · 진로 · 행발은 담임, 과세특 · 동아리는 교과', () => {
  const B = boot();
  eq(B.deskModeOf_({ recordKey: '자율' }), 'homeroom');
  eq(B.deskModeOf_({ recordKey: '행발' }), 'homeroom');
  eq(B.deskModeOf_({ recordKey: '과세특' }), 'subject');
  eq(B.deskModeOf_({ recordKey: '동아리' }), 'subject');
});
t('담임 시트 한 번에 만들기 — 세 개, 다시 눌러도 겹치지 않음, 학생 줄이 채워짐', () => {
  const B = setup();
  const ctx = B.deskMakeHomeroomSheets();
  eq(ctx.made, ['자율활동', '진로활동', '행동특성']);
  eq(ctx.activities.filter(a => a.mode === 'homeroom').map(a => a.rec), ['자율', '진로', '행발']);
  eq(B.deskMakeHomeroomSheets().made, []);
  const s = B.__g.__ss.getSheetByName(B.getActivity_('자율활동').inSheet);
  ok(s.getLastRow() >= 7, '학생 줄 ' + s.getLastRow());
});
t('반 목록 · 담임 학반 저장(이 파일) · 지우기', () => {
  const B = setup();
  const c = B.deskContext();
  eq(c.classes, ['1', '2']);
  eq(c.homeroom, '');
  eq(B.deskSetHomeroom('2').homeroom, '2');
  eq(B.__g.__docProps.getProperty('HOMEROOM'), '2');
  eq(B.deskSetHomeroom('').homeroom, '');
});

console.log('\n[불러오기 · 저장]');
t('담임 모드는 그 반 학생만, 교과 모드 "모든 반"은 전부 — 활동별로 한 번에', () => {
  const B = setup();
  B.deskMakeHomeroomSheets();
  const hr = B.deskLoad({ mode: 'homeroom', cls: '2' });
  eq(hr.students.map(s => s.id), ['2-1', '2-2']);
  eq(Object.keys(hr.data).sort(), ['자율활동', '진로활동', '행동특성'].sort());
  eq(Object.keys(hr.data['자율활동']), ['2-1', '2-2']);
  const sj = B.deskLoad({ mode: 'subject', cls: '' });
  eq(sj.students.length, 4);
  eq(Object.keys(sj.data), ['탐구']);
  eq(sj.data['탐구']['1-2'].name, '라마바');
});
t('저장: 입력 항목 · 최종본을 그 학생 줄에 쓰고 [검증]을 새로 씀', () => {
  const B = setup();
  const r = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-2'];
  const out = B.deskSave({ key: '탐구', row: r.row, id: '1-2', inputs: ['기후 자료', '추세선의 한계'], final: '기후 자료의 추세선을 해석하며 한계를 짚어 냄.' });
  const s = B.__g.__ss.getSheetByName('탐구 ▸입력');
  eq(s.getRange(r.row, 5, 1, 2).getValues()[0], ['기후 자료', '추세선의 한계']);
  eq(out.final, '기후 자료의 추세선을 해석하며 한계를 짚어 냄.');
  ok(/최종본 기준/.test(out.check), out.check);
  eq(B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'].inputs, ['', ''], '다른 학생은 그대로');
});
t('그사이 시트 줄이 바뀌었으면 학생(반-번호)으로 다시 찾아 저장 · 없으면 거절', () => {
  const B = setup();
  const out = B.deskSave({ key: '탐구', row: 4, id: '2-2', final: '자료를 모아 정리함.' });   // 4행은 1-1
  ok(out.row !== 4 && out.id === '2-2', JSON.stringify(out));
  eq(B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'].final, '', '엉뚱한 학생에 씀');
  let msg = ''; try { B.deskSave({ key: '탐구', row: 4, id: '9-9', final: 'x' }); } catch (e) { msg = e.message; }
  ok(/찾지 못했습니다/.test(msg), msg);
});
t('검사만(저장 안 함) — 금지어 · 바이트', () => {
  const B = setup();
  const v = B.deskInspect({ key: '탐구', text: '토익 만점을 받음.' });
  ok(v.issues.some(x => x.level === 'block'), JSON.stringify(v.issues));
  ok(v.limit > 0 && v.bytes > 0);
});

console.log('\n[표 보기 — 한 번에 저장 · 열 고치기]');
t('여러 학생을 한 번에 저장 — null 칸은 그대로, 검증을 새로 씀, 없는 학생은 missing', () => {
  const B = setup();
  const s = B.__g.__ss.getSheetByName('탐구 ▸입력');
  s.getRange(4, 5, 1, 2).setValues([['옛 주제', '옛 배움']]);
  const d = B.deskLoad({ mode: 'subject', cls: '' }).data['탐구'];
  const res = B.deskSaveRows({ key: '탐구', rows: [
    { id: '1-1', row: d['1-1'].row, inputs: [null, '새 배움'] },
    { id: '2-1', row: d['2-1'].row, inputs: ['기후 자료', '추세선'], final: '기후 자료의 추세선을 해석함.' },
    { id: '2-2', row: 4, final: '자료를 모아 정리함.' },                 // 줄 번호가 틀려도 학생으로 찾음
    { id: '9-9', row: 4, final: 'x' }
  ] });
  eq(res.missing, ['9-9']);
  eq(res.rows.map(r => r.id), ['1-1', '2-1', '2-2']);
  eq(res.rows[0].inputs, ['옛 주제', '새 배움']);
  ok(/최종본 기준/.test(res.rows[1].check), res.rows[1].check);
  const again = B.deskLoad({ mode: 'subject', cls: '' }).data['탐구'];
  eq(again['2-1'].inputs, ['기후 자료', '추세선']);
  eq(again['2-2'].final, '자료를 모아 정리함.');
  eq(again['1-1'].final, '', '엉뚱한 학생에 씀');
  eq(again['1-2'].inputs, ['', '']);
});
t('열 이름 바꾸기 — 학생 자료 · 최종본이 그대로 따라옴 · 활동목록 · 창에 보낼 목록도 바뀜', () => {
  const B = setup();
  const d = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구'];
  B.deskSaveRows({ key: '탐구', rows: [{ id: '1-2', row: d['1-2'].row, inputs: ['기후 자료', '추세선의 한계'], final: '한계를 짚어 냄.' }] });
  const res = B.deskSetColumns({ key: '탐구', columns: [{ name: '주제', from: '탐구 주제' }, { name: '알게 된 점', from: '알게 된 점' }] });
  eq(res.renamed, ['탐구 주제 → 주제']); eq(res.removed, []);
  eq(res.context.activities.filter(a => a.key === '탐구')[0].columns, ['주제', '알게 된 점']);
  const r = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-2'];
  eq(r.inputs, ['기후 자료', '추세선의 한계']); eq(r.final, '한계를 짚어 냄.');
});
t('열 더하기 · 순서 바꾸기 — 자료는 이름을 따라감', () => {
  const B = setup();
  const d = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구'];
  B.deskSaveRows({ key: '탐구', rows: [{ id: '1-1', row: d['1-1'].row, inputs: ['가', '나'] }] });
  const res = B.deskSetColumns({ key: '탐구', columns: [{ name: '알게 된 점', from: '알게 된 점' }, { name: '발표 태도' }, { name: '탐구 주제', from: '탐구 주제' }] });
  eq(res.added, ['발표 태도']);
  eq(B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'].inputs, ['나', '', '가']);
});
t('자료가 있는 열을 지우면 먼저 묻고(몇 명), force 로 지움 · 빈 열은 바로 지움', () => {
  const B = setup();
  const d = B.deskLoad({ mode: 'subject', cls: '' }).data['탐구'];
  B.deskSaveRows({ key: '탐구', rows: [{ id: '1-1', row: d['1-1'].row, inputs: ['가', '나'] }, { id: '2-1', row: d['2-1'].row, inputs: ['다', ''] }] });
  const cols = [{ name: '알게 된 점', from: '알게 된 점' }];
  const ask = B.deskSetColumns({ key: '탐구', columns: cols });
  ok(ask.needConfirm && ask.lost === 2, JSON.stringify(ask)); eq(ask.removed, ['탐구 주제']);
  eq(B.deskContext().activities[0].columns, ['탐구 주제', '알게 된 점'], '묻기만 하고 바꾸지 않음');
  const res = B.deskSetColumns({ key: '탐구', columns: cols, force: true });
  eq(res.removed, ['탐구 주제']);
  eq(B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'].inputs, ['나']);
  const res2 = B.deskSetColumns({ key: '탐구', columns: [{ name: '알게 된 점', from: '알게 된 점' }, { name: '빈 열' }] });
  ok(!res2.needConfirm);
  ok(!B.deskSetColumns({ key: '탐구', columns: cols }).needConfirm, '빈 열은 묻지 않음');
});
t('지운 열 이름을 다른 열에 붙여도 섞이지 않음 · 겹친 이름 · 빈 목록은 거절', () => {
  const B = setup();
  const d = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구'];
  B.deskSaveRows({ key: '탐구', rows: [{ id: '1-1', row: d['1-1'].row, inputs: ['가', '나'] }] });
  B.deskSetColumns({ key: '탐구', columns: [{ name: '탐구 주제', from: '알게 된 점' }], force: true });   // [탐구 주제]를 지우고 [알게 된 점]을 그 이름으로
  eq(B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'].inputs, ['나']);
  let m = ''; try { B.deskSetColumns({ key: '탐구', columns: [{ name: '가' }, { name: '가' }] }); } catch (e) { m = e.message; }
  ok(/중복/.test(m), m);
  m = ''; try { B.deskSetColumns({ key: '탐구', columns: [] }); } catch (e) { m = e.message; }
  ok(/1개 이상/.test(m), m);
});
t('바로 쓰기(담임) 시트에도 열을 더할 수 있음', () => {
  const B = setup();
  B.deskMakeHomeroomSheets();
  const res = B.deskSetColumns({ key: '자율활동', columns: [{ name: '관찰 메모', from: '관찰 메모' }, { name: '학급 임원 활동' }] });
  eq(res.context.activities.filter(a => a.key === '자율활동')[0].columns, ['관찰 메모', '학급 임원 활동']);
  eq(B.deskLoad({ mode: 'homeroom', cls: '1' }).data['자율활동']['1-1'].inputs, ['', '']);
});

console.log('\n[창 안에서 활동 · 프롬프트 · 설정]');
t('준비 자료 — 기록 영역(담임/교과) · 교과 · 설정값, 키는 있는지만', () => {
  const B = setup();
  B.__g.__userProps.setProperty('KEY_gemini', 'AIza-secret-key');
  const s = B.deskSetup();
  eq(s.records.filter(r => r.key === '자율')[0].mode, 'homeroom');
  eq(s.records.filter(r => r.key === '과세특')[0].mode, 'subject');
  ok(s.records[0].cap >= 60 && s.subjects.length > 1 && s.columnSets.length > 1);
  eq(s.settings.rosterCount, 4);
  eq(s.settings.mask, true);
  ok(s.settings.models.length >= 1 && s.settings.consent && Array.isArray(s.settings.consent.items));
  ok(JSON.stringify(s).indexOf('AIza-secret-key') < 0, '키가 창으로 나감');
});
t('활동 만들기 — 관찰 메모 한 칸(예시 시트 없음) · 같은 영역에 여러 개', () => {
  const B = setup();
  B.deskMakeHomeroomSheets();
  const a = B.deskAddActivity({ name: '학급 자치', recordKey: '자율', kind: 'quick' });
  eq(a.key, '학급 자치');
  const b = B.deskAddActivity({ name: '진로 체험', recordKey: '진로', kind: 'quick', bytes: 600 });
  const acts = b.context.activities;
  eq(acts.filter(x => x.rec === '자율').map(x => x.name), ['자율활동', '학급 자치']);
  const mine = acts.filter(x => x.key === '진로 체험')[0];
  ok(mine.quick && mine.mode === 'homeroom' && mine.limit === 600, JSON.stringify(mine));
  eq(B.getActivity_('학급 자치').exSheet, '');
  eq(Object.keys(B.deskLoad({ mode: 'homeroom', cls: '1' }).data['학급 자치']).length, 2, '학생 줄이 채워짐');
});
t('활동 만들기 — 입력 항목을 정해서(예시 시트 있음) · 이름 없음 · 겹친 이름은 거절', () => {
  const B = setup();
  const r = B.deskAddActivity({ name: '실험 보고', recordKey: '과세특', subjectKey: '수학', kind: 'cols', columns: ['실험 주제', '결과 해석'], desc: '함수 단원 실험' });
  eq(r.context.activities.filter(x => x.key === r.key)[0].columns, ['실험 주제', '결과 해석']);
  ok(B.getActivity_(r.key).exSheet, '예시 시트');
  let m = ''; try { B.deskAddActivity({ name: ' ', recordKey: '과세특', kind: 'quick' }); } catch (e) { m = e.message; }
  ok(/이름/.test(m), m);
  m = ''; try { B.deskAddActivity({ name: '실험 보고', recordKey: '과세특', kind: 'quick' }); } catch (e) { m = e.message; }
  ok(/이미/.test(m), m);
  m = ''; try { B.deskAddActivity({ name: '새 활동', recordKey: '없는영역', kind: 'quick' }); } catch (e) { m = e.message; }
  ok(/기록 영역/.test(m), m);
});
t('활동 설정 읽기 · 저장 — 이름 · 개요 · 바이트 · 분량, 학생 자료는 그대로, 프롬프트에 개요가 들어감', () => {
  const B = setup();
  const d = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구'];
  B.deskSaveRows({ key: '탐구', rows: [{ id: '1-1', row: d['1-1'].row, inputs: ['가', '나'], final: '끝까지 탐구함.' }] });
  const info = B.deskActivityInfo('탐구');
  eq(info.columns, ['탐구 주제', '알게 된 점']); eq(info.amount, '보통');
  ok(info.hasExamples && info.prompt.length > 100 && info.tokens > 0);
  const res = B.deskSaveActivity({ key: '탐구', name: '자료 탐구', desc: '공공 자료로 추세를 읽는 활동', bytes: 900, amount: '넉넉히' });
  eq(res.info.name, '자료 탐구'); eq(res.info.bytes, 900); eq(res.info.amount, '넉넉히');
  ok(res.info.prompt.indexOf('공공 자료로 추세를 읽는 활동') >= 0, '개요가 프롬프트에 없음');
  eq(res.context.activities[0].name, '자료 탐구'); eq(res.context.activities[0].limit, 900);
  const r = B.deskLoad({ mode: 'subject', cls: '1' }).data['탐구']['1-1'];
  eq(r.inputs, ['가', '나']); eq(r.final, '끝까지 탐구함.');
  eq(B.deskSaveActivity({ key: '탐구', amount: '보통' }).info.amount, '보통');
  let m = ''; try { B.deskSaveActivity({ key: '탐구', amount: '아주많이' }); } catch (e) { m = e.message; }
  ok(/분량/.test(m), m);
  eq(B.deskSaveActivity({ key: '탐구', bytes: 99999 }).info.bytes, res.info.cap, '한 칸을 넘지 않음');
});
t('예시 고치기 — 저장한 예시가 프롬프트에 들어가고, 빈 줄은 빼고, 너무 많으면 거절', () => {
  const B = setup();
  const res = B.deskSaveActivity({ key: '탐구', examples: [
    { values: ['기후 자료', '추세선의 한계'], result: '기후 자료의 추세선을 그리고 한계를 짚어 냄.' },
    { values: ['', ''], result: '' }
  ] });
  eq(res.info.examples, [{ values: ['기후 자료', '추세선의 한계'], result: '기후 자료의 추세선을 그리고 한계를 짚어 냄.' }]);
  ok(res.info.prompt.indexOf('한계를 짚어 냄') >= 0, '예시가 프롬프트에 없음');
  eq(B.deskSaveActivity({ key: '탐구', examples: [] }).info.examples, []);
  const many = []; for (let i = 0; i < res.info.exampleMax + 1; i++) many.push({ values: ['a', 'b'], result: '결과 ' + i });
  let m = ''; try { B.deskSaveActivity({ key: '탐구', examples: many }); } catch (e) { m = e.message; }
  ok(/이하/.test(m), m);
  B.deskMakeHomeroomSheets();
  m = ''; try { B.deskSaveActivity({ key: '자율활동', examples: [{ values: ['a'], result: 'b' }] }); } catch (e) { m = e.message; }
  ok(/예시 시트가 없습니다/.test(m), m);
});
t('활동 지우기 — 이름을 그대로 적어야 지움 · 시트와 목록 줄이 함께 사라짐', () => {
  const B = setup();
  let m = ''; try { B.deskDeleteActivity({ key: '탐구', confirm: '탐구' }); } catch (e) { m = e.message; }
  ok(/그대로 적어/.test(m), m);
  ok(B.getActivity_('탐구'), '지워지면 안 됨');
  const res = B.deskDeleteActivity({ key: '탐구', confirm: '데이터 탐구' });
  eq(res.context.activities, []);
  ok(!B.getActivity_('탐구') && !B.__g.__ss.getSheetByName('탐구 ▸입력') && !B.__g.__ss.getSheetByName('탐구 ▸예시'));
});
t('공통 프롬프트 — 읽기 · 바뀐 줄만 저장 · 없는 키는 건너뜀 · 다음 프롬프트에 반영', () => {
  const B = setup();
  const rows = B.deskCommon();
  ok(rows.length >= 3 && rows.every(r => r.key && typeof r.text === 'string'));
  const first = rows.filter(r => r.text)[0];
  const res = B.deskSaveCommon([{ key: first.key, text: first.text + '\n표식문장-가나다' }, { key: rows[1].key, text: rows[1].text }, { key: '없는키', text: 'x' }]);
  eq(res.saved, first.key === rows[1].key ? 1 : 1);
  ok(B.getCommon_()[first.key].indexOf('표식문장-가나다') >= 0);
  eq(B.deskSaveCommon([{ key: first.key, text: first.text + '\n표식문장-가나다' }]).saved, 0);
});
t('설정 저장 — 준 것만 바뀜 · 묶음 수는 1~10 · 쓸 수 없는 모델은 거절', () => {
  const B = setup();
  const before = B.deskSetup().settings;
  const res = B.deskSaveSettings({ batch: 30, mask: false, ground: true, years: 7 });
  const s = res.setup.settings;
  eq([s.batch, s.mask, s.ground, s.years], [10, false, true, 7]);
  eq([s.autoRepair, s.thinkingLow, s.model], [before.autoRepair, before.thinkingLow, before.model]);
  ok(res.context.activities.length === 1);
  let m = ''; try { B.deskSaveSettings({ model: 'gpt-없는-모델' }); } catch (e) { m = e.message; }
  ok(/쓸 수 없는 모델/.test(m), m);
  const last = s.models[s.models.length - 1];
  eq(B.deskSaveSettings({ model: last }).setup.settings.model, last);
  ok(B.deskContext().manualOnly, '키 없이로 바꾸면 창 안 복사 · 붙여넣기');
});
t('창에서 명단 저장 — 반 목록이 바로 바뀌고 활동 시트에 학생 줄이 생김', () => {
  const B = setup();
  const res = B.deskRosterSave({ text: '3 1 하나\n3 2 두리\n3 3 세찌', mode: 'class' });
  eq(res.count, 3); eq(res.context.classes, ['3']);
  eq(Object.keys(B.deskLoad({ mode: 'subject', cls: '3' }).data['탐구']).length, 3);
  ok(B.deskSyncRoster().sheets >= 1);
});

console.log('\n[취합 · 압축 · 점검]');
/** 과세특 활동 둘 + 1반 1번 · 2번의 최종본 */
function setupSum() {
  const B = setup();
  B.createActivity_({ key: '발표', name: '주제 발표', recordKey: '과세특', subjectKey: '수학', columns: '발표 주제', examples: [] });
  const put = (sheet, row, text) => { const s = B.__g.__ss.getSheetByName(sheet); s.getRange(row, B.colOf_(s, B.APP.HEAD_ROW, '최종본')).setValue(text); };
  put('탐구 ▸입력', 4, '기후 자료의 추세선을 그리고 한계를 짚어 냄.');
  put('발표 ▸입력', 4, '확률 단원의 오개념을 사례로 발표함.');
  put('탐구 ▸입력', 5, '인구 자료를 표로 정리하고 변화의 까닭을 설명함.');
  B.__put = put;
  return B;
}
t('취합 보기 — 영역마다 활동 글을 모으고, 한도 안이면 최종본에 넣음', () => {
  const B = setupSum();
  const res = B.deskCompile({});
  eq(res.areas.map(a => a.rec), ['과세특']);
  const a = res.areas[0];
  eq(a.mode, 'subject'); eq(a.acts, ['데이터 탐구', '주제 발표']); eq(a.rows.length, 4);
  const r = a.rows.find(x => x.id === '1-1');
  eq(r.parts, ['기후 자료의 추세선을 그리고 한계를 짚어 냄.', '확률 단원의 오개념을 사례로 발표함.']);
  eq(r.merged, r.parts.join(' ')); eq(r.final, r.merged);
  eq(a.rows.find(x => x.id === '2-2').final, '');
  eq(res.manualOnly, true);
});
t('최종본 저장 — 검증을 새로 쓰고, 다시 모아도 고친 글이 남음 · 없는 학생은 알려 줌', () => {
  const B = setupSum();
  const a = B.deskCompile({}).areas[0], r = a.rows.find(x => x.id === '1-1');
  const res = B.deskCompileSave({ rec: '과세특', rows: [{ id: '1-1', row: 999, final: '추세선의 한계를 짚고 오개념 사례를 발표함.' }, { id: '9-9', row: 4, final: 'x' }] });
  eq(res.missing, ['9-9']); eq(res.rows.length, 1); eq(res.rows[0].row, r.row);
  ok(res.rows[0].check, '검증이 비어 있음');
  B.__put('탐구 ▸입력', 4, '기후 자료를 다시 정리함.');
  const again = B.deskCompile({ refresh: true }).areas[0].rows.find(x => x.id === '1-1');
  eq(again.final, '추세선의 한계를 짚고 오개념 사례를 발표함.');
  ok(/다시 정리함/.test(again.merged), again.merged);
});
t('압축 — 합본 글만 보내고(이름 없음), 한도를 넘던 학생의 최종본에 넣음 · 다듬은 글은 덮지 않음', () => {
  const B = setupSum();
  B.__put('탐구 ▸입력', 4, '가'.repeat(520) + '함.');
  const a = B.deskCompile({ refresh: true }).areas[0];
  const r1 = a.rows.find(x => x.id === '1-1'), r2 = a.rows.find(x => x.id === '1-2');
  eq(r1.final, '', '한도를 넘으면 최종본은 비워 둠');
  B.deskCompileSave({ rec: '과세특', rows: [{ id: '1-2', row: r2.row, final: '선생님이 다듬은 글임.' }] });
  B.setKey_('gemini', 'AIza-x');
  const sent = [];
  B.__g.__fetch.handler = (url, opt) => { sent.push(String(opt.payload)); return gemOk('추세선을 그리고 오개념 사례를 발표함.'); };
  const res = B.deskCompress({ rec: '과세특', rows: [{ id: '1-1', row: r1.row }, { id: '1-2', row: r2.row }, { id: '2-2', row: 7 }] });
  eq(res.done, { ok: 2, err: 0, left: 0 }); eq(res.empty, 1); eq(sent.length, 2);
  ok(!/가나다|라마바/.test(sent.join('')), '요청에 이름');
  const o1 = res.rows.find(x => x.id === '1-1'), o2 = res.rows.find(x => x.id === '1-2');
  eq(o1.final, '추세선을 그리고 오개념 사례를 발표함.'); ok(o1.adopted);
  eq(o2.final, '선생님이 다듬은 글임.'); eq(o2.ai, '추세선을 그리고 오개념 사례를 발표함.');
  eq(B.deskCompile({}).areas[0].rows.find(x => x.id === '1-1').final, o1.final);
});
t('압축 — 키가 없으면 복사 · 붙여넣기 요청문, 답을 넣고 다시 읽으면 최종본에 들어감', () => {
  const B = setupSum();
  const r = B.deskCompile({}).areas[0].rows.find(x => x.id === '1-1');
  const res = B.deskCompress({ rec: '과세특', rows: [{ id: '1-1', row: r.row }] });
  ok(res.manual && res.manual.chunks.length === 1, JSON.stringify(Object.keys(res)));
  const c = res.manual.chunks[0];
  ok(!/가나다/.test(res.manual.system + c.user + c.labels.join()), '요청문 · 표시에 이름');
  B.manualApply({ sheet: res.manual.sheet, target: res.manual.target, check: res.manual.check, limit: res.manual.limit,
                  rows: c.rows, ids: c.ids, labels: c.labels, answer: '[S1] 추세선의 한계와 오개념 사례를 함께 다룸.' });
  const back = B.deskCompileRows({ rec: '과세특', rows: c.rows, adopt: true });
  eq(back[0].final, '추세선의 한계와 오개념 사례를 함께 다룸.');
});
t('압축 — 동의 전이면 아무것도 보내지 않음', () => {
  const B = setupSum();
  B.deskCompile({});
  B.__g.__userProps.deleteProperty('CONSENT');
  B.setKey_('gemini', 'AIza-x');
  let calls = 0; B.__g.__fetch.handler = () => { calls++; return gemOk(); };
  eq(B.deskCompress({ rec: '과세특', rows: [{ id: '1-1', row: 4 }] }), { consent: false });
  eq(calls, 0);
});
t('학생 간 점검 — 같은 문장 · 빈 학생을 알려 주고, 반을 정하면 그 반만', () => {
  const B = setupSum();
  B.__put('탐구 ▸입력', 5, '기후 자료의 추세선을 그리고 한계를 짚어 냄.');
  B.__put('발표 ▸입력', 5, '확률 단원의 오개념을 사례로 발표함.');
  B.deskCompile({ refresh: true });
  const all = B.deskEquity({ rec: '과세특' });
  eq(all.n, 4); eq(all.filled, 2); eq(all.similar.length, 1); eq(all.similar[0].ratio, 1); eq(all.empty.length, 2);
  const one = B.deskEquity({ rec: '과세특', cls: '1' });
  eq(one.n, 2); eq(one.empty, []);
  const act = B.deskEquity({ key: '탐구', cls: '2' });
  eq(act.n, 2); eq(act.filled, 0);
});
t('취합 글 검사는 기록 영역 한도로 · 활동이 없는 영역은 보이지 않음', () => {
  const B = setupSum();
  B.deskCompile({});
  eq(B.deskInspect({ rec: '과세특', text: '추세선을 그림.' }).limit, B.deskCompile({}).areas[0].limit);
  B.deskDeleteActivity({ key: '탐구', confirm: '데이터 탐구' });
  B.deskDeleteActivity({ key: '발표', confirm: '주제 발표' });
  eq(B.deskCompile({}).areas, []);
});

console.log('\n[AI 로 쓰기]');
t('키가 있으면 바로 쓰고 바뀐 줄을 돌려줌 · 자료가 빈 학생은 건너뜀', () => {
  const B = setup();
  const s = B.__g.__ss.getSheetByName('탐구 ▸입력');
  s.getRange(4, 5, 1, 2).setValues([['기후 자료', '추세선의 한계']]);
  B.setKey_('gemini', 'AIza-x');
  B.__g.__fetch.handler = () => gemOk('기후 자료의 추세선을 해석하며 한계를 짚어 냄.');
  const res = B.deskGenerate({ key: '탐구', ids: ['1-1', '1-2'], rows: [4, 5] });
  eq(res.empty, 1);
  eq(res.rows.length, 1);
  ok(/추세선/.test(res.rows[0].ai), JSON.stringify(res.rows[0]));
});
t('키가 없으면 복사 · 붙여넣기 요청문을 돌려주고, 답을 넣으면 그 줄이 바뀜', () => {
  const B = setup();
  const s = B.__g.__ss.getSheetByName('탐구 ▸입력');
  s.getRange(4, 5, 1, 2).setValues([['기후 자료', '추세선의 한계']]);
  const res = B.deskGenerate({ key: '탐구', ids: ['1-1'], rows: [4] });
  ok(res.manual && res.manual.chunks.length === 1, JSON.stringify(Object.keys(res)));
  const c = res.manual.chunks[0];
  ok(!/가나다/.test(res.manual.system + c.user), '요청문에 이름');
  B.manualApply({ sheet: res.manual.sheet, target: res.manual.target, check: res.manual.check, limit: res.manual.limit,
                  rows: c.rows, ids: c.ids, labels: c.labels, answer: '[S1] 기후 자료를 정리하며 추세선의 한계를 짚어 냄.' });
  ok(/추세선/.test(B.deskRows({ key: '탐구', rows: c.rows })[0].ai));
});
t('동의 전이면 아무것도 보내지 않음', () => {
  const B = setup();
  B.__g.__userProps.deleteProperty('CONSENT');
  B.setKey_('gemini', 'AIza-x');
  let calls = 0; B.__g.__fetch.handler = () => { calls++; return gemOk(); };
  eq(B.deskGenerate({ key: '탐구', ids: ['1-1'], rows: [4] }), { consent: false });
  eq(calls, 0);
});

console.log('\n[창 · 메뉴]');
t('창 크기 — 처음 1240×700, 화면에 맞춘 크기를 기억(너무 작거나 크면 자름)', () => {
  const B = boot();
  eq(B.deskSize_(), { w: 1240, h: 700 });
  B.deskOpenSized(1500, 820);
  eq(B.deskSize_(), { w: 1500, h: 820 });
  B.deskOpenSized(300, 5000);
  eq(B.deskSize_(), { w: 900, h: 1100 });
});
t('메뉴 맨 위에 🖥️ 작성실 (8개 넘지 않음) · 작업판 버튼 · 시작하기 버튼', () => {
  const src = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  ok(/m\.addItem\('🖥️ 작성실[^']*', 'openDesk'\)/.test(src));
  ok((src.match(/^\s*m\.addItem\(/gm) || []).length <= 8);
  ok(/'openFormDialog'/.test(src), '설문지 메뉴가 사라짐');
  const B = boot();
  eq(B.HOME_ACTIONS.desk, 'openDesk');
  ok(/deskOpenSized/.test(fs.readFileSync(path.join(dir, 'UI_Home.html'), 'utf8')));
});
t('작성실 창: charset · [hidden] · 부르는 서버 함수가 모두 있음', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Desk.html'), 'utf8');
  ok(/<meta charset="utf-8">/.test(ui) && /\[hidden\]\s*\{\s*display:none !important/.test(ui));
  const B = boot();
  const fns = new Set();
  (ui.match(/\.(desk\w+|manualApply|homeRun)\(/g) || []).forEach(m => fns.add(m.slice(1, -1)));
  (ui.match(/run\('(\w+)'/g) || []).forEach(m => fns.add(m.slice(5, -1)));
  ok(fns.size >= 8, [...fns].join());
  fns.forEach(f => ok(typeof B[f] === 'function', f + ' 없음'));
  fns.forEach(f => ok(!/_$/.test(f), f + ' — 창에서 부르는 함수 이름 끝에 _ 금지'));
});

console.log('\n[길잡이 줄 — 어디까지 했는지]');
t('설치 전 · 설치만 · 명단 · 활동 · 최종본 수', () => {
  const g0 = makeGlobals();
  const raw = vm.createContext(Object.assign({ module: { exports: {} } }, g0));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), raw, { filename: f }));
  const before = raw.deskGuide();
  ok(before.installed === false && before.students === 0 && before.acts === 0, '설치 전: ' + JSON.stringify(before));
  const B = boot();
  let g = B.deskGuide();
  ok(g.installed && g.students === 0 && g.slots === 0, '설치만: ' + JSON.stringify(g));
  const S = setup();
  g = S.deskGuide();
  eq([g.students, g.acts, g.slots, g.written, g.compiled], [4, 1, 4, 0, 0]);
  const res = S.deskLoad({ mode: 'subject', cls: '' });
  const key = S.deskContext().activities[0].key;
  const st = res.students[0], row = res.data[key][st.id];
  S.deskSave({ key: key, row: row.row, id: row.id, inputs: row.inputs, final: '자료를 정리하여 발표함.' });
  g = S.deskGuide();
  eq([g.slots, g.written], [4, 1], '최종본이 있는 칸 / 전체 칸');
  eq(S.deskContext().guide.written, 1, '창을 열 때 받는 값에도 들어 있음');
  ok(!/가나다|라마바|발표함/.test(JSON.stringify(g)), '이름 · 글은 담지 않음');
});
t('동의 · 키 상태 · 취합 시트 수', () => {
  const S = setup();
  let g = S.deskGuide();
  ok(g.consent === true && g.api === false, JSON.stringify(g));
  S.__g.__userProps.deleteProperty('CONSENT');
  ok(S.deskGuide().consent === false, '동의 전');
  S.setKey_('gemini', 'AIza-x');
  ok(S.deskGuide().api === true, '키를 넣은 뒤');
  S.deskCompile({});
  ok(S.deskGuide().compiled >= 1, '취합 보기를 열면 모음 시트가 생김');
});
t('창에 길잡이 줄 · 누르면 창 안에서 처리 · 동의 안내는 [⚙ 설정]으로', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Desk.html'), 'utf8');
  ok(/id="guide"/.test(ui) && /function drawGuide\(/.test(ui) && /function guideGo\(/.test(ui) && /\.deskGuide\(\)/.test(ui));
  ok(/data-guide=/.test(ui) && /setCover\('roster'\)/.test(ui) && /run\('onboardInstall'/.test(ui));
  ok(!/메뉴 ①②③ > \[개인정보/.test(ui), '창 안에서 메뉴로 보내는 동의 안내가 남아 있음');
});

console.log('\n[처음 화면 · 체험 예시]');
t('체험 예시 넣기 → 길잡이에 표시 → 지우기 (창 안에서)', () => {
  const B = boot();
  let g = B.deskGuide();
  ok(g.demo.canFill === true && g.demo.filled === false, JSON.stringify(g.demo));
  const ctx = B.deskDemo();
  ok(ctx.demoKey && ctx.activities.some(a => a.key === ctx.demoKey), '체험 활동이 창의 활동 목록에');
  ok(ctx.guide.students === 3 && ctx.guide.acts === 1 && ctx.guide.demo.filled === true && ctx.guide.demo.canFill === false, JSON.stringify(ctx.guide));
  const back = B.deskDemoClear();
  ok(back.activities.length === 0 && back.guide.students === 0 && back.guide.demo.filled === false && back.guide.demo.canFill === true, '지우면 처음으로');
});
t('실제 학생이 있으면 체험 예시를 넣지 않음', () => {
  const S = setup();
  ok(S.deskGuide().demo.canFill === false);
  let msg = '';
  try { S.deskDemo(); } catch (e) { msg = e.message; }
  ok(/체험 예시를 넣지 않았습니다/.test(msg), msg);
  eq(S.deskGuide().students, 4, '명단은 그대로');
});
t('창의 처음 화면 — 설치 · 명단 · 활동 · 체험 단추, 메뉴 맨 위는 네 가지', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Desk.html'), 'utf8');
  ok(/이렇게 시작하세요/.test(ui) && /id="bDemo"/.test(ui) && /id="bDemoClear"/.test(ui) && /data-guide="install"/.test(ui));
  ok(/run\('deskDemo'/.test(ui) && /run\('deskDemoClear'/.test(ui));
  const src = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  const body = src.slice(src.indexOf('function onOpen('), src.indexOf('m.addToUi();'));
  eq((body.match(/^\s*m\.addItem\(/gm) || []).length, 4, '맨 위 항목 수');
  ok(/\[🖥️ 작성실\] 을 누르면/.test(src), '처음 열 때 작성실을 알려 줌');
  ['generateChecked', 'buildCompile', 'openQuickSheetDialog', 'openHome', 'syncFormResponses', 'showVersion', 'repairExampleSheet'].forEach(f => ok(body.includes("'" + f + "'"), f + ' 가 메뉴에서 사라짐'));
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
