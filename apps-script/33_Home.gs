/**
 * 세특 작성 도우미 v3 — 🧭 작업판(오른쪽 사이드바) · 간단히 보기(뒤에서만 쓰는 시트 숨기기)
 *
 * 시트 탭이 많아 눈에 안 들어오는 문제를 푼다.
 *   · 작업판: 준비 → 활동 → 쓰기 → 점검 → 마무리 순서의 큰 버튼 한 화면. 활동 시트로 바로 가기.
 *   · 간단히 보기: 설정 · 규칙 · 예시처럼 도구가 뒤에서 읽는 시트를 숨긴다. 메뉴로 그 시트를 열면 저절로 다시 보인다(goSheet_).
 * 작업판에는 학생 이름을 보여 주지 않는다(숫자만).
 */

var VIEW_KEY = 'VIEW_SIMPLE';          // DocumentProperties '1' 켬 · '0' 끔 · 없으면 켬
var HOME_AUTO_FN = 'onOpenHome';       // 설치형 열기 트리거가 부르는 함수(끝에 _ 금지)

/** 간단히 보기에서 숨기는 시트 — 도구가 읽기만 하거나 가끔 고치는 것 */
function backstageNames_() {
  return [APP.SH.HELP, APP.SH.CONFIG, APP.SH.RECORD, APP.SH.SUBJECT, APP.SH.COMMON,
          APP.SH.ACTIVITY, APP.SH.REVIEW, APP.SH.RULES, APP.SH.STYLE, APP.SH.FORM_RAW];
}

/** 숨길 시트인가 — 정해 둔 이름 + 활동 예시 시트(▸예시). 선생님이 직접 만든 시트는 건드리지 않는다. */
function isBackstage_(name) {
  name = String(name || '');
  if (backstageNames_().indexOf(name) >= 0) return true;
  var ex = APP.SUFFIX.EX;
  return name.length > ex.length && name.slice(-ex.length) === ex;
}

function viewSimpleOn_() {
  try { return PropertiesService.getDocumentProperties().getProperty(VIEW_KEY) !== '0'; } catch (e) { return true; }
}

/** 숨긴 시트를 보이게 하고 연다. 메뉴 · 창이 시트를 열 때는 늘 이것으로. */
function goSheet_(s) {
  if (!s) return s;
  try { if (s.isSheetHidden()) s.showSheet(); } catch (e) { logSoft_('goSheet_', e); }
  ss_().setActiveSheet(s);
  return s;
}

/**
 * 간단히 보기를 시트에 적용한다(설정은 바꾸지 않음).
 * @param {boolean} on 켜면 뒤 시트를 숨기고, 끄면 모두 보인다
 * @return {{hidden:number, shown:number}}
 */
function applyView_(on) {
  var hidden = 0, shown = 0;
  var all = ss_().getSheets();
  var active = ss_().getActiveSheet();
  // 보이는 시트가 하나도 없으면 안 되므로 [🚀 시작하기]부터 확실히 보이게
  var start = sh_(APP.SH.START);
  if (on && start && start.isSheetHidden()) start.showSheet();
  all.forEach(function (s) {
    var want = on && isBackstage_(s.getName());
    try {
      if (want && !s.isSheetHidden()) { s.hideSheet(); hidden++; }
      else if (!want && s.isSheetHidden()) { s.showSheet(); shown++; }
    } catch (e) { logSoft_('applyView_ ' + s.getName(), e); }
  });
  // 보고 있던 시트를 숨겼으면 시작하기로
  if (on && active && isBackstage_(active.getName()) && start) ss_().setActiveSheet(start);
  return { hidden: hidden, shown: shown };
}

/** 작업판 · 메뉴: 간단히 보기 켜기/끄기 */
function homeSetView(on) {
  on = !!on;
  try { PropertiesService.getDocumentProperties().setProperty(VIEW_KEY, on ? '1' : '0'); } catch (e) { logSoft_('homeSetView', e); }
  var r = applyView_(on);
  toast_(on ? '간단히 보기 — 뒤에서만 쓰는 시트 ' + countBackstage_() + '개를 숨겼습니다. 메뉴로 열면 다시 보입니다.'
            : '모든 시트를 보이게 했습니다.');
  return homeState();
}

function viewSimple() { homeSetView(true); }
function viewAll() { homeSetView(false); }

function countBackstage_() {
  return ss_().getSheets().filter(function (s) { return isBackstage_(s.getName()); }).length;
}

/* ------------------------------------------------------------ 작업판 */
function openHome() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Home').setTitle('🧭 작업판');
  ui_().showSidebar(html);
}

/** 설치형 열기 트리거 — 파일을 열면 작업판을 띄운다(단순 onOpen 은 사이드바를 못 연다) */
function onOpenHome() {
  try { openHome(); } catch (e) { logSoft_('onOpenHome', e); }
}

function homeAutoOn_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === HOME_AUTO_FN; });
  } catch (e) { return false; }
}

/** 작업판: 파일을 열 때 작업판 저절로 열기 (내 계정에만 · 사본마다 따로) */
function homeSetAutoOpen(on) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === HOME_AUTO_FN) ScriptApp.deleteTrigger(t);
  });
  if (on) ScriptApp.newTrigger(HOME_AUTO_FN).forSpreadsheet(ss_()).onOpen().create();
  return homeState();
}

/** 활동 시트 하나의 진행 — 학생 줄 수 · [최종본]을 채운 줄 수 (이름은 읽지 않는다) */
function activityProgress_(s) {
  var out = { students: 0, done: 0 };
  if (!s) return out;
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return out;
  var cFinal = colOf_(s, APP.HEAD_ROW, '최종본');
  var width = Math.max(cFinal || 0, 2);
  var v = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, width).getValues();
  v.forEach(function (r) {
    if (!String(r[0]).trim() && !String(r[1]).trim()) return;   // 반 · 번호가 빈 줄은 학생 줄이 아님
    out.students++;
    if (cFinal && String(r[cFinal - 1]).trim()) out.done++;
  });
  return out;
}

/** 작업판이 그리는 상태 — 숫자와 활동 이름만 */
function homeState() {
  var st = { version: APP.VERSION, consent: true, ai: '', students: 0, activities: [], compiles: [],
             simple: viewSimpleOn_(), backstage: countBackstage_(), hiddenNow: 0, autoOpen: homeAutoOn_(),
             active: '', installed: !!sh_(APP.SH.ACTIVITY) };
  try { st.consent = consentOk_(); } catch (e) {}
  try {
    var k = keyStatus_();
    var names = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude' };
    var on = PROVIDERS.filter(function (p) { return k[p]; }).map(function (p) { return names[p] || p; });
    if (k.subscription) on.push('Gemini 구독');
    st.ai = on.length ? on.join(' · ') : '';
  } catch (e) { logSoft_('homeState ai', e); }
  try { st.students = sh_(APP.SH.ROSTER) ? getRoster_().length : 0; } catch (e) { logSoft_('homeState roster', e); }
  try { st.active = ss_().getActiveSheet().getName(); } catch (e) {}
  if (st.installed) {
    try {
      st.activities = getActivities_().map(function (a) {
        var p = activityProgress_(sh_(a.inSheet));
        return { key: a.key, name: a.name || a.key, rec: a.recordKey, mode: a.mode, sheet: a.inSheet,
                 students: p.students, done: p.done, missing: !sh_(a.inSheet) };
      });
    } catch (e) { logSoft_('homeState activities', e); }
  }
  try { st.compiles = compileSheets_().map(function (s) { return s.getName(); }); } catch (e) {}
  try { st.hiddenNow = ss_().getSheets().filter(function (s) { return s.isSheetHidden(); }).length; } catch (e) {}
  return st;
}

/** 작업판: 시트 열기 (활동 · 취합 · 명단 · 시작하기만 — 이름으로 아무 시트나 열지는 않음) */
function homeGoto(name) {
  var ok = name === APP.SH.START || name === APP.SH.ROSTER ||
           String(name).indexOf(APP.SH.COMPILE_PREFIX) === 0 ||
           getActivities_().some(function (a) { return a.inSheet === name; });
  if (!ok) throw new Error('작업판에서 열 수 없는 시트입니다.');
  var s = sh_(name);
  if (!s) throw new Error('[' + name + '] 시트가 없습니다. 메뉴 ①②③ > [① 처음 설치 / 구조 복구] 를 눌러 보세요.');
  goSheet_(s);
  return homeState();
}

/** 작업판 버튼 → 기존 메뉴 함수. 여기 없는 이름은 부르지 않는다. */
var HOME_ACTIONS = {
  onboard: 'openOnboard', consent: 'openConsentDialog', api: 'openApiDialog', roster: 'openRosterDialog',
  wizard: 'openWizard', quick: 'openQuickSheetDialog', form: 'openFormDialog', studio: 'openStudio',
  generate: 'generateChecked', manual: 'openManualForChecked', check: 'openCheckSidebar',
  equity: 'menuEquityCheck', compile: 'buildCompile', neis: 'openNeisDialog',
  style: 'openStyleDialog', help: 'openHelpSheet', settings: 'openSettingsSheet', update: 'openUpdateDialog'
};

function homeRun(action) {
  var fn = HOME_ACTIONS[action];
  if (!fn) throw new Error('알 수 없는 버튼: ' + action);
  var f = this[fn] || (typeof globalThis !== 'undefined' ? globalThis[fn] : null);
  if (typeof f !== 'function') throw new Error('기능을 찾지 못했습니다: ' + fn);
  f();
  return homeState();
}

/** [⚙️ 설정] 시트 열기 (숨겨 두었으면 다시 보이게) */
function openSettingsSheet() {
  var s = sh_(APP.SH.CONFIG) || (buildConfig(), sh_(APP.SH.CONFIG));
  goSheet_(s);
}
