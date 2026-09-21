/**
 * 세특 작성 도우미 v3 — 활동 만들기 AI 마법사
 *
 * "프롬프트를 쓰는 일"을 없애는 것이 목적입니다.
 * 교사는 활동을 말로 설명하고, AI가 입력 항목·활동 개요·예시 초안을 제안하며,
 * 프롬프트 본문은 엔진이 조립합니다. 교사는 검토하고 [만들기]만 누릅니다.
 */

function openWizard() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Wizard')
    .setWidth(620).setHeight(680);
  // 모델리스: 대화상자를 열어 둔 채 시트를 계속 볼 수 있습니다.
  SpreadsheetApp.getUi().showModelessDialog(html, '활동 만들기 마법사');
}

/** 사이드바 초기 데이터 */
function wizardContext() {
  return {
    records: getRecordTypes_().map(function (r) {
      return { key: r.key, name: r.name, chars: r.chars, useGrade: r.useGrade };
    }),
    subjects: getSubjects_().map(function (s) {
      return { key: s.key, name: s.name, kind: s.kind };
    }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    models: modelChoices_(),
    defaultModel: normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL,
    hasKey: !!(getKey_('openai') || getKey_('gemini') || getKey_('anthropic'))
  };
}

/**
 * 말로 쓴 설명 → 활동 정의(JSON) 제안
 * @param {Object} p {text, recordKey, subjectKey, model, previous}
 */
function wizardSuggest(p) {
  var rec = findByKey(getRecordTypes_(), p.recordKey) || getRecordTypes_()[0];
  var sub = findByKey(getSubjects_(), p.subjectKey) || findByKey(getSubjects_(), '공통');
  var model = normModel(p.model) || normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var want = Math.max(1, Math.min(3, Number(p.count) || 1));
  if (providerOf_(model) === 'subscription') {
    throw new Error('마법사는 API 키가 필요합니다. 모델을 ' + DEFAULT_MODEL + ' 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.');
  }

  var system = [
    '당신은 학교생활기록부 기록 설계를 돕는 조수입니다.',
    '교사가 설명한 활동을 스프레드시트 입력 양식으로 바꾸는 것이 임무입니다.',
    '',
    '# 지켜야 할 것',
    '- 반드시 아래 JSON 하나만 출력한다. 설명, 머리말, 코드펜스를 붙이지 않는다.',
    '- name: 시트에 표시할 짧은 활동 이름(12자 이내).',
    '- key: 시트 이름에 쓸 짧은 식별자(공백 없이 8자 이내, 한글 가능).',
    '- columns: 교사가 학생 한 명당 채울 입력 항목 이름 배열. 3~6개.',
    '    · 교사가 실제로 타이핑할 수 있을 만큼 짧고 구체적인 항목으로 만든다.',
    '    · 결과(특기사항 문장) 자체를 입력 항목으로 넣지 않는다.',
    '    · 활동의 과정이 드러나도록 구성한다(무엇을, 왜, 어떻게, 무엇을 알게 되었는지, 한계 등).',
    '- desc: 이 활동이 무엇인지 교사 시점에서 1~2문장으로 요약. AI가 맥락을 잡는 데 쓰인다.',
    '- examples: 예시 ' + want + '개. values는 columns와 같은 순서·같은 개수의 문자열 배열,',
    '    result는 그 자료로 쓴 특기사항 예문.',
    '    result는 명사형 어미(~함/~음/~임)를 쓰고, 학생을 지칭하는 주어와 특수문자를 쓰지 않으며,',
    '    ' + rec.chars + '자 이내여야 한다. 수상·자격증·어학점수·대학명은 절대 넣지 않는다.',
    (want > 1
      ? '    ' + want + '개는 서로 다른 소재와 다른 수준을 다루어야 한다. ' +
        (rec.useGrade
          ? '성취수준이 높은 학생과 아직 부족한 학생이 섞이게 하되, 부족한 경우도 노력한 지점과 성장 가능성을 담아 긍정적으로 쓴다.'
          : '주도한 경우와 시행착오를 겪은 경우가 섞이게 한다.')
      : ''),
    '',
    '# 대상 기록',
    rec.name + ' (' + rec.chars + '자 이내)',
    rec.view || '',
    '',
    '# 교과·영역',
    (sub ? sub.name : '공통'),
    '',
    '# 출력 형식',
    '{"name":"","key":"","columns":["",""],"desc":"","examples":[{"values":["",""],"result":""}]}'
  ].filter(function (x) { return x !== ''; }).join('\n');

  var user = '교사의 설명:\n' + String(p.text || '').trim();
  if (p.previous) {
    user += '\n\n직전에 제안한 초안:\n' + JSON.stringify(p.previous) +
            '\n\n위 초안을 교사의 요청에 맞게 수정해서 같은 JSON 형식으로 다시 출력하라.';
  }

  var raw = callAI_(system, user, model);
  var def = parseJsonLoose_(raw);
  if (!def || !def.columns || !def.columns.length) {
    throw new Error('AI 응답을 이해하지 못했습니다. 설명을 조금 더 구체적으로 적어 주세요.');
  }
  def.key = safeKey_(def.key || def.name);
  def.chars = rec.chars;
  def.recordKey = rec.key;
  def.subjectKey = sub ? sub.key : '공통';
  if (!Array.isArray(def.examples)) def.examples = [];
  // 예문이 한도를 넘거나 마크다운이 섞여 오는 경우를 정리
  var limit = rec.chars * 3;
  def.examples = def.examples.filter(function (e) { return e && e.result; }).map(function (e) {
    var res = cleanResult_(e.result);
    if (byteLen(res) > limit) res = trimToBytes(res, limit);
    var vals = Array.isArray(e.values) ? e.values : [];
    var norm = [];
    for (var c = 0; c < def.columns.length; c++) norm.push(String(vals[c] || '').trim());
    return { values: norm, result: res };
  }).slice(0, want);
  return def;
}

/** 코드펜스·앞뒤 설명이 섞여 있어도 JSON을 뽑아낸다 */
function parseJsonLoose_(raw) {
  var t = String(raw || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {}
  // 흔한 깨짐: 말미 쉼표
  try { return JSON.parse(t.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1')); } catch (e2) {}
  return null;
}

/** 만들기 전에 실제 프롬프트를 확인 */
function wizardPreview(def) {
  var recs = getRecordTypes_(), subs = getSubjects_();
  var rec = findByKey(recs, def.recordKey) || recs[0];
  var sub = findByKey(subs, def.subjectKey) || findByKey(subs, '공통');
  var cols = Array.isArray(def.columns) ? def.columns : parseColumns(def.columns);
  var blocks = [];
  (def.examples || []).forEach(function (ex, i) {
    if (!ex || !ex.result) return;
    var parts = [];
    cols.forEach(function (c, ci) {
      var v = ex.values ? ex.values[ci] : '';
      if (v) parts.push(c + ': ' + v);
    });
    blocks.push('## 예시' + (i + 1) + ' 입력\n' + parts.join('\n') +
                '\n## 예시' + (i + 1) + ' 결과\n' + ex.result);
  });
  var examples = blocks.join('\n\n');
  return buildPrompt({
    activity: {
      key: def.key, name: def.name, recordKey: rec.key, subjectKey: sub ? sub.key : '공통',
      chars: def.chars || rec.chars, columns: cols.join('|'), desc: def.desc, mode: '자동'
    },
    record: rec, subject: sub, common: getCommon_(),
    examples: examples, years: Number(cfg_('교사 경력(년)', 15))
  });
}

/** 확정 → 시트 생성 */
function wizardCreate(def) {
  var cols = Array.isArray(def.columns) ? def.columns : parseColumns(def.columns);
  var r = createActivity_({
    key: def.key, name: def.name, recordKey: def.recordKey, subjectKey: def.subjectKey,
    chars: def.chars, columns: cols.join('|'), desc: def.desc, examples: def.examples || []
  });
  var s = sh_(r.inSheet);
  if (s) ss_().setActiveSheet(s);
  return r;
}
