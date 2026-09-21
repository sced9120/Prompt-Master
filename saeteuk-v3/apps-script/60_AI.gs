/**
 * 세특 작성 도우미 v3 — AI 연결
 * API 키는 UserProperties에 저장되어 사용자 계정별로 분리됩니다.
 * 사본을 다른 선생님과 공유해도 키는 넘어가지 않습니다.
 */

var SUBSCRIPTION_MODEL = 'Gemini(구독)';

function modelChoices_() {
  var extra = String(cfg_('추가 모델', '') || '').split(',').map(function (x) { return x.trim(); }).filter(String);
  return [
    SUBSCRIPTION_MODEL,
    'gemini-2.5-flash', 'gemini-2.5-pro',
    'gpt-5-mini', 'gpt-5',
    'claude-haiku-4-5', 'claude-sonnet-4-5'
  ].concat(extra);
}

function providerOf_(model) {
  var m = String(model || '').trim();
  if (!m || m === SUBSCRIPTION_MODEL) return 'subscription';
  if (/^gemini/i.test(m)) return 'gemini';
  if (/^claude/i.test(m)) return 'anthropic';
  return 'openai';
}

function props_() { return PropertiesService.getUserProperties(); }
function getKey_(p) { return props_().getProperty('KEY_' + p) || ''; }
function setKey_(p, v) {
  if (v) props_().setProperty('KEY_' + p, v);
  else props_().deleteProperty('KEY_' + p);
}

/* -------------------------------------------------------------- 설정 UI */
function openApiDialog() {
  var t = HtmlService.createTemplateFromFile('UI_ApiKey');
  t.has = {
    openai: !!getKey_('openai'), gemini: !!getKey_('gemini'), anthropic: !!getKey_('anthropic')
  };
  ui_().showModalDialog(t.evaluate().setWidth(560).setHeight(560), 'AI 연결 설정');
}

function saveKeys(obj) {
  ['openai', 'gemini', 'anthropic'].forEach(function (p) {
    if (obj[p] === undefined) return;
    var v = String(obj[p] || '').trim();
    if (v === '__KEEP__') return;
    setKey_(p, v);
  });
  return '저장했습니다. 이 키는 ' + Session.getActiveUser().getEmail() + ' 계정에만 저장됩니다.';
}

function testConnection() {
  var out = [];
  ['openai', 'gemini', 'anthropic'].forEach(function (p) {
    if (!getKey_(p)) { out.push('· ' + p + ' : 키 없음'); return; }
    var model = p === 'openai' ? 'gpt-5-mini' : (p === 'gemini' ? 'gemini-2.5-flash' : 'claude-haiku-4-5');
    try {
      var r = callAI_('한 단어로만 답한다.', '준비됐으면 "확인"이라고만 답해라.', model);
      out.push('· ' + p + ' : 정상 (' + String(r).slice(0, 20) + ')');
    } catch (e) {
      out.push('· ' + p + ' : 실패 — ' + e.message);
    }
  });
  out.push('');
  out.push('· ' + SUBSCRIPTION_MODEL + ' : 빈 셀에 =AI("안녕") 을 입력해 답이 나오면 사용 가능합니다.');
  ui_().alert('연결 테스트', out.join('\n'), ui_().ButtonSet.OK);
}

/* ------------------------------------------------------------- 호출 본체 */
/**
 * @param {string} system  조립된 프롬프트(규칙 전체)
 * @param {string} user    학생 자료
 * @param {string} model
 * @return {string}
 */
function callAI_(system, user, model) {
  var p = providerOf_(model);
  if (p === 'subscription') throw new Error(SUBSCRIPTION_MODEL + ' 은(는) 셀 수식으로 동작합니다. 메뉴 ⑤ 대신 체크박스를 사용하세요.');
  var key = getKey_(p);
  if (!key) throw new Error(p + ' API 키가 없습니다. 메뉴 > ② AI 연결 설정 에서 입력하세요.');

  if (p === 'openai') return callOpenAI_(key, model, system, user);
  if (p === 'gemini') return callGemini_(key, model, system, user);
  return callAnthropic_(key, model, system, user);
}

function fetchJson_(url, options, label) {
  var delays = [0, 2000, 5000];
  var last = '';
  for (var i = 0; i < delays.length; i++) {
    if (delays[i]) Utilities.sleep(delays[i]);
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 200 && code < 300) {
      try { return JSON.parse(body); }
      catch (e) { throw new Error(label + ' 응답 해석 실패'); }
    }
    last = code + ' ' + body.slice(0, 300);
    if (code === 429 || code >= 500) continue;   // 재시도
    break;
  }
  throw new Error(label + ' 호출 실패 (' + last + ')');
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
  if (parts) parts.forEach(function (p) { if (p.text) txt += p.text; });
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
