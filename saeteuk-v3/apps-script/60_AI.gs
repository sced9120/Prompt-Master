/**
 * 세특 작성 도우미 v3 — AI 연결 · 모델
 * API 키는 UserProperties에 저장되어 사용자 계정별로 분리됩니다.
 * 사본을 다른 선생님과 공유해도 키는 넘어가지 않습니다.
 *
 * 모델은 [⚙️ 설정] 시트 아래 [🤖 모델 목록] 표에서 선생님이 직접 적습니다.
 * 표가 곧 드롭다운의 선택지이고, 연결 테스트 결과도 그 표에 남습니다.
 */

var SUBSCRIPTION_MODEL = 'Gemini(구독)';
var PROVIDERS = ['gemini', 'openai', 'anthropic'];
// [⚙️ 설정]의 항목|값|설명 열 폭에 맞춰 순서를 정했다 (C열이 넓은 설명 칸)
var MODEL_HEAD = ['모델명', '수준', '언제 쓰나', '회사', '연결 확인'];
var MODEL_FIELDS = ['model', 'level', 'memo', 'company', 'status'];
function modelCol_(field) { return MODEL_FIELDS.indexOf(field) + 1; }
var COMPANY_CHOICES = ['자동', 'Gemini', 'OpenAI', 'Claude'];
var TEST_SYSTEM = '짧게 답한다.';
var TEST_USER = '연결 확인입니다. "확인"이라고만 답하세요.';

var __modelCache = null;   // 한 번 실행하는 동안만 쓰는 표 캐시

/* ------------------------------------------------------------ 모델 표 */
/** [⚙️ 설정] 시트에서 모델 표 헤더가 있는 행. 없으면 0 */
function modelTableRow_(s) {
  if (!s) return 0;
  var last = s.getLastRow();
  if (!last) return 0;
  var v = s.getRange(1, 1, last, 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === MODEL_HEAD[0] && String(v[i][1]).trim() === MODEL_HEAD[1]) return i + 1;
  }
  return 0;
}

/** 표 읽기 → [{model, company, level, memo, status, row}] */
function readModelRowsAt_(s, head) {
  var out = [];
  var last = s.getLastRow();
  if (!head || last <= head) return out;
  var v = s.getRange(head + 1, 1, last - head, MODEL_HEAD.length).getValues();
  var seen = {};
  for (var i = 0; i < v.length; i++) {
    var get = function (f) { return v[i][modelCol_(f) - 1]; };
    var m = normModel(get('model'));
    if (!m || seen[m]) continue;
    seen[m] = true;
    out.push({
      model: m, company: String(get('company') || '자동').trim() || '자동',
      level: String(get('level') || ''), memo: String(get('memo') || ''), status: String(get('status') || ''),
      row: head + 1 + i
    });
  }
  return out;
}

function presetModelRows_() {
  return PRESET_MODELS.map(function (p) {
    return { model: p.model, company: '자동', level: p.level, memo: p.memo, status: '' };
  });
}

/** 지금 쓸 수 있는 모델 표 (표가 없으면 기본 목록) */
function readModelTable_() {
  if (__modelCache) return __modelCache;
  var s = sh_(APP.SH.CONFIG);
  var head = modelTableRow_(s);
  __modelCache = head ? readModelRowsAt_(s, head) : presetModelRows_();
  return __modelCache;
}

/** 표 쓰기 — head 행에 헤더, 그 아래에 rows. 아래쪽 남은 줄은 비운다 */
function writeModelTable_(s, head, rows) {
  var n = MODEL_HEAD.length;
  ensureCols_(s, n);
  var last = s.getLastRow();
  if (last > head) s.getRange(head + 1, 1, last - head, n).clearContent();
  s.getRange(head, 1, 1, n).setValues([MODEL_HEAD]);
  styleHeader_(s, head, n, '#35583f');
  if (rows.length) {
    s.getRange(head + 1, 1, rows.length, n).setValues(rows.map(modelRowValues_));
  }
  var body = Math.max(rows.length + 10, 20);   // 빈 줄도 몇 개 서식을 입혀 둔다
  if (head + body > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), head + body - s.getMaxRows());
  s.getRange(head + 1, 1, body, n).setWrap(true).setVerticalAlignment('top');
  s.getRange(head + 1, modelCol_('model'), body, 1).setBackground(APP.COLORS.input).setFontWeight('bold');
  s.getRange(head + 1, modelCol_('level'), body, 1).setFontWeight('bold').setFontColor('#35583f');
  s.getRange(head + 1, modelCol_('memo'), body, 1).setFontColor('#555555');
  s.getRange(head + 1, modelCol_('company'), body, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(COMPANY_CHOICES, true).setAllowInvalid(true).build());
  s.getRange(head + 1, modelCol_('status'), body, 1).setFontColor('#37474f');
  __modelCache = null;
}

function modelRowValues_(r) {
  var d = { model: r.model, level: r.level || '', memo: r.memo || '', company: r.company || '자동', status: r.status || '' };
  return MODEL_FIELDS.map(function (f) { return d[f]; });
}

/** 표에서 [회사]를 직접 고른 모델 → 회사 */
function companyMap_() {
  var map = {};
  readModelTable_().forEach(function (r) {
    var p = companyToProvider(r.company);
    if (p) map[r.model] = p;
  });
  return map;
}

/** 드롭다운 선택지: 구독 + 표의 모델 + 설정에 적힌 모델 */
function modelChoices_() {
  var out = [SUBSCRIPTION_MODEL], seen = {};
  seen[SUBSCRIPTION_MODEL] = true;
  var add = function (m) { m = normModel(m); if (m && !seen[m]) { seen[m] = true; out.push(m); } };
  readModelTable_().forEach(function (r) { add(r.model); });
  add(cfg_('활동용 모델', DEFAULT_MODEL));
  add(cfg_('합본용 모델', DEFAULT_MODEL));
  return out;
}

function modelValidation_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(modelChoices_(), true)
    .setAllowInvalid(true)          // 목록에 없는 이름도 직접 적을 수 있게
    .build();
}

/** 시트의 [모델] 열에 드롭다운을 입힌다 (헤더가 HEAD_ROW 에 있는 입력·취합 시트) */
function applyModelDropdown_(sheet, rows) {
  var c = colOf_(sheet, APP.HEAD_ROW, '모델');
  if (!c) return false;
  var n = rows || (sheet.getMaxRows() - APP.DATA_ROW + 1);
  if (n < 1) return false;
  sheet.getRange(APP.DATA_ROW, c, n, 1).setDataValidation(modelValidation_());
  return true;
}

/** 모델 목록이 바뀐 뒤 모든 입력·취합 시트와 설정 칸의 드롭다운을 새로 입힌다 */
function refreshModelDropdowns_() {
  __modelCache = null;
  var n = 0;
  try {
    getActivities_().forEach(function (a) {
      var s = a.inSheet && sh_(a.inSheet);
      if (s && applyModelDropdown_(s)) n++;
    });
  } catch (e) {}
  try {
    compileSheets_().forEach(function (s) {
      var rows = s.getLastRow() - APP.DATA_ROW + 1;
      if (rows > 0 && applyModelDropdown_(s, rows)) n++;
    });
  } catch (e) {}
  applyConfigModelDropdown_();
  return n;
}

/** [⚙️ 설정]의 활동용/합본용 모델 칸 */
function applyConfigModelDropdown_() {
  var s = sh_(APP.SH.CONFIG);
  if (!s || !s.getLastRow()) return;
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    var k = String(v[i][0]).trim();
    if (k === '활동용 모델' || k === '합본용 모델') s.getRange(i + 1, 2).setDataValidation(modelValidation_());
  }
}

/* ------------------------------------------------------------ 회사 판별 */
function providerOf_(model) {
  var m = normModel(model);
  if (!m || m === SUBSCRIPTION_MODEL) return 'subscription';
  return companyMap_()[m] || guessProvider(m);
}

/* ------------------------------------------------------------ 키 보관 */
function props_() { return PropertiesService.getUserProperties(); }
function getKey_(p) { return props_().getProperty('KEY_' + p) || ''; }
function setKey_(p, v) {
  if (v) props_().setProperty('KEY_' + p, v);
  else props_().deleteProperty('KEY_' + p);
}

/* -------------------------------------------------------------- 설정 창 */
function openApiDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_ApiKey').setWidth(760).setHeight(640);
  ui_().showModalDialog(html, 'AI 연결 · 모델 설정');
}

/** 설정 창이 처음 열릴 때 필요한 것 전부 */
function getAiSettings() {
  var has = {};
  PROVIDERS.forEach(function (p) { has[p] = !!getKey_(p); });
  return {
    has: has,
    rows: readModelTable_().map(function (r) {
      return { model: r.model, company: r.company, level: r.level, memo: r.memo, status: r.status };
    }),
    activity: normModel(cfg_('활동용 모델', DEFAULT_MODEL)),
    compile: normModel(cfg_('합본용 모델', DEFAULT_MODEL)),
    presets: presetModelRows_(),
    links: MODEL_LINKS,
    defaults: PROVIDER_DEFAULT_MODEL,
    fallback: DEFAULT_MODEL
  };
}

function saveKeys(obj) {
  PROVIDERS.forEach(function (p) {
    if (obj[p] === undefined) return;
    var v = String(obj[p] || '').trim();
    if (v === '__KEEP__') return;
    if (v === '__DELETE__') v = '';
    setKey_(p, v);
  });
  var has = {};
  PROVIDERS.forEach(function (p) { has[p] = !!getKey_(p); });
  var who = '';
  try { who = Session.getActiveUser().getEmail(); } catch (e) {}
  return { has: has, message: '저장했습니다. 키는 ' + (who || '내') + ' 계정에만 보관됩니다.' };
}

/**
 * 모델 표 저장 (설정 창의 [저장])
 * @param {{rows:Array, activity:string, compile:string}} p
 */
function saveModelSettings(p) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) throw new Error('[⚙️ 설정] 시트가 없습니다. 메뉴 ① 처음 설치 / 구조 복구 를 먼저 실행하세요.');
  var seen = {}, rows = [];
  (p.rows || []).forEach(function (r) {
    var m = normModel(r.model);
    if (!m || m === SUBSCRIPTION_MODEL || seen[m]) return;
    seen[m] = true;
    rows.push({ model: m, company: r.company || '자동', level: r.level || '', memo: r.memo || '', status: r.status || '' });
  });
  if (!rows.length) throw new Error('모델을 한 개 이상 적어 주세요.');

  var head = modelTableRow_(s);
  if (!head) { buildConfig(); head = modelTableRow_(s); }
  writeModelTable_(s, head, rows);

  var act = normModel(p.activity) || rows[0].model;
  var cmp = normModel(p.compile) || act;
  setCfg_('활동용 모델', act);
  setCfg_('합본용 모델', cmp);
  var n = refreshModelDropdowns_();
  return '저장했습니다. 활동용 ' + act + ' · 합본용 ' + cmp +
         (n ? ' · 시트 ' + n + '곳의 모델 드롭다운을 새로 고쳤습니다.' : '');
}

/* ------------------------------------------------------------ 연결 확인 */
/**
 * 모델 하나 시험 호출 (설정 창에서 한 줄씩 부른다)
 * @param {{model:string, company?:string}} p
 * @return {{ok:boolean|null, model, provider, sec?, message, short?, kind?, skipped?}}
 */
function testModel(p) {
  var m = normModel(p && p.model);
  if (!m) return { ok: false, model: '', message: '모델명이 비었습니다.' };
  if (m === SUBSCRIPTION_MODEL) {
    return { ok: null, model: m, provider: 'subscription',
      message: '스크립트로는 시험할 수 없습니다. 빈 셀에 =AI("안녕")을 넣어 답이 나오면 사용 가능합니다.' };
  }
  var prov = companyToProvider(p.company) || providerOf_(m);
  if (!prov || prov === 'subscription') {
    return { ok: false, model: m, provider: '', short: '회사를 모름',
      message: '어느 회사 모델인지 알 수 없습니다. [회사] 칸에서 Gemini·OpenAI·Claude 중 하나를 고르세요.' };
  }
  if (!getKey_(prov)) {
    return { ok: false, skipped: true, model: m, provider: prov, message: providerLabel(prov) + ' 키 없음' };
  }
  var t0 = Date.now();
  try {
    var r = callAI_(TEST_SYSTEM, TEST_USER, m, prov);
    return { ok: true, model: m, provider: prov, sec: ((Date.now() - t0) / 1000).toFixed(1),
             reply: String(r).slice(0, 20), message: '연결됨' };
  } catch (e) {
    return { ok: false, model: m, provider: prov, kind: e.kind || '', hint: e.hint || '',
             short: e.hint ? e.hint.split('.')[0] : '', message: e.message };
  }
}

function stamp_() {
  try { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d HH:mm'); }
  catch (e) { return ''; }
}

/** 표의 한 모델에 연결 확인 결과를 적는다 (표에 없으면 맨 아래에 추가) */
function recordModelStatus_(res, extra) {
  var s = sh_(APP.SH.CONFIG);
  var head = modelTableRow_(s);
  if (!head || !res || !res.model) return;
  var rows = readModelRowsAt_(s, head);
  var text = modelStatusText(res, stamp_());
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].model === res.model) { s.getRange(rows[i].row, modelCol_('status')).setValue(text); __modelCache = null; return; }
  }
  var r = (rows.length ? rows[rows.length - 1].row : head) + 1;
  extra = extra || {};
  s.getRange(r, 1, 1, MODEL_HEAD.length).setValues([modelRowValues_({ model: res.model, company: extra.company,
    level: extra.level, memo: extra.memo || '직접 추가', status: text })]);
  __modelCache = null;
}

/** 메뉴: 모델 목록 전체 연결 테스트 → 표에 ✓/✗ 를 적고 요약을 띄운다 */
function testAllModels() {
  var t0 = Date.now();
  var list = readModelTable_().slice();
  var cur = [normModel(cfg_('활동용 모델', DEFAULT_MODEL)), normModel(cfg_('합본용 모델', DEFAULT_MODEL))];
  cur.forEach(function (m) {
    if (m && m !== SUBSCRIPTION_MODEL && !list.some(function (r) { return r.model === m; })) list.push({ model: m, company: '자동' });
  });
  var lines = [], okN = 0, badN = 0, noKey = {};
  for (var i = 0; i < list.length; i++) {
    if (Date.now() - t0 > 240000) { lines.push('… 시간이 오래 걸려 여기서 멈췄습니다. 다시 누르면 이어서 확인합니다.'); break; }
    toast_((i + 1) + '/' + list.length + ' ' + list[i].model + ' 확인 중…', '모델 연결 테스트');
    var res = testModel({ model: list[i].model, company: list[i].company });
    recordModelStatus_(res);
    if (res.skipped) { noKey[providerLabel(res.provider)] = true; continue; }
    if (res.ok) { okN++; lines.push('✓ ' + res.model + ' — ' + res.sec + '초'); }
    else { badN++; lines.push('✗ ' + res.model + ' — ' + (res.short || res.message)); }
  }
  var head = ['사용 중: 활동용 ' + cur[0] + ' · 합본용 ' + cur[1], ''];
  var tail = [];
  var nk = Object.keys(noKey);
  if (nk.length) tail.push('', '– 키가 없어 건너뜀: ' + nk.join(', ') + ' 모델');
  tail.push('', '결과는 [⚙️ 설정] 아래 모델 목록의 [연결 확인] 칸에도 적어 두었습니다.');
  if (badN) tail.push('✗ 가 뜬 모델은 이름을 고치거나 지우세요. 최신 이름은 메뉴 ② [AI 연결 · 모델 설정] > 도움말에서 확인할 수 있습니다.');
  ui_().alert('모델 연결 테스트 — 통과 ' + okN + ' / 실패 ' + badN,
    head.concat(lines.length ? lines : ['(시험할 모델이 없습니다 — 먼저 API 키를 넣으세요)']).concat(tail).join('\n'),
    ui_().ButtonSet.OK);
}

/** 예전 메뉴 이름 호환 */
function testConnection() { testAllModels(); }

/* ------------------------------------------------- 내 키로 쓸 수 있는 모델 */
/**
 * 각 회사에 "이 키로 쓸 수 있는 모델 목록"을 물어본다. 키가 있는 회사만.
 * @return {{gemini?:{ok, models?:string[], message?}, openai?:…, anthropic?:…}}
 */
function listAvailableModels() {
  var out = {};
  PROVIDERS.forEach(function (p) {
    var key = getKey_(p);
    if (!key) return;
    try {
      var ids = [];
      if (p === 'gemini') {
        var token = '', guard = 0;
        do {
          var j = fetchJson_('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' +
            (token ? '&pageToken=' + encodeURIComponent(token) : '') + '&key=' + encodeURIComponent(key),
            { method: 'get', muteHttpExceptions: true }, 'Gemini');
          (j.models || []).forEach(function (x) {
            var methods = x.supportedGenerationMethods || [];
            if (methods.indexOf('generateContent') >= 0) ids.push(normModel(x.name));
          });
          token = j.nextPageToken || '';
        } while (token && ++guard < 5);
      } else if (p === 'openai') {
        var o = fetchJson_('https://api.openai.com/v1/models',
          { method: 'get', headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true }, 'OpenAI');
        (o.data || []).forEach(function (x) { ids.push(normModel(x.id)); });
      } else {
        var a = fetchJson_('https://api.anthropic.com/v1/models?limit=100',
          { method: 'get', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true }, 'Anthropic');
        (a.data || []).forEach(function (x) { ids.push(normModel(x.id)); });
      }
      var seen = {};
      ids = ids.filter(function (m) { if (seen[m] || !isTextModel(p, m)) return false; seen[m] = true; return true; });
      out[p] = { ok: true, models: sortModelIds(ids) };
    } catch (e) {
      out[p] = { ok: false, message: e.hint || e.message };
    }
  });
  return out;
}

/* ------------------------------------------------------------- 호출 본체 */
/**
 * @param {string} system  조립된 프롬프트(규칙 전체)
 * @param {string} user    학생 자료
 * @param {string} model
 * @param {string=} provider  회사를 직접 지정할 때(연결 테스트)
 * @return {string}
 */
function callAI_(system, user, model, provider) {
  var m = normModel(model);
  var p = provider || providerOf_(m);
  if (p === 'subscription') throw new Error(SUBSCRIPTION_MODEL + ' 은(는) 셀 수식으로 동작합니다. 메뉴 ⑥ 대신 체크박스를 사용하세요.');
  if (!p) {
    throw new Error('"' + m + '" 이(가) 어느 회사 모델인지 알 수 없습니다. [⚙️ 설정] 아래 모델 목록의 [회사] 칸을 골라 주세요.');
  }
  var key = getKey_(p);
  if (!key) throw new Error(providerLabel(p) + ' API 키가 없습니다. 메뉴 > ② AI 연결 · 모델 설정 에서 입력하세요.');

  if (p === 'openai') return callOpenAI_(key, m, system, user);
  if (p === 'gemini') return callGemini_(key, m, system, user);
  return callAnthropic_(key, m, system, user);
}

function fetchJson_(url, options, label) {
  var delays = [0, 2000, 5000];
  var last = '', info = null, code = 0;
  for (var i = 0; i < delays.length; i++) {
    if (delays[i]) Utilities.sleep(delays[i]);
    var res;
    try { res = UrlFetchApp.fetch(url, options); }
    catch (e) {                              // 네트워크 오류·시간 초과
      last = String(e.message || e).slice(0, 160);
      info = { kind: 'server', retry: true, hint: '인터넷 연결이 잠시 끊겼거나 응답이 늦습니다. 잠시 뒤 다시 시도하세요.' };
      continue;
    }
    code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 200 && code < 300) {
      try { return JSON.parse(body); }
      catch (e) { throw new Error(label + ' 응답 해석 실패'); }
    }
    last = body.replace(/\s+/g, ' ').slice(0, 220);
    info = explainApiError(code, body);
    if (!info.retry) break;
  }
  var err = new Error(label + ' — ' + (info && info.hint ? info.hint + ' ' : '') + '[' + (code || '연결') + '] ' + last);
  err.kind = info ? info.kind : 'other';
  err.hint = info ? info.hint : '';
  err.code = code;
  throw err;
}

function callOpenAI_(key, model, system, user) {
  var json = fetchJson_('https://api.openai.com/v1/chat/completions', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    }),
    muteHttpExceptions: true
  }, 'OpenAI');
  var c = json.choices && json.choices[0];
  var txt = c && c.message && c.message.content;
  if (!txt) throw new Error('OpenAI 응답이 비었습니다.');
  return String(txt).trim();
}

function callGemini_(key, model, system, user) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  var json = fetchJson_(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }]
    }),
    muteHttpExceptions: true
  }, 'Gemini');
  var cand = json.candidates && json.candidates[0];
  var parts = cand && cand.content && cand.content.parts;
  var txt = '';
  if (parts) parts.forEach(function (p) { if (p.text && !p.thought) txt += p.text; });
  if (!txt) throw new Error('Gemini 응답이 비었습니다. (안전 필터 또는 모델명 확인)');
  return txt.trim();
}

function callAnthropic_(key, model, system, user) {
  var json = fetchJson_('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model, max_tokens: 2000, system: system,
      messages: [{ role: 'user', content: user }]
    }),
    muteHttpExceptions: true
  }, 'Anthropic');
  var txt = '';
  (json.content || []).forEach(function (b) { if (b.type === 'text') txt += b.text; });
  if (!txt) throw new Error('Anthropic 응답이 비었습니다.');
  return txt.trim();
}

/** Gemini 구독(=AI 함수)용 수식 문자열 */
function subscriptionFormula_(system, user) {
  var text = system + '\n\n# 학생 자료\n' + user;
  return '=AI("' + text.replace(/"/g, '""') + '")';
}

/** 결과 문자열 정리 (마크다운·따옴표·줄바꿈 제거) */
function cleanResult_(t) {
  return String(t || '')
    .replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();
}
