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

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
