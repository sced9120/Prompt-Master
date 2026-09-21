/* 모델 직접 입력 · 연결 테스트 (node test/models.test.js)
   1) 이름 정리·회사 판별·오류 해석 같은 순수 로직
   2) 가짜 시트 + 가짜 인터넷 위에서 설정 → 시험 → 저장 → 생성까지 */
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
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => ok(a === b, (m || '') + ' 기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a));

/* ------------------------------------------------------------ 순수 로직 */
console.log('\n[모델명 정리]');
t('앞뒤 공백·따옴표 제거', () => eq(M.normModel('  "gemini-3.8-flash" '), 'gemini-3.8-flash'));
t('API 목록의 models/ 접두어 제거', () => eq(M.normModel('models/gemini-flash-latest'), 'gemini-flash-latest'));
t('복사할 때 딸려 온 보이지 않는 문자 제거', () => eq(M.normModel('gpt-5.6-luna​'), 'gpt-5.6-luna'));
t('빈 값', () => { eq(M.normModel(null), ''); eq(M.normModel(undefined), ''); });

console.log('\n[회사 판별]');
[['gemini-flash-latest', 'gemini'], ['Gemini-3.8-Flash', 'gemini'], ['gpt-5.6-luna', 'openai'],
 ['o4-mini', 'openai'], ['chatgpt-4o-latest', 'openai'], ['claude-haiku-4-5', 'anthropic'],
 ['claude-sonnet-5', 'anthropic'], ['mistral-large', ''], ['', '']]
  .forEach(([m, p]) => t(JSON.stringify(m) + ' → ' + (p || '모름'), () => eq(M.guessProvider(m), p)));
t('[회사] 칸 값 해석', () => {
  eq(M.companyToProvider('자동'), ''); eq(M.companyToProvider('Gemini'), 'gemini');
  eq(M.companyToProvider('OpenAI'), 'openai'); eq(M.companyToProvider('Claude'), 'anthropic');
  eq(M.companyToProvider('구글'), 'gemini');
});

console.log('\n[오류를 선생님 말로]');
const E = (code, body) => M.explainApiError(code, typeof body === 'string' ? body : JSON.stringify(body));
t('Gemini 모델 없음(404)', () => eq(E(404, { error: { message: 'models/gemini-9 is not found for API version v1beta' } }).kind, 'model'));
t('OpenAI 모델 없음', () => eq(E(404, { error: { code: 'model_not_found', message: 'The model `gpt-9` does not exist' } }).kind, 'model'));
t('Claude 모델 없음', () => eq(E(404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-9' } }).kind, 'model'));
t('Gemini 키 오류(400 API key not valid)', () => eq(E(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }).kind, 'key'));
t('OpenAI 키 오류(401)', () => eq(E(401, { error: { message: 'Incorrect API key provided' } }).kind, 'key'));
t('무료 등급에서 못 쓰는 모델(429 limit: 0)', () => {
  const r = E(429, { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro' } });
  eq(r.kind, 'free'); eq(r.retry, false);
});
t('일반 호출 한도(429)는 재시도', () => {
  const r = E(429, { error: { message: 'Quota exceeded for metric: ..., limit: 10' } });
  eq(r.kind, 'rate'); eq(r.retry, true);
});
t('OpenAI 잔액 없음(429 insufficient_quota)은 재시도 안 함', () => {
  const r = E(429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } });
  eq(r.kind, 'billing'); eq(r.retry, false);
});
t('Claude 잔액 없음', () => eq(E(400, { error: { message: 'Your credit balance is too low' } }).kind, 'billing'));
t('서버 과부하(529/503)는 재시도', () => { eq(E(529, 'overloaded').retry, true); eq(E(503, '').kind, 'server'); });
t('모든 해석에 안내 문장이 있음(기타 제외)', () => {
  [[404, ''], [401, ''], [429, 'limit: 0'], [429, ''], [402, ''], [403, ''], [500, ''], [400, '']]
    .forEach(([c, b]) => ok(E(c, b).hint.length > 5, c + ' 안내 없음'));
});

console.log('\n[내 키 목록 거르기]');
t('Gemini: 이미지·임베딩·음성·gemma 제외', () => {
  const ids = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-embedding-001', 'gemini-3.1-flash-image',
               'gemini-2.5-flash-preview-tts', 'gemini-3.8-live', 'gemma-3-27b-it', 'gemini-3.1-pro-preview'];
  const kept = ids.filter(m => M.isTextModel('gemini', m));
  eq(kept.join(','), 'gemini-flash-latest,gemini-3.8-flash,gemini-3.1-pro-preview');
});
t('OpenAI: 음성·이미지·임베딩 제외', () => {
  const ids = ['gpt-5.6-luna', 'gpt-realtime-2.1', 'gpt-image-2.5-flare', 'text-embedding-3-small', 'gpt-4o-mini-tts', 'o4-mini', 'whisper-1'];
  eq(ids.filter(m => M.isTextModel('openai', m)).join(','), 'gpt-5.6-luna,o4-mini');
});
t('정렬: -latest → 버전 큰 순', () => {
  eq(M.sortModelIds(['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite']).join(','),
     'gemini-flash-latest,gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash');
});
t('상태 한 줄', () => {
  eq(M.modelStatusText({ ok: true, sec: '1.8' }, '9/21 14:05'), '✓ 연결됨 · 1.8초 · 9/21 14:05');
  ok(/^✗ 모델명/.test(M.modelStatusText({ ok: false, short: '모델명을 찾을 수 없습니다', message: 'x' }, '')), '실패 표기');
  ok(/^– /.test(M.modelStatusText({ ok: false, skipped: true, message: 'Gemini 키 없음' })), '건너뜀 표기');
});

console.log('\n[기본 모델 목록]');
{
  const P = boot();
  t('모든 기본 모델이 어느 회사인지 판별됨', () => {
    const bad = P.PRESET_MODELS.filter(x => !M.guessProvider(x.model)).map(x => x.model);
    ok(!bad.length, bad.join(','));
  });
  t('회사별 기본 모델이 목록 안에 있고 회사가 맞음', () => {
    Object.keys(P.PROVIDER_DEFAULT_MODEL).forEach(p => {
      const m = P.PROVIDER_DEFAULT_MODEL[p];
      ok(P.PRESET_MODELS.some(x => x.model === m), m + ' 목록에 없음');
      eq(M.guessProvider(m), p, m);
    });
  });
  t('첫 줄이 기본 모델이고 제미나이', () => {
    eq(P.PRESET_MODELS[0].model, P.DEFAULT_MODEL); eq(M.guessProvider(P.DEFAULT_MODEL), 'gemini');
  });
  t('공식 모델 목록 주소 3곳', () => ['gemini', 'openai', 'anthropic'].forEach(p => ok(/^https:\/\//.test(P.MODEL_LINKS[p]), p)));
}

/* ------------------------------------------------- 가짜 시트 + 가짜 인터넷 */
const gemOk = (text) => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: text || '확인' }] } }] } });
const oaOk = (text) => ({ code: 200, body: { choices: [{ message: { content: text || '확인' } }] } });

console.log('\n[처음 설치 — 기본값은 제미나이]');
const A = boot();
A.installCore_();
t('활동용·합본용 모델 모두 gemini-flash-latest', () => {
  eq(A.cfg_('활동용 모델', ''), 'gemini-flash-latest', '활동용');
  eq(A.cfg_('합본용 모델', ''), 'gemini-flash-latest', '합본용');
});
t('모델 목록 표가 기본 8개로 채워짐', () => {
  const rows = A.readModelTable_();
  eq(rows.length, A.PRESET_MODELS.length, '개수');
  eq(rows[0].model, 'gemini-flash-latest', '첫 줄');
  ok(rows.every(r => r.level && r.memo), '수준·설명 빈칸 있음');
});
t('드롭다운 선택지 = 구독 + 표의 모델', () => {
  const c = A.modelChoices_();
  eq(c[0], 'Gemini(구독)'); ok(c.indexOf('claude-haiku-4-5') > 0, '표의 모델 누락');
});
t('모델 표가 다른 설정 읽기를 방해하지 않음', () => {
  eq(Number(A.cfg_('1회 최대 생성 건수', 0)), 25);
  eq(A.cfgBool_('학생 이름 마스킹', false), true);
});
t('설정 시트를 다시 만들어도 모델 표가 한 벌만', () => {
  A.buildConfig(); A.buildConfig();
  eq(A.readModelTable_().length, A.PRESET_MODELS.length);
});

console.log('\n[v3.0.x 에서 올라올 때]');
t('손대지 않은 옛 기본값은 새 기본값으로, 직접 바꾼 값은 그대로', () => {
  const B = boot();
  B.installCore_();
  B.setCfg_('활동용 모델', 'gemini-2.5-flash');      // v3.0 기본값 → 올려야 함
  B.setCfg_('합본용 모델', 'gpt-5.6-terra');         // 선생님이 고른 값 → 두어야 함
  B.buildConfig();
  eq(B.cfg_('활동용 모델', ''), 'gemini-flash-latest', '활동용');
  eq(B.cfg_('합본용 모델', ''), 'gpt-5.6-terra', '합본용');
});
t('옛 [추가 모델] 칸의 이름이 모델 목록으로 옮겨짐', () => {
  const B = boot();
  B.installCore_();
  const s = B.__ss.getSheetByName('⚙️ 설정');
  // v3.0 설정 시트 흉내: 표 없이 항목만, 끝에 추가 모델
  s.clear();
  s.getRange(4, 1, 3, 2).setValues([['활동용 모델', 'gemini-2.5-flash'], ['합본용 모델', 'gpt-5-mini'], ['추가 모델', 'gemini-3.7-flash, my-model']]);
  B.__modelCache = null;
  B.buildConfig();
  const names = B.readModelTable_().map(r => r.model);
  ok(names.indexOf('gemini-3.7-flash') >= 0 && names.indexOf('my-model') >= 0, '옮겨지지 않음: ' + names.join(','));
  eq(B.cfg_('합본용 모델', ''), 'gemini-flash-latest', 'gpt-5-mini 기본값은 제미나이로');
});

console.log('\n[모델 표 저장]');
t('선생님이 적은 목록 저장 — 중복·models/ 접두어 정리', () => {
  const msg = A.saveModelSettings({
    rows: [{ model: 'models/gemini-3.8-flash', company: '자동', level: '고정', memo: '', status: '' },
           { model: 'gemini-3.8-flash', company: '자동' },
           { model: 'gemini-flash-latest', company: '자동', level: '★', memo: '기본' },
           { model: 'my-proxy', company: 'OpenAI', level: '', memo: '학교 프록시' }],
    activity: 'gemini-3.8-flash', compile: 'gemini-flash-latest'
  });
  ok(/저장했습니다/.test(msg), msg);
  eq(A.readModelTable_().map(r => r.model).join(','), 'gemini-3.8-flash,gemini-flash-latest,my-proxy');
  eq(A.cfg_('활동용 모델', ''), 'gemini-3.8-flash');
});
t('[회사]를 직접 고른 이름은 그 회사로 보냄', () => eq(A.providerOf_('my-proxy'), 'openai'));
t('다시 설치/복구해도 선생님 목록이 보존됨', () => {
  A.installCore_();
  eq(A.readModelTable_().map(r => r.model).join(','), 'gemini-3.8-flash,gemini-flash-latest,my-proxy');
  eq(A.cfg_('활동용 모델', ''), 'gemini-3.8-flash');
});
t('빈 목록은 거절', () => {
  let err = null; try { A.saveModelSettings({ rows: [{ model: ' ' }] }); } catch (e) { err = e; }
  ok(err, '예외가 나야 함');
});

console.log('\n[연결 테스트 — 가짜 인터넷]');
t('키가 없으면 호출하지 않고 "키 없음"', () => {
  A.__fetch.calls.length = 0;
  const r = A.testModel({ model: 'gemini-flash-latest' });
  eq(r.skipped, true); eq(A.__fetch.calls.length, 0, '호출 수');
});
A.setKey_('gemini', 'AIza-test');
t('정상 → ✓ 와 걸린 시간', () => {
  A.__fetch.handler = (url) => { ok(/gemini-flash-latest:generateContent/.test(url), 'URL ' + url); return gemOk(); };
  const r = A.testModel({ model: 'gemini-flash-latest' });
  eq(r.ok, true); ok(/^\d+\.\d$/.test(r.sec), '초: ' + r.sec);
});
t('없는 모델 → ✗ 모델명, 재시도 안 함', () => {
  A.__fetch.calls.length = 0;
  A.__fetch.handler = () => ({ code: 404, body: { error: { message: 'models/gemini-9 is not found' } } });
  const r = A.testModel({ model: 'gemini-9' });
  eq(r.ok, false); eq(r.kind, 'model'); eq(A.__fetch.calls.length, 1, '호출 수');
  ok(/모델명을 찾을 수 없습니다/.test(r.short), r.short);
});
t('무료 등급 불가 → 재시도 없이 바로 안내', () => {
  A.__fetch.calls.length = 0;
  A.__fetch.handler = () => ({ code: 429, body: { error: { message: 'Quota exceeded ... limit: 0, model: gemini-pro' } } });
  const r = A.testModel({ model: 'gemini-pro-latest' });
  eq(r.kind, 'free'); eq(A.__fetch.calls.length, 1, '호출 수');
});
t('일시적 한도 초과 → 두 번 더 시도', () => {
  A.__fetch.calls.length = 0;
  let n = 0;
  A.__fetch.handler = () => (++n < 3 ? { code: 429, body: 'limit: 10' } : gemOk());
  eq(A.testModel({ model: 'gemini-flash-latest' }).ok, true); eq(A.__fetch.calls.length, 3, '호출 수');
});
t('네트워크가 끊겨도 예외 대신 ✗', () => {
  A.__fetch.handler = () => { throw new Error('Address unavailable'); };
  const r = A.testModel({ model: 'gemini-flash-latest' });
  eq(r.ok, false); eq(r.kind, 'server');
});
t('회사를 모르는 이름 → 호출 없이 안내', () => {
  A.__fetch.calls.length = 0;
  const r = A.testModel({ model: 'mistral-large' });
  eq(r.ok, false); ok(/회사/.test(r.message), r.message); eq(A.__fetch.calls.length, 0);
});
t('[회사]를 고르면 그 회사 주소로 호출', () => {
  A.setKey_('openai', 'sk-test');
  A.__fetch.handler = (url) => { ok(/api\.openai\.com/.test(url), url); return oaOk(); };
  eq(A.testModel({ model: 'mistral-large', company: 'OpenAI' }).ok, true);
});
t('구독 모델은 스크립트로 시험하지 않음', () => eq(A.testModel({ model: 'Gemini(구독)' }).ok, null));

console.log('\n[메뉴: 모델 연결 테스트]');
t('표 전체를 시험하고 [연결 확인] 칸에 적음', () => {
  A.__fetch.handler = (url) => (/gemini-3\.8-flash/.test(url) ? { code: 404, body: 'is not found' } : /openai/.test(url) ? oaOk() : gemOk());
  A.__alerts.length = 0;
  A.testAllModels();
  ok(A.__alerts.length === 1, '알림 ' + A.__alerts.length);
  ok(/통과 2 \/ 실패 1/.test(A.__alerts[0]), A.__alerts[0].slice(0, 120));
  const st = {}; A.readModelTable_().forEach(r => { st[r.model] = r.status; });
  ok(/^✗ 모델명/.test(st['gemini-3.8-flash']), '3.8: ' + st['gemini-3.8-flash']);
  ok(/^✓ 연결됨/.test(st['gemini-flash-latest']), 'latest: ' + st['gemini-flash-latest']);
});

console.log('\n[내 키로 쓸 수 있는 모델]');
t('회사 목록을 받아 글쓰기 모델만 정렬해서 돌려줌', () => {
  A.setKey_('openai', '');
  A.__fetch.handler = (url) => {
    ok(/\/v1beta\/models\?/.test(url), url);
    return { code: 200, body: { models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent', 'countTokens'] },
      { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }
    ] } };
  };
  const r = A.listAvailableModels();
  ok(r.gemini && r.gemini.ok, JSON.stringify(r));
  eq(r.gemini.models.join(','), 'gemini-flash-latest,gemini-3.8-flash,gemini-2.5-flash');
  ok(!r.openai && !r.anthropic, '키 없는 회사는 묻지 않음');
});
t('목록 요청이 실패해도 예외 대신 이유', () => {
  A.__fetch.handler = () => ({ code: 400, body: 'API key not valid' });
  const r = A.listAvailableModels();
  eq(r.gemini.ok, false); ok(/키/.test(r.gemini.message), r.gemini.message);
});

console.log('\n[시작하기 — 키와 모델]');
t('기본 모델로 연결되면 활동용·합본용을 맞추고 표에 ✓', () => {
  const C = boot(); C.installCore_();
  C.__fetch.handler = () => gemOk();
  const r = C.onboardSaveKey({ provider: 'gemini', key: 'AIza-x', model: '' });
  eq(r.ok, true, r.message);
  eq(C.cfg_('활동용 모델', ''), 'gemini-flash-latest'); eq(C.cfg_('합본용 모델', ''), 'gemini-flash-latest');
  const row = C.readModelTable_().filter(x => x.model === 'gemini-flash-latest')[0];
  ok(row && /^✓/.test(row.status), '표 상태: ' + (row && row.status));
});
t('직접 적은 모델이 표에 없으면 추가됨', () => {
  const C = boot(); C.installCore_();
  C.__fetch.handler = () => gemOk();
  const r = C.onboardSaveKey({ provider: 'gemini', key: 'AIza-x', model: 'gemini-3.7-flash' });
  eq(r.ok, true, r.message);
  ok(C.readModelTable_().some(x => x.model === 'gemini-3.7-flash'), '추가 안 됨');
  eq(C.cfg_('활동용 모델', ''), 'gemini-3.7-flash');
});
t('회사와 모델이 어긋나면 호출 전에 알려 줌', () => {
  const C = boot(); C.installCore_();
  C.__fetch.calls.length = 0;
  const r = C.onboardSaveKey({ provider: 'gemini', key: 'AIza-x', model: 'gpt-5.6-luna' });
  eq(r.ok, false); ok(/OpenAI/.test(r.message), r.message); eq(C.__fetch.calls.length, 0);
});
t('연결 실패면 설정 모델은 바꾸지 않음', () => {
  const C = boot(); C.installCore_();
  C.__fetch.handler = () => ({ code: 404, body: 'is not found' });
  const r = C.onboardSaveKey({ provider: 'gemini', key: 'AIza-x', model: 'gemini-typo' });
  eq(r.ok, false); eq(C.cfg_('활동용 모델', ''), 'gemini-flash-latest');
});

console.log('\n[생성 — 모델 칸을 비우면 활동용 모델]');
t('입력 시트에서 체크된 행 생성', () => {
  const D = boot(); D.installCore_();
  D.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준');
  const made = D.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통',
    columns: '탐구 주제|알게 된 점', desc: '', examples: [] });
  const s = D.__ss.getSheetByName(made.inSheet);
  s.getRange(4, 5, 1, 2).setValues([['기후 자료', '추세선의 한계']]);
  const cGen = D.colOf_(s, 3, '생성'), cAi = D.colOf_(s, 3, 'AI 결과');
  s.getRange(4, cGen).setValue(true);
  D.setKey_('gemini', 'AIza-x');
  const urls = [];
  D.__fetch.handler = (url) => { urls.push(url); return gemOk('기후 자료의 추세선을 해석하며 한계를 짚어 냄.'); };
  D.__ss.setActiveSheet(s);
  D.generateChecked();
  ok(/gemini-flash-latest/.test(urls[0] || ''), '호출 URL: ' + urls[0]);
  ok(/추세선/.test(s.getRange(4, cAi).getValue()), '결과: ' + s.getRange(4, cAi).getValue());
  eq(s.getRange(4, cGen).getValue(), false, '체크 해제');
});
t('시간 제한에 걸리면 남은 행은 체크를 두고 알림', () => {
  const D = boot(); D.installCore_();
  D.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준');
  const made = D.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통',
    columns: '탐구 주제', desc: '', examples: [] });
  const s = D.__ss.getSheetByName(made.inSheet);
  s.getRange(4, 5, 2, 1).setValues([['가'], ['나']]);
  const cGen = D.colOf_(s, 3, '생성');
  s.getRange(4, cGen, 2, 1).setValues([[true], [true]]);
  D.setKey_('gemini', 'AIza-x');
  D.__fetch.handler = () => gemOk('결과 문장.');
  vm.runInContext('RUN_BUDGET_MS = -1;', D);
  D.__alerts.length = 0;
  D.__ss.setActiveSheet(s);
  D.generateChecked();
  ok(/2건을 남기고 멈췄습니다/.test(D.__alerts.join('\n')), D.__alerts.join(' / '));
  eq(s.getRange(5, cGen).getValue(), true, '남은 행 체크 유지');
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
