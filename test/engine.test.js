/* 프롬프트 엔진 단위 테스트 (node test/engine.test.js) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'apps-script');
const sandbox = { module: { exports: {} }, console };
sandbox.exports = sandbox.module.exports;
vm.createContext(sandbox);
for (const f of ['00_Presets.gs', '10_Engine.gs']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}
const E = sandbox.module.exports;
const { PRESET_RECORD_TYPES, PRESET_SUBJECTS, PRESET_COMMON, PRESET_BANNED, PRESET_FORMAT_RULES } = sandbox;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}
function ok(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }

console.log('\n[byteLen]');
t('한글 3바이트', () => eq(E.byteLen('가나다'), 9));
t('영숫자 1바이트', () => eq(E.byteLen('abc123'), 6));
t('공백/구두점 1바이트', () => eq(E.byteLen('a, b.'), 5));
t('줄바꿈 2바이트', () => eq(E.byteLen('가\n나'), 8));
t('빈값 0', () => eq(E.byteLen(''), 0) || eq(E.byteLen(null), 0));
t('500자 = 1500바이트', () => eq(E.byteLen('가'.repeat(500)), 1500));

console.log('\n[trimToBytes]');
t('한도 이하는 그대로', () => eq(E.trimToBytes('가나다', 100), '가나다'));
t('한도 초과 시 자름', () => ok(E.byteLen(E.trimToBytes('가'.repeat(100), 90)) <= 90));
t('문장 끝에서 끊음', () => {
  const s = '첫 문장임. 두 번째 문장임. 세 번째 문장으로 길게 이어지는 내용임.';
  const r = E.trimToBytes(s, 60);
  ok(r.endsWith('.'), '마침표로 끝나야 함: ' + r);
});

console.log('\n[parseColumns]');
t('파이프 구분', () => eq(E.parseColumns('가|나|다'), ['가', '나', '다']));
t('콤마 구분', () => eq(E.parseColumns('가, 나 , 다'), ['가', '나', '다']));
t('빈 항목 제거', () => eq(E.parseColumns('가||나,'), ['가', '나']));
t('빈 입력', () => eq(E.parseColumns(''), []));

console.log('\n[fillTokens]');
t('치환', () => eq(E.fillTokens('안녕 {NAME}', { NAME: '철수' }), '안녕 철수'));
t('없는 키는 제거', () => eq(E.fillTokens('a{X}b', {}), 'ab'));

const common = {};
PRESET_COMMON.forEach(r => common[r.key] = r.body);

console.log('\n[buildPrompt — 과세특/수학]');
const mathPrompt = E.buildPrompt({
  activity: { key: '탐구저널', name: '수학탐구저널', recordKey: '과세특', subjectKey: '수학', chars: 500, columns: '탐구주제|선정이유|탐구과정|결론', desc: '공통수학2 개념 기반 자유주제 탐구보고서', mode: '자동' },
  record: E.findByKey(PRESET_RECORD_TYPES, '과세특'),
  subject: E.findByKey(PRESET_SUBJECTS, '수학'),
  common,
  examples: '##예시1 입력: ...\n##예시1 결과: ...',
  years: 9
});
t('역할에 교과명 포함', () => ok(/수학 교과/.test(mathPrompt), mathPrompt.slice(0, 200)));
t('경력 치환', () => ok(/9년간/.test(mathPrompt)));
t('분량 문장 자동 생성', () => ok(/500자\(1500바이트\) 이내/.test(mathPrompt)));
t('90% 하한 문장', () => ok(/1350바이트 이상/.test(mathPrompt)));
t('기재 금지사항 포함', () => ok(/공인어학시험/.test(mathPrompt)));
t('수학 역량 포함', () => ok(/문제해결, 추론, 의사소통/.test(mathPrompt)));
t('입력 형식 포함', () => ok(/탐구주제\|선정이유\|탐구과정\|결론/.test(mathPrompt)));
t('예시 포함', () => ok(/##예시1/.test(mathPrompt)));
t('과세특은 성취수준 지침 포함', () => ok(/성취수준 반영/.test(mathPrompt)));
t('남은 치환 토큰 없음', () => ok(!/\{[A-Z_]+\}/.test(mathPrompt), '미치환 토큰: ' + (mathPrompt.match(/\{[A-Z_]+\}/g) || []).join()));

console.log('\n[buildPrompt — 동아리/공통]');
const clubPrompt = E.buildPrompt({
  activity: { key: '동아리', name: '전기전자 탐구 동아리', recordKey: '동아리', subjectKey: '공통', columns: '탐구주제|역할|과정|배운점', desc: '노트북 기반 데이터 탐구', mode: '자동' },
  record: E.findByKey(PRESET_RECORD_TYPES, '동아리'),
  subject: E.findByKey(PRESET_SUBJECTS, '공통'),
  common, examples: ''
});
t('동아리 관점 포함', () => ok(/동아리의 공동 활동/.test(clubPrompt)));
t('동아리는 성취수준 지침 제외', () => ok(!/성취수준 반영/.test(clubPrompt), '등급 지침이 들어감'));
t('교과 역량 대신 공통 역량', () => ok(/2022 개정 교육과정 핵심역량/.test(clubPrompt)));
t('예시 없으면 예시 섹션 없음', () => ok(!/# 예시/.test(clubPrompt)));
t('역할에 교과 토큰 잔여 없음', () => ok(!/\{교과\}/.test(clubPrompt)));

console.log('\n[buildPrompt — 행발 300자]');
const hPrompt = E.buildPrompt({
  activity: { key: '행발', name: '행동특성 및 종합의견', recordKey: '행발', subjectKey: '공통', columns: '관찰내용', mode: '자동' },
  record: E.findByKey(PRESET_RECORD_TYPES, '행발'),
  subject: E.findByKey(PRESET_SUBJECTS, '공통'),
  common
});
t('행발 기본 300자 적용', () => ok(/300자\(900바이트\) 이내/.test(hPrompt), hPrompt.match(/.*자\(.*바이트\) 이내/)));
t('담임 관점', () => ok(/담임교사/.test(hPrompt)));

console.log('\n[buildPrompt — 직접작성 모드]');
const custom = E.buildPrompt({
  activity: { mode: '직접작성', custom: '{ROLE}\n---\n{NEIS_RULES}\n한도 {BYTES}바이트\n{EXAMPLES}', chars: 400, recordKey: '자율', subjectKey: '공통' },
  record: E.findByKey(PRESET_RECORD_TYPES, '자율'),
  subject: E.findByKey(PRESET_SUBJECTS, '공통'),
  common, examples: 'EX'
});
t('직접 모드 토큰 치환', () => ok(/한도 1200바이트/.test(custom) && /EX/.test(custom) && /공인어학시험/.test(custom), custom));

console.log('\n[buildStudentBlock]');
t('빈 값 제외', () => eq(
  E.buildStudentBlock(['A', 'B', 'C'], ['1', '', '3']),
  'A: 1\nC: 3'));
t('성취수준 부가', () => ok(/성취수준: 2/.test(E.buildStudentBlock(['A'], ['1'], { grade: 2 }))));

console.log('\n[validateResult]');
const V = (s, lim) => E.validateResult(s, lim, PRESET_BANNED, PRESET_FORMAT_RULES);
t('정상 문장 통과', () => {
  const r = V('탐구 주제를 스스로 정하고 자료를 수집하여 결론을 도출함. 논리적 사고가 돋보임.', 1500);
  ok(r.ok, JSON.stringify(r.issues));
});
t('분량 초과 탐지', () => {
  const r = V('가'.repeat(600) + '함.', 1500);
  ok(!r.ok && r.issues.some(i => i.label === '분량 초과'));
});
t('수상 표현 탐지', () => ok(V('교내 수학 경시대회에서 최우수상을 수상함.', 1500).issues.some(i => i.label === '수상·등수')));
t('어학시험 탐지', () => ok(!V('토익 900점을 받음.', 1500).ok));
t('학생 주어 탐지', () => ok(V('학생은 성실함.', 1500).issues.some(i => i.label === "'학생' 주어")));
t('존댓말 탐지', () => ok(V('탐구를 잘 했습니다.', 1500).issues.some(i => i.label === '존댓말/평서형 어미')));
t('특수문자 탐지', () => ok(V('자료 분석 - 결론 도출함.', 1500).issues.some(i => i.label === '금지 특수문자')));
t('빈 결과', () => ok(!V('', 1500).ok));
t('대회 언급은 확인 수준', () => {
  const r = V('동아리 내부 토론대회 형식의 활동에 참여함.', 1500);
  ok(r.issues.some(i => i.label === '대회 언급' && i.level === 'check'));
});

console.log('\n[formatIssues]');
t('통과 메시지', () => ok(/통과/.test(E.formatIssues(V('자료를 분석하여 결론을 도출함.', 50)))));

console.log('\n[프리셋 무결성]');
t('기록종류 키 유일', () => {
  const k = PRESET_RECORD_TYPES.map(r => r.key);
  eq(k.length, new Set(k).size);
});
t('교과 키 유일', () => {
  const k = PRESET_SUBJECTS.map(r => r.key);
  eq(k.length, new Set(k).size);
});
t('모든 기록종류가 조립 가능', () => {
  PRESET_RECORD_TYPES.forEach(rec => {
    const p = E.buildPrompt({
      activity: { name: 't', columns: 'a|b', mode: '자동' },
      record: rec, subject: E.findByKey(PRESET_SUBJECTS, '공통'), common
    });
    ok(p.length > 500, rec.key + ' 프롬프트가 너무 짧음');
    ok(!/\{[A-Za-z가-힣_]+\}/.test(p), rec.key + ' 미치환 토큰');
  });
});
t('모든 교과가 조립 가능', () => {
  PRESET_SUBJECTS.forEach(sub => {
    const p = E.buildPrompt({
      activity: { name: 't', columns: 'a', mode: '자동' },
      record: E.findByKey(PRESET_RECORD_TYPES, '과세특'), subject: sub, common
    });
    ok(!/\{[A-Za-z가-힣_]+\}/.test(p), sub.key + ' 미치환 토큰');
    ok(!/당신은 입니다/.test(p), sub.key + ' 역할 문장 깨짐');
  });
});
t('모든 정규식이 유효', () => {
  PRESET_BANNED.concat(PRESET_FORMAT_RULES).forEach(r => { new RegExp(r.re); });
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
