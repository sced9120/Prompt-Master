/**
 * 세특 작성 도우미 v3 — 📚 새 교과 만들기 (시트 쪽)
 * 요청문·답 읽기·나누는 글은 19_Subjects.gs(순수). 여기서는 창 열기, AI 부르기, [📚 교과영역] 저장.
 *
 * 흐름: 교과 이름 + 교육과정 자료(붙여 넣기·드라이브 PDF/HWPX/구글 문서)
 *   → API 가 있으면 바로 초안, 없으면 요청문 복사 → Gemini 앱 → 답 붙여 넣기
 *   → 창에서 읽고 고침([교육과정 확인 필요] 줄은 확인 체크) → 저장 → (선택) 그 입력 항목으로 활동 만들기
 */

function openSubjectDialog() {
  if (!sh_(APP.SH.SUBJECT) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Subject').setWidth(780).setHeight(720);
  ui_().showModalDialog(html, '📚 새 교과 만들기');
}

function subjectContext() {
  var model = '';
  try { model = apiModelForChecks_(); } catch (e) {}
  return {
    model: model,
    subjects: getSubjects_().map(function (s) { return { key: s.key, name: s.name, kind: s.kind }; }),
    records: getRecordTypes_().map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통'))
  };
}

/** 키 없이 — Gemini 앱에 붙여 넣을 요청문. 드라이브 파일은 Gemini [+] 로 직접 붙이게 한다 */
function subjectRequest(p) {
  p = p || {};
  if (!String(p.name || '').trim()) throw new Error('교과(과목) 이름을 적어 주세요.');
  var files = driveIdsIn(p.link || '').length ? ['교육과정 파일(Gemini [+] → 드라이브에서 붙임)'] : [];
  return SUBJECT_SYSTEM + '\n\n' + buildSubjectUser({ name: p.name, level: p.level, note: p.note, source: p.source, files: files });
}

/** API 로 초안 — 저장하지 않고 돌려준다(창에서 읽고 고친 뒤 저장) */
function subjectDraft(p) {
  p = p || {};
  if (!String(p.name || '').trim()) throw new Error('교과(과목) 이름을 적어 주세요.');
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없습니다. [요청문 복사]로 Gemini 앱에서 만들어 답을 붙여 넣으세요.');
  var src = { text: '', parts: [], files: [], errors: [] };
  if (String(p.link || '').trim()) {
    src = readReportSource_(p.link);
    if (!src.text && !src.parts.length) throw new Error(src.errors.length ? src.errors.join(' / ') : '링크에서 읽을 파일을 찾지 못했습니다.');
  }
  var source = [String(p.source || '').trim(), src.text].filter(String).join('\n\n');
  usageReset_();
  var res = callWithBackup_(SUBJECT_SYSTEM,
    buildSubjectUser({ name: p.name, level: p.level, note: p.note, source: source, files: src.files }), model, { parts: src.parts });
  var sub = parseSubjectAnswer(res.text);
  if (sub.missing.length) throw new Error('AI 답을 읽지 못했습니다(' + sub.missing.join('·') + ' 없음). 한 번 더 누르거나 [요청문 복사]로 해 보세요.');
  return { sub: sub, exists: !!findByKey(getSubjects_(), sub.key), errors: src.errors, model: res.model, usage: usageText_() };
}

/** 붙여 넣은 답(또는 공방·다른 선생님이 나눈 교과 글) 읽기 */
function subjectParse(text) {
  var sub = parseSubjectAnswer(text);
  if (sub.missing.length) {
    throw new Error('읽지 못한 것: ' + sub.missing.join('·') + ' — "키: …", "관찰 모습:" 같은 줄이 든 답을 통째로 붙여 넣으세요.');
  }
  return { sub: sub, exists: !!findByKey(getSubjects_(), sub.key) };
}

/**
 * [📚 교과영역]에 저장. 같은 키가 있으면 opts.overwrite 일 때만 덮어쓴다.
 * @param {{key,name,kind,role,comp,columns}} sub
 * @param {{overwrite?:boolean, confirmed?:boolean, makeDefault?:boolean,
 *          activity?:{name:string, recordKey?:string, desc?:string}}} opts  activity 가 있으면 그 입력 항목으로 활동도 만든다
 * @return {{key:string, message:string, inSheet:string}}
 */
function subjectSave(sub, opts) {
  sub = sub || {}; opts = opts || {};
  var key = subjectKeyOf(sub.key || sub.name);
  if (!key) throw new Error('키가 비었습니다.');
  var comp = String(sub.comp || '').trim();
  if (!comp) throw new Error('역량·서술 관점이 비었습니다.');
  if (comp.indexOf(SUBJECT_UNSURE) >= 0 && !opts.confirmed) {
    throw new Error(SUBJECT_UNSURE + ' 표시가 남아 있습니다. 교육과정 문서와 맞춰 본 뒤 [확인했습니다]를 체크하세요.');
  }
  comp = comp.split(SUBJECT_UNSURE).join('').replace(/[ \t]+(\n|$)/g, '$1').trim();
  var name = String(sub.name || key).trim();
  var role = String(sub.role || '').trim() || ('고등학교 ' + name.replace(/\(.*?\)/g, '').trim() + '교사');
  var row = [key, name, sub.kind === '공통' ? '공통' : '교과', role, comp];

  var s = shRequire_(APP.SH.SUBJECT);
  var at = 0;
  readTable_(s, 2).forEach(function (r) { if (String(r['키'] || '').trim() === key) at = r.__row; });
  if (at && !opts.overwrite) throw new Error('이미 "' + key + '" 교과가 있습니다. [같은 키 덮어쓰기]를 체크하거나 키를 바꾸세요.');
  if (at) s.getRange(at, 1, 1, row.length).setValues([row]);
  else { s.appendRow(row); at = s.getLastRow(); }
  s.getRange(at, 1, 1, row.length).setWrap(true).setVerticalAlignment('top');
  refreshActivityValidation_();
  if (opts.makeDefault) setCfg_('기본 교과영역', key);

  var msg = '[📚 교과영역]에 "' + key + '"을(를) ' + (opts.overwrite ? '저장' : '더') + '했습니다.', inSheet = '';
  if (opts.activity && String(opts.activity.name || '').trim()) {
    var cols = Array.isArray(sub.columns) ? sub.columns : parseColumns(sub.columns);
    if (!cols.length) throw new Error('교과는 저장했습니다. 활동을 만들려면 입력 항목을 1개 이상 적어 주세요.');
    var made = createActivity_({
      key: opts.activity.name, name: String(opts.activity.name).trim(), recordKey: opts.activity.recordKey || '과세특',
      subjectKey: key, columns: cols, desc: String(opts.activity.desc || '').trim()
    });
    inSheet = made.inSheet;
    msg += ' 활동 시트 [' + inSheet + ']도 만들었습니다.';
    try { ss_().setActiveSheet(sh_(inSheet)); } catch (e) {}
  }
  return { key: key, message: msg, inSheet: inSheet };
}
