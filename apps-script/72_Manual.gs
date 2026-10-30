/**
 * 세특 작성 도우미 v3 — 키 없이 쓰기 (복사 · 붙여넣기)
 *
 * API 키가 없는 선생님도 처음부터 끝까지 쓸 수 있게 하는 길.
 *   ① 시트가 규칙(프롬프트)과 학생 자료를 한 덩어리로 만들어 준다 — 학생 이름은 보내지 않는다(마스킹)
 *   ② 선생님이 Gemini 앱(학교 계정 권장)·ChatGPT·Claude 대화창에 붙여 넣는다
 *   ③ 받은 답을 창에 붙여 넣으면 학생별로 나눠 [AI 결과]에 넣고 바로 검사한다
 * 스크립트는 바깥으로 아무것도 보내지 않는다. 대화창에 무엇을 붙여 넣을지는 선생님이 본다.
 */

/**
 * @param {{kind:string, sheet:string, target:string, check:string, title:string, limit:number,
 *          system:string, jobs:Array<{row:number, user:string, label:string, links?:string[]}>, note?:string,
 *          heading?:string, chunk?:number}} p
 *   kind: 'generate' | 'compile' | 'extract'(보고서 요점 — 줄바꿈을 살리고 검사하지 않음)
 *   chunk: 한 번에 묶을 학생 수(보고서 파일을 첨부해야 하면 1)
 */
function openManualDialog_(p) {
  var size = p.chunk || Math.min(10, Math.max(5, Number(cfg_('한 번에 묶을 학생 수', 5)) || 5));
  var tail = p.kind === 'extract' ? '' : styleTail_();
  var chunks = [];
  for (var i = 0; i < p.jobs.length; i += size) {
    var part = p.jobs.slice(i, i + size);
    var items = part.map(function (j, n) { return { id: 'S' + (n + 1), block: j.user }; });
    chunks.push({
      rows: part.map(function (j) { return j.row; }),
      ids: items.map(function (x) { return x.id; }),
      labels: part.map(function (j) { return j.label; }),
      links: part.map(function (j) { return j.links || []; }),
      user: p.kind === 'extract' ? items.map(function (x) { return x.block; }).join('\n\n') : buildManualUser(items, p.heading) + tail
    });
  }
  var data = {
    kind: p.kind, sheet: p.sheet, target: p.target, check: p.check, title: p.title, limit: p.limit,
    system: p.system, gem: buildGemText(p.system), chunks: chunks, note: p.note || '', aiNotice: AI_NOTICE_2026,
    account: accountInfo_(), masked: maskName_()
  };
  var t = HtmlService.createTemplateFromFile('UI_Manual');
  t.data = JSON.stringify(data).replace(/</g, '\\u003c');
  ui_().showModalDialog(t.evaluate().setWidth(800).setHeight(690), '📋 키 없이 쓰기 — ' + p.title);
}

/**
 * 대화창에서 복사해 온 답을 학생별로 나눠 시트에 넣는다.
 * @param {{sheet:string, target:string, check:string, limit:number, rows:number[], ids:string[], labels:string[], answer:string}} p
 * @return {{written:number, missing:string[], results:Array<{label, bytes, limit, ok, issues:string[]}>}}
 */
function manualApply(p) {
  var s = sh_(p.sheet);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + p.sheet);
  var cT = colOf_(s, APP.HEAD_ROW, p.target);
  if (!cT) throw new Error('[' + p.target + '] 칸이 없습니다. 시트 구조를 확인하세요.');
  var cV = colOf_(s, APP.HEAD_ROW, '검증');
  var cC = p.check ? colOf_(s, APP.HEAD_ROW, p.check) : 0;
  var parsed = parseManualAnswer(p.answer, p.ids || []);
  var results = [], written = 0;
  var extract = p.kind === 'extract';
  var ref = null;
  if (!extract) { try { var act = activityOfSheet_(p.sheet); if (act) ref = styleReference_(act); } catch (e) {} }
  (p.ids || []).forEach(function (id, n) {
    var row = p.rows[n];
    var raw = parsed.map[id];
    if (!raw || !row) return;
    if (extract) {
      s.getRange(row, cT).setValue(cleanPoints(raw)).setWrap(true);
      written++;
      results.push({ label: (p.labels || [])[n] || id, bytes: 0, limit: 0, ok: true, issues: ['요점을 넣었습니다 — 읽고 고친 뒤 생성하세요'] });
      return;
    }
    var txt = cleanResult_(raw);
    var v = inspectStyled_(txt, Number(p.limit) || 1500, ref);
    s.getRange(row, cT).setValue(txt);
    if (cV) s.getRange(row, cV).setValue(formatIssues(v) + '\n(키 없이 · 복사·붙여넣기)');
    if (cC) s.getRange(row, cC).setValue(false);
    written++;
    results.push({ label: (p.labels || [])[n] || id, bytes: v.bytes, limit: Number(p.limit) || 1500, ok: v.ok,
                   issues: v.issues.map(function (x) { return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : ''); }) });
  });
  SpreadsheetApp.flush();
  var missing = parsed.missing.map(function (id) { var k = (p.ids || []).indexOf(id); return (p.labels || [])[k] || id; });
  return { written: written, missing: missing, results: results };
}

/** 선택한 행을 시트에서 보여 주기(창에서 학생 이름을 누르면) */
function manualGoto(p) {
  var s = sh_(p.sheet);
  if (!s) return false;
  ss_().setActiveSheet(s);
  var c = colOf_(s, APP.HEAD_ROW, p.target) || 1;
  s.getRange(p.row, c).activate();
  return true;
}
