/**
 * 세특 프롬프트 공방(web/prompt-studio.html)에 시트와 같은 엔진을 넣는다.
 *   node tools/build-studio.js        (npm run build 가 맨 먼저 부른다)
 *
 * 같은 페이지를 apps-script/UI_Studio.html 로도 써서 시트 메뉴 [🧪 세특 프롬프트 공방]이 연다(88_Studio.gs).
 * 시트 안에서는 페이지가 google.script.run 을 보고 그 시트의 자료를 받아 쓴다. 웹에서는 내장 기본값.
 *
 * apps-script 의 순수 모듈(프리셋 · 프롬프트 엔진 · 2026 기재요령 규칙판 · 새 교과)을 그대로 이어 붙여
 * 페이지의 "@@ENGINE" 표시 사이에 넣는다. 그래서 공방이 조립하는 프롬프트, 바이트 한도 문장,
 * 금지어 검사, 새 교과 요청문·답 읽기가 시트와 글자 하나까지 같다. 규칙판이 바뀌면 이것만 다시 돌리면 된다.
 *
 * 버튼 아이콘은 Lucian Icons(MIT, tools/icons/*.json)를 움직임 없는 기본 모습으로 그려 "@@ICONS" 자리에 넣는다.
 * 페이지에서는 data-icon="copy" 처럼 이름만 적는다(시작하기 시트 버튼은 tools/make-buttons.py).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const SRC = ['00_Presets.gs', '10_Engine.gs', '16_Rules.gs', '17_Design.gs', '19_Subjects.gs'];
const PAGE = path.join(root, 'web', 'prompt-studio.html');
const BEGIN = '/* @@ENGINE — tools/build-studio.js 가 넣는 자리. 손으로 고치지 마세요. */';
const END = '/* @@ENGINE-END */';

const UI = path.join(root, 'apps-script', 'UI_Studio.html');
const ICON_DIR = path.join(root, 'tools', 'icons');
const ICON_BEGIN = '/* @@ICONS — tools/build-studio.js 가 넣는 자리. 손으로 고치지 마세요. */';
const ICON_END = '/* @@ICONS-END */';

// make-buttons.py 의 static_svg 와 같은 방식. 선은 글자색(currentColor), 강조와 옅은 면은 아이콘 색(--ic, 초록 버튼에서는 글자색)
function staticSvg(d) {
  const rep = {
    s: 'style="fill:var(--ic);fill-opacity:.2"', t: 'style="fill:var(--ic);fill-opacity:.2;stroke:none"',
    a: 'style="stroke:var(--ic)"', f: 'style="fill:var(--ic);stroke:none"',
    k: 'style="fill:currentColor;stroke:none"', y: 'style="fill:#F4AF2D;stroke:none"', e: 'style="stroke:#F05465"'
  };
  const poses = d.poses || {}, pose = {};
  [poses['*'] || {}, poses[d.defaultState || ''] || {}].forEach(p => Object.keys(p).forEach(k => { pose[k] = Object.assign(pose[k] || {}, p[k]); }));
  const hidden = part => ['opacity', 'draw', 'scale'].some(x => (pose[part] || {})[x] === 0);
  let body = d.svg.replace(/class="([saftkye])"/g, (m, c) => rep[c]);
  body = body.replace(/<(path|circle|rect|ellipse|line|polyline)\b[^>]*data-part="([\w-]+)"[^>]*\/>/g, (m, t, p) => hidden(p) ? '' : m);
  body = body.replace(/<g data-part="([\w-]+)"[^>]*>[\s\S]*?<\/g>/g, (m, p) => hidden(p) ? '' : m);
  body = body.replace(/\sdata-part="[\w-]+"/g, '');
  return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="--ic:' + d.color + '" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
}
function iconsJs(page) {
  const used = Array.from(new Set((page.match(/data-icon="([\w-]+)"|ICONS\.([\w-]+)/g) || []).map(m => m.replace(/^data-icon="|"$|^ICONS\./g, '')))).sort();
  const map = {};
  used.forEach(id => {
    const f = path.join(ICON_DIR, id + '.json');
    if (!fs.existsSync(f)) throw new Error('아이콘 정의가 없습니다: tools/icons/' + id + '.json');
    map[id] = staticSvg(JSON.parse(fs.readFileSync(f, 'utf8')));
  });
  return 'const ICONS = ' + JSON.stringify(map, null, 1) + ';';
}

function run() {
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
  subjects: PRESET_SUBJECTS, common: COMMON,
  oldNeis: NEIS_RULES_2026_1, oldWrite: OLD_COMMON_2026_1.WRITING_RULES, rules: RULES_2026.rules.concat(AI_TELL_RULES),
  packCount: RULES_2026.rules.length, aiTellCount: AI_TELL_RULES.length,
  buildGemText: buildGemText, buildSkillMd: buildSkillMd, skillName: skillName,
  byteLen: byteLen, buildPrompt: buildPrompt, activityBytes: activityBytes, splitBytes: splitBytes,
  validateResult: validateResult, parseColumns: parseColumns, exampleValuesFrom: exampleValuesFrom,
  DESIGN_SYSTEM: DESIGN_SYSTEM, buildDesignUser: buildDesignUser, parseDesignAnswer: parseDesignAnswer, suggestBytes: suggestBytes,
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
let out = page.slice(0, a + BEGIN.length) + '\n' + engine + '\n' + page.slice(b);
const ia = out.indexOf(ICON_BEGIN), ib = out.indexOf(ICON_END);
if (ia < 0 || ib < ia) throw new Error('web/prompt-studio.html 에 @@ICONS 표시가 없습니다');
out = out.slice(0, ia + ICON_BEGIN.length) + '\n' + iconsJs(out.slice(0, ia) + out.slice(ib)) + '\n' + out.slice(ib);
fs.writeFileSync(PAGE, out);
fs.writeFileSync(UI, '<meta charset="utf-8">\n<!-- 자동 생성: web/prompt-studio.html → tools/build-studio.js. 여기를 고치지 말고 web/prompt-studio.html 을 고치세요. -->\n' + out);
console.log('web/prompt-studio.html  ' + Math.round(out.length / 1024) + 'KB · ' + E.version + ' · 규칙판 ' + E.rulesId +
  ' (' + E.packCount + '개 + AI 투 ' + E.aiTellCount + '개) · 기록 ' + E.records.length + ' · 교과 ' + E.subjects.length);
}

if (require.main === module) run();
module.exports = run;
