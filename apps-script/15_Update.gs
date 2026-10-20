/**
 * 세특 작성 도우미 v3 — 새 버전 알림 · 이전 파일에서 가져오기 (순수 함수)
 * ---------------------------------------------------------------
 * 사본은 만든 순간의 코드로 굳는다. 그래서
 *   1) 만든이의 GitHub 에 올린 version.json 을 읽어 "새 버전이 나왔어요"를 알리고
 *   2) 새 버전 사본에서 예전 사본의 링크를 붙여 넣으면 학생명단·활동·예시·결과·문체·설정을 옮겨 온다.
 * 예전 파일은 xlsx 로 내려받아(drive.readonly 권한 안에서) 이 파일의 함수로 읽는다 — 시트 API 를 켜지 않아도 된다.
 * 머리글 이름으로 옮기므로 버전이 달라 열 순서가 바뀌어도 따라간다.
 * (node test/update.test.js)
 */

var UPDATE_URL = 'https://raw.githubusercontent.com/sced9120/Prompt-Master/main/version.json';
var MASTER_COPY_URL = 'https://docs.google.com/spreadsheets/d/11FNX77xBegfn1lw0GhkBAFvLtyxm8NS1ktfbs309vZM/copy';

/**
 * 예전 판의 기본 문구 — 기본값을 고칠 때 바뀌기 전 문구를 여기에 더해 두면,
 * 예전 사본에서 가져올 때 "선생님이 고친 칸"으로 잘못 보고 새 문구를 덮어쓰지 않는다.
 */
var OLD_PRESET_TEXTS = [];

/* ------------------------------------------------------------ 버전 */
/** 'v3.8.2' → [3, 8, 2] (모르는 글자는 0) */
function versionParts(v) {
  var m = String(v || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : [0, 0, 0];
}

/** a 가 b 보다 새로우면 1, 같으면 0, 오래되면 -1 */
function compareVersions(a, b) {
  var x = versionParts(a), y = versionParts(b);
  for (var i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1; }
  return 0;
}

/** version.json 글 → {version, date, copyUrl, title, notes[]} (모양이 이상하면 null) */
function parseVersionInfo(text) {
  var o;
  try { o = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return null; }
  if (!o || !/\d+\.\d+/.test(String(o.version || ''))) return null;
  var url = String(o.copyUrl || '');
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}\/copy/.test(url)) url = MASTER_COPY_URL;
  return {
    version: 'v' + versionParts(o.version).join('.'),
    date: String(o.date || ''),
    title: String(o.title || ''),
    copyUrl: url,
    notes: (Array.isArray(o.notes) ? o.notes : []).map(String).filter(function (s) { return s.trim(); }).slice(0, 12)
  };
}

/** 지금 판과 최신 판 비교 → {available, current, latest, ...} */
function updateState(current, info) {
  if (!info) return { available: false, current: current, latest: '', notes: [], copyUrl: MASTER_COPY_URL };
  return { available: compareVersions(info.version, current) > 0, current: current, latest: info.version,
           date: info.date, title: info.title, notes: info.notes, copyUrl: info.copyUrl };
}

/** 스프레드시트 링크(또는 ID)에서 파일 ID */
function spreadsheetIdIn(text) {
  var t = String(text || '').trim();
  var m = t.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]{20,})/) || t.match(/[?&]id=([\w-]{20,})/);
  if (m) return m[1];
  return /^[\w-]{25,}$/.test(t) ? t : '';
}

/* ------------------------------------------------------- xlsx 읽기 */
function xmlUnescape(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(Number(d)); })
    .replace(/&amp;/g, '&');
}

/** <t> 조각을 모두 이어 붙인 글 (서식 있는 글자 run 포함) */
function xmlTexts_(xml) {
  var out = '', re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g, m;
  while ((m = re.exec(xml))) out += m[1] ? xmlUnescape(m[1]) : '';
  return out;
}

/** 'AB12' → 열 번호(0부터) */
function colIndexOf(ref) {
  var letters = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase(), n = 0;
  for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSharedStrings(xml) {
  var out = [], re = /<si>([\s\S]*?)<\/si>|<si\/>/g, m;
  while ((m = re.exec(String(xml || '')))) out.push(m[1] ? xmlTexts_(m[1]) : '');
  return out;
}

/** 시트 XML → 행 배열(1행이 [0]). 빈 칸은 '' */
function parseSheetXml(xml, shared) {
  var rows = [], width = 0;
  var rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, rm;
  while ((rm = rowRe.exec(String(xml || '')))) {
    var rAttr = (rm[1].match(/\br="(\d+)"/) || [])[1];
    var ri = rAttr ? Number(rAttr) - 1 : rows.length;
    var row = [];
    var cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, ci = 0;
    while ((cm = cellRe.exec(rm[2] || ''))) {
      var attr = cm[1], body = cm[2] || '';
      var ref = (attr.match(/\br="([A-Z]+)\d*"/i) || [])[1];
      if (ref) ci = colIndexOf(ref);
      var t = (attr.match(/\bt="(\w+)"/) || [])[1] || 'n';
      var vm = body.match(/<v>([\s\S]*?)<\/v>/);
      var raw = vm ? xmlUnescape(vm[1]) : '';
      var val;
      if (t === 's') val = (shared || [])[Number(raw)] || '';
      else if (t === 'inlineStr') val = xmlTexts_(body);
      else if (t === 'b') val = raw === '1';
      else if (t === 'str' || t === 'e') val = raw;
      else val = raw === '' ? '' : (isNaN(Number(raw)) ? raw : Number(raw));
      while (row.length < ci) row.push('');
      row[ci] = val;
      ci++;
    }
    while (rows.length < ri) rows.push([]);
    rows[ri] = row;
    if (row.length > width) width = row.length;
  }
  return rows.map(function (r) { while (r.length < width) r.push(''); return r; });
}

/** zip 안 파일들 {경로: XML} → {시트 이름: 행 배열} */
function readXlsxParts(parts) {
  var p = {};
  Object.keys(parts || {}).forEach(function (k) { p[String(k).replace(/^\/+/, '')] = parts[k]; });
  var wb = p['xl/workbook.xml'];
  if (!wb) throw new Error('엑셀 파일 모양이 아닙니다(workbook.xml 없음).');
  var rels = {}, rm, relRe = /<Relationship\b([^>]*)\/?>/g;
  while ((rm = relRe.exec(p['xl/_rels/workbook.xml.rels'] || ''))) {
    var id = (rm[1].match(/\bId="([^"]+)"/) || [])[1], target = (rm[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) rels[id] = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  var shared = parseSharedStrings(p['xl/sharedStrings.xml'] || '');
  var out = {}, sm, shRe = /<sheet\b([^>]*)\/?>/g, n = 0;
  while ((sm = shRe.exec(wb))) {
    n++;
    var name = xmlUnescape((sm[1].match(/\bname="([^"]*)"/) || [])[1] || ('Sheet' + n));
    var rid = (sm[1].match(/\br:id="([^"]+)"/) || sm[1].match(/\bid="([^"]+)"/) || [])[1];
    var path = rels[rid] || ('xl/worksheets/sheet' + n + '.xml');
    out[name] = parseSheetXml(p[path] || '', shared);
  }
  return out;
}

/* ------------------------------------------------------- 표 다루기 */
/** 행 배열에서 headRow(0부터) 를 머리글로 → {head:[], rows:[{머리글:값, __i}]} (빈 줄 제외) */
function tableOf(rows, headRow) {
  var head = ((rows || [])[headRow] || []).map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = headRow + 1; i < (rows || []).length; i++) {
    var r = rows[i] || [], o = { __i: i }, empty = true;
    head.forEach(function (h, c) {
      if (!h) return;
      var v = r[c] === undefined ? '' : r[c];
      o[h] = v;
      if (v !== '' && v !== false && v !== null) empty = false;
    });
    if (!empty) out.push(o);
  }
  return { head: head, rows: out };
}

/** 같은 글인지 (줄바꿈·공백 차이 무시) */
function sameText_(a, b) { return String(a === null || a === undefined ? '' : a).replace(/\s+/g, ' ').trim() === String(b === null || b === undefined ? '' : b).replace(/\s+/g, ' ').trim(); }

/**
 * 키로 맞춰 보는 표 합치기 — [🧩 기록종류]·[📚 교과영역]·[📐 공통규칙]·[⚙️ 설정] 공용.
 *   · 예전에만 있는 키 → 새 줄(append)
 *   · 둘 다 있는 키 → 예전 값이 기본값과 다르고(선생님이 고침) 지금 값은 아직 기본값이면 예전 값으로(update)
 *     예전 값이 OLD_PRESET_TEXTS(옛 기본 문구)면 고친 것으로 보지 않는다.
 * @param {Array<Object>} oldRows  예전 표 줄
 * @param {Array<Object>} curRows  지금 표 줄
 * @param {Object} presets  {키: {열: 기본값}} — 없으면 지금 값을 기본값으로 본다
 * @param {string} keyCol  @param {string[]} cols 옮길 열
 * @return {{appends:Array<Object>, updates:Array<{key:string, col:string, value:*}>}}
 */
function mergeKeyed(oldRows, curRows, presets, keyCol, cols) {
  var cur = {}, out = { appends: [], updates: [] };
  (curRows || []).forEach(function (r) { var k = String(r[keyCol] || '').trim(); if (k) cur[k] = r; });
  var seen = {};
  (oldRows || []).forEach(function (r) {
    var k = String(r[keyCol] || '').trim();
    if (!k || seen[k]) return;
    seen[k] = 1;
    if (!cur[k]) { out.appends.push(r); return; }
    var pre = (presets || {})[k];
    cols.forEach(function (c) {
      if (!r.hasOwnProperty(c) || !cur[k].hasOwnProperty(c)) return;
      var ov = r[c], cv = cur[k][c];
      if (sameText_(ov, cv)) return;
      var base = pre && pre.hasOwnProperty(c) ? pre[c] : undefined;
      if (base === undefined) {                                // 기본값을 모르면: 지금 칸이 비었을 때만 채운다
        if (String(cv === null || cv === undefined ? '' : cv).trim() === '') out.updates.push({ key: k, col: c, value: ov });
        return;
      }
      if (sameText_(ov, base)) return;                         // 예전 것은 손대지 않은 기본값
      if (OLD_PRESET_TEXTS.some(function (t) { return sameText_(t, ov); })) return;
      if (!sameText_(cv, base)) return;                        // 새 파일에서 이미 고친 칸
      out.updates.push({ key: k, col: c, value: ov });
    });
  });
  return out;
}

/** 학생 줄 열쇠 — "A열-번호" (활동·취합 시트 공용) */
function studentKeyOf(row, head) {
  var a = row[head[0]], no = row['번호'];
  return String(a === undefined ? '' : a).trim() + '-' + String(no === undefined ? '' : no).trim();
}

/**
 * 예전 사본의 활동 한 줄 → createActivity_ 에 넘길 정의.
 * @param {Object} row  [🗂 활동목록] 한 줄
 * @param {Array<Array>} exRows  예전 예시 시트(행 배열) 또는 null
 */
function activityDefFromOld(row, exRows) {
  var cols = String(row['입력 항목'] || '').split(/\s*[|,]\s*/).map(function (s) { return s.trim(); }).filter(String);
  var mode = String(row['프롬프트 모드'] || '자동').trim() || '자동';
  var bytes = Number(row['바이트 한도'] || 0) || (Number(row['글자수'] || 0) * 3) || 0;
  var examples = [];
  if (exRows) {
    var t = tableOf(exRows, 2);
    t.rows.forEach(function (r) {
      var values = cols.map(function (c) { return String(r.hasOwnProperty(c) ? r[c] : '').trim(); });
      var result = String(r['결과'] || '').trim();
      if (result || values.some(String)) examples.push({ values: values, result: result });
    });
  }
  return {
    key: String(row['활동키'] || '').trim(), name: String(row['활동명'] || row['활동키'] || '').trim(),
    recordKey: String(row['기록종류'] || '').trim(), subjectKey: String(row['교과영역'] || '').trim(),
    bytes: bytes, columns: cols, desc: String(row['활동 개요'] || ''),
    mode: mode, custom: String(row['직접 작성 프롬프트'] || ''),
    inSheet: String(row['입력 시트'] || '').trim(), exSheet: String(row['예시 시트'] || '').trim(),
    examples: examples
  };
}

/**
 * 예전 시트의 학생 줄 → 새 시트 머리글 순서의 줄. 수식으로 채우는 열(바이트·합본 바이트)은 비운다.
 * @param {Array<Array>} oldRows 예전 시트(행 배열)  @param {string[]} newHead 새 시트 머리글
 * @param {number} headRow 머리글 행(0부터)
 * @return {Array<Array>}
 */
function remapStudentRows(oldRows, newHead, headRow) {
  var t = tableOf(oldRows, headRow);
  var skip = ['바이트'];
  var aliases = { '반': ['학년-반'], '학년-반': ['반'] };
  return t.rows.filter(function (r) {
    var a = r[t.head[0]], nm = r['이름'];
    return String(a === undefined ? '' : a).trim() !== '' || String(nm === undefined ? '' : nm).trim() !== '';
  }).map(function (r) {
    return newHead.map(function (h, i) {
      if (skip.indexOf(h) >= 0) return '';
      if (i === 0) return r[t.head[0]];
      if (r.hasOwnProperty(h)) return r[h];
      var al = (aliases[h] || []).filter(function (x) { return r.hasOwnProperty(x); })[0];
      return al ? r[al] : (h === '생성' || h === '압축' ? false : '');
    });
  });
}

/** 가져오기 결과 → 사람이 읽는 줄들 */
function importReportLines(rep) {
  var L = [];
  if (rep.roster) L.push('👤 학생 ' + rep.roster + '명');
  if (rep.activities.length) L.push('🗂 활동 ' + rep.activities.length + '개 — ' + rep.activities.map(function (a) {
    return a.name + '(학생 ' + a.rows + '줄' + (a.examples ? ' · 예시 ' + a.examples + '편' : '') + ')';
  }).join(', '));
  if (rep.compile.length) L.push('📦 최종취합 ' + rep.compile.join(', ') + ' — 다듬어 둔 [최종본] 포함');
  if (rep.style) L.push('✒️ 내 문체 ' + rep.style + '편');
  if (rep.settings.length) L.push('⚙️ 설정 ' + rep.settings.length + '개 — ' + rep.settings.join(', '));
  if (rep.models) L.push('🤖 모델 목록에 직접 넣은 모델 ' + rep.models + '개');
  if (rep.records.length) L.push('🧩 기록종류 ' + rep.records.join(', '));
  if (rep.subjects.length) L.push('📚 교과영역 ' + rep.subjects.join(', '));
  if (rep.common.length) L.push('📐 공통규칙 ' + rep.common.join(', '));
  if (rep.rules) L.push('📏 우리 학교 규칙 ' + rep.rules + '줄');
  if (rep.extra.length) L.push('📄 그 밖의 시트(값만) ' + rep.extra.join(', '));
  return L;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UPDATE_URL: UPDATE_URL, MASTER_COPY_URL: MASTER_COPY_URL, versionParts: versionParts, compareVersions: compareVersions,
    parseVersionInfo: parseVersionInfo, updateState: updateState, spreadsheetIdIn: spreadsheetIdIn,
    xmlUnescape: xmlUnescape, colIndexOf: colIndexOf, parseSharedStrings: parseSharedStrings, parseSheetXml: parseSheetXml,
    readXlsxParts: readXlsxParts, tableOf: tableOf, mergeKeyed: mergeKeyed, studentKeyOf: studentKeyOf,
    activityDefFromOld: activityDefFromOld, remapStudentRows: remapStudentRows, importReportLines: importReportLines
  };
}
