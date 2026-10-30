/* v3.8.4 — AI 투 검사 · 다듬기(im-not-ai 참고) · 💎 Gem 으로 쓰기 · 📄 스캔 문서 → 표 Gem (node test/gem.test.js) */
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

const P = boot();
const ai = (s) => P.validateResult(s, 0, P.AI_TELL_RULES, [], { spell: false }).issues;   // 분량 검사 없이 AI 투만

console.log('\n[AI 투 규칙 (순수)]');
// 규칙마다 걸려야 하는 문장 하나씩 — AI_TELL_RULES 와 같은 순서
const HIT = ['수학에 있어서 개념을 정리함.', '통계와 관련하여 자료를 모음.', '실험 결과에 기반하여 결론을 냄.', '수학에 관심을 가지고 있음.',
  '문제가 해결되어짐.', '친구에 의해 제안된 방법을 씀.', '수업에서의 태도가 좋음.', '뛰어난 이해력을 보여줌.', '단순한 계산을 넘어 원리를 탐구함.',
  '이를 통해 성장함.', '결론적으로 우수함.', '시사하는 바가 큼.', '주목할 점은 끈기임.', '깊이 있는 이해를 함.', '협력의 중요성을 깨달음.',
  '진로를 정하는 계기가 됨.', '역량을 함양함.', '한 단계 성장함.', '탁월한 실력.', '다양한 활동을 통해 배움.',
  '질문하는 모습을 보임. 설명하는 모습을 보임.', '발표가 돋보임. 태도가 돋보임.', '조사하며, 정리하고, 발표하지만, 끝냄.'];
t('규칙 ' + P.AI_TELL_RULES.length + '개 — 모두 [확인], 이름이 "AI 투", 정규식이 맞고, 각자 제 문장에서 걸림', () => {
  eq(P.AI_TELL_RULES.length, HIT.length, '시험 문장 수');
  P.AI_TELL_RULES.forEach((r, i) => {
    ok(r.level === 'check' && /^AI 투 · /.test(r.label) && r.why, '모양: ' + JSON.stringify(r));
    new RegExp(r.re, 'g');
    ok(new RegExp(r.re).test(HIT[i]), i + '번 규칙이 제 문장을 못 잡음: ' + r.re + ' / ' + HIT[i]);
    ok(r.re === r.re.trim(), i + '번 정규식 끝에 빈칸(시트가 지움)');
  });
});
t('평범한 세특 문장은 걸리지 않음 (한 번 쓴 "모습을 보임" · 쉼표 두 번도)', () => {
  eq(ai('함수 그래프를 직접 그려 모둠원에게 설명함. 질문을 받고 예를 바꿔 다시 설명하는 모습을 보임. 오답을 고쳐, 다음 시간에 발표하며, 끝까지 맡음.').map(x => x.label), []);
  eq(ai('친구들과의 협업으로 실험을 설계함. 앞으로의 계획을 세움. 진로의 방향을 정함.').map(x => x.label), [], '와의 · 앞으로의 · 진로의 는 자연스러운 말');
});
t('되풀이 · 쉼표 규칙은 짧은 구절만 보여 줌', () => {
  const r = ai('설명하는 모습을 보임. 다시 묻는 모습을 보였음.');
  eq(r.length, 1); eq(r[0].hit, '모습을 보임');
  ok(ai('정리하며, 묻고, 고치지만, 끝냄.')[0].hit.length < 20);
});
t('생성 프롬프트에 [피할 표현] — 서술 규칙 바로 뒤, 비우면 빠짐, 직접작성 토큰', () => {
  const com = {}; P.PRESET_COMMON.forEach(r => { com[r.key] = r.body; });
  eq(com.AVOID_RULES, P.AVOID_RULES_DEFAULT, '00_Presets 와 16_Rules 의 기본 문구가 같아야 함');
  const base = { activity: { name: 'a', recordKey: '과세특', columns: 'x' }, record: P.PRESET_RECORD_TYPES[0], subject: P.PRESET_SUBJECTS[1] };
  ok(/# 서술 규칙\n[\s\S]*?\n\n# 피할 표현\nAI가 쓴 글에서 흔한 말투/.test(P.buildPrompt(Object.assign({ common: com }, base))));
  ok(!/# 피할 표현/.test(P.buildPrompt(Object.assign({ common: Object.assign({}, com, { AVOID_RULES: '' }) }, base))));
  eq(P.buildPrompt({ activity: { mode: '직접작성', custom: '{AVOID_RULES}', recordKey: '과세특' }, record: P.PRESET_RECORD_TYPES[0], subject: {}, common: com }), P.AVOID_RULES_DEFAULT);
});
t('다듬기 요청문 — 걸린 표현만 짚어 줌', () => {
  const u = P.buildPolishUser('이를 통해 성장함.', [{ label: 'AI 투 · 관용구', hit: '이를 통해', fix: '지우고 앞 문장과 바로 잇기' }, { label: '맞춤법', hit: '할수' }]);
  ok(/^# 글\n이를 통해 성장함\.\n\n# 검사에서 걸린 표현\n- 관용구: 이를 통해 \(권장: 지우고/.test(u) && !/할수/.test(u), u);
  ok(/규칙에 걸린 것은 없다/.test(P.buildPolishUser('좋음.', [])));
  ok(/과윤문|30%/.test(P.POLISH_SYSTEM) && /사실·수치·고유명사/.test(P.POLISH_SYSTEM));
});

console.log('\n[AI 투 — 시트]');
t('설치하면 [📏 기재요령]에 AI 투 줄(출처 "AI 투(기본)"), 검사에선 [확인]만 — 자동 고쳐쓰기는 안 부름', () => {
  const D = boot();
  const rows = D.readRuleRows_(D.__ss.getSheetByName('📏 기재요령'));
  eq(rows.filter(r => r[6] === 'AI 투(기본)').length, D.AI_TELL_RULES.length);
  const v = D.inspect_('이를 통해 협력의 중요성을 깨달음.', 1500);
  ok(v.issues.some(x => x.label === 'AI 투 · 관용구') && v.issues.some(x => x.label === 'AI 투 · 상투어'), JSON.stringify(v.issues));
  ok(v.ok && !D.needsRepair(v), '[확인]이라 고쳐쓰기 안 함');
});
t('구조 복구를 다시 눌러도 겹치지 않고, 규칙판 업데이트 때 선생님이 끈 [사용]도 그대로', () => {
  const D = boot();
  const s = D.__ss.getSheetByName('📏 기재요령');
  const n = D.readRuleRows_(s).length;
  D.installCore_();
  eq(D.ensureAiTellRows_(), 0); eq(D.readRuleRows_(s).length, n, '겹침');
  const rows = D.readRuleRows_(s);
  const at = rows.findIndex(r => r[6] === 'AI 투(기본)');
  s.getRange(4 + at, 1).setValue(false);   // 하나 끄기
  s.getRange(4 + rows.length, 1, 1, 7).setValues([[true, '확인', '내 학교', '우리말', '', '', '내 학교']]);
  const pack = JSON.parse(JSON.stringify(D.RULES_2026)); pack.id = '2026.9';
  D.applyRulePack_(pack);
  const after = D.readRuleRows_(s);
  eq(after.length, n + 1, '규칙판 + AI 투 + 내 학교');
  eq(after.filter(r => r[6] === 'AI 투(기본)' && r[0] === false).length, 1, '끈 줄 그대로');
  ok(after.some(r => r[6] === '내 학교'));
  ok(D.isBuiltinRow('AI 투(기본)') && D.isBuiltinRow('2026 기재요령') && !D.isBuiltinRow('내 학교'));
});
t('이전 파일에서 가져오기 — 예전 파일의 AI 투 줄은 옮기지 않고 "내 학교" 줄만', () => {
  const D = boot();
  const s = D.__ss.getSheetByName('📏 기재요령');
  const n = D.readRuleRows_(s).length;
  const head = [['배너'], [''], D.RULES_HEAD];
  const book = {}; book['📏 기재요령'] = head.concat([[true, '확인', 'AI 투 · 관용구', '옛날 패턴', '', '', 'AI 투(기본)'], [true, '확인', '우리 학교', '보라색', '', '', '내 학교']]);
  const rep = {};
  D.importRules_(book, rep);
  eq(rep.rules, 1); eq(D.readRuleRows_(s).length, n + 1);
});
t('[피할 표현] 칸이 없는 예전 시트도 기본 문구로, 비워 두면 뺌 — 공방도 같게', () => {
  const D = boot();
  const s = D.__ss.getSheetByName('📐 공통규칙');
  const keys = s.getRange(3, 1, s.getLastRow() - 2, 1).getValues().map(r => r[0]);
  const row = 3 + keys.indexOf('AVOID_RULES');
  ok(row >= 3, '설치하면 칸이 있음');
  D.createActivity_({ key: '탐구', name: '탐구', recordKey: '과세특', subjectKey: '수학', columns: '주제' });
  s.getRange(row, 1).setValue('');   // 칸이 없는 것처럼
  ok(/# 피할 표현\nAI가 쓴/.test(D.promptFor_(D.getActivity_('탐구'), '')), '없으면 기본');
  eq(D.studioContext().common.AVOID_RULES, D.AVOID_RULES_DEFAULT);
  s.getRange(row, 1).setValue('AVOID_RULES'); s.getRange(row, 3).setValue('');
  ok(!/# 피할 표현/.test(D.promptFor_(D.getActivity_('탐구'), '')), '비우면 뺌');
  eq(D.studioContext().common.AVOID_RULES, '');
});
t('🪶 AI 투 다듬기 — 키 없으면 요청문, 키 있으면 걸린 곳 목록과 함께 불러 고칠 목록', () => {
  const D = boot();
  const text = '이를 통해 수학에 있어서 개념을 정리함.';
  throws(() => D.aiPolish({ text }), /API 키가 없어/);
  const req = D.polishRequest({ text });
  ok(/목록으로 보여 주고/.test(req) && /- 관용구: 이를 통해/.test(req) && /- 번역투: 에 있어서/.test(req) && !/JSON 하나만/.test(req), req.slice(-300));
  D.setKey_('gemini', 'AIza');
  let sent = null;
  D.__fetch.handler = (url, opt) => { sent = JSON.parse(opt.payload); return gem('{"changes":[{"from":"이를 통해 ","to":"","why":"결산 표현"},{"from":"수학에 있어서","to":"수학에서","why":"번역투"},{"from":"없는 구절","to":"x"}]}'); };
  const r = D.aiPolish({ text });
  eq(r.changes.map(c => c.to), ['', '수학에서'], '글에 없는 구절은 버림');
  eq(r.fixed, '수학에서 개념을 정리함.');
  ok(/다듬는 한국어 교정자/.test(sent.systemInstruction.parts[0].text) && /# 검사에서 걸린 표현\n- 번역투/.test(sent.contents[0].parts[0].text));
});

console.log('\n[💎 Gem 으로 쓰기]');
t('시작하기 [Gem으로] — 키 없이로 맞추고 Gem 표시', () => {
  const D = boot();
  const r = D.onboardUseGem();
  ok(r.ok && r.status.manual && r.status.gem && /Gem으로 쓰기로/.test(r.message), JSON.stringify(r.status.gem));
});
t('💎 Gem 시트 — 빈 바로 쓰기 시트 + Gem 안내 머리말 + 이 시트의 Gem 지침', () => {
  const D = boot();
  D.onboardSaveRoster('1\t1\t김하늘');
  eq(D.quickContext().suggestGem, 'Gem1');
  const r = D.createQuickSheet({ kind: 'Gem', name: 'Gem1', recordKey: '과세특', subjectKey: '수학' });
  eq(r.inSheet, 'Gem1 ▸입력');
  const s = D.__ss.getSheetByName(r.inSheet);
  ok(/💎 Gem 시트/.test(String(s.getRange(1, 4).getValue())), '머리말');
  eq(D.getActivity_(r.key).mode, '바로쓰기');
  ok(/# 사용법\n교사가 학생 자료를 붙여 넣으면/.test(r.gem) && /# 피할 표현/.test(r.gem) && /\[S1\] \[S2\]/.test(r.gem), r.gem.slice(-200));
  eq(D.quickContext().suggestGem, 'Gem2');
  eq(D.gemFor(r.key).gem, r.gem);
});

console.log('\n[📄 스캔 문서 → 표 Gem]');
t('Gem 전용 지침 — 대시보드 원격 지침을 읽지 않음', () => {
  const D = boot();
  let fetched = 0;
  D.__fetch.handler = () => { fetched++; return { code: 200, body: { ocr: { prompt: '대시보드 지침' } } }; };
  const a = D.ocrGemContext();
  eq(fetched, 0);
  ok(a.gem === D.OCR_GEM_TEXT && a.chars === a.gem.length && a.gem.indexOf('대시보드 지침') < 0);
});
t('지침 내용: 열 정하기 · 묻기 · 양식 문구 빼기 · 회색 글씨 · 이어 쓰기', () => {
  const D = boot(), g = D.OCR_GEM_TEXT;
  ok(/^# 역할/.test(g) && g.indexOf('\r') < 0);
  ok(/학생 1명 = 1행/.test(g) && /반 \| 번호 \| 이름 \| 주제 \| 탐구 동기 \| 탐구 내용 \| 결론/.test(g), '기본 열 예시');
  ok(/표를 만들지 말고 먼저 물어봅니다/.test(g) && /"열: …"/.test(g), '판단이 어려우면 묻기');
  ok(/글자 색으로 판단하지 마십시오/.test(g) && /모든 학생 파일에 똑같이 인쇄된 지시문/.test(g), '양식 문구');
  ok(/한 행으로 합칩니다/.test(g) && /광고/.test(g) && /\(미선택\)/.test(g) && /\[불확실: 김태용\/김태영\]/.test(g));
  ok(/같은 열머리 줄부터 다시 쓰고/.test(g) && /CSV 코드 블록 하나/.test(g), '이어 쓰기 · CSV');
});
t('내려받을 .txt 와 Claude 스킬 zip', () => {
  const D = boot();
  const f = D.ocrGemFiles();
  eq([f.txt.file, f.zip.file], ['스캔문서_표_지침.txt', 'scan-to-table-ko.zip']);
  ok(f.txt.b64.length > 1000 && f.zip.b64.length > 0);
  const md = D.buildOcrSkillMd(D.buildOcrGemText());
  ok(/^---\nname: scan-to-table-ko\ndescription: 학생이 낸 보고서/.test(md) && md.indexOf(D.OCR_GEM_TEXT) > 0);
});

console.log('\n[공방 — Gem · 스킬 · AI 투]');
t('공방 페이지 엔진에 Gem · 스킬 만들기와 AI 투 규칙이 들어 있음', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'prompt-studio.html'), 'utf8');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const box = {}; vm.createContext(box); vm.runInContext(code + ';this.E = ENGINE;', box);
  const E = box.E;
  eq([E.packCount, E.aiTellCount, E.rules.length], [P.RULES_2026.rules.length, P.AI_TELL_RULES.length, P.RULES_2026.rules.length + P.AI_TELL_RULES.length]);
  ok(typeof E.buildGemText === 'function' && typeof E.buildSkillMd === 'function' && E.skillName('과세특', 1));
  ok(/# 피할 표현/.test(E.buildPrompt({ activity: { name: 'a', recordKey: '과세특', columns: 'x' }, record: E.records[0], subject: E.subjects[1], common: E.common })));
  ok(/id="gemCopy"/.test(html) && /id="skillCopy"/.test(html));
});

console.log('\n' + (fail ? '실패 ' + fail + '개 / ' : '') + '통과 ' + pass + '개');
if (fail) process.exit(1);
