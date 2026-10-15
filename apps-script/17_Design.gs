/**
 * 세특 작성 도우미 v3 — 🪄 예시로 칸 채우기 (순수 함수: 시트·네트워크 없음, Node 시험 가능)
 * ---------------------------------------------------------------
 * 교사가 "이렇게 나왔으면" 하는 결과(세특 예시)를 1~5편 주면, 같은 활동의 다른 학생도 그런 글이 나오도록
 * 프롬프트의 빈칸을 거꾸로 채운다 — 활동 이름 · 활동 개요 · 입력 항목 · 예시마다의 학생 자료.
 * 바이트 한도는 AI 가 아니라 예시 길이로 셈한다(suggestBytes).
 *
 * 세특 프롬프트 공방(웹·시트 안)의 [AI로 칸 채우기] 탭이 쓴다. 웹은 요청문 복사 → 답 붙여 넣기,
 * 시트 안에서 API 키가 있으면 studioDesign()(88_Studio.gs)이 바로 부른다. 답은 같은 parseDesignAnswer 로 읽는다.
 */

var DESIGN_SYSTEM = [
  '당신은 학교생활기록부 특기사항(세특) 프롬프트를 설계하는 조수입니다.',
  '교사가 "이렇게 나오면 좋겠다"는 완성된 특기사항 예시를 줍니다. 같은 활동의 다른 학생에게도 이런 글이 나오도록,',
  '프롬프트의 빈칸(활동 개요, 입력 항목, 예시마다의 학생 자료)을 채웁니다.',
  '',
  '# 지킬 것',
  '- 예시 글에 있는 내용만 근거로 한다. 예시에 없는 활동 내용이나 학생 정보를 지어내지 않는다.',
  '- 활동 개요: 이 활동이 무엇이고, 이 활동의 세특에서 무엇이 드러나야 하는지 1~2문장.',
  '- 입력 항목: 교사가 학생마다 적을 칸 이름 3~6개. 예시 글의 문장들이 어느 칸의 메모에서 왔을지 거꾸로 생각해,',
  '  과정이 드러나게 정한다(예: 탐구 주제, 고른 까닭, 방법, 알게 된 점, 교사 관찰). 짧은 명사구로 쓰고 | 로 나눈다.',
  '  반·번호·이름·성취수준·최종본·AI 결과·바이트·검증은 쓰지 않는다. 교사가 정해 둔 입력 항목이 있으면 되도록 그대로 쓴다.',
  '- 예시마다: 그 글을 쓰기 위해 교사가 적었을 법한 학생 자료를 입력 항목별로 짧게(한 칸에 한두 문장, 메모체) 쓴다.',
  '  예시 글에 있는 사실만 옮기고, "우수함", "뛰어남" 같은 평가 말은 빼고 관찰한 사실만 남긴다.',
  '  교사가 이미 적어 둔 학생 자료가 있으면 내용은 바꾸지 말고 입력 항목에 맞게 나누기만 한다.',
  '- 학생 이름, 대학명·기관명, 수상, 자격증, 공인어학시험처럼 학생부에 쓸 수 없는 것은 옮기지 않는다.',
  '',
  '# 출력 — 아래 모양 그대로. 머리말·설명·마크다운 없이',
  '활동 이름: (짧게, 20자 이내)',
  '활동 개요: (1~2문장)',
  '입력 항목: 항목1|항목2|항목3',
  '[예시1]',
  '항목1: …',
  '항목2: …',
  '항목3: …',
  '[예시2]',
  '항목1: …',
  '(예시 수만큼)'
].join('\n');

/**
 * AI 에게 보낼 사용자 글
 * @param {{record?:{name,chars}, subject?:{key,name,kind}, name?:string, desc?:string, columns?:string[],
 *          bytes?:number, examples:Array<{in?:string, out:string}>}} p
 */
function buildDesignUser(p) {
  p = p || {};
  var rec = p.record || {}, sub = p.subject || {};
  var L = [];
  L.push('기록 항목: ' + (rec.name || '학교생활기록부 특기사항') + (p.bytes ? ' (이 활동은 ' + p.bytes + '바이트 이내)' : ''));
  if (sub.kind === '교과' && (sub.name || sub.key)) L.push('교과: ' + String(sub.name || sub.key).replace(/\(.*?\)/g, '').trim());
  if (String(p.name || '').trim()) L.push('교사가 정한 활동 이름: ' + String(p.name).trim());
  if (String(p.desc || '').trim()) L.push('교사가 적은 활동 개요: ' + String(p.desc).trim().replace(/\s*\n\s*/g, ' '));
  var cols = (p.columns || []).map(function (c) { return String(c).trim(); }).filter(String);
  if (cols.length) L.push('교사가 정한 입력 항목(되도록 그대로): ' + cols.join('|'));
  var ex = (p.examples || []).filter(function (e) { return e && String(e.out || '').trim(); });
  ex.forEach(function (e, i) {
    L.push('');
    L.push('# 예시' + (i + 1));
    if (String(e.in || '').trim()) {
      L.push('## 교사가 적어 둔 학생 자료 (내용은 그대로, 입력 항목에 맞게 나누기만)');
      L.push(String(e.in).trim());
    }
    L.push('## 이렇게 나오면 좋겠다는 결과');
    L.push(String(e.out).trim());
  });
  L.push('');
  L.push('예시는 ' + ex.length + '편이다. [예시1]부터 [예시' + ex.length + ']까지 모두 쓴다.');
  return L.join('\n');
}

var DESIGN_RESERVED = ['반', '번호', '이름', '성취수준', '생성', '모델', 'AI 결과', '최종본', '바이트', '검증'];

/**
 * AI 답 → 칸 채우기 제안
 * @param {string} text
 * @param {number} n 보낸 예시 수(모자라면 missing 에 적는다)
 * @return {{name:string, desc:string, columns:string[], examples:string[], missing:string[]}}
 *   examples[i] = "항목: 값" 줄들(입력 항목 순서) — 공방의 예시 학생 자료 칸에 그대로 넣는다
 */
function parseDesignAnswer(text, n) {
  var t = String(text || '').replace(/\r/g, '').replace(/^\s*```[a-z]*\s*$/gim, '').replace(/\*\*/g, '');
  var head = {}, blocks = [], cur = null;
  t.split('\n').forEach(function (raw) {
    var line = raw.replace(/\s+$/, '');
    var mb = /^\s*(?:#+\s*)?\[?\s*예시\s*(\d+)\s*\]?\s*:?\s*$/.exec(line);
    if (mb) { cur = []; blocks[Number(mb[1]) - 1] = cur; return; }
    var mh = /^\s*(?:[-*•]\s*)?(활동\s*이름|활동명|활동\s*개요|입력\s*항목)\s*[:：]\s*(.*)$/.exec(line);
    if (mh && !cur) { head[mh[1].replace(/\s+/g, '')] = mh[2].trim(); return; }
    if (cur && line.trim()) cur.push(line.trim().replace(/^[-*•]\s*/, ''));
  });
  var name = String(head['활동이름'] || head['활동명'] || '').trim().slice(0, 30);
  var desc = String(head['활동개요'] || '').trim();
  var seen = {};
  var columns = String(head['입력항목'] || '').split(/[|,]/).map(function (x) { return x.trim(); })
    .filter(function (x) { if (!x || seen[x] || DESIGN_RESERVED.indexOf(x) >= 0) return false; seen[x] = 1; return true; }).slice(0, 12);
  var examples = [];
  for (var i = 0; i < Math.max(n || 0, blocks.length); i++) {
    var lines = blocks[i] || [];
    if (!columns.length) { examples.push(lines.join('\n')); continue; }
    var vals = exampleValuesFrom(columns, lines.join('\n'));
    examples.push(columns.map(function (c, k) { return vals[k] ? c + ': ' + vals[k] : ''; }).filter(String).join('\n'));
  }
  var missing = [];
  if (!columns.length) missing.push('입력 항목');
  if (!desc) missing.push('활동 개요');
  for (var k = 0; k < (n || 0); k++) if (!examples[k]) missing.push('예시' + (k + 1) + ' 학생 자료');
  return { name: name, desc: desc, columns: columns, examples: examples.slice(0, Math.max(n || 0, 0) || examples.length), missing: missing };
}

/**
 * 예시 결과 길이로 바이트 한도 제안 — 엔진이 한도의 90% 안팎을 쓰게 하므로 가장 긴 예시 ÷ 0.9, 10 단위 올림.
 * 한 칸(cap)을 넘지 않고, 150바이트보다 작게 하지 않는다. 예시가 없으면 0.
 */
function suggestBytes(texts, cap) {
  var max = 0;
  (texts || []).forEach(function (t) { var b = byteLen(String(t || '').trim()); if (b > max) max = b; });
  if (!max) return 0;
  var s = Math.ceil(max / 0.9 / 10) * 10;
  return Math.max(150, Math.min(Number(cap) || s, s));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DESIGN_SYSTEM: DESIGN_SYSTEM, buildDesignUser: buildDesignUser,
    parseDesignAnswer: parseDesignAnswer, suggestBytes: suggestBytes
  };
}
