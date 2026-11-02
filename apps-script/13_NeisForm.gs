/**
 * 세특 작성 도우미 v3 — 📤 나이스 업로드 양식 채우기 (순수 함수 — Node 시험 가능)
 *
 * 나이스에서 내려받은 엑셀 양식(학생 줄이 채워져 있고 특기사항 칸만 빈 파일)에
 * 시트의 [최종본]을 학생별로 넣어, 그 파일을 그대로 나이스에 다시 올리게 한다.
 *   · 파일은 다시 만들지 않는다. 시트 XML 에서 특기사항 칸만 바꿔 끼우고 나머지(학생개인번호 · 과목코드 · 서식)는 손대지 않는다.
 *   · 학년 · 반 · 번호 · 성명이 모두 맞는 학생에게만 넣는다(쌤패스와 같은 원칙). 하나라도 어긋나면 넣지 않고 까닭을 보여 준다.
 *   · [최종본]만 쓴다. [AI 결과]는 넣지 않는다(2026 기재요령: AI 생성 글을 그대로 입력하지 않는다).
 *
 * 확인한 양식(2026-11, 사용자가 준 파일)
 *   과목 세특: 학년도 | 학기 | 학년 | 학생개인번호 | 과목 | 과목코드 | 반/번호 | 성명 | 학적변동 구분 | 세부능력 및 특기사항 | 영재·발명교육 기록사항
 *   동아리:   영역 구분(동아리활동_특기사항) | 학년도 | 학년 | 학과 | 반 | 번호 | 동아리활동 부서명 | 학생개인번호 | 성명 | 특기사항
 *   모든 칸이 inlineStr 이고, 빈 특기사항 칸은 <c r="J2" s="4"></c> 처럼 서식만 있는 칸으로 들어 있다.
 */

/** 특기사항이 들어갈 열의 머리글 — 앞의 것이 먼저 (공백 · 줄바꿈은 지우고 견준다) */
var NEIS_CONTENT_HEADS = ['세부능력및특기사항', '행동특성및종합의견', '특기사항', '종합의견'];

/** 영역 구분 · 머리글 → 시트의 기록종류 키 */
var NEIS_AREA_KEYS = [
  { re: /동아리/, key: '동아리' }, { re: /자율/, key: '자율' }, { re: /진로/, key: '진로' },
  { re: /행동특성|종합의견/, key: '행발' }, { re: /개인별/, key: '개세특' }, { re: /세부능력/, key: '과세특' }
];

function neisHead_(h) { return String(h === null || h === undefined ? '' : h).replace(/\s+/g, ''); }
function neisName_(s) { return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ''); }
function neisNum_(s) { var n = parseInt(String(s === null || s === undefined ? '' : s).replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; }

/** 열 번호(0부터) → 'A', 'J', 'AB' */
function colLetterOf(i) {
  var s = '';
  for (var n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

/** workbook 의 첫 시트가 어느 XML 파일인지 */
function neisSheetPath_(parts) {
  var wb = parts['xl/workbook.xml'] || '';
  var sm = wb.match(/<sheet\b([^>]*)\/?>/);
  if (!sm) throw new Error('엑셀 파일 모양이 아닙니다(시트가 없음).');
  var name = xmlUnescape((sm[1].match(/\bname="([^"]*)"/) || [])[1] || '');
  var rid = (sm[1].match(/\br:id="([^"]+)"/) || [])[1];
  var path = 'xl/worksheets/sheet1.xml', rm, relRe = /<Relationship\b([^>]*)\/?>/g;
  while ((rm = relRe.exec(parts['xl/_rels/workbook.xml.rels'] || ''))) {
    if ((rm[1].match(/\bId="([^"]+)"/) || [])[1] !== rid) continue;
    var t = (rm[1].match(/\bTarget="([^"]+)"/) || [])[1] || '';
    path = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
  }
  return { name: name, path: path };
}

/**
 * 나이스 양식 읽기
 * @param {Object<string,string>} parts  xlsx 안의 XML 파일들 {경로: 글}
 * @return {{sheetName:string, sheetPath:string, kind:string, subject:string, year:string, term:string,
 *           contentCol:number, contentHead:string, head:string[],
 *           rows:Array<{r:number, year:?number, cls:?number, no:?number, name:string, status:string, content:string}>}}
 */
function readNeisForm(parts) {
  var p = {};
  Object.keys(parts || {}).forEach(function (k) { p[String(k).replace(/^\/+/, '')] = parts[k]; });
  var sp = neisSheetPath_(p);
  var grid = parseSheetXml(p[sp.path] || '', parseSharedStrings(p['xl/sharedStrings.xml'] || ''));
  if (!grid.length) throw new Error('양식에 줄이 없습니다.');
  var head = (grid[0] || []).map(function (h) { return String(h === null || h === undefined ? '' : h); });
  var H = head.map(neisHead_);
  var at = function (name) { return H.indexOf(name); };
  var contentCol = -1;
  for (var i = 0; i < NEIS_CONTENT_HEADS.length && contentCol < 0; i++) contentCol = at(NEIS_CONTENT_HEADS[i]);
  var cYear = at('학년'), cCls = at('반'), cNo = at('번호'), cClsNo = at('반/번호'), cName = at('성명');
  if (cName < 0) cName = at('이름');
  if (contentCol < 0) throw new Error('특기사항 칸을 찾지 못했습니다. 나이스에서 내려받은 양식 그대로인지 확인해 주세요. (머리글: ' + head.join(' | ') + ')');
  if (cName < 0 || (cClsNo < 0 && (cCls < 0 || cNo < 0))) throw new Error('반 · 번호 · 성명 칸을 찾지 못했습니다. (머리글: ' + head.join(' | ') + ')');

  var cArea = at('영역구분'), cSub = at('과목'), cStatus = at('학적변동구분'), cY = at('학년도'), cTerm = at('학기');
  var rows = [];
  for (var r = 1; r < grid.length; r++) {
    var g = grid[r] || [];
    var v = function (c) { return c < 0 ? '' : String(g[c] === null || g[c] === undefined ? '' : g[c]).trim(); };
    var cls = cCls >= 0 ? v(cCls) : v(cClsNo).split('/')[0];
    var no = cNo >= 0 ? v(cNo) : (v(cClsNo).split('/')[1] || '');
    if (!v(cName) && !cls && !no) continue;
    rows.push({ r: r + 1, year: neisNum_(v(cYear)), cls: neisNum_(cls), no: neisNum_(no), name: v(cName),
                status: v(cStatus), content: v(contentCol) });
  }
  var first = grid[1] || [];
  var area = cArea >= 0 ? String(first[cArea] || '') : '';
  var probe = area + ' ' + H[contentCol] + ' ' + (cSub >= 0 ? '세부능력' : '');
  var kind = '';
  for (var k = 0; k < NEIS_AREA_KEYS.length && !kind; k++) if (NEIS_AREA_KEYS[k].re.test(probe)) kind = NEIS_AREA_KEYS[k].key;
  return {
    sheetName: sp.name, sheetPath: sp.path, kind: kind,
    subject: cSub >= 0 ? String(first[cSub] || '').trim() : '',
    year: cY >= 0 ? String(first[cY] || '').trim() : '', term: cTerm >= 0 ? String(first[cTerm] || '').trim() : '',
    contentCol: contentCol, contentHead: head[contentCol].replace(/\s+/g, ' '), head: head, rows: rows
  };
}

/** 시트의 A열(반 또는 "학년-반") → {year, cls} */
function neisClassOf_(label) {
  var s = String(label === null || label === undefined ? '' : label).trim();
  var m = s.match(/^(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { year: Number(m[1]), cls: Number(m[2]) };
  return { year: null, cls: neisNum_(s) };
}

/**
 * 양식의 학생 줄 ↔ 시트의 [최종본] 맞추기
 * @param {Array} formRows  readNeisForm().rows
 * @param {Array<{cls:*, no:*, name:string, text:string, check?:string}>} src  시트 줄 (cls 는 A열 값)
 * @param {{limit?:number, overwrite?:boolean, includeFlagged?:boolean}} opt
 * @return {Array<{r:number, label:string, ok:boolean, why:string, text:string, bytes:number}>}
 */
function matchNeisRows(formRows, src, opt) {
  opt = opt || {};
  var list = (src || []).map(function (s) {
    var c = neisClassOf_(s.cls);
    return { year: c.year, cls: c.cls, no: neisNum_(s.no), name: neisName_(s.name), text: String(s.text || '').replace(/\r\n?/g, '\n').trim(),
             check: String(s.check || '') };
  });
  return (formRows || []).map(function (f) {
    var label = (f.year ? f.year + '학년 ' : '') + (f.cls === null ? '?' : f.cls) + '반 ' + (f.no === null ? '?' : f.no) + '번 ' + f.name;
    var out = { r: f.r, label: label, ok: false, why: '', text: '', bytes: 0 };
    if (f.status && f.status !== '재학') { out.why = '학적변동: ' + f.status; return out; }
    if (f.content && !opt.overwrite) { out.why = '나이스 양식에 이미 내용이 있음'; return out; }
    var same = list.filter(function (s) {
      return s.cls === f.cls && s.no === f.no && (s.year === null || f.year === null || s.year === f.year);
    });
    if (!same.length) { out.why = '시트에 없는 학생'; return out; }
    var hit = same.filter(function (s) { return !s.name || s.name === neisName_(f.name); });
    if (!hit.length) { out.why = '반 · 번호는 같은데 이름이 다름 (시트: ' + same[0].name + ')'; return out; }
    if (hit.length > 1) { out.why = '같은 반 · 번호 · 이름이 시트에 둘 이상'; return out; }
    var s = hit[0];
    out.text = s.text; out.bytes = s.text ? byteLen(s.text) : 0;
    if (!s.text) { out.why = '[최종본]이 비어 있음'; return out; }
    if (opt.limit && out.bytes > opt.limit) { out.why = '바이트 초과 ' + out.bytes + ' / ' + opt.limit; return out; }
    if (/수정필요|\[수정\]/.test(s.check) && !opt.includeFlagged) { out.why = '[검증]에 [수정]이 남아 있음'; return out; }
    out.ok = true;
    return out;
  });
}

/**
 * 올리기가 막힐 때의 대안 — 양식 2행부터 학생 순서대로 [최종본] 한 열(빠진 학생 · 빈 줄은 '')
 * 엑셀에서 특기사항 열의 첫 학생 칸에 붙여 넣으므로 칸 안의 줄바꿈 · 탭은 띄어쓰기로 바꾼다.
 * @return {string[]}
 */
function neisColumn(plan) {
  var by = {}, last = 1;
  (plan || []).forEach(function (x) { by[x.r] = x.ok ? String(x.text).replace(/[\t\r\n]+/g, ' ').trim() : ''; last = Math.max(last, x.r); });
  var out = [];
  for (var r = 2; r <= last; r++) out.push(by.hasOwnProperty(r) ? by[r] : '');
  return out;
}

function neisXmlText_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * 시트 XML 의 한 열에 글 넣기 — 그 칸만 inlineStr 로 바꾸고 서식(s)은 그대로 둔다
 * @param {string} xml  @param {number} col  열 번호(0부터)  @param {Object<number,string>} fills {행 번호: 글}
 * @return {string}
 */
function fillNeisSheetXml(xml, col, fills) {
  var L = colLetterOf(col);
  return String(xml).replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, function (whole, attr, body) {
    var rn = Number((attr.match(/\br="(\d+)"/) || [])[1]);
    if (!fills.hasOwnProperty(rn)) return whole;
    var ref = L + rn;
    var cell = function (a) {
      a = String(a || '').replace(/\s*\bt="[^"]*"/, '').replace(/\s*\br="[^"]*"/, '');
      return '<c r="' + ref + '"' + a + ' t="inlineStr"><is><t xml:space="preserve">' + neisXmlText_(fills[rn]) + '</t></is></c>';
    };
    body = body || '';
    var re = new RegExp('<c\\b(?=[^>]*\\br="' + ref + '")([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    if (re.test(body)) body = body.replace(re, function (m, a) { return cell(a); });
    else {
      // 칸이 없으면 열 순서에 맞는 자리에 끼운다
      var at = -1, cm, cre = /<c\b[^>]*\br="([A-Z]+)\d+"/g;
      while ((cm = cre.exec(body))) if (colIndexOf(cm[1]) > col) { at = cm.index; break; }
      body = at < 0 ? body + cell('') : body.slice(0, at) + cell('') + body.slice(at);
    }
    return '<row' + attr + '>' + body + '</row>';
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NEIS_CONTENT_HEADS: NEIS_CONTENT_HEADS, colLetterOf: colLetterOf, readNeisForm: readNeisForm,
    matchNeisRows: matchNeisRows, fillNeisSheetXml: fillNeisSheetXml, neisColumn: neisColumn
  };
}
