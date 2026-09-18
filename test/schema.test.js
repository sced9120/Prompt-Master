/* 시트 헤더 ↔ 읽기 코드 정합성 검사 (node test/schema.test.js)
   build*() 가 쓰는 헤더와 get*_() 가 찾는 이름이 어긋나면
   실행 중에는 "값이 빈 채로 조용히" 동작하므로 여기서 잡는다. */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'apps-script');
const src = {};
fs.readdirSync(dir).filter(f => f.endsWith('.gs'))
  .forEach(f => src[f] = fs.readFileSync(path.join(dir, f), 'utf8'));
const all = Object.values(src).join('\n');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
};
const ok = (c, m) => { if (!c) throw new Error(m); };

/** build 함수 안의 `var head = [...]` 를 뽑는다 */
function headOf(fnName) {
  const i = all.indexOf('function ' + fnName + '(');
  ok(i >= 0, fnName + ' 를 찾지 못함');
  const body = all.slice(i, i + 2600);
  const m = body.match(/var head = \[([\s\S]*?)\];/);
  ok(m, fnName + ' 에 head 배열이 없음');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}
/** get 함수 안에서 r['…'] 로 찾는 이름을 뽑는다 */
function lookupsOf(fnName) {
  const i = all.indexOf('function ' + fnName + '(');
  ok(i >= 0, fnName + ' 를 찾지 못함');
  const body = all.slice(i, all.indexOf('\n}', i));
  return [...new Set([...body.matchAll(/r\['([^']+)'\]/g)].map(x => x[1]))];
}

const pairs = [
  ['buildRecordTypes', 'getRecordTypes_'],
  ['buildSubjects', 'getSubjects_'],
  ['buildCommonRules', 'getCommon_'],
  ['buildActivityList', 'getActivities_']
];

console.log('\n[헤더 ↔ 읽기 이름]');
pairs.forEach(([b, g]) => {
  t(b + ' → ' + g, () => {
    const head = headOf(b), look = lookupsOf(g);
    const missing = look.filter(n => !head.includes(n));
    ok(!missing.length, '헤더에 없는 이름을 읽고 있음: ' + missing.join(', ') + '\n       헤더: ' + head.join(' | '));
  });
});

console.log('\n[프리셋 ↔ 헤더 열 개수]');
function presetRowLen(fnName) {
  const i = all.indexOf('function ' + fnName + '(');
  const body = all.slice(i, i + 2600);
  const m = body.match(/return \[([^\]]*)\];/);
  ok(m, fnName + ' 의 프리셋 매핑을 찾지 못함');
  return m[1].split(',').length;
}
t('기록종류 프리셋 열 수', () => {
  ok(presetRowLen('buildRecordTypes') === headOf('buildRecordTypes').length,
    presetRowLen('buildRecordTypes') + ' ≠ ' + headOf('buildRecordTypes').length);
});
t('교과영역 프리셋 열 수', () => {
  ok(presetRowLen('buildSubjects') === headOf('buildSubjects').length,
    presetRowLen('buildSubjects') + ' ≠ ' + headOf('buildSubjects').length);
});
t('공통규칙 프리셋 열 수', () => {
  ok(presetRowLen('buildCommonRules') === headOf('buildCommonRules').length,
    presetRowLen('buildCommonRules') + ' ≠ ' + headOf('buildCommonRules').length);
});
t('createActivity_ 가 쓰는 행 길이 = 활동목록 헤더 수', () => {
  const i = all.indexOf('var row = [key, name, rec.key');
  ok(i > 0, 'createActivity_ 의 row 배열을 찾지 못함');
  let seg = all.slice(i, all.indexOf('];', i));
  // 중첩 호출 안의 쉼표(cfg_('a', 'b'))는 열 구분자가 아니므로 제거
  let prev;
  do { prev = seg; seg = seg.replace(/\([^()]*\)/g, '()'); } while (seg !== prev);
  const n = seg.split(',').length;
  const h = headOf('buildActivityList').length;
  ok(n === h, 'row ' + n + '열 ≠ 헤더 ' + h + '열');
});

console.log('\n[공통규칙 키]');
t('buildPrompt 가 쓰는 키가 프리셋에 모두 있음', () => {
  const used = [...new Set([...src['10_Engine.gs'].matchAll(/com\.([A-Z_]+)/g)].map(x => x[1]))];
  const defined = [...src['00_Presets.gs'].matchAll(/key: '([A-Z_]+)'/g)].map(x => x[1]);
  const missing = used.filter(k => !defined.includes(k));
  ok(!missing.length, '프리셋에 없는 키: ' + missing.join(', '));
});
t('압축 프롬프트도 같은 키만 씀', () => {
  const used = [...new Set([...src['80_Compile.gs'].matchAll(/com\.([A-Z_]+)/g)].map(x => x[1]))];
  const defined = [...src['00_Presets.gs'].matchAll(/key: '([A-Z_]+)'/g)].map(x => x[1]);
  ok(used.every(k => defined.includes(k)), '없는 키 사용: ' + used.filter(k => !defined.includes(k)));
});

console.log('\n[활동 시트 열 구조]');
t('입력 시트가 colOf_ 로 찾는 열을 모두 가짐', () => {
  const i = all.indexOf('function buildActivityInputSheet_(');
  const body = all.slice(i, i + 900);
  const fixed = [...body.matchAll(/'([^']+)'/g)].map(x => x[1]);
  ['생성', '모델', 'AI 결과', '최종본', '바이트', '검증', '반', '번호', '이름', '성취수준']
    .forEach(n => ok(fixed.includes(n), '입력 시트 헤더에 없음: ' + n));
});
t('취합 시트가 colOf_ 로 찾는 열을 모두 가짐', () => {
  const i = all.indexOf('function buildCompileFor_(');
  const body = all.slice(i, i + 1800);
  const fixed = [...body.matchAll(/'([^']+)'/g)].map(x => x[1]);
  ['합본', '합본 바이트', '압축', '모델', 'AI 압축결과', '최종본', '바이트', '검증']
    .forEach(n => ok(fixed.includes(n), '취합 시트 헤더에 없음: ' + n));
});
t('입력 항목은 5열부터 시작한다는 가정이 지켜짐', () => {
  ok(/\['반', '번호', '이름', '성취수준'\]\s*\n?\s*\.concat\(cols\)/.test(all),
    '입력 시트 헤더가 반/번호/이름/성취수준 + 입력항목 순서가 아님');
  ok(/getRange\(row, 5, 1, cols\.length\)/.test(src['70_Generate.gs']),
    '생성 로직이 5열부터 읽지 않음');
});

console.log('\n[예시 시트]');
t('예시 시트가 결과·바이트·검증 열을 가짐', () => {
  const i = all.indexOf('function exampleLayout_(');
  const body = all.slice(i, all.indexOf('\n}', i));
  const m = body.match(/var head = ([\s\S]*?);\n/);
  ok(m, 'exampleLayout_ 에 head 정의가 없음');
  const fixed = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  ['예시번호', '결과', '바이트', '검증'].forEach(n => ok(fixed.includes(n), '예시 헤더에 없음: ' + n));
});
t('readExamples_ 가 결과 열을 이름으로 찾음', () => {
  ok(/colOf_\(s, APP\.HEAD_ROW, '결과'\)/.test(src['20_Lib.gs']),
    '예시 결과 열을 위치로만 읽고 있음 — 열이 추가되면 깨짐');
});
t('writeExampleRows_ 의 열 수가 헤더와 맞음', () => {
  const i = all.indexOf('function writeExampleRows_(');
  const body = all.slice(i, all.indexOf('\n}', i));
  ok(/var n = 1 \+ cols\.length \+ 3;/.test(body), '예시번호 + 입력항목 + (결과·바이트·검증) 3열 구조가 아님');
  ok(/var cResult = 1 \+ cols\.length \+ 1;/.test(body), '결과 열 위치 계산이 바뀜');
});
t('예시 상한이 정의되어 있음', () => {
  ok(/var EXAMPLE_MAX = \d+;/.test(all), 'EXAMPLE_MAX 미정의 — 예시가 늘면 호출 비용이 무한정 커짐');
  ok(/var EXAMPLE_ROWS_DEFAULT = \d+;/.test(all), 'EXAMPLE_ROWS_DEFAULT 미정의');
  ok(/i < cap/.test(src['20_Lib.gs']), 'readExamples_ 가 상한을 적용하지 않음');
});
t('예시 기능 메뉴 핸들러가 모두 존재', () => {
  const defined = new Set([...all.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  ['addExampleRows', 'validateExamples', 'generateMoreExamples', 'repairExampleSheet']
    .forEach(n => ok(defined.has(n), '없는 함수: ' + n));
});
t('AI 생성 예시도 공통규칙을 따르도록 지시함', () => {
  const i = all.indexOf('function suggestExamples_(');
  const body = all.slice(i, all.indexOf('\n}\n', i));
  ok(/com\.WRITING_RULES/.test(body) && /com\.NEIS_RULES/.test(body),
    '예시 생성 프롬프트에 서술 규칙·기재 금지사항이 빠짐');
});

console.log('\n[안내문이 데이터로 읽히지 않는지]');
t('설정 시트들의 안내문은 1행 배너로만 존재', () => {
  ['buildRecordTypes', 'buildSubjects', 'buildCommonRules', 'buildActivityList', 'buildRoster']
    .forEach(fn => {
      const i = all.indexOf('function ' + fn + '(');
      const body = all.slice(i, all.indexOf('\n}', i));
      ok(!/noteRow_\(/.test(body), fn + ' 이 데이터 영역에 noteRow_ 를 쓰고 있음 (유령 행 발생)');
    });
});

console.log('\n[메뉴 ↔ 함수]');
t('모든 메뉴 항목의 핸들러가 정의되어 있음', () => {
  const defined = new Set([...all.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const menu = [...all.matchAll(/addItem\('[^']*',\s*'([^']+)'\)/g)].map(m => m[1]);
  const bad = menu.filter(n => !defined.has(n));
  ok(!bad.length, '없는 함수: ' + bad.join(', '));
  ok(menu.length >= 15, '메뉴 항목이 너무 적음');
});
t('HTML 이 호출하는 서버 함수가 모두 정의되어 있음', () => {
  const defined = new Set([...all.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  let h = '';
  fs.readdirSync(dir).filter(f => f.endsWith('.html'))
    .forEach(f => h += fs.readFileSync(path.join(dir, f), 'utf8'));
  const calls = [...new Set([...h.matchAll(/withFailureHandler\([\s\S]{0,400}?\)\s*\n?\s*\.([A-Za-z_$][\w$]*)\(/g)].map(m => m[1]))];
  const bad = calls.filter(n => !defined.has(n));
  ok(calls.length >= 5, '검출된 호출이 너무 적음: ' + calls.join(','));
  ok(!bad.length, '없는 함수: ' + bad.join(', '));
});

console.log('\n' + (fail ? `실패 ${fail}개 / ` : '') + `통과 ${pass}개`);
process.exit(fail ? 1 : 0);
