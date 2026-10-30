/**
 * 세특 작성 도우미 v3 — 학생 명단 해석 (순수 로직)
 * ---------------------------------------------------------------
 * 붙여넣은 글이든, 엑셀·CSV 파일에서 읽은 표든 같은 함수로 해석한다.
 *
 *   명단 방식 'class' : 반 · 번호 · 이름 · 성취수준          (담임·교과)
 *   명단 방식 'grade' : 학년 · 반 · 번호 · 이름 · 성취수준   (동아리·방과후처럼 학년이 섞일 때)
 *   'auto'           : 머리글이나 값을 보고 알아서 고른다
 *
 * 머리글이 있으면 이름으로 열을 찾고(순서 무관), 없으면 자리 순서로 읽는다.
 * "학번"(20315 = 2학년 3반 15번) 칸이나 "2학년 3반 15번 김하늘" 같은 글도 알아본다.
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/roster.test.js).
 * ---------------------------------------------------------------
 */

var ROSTER_HEAD = {
  'class': ['반', '번호', '이름', '성취수준'],
  'grade': ['학년', '반', '번호', '이름', '성취수준']
};

/** 머리글 한 칸이 무엇인지 */
function rosterHeadKind(cell) {
  var t = String(cell === null || cell === undefined ? '' : cell).replace(/\s+/g, '');
  if (!t) return '';
  if (/학번/.test(t)) return 'sid';
  if (/^(학년|년)$/.test(t)) return 'year';
  if (/^(반|학급|반명)$/.test(t)) return 'cls';
  if (/^(번호|번|출석번호)$/.test(t)) return 'no';
  if (/^(이름|성명|학생명|학생이름|성함)$/.test(t)) return 'name';
  if (/성취|수준|성취도/.test(t)) return 'level';
  return '';
}

/** 학번 → [학년, 반, 번호]. 5자리 20315, 4자리 2315(반이 한 자리일 때) */
function splitStudentId(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  if (s.length === 5) return [Number(s.charAt(0)), Number(s.slice(1, 3)), Number(s.slice(3))];
  if (s.length === 4) return [Number(s.charAt(0)), Number(s.charAt(1)), Number(s.slice(2))];
  return null;
}

function numOf_(v) {
  var m = String(v === null || v === undefined ? '' : v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function levelOf_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return '';
  var n = Number(s.replace(/[^0-9.]/g, ''));
  return (n >= 1 && n <= 5 && Math.floor(n) === n) ? n : null;   // null = 잘못된 값
}

function isSampleName_(name) {
  return /^(예시|\(예\)|예\)|홍길동)/.test(String(name || '').trim());
}

/** 붙여넣은 글 → 칸 나눈 줄들 */
function rosterTextToRows(text) {
  var out = [];
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var t = line.replace(/\u00A0/g, ' ').trim();
    if (!t) return;
    var cells = t.split(/\t|,|\s{2,}/).map(function (x) { return x.trim(); }).filter(String);
    if (cells.length < 3) cells = t.split(/\s+/);
    out.push(cells);
  });
  return out;
}

/**
 * 표(2차원 배열) → 학생 목록
 * @param {Array<Array>} rows
 * @param {string} mode 'class' | 'grade' | 'auto'
 * @return {{mode:string, students:Array<{year,cls,no,name,level}>, skipped:Array<{line:number, text:string, reason:string}>,
 *           warnings:string[], header:boolean}}
 */
function parseRosterRows(rows, mode) {
  rows = (rows || []).map(function (r) {
    return (Array.isArray(r) ? r : [r]).map(function (c) { return c === null || c === undefined ? '' : String(c).trim(); });
  });
  var res = { mode: mode, students: [], skipped: [], warnings: [], header: false };

  // 1) 머리글 줄 찾기 (앞쪽 10줄 안에서, '이름' 칸과 반/번호/학번 칸이 함께 있는 줄)
  var hIdx = -1, map = null;
  for (var i = 0; i < Math.min(rows.length, 10); i++) {
    var m = {};
    rows[i].forEach(function (c, j) { var k = rosterHeadKind(c); if (k && m[k] === undefined) m[k] = j; });
    if (m.name !== undefined && (m.cls !== undefined || m.no !== undefined || m.sid !== undefined)) { hIdx = i; map = m; break; }
  }

  var picked = [];
  if (map) {
    res.header = true;
    if (mode === 'auto') mode = (map.year !== undefined || map.sid !== undefined) ? 'grade' : 'class';
    for (var r = hIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row.some(String)) continue;
      var st = { year: '', cls: '', no: '', name: '', level: '' };
      if (map.sid !== undefined && (map.cls === undefined || !row[map.cls])) {
        var sp = splitStudentId(row[map.sid]);
        if (sp) { st.year = sp[0]; st.cls = sp[1]; st.no = sp[2]; }
      }
      if (map.year !== undefined && row[map.year] !== '') st.year = numOf_(row[map.year]);
      if (map.cls !== undefined && row[map.cls] !== '') st.cls = numOf_(row[map.cls]);
      if (map.no !== undefined && row[map.no] !== '') st.no = numOf_(row[map.no]);
      st.name = String(row[map.name] || '').trim();
      if (map.level !== undefined) st.level = levelOf_(row[map.level]);
      else if (!rows[hIdx][map.name + 1]) {   // 머리글 없는 바로 옆 칸에 1~5 가 있으면 성취수준으로 (예전 붙여넣기 호환)
        st.level = /^[1-5]$/.test(String(row[map.name + 1] || '').trim()) ? Number(row[map.name + 1]) : '';
      }
      picked.push({ st: st, line: r + 1, text: row.filter(String).join(' ') });
    }
  } else {
    // 2) 머리글 없음: 줄마다 값을 보고 읽는다
    var three = 0, sidN = 0, total = 0;
    var parsed = rows.map(function (row, r) {
      var cells = row.filter(String);
      if (!cells.length) return null;
      total++;
      var tagged = { year: null, cls: null, no: null }, nums = [], name = '', after = [];
      cells.forEach(function (c) {
        if (!name) {
          if (/^\d+\s*학년$/.test(c)) { tagged.year = numOf_(c); return; }
          if (/^\d+\s*반$/.test(c)) { tagged.cls = numOf_(c); return; }
          if (/^\d+\s*번$/.test(c)) { tagged.no = numOf_(c); return; }
          if (/^\d+$/.test(c)) { nums.push(c); return; }
          if (/[가-힣A-Za-z]/.test(c)) { name = c; return; }
        } else after.push(c);
      });
      var lv = '';
      for (var a = 0; a < after.length; a++) { if (/^\d$/.test(after[a])) { lv = levelOf_(after[a]); break; } }
      if (nums.length === 1 && /^\d{4,5}$/.test(nums[0]) && tagged.cls === null) sidN++;
      if (nums.length + (tagged.year !== null) + (tagged.cls !== null) + (tagged.no !== null) >= 3) three++;
      return { tagged: tagged, nums: nums, name: name, level: lv, line: r + 1, text: cells.join(' ') };
    });
    if (mode === 'auto') mode = (three + sidN > total / 2) ? 'grade' : 'class';
    parsed.forEach(function (p) {
      if (!p) return;
      var st = { year: '', cls: '', no: '', name: p.name, level: p.level };
      var nums = p.nums.slice();
      if (nums.length === 1 && /^\d{4,5}$/.test(nums[0]) && p.tagged.cls === null) {
        var sp = splitStudentId(nums[0]);
        st.year = sp[0]; st.cls = sp[1]; st.no = sp[2];
      } else {
        var order = mode === 'grade' ? ['year', 'cls', 'no'] : ['cls', 'no'];
        order.forEach(function (k) {
          if (p.tagged[k] !== null) st[k] = p.tagged[k];
          else if (nums.length) st[k] = Number(nums.shift());
        });
        if (mode === 'class' && p.tagged.year !== null) st.year = p.tagged.year;
      }
      picked.push({ st: st, line: p.line, text: p.text });
    });
  }
  res.mode = mode === 'grade' ? 'grade' : 'class';

  // 3) 걸러 내기 · 경고
  var seen = {}, badLevel = 0, noYear = 0;
  picked.forEach(function (p) {
    var st = p.st;
    if (!st.name) { res.skipped.push({ line: p.line, text: p.text, reason: '이름 없음' }); return; }
    if (isSampleName_(st.name)) { res.skipped.push({ line: p.line, text: p.text, reason: '양식의 예시 줄' }); return; }
    if (rosterHeadKind(st.name)) return;                             // 머리글이 한 번 더 나온 줄
    if (st.cls === '' || st.cls === null || st.no === '' || st.no === null) {
      res.skipped.push({ line: p.line, text: p.text, reason: '반 또는 번호 없음' }); return;
    }
    if (st.level === null) { badLevel++; st.level = ''; }
    if (res.mode === 'grade' && (st.year === '' || st.year === null)) noYear++;
    var key = (res.mode === 'grade' ? st.year + '-' : '') + st.cls + '-' + st.no;
    if (seen[key]) res.warnings.push('같은 ' + (res.mode === 'grade' ? '학년·' : '') + '반·번호가 두 번 있습니다: ' +
      key.replace(/-/g, ' ') + ' (' + seen[key] + ', ' + st.name + ')');
    else seen[key] = st.name;
    res.students.push(st);
  });
  if (badLevel) res.warnings.push('성취수준이 1~5가 아닌 값 ' + badLevel + '개는 비워 두었습니다.');
  if (noYear) res.warnings.push('학년이 비어 있는 학생이 ' + noYear + '명 있습니다.');

  res.students.sort(function (a, b) {
    return (Number(a.year) || 0) - (Number(b.year) || 0) || (Number(a.cls) || 0) - (Number(b.cls) || 0) ||
           (Number(a.no) || 0) - (Number(b.no) || 0);
  });
  return res;
}

/** 학생 → 명단 시트 한 줄 */
function rosterRowOf(st, mode) {
  return mode === 'grade' ? [st.year, st.cls, st.no, st.name, st.level] : [st.cls, st.no, st.name, st.level];
}

/** 활동 시트 A열에 보일 반 표시: 반 방식은 "3", 학년 방식은 "2-3" */
function classLabel(year, cls) {
  var y = String(year === null || year === undefined ? '' : year).trim();
  return y ? y + '-' + cls : cls;
}

/** "2학년 3반 15번 김하늘" */
function studentLabel(st) {
  return (st.year !== '' && st.year !== undefined && st.year !== null ? st.year + '학년 ' : '') +
         st.cls + '반 ' + st.no + '번 ' + (st.name || '');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROSTER_HEAD: ROSTER_HEAD, rosterHeadKind: rosterHeadKind, splitStudentId: splitStudentId,
    rosterTextToRows: rosterTextToRows, parseRosterRows: parseRosterRows, rosterRowOf: rosterRowOf,
    classLabel: classLabel, studentLabel: studentLabel
  };
}
