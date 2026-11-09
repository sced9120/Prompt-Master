/* 🧭 작업판 · 간단히 보기 (node test/home.test.js) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
function boot(beforeInstall) {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  if (beforeInstall) beforeInstall(g);
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
const hidden = B => B.__g.__ss.getSheets().filter(s => s.isSheetHidden()).map(s => s.getName());
const visible = B => B.__g.__ss.getSheets().filter(s => !s.isSheetHidden()).map(s => s.getName());

function withActivity() {
  const B = boot();
  B.rosterSave({ text: '1 1 가나다\n1 2 라마바\n1 3 사아자', mode: 'class' });
  B.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '과세특', subjectKey: '수학', columns: '탐구 주제', examples: [] });
  B.applyView_(B.viewSimpleOn_());
  return B;
}

console.log('\n[간단히 보기]');
t('설치하면 처음부터 간단히 보기 — 설정 · 규칙 · 활동목록 · 사용법은 숨고, 시작하기 · 명단은 보임', () => {
  const B = boot();
  const h = hidden(B), v = visible(B);
  ['⚙️ 설정', '📏 기재요령', '🗂 활동목록', '📖 사용법', '🧩 기록종류', '📚 교과영역', '📐 공통규칙', '✒️ 내 문체'].forEach(n => ok(h.includes(n), n + ' 안 숨음'));
  ['🚀 시작하기', '👤 학생명단'].forEach(n => ok(v.includes(n), n + ' 숨음'));
});
t('활동 입력 시트 · 취합 시트는 보이고 ▸예시 시트는 숨음 · 선생님이 만든 시트(시트1)는 그대로', () => {
  const B = withActivity();
  const v = visible(B);
  ok(v.includes('탐구 ▸입력'), v.join());
  ok(!v.includes('탐구 ▸예시') || !B.__g.__ss.getSheetByName('탐구 ▸예시'), '예시 시트가 보임');
  ok(v.includes('시트1'), '선생님 시트를 숨김');
  B.buildCompileCore_();
  B.applyView_(true);
  ok(B.compileSheets_().every(s => !s.isSheetHidden()), '취합 시트가 숨음');
});
t('끄면 모두 보이고, 꺼 둔 설정은 [구조 복구]를 다시 해도 유지', () => {
  const B = boot();
  B.homeSetView(false);
  eq(hidden(B), []);
  eq(B.__g.__docProps.getProperty('VIEW_SIMPLE'), '0');
  B.installCore_();
  eq(hidden(B), [], '복구가 다시 숨김');
  B.homeSetView(true);
  ok(hidden(B).length >= 8);
});
t('예전부터 꺼 둔 사본은 설치해도 숨기지 않음', () => {
  const B = boot(g => g.__docProps.setProperty('VIEW_SIMPLE', '0'));
  eq(hidden(B), []);
});
t('메뉴로 숨긴 시트를 열면 다시 보임 (규칙 · 설정 · 내 문체 · 사용법)', () => {
  const B = boot();
  B.openRulesSheet();
  ok(!B.__g.__ss.getSheetByName('📏 기재요령').isSheetHidden());
  eq(B.__g.__ss.getActiveSheet().getName(), '📏 기재요령');
  B.openSettingsSheet(); ok(!B.__g.__ss.getSheetByName('⚙️ 설정').isSheetHidden());
  B.openStyleSheet(); ok(!B.__g.__ss.getSheetByName('✒️ 내 문체').isSheetHidden());
  B.openHelpSheet(); ok(!B.__g.__ss.getSheetByName('📖 사용법').isSheetHidden());
});
t('보고 있던 시트를 숨기면 시작하기로 옮김 · 시작하기가 숨어 있어도 먼저 보이게', () => {
  const B = boot();
  B.homeSetView(false);
  B.openSettingsSheet();
  B.__g.__ss.getSheetByName('🚀 시작하기').hideSheet();
  B.homeSetView(true);
  eq(B.__g.__ss.getActiveSheet().getName(), '🚀 시작하기');
  ok(!B.__g.__ss.getSheetByName('🚀 시작하기').isSheetHidden());
});
t('시트를 여는 코드는 모두 goSheet_ 를 거침 (시트 순서 정리 · 작업판만 예외)', () => {
  files.forEach(f => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const n = (src.match(/ss_\(\)\.setActiveSheet\(/g) || []).length;
    if (f === '30_Setup.gs') eq(n, 2, f);
    else if (f === '33_Home.gs') ok(n <= 2, f);
    else eq(n, 0, f + ' 에 setActiveSheet');
  });
});

console.log('\n[작업판]');
t('상태: 활동 이름 · 진행(최종본 수) · 명단 수 — 학생 이름은 들어가지 않음', () => {
  const B = withActivity();
  const s = B.__g.__ss.getSheetByName('탐구 ▸입력');
  const cFinal = B.colOf_(s, 3, '최종본');
  s.getRange(4, cFinal).setValue('탐구 주제를 정해 자료를 모음.');
  const st = B.homeState();
  eq(st.students, 3);
  eq(st.activities.length, 1);
  eq(st.activities[0].name, '데이터 탐구');
  eq([st.activities[0].done, st.activities[0].students], [1, 3]);
  ok(st.simple && st.installed);
  const json = JSON.stringify(st);
  ['가나다', '라마바', '사아자'].forEach(n => ok(!json.includes(n), '이름 ' + n + ' 이 상태에 들어감'));
});
t('활동 누르면 그 시트가 열림 · 활동 아닌 시트(설정)는 열지 않음', () => {
  const B = withActivity();
  const st = B.homeGoto('탐구 ▸입력');
  eq(st.active, '탐구 ▸입력');
  let msg = ''; try { B.homeGoto('⚙️ 설정'); } catch (e) { msg = e.message; }
  ok(/열 수 없는/.test(msg), msg);
});
t('버튼은 정해 둔 기능만 부름 · 모르는 이름은 거절 · 모든 이름이 실제 함수', () => {
  const B = withActivity();
  Object.keys(B.HOME_ACTIONS).forEach(k => ok(typeof B[B.HOME_ACTIONS[k]] === 'function', k + ' → ' + B.HOME_ACTIONS[k] + ' 없음'));
  let msg = ''; try { B.homeRun('installAll; deleteAll'); } catch (e) { msg = e.message; }
  ok(/알 수 없는/.test(msg), msg);
  let called = 0; B.openApiDialog = () => called++;
  B.homeRun('api');
  eq(called, 1);
  ok(B.homeRun('settings').hiddenNow < B.homeState().backstage + 1);
});
t('파일 열 때 저절로 열기 — 설치형 열기 트리거 하나만, 끄면 지움', () => {
  const B = boot();
  eq(B.homeSetAutoOpen(true).autoOpen, true);
  B.homeSetAutoOpen(true);
  eq(B.__g.__triggers.filter(x => x.fn === 'onOpenHome').length, 1, '겹침');
  eq(B.__g.__triggers.find(x => x.fn === 'onOpenHome').kind, 'open');
  eq(B.homeSetAutoOpen(false).autoOpen, false);
  eq(B.__g.__triggers.length, 0);
});
t('메뉴 맨 위에 🧭 작업판 · 도움말에 간단히 보기 / 모든 시트 보기', () => {
  const src = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  ok(/m\.addItem\('🧭 작업판[^']*', 'openHome'\)/.test(src));
  ok(/'viewSimple'/.test(src) && /'viewAll'/.test(src));
});
t('작업판 창: charset · [hidden] · 학생 칸을 다루는 버튼은 활동 시트에서만', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Home.html'), 'utf8');
  ok(/<meta charset="utf-8">/.test(ui) && /\[hidden\]\s*\{\s*display:none !important/.test(ui));
  ok(/data-run="generate" data-need-act/.test(ui) && /data-run="neis"/.test(ui));
  const runs = (ui.match(/data-run="(\w+)"/g) || []).map(x => x.slice(10, -1));
  const B = boot();
  runs.forEach(r => ok(B.HOME_ACTIONS[r], '창 버튼 ' + r + ' 이 HOME_ACTIONS 에 없음'));
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
