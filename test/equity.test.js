/* ⚖️ 학생 간 같은 문장 · 분량 격차 점검 (node test/equity.test.js) */
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

const P = boot();
const A = '일차함수 단원 모둠 발표에서 그래프를 직접 그려 기울기를 1시간에 늘어나는 양으로 설명하고 친구의 질문에 예를 바꿔 다시 설명함. 발표 뒤 질문과 답을 모둠 기록지에 정리해 올림.';
const B = '이차방정식 단원에서 근의 공식을 직접 유도하는 활동을 하고 판별식의 부호에 따라 그래프가 축과 만나는 개수가 달라지는 까닭을 표로 정리해 모둠원에게 설명함.';
const C = '삼각비 단원 건물 높이 재기 활동에서 모둠마다 값이 다르게 나온 까닭을 따져 각도를 재는 눈높이가 달랐음을 찾고 기준을 맞춰 다시 재어 오차를 줄임.';

console.log('\n[겹침]');
t('같은 글은 100%, 전혀 다른 글은 0%, 앞부분만 같으면 그만큼', () => {
  eq(P.equitySimilarity(A, A), 1);
  eq(P.equitySimilarity(A, B), 0);
  const half = A.slice(0, 40) + ' 그리고 전혀 다른 내용을 길게 이어 붙여 본다 하나 둘 셋 넷 다섯 여섯 일곱';
  const r = P.equitySimilarity(A, half);
  ok(r > 0.15 && r < 0.9, String(r));
  eq(P.equitySimilarity('', A), 0);
});
t('이름 · 숫자만 바꾼 복사본도 걸림 (공백 · 문장부호는 무시)', () => {
  const copy = A.replace(/ /g, '  ').replace('1시간', '2시간');
  ok(P.equitySimilarity(A, copy) > 0.8);
});

console.log('\n[점검]');
t('같은 문장 쌍 · 분량 격차 · 빈 칸을 각각 알려 줌', () => {
  const items = [
    { label: '1번', text: A }, { label: '2번', text: A.replace('1시간', '2시간') }, { label: '3번', text: B }, { label: '4번', text: C },
    { label: '5번', text: '발표함.' }, { label: '6번', text: '' }, { label: '7번', text: C + ' ' + B + ' ' + A }
  ];
  const r = P.checkEquity(items);
  eq([r.n, r.filled], [7, 6]);
  ok(r.similar.some(p => p.a === '1번' && p.b === '2번' && p.ratio > 0.8), '복사본 쌍');
  ok(r.similar.some(p => p.a === '4번' && p.b === '7번') || r.similar.some(p => p.b === '4번' || p.a === '4번'), '긴 글이 짧은 글을 품은 경우도');
  eq(r.gaps.map(g => [g.label, g.kind]), [['5번', '짧음'], ['7번', '긺']]);
  eq(r.empty, ['6번']);
  const txt = P.equityReportText(r, '시트');
  ok(/1번 ↔ 2번/.test(txt) && /5번 — \d+바이트 \(짧음\)/.test(txt) && /\[최종본\]이 빈 학생 1명: 6번/.test(txt));
});
t('문제가 없으면 ✓ 한 줄, 학생이 3명 이하면 분량 격차는 보지 않음', () => {
  const r = P.checkEquity([{ label: '1번', text: A }, { label: '2번', text: B }, { label: '3번', text: C }]);
  eq([r.similar.length, r.gaps.length, r.empty.length], [0, 0, 0]);
  ok(/✓ 같은 문장/.test(P.equityReportText(r, '시트')));
  eq(P.checkEquity([{ label: '1번', text: A }, { label: '2번', text: '짧음' }, { label: '3번', text: C }]).gaps.length, 0);
});

console.log('\n[시트]');
t('최종취합 시트의 [최종본]을 읽어 비교 — 이름은 마스킹 설정에 따라', () => {
  const Bk = boot();
  Bk.rosterSave({ text: '1 1 가나다\n1 2 라마바\n1 3 사아자\n1 4 차카타', mode: 'class' });
  Bk.createActivity_({ key: '탐구', name: '탐구', recordKey: '과세특', subjectKey: '수학', columns: [Bk.QUICK_COLUMN], mode: '바로쓰기' });
  Bk.buildCompileCore_();
  const s = Bk.__ss.getSheetByName(Bk.compileSheetName_('과세특'));
  const cF = Bk.colOf_(s, Bk.APP.HEAD_ROW, '최종본');
  [A, A, B, ''].forEach((v, i) => s.getRange(Bk.APP.DATA_ROW + i, cF).setValue(v));
  Bk.__ss.setActiveSheet && Bk.__ss.setActiveSheet(s);
  const r = Bk.equityCheck(s.getName());
  eq(r.report.similar.length, 1); eq(r.report.empty.length, 1);
  ok(/1반 1번 ↔ 1반 2번/.test(r.text) && !/가나다/.test(r.text), '이름은 기본으로 가림: ' + r.text);
  ok(/학생 간 같은 문장/.test(fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8')));
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
