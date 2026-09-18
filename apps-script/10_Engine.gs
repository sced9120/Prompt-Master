/**
 * 세특 작성 도우미 v3 — 프롬프트 조립 엔진 (순수 로직)
 * ---------------------------------------------------------------
 * v2의 가장 큰 문제: 활동마다 프롬프트 "전체"를 사람이 복붙해서 관리
 *   → 활동이 늘수록 골격이 서로 달라지고, 공통 규칙을 고쳐도 활동별
 *     하드코딩 문구(예: "750바이트 이내") 때문에 반영되지 않음.
 *
 * v3의 해법: 프롬프트를 7개 슬롯으로 쪼개고 엔진이 자동 조립.
 *   교사가 쓰는 것은 [활동설명 한두 줄 + 입력컬럼 + 예시] 뿐.
 *
 *   ① 역할      ← 기록종류.role  ×  교과영역.role
 *   ② 맥락      ← 기록종류.goal  +  활동명/활동설명
 *   ③ 서술규칙  ← 공통규칙.WRITING_RULES
 *   ④ 기재요령  ← 공통규칙.NEIS_RULES
 *   ⑤ 관점·역량 ← 기록종류.view  +  교과영역.comp
 *   ⑥ 분량      ← 글자수(한 곳에서만 관리) → 문장 자동 생성 + BYTE_RULE
 *   ⑦ 활동고유  ← 입력 형식 + 예시 + (성취수준 지침) + 마무리 지시문
 * ---------------------------------------------------------------
 * 이 파일은 Apps Script와 Node 양쪽에서 동작하도록 작성되어 있습니다.
 */

/** NEIS 기준 바이트 수 (한글 3, 그 외 1, 줄바꿈 2) */
function byteLen(s) {
  if (s === null || s === undefined) return 0;
  s = String(s);
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c === 10 || c === 13) n += 2;          // 줄바꿈
    else if (c > 127) n += 3;                   // 한글 등 멀티바이트
    else n += 1;
  }
  return n;
}

/** 바이트 한도에 맞게 자르되 문장 단위로 끊음 */
function trimToBytes(s, limit) {
  s = String(s || '');
  if (byteLen(s) <= limit) return s;
  var cut = '';
  for (var i = 0; i < s.length; i++) {
    if (byteLen(cut + s[i]) > limit) break;
    cut += s[i];
  }
  var last = cut.lastIndexOf('.');
  if (last > cut.length * 0.5) cut = cut.slice(0, last + 1);
  return cut;
}

/** "a|b|c" 또는 "a, b, c" → ['a','b','c'] */
function parseColumns(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[|,\n]/)
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x.length > 0; });
}

/** 목록에서 key로 1건 찾기 */
function findByKey(list, key) {
  key = String(key || '').trim();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].key).trim() === key) return list[i];
  }
  return null;
}

/** {KEY} 치환 (없는 키는 빈 문자열로 제거) */
function fillTokens(tpl, map) {
  return String(tpl || '').replace(/\{([A-Za-z0-9_가-힣]+)\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(map, k) ? String(map[k]) : '';
  });
}

/**
 * 프롬프트 조립
 * @param {Object} o
 *   o.activity  {key,name,recordKey,subjectKey,chars,columns,desc,mode,custom}
 *   o.record    기록종류 1건
 *   o.subject   교과영역 1건
 *   o.common    {WRITING_RULES, NEIS_RULES, BYTE_RULE, GRADE_RULE, INSTRUCTION}
 *   o.examples  예시 합본 문자열 (없으면 빈 문자열)
 *   o.years     교직 경력 표기 (기본 15)
 * @return {string}
 */
function buildPrompt(o) {
  var act = o.activity || {};
  var rec = o.record || {};
  var sub = o.subject || {};
  var com = o.common || {};
  var chars = Number(act.chars || rec.chars || 500);
  var bytes = chars * 3;
  var cols = parseColumns(act.columns);

  // 직접 작성 모드: 교사가 쓴 본문을 토큰만 치환해서 사용
  if (String(act.mode || '').indexOf('직접') === 0) {
    return fillTokens(act.custom, {
      ROLE: buildRole(rec, sub, o.years),
      WRITING_RULES: com.WRITING_RULES || '',
      NEIS_RULES: com.NEIS_RULES || '',
      BYTE_RULE: com.BYTE_RULE || '',
      GRADE_RULE: com.GRADE_RULE || '',
      INSTRUCTION: com.INSTRUCTION || '',
      COMPETENCY: sub.comp || '',
      VIEW: rec.view || '',
      EXAMPLES: o.examples || '',
      CHARS: chars,
      BYTES: bytes,
      COLUMNS: cols.join('|'),
      ACTIVITY: act.name || '',
      RECORD: rec.name || ''
    }).trim();
  }

  var P = [];

  // ① 역할
  P.push('# 역할\n' + buildRole(rec, sub, o.years));

  // ② 맥락
  var ctx = ['# 과제'];
  ctx.push('- 목표: ' + (rec.goal || '학교생활기록부 특기사항 작성'));
  ctx.push('- 기록 항목: ' + (rec.name || act.recordKey || ''));
  if (act.name) ctx.push('- 대상 활동: ' + act.name);
  if (act.desc) ctx.push('- 활동 개요: ' + String(act.desc).replace(/\n/g, ' '));
  P.push(ctx.join('\n'));

  // ③ 서술 규칙
  if (com.WRITING_RULES) P.push('# 서술 규칙\n' + com.WRITING_RULES);

  // ④ 기재 금지사항
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);

  // ⑤ 관점 · 역량
  var persp = [];
  if (rec.view) persp.push(rec.view);
  if (sub.comp) persp.push(sub.comp);
  if (persp.length) P.push('# 서술 관점과 역량\n' + persp.join('\n\n'));

  // ⑥ 분량 (단일 출처)
  var len = ['# 분량'];
  len.push('- ' + chars + '자(' + bytes + '바이트) 이내로 작성한다.');
  len.push('- ' + Math.round(bytes * 0.9) + '바이트 이상을 채워 충실하게 작성한다.');
  if (com.BYTE_RULE) len.push(com.BYTE_RULE);
  P.push(len.join('\n'));

  // ⑦-1 입력 형식
  if (cols.length) {
    P.push('# 입력 자료 형식\n아래 학생 자료는 다음 항목이 | 로 구분되어 제공된다.\n' + cols.join('|'));
  }

  // ⑦-2 예시
  if (o.examples && String(o.examples).trim()) {
    P.push('# 예시\n표현 방식과 서술 흐름을 참고한다. 문장을 그대로 베끼지 않는다.\n\n' + String(o.examples).trim());
  }

  // ⑦-3 성취수준 (해당 기록 종류에만)
  if (rec.useGrade && com.GRADE_RULE) {
    P.push('# 성취수준 반영\n' + com.GRADE_RULE);
  }

  // ⑦-4 마무리 지시문
  P.push('# 출력\n' + (com.INSTRUCTION || '특기사항 본문만 한 문단으로 출력한다.'));

  return P.join('\n\n');
}

/** 역할 문장 조립 */
function buildRole(rec, sub, years) {
  years = years || 15;
  var base = rec && rec.role ? rec.role : '고등학교 교사';
  var filled = fillTokens(base, {
    교과: (sub && sub.kind === '교과' && sub.name) ? sub.name.replace(/\(.*?\)/g, '').trim() : '',
    연차: years
  });
  filled = filled.replace(/\s{2,}/g, ' ').replace(/^ /, '');
  // 교과 토큰이 비어 "  교과를" 처럼 남는 경우 정리
  filled = filled.replace(/^\s*교과를/, '여러 교과를');
  var who = (sub && sub.role) ? sub.role : '고등학교 교사';
  if (filled.indexOf(who) === -1 && sub && sub.kind === '교과') {
    return '당신은 ' + filled + '입니다. (' + who + ')';
  }
  return '당신은 ' + filled + '입니다.';
}

/** 학생 1명의 입력값들을 "컬럼|컬럼" 형태 1줄로 */
function buildStudentBlock(cols, values, opts) {
  opts = opts || {};
  var pairs = [];
  for (var i = 0; i < cols.length; i++) {
    var v = values[i];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    pairs.push(cols[i] + ': ' + String(v).trim().replace(/\n/g, ' '));
  }
  var out = pairs.join('\n');
  if (opts.grade) out += '\n성취수준: ' + opts.grade;
  return out;
}

/** 결과 검증 — 바이트 / 기재 금지 / 형식 */
function validateResult(text, limitBytes, banned, formatRules) {
  text = String(text || '');
  var issues = [];
  var b = byteLen(text);

  if (!text.trim()) return { ok: false, bytes: 0, issues: [{ level: 'block', label: '결과 없음', hit: '' }] };

  if (limitBytes && b > limitBytes) {
    issues.push({ level: 'block', label: '분량 초과', hit: b + ' / ' + limitBytes + '바이트' });
  } else if (limitBytes && b < limitBytes * 0.7) {
    issues.push({ level: 'check', label: '분량 부족', hit: b + ' / ' + limitBytes + '바이트' });
  }

  var all = (banned || []).concat(formatRules || []);
  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    if (!r || !r.re) continue;
    var m;
    try { m = text.match(new RegExp(r.re, 'g')); } catch (e) { continue; }
    if (m && m.length) {
      var uniq = [];
      for (var j = 0; j < m.length; j++) if (uniq.indexOf(m[j]) === -1) uniq.push(m[j]);
      issues.push({ level: r.level || 'check', label: r.label, hit: uniq.slice(0, 5).join(', ') });
    }
  }

  var blocks = issues.filter(function (x) { return x.level === 'block'; });
  return { ok: blocks.length === 0, bytes: b, issues: issues };
}

/** 검증 결과를 셀에 넣을 짧은 문자열로 */
function formatIssues(v) {
  if (!v.issues.length) return '통과 (' + v.bytes + 'B)';
  var parts = v.issues.map(function (x) {
    return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : '');
  });
  return (v.ok ? '확인필요 ' : '수정필요 ') + '(' + v.bytes + 'B)\n' + parts.join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    byteLen: byteLen, trimToBytes: trimToBytes, parseColumns: parseColumns,
    findByKey: findByKey, fillTokens: fillTokens, buildPrompt: buildPrompt,
    buildRole: buildRole, buildStudentBlock: buildStudentBlock,
    validateResult: validateResult, formatIssues: formatIssues
  };
}
