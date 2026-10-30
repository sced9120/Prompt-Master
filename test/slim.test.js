/* v3.8.7 — 프롬프트 줄이기(검사기가 잡는 것은 짧게) · 옛 기본 문구 이어받기 · 체험 예시 (node test/slim.test.js) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals } = require('./sheets-mock');

const dir = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort();

function boot(noInstall) {
  const g = makeGlobals();
  const ctx = vm.createContext(Object.assign({ module: { exports: {} } }, g));
  files.forEach(f => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  if (!noInstall) ctx.installCore_();
  ctx.__g = g;
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 3).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((m ? m + ' — ' : '') + '기대 ' + y + ' / 실제 ' + x); };

const P = boot();
const COM = {}; P.PRESET_COMMON.forEach(c => { COM[c.key] = c.body; });
const recOf = k => Object.assign({}, P.findByKey(P.PRESET_RECORD_TYPES, k), { rules: P.RECORD_RULES_2026[k] });
const prompt = (k, ex) => P.buildPrompt({ activity: { name: '탐구', recordKey: k, subjectKey: '수학', mode: '바로쓰기' },
  record: recOf(k), subject: P.findByKey(P.PRESET_SUBJECTS, '수학'), common: COM, examples: ex || '' });
const cellOf = (s, key) => { const v = s.getRange(1, 1, s.getLastRow(), 3).getValues(); for (let i = 0; i < v.length; i++) if (v[i][0] === key) return { row: i + 1, text: v[i][2] }; return null; };

console.log('\n[프롬프트 길이]');
t('예시 없는 과세특 프롬프트가 5,500바이트 안 (v3.8 은 6,956바이트)', () => {
  const b = P.byteLen(prompt('과세특'));
  ok(b < 5500, b + '바이트');
});
t('검사기가 잡는 금지 항목은 프롬프트에 짧게 남음 (대회 · 어학시험 · 자격증 · 모의고사 · MOOC · 방과후 · 대학명 · 부모)', () => {
  const n = COM.NEIS_RULES;
  ['대회', '공인어학시험', '자격증', '모의고사', 'K-MOOC', '방과후학교', '대학명', '부모', '연구보고서', '정규교육과정 밖', '사교육'].forEach(w => ok(n.indexOf(w) >= 0, w));
  ok(/2026학년도 학교생활기록부 기재요령 기준/.test(n));
  ok(P.byteLen(n) < P.byteLen(P.NEIS_RULES_2026_1) * 0.6, '절반 남짓으로');
});
t('과세특 · 개세특 기재 주의에 금지사항과 겹치는 줄이 없음, 진로 · 행발에 분량 줄이 없음', () => {
  ok(!/K-MOOC/.test(P.RECORD_RULES_2026['과세특'] + P.RECORD_RULES_2026['개세특']));
  ok(!/최대 \d+자/.test(P.RECORD_RULES_2026['진로'] + P.RECORD_RULES_2026['행발']));
  ok(/연구보고서의 제목/.test(P.RECORD_RULES_2026['과세특']), '탐구 과목 예외는 남김');
});
t('서술 규칙의 핵심(어미 · 주어 · 특수문자 · 지어내지 않기)은 그대로', () => {
  const w = COM.WRITING_RULES;
  ok(/명사형 어미/.test(w) && /학생 주어/.test(w) && /특수문자/.test(w) && /입력 자료에 없는 사실/.test(w), w);
});
t('피할 표현 기본값이 두 곳(공통규칙 프리셋 · AVOID_RULES_DEFAULT)에서 같음', () => eq(COM.AVOID_RULES, P.AVOID_RULES_DEFAULT));
t('예시는 프롬프트에 5편까지', () => eq(P.EXAMPLE_MAX, 5));
t('분량 맞추기 세 단계: 보통(기본) · 메모만큼 · 넉넉히 — 어느 단계든 메모에 없는 것은 만들지 않음', () => {
  const p = prompt('과세특', '## 예시1 입력\n메모: 가\n## 예시1 결과\n나');
  ok(/메모가 짧아도 \d+바이트 안팎은 쓴다/.test(p) && /교과 역량과 잇는/.test(p) && /만들지 않는다/.test(p), '보통(기본)');
  ok(/학생 자료가 예시 입력보다 적으면 예시보다 짧아도 된다/.test(p), '예시 · 보통');
  const EX = '## 예시1 입력\n가\n## 예시1 결과\n나';
  const pm = P.buildPrompt({ activity: { name: '탐구', recordKey: '과세특', subjectKey: '수학', mode: '바로쓰기', amount: '메모만큼' },
    record: recOf('과세특'), subject: P.findByKey(P.PRESET_SUBJECTS, '수학'), common: COM, examples: EX });
  ok(/분량은 자료의 양을 따른다/.test(pm) && /메모가 한두 줄이면 한두 문장/.test(pm) && /메모가 짧으면 짧게 쓴다/.test(pm) && /그만큼 짧게 쓴다/.test(pm), '메모만큼');
  const pn = P.buildPrompt({ activity: { name: '탐구', recordKey: '과세특', subjectKey: '수학', amount: '넉넉히' },
    record: recOf('과세특'), subject: P.findByKey(P.PRESET_SUBJECTS, '수학'), common: COM, examples: EX });
  ok(/메모 양과 관계없이 1350바이트 안팎/.test(pn) && /만들지 않는다/.test(pn) && !/예시보다 짧아도/.test(pn), '넉넉히');
  eq(P.activityAmount({ amount: '' }), '보통'); eq(P.activityAmount({ amount: '아무거나' }), '보통');
  ok(/자료가 뒷받침할 때만/.test(COM.WRITING_RULES) && !/사실 → 그 의미 → 성장 가능성 순서로/.test(COM.WRITING_RULES), '서술 규칙');
});

console.log('\n[옛 기본 문구 이어받기]');
t('규칙판 2026.2 · 직전 판(2026.1)의 문구가 history 에 남아 원격 규칙판으로 옛 사본도 바뀜', () => {
  eq(P.RULES_2026.id, '2026.2');
  const h = P.RULES_2026.history.filter(x => x.id === '2026.1')[0];
  ok(h && h.neisRules === P.NEIS_RULES_2026_1 && h.byRecord['과세특'] === P.RECORD_RULES_2026_1['과세특']);
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'latest.json'), 'utf8'));
  eq(pack.id, '2026.2'); eq(pack.neisRules, P.NEIS_RULES_2026);
  ok(pack.history.some(x => x.neisRules === P.NEIS_RULES_2026_1), 'latest.json history');
});
t('2026.1 사본에서 구조 복구: 손대지 않은 금지사항 · 기재 주의 · 서술 규칙 · 피할 표현은 새 문구로, 고친 칸은 그대로', () => {
  const B = boot();
  const c = B.__ss.getSheetByName('📐 공통규칙');
  // 2026.1 판처럼 되돌린다
  ['WRITING_RULES', 'BYTE_RULE', 'AVOID_RULES'].forEach(k => c.getRange(cellOf(c, k).row, 3).setValue(B.OLD_COMMON_2026_1[k]));
  c.getRange(cellOf(c, 'NEIS_RULES').row, 3).setValue(B.NEIS_RULES_2026_1);
  c.getRange(cellOf(c, 'GRADE_RULE').row, 3).setValue('우리 학교 성취수준 문구');
  const r = B.__ss.getSheetByName('🧩 기록종류'), col = B.colOf_(r, 2, '기재 주의');
  const keys = r.getRange(3, 1, r.getLastRow() - 2, 1).getValues().map(x => x[0]);
  keys.forEach((k, i) => { if (B.RECORD_RULES_2026_1[k]) r.getRange(3 + i, col).setValue(B.RECORD_RULES_2026_1[k]); });
  B.__g.__docProps.setProperty('RULES_ID', '2026.1');
  B.__g.__docProps.setProperty('RULES_PACK', JSON.stringify({ id: '2026.1', neisRules: B.NEIS_RULES_2026_1, byRecord: B.RECORD_RULES_2026_1, chars: B.RULES_2026.chars, history: [] }));
  const rep = B.migrateRules_();
  const com = B.getCommon_();
  eq(com.NEIS_RULES, B.NEIS_RULES_2026);
  eq(com.WRITING_RULES, COM.WRITING_RULES); eq(com.BYTE_RULE, COM.BYTE_RULE); eq(com.AVOID_RULES, COM.AVOID_RULES);
  eq(com.GRADE_RULE, '우리 학교 성취수준 문구', '고친 칸');
  ok(rep.common.indexOf('WRITING_RULES') >= 0 && rep.common.indexOf('GRADE_RULE') < 0, JSON.stringify(rep.common));
  eq(B.getRecordTypes_().filter(x => x.key === '과세특')[0].rules, B.RECORD_RULES_2026['과세특']);
  eq(B.currentPackInfo_().id, '2026.2');
  ok(B.readRuleRows_(B.__ss.getSheetByName('📏 기재요령')).some(x => String(x[6]) === 'AI 투(기본)'), 'AI 투 줄이 남아야 함');
});
t('v3.8.7 시험판 서술 규칙이 든 시험 사본도 구조 복구로 새 문구', () => {
  const B = boot();
  const c = B.__ss.getSheetByName('📐 공통규칙');
  c.getRange(cellOf(c, 'WRITING_RULES').row, 3).setValue(B.OLD_WRITING_RULES_387);
  eq(B.syncCommonDefaults_(), ['WRITING_RULES']);
  eq(B.getCommon_().WRITING_RULES, COM.WRITING_RULES);
  ok(B.OLD_PRESET_TEXTS.indexOf(B.OLD_WRITING_RULES_387) >= 0, '가져오기');
});
t('새 사본(처음 설치)은 처음부터 짧은 문구', () => {
  const com = P.getCommon_();
  eq(com.NEIS_RULES, P.NEIS_RULES_2026); eq(com.WRITING_RULES, COM.WRITING_RULES);
});
t('이전 파일 가져오기: 옛 기본 문구는 "고친 칸"으로 보지 않음', () => {
  ok(P.OLD_PRESET_TEXTS.indexOf(P.OLD_COMMON_2026_1.WRITING_RULES) >= 0 && P.OLD_PRESET_TEXTS.indexOf(P.OLD_COMMON_2026_1.AVOID_RULES) >= 0);
});

console.log('\n[분량 맞추기 열]');
t('새 활동은 [분량 맞추기]를 12열에 적고, 읽어서 프롬프트에 씀(보통은 빈칸)', () => {
  const B = boot();
  B.createActivity_({ key: '넉넉', name: '넉넉', recordKey: '과세특', subjectKey: '수학', columns: [B.QUICK_COLUMN], mode: '바로쓰기', amount: '넉넉히' });
  B.createActivity_({ key: '보통', name: '보통', recordKey: '과세특', subjectKey: '수학', columns: [B.QUICK_COLUMN], mode: '바로쓰기', amount: '보통' });
  const s = B.__ss.getSheetByName(B.APP.SH.ACTIVITY);
  eq(B.colOf_(s, 2, '분량 맞추기'), 12);
  eq(B.getActivity_('넉넉').amount, '넉넉히'); eq(B.getActivity_('보통').amount, '');
  ok(/메모 양과 관계없이/.test(B.promptFor_(B.getActivity_('넉넉'), '')), '넉넉히 프롬프트');
  ok(/메모가 짧아도/.test(B.promptFor_(B.getActivity_('보통'), '')), '보통 프롬프트');
});
t('예전 활동목록(11열)은 구조 복구 때 [분량 맞추기] 열이 맨 뒤에 붙고 기존 활동은 보통', () => {
  const B = boot();
  B.createActivity_({ key: '옛활동', name: '옛활동', recordKey: '과세특', subjectKey: '수학', columns: [B.QUICK_COLUMN], mode: '바로쓰기' });
  const s = B.__ss.getSheetByName(B.APP.SH.ACTIVITY);
  s.getRange(2, 12).setValue('');   // 11열짜리 예전 시트처럼
  eq(B.colOf_(s, 2, '분량 맞추기'), 0);
  B.buildActivityList();
  eq(B.colOf_(s, 2, '분량 맞추기'), 12);
  eq(B.activityAmount(B.getActivity_('옛활동')), '보통');
});

console.log('\n[🧪 체험 예시]');
const rowsOf = (B, sheet) => {
  const s = B.__ss.getSheetByName(sheet);
  const v = s.getRange(B.APP.HEAD_ROW, 1, s.getLastRow() - B.APP.HEAD_ROW + 1, s.getLastColumn()).getValues();
  const h = v[0];
  return v.slice(1).filter(r => String(r[2]).trim()).map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; });
};
t('예시 2편은 검사에 걸리지 않음 · 초안은 [수정] · AI 투 · 맞춤법이 함께 보임', () => {
  P.DEMO_EXAMPLES.forEach((e, i) => { const v = P.inspect_(e.result, P.DEMO_BYTES); ok(!v.issues.length, '예시 ' + (i + 1) + ': ' + P.formatIssues(v)); });
  const f = P.formatIssues(P.inspect_(P.DEMO_DRAFT.text, P.DEMO_BYTES));
  ok(/\[수정\] 존댓말\/평서형 어미/.test(f) && /AI 투/.test(f) && /맞춤법/.test(f), f);
});
t('관찰 메모 양이 학생마다 다르고(강하늘 > 윤바다 > 서가람), 예시 입력은 한 줄 메모보다 훨씬 김', () => {
  const m = P.DEMO_MEMOS, len = x => P.byteLen(x);
  ok(len(m['강하늘']) > len(m['윤바다']) * 1.4 && len(m['윤바다']) > len(m['서가람']) * 2, [len(m['강하늘']), len(m['윤바다']), len(m['서가람'])].join(' / '));
  P.DEMO_EXAMPLES.forEach((e, i) => ok(len(e.values[0]) > len(m['서가람']) * 4, '예시 ' + (i + 1) + ' 입력 ' + len(e.values[0])));
});
t('빈 사본: 채우면 가상 학생 3명 · 활동 · 예시 2편 · 메모 3칸 · 초안 검증', () => {
  const B = boot();
  eq(B.demoState_().canFill, true);
  const r = B.demoFill();
  eq(r.roster, 'added');
  eq(B.getRoster_().map(x => x.name), ['강하늘', '윤바다', '서가람']);
  const a = B.getActivity_('체험예시');
  ok(a && a.mode === '바로쓰기' && a.recordKey === '과세특' && a.subjectKey === '수학', JSON.stringify(a));
  eq(B.bytesFor_(a), 600);
  const rows = rowsOf(B, a.inSheet);
  eq(rows.length, 3);
  ok(rows.every(x => String(x['관찰 메모']).length > 10), '메모');
  const k = rows.filter(x => x['이름'] === '강하늘')[0];
  ok(/했다/.test(k['AI 결과']) && /\[수정\]/.test(k['검증']), k['검증']);
  eq(B.readExampleRows_(a).length, 2);
  ok(/# 예시/.test(B.promptFor_(a)), '예시가 프롬프트에');
  eq(B.demoState_().filled, true);
  let msg = '';
  try { B.demoFill(); } catch (e) { msg = e.message; }
  ok(/이미 들어 있습니다/.test(msg), '두 번 채우기: ' + msg);
});
t('지우면 체험 활동 · 시트 2개 · 체험 학생만 사라지고 선생님 활동은 그대로', () => {
  const B = boot();
  B.demoFill();
  B.createQuickSheet({ name: '바로쓰기1', recordKey: '행발' });
  const r = B.demoClear();
  eq(r.activity, true); eq(r.sheets.length, 2); eq(r.students, 3);
  ok(!B.getActivity_('체험예시') && !B.__ss.getSheetByName('체험예시 ▸입력'), '체험 활동');
  ok(B.getActivity_('바로쓰기1'), '선생님 활동이 사라짐');
  eq(B.getRoster_().length, 0);
  eq(B.demoState_().filled, false); eq(B.demoState_().canFill, true);
});
t('실제 학생이 있는 명단에는 넣지 않음', () => {
  const B = boot();
  B.rosterSave({ text: '2 7 김철수' });
  let msg = '';
  try { B.demoFill(); } catch (e) { msg = e.message; }
  ok(/체험 학생이 아닌 학생이 1명/.test(msg), msg);
  eq(B.demoState_().canFill, false);
  ok(!B.getActivity_('체험예시'));
});
t('실습처럼 가상 학생 3명을 먼저 넣었으면 명단은 그대로 쓰고, 지울 때 그 학생도 지움', () => {
  const B = boot();
  B.rosterSave({ text: '1 1 강하늘\n1 2 윤바다\n1 3 서가람' });
  eq(B.demoFill().roster, 'kept');
  eq(B.demoClear().students, 3);
});
t('메뉴 · 시작하기 창에 버튼', () => {
  const ui = fs.readFileSync(path.join(dir, 'UI_Onboard.html'), 'utf8'), menu = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  ok(/menuDemoFill/.test(menu) && /menuDemoClear/.test(menu));
  ok(/체험 예시로 채워 보기/.test(ui) && /체험 예시 지우기/.test(ui) && /한 번 더 누르면 지웁니다/.test(ui));
  ok(P.onboardStatus().demo, 'onboardStatus.demo');
});

console.log('\n통과 ' + pass + '개' + (fail ? ' / 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
