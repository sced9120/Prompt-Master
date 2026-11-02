/* 📤 나이스 업로드 양식 채우기 (node test/neis.test.js)
   양식은 사용자가 준 나이스 파일(2026-11)과 같은 모양으로 만든 가짜 — 이름 · 번호는 모두 지어낸 것 */
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
  g.__docProps.setProperty('UPDATE_CHECKED_AT', String(Date.now()));
  ctx.installCore_();
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

/* ---- 나이스 양식 모양 (inlineStr, 빈 특기사항 칸은 서식만) */
const is = (ref, s, v) => '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t>' + v + '</t></is></c>';
function sheetXml(head, rows, emptyStyle) {
  const L = i => P.colLetterOf(i);
  const r1 = '<row r="1">\n' + head.map((h, i) => is(L(i) + '1', 1, h)).join('') + '</row>';
  const rs = rows.map((r, k) => '<row r="' + (k + 2) + '">\n' + r.map((v, i) => v === null ? '<c r="' + L(i) + (k + 2) + '" s="' + emptyStyle + '"></c>' : is(L(i) + (k + 2), 2, v)).join('') + '</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1"/>' +
    '<sheetData>' + r1 + rs + '</sheetData><pageMargins bottom="0.75" footer="0.3" header="0.3" left="0.7" right="0.7" top="0.75"/></worksheet>';
}
function parts(sheetName, xml) {
  return {
    '[Content_Types].xml': '<Types/>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + sheetName + '" r:id="rId3" sheetId="1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId3" Target="worksheets/sheet1.xml" Type="x"/></Relationships>',
    'xl/sharedStrings.xml': '<sst count="0" uniqueCount="0"/>',
    'xl/worksheets/sheet1.xml': xml
  };
}
const SUBJ_HEAD = ['학년도', '학기', '학년', '학생개인번호', '과목', '과목코드', '반/번호', '성명', '학적변동&#xd;&#xa;구분', '세부능력 및 특기사항', '영재·발명교육 기록사항'];
const subjRow = (no, name, status) => ['2026', '2', '1', '20269990' + String(no).padStart(2, '0'), '공통수학2', '0003000013', '1/' + no, name, status || '재학', null, null];
const SUBJ = parts('과목별세부능력및특기사항', sheetXml(SUBJ_HEAD, [subjRow(1, '가나다'), subjRow(2, '라마바'), subjRow(3, '사아자'), subjRow(4, '차카타', '전출')], 2));
const CLUB_HEAD = ['영역 구분', '학년도', '학년', '학과', '반', '번호', '동아리활동&#xd;&#xa;부서명', '학생개인번호', '성명', '특기사항'];
const clubRow = (y, c, n, name) => ['동아리활동_특기사항', '2026', String(y), null, String(c), String(n), '가상부서', '20269991' + n, name, null];
const CLUB = parts('가상부서_특기사항', sheetXml(CLUB_HEAD, [clubRow(1, 1, 25, '하늘솔'), clubRow(2, 1, 25, '바다솔'), clubRow(1, 3, 7, '구름솔')], 4));

console.log('\n[양식 읽기]');
t('과목 세특 양식: 반/번호 칸 · 학적변동 · 과목 · 넣을 칸(J)', () => {
  const f = P.readNeisForm(SUBJ);
  eq([f.kind, f.subject, f.year, f.term, f.contentCol, f.contentHead], ['과세특', '공통수학2', '2026', '2', 9, '세부능력 및 특기사항']);
  eq(f.rows.map(r => [r.r, r.year, r.cls, r.no, r.name, r.status]), [[2, 1, 1, 1, '가나다', '재학'], [3, 1, 1, 2, '라마바', '재학'], [4, 1, 1, 3, '사아자', '재학'], [5, 1, 1, 4, '차카타', '전출']]);
});
t('동아리 양식: 영역 구분으로 동아리, 반 · 번호 칸이 따로, 여러 학년', () => {
  const f = P.readNeisForm(CLUB);
  eq([f.kind, f.contentCol, f.contentHead, f.sheetName], ['동아리', 9, '특기사항', '가상부서_특기사항']);
  eq(f.rows.map(r => [r.year, r.cls, r.no]), [[1, 1, 25], [2, 1, 25], [1, 3, 7]]);
});
t('특기사항 칸이 없으면 알아듣게 거절', () => {
  let msg = '';
  try { P.readNeisForm(parts('x', sheetXml(['반', '번호', '성명'], [['1', '1', '가나다']], 2))); } catch (e) { msg = e.message; }
  ok(/특기사항 칸을 찾지 못했습니다/.test(msg), msg);
});

console.log('\n[학생 맞추기]');
const GOOD = '함수 단원 모둠 발표에서 그래프를 직접 그려 기울기를 설명함.';
t('반 · 번호 · 이름이 모두 맞아야 넣고, 빠지는 까닭을 하나씩 알려 줌', () => {
  const src = [
    { cls: '1', no: 1, name: '가나다', text: GOOD, check: '통과 (90B)' },
    { cls: '1', no: 2, name: '라마바', text: '', check: '' },
    { cls: '1', no: 3, name: '사아자아', text: GOOD, check: '' },
    { cls: '1', no: 4, name: '차카타', text: GOOD, check: '' }
  ];
  const plan = P.matchNeisRows(P.readNeisForm(SUBJ).rows, src, { limit: 1500 });
  eq(plan.map(x => [x.ok, x.why.replace(/ \(.*/, '')]), [[true, ''], [false, '[최종본]이 비어 있음'], [false, '반 · 번호는 같은데 이름이 다름'], [false, '학적변동: 전출']]);
  eq(plan[0].bytes, P.byteLen(GOOD));
});
t('[수정]이 남았거나 바이트가 넘으면 빠지고, 고르면 [수정]도 넣음 · 양식에 내용이 있으면 덮어쓰기 골라야', () => {
  const rows = [{ r: 2, year: 1, cls: 1, no: 1, name: '가나다', status: '재학', content: '' }, { r: 3, year: 1, cls: 1, no: 2, name: '라마바', status: '재학', content: '옛 글' }];
  const src = [{ cls: '1', no: 1, name: '가나다', text: GOOD, check: '수정필요 (90B)\n[수정] 수상 · 등수' }, { cls: '1', no: 2, name: '라마바', text: GOOD }];
  eq(P.matchNeisRows(rows, src, {}).map(x => x.why), ['[검증]에 [수정]이 남아 있음', '나이스 양식에 이미 내용이 있음']);
  eq(P.matchNeisRows(rows, src, { includeFlagged: true, overwrite: true }).map(x => x.ok), [true, true]);
  eq(P.matchNeisRows(rows, src, { limit: 30, includeFlagged: true, overwrite: true })[0].why, '바이트 초과 ' + P.byteLen(GOOD) + ' / 30');
});
t('학년-반 명단(1-1)은 학년까지, 반만 쓰는 명단은 이름으로 다른 학년을 가림', () => {
  const rows = P.readNeisForm(CLUB).rows;
  const byGrade = [{ cls: '1-1', no: 25, name: '하늘솔', text: GOOD }, { cls: '2-1', no: 25, name: '바다솔', text: GOOD + ' 2' }];
  eq(P.matchNeisRows(rows, byGrade, {}).map(x => [x.ok, x.text === GOOD]), [[true, true], [true, false], [false, false]]);
  const byClass = [{ cls: '1', no: 25, name: '하늘솔', text: GOOD }, { cls: '1', no: 25, name: '바다솔', text: GOOD + ' 2' }];
  const p2 = P.matchNeisRows(rows, byClass, {});
  eq(p2.map(x => x.ok), [true, true, false]); eq(p2[1].text, GOOD + ' 2'); eq(p2[2].why, '시트에 없는 학생');
});

console.log('\n[파일 채우기]');
t('특기사항 칸만 바뀌고 서식(s) · 다른 칸 · 학생개인번호 · 과목코드는 글자 하나 안 바뀜', () => {
  const xml = SUBJ['xl/worksheets/sheet1.xml'];
  const out = P.fillNeisSheetXml(xml, 9, { 2: GOOD + ' A&B <확인>', 4: GOOD });
  const strip = s => s.replace(/<c r="J\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, '');
  eq(strip(out), strip(xml), 'J 말고는 그대로');
  ok(out.indexOf('<c r="J2" s="2" t="inlineStr"><is><t xml:space="preserve">' + GOOD + ' A&amp;B &lt;확인&gt;</t></is></c>') > 0, 'J2');
  ok(out.indexOf('<c r="J3" s="2"></c>') > 0, '넣지 않은 학생은 빈 칸 그대로');
  const grid = P.parseSheetXml(out, []);
  eq([grid[1][9], grid[3][9], grid[2][9], grid[1][5], grid[1][3]], [GOOD + ' A&B <확인>', GOOD, '', '0003000013', '2026999001']);
});
t('특기사항 칸이 아예 없는 줄에도 열 순서에 맞게 끼움', () => {
  const xml = '<sheetData><row r="2">' + is('A2', 2, '1') + is('K2', 2, '끝') + '</row></sheetData>';
  const out = P.fillNeisSheetXml(xml, 9, { 2: '가' });
  ok(/<c r="A2"[^]*<c r="J2"[^]*<c r="K2"/.test(out), out);
});

t('대안 열: 2행부터 양식 줄 순서, 빠진 학생 · 비어 있는 줄은 빈 칸, 칸 안 줄바꿈 · 탭은 띄어쓰기', () => {
  const plan = [{ r: 2, ok: true, text: '가\n나' }, { r: 3, ok: false, text: '안 넣음' }, { r: 5, ok: true, text: '다\t라' }];
  eq(P.neisColumn(plan), ['가 나', '', '', '다 라']);
});

console.log('\n[시트에서 만들기]');
t('최종취합 시트의 [최종본]으로 미리 보기 · 파일 만들기 (원래 파일 이름 그대로)', () => {
  const B = boot();
  B.rosterSave({ text: '1 1 가나다\n1 2 라마바\n1 3 사아자\n1 4 차카타', mode: 'class' });
  B.createActivity_({ key: '수학탐구', name: '수학탐구', recordKey: '과세특', subjectKey: '수학', columns: [B.QUICK_COLUMN], mode: '바로쓰기' });
  B.buildCompileCore_();
  const s = B.__ss.getSheetByName(B.compileSheetName_('과세특'));
  const cF = B.colOf_(s, B.APP.HEAD_ROW, '최종본');
  s.getRange(B.APP.DATA_ROW, cF).setValue(GOOD);
  s.getRange(B.APP.DATA_ROW + 2, cF).setValue(GOOD + ' 셋');
  // xlsx 는 {경로: XML} JSON 으로 주고받는다(모의 Utilities)
  const json = o => Buffer.from(JSON.stringify(o)).toString('base64');
  const mk = (bytes, type, name) => {
    const b = { bytes, name, getBytes: () => b.bytes, getName: () => b.name, setName: n => { b.name = n; return b; },
                getDataAsString: () => Buffer.from(b.bytes).toString('utf8'), setDataFromString: (x) => { b.bytes = Array.from(Buffer.from(x, 'utf8')); return b; } };
    return b;
  };
  B.Utilities = {
    base64Decode: s => Array.from(Buffer.from(s, 'base64')),
    base64Encode: b => Buffer.from(b).toString('base64'),
    newBlob: (d, type, name) => mk(typeof d === 'string' ? Array.from(Buffer.from(d, 'utf8')) : d, type, name),
    unzip: b => { const o = JSON.parse(Buffer.from(Buffer.from(b.getBytes()).toString('utf8'), 'base64').toString('utf8')); return Object.keys(o).map(k => mk(Array.from(Buffer.from(o[k], 'utf8')), 'text/xml', k)); },
    zip: (blobs, name) => { const o = {}; blobs.forEach(x => { o[x.getName()] = x.getDataAsString(); }); return mk(Array.from(Buffer.from(JSON.stringify(o))), 'application/zip', name); }
  };
  const fakeUnzipInput = json(SUBJ);   // neisParts_ 는 base64 → newBlob → unzip
  B.Utilities.newBlob = ((orig) => (d, type, name) => type === 'application/zip' ? mk(Array.from(Buffer.from(Buffer.from(d).toString('base64'))), type, name) : orig(d, type, name))(B.Utilities.newBlob);
  const pv = B.neisPreview({ b64: fakeUnzipInput });
  eq(pv.source.sheet, B.compileSheetName_('과세특'));
  eq([pv.form.kind, pv.form.students, pv.fill], ['과세특', 4, 2]);
  eq(pv.plan.map(x => x.why), ['', '[최종본]이 비어 있음', '', '학적변동: 전출']);
  eq(pv.column, [GOOD, '', GOOD + ' 셋', ''], '대안: 양식 순서대로 한 열');
  const r = B.neisBuild({ b64: fakeUnzipInput, fileName: '2026_2학기_1학년_1_공통수학2_과목세특_1.xlsx' });
  eq([r.file, r.fill, r.skip], ['2026_2학기_1학년_1_공통수학2_과목세특_1.xlsx', 2, 2]);
  const back = JSON.parse(Buffer.from(r.b64, 'base64').toString('utf8'));
  eq(Object.keys(back).sort(), Object.keys(SUBJ).sort(), '파일 구성 그대로');
  const grid = B.parseSheetXml(back['xl/worksheets/sheet1.xml'], []);
  eq([grid[1][9], grid[2][9], grid[3][9], grid[4][9]], [GOOD, '', GOOD + ' 셋', '']);
  eq(back['xl/workbook.xml'], SUBJ['xl/workbook.xml']);
});
t('메뉴 · 창 · 도움말', () => {
  const src = fs.readFileSync(path.join(dir, '30_Setup.gs'), 'utf8');
  ok(/📤 나이스 업로드 파일 만들기.*openNeisDialog/.test(src));
  const ui = fs.readFileSync(path.join(dir, 'UI_Neis.html'), 'utf8');
  ok(/neisPreview/.test(ui) && /neisBuild/.test(ui) && /neisContext/.test(ui) && /\[AI 결과\]는 넣지 않습니다/.test(ui));
  ok(/type="file" id="file" accept="\.xlsx" multiple/.test(ui) && /모두 받기/.test(ui), '여러 파일 한꺼번에');
  ok(/특기사항 열 복사/.test(ui) && /pv\.column\.join/.test(ui), '올리기가 막힐 때의 대안');
  ok(/나이스 업로드 파일 만들기/.test(fs.readFileSync(path.join(dir, '35_Help.gs'), 'utf8')));
});

console.log('\n통과 ' + pass + '개' + (fail ? ' · 실패 ' + fail + '개' : ''));
if (fail) process.exit(1);
