/* v3.9 — 🔄 새 버전 알림 · 📥 이전 파일에서 가져오기
   (node test/update.test.js) */
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
  g.__docProps.setProperty('RULES_CHECKED_AT', String(Date.now()));
  if (!(opts && opts.updateCheck)) g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  return ctx;
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n       ')); fail++; }
}
const ok = (c, m) => { if (!c) throw new Error(m || '조건 불만족'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m ? m + ' — ' : '') + '기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a)); };

/** 가짜 스프레드시트 → xlsx 안 XML 들 (구글 내보내기처럼 글은 sharedStrings, 참거짓은 t="b") */
function toXlsx(ss) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const shared = [], idx = new Map();
  const si = s => { if (!idx.has(s)) { idx.set(s, shared.length); shared.push(s); } return idx.get(s); };
  const col = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const parts = {};
  const sheets = ss.getSheets();
  let wb = '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  let rels = '<?xml version="1.0"?><Relationships>';
  sheets.forEach((s, i) => {
    wb += '<sheet name="' + esc(s.getName()) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 3) + '"/>';
    rels += '<Relationship Id="rId' + (i + 3) + '" Type="worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    const lr = s.getLastRow(), lc = s.getLastColumn();
    const v = lr && lc ? s.getRange(1, 1, lr, lc).getValues() : [];
    let x = '<?xml version="1.0"?><worksheet><cols><col min="1" max="3" width="9"/></cols><sheetData>';
    v.forEach((row, r) => {
      const cells = row.map((val, c) => {
        if (val === '' || val === null || val === undefined) return '';
        const ref = col(c) + (r + 1);
        if (typeof val === 'boolean') return '<c r="' + ref + '" t="b"><v>' + (val ? 1 : 0) + '</v></c>';
        if (typeof val === 'number') return '<c r="' + ref + '" s="1"><v>' + val + '</v></c>';
        return '<c r="' + ref + '" t="s"><v>' + si(String(val)) + '</v></c>';
      }).join('');
      if (cells) x += '<row r="' + (r + 1) + '">' + cells + '</row>';
    });
    parts['xl/worksheets/sheet' + (i + 1) + '.xml'] = x + '</sheetData></worksheet>';
  });
  parts['xl/workbook.xml'] = wb + '</sheets></workbook>';
  parts['xl/_rels/workbook.xml.rels'] = rels + '</Relationships>';
  parts['xl/sharedStrings.xml'] = '<?xml version="1.0"?><sst>' + shared.map(s => '<si><t xml:space="preserve">' + esc(s) + '</t></si>').join('') + '</sst>';
  return parts;
}

const P = boot();

console.log('\n[새 버전 — 순수]');
t('버전 비교', () => {
  eq(P.compareVersions('v3.9.0', 'v3.8.2'), 1); eq(P.compareVersions('v3.8.2', 'v3.8.2'), 0);
  eq(P.compareVersions('3.8.10', 'v3.8.9'), 1); eq(P.compareVersions('v3.10.0', 'v3.9.9'), 1); eq(P.compareVersions('v3.8', 'v3.8.1'), -1);
});
t('version.json 읽기 — 이상한 사본 주소는 원본 /copy 로', () => {
  const i = P.parseVersionInfo(JSON.stringify({ version: '3.9.1', date: '2026-10-21', notes: ['가', '', '나'], copyUrl: 'https://evil.example/copy' }));
  eq(i.version, 'v3.9.1'); eq(i.notes.length, 2); eq(i.copyUrl, P.MASTER_COPY_URL);
  eq(P.parseVersionInfo('<html>404</html>'), null); eq(P.parseVersionInfo('{"version":""}'), null);
  const ok2 = P.parseVersionInfo({ version: 'v4.0.0', copyUrl: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/copy' });
  ok(/1AbCdEf/.test(ok2.copyUrl));
});
t('지금 판과 비교', () => {
  const s = P.updateState('v3.9.0', P.parseVersionInfo({ version: 'v3.9.1', notes: ['고침'] }));
  ok(s.available); eq(s.latest, 'v3.9.1');
  ok(!P.updateState('v3.9.1', P.parseVersionInfo({ version: 'v3.9.1' })).available);
  ok(!P.updateState('v3.9.1', null).available);
});
t('시트 링크에서 ID', () => {
  eq(P.spreadsheetIdIn('https://docs.google.com/spreadsheets/d/11FNX77xBegfn1lw0GhkBAFvLtyxm8NS1ktfbs309vZM/edit?gid=2069114757#gid=2069114757'), '11FNX77xBegfn1lw0GhkBAFvLtyxm8NS1ktfbs309vZM');
  eq(P.spreadsheetIdIn('https://docs.google.com/spreadsheets/u/1/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/copy'), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  eq(P.spreadsheetIdIn('  1AbCdEfGhIjKlMnOpQrStUvWxYz012345 '), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  eq(P.spreadsheetIdIn('https://example.com/abc'), '');
});

console.log('\n[xlsx 읽기 — 순수]');
t('공유 글 · 바로 쓴 글 · 서식 run · 참거짓 · 숫자 · 빈 칸 · 이름 이스케이프', () => {
  const book = P.readXlsxParts({
    'xl/workbook.xml': '<workbook><sheets><sheet name="🗂 활동목록 &amp; 기타" sheetId="1" r:id="rId9"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId9" Type="x" Target="/xl/worksheets/a.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>활동키</t></si><si><r><t>탐구</t></r><r><rPr/><t xml:space="preserve"> 과정 &lt;1&gt;</t></r></si><si/></sst>',
    'xl/worksheets/a.xml': '<worksheet><sheetData><row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" t="s"><v>1</v></c></row>' +
      '<row r="3" spans="1:4"><c r="A3" t="inlineStr"><is><t>줄&#10;바꿈</t></is></c><c r="B3" t="b"><v>1</v></c><c r="C3"><v>1500</v></c><c r="D3" s="2"/></row>' +
      '<row r="5"/></sheetData></worksheet>'
  });
  const rows = book['🗂 활동목록 & 기타'];
  ok(rows, Object.keys(book).join(','));
  eq(rows[0].length, 4); eq(rows[0][0], '');
  eq(rows[1][0], '활동키'); eq(rows[1][1], ''); eq(rows[1][2], '탐구 과정 <1>');
  eq(rows[2][0], '줄\n바꿈'); eq(rows[2][1], true); eq(rows[2][2], 1500);
  eq(rows.length, 5);
});
t('r 속성이 없는 칸도 순서대로', () => {
  const r = P.parseSheetXml('<sheetData><row><c t="s"><v>0</v></c><c><v>2</v></c></row></sheetData>', ['가']);
  eq(r[0][0], '가'); eq(r[0][1], 2);
});
t('표 합치기 — 고친 칸만, 새 파일이 이미 고친 칸은 두고, 옛 기본 문구는 고친 것으로 안 봄', () => {
  const presets = { A: { body: '기본' }, B: { body: '기본B' }, C: { body: '새 기본' } };
  P.OLD_PRESET_TEXTS.push('옛 기본');
  const plan = P.mergeKeyed(
    [{ k: 'A', body: '내가 고침' }, { k: 'B', body: '내가 고침B' }, { k: 'C', body: '옛 기본' }, { k: 'D', body: '새 줄' }, { k: 'E', body: '카드' }],
    [{ k: 'A', body: '기본' }, { k: 'B', body: '새 파일에서 고침' }, { k: 'C', body: '새 기본' }, { k: 'E', body: '' }],
    presets, 'k', ['body']);
  P.OLD_PRESET_TEXTS.pop();
  eq(plan.updates.length, 2, JSON.stringify(plan.updates));
  eq(plan.updates[0].key, 'A'); eq(plan.updates[1].key, 'E'); eq(plan.updates[1].value, '카드');
  eq(plan.appends.length, 1); eq(plan.appends[0].k, 'D');
});
t('예전 활동 줄 → 정의 (v3.7 [글자수] · 예시 시트 · 직접작성)', () => {
  const def = P.activityDefFromOld({ '활동키': '탐구', '활동명': '탐구 보고서', '기록종류': '과세특', '교과영역': '수학', '글자수': 400,
    '입력 항목': '주제|과정', '프롬프트 모드': '직접작성', '직접 작성 프롬프트': '나만의 지시', '입력 시트': '탐구 ▸입력', '예시 시트': '탐구 ▸예시' },
    [['배너'], [''], ['예시번호', '주제', '과정', '결과', '바이트'], [1, '급식', '설문', '잘함.', 9], [2, '', '', '', '']]);
  eq(def.bytes, 1200); eq(def.columns.join(','), '주제,과정'); eq(def.mode, '직접작성'); eq(def.custom, '나만의 지시');
  eq(def.examples.length, 1); eq(def.examples[0].values[0], '급식'); eq(def.examples[0].result, '잘함.');
});
t('학생 줄 옮기기 — 머리글 이름으로, 바이트는 비움, 반↔학년-반', () => {
  const old = [['제목'], [''], ['학년-반', '번호', '이름', '성취수준', '주제', '생성', 'AI 결과', '최종본', '바이트', '검증'],
               ['2-3', 1, '김하늘', '', '급식', true, '초안', '최종', 30, '✓'], ['', '', '', '', '', false, '', '', '', '']];
  const out = P.remapStudentRows(old, ['반', '번호', '이름', '성취수준', '주제', '새 항목', '생성', '모델', 'AI 결과', '최종본', '바이트', '검증'], 2);
  eq(out.length, 1);
  eq(out[0].join('|'), '2-3|1|김하늘||급식||true||초안|최종||✓');
});

console.log('\n[새 버전 알림]');
t('하루 한 번 확인 · 새 판이면 토스트 한 번만 · 같은 판이면 조용히', () => {
  const C = boot({ updateCheck: true });
  C.installCore_();
  let calls = 0;
  C.__fetch.handler = (url) => { calls++; ok(/version\.json/.test(url), url); return { code: 200, body: { version: 'v99.0.0', notes: ['무엇'], date: '2099-01-01' } }; };
  const toasts = () => C.__ss.__toasts || [];
  const st = C.autoUpdateCheck_();
  ok(st && st.available, JSON.stringify(st)); eq(calls, 1);
  eq(C.autoUpdateCheck_(), null, '하루 안에는 다시 묻지 않음'); eq(calls, 1);
  C.__docProps.setProperty('UPDATE_CHECKED_AT', '0');
  C.autoUpdateCheck_(); eq(calls, 2);
  eq(C.__docProps.getProperty('UPDATE_TOLD'), 'v99.0.0');
  eq(toasts().filter(m => /새 버전 v99/.test(m)).length, 1, '같은 판은 한 번만 알림');
  const s2 = C.updateStatus(false);
  ok(s2.available && s2.latest === 'v99.0.0' && /CURRENT_SHEET_ID/.test(s2.fileUrl), JSON.stringify(s2));
  ok(C.onboardStatus().update.available, '시작하기 창에도 알림');
});
t('네트워크가 안 되면 조용히(시작하기·생성이 멈추지 않음)', () => {
  const C = boot({ updateCheck: true });
  C.installCore_();
  C.__fetch.handler = () => { throw new Error('offline'); };
  const a = C.autoUpdateCheck_();
  ok(!a || !a.available, JSON.stringify(a));
  const st = C.updateStatus(true);
  ok(!st.available && !st.checked);
});
t('메뉴와 창', () => {
  ok(typeof P.openUpdateDialog === 'function' && typeof P.openImportDialog === 'function');
  P.openUpdateDialog('import');
  const tpl = P.__templates[P.__templates.length - 1];
  eq(tpl.file, 'UI_Update'); eq(tpl.tab, 'import');
  ok(fs.existsSync(path.join(dir, 'UI_Update.html')));
  const html = fs.readFileSync(path.join(dir, 'UI_Update.html'), 'utf8');
  ok(/<meta charset="utf-8">/.test(html) && /\[hidden\]\s*\{\s*display:none\s*!important/.test(html));
  ['updateStatus', 'importPreview', 'importFromOld'].forEach(fn => ok(html.indexOf('.' + fn + '(') >= 0, fn));
});

console.log('\n[이전 파일에서 가져오기 — 끝까지]');
function makeOld() {
  const O = boot();
  O.installCore_();
  O.rosterSave({ text: '1\t1\t김하늘\n1\t2\t박서준\n1\t3\t이유나', mode: 'class' });
  const made = O.createActivity_({ key: '탐구', name: '수학 탐구', recordKey: '과세특', subjectKey: '수학', bytes: 900,
    columns: '탐구 주제|탐구 과정', desc: '통계 탐구', examples: [{ values: ['급식', '설문'], result: '예시 세특 문장임.' }, { values: ['교통', '관찰'], result: '두 번째 예시임.' }] });
  const inS = O.__ss.getSheetByName(made.inSheet);
  const head = inS.getRange(3, 1, 1, inS.getLastColumn()).getValues()[0];
  const c = n => head.indexOf(n) + 1;
  inS.getRange(4, c('탐구 주제')).setValue('급식 잔반');
  inS.getRange(4, c('AI 결과')).setValue('AI 초안 문장임.');
  inS.getRange(4, c('최종본')).setValue('선생님이 다듬은 최종 문장임.');
  inS.getRange(5, c('탐구 주제')).setValue('교통량');
  inS.getRange(5, c('생성')).setValue(true);
  O.createQuickSheet({ name: '수업 태도', recordKey: '과세특', subjectKey: '수학', desc: '' });
  // 직접작성 활동
  O.createActivity_({ key: '직접', name: '직접 쓴 활동', recordKey: '자율', subjectKey: '공통', columns: '메모', desc: '' });
  const list = O.__ss.getSheetByName(O.APP.SH.ACTIVITY);
  const lr = list.getLastRow();
  list.getRange(lr, 8).setValue('직접작성'); list.getRange(lr, 9).setValue('나만의 프롬프트 {RECORD_BYTES}');
  // 설정 · 공통규칙 · 교과영역 · 문체 · 우리 학교 규칙 · 그 밖의 시트
  O.setCfg_('교사 경력(년)', 9);
  O.setCfg_('기본 교과영역', '공통');
  const com = O.__ss.getSheetByName(O.APP.SH.COMMON);
  const cv = com.getRange(3, 1, com.getLastRow() - 2, 3).getValues();
  cv.forEach((r, i) => {
    if (r[0] === 'WRITING_RULES') com.getRange(3 + i, 3).setValue('우리 학교는 ~하였음 으로 끝맺음.');
    if (r[0] === 'STYLE_CARD') com.getRange(3 + i, 3).setValue('- 첫 문장은 장면으로 시작함');
  });
  const sub = O.__ss.getSheetByName(O.APP.SH.SUBJECT);
  sub.getRange(sub.getLastRow() + 1, 1, 1, 5).setValues([['화학', '화학', '교과', '화학 교사', '화학 역량']]);
  const st = O.__ss.getSheetByName(O.APP.SH.STYLE);
  st.getRange(4, 1, 2, 2).setValues([[true, '예전에 쓴 세특 한 편임.'], [false, '두 번째 편임.']]);
  const rs = O.__ss.getSheetByName(O.APP.SH.RULES);
  rs.getRange(rs.getLastRow() + 1, 1, 1, 7).setValues([[true, '확인', '우리 학교', '교내상', '', '학교 방침', '내 학교']]);
  O.buildCompileCore_();
  const cs = O.__ss.getSheetByName(O.APP.SH.COMPILE_PREFIX + '과세특');
  const ch = cs.getRange(3, 1, 1, cs.getLastColumn()).getValues()[0];
  cs.getRange(5, ch.indexOf('최종본') + 1).setValue('박서준 취합 최종본임.');
  const ex = O.__ss.insertSheet('내 메모');
  ex.getRange(1, 1, 2, 2).setValues([['할 일', '메모'], ['나이스 입력', '금요일까지']]);
  return O;
}

const OLD = makeOld();
const OLD_ID = '1OldOldOldOldOldOldOldOldOldOld99';
const parts = toXlsx(OLD.__ss);

function freshCopy() {
  const N = boot();
  N.installCore_();
  N.__fetch.handler = (url, opt) => {
    ok(url.indexOf(OLD_ID) > 0, url);
    ok(/Bearer test-token/.test(((opt || {}).headers || {}).Authorization || ''), '토큰을 보내야 함');
    return { code: 200, body: '', entries: parts };
  };
  return N;
}

t('미리 보기 — 버전 · 학생 수 · 활동', () => {
  const N = freshCopy();
  const s = N.importPreview('https://docs.google.com/spreadsheets/d/' + OLD_ID + '/edit#gid=0');
  eq(s.roster, 3); eq(s.activities.length, 3, s.activities.join(',')); eq(s.style, 2);
  ok(/^v\d/.test(s.version), s.version);
});
t('잘못된 링크 · 이 파일 링크 · 세특 도우미가 아닌 파일', () => {
  const N = freshCopy();
  let m = ''; try { N.importPreview('아무 글'); } catch (e) { m = e.message; } ok(/링크/.test(m), m);
  m = ''; try { N.importPreview(N.__ss.getUrl()); } catch (e) { m = e.message; } ok(/지금 열려 있는/.test(m), m);
  N.__fetch.handler = () => ({ code: 200, body: '', entries: { 'xl/workbook.xml': '<workbook><sheets><sheet name="가계부" r:id="r1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '' } });
  m = ''; try { N.importPreview('https://docs.google.com/spreadsheets/d/' + OLD_ID + '/edit'); } catch (e) { m = e.message; } ok(/아닌 것 같습니다/.test(m), m);
  N.__fetch.handler = () => ({ code: 404, body: 'nope' });
  m = ''; try { N.importPreview('https://docs.google.com/spreadsheets/d/' + OLD_ID + '/edit'); } catch (e) { m = e.message; } ok(/열 수 없습니다/.test(m), m);
});

const N = freshCopy();
const R = N.importFromOld('https://docs.google.com/spreadsheets/d/' + OLD_ID + '/edit');
const sheet = n => N.__ss.getSheetByName(n);
const table = (s, headRow) => N.tableOf(s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues(), headRow - 1);

t('가져오기 결과 요약 · 실패 없음 · 남은 할 일 안내', () => {
  eq((R.failed || []).length, 0, (R.failed || []).join(' / '));
  ok(R.lines.some(l => /학생 3명/.test(l)), R.lines.join('\n'));
  ok(R.notes.some(n => /API 키/.test(n)), '키는 다시 넣으라는 안내');
  ok(N.__docProps.getProperty('IMPORTED_FROM') === OLD_ID);
  ok(N.onboardStatus().imported);
});
t('학생명단', () => {
  const r = N.getRoster_();
  eq(r.length, 3); eq(r[1].name, '박서준');
});
t('활동 3개 — 바이트 한도 · 입력 항목 · 개요 · 바로쓰기 · 직접작성', () => {
  const acts = N.getActivities_();
  eq(acts.length, 3, acts.map(a => a.key).join(','));
  const a = N.getActivity_('탐구');
  eq(a.bytes, 900); eq(a.columns, '탐구 주제|탐구 과정'); eq(a.desc, '통계 탐구'); eq(a.subjectKey, '수학');
  ok(acts.some(x => x.mode === '바로쓰기'), '바로 쓰기 시트');
  const d = N.getActivity_('직접');
  eq(d.mode, '직접작성'); eq(d.custom, '나만의 프롬프트 {RECORD_BYTES}');
});
t('학생 자료 · AI 결과 · 최종본 · 생성 체크 · 바이트 수식', () => {
  const s = sheet(N.getActivity_('탐구').inSheet);
  const tb = table(s, 3);
  eq(tb.rows.length, 3);
  const k = tb.rows[0];
  eq(k['이름'], '김하늘'); eq(k['탐구 주제'], '급식 잔반'); eq(k['AI 결과'], 'AI 초안 문장임.'); eq(k['최종본'], '선생님이 다듬은 최종 문장임.');
  eq(tb.rows[1]['생성'], true);
  const cB = tb.head.indexOf('바이트') + 1, cF = tb.head.indexOf('최종본') + 1;
  ok(/saeteukBytes/.test(s.getRange(4, cB).getFormula ? s.getRange(4, cB).getFormula() : s.getRange(4, cB, 1, 1).getFormulas()[0][0]), '바이트 수식');
  ok(cF > 0);
});
t('예시 2편', () => {
  const ex = N.readExampleRows_(N.getActivity_('탐구'));
  eq(ex.length, 2); eq(ex[1].result, '두 번째 예시임.'); eq(ex[0].values[1], '설문');
});
t('최종취합의 다듬은 [최종본]', () => {
  const cs = sheet(N.APP.SH.COMPILE_PREFIX + '과세특');
  ok(cs, '취합 시트');
  const tb = table(cs, 3);
  const park = tb.rows.filter(r => r['이름'] === '박서준')[0];
  eq(park['최종본'], '박서준 취합 최종본임.');
  ok(R.report.compile.indexOf('과세특') >= 0);
});
t('설정 · 공통규칙(고친 칸) · 내 문체 카드 · 새 교과', () => {
  eq(Number(N.cfg_('교사 경력(년)')), 9); eq(N.cfg_('기본 교과영역'), '공통');
  const com = N.getCommon_();
  eq(com.WRITING_RULES, '우리 학교는 ~하였음 으로 끝맺음.'); eq(com.STYLE_CARD, '- 첫 문장은 장면으로 시작함');
  ok(N.getSubjects_().some(s => s.key === '화학' && s.comp === '화학 역량'));
});
t('✒️ 내 문체 2편 · 📏 우리 학교 규칙 · 그 밖의 시트', () => {
  eq(R.report.style, 2);
  eq(N.styleSampleTexts_(5).length, 1, '[사용] 켠 것만 문체 예시로');
  ok(N.readRuleRows_(sheet(N.APP.SH.RULES)).some(r => r[3] === '교내상' && r[6] === '내 학교'));
  const m = sheet('내 메모'); ok(m, '내 메모 시트'); eq(m.getRange(2, 2).getValue(), '금요일까지');
});
t('두 번 눌러도 겹치지 않음', () => {
  const R2 = N.importFromOld('https://docs.google.com/spreadsheets/d/' + OLD_ID + '/edit');
  eq(N.getActivities_().length, 3); eq(R2.report.activities.length, 0); eq(R2.report.skipped.length, 3);
  eq(R2.report.style, 0); eq(R2.report.rules, 0);
  eq(table(sheet(N.getActivity_('탐구').inSheet), 3).rows.length, 3);
});
t('설치 전 빈 사본에서 바로 가져와도 구조부터 만든다', () => {
  const E = boot();
  E.__fetch.handler = () => ({ code: 200, body: '', entries: parts });
  const r = E.importFromOld(OLD_ID);
  eq(r.failed.length, 0, r.failed.join(' / '));
  eq(E.getActivities_().length, 3);
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
