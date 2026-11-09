/**
 * 세특 작성 도우미 v3 — ⚖️ 학생 간 같은 문장 · 분량 격차 점검 (순수 함수 — Node 시험 가능)
 *
 * 2026 기재요령 · 훈령은 서술형 항목의 내용이 학생 간에 같거나(전체 동일), 학생 사이가 뒤바뀌거나, 통째로 빠진 것을
 * 입력 주체의 과실로 보아 정정 사유로 삼는다. 한 반 학생을 한꺼번에 AI 로 쓰면 비슷한 문장이 여러 학생에 퍼지거나
 * 어떤 학생만 훨씬 짧아지기 쉬워, [최종본]을 모아 보고 다음 셋을 알린다(고치는 것은 선생님).
 *   · 같은 문장: 두 학생의 [최종본]이 열 글자씩 끊은 조각의 40% 이상을 공유
 *   · 분량 격차: 중앙값의 절반 미만이거나 1.6배 초과 (학생 4명 이상일 때)
 *   · 빈 [최종본]: 입력이 빠진 학생
 * 학생 자료는 어디로도 보내지 않고 이 시트 안에서만 비교한다.
 */

var EQUITY_GRAM = 10;
var EQUITY_SIMILAR = 0.4;

/** 공백 · 문장부호를 지운 글 */
function equityNorm_(s) { return String(s === null || s === undefined ? '' : s).replace(/[\s.,·\-–—'"“”‘’()\[\]!?]/g, ''); }

/** 열 글자씩 끊은 조각 집합 {조각: true} */
function equityGrams_(text) {
  var t = equityNorm_(text), out = {}, n = 0;
  for (var i = 0; i + EQUITY_GRAM <= t.length; i++) { out[t.substr(i, EQUITY_GRAM)] = true; n++; }
  return { set: out, size: Object.keys(out).length };
}

/** 두 글이 얼마나 겹치는지 0~1 (짧은 쪽 조각 가운데 다른 쪽에도 있는 비율) */
function equitySimilarity(a, b) {
  var A = equityGrams_(a), B = equityGrams_(b);
  if (!A.size || !B.size) return 0;
  var small = A.size <= B.size ? A : B, big = A.size <= B.size ? B : A, same = 0;
  Object.keys(small.set).forEach(function (g) { if (big.set[g]) same++; });
  return same / small.size;
}

function equityMedian_(nums) {
  var v = nums.slice().sort(function (x, y) { return x - y; }), m = Math.floor(v.length / 2);
  return v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : 0;
}

/**
 * @param {Array<{label:string, text:string}>} items  학생마다 [최종본]
 * @return {{n:number, filled:number, median:number, similar:Array<{a:string,b:string,ratio:number}>,
 *           gaps:Array<{label:string, bytes:number, kind:string}>, empty:string[]}}
 */
function checkEquity(items) {
  items = (items || []).map(function (x) { return { label: x.label, text: String(x.text || '').trim() }; });
  var filled = items.filter(function (x) { return x.text; });
  var out = { n: items.length, filled: filled.length, median: 0, similar: [], gaps: [], empty: [] };
  out.empty = items.filter(function (x) { return !x.text; }).map(function (x) { return x.label; });
  var grams = filled.map(function (x) { return equityGrams_(x.text); });
  for (var i = 0; i < filled.length; i++) {
    for (var j = i + 1; j < filled.length; j++) {
      var A = grams[i], B = grams[j];
      if (!A.size || !B.size) continue;
      var small = A.size <= B.size ? A : B, big = A.size <= B.size ? B : A, same = 0, k, keys = Object.keys(small.set);
      for (k = 0; k < keys.length; k++) if (big.set[keys[k]]) same++;
      var r = same / small.size;
      if (r >= EQUITY_SIMILAR) out.similar.push({ a: filled[i].label, b: filled[j].label, ratio: Math.round(r * 100) / 100 });
    }
  }
  out.similar.sort(function (x, y) { return y.ratio - x.ratio; });
  var bytes = filled.map(function (x) { return byteLen(x.text); });
  out.median = equityMedian_(bytes);
  if (filled.length >= 4 && out.median) {
    filled.forEach(function (x, i) {
      if (bytes[i] < out.median * 0.5) out.gaps.push({ label: x.label, bytes: bytes[i], kind: '짧음' });
      else if (bytes[i] > out.median * 1.6) out.gaps.push({ label: x.label, bytes: bytes[i], kind: '긺' });
    });
  }
  return out;
}

/** 점검 결과를 알림 글로 */
function equityReportText(r, sheetName) {
  var L = ['[' + sheetName + '] 학생 ' + r.n + '명 가운데 [최종본]이 있는 학생 ' + r.filled + '명'];
  var ok = !r.similar.length && !r.gaps.length && !r.empty.length;
  if (ok) L.push('', '✓ 같은 문장 · 분량 격차 · 빈 칸이 없습니다.');
  if (r.similar.length) {
    L.push('', '같은 문장이 많은 학생 ' + r.similar.length + '쌍 (겹침 %)');
    r.similar.slice(0, 10).forEach(function (p) { L.push('  · ' + p.a + ' ↔ ' + p.b + ' — ' + Math.round(p.ratio * 100) + '%'); });
    if (r.similar.length > 10) L.push('  … 외 ' + (r.similar.length - 10) + '쌍');
  }
  if (r.gaps.length) {
    L.push('', '분량 차이가 큰 학생 (중앙값 ' + r.median + '바이트)');
    r.gaps.slice(0, 10).forEach(function (g) { L.push('  · ' + g.label + ' — ' + g.bytes + '바이트 (' + g.kind + ')'); });
    if (r.gaps.length > 10) L.push('  … 외 ' + (r.gaps.length - 10) + '명');
  }
  if (r.empty.length) {
    L.push('', '[최종본]이 빈 학생 ' + r.empty.length + '명: ' + r.empty.slice(0, 8).join(', ') + (r.empty.length > 8 ? ' 외 ' + (r.empty.length - 8) + '명' : ''));
  }
  if (!ok) L.push('', '같은 문장은 학생마다 그 학생이 한 일로 고쳐 쓰고, 분량 차이는 관찰 메모를 더 적어 맞추세요. 판단은 선생님이 합니다.');
  return L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { equitySimilarity: equitySimilarity, checkEquity: checkEquity, equityReportText: equityReportText };
}
