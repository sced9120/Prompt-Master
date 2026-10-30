/**
 * 세특 작성 도우미 v3 — [📏 기재요령] 시트 · 규칙판 업데이트
 *
 * 검사(금지어·형식·맞춤법)는 이 시트의 표를 읽는다. 표가 없으면 코드에 든 2026 규칙판을 쓴다.
 * 새 학년도 규칙판은 RULES_URL(만든이의 GitHub)에서 받는다. 7일에 한 번 저절로 확인하고,
 * 메뉴 ⑧ [기재요령 규칙 업데이트 확인]으로 바로 확인할 수도 있다.
 * 업데이트는 "선생님이 손대지 않은 칸"만 바꾼다 — 고친 칸은 그대로 두고 무엇을 남겼는지 알린다.
 */

var RULES_HEAD = ['사용', '수준', '분류', '찾을 말(정규식)', '바르게(맞춤법)', '이유 · 근거', '출처'];
var RULES_PROP_ID = 'RULES_ID';
var RULES_PROP_AT = 'RULES_CHECKED_AT';
var __rulesCache = null;

/* ------------------------------------------------------------ 시트 */
/** 설치·복구: 표가 없으면 규칙판으로 채우고, 있으면 머리말만 새로 */
function buildRulesSheet() {
  var s = shOrCreate_(APP.SH.RULES);
  var n = RULES_HEAD.length;
  var hasRows = s.getLastRow() >= APP.DATA_ROW;
  if (!hasRows) {
    s.clear();
    writeRuleRows_(s, packRuleRows(RULES_2026).concat(aiTellRuleRows()));
    try { PropertiesService.getDocumentProperties().setProperty(RULES_PROP_ID, RULES_2026.id); } catch (e) {}
  }
  rulesBanner_(s, currentPackInfo_());
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([RULES_HEAD]);
  styleHeader_(s, APP.HEAD_ROW, n, '#5d4037');
  s.setFrozenRows(APP.HEAD_ROW);
  [56, 60, 120, 300, 120, 420, 120].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  __rulesCache = null;
  return s;
}

function rulesBanner_(s, info) {
  var n = RULES_HEAD.length;
  banner_(s, n, '📏 기재요령 규칙 — ' + info.year + '학년도 (규칙판 ' + info.id + ')',
    '맞춤법·금지어 검사, 생성 직후 [검증], 자동 고쳐쓰기가 이 표를 씁니다. 찾을 말은 정규식입니다(| 는 "또는"). ' +
    '[출처]가 "기재요령"·"맞춤법(기본)"인 줄은 새 학년도 규칙판이 나오면 저절로 바뀌고, [출처]에 "내 학교"라고 적어 더한 줄은 그대로 남습니다. ' +
    '줄을 끄려면 [사용] 체크를 푸세요. 확인: ' + (info.checked || '-') + ' · 출처: ' + (info.source || ''));
  ensureCols_(s, n);
  unmergeRow_(s, 2);
  s.getRange(2, 1, 1, n).merge().setValue('⚠️ ' + (info.aiNotice || AI_NOTICE_2026))
    .setBackground('#fdecea').setFontColor('#7f1d1d').setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  s.setRowHeight(2, 46);
}

/** 표 쓰기 — 규칙판 줄 + (있으면) 선생님이 더한 줄 */
function writeRuleRows_(s, rows) {
  var n = RULES_HEAD.length;
  var last = s.getLastRow();
  if (last >= APP.DATA_ROW) s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, n).clearContent().clearDataValidations();
  ensureRows_(s, APP.DATA_ROW + rows.length + 20);
  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, n).setValues(rows);
  var body = rows.length + 20;
  s.getRange(APP.DATA_ROW, 1, body, 1).insertCheckboxes();
  s.getRange(APP.DATA_ROW, 2, body, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['수정', '확인'], true).build());
  s.getRange(APP.DATA_ROW, 1, body, n).setWrap(true).setVerticalAlignment('top').setFontSize(10);
  s.getRange(APP.DATA_ROW, 4, body, 1).setBackground(APP.COLORS.input);
  __rulesCache = null;
}

/** 지금 표의 줄 [[...7칸]] (빈 줄 제외) */
function readRuleRows_(s) {
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return [];
  return s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, RULES_HEAD.length).getValues()
    .filter(function (r) { return String(r[3]).trim() !== '' || String(r[2]).trim() !== ''; });
}

/** 검사에 쓸 규칙 전부 (실행 한 번 동안 기억) */
function rulesAll_() {
  if (__rulesCache) return __rulesCache;
  var list = [];
  try {
    var s = sh_(APP.SH.RULES);
    if (s) list = readRuleRows_(s).map(ruleFromRow).filter(function (r) { return r; });
  } catch (e) { list = []; }
  __rulesCache = list.length ? list : RULES_2026.rules.concat(AI_TELL_RULES);
  return __rulesCache;
}

/** 모든 검증이 부르는 한 곳 — 금지어·형식·맞춤법(+띄어쓰기) */
function inspect_(text, limitBytes) {
  return validateResult(text, limitBytes, rulesAll_(), []);
}

/** 지금 반영된 규칙판 정보 */
function currentPackInfo_() {
  var id = '';
  try { id = PropertiesService.getDocumentProperties().getProperty(RULES_PROP_ID) || ''; } catch (e) {}
  var p = RULES_2026;
  try {
    var saved = PropertiesService.getDocumentProperties().getProperty('RULES_INFO');
    if (saved) { var j = JSON.parse(saved); if (j && j.id) p = j; }
  } catch (e) {}
  return { id: id || p.id, year: p.year, checked: p.checked, source: p.source, aiNotice: p.aiNotice };
}

/** 이 파일에 반영된 규칙판(프롬프트 글 비교용) — 저장된 것이 없으면 코드에 든 RULES_2026 */
function storedPack_() {
  try {
    var saved = JSON.parse(PropertiesService.getDocumentProperties().getProperty('RULES_PACK') || 'null');
    if (saved && saved.id) return saved;
  } catch (e) {}
  return RULES_2026;
}

/** 메뉴: [📏 기재요령] 시트 열기 */
function openRulesSheet() {
  var s = sh_(APP.SH.RULES) || buildRulesSheet();
  ss_().setActiveSheet(s);
}

/* ------------------------------------------------------- 처음 설치 · 옛 사본 */
/**
 * 옛 번호 v3.5 이전 사본을 2026 규칙으로 올린다 (처음 설치 / 구조 복구에서 부른다).
 *   · [📐 공통규칙] NEIS_RULES 가 예전 기본 문구 그대로면 2026 문구로
 *   · [🧩 기록종류]에 [기재 주의] 칸이 없으면 만들고 2026 주의를 채운다
 *   · 코드에 든 규칙판이 이 파일의 규칙판보다 새것이면(예: 2026.1 → 2026.2) 그것으로 올린다
 *   · [📐 공통규칙]의 서술 규칙 · 분량 · 성취수준 · 피할 표현이 옛 기본 문구 그대로면 새 기본 문구로
 */
function migrateRules_() {
  var info = currentPackInfo_();
  var pack = RULES_2026;
  if (info.id !== RULES_2026.id) {
    try { var saved = JSON.parse(PropertiesService.getDocumentProperties().getProperty('RULES_PACK') || 'null'); if (saved && saved.id) pack = saved; } catch (e) {}
  }
  if (packNewer(RULES_2026.id, pack.id || info.id || '')) {
    var rep = applyRulePack_(RULES_2026);
    rep.common = syncCommonDefaults_();
    return rep;
  }
  return {
    common: syncCommonDefaults_(),
    neis: syncNeisRules_(pack),
    records: syncRecordRules_(pack),
    chars: syncRecordChars_(pack)
  };
}

/**
 * [📏 기재요령]에 AI 투 줄(출처 'AI 투(기본)')이 없으면 더한다 — 처음 설치 · 구조 복구.
 * 이미 있는 AI 투 줄은 건드리지 않고(선생님이 끈 [사용] 그대로), 새로 생긴 규칙만 뒤에 붙인다. @return 더한 줄 수
 */
function ensureAiTellRows_() {
  var s = sh_(APP.SH.RULES);
  if (!s) return 0;
  var cur = readRuleRows_(s);
  var have = cur.filter(function (r) { return String(r[6] || '').trim() === AI_TELL_SRC; }).map(function (r) { return String(r[3]).trim(); });
  var add = aiTellRuleRows().filter(function (r) { return have.indexOf(String(r[3]).trim()) < 0; });
  if (!add.length) return 0;
  writeRuleRows_(s, cur.concat(add));
  __rulesCache = null;
  return add.length;
}

/** [📐 공통규칙]에 AVOID_RULES(피할 표현) 줄이 없으면 기본 문구로 더한다 */
function ensureAvoidRow_() {
  var s = sh_(APP.SH.COMMON);
  if (!s) return;
  var last = s.getLastRow();
  var keys = last >= 3 ? s.getRange(3, 1, last - 2, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  if (keys.indexOf('AVOID_RULES') >= 0) return;
  s.getRange(last + 1, 1, 1, 3).setValues([['AVOID_RULES', '피할 표현 (AI 투)', AVOID_RULES_DEFAULT]]);
  s.getRange(last + 1, 1, 1, 2).setBackground(APP.COLORS.lock);
  s.getRange(last + 1, 3).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
}

/**
 * [📐 공통규칙]에서 옛 기본 문구(OLD_COMMON_2026_1) 그대로인 칸만 지금 기본 문구로 바꾼다. 선생님이 고친 칸은 그대로.
 * @return {string[]} 바꾼 키
 */
function syncCommonDefaults_() {
  var out = [];
  var s = sh_(APP.SH.COMMON);
  if (!s || typeof OLD_COMMON_2026_1 === 'undefined') return out;
  var now = {};
  PRESET_COMMON.forEach(function (c) { now[c.key] = c.body; });
  var v = s.getRange(1, 1, Math.max(s.getLastRow(), 1), 3).getValues();
  for (var i = 0; i < v.length; i++) {
    var k = String(v[i][0]).trim();
    if (!OLD_COMMON_2026_1.hasOwnProperty(k) || now[k] === undefined) continue;
    var olds = [OLD_COMMON_2026_1[k]].concat(k === 'WRITING_RULES' && typeof OLD_WRITING_RULES_387 === 'string' ? [OLD_WRITING_RULES_387] : []);
    if (!olds.some(function (t) { return normText(v[i][2]) === normText(t); })) continue;
    s.getRange(i + 1, 3).setValue(now[k]);
    out.push(k);
  }
  return out;
}

/** NEIS_RULES 칸: 'same' | 'updated' | 'kept' */
function syncNeisRules_(pack) {
  var s = sh_(APP.SH.COMMON);
  if (!s || !pack.neisRules) return 'same';
  var v = s.getRange(1, 1, Math.max(s.getLastRow(), 1), 3).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() !== 'NEIS_RULES') continue;
    var cur = normText(v[i][2]);
    if (cur === normText(pack.neisRules)) return 'same';
    if (!cur || knownOldTexts(pack, 'neisRules').indexOf(cur) >= 0) {
      s.getRange(i + 1, 3).setValue(pack.neisRules);
      return 'updated';
    }
    return 'kept';
  }
  return 'same';
}

/** [🧩 기록종류]의 [기재 주의] 칸 — 없으면 만들고, 손대지 않은 칸만 새 문구로. {updated:[], kept:[]} */
function syncRecordRules_(pack) {
  var out = { updated: [], kept: [] };
  var s = sh_(APP.SH.RECORD);
  if (!s || s.getLastRow() < 2) return out;
  var c = colOf_(s, 2, '기재 주의');
  if (!c) {
    c = s.getLastColumn() + 1;
    ensureCols_(s, c);
    s.getRange(2, c).setValue('기재 주의');
    styleHeader_(s, 2, c);
    s.setColumnWidth(c, 380);
    try { banner_(s, c, RECORD_BANNER_TITLE, RECORD_BANNER_NOTE); } catch (e) {}
  }
  var last = s.getLastRow();
  if (last < 3) return out;
  var keys = s.getRange(3, 1, last - 2, 1).getValues();
  var cells = s.getRange(3, c, last - 2, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim();
    if (!k || !pack.byRecord || pack.byRecord[k] === undefined) continue;
    var cur = normText(cells[i][0]), want = normText(pack.byRecord[k]);
    if (cur === want) continue;
    if (!cur || knownOldTexts(pack, 'byRecord', k).indexOf(cur) >= 0) {
      s.getRange(3 + i, c).setValue(pack.byRecord[k]).setWrap(true).setVerticalAlignment('top');
      out.updated.push(k);
    } else out.kept.push(k);
  }
  return out;
}

/** [🧩 기록종류]의 글자수 — 예전 기본값 그대로인 칸만 새 학년도 값으로. {updated:['진로 700→500'], kept:[]} */
function syncRecordChars_(pack) {
  var out = { updated: [], kept: [] };
  var s = sh_(APP.SH.RECORD);
  if (!s || s.getLastRow() < 3 || !pack.chars) return out;
  var cK = 1, cC = colOf_(s, 2, '글자수');
  if (!cC) return out;
  var last = s.getLastRow();
  var keys = s.getRange(3, cK, last - 2, 1).getValues();
  var vals = s.getRange(3, cC, last - 2, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim(), want = pack.chars[k];
    if (!k || !want) continue;
    var cur = Number(vals[i][0]) || 0;
    if (cur === want) continue;
    var known = [RULES_2026.chars[k]];
    PRESET_RECORD_TYPES.forEach(function (r) { if (r.key === k) known.push(r.chars); });
    (pack.history || []).forEach(function (h) { if (h && h.chars && h.chars[k]) known.push(Number(h.chars[k])); });
    if (known.indexOf(cur) >= 0) { s.getRange(3 + i, cC).setValue(want); out.updated.push(k + ' ' + cur + '→' + want + '자'); }
    else out.kept.push(k + ' ' + cur + '자(새 기준 ' + want + '자)');
  }
  return out;
}

/* ------------------------------------------------------- 원격 규칙판 */
function fetchRulePack_() {
  try {
    var res = UrlFetchApp.fetch(RULES_URL, { muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode();
    if (code === 404) return { ok: false, error: '업데이트 서버에 아직 규칙판이 없습니다' };
    if (code < 200 || code >= 300) return { ok: false, error: '업데이트 서버 응답 ' + code };
    var v = validatePack(res.getContentText());
    if (!v.ok) return { ok: false, error: '규칙판이 올바르지 않습니다: ' + v.errors.join(', ') };
    return { ok: true, pack: v.pack, warnings: v.errors };
  } catch (e) {
    return { ok: false, error: '업데이트 서버에 연결하지 못했습니다(' + String(e.message || e).slice(0, 80) + ')' };
  }
}

/**
 * 규칙판 반영 — 표의 기본 줄은 바꾸고 '내 학교' 줄은 남긴다. 손대지 않은 칸만 바꾼다.
 * @return {{id, rules:number, mine:number, neis:string, records:Object, chars:Object}}
 */
function applyRulePack_(pack) {
  var s = sh_(APP.SH.RULES) || buildRulesSheet();
  var cur = readRuleRows_(s);
  var mine = cur.filter(function (r) { return !isBuiltinRow(r[6]); });
  var ai = cur.filter(function (r) { return String(r[6] || '').trim() === AI_TELL_SRC; });   // AI 투 줄은 [사용] 그대로 둔다
  var rows = packRuleRows(pack).concat(ai).concat(mine);
  writeRuleRows_(s, rows);
  var dp = PropertiesService.getDocumentProperties();
  dp.setProperty(RULES_PROP_ID, pack.id);
  dp.setProperty('RULES_INFO', JSON.stringify({ id: pack.id, year: pack.year, checked: pack.checked, source: pack.source, aiNotice: pack.aiNotice }));
  try { dp.setProperty('RULES_PACK', JSON.stringify({ id: pack.id, neisRules: pack.neisRules, byRecord: pack.byRecord, chars: pack.chars, history: pack.history || [] })); } catch (e) {}
  rulesBanner_(s, currentPackInfo_());
  var rep = { id: pack.id, rules: rows.length - mine.length - ai.length, mine: mine.length,
              neis: syncNeisRules_(pack), records: syncRecordRules_(pack), chars: syncRecordChars_(pack) };
  __rulesCache = null;
  return rep;
}

function packReportText_(rep) {
  var L = ['규칙판 ' + rep.id + ' 을(를) 반영했습니다.', '',
           '· 검사 규칙 ' + rep.rules + '줄' + (rep.mine ? ' (선생님이 더한 줄 ' + rep.mine + '개는 그대로)' : '')];
  L.push('· 기재 금지사항(공통규칙): ' + ({ updated: '새 문구로 바꿈', kept: '직접 고친 내용이 있어 그대로 둠 — [📏 기재요령] 2행과 비교해 보세요', same: '이미 같음' }[rep.neis] || rep.neis));
  if (rep.records.updated.length) L.push('· 기재 주의 바꿈: ' + rep.records.updated.join(', '));
  if (rep.records.kept.length) L.push('· 기재 주의 직접 고친 것 그대로: ' + rep.records.kept.join(', '));
  if (rep.chars.updated.length) L.push('· 글자수 바꿈: ' + rep.chars.updated.join(', '));
  if (rep.chars.kept.length) L.push('· 글자수 직접 바꾼 것 그대로: ' + rep.chars.kept.join(', ') + ' — 확인해 주세요');
  return L.join('\n');
}

/** 메뉴: 기재요령 규칙 업데이트 확인 */
function checkRulesUpdate() {
  var info = currentPackInfo_();
  var r = fetchRulePack_();
  try { PropertiesService.getDocumentProperties().setProperty(RULES_PROP_AT, String(Date.now())); } catch (e) {}
  if (!r.ok) {
    ui_().alert(APP.MENU, r.error + '\n\n지금 규칙판(' + info.id + ', ' + info.year + '학년도)을 그대로 씁니다.', ui_().ButtonSet.OK);
    return;
  }
  if (!packNewer(r.pack.id, info.id)) {
    ui_().alert(APP.MENU, '최신 규칙판을 쓰고 있습니다.\n\n규칙판 ' + info.id + ' · ' + info.year + '학년도 · 확인 ' + (info.checked || '-') +
      '\n\n7일마다 저절로 확인합니다.', ui_().ButtonSet.OK);
    return;
  }
  var go = ui_().alert(APP.MENU, '새 규칙판이 있습니다: ' + r.pack.id + ' (' + r.pack.year + '학년도, ' + r.pack.checked + ')\n' + r.pack.source +
    '\n\n지금 반영할까요? 선생님이 직접 고친 칸과 "내 학교" 규칙은 그대로 둡니다.', ui_().ButtonSet.YES_NO);
  if (go !== ui_().Button.YES) return;
  ui_().alert(APP.MENU, packReportText_(applyRulePack_(r.pack)), ui_().ButtonSet.OK);
}

/**
 * 7일에 한 번 저절로 확인 (생성·검사·시작하기에서 부른다). 실패해도 조용히 넘어간다.
 * 새 판이면 손대지 않은 칸만 바꾸고 알림을 띄운다.
 */
function autoRulesCheck_() {
  try {
    var dp = PropertiesService.getDocumentProperties();
    var at = Number(dp.getProperty(RULES_PROP_AT) || 0);
    if (Date.now() - at < RULES_CHECK_DAYS * 86400000) return null;
    dp.setProperty(RULES_PROP_AT, String(Date.now()));
    var r = fetchRulePack_();
    if (!r.ok || !packNewer(r.pack.id, currentPackInfo_().id)) return null;
    // 프롬프트 글이 바뀌는 판은 저절로 반영하지 않는다 — 알리고, 선생님이 메뉴에서 보고 반영
    if (packTouchesPrompt(storedPack_(), r.pack)) {
      if (dp.getProperty('RULES_TOLD') !== r.pack.id) {
        dp.setProperty('RULES_TOLD', r.pack.id);
        toast_('새 기재요령 규칙판 ' + r.pack.id + ' 이(가) 있습니다. 프롬프트 문구가 바뀌는 판이라 저절로 바꾸지 않았습니다 — ' +
               '메뉴 [기재요령 규칙 업데이트 확인]에서 보고 반영하세요.', APP.MENU, 15);
      }
      return null;
    }
    var rep = applyRulePack_(r.pack);
    toast_('기재요령 규칙판이 ' + rep.id + '(으)로 바뀌었습니다. [📏 기재요령] 시트를 확인하세요.', APP.MENU);
    return rep;
  } catch (e) { logSoft_('규칙판 자동 확인', e); return null; }
}

/* ------------------------------------------------------- 셀 함수 */
/**
 * 시트 어디서나: =SAETEUK_CHECK(A2) 또는 =SAETEUK_CHECK(A2, 300)
 * 바이트 · 기재 금지 · 형식 · 맞춤법을 한 칸에 요약한다. AI 를 부르지 않는다.
 * @param {string} text  검사할 글
 * @param {number} chars 최대 글자 수(비우면 500)
 * @customfunction
 */
function SAETEUK_CHECK(text, chars) {
  var one = function (t) {
    t = String(t === null || t === undefined ? '' : t).trim();
    if (!t) return '';
    return formatIssues(inspect_(t, (Number(chars) || 500) * 3));
  };
  if (Array.isArray(text)) return text.map(function (r) { return r.map(one); });
  return one(text);
}
