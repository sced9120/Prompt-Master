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
    api: anyKey_(k), manualOnly: deskManualOnly_(k),
    hasHomeroomActs: acts.some(function (a) { return a.mode === 'homeroom'; }),
    guide: deskGuide()
  };
}

/**
 * 창 맨 위 길잡이 줄의 숫자 — 어디까지 했는지(명단 · 활동 · AI 연결 · 쓰기 · 취합). 이름이나 글은 담지 않는다.
 * written / slots = [최종본]이 있는 칸 / 학생 × 활동 칸.
 */
function deskGuide() {
  var g = { installed: !!sh_(APP.SH.ACTIVITY), students: 0, acts: 0, written: 0, slots: 0, compiled: 0, consent: true, api: false };
  try { g.students = sh_(APP.SH.ROSTER) ? getRoster_().length : 0; } catch (e) { logSoft_('deskGuide roster', e); }
  if (g.installed) {
    try {
      getActivities_().forEach(function (a) {
        var s = sh_(a.inSheet); if (!s) return;
        var p = activityProgress_(s);
        g.acts++; g.slots += p.students; g.written += p.done;
      });
    } catch (e) { logSoft_('deskGuide acts', e); }
  }
  try { g.compiled = compileSheets_().length; } catch (e) {}
  try { g.consent = consentOk_(); } catch (e) {}
  try { g.api = anyKey_(keyStatus_()); } catch (e) {}
  try { var d = demoState_(); g.demo = { filled: d.filled, canFill: d.canFill }; } catch (e) { g.demo = { filled: false, canFill: false }; }
  return g;
}

/** 창에서 체험 예시 넣기 — 가상 학생 3명 · 활동 하나(명단에 실제 학생이 있으면 넣지 않는다) */
function deskDemo() {
  var r = demoFill();
  var ctx = deskContext();
  ctx.demoKey = DEMO_KEY; ctx.demoSheet = r.inSheet;
  return ctx;
}

/** 창에서 체험 예시 지우기 — 체험 활동과 체험 학생만 */
function deskDemoClear() {
  demoClear();
  return deskContext();
}

/** API 키가 없거나, 설정의 활동용 모델이 [키 없이]면 창 안에서 복사 · 붙여넣기로 */
function deskManualOnly_(k) {
  k = k || keyStatus_();
  if (!anyKey_(k) && !k.subscription) return true;
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
  if (!row) throw new Error('이 학생의 줄을 시트에서 찾지 못했습니다. [⚙ 설정] > 학생 명단 > [시트에서 고친 명단 반영]을 누른 뒤 다시 해 주세요.');
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
  var act = p.rec ? null : getActivity_(p.key);
  var limit = p.rec ? deskArea_(p.rec).limit : act ? bytesFor_(act) : 1500;
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
  if (!rows.length) throw new Error('쓸 학생을 시트에서 찾지 못했습니다. [⚙ 설정] > 학생 명단 > [시트에서 고친 명단 반영]을 누른 뒤 다시 해 주세요.');
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

/* ------------------------------------------------------------------ 표 보기 (v3.1.0) */

/**
 * 표 보기 저장 — 고친 학생 줄을 한 번에 쓴다(시트를 한 번만 읽고, 줄마다 입력 항목 · 최종본 · 검증을 쓴다).
 * inputs 의 null 칸은 건드리지 않는다. 줄 번호가 그 학생이 아니면 학생 id 로 다시 찾는다.
 * @param {{key:string, rows:Array<{id:string, row:number, inputs?:Array<?string>, final?:string}>}} p
 * @return {{rows:Object[], missing:string[]}}  missing = 시트에서 찾지 못한 학생 id
 */
function deskSaveRows(p) {
  var ctx = deskAct_(p.key), s = ctx.sheet, c = ctx.cols;
  var items = p.rows || [], out = [], missing = [];
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return { rows: [], missing: items.map(function (it) { return String(it.id); }) };
  var v = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, Math.max(s.getLastColumn(), 4)).getValues();
  var idOf = function (r) { return String(r[0]).trim() + '-' + String(r[1]).trim(); };
  var at = {};
  v.forEach(function (r, i) { var id = idOf(r); if (!at.hasOwnProperty(id)) at[id] = i; });
  var limit = bytesFor_(ctx.act);
  items.forEach(function (it) {
    var id = String(it.id), i = Number(it.row) - APP.DATA_ROW;
    if (!(i >= 0 && i < v.length && idOf(v[i]) === id)) i = at.hasOwnProperty(id) ? at[id] : -1;
    if (i < 0) { missing.push(id); return; }
    var r = v[i], row = APP.DATA_ROW + i;
    if (it.inputs && ctx.nCols) {
      var vals = [];
      for (var k = 0; k < ctx.nCols; k++) {
        var x = it.inputs[k];
        vals.push(x == null ? r[4 + k] : String(x));
        r[4 + k] = vals[k];
      }
      s.getRange(row, 5, 1, ctx.nCols).setValues([vals]);
    }
    if (it.final != null && c.fin) { r[c.fin - 1] = String(it.final); s.getRange(row, c.fin).setValue(r[c.fin - 1]); }
    if (c.check) {
      var fin = String(c.fin ? r[c.fin - 1] || '' : '').trim();
      var t = fin || String(c.ai ? r[c.ai - 1] || '' : '').trim();
      if (t.indexOf('⚠') !== 0) {
        r[c.check - 1] = t ? formatIssues(inspect_(t, limit)) + (fin ? '\n(최종본 기준)' : '') : '';
        s.getRange(row, c.check).setValue(r[c.check - 1]);
      }
    }
    out.push(deskRowOf_(r, row, ctx.nCols, c));
  });
  return { rows: out, missing: missing };
}

/**
 * 표 보기에서 입력 열 고치기 — 이름 바꾸기 · 더하기 · 지우기 · 순서 바꾸기를 한 번에.
 * from 은 그 열의 옛 이름(새 열이면 ''). 이름만 바꾼 열은 학생 자료가 그대로 따라온다.
 * 지우는 열에 자료가 있으면 force 없이는 쓰지 않고 몇 명인지 돌려준다.
 * @param {{key:string, columns:Array<{name:string, from?:string}>, force?:boolean}} p
 * @return {{needConfirm:true, removed:string[], lost:number} | {context:Object, added:string[], removed:string[], renamed:string[]}}
 */
function deskSetColumns(p) {
  var ctx = deskAct_(p.key);
  var old = parseColumns(ctx.act.columns);
  var items = (p.columns || []).map(function (c) {
    return { name: String((c && c.name) || '').trim(), from: String((c && c.from) || '').trim() };
  }).filter(function (c) { return c.name; });
  var names = validateColumns_(items.map(function (c) { return c.name; }));
  var used = {};
  items.forEach(function (c) {
    if (c.from && (old.indexOf(c.from) < 0 || used[c.from])) c.from = '';
    if (c.from) used[c.from] = true;
  });
  var removed = old.filter(function (c) { return !used[c]; });
  var s = ctx.sheet, last = s.getLastRow();

  if (removed.length && !p.force && last >= APP.DATA_ROW) {
    var idx = removed.map(function (c) { return old.indexOf(c); });
    var lost = s.getRange(APP.DATA_ROW, 5, last - APP.DATA_ROW + 1, old.length).getValues().filter(function (r) {
      return idx.some(function (i) { return String(r[i]).trim() !== ''; });
    }).length;
    if (lost) return { needConfirm: true, removed: removed, lost: lost };
  }

  // 머리글을 먼저 새 이름으로 — updateActivity_ 가 머리글 이름으로 자료를 옮긴다. 지울 열은 겹치지 않는 이름으로.
  var to = {};
  items.forEach(function (c) { if (c.from && c.from !== c.name) to[c.from] = c.name; });
  removed.forEach(function (c, i) { to[c] = '(지운 열 ' + (i + 1) + ')'; });
  var renamed = items.filter(function (c) { return c.from && c.from !== c.name; }).map(function (c) { return c.from + ' → ' + c.name; });
  if (Object.keys(to).length) {
    [s, sh_(ctx.act.exSheet)].forEach(function (sheet) {
      if (!sheet) return;
      var lc = sheet.getLastColumn();
      if (lc < 1) return;
      var rng = sheet.getRange(APP.HEAD_ROW, 1, 1, lc);
      var head = rng.getValues()[0];
      var hit = false;
      var next = head.map(function (h) {
        var k = String(h).trim();
        if (old.indexOf(k) >= 0 && to.hasOwnProperty(k)) { hit = true; return to[k]; }
        return h;
      });
      if (hit) rng.setValues([next]);
    });
  }
  var r = updateActivity_(p.key, { columns: names });
  return { context: deskContext(), added: items.filter(function (c) { return !c.from; }).map(function (c) { return c.name; }),
           removed: removed, renamed: renamed, rows: r.rows };
}

/* ------------------------------------------------------------------ 창 안에서 활동 · 프롬프트 · 설정 (v3.1.1) */

/** [＋ 활동] · [⚙ 설정] 창에 필요한 목록과 지금 설정값 (키 자체는 보내지 않고 있는지만) */
function deskSetup() {
  var num = function (k, d) { return Number(cfg_(k, d)) || d; };
  var rosterCount = 0;
  try { rosterCount = getRoster_().length; } catch (e) { logSoft_('deskSetup roster', e); }
  var style = { samples: 0, card: '' };
  try { style = { samples: styleSampleTexts_(20).length, card: String(getCommon_().STYLE_CARD || '') }; } catch (e) { logSoft_('deskSetup style', e); }
  return {
    records: getRecordTypes_().map(function (r) {
      return { key: r.key, name: r.name, cap: r.chars * 3, mode: deskModeOf_({ recordKey: r.key }) };
    }),
    subjects: getSubjects_().map(function (s) { return { key: s.key, name: s.name, kind: s.kind }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    columnSets: PRESET_COLUMN_SETS,
    amounts: AMOUNTS,
    providers: PROVIDERS,
    settings: {
      has: keyStatus_(), models: modelChoices_(),
      model: normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL,
      compile: normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL,
      backup: normModel(cfg_('예비 모델', '')),
      batch: Math.max(1, Math.min(10, num('한 번에 묶을 학생 수', 5))),
      thinkingLow: cfgBool_('생각 줄이기', true), mask: maskName_(),
      autoRepair: cfgBool_('자동 고쳐쓰기', true), ground: cfgBool_('근거 자동 확인', false),
      style: styleOn_(), styleSamples: style.samples, styleCard: style.card,
      years: num('교사 경력(년)', 15),
      consent: consentState(), rosterCount: rosterCount, rosterMode: rosterMode_()
    }
  };
}

/**
 * 창에서 활동 만들기.
 * kind 'quick' = 관찰 메모 한 칸(예시 시트 없음), 'cols' = 입력 항목을 정해서(예시 시트 있음).
 * @param {{name:string, recordKey:string, subjectKey?:string, kind:'quick'|'cols', columns?:string[], desc?:string, bytes?:number}} p
 * @return {{context:Object, key:string}}
 */
function deskAddActivity(p) {
  p = p || {};
  var name = String(p.name || '').trim();
  if (!name) throw new Error('활동 이름을 적어 주세요.');
  var recs = getRecordTypes_();
  var rec = findByKey(recs, p.recordKey);
  if (!rec) throw new Error('기록 영역을 골라 주세요.');
  var quick = p.kind !== 'cols';
  var made = createActivity_({
    key: name, name: name, recordKey: rec.key,
    subjectKey: p.subjectKey || (rec.key === '과세특' ? cfg_('기본 교과영역', '공통') : '공통'),
    bytes: Number(p.bytes) || 0,
    columns: quick ? [QUICK_COLUMN] : p.columns,
    desc: String(p.desc || '').trim(),
    mode: quick ? '바로쓰기' : '자동', noExamples: quick
  });
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) { logSoft_('deskAddActivity compile', e); }
  return { context: deskContext(), key: made.key };
}

/** [⚙ 활동 설정] 창 — 이름 · 개요 · 바이트 · 분량 · 예시 · 지금 조립되는 프롬프트 */
function deskActivityInfo(key) {
  var act = getActivity_(key);
  if (!act) throw new Error('활동을 찾지 못했습니다: ' + key);
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var prompt = '', tokens = 0;
  try { prompt = promptFor_(act); tokens = estimateTokens(prompt); } catch (e) { logSoft_('deskActivityInfo prompt', e); prompt = '프롬프트를 만들지 못했습니다: ' + redactSecrets(String((e && e.message) || e)); }
  return {
    key: act.key, name: act.name || act.key, recordKey: act.recordKey, recordName: rec ? rec.name : act.recordKey,
    subjectKey: act.subjectKey, mode: act.mode, quick: act.mode === '바로쓰기',
    bytes: bytesFor_(act), cap: (rec ? rec.chars : 500) * 3,
    desc: act.desc, amount: act.amount || '보통', columns: parseColumns(act.columns),
    hasExamples: !!(act.exSheet && sh_(act.exSheet)),
    examples: readExampleRows_(act).map(function (e) { return { values: e.values, result: e.result }; }),
    exampleMax: EXAMPLE_MAX,
    prompt: prompt, tokens: tokens, promptBytes: byteLen(prompt)
  };
}

/**
 * 활동 설정 저장 — 준 것만 바꾼다. 입력 항목(열)은 표 보기의 [열 고치기](deskSetColumns)에서.
 * @param {{key:string, name?:string, desc?:string, bytes?:number, amount?:string, subjectKey?:string,
 *          examples?:Array<{values:string[], result:string}>}} p
 * @return {{context:Object, info:Object}}
 */
function deskSaveActivity(p) {
  p = p || {};
  var act = getActivity_(p.key);
  if (!act) throw new Error('활동을 찾지 못했습니다: ' + p.key);
  var name = p.name === undefined ? act.name : String(p.name).trim();
  if (!name) throw new Error('활동 이름을 적어 주세요.');
  var desc = p.desc === undefined ? act.desc : String(p.desc).trim();
  if (name !== act.name || desc !== act.desc) updateActivity_(p.key, { name: name, columns: parseColumns(act.columns), desc: desc });

  var list = shRequire_(APP.SH.ACTIVITY);
  if (p.subjectKey !== undefined && String(p.subjectKey) !== act.subjectKey) {
    if (!findByKey(getSubjects_(), p.subjectKey)) throw new Error('교과영역을 찾지 못했습니다: ' + p.subjectKey);
    var cs = colOf_(list, 2, '교과영역');
    if (cs) list.getRange(act.__row, cs).setValue(String(p.subjectKey));
  }
  if (p.amount !== undefined) {
    if (AMOUNTS.indexOf(String(p.amount)) < 0) throw new Error('분량 맞추기는 ' + AMOUNTS.join(' · ') + ' 가운데 하나입니다.');
    var ca = ensureAmountCol_();
    var amount = p.amount === '보통' ? '' : String(p.amount);
    if (ca && amount !== act.amount) list.getRange(act.__row, ca).setValue(amount);
  }
  if (p.bytes !== undefined) bytesSave([{ key: p.key, bytes: p.bytes }]);

  if (p.examples) {
    var exS = act.exSheet && sh_(act.exSheet);
    if (!exS) throw new Error('이 활동은 예시 시트가 없습니다(바로 쓰기).');
    var cols = parseColumns(act.columns);
    var rows = p.examples.map(function (e) {
      return { values: cols.map(function (c, i) { return String((e.values || [])[i] || '').trim(); }), result: String(e.result || '').trim() };
    }).filter(function (e) { return e.result || e.values.some(String); });
    if (rows.length > EXAMPLE_MAX) throw new Error('예시는 ' + EXAMPLE_MAX + '개까지 프롬프트에 들어갑니다. ' + EXAMPLE_MAX + '개 이하로 줄여 주세요.');
    exS.clear();
    exampleLayout_(exS, name, cols);
    writeExampleRows_(exS, cols, rows, APP.DATA_ROW, Math.max(EXAMPLE_ROWS_DEFAULT, rows.length));
  }
  return { context: deskContext(), info: deskActivityInfo(p.key) };
}

/**
 * 활동 지우기 — 시트(입력 · 예시)와 활동목록 줄. 학생 자료가 함께 사라지므로 활동 이름을 그대로 적어야 한다.
 * @param {{key:string, confirm:string}} p
 */
function deskDeleteActivity(p) {
  p = p || {};
  var act = getActivity_(p.key);
  if (!act) throw new Error('활동을 찾지 못했습니다: ' + p.key);
  if (String(p.confirm || '').trim() !== (act.name || act.key)) throw new Error('지우려면 활동 이름 "' + (act.name || act.key) + '" 을 그대로 적어 주세요.');
  [act.inSheet, act.exSheet].forEach(function (n) { var s = n && sh_(n); if (s) ss_().deleteSheet(s); });
  shRequire_(APP.SH.ACTIVITY).deleteRow(act.__row);
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) { logSoft_('deskDeleteActivity compile', e); }
  return { context: deskContext() };
}

/** 모든 활동에 함께 들어가는 프롬프트 글([📐 공통규칙]) */
function deskCommon() {
  var s = shRequire_(APP.SH.COMMON);
  return readTable_(s, 2).map(function (r) {
    return { key: String(r['키'] || '').trim(), title: String(r['제목'] || ''), text: String(r['내용'] || '') };
  }).filter(function (r) { return r.key; });
}

/**
 * 공통 프롬프트 저장 — [내용] 칸만, 바뀐 줄만.
 * @param {Array<{key:string, text:string}>} list
 * @return {{saved:number, rows:Object[]}}
 */
function deskSaveCommon(list) {
  var s = shRequire_(APP.SH.COMMON);
  var c = colOf_(s, 2, '내용');
  if (!c) throw new Error('[📐 공통규칙]에 [내용] 칸이 없습니다. 메뉴 [①②③ 준비] > [① 처음 설치 / 구조 복구]를 누르면 다시 만들어집니다(적어 둔 내용은 그대로 둡니다).');
  var at = {};
  readTable_(s, 2).forEach(function (r) { var k = String(r['키'] || '').trim(); if (k) at[k] = { row: r.__row, text: String(r['내용'] || '') }; });
  var n = 0;
  (list || []).forEach(function (x) {
    var hit = at.hasOwnProperty(x.key) ? at[x.key] : null;
    if (!hit) return;
    var t = String(x.text == null ? '' : x.text);
    if (t === hit.text) return;
    s.getRange(hit.row, c).setValue(t);
    n++;
  });
  return { saved: n, rows: deskCommon() };
}

/**
 * 설정 저장 — 준 것만. API 키는 여기로 오지 않는다(saveKeys → UserProperties).
 * @param {{model?:string, compile?:string, backup?:string, batch?:number, thinkingLow?:boolean, mask?:boolean,
 *          autoRepair?:boolean, ground?:boolean, style?:boolean, years?:number}} p
 * @return {{context:Object, setup:Object}}
 */
function deskSaveSettings(p) {
  p = p || {};
  if (!sh_(APP.SH.CONFIG)) throw new Error('[⚙️ 설정] 시트가 없습니다. 메뉴 [①②③ 준비] > [① 처음 설치 / 구조 복구]를 누르면 다시 만들어집니다(적어 둔 내용은 그대로 둡니다).');
  var choices = modelChoices_();
  var model = function (k, v, allowEmpty) {
    if (v === undefined) return;
    var m = normModel(v);
    if (!m && allowEmpty) { setCfg_(k, ''); return; }
    if (choices.indexOf(m) < 0) throw new Error('쓸 수 없는 모델입니다: ' + v + ' (그 회사의 API 키를 먼저 넣어 주세요)');
    setCfg_(k, m);
  };
  model('활동용 모델', p.model);
  model('합본용 모델', p.compile);
  model('예비 모델', p.backup, true);
  if (p.batch !== undefined) setCfg_('한 번에 묶을 학생 수', Math.max(1, Math.min(10, Math.floor(Number(p.batch)) || 1)));
  if (p.years !== undefined) setCfg_('교사 경력(년)', Math.max(0, Math.min(45, Math.floor(Number(p.years)) || 0)));
  var bool = { thinkingLow: '생각 줄이기', mask: '학생 이름 마스킹', autoRepair: '자동 고쳐쓰기', ground: '근거 자동 확인', style: '내 문체 적용' };
  Object.keys(bool).forEach(function (k) { if (p[k] !== undefined) setCfg_(bool[k], p[k] === true); });
  return { context: deskContext(), setup: deskSetup() };
}

/** 창에서 명단 저장(붙여넣기) — 저장하고 모든 활동 시트에 반영한 뒤, 창이 다시 그릴 목록을 돌려준다 */
function deskRosterSave(p) {
  var res = rosterSave(p);
  return { count: res.count, mode: res.mode, warnings: res.warnings || [], context: deskContext() };
}

/** [👥 학생명단] 시트를 직접 고친 뒤 — 모든 활동 시트에 반영 */
function deskSyncRoster() {
  return { sheets: syncRosterAll_(), context: deskContext() };
}

/* ------------------------------------------------------------------ 취합 · 압축 · 점검 (v3.1.2) */

/** 취합 시트 하나 — 기록 영역 · 한도 · 칸 위치 */
function deskArea_(recKey) {
  var s = sh_(compileSheetName_(recKey));
  if (!s) throw new Error('[' + recKey + '] 취합이 아직 없습니다. [🔄 다시 모으기]를 눌러 주세요.');
  var rec = findByKey(getRecordTypes_(), recKey);
  var c = { merge: colOf_(s, APP.HEAD_ROW, '합본'), ai: colOf_(s, APP.HEAD_ROW, 'AI 압축결과'),
            fin: colOf_(s, APP.HEAD_ROW, '최종본'), check: colOf_(s, APP.HEAD_ROW, '검증'), chk: colOf_(s, APP.HEAD_ROW, '압축') };
  if (!c.merge || !c.fin) throw new Error('[' + s.getName() + '] 시트 구조가 올바르지 않습니다. [🔄 다시 모으기]를 눌러 주세요.');
  return { sheet: s, recKey: recKey, rec: rec, limit: (rec ? rec.chars : 500) * 3, cols: c };
}

/** 취합 시트 한 줄 → 창에 보낼 모양 (parts = 활동별 글) */
function deskAreaRowOf_(a, v, row) {
  var c = a.cols, g = function (col) { return col ? String(v[col - 1] == null ? '' : v[col - 1]) : ''; };
  return { row: row, cls: String(v[0]).trim(), no: String(v[1]).trim(), name: String(v[2] || ''),
           id: String(v[0]).trim() + '-' + String(v[1]).trim(),
           parts: v.slice(4, c.merge - 1).map(function (x) { return x == null ? '' : String(x); }),
           merged: g(c.merge), ai: g(c.ai), final: g(c.fin), check: g(c.check) };
}

function deskAreaRows_(a) {
  var s = a.sheet, last = s.getLastRow();
  if (last < APP.DATA_ROW) return [];
  var v = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, s.getLastColumn()).getValues();
  var out = [];
  v.forEach(function (r, i) {
    if (!String(r[0]).trim() && !String(r[1]).trim()) return;
    out.push(deskAreaRowOf_(a, r, APP.DATA_ROW + i));
  });
  return out;
}

/** 줄 번호가 그 학생이 아니면 학생 id 로 다시 찾는다 */
function deskAreaFind_(a, items) {
  var rows = deskAreaRows_(a), at = {};
  rows.forEach(function (r) { if (!at.hasOwnProperty(r.id)) at[r.id] = r; });
  var found = [], missing = [];
  (items || []).forEach(function (it) {
    var id = String(it.id), r = at[id];
    if (r) found.push({ item: it, cur: r }); else missing.push(id);
  });
  return { found: found, missing: missing };
}

/** 합본용 모델을 창 안 복사 · 붙여넣기로 돌려야 하는가 */
function deskCompileManual_() {
  var has = keyStatus_();
  var model = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var prov = providerOf_(model);
  return prov === 'manual' || prov === 'subscription' || !providerUsable(prov, has);
}

/**
 * 취합 보기 — 기록 영역(과세특 · 동아리 · 자율 · 진로 · 행발)마다 활동 결과를 모은 표.
 * refresh 이거나 취합 시트가 없으면 활동 결과를 다시 모은다([최종본]은 지키고, 합본이 한도 안이면 빈 최종본에 넣는다).
 * @param {{refresh?:boolean}=} p
 * @return {{areas:Array<{rec,name,mode,limit,sheet,acts:string[],rows:Object[]}>, manualOnly:boolean}}
 */
function deskCompile(p) {
  p = p || {};
  if (p.refresh || !compileSheets_().length) buildCompileCore_();
  var recs = getRecordTypes_(), order = recs.map(function (r) { return r.key; });
  var live = {};
  getActivities_().forEach(function (x) { if (x.recordKey) live[x.recordKey] = true; });
  var areas = [];
  compileSheets_().forEach(function (s) {
    var rk = recordKeyOfCompile_(s.getName());
    if (!live[rk]) return;                         // 활동이 모두 지워진 영역은 보이지 않는다
    var a;
    try { a = deskArea_(rk); } catch (e) { logSoft_('deskCompile ' + rk, e); return; }
    var head = s.getRange(APP.HEAD_ROW, 1, 1, s.getLastColumn()).getValues()[0];
    areas.push({ rec: rk, name: a.rec ? a.rec.name : rk, mode: DESK_HOMEROOM_RECORDS.indexOf(rk) >= 0 ? 'homeroom' : 'subject',
                 limit: a.limit, sheet: s.getName(), acts: head.slice(4, a.cols.merge - 1).map(String), rows: deskAreaRows_(a) });
  });
  areas.sort(function (x, y) { return order.indexOf(x.rec) - order.indexOf(y.rec); });
  var manual = true;
  try { manual = deskCompileManual_(); } catch (e) { logSoft_('deskCompile manual', e); }
  return { areas: areas, manualOnly: manual };
}

/**
 * 취합 최종본 저장 — 고친 학생 줄만. 저장 뒤 [검증]을 새로 쓴다.
 * @param {{rec:string, rows:Array<{id:string, row:number, final:string}>}} p
 * @return {{rows:Object[], missing:string[]}}
 */
function deskCompileSave(p) {
  var a = deskArea_(p.rec), s = a.sheet;
  var hit = deskAreaFind_(a, p.rows);
  var out = [];
  hit.found.forEach(function (f) {
    var txt = String(f.item.final == null ? '' : f.item.final);
    s.getRange(f.cur.row, a.cols.fin).setValue(txt);
    var chk = txt.trim() ? formatIssues(inspect_(txt, a.limit)) : '';
    if (a.cols.check) s.getRange(f.cur.row, a.cols.check).setValue(chk);
    f.cur.final = txt; f.cur.check = chk;
    out.push(f.cur);
  });
  SpreadsheetApp.flush();
  return { rows: out, missing: hit.missing };
}

/** 압축본을 최종본으로 — 최종본이 비었거나, 합본 그대로이거나, 한도를 넘을 때만(선생님이 다듬은 글은 덮지 않는다) */
function deskAdopt_(a, r) {
  var ai = String(r.ai || '').trim();
  if (!ai || ai.indexOf('⚠') === 0 || ai.indexOf('=') === 0) return r;
  var fin = String(r.final || '').trim();
  if (fin && fin !== String(r.merged || '').trim() && byteLen(fin) <= a.limit) return r;
  a.sheet.getRange(r.row, a.cols.fin).setValue(ai);
  var chk = formatIssues(inspect_(ai, a.limit)) + '\n(압축본)';
  if (a.cols.check) a.sheet.getRange(r.row, a.cols.check).setValue(chk);
  r.final = ai; r.check = chk; r.adopted = true;
  return r;
}

/** 키 없이 답을 넣은 뒤(또는 다시 읽을 때) 그 학생 줄들. adopt 면 압축본을 최종본으로 옮긴다 */
function deskCompileRows(p) {
  var a = deskArea_(p.rec);
  var want = {};
  (p.rows || []).forEach(function (r) { want[Number(r)] = true; });
  var out = deskAreaRows_(a).filter(function (r) { return want[r.row]; });
  if (p.adopt) { out = out.map(function (r) { return deskAdopt_(a, r); }); SpreadsheetApp.flush(); }
  return out;
}

/**
 * 합본이 한도를 넘는 학생의 글을 한도 안으로 줄인다. 키가 있으면 바로, 없으면 복사 · 붙여넣기 요청문을 돌려준다.
 * 보내는 것은 합본 글뿐이다(반 · 번호 · 이름은 보내지 않는다).
 * @param {{rec:string, rows:Array<{id:string, row:number}>}} p
 */
function deskCompress(p) {
  if (!consentOk_()) return { consent: false };
  var a = deskArea_(p.rec), s = a.sheet;
  var hit = deskAreaFind_(a, p.rows);
  var jobs = hit.found.map(function (f) { return f.cur; }).filter(function (r) { return r.merged.trim() !== ''; });
  var empty = hit.found.length - jobs.length;
  if (!jobs.length) return { empty: empty, rows: [] };
  var system = compressPrompt_(a.rec);
  var title = (a.rec ? a.rec.name : a.recKey) + ' 압축';
  if (deskCompileManual_()) {
    var data = manualPayload_({ kind: 'compile', sheet: s.getName(), target: 'AI 압축결과', check: '압축', title: title,
      limit: a.limit, system: system, heading: '통합할 문장들',
      jobs: jobs.map(function (r) { return { row: r.row, user: r.merged, label: (r.cls ? r.cls + '반 ' : '') + r.no + '번' + (maskName_() ? '' : ' ' + r.name) }; }) });
    return { manual: data, empty: empty };
  }
  var model = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var okN = 0, errN = 0, left = 0, t0 = Date.now(), out = [];
  usageReset_();
  for (var k = 0; k < jobs.length; k++) {
    var r = jobs[k];
    if (!canStartCall_(t0)) { left = jobs.length - k; break; }
    try {
      var res = callWithBackup_(system, r.merged, model);
      var txt = cleanResult_(res.text);
      if (byteLen(txt) > a.limit) txt = trimToBytes(txt, a.limit);
      if (a.cols.ai) s.getRange(r.row, a.cols.ai).setValue(txt);
      r.ai = txt;
      deskAdopt_(a, r);
      okN++;
    } catch (e) {
      r.ai = '⚠ 실패: ' + redactSecrets(e.message);
      if (a.cols.ai) s.getRange(r.row, a.cols.ai).setValue(r.ai);
      errN++;
    }
    out.push(r);
  }
  SpreadsheetApp.flush();
  return { done: { ok: okN, err: errN, left: left }, empty: empty, rows: out };
}

/**
 * ⚖️ 학생 간 점검 — 같은 문장 · 분량 격차 · 빈 학생. 창 안에서만 보여 준다(AI 로 보내지 않는다).
 * @param {{rec?:string, key?:string, cls?:string}} p  rec = 취합 영역, key = 활동 하나. cls 가 있으면 그 반만
 */
function deskEquity(p) {
  p = p || {};
  var name = p.rec ? compileSheetName_(p.rec) : deskAct_(p.key).act.inSheet;
  var cls = String(p.cls || '').trim();
  var rows = neisSourceRows_(name).filter(function (r) { return !cls || String(r.cls).trim() === cls; }).map(function (r) {
    return { label: (cls ? '' : String(r.cls).trim() + '반 ') + r.no + '번 ' + r.name, text: r.text };
  });
  var rep = checkEquity(rows);
  return { sheet: name, n: rep.n, filled: rep.filled, median: rep.median, similar: rep.similar, gaps: rep.gaps, empty: rep.empty };
}
