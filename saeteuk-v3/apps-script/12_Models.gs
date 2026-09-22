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
    .replace(/[​-‍﻿]/g, '')
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

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normModel: normModel, guessProvider: guessProvider, companyToProvider: companyToProvider,
    providerLabel: providerLabel, explainApiError: explainApiError, isTextModel: isTextModel,
    sortModelIds: sortModelIds, modelStatusText: modelStatusText
  };
}
