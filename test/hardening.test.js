/* 검토에서 나온 위험을 막는 시험 (node test/hardening.test.js)
   키 노출 · 설문지 동시 제출 · 6분 한도 · 응답 잘림 · 원격 신뢰 · 고쳐쓰기 묶음 · Claude 사진 한도 · 판 번호 표기 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');
const M = require('../apps-script/12_Models.gs');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
function boot() {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ' — ' : '') + '기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a)); };
const gemOk = (text, finish) => ({ code: 200, body: { candidates: [{ finishReason: finish || 'STOP', content: { parts: [{ text: text || '확인' }] } }] } });
const KEY = 'AIzaSyD-REALLOOKINGKEY_1234567890abcde';

function genSetup(D, n) {
  D.installCore_();
  D.onboardSaveRoster(Array.from({ length: n }, (_, i) => '1\t' + (i + 1) + '\t학생' + (i + 1)).join('\n'));
  const made = D.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통', columns: '탐구 주제', desc: '', examples: [] });
  const s = D.__ss.getSheetByName(made.inSheet);
  const c = name => D.colOf_(s, 3, name);
  s.getRange(4, 5, n, 1).setValues(Array.from({ length: n }, (_, i) => ['주제' + (i + 1)]));
  s.getRange(4, c('생성'), n, 1).setValues(Array.from({ length: n }, () => [true]));
  D.__ss.setActiveSheet(s);
  D.setKey_('gemini', KEY);
  return { s, c, act: D.getActivities_().filter(a => a.key === '탐구')[0] };
}
const batchBody = (ids, text) => JSON.stringify({ results: ids.map(id => ({ id, text: typeof text === 'function' ? text(id) : text })) });

/* ------------------------------------------------------------ 키 노출 */
console.log('\n[API 키가 시트 · 오류 문구에 남지 않게]');
t('redactSecrets — 주소의 key= · Bearer · 회사별 키 모양을 가림', () => {
  const s = M.redactSecrets('Exception: Timeout: https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=' + KEY +
    ' Bearer sk-proj-abcdefghijklmnop sk-ant-api03-ZZZZZZZZZZZZZZZZ ' + KEY);
  ok(s.indexOf(KEY) < 0 && s.indexOf('REALLOOKING') < 0, s);
  ok(!/sk-(proj|ant)-[a-z0-9]{6}/i.test(s), s);
  ok(/key=\*\*\*/.test(s) && /Bearer \*\*\*/.test(s), s);
  eq(M.redactSecrets('보통 문장 key 라는 낱말'), '보통 문장 key 라는 낱말');
});
t('Gemini 키는 주소가 아니라 x-goog-api-key 머리글로 감', () => {
  const D = boot(); D.installCore_(); D.setKey_('gemini', KEY);
  const seen = [];
  D.__fetch.handler = (url, opt) => { seen.push({ url, h: opt.headers || {} }); return url.indexOf('/models?') > 0 ? { code: 200, body: { models: [] } } : gemOk(); };
  D.testModel({ model: 'gemini-flash-latest' });
  D.listAvailableModels();
  eq(seen.length, 2);
  seen.forEach(x => { ok(x.url.indexOf(KEY) < 0 && !/[?&]key=/.test(x.url), x.url); eq(x.h['x-goog-api-key'], KEY); });
});
t('시간 초과 오류 문구에 주소가 찍혀도 [AI 결과] 칸에는 키가 없음', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1);
  D.setCfg_('한 번에 묶을 학생 수', 1);
  D.__fetch.handler = (url) => { throw new Error('Timeout: ' + url + '?key=' + KEY); };
  D.generateChecked();
  const v = String(s.getRange(4, c('AI 결과')).getValue());
  ok(/^⚠ 실패/.test(v), v);
  ok(v.indexOf(KEY) < 0 && v.indexOf('REALLOOKING') < 0, '키가 칸에 남음: ' + v);
});

/* ------------------------------------------------------------ 설문지 동시 제출 */
console.log('\n[설문지 — 동시 제출 · 트리거]');
t('다른 생성이 잠금을 쥐고 있으면 그 줄은 [생성] 체크 + [검증] ⏳ 생성 대기', () => {
  const D = boot();
  const { s, c, act } = genSetup(D, 2);
  s.getRange(4, c('생성'), 2, 1).setValues([[false], [false]]);
  D.LockService.getDocumentLock = () => ({ tryLock: () => false, releaseLock() {} });
  let calls = 0; D.__fetch.handler = () => { calls++; return gemOk(); };
  const r = D.runGeneration_(act, s, [4, 5], { quiet: true, lockWaitMs: 10 });
  ok(r && r.busy, '잠금 실패를 알리지 않음');
  eq(calls, 0, 'AI 호출');
  [4, 5].forEach(row => {
    eq(s.getRange(row, c('생성')).getValue(), true, row + '행 체크');
    ok(/⏳ 생성 대기/.test(s.getRange(row, c('검증')).getValue()), s.getRange(row, c('검증')).getValue());
  });
});
t('트리거(quiet)에서는 알림창을 띄우지 않음 — 한도를 넘는 줄도 대기로', () => {
  const D = boot();
  const { s, c, act } = genSetup(D, 3);
  D.setCfg_('1회 최대 생성 건수', 2); D.setCfg_('한 번에 묶을 학생 수', 1); D.setCfg_('자동 고쳐쓰기', false);
  D.SpreadsheetApp.getUi = () => { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); };
  D.__fetch.handler = () => gemOk('탐구 주제를 정하고 자료를 모아 정리함.');
  D.runGeneration_(act, s, [4, 5, 6], { quiet: true });
  ok(/탐구 주제/.test(s.getRange(4, c('AI 결과')).getValue()));
  ok(/⏳ 생성 대기/.test(s.getRange(6, c('검증')).getValue()), s.getRange(6, c('검증')).getValue());
  eq(s.getRange(6, c('생성')).getValue(), true);
});
t('설문지 제출 트리거: 옮겨 적기 잠금을 못 잡으면 아무것도 건드리지 않고 조용히 끝남', () => {
  const D = boot(); D.installCore_();
  D.__docProps.setProperty('FORM_LINKS', JSON.stringify([{ auto: true, sheet: '설문지 응답 시트1' }]));
  D.LockService.getDocumentLock = () => ({ tryLock: () => false, releaseLock() {} });
  let pushed = 0; D.pushFormLink_ = () => { pushed++; return { rows: [] }; };
  D.onFormSubmitInstalled({});
  eq(pushed, 0);
});
t('설문지 제출 트리거: 옮겨 적은 뒤 잠금을 풀고 생성(quiet · 기다림 · 시작 시각 전달)', () => {
  const D = boot(); D.installCore_();
  const order = [];
  D.__docProps.setProperty('FORM_LINKS', JSON.stringify([{ auto: true, autoGen: true, act: '탐구', sheet: '' }]));
  D.LockService.getDocumentLock = () => ({ tryLock: () => { order.push('lock'); return true; }, releaseLock() { order.push('unlock'); } });
  D.setKey_('gemini', KEY);
  D.pushFormLink_ = () => { order.push('push'); return { rows: [4] }; };
  D.getActivity_ = () => ({ inSheet: '🚀 시작하기' });
  let got = null;
  D.runGeneration_ = (a, sh, rows, opt) => { order.push('gen'); got = opt; };
  D.onFormSubmitInstalled({});
  eq(order.join(','), 'lock,push,unlock,gen');
  ok(got.quiet && got.lockWaitMs >= 60000 && got.startedAt > 0, JSON.stringify(got));
});

/* ------------------------------------------------------------ 6분 한도 · 응답 잘림 */
console.log('\n[실행 시간 · 응답 잘림]');
t('남은 시간이 호출 하나에 모자라면 새 호출을 시작하지 않음(고쳐쓰기 · 근거 확인 포함)', () => {
  const D = boot();
  const { s, c } = genSetup(D, 2);
  D.setCfg_('한 번에 묶을 학생 수', 2);
  let calls = 0;
  D.__fetch.handler = () => { calls++; vm.runInContext('CALL_RESERVE_MS = 10000000;', D); return gemOk(batchBody(['S1', 'S2'], '학생은 교내 대회에서 최우수상을 수상함.')); };
  D.generateChecked();
  eq(calls, 1, '묶음 생성 뒤 고쳐쓰기를 부름');
  ok(/수상/.test(s.getRange(4, c('AI 결과')).getValue()), '초안은 그대로 들어가야 함');
  ok(/\[수정\]|수상/.test(s.getRange(4, c('검증')).getValue()), s.getRange(4, c('검증')).getValue());
});
t('재시도 대기는 실행 마감(__deadline)을 넘기지 않음', () => {
  const D = boot(); D.installCore_(); D.setKey_('gemini', KEY);
  let calls = 0;
  D.__fetch.handler = () => { calls++; return { code: 503, body: 'overloaded' }; };
  vm.runInContext('__deadline = Date.now() + 1000;', D);
  let err = null; try { D.callAI_('s', 'u', 'gemini-flash-latest'); } catch (e) { err = e; }
  ok(err && err.kind === 'server', String(err && err.message));
  eq(calls, 1, '마감이 가까운데 기다렸다 다시 부름');
  vm.runInContext('__deadline = 0;', D);
});
t('Gemini MAX_TOKENS · OpenAI length · Claude max_tokens → 잘림 오류', () => {
  const D = boot(); D.installCore_();
  D.setKey_('gemini', KEY); D.setKey_('openai', 'sk-x'); D.setKey_('anthropic', 'sk-ant-x');
  D.__fetch.handler = (url) => /openai/.test(url) ? { code: 200, body: { choices: [{ finish_reason: 'length', message: { content: '{"res' } }] } }
    : /anthropic/.test(url) ? { code: 200, body: { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"res' }] } }
    : gemOk('{"res', 'MAX_TOKENS');
  ['gemini-flash-latest', 'gpt-5.6-luna', 'claude-haiku-4-5'].forEach(m => {
    let e = null; try { D.callAI_('s', 'u', m); } catch (x) { e = x; }
    ok(e && e.kind === 'truncated', m + ': ' + (e && e.message));
  });
});
t('묶음 답이 잘리면 반씩 나눠 다시 — 한 명씩 다시 부르지 않음', () => {
  const D = boot();
  const { s, c } = genSetup(D, 4);
  D.setCfg_('한 번에 묶을 학생 수', 4); D.setCfg_('자동 고쳐쓰기', false);
  const sizes = [];
  D.__fetch.handler = (url, opt) => {
    const u = JSON.parse(opt.payload).contents[0].parts[0].text;
    const ids = (u.match(/^## S\d+/gm) || []).map(x => x.slice(3));
    sizes.push(ids.length);
    if (ids.length > 2) return gemOk('{"results":[{"id":"S1","text":"잘', 'MAX_TOKENS');
    return gemOk(batchBody(ids, id => '탐구 내용을 정리하고 발표함 ' + id + '.'));
  };
  D.generateChecked();
  eq(sizes.join(','), '4,2,2', '호출 모양');
  for (let r = 4; r <= 7; r++) ok(/탐구 내용을 정리/.test(s.getRange(r, c('AI 결과')).getValue()), r + '행: ' + s.getRange(r, c('AI 결과')).getValue());
});

/* ------------------------------------------------------------ 고쳐쓰기 묶음 */
console.log('\n[자동 고쳐쓰기 — 묶어서 한 번에]');
t('buildBatchRepairUser — 학생마다 자료 · 초안 · 걸린 점, JSON 형식 안내', () => {
  const D = boot();
  const u = D.buildBatchRepairUser([
    { id: 'S1', block: '탐구 주제: 함수', draft: '최우수상을 수상함.', issues: [{ level: 'block', label: '수상', hit: '최우수상', why: '수상 기재 금지' }] },
    { id: 'S2', block: '탐구 주제: 통계', draft: '아주 긴 글', issues: [{ level: 'block', label: '분량 초과', hit: '1600바이트' }] }], 1500);
  ok(/## S1[\s\S]*최우수상[\s\S]*## S2[\s\S]*1500바이트 이내/.test(u), u);
  ok(/"results"/.test(u) && /"id":"S2"/.test(u), u);
});
t('[수정]이 나온 학생이 여럿이면 고쳐쓰기는 한 번의 호출로', () => {
  const D = boot();
  const { s, c } = genSetup(D, 3);
  D.setCfg_('한 번에 묶을 학생 수', 3);
  const kinds = [];
  D.__fetch.handler = (url, opt) => {
    const u = JSON.parse(opt.payload).contents[0].parts[0].text;
    const ids = (u.match(/^## S\d+/gm) || []).map(x => x.slice(3));
    if (/# 고쳐 쓸 학생/.test(u)) { kinds.push('repair' + ids.length); return gemOk(batchBody(ids, id => '탐구 과정을 꼼꼼히 정리하고 결과를 발표함 ' + id + '.')); }
    kinds.push('gen' + ids.length);
    return gemOk(batchBody(ids, '학생은 교내 대회에서 최우수상을 수상함.'));
  };
  D.generateChecked();
  eq(kinds.join(','), 'gen3,repair3');
  for (let r = 4; r <= 6; r++) {
    ok(/꼼꼼히 정리/.test(s.getRange(r, c('AI 결과')).getValue()), r + '행: ' + s.getRange(r, c('AI 결과')).getValue());
    ok(/자동 고쳐쓰기 1회/.test(s.getRange(r, c('검증')).getValue()));
  }
});
t('고쳐 쓴 글이 더 나쁘면 초안을 그대로 둠(묶음에서도)', () => {
  const D = boot();
  const { s, c } = genSetup(D, 2);
  D.setCfg_('한 번에 묶을 학생 수', 2);
  D.__fetch.handler = (url, opt) => {
    const u = JSON.parse(opt.payload).contents[0].parts[0].text;
    const ids = (u.match(/^## S\d+/gm) || []).map(x => x.slice(3));
    if (/# 고쳐 쓸 학생/.test(u)) return gemOk(batchBody(ids, '학생은 교내 대회에서 최우수상을 수상함. 교외 대회와 K-MOOC, 방과후학교에서 1등을 함.'));
    return gemOk(batchBody(ids, '학생은 교내 대회에서 최우수상을 수상함.'));
  };
  D.generateChecked();
  ok(/교내 대회에서 최우수상/.test(s.getRange(4, c('AI 결과')).getValue()));
  ok(!/자동 고쳐쓰기 1회/.test(s.getRange(4, c('검증')).getValue()));
});

/* ------------------------------------------------------------ 원격 신뢰 · 사진 한도 · 판 번호 */
console.log('\n[원격 신뢰 · Claude 사진 · 판 번호]');
t('Claude 에는 5MB 넘는 사진을 빼고 보냄(PDF는 그대로) — 뺀 까닭을 글에 적음', () => {
  const D = boot();
  const big = 'A'.repeat(Math.ceil(5.5 * 1024 * 1024 * 4 / 3));
  const parts = [{ mime: 'image/jpeg', b64: big, name: 'big.jpg' }, { mime: 'image/png', b64: 'AAAA', name: 'small.png' },
                 { mime: 'application/pdf', b64: big, name: 'r.pdf' }];
  const a = D.userContent_('anthropic', '자료', parts);
  eq(a.filter(x => x.type === 'image').length, 1); eq(a.filter(x => x.type === 'document').length, 1);
  ok(/big\.jpg — 5MB/.test(a[a.length - 1].text), a[a.length - 1].text);
  eq(D.userContent_('gemini', '자료', parts).length, 4, 'Gemini 는 그대로');
  eq(M.b64Bytes('QUJD'), 3); eq(M.b64Bytes('QUI='), 2);
});
t('withVersion — 글 속 판 번호만 바꿈', () => {
  const D = boot();
  eq(D.withVersion('세특 작성 도우미 v3.8.2', 'v3.0.0'), '세특 작성 도우미 v3.0.0');
  eq(D.withVersion('⚙️ 설정  —  v3.8.7', 'v3.0.1'), '⚙️ 설정  —  v3.0.1');
  eq(D.withVersion('판 번호 없음', 'v3.0.0'), '판 번호 없음');
});
t('시트를 열면 [🚀 시작하기] · [⚙️ 설정] 머리의 옛 판 번호를 지금 코드 번호로', () => {
  const D = boot(); D.installCore_();
  const st = D.__ss.getSheetByName('🚀 시작하기'), cf = D.__ss.getSheetByName('⚙️ 설정');
  st.getRange(1, 1).setValue('세특 작성 도우미 v3.8.2');
  cf.getRange(1, 1).setValue('⚙️ 설정  —  v3.8.7');
  D.onOpen();
  eq(st.getRange(1, 1).getValue(), '세특 작성 도우미 ' + D.APP.VERSION);
  eq(cf.getRange(1, 1).getValue(), '⚙️ 설정  —  ' + D.APP.VERSION);
  eq(D.refreshVersionLabels_(), 0, '두 번째는 고칠 것 없음');
});

console.log('\n[분량 맞추기 — 보통은 한도의 3분의 2]');
t('1500바이트 보통 = 메모가 짧아도 1000바이트 안팎, 넉넉히 1350, 메모만큼은 바닥 없음', () => {
  const D = boot();
  ok(/짧아도 1000바이트 안팎은 쓴다/.test(D.amountLines('보통', 1500).join('\n')), D.amountLines('보통', 1500).join(' / '));
  ok(/1350바이트 안팎/.test(D.amountLines('넉넉히', 1500).join('\n')));
  ok(!/1000바이트/.test(D.amountLines('메모만큼', 1500).join('\n')));
  ok(/짧아도 600바이트 안팎/.test(D.amountLines('보통', 900).join('\n')), '행발 900 → 600');
});

console.log(fail ? '\n실패 ' + fail + '개 / 통과 ' + pass + '개' : '\n통과 ' + pass + '개');
if (fail) process.exit(1);
