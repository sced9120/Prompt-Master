/**
 * 세특 작성 도우미 v3 — 생성 실행
 *
 * 한 학생의 흐름 (하네스):
 *   ① 규칙 조립(기록종류·교과·공통규칙·기재 주의 — 그 활동에 필요한 것만)
 *   ② 생성 → ③ 자동 검사([📏 기재요령] 표 + 맞춤법)
 *   ④ [수정]이 나오면 걸린 점만 짚어 한 번 더 고쳐 쓰게 한다(자동 고쳐쓰기)
 *   ⑤ (켜 두었으면) 학생 자료에 없는 내용이 들어갔는지 근거 확인
 * 키가 없거나 모델이 [키 없이(복사·붙여넣기)] 인 줄은 ②~⑤ 대신 복사·붙여넣기 창으로 넘긴다.
 */

/** 한 번 실행에서 AI 호출에 쓸 시간 (Apps Script 한도 6분보다 여유 있게) */
var RUN_BUDGET_MS = 300000;

/** 현재 시트가 어떤 활동의 입력 시트인지 */
function activityOfSheet_(name) {
  var acts = getActivities_();
  for (var i = 0; i < acts.length; i++) if (acts[i].inSheet === name) return acts[i];
  return null;
}

function generateChecked() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) {
    if (recordKeyOfCompile_(sheet.getName())) { compileChecked(); return; }
    ui_().alert(APP.MENU, '활동 입력 시트에서 실행하세요.\n(시트 이름이 "○○ ▸입력" 인 시트)', ui_().ButtonSet.OK);
    return;
  }
  var rows = checkedRows_(sheet);
  if (!rows.length) { toast_('[생성] 체크된 행이 없습니다.'); return; }
  autoRulesCheck_();
  runGeneration_(act, sheet, rows);
}

function generateSelection() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트에서 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('데이터 행을 선택하세요.'); return; }
  runGeneration_(act, sheet, rows);
}

/** 메뉴 ⑥: 모델과 상관없이 체크된 행을 복사·붙여넣기로 */
function openManualForChecked() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) {
    if (recordKeyOfCompile_(sheet.getName())) { compileChecked({ manual: true }); return; }
    ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)나 최종취합 시트에서 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var rows = checkedRows_(sheet);
  if (!rows.length) rows = selectedRows_(sheet);
  if (!rows.length) { toast_('[생성]을 체크하거나 행을 선택하세요.'); return; }
  runGeneration_(act, sheet, rows, { manual: true });
}

function selectedRows_(sheet) {
  var r = sheet.getActiveRange();
  var rows = [];
  if (!r) return rows;
  for (var i = 0; i < r.getNumRows(); i++) {
    var row = r.getRow() + i;
    if (row >= APP.DATA_ROW) rows.push(row);
  }
  return rows;
}

function checkedRows_(sheet) {
  var c = colOf_(sheet, APP.HEAD_ROW, '생성');
  if (!c) return [];
  var last = sheet.getLastRow();
  if (last < APP.DATA_ROW) return [];
  var v = sheet.getRange(APP.DATA_ROW, c, last - APP.DATA_ROW + 1, 1).getValues();
  var rows = [];
  for (var i = 0; i < v.length; i++) if (v[i][0] === true) rows.push(APP.DATA_ROW + i);
  return rows;
}

/** 이 학생 줄의 AI 자료(이름은 마스킹 설정을 따름). 자료가 비었으면 null */
function studentJob_(sheet, row, cols, rec, masked) {
  var vals = sheet.getRange(row, 5, 1, cols.length).getValues()[0];
  var filled = vals.some(function (v) { return String(v).trim() !== ''; });
  if (!filled) return null;
  var grade = sheet.getRange(row, 4).getValue();
  var user = buildStudentBlock(cols, vals, { grade: (rec && rec.useGrade) ? grade : '' });
  if (!masked) user = '학생 이름: ' + sheet.getRange(row, 3).getValue() + '\n' + user;
  var who = sheet.getRange(row, 1, 1, 3).getValues()[0];
  return { row: row, user: user, label: String(who[0]) + '반 ' + String(who[1]) + '번 ' + String(who[2]) };
}

/**
 * 실제 생성 루프
 * @param {{manual?:boolean}=} opt  manual: 모든 줄을 복사·붙여넣기로
 */
function runGeneration_(act, sheet, rows, opt) {
  opt = opt || {};
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) { toast_('다른 생성 작업이 실행 중입니다.'); return; }
  var manualJobs = [], manualNote = '';
  try {
    var maxN = Number(cfg_('1회 최대 생성 건수', 25));
    if (rows.length > maxN && !opt.manual) {
      ui_().alert(APP.MENU, '한 번에 ' + maxN + '건까지 처리합니다. 앞에서부터 ' + maxN + '건만 진행합니다.\n' +
        '(설정 시트에서 늘릴 수 있지만, 실행 시간 제한으로 실패할 수 있습니다.)', ui_().ButtonSet.OK);
      rows = rows.slice(0, maxN);
    }

    var cols = parseColumns(act.columns);
    var head = APP.HEAD_ROW;
    var cGen = colOf_(sheet, head, '생성');
    var cModel = colOf_(sheet, head, '모델');
    var cAi = colOf_(sheet, head, 'AI 결과');
    var cValid = colOf_(sheet, head, '검증');
    var limit = charsFor_(act) * 3;
    var system = promptFor_(act);
    var defModel = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
    var autoValidate = cfgBool_('결과 자동검증', true);
    var autoRepair = cfgBool_('자동 고쳐쓰기', true);
    var autoGround = cfgBool_('근거 자동 확인', false);
    var batchN = Math.max(1, Math.min(10, Number(cfg_('한 번에 묶을 학생 수', 5)) || 1));
    var rec = findByKey(getRecordTypes_(), act.recordKey);
    var masked = maskName_();
    var has = keyStatus_();
    var anyApi = has.gemini || has.openai || has.anthropic;
    usageReset_();

    var okN = 0, skipN = 0, errN = 0, subN = 0, leftN = 0, backupN = 0, fixN = 0;
    var t0 = Date.now();

    // 1) 행마다 학생 자료와 모델을 먼저 모은다
    var jobs = [];
    rows.forEach(function (row) {
      var job = studentJob_(sheet, row, cols, rec, masked);
      if (!job) { skipN++; if (cGen) sheet.getRange(row, cGen).setValue(false); return; }
      var model = cModel ? normModel(sheet.getRange(row, cModel).getValue()) : '';
      job.model = model || defModel;
      var prov = providerOf_(job.model);
      // 키 없이 쓰기: 고른 모델이 복사·붙여넣기이거나, API 키가 하나도 없는데 키가 필요한 모델이면
      if (opt.manual || prov === 'manual' || (!anyApi && prov !== 'subscription' && !providerUsable(prov, has))) {
        if (!opt.manual && prov !== 'manual') {
          manualNote = 'API 키가 없어 [키 없이 — 복사·붙여넣기]로 진행합니다. 키를 넣으면 메뉴 ⑥ 한 번으로 자동 생성됩니다.';
        }
        manualJobs.push(job);
        return;
      }
      jobs.push(job);
    });

    var finish = function (job, res, repaired) {
      var txt = cleanResult_(res.text);
      sheet.getRange(job.row, cAi).setValue(txt);
      if (autoValidate && cValid) {
        var v = formatIssues(inspect_(txt, limit));
        if (repaired) v += '\n(자동 고쳐쓰기 1회)';
        if (res.backup) v += '\n(예비 모델 ' + res.model + ' 로 생성)';
        if (res.ground) v += '\n' + res.ground;
        sheet.getRange(job.row, cValid).setValue(v);
      }
      if (cGen) sheet.getRange(job.row, cGen).setValue(false);
      okN++; if (res.backup) backupN++;
    };
    var fail = function (job, e) {
      sheet.getRange(job.row, cAi).setValue('⚠ 실패: ' + e.message);
      if (cGen) sheet.getRange(job.row, cGen).setValue(false);
      errN++;
    };
    /** ③~⑤ 검사 → 고쳐쓰기 → 근거 확인 */
    var polish = function (job, res) {
      var repaired = false;
      if (autoRepair && Date.now() - t0 < RUN_BUDGET_MS) {
        var draft = cleanResult_(res.text);
        var v1 = inspect_(draft, limit);
        if (needsRepair(v1)) {
          try {
            var fixList = v1.issues.filter(function (x) { return x.level === 'block'; });
            var r2 = callWithBackup_(system, buildRepairUser(job.user, draft, fixList, limit), res.model || job.model);
            var t2 = cleanResult_(r2.text);
            if (t2 && betterResult(v1, inspect_(t2, limit)) === 'b') {
              res = { text: t2, model: r2.model, backup: res.backup || r2.backup };
              repaired = true; fixN++;
            }
          } catch (e) {}
        }
      }
      if (autoGround && Date.now() - t0 < RUN_BUDGET_MS) {
        try { res.ground = groundText_(groundCheck_(job.user, cleanResult_(res.text), res.model || job.model)); } catch (e) {}
      }
      finish(job, res, repaired);
    };

    // 2) 같은 모델끼리 batchN 명씩 묶어서 부른다
    var i = 0;
    while (i < jobs.length) {
      // Apps Script 한 번 실행은 약 6분까지. 넘기기 전에 멈추고, 남은 행은 체크를 그대로 둔다.
      if (Date.now() - t0 > RUN_BUDGET_MS) { leftN = jobs.length - i; break; }
      var first = jobs[i];
      if (providerOf_(first.model) === 'subscription') {
        sheet.getRange(first.row, cAi).setFormula(subscriptionFormula_(system, first.user));
        subN++; i++;
        continue;   // 수식 결과는 시트가 계산하므로 체크 유지
      }
      var chunk = [first], k = i + 1;
      while (chunk.length < batchN && k < jobs.length && jobs[k].model === first.model) { chunk.push(jobs[k]); k++; }
      i = k;
      toast_((i) + '/' + jobs.length + ' 생성 중… (' + first.model + (chunk.length > 1 ? ' · ' + chunk.length + '명 묶음' : '') + ')', act.name);

      var got = chunk.length > 1 ? generateBatch_(system, chunk, first.model) : {};
      if (got.error) { chunk.forEach(function (job) { fail(job, got.error); }); SpreadsheetApp.flush(); continue; }
      chunk.forEach(function (job) {
        try {
          polish(job, got[job.row] || callWithBackup_(system, job.user, job.model));
        } catch (e) { fail(job, e); }
      });
      SpreadsheetApp.flush();
    }

    var msg = '완료 ' + okN + '건';
    if (fixN) msg += ' (그중 자동 고쳐쓰기 ' + fixN + '건)';
    if (subN) msg += ' / 구독수식 ' + subN + '건(AI 결과 칸을 선택하고 [생성 및 삽입]을 눌러 주세요)';
    if (skipN) msg += ' / 자료 없음 ' + skipN + '건';
    if (errN) msg += ' / 실패 ' + errN + '건';
    if (backupN) msg += ' / 예비 모델 ' + backupN + '건';
    var used = usageText_();
    if (leftN) {
      ui_().alert(APP.MENU, msg + '\n\n실행 시간 제한(약 6분)에 가까워져 ' + leftN + '건을 남기고 멈췄습니다.\n' +
        '남은 행은 [생성] 체크가 그대로 있으니 메뉴 ⑥ 을 한 번 더 누르세요.\n' +
        '(자주 멈춘다면 [⚙️ 설정]의 1회 최대 생성 건수를 줄이거나 더 빠른 모델을 쓰세요)' +
        (used ? '\n\n' + used : ''), ui_().ButtonSet.OK);
    } else if (jobs.length || skipN) toast_(msg + (used ? '\n' + used : ''), act.name);
  } finally { lock.releaseLock(); }

  // 3) 키 없이 쓰는 줄 — 복사·붙여넣기 창 (잠금을 푼 뒤에 연다)
  if (manualJobs.length) {
    openManualDialog_({
      kind: 'generate', sheet: sheet.getName(), target: 'AI 결과', check: '생성',
      title: act.name, limit: charsFor_(act) * 3, system: promptFor_(act), jobs: manualJobs, note: manualNote
    });
  }
}

/**
 * 여러 학생을 한 번의 호출로 생성한다.
 * @return {Object} row → {text, model, backup}. 호출 자체가 실패하면 {error: Error}.
 *         응답에서 빠진 학생은 결과에 없으므로, 부르는 쪽이 한 명씩 다시 부른다.
 */
function generateBatch_(system, chunk, model) {
  var ids = chunk.map(function (job, n) { return 'S' + (n + 1); });
  var user = buildBatchUser(chunk.map(function (job, n) { return { id: ids[n], block: job.user }; }));
  var res;
  try {
    res = callWithBackup_(system, user, model, { json: true, schema: BATCH_SCHEMA });
  } catch (e) {
    return e.kind ? { error: e } : {};     // API 오류면 모두 실패로, 그 밖(빈 응답 등)은 한 명씩 다시
  }
  var parsed = parseBatchResult(res.text, ids);
  var out = {};
  chunk.forEach(function (job, n) {
    var t = parsed.map[ids[n]];
    if (t) out[job.row] = { text: t, model: res.model, backup: res.backup };
  });
  return out;
}

/* ------------------------------------------------------- 근거 확인 */
/** 학생 자료 ↔ 초안 → 자료에 없는 구절 목록 */
function groundCheck_(source, draft, model) {
  var res = callWithBackup_(GROUND_SYSTEM, buildGroundUser(source, draft), model, { json: true });
  return parseGroundResult(res.text);
}

function groundText_(list) {
  if (!list || !list.length) return '[근거] 학생 자료에 없는 내용 못 찾음';
  return list.slice(0, 4).map(function (x) {
    return '[확인] 자료에 없는 내용 → "' + x.quote.slice(0, 40) + '"' + (x.why ? ' (' + x.why.slice(0, 40) + ')' : '');
  }).join('\n');
}

/** 근거 확인·검사 창에 쓸 모델 — 활동용 모델의 키가 없으면 키가 있는 회사의 기본 모델. 없으면 '' */
function apiModelForChecks_() {
  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var p = providerOf_(model);
  if (p !== 'subscription' && p !== 'manual' && modelUsable_(model)) return model;
  var withKey = PROVIDERS.filter(function (x) { return getKey_(x); })[0];
  return withKey ? PROVIDER_DEFAULT_MODEL[withKey] : '';
}

/** 메뉴 ⑧: 선택한 행의 AI 결과(또는 최종본)가 학생 자료에 있는 내용인지 */
function groundCheckSelection() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)에서 확인할 행을 선택한 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('확인할 학생 행을 선택하세요.'); return; }
  var model = apiModelForChecks_();
  if (!model) {
    ui_().alert(APP.MENU, '근거 확인은 API 키가 있어야 자동으로 됩니다.\n\n키 없이 하려면 메뉴 [🔍 맞춤법 · 금지어 검사] 창에 글과 학생 자료를 넣고 ' +
      '[Gemini 앱에서 근거 확인 — 요청 복사]를 누르세요.', ui_().ButtonSet.OK);
    return;
  }
  var cols = parseColumns(act.columns);
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var cAi = colOf_(sheet, APP.HEAD_ROW, 'AI 결과'), cFi = colOf_(sheet, APP.HEAD_ROW, '최종본'), cV = colOf_(sheet, APP.HEAD_ROW, '검증');
  var n = 0, found = 0, t0 = Date.now();
  usageReset_();
  for (var i = 0; i < rows.length; i++) {
    if (Date.now() - t0 > RUN_BUDGET_MS) break;
    var job = studentJob_(sheet, rows[i], cols, rec, true);
    var draft = String(cFi ? sheet.getRange(rows[i], cFi).getValue() : '').trim() || String(sheet.getRange(rows[i], cAi).getValue()).trim();
    if (!job || !draft || draft.indexOf('⚠') === 0) continue;
    toast_((i + 1) + '/' + rows.length + ' 근거 확인 중…', APP.MENU);
    try {
      var list = groundCheck_(job.user, draft, model);
      if (list.length) found++;
      var prev = String(sheet.getRange(rows[i], cV).getValue()).split('\n')
        .filter(function (l) { return !/^\[근거\]|자료에 없는 내용/.test(l); }).join('\n');
      sheet.getRange(rows[i], cV).setValue((prev ? prev + '\n' : '') + groundText_(list));
      n++;
    } catch (e) {
      sheet.getRange(rows[i], cV).setValue('근거 확인 실패: ' + e.message);
    }
  }
  toast_('근거 확인 ' + n + '건 · 자료에 없는 내용이 보인 학생 ' + found + '명 — [검증] 칸을 보세요.' +
         (usageText_() ? '\n' + usageText_() : ''), APP.MENU);
}

/* ------------------------------------------------------- 자동 생성 트리거 */
function enableAutoTrigger() {
  disableAutoTrigger();
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss_()).onEdit().create();
  ui_().alert(APP.MENU,
    '자동 생성을 켰습니다.\n[생성] 체크박스를 체크하면 그 줄이 바로 생성됩니다.\n\n' +
    '※ 여러 명을 한꺼번에 처리할 때는 메뉴 ⑥ [체크된 행 생성] 이 더 빠르고 안정적입니다.\n' +
    '※ 모델이 [키 없이(복사·붙여넣기)]인 줄은 자동으로 하지 않고, 메뉴 ⑥ 에서 창을 엽니다.',
    ui_().ButtonSet.OK);
}

function disableAutoTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
}

function onEditInstalled(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var act = activityOfSheet_(sheet.getName());
    if (!act) return;
    var cGen = colOf_(sheet, APP.HEAD_ROW, '생성');
    if (!cGen || e.range.getColumn() !== cGen) return;
    if (e.range.getRow() < APP.DATA_ROW) return;
    if (e.value !== 'TRUE' && e.range.getValue() !== true) return;
    var cModel = colOf_(sheet, APP.HEAD_ROW, '모델');
    var model = (cModel ? normModel(sheet.getRange(e.range.getRow(), cModel).getValue()) : '') ||
                normModel(cfg_('활동용 모델', DEFAULT_MODEL));
    // 복사·붙여넣기 창은 메뉴에서 연다 — 트리거에서는 창을 띄울 수 없다(키가 하나도 없을 때도 같음)
    if (providerOf_(model) === 'manual' || !PROVIDERS.some(function (p) { return getKey_(p); })) return;
    runGeneration_(act, sheet, [e.range.getRow()]);
  } catch (err) {
    try { toast_('자동 생성 오류: ' + err.message); } catch (e2) {}
  }
}

/* ------------------------------------------------------------- 재검증 */
function revalidateAll() {
  var acts = getActivities_();
  var n = 0;
  acts.forEach(function (a) {
    var s = sh_(a.inSheet);
    if (!s) return;
    var cAi = colOf_(s, APP.HEAD_ROW, 'AI 결과');
    var cFinal = colOf_(s, APP.HEAD_ROW, '최종본');
    var cValid = colOf_(s, APP.HEAD_ROW, '검증');
    if (!cValid) return;
    var last = s.getLastRow();
    if (last < APP.DATA_ROW) return;
    var cnt = last - APP.DATA_ROW + 1;
    var ai = s.getRange(APP.DATA_ROW, cAi, cnt, 1).getValues();
    var fin = cFinal ? s.getRange(APP.DATA_ROW, cFinal, cnt, 1).getValues() : ai;
    var limit = charsFor_(a) * 3;
    var out = [];
    for (var i = 0; i < cnt; i++) {
      var t = String(fin[i][0] || '').trim() || String(ai[i][0] || '').trim();
      out.push([t ? formatIssues(inspect_(t, limit)) : '']);
      if (t) n++;
    }
    s.getRange(APP.DATA_ROW, cValid, cnt, 1).setValues(out);
  });
  // 최종취합 (기록종류별)
  compileSheets_().forEach(function (cp) {
    var cF = colOf_(cp, APP.HEAD_ROW, '최종본');
    var cV = colOf_(cp, APP.HEAD_ROW, '검증');
    var last2 = cp.getLastRow();
    if (!cF || !cV || last2 < APP.DATA_ROW) return;
    var cnt2 = last2 - APP.DATA_ROW + 1;
    var f2 = cp.getRange(APP.DATA_ROW, cF, cnt2, 1).getValues();
    var lim2 = compileLimitOf_(cp.getName());
    var o2 = [];
    for (var j = 0; j < cnt2; j++) {
      var t2 = String(f2[j][0] || '').trim();
      o2.push([t2 ? formatIssues(inspect_(t2, lim2)) : '']);
      if (t2) n++;
    }
    cp.getRange(APP.DATA_ROW, cV, cnt2, 1).setValues(o2);
  });
  toast_(n + '건 재검증 완료', APP.MENU);
}

/* ------------------------------------------------- 고쳐 쓰면 바로 검사 */
/**
 * 단순 트리거(onEdit)에서 부른다 — 입력·취합 시트의 [최종본]이나 [AI 결과]를 고치면
 * [검증] 칸을 바로 새로 쓴다. AI 를 부르지 않으므로 권한 승인 없이도 돈다.
 * @return {boolean} 이 편집을 처리했는지
 */
function recheckOnEdit_(e) {
  var s = e.range.getSheet();
  var name = s.getName();
  var limit = 0, act = null;
  if (name.indexOf(APP.SH.COMPILE_PREFIX) === 0) limit = compileLimitOf_(name);
  else if (name.slice(-APP.SUFFIX.IN.length) === APP.SUFFIX.IN) { act = activityOfSheet_(name); if (act) limit = charsFor_(act) * 3; }
  if (!limit) return false;
  var r1 = e.range.getRow(), nr = e.range.getNumRows();
  if (r1 + nr - 1 < APP.DATA_ROW) return false;
  var cFi = colOf_(s, APP.HEAD_ROW, '최종본');
  var cAi = colOf_(s, APP.HEAD_ROW, act ? 'AI 결과' : 'AI 압축결과');
  var cV = colOf_(s, APP.HEAD_ROW, '검증');
  var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
  var hit = function (c) { return c && c1 <= c && c <= c2; };
  if (!cV || (!hit(cFi) && !hit(cAi))) return false;
  for (var r = Math.max(r1, APP.DATA_ROW); r < r1 + nr && r < APP.DATA_ROW + 500; r++) {
    var fin = cFi ? String(s.getRange(r, cFi).getValue()).trim() : '';
    var t = fin || (cAi ? String(s.getRange(r, cAi).getValue()).trim() : '');
    if (t.indexOf('⚠') === 0) continue;
    s.getRange(r, cV).setValue(t ? formatIssues(inspect_(t, limit)) + (fin ? '\n(최종본 기준)' : '') : '');
  }
  return true;
}
