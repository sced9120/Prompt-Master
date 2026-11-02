/**
 * 세특 작성 도우미 v3 — 📤 나이스 업로드 파일 만들기
 *
 * 나이스에서 내려받은 엑셀 양식을 창에서 고르면, 이 시트의 [최종본]을 학생별로 채운 같은 파일을 돌려준다.
 * 선생님은 받은 파일을 나이스에 그대로 올린다. 파일은 Drive 에 저장하지 않고 창에서 바로 내려받는다(새 권한 없음).
 * 읽기 · 맞추기 · 채우기는 13_NeisForm.gs 의 순수 함수가 한다.
 */

function openNeisDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Neis').setWidth(820).setHeight(680);
  ui_().showModalDialog(html, '📤 나이스 업로드 파일 만들기');
}

/** [최종본] 열이 있는 시트들 — 최종취합 시트를 앞에 */
function neisSources() {
  var recs = getRecordTypes_();
  var out = [];
  compileSheets_().forEach(function (s) {
    var rk = recordKeyOfCompile_(s.getName()), rec = findByKey(recs, rk);
    out.push({ sheet: s.getName(), recKey: rk, limit: (rec ? rec.chars : 500) * 3, label: s.getName() + ' (최종취합)' });
  });
  getActivities_().forEach(function (a) {
    var s = sh_(a.inSheet);
    if (!s || !colOf_(s, APP.HEAD_ROW, '최종본')) return;
    var rec = findByKey(recs, a.recordKey);
    out.push({ sheet: a.inSheet, recKey: a.recordKey, limit: activityBytes(a, rec || {}), label: a.inSheet + ' (활동 하나)' });
  });
  return out;
}

/** 창이 처음 열릴 때 */
function neisContext() {
  return { sources: neisSources() };
}

function neisParts_(b64) {
  var parts = {};
  var blob = Utilities.newBlob(Utilities.base64Decode(String(b64 || '')), 'application/zip', 'form.xlsx');
  var files;
  try { files = Utilities.unzip(blob); } catch (e) { throw new Error('엑셀(.xlsx) 파일이 아닙니다. 나이스에서 내려받은 파일을 그대로 골라 주세요.'); }
  files.forEach(function (b) { parts[String(b.getName()).replace(/^\/+/, '')] = b; });
  return parts;
}

function neisXmlOf_(parts) {
  var x = {};
  Object.keys(parts).forEach(function (k) { if (/\.(xml|rels)$/.test(k)) x[k] = parts[k].getDataAsString('UTF-8'); });
  return x;
}

/** 시트의 학생 줄: A열(반 또는 학년-반) · 번호 · 이름 · [최종본] · [검증] */
function neisSourceRows_(sheetName) {
  var s = sh_(sheetName);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + sheetName);
  var cF = colOf_(s, APP.HEAD_ROW, '최종본'), cV = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cF) throw new Error('[' + sheetName + '] 에 [최종본] 칸이 없습니다.');
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return [];
  var n = last - APP.DATA_ROW + 1;
  var abc = s.getRange(APP.DATA_ROW, 1, n, 3).getValues();
  var fin = s.getRange(APP.DATA_ROW, cF, n, 1).getValues();
  var chk = cV ? s.getRange(APP.DATA_ROW, cV, n, 1).getValues() : null;
  var out = [];
  for (var i = 0; i < n; i++) {
    if (!String(abc[i][1]).trim() && !String(abc[i][2]).trim()) continue;
    out.push({ cls: abc[i][0], no: abc[i][1], name: abc[i][2], text: String(fin[i][0] || ''), check: chk ? String(chk[i][0] || '') : '' });
  }
  return out;
}

/** 양식 종류에 맞는 시트를 고른다 (사용자가 고른 것이 먼저) */
function neisPickSource_(kind, wanted) {
  var list = neisSources();
  var hit = list.filter(function (x) { return x.sheet === wanted; })[0];
  if (!hit) hit = list.filter(function (x) { return x.recKey === kind && x.label.indexOf('최종취합') >= 0; })[0];
  if (!hit) hit = list.filter(function (x) { return x.recKey === kind; })[0];
  if (!hit) {
    throw new Error(kind ? '이 양식(' + kind + ')에 넣을 [최종본]이 있는 시트가 없습니다. 메뉴 ⑦ [최종취합 시트 생성/갱신]을 먼저 누르세요.'
                         : '[최종본]이 있는 시트를 골라 주세요.');
  }
  return hit;
}

/**
 * 미리 보기 — 누가 들어가고 누가 빠지는지
 * @param {{b64:string, source?:string, overwrite?:boolean, includeFlagged?:boolean}} p
 */
function neisPreview(p) {
  p = p || {};
  var form = readNeisForm(neisXmlOf_(neisParts_(p.b64)));
  var src = neisPickSource_(form.kind, p.source);
  var plan = matchNeisRows(form.rows, neisSourceRows_(src.sheet),
                           { limit: src.limit, overwrite: !!p.overwrite, includeFlagged: !!p.includeFlagged });
  return {
    form: { kind: form.kind, subject: form.subject, year: form.year, term: form.term, contentHead: form.contentHead,
            sheetName: form.sheetName, students: form.rows.length },
    source: src, plan: plan.map(function (x) { return { label: x.label, ok: x.ok, why: x.why, bytes: x.bytes }; }),
    fill: plan.filter(function (x) { return x.ok; }).length,
    column: neisColumn(plan)
  };
}

/**
 * 채운 파일 만들기 — 원래 파일에서 특기사항 칸만 바꾼다
 * @return {{file:string, b64:string, fill:number, skip:number}}
 */
function neisBuild(p) {
  p = p || {};
  var parts = neisParts_(p.b64);
  var form = readNeisForm(neisXmlOf_(parts));
  var src = neisPickSource_(form.kind, p.source);
  var plan = matchNeisRows(form.rows, neisSourceRows_(src.sheet),
                           { limit: src.limit, overwrite: !!p.overwrite, includeFlagged: !!p.includeFlagged });
  var fills = {};
  plan.forEach(function (x) { if (x.ok) fills[x.r] = x.text; });
  if (!Object.keys(fills).length) throw new Error('넣을 학생이 없습니다. 미리 보기에서 빠진 까닭을 확인해 주세요.');
  var sheetBlob = parts[form.sheetPath];
  var xml = fillNeisSheetXml(sheetBlob.getDataAsString('UTF-8'), form.contentCol, fills);
  parts[form.sheetPath] = Utilities.newBlob(xml, 'application/xml', form.sheetPath).setDataFromString(xml, 'UTF-8');
  var name = String(p.fileName || '나이스 양식.xlsx').replace(/[\\\/:*?"<>|]/g, '_');
  if (!/\.xlsx$/i.test(name)) name += '.xlsx';
  var blobs = Object.keys(parts).map(function (k) { return parts[k].setName(k); });
  var zip = Utilities.zip(blobs, name);
  return { file: name, b64: Utilities.base64Encode(zip.getBytes()), fill: Object.keys(fills).length, skip: plan.length - Object.keys(fills).length };
}
