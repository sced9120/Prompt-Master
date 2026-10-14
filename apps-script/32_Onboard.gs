/**
 * 세특 작성 도우미 v3 — 시작하기 (온보딩)
 *
 * 배포 방식: 제작자가 마스터 사본을 한 번 만들어 두고, 공유 링크 끝의
 * /edit 를 /copy 로 바꿔 나눠 줍니다. 받는 사람은 [사본 만들기] 한 번이면
 * 코드까지 통째로 복사됩니다. 그 사본에서 처음 열었을 때 길을 잃지 않도록
 * 하는 것이 이 파일의 역할입니다.
 */

var ONBOARD_KEY = 'ONBOARD_DONE';

/**
 * onOpen 은 단순 트리거라 권한 승인 전에도 실행된다.
 * 그때는 PropertiesService 를 쓸 수 없으므로(승인 필요) 시트만 보고 판단한다.
 * 사본을 막 받은 사람에게 안내가 안 뜨는 일이 없어야 한다.
 */
function needsOnboarding_() {
  var r = sh_(APP.SH.ROSTER);
  if (!r) return true;                 // 아직 설치 전
  return r.getLastRow() < APP.DATA_ROW - 1;   // 학생 명단이 비어 있으면 아직 준비 전
}

/** 팝업 내부에서만 쓰는 완료 표시 (승인 이후에 호출된다) */
function isOnboardDone_() {
  try {
    return PropertiesService.getDocumentProperties().getProperty(ONBOARD_KEY) === '1';
  } catch (e) { return false; }
}

function openOnboard() {
  try { if (sh_(APP.SH.RULES)) autoRulesCheck_(); } catch (e) {}
  var html = HtmlService.createHtmlOutputFromFile('UI_Onboard')
    .setWidth(660).setHeight(720);
  ui_().showModelessDialog(html, '시작하기 — ' + APP.MENU);
}

/* ---------------------------------------------------------- 현재 상태 */
/**
 * 각 단계가 끝났는지를 "결과물이 실제로 있는지"로 판단한다.
 * 진행 상황을 따로 저장하지 않으므로, 중간에 창을 닫거나 나중에 다시 열어도
 * 항상 지금 상태에서 이어진다.
 */
function onboardStatus() {
  var st = {
    installed: false, hasKey: false, keyNames: [],
    rosterCount: 0, activities: [], exampleCount: 0, done: isOnboardDone_(),
    models: [], defaultModel: '', compileModel: '',
    providerDefaults: PROVIDER_DEFAULT_MODEL, presets: presetModelRows_(), links: MODEL_LINKS,
    manual: false, manualModel: MANUAL_MODEL, account: accountInfo_(), aiNotice: AI_NOTICE_2026
  };
  try { st.manual = manualOn_(); } catch (e) {}
  try {
    st.installed = !!(sh_(APP.SH.CONFIG) && sh_(APP.SH.RECORD) && sh_(APP.SH.ACTIVITY) && sh_(APP.SH.ROSTER));
  } catch (e) {}
  ['gemini', 'openai', 'anthropic'].forEach(function (p) {
    if (getKey_(p)) { st.hasKey = true; st.keyNames.push(p); }
  });
  try { st.subscription = subOn_(); } catch (e) { st.subscription = false; }
  if (st.installed) {
    try { st.rosterCount = getRoster_().length; st.rosterMode = rosterMode_(); } catch (e) {}
    try {
      st.activities = getActivities_().map(function (a) {
        return { key: a.key, name: a.name, inSheet: a.inSheet, exSheet: a.exSheet, quick: a.mode === '바로쓰기' };
      });
    } catch (e) {}
    try {
      st.backupModel = normModel(cfg_('예비 모델', ''));
      st.models = modelChoices_().filter(function (m) { return m !== SUBSCRIPTION_MODEL && m !== MANUAL_MODEL; });
      st.defaultModel = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
      st.compileModel = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
    } catch (e) {}
    if (st.activities.length) {
      try { st.exampleCount = readExampleRows_(getActivity_(st.activities[0].key)).length; } catch (e) {}
    }
    try { st.rules = currentPackInfo_(); } catch (e) {}
  }
  return st;
}

/* -------------------------------------------------------------- 1단계 */
function onboardInstall() {
  installCore_();
  return onboardStatus();
}

/* -------------------------------------------------------------- 2단계 */
/**
 * 키를 저장하고, 고른(또는 기본) 모델로 한 번 불러 본다.
 * 성공하면 그 모델을 활동용·합본용 모델로 맞추고, 모델 목록 표에 ✓ 를 남긴다.
 * @param {{provider:string, key?:string, model?:string}} p  key 가 비면 저장된 키로 모델만 다시 시험
 */
function onboardSaveKey(p) {
  var provider = String(p.provider || 'gemini');
  if (PROVIDERS.indexOf(provider) < 0) throw new Error('알 수 없는 회사: ' + provider);
  var key = String(p.key || '').trim();
  if (key) setKey_(provider, key);
  else if (!getKey_(provider)) throw new Error('키를 입력하세요.');

  var model = normModel(p.model) || PROVIDER_DEFAULT_MODEL[provider];
  var guess = guessProvider(model);
  if (guess && guess !== provider) {
    return { ok: false, status: onboardStatus(),
      message: model + ' 은(는) ' + providerLabel(guess) + ' 모델입니다. 위에서 회사를 ' + providerLabel(guess) +
               '(으)로 바꾸거나, ' + providerLabel(provider) + ' 모델 이름을 적어 주세요.' };
  }
  var res = testModel({ model: model, company: providerLabel(provider) });
  try {
    var preset = PRESET_MODELS.filter(function (x) { return x.model === model; })[0] || {};
    recordModelStatus_(res, { company: guess ? '자동' : providerLabel(provider), level: preset.level, memo: preset.memo });
  } catch (e) {}
  if (res.ok) {
    // 이미 다른 회사 키로 잘 쓰고 있으면 주 모델은 두고, 새 모델을 예비 모델로 둔다
    var cur = normModel(cfg_('활동용 모델', DEFAULT_MODEL));
    var curProv = providerOf_(cur);
    var keep = curProv && curProv !== 'subscription' && curProv !== provider && !!getKey_(curProv);
    var msg = '연결됐습니다 · ' + model + ' · ' + res.sec + '초. ';
    if (keep) {
      if (!normModel(cfg_('예비 모델', ''))) { setCfg_('예비 모델', model); msg += '지금 쓰는 ' + cur + ' 은 그대로 두고, ' + model + ' 을 예비 모델로 두었습니다(주 모델이 한도 초과 등으로 실패하면 대신 씀).'; }
      else msg += '지금 쓰는 ' + cur + ' 은 그대로 두었습니다. 바꾸려면 메뉴 ② [모델] 탭에서 고르세요.';
    } else {
      setCfg_('활동용 모델', model);
      setCfg_('합본용 모델', model);
      msg += '활동용·합본용 모델을 이것으로 맞췄습니다.';
    }
    try { refreshModelDropdowns_(); } catch (e) {}
    return { ok: true, model: model, kept: keep, status: onboardStatus(), message: msg };
  }
  // 시험은 실패해도 새 키는 저장됐으므로, 그 회사 모델이 드롭다운에 나오게 한다
  if (key) { try { refreshModelDropdowns_(); } catch (e) {} }
  return { ok: false, model: model, kind: res.kind || '', status: onboardStatus(), message: res.message };
}

/**
 * 2단계를 키 대신 "Gemini 구독(학교 계정·Google AI Pro)"으로 마친다.
 * 이미 키로 잘 쓰고 있는 모델이 있으면 그대로 두고, 아니면 활동용·합본용을 Gemini(구독)으로 맞춘다.
 */
function onboardUseSubscription() {
  setSub_(true);
  var changed = [];
  ['활동용 모델', '합본용 모델'].forEach(function (k) {
    var cur = normModel(cfg_(k, DEFAULT_MODEL));
    if (cur === SUBSCRIPTION_MODEL) return;
    if (providerOf_(cur) !== 'subscription' && modelUsable_(cur)) return;   // 키로 쓰는 모델은 둔다
    setCfg_(k, SUBSCRIPTION_MODEL);
    changed.push(k);
  });
  try { refreshModelDropdowns_(); } catch (e) {}
  var msg = 'Gemini 구독을 켰습니다. ';
  msg += changed.length ? changed.join('·') + '을 Gemini(구독)으로 맞췄습니다.'
                        : '지금 쓰는 모델은 키로 그대로 쓰고, Gemini(구독)도 목록에서 고를 수 있게 했습니다.';
  return { ok: true, status: onboardStatus(), message: msg };
}

/**
 * 2단계를 [키 없이 — 복사·붙여넣기]로 마친다. 키로 잘 쓰는 모델이 있으면 그대로 두고,
 * 키가 없는 모델이 골라져 있으면 활동용·합본용을 [키 없이(복사·붙여넣기)]로 맞춘다.
 */
function onboardUseManual() {
  setManual_(true);
  var changed = [];
  ['활동용 모델', '합본용 모델'].forEach(function (k) {
    var cur = normModel(cfg_(k, DEFAULT_MODEL));
    if (cur === MANUAL_MODEL || modelUsable_(cur)) return;
    setCfg_(k, MANUAL_MODEL);
    changed.push(k);
  });
  try { refreshModelDropdowns_(); } catch (e) {}
  return { ok: true, status: onboardStatus(),
           message: '키 없이 쓰기로 시작합니다. ' + (changed.length ? changed.join('·') + '을 [' + MANUAL_MODEL + ']로 맞췄습니다. ' : '') +
                    '나중에 키를 넣으면 메뉴 ⑥ 한 번으로 자동 생성됩니다.' };
}

/** 설정 시트의 값 하나를 바꾼다 */
function setCfg_(key, value) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) return;
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) { s.getRange(i + 1, 2).setValue(value); return; }
  }
}

/* -------------------------------------------------------------- 3단계 */
/**
 * 붙여넣은 명단을 해석한다.
 * 탭·쉼표·여러 칸 공백 어느 것으로 나뉘어 있어도 받고,
 * "1반 3번 김하늘" 같은 한 줄 표기도 받는다.
 */
/** 붙여넣은 명단 → 명단 시트 줄들 (해석은 14_RosterParse.gs) */
function parseRoster_(text, mode) {
  var r = parseRosterRows(rosterTextToRows(text), mode || 'class');
  return r.students.map(function (st) { return rosterRowOf(st, r.mode); });
}

/** @param {string} text  @param {string=} mode 'class' | 'grade' | 'auto' */
function onboardPreviewRoster(text, mode) {
  var r = rosterPreview({ text: text, mode: mode || 'auto' });
  return { count: r.count, mode: r.mode, warnings: r.warnings,
           sample: r.students.slice(0, 3).map(studentLabel), skippedCount: r.skippedCount };
}

function onboardSaveRoster(text, mode) {
  rosterSave({ text: text, mode: mode || 'auto' });
  return onboardStatus();
}

/* -------------------------------------------------------------- 4단계 */
/**
 * @param {{text:string, recordKey:string, subjectKey:string, model:string,
 *          columns?:(string|string[]), name?:string, direct?:boolean}} p
 *   direct: AI 없이 적어 준 항목 그대로 만든다
 */
function onboardCreateActivity(p) {
  var cols = p.columns ? validateColumns_(p.columns) : null;
  var def;
  if (p.direct) {
    if (!cols) throw new Error('입력 항목을 적어 주세요.');
    var name = String(p.name || '').trim() || String(p.text || '').trim().slice(0, 12) || '활동';
    def = { name: name, key: name, columns: cols, desc: String(p.text || '').trim(),
            recordKey: p.recordKey, subjectKey: p.subjectKey, examples: [] };
  } else {
    def = wizardSuggest({
      text: p.text, recordKey: p.recordKey, subjectKey: p.subjectKey,
      model: p.model, count: 2, columns: cols, name: p.name
    });
  }
  var made = wizardCreate(def);
  return { made: made, def: def, status: onboardStatus() };
}

/** 4단계를 [✍️ 바로 쓰기 시트]로 — 입력 항목 없이 */
function onboardCreateQuick(p) {
  var r = createQuickSheet({ name: p.name, recordKey: p.recordKey, subjectKey: p.subjectKey, desc: p.text });
  return { made: { inSheet: r.inSheet, exSheet: '' }, status: onboardStatus() };
}

/* -------------------------------------------------------------- 5단계 */
/** 시험에 쓸 학생 자료 한 건 — 예시 시트 1번, 없으면(바로 쓰기) 보기 메모 */
function testBlockFor_(act) {
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var rows = readExampleRows_(act);
  var values = rows.length ? rows[0].values : null;
  if (!values && act.mode === '바로쓰기') values = [SAMPLE_MEMO[act.recordKey] || SAMPLE_MEMO['과세특']];
  if (!values && act.mode === '보고서') values = ['', SAMPLE_POINTS, ''];
  if (!values) throw new Error('예시 시트가 비어 있어 시험할 자료가 없습니다. 활동을 다시 만들거나 예시를 한 줄 채워 주세요.');
  return blockFor_(act, values, (rec && rec.useGrade) ? 3 : '');
}

/** 키 없이 시험: 요청문을 만들어 준다 */
function onboardManualTest(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = buildManualUser([{ id: 'S1', block: testBlockFor_(act) }]);
  return { prompt: promptFor_(act) + '\n\n' + user, limit: bytesFor_(act), gem: buildGemText(promptFor_(act)) };
}

/** 키 없이 시험: 받아 온 답을 검사만 한다(시트에 쓰지 않음) */
function onboardManualCheck(p) {
  var txt = cleanResult_(parseManualAnswer(p.answer, ['S1']).map.S1 || '');
  if (!txt) return { ok: false, message: '받은 답을 붙여 넣어 주세요.' };
  var limit = Number(p.limit) || 1500;
  var v = inspect_(txt, limit);
  return { ok: true, text: txt, bytes: v.bytes, limit: limit,
           issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label + (i.hit ? ' → ' + i.hit : ''); }) };
}

/**
 * 시험 생성 — 학생 데이터를 건드리지 않고, 예시 시트의 1번 입력값으로
 * 실제 호출을 한 번 돌려 본다. 여기까지 결과가 나오면 설정이 끝난 것이다.
 */
function onboardTestGenerate(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = testBlockFor_(act);
  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  if (providerOf_(model) === 'subscription' || providerOf_(model) === 'manual' || !modelUsable_(model)) {
    var withKey = PROVIDERS.filter(function (x) { return getKey_(x); })[0];
    if (!withKey) throw new Error('API 키가 없어 스크립트로 바로 시험할 수 없습니다. [키 없이] 시험이나 [구독으로 시험하기]를 쓰세요.');
    model = PROVIDER_DEFAULT_MODEL[withKey];
  }

  var system = promptFor_(act);
  var txt = cleanResult_(callAI_(system, user, model));
  var limit = bytesFor_(act);
  var v = inspect_(txt, limit), fixed = false;
  // 시험에서도 실제 생성과 같은 흐름: [수정]이 나오면 한 번 고쳐 쓰게 한다
  if (needsRepair(v) && cfgBool_('자동 고쳐쓰기', true)) {
    try {
      var t2 = cleanResult_(callAI_(system, buildRepairUser(user, txt, v.issues.filter(function (x) { return x.level === 'block'; }), limit), model));
      var v2 = inspect_(t2, limit);
      if (t2 && betterResult(v, v2) === 'b') { txt = t2; v = v2; fixed = true; }
    } catch (e) {}
  }
  return {
    text: txt, bytes: v.bytes, limit: limit, model: model, repaired: fixed,
    issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; })
  };
}

/**
 * 구독만 쓰는 경우의 시험 생성.
 * =AI 수식은 선생님이 셀에서 [생성 및 삽입]을 눌러야 결과가 나오므로(구글 정책), 스크립트가 끝까지 할 수 없다.
 * [🚀 시작하기] 시트 아래쪽에 시험 셀을 만들어 그 셀로 데려가고, 결과는 onboardReadSubTest 로 읽는다.
 */
function onboardTestSubscription(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = testBlockFor_(act);

  var s = sh_(APP.SH.START) || buildStart();
  var r = s.getLastRow() + 2;
  if (r + 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + 1 - s.getMaxRows());
  s.getRange(r, 1).setValue('🧪 구독 시험 — 바로 아래 셀을 누르면 뜨는 [생성 및 삽입](Generate and insert)을 누르세요. ' +
                            '답이 들어오면 시작하기 창에서 [결과 확인]을 누릅니다. 확인이 끝나면 이 두 줄은 지워도 됩니다.')
    .setFontWeight('bold').setBackground(APP.COLORS.input);
  var cell = s.getRange(r + 1, 1);
  cell.setFormula(subscriptionFormula_(promptFor_(act), user));
  cell.activate();
  return { a1: cell.getA1Notation(), limit: bytesFor_(act) };
}

/** 구독 시험 셀의 결과를 읽어 검사한다. 아직 [생성 및 삽입] 전이면 ok:false */
function onboardReadSubTest(p) {
  var s = sh_(APP.SH.START);
  var cell = s && p && p.a1 ? s.getRange(p.a1) : null;
  var v = cell ? String(cell.getDisplayValue() || '').trim() : '';
  if (!v || /^#/.test(v) || /^(loading|로드 중)/i.test(v)) {
    return { ok: false, message: '아직 결과가 없습니다. 시험 셀을 선택하고 [생성 및 삽입]을 누른 뒤, 답이 들어오면 다시 눌러 주세요.' +
             (/^#/.test(v) ? ' (지금 셀에 ' + v.slice(0, 20) + ' 이(가) 보입니다 — 이 계정에서는 =AI 함수를 쓸 수 없는 것일 수 있습니다)' : '') };
  }
  var txt = cleanResult_(v);
  var limit = Number(p.limit) || 1500;
  var res = inspect_(txt, limit);
  return { ok: true, text: txt, bytes: res.bytes, limit: limit,
           issues: res.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; }) };
}

/* -------------------------------------------------------------- 마무리 */
function onboardFinish() {
  try { PropertiesService.getDocumentProperties().setProperty(ONBOARD_KEY, '1'); } catch (e) {}
  return true;
}

function onboardReset() {
  try { PropertiesService.getDocumentProperties().deleteProperty(ONBOARD_KEY); } catch (e) {}
  toast_('시작하기 안내를 다시 켰습니다.');
}

/** 특정 시트로 이동 */
function onboardGoto(name) {
  var s = sh_(name);
  if (s) ss_().setActiveSheet(s);
  return !!s;
}

/* ------------------------------------------------------ 시작하기 시트 */
/** [🚀 시작하기] 시트 위쪽 버튼 — 그림에 함수를 붙인다(휴대폰 앱에서는 동작하지 않아 메뉴 안내를 함께 둔다) */
var START_BUTTONS = [
  { img: 'start', fn: 'openOnboard', alt: '시작하기 (처음이면 여기)', row: 0, col: 0 },
  { img: 'quick', fn: 'openQuickSheetDialog', alt: '바로 쓰기 · 보고서 시트 추가', row: 0, col: 1 },
  { img: 'form', fn: 'openFormDialog', alt: '구글 설문지 연결', row: 1, col: 0 },
  { img: 'check', fn: 'openCheckSidebar', alt: '맞춤법 · 금지어 검사', row: 1, col: 1 },
  { img: 'style', fn: 'openStyleDialog', alt: '내 문체 카드', row: 2, col: 0 },
  { img: 'ocr', fn: 'openOcrGuide', alt: '스캔 문서 → 엑셀 사용 설명서', row: 2, col: 1 },
  { img: 'subject', fn: 'openSubjectDialog', alt: '새 교과 만들기', row: 3, col: 0 },
  { img: 'bytes', fn: 'openBytesDialog', alt: '활동별 바이트 한도', row: 3, col: 1 },
  { img: 'studio', fn: 'openStudio', alt: '세특 프롬프트 공방', row: 4, col: 0 },
  { img: 'help', fn: 'openHelpSheet', alt: '사용법 시트', row: 4, col: 1 }
];

function buildStart() {
  var s = shOrCreate_(APP.SH.START);
  s.clear();
  var L = [];
  var H = function (t) { L.push(['§', t]); };
  var P = function (t) { L.push(['', t]); };

  L.push(['#', '세특 작성 도우미 ' + APP.VERSION]);
  P('학생부 특기사항을 활동 단위로 모으고, 프롬프트를 자동으로 조립해 AI에게 맡기는 도구입니다. 과목별 세특 · 자율 · 동아리 · 진로 · 행발까지 같은 방식으로 씁니다.');
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  P('버튼이 안 눌리면 상단 메뉴 [' + APP.MENU + '] 에서 같은 이름을 누르세요. (휴대폰·태블릿 앱에서는 버튼이 동작하지 않습니다)');
  L.push(['!', '⚠️ 2026학년도 기재요령: ' + AI_NOTICE_2026]);
  P('');

  H('1단계.  이 파일을 내 드라이브로 복사하세요');
  P('지금 보고 계신 파일이 남의 원본이라면, 상단 [파일] > [사본 만들기] 를 먼저 누르세요. 이미 내 사본이라면 다음으로 넘어가면 됩니다.');
  P('');

  H('2단계.  위 초록 버튼 [▶ 시작하기] 를 누르세요');
  P('또는 상단 메뉴  [' + APP.MENU + ']  >  [🚀 시작하기].  팝업이 순서대로 안내합니다. 중간에 닫아도 다시 누르면 이어서 진행됩니다.');
  P('');

  H('⚠️ 처음 한 번만 — 권한 승인 화면 넘는 법');
  P('버튼이나 메뉴를 처음 누르면 구글이 승인을 요구합니다. 아래 순서대로 누르시면 됩니다.');
  P('   ①  [승인 필요] 창에서  [계속]  클릭');
  P('   ②  구글 계정 선택');
  P('   ③  "Google에서 확인하지 않은 앱입니다" 화면이 나오면  →  왼쪽 아래  [고급]  →  [세특 작성 도우미(안전하지 않음)(으)로 이동]');
  P('   ④  [허용]  클릭');
  P('이 경고는 개인이 만든 스크립트라서 뜨는 것입니다. 코드는 이 파일 안에 그대로 있고 [확장 프로그램] > [Apps Script] 에서 볼 수 있습니다.');
  P('');

  H('API 키가 없어도 됩니다 — 세 가지 방법 중 하나');
  P('①  키 없이 (복사·붙여넣기) — 처음이라면 이것부터.  시트가 요청문을 만들어 주면 Gemini 앱(gemini.google.com)에 붙여 넣고, 받은 답을 다시 붙여 넣습니다.');
  P('     학교 구글 계정으로 Gemini 앱에 들어가면 무료이고 입력 내용이 AI 학습에 쓰이지 않습니다(학교에서 Gemini를 켜 두었을 때). 학생 이름은 보내지 않습니다.');
  P('②  Gemini API 키 — 생성 · 검사가 버튼 한 번.  aistudio.google.com/apikey 에서 무료 발급. 무료 등급은 보낸 내용이 서비스 개선에 쓰일 수 있어, 학생 자료는 결제를 켠 키를 권합니다.');
  P('③  Gemini 구독(=AI 함수) — 학교에 Google AI Pro for Education 이 있거나 개인 Google AI Pro·Ultra 일 때.  무료 학교 계정(Education Fundamentals)에는 아직 없습니다.');
  P('     확인법: 시작하기 2단계 [구독으로]에서 [구독 확인하기] — 시험 셀을 만들어 [생성 및 삽입]이 되는지 봅니다.');
  P('');

  H('이 도구로 할 수 있는 것');
  P('· 활동별 세특·창체·행발 초안 — 메뉴 ④ 활동 만들기 (입력 항목은 직접 적거나 AI에게 맡김)');
  P('· ✍️ 바로 쓰기 — 입력 항목을 정하지 않고 학생마다 메모만 적어 초안 받기, 또는 직접 쓴 글을 바로 검사하기');
  P('· 📄 보고서 세특 — 학생 보고서(본문·PDF·사진·구글 문서·HWPX) → AI가 요점 뽑기 → 선생님 확인 → 직접 쓴 3~5편을 ⭐예시로 → 나머지 생성');
  P('· 📝 구글 설문지 연결 — 응답이 오면 저절로 시트에(파일 업로드 보고서 포함), 원하면 바로 생성');
  P('· ✒️ 내 문체 — 예전에 쓴 세특을 넣으면 "나처럼" 쓰도록 문체 카드를 만들어 모든 학생에게 똑같이 적용');
  P('· 📚 새 교과 만들기 — 목록에 없는 교과(화학 · 공통국어1 · 인공지능 기초 …)의 교과 역량과 입력 항목을 교육과정 자료로 AI가 초안, 선생님끼리 글로 나누기');
  P('· 📏 활동별 바이트 한도 — 한 칸(예: 수학 과세특 1500바이트)을 탐구 · 발표 · 수업 태도처럼 여러 활동이 나눠 쓰게');
  P('· 🧪 세특 프롬프트 공방 — 활동을 설계하면서 조립되는 프롬프트를 바로 보고 복사(어느 AI에든), 마음에 들면 그대로 활동 시트로');
  P('· 🔍 맞춤법 · 금지어 검사 — 2026 기재요령 금지어, 어미 · 특수문자, 맞춤법 · 띄어쓰기, 나이스 바이트');
  P('· 생성 직후 자동 검사 → [수정]이 나온 학생만 걸린 점을 짚어 한 번 더 고쳐 쓰기, 원하면 근거 확인(학생 자료에 없는 내용 찾기)');
  P('· 📏 기재요령 규칙판은 해마다 저절로 업데이트 — 직접 고친 칸은 그대로 둡니다');
  P('');

  H('꼭 알아 두실 것');
  P('· AI 키는 이 파일이 아니라 각자의 구글 계정에 저장됩니다. 사본을 나눠 줘도 키는 넘어가지 않습니다.');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다. 주민등록번호, 가정환경, 건강 정보 같은 민감정보는 입력하지 마세요.');
  P('· AI가 쓴 문장을 그대로 기재하지 마세요. 교사가 직접 관찰·평가한 내용을 바탕으로 고쳐 쓰고, 최종 문장의 책임은 작성한 교사에게 있습니다.');
  P('· 학교·교육청의 생성형 AI 활용 지침을 먼저 확인하세요. 시도교육청마다 다릅니다.');
  P('');

  H('함께 쓰면 좋은 도구');
  P('📄 스캔 문서 → 엑셀 (업무 인수인계 대시보드) — 손글씨 활동지 · 신청서를 글자 그대로 표로 읽어 엑셀로. 위 파란 버튼을 누르면 설치 · 사용법이 열립니다.');
  P('');
  P('설정이 끝나면 이 탭은 닫아 두셔도 됩니다. 자세한 사용법은 [📖 사용법] 탭에 있습니다.');

  var rows = L.map(function (r) { return [r[1]]; });
  s.getRange(1, 1, rows.length, 1).setValues(rows);
  var btnRows = [];
  for (var i = 0; i < L.length; i++) {
    var c = s.getRange(i + 1, 1);
    if (L[i][0] === '#') c.setFontSize(18).setFontWeight('bold').setFontColor('#1b3a2a');
    else if (L[i][0] === '§') {
      c.setFontWeight('bold').setFontSize(13).setBackground('#e3ece4').setFontColor('#1b3a2a');
      s.setRowHeight(i + 1, 32);
    } else if (L[i][0] === '!') {
      c.setBackground('#fdecea').setFontColor('#7f1d1d').setFontWeight('bold').setFontSize(10);
      s.setRowHeight(i + 1, 50);
    } else if (L[i][0] === 'btn') {
      s.setRowHeight(i + 1, 62);
      btnRows.push(i + 1);
    }
  }
  s.setColumnWidth(1, 820);
  s.getRange(1, 1, rows.length, 1).setWrap(true).setVerticalAlignment('middle');
  s.setHiddenGridlines(true);
  try { placeStartButtons_(s, btnRows); } catch (e) {}   // 그림을 못 넣어도 시트는 그대로 쓴다
  return s;
}

/** 버튼 그림을 지우고 다시 붙인다 (여러 번 만들어도 겹치지 않게) */
function placeStartButtons_(s, btnRows) {
  s.getImages().forEach(function (img) { img.remove(); });
  START_BUTTONS.forEach(function (b) {
    var row = btnRows[b.row];
    if (!row || !BUTTON_PNG[b.img]) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(BUTTON_PNG[b.img]), 'image/png', b.img + '.png');
    var img = s.insertImage(blob, 1, row, 6 + b.col * 400, 5);
    img.setWidth(380).setHeight(52);
    img.assignScript(b.fn);
    try { img.setAltTextTitle(b.alt).setAltTextDescription('누르면 ' + b.alt + ' 창이 열립니다'); } catch (e) {}
  });
}
