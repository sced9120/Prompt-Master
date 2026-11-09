/**
 * 세특 작성 도우미 v3 — 🖥️ 작성실 (큰 창)
 *
 * 시트 탭 대신 큰 창 하나에서 학생별로 쓴다. 자료는 지금처럼 활동 입력 시트에 저장된다(창은 보여 주고 고치기만).
 *   · 위: [담임 | 교과] 전환 · 반 고르기 · 활동 탭
 *     담임 = 자율 · 진로 · 행발(담임 학반 학생만), 교과 = 과세특 · 개세특 · 동아리 · 그 밖
 *   · 왼쪽: 학생 목록(활동마다 최종본을 채웠는지 점)
 *   · 가운데: 입력 항목 · AI 결과 · 최종본 · 바이트 — 학생을 넘길 때 저장
 *   · 오른쪽: 검증(지금 쓰는 글을 바로 검사)
 * 반 전체를 한 번에 읽어 창으로 보낸다(시트를 학생마다 읽지 않게 — 호출마다 1~3초 걸림).
 */

var DESK_HOMEROOM_KEY = 'HOMEROOM';          // DocumentProperties — 담임 학반(활동 시트 A열 값, 예: "3" 또는 "2-3")
var DESK_SIZE_KEY = 'DESK_SIZE';             // UserProperties — 마지막 창 크기 "가로x세로"
var DESK_HOMEROOM_RECORDS = ['자율', '진로', '행발'];

/** 활동이 담임 쪽인가 */
function deskModeOf_(act) {
  return DESK_HOMEROOM_RECORDS.indexOf(String(act.recordKey || '')) >= 0 ? 'homeroom' : 'subject';
}

function deskHomeroom_() {
  try { return PropertiesService.getDocumentProperties().getProperty(DESK_HOMEROOM_KEY) || ''; } catch (e) { return ''; }
}

/** 창 크기 — 화면에 맞춰 연 크기를 기억한다(처음에는 노트북에서도 잘리지 않을 만큼) */
function deskSize_() {
  var w = 1240, h = 700;
  try {
    var v = String(PropertiesService.getUserProperties().getProperty(DESK_SIZE_KEY) || '');
    var m = v.match(/^(\d+)x(\d+)$/);
    if (m) { w = +m[1]; h = +m[2]; }
  } catch (e) {}
  return { w: Math.max(900, Math.min(1800, w)), h: Math.max(540, Math.min(1100, h)) };
}

function openDesk() {
  var z = deskSize_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Desk').setWidth(z.w).setHeight(z.h);
  ui_().showModalDialog(html, '🖥️ 작성실');
}

/** 창 안 [↔ 화면에 맞게] · 작업판 버튼 — 브라우저가 알려 준 화면 크기로 다시 연다 */
function deskOpenSized(w, h) {
  w = Math.round(Number(w) || 0); h = Math.round(Number(h) || 0);
  if (w > 0 && h > 0) {
    try { PropertiesService.getUserProperties().setProperty(DESK_SIZE_KEY, w + 'x' + h); } catch (e) { logSoft_('deskOpenSized', e); }
  }
  openDesk();
}

/** 담임 학반 정하기 ('' 이면 지움) */
function deskSetHomeroom(cls) {
  cls = String(cls || '').trim();
  var dp = PropertiesService.getDocumentProperties();
  if (cls) dp.setProperty(DESK_HOMEROOM_KEY, cls); else dp.deleteProperty(DESK_HOMEROOM_KEY);
  return deskContext();
}

/** 창을 열 때 한 번 — 활동 목록 · 반 목록 · 담임 학반 · AI 상태 */
function deskContext() {
  var acts = [];
  try {
    acts = getActivities_().filter(function (a) { return !!sh_(a.inSheet); }).map(function (a) {
      return { key: a.key, name: a.name || a.key, rec: a.recordKey, mode: deskModeOf_(a), quick: a.mode === '바로쓰기',
               limit: bytesFor_(a), columns: parseColumns(a.columns) };
    });
  } catch (e) { logSoft_('deskContext acts', e); }
  var classes = [];
  try {
    getRoster_().forEach(function (st) { var c = String(st.cls).trim(); if (c && classes.indexOf(c) < 0) classes.push(c); });
  } catch (e) {}
  var k = {};
  try { k = keyStatus_(); } catch (e) {}
  return {
    version: APP.VERSION, activities: acts, classes: classes, homeroom: deskHomeroom_(),
    consent: (function () { try { return consentOk_(); } catch (e) { return true; } })(),
    api: !!(k.gemini || k.openai || k.anthropic), manualOnly: deskManualOnly_(k),
    hasHomeroomActs: acts.some(function (a) { return a.mode === 'homeroom'; })
  };
}

/** API 키가 없거나, 설정의 활동용 모델이 [키 없이]면 창 안에서 복사 · 붙여넣기로 */
function deskManualOnly_(k) {
  k = k || keyStatus_();
  if (!(k.gemini || k.openai || k.anthropic) && !k.subscription) return true;
  try { return providerOf_(normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL) === 'manual'; } catch (e) { return false; }
}

/** 활동 시트 한 줄 → 창에 보낼 모양 */
function deskRowOf_(v, row, nCols, c) {
  var g = function (col) { return col ? v[col - 1] : ''; };
  return {
    row: row, cls: String(v[0]).trim(), no: String(v[1]).trim(), name: String(v[2] || ''),
    id: String(v[0]).trim() + '-' + String(v[1]).trim(),
    inputs: v.slice(4, 4 + nCols).map(function (x) { return x == null ? '' : String(x); }),
    ai: String(g(c.ai) || ''), final: String(g(c.fin) || ''), check: String(g(c.check) || '')
  };
}

function deskCols_(s) {
  return { ai: colOf_(s, APP.HEAD_ROW, 'AI 결과'), fin: colOf_(s, APP.HEAD_ROW, '최종본'),
           check: colOf_(s, APP.HEAD_ROW, '검증'), gen: colOf_(s, APP.HEAD_ROW, '생성') };
}

function deskAct_(key) {
  var act = getActivity_(key);
  if (!act) throw new Error('활동을 찾지 못했습니다: ' + key);
  var s = sh_(act.inSheet);
  if (!s) throw new Error('[' + act.inSheet + '] 시트가 없습니다. 메뉴 ①②③ > [① 처음 설치 / 구조 복구] 를 눌러 보세요.');
  return { act: act, sheet: s, cols: deskCols_(s), nCols: parseColumns(act.columns).length };
}

/**
 * 한 모드의 활동을 반 단위로 한 번에 읽는다.
 * @param {{mode:'homeroom'|'subject', cls:string}} p  cls '' 이면 모든 반
 * @return {{students:Array<{id,cls,no,name}>, data:Object<string,Object<string,Object>>}}  data[활동키][학생id] = 줄
 */
function deskLoad(p) {
  p = p || {};
  var cls = String(p.cls || '').trim();
  var order = [], seen = {};
  var add = function (id, st) { if (!seen[id]) { seen[id] = true; order.push(st); } };
  try {
    getRoster_().forEach(function (st) {
      if (cls && String(st.cls).trim() !== cls) return;
      add(st.id, { id: st.id, cls: String(st.cls).trim(), no: String(st.no).trim(), name: String(st.name || '') });
    });
  } catch (e) {}
  var data = {};
  getActivities_().forEach(function (a) {
    if (deskModeOf_(a) !== p.mode) return;
    var s = sh_(a.inSheet);
    if (!s) return;
    var last = s.getLastRow();
    data[a.key] = {};
    if (last < APP.DATA_ROW) return;
    var c = deskCols_(s), nCols = parseColumns(a.columns).length;
    var v = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, Math.max(s.getLastColumn(), 4)).getValues();
    v.forEach(function (r, i) {
      if (!String(r[0]).trim() && !String(r[1]).trim()) return;
      if (cls && String(r[0]).trim() !== cls) return;
      var d = deskRowOf_(r, APP.DATA_ROW + i, nCols, c);
      data[a.key][d.id] = d;
      add(d.id, { id: d.id, cls: d.cls, no: d.no, name: d.name });   // 명단에는 없고 시트에만 있는 줄
    });
  });
  return { students: order, data: data };
}

/** 줄 번호가 그 학생인지 확인 — 그사이 시트 줄이 바뀌었으면 학생 id 로 다시 찾는다 */
function deskFindRow_(ctx, row, id) {
  var s = ctx.sheet;
  if (row >= APP.DATA_ROW && row <= s.getLastRow()) {
    var v = s.getRange(row, 1, 1, 2).getValues()[0];
    if (String(v[0]).trim() + '-' + String(v[1]).trim() === id) return row;
  }
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return 0;
  var all = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, 2).getValues();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i][0]).trim() + '-' + String(all[i][1]).trim() === id) return APP.DATA_ROW + i;
  }
  return 0;
}

function deskReadRow_(ctx, row) {
  var v = ctx.sheet.getRange(row, 1, 1, Math.max(ctx.sheet.getLastColumn(), 4)).getValues()[0];
  return deskRowOf_(v, row, ctx.nCols, ctx.cols);
}

/**
 * 한 학생 · 한 활동 저장 — 입력 항목과 최종본만 쓴다(AI 결과는 AI 만 쓴다). 저장 뒤 [검증]을 새로 쓴다.
 * @param {{key:string, row:number, id:string, inputs?:string[], final?:string}} p
 */
function deskSave(p) {
  var ctx = deskAct_(p.key);
  var row = deskFindRow_(ctx, Number(p.row), String(p.id));
  if (!row) throw new Error('이 학생의 줄을 시트에서 찾지 못했습니다. 명단 동기화 뒤 다시 열어 주세요.');
  var s = ctx.sheet;
  if (p.inputs && ctx.nCols) {
    var vals = [];
    for (var i = 0; i < ctx.nCols; i++) vals.push(p.inputs[i] == null ? '' : String(p.inputs[i]));
    s.getRange(row, 5, 1, ctx.nCols).setValues([vals]);
  }
  if (p.final != null && ctx.cols.fin) s.getRange(row, ctx.cols.fin).setValue(String(p.final));
  if (ctx.cols.check) {
    var fin = String(p.final != null ? p.final : s.getRange(row, ctx.cols.fin).getValue() || '').trim();
    var t = fin || String(ctx.cols.ai ? s.getRange(row, ctx.cols.ai).getValue() || '' : '').trim();
    if (t.indexOf('⚠') !== 0) {
      s.getRange(row, ctx.cols.check).setValue(t ? formatIssues(inspect_(t, bytesFor_(ctx.act))) + (fin ? '\n(최종본 기준)' : '') : '');
    }
  }
  return deskReadRow_(ctx, row);
}

/** 오른쪽 검증 — 저장하지 않고 글만 검사 */
function deskInspect(p) {
  var act = getActivity_(p.key);
  var limit = act ? bytesFor_(act) : 1500;
  var v = inspect_(String(p.text || ''), limit);
  return { bytes: v.bytes, limit: limit, ok: v.ok,
           issues: v.issues.map(function (x) { return { level: x.level, label: x.label, hit: x.hit || '', fix: x.fix || '', why: x.why || '' }; }) };
}

/**
 * AI 로 쓰기. 키가 있으면 바로 쓰고 바뀐 줄을 돌려준다. 키 없이면 복사 · 붙여넣기 요청문을 돌려준다.
 * @param {{key:string, ids:string[], rows:number[]}} p  ids · rows 는 같은 순서
 */
function deskGenerate(p) {
  if (!consentOk_()) return { consent: false };
  var ctx = deskAct_(p.key);
  var rows = [];
  (p.ids || []).forEach(function (id, n) {
    var r = deskFindRow_(ctx, Number((p.rows || [])[n]), String(id));
    if (r) rows.push(r);
  });
  if (!rows.length) throw new Error('쓸 학생을 시트에서 찾지 못했습니다.');
  // 자료가 빈 학생은 미리 빼서 알려 준다(AI 를 부르지 않음)
  var read = rowReader_(ctx.sheet, rows);
  var empty = rows.filter(function (r) {
    return !read(r).slice(4, 4 + ctx.nCols).some(function (x) { return String(x).trim() !== ''; });
  });
  rows = rows.filter(function (r) { return empty.indexOf(r) < 0; });
  if (!rows.length) return { empty: empty.length, rows: [] };

  if (deskManualOnly_()) {
    var rec = findByKey(getRecordTypes_(), ctx.act.recordKey);
    var tail = styleTail_(), masked = maskName_();
    var jobs = rows.map(function (r) { return studentJob_(ctx.act, ctx.sheet, r, rec, masked, tail, read); }).filter(Boolean);
    var data = manualPayload_({ kind: 'generate', sheet: ctx.act.inSheet, target: 'AI 결과', check: '생성',
                                title: ctx.act.name, limit: bytesFor_(ctx.act), system: promptFor_(ctx.act), jobs: jobs });
    return { manual: data, empty: empty.length };
  }
  var res = runGeneration_(ctx.act, ctx.sheet, rows, { quiet: true });
  return { done: res, empty: empty.length, rows: rows.map(function (r) { return deskReadRow_(ctx, r); }) };
}

/** 키 없이 답을 넣은 뒤 그 줄들을 다시 읽는다 */
function deskRows(p) {
  var ctx = deskAct_(p.key);
  return (p.rows || []).map(function (r) { return deskReadRow_(ctx, Number(r)); });
}

/** 담임 모드에 활동이 없을 때 — 자율 · 진로 · 행발 바로 쓰기 시트를 한 번에 (이미 있는 기록 종류는 건너뜀) */
function deskMakeHomeroomSheets() {
  var have = {};
  getActivities_().forEach(function (a) { have[a.recordKey] = true; });
  var recs = getRecordTypes_();
  var made = [];
  DESK_HOMEROOM_RECORDS.forEach(function (key) {
    if (have[key] || !findByKey(recs, key)) return;
    var name = { '자율': '자율활동', '진로': '진로활동', '행발': '행동특성' }[key] || key;
    if (getActivity_(name)) return;
    createActivity_({ key: name, name: name, recordKey: key, subjectKey: '공통', columns: [QUICK_COLUMN],
                      desc: '', mode: '바로쓰기', noExamples: true });
    made.push(name);
  });
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) { logSoft_('deskMakeHomeroomSheets compile', e); }
  try { applyView_(viewSimpleOn_()); } catch (e) {}
  var ctx = deskContext();
  ctx.made = made;
  return ctx;
}
