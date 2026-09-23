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
  var html = HtmlService.createHtmlOutputFromFile('UI_Onboard')
    .setWidth(640).setHeight(700);
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
    providerDefaults: PROVIDER_DEFAULT_MODEL, presets: presetModelRows_(), links: MODEL_LINKS
  };
  try {
    st.installed = !!(sh_(APP.SH.CONFIG) && sh_(APP.SH.RECORD) && sh_(APP.SH.ACTIVITY) && sh_(APP.SH.ROSTER));
  } catch (e) {}
  ['gemini', 'openai', 'anthropic'].forEach(function (p) {
    if (getKey_(p)) { st.hasKey = true; st.keyNames.push(p); }
  });
  if (st.installed) {
    try { st.rosterCount = getRoster_().length; st.rosterMode = rosterMode_(); } catch (e) {}
    try {
      st.activities = getActivities_().map(function (a) {
        return { key: a.key, name: a.name, inSheet: a.inSheet, exSheet: a.exSheet };
      });
    } catch (e) {}
    try {
      st.backupModel = normModel(cfg_('예비 모델', ''));
      st.models = modelChoices_().filter(function (m) { return m.indexOf('구독') < 0; });
      st.defaultModel = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
      st.compileModel = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
    } catch (e) {}
    if (st.activities.length) {
      try { st.exampleCount = readExampleRows_(getActivity_(st.activities[0].key)).length; } catch (e) {}
    }
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
  return { ok: false, model: model, kind: res.kind || '', status: onboardStatus(), message: res.message };
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

/* -------------------------------------------------------------- 5단계 */
/**
 * 시험 생성 — 학생 데이터를 건드리지 않고, 예시 시트의 1번 입력값으로
 * 실제 호출을 한 번 돌려 본다. 여기까지 결과가 나오면 설정이 끝난 것이다.
 */
function onboardTestGenerate(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var cols = parseColumns(act.columns);
  var rows = readExampleRows_(act);
  if (!rows.length) throw new Error('예시 시트가 비어 있어 시험할 자료가 없습니다. 활동을 다시 만들거나 예시를 한 줄 채워 주세요.');

  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var user = buildStudentBlock(cols, rows[0].values, { grade: (rec && rec.useGrade) ? 3 : '' });
  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  if (providerOf_(model) === 'subscription') {
    var withKey = PROVIDERS.filter(function (x) { return getKey_(x); })[0] || 'gemini';
    model = PROVIDER_DEFAULT_MODEL[withKey];
  }

  var txt = cleanResult_(callAI_(promptFor_(act), user, model));
  var limit = charsFor_(act) * 3;
  var v = validateResult(txt, limit, PRESET_BANNED, PRESET_FORMAT_RULES);
  return {
    text: txt, bytes: v.bytes, limit: limit, model: model,
    issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; })
  };
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
function buildStart() {
  var s = shOrCreate_(APP.SH.START);
  s.clear();
  var L = [];
  var H = function (t) { L.push(['§', t]); };
  var P = function (t) { L.push(['', t]); };

  L.push(['#', '세특 작성 도우미 ' + APP.VERSION]);
  P('학생부 특기사항을 활동 단위로 모으고, 프롬프트를 자동으로 조립해 AI에게 맡기는 도구입니다.');
  P('과목별 세특뿐 아니라 자율·동아리·진로·행동특성 및 종합의견까지 같은 방식으로 씁니다.');
  P('');

  H('1단계.  이 파일을 내 드라이브로 복사하세요');
  P('지금 보고 계신 파일이 남의 원본이라면, 상단 [파일] > [사본 만들기] 를 먼저 누르세요.');
  P('이미 내 사본이라면 다음으로 넘어가면 됩니다.');
  P('');

  H('2단계.  메뉴에서 [🚀 시작하기] 를 누르세요');
  P('상단 메뉴  [' + APP.MENU + ']  >  [🚀 시작하기]');
  P('나머지는 팝업이 순서대로 안내합니다. 중간에 닫아도 다시 누르면 이어서 진행됩니다.');
  P('');

  H('⚠️ 처음 한 번만 — 권한 승인 화면 넘는 법');
  P('메뉴를 처음 누르면 구글이 승인을 요구합니다. 아래 순서대로 누르시면 됩니다.');
  P('');
  P('   ①  [승인 필요] 창에서  [계속]  클릭');
  P('   ②  구글 계정 선택');
  P('   ③  "Google에서 확인하지 않은 앱입니다" 화면이 나오면');
  P('        →  왼쪽 아래  [고급]  클릭');
  P('        →  [세특 작성 도우미(안전하지 않음)(으)로 이동]  클릭');
  P('   ④  [허용]  클릭');
  P('');
  P('이 경고는 개인이 만든 스크립트라서 뜨는 것입니다. 구글 심사를 받은 앱이 아니면 모두 이 화면이 나옵니다.');
  P('코드는 이 파일 안에 그대로 들어 있고, [확장 프로그램] > [Apps Script] 에서 직접 확인할 수 있습니다.');
  P('');

  H('무엇이 필요한가요');
  P('· AI 키 하나.  Gemini 키가 가장 부담이 적습니다(무료 등급 있음). aistudio.google.com 에서 발급.');
  P('· 구글 워크스페이스 Gemini나 Google One AI Premium 구독이 있다면 키 없이도 쓸 수 있습니다.');
  P('   확인법: 빈 셀에  =AI("안녕")  을 넣어 답이 나오면 됩니다.');
  P('· 학생 명단(반·번호·이름, 동아리면 학년까지). 엑셀 양식을 내려받아 채워 올리거나, 복사해 붙여넣으면 됩니다.');
  P('');

  H('꼭 알아 두실 것');
  P('· AI 키는 이 파일이 아니라 각자의 구글 계정에 저장됩니다. 사본을 나눠 줘도 키는 넘어가지 않습니다.');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다.');
  P('· 주민등록번호, 가정환경, 건강 정보 같은 민감정보는 입력하지 마세요.');
  P('· AI가 쓴 문장을 그대로 기재하지 마세요. 반드시 읽고 고쳐서 쓰는 것이 원칙이며,');
  P('   최종 문장에 대한 책임은 작성한 교사에게 있습니다.');
  P('· 학교·교육청의 생성형 AI 활용 지침을 먼저 확인하세요. 시도교육청마다 다릅니다.');
  P('');
  P('설정이 끝나면 이 탭은 닫아 두셔도 됩니다. 자세한 사용법은 [📖 사용법] 탭에 있습니다.');

  var rows = L.map(function (r) { return [r[1]]; });
  s.getRange(1, 1, rows.length, 1).setValues(rows);
  for (var i = 0; i < L.length; i++) {
    var c = s.getRange(i + 1, 1);
    if (L[i][0] === '#') c.setFontSize(18).setFontWeight('bold').setFontColor('#1b3a2a');
    else if (L[i][0] === '§') {
      c.setFontWeight('bold').setFontSize(13).setBackground('#e3ece4').setFontColor('#1b3a2a');
      s.setRowHeight(i + 1, 32);
    }
  }
  s.setColumnWidth(1, 820);
  s.getRange(1, 1, rows.length, 1).setWrap(true).setVerticalAlignment('middle');
  s.setHiddenGridlines(true);
  return s;
}
