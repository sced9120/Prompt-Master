/* v3.7 — 📄 보고서 세특 · 보고서 파일 읽기 · ⭐ 예시 등록 · ✒️ 내 문체 · 📝 구글 설문지 연결
   (node test/reports.test.js) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();

function boot() {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));   // 새 버전 확인도 건너뜀(호출 수를 세는 시험)
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ' — ' : '') + '기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a)); };
const gem = (text) => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: text }] } }] } });
const P = boot();

console.log('\n[보고서 — 순수]');
t('드라이브 링크에서 파일 ID (설문지 open?id · file/d · 문서)', () => {
  const ids = P.driveIdsIn('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345, https://drive.google.com/file/d/1ZyXwVuTsRqPoNmLkJiHgFeDcBa98765/view\nhttps://docs.google.com/document/d/1DocDocDocDocDocDocDocDocDoc0001/edit');
  eq(ids.length, 3); eq(ids[0], '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  eq(P.driveIdsIn('id=짧음 https://example.com').length, 0);
  eq(P.textWithoutLinks('제 보고서입니다 https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), '제 보고서입니다');
});
t('폴더 링크', () => eq(P.driveFolderIdIn('https://drive.google.com/drive/u/0/folders/1FoLdErFoLdErFoLdErFoLdEr0001?usp=x'), '1FoLdErFoLdErFoLdErFoLdEr0001'));
t('docx · hwpx · pptx 글자 뽑기', () => {
  eq(P.xmlText('<w:p><w:r><w:t>가설을</w:t></w:r><w:r><w:t xml:space="preserve"> 세움</w:t></w:r></w:p><w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p>', 'docx'), '가설을 세움\nA & B');
  eq(P.xmlText('<hp:p><hp:run><hp:t>실험 결과</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>오차 분석</hp:t></hp:run></hp:p>', 'hwpx'), '실험 결과\n오차 분석');
  eq(P.xmlText('<a:p><a:r><a:t>슬라이드 1</a:t></a:r></a:p>', 'pptx'), '슬라이드 1');
});
t('파일 종류', () => {
  eq(P.fileKind('application/vnd.google-apps.document', 'x'), 'gdoc');
  eq(P.fileKind('application/pdf', 'a.pdf'), 'pdf'); eq(P.fileKind('image/jpeg', 'a.jpg'), 'image');
  eq(P.fileKind('application/octet-stream', '보고서.hwpx'), 'hwpx'); eq(P.fileKind('application/x-hwp', '보고서.hwp'), 'hwp');
  eq(P.fileKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'), 'docx');
});
t('파일 이름 → 학생 (학번 > 이름 > 반·번호, 겹치면 모름)', () => {
  const st = [{ cls: 3, no: 15, name: '김하늘' }, { cls: 3, no: 7, name: '박서준' }, { cls: 2, no: 15, name: '이유나' }];
  eq(P.matchFileToStudent('20315_실험보고서.pdf', st), 0);
  eq(P.matchFileToStudent('박서준 보고서 최종.docx', st), 1);
  eq(P.matchFileToStudent('2반 15번 탐구.hwpx', st), 2);
  eq(P.matchFileToStudent('보고서.pdf', st), -1);
  eq(P.matchFileToStudent('김하늘_박서준_공동.pdf', st), -1);
});
t('요점 답 정리 — 머리말·굵게·글머리 걷기', () => {
  const r = P.cleanPoints('다음은 요점입니다.\n- **탐구 주제와 동기**: 급식\n- 탐구 과정과 방법: 표');
  ok(/^탐구 주제와 동기: 급식\n탐구 과정과 방법: 표$/.test(r), r);
});
t('요점 뽑기 지시에 연구보고서 실적·이름을 옮기지 말라는 규칙', () => {
  ok(/참여 인원·소요 시간/.test(P.EXTRACT_SYSTEM) && /추측, 평가, 칭찬/.test(P.EXTRACT_SYSTEM));
  P.REPORT_POINTS.forEach(p => ok(P.EXTRACT_SYSTEM.indexOf(p + ': ') >= 0, p));
});

console.log('\n[내 문체 — 순수]');
const pastStyle = ['실험을 설계하였음. 변인을 통제하였음. 결과를 정리하였음.', '자료를 분석하였음. 오차를 줄였음. 개선안을 냈음.'];
t('끝맺음이 예시와 다르면 [확인] 문체', () => {
  const ref = P.styleProfile(pastStyle);
  ok(ref.pastRatio > 0.6, JSON.stringify(ref));
  const d = P.styleDrift(ref, '실험을 설계함. 변인을 통제함. 결과를 정리함.');
  ok(d && /끝맺음/.test(d.hit), JSON.stringify(d));
  eq(P.styleDrift(ref, '실험을 설계하였음. 결과를 정리하였음.'), null);
});
t('문장 길이가 크게 다르면 [확인]', () => {
  const ref = P.styleProfile(['짧게 씀. 짧게 씀.', '또 씀. 또 씀.']);
  const d = P.styleDrift(ref, '여러 활동에 꾸준히 참여하여 친구들과 협력하며 자료를 모으고 정리하는 과정을 끝까지 성실하게 해냄.');
  ok(d && /문장 길이/.test(d.hit), JSON.stringify(d));
});
t('기준 글이 2편 미만이면 보지 않음', () => eq(P.styleDrift(P.styleProfile(['한 편뿐임.']), '아무 글.'), null));
t('문체 카드는 학생 자료 뒤에 붙는 꼬리로', () => {
  ok(/# 쓰기 직전 확인 — 내 문체/.test(P.styleTail('- 한 편 4문장')));
  eq(P.styleTail(''), '');
});

console.log('\n[설문지 — 순수]');
t('머리글 알아보기 (물음 꼴·괄호·이메일)', () => {
  eq(P.formHeadKind('타임스탬프'), 'ts'); eq(P.formHeadKind('이메일 주소'), 'email');
  eq(P.formHeadKind('학번 (예: 20315)'), 'sid'); eq(P.formHeadKind('몇 반인가요?'), 'cls');
  eq(P.formHeadKind('번호를 입력하세요'), 'no'); eq(P.formHeadKind('이름(실명)'), 'name');
  eq(P.formHeadKind('탐구 주제'), '');
});
t('응답 시트 해석 — 학생 칸과 문항 칸', () => {
  const info = P.parseFormHeader(['타임스탬프', '이메일 주소', '학번', '이름', '탐구 주제', '보고서 파일']);
  eq(info.sid, 2); eq(info.name, 3); eq(info.email, 1);
  eq(info.questions.map(q => q.title).join(), '탐구 주제,보고서 파일');
  ok(info.ok);
});
t('같은 학생이 여러 번 내면 마지막 응답', () => {
  const info = P.parseFormHeader(['타임스탬프', '반', '번호', '이름', '느낀 점']);
  const r = P.latestResponses([[1, 3, 15, '김하늘', '처음'], [2, 3, 7, '박서준', '좋음'], [3, 3, 15, '김하늘', '다시 냄']], info);
  eq(r.length, 2); eq(r[0].row[4], '다시 냄'); eq(r[0].st.cls, 3); eq(r[0].st.no, 15);
});
t('학번 → 학년·반·번호', () => {
  const info = P.parseFormHeader(['타임스탬프', '학번', '이름']);
  const st = P.formStudentOf(['t', '20315', '김하늘'], info);
  eq(st.year, 2); eq(st.cls, 3); eq(st.no, 15);
});
t('자동 연결: 이름이 같은 칸, 보고서 시트는 파일 문항 → [보고서]', () => {
  const m = P.autoMapQuestions([{ title: '탐구 주제' }, { title: '제출 파일', isFile: true }, { title: '소감' }], P.REPORT_COLUMNS, '보고서');
  eq(m['제출 파일'], '보고서'); eq(m['탐구 주제'], '보고서'); eq(m['소감'], '');
  eq(P.autoMapQuestions([{ title: '탐구 주제' }], ['탐구 주제', '알게 된 점'], '')['탐구 주제'], '탐구 주제');
});
t('여러 문항을 한 칸에 — "문항: 답"', () => {
  eq(P.joinAnswers([{ title: 'a', value: '하나' }]), '하나');
  eq(P.joinAnswers([{ title: '동기', value: '궁금' }, { title: '빈칸', value: '' }, { title: '과정', value: '측정' }]), '동기: 궁금\n과정: 측정');
});
t('선생님이 고친 칸은 덮어쓰지 않음 (메모의 지문 비교)', () => {
  const v = '학생 답';
  const note = P.formNote(P.textHash(v), '10/14 09:00');
  ok(P.formCellWritable('', ''), '빈 칸');
  ok(P.formCellWritable(v, note), '설문지가 넣은 그대로');
  ok(!P.formCellWritable(v + ' (선생님이 고침)', note), '고친 칸');
  ok(!P.formCellWritable('선생님이 직접 쓴 것', ''), '메모 없는 칸');
});

console.log('\n[📄 보고서 시트]');
function reportSetup(D, n) {
  D.installCore_();
  D.onboardSaveRoster(Array.from({ length: n }, (_, i) => '3\t' + (i + 1) + '\t학생' + (i + 1)).join('\n'));
  const r = D.createQuickSheet({ kind: '보고서', name: '실험보고서', recordKey: '과세특', subjectKey: '과학' });
  const s = D.__ss.getSheetByName(r.inSheet);
  const c = name => D.colOf_(s, 3, name);
  D.__ss.setActiveSheet(s);
  return { s, c, act: D.getActivity_('실험보고서') };
}
t('보고서 · 보고서 요점 · 교사 관찰 메모 세 칸, 모드 보고서, 예시 시트 있음', () => {
  const D = boot();
  const { s, act } = reportSetup(D, 1);
  eq(act.mode, '보고서'); eq(act.columns, '보고서|보고서 요점|교사 관찰 메모');
  ok(D.__ss.getSheetByName('실험보고서 ▸예시'), '예시 시트');
  ok(s.getRange(1, 1).getValue().indexOf('📄') === 0, '머리말');
});
t('프롬프트: 보고서 입력 형식 · 원문 [보고서]는 AI 자료에서 뺌', () => {
  const D = boot();
  const { act } = reportSetup(D, 1);
  const p = D.promptFor_(act);
  ok(/학생이 수업 중에 쓴 보고서에서 뽑아 교사가 확인한/.test(p) && /연구보고서 실적/.test(p), p.slice(-900));
  const b = D.blockFor_(act, ['아주 긴 원문', '탐구 주제와 동기: 급식\n결과와 해석: 금요일', '모둠 토의를 이끔'], '');
  ok(!/아주 긴 원문/.test(b) && /보고서 요점: 탐구 주제와 동기: 급식 \/ 결과와 해석: 금요일/.test(b) && /교사 관찰 메모: 모둠 토의를 이끔/.test(b), b);
});
t('요점이 비면 PDF 를 읽어 요점부터 → 이어서 생성(한 명씩)', () => {
  const D = boot();
  const { s, c } = reportSetup(D, 2);
  D.setKey_('gemini', 'AIza');
  D.__drive.files['1PdfPdfPdfPdfPdfPdfPdfPdfPdf001'] = { name: '20301 보고서.pdf', mime: 'application/pdf', bytes: [37, 80, 68, 70] };
  s.getRange(4, c('보고서')).setValue('https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf001');
  s.getRange(5, c('보고서')).setValue('붙여 넣은 보고서 본문: 진자의 주기를 측정함');
  s.getRange(4, c('생성'), 2, 1).setValues([[true], [true]]);
  const sent = [];
  D.__fetch.handler = (url, opt) => {
    const p = JSON.parse(opt.payload); sent.push(p);
    if (/요점만 정리한다/.test(p.systemInstruction.parts[0].text)) return gem('탐구 주제와 동기: 진자\n탐구 과정과 방법: 측정');
    return gem('진자의 주기를 측정하며 변인을 통제함.');
  };
  D.generateChecked();
  const ex = sent.filter(p => /요점만 정리한다/.test(p.systemInstruction.parts[0].text));
  eq(ex.length, 2, '요점 뽑기 2번');
  const pdf = ex[0].contents[0].parts.filter(x => x.inlineData);
  eq(pdf.length, 1, 'PDF 첨부'); eq(pdf[0].inlineData.mimeType, 'application/pdf');
  eq(sent.length - ex.length, 2, '생성은 한 명씩 2번(묶지 않음)');
  ok(/탐구 주제와 동기: 진자\n/.test(s.getRange(4, c('보고서 요점')).getValue()), '요점 줄바꿈 유지');
  eq(s.getRange(5, c('AI 결과')).getValue(), '진자의 주기를 측정하며 변인을 통제함.');
  const genUser = sent.filter(p => !/요점만 정리한다/.test(p.systemInstruction.parts[0].text))[0].contents[0].parts[0].text;
  ok(!/drive\.google\.com/.test(genUser) && /보고서 요점: /.test(genUser), '생성에는 요점만: ' + genUser);
});
t('docx · hwpx 는 글자로, 구글 문서는 내보내기로, .hwp 는 안내', () => {
  const D = boot();
  const { s, c } = reportSetup(D, 1);
  D.setKey_('gemini', 'AIza');
  D.__drive.files['1DocxDocxDocxDocxDocxDocx00001'] = { name: 'a.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    entries: { 'word/document.xml': '<w:p><w:r><w:t>도르래 실험</w:t></w:r></w:p>' } };
  D.__drive.files['1HwpxHwpxHwpxHwpxHwpxHwpx00001'] = { name: 'b.hwpx', mime: 'application/octet-stream',
    entries: { 'Contents/section0.xml': '<hp:p><hp:run><hp:t>마찰 계수</hp:t></hp:run></hp:p>' } };
  D.__drive.files['1GdocGdocGdocGdocGdocGdoc00001'] = { name: '문서', mime: 'application/vnd.google-apps.document' };
  D.__drive.files['1HwpHwpHwpHwpHwpHwpHwpHwp00001'] = { name: 'c.hwp', mime: 'application/x-hwp' };
  s.getRange(4, c('보고서')).setValue(['1DocxDocxDocxDocxDocxDocx00001', '1HwpxHwpxHwpxHwpxHwpxHwpx00001', '1GdocGdocGdocGdocGdocGdoc00001', '1HwpHwpHwpHwpHwpHwpHwpHwp00001']
    .map(id => 'https://drive.google.com/open?id=' + id).join('\n'));
  let user = '', exportUrl = '';
  D.__fetch.handler = (url, opt) => {
    if (/drive\/v3\/files/.test(url)) { exportUrl = url; ok(/Bearer test-token/.test(opt.headers.Authorization), '토큰'); return { code: 200, body: '구글 문서 본문' }; }
    user = JSON.parse(opt.payload).contents[0].parts[0].text; return gem('탐구 주제와 동기: 도르래');
  };
  s.getRange(4, 1).activate();
  D.extractReportPoints();
  ok(/도르래 실험/.test(user) && /마찰 계수/.test(user) && /구글 문서 본문/.test(user), user);
  ok(/export\?mimeType=text%2Fplain/.test(exportUrl), exportUrl);
  ok(/\.hwp\) 파일은 읽지 못합니다/.test(s.getRange(4, c('검증')).getValue()), s.getRange(4, c('검증')).getValue());
});
t('키가 없으면 요점 창(학생 한 명씩, 파일 링크·첨부 안내)', () => {
  const D = boot();
  const { s, c } = reportSetup(D, 2);
  s.getRange(4, c('보고서')).setValue('https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf001');
  s.getRange(5, c('보고서')).setValue('본문');
  s.getRange(4, c('생성'), 2, 1).setValues([[true], [true]]);
  D.generateChecked();
  const tpl = D.__templates.filter(x => x.file === 'UI_Manual').pop();
  const data = JSON.parse(tpl.data.replace(/\\u003c/g, '<'));
  eq(data.kind, 'extract'); eq(data.target, '보고서 요점'); eq(data.chunks.length, 2);
  eq(data.chunks[0].links[0][0], 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf001');
  const r = D.manualApply({ kind: 'extract', sheet: data.sheet, target: data.target, check: '', limit: 0, rows: data.chunks[1].rows,
                            ids: data.chunks[1].ids, labels: data.chunks[1].labels, answer: '요점입니다:\n탐구 주제와 동기: 진자\n결과와 해석: 주기' });
  eq(r.written, 1);
  eq(s.getRange(5, c('보고서 요점')).getValue(), '탐구 주제와 동기: 진자\n결과와 해석: 주기');
  eq(s.getRange(5, c('생성')).getValue(), true, '생성 체크는 그대로');
});
t('폴더에서 가져오기: 파일 이름으로 학생 찾기 · 모르는 파일 알림', () => {
  const D = boot();
  const { s, c } = reportSetup(D, 3);
  D.__drive.files['1F1F1F1F1F1F1F1F1F1F1F1F1F1F01'] = { name: '30301_보고서.pdf', mime: 'application/pdf' };
  D.__drive.files['1F2F2F2F2F2F2F2F2F2F2F2F2F2F02'] = { name: '학생2 탐구.docx', mime: 'x' };
  D.__drive.files['1F3F3F3F3F3F3F3F3F3F3F3F3F3F03'] = { name: '제목없음.pdf', mime: 'application/pdf' };
  D.__drive.folders['1FoLdErFoLdErFoLdErFoLdEr0001'] = ['1F1F1F1F1F1F1F1F1F1F1F1F1F1F01', '1F2F2F2F2F2F2F2F2F2F2F2F2F2F02', '1F3F3F3F3F3F3F3F3F3F3F3F3F3F03'];
  const r = D.importReportFolderCore_(s, 'https://drive.google.com/drive/folders/1FoLdErFoLdErFoLdErFoLdEr0001');
  eq(r.matched, 2); eq(r.unmatched.join(), '제목없음.pdf'); eq(r.noFile, 1);
  ok(/1F1F1F/.test(s.getRange(4, c('보고서')).getValue()) && /1F2F2F/.test(s.getRange(5, c('보고서')).getValue()));
});

console.log('\n[⭐ 예시로 등록]');
t('선택한 학생의 최종본 → 예시 시트 빈칸부터, 프롬프트 예시에는 원문 보고서 없이', () => {
  const D = boot();
  const { s, c, act } = reportSetup(D, 2);
  s.getRange(4, 5, 2, 3).setValues([['원문1', '탐구 주제와 동기: 진자', '꼼꼼함'], ['원문2', '탐구 주제와 동기: 용수철', '']]);
  s.getRange(4, c('최종본')).setValue('진자의 주기를 측정하고 오차를 줄임.');
  s.getRange(5, c('AI 결과')).setValue('용수철 상수를 구함.');
  const r = D.promoteRows_(act, s, [4, 5]);
  eq(r.added, 2); eq(r.total, 2);
  const ex = D.readExamples_(D.getActivity_(act.key));
  ok(/보고서 요점: 탐구 주제와 동기: 진자/.test(ex) && /## 예시1 결과\n진자의 주기/.test(ex) && !/원문1/.test(ex), ex);
});
t('바로 쓰기 시트도 예시 시트를 새로 만들어 등록', () => {
  const D = boot(); D.installCore_();
  D.onboardSaveRoster('1\t1\t가');
  const q = D.createQuickSheet({ name: '메모', recordKey: '자율', subjectKey: '공통' });
  const s = D.__ss.getSheetByName(q.inSheet);
  s.getRange(4, 5).setValue('분리배출을 이끎');
  s.getRange(4, D.colOf_(s, 3, '최종본')).setValue('학급 분리배출 캠페인을 이끎.');
  const act = D.getActivity_('메모');
  eq(act.exSheet, '');
  const r = D.promoteRows_(act, s, [4]);
  eq(r.added, 1); eq(D.getActivity_('메모').exSheet, '메모 ▸예시');
});

console.log('\n[✒️ 내 문체]');
function styleSetup(D) {
  D.installCore_();
  const st = D.__ss.getSheetByName('✒️ 내 문체');
  st.getRange(4, 1, 2, 2).setValues([[true, pastStyle[0]], [true, pastStyle[1]]]);
  vm.runInContext('__styleSamples = null', D);
  return st;
}
t('설치하면 ✒️ 내 문체 시트와 공통규칙 STYLE_CARD 칸', () => {
  const D = boot(); D.installCore_();
  ok(D.__ss.getSheetByName('✒️ 내 문체'));
  ok(Object.prototype.hasOwnProperty.call(D.getCommon_(), 'STYLE_CARD'));
});
t('문체 예시와 카드가 프롬프트에, 카드는 학생 자료 뒤에도 한 번 더', () => {
  const D = boot();
  styleSetup(D);
  D.styleSaveCard('- 끝맺음은 ~하였음');
  D.onboardSaveRoster('1\t1\t가');
  const made = D.createActivity_({ key: '탐구', name: '탐구', recordKey: '동아리', subjectKey: '공통', columns: '주제', desc: '', examples: [] });
  const p = D.promptFor_(D.getActivity_('탐구'));
  ok(/# 문체 예시/.test(p) && /실험을 설계하였음/.test(p) && /# 내 문체 \(/.test(p), p.slice(-700));
  const s = D.__ss.getSheetByName(made.inSheet);
  s.getRange(4, 5).setValue('주제').getSheet();
  s.getRange(4, D.colOf_(s, 3, '생성')).setValue(true);
  D.setKey_('gemini', 'AIza'); D.setCfg_('한 번에 묶을 학생 수', 1);
  let user = '';
  D.__fetch.handler = (url, opt) => { user = JSON.parse(opt.payload).contents[0].parts[0].text; return gem('주제를 탐구하였음.'); };
  D.__ss.setActiveSheet(s);
  D.generateChecked();
  ok(/주제: 주제\n?[\s\S]*# 쓰기 직전 확인 — 내 문체[\s\S]*~하였음$/.test(user), user);
});
t('[내 문체 적용] FALSE 면 빠짐', () => {
  const D = boot();
  styleSetup(D);
  D.styleSaveCard('- 끝맺음은 ~하였음');
  D.setCfg_('내 문체 적용', false);
  D.onboardSaveRoster('1\t1\t가');
  D.createActivity_({ key: '탐구', name: '탐구', recordKey: '동아리', subjectKey: '공통', columns: '주제', desc: '', examples: [] });
  const p = D.promptFor_(D.getActivity_('탐구'));
  ok(!/# 문체 예시/.test(p) && !/# 내 문체/.test(p));
  eq(D.styleTail_(), '');
});
t('생성 결과의 문체가 예시와 많이 다르면 [검증]에 [확인] 문체', () => {
  const D = boot();
  styleSetup(D);
  D.onboardSaveRoster('1\t1\t가');
  const made = D.createActivity_({ key: '탐구', name: '탐구', recordKey: '동아리', subjectKey: '공통', columns: '주제', desc: '', examples: [] });
  const s = D.__ss.getSheetByName(made.inSheet);
  s.getRange(4, 5).setValue('주제'); s.getRange(4, D.colOf_(s, 3, '생성')).setValue(true);
  D.setKey_('gemini', 'AIza'); D.setCfg_('한 번에 묶을 학생 수', 1);
  D.__fetch.handler = () => gem('실험을 설계함. 변인을 통제함. 결과를 정리함.');
  D.__ss.setActiveSheet(s);
  D.generateChecked();
  ok(/\[확인\] 문체/.test(s.getRange(4, D.colOf_(s, 3, '검증')).getValue()), s.getRange(4, D.colOf_(s, 3, '검증')).getValue());
});
t('AI로 문체 카드 만들기 — 예전 세특을 보내고 카드를 돌려줌', () => {
  const D = boot();
  styleSetup(D);
  D.setKey_('gemini', 'AIza');
  let sys = '';
  D.__fetch.handler = (url, opt) => { const p = JSON.parse(opt.payload); sys = p.systemInstruction.parts[0].text; return gem('- 문장은 짧게\n- ~하였음'); };
  const r = D.styleMakeCard();
  ok(/쓰는 방식/.test(sys)); eq(r.card, '- 문장은 짧게\n- ~하였음');
});

console.log('\n[📝 구글 설문지]');
function formSetup(D, roster) {
  D.installCore_();
  if (roster) D.onboardSaveRoster('3\t15\t김하늘\n3\t7\t박서준');
  const f = D.__ss.insertSheet('설문지 응답 시트1');
  f.getRange(1, 1, 1, 6).setValues([['타임스탬프', '이메일 주소', '학번', '이름', '탐구 주제', '보고서 파일']]);
  f.getRange(2, 1, 4, 6).setValues([
    ['10/1', 'a@x', '30315', '김하늘', '진자', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf001'],
    ['10/2', 'b@x', '30307', '박서준', '용수철', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf002'],
    ['10/3', 'c@x', '30399', '전학생', '마찰', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf003'],
    ['10/4', 'a@x', '30315', '김하늘', '진자 다시', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf004']]);
  return f;
}
t('응답 시트를 찾고 학생 칸·파일 문항을 알아봄 (이메일 수집을 켜도)', () => {
  const D = boot(); formSetup(D, true);
  const c = D.formDialogContext();
  eq(c.sheets.length, 1);
  const info = c.sheets[0].info;
  eq(info.sid, 2); eq(info.name, 3);
  ok(info.questions.filter(q => q.title === '보고서 파일')[0].isFile, '파일 문항');
});
t('새 📄 보고서 시트로 연결 — 마지막 응답, 명단에 없으면 알림, 메모에 지문', () => {
  const D = boot(); formSetup(D, true);
  const r = D.formSave({ sheet: '설문지 응답 시트1', keys: { sid: 2, year: -1, cls: -1, no: -1, name: 3 },
    map: { '탐구 주제': '', '보고서 파일': '보고서' }, target: { type: 'new', kind: '보고서', name: '설문 보고서', recordKey: '과세특', subjectKey: '과학' },
    auto: true, autoGen: false, addMissing: false });
  const s = D.__ss.getSheetByName('설문 보고서 ▸입력');
  const cR = D.colOf_(s, 3, '보고서');
  const rows = s.getRange(4, 1, 2, 3).getValues();
  const rowOf = n => 4 + rows.findIndex(r => r[2] === n);
  ok(/Pdf004/.test(s.getRange(rowOf('김하늘'), cR).getValue()), '마지막 응답: ' + s.getRange(rowOf('김하늘'), cR).getValue());
  ok(/Pdf002/.test(s.getRange(rowOf('박서준'), cR).getValue()));
  eq(r.result.unmatched.length, 1); ok(/전학생/.test(r.result.unmatched[0]), r.result.unmatched[0]);
  ok(/^📝 설문지에서 가져옴/.test(s.getRange(rowOf('김하늘'), cR).getNote()), '메모');
  ok(D.__triggers.some(x => x.fn === 'onFormSubmitInstalled'), '제출 트리거');
});
t('다시 받아 와도 선생님이 고친 칸은 그대로', () => {
  const D = boot(); const f = formSetup(D, true);
  D.formSave({ sheet: '설문지 응답 시트1', keys: { sid: 2, year: -1, cls: -1, no: -1, name: 3 }, map: { '탐구 주제': '', '보고서 파일': '보고서' },
    target: { type: 'new', kind: '보고서', name: '설문 보고서', recordKey: '과세특', subjectKey: '과학' }, auto: false, autoGen: false, addMissing: false });
  const s = D.__ss.getSheetByName('설문 보고서 ▸입력');
  const cR = D.colOf_(s, 3, '보고서');
  const rows = s.getRange(4, 1, 2, 3).getValues();
  const rowOf = n => 4 + rows.findIndex(r => r[2] === n);
  s.getRange(rowOf('김하늘'), cR).setValue('선생님이 붙인 본문');
  f.getRange(6, 1, 2, 6).setValues([['10/5', 'a@x', '30315', '김하늘', '새 주제', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf006'],
                                   ['10/6', 'b@x', '30307', '박서준', '새 주제', 'https://drive.google.com/open?id=1PdfPdfPdfPdfPdfPdfPdfPdfPdf005']]);
  const txt = D.formRunNow('설문지 응답 시트1');
  ok(/고친 칸 1개는 그대로/.test(txt), txt);
  eq(s.getRange(rowOf('김하늘'), cR).getValue(), '선생님이 붙인 본문');
  ok(/Pdf005/.test(s.getRange(rowOf('박서준'), cR).getValue()), '안 고친 칸은 새 응답으로');
  eq(D.__triggers.filter(x => x.fn === 'onFormSubmitInstalled').length, 0, '저절로를 끄면 트리거 없음');
});
t('명단이 없으면 응답한 학생을 줄로 더하기 · 문항을 새 활동 입력 항목으로', () => {
  const D = boot(); formSetup(D, false);
  const r = D.formSave({ sheet: '설문지 응답 시트1', keys: { sid: 2, year: -1, cls: -1, no: -1, name: 3 }, map: { '탐구 주제': '＋', '보고서 파일': '' },
    target: { type: 'new', kind: '자동', name: '탐구활동', recordKey: '과세특', subjectKey: '과학' }, auto: false, autoGen: false, addMissing: true });
  eq(r.result.appended, 3); eq(r.result.unmatched.length, 0);
  const a = D.getActivity_('탐구활동');
  eq(a.columns, '탐구 주제');
  const s = D.__ss.getSheetByName(a.inSheet);
  eq(s.getRange(4, 3).getValue(), '김하늘'); eq(s.getRange(4, 5).getValue(), '진자 다시');
});
t('제출 트리거: 받아 오고, 바로 생성을 켰으면 그 학생만 생성', () => {
  const D = boot(); formSetup(D, true);
  D.setKey_('gemini', 'AIza');
  D.formSave({ sheet: '설문지 응답 시트1', keys: { sid: 2, year: -1, cls: -1, no: -1, name: 3 }, map: { '탐구 주제': '관찰 메모', '보고서 파일': '' },
    target: { type: 'new', kind: '바로쓰기', name: '설문 메모', recordKey: '과세특', subjectKey: '과학' }, auto: true, autoGen: true, addMissing: false });
  let n = 0;
  D.__fetch.handler = () => { n++; return gem('진자의 주기를 측정함.'); };
  const f = D.__ss.getSheetByName('설문지 응답 시트1');
  f.getRange(6, 1, 1, 6).setValues([['10/9', 'a@x', '30315', '김하늘', '진자의 길이를 바꿔 다시 잼', '']]);
  D.onFormSubmitInstalled({ range: f.getRange(6, 1, 1, 6) });
  ok(n >= 1, '생성 호출');
  const s = D.__ss.getSheetByName('설문 메모 ▸입력');
  ok(/진자/.test(s.getRange(4, D.colOf_(s, 3, 'AI 결과')).getValue() + s.getRange(5, D.colOf_(s, 3, 'AI 결과')).getValue()));
});
t('바로 생성은 이번에 답이 바뀐 학생만 (나머지 반 전체를 다시 쓰지 않음)', () => {
  const D = boot(); const f = formSetup(D, true);
  D.setKey_('gemini', 'AIza');
  D.__fetch.handler = () => gem('처음 쓴 글.');
  D.formSave({ sheet: '설문지 응답 시트1', keys: { sid: 2, year: -1, cls: -1, no: -1, name: 3 }, map: { '탐구 주제': '관찰 메모', '보고서 파일': '' },
    target: { type: 'new', kind: '바로쓰기', name: '설문 메모', recordKey: '과세특', subjectKey: '과학' }, auto: true, autoGen: true, addMissing: false });
  let users = [];
  D.__fetch.handler = (url, opt) => { users.push(JSON.parse(opt.payload).contents[0].parts[0].text); return gem('새로 쓴 글.'); };
  D.onFormSubmitInstalled({ range: f.getRange(5, 1, 1, 6) });
  eq(users.length, 0, '바뀐 답이 없으면 생성 안 함');
  f.getRange(6, 1, 1, 6).setValues([['10/9', 'b@x', '30307', '박서준', '스프링 다시', '']]);
  D.onFormSubmitInstalled({ range: f.getRange(6, 1, 1, 6) });
  eq(users.length, 1, '박서준만'); ok(/스프링 다시/.test(users[0]), users[0]);
  eq(D.formRunNow('설문지 응답 시트1').indexOf('학생 2명 반영'), 0);
});
t('구글 문서 글자 내보내기가 막히면 PDF 로 바꿔 보냄', () => {
  const D = boot();
  const { s, c } = reportSetup(D, 1);
  D.setKey_('gemini', 'AIza');
  D.__drive.files['1GdocGdocGdocGdocGdocGdoc00002'] = { name: '문서2', mime: 'application/vnd.google-apps.document' };
  s.getRange(4, c('보고서')).setValue('https://docs.google.com/document/d/1GdocGdocGdocGdocGdocGdoc00002/edit');
  let parts = null;
  D.__fetch.handler = (url, opt) => {
    if (/drive\/v3/.test(url)) return { code: 403, body: 'forbidden' };
    parts = JSON.parse(opt.payload).contents[0].parts; return gem('탐구 주제와 동기: 문서');
  };
  s.getRange(4, 1).activate();
  D.extractReportPoints();
  ok(parts && parts.some(p => p.inlineData && p.inlineData.mimeType === 'application/pdf'), JSON.stringify(parts).slice(0, 200));
  eq(s.getRange(4, c('보고서 요점')).getValue(), '탐구 주제와 동기: 문서');
});
t('메뉴 [지금 받아 오기]: 연결이 없으면 연결 창', () => {
  const D = boot(); D.installCore_();
  D.syncFormResponses();
  ok(D.__templates.length === 0, '템플릿 아님');
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
if (fail) process.exit(1);
