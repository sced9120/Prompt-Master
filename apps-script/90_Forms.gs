/**
 * 세특 작성 도우미 v3 — 📝 구글 설문지 연결
 *
 * 설문지 응답 시트(폼의 [응답] → [Sheets에 연결] → 이 파일)를 활동 시트에 잇는다.
 *   · 학생 칸(학번·학년·반·번호·이름)과 문항을 머리글 "이름"으로 읽는다 — 문항 순서를 바꾸거나 이메일 수집을 켜도 흔들리지 않는다
 *   · 문항 → 칸 연결은 창에서 고른다(이름이 같으면 저절로). 여러 문항을 한 칸에 모을 수 있다
 *   · 같은 학생이 여러 번 내면 마지막 응답, 명단에 없는 학생은 줄을 더하거나(선택) 목록으로 알려 준다
 *   · 선생님이 고친 칸은 덮어쓰지 않는다(설문지에서 넣은 값의 지문을 칸 메모에 남겨 비교)
 *   · [응답이 오면 저절로 받아 오기]를 켜면 제출 때마다 받아 오고, 원하면 그 학생만 바로 생성한다
 *   · 파일 업로드 문항(보고서)은 드라이브 링크로 들어오고, 📄 보고서 시트가 그 파일을 읽어 요점을 뽑는다
 * 연결 정보는 이 파일(DocumentProperties)에 저장한다.
 */

var FORM_LINKS_PROP = 'FORM_LINKS';
var FORM_NEW_COL = '＋';    // 새 활동: 이 문항 이름으로 새 입력 항목

/** 설문지 응답 시트 후보 — 1행 첫 칸이 타임스탬프 */
function formSheets_() {
  var acts = {};
  try { getActivities_().forEach(function (a) { acts[a.inSheet] = 1; acts[a.exSheet] = 1; }); } catch (e) {}
  return ss_().getSheets().filter(function (s) {
    if (acts[s.getName()] || s.getLastRow() < 1 || s.getLastColumn() < 2) return false;
    return /타임스탬프|timestamp/i.test(String(s.getRange(1, 1).getValue()));
  });
}

function formLinks_() {
  try { return JSON.parse(PropertiesService.getDocumentProperties().getProperty(FORM_LINKS_PROP) || '[]') || []; }
  catch (e) { return []; }
}
function saveFormLinks_(links) {
  PropertiesService.getDocumentProperties().setProperty(FORM_LINKS_PROP, JSON.stringify(links));
  ensureFormTrigger_(links);
}

/** 저절로 받아 오기를 켠 연결이 있으면 제출 트리거 하나, 없으면 지운다 */
function ensureFormTrigger_(links) {
  var want = (links || formLinks_()).some(function (l) { return l.auto; });
  var have = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'onFormSubmitInstalled'; });
  if (want && !have.length) ScriptApp.newTrigger('onFormSubmitInstalled').forSpreadsheet(ss_()).onFormSubmit().create();
  if (!want) have.forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

/* ------------------------------------------------------- 창 */
function openFormDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Form').setWidth(780).setHeight(700);
  ui_().showModalDialog(html, '📝 구글 설문지 연결');
}

/** 응답 시트 하나의 머리글 해석 + 파일 업로드 문항 찾기 */
function formSheetInfo_(s) {
  var head = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var info = parseFormHeader(head);
  var n = Math.min(Math.max(s.getLastRow() - 1, 0), 30);
  var sample = n ? s.getRange(2, 1, n, head.length).getValues() : [];
  info.questions.forEach(function (q) {
    q.isFile = sample.some(function (r) { return driveIdsIn(r[q.i]).length > 0; });
  });
  return { name: s.getName(), rows: Math.max(s.getLastRow() - 1, 0), head: head, info: info };
}

function formDialogContext() {
  var acts = getActivities_();
  return {
    sheets: formSheets_().map(formSheetInfo_),
    activities: acts.map(function (a) { return { key: a.key, name: a.name, mode: a.mode, cols: parseColumns(a.columns) }; }),
    records: getRecordTypes_().map(function (r) { return { key: r.key, name: r.name }; }),
    subjects: getSubjects_().map(function (s) { return { key: s.key, name: s.name }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    links: formLinks_().map(function (l) {
      var a = getActivity_(l.act);
      return { sheet: l.sheet, act: l.act, actName: a ? a.name : '(지워진 활동)', auto: !!l.auto, autoGen: !!l.autoGen, last: l.last || '' };
    }),
    hasKey: !!apiModelForChecks_(), rosterCount: (function () { try { return getRoster_().length; } catch (e) { return 0; } })(),
    reportCols: REPORT_COLUMNS
  };
}

/**
 * 연결 저장 + 지금 받아 오기
 * @param {{sheet:string, keys:Object, map:Object<string,string>, target:{type:string, key?:string, kind?:string, name?:string,
 *          recordKey?:string, subjectKey?:string}, auto:boolean, autoGen:boolean, addMissing:boolean}} p
 */
function formSave(p) {
  var fs = sh_(p.sheet);
  if (!fs) throw new Error('응답 시트를 찾을 수 없습니다: ' + p.sheet);
  var keys = p.keys || {};
  if (!(keys.sid >= 0 || (keys.cls >= 0 && keys.no >= 0) || keys.name >= 0)) {
    throw new Error('학생을 알아볼 칸(학번, 또는 반·번호, 또는 이름)을 하나 이상 골라 주세요.');
  }
  var map = p.map || {};
  var act;
  if (p.target.type === 'existing') {
    act = getActivity_(p.target.key);
    if (!act) throw new Error('활동을 찾을 수 없습니다.');
  } else {
    var name = safeKey_(p.target.name);
    if (!name) throw new Error('새 시트 이름을 적어 주세요.');
    var base = { name: name, recordKey: p.target.recordKey, subjectKey: p.target.subjectKey, desc: '구글 설문지로 받은 학생 응답' };
    if (p.target.kind === '보고서') act = getActivity_(createReportSheet(base).name);
    else if (p.target.kind === '바로쓰기') act = getActivity_(createQuickSheet(base).name);
    else {
      var cols = Object.keys(map).filter(function (q) { return map[q] === FORM_NEW_COL; });
      if (!cols.length) throw new Error('새 활동의 입력 항목으로 쓸 문항을 하나 이상 고르세요.');
      cols.forEach(function (q) { map[q] = q.replace(/[|,\n]/g, ' ').trim().slice(0, 40); });
      var made = createActivity_({ key: name, name: name, recordKey: p.target.recordKey, subjectKey: p.target.subjectKey,
                                   columns: cols.map(function (q) { return map[q]; }), desc: base.desc, examples: [] });
      act = getActivity_(made.key);
    }
  }
  var target = parseColumns(act.columns);
  Object.keys(map).forEach(function (q) { if (map[q] && target.indexOf(map[q]) < 0) map[q] = ''; });
  if (!Object.keys(map).some(function (q) { return map[q]; })) throw new Error('시트로 보낼 문항을 하나 이상 연결해 주세요.');
  var links = formLinks_().filter(function (l) { return l.sheet !== p.sheet; });
  var link = { sheet: p.sheet, act: act.key, keys: keys, map: map, auto: !!p.auto, autoGen: !!p.autoGen, addMissing: !!p.addMissing };
  links.push(link);
  saveFormLinks_(links);
  var r = pushFormLink_(link);
  link.last = stamp_();
  saveFormLinks_(links);
  return { act: act.name, inSheet: act.inSheet, result: r, text: formResultText_(r) };
}

function formUnlink(sheetName) {
  saveFormLinks_(formLinks_().filter(function (l) { return l.sheet !== sheetName; }));
  return '연결을 끊었습니다. 응답 시트와 이미 받아 온 내용은 그대로 있습니다.';
}

function formRunNow(sheetName) {
  var links = formLinks_();
  var l = links.filter(function (x) { return x.sheet === sheetName; })[0];
  if (!l) throw new Error('연결이 없습니다.');
  var r = pushFormLink_(l);
  l.last = stamp_();
  saveFormLinks_(links);
  return formResultText_(r);
}

/** 메뉴: 연결해 둔 설문지를 모두 지금 받아 온다 (없으면 연결 창) */
function syncFormResponses() {
  var links = formLinks_();
  if (!links.length) { openFormDialog(); return; }
  var lines = [];
  links.forEach(function (l) {
    try { lines.push('· ' + l.sheet + ' → ' + formResultText_(pushFormLink_(l))); l.last = stamp_(); }
    catch (e) { lines.push('· ' + l.sheet + ' — ' + e.message); }
  });
  saveFormLinks_(links);
  ui_().alert(APP.MENU, '설문지 응답을 받아 왔습니다.\n\n' + lines.join('\n'), ui_().ButtonSet.OK);
}

function formResultText_(r) {
  var t = '학생 ' + r.students + '명 반영';
  if (r.appended) t += ' · 새 줄 ' + r.appended;
  if (r.kept) t += ' · 선생님이 고친 칸 ' + r.kept + '개는 그대로';
  if (r.unmatched.length) t += ' · 명단에 없는 응답 ' + r.unmatched.length + '건(' + r.unmatched.slice(0, 5).join(', ') + (r.unmatched.length > 5 ? ' …' : '') + ')';
  return t;
}

/* ------------------------------------------------------- 받아 오기 */
/**
 * 응답 시트 → 활동 입력 시트
 * @return {{students:number, appended:number, kept:number, unmatched:string[], rows:number[]}}  rows = 이번에 값이 바뀐 줄
 */
function pushFormLink_(link) {
  var fs = sh_(link.sheet);
  if (!fs) throw new Error('응답 시트가 없습니다: ' + link.sheet);
  var act = getActivity_(link.act);
  if (!act) throw new Error('보낼 활동이 지워졌습니다. 연결을 다시 만드세요.');
  var t = sh_(act.inSheet);
  if (!t) throw new Error('입력 시트가 없습니다: ' + act.inSheet);
  var out = { students: 0, appended: 0, kept: 0, unmatched: [], rows: [] };
  var last = fs.getLastRow();
  if (last < 2) return out;

  var head = fs.getRange(1, 1, 1, fs.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var info = parseFormHeader(head);
  ['sid', 'year', 'cls', 'no', 'name'].forEach(function (k) {
    if (link.keys && link.keys[k] !== undefined && link.keys[k] !== null) info[k] = Number(link.keys[k]);
  });
  var resps = latestResponses(fs.getRange(2, 1, last - 1, head.length).getValues(), info);
  if (!resps.length) return out;

  var cols = parseColumns(act.columns);
  var byCol = {};       // 칸 이름 → [{title, i}]
  head.forEach(function (h, i) {
    var c = link.map && link.map[h];
    if (c && cols.indexOf(c) >= 0) (byCol[c] = byCol[c] || []).push({ title: h, i: i });
  });
  var grade = classHead_() === '학년-반';
  var labelOf = function (st) { return grade && st.year !== '' ? st.year + '-' + st.cls : String(st.cls); };

  // 학생 줄 찾기 — 반(학년-반)·번호, 안 되면 이름이 한 명뿐일 때
  var n0 = Math.max(t.getLastRow() - APP.DATA_ROW + 1, 0);
  var who = n0 ? t.getRange(APP.DATA_ROW, 1, n0, 3).getValues() : [];
  var byId = {}, byName = {}, nameCnt = {};
  who.forEach(function (w, i) {
    var id = String(w[0]).trim() + '-' + String(w[1]).trim();
    if (id !== '-') byId[id] = APP.DATA_ROW + i;
    var nm = String(w[2]).trim();
    if (nm) { nameCnt[nm] = (nameCnt[nm] || 0) + 1; byName[nm] = APP.DATA_ROW + i; }
  });
  var targets = [];
  resps.forEach(function (r) {
    var st = r.st;
    var row = (st.cls !== '' && st.no !== '') ? byId[labelOf(st) + '-' + st.no] : 0;
    if (!row && st.name && nameCnt[st.name] === 1) row = byName[st.name];
    if (!row) {
      var lab = (st.cls !== '' ? labelOf(st) + '반 ' : '') + (st.no !== '' ? st.no + '번 ' : '') + (st.name || '');
      if (!link.addMissing || st.cls === '' || st.no === '') { out.unmatched.push(lab.trim() || '(학생 칸 비어 있음)'); return; }
      row = Math.max(t.getLastRow(), APP.DATA_ROW - 1) + 1;
      ensureRows_(t, row);
      t.getRange(row, 1).setNumberFormat('@');
      t.getRange(row, 1, 1, 3).setValues([[labelOf(st), st.no, st.name]]);
      byId[labelOf(st) + '-' + st.no] = row;
      out.appended++;
    }
    targets.push({ row: row, resp: r });
  });
  if (out.appended) applyRowFormat_(t, t.getLastRow() - APP.DATA_ROW + 1);

  // 칸마다 한 번에 읽고 한 번에 쓴다 (선생님이 고친 칸은 남김)
  var nRows = t.getLastRow() - APP.DATA_ROW + 1;
  var when = stamp_();
  var touched = {}, changedRows = {};   // touched: 응답이 반영돼 있는 학생 · changedRows: 이번에 값이 바뀐 학생(바로 생성 대상)
  Object.keys(byCol).forEach(function (c) {
    var col = 5 + cols.indexOf(c);
    var rng = t.getRange(APP.DATA_ROW, col, nRows, 1);
    var vals = rng.getValues(), notes = rng.getNotes();
    var changed = false;
    targets.forEach(function (x) {
      var v = joinAnswers(byCol[c].map(function (q) { return { title: q.title, value: x.resp.row[q.i] }; }));
      if (!String(v).trim()) return;
      var k = x.row - APP.DATA_ROW;
      if (String(vals[k][0]) === v) { touched[x.row] = 1; return; }
      if (!formCellWritable(vals[k][0], notes[k][0])) { out.kept++; return; }
      vals[k][0] = v; notes[k][0] = formNote(textHash(v), when);
      changed = true; touched[x.row] = 1; changedRows[x.row] = 1;
    });
    if (changed) { rng.setValues(vals); rng.setNotes(notes); }
  });
  out.rows = Object.keys(changedRows).map(Number).sort(function (a, b) { return a - b; });
  out.students = Object.keys(touched).length;
  SpreadsheetApp.flush();
  return out;
}

/** 설치형 트리거: 설문지 제출 때마다 그 응답 시트를 받아 오고, 켜 두었으면 받은 학생만 생성 */
function onFormSubmitInstalled(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    var links = formLinks_();
    links.forEach(function (l) {
      if (!l.auto || (name && l.sheet !== name)) return;
      var r = pushFormLink_(l);
      l.last = stamp_();
      if (l.autoGen && r.rows.length && PROVIDERS.some(function (p) { return getKey_(p); })) {
        var act = getActivity_(l.act);
        var t = act && sh_(act.inSheet);
        if (t) runGeneration_(act, t, r.rows);
      }
    });
    PropertiesService.getDocumentProperties().setProperty(FORM_LINKS_PROP, JSON.stringify(links));
  } catch (err) {
    try { toast_('설문지 받아 오기 오류: ' + err.message); } catch (e2) {}
  }
}
