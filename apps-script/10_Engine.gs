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
 *   ⑥ 분량      ← 활동의 바이트 한도(없으면 기록종류 글자수×3) → 문장 자동 생성 + BYTE_RULE
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

/**
 * 활동의 바이트 한도 — [🗂 활동목록]의 바이트 한도(예전 시트는 글자수×3), 비었으면 기록 항목 한도.
 * 기록 항목 한도(나이스 한 칸)를 넘지 않는다. 한 기록 항목을 여러 활동이 나눠 쓸 때 활동마다 작게 정한다.
 */
function activityBytes(act, rec) {
  var cap = Number(rec && rec.chars || 500) * 3;
  var b = Number(act && act.bytes) || Number(act && act.chars || 0) * 3;
  return b > 0 ? Math.min(Math.round(b), cap) : cap;
}

/** 한도를 n 개 활동에 똑같이 나누기(남는 바이트는 앞 활동부터 1씩) */
function splitBytes(total, n) {
  total = Math.max(0, Math.floor(Number(total) || 0)); n = Math.max(1, Math.floor(Number(n) || 1));
  var each = Math.floor(total / n), rest = total - each * n, out = [];
  for (var i = 0; i < n; i++) out.push(each + (i < rest ? 1 : 0));
  return out;
}

/**
 * 같은 기록 항목(과세특은 같은 교과까지)을 나눠 쓰는 활동들의 한도 합 — 나이스 한 칸을 넘는지
 * @param {Array<{bytes?:number, chars?:number}>} acts
 * @return {{cap:number, sum:number, left:number, over:boolean}}
 */
function byteBudget(acts, rec) {
  var cap = Number(rec && rec.chars || 500) * 3, sum = 0;
  (acts || []).forEach(function (a) { sum += activityBytes(a, rec); });
  return { cap: cap, sum: sum, left: cap - sum, over: sum > cap };
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
 *   o.activity  {key,name,recordKey,subjectKey,bytes,columns,desc,mode,custom}  (bytes 대신 예전 chars 도 읽는다)
 *   o.record    기록종류 1건
 *   o.subject   교과영역 1건
 *   o.common    {WRITING_RULES, NEIS_RULES, BYTE_RULE, GRADE_RULE, INSTRUCTION}
 *   o.examples  예시 합본 문자열 (없으면 빈 문자열)
 *   o.years     교직 경력 표기 (기본 15)
 *   record.rules 이 기록 항목에만 붙는 기재 주의([🧩 기록종류]의 [기재 주의] — 기재요령 규칙판에서 옴)
 *   activity.mode '바로쓰기' 면 입력 자료가 교사의 자유 메모 한 칸이다
 *   activity.mode '보고서' 면 입력 자료가 [보고서 요점](교사가 확인한 것)과 [교사 관찰 메모]다
 *   o.styleSamples 예전에 쓴 세특 몇 편(쓰는 방식만 참고) · common.STYLE_CARD 내 문체 카드
 * @return {string}
 */
function buildPrompt(o) {
  var act = o.activity || {};
  var rec = o.record || {};
  var sub = o.subject || {};
  var com = o.common || {};
  var recBytes = Number(rec.chars || 500) * 3;
  var bytes = activityBytes(act, rec);
  var chars = Math.floor(bytes / 3);
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
      RECORD_RULES: rec.rules || '',
      STYLE_CARD: com.STYLE_CARD || '',
      EXAMPLES: o.examples || '',
      CHARS: chars,
      BYTES: bytes,
      RECORD_BYTES: recBytes,
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

  // ④ 기재 금지사항 (+ 이 기록 항목에만 해당하는 기재 주의)
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);
  if (rec.rules && String(rec.rules).trim()) {
    P.push('# 이 기록 항목의 기재 주의 (' + (rec.name || act.recordKey || '') + ')\n' + String(rec.rules).trim());
  }

  // ⑤ 관점 · 역량
  var persp = [];
  if (rec.view) persp.push(rec.view);
  if (sub.comp) persp.push(sub.comp);
  if (persp.length) P.push('# 서술 관점과 역량\n' + persp.join('\n\n'));

  // ⑥ 분량 (단일 출처)
  // 2026 기재요령: 최대 글자 수 안에서 교사가 자율적으로 입력한다. 분량을 채우려 지어내면 허위·과장 기재가 된다.
  var len = ['# 분량'];
  if (bytes < recBytes) {
    len.push('- 이 활동은 ' + (rec.name || '이 기록 항목') + ' 한 칸(' + recBytes + '바이트) 가운데 한 부분이다. ' +
             '같은 학생의 다른 활동 기록과 합쳐 들어가므로 이 활동의 몫만 쓴다.');
  }
  len.push('- ' + bytes + '바이트(한글 약 ' + chars + '자) 이내로 작성한다. 넘으면 안 된다.');
  len.push('- 자료가 충분하면 ' + Math.round(bytes * 0.9) + '바이트 안팎으로 충실하게 쓰되, 자료에 없는 내용으로 분량을 채우지 않는다. 자료가 적으면 짧게 쓴다.');
  if (com.BYTE_RULE) len.push(com.BYTE_RULE);
  P.push(len.join('\n'));

  // ⑦-1 입력 형식
  if (String(act.mode || '') === '바로쓰기') {
    P.push('# 입력 자료 형식\n아래 학생 자료는 교사가 수업·활동 중에 관찰하고 자유롭게 적은 메모다. ' +
           '메모에 있는 사실만 근거로 문장을 다듬어 쓴다. 메모가 짧으면 짧게 쓴다.');
  } else if (String(act.mode || '') === '보고서') {
    P.push('# 입력 자료 형식\n아래 학생 자료는 학생이 수업 중에 쓴 보고서에서 뽑아 교사가 확인한 [보고서 요점]과, ' +
           '교사가 수업에서 직접 본 [교사 관찰 메모]다.\n' +
           '- 보고서 요점은 학생이 쓴 내용이다. 그대로 옮기지 말고, 교사가 수업과 평가에서 관찰한 탐구 과정과 사고의 변화로 서술한다.\n' +
           '- 교사 관찰 메모가 있으면 그것을 가장 앞세운다. 요점과 메모가 다르면 메모를 따른다.\n' +
           '- 보고서 제목, 참고문헌, 연구보고서 실적(제목·주제·참여 인원·소요 시간)은 쓰지 않는다.');
  } else if (cols.length) {
    P.push('# 입력 자료 형식\n아래 학생 자료는 다음 항목이 | 로 구분되어 제공된다.\n' + cols.join('|'));
  }

  // ⑦-2 예시 (문체 예시 → 활동 예시 순)
  if (o.styleSamples && String(o.styleSamples).trim()) {
    P.push('# 문체 예시 — 선생님이 예전에 쓴 세특\n내용·소재는 따르지 말고 문장 길이, 여는 방식, 끝맺음, 이음말 같은 쓰는 방식만 따른다.\n\n' +
           String(o.styleSamples).trim());
  }
  if (o.examples && String(o.examples).trim()) {
    P.push('# 예시\n표현 방식과 서술 흐름을 참고한다. 문장을 그대로 베끼지 않는다.\n\n' + String(o.examples).trim());
  }

  // ⑦-3 성취수준 (해당 기록 종류에만)
  if (rec.useGrade && com.GRADE_RULE) {
    P.push('# 성취수준 반영\n' + com.GRADE_RULE);
  }

  // ⑦-4 내 문체 카드 — 규칙 맨 끝(출력 바로 앞)에 두고, 학생 자료 뒤에도 한 번 더 붙인다(styleTail)
  if (com.STYLE_CARD && String(com.STYLE_CARD).trim()) {
    P.push('# 내 문체 (예시와 함께 가장 우선해서 따른다)\n' + String(com.STYLE_CARD).trim());
  }

  // ⑦-5 마무리 지시문
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

/**
 * 결과 검증 — 바이트 / 기재 금지 / 형식 / 맞춤법
 * 규칙마다 fix(바른 표기)·why(이유·근거)가 있으면 issue 에 함께 싣는다.
 * spellIssues(16_Rules.gs)가 있으면 띄어쓰기·어미 검사도 더한다(opts.spell === false 면 뺀다).
 */
function validateResult(text, limitBytes, banned, formatRules, opts) {
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
      var issue = { level: r.level || 'check', label: r.label, hit: uniq.slice(0, 5).join(', ') };
      if (r.fix) issue.fix = r.fix;
      if (r.why) issue.why = r.why;
      issues.push(issue);
    }
  }
  if (typeof spellIssues === 'function' && !(opts && opts.spell === false)) {
    issues = issues.concat(spellIssues(text));
  }

  var blocks = issues.filter(function (x) { return x.level === 'block'; });
  return { ok: blocks.length === 0, bytes: b, issues: issues };
}

/** 검증 결과를 셀에 넣을 짧은 문자열로 */
function formatIssues(v) {
  if (!v.issues.length) return '통과 (' + v.bytes + 'B)';
  var parts = v.issues.map(function (x) {
    return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : '') +
           (x.fix ? ' (바르게: ' + x.fix + ')' : '');
  });
  return (v.ok ? '확인필요 ' : '수정필요 ') + '(' + v.bytes + 'B)\n' + parts.join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    byteLen: byteLen, trimToBytes: trimToBytes, parseColumns: parseColumns,
    findByKey: findByKey, fillTokens: fillTokens, buildPrompt: buildPrompt,
    activityBytes: activityBytes, splitBytes: splitBytes, byteBudget: byteBudget,
    buildRole: buildRole, buildStudentBlock: buildStudentBlock,
    validateResult: validateResult, formatIssues: formatIssues
  };
}
