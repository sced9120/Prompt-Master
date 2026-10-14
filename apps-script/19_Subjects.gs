/**
 * 세특 작성 도우미 v3 — 📚 새 교과 만들기 (순수 함수: 시트·네트워크 없음, Node 시험 가능)
 * ---------------------------------------------------------------
 * 교과 이름 + 교육과정 자료(성취기준·교과 역량을 붙여 넣거나 드라이브 PDF) → [📚 교과영역] 한 줄
 * (키·표시명·분류·역할 표현·역량·서술 관점)과 추천 입력 항목.
 *
 * 같은 "이름: 값" 글 모양 하나를 AI 답, 세특 프롬프트 공방(웹)에서 만든 교과, 선생님끼리 나누는 글에
 * 함께 쓴다 — 어느 쪽에서 만든 것이든 [📚 새 교과 만들기] 창의 붙여 넣기 칸에 넣으면 읽힌다.
 *
 * 자료 없이 만든 줄에는 [교육과정 확인 필요] 를 붙이게 하고, 저장 전에 교사에게 보여 준다
 * (AI 가 교과 역량 이름을 그럴듯하게 지어내는 일을 막으려고).
 */

var SUBJECT_UNSURE = '[교육과정 확인 필요]';
var SUBJECT_SOURCE_MAX = 30000;   // 붙여 넣은 교육과정 글은 이만큼만 보낸다(글자)

/** 답에서 알아듣는 이름들 → 필드 */
var SUBJECT_FIELDS = [
  { f: 'key', names: ['키'] },
  { f: 'name', names: ['표시명', '과목명', '교과명'] },
  { f: 'kind', names: ['분류'] },
  { f: 'role', names: ['역할 표현', '역할'] },
  { f: 'comps', names: ['핵심역량', '교과 역량', '역량'] },
  { f: 'look', names: ['관찰 모습', '관찰할 모습'] },
  { f: 'comp', names: ['역량·서술 관점', '역량 서술 관점', '서술 관점'] },
  { f: 'columns', names: ['입력 항목', '추천 입력 항목'] },
  { f: 'basis', names: ['근거', '출처'] }
];

var SUBJECT_SYSTEM = [
  '당신은 2022 개정 교육과정에 밝은 고등학교 교육과정 전문가입니다.',
  '교사가 학교생활기록부 과목별 세부능력 및 특기사항(세특)을 AI 로 쓸 때 프롬프트에 넣을 "교과 정보"를 만듭니다.',
  '',
  '# 지킬 것',
  '- 교사가 준 교육과정 자료(교과 역량·핵심 아이디어·성취기준)가 있으면 그 자료의 말로 쓴다. 자료에 없는 역량 이름을 지어내지 않는다.',
  '- 자료가 없거나 모자라면 일반적인 교과 지식으로 쓰되, 확실하지 않은 줄 끝에 ' + SUBJECT_UNSURE + ' 를 붙인다.',
  '- 관찰 모습은 교사가 수업·평가 장면에서 실제로 볼 수 있는 학생의 행동으로 4~6줄 쓴다. 각 줄은 "~하는 모습"으로 끝낸다.',
  '- 관찰 모습에는 결과보다 탐구 과정·사고의 전개·태도의 변화가 드러나게 한다.',
  '- 입력 항목은 교사가 학생마다 적을 칸 이름 3~5개. 짧은 명사구로 쓰고 | 로 나눈다. 반·번호·이름·성취수준·최종본은 쓰지 않는다.',
  '- 대학명·기관명·수상·자격증·공인어학시험처럼 학생부에 쓸 수 없는 것을 예로 들지 않는다.',
  '',
  '# 출력 — 아래 모양 그대로. 머리말·설명·마크다운 없이',
  '키: (짧은 이름, 띄어쓰기 없이. 예: 화학, 공통국어1, 인공지능기초)',
  '표시명: (교과·과목의 정식 이름)',
  '분류: 교과',
  '역할 표현: 고등학교 ○○교사',
  '핵심역량: (교과 역량 이름을 쉼표로)',
  '관찰 모습:',
  '- …하는 모습',
  '- …하는 모습',
  '입력 항목: 항목1|항목2|항목3',
  '근거: (무엇을 보고 썼는지 — 교사가 준 자료의 어느 부분 / 일반 지식)'
].join('\n');

/**
 * AI 에게 보낼 사용자 글
 * @param {{name:string, level?:string, source?:string, note?:string, files?:string[]}} p
 */
function buildSubjectUser(p) {
  p = p || {};
  var L = [];
  L.push('교과(과목) 이름: ' + String(p.name || '').trim());
  L.push('학교급: ' + (String(p.level || '').trim() || '고등학교'));
  if (p.note && String(p.note).trim()) L.push('우리 학교·수업에서 강조할 점: ' + String(p.note).trim().replace(/\s*\n\s*/g, ' '));
  var src = String(p.source || '').trim();
  var files = (p.files || []).filter(String);
  if (src || files.length) {
    L.push('');
    L.push('# 교육과정 자료 (교사가 준 것 — 이 자료의 말로 쓴다)');
    if (files.length) L.push('첨부 파일: ' + files.join(', '));
    if (src) L.push(src.length > SUBJECT_SOURCE_MAX ? src.slice(0, SUBJECT_SOURCE_MAX) + '\n…(뒤는 줄임)' : src);
  } else {
    L.push('');
    L.push('# 교육과정 자료');
    L.push('(없음 — 일반적인 교과 지식으로 쓰고, 확실하지 않은 줄 끝에 ' + SUBJECT_UNSURE + ' 를 붙인다)');
  }
  return L.join('\n');
}

/** 시트 이름·키에 못 쓰는 문자를 지우고 띄어쓰기를 없앤 짧은 키 */
function subjectKeyOf(raw) {
  return String(raw || '').replace(/\(.*?\)/g, '').replace(/[\[\]\*\/\\\?:'"\s]/g, '').trim().slice(0, 20);
}

/** "이름: 값" 줄이면 [필드, 값], 아니면 null */
function subjectFieldOf_(line) {
  var m = /^\s*(?:[-*•]\s*)?\**\s*([가-힣·\s]{1,12}?)\s*\**\s*[:：]\s*(.*)$/.exec(line);
  if (!m) return null;
  var label = m[1].replace(/\s+/g, ' ').trim();
  for (var i = 0; i < SUBJECT_FIELDS.length; i++) {
    if (SUBJECT_FIELDS[i].names.indexOf(label) >= 0) return [SUBJECT_FIELDS[i].f, m[2].trim()];
  }
  return null;
}

/**
 * AI 답(또는 공방·다른 선생님이 준 글) → 교과 한 줄
 * @return {{key,name,kind,role,comp,columns:string[],basis,unsure:boolean,missing:string[]}}
 */
function parseSubjectAnswer(text) {
  var t = String(text || '').replace(/\r/g, '').replace(/^\s*```[a-z]*\s*$/gim, '').replace(/\*\*/g, '');
  var got = {}, cur = null;
  t.split('\n').forEach(function (raw) {
    var line = raw.replace(/\s+$/, '');
    var fv = subjectFieldOf_(line);
    if (fv) { cur = fv[0]; got[cur] = got[cur] ? got[cur] + '\n' + fv[1] : fv[1]; return; }
    if (!line.trim() || /^\s*#/.test(line)) return;
    if (cur === 'look' || cur === 'comp' || cur === 'comps' || cur === 'basis') got[cur] = (got[cur] ? got[cur] + '\n' : '') + line.trim();
  });
  var name = String(got.name || '').trim();
  var key = subjectKeyOf(got.key || name);
  if (!name) name = key;
  var plain = name.replace(/\(.*?\)/g, '').trim() || key;
  var kind = /공통/.test(got.kind || '') ? '공통' : '교과';
  var role = String(got.role || '').trim() || ('고등학교 ' + plain + '교사');

  var comp = String(got.comp || '').trim();
  if (!comp) {
    var comps = String(got.comps || '').trim().replace(/\.$/, '');
    var look = String(got.look || '').split('\n').map(function (x) { return x.trim(); }).filter(String)
      .map(function (x) { return /^[-•·*]\s*/.test(x) ? '- ' + x.replace(/^[-•·*]\s*/, '') : '- ' + x; });
    var lines = [];
    if (comps) lines.push(plain + '과 핵심역량: ' + comps + '.');
    comp = lines.concat(look).join('\n');
  }

  var columns = String(got.columns || '').split(/[|,\n]/).map(function (x) { return x.trim(); })
    .filter(function (x) { return x && ['반', '번호', '이름', '성취수준', '최종본', 'AI 결과', '생성', '모델', '바이트', '검증'].indexOf(x) < 0; });
  var seen = {};
  columns = columns.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).slice(0, 8);

  var missing = [];
  if (!key) missing.push('키');
  if (!comp) missing.push('역량·관찰 모습');
  return {
    key: key, name: name, kind: kind, role: role, comp: comp, columns: columns,
    basis: String(got.basis || '').trim(),
    unsure: (comp + '\n' + (got.basis || '')).indexOf(SUBJECT_UNSURE) >= 0,
    missing: missing
  };
}

/** 교과 한 줄 → 나누는 글(공방·시트·다른 선생님 모두 이 모양을 읽는다) */
function formatSubjectBlock(sub) {
  sub = sub || {};
  var L = ['키: ' + (sub.key || ''), '표시명: ' + (sub.name || sub.key || ''), '분류: ' + (sub.kind || '교과'),
           '역할 표현: ' + (sub.role || ''), '역량·서술 관점:'];
  String(sub.comp || '').split('\n').forEach(function (x) { if (x.trim()) L.push(x); });
  var cols = Array.isArray(sub.columns) ? sub.columns : String(sub.columns || '').split('|');
  cols = cols.map(function (x) { return String(x).trim(); }).filter(String);
  if (cols.length) L.push('입력 항목: ' + cols.join('|'));
  if (sub.basis) L.push('근거: ' + String(sub.basis).replace(/\s*\n\s*/g, ' '));
  return L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUBJECT_SYSTEM: SUBJECT_SYSTEM, SUBJECT_UNSURE: SUBJECT_UNSURE, buildSubjectUser: buildSubjectUser,
    subjectKeyOf: subjectKeyOf, parseSubjectAnswer: parseSubjectAnswer, formatSubjectBlock: formatSubjectBlock
  };
}
