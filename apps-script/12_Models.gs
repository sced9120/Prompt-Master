/**
 * 세특 작성 도우미 v3 — 모델 이름 다루기 (순수 로직)
 * ---------------------------------------------------------------
 * 선생님이 모델 이름을 직접 적으므로, 오타·복사 흔적·회사 판별·오류 해석을 여기서 처리한다.
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/models.test.js).
 * ---------------------------------------------------------------
 */

/** 복사해 온 이름 정리: 앞뒤 공백·따옴표, API 목록의 'models/' 접두어 */
function normModel(m) {
  return String(m === null || m === undefined ? '' : m)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .replace(/^models\//i, '')
    .trim();
}

/** 이름만 보고 회사를 짐작한다. 모르면 '' */
function guessProvider(m) {
  m = normModel(m).toLowerCase();
  if (!m) return '';
  if (/^(gemini|learnlm)/.test(m)) return 'gemini';
  if (/^claude/.test(m)) return 'anthropic';
  if (/^(gpt|chatgpt|o\d|ft:gpt|ft:o\d)/.test(m)) return 'openai';
  return '';
}

/** 표의 [회사] 칸 값 → 내부 이름. '자동'이나 빈칸이면 '' */
function companyToProvider(label) {
  var s = String(label || '').trim().toLowerCase();
  if (!s || s === '자동') return '';
  if (/gemini|google|구글|제미나이/.test(s)) return 'gemini';
  if (/openai|gpt|오픈/.test(s)) return 'openai';
  if (/claude|anthropic|클로드|앤트로픽/.test(s)) return 'anthropic';
  return '';
}

function providerLabel(p) {
  return { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude', subscription: 'Gemini(구독)' }[p] || '?';
}

/**
 * API 오류를 선생님이 알아들을 말로 바꾼다.
 * @return {{kind:string, hint:string, retry:boolean}}
 *   kind: model | key | free | billing | rate | access | region | request | server | other
 */
function explainApiError(code, body) {
  code = Number(code) || 0;
  var b = String(body || '').toLowerCase();

  if (/api[ _-]?key not valid|invalid[ _-]api[ _-]key|incorrect api key|invalid x-api-key|api_key_invalid|authentication_error|unauthenticated/.test(b) || code === 401) {
    return { kind: 'key', retry: false, hint: 'API 키가 올바르지 않습니다. 키를 처음부터 다시 복사해 넣으세요.' };
  }
  if (code === 404 || /model_not_found|not_found_error|is not found|was not found|does not exist|unknown model|not supported for generatecontent|no such model/.test(b)) {
    return { kind: 'model', retry: false, hint: '모델명을 찾을 수 없습니다. 철자를 확인하거나, 종료된 모델이면 최신 이름으로 바꾸세요.' };
  }
  if (/insufficient_quota|credit balance|billing_hard_limit|payment required/.test(b) || code === 402) {
    return { kind: 'billing', retry: false, hint: '결제 잔액(크레딧)이 없습니다. 해당 회사 콘솔에서 결제 수단이나 충전을 확인하세요.' };
  }
  if (code === 429 && /limit:\s*0\b|free_tier[^,]*limit:\s*0/.test(b)) {
    return { kind: 'free', retry: false, hint: '무료 등급에서는 이 모델을 쓸 수 없습니다. 다른 모델을 고르거나 결제(유료 등급)를 등록하세요.' };
  }
  if (code === 429) {
    return { kind: 'rate', retry: true, hint: '호출 한도를 넘었습니다(무료 등급은 분당·하루 횟수 제한). 잠시 뒤 다시 하거나 나눠서 실행하세요.' };
  }
  if (/location is not supported|user location|unsupported_country|region/.test(b) && code === 400) {
    return { kind: 'region', retry: false, hint: '이 지역에서는 쓸 수 없는 모델입니다.' };
  }
  if (code === 403) {
    return { kind: 'access', retry: false, hint: '이 키로는 이 모델을 쓸 권한이 없습니다. 콘솔에서 사용 권한이나 프로젝트 설정을 확인하세요.' };
  }
  if (code >= 500 || code === 529) {
    return { kind: 'server', retry: true, hint: '회사 서버가 잠시 불안정합니다. 잠시 뒤 다시 시도하세요.' };
  }
  if (code === 400) {
    return { kind: 'request', retry: false, hint: '이 모델이 요청을 받지 않습니다. 글을 쓰는(대화용) 모델이 맞는지 확인하세요 — 이미지·음성·임베딩 모델은 쓸 수 없습니다.' };
  }
  return { kind: 'other', retry: false, hint: '' };
}

/** "내 키로 쓸 수 있는 모델" 목록에서 글쓰기에 못 쓰는 모델을 뺀다 */
function isTextModel(provider, id) {
  var m = normModel(id).toLowerCase();
  if (!m) return false;
  var common = /embed|image|imagen|tts|audio|speech|live|realtime|transcri|whisper|veo|lyria|robotics|computer-use|deep-research|antigravity|omni|aqa|moderation|dall-e|sora|search/;
  if (common.test(m)) return false;
  if (provider === 'gemini') return /^gemini/.test(m);
  if (provider === 'openai') return /^(gpt|chatgpt|o\d)/.test(m) && !/instruct|codex|oss|babbage|davinci/.test(m);
  if (provider === 'anthropic') return /^claude/.test(m);
  return false;
}

/** 목록 정렬: -latest 별칭 → 버전 숫자가 큰 것 → 이름순 */
function sortModelIds(ids) {
  var ver = function (s) {
    var m = String(s).match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };
  return ids.slice().sort(function (a, b) {
    var la = /-latest$/.test(a) ? 1 : 0, lb = /-latest$/.test(b) ? 1 : 0;
    if (la !== lb) return lb - la;
    var d = ver(b) - ver(a);
    if (d) return d;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** 연결 확인 결과를 표에 적을 한 줄로 */
function modelStatusText(res, stamp) {
  if (!res) return '';
  var tail = stamp ? ' · ' + stamp : '';
  if (res.ok === true) return '✓ 연결됨 · ' + res.sec + '초' + tail;
  if (res.skipped) return '– ' + res.message + tail;
  if (res.ok === null) return 'ⓘ ' + res.message;
  return '✗ ' + (res.short || res.message) + tail;
}

/* ------------------------------------------------------------ 비용 줄이기 */
/**
 * "생각(추론)을 줄이는" 요청 옵션. 모르는 모델이면 null (아무것도 안 보냄).
 * 세특 한 편은 깊은 추론이 필요 없는 글쓰기라, 생각을 줄여도 품질 차이가 거의 없고
 * 생각 토큰은 출력 요금으로 청구되므로 비용과 시간이 크게 준다.
 *   Gemini 3 이후·-latest : thinkingLevel 'low'   (3.8 Flash 기본은 medium)
 *   Gemini 2.5 Flash 계열 : thinkingBudget 0      (끄기)
 *   Gemini 2.5 Pro        : thinkingBudget 128    (끌 수 없어 최소값)
 *   OpenAI gpt-5·gpt-6·o  : reasoning_effort 'low' (gpt-5.x 기본은 medium)
 */
function thinkingFor(provider, model) {
  var m = normModel(model).toLowerCase();
  if (provider === 'gemini') {
    if (/^gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 };
    if (/^gemini-2\.5-flash/.test(m)) return { thinkingBudget: 0 };
    var v = m.match(/^gemini-(\d+)/);
    if (v && Number(v[1]) >= 3) return { thinkingLevel: 'low' };
    if (/^gemini-(flash|flash-lite|pro)-latest$/.test(m)) return { thinkingLevel: 'low' };
    return null;
  }
  if (provider === 'openai') {
    if (/^(gpt-5|gpt-6|gpt-7|o\d)/.test(m) && !/chat-latest/.test(m)) return { reasoning_effort: 'low' };
    return null;
  }
  return null;
}

/** 여러 학생을 한 번에 보낼 때의 응답 형식 (Gemini responseSchema 형식) */
var BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
        required: ['id', 'text']
      }
    }
  },
  required: ['results']
};

/**
 * 여러 학생 자료를 한 번의 요청으로 묶는다. 규칙(시스템 프롬프트)은 그대로 두고
 * 학생 자료만 여기 모으므로, 규칙을 학생 수만큼 되풀이해 보내지 않아도 된다.
 * @param {Array<{id:string, block:string}>} items
 */
function buildBatchUser(items) {
  var L = [];
  L.push('# 이번에 작성할 학생 ' + items.length + '명');
  L.push('아래 학생들의 특기사항을 한 명씩 따로 작성한다.');
  L.push('- 위의 모든 규칙(분량 포함)을 학생마다 따로 지킨다. 분량은 학생 한 명 기준이다.');
  L.push('- 다른 학생의 자료를 섞지 않는다. 그 학생 자료에 없는 내용을 지어내지 않는다.');
  L.push('- 학생마다 첫 문장과 문장 구조를 다르게 하고, 같은 표현을 여러 학생에게 되풀이하지 않는다.');
  items.forEach(function (it) {
    L.push('');
    L.push('## ' + it.id);
    L.push(String(it.block || '').trim());
  });
  L.push('');
  L.push('# 출력 형식 (위의 [출력] 규칙은 학생 한 명의 text 에 적용한다)');
  L.push('JSON 하나만 출력한다. 설명이나 코드 블록 표시를 붙이지 않는다.');
  L.push('{"results":[' + items.map(function (it) { return '{"id":"' + it.id + '","text":"특기사항 본문"}'; }).join(',') + ']}');
  return L.join('\n');
}

/**
 * 묶음 응답을 id → 본문으로 푼다. 형식이 조금 달라도 최대한 살린다.
 * @return {{map:Object, missing:string[]}}
 */
function parseBatchResult(text, ids) {
  var map = {}, t = String(text || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var data = null;
  var tryParse = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
  data = tryParse(t);
  if (!data) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) data = tryParse(t.slice(a, b + 1));
  }
  if (!data) {
    var c = t.indexOf('['), d = t.lastIndexOf(']');
    if (c >= 0 && d > c) data = tryParse(t.slice(c, d + 1));
  }
  var list = null;
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.results)) list = data.results;
  else if (data && typeof data === 'object') {
    list = Object.keys(data).map(function (k) { return { id: k, text: data[k] }; });
  }
  (list || []).forEach(function (x, i) {
    if (!x) return;
    var id = String(x.id || x.ID || x.student || '').trim();
    var body = typeof x === 'string' ? x : (x.text || x.result || x.content || '');
    if (!id && ids[i]) id = ids[i];                     // id 를 빼먹었으면 순서로
    if (ids.indexOf(id) < 0) {
      var n = id.match(/(\d+)/);                        // "학생1" 처럼 바꿔 쓴 경우
      if (n && ids[Number(n[1]) - 1]) id = ids[Number(n[1]) - 1];
    }
    body = String(body || '').trim();
    if (id && body && ids.indexOf(id) >= 0 && !map[id]) map[id] = body;
  });
  return { map: map, missing: ids.filter(function (id) { return !map[id]; }) };
}

/** 대략의 토큰 수 (한글은 1.4자에 1토큰, 나머지는 3.5자에 1토큰 정도로 어림) */
function estimateTokens(text) {
  var s = String(text || ''), h = 0, o = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) h++;
    else if (c > 32) o++;
  }
  return Math.round(h / 1.4 + o / 3.5);
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normModel: normModel, guessProvider: guessProvider, companyToProvider: companyToProvider,
    providerLabel: providerLabel, explainApiError: explainApiError, isTextModel: isTextModel,
    sortModelIds: sortModelIds, modelStatusText: modelStatusText,
    thinkingFor: thinkingFor, BATCH_SCHEMA: BATCH_SCHEMA, buildBatchUser: buildBatchUser,
    parseBatchResult: parseBatchResult, estimateTokens: estimateTokens
  };
}
