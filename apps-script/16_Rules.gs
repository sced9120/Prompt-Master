/**
 * 세특 작성 도우미 v3 — 기재요령 규칙판 · 맞춤법 · 고쳐쓰기 (순수 로직)
 * ---------------------------------------------------------------
 * 해마다 바뀌는 학교생활기록부 기재요령을 "규칙판" 하나로 묶는다.
 *   · 금지어·형식·맞춤법 검사 표       → [📏 기재요령] 시트
 *   · 프롬프트의 [학생부 기재 금지사항] → [📐 공통규칙] NEIS_RULES
 *   · 기록 항목별 기재 주의            → [🧩 기록종류] [기재 주의] 칸 (그 항목 프롬프트에만 붙는다)
 *   · 기록 항목별 최대 글자 수         → [🧩 기록종류] [글자수] 칸
 * 새 학년도 기재요령이 나오면 만든이가 rules/latest.json 하나만 고치고,
 * 사본들은 그것을 받아 선생님이 손대지 않은 칸만 바꾼다(손댄 칸은 그대로 두고 알린다).
 *
 * 이 파일은 Apps Script와 Node 양쪽에서 동작한다(테스트: test/rules.test.js).
 * ---------------------------------------------------------------
 */

/** 원격 규칙판 주소 — 구글 서버에서 받으므로 학교망에서 github 가 막혀도 된다 */
var RULES_URL = 'https://raw.githubusercontent.com/sced9120/Prompt-Master/main/rules/latest.json';
/** 원격 규칙판을 저절로 확인하는 간격 */
var RULES_CHECK_DAYS = 7;

/** 2026 기재요령의 생성형 AI 원칙 — 시작하기·사용법·검사 창·복사 창에 보여 준다 */
var AI_NOTICE_2026 =
  'AI로 생성한 자료를 학교생활기록부 서술형 항목에 그대로 입력하는 것은 금지입니다(2026학년도 기재요령 고 p.19). ' +
  '이 도구의 결과는 초안입니다. 교사가 평소 직접 관찰·평가한 내용을 바탕으로 고쳐 쓰고, 최종 입력 전에 ' +
  '학생의 실제 수행과 무관한 허위·과장 기재가 없는지, 기재요령을 지켰는지 반드시 확인하세요.';

/** 맞춤법 표(자주 틀리는 표기) — [📏 기재요령] 시트에 함께 채워져 선생님이 더할 수 있다 */
var PRESET_SPELL_RULES = [
  ['역활', '역할'], ['됬', '됐'], ['몇 ?일', '며칠'], ['왠만', '웬만'], ['웬지', '왠지'],
  ['금새', '금세'], ['희안', '희한'], ['설레임', '설렘'], ['오랫만', '오랜만'],
  ['일일히', '일일이'], ['깨끗히', '깨끗이'], ['틈틈히', '틈틈이'], ['곰곰히', '곰곰이'],
  ['꼼꼼이', '꼼꼼히'], ['솔직이', '솔직히'], ['꾸준이', '꾸준히'], ['열심이', '열심히'],
  ['번번히', '번번이'], ['어떻해', '어떻게 해'], ['할께', '할게'], ['내노라', '내로라'],
  ['어의없', '어이없'], ['문안하게', '무난하게'], ['뒤쳐', '뒤처'], ['짜집기', '짜깁기'],
  ['염두해', '염두에 두어'], ['단언컨데', '단언컨대'], ['요컨데', '요컨대'], ['생각컨대', '생각건대'],
  ['할려고', '하려고'], ['볼려고', '보려고'], ['갈려고', '가려고'], ['들어나', '드러나'], ['들어남', '드러남'],
  ['가르키', '가리키'], ['어줍잖', '어쭙잖'], ['안밖', '안팎'], ['되여', '되어'], ['바뀌였', '바뀌었']
].map(function (p) { return { level: 'check', label: '맞춤법', re: p[0], fix: p[1], why: '바른 표기: ' + p[1] }; });

/* ============================================================ 2026 규칙판 */
/**
 * 기록 항목별 기재 주의 — 그 기록 항목의 프롬프트에만 붙는다(필요한 규칙만 꺼내 쓰기).
 * 출처: 2026학년도 학교생활기록부 기재요령 주요 개정사항 안내(고등학교, 교육부·KERIS)
 */
var RECORD_RULES_2026 = {
  '과세특':
    '- 교사가 수업과 수업에 연계한 수행평가 등에서 수시·상시로 관찰·평가한 내용만 바탕으로 쓴다(고 p.117).\n' +
    '- 성취기준에 따른 성취수준의 특성, 학습활동 참여도, 자기주도적 학습에 의한 변화와 성장 정도를 중심으로 쓴다.\n' +
    '- 수업 활동을 단순히 나열하거나 성취기준에 이미 적힌 지식을 그대로 옮기지 않는다(고 p.95).\n' +
    '- 교내·외 대회, 방과후학교 활동, K-MOOC·MOOC·KOCW, 연구보고서(소논문) 실적은 쓰지 않는다(고 p.118).\n' +
    '- 수학과제 탐구·사회문제 탐구·융합과학 탐구·과학과제 연구·사회과제 연구·윤리문제 탐구 과목은 연구보고서의 제목·주제·참여 인원·소요 시간을 빼고 과정만 쓸 수 있다.',
  '개세특':
    '- 정규교육과정의 교육활동에서 교사가 직접 관찰·평가한 내용만 쓴다.\n' +
    '- 교내·외 대회, 방과후학교 활동, K-MOOC·MOOC·KOCW, 연구보고서(소논문) 실적은 쓰지 않는다(고 p.118).',
  '자율':
    '- 학교교육계획에 따른 정규교육과정의 자율·자치활동만 쓴다(고 p.81).\n' +
    '- 이 영역과 연계해 학교교육계획에 따라 실시한 봉사활동은 이 영역 특기사항에 쓸 수 있다(2026학년도 1·2학년, 고 p.86).',
  '동아리':
    '- 정규교육과정의 동아리활동만 특기사항을 쓴다(고 p.81).\n' +
    '- 자율동아리, 정규교육과정 밖의 학교스포츠클럽, 청소년단체 활동은 특기사항을 쓰지 않는다(고등학교, 고 p.78·p.84).\n' +
    '- 이 영역과 연계해 학교교육계획에 따라 실시한 봉사활동은 이 영역 특기사항에 쓸 수 있다(2026학년도 1·2학년).',
  '진로':
    '- 정규교육과정의 진로활동만 쓴다(고 p.81).\n' +
    '- 희망 진로를 특정 대학명·학과명으로 쓰지 않는다.\n' +
    '- 최대 500자다(2026학년도부터 700자에서 줄어듦, 고 p.208).',
  '행발':
    '- 학습·행동·인성 등 학교 교육활동 전반에서 지속적으로 관찰한 행동특성을 바탕으로, 학생의 성장을 지원하는 교육적 관점에서 쓴다(고 p.158).\n' +
    '- 부정적 행동특성을 쓸 때는 구체적 관찰 사실과 함께 변화 가능성을 쓴다.\n' +
    '- 다른 항목에 입력할 수 없는 내용(방과후학교 활동 등)은 여기에도 쓰지 않는다(고 p.159).\n' +
    '- 최대 300자다(2026학년도부터 500자에서 줄어듦, 고 p.208).'
};

/** 2026학년도 규칙판 — 원격 규칙판(rules/latest.json)도 같은 모양이다 */
var RULES_2026 = {
  id: '2026.1',
  year: 2026,
  checked: '2026-10-13',
  source: '2026학년도 학교생활기록부 기재요령 · 주요 개정사항 안내(고등학교, 교육부·KERIS, 2026-02)',
  aiNotice: AI_NOTICE_2026,
  neisRules: NEIS_RULES_2026,
  chars: { '과세특': 500, '개세특': 500, '자율': 500, '동아리': 500, '진로': 500, '행발': 300 },
  byRecord: RECORD_RULES_2026,
  rules: PRESET_BANNED.concat(PRESET_FORMAT_RULES).concat(PRESET_SPELL_RULES),
  // 직전 기준 — 이 값 그대로인 칸은 손대지 않은 옛 기본값으로 보고 새 값으로 바꾼다
  history: [{ id: '2025', chars: { '진로': 700, '행발': 500 } }]
};

/**
 * 규칙판이 바뀌기 전 판들의 [기재 주의]·NEIS 문구 — 이 문구 그대로면 선생님이 손대지 않은 것.
 * 다음 학년도 규칙판을 만들 때 직전 판의 문구가 여기에 남도록 rules/latest.json 의 history 에 넣는다.
 */
function knownOldTexts(pack, field, key) {
  var out = [];
  var add = function (t) { t = normText(t); if (t && out.indexOf(t) < 0) out.push(t); };
  if (field === 'neisRules') (typeof OLD_NEIS_RULES !== 'undefined' ? OLD_NEIS_RULES : []).forEach(add);
  [RULES_2026].concat(pack && pack.history ? pack.history : []).forEach(function (h) {
    if (!h) return;
    if (field === 'neisRules') add(h.neisRules);
    else if (field === 'byRecord' && h.byRecord) add(h.byRecord[key]);
  });
  return out;
}

/** 비교용으로 줄 끝 공백·줄바꿈 종류를 맞춘다 */
function normText(t) {
  return String(t === null || t === undefined ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

/** 규칙판 번호 비교: '2026.1' < '2026.2' < '2027.1' */
function packNewer(a, b) {
  var p = function (x) { return String(x || '0').split('.').map(function (n) { return Number(n) || 0; }); };
  var x = p(a), y = p(b);
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * 원격에서 받은 규칙판 검사. 깨진 정규식·너무 긴 값은 빼고, 쓸 수 있는 것만 남긴다.
 * @return {{ok:boolean, pack?:Object, errors:string[]}}
 */
function validatePack(raw) {
  var errors = [];
  var p = raw;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { return { ok: false, errors: ['JSON 이 아님'] }; } }
  if (!p || typeof p !== 'object') return { ok: false, errors: ['비어 있음'] };
  if (!/^\d{4}\.\d+$/.test(String(p.id || ''))) errors.push('id 형식이 아님(예: 2027.1)');
  var rules = [];
  (Array.isArray(p.rules) ? p.rules : []).forEach(function (r, i) {
    if (!r || !r.re || String(r.re).length > 400) { errors.push('rules[' + i + '] 비었거나 너무 김'); return; }
    try { new RegExp(r.re); } catch (e) { errors.push('rules[' + i + '] 정규식 오류: ' + r.re); return; }
    rules.push({ level: r.level === 'block' ? 'block' : 'check', label: String(r.label || '기타').slice(0, 40),
                 re: String(r.re), fix: r.fix ? String(r.fix).slice(0, 60) : '', why: String(r.why || '').slice(0, 300) });
  });
  if (!rules.length) errors.push('rules 가 비었음');
  var chars = {};
  Object.keys(p.chars || {}).forEach(function (k) {
    var n = Number(p.chars[k]);
    if (n >= 50 && n <= 3000) chars[k] = Math.round(n);
  });
  var byRecord = {};
  Object.keys(p.byRecord || {}).forEach(function (k) {
    var t = String(p.byRecord[k] || '');
    if (t.length <= 3000) byRecord[k] = t;
  });
  var fatal = !/^\d{4}\.\d+$/.test(String(p.id || '')) || !rules.length;
  if (fatal) return { ok: false, errors: errors };
  return {
    ok: true, errors: errors,
    pack: {
      id: String(p.id), year: Number(p.year) || Number(String(p.id).slice(0, 4)),
      checked: String(p.checked || ''), source: String(p.source || '').slice(0, 300),
      aiNotice: String(p.aiNotice || AI_NOTICE_2026).slice(0, 1200),
      neisRules: String(p.neisRules || '').slice(0, 6000),
      chars: chars, byRecord: byRecord, rules: rules,
      history: Array.isArray(p.history) ? p.history.slice(0, 10) : []
    }
  };
}

/** 규칙판 → [📏 기재요령] 표의 줄 [사용, 수준, 분류, 찾을 말, 바르게, 이유·근거, 출처] */
function packRuleRows(pack) {
  var src = (pack.year || '') + ' 기재요령';
  return (pack.rules || []).map(function (r) {
    return [true, r.level === 'block' ? '수정' : '확인', r.label, r.re, r.fix || '', r.why || '',
            r.label === '맞춤법' ? '맞춤법(기본)' : src];
  });
}

/** 표의 한 줄 → 검사 규칙. 사용을 끈 줄·빈 줄·깨진 정규식은 null */
function ruleFromRow(row) {
  var use = row[0] === true || String(row[0]).toUpperCase() === 'TRUE';
  var re = String(row[3] || '').trim();
  if (!use || !re) return null;
  try { new RegExp(re); } catch (e) { return null; }
  var lv = String(row[1] || '').trim();
  return { level: (lv === '수정' || lv === 'block') ? 'block' : 'check', label: String(row[2] || '기타').trim() || '기타',
           re: re, fix: String(row[4] || '').trim(), why: String(row[5] || '').trim() };
}

/** 표의 [출처]가 기본(규칙판)에서 온 줄인지 — 선생님이 더한 '내 학교' 줄은 업데이트 때 남긴다 */
function isPackRow(src) {
  src = String(src || '').trim();
  return !src || /기재요령|맞춤법\(기본\)/.test(src);
}

/* ============================================================ 맞춤법 */
var JONG_RIEUL = 8, JONG_NIEUN = 4, JONG_SS = 20, JONG_BS = 18;
/** '안'·'않' 뒤에 오는 되·돼·하·해 (받침이 붙은 된·됨·한·했… 까지) */
var NEG_NEXT = /^[돼-됳하-햏]/;
function jongOf_(ch) {
  var c = ch ? ch.charCodeAt(0) : 0;
  if (c < 0xAC00 || c > 0xD7A3) return -1;
  return (c - 0xAC00) % 28;
}

/**
 * 표로 잡기 어려운 띄어쓰기·어미 오류 (정확도가 높은 것만, 모두 [확인] 수준)
 *   · 할수 있다 → 할 수 있다,  할것 → 할 것,  할때 → 할 때,  할줄 알다 → 할 줄 알다
 *   · 있슴/했슴 → 있음/했음,  않하다 → 안 하다,  해서는 안된다 → 안 된다
 *   · 같은 낱말 연속, 빈칸 두 번, 문장부호 앞 빈칸, 마침표·쉼표 뒤 붙여 쓰기
 * @return {Array<{level, label, hit, fix, why}>}
 */
function spellIssues(text) {
  var s = String(text || ''), out = [], seen = {};
  var push = function (hit, fix, why) {
    var k = hit + '→' + fix;
    if (seen[k]) return;
    seen[k] = 1;
    out.push({ level: 'check', label: '맞춤법', hit: hit, fix: fix, why: why });
  };
  for (var i = 1; i < s.length; i++) {
    var prev = s.charAt(i - 1), ch = s.charAt(i), next = s.charAt(i + 1), j = jongOf_(prev);
    if (ch === '수' && j === JONG_RIEUL) {
      var rest = s.slice(i + 1).replace(/^ +/, '');
      if (/^(있|없)/.test(rest)) push(prev + '수', prev + ' 수', "의존명사 '수'는 띄어 씀");
    } else if (ch === '것' && (j === JONG_RIEUL || j === JONG_NIEUN) && ['날', '별', '온', '산'].indexOf(prev) < 0) {
      push(prev + '것', prev + ' 것', "의존명사 '것'은 띄어 씀");
    } else if (ch === '때' && j === JONG_RIEUL) {
      push(prev + '때', prev + ' 때', "'~ㄹ 때'는 띄어 씀");
    } else if (ch === '줄' && j === JONG_RIEUL && /^ ?(알|몰)/.test(s.slice(i + 1))) {
      push(prev + '줄', prev + ' 줄', "의존명사 '줄'은 띄어 씀");
    } else if (ch === '슴' && (j === JONG_SS || j === JONG_BS)) {
      push(prev + '슴', prev + '음', "명사형은 '~음' (있음, 했음)");
    } else if (ch === '않' && NEG_NEXT.test(next)) {
      push('않' + next, '안 ' + next, "부정은 '안 ~' (않은 '~지 않다'에만)");
    }
  }
  var m, re1 = new RegExp('(^|[\\s,.])안(' + NEG_NEXT.source.slice(1) + ')', 'g');
  while ((m = re1.exec(s))) push('안' + m[2], '안 ' + m[2], "부정의 '안'은 띄어 씀");
  var re2 = /(^|\s)([가-힣A-Za-z]{2,})\s+\2(?=[\s.,]|$)/g;
  while ((m = re2.exec(s))) push(m[2] + ' ' + m[2], m[2], '같은 낱말이 잇따라 나옴');
  if (/ {2,}/.test(s)) push('빈칸 두 번', '빈칸 한 번', '빈칸이 겹침');
  if ((m = s.match(/\S\s+[.,]/))) push(m[0], m[0].replace(/\s+/, ''), '문장부호 앞에는 빈칸을 두지 않음');
  if ((m = s.match(/[가-힣][.,][가-힣A-Za-z]/))) push(m[0], m[0].charAt(0) + m[0].charAt(1) + ' ' + m[0].charAt(2), '마침표·쉼표 뒤는 한 칸 띄움');
  return out;
}

/* ============================================================ 고쳐쓰기 (하네스) */
/**
 * 생성 → 자동 검사 → 걸린 것만 짚어 다시 쓰게 하는 "고쳐쓰기" 요청문.
 * 규칙(시스템 프롬프트)은 처음 생성과 똑같이 보내므로 회사 쪽 캐시 할인도 그대로 받는다.
 * @param {string} block      학생 자료
 * @param {string} draft      첫 결과
 * @param {Array} issues      validateResult 의 issues 중 고칠 것
 * @param {number} limitBytes
 */
function buildRepairUser(block, draft, issues, limitBytes) {
  var L = ['# 학생 자료', String(block || '').trim(), '', '# 고쳐 쓸 초안', String(draft || '').trim(), '',
           '# 자동 검사에서 걸린 점 — 이것만 바로잡는다'];
  (issues || []).forEach(function (x) {
    if (x.label === '분량 초과') L.push('- 분량 초과(' + x.hit + '): ' + limitBytes + '바이트 이내가 되도록 덜 중요한 문장을 줄인다.');
    else if (x.fix) L.push('- ' + x.label + ': "' + x.hit + '" → "' + x.fix + '"');
    else L.push('- ' + x.label + ': "' + x.hit + '" ' + (x.why ? '— ' + x.why : '') + ' → 이 내용을 빼거나 기재요령에 맞게 바꾼다.');
  });
  L.push('', '# 출력', '위 점만 바로잡은 특기사항 본문만 한 문단으로 출력한다. 학생 자료에 없는 내용을 새로 넣지 않는다. 설명을 붙이지 않는다.');
  return L.join('\n');
}

/** 고쳐 쓸 만한지: [수정] 수준이 하나라도 있으면 */
function needsRepair(v) {
  return !!(v && v.issues && v.issues.some(function (x) { return x.level === 'block' && x.label !== '결과 없음'; }));
}

/** 두 검사 결과 중 나은 쪽: [수정] 수가 적은 쪽, 같으면 [확인] 수가 적은 쪽 */
function betterResult(a, b) {
  var cnt = function (v, lv) { return v.issues.filter(function (x) { return x.level === lv; }).length; };
  var ab = cnt(a, 'block'), bb = cnt(b, 'block');
  if (ab !== bb) return bb < ab ? 'b' : 'a';
  return cnt(b, 'check') < cnt(a, 'check') ? 'b' : 'a';
}

/* ============================================================ 근거 확인 */
/**
 * "AI 결과가 학생 자료에 있는 내용인가" — 2026 기재요령의 허위·과장 확인을 돕는 검토 요청.
 * 결과는 JSON {"unsupported":[{"quote","why"}]}.
 */
var GROUND_SYSTEM =
  '# 역할\n당신은 학교생활기록부 문장을 검토하는 교사다.\n\n' +
  '# 할 일\n[학생 자료]와 [특기사항 초안]을 비교해, 초안에서 학생 자료로 뒷받침되지 않는 내용을 찾는다.\n' +
  '- 자료에 없는 활동, 결과, 수치, 횟수, 도서·인물, 과장된 평가(예: 탁월함, 뛰어남)를 찾는다.\n' +
  '- 자료의 표현을 자연스럽게 바꾼 것, 자료에서 바로 읽히는 의미 부여는 문제 삼지 않는다.\n' +
  '- 근거가 없는 구절만 초안 원문 그대로 짧게 뽑는다.\n\n' +
  '# 출력\nJSON 하나만 출력한다. {"unsupported":[{"quote":"초안의 구절","why":"자료에 없는 이유"}]}\n없으면 {"unsupported":[]}';

function buildGroundUser(source, draft) {
  return '# 학생 자료\n' + String(source || '').trim() + '\n\n# 특기사항 초안\n' + String(draft || '').trim();
}

function parseGroundResult(text) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var j = null;
  try { j = JSON.parse(t); } catch (e) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { j = JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
  }
  var list = j && Array.isArray(j.unsupported) ? j.unsupported : (Array.isArray(j) ? j : []);
  return list.map(function (x) {
    return { quote: String((x && (x.quote || x.text)) || '').trim(), why: String((x && x.why) || '').trim() };
  }).filter(function (x) { return x.quote; });
}

/* ============================================================ 맞춤법 (AI) */
var SPELL_SYSTEM =
  '# 역할\n당신은 한국어 맞춤법·띄어쓰기 교정자다.\n\n' +
  '# 할 일\n[글]의 맞춤법, 띄어쓰기, 오탈자, 문장부호만 바로잡는다.\n' +
  '- 내용, 낱말 선택, 문장 순서, 문체는 바꾸지 않는다. 학교생활기록부 문장이라 "~함.", "~음." 처럼 끝나는 것은 그대로 둔다.\n' +
  '- 고칠 곳마다 글에 있는 그대로의 짧은 구절(from)과 바른 표기(to)를 쓴다.\n\n' +
  '# 출력\nJSON 하나만 출력한다. {"changes":[{"from":"틀린 구절","to":"바른 구절","why":"짧은 이유"}]}\n고칠 것이 없으면 {"changes":[]}';

function parseSpellResult(text, original) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var j = null;
  try { j = JSON.parse(t); } catch (e) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { j = JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
  }
  var src = String(original || '');
  return (j && Array.isArray(j.changes) ? j.changes : []).map(function (c) {
    return { from: String((c && c.from) || ''), to: String((c && c.to) || ''), why: String((c && c.why) || '') };
  }).filter(function (c) { return c.from && c.from !== c.to && src.indexOf(c.from) >= 0; });
}

/** 고칠 목록을 글에 적용 (앞에서부터 한 번씩) */
function applyChanges(text, changes) {
  var s = String(text || '');
  (changes || []).forEach(function (c) {
    var i = s.indexOf(c.from);
    if (i >= 0) s = s.slice(0, i) + c.to + s.slice(i + c.from.length);
  });
  return s;
}

/* ============================================================ 키 없이 (복사·붙여넣기) */
/**
 * Gemini 앱(학교 계정)·ChatGPT·Claude 같은 대화창에 붙여 넣을 요청문.
 * 대화창은 JSON 대신 [S1] 같은 표시로 나눠 받는 편이 안정적이다.
 * @param {Array<{id:string, block:string}>} items
 * @param {string=} heading  한 명일 때 자료 제목 (기본 '학생 자료', 압축은 '통합할 문장들')
 */
function buildManualUser(items, heading) {
  heading = heading || '학생 자료';
  if (items.length === 1) {
    return '# ' + heading + '\n' + String(items[0].block || '').trim() + '\n\n# 출력\n위 규칙대로 특기사항 본문만 한 문단으로 출력한다. 설명, 제목, 따옴표를 붙이지 않는다.';
  }
  var L = ['# 이번에 작성할 학생 ' + items.length + '명',
           '아래 학생들의 특기사항을 한 명씩 따로 작성한다.',
           '- 위의 모든 규칙(분량 포함)을 학생마다 따로 지킨다. 분량은 학생 한 명 기준이다.',
           '- 다른 학생의 자료를 섞지 않는다. 그 학생 자료에 없는 내용을 지어내지 않는다.',
           '- 학생마다 첫 문장과 문장 구조를 다르게 한다.'];
  items.forEach(function (it) { L.push('', '## ' + it.id, String(it.block || '').trim()); });
  L.push('', '# 출력 형식',
         '학생마다 [번호] 한 줄을 쓰고 다음 줄에 특기사항 본문만 쓴다. 다른 설명은 붙이지 않는다.',
         items.map(function (it) { return '[' + it.id + ']\n(본문)'; }).join('\n'));
  return L.join('\n');
}

/**
 * 대화창에서 복사해 온 답 → id → 본문.
 * [S1] / S1: / **S1** / ## S1 같은 표시를 모두 받고, JSON 으로 왔으면 그것도 읽는다.
 */
function parseManualAnswer(text, ids) {
  var t = String(text || '').replace(/\r\n?/g, '\n').trim();
  var map = {};
  if (!t) return { map: map, missing: ids.slice() };
  if (ids.length === 1 && !/\[?\*{0,2}#*\s*S1\b/.test(t)) {
    map[ids[0]] = t;
    return { map: map, missing: [] };
  }
  var re = /(^|\n)\s*(?:#+\s*)?(?:\*\*)?\[?\s*(S\d+)\s*\]?(?:\*\*)?\s*[:：]?[ \t]*/g, m, marks = [];
  while ((m = re.exec(t))) marks.push({ id: m[2], start: m.index + m[0].length, at: m.index });
  if (marks.length) {
    marks.forEach(function (mk, i) {
      var body = t.slice(mk.start, i + 1 < marks.length ? marks[i + 1].at : t.length).trim();
      if (ids.indexOf(mk.id) >= 0 && body && !map[mk.id]) map[mk.id] = body;
    });
  } else if (typeof parseBatchResult === 'function') {
    map = parseBatchResult(t, ids).map;
  }
  return { map: map, missing: ids.filter(function (id) { return !map[id]; }) };
}

/* ============================================================ AI 앱으로 내보내기 */
var RECORD_SLUG = { '과세특': 'subject', '개세특': 'individual', '자율': 'autonomy', '동아리': 'club', '진로': 'career', '행발': 'behavior' };

/** 스킬 이름: 영문 소문자·숫자·하이픈만, 64자 이내 */
function skillName(recordKey, n) {
  return ('saeteuk-' + (RECORD_SLUG[recordKey] || 'record') + '-' + (Number(n) || 1)).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

/** Gemini Gem 안내 · ChatGPT/Claude 프로젝트 지침에 붙여 넣을 글 */
function buildGemText(system) {
  return String(system || '').trim() + '\n\n# 사용법\n교사가 학생 자료를 붙여 넣으면 위 규칙대로 특기사항 본문만 쓴다. ' +
    '여러 명이면 [S1] [S2] 처럼 학생마다 표시 한 줄을 쓰고 다음 줄에 본문을 쓴다.';
}

/**
 * Claude 스킬(SKILL.md) — 시트가 조립한 규칙을 그대로 담는다. 시트를 고치면 다시 내보내야 한다.
 * @param {{name:string, activity:string, record:string, system:string, notice:string, rulesId:string}} o
 */
function buildSkillMd(o) {
  var desc = (o.activity + ' 활동의 학교생활기록부 ' + o.record + ' 초안을 2026학년도 기재요령에 맞춰 쓴다. ' +
              '교사가 학생 관찰 자료(메모·입력 항목)를 주고 세특·특기사항 초안을 부탁할 때 쓴다.').replace(/\s+/g, ' ');
  return [
    '---',
    'name: ' + o.name,
    'description: ' + desc.slice(0, 1000),
    '---',
    '',
    '# ' + o.activity + ' — ' + o.record + ' 초안 쓰기',
    '',
    '세특 작성 도우미(구글 시트)에서 내보낸 규칙입니다. 기재요령 규칙판 ' + o.rulesId + '.',
    '',
    '## 규칙',
    '',
    String(o.system || '').trim(),
    '',
    '## 여러 학생을 한 번에 받을 때',
    '',
    '학생마다 [S1] [S2] 처럼 표시 한 줄을 쓰고 다음 줄에 그 학생의 본문만 쓴다. 학생 자료를 서로 섞지 않는다.',
    '',
    '## 꼭 지킬 것',
    '',
    '- ' + String(o.notice || '').trim(),
    '- 결과는 초안이다. 교사가 직접 관찰한 사실과 맞는지 확인하고 고쳐 쓰도록 답 끝에 한 줄로 알린다.',
    ''
  ].join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RULES_2026: RULES_2026, PRESET_SPELL_RULES: PRESET_SPELL_RULES, RECORD_RULES_2026: RECORD_RULES_2026,
    knownOldTexts: knownOldTexts, normText: normText, packNewer: packNewer, validatePack: validatePack,
    packRuleRows: packRuleRows, ruleFromRow: ruleFromRow, isPackRow: isPackRow, spellIssues: spellIssues,
    buildRepairUser: buildRepairUser, needsRepair: needsRepair, betterResult: betterResult,
    buildGroundUser: buildGroundUser, parseGroundResult: parseGroundResult,
    parseSpellResult: parseSpellResult, applyChanges: applyChanges,
    buildManualUser: buildManualUser, parseManualAnswer: parseManualAnswer,
    skillName: skillName, buildGemText: buildGemText, buildSkillMd: buildSkillMd
  };
}
