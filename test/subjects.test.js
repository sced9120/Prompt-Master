/* v3.8 — 📚 새 교과 만들기 · 📏 활동별 바이트 한도 (node test/subjects.test.js) */
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
  ctx.installCore_();
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((m ? m + ' — ' : '') + '기대 ' + y + ' / 실제 ' + x); };
const throws = (fn, re) => { let e = null; try { fn(); } catch (x) { e = x; } ok(e && re.test(e.message), '예외: ' + (e && e.message)); };
const gem = (text) => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: text }] } }] } });
const colOf = (s, row, name) => s.getRange(row, 1, 1, s.getLastColumn()).getValues()[0].indexOf(name) + 1;

const AI_ANSWER = [
  '```text',
  '**키**: 화학',
  '**표시명**: 화학',
  '분류: 교과',
  '역할 표현: 고등학교 화학교사',
  '핵심역량: 과학적 사고력, 과학적 탐구 능력, 과학적 문제 해결력, 과학적 의사소통 능력',
  '관찰 모습:',
  '- 물질의 변화를 입자 수준에서 설명하려고 모형을 그려 보는 모습',
  '* 실험 오차의 원인을 찾아 설계를 고치는 모습 [교육과정 확인 필요]',
  '입력 항목: 탐구 주제 | 실험 설계 | 결과 해석 | 교사 관찰 | 이름',
  '근거: 일반 지식',
  '```'
].join('\n');

const P = boot();

console.log('\n[새 교과 — 답 읽기 (순수)]');
t('AI 답 → 교과 한 줄 (코드펜스·굵게·글머리 섞여도)', () => {
  const s = P.parseSubjectAnswer(AI_ANSWER);
  eq(s.key, '화학'); eq(s.name, '화학'); eq(s.kind, '교과'); eq(s.role, '고등학교 화학교사');
  ok(/^화학과 핵심역량: 과학적 사고력, 과학적 탐구 능력, 과학적 문제 해결력, 과학적 의사소통 능력\.\n- 물질의 변화를/.test(s.comp), s.comp);
  ok(/\n- 실험 오차의 원인을 찾아 설계를 고치는 모습 \[교육과정 확인 필요\]$/.test(s.comp), s.comp);
  eq(s.columns, ['탐구 주제', '실험 설계', '결과 해석', '교사 관찰'], '시스템 이름(이름)은 뺌');
  eq(s.unsure, true); eq(s.missing, []); eq(s.basis, '일반 지식');
});
t('키는 띄어쓰기·괄호·시트에 못 쓰는 문자 없이', () => {
  eq(P.subjectKeyOf('인공지능 기초'), '인공지능기초');
  eq(P.subjectKeyOf('과학(통합과학)'), '과학');
  eq(P.subjectKeyOf("a/b:c'd"), 'abcd');
  const s = P.parseSubjectAnswer('표시명: 인공지능 기초\n핵심역량: 컴퓨팅 사고력\n관찰 모습:\n- 문제를 나누는 모습');
  eq(s.key, '인공지능기초'); eq(s.name, '인공지능 기초'); eq(s.role, '고등학교 인공지능 기초교사');
});
t('나누는 글 → 다시 읽어도 같다 (공방·다른 선생님 글)', () => {
  const sub = { key: '공통국어1', name: '공통국어1', kind: '교과', role: '고등학교 국어교사',
    comp: '국어과 핵심역량: 비판적·창의적 사고, 의사소통.\n- 근거를 들어 읽는 모습\n- 목적에 맞게 쓰는 모습', columns: ['읽은 글', '쓴 글', '교사 관찰'] };
  const text = P.formatSubjectBlock(sub);
  ok(/^키: 공통국어1\n표시명: 공통국어1\n분류: 교과\n역할 표현: 고등학교 국어교사\n역량·서술 관점:\n국어과 핵심역량/.test(text), text);
  const back = P.parseSubjectAnswer(text);
  eq([back.key, back.name, back.role, back.comp, back.columns], [sub.key, sub.name, sub.role, sub.comp, sub.columns]);
  eq(back.unsure, false);
});
t('읽을 게 없으면 무엇이 빠졌는지', () => eq(P.parseSubjectAnswer('좋은 질문입니다! 화학은 …').missing, ['키', '역량·관찰 모습']));
t('요청문 — 자료가 있으면 그 말로, 없으면 [교육과정 확인 필요]', () => {
  const u1 = P.buildSubjectUser({ name: '화학', source: '교과 역량: 과학적 사고력' });
  ok(/교과\(과목\) 이름: 화학/.test(u1) && /# 교육과정 자료 \(교사가 준 것/.test(u1) && /과학적 사고력/.test(u1), u1);
  const u2 = P.buildSubjectUser({ name: '화학' });
  ok(/\(없음 — /.test(u2) && /\[교육과정 확인 필요\]/.test(u2), u2);
  ok(P.buildSubjectUser({ name: '화학', source: '가'.repeat(40000) }).length < 31000, '긴 자료는 줄임');
  ok(/지어내지 않는다/.test(P.SUBJECT_SYSTEM) && /입력 항목: 항목1\|항목2/.test(P.SUBJECT_SYSTEM));
});

console.log('\n[새 교과 — 시트]');
t('키 없이: 요청문 복사 (드라이브 링크는 Gemini [+] 안내)', () => {
  const D = boot();
  eq(D.subjectContext().model, '');
  const r = D.subjectRequest({ name: '화학', link: 'https://drive.google.com/file/d/1PdfPdfPdfPdfPdfPdfPdfPdfPdf001/view' });
  ok(r.indexOf(D.SUBJECT_SYSTEM) === 0 && /교과\(과목\) 이름: 화학/.test(r) && /Gemini \[\+\]/.test(r), r.slice(-300));
  throws(() => D.subjectRequest({ name: ' ' }), /이름을 적어/);
  throws(() => D.subjectDraft({ name: '화학' }), /API 키가 없습니다/);
});
t('API: 교육과정 PDF 를 첨부해 초안 → 읽어서 돌려줌(저장은 안 함)', () => {
  const D = boot();
  D.setKey_('gemini', 'AIza');
  D.__drive.files['1PdfPdfPdfPdfPdfPdfPdfPdfPdf001'] = { name: '화학 교육과정.pdf', mime: 'application/pdf', bytes: [37, 80, 68, 70] };
  let sent = null;
  D.__fetch.handler = (url, opt) => { sent = JSON.parse(opt.payload); return gem(AI_ANSWER); };
  const r = D.subjectDraft({ name: '화학', source: '교과 역량: 과학적 사고력', link: 'https://drive.google.com/file/d/1PdfPdfPdfPdfPdfPdfPdfPdfPdf001/view' });
  eq(r.sub.key, '화학'); eq(r.exists, false);
  ok(/교육과정 전문가/.test(sent.systemInstruction.parts[0].text));
  const parts = sent.contents[0].parts;
  ok(/교과 역량: 과학적 사고력/.test(parts[0].text) && /화학 교육과정\.pdf/.test(parts[0].text), parts[0].text);
  eq(parts.filter(p => p.inlineData && p.inlineData.mimeType === 'application/pdf').length, 1, 'PDF 첨부');
  ok(!D.getSubjects_().some(s => s.key === '화학'), '초안 단계에서 저장하면 안 됨');
});
t('붙여 넣은 답 읽기 — 이미 있는 키면 알려 줌', () => {
  const D = boot();
  eq(D.subjectParse(AI_ANSWER).exists, false);
  eq(D.subjectParse('키: 수학\n관찰 모습:\n- 추론하는 모습').exists, true);
  throws(() => D.subjectParse('안녕하세요'), /읽지 못한 것: 키/);
});
t('저장 — [교육과정 확인 필요]는 확인해야 저장, 저장하면 표시는 지움', () => {
  const D = boot();
  const sub = D.parseSubjectAnswer(AI_ANSWER);
  throws(() => D.subjectSave(sub, {}), /교육과정 확인 필요/);
  const r = D.subjectSave(sub, { confirmed: true });
  eq(r.key, '화학');
  const got = D.getSubjects_().filter(s => s.key === '화학')[0];
  ok(got && got.kind === '교과' && got.role === '고등학교 화학교사', JSON.stringify(got));
  ok(!/교육과정 확인 필요/.test(got.comp) && /설계를 고치는 모습$/.test(got.comp), got.comp);
});
t('같은 키는 덮어쓰기를 체크해야, 줄이 늘지 않게', () => {
  const D = boot();
  const n = D.getSubjects_().length;
  const sub = { key: '수학', name: '수학', role: '고등학교 수학교사', comp: '수학과 핵심역량: 추론.\n- 새로 쓴 모습' };
  throws(() => D.subjectSave(sub, {}), /이미 "수학"/);
  D.subjectSave(sub, { overwrite: true });
  eq(D.getSubjects_().length, n);
  eq(D.getSubjects_().filter(s => s.key === '수학')[0].comp, sub.comp);
});
t('기본 교과로 정하기 · 그 입력 항목으로 활동 시트까지', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  const sub = D.parseSubjectAnswer(AI_ANSWER);
  const r = D.subjectSave(sub, { confirmed: true, makeDefault: true, activity: { name: '화학 실험', recordKey: '과세특' } });
  eq(D.cfg_('기본 교과영역', ''), '화학');
  ok(r.inSheet && D.__ss.getSheetByName(r.inSheet), '입력 시트: ' + r.inSheet);
  const act = D.getActivity_('화학 실험');
  eq([act.subjectKey, act.recordKey, act.columns], ['화학', '과세특', '탐구 주제|실험 설계|결과 해석|교사 관찰']);
  const p = D.promptFor_(act);
  ok(/화학 교과를/.test(p) && /화학과 핵심역량: 과학적 사고력/.test(p) && /탐구 주제\|실험 설계/.test(p), p.slice(0, 400));
});

console.log('\n[활동별 바이트 한도]');
t('새 활동은 [바이트 한도] 칸에 바이트로 (비우면 한 칸 전체)', () => {
  const D = boot();
  D.createActivity_({ key: '탐구', name: '수학 탐구', recordKey: '과세특', subjectKey: '수학', columns: '주제|과정' });
  D.createActivity_({ key: '발표', name: '수학 발표', recordKey: '과세특', subjectKey: '수학', bytes: 450, columns: '주제|과정' });
  const s = D.__ss.getSheetByName('🗂 활동목록');
  eq(s.getRange(2, 5).getValue(), '바이트 한도');
  eq([D.getActivity_('탐구').bytes, D.getActivity_('발표').bytes], [1500, 450]);
  eq([D.bytesFor_(D.getActivity_('탐구')), D.charsFor_(D.getActivity_('발표'))], [1500, 150]);
  const title = D.__ss.getSheetByName('발표 ▸입력').getRange(1, 1).getValue();
  ok(/수학 발표\n과목별 세부능력 및 특기사항 · 450바이트\(전체 1500 중\)/.test(title), title);
  ok(/500자\(1500바이트\)/.test(D.__ss.getSheetByName('탐구 ▸입력').getRange(1, 1).getValue()));
});
t('예전 시트의 [글자수]도 읽고, 새 활동을 적기 전에 [바이트 한도](×3)로 옮김', () => {
  const D = boot();
  D.createActivity_({ key: '옛활동', name: '옛 활동', recordKey: '동아리', subjectKey: '공통', columns: '주제' });
  const s = D.__ss.getSheetByName('🗂 활동목록');
  s.getRange(2, 5).setValue('글자수'); s.getRange(3, 5).setValue(400);           // v3.7 이전 시트처럼
  eq(D.getActivity_('옛활동').bytes, 1200, '옮기기 전에도 글자수×3 으로 읽음');
  D.createActivity_({ key: '새활동', name: '새 활동', recordKey: '동아리', subjectKey: '공통', bytes: 300, columns: '주제' });
  eq(s.getRange(2, 5).getValue(), '바이트 한도');
  eq([s.getRange(3, 5).getValue(), s.getRange(4, 5).getValue()], [1200, 300]);
  eq(D.migrateActivityBytes_(), false, '두 번 옮기지 않음');
  ok(/바이트 한도/.test(String(s.getRange(1, 1).getValue())), '머리말도 새 설명으로');
});
t('구조 복구(처음 설치)를 눌러도 옮김', () => {
  const D = boot();
  D.createActivity_({ key: '가', name: '가', recordKey: '행발', subjectKey: '공통', columns: '관찰' });
  const s = D.__ss.getSheetByName('🗂 활동목록');
  s.getRange(2, 5).setValue('글자수'); s.getRange(3, 5).setValue(300);
  D.installCore_();
  eq([s.getRange(2, 5).getValue(), s.getRange(3, 5).getValue()], ['바이트 한도', 900]);
});
t('나누기 창 — 과세특은 교과마다, 창체는 기록 항목마다 묶음', () => {
  const D = boot();
  D.createActivity_({ key: 'm1', name: '수학 탐구', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  D.createActivity_({ key: 'm2', name: '수학 발표', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  D.createActivity_({ key: 's1', name: '과학 실험', recordKey: '과세특', subjectKey: '과학', columns: '주제' });
  D.createActivity_({ key: 'c1', name: '동아리 탐구', recordKey: '동아리', subjectKey: '공통', columns: '주제' });
  const g = D.bytesContext();
  eq(g.map(x => x.id + ':' + x.acts.length), ['과세특·수학:2', '과세특·과학:1', '동아리:1']);
  eq([g[0].cap, g[0].chars, g[0].acts[1].bytes], [1500, 500, 1500]);
  ok(/수학$/.test(g[0].title), g[0].title);
});
t('저장 — 0·빈칸·너무 크면 한 칸 전체, 너무 작으면 거절, 입력 시트 제목도 바뀜', () => {
  const D = boot();
  D.createActivity_({ key: 'm1', name: '수학 탐구', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  D.createActivity_({ key: 'm2', name: '수학 발표', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  ok(/2개 활동/.test(D.bytesSave([{ key: 'm1', bytes: 1050 }, { key: 'm2', bytes: 450 }])));
  eq([D.getActivity_('m1').bytes, D.getActivity_('m2').bytes], [1050, 450]);
  ok(/450바이트\(전체 1500 중\)/.test(D.__ss.getSheetByName('m2 ▸입력').getRange(1, 1).getValue()));
  D.bytesSave([{ key: 'm1', bytes: 0 }, { key: 'm2', bytes: 99999 }]);
  eq([D.getActivity_('m1').bytes, D.getActivity_('m2').bytes], [1500, 1500]);
  ok(/500자\(1500바이트\)/.test(D.__ss.getSheetByName('m2 ▸입력').getRange(1, 1).getValue()));
  throws(() => D.bytesSave([{ key: 'm1', bytes: 30 }]), /60바이트/);
  eq(D.bytesSave([{ key: 'm1', bytes: 1500 }]), '바뀐 것이 없습니다.');
});
t('기록 항목 글자수가 줄면 활동 한도도 그 한 칸까지만', () => {
  const D = boot();
  D.createActivity_({ key: 'j', name: '진로 탐색', recordKey: '진로', subjectKey: '공통', bytes: 2100, columns: '주제' });
  eq(D.bytesFor_(D.getActivity_('j')), 1500);
});
t('생성 — 그 활동의 몫으로 프롬프트, 검증도 그 한도로', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  D.createActivity_({ key: '발표', name: '수학 발표', recordKey: '과세특', subjectKey: '수학', bytes: 450, columns: '주제|과정' });
  D.setKey_('gemini', 'AIza');
  const s = D.__ss.getSheetByName('발표 ▸입력');
  s.getRange(4, colOf(s, 3, '주제')).setValue('함수의 극한');
  s.getRange(4, colOf(s, 3, '생성')).setValue(true);
  D.__ss.setActiveSheet(s);
  const systems = [];
  D.__fetch.handler = (url, opt) => { systems.push(JSON.parse(opt.payload).systemInstruction.parts[0].text); return gem('극한의 뜻을 그래프로 설명함. '.repeat(12).trim()); };
  D.generateChecked();
  ok(/450바이트\(한글 약 150자\) 이내/.test(systems[0]) && /한 칸\(1500바이트\) 가운데 한 부분/.test(systems[0]), systems[0].match(/# 분량[\s\S]*?\n\n/));
  const v = String(s.getRange(4, colOf(s, 3, '검증')).getValue());
  ok(/분량 초과/.test(v) && /\/ 450바이트/.test(v), v);
});
t('🔍 검사 — 한도를 나눈 활동을 고를 수 있고, 그 활동 시트에서 가져오면 그 한도', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  D.createActivity_({ key: '탐구', name: '수학 탐구', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  D.createActivity_({ key: '발표', name: '수학 발표', recordKey: '과세특', subjectKey: '수학', bytes: 450, columns: '주제' });
  const c = D.checkContext();
  eq(c.activities.map(a => a.key + ':' + a.bytes), ['발표:450'], '한 칸 전체를 쓰는 활동은 기록 항목으로 충분');
  const r = D.checkTextNow({ text: '가'.repeat(200) + '함.', bytes: 450 });
  eq([r.limit, r.chars], [450, 150]);
  ok(r.issues.some(i => i.label === '분량 초과'), JSON.stringify(r.issues));
  eq(D.checkTextNow({ text: '탐구함.', chars: 300 }).limit, 900, '예전처럼 chars 만 줘도');
  const s = D.__ss.getSheetByName('발표 ▸입력');
  s.getRange(4, 5).activate();
  const cell = D.readActiveCell();
  eq([cell.recordKey, cell.activityKey], ['과세특', '발표']);
});

console.log('\n[🧪 공방 — 시트 안에서]');
t('예시 글 "항목: 값" → 입력 항목 순서 (안 맞으면 첫 칸에 통째로)', () => {
  eq(P.exampleValuesFrom(['주제', '과정', '배운 점'], '과정: 표를 그림\n주제: 함수\n기타: 무시\n과정: 그래프로 확인'), ['함수', '표를 그림 그래프로 확인', '']);
  eq(P.exampleValuesFrom(['관찰 메모'], '수업 중 질문이 많음'), ['수업 중 질문이 많음']);
  eq(P.exampleValuesFrom(['주제'], ''), ['']);
});
t('공방 페이지가 시트에 들어 있고(UI_Studio), 웹 페이지와 같은 내용', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Studio.html'), 'utf8');
  const web = fs.readFileSync(path.join(__dirname, '..', 'web', 'prompt-studio.html'), 'utf8');
  ok(/^<meta charset="utf-8">/.test(ui), 'meta charset');
  ok(ui.endsWith(web), '웹 페이지 그대로여야 함(빌드를 다시 돌리세요)');
  ok(/var ENGINE = \(function/.test(ui) && /studioContext\(\)/.test(ui) && /studioCreateActivity\(/.test(ui), '엔진·시트 호출');
  ok(/\[hidden\]\{display:none!important\}/.test(ui), '[hidden] 규칙');
});
t('공방 창 — 이 시트의 기록종류 · 교과영역(새로 저장한 교과 포함) · 공통규칙 · 기재요령', () => {
  const D = boot();
  D.openStudio();
  D.subjectSave(D.parseSubjectAnswer(AI_ANSWER), { confirmed: true });
  const c = JSON.parse(JSON.stringify(D.studioContext()));
  ok(c.subjects.some(x => x.key === '화학'), '화학');
  ok(c.records.length === 6 && c.records.filter(r => r.key === '동아리')[0].rules.length > 0, '기록종류·기재 주의');
  ok(/명사형 어미/.test(c.common.WRITING_RULES) && c.common.NEIS_RULES, '공통규칙');
  ok(c.rules.length >= 50 && c.rules.every(r => r.re && r.label), '기재요령 규칙: ' + c.rules.length);
  eq(c.version, D.APP.VERSION);
});
t('공방에서 [이 설계로 활동 시트 만들기] — 바이트 한도·예시 1편까지', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘\n1\t2\t박서준');
  const r = D.studioCreateActivity({ name: '수학 발표', recordKey: '과세특', subjectKey: '수학', bytes: 450, columns: ['주제', '과정'],
    desc: '함수 발표', exIn: '주제: 함수의 극한\n과정: 그래프로 설명', exOut: '극한의 뜻을 그래프로 설명함.' });
  ok(/수학 발표 ▸입력/.test(r.message) && /예시 1편/.test(r.message), r.message);
  const act = D.getActivity_('수학 발표');
  eq([act.bytes, act.columns, act.desc], [450, '주제|과정', '함수 발표']);
  const ex = D.readExampleRows_(act);
  eq([ex.length, ex[0].values.join('/'), ex[0].result], [1, '함수의 극한/그래프로 설명', '극한의 뜻을 그래프로 설명함.']);
  eq(D.__ss.getSheetByName(r.inSheet).getLastRow(), 5, '명단 2명');
  ok(D.studioOpenSheet(r.inSheet));
  throws(() => D.studioCreateActivity({ name: '수학 발표', recordKey: '과세특', subjectKey: '수학', columns: ['주제'] }), /같은 활동/);
  throws(() => D.studioCreateActivity({ name: ' ', columns: ['주제'] }), /활동 이름/);
  throws(() => D.studioCreateActivity({ name: '빈 항목', columns: [] }), /1개 이상/);
});

console.log('\n[🪄 예시로 칸 채우기]');
const DESIGN_ANSWER = [
  '```',
  '**활동 이름**: 함수 탐구 발표',
  '활동 개요: 실생활 자료로 함수 모델을 세우고 발표하는 활동. 자료를 다루는 과정과 스스로 고친 점이 드러나야 함.',
  '입력 항목: 탐구 주제 | 자료와 방법 | 알게 된 점 | 이름',
  '[예시1]',
  '탐구 주제: 기온과 전력 수요',
  '- 자료와 방법: 공개 자료를 시간 단위로 합쳐 산점도',
  '알게 된 점: 28도 넘으면 증가폭이 커짐',
  '## 예시 2',
  '탐구 주제: 버스 배차와 대기 시간',
  '자료와 방법: 정류장 도착 기록으로 평균 대기 시간 계산',
  '```'
].join('\n');
t('답 읽기 — 굵게·코드펜스·[예시1]/## 예시 2 모두, 예시는 입력 항목 순서의 "항목: 값"으로', () => {
  const d = P.parseDesignAnswer(DESIGN_ANSWER, 2);
  eq([d.name, d.columns], ['함수 탐구 발표', ['탐구 주제', '자료와 방법', '알게 된 점']], '시스템 이름(이름)은 뺌');
  ok(/^실생활 자료로/.test(d.desc), d.desc);
  eq(d.examples, ['탐구 주제: 기온과 전력 수요\n자료와 방법: 공개 자료를 시간 단위로 합쳐 산점도\n알게 된 점: 28도 넘으면 증가폭이 커짐',
                  '탐구 주제: 버스 배차와 대기 시간\n자료와 방법: 정류장 도착 기록으로 평균 대기 시간 계산']);
  eq(d.missing, []);
});
t('모자라면 무엇이 빠졌는지', () => {
  const d = P.parseDesignAnswer('활동 개요: 무엇\n입력 항목: 주제|과정\n[예시1]\n주제: 함수', 2);
  eq(d.missing, ['예시2 학생 자료']);
  eq(P.parseDesignAnswer('좋은 예시네요!', 1).missing, ['입력 항목', '활동 개요', '예시1 학생 자료']);
});
t('요청문 — 결과 예시와 교사가 적은 자료·항목을 함께, 예시 수를 못박음', () => {
  const u = P.buildDesignUser({ record: { name: '과목별 세부능력 및 특기사항' }, subject: { key: '수학', name: '수학', kind: '교과' }, bytes: 750,
    name: '함수 발표', columns: ['주제', '과정'], examples: [{ in: '', out: '결과 하나.' }, { in: '주제: 함수', out: '결과 둘.' }, { out: ' ' }] });
  ok(/750바이트 이내/.test(u) && /교과: 수학/.test(u) && /교사가 정한 입력 항목\(되도록 그대로\): 주제\|과정/.test(u), u);
  ok(/# 예시1\n## 이렇게 나오면 좋겠다는 결과\n결과 하나\./.test(u) && /# 예시2\n## 교사가 적어 둔 학생 자료[^\n]*\n주제: 함수/.test(u), u);
  ok(/예시는 2편이다/.test(u) && !/# 예시3/.test(u), '빈 결과는 빼고 셈');
  ok(/지어내지 않는다/.test(P.DESIGN_SYSTEM) && /\[예시1\]/.test(P.DESIGN_SYSTEM));
});
t('바이트 한도 제안 — 가장 긴 예시 ÷ 0.9, 10 단위 올림, 한 칸·150 사이', () => {
  eq(P.suggestBytes(['가'.repeat(200), '가'.repeat(100)], 1500), 670);   // 600 / 0.9 = 666.7 → 670
  eq(P.suggestBytes(['가'.repeat(480)], 1500), 1500, '한 칸을 넘지 않음');
  eq(P.suggestBytes(['짧음.'], 1500), 150, '너무 짧으면 150');
  eq(P.suggestBytes(['', '  '], 1500), 0);
});
t('시트 안 [AI로 채우기] — 키가 있으면 바로, 이 시트의 기록 항목·교과로', () => {
  const D = boot();
  throws(() => D.studioDesign({ examples: [{ out: '결과.' }] }), /API 키가 없습니다/);
  D.setKey_('gemini', 'AIza');
  ok(D.studioContext().model, '공방이 [AI로 채우기]를 보여 줄 수 있게 모델을 알려 줌');
  throws(() => D.studioDesign({ examples: [{ out: ' ' }] }), /한 편 이상/);
  let sent = null;
  D.__fetch.handler = (url, opt) => { sent = JSON.parse(opt.payload); return gem(DESIGN_ANSWER); };
  const r = D.studioDesign({ recordKey: '과세특', subjectKey: '수학', bytes: 750, columns: [], examples: [{ out: '기온과 전력 수요의 관계를 탐구함.' }, { out: '버스 대기 시간을 계산함.' }] });
  eq(r.design.columns.length, 3); eq(r.design.examples.length, 2);
  ok(/프롬프트를 설계하는 조수/.test(sent.systemInstruction.parts[0].text));
  ok(/과목별 세부능력 및 특기사항 \(이 활동은 750바이트 이내\)/.test(sent.contents[0].parts[0].text) && /교과: 수학/.test(sent.contents[0].parts[0].text));
});
t('공방에서 예시 여러 편 → 예시 시트에 모두 (예전 한 편 방식도)', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  const r = D.studioCreateActivity({ name: '함수 발표', recordKey: '과세특', subjectKey: '수학', columns: ['탐구 주제', '알게 된 점'],
    examples: [{ in: '탐구 주제: 전력\n알게 된 점: 비선형', out: '전력 수요를 탐구함.' }, { in: '', out: '버스 대기 시간을 계산함.' }, { in: '탐구 주제: 빈 결과', out: '' }] });
  ok(/예시 2편/.test(r.message), r.message);
  const ex = D.readExampleRows_(D.getActivity_('함수 발표'));
  eq(ex.map(e => e.values.join('/') + '=' + e.result), ['전력/비선형=전력 수요를 탐구함.', '/=버스 대기 시간을 계산함.']);
  const r2 = D.studioCreateActivity({ name: '옛 방식', recordKey: '과세특', subjectKey: '수학', columns: ['주제'], exIn: '주제: 함수', exOut: '함수를 탐구함.' });
  ok(/예시 1편/.test(r2.message), r2.message);
});

console.log('\n' + (fail ? '실패 ' + fail + '개 / ' : '') + '통과 ' + pass + '개');
if (fail) process.exit(1);
