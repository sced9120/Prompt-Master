/**
 * 세특 프롬프트 공방(web/prompt-studio.html)에 시트와 같은 엔진을 넣는다.
 *   node tools/build-studio.js        (npm run kit 에 포함)
 *
 * apps-script 의 순수 모듈(프리셋 · 프롬프트 엔진 · 2026 기재요령 규칙판 · 새 교과)을 그대로 이어 붙여
 * 페이지의 "@@ENGINE" 표시 사이에 넣는다. 그래서 공방이 조립하는 프롬프트, 바이트 한도 문장,
 * 금지어 검사, 새 교과 요청문·답 읽기가 시트와 글자 하나까지 같다. 규칙판이 바뀌면 이것만 다시 돌리면 된다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = ['00_Presets.gs', '10_Engine.gs', '16_Rules.gs', '19_Subjects.gs'];
const PAGE = path.join(root, 'web', 'prompt-studio.html');
const BEGIN = '/* @@ENGINE — tools/build-studio.js 가 넣는 자리. 손으로 고치지 마세요. */';
const END = '/* @@ENGINE-END */';

const strip = (code) => code.replace(/\nif \(typeof module !== 'undefined' && module\.exports\) \{[\s\S]*?\n\}\s*$/, '\n');
const body = SRC.map(f => '/* ── apps-script/' + f + ' ── */\n' + strip(fs.readFileSync(path.join(root, 'apps-script', f), 'utf8'))).join('\n');

const tail = `
var COMMON = {};
PRESET_COMMON.forEach(function (r) { COMMON[r.key] = r.body; });
return {
  version: APP.VERSION, rulesId: RULES_2026.id, rulesYear: RULES_2026.year, aiNotice: AI_NOTICE_2026,
  records: PRESET_RECORD_TYPES.map(function (r) {
    return { key: r.key, name: r.name, chars: r.chars, useGrade: r.useGrade, role: r.role, goal: r.goal, view: r.view, note: r.note,
             rules: RECORD_RULES_2026.hasOwnProperty(r.key) ? RECORD_RULES_2026[r.key] : '' };
  }),
  subjects: PRESET_SUBJECTS, common: COMMON, rules: RULES_2026.rules,
  byteLen: byteLen, buildPrompt: buildPrompt, activityBytes: activityBytes, splitBytes: splitBytes,
  validateResult: validateResult, parseColumns: parseColumns,
  SUBJECT_SYSTEM: SUBJECT_SYSTEM, SUBJECT_UNSURE: SUBJECT_UNSURE, buildSubjectUser: buildSubjectUser,
  parseSubjectAnswer: parseSubjectAnswer, formatSubjectBlock: formatSubjectBlock, subjectKeyOf: subjectKeyOf
};`;
const engine = 'var ENGINE = (function () {\n' + body + '\n' + tail + '\n})();';

// 브라우저처럼 아무것도 없는 곳에서 돌아가는지 먼저 확인
const box = {};
vm.createContext(box);
vm.runInContext(engine + '\nthis.__E = ENGINE;', box);
const E = box.__E;
if (!E.records.length || !E.subjects.length || !E.rules.length || typeof E.buildPrompt !== 'function') throw new Error('엔진을 만들지 못했습니다');

const page = fs.readFileSync(PAGE, 'utf8');
const a = page.indexOf(BEGIN), b = page.indexOf(END);
if (a < 0 || b < a) throw new Error('web/prompt-studio.html 에 @@ENGINE 표시가 없습니다');
const out = page.slice(0, a + BEGIN.length) + '\n' + engine + '\n' + page.slice(b);
fs.writeFileSync(PAGE, out);
console.log('web/prompt-studio.html  ' + Math.round(out.length / 1024) + 'KB · ' + E.version + ' · 규칙판 ' + E.rulesId +
  ' (' + E.rules.length + '개) · 기록 ' + E.records.length + ' · 교과 ' + E.subjects.length);
