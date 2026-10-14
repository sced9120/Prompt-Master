/* v3.6 — 2026 기재요령 규칙판 · 맞춤법 · 자동 고쳐쓰기 · 키 없이 쓰기 · 바로 쓰기 · 시작하기 버튼
   (node test/rules.test.js) — 순수 함수는 그대로, 시트 흐름은 sheets-mock 위에서 돌린다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();

function boot(opts) {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  if (!(opts && opts.remote)) g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ' — ' : '') + '기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a)); };
const gemOk = (text) => ({ code: 200, body: { candidates: [{ content: { parts: [{ text: text || '확인' }] } }] } });

const P = boot();
const V = (s, lim) => P.inspect_(s, lim || 1500);
const labels = v => v.issues.map(i => (i.level === 'block' ? '수정:' : '확인:') + i.label);

console.log('\n[2026 규칙판]');
t('모든 규칙의 정규식이 유효', () => { P.RULES_2026.rules.forEach(r => new RegExp(r.re)); });
t('규칙판 번호·학년도·AI 원칙', () => {
  eq(P.RULES_2026.id, '2026.1'); eq(P.RULES_2026.year, 2026);
  ok(/그대로 입력하는 것은 금지/.test(P.AI_NOTICE_2026), P.AI_NOTICE_2026);
});
t('2026 글자수: 진로 500 · 행발 300', () => { eq(P.RULES_2026.chars['진로'], 500); eq(P.RULES_2026.chars['행발'], 300); });
t('rules/latest.json 이 코드의 규칙판과 같음(빌드가 만든 파일)', () => {
  const f = path.join(__dirname, '..', 'rules', 'latest.json');
  ok(fs.existsSync(f), 'rules/latest.json 없음 — npm run build');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  eq(j.id, P.RULES_2026.id); eq(j.rules.length, P.RULES_2026.rules.length);
  eq(j.neisRules, P.RULES_2026.neisRules);
  ok(P.validatePack(j).ok, P.validatePack(j).errors.join(','));
});
t('validatePack: 깨진 정규식은 빼고, id 없으면 거절', () => {
  const v = P.validatePack({ id: '2027.1', rules: [{ re: '(', label: 'x' }, { re: '토익', label: '어학', level: 'block' }] });
  ok(v.ok); eq(v.pack.rules.length, 1); ok(v.errors.length === 1, v.errors.join());
  ok(!P.validatePack({ rules: [{ re: 'a' }] }).ok, 'id 없이 통과');
  ok(!P.validatePack('{not json').ok);
});
t('packNewer', () => { ok(P.packNewer('2027.1', '2026.3')); ok(P.packNewer('2026.2', '2026.1')); ok(!P.packNewer('2026.1', '2026.1')); });

console.log('\n[2026 금지어]');
t('K-MOOC·방과후학교는 [수정]', () => {
  ok(labels(V('K-MOOC 강좌를 수강하며 개념을 넓힘.')).indexOf('수정:온라인 공개강좌') >= 0, labels(V('K-MOOC 강좌를 수강함.')));
  ok(labels(V('방과후학교 수업에서 심화 문제를 풂.')).indexOf('수정:방과후학교') >= 0);
});
t('교외상(표창장)은 [수정]', () => ok(labels(V('구청장 표창장을 받음.')).indexOf('수정:교외상') >= 0));
t('청소년단체·학교스포츠클럽·자율동아리는 [확인]', () => {
  const l = labels(V('스카우트 활동과 스포츠클럽, 자율동아리에서 활약함.'));
  ['확인:청소년단체', '확인:학교스포츠클럽', '확인:자율동아리'].forEach(x => ok(l.indexOf(x) >= 0, l.join()));
});
t('"세계유산 등재"는 더 이상 [수정]이 아님(예전 판의 오탐)', () => {
  const v = V('유네스코 세계유산 등재 과정을 조사하고 의미를 정리함.');
  ok(v.ok, labels(v).join());
});
t('근거·바른 표기가 결과에 실림', () => {
  const v = V('토익 900점을 받음.');
  const x = v.issues.filter(i => i.label === '공인어학시험')[0];
  ok(x && /p\.118/.test(x.why), JSON.stringify(x));
  const y = V('맡은 역활을 다함.').issues.filter(i => i.label === '맞춤법')[0];
  eq(y && y.fix, '역할');
  ok(/바르게: 역할/.test(P.formatIssues(V('맡은 역활을 다함.'))), P.formatIssues(V('맡은 역활을 다함.')));
});

console.log('\n[맞춤법 · 띄어쓰기]');
const sp = s => P.spellIssues(s).map(i => i.hit + '→' + i.fix);
t('할수 있음 → 할 수', () => ok(sp('문제를 해결할수 있음.').some(x => /할수→할 수/.test(x)), sp('문제를 해결할수 있음.')));
t('할수록은 그대로', () => eq(sp('탐구할수록 흥미가 커짐.').length, 0, sp('탐구할수록 흥미가 커짐.').join()));
t('있슴·했슴 → 있음·했음', () => ok(sp('관심이 있슴.').some(x => /있슴→있음/.test(x))));
t('한것·할것 → 한 것', () => ok(sp('조사한것을 발표함.').some(x => /한것→한 것/.test(x))));
t('날것·별것은 그대로', () => eq(sp('날것의 자료와 별것 아닌 차이를 비교함.').length, 0));
t('해서는 안된다 → 안 된다 / 편안한·제안하고는 그대로', () => {
  ok(sp('포기해서는 안된다는 것을 깨달음.').some(x => /안된→안 된/.test(x)), sp('포기해서는 안된다는 것을 깨달음.'));
  eq(sp('편안한 분위기에서 해결책을 제안하고 고안함.').length, 0, sp('편안한 분위기에서 해결책을 제안하고 고안함.').join());
});
t('않하고 → 안 하고', () => ok(sp('포기를 않하고 끝까지 함.').some(x => /않하→안 하/.test(x))));
t('마침표 뒤 붙여 쓰기 · 숫자 소수점은 그대로', () => {
  ok(sp('정리함.또한 발표함.').length === 1, sp('정리함.또한 발표함.'));
  eq(sp('평균 3.5를 구함.').length, 0);
});
t('같은 낱말 잇따라', () => ok(sp('자료를 자료 자료 분석함.').some(x => /자료 자료/.test(x))));

console.log('\n[고쳐쓰기 · 근거 확인 · AI 맞춤법 (순수)]');
t('고쳐쓰기 요청문에 걸린 점·한도·자료가 들어감', () => {
  const v = V('학생은 교내 대회에서 최우수상을 수상함.', 30);
  ok(P.needsRepair(v));
  const u = P.buildRepairUser('주제: 함수', '학생은 교내 대회에서 최우수상을 수상함.', v.issues.filter(i => i.level === 'block'), 30);
  ok(/# 학생 자료\n주제: 함수/.test(u) && /분량 초과/.test(u) && /수상·등수/.test(u) && /30바이트 이내/.test(u), u);
});
t('betterResult: [수정]이 적은 쪽', () => {
  eq(P.betterResult(V('학생은 수상함.'), V('탐구 과정을 정리함.')), 'b');
  eq(P.betterResult(V('탐구 과정을 정리함.'), V('학생은 수상함.')), 'a');
});
t('근거 확인 응답 해석(코드 울타리·빈 목록)', () => {
  const r = P.parseGroundResult('```json\n{"unsupported":[{"quote":"3회 발표","why":"자료에 횟수 없음"}]}\n```');
  eq(r.length, 1); eq(r[0].quote, '3회 발표');
  eq(P.parseGroundResult('{"unsupported":[]}').length, 0);
});
t('AI 맞춤법: 글에 없는 구절은 버리고, 앞에서부터 고침', () => {
  const src = '역활을 다하고 꾸준이 노력함.';
  const ch = P.parseSpellResult('{"changes":[{"from":"역활","to":"역할"},{"from":"없는말","to":"x"},{"from":"꾸준이","to":"꾸준히"}]}', src);
  eq(ch.length, 2);
  eq(P.applyChanges(src, ch), '역할을 다하고 꾸준히 노력함.');
});

console.log('\n[키 없이 — 요청문 · 답 나누기]');
t('한 명: 학생 자료 + 출력 지시', () => {
  const u = P.buildManualUser([{ id: 'S1', block: '메모: 발표함' }]);
  ok(/# 학생 자료\n메모: 발표함/.test(u) && !/\[S1\]/.test(u), u);
});
t('여러 명: [S1] 형식 안내', () => {
  const u = P.buildManualUser([{ id: 'S1', block: 'a' }, { id: 'S2', block: 'b' }]);
  ok(/## S1\na/.test(u) && /\[S2\]\n\(본문\)/.test(u), u);
});
t('답 나누기: [S1] · **S2** · S3: · ## S4', () => {
  const r = P.parseManualAnswer('[S1]\n첫째 본문.\n\n**S2**\n둘째 본문.\nS3: 셋째 본문.\n## S4\n넷째 본문.', ['S1', 'S2', 'S3', 'S4']);
  eq(r.map.S1, '첫째 본문.'); eq(r.map.S2, '둘째 본문.'); eq(r.map.S3, '셋째 본문.'); eq(r.map.S4, '넷째 본문.'); eq(r.missing.length, 0);
});
t('답 나누기: JSON 으로 와도 읽음 · 빠진 학생 알림', () => {
  const r = P.parseManualAnswer('{"results":[{"id":"S1","text":"가."}]}', ['S1', 'S2']);
  eq(r.map.S1, '가.'); eq(r.missing.join(), 'S2');
});
t('한 명이면 표시가 없어도 통째로', () => eq(P.parseManualAnswer('그냥 본문만 옴.', ['S1']).map.S1, '그냥 본문만 옴.'));

console.log('\n[프롬프트]');
t('기록 항목별 기재 주의가 그 항목 프롬프트에만', () => {
  const recs = P.PRESET_RECORD_TYPES.map(r => Object.assign({}, r, { rules: P.RECORD_RULES_2026[r.key] }));
  const sub = P.PRESET_SUBJECTS[0];
  const com = {}; P.PRESET_COMMON.forEach(c => { com[c.key] = c.body; });
  const p1 = P.buildPrompt({ activity: { name: 'x', columns: 'a' }, record: recs.filter(r => r.key === '동아리')[0], subject: sub, common: com });
  ok(/# 이 기록 항목의 기재 주의/.test(p1) && /학교스포츠클럽/.test(p1), '동아리 주의 없음');
  ok(!/K-MOOC·MOOC·KOCW, 연구보고서/.test(p1.split('# 이 기록 항목의 기재 주의')[1]), '과세특 주의가 섞임');
  ok(/2026학년도 학교생활기록부 기재요령 기준/.test(p1), '2026 금지사항 문구 아님');
});
t('바로쓰기 모드는 자유 메모 형식', () => {
  const com = {}; P.PRESET_COMMON.forEach(c => { com[c.key] = c.body; });
  const p = P.buildPrompt({ activity: { name: 'q', columns: '관찰 메모', mode: '바로쓰기' }, record: P.PRESET_RECORD_TYPES[0], subject: P.PRESET_SUBJECTS[1], common: com });
  ok(/자유롭게 적은 메모/.test(p) && !/\| 로 구분/.test(p), p.slice(-600));
});

console.log('\n[설치 · 옛 사본 올리기]');
const A = boot();
A.installCore_();
t('📏 기재요령 시트가 생기고 규칙이 채워짐', () => {
  const s = A.__ss.getSheetByName('📏 기재요령');
  ok(s, '시트 없음');
  eq(A.readRuleRows_(s).length, A.RULES_2026.rules.length);
  eq(A.rulesAll_().length, A.RULES_2026.rules.length);
});
t('기록종류에 [기재 주의] 칸이 채워짐', () => {
  const r = A.getRecordTypes_().filter(x => x.key === '행발')[0];
  ok(/방과후학교/.test(r.rules), r.rules);
});
t('시트에서 규칙을 끄면 검사에서 빠짐', () => {
  const s = A.__ss.getSheetByName('📏 기재요령');
  const rows = A.readRuleRows_(s);
  const i = rows.findIndex(r => r[2] === '공인어학시험');
  s.getRange(4 + i, 1).setValue(false);
  A.__rulesCache = null;
  vm.runInContext('__rulesCache = null', A);
  ok(A.inspect_('토익 공부를 함.', 1500).ok, '꺼도 걸림');
  s.getRange(4 + i, 1).setValue(true);
  vm.runInContext('__rulesCache = null', A);
});
t('v3.5 이전 사본: 예전 NEIS 문구 → 2026 문구, 기재 주의 칸 새로 만듦', () => {
  const B = boot();
  B.buildConfig(); B.buildSubjects();
  // 예전 판처럼 공통규칙·기록종류를 만든다
  const c = B.__ss.insertSheet('📐 공통규칙');
  c.getRange(2, 1, 1, 3).setValues([['키', '제목', '내용']]);
  c.getRange(3, 1, 1, 3).setValues([['NEIS_RULES', '학생부 기재 금지사항', B.OLD_NEIS_RULES[0]]]);
  const r = B.__ss.insertSheet('🧩 기록종류');
  r.getRange(2, 1, 1, 8).setValues([['키', '기록 항목명', '글자수', '성취수준 사용', '역할', '목표', '서술 관점', '비고']]);
  r.getRange(3, 1, 2, 8).setValues([['진로', '진로활동 특기사항', 700, false, '', '', '', ''], ['행발', '행동특성 및 종합의견', 280, false, '', '', '', '']]);
  const rep = B.migrateRules_();
  eq(rep.neis, 'updated');
  ok(/2026학년도/.test(B.getCommon_().NEIS_RULES));
  ok(B.colOf_(r, 2, '기재 주의') === 9, '기재 주의 칸 위치');
  ok(/500자/.test(B.getRecordTypes_()[0].rules));
  ok(rep.chars.updated.some(x => /진로 700→500/.test(x)), JSON.stringify(rep.chars));
  ok(rep.chars.kept.some(x => /행발 280/.test(x)), '직접 바꾼 행발 280 은 남겨야 함');
});
t('직접 고친 NEIS 문구는 그대로 두고 알림', () => {
  const B = boot(); B.installCore_();
  const c = B.__ss.getSheetByName('📐 공통규칙');
  c.getRange(4, 3).setValue('우리 학교 금지사항');
  eq(B.syncNeisRules_(B.RULES_2026), 'kept');
  eq(B.getCommon_().NEIS_RULES, '우리 학교 금지사항');
});

console.log('\n[원격 규칙판]');
const pack2027 = () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'latest.json'), 'utf8'));
  p.id = '2027.1'; p.year = 2027; p.chars['행발'] = 400;
  p.byRecord['행발'] = '- 2027 행발 주의';
  p.neisRules = '2027 금지사항';
  p.history = [{ id: '2026.1', neisRules: A.RULES_2026.neisRules, byRecord: A.RULES_2026.byRecord, chars: A.RULES_2026.chars }];
  p.rules.push({ level: 'block', label: '새 금지', re: '새금지어', why: '2027 신설' });
  return p;
};
t('새 판이면 손대지 않은 칸만 바꾸고 "내 학교" 줄은 남김', () => {
  const C = boot({ remote: true }); C.installCore_();
  const s = C.__ss.getSheetByName('📏 기재요령');
  const n = C.readRuleRows_(s).length;
  s.getRange(4 + n, 1, 1, 7).setValues([[true, '확인', '우리 학교', '교장배', '', '교내 표현', '내 학교']]);
  C.__fetch.handler = (url) => { ok(/rules\/latest\.json/.test(url), url); return { code: 200, body: pack2027() }; };
  const rep = C.autoRulesCheck_();
  ok(rep && rep.id === '2027.1', '반영 안 됨');
  const rows = C.readRuleRows_(s);
  ok(rows.some(r => r[2] === '새 금지'), '새 규칙 없음');
  ok(rows.some(r => r[2] === '우리 학교'), '내 학교 줄이 사라짐');
  eq(C.getCommon_().NEIS_RULES, '2027 금지사항');
  eq(C.getRecordTypes_().filter(r => r.key === '행발')[0].chars, 400);
  eq(C.currentPackInfo_().id, '2027.1');
  ok(!C.inspect_('새금지어 포함함.', 1500).ok, '새 규칙이 검사에 안 쓰임');
});
t('7일 안에는 다시 묻지 않음 · 서버에 없으면(404) 조용히 넘어감', () => {
  const C = boot({ remote: true }); C.installCore_();
  let n = 0;
  C.__fetch.handler = () => { n++; return { code: 404, body: 'Not Found' }; };
  eq(C.autoRulesCheck_(), null); eq(n, 1);
  eq(C.autoRulesCheck_(), null); eq(n, 1, '7일 안에 또 물음');
  eq(C.currentPackInfo_().id, '2026.1');
});
t('메뉴 [업데이트 확인]: 최신이면 알림만', () => {
  const C = boot(); C.installCore_();
  C.__fetch.handler = () => ({ code: 200, body: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'latest.json'), 'utf8')) });
  C.checkRulesUpdate();
  ok(/최신 규칙판/.test(C.__alerts[C.__alerts.length - 1]), C.__alerts[C.__alerts.length - 1]);
});

console.log('\n[생성 — 자동 고쳐쓰기]');
function genSetup(D, n, mode) {
  D.installCore_();
  D.onboardSaveRoster(Array.from({ length: n }, (_, i) => '1\t' + (i + 1) + '\t학생' + (i + 1)).join('\n'));
  const made = mode === 'quick'
    ? D.createQuickSheet({ name: '메모', recordKey: '과세특', subjectKey: '수학' })
    : D.createActivity_({ key: '탐구', name: '데이터 탐구', recordKey: '동아리', subjectKey: '공통', columns: '탐구 주제', desc: '', examples: [] });
  const s = D.__ss.getSheetByName(made.inSheet);
  const c = name => D.colOf_(s, 3, name);
  s.getRange(4, 5, n, 1).setValues(Array.from({ length: n }, (_, i) => ['주제' + (i + 1)]));
  s.getRange(4, c('생성'), n, 1).setValues(Array.from({ length: n }, () => [true]));
  D.__ss.setActiveSheet(s);
  return { s, c };
}
t('[수정]이 나오면 걸린 점을 짚어 한 번 더 — 나아진 글을 넣음', () => {
  const D = boot(); D.setCfg_ && 0;
  const { s, c } = genSetup(D, 1);
  D.setCfg_('한 번에 묶을 학생 수', 1);
  D.setKey_('gemini', 'AIza');
  const sent = [];
  D.__fetch.handler = (url, opt) => {
    const p = JSON.parse(opt.payload); sent.push(p.contents[0].parts[0].text);
    return gemOk(sent.length === 1 ? '학생은 교내 대회에서 최우수상을 수상함.' : '탐구 과정을 꼼꼼히 정리하고 결과를 발표함.');
  };
  D.generateChecked();
  eq(sent.length, 2, '호출 수');
  ok(/# 고쳐 쓸 초안/.test(sent[1]) && /수상·등수/.test(sent[1]), sent[1]);
  eq(s.getRange(4, c('AI 결과')).getValue(), '탐구 과정을 꼼꼼히 정리하고 결과를 발표함.');
  ok(/자동 고쳐쓰기 1회/.test(s.getRange(4, c('검증')).getValue()), s.getRange(4, c('검증')).getValue());
});
t('고쳐쓰기를 끄면 한 번만', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1);
  D.setCfg_('한 번에 묶을 학생 수', 1); D.setCfg_('자동 고쳐쓰기', false);
  D.setKey_('gemini', 'AIza');
  let n = 0;
  D.__fetch.handler = () => { n++; return gemOk('학생은 수상함.'); };
  D.generateChecked();
  eq(n, 1); ok(/수정필요/.test(s.getRange(4, c('검증')).getValue()));
});
t('고쳐 쓴 글이 더 나쁘면 처음 글을 둠', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1);
  D.setCfg_('한 번에 묶을 학생 수', 1); D.setKey_('gemini', 'AIza');
  let n = 0;
  D.__fetch.handler = () => { n++; return gemOk(n === 1 ? '학생은 탐구함.' : '학생은 토익 대회에서 수상함.'); };
  D.generateChecked();
  eq(s.getRange(4, c('AI 결과')).getValue(), '학생은 탐구함.');
});

console.log('\n[키 없이 — 복사·붙여넣기]');
t('키가 하나도 없으면 생성 대신 복사·붙여넣기 창(학생 이름은 요청문에 없음)', () => {
  const D = boot();
  genSetup(D, 3);
  let n = 0;
  D.__fetch.handler = () => { n++; return gemOk(); };
  D.generateChecked();
  eq(n, 0, 'API 를 부르면 안 됨');
  const tpl = D.__templates.filter(x => x.file === 'UI_Manual').pop();
  ok(tpl, '창이 안 열림');
  const data = JSON.parse(tpl.data.replace(/\\u003c/g, '<'));
  eq(data.chunks.length, 1); eq(data.chunks[0].ids.join(), 'S1,S2,S3');
  ok(!/학생1|학생2/.test(data.system + data.chunks[0].user), '이름이 요청문에 들어감');
  ok(/키가 없어/.test(data.note), data.note);
});
t('붙여 넣은 답을 학생별로 [AI 결과]에 넣고 검사 · 체크 해제', () => {
  const D = boot();
  const { s, c } = genSetup(D, 2);
  D.generateChecked();
  const data = JSON.parse(D.__templates.filter(x => x.file === 'UI_Manual').pop().data.replace(/\\u003c/g, '<'));
  const ch = data.chunks[0];
  const r = D.manualApply({ sheet: data.sheet, target: data.target, check: data.check, limit: data.limit, rows: ch.rows, ids: ch.ids, labels: ch.labels,
                            answer: '[S1]\n탐구 주제를 스스로 정함.\n[S2]\n학생은 토익을 준비함.' });
  eq(r.written, 2);
  eq(s.getRange(4, c('AI 결과')).getValue(), '탐구 주제를 스스로 정함.');
  ok(/수정필요/.test(s.getRange(5, c('검증')).getValue()), s.getRange(5, c('검증')).getValue());
  eq(s.getRange(4, c('생성')).getValue(), false);
  ok(r.results[1].issues.some(x => /공인어학시험/.test(x)));
});
t('[키 없이(복사·붙여넣기)] 모델을 고르면 키가 있어도 창으로', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1);
  D.setKey_('gemini', 'AIza');
  s.getRange(4, c('모델')).setValue(D.MANUAL_MODEL);
  let n = 0;
  D.__fetch.handler = () => { n++; return gemOk(); };
  D.generateChecked();
  eq(n, 0);
  ok(D.__templates.some(x => x.file === 'UI_Manual'));
});
t('시작하기 [키 없이]: 2단계 완료, 키 없는 모델은 [키 없이]로', () => {
  const D = boot(); D.installCore_();
  const r = D.onboardUseManual();
  ok(r.status.manual, '완료 표시 없음');
  eq(D.cfg_('활동용 모델', ''), D.MANUAL_MODEL);
});
t('키 없이 시험: 요청문 → 답 검사', () => {
  const D = boot(); D.installCore_();
  const q = D.createQuickSheet({ name: '시험', recordKey: '행발', subjectKey: '공통' });
  const k = D.getActivities_().filter(a => a.inSheet === q.inSheet)[0].key;
  const m = D.onboardManualTest(k);
  ok(/# 학생 자료/.test(m.prompt) && /청소 구역/.test(m.prompt), '보기 메모가 없음');
  eq(m.limit, 900);
  const r = D.onboardManualCheck({ answer: '맡은 일을 끝까지 책임지는 태도를 보임.', limit: m.limit });
  ok(r.ok && r.bytes > 0);
});

console.log('\n[✍️ 바로 쓰기]');
t('입력 항목 없이 [관찰 메모] 한 칸 · 예시 시트 없음 · 모드 바로쓰기', () => {
  const D = boot(); D.installCore_();
  const r = D.createQuickSheet({ name: '1학기 메모', recordKey: '과세특', subjectKey: '수학' });
  const a = D.getActivities_().filter(x => x.inSheet === r.inSheet)[0];
  eq(a.mode, '바로쓰기'); eq(a.exSheet, ''); eq(a.columns, '관찰 메모');
  ok(/자유롭게 적은 메모/.test(D.promptFor_(a)));
  eq(D.__ss.getSheetByName('1학기 메모 ▸예시'), null);
});
t('최종본에 직접 쓰면 [검증]이 바로 다시 검사(onEdit)', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1, 'quick');
  s.getRange(4, c('최종본')).setValue('교내 경시대회 금상을 받음.');
  D.onEdit({ range: s.getRange(4, c('최종본')) });
  const v = s.getRange(4, c('검증')).getValue();
  ok(/수정필요/.test(v) && /수상·등수/.test(v) && /최종본 기준/.test(v), v);
});
t('명단에 없는 학생 줄(직접 적은 줄)은 동기화해도 남음', () => {
  const D = boot(); D.installCore_();
  const r = D.createQuickSheet({ name: '명단없음', recordKey: '자율', subjectKey: '공통' });
  const s = D.__ss.getSheetByName(r.inSheet);
  s.getRange(4, 1, 1, 5).setValues([['3', '7', '직접적은학생', '', '분리배출 캠페인을 이끎']]);
  D.onboardSaveRoster('1\t1\t명단학생');
  const vals = s.getRange(4, 1, 2, 5).getValues();
  eq(vals[0][2], '명단학생'); eq(vals[1][2], '직접적은학생'); eq(vals[1][4], '분리배출 캠페인을 이끎');
});

console.log('\n[시작하기 버튼 · 메뉴 · 셀 함수 · 내보내기]');
t('시작하기 시트에 버튼 6개, 각각 함수가 붙음', () => {
  const s = A.__ss.getSheetByName('🚀 시작하기');
  const imgs = s.getImages();
  eq(imgs.length, 6);
  eq(imgs.map(i => i.getScript()).join(), 'openOnboard,openQuickSheetDialog,openFormDialog,openCheckSidebar,openStyleDialog,openOcrGuide');
  imgs.forEach(i => ok(typeof A[i.getScript()] === 'function', i.getScript() + ' 없음'));
  A.buildStart();
  eq(A.__ss.getSheetByName('🚀 시작하기').getImages().length, 6, '다시 만들면 겹침');
});
t('SAETEUK_CHECK: 칸 하나·여러 칸', () => {
  ok(/수정필요/.test(A.SAETEUK_CHECK('토익 만점을 받음.')));
  ok(/통과/.test(A.SAETEUK_CHECK('탐구 과정을 정리함.', 10)) || /확인필요/.test(A.SAETEUK_CHECK('탐구 과정을 정리함.', 10)));
  eq(A.SAETEUK_CHECK([['토익'], ['']])[1][0], '');
});
t('검사 창: 규칙 검사 · 셀 가져오기/다시 넣기', () => {
  const D = boot();
  const { s, c } = genSetup(D, 1, 'quick');
  const r = D.checkTextNow({ text: '할수 있슴.', chars: 300 });
  eq(r.limit, 900); ok(r.issues.filter(i => i.label === '맞춤법').length >= 2, JSON.stringify(r.issues));
  s.getRange(4, c('최종본')).setValue('역활을 다함.').activate();
  const got = D.readActiveCell();
  eq(got.text, '역활을 다함.'); eq(got.recordKey, '과세특');
  D.writeBackCell({ sheet: got.sheet, a1: got.a1, text: '역할을 다함.' });
  eq(s.getRange(4, c('최종본')).getValue(), '역할을 다함.');
  ok(!/역활/.test(s.getRange(4, c('검증')).getValue()), '다시 검사 안 됨');
});
t('AI 앱 내보내기: Gem 글 · SKILL.md 머리말 · zip', () => {
  const D = boot(); D.installCore_();
  D.createQuickSheet({ name: '내보내기', recordKey: '동아리', subjectKey: '공통' });
  const k = D.getActivities_()[0].key;
  const r = D.exportFor({ key: k });
  ok(/^---\nname: saeteuk-club-1\ndescription: /.test(r.skill), r.skill.slice(0, 120));
  ok(/# 사용법/.test(r.gem) && /# 역할/.test(r.gem));
  const z = D.exportSkillZip({ key: k });
  eq(z.file, 'saeteuk-club-1.zip'); ok(z.b64.length > 4);
});
t('계정 정보: 학교·기관 계정 판별', () => {
  eq(A.accountInfo_().kind, 'school');
});
t('모든 대화상자(UI_*.html)가 부르는 서버 함수가 있음', () => {
  const src = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const defined = new Set([...src.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]));
  const bad = [];
  fs.readdirSync(dir).filter(f => /^UI_.*\.html$/.test(f)).forEach(f => {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    let i = 0;
    while ((i = h.indexOf('google.script.run', i)) >= 0) {
      let j = i + 'google.script.run'.length;
      for (;;) {   // .withSuccessHandler(…).withFailureHandler(…).서버함수( — 괄호 짝을 맞춰 넘긴다
        const m = h.slice(j).match(/^\s*\.\s*([A-Za-z_]\w*)\s*\(/);
        if (!m) break;
        j += m[0].length;
        let d = 1;
        while (d && j < h.length) { if (h[j] === '(') d++; else if (h[j] === ')') d--; j++; }
        if (!/^with(Success|Failure)Handler$|^withUserObject$/.test(m[1])) { if (!defined.has(m[1])) bad.push(f + ': ' + m[1]); break; }
      }
      i = j;
    }
  });
  ok(!bad.length, '없는 서버 함수: ' + bad.join(', '));
});
t('메뉴가 화면 밖으로 잘리지 않게 맨 위 항목은 8개 이하', () => {
  const src = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  const body = src.slice(src.indexOf('function onOpen('), src.indexOf('m.addToUi();'));
  const top = (body.match(/^\s*m\.addItem\(/gm) || []).length;
  const subs = (body.match(/^\s*m\.addSubMenu\(/gm) || []).length;
  ok(top <= 8, '맨 위 항목 ' + top + '개');
  ok(top + subs <= 14, '맨 위 줄 수 ' + (top + subs));
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
if (fail) process.exit(1);
