/* 🔒 개인정보 · 보안 안내와 동의 (node test/consent.test.js) */
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
  g.__userProps.deleteProperty('CONSENT');   // 모의 환경은 동의한 선생님으로 시작하므로 지운다
  return ctx;
}
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((m ? m + ' — ' : '') + '기대 ' + y + ' / 실제 ' + x); };

console.log('\n[동의 전]');
t('AI 호출(callAI_)은 동의 전이면 키가 있어도 보내지 않고 안내 문구로 멈춤', () => {
  const B = boot();
  B.__g.__userProps.setProperty('KEY_gemini', 'test-key-123');
  let msg = ''; try { B.callAI_('s', 'u', 'gemini-flash-latest'); } catch (e) { msg = e.message; }
  ok(/개인정보 · 보안 안내/.test(msg), msg);
});
t('생성(⑥ · 키 없이 둘 다)은 동의 창을 열고 아무것도 만들지 않음 · 설문지 자동 생성은 줄에 표시만', () => {
  const B = boot();
  const opened = [];
  B.openConsentDialog = () => opened.push(1);
  eq(B.runGeneration_({ key: 'x' }, null, [3]), { consent: false });
  eq(B.runGeneration_({ key: 'x' }, null, [3], { manual: true }), { consent: false });
  eq(opened.length, 2);
  const marked = []; B.markPending_ = (s, rows, why) => marked.push(why);
  eq(B.runGeneration_({ key: 'x' }, null, [3], { quiet: true }), { consent: false });
  ok(/동의한 뒤/.test(marked[0]));
});
t('시작하기 창 상태에 consentOk=false, 창 맨 위에 안내 카드', () => {
  const B = boot();
  eq(B.consentState().ok, false);
  const ui = fs.readFileSync(path.join(dir, 'UI_Onboard.html'), 'utf8');
  ok(/function drawConsent/.test(ui) && /openConsentDialog\(true\)/.test(ui) && /drawConsent\(\); drawUpdate\(\)/.test(ui));
  ok(/st\.consentOk = consentOk_\(\)/.test(fs.readFileSync(path.join(dir, '32_Onboard.gs'), 'utf8')));
});

console.log('\n[동의 · 철회]');
t('항목을 모두 체크해야 동의되고, 동의는 선생님 계정(UserProperties)에 판 번호와 함께', () => {
  const B = boot();
  const n = B.CONSENT_ITEMS.length;
  ok(n >= 6, '항목 ' + n + '개');
  let msg = ''; try { B.consentAgree({ checked: Array(n).fill(true).map((x, i) => i !== 2) }); } catch (e) { msg = e.message; }
  ok(/모두/.test(msg)); eq(B.consentOk_(), false);
  const s = B.consentAgree({ checked: Array(n).fill(true) });
  eq(s.ok, true);
  eq(JSON.parse(B.__g.__userProps.getProperty('CONSENT')).v, B.CONSENT_VERSION);
  eq(B.__g.__docProps.getProperty('CONSENT'), null, '파일(문서 속성)에는 남기지 않음');
});
t('안내 판이 바뀌면 다시 동의해야 함 · 철회하면 다시 막힘', () => {
  const B = boot();
  B.__g.__userProps.setProperty('CONSENT', JSON.stringify({ v: '2000.1', at: '2000-01-01' }));
  eq([B.consentOk_(), B.consentState().old], [false, true]);
  B.consentAgree({ checked: Array(B.CONSENT_ITEMS.length).fill(true) });
  eq(B.consentOk_(), true);
  B.consentWithdraw();
  eq(B.consentOk_(), false);
});
t('안내 글에 꼭 들어갈 것: 저장 위치 · 이름 빼고 보냄 · 민감 정보 · AI 회사 정책 · 기재요령(AI 글 그대로 금지) · 학교 지침', () => {
  const B = boot();
  const all = B.CONSENT_ITEMS.map(x => x.join(' ')).join(' ');
  ['스프레드시트', '이름', '주민등록번호', '약관', '기재요령', '정보보안 지침', '개발자'].forEach(w => ok(all.indexOf(w) >= 0, w));
});
t('메뉴 ①②③ 준비에 동의 창 · 창 스크립트에는 <?!= ?> 만', () => {
  ok(/🔒 개인정보 · 보안 안내와 동의.*openConsentDialog/.test(fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8')));
  const ui = fs.readFileSync(path.join(dir, 'UI_Consent.html'), 'utf8');
  ok(/consentAgree/.test(ui) && /consentWithdraw/.test(ui) && !/<\?= /.test(ui));
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
