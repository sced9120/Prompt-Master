/**
 * 세특 작성 도우미 v3 — 📄 보고서 세특 · 보고서 파일 읽기 · 예시 등록 · ✒️ 내 문체
 *
 * 보고서 시트(프롬프트 모드 '보고서')의 입력 항목은 [보고서] [보고서 요점] [교사 관찰 메모] 세 칸.
 *   [보고서]      : 본문을 붙여 넣거나, 구글 드라이브 파일 링크(설문지 파일 업로드·클래스룸·직접 붙인 링크)
 *   [보고서 요점]  : AI 가 보고서에서 뽑고 교사가 확인·수정한다 — 생성에는 이 칸과 관찰 메모만 간다
 *   [교사 관찰 메모]: 교사가 수업에서 직접 본 것 (2026 기재요령: 세특은 교사가 관찰·평가한 내용 바탕)
 * 드라이브 파일은 읽기만 한다(drive.readonly). 구글 문서·PDF·사진·docx·hwpx·pptx·txt 를 읽고, .hwp 는 PDF 로 바꿔 달라고 안내한다.
 */

var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
// base64 로 보내면 4/3 배가 된다 — Gemini 한 요청 20MB 안쪽에 들도록
var REPORT_FILE_MAX = 10 * 1024 * 1024;     // 한 파일
var REPORT_PARTS_MAX = 13 * 1024 * 1024;    // 한 학생 첨부 합계
var STYLE_SAMPLE_MAX = 3;                   // 프롬프트에 넣을 문체 예시 수

/** 시작하기 시험 생성에 쓰는 보기 요점 (실제 학생 자료가 아님) */
var SAMPLE_POINTS =
  '탐구 주제와 동기: 급식 잔반량이 요일마다 다른 까닭이 궁금해 잔반 기록을 분석함\n' +
  '탐구 과정과 방법: 4주 동안 요일별 잔반 무게를 표로 정리하고 평균과 분산을 구함\n' +
  '결과와 해석: 금요일 잔반이 가장 많았고 메뉴 선호도 설문과 비교해 원인을 추측함\n' +
  '한계와 개선점: 조사 기간이 짧아 계절 영향을 보지 못했다고 스스로 밝힘\n' +
  '활용한 교과 개념: 평균, 분산, 표준편차\n' +
  '학생의 생각과 질문: 분산이 크면 무엇을 바꿔야 하는지 질문함';

function isReportActivity_(act) { return !!act && act.mode === '보고서'; }

/** 보고서 시트 만들기 (바로 쓰기 창에서 [📄 보고서]를 고르면) */
function createReportSheet(p) {
  var name = safeKey_(p.name) || ('보고서' + Date.now() % 1000);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, p.recordKey) || recs[0];
  var made = createActivity_({
    key: name, name: name, recordKey: rec.key,
    subjectKey: p.subjectKey || cfg_('기본 교과영역', '공통'),
    chars: Number(p.chars) || 0, columns: REPORT_COLUMNS, desc: String(p.desc || '').trim(),
    mode: '보고서'
  });
  var s = sh_(made.inSheet);
  if (s) ss_().setActiveSheet(s);
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { inSheet: made.inSheet, exSheet: made.exSheet, name: name };
}

/* ------------------------------------------------------- 드라이브 읽기 */
/** 드라이브 읽기 권한 — 처음 승인 때 체크를 풀었으면 여기서 다시 묻는다 */
function ensureDriveScope_() {
  try {
    if (ScriptApp.requireScopes) ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [DRIVE_SCOPE]);
  } catch (e) {
    throw new Error('보고서 파일을 읽으려면 "Google 드라이브 파일 보기" 권한이 필요합니다. 메뉴를 다시 눌러 승인 창에서 그 항목을 체크하고 [계속]을 누르세요. (' + e.message + ')');
  }
}

/** 구글 문서·프레젠테이션 → 글자 (Drive API 내보내기) */
function exportGoogleText_(id) {
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '/export?mimeType=text%2Fplain',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('구글 문서를 글자로 내보내지 못했습니다(' + res.getResponseCode() + ')');
  return res.getContentText('UTF-8');
}

/** zip 안 XML 들 → 글자 (docx·pptx·hwpx) */
function zipText_(blob, kind) {
  var entries = Utilities.unzip(blob.setContentType('application/zip'));
  var pick = kind === 'docx' ? /^word\/document\.xml$/ : kind === 'pptx' ? /^ppt\/slides\/slide(\d+)\.xml$/ : /^Contents\/section(\d+)\.xml$/;
  var found = entries.filter(function (b) { return pick.test(b.getName()); })
    .sort(function (a, b) {
      var na = Number((a.getName().match(/(\d+)\.xml$/) || [0, 0])[1]), nb = Number((b.getName().match(/(\d+)\.xml$/) || [0, 0])[1]);
      return na - nb;
    });
  return found.map(function (b) { return xmlText(b.getDataAsString('UTF-8'), kind); }).join('\n');
}

/**
 * [보고서] 칸 → 보낼 것. 링크가 없으면 글 그대로.
 * @return {{text:string, parts:Array<{mime,b64,name}>, files:string[], errors:string[]}}
 */
function readReportSource_(value) {
  var out = { text: '', parts: [], files: [], errors: [] };
  var ids = driveIdsIn(value);
  if (!ids.length) { out.text = String(value || '').trim(); return out; }
  ensureDriveScope_();
  var texts = [], rest = textWithoutLinks(value), total = 0;
  if (rest) texts.push(rest);
  ids.forEach(function (id) {
    var f;
    try { f = DriveApp.getFileById(id); } catch (e) { out.errors.push('파일을 열 수 없습니다(권한이 없거나 지워짐): …' + id.slice(-6)); return; }
    var name = f.getName(), mime = f.getMimeType(), kind = fileKind(mime, name);
    out.files.push(name);
    try {
      if (kind === 'gdoc') {
        try { texts.push(exportGoogleText_(id)); }
        catch (ex) {   // 글자 내보내기가 막히면 PDF 로 바꿔 그림째 보낸다
          var pdf = f.getAs('application/pdf');
          if (pdf.getBytes().length > REPORT_FILE_MAX) throw ex;
          out.parts.push({ mime: 'application/pdf', b64: Utilities.base64Encode(pdf.getBytes()), name: name + '.pdf' });
        }
      }
      else if (kind === 'text') texts.push(f.getBlob().getDataAsString('UTF-8'));
      else if (kind === 'docx' || kind === 'pptx' || kind === 'hwpx') texts.push(zipText_(f.getBlob(), kind));
      else if (kind === 'pdf' || kind === 'image') {
        var size = f.getSize();
        if (size > REPORT_FILE_MAX || total + size > REPORT_PARTS_MAX) { out.errors.push(name + ': 파일이 너무 큽니다(한 학생 10MB까지) — 쪽을 나누거나 사진 해상도를 줄여 올려 주세요'); return; }
        total += size;
        var m = kind === 'pdf' ? 'application/pdf' : (/jpe?g$/i.test(mime) ? 'image/jpeg' : mime);
        out.parts.push({ mime: m, b64: Utilities.base64Encode(f.getBlob().getBytes()), name: name });
      }
      else if (kind === 'hwp') out.errors.push(name + ': 한글(.hwp) 파일은 읽지 못합니다 — 한글에서 PDF나 HWPX로 저장해 올려 주세요');
      else out.errors.push(name + ': 읽을 수 없는 파일 형식(' + mime + ')');
    } catch (e) { out.errors.push(name + ': ' + e.message); }
  });
  out.text = texts.join('\n\n').trim();
  return out;
}

/* ------------------------------------------------------- 요점 뽑기 */
/** 한 학생 보고서 → 요점 (API). @return {{points:string, errors:string[], model:string}} */
function extractPoints_(reportValue, model) {
  var src = readReportSource_(reportValue);
  if (!src.text && !src.parts.length) throw new Error(src.errors.length ? src.errors.join(' / ') : '보고서가 비었습니다.');
  var res = callWithBackup_(EXTRACT_SYSTEM, buildExtractUser(src.text, src.files.filter(function (n, i) { return i < 5; })), model,
                            { parts: src.parts });
  return { points: cleanPoints(res.text), errors: src.errors, model: res.model };
}

/** 메뉴: 선택한(없으면 체크된) 학생의 보고서 요점 뽑기 */
function extractReportPoints() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!isReportActivity_(act)) {
    ui_().alert(APP.MENU, '📄 보고서 시트(○○ ▸입력)에서 학생 줄을 고른 뒤 실행하세요.\n보고서 시트는 메뉴 [✍️ 바로 쓰기 · 📄 보고서 시트 추가]에서 만듭니다.', ui_().ButtonSet.OK);
    return;
  }
  // [생성]을 체크한 학생이 있으면 그 학생들, 없으면 고른 줄
  var rows = checkedRows_(sheet);
  if (!rows.length) rows = selectedRows_(sheet);
  if (!rows.length) { toast_('[생성]을 체크하거나 학생 줄을 고르세요.'); return; }
  var c = function (n) { return colOf_(sheet, APP.HEAD_ROW, n); };
  var withReport = rows.filter(function (r) { return String(sheet.getRange(r, c(REPORT_COL)).getValue()).trim(); });
  if (!withReport.length) { toast_('고른 줄의 [보고서] 칸이 비었습니다.'); return; }
  var filled = withReport.filter(function (r) { return String(sheet.getRange(r, c(POINTS_COL)).getValue()).trim(); });
  var redo = false;
  if (filled.length) {
    var ans = ui_().alert(APP.MENU, filled.length + '명은 [보고서 요점]이 이미 있습니다. 다시 뽑아 덮어쓸까요?\n[아니요]를 누르면 빈 줄만 뽑습니다.', ui_().ButtonSet.YES_NO_CANCEL);
    if (ans === ui_().Button.CANCEL) return;
    redo = ans === ui_().Button.YES;
  }
  var todo = redo ? withReport : withReport.filter(function (r) { return filled.indexOf(r) < 0; });
  runExtraction_(act, sheet, todo, { manual: !apiModelForChecks_() });
}

/**
 * 요점 뽑기 실행 — API 면 학생마다 한 번씩, 키가 없으면 복사·붙여넣기 창(파일은 학생마다 한 명씩, 첨부 안내).
 * @return {{done:number, failed:number, rows:number[]}}  API 로 채운 줄
 */
function runExtraction_(act, sheet, rows, opt) {
  opt = opt || {};
  var c = function (n) { return colOf_(sheet, APP.HEAD_ROW, n); };
  var cR = c(REPORT_COL), cP = c(POINTS_COL), cV = c('검증');
  var model = apiModelForChecks_();
  if (opt.manual || !model) {
    var jobs = rows.map(function (r) {
      var v = String(sheet.getRange(r, cR).getValue());
      var who = sheet.getRange(r, 1, 1, 3).getValues()[0];
      var links = driveIdsIn(v).map(function (id) { return 'https://drive.google.com/open?id=' + id; });
      return { row: r, label: String(who[0]) + '반 ' + String(who[1]) + '번 ' + String(who[2]), links: links,
               user: buildExtractUser(textWithoutLinks(v) || (links.length ? '' : v), links.length ? ['보고서 파일 ' + links.length + '개를 이 대화에 첨부했습니다'] : []) };
    });
    openManualDialog_({ kind: 'extract', sheet: sheet.getName(), target: POINTS_COL, check: '', title: act.name + ' — 보고서 요점 뽑기',
      limit: 0, system: EXTRACT_SYSTEM, jobs: jobs, chunk: 1,   // 요점 답에는 [S1] 표시가 없어 한 명씩
      note: '요점을 시트에 넣은 뒤 읽어 보고 고치세요. 그다음 [생성]을 체크하고 메뉴 ⑥ 을 누르면 세특을 씁니다.' });
    return { done: 0, failed: 0, rows: [] };
  }
  var done = 0, failed = 0, okRows = [], t0 = Date.now();
  usageReset_();
  rows.forEach(function (r, k) {
    if (Date.now() - t0 > RUN_BUDGET_MS) return;
    toast_((k + 1) + '/' + rows.length + ' 보고서 읽는 중…', act.name);
    try {
      var x = extractPoints_(sheet.getRange(r, cR).getValue(), model);
      sheet.getRange(r, cP).setValue(x.points).setWrap(true);
      if (x.errors.length && cV) sheet.getRange(r, cV).setValue('[확인] 보고서 파일: ' + x.errors.join(' / '));
      done++; okRows.push(r);
    } catch (e) {
      if (cV) sheet.getRange(r, cV).setValue('⚠ 요점 뽑기 실패: ' + e.message);
      failed++;
    }
    SpreadsheetApp.flush();
  });
  if (!opt.quiet) toast_('보고서 요점 ' + done + '건' + (failed ? ' / 실패 ' + failed + '건([검증] 칸)' : '') +
                         ' — 요점을 읽고 고친 뒤 생성하세요.' + (usageText_() ? '\n' + usageText_() : ''), act.name);
  return { done: done, failed: failed, rows: okRows };
}

/* ------------------------------------------------------- 폴더에서 가져오기 */
/** 메뉴: 드라이브 폴더(클래스룸 과제 폴더 등)의 보고서 파일을 파일 이름으로 학생에게 붙인다 */
function importReportFolder() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!isReportActivity_(act)) { ui_().alert(APP.MENU, '📄 보고서 시트에서 실행하세요.', ui_().ButtonSet.OK); return; }
  var url = promptText_('보고서 폴더에서 가져오기',
    '보고서 파일이 든 구글 드라이브 폴더의 링크를 붙여 넣으세요.\n(클래스룸 과제 폴더도 됩니다. 파일 이름에 학번(20315)·이름·"3반 15번" 중 하나가 있어야 학생을 찾습니다)');
  if (!url) return;
  var r = importReportFolderCore_(sheet, url);
  ui_().alert(APP.MENU, '학생 ' + r.matched + '명에게 파일을 붙였습니다.' +
    (r.kept ? '\n이미 [보고서]에 내용이 있어 건너뛴 학생: ' + r.kept + '명' : '') +
    (r.unmatched.length ? '\n\n누구 것인지 모르는 파일 ' + r.unmatched.length + '개:\n· ' + r.unmatched.slice(0, 12).join('\n· ') + (r.unmatched.length > 12 ? '\n…' : '') : '') +
    (r.noFile ? '\n\n파일을 못 찾은 학생: ' + r.noFile + '명' : '') +
    '\n\n다음: 학생 줄을 고르고 메뉴 ⑥ 생성 더 보기 > [📄 보고서 요점 뽑기].', ui_().ButtonSet.OK);
}

function importReportFolderCore_(sheet, url) {
  var fid = driveFolderIdIn(url) || (String(url).trim().match(/^[A-Za-z0-9_-]{20,}$/) || [''])[0];
  if (!fid) throw new Error('폴더 링크를 알아보지 못했습니다. 드라이브에서 폴더를 열고 주소창의 링크를 복사하세요.');
  ensureDriveScope_();
  var folder = DriveApp.getFolderById(fid);
  var last = sheet.getLastRow();
  var n = Math.max(0, last - APP.DATA_ROW + 1);
  var who = n ? sheet.getRange(APP.DATA_ROW, 1, n, 3).getValues() : [];
  var students = who.map(function (w) {
    var a = String(w[0]).trim(), m = a.match(/^(\d)-(\d+)$/);
    return { year: m ? Number(m[1]) : '', cls: m ? Number(m[2]) : Number(a), no: Number(w[1]), name: String(w[2]).trim() };
  });
  var cR = colOf_(sheet, APP.HEAD_ROW, REPORT_COL);
  var cur = n ? sheet.getRange(APP.DATA_ROW, cR, n, 1).getValues().map(function (x) { return String(x[0]); }) : [];
  var add = {}, unmatched = [], count = 0;
  var it = folder.getFiles();
  while (it.hasNext() && count < 1000) {
    var f = it.next(); count++;
    var i = matchFileToStudent(f.getName(), students);
    if (i < 0) { unmatched.push(f.getName()); continue; }
    (add[i] = add[i] || []).push('https://drive.google.com/open?id=' + f.getId());
  }
  var matched = 0, kept = 0;
  Object.keys(add).forEach(function (k) {
    var i = Number(k);
    if (String(cur[i]).trim() && !driveIdsIn(cur[i]).length) { kept++; return; }   // 본문을 붙여 둔 학생은 그대로
    var have = driveIdsIn(cur[i]);
    var links = add[i].filter(function (l) { return have.indexOf(driveIdsIn(l)[0]) < 0; });
    var v = (String(cur[i]).trim() ? String(cur[i]).trim() + '\n' : '') + links.join('\n');
    sheet.getRange(APP.DATA_ROW + i, cR).setValue(v);
    matched++;
  });
  return { matched: matched, kept: kept, unmatched: unmatched, noFile: students.filter(function (s, i) { return s.name && !add[i]; }).length };
}

/* ------------------------------------------------------- 예시로 등록 */
/** 메뉴: 선택한 학생의 [최종본](없으면 AI 결과)을 이 활동의 예시로 */
function promoteToExample() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)에서 예시로 쓸 학생 줄을 고른 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('예시로 쓸 학생 줄을 고르세요.'); return; }
  var ok = ui_().alert(APP.MENU, '선택한 ' + rows.length + '명의 [최종본](비었으면 AI 결과)을 [' + act.name + ']의 예시로 등록합니다.\n\n' +
    '예시는 다른 학생을 생성할 때 AI 에게 함께 갑니다(학생 이름은 가지 않음). 선생님이 직접 쓰거나 고친 글일수록 좋습니다.\n' +
    '수준이 다른 학생 3~5명이 알맞습니다. 계속할까요?', ui_().ButtonSet.YES_NO);
  if (ok !== ui_().Button.YES) return;
  var r = promoteRows_(act, sheet, rows);
  toast_('예시 ' + r.added + '건 등록 → [' + r.exSheet + '] (지금 예시 ' + r.total + '건, 프롬프트에는 앞에서 ' + EXAMPLE_MAX + '건까지)' +
         (r.skipped ? ' · 글이 없어 건너뜀 ' + r.skipped + '명' : ''), act.name);
}

function promoteRows_(act, sheet, rows) {
  var cols = parseColumns(act.columns);
  var cFi = colOf_(sheet, APP.HEAD_ROW, '최종본'), cAi = colOf_(sheet, APP.HEAD_ROW, 'AI 결과');
  var exs = [], skipped = 0;
  rows.forEach(function (r) {
    var result = String(cFi ? sheet.getRange(r, cFi).getValue() : '').trim() || String(cAi ? sheet.getRange(r, cAi).getValue() : '').trim();
    if (!result || result.indexOf('⚠') === 0) { skipped++; return; }
    exs.push({ values: sheet.getRange(r, 5, 1, cols.length).getValues()[0].map(function (v) { return String(v); }), result: result });
  });
  var ex = act.exSheet && sh_(act.exSheet);
  if (!ex) {
    ex = buildActivityExampleSheet_(act.key, act.name, cols, []);
    var list = shRequire_(APP.SH.ACTIVITY);
    var c = colOf_(list, 2, '예시 시트');
    if (c && act.__row) list.getRange(act.__row, c).setValue(ex.getName());
  }
  var cResult = colOf_(ex, APP.HEAD_ROW, '결과') || (1 + cols.length + 1);
  var last = Math.max(ex.getLastRow(), APP.DATA_ROW - 1);
  var empty = [];
  if (last >= APP.DATA_ROW) {
    var v = ex.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, cResult).getValues();
    v.forEach(function (row, i) { if (row.slice(1).every(function (x) { return String(x).trim() === ''; })) empty.push(APP.DATA_ROW + i); });
  }
  exs.forEach(function (e) {
    var at = empty.length ? empty.shift() : Math.max(ex.getLastRow(), APP.DATA_ROW - 1) + 1;
    writeExampleRows_(ex, cols, [e], at, 1);
  });
  try { validateExamplesQuiet_(getActivity_(act.key) || act); } catch (e) {}
  return { added: exs.length, skipped: skipped, exSheet: ex.getName(), total: readExampleRows_(getActivity_(act.key) || act).length };
}

/* ------------------------------------------------------- ✒️ 내 문체 */
var STYLE_HEAD = ['사용', '예전에 쓴 세특 (한 칸에 한 편)', '기록 항목', '메모'];

function buildStyleSheet() {
  var s = shOrCreate_(APP.SH.STYLE);
  var n = STYLE_HEAD.length;
  banner_(s, n, '✒️ 내 문체 — 예전에 쓴 세특으로 "나처럼" 쓰게 하기',
    '예전에 직접 쓴 세특을 한 칸에 한 편씩 붙여 넣으세요(학생 이름은 지우고). [사용]을 켠 앞의 ' + STYLE_SAMPLE_MAX + '편이 "문체 예시"로 모든 생성에 함께 가고, ' +
    '메뉴 ⑧ [✒️ 내 문체 카드 만들기]를 누르면 쓰는 방식만 뽑은 카드가 [📐 공통규칙]의 STYLE_CARD 에 저장되어 학생마다 쓰기 직전에 한 번 더 보여 줍니다. ' +
    '끄려면 [⚙️ 설정]의 내 문체 적용을 FALSE 로.');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([STYLE_HEAD]);
  styleHeader_(s, APP.HEAD_ROW, n, '#4a3f6b');
  s.setFrozenRows(APP.HEAD_ROW);
  ensureRows_(s, APP.DATA_ROW + 30);
  s.getRange(APP.DATA_ROW, 1, 30, 1).insertCheckboxes();
  s.getRange(APP.DATA_ROW, 2, 30, 1).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
  [56, 640, 110, 200].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  return s;
}

/** [📐 공통규칙]에 STYLE_CARD 줄이 없으면 맨 아래에 더한다 (옛 사본) */
function ensureStyleCardRow_() {
  var s = sh_(APP.SH.COMMON);
  if (!s) return;
  var last = s.getLastRow();
  var keys = last >= 3 ? s.getRange(3, 1, last - 2, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  if (keys.indexOf('STYLE_CARD') >= 0) return;
  s.getRange(last + 1, 1, 1, 3).setValues([['STYLE_CARD', '내 문체 카드', '']]);
  s.getRange(last + 1, 1, 1, 2).setBackground(APP.COLORS.lock);
  s.getRange(last + 1, 3).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
}

/** [사용]을 켠 예전 세특 (앞에서부터) */
function styleSampleTexts_(max) {
  var s = sh_(APP.SH.STYLE);
  if (!s || s.getLastRow() < APP.DATA_ROW) return [];
  return s.getRange(APP.DATA_ROW, 1, s.getLastRow() - APP.DATA_ROW + 1, 2).getValues()
    .filter(function (r) { return (r[0] === true || String(r[0]).toUpperCase() === 'TRUE') && String(r[1]).trim(); })
    .map(function (r) { return String(r[1]).trim(); })
    .slice(0, max || STYLE_SAMPLE_MAX);
}

var __styleSamples = null;
function readStyleSamples_() {
  if (__styleSamples !== null) return __styleSamples;
  var t = styleSampleTexts_(STYLE_SAMPLE_MAX);
  __styleSamples = t.map(function (x, i) { return '## 문체 예시' + (i + 1) + '\n' + x; }).join('\n\n');
  return __styleSamples;
}

/** 문체 검사의 기준 글: 이 활동의 예시 결과 + 내 문체 예시 */
function styleReference_(act) {
  var texts = [];
  try { texts = readExampleRows_(act).map(function (e) { return e.result; }); } catch (e) {}
  if (styleOn_()) texts = texts.concat(styleSampleTexts_(6));
  return styleProfile(texts.slice(0, 12)) ;
}

function openStyleDialog() {
  if (!sh_(APP.SH.STYLE)) buildStyleSheet();
  ensureStyleCardRow_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Style').setWidth(720).setHeight(640);
  ui_().showModalDialog(html, '✒️ 내 문체 카드');
}

function styleContext() {
  return { samples: styleSampleTexts_(20).length, card: String(getCommon_().STYLE_CARD || ''), on: styleOn_(),
           model: apiModelForChecks_(), request: STYLE_SYSTEM + '\n\n' + buildStyleUser(styleSampleTexts_(10)) };
}

/** AI 로 문체 카드 만들기 (저장은 하지 않고 돌려준다 — 창에서 보고 [저장]) */
function styleMakeCard() {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없습니다. [요청문 복사]로 Gemini 앱에서 만들어 붙여 넣으세요.');
  var samples = styleSampleTexts_(10);
  if (samples.length < 2) throw new Error('[✒️ 내 문체] 시트에 예전 세특을 2편 이상 넣고 [사용]을 켜 주세요.');
  usageReset_();
  var res = callWithBackup_(STYLE_SYSTEM, buildStyleUser(samples), model);
  return { card: String(res.text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim(), usage: usageText_() };
}

function styleSaveCard(text) {
  ensureStyleCardRow_();
  var s = shRequire_(APP.SH.COMMON);
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === 'STYLE_CARD') { s.getRange(i + 1, 3).setValue(String(text || '').trim()); return '저장했습니다. 다음 생성부터 모든 활동에 적용됩니다.'; }
  }
  throw new Error('공통규칙에 STYLE_CARD 줄을 만들지 못했습니다.');
}

function openStyleSheet() { var s = sh_(APP.SH.STYLE) || buildStyleSheet(); ss_().setActiveSheet(s); }
