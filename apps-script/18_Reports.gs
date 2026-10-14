/**
 * 세특 작성 도우미 v3 — 보고서 · 내 문체 · 설문지 (순수 로직)
 * ---------------------------------------------------------------
 * 📄 보고서 세특: 완성된 보고서를 곧바로 세특으로 바꾸지 않고 두 단계로 나눈다.
 *   ① 보고서 → [보고서 요점] (AI 가 정해진 칸에 뽑고, 교사가 확인·수정)
 *   ② [보고서 요점] + [교사 관찰 메모] + 예시 → 세특 (원래 생성 흐름 그대로)
 *   긴 보고서를 통째로 넣으면 예시가 묻혀 덜 따르게 되므로, ②에는 요점만 보낸다.
 * ✒️ 내 문체: 예전에 쓴 세특에서 "쓰는 방식"만 뽑은 문체 카드 + 문체 예시 몇 편.
 *   카드는 규칙 끝과 학생 자료 바로 뒤에 한 번 더 붙여, 몇 번째 학생이든 똑같이 따르게 한다.
 * 📝 구글 설문지: 응답 시트의 머리글을 이름으로 읽고(순서·이메일 칸에 흔들리지 않게) 학생과 맞춘다.
 *
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/reports.test.js).
 * ---------------------------------------------------------------
 */

/** 보고서 시트의 입력 항목 — 이름이 곧 열 머리글 */
var REPORT_COL = '보고서', POINTS_COL = '보고서 요점', TEACHER_COL = '교사 관찰 메모';
var REPORT_COLUMNS = [REPORT_COL, POINTS_COL, TEACHER_COL];

/** 보고서에서 뽑을 요점 칸 (교사가 확인하기 쉬운 순서) */
var REPORT_POINTS = ['탐구 주제와 동기', '탐구 과정과 방법', '결과와 해석', '한계와 개선점', '활용한 교과 개념', '학생의 생각과 질문'];

var EXTRACT_SYSTEM =
  '# 역할\n당신은 고등학교 교사의 학교생활기록부 작성을 돕는 조교다. 학생이 수업 중에 쓴 보고서를 읽고, 세특의 근거가 될 요점만 정리한다.\n\n' +
  '# 지킬 것\n' +
  '- 보고서에 실제로 쓰여 있는 내용만 쓴다. 추측, 평가, 칭찬을 덧붙이지 않는다.\n' +
  '- 항목마다 1~3문장으로 짧게. 보고서에 없으면 "없음".\n' +
  '- 보고서 제목, 참고문헌 목록, 참여 인원·소요 시간, 대학·기관·인물 이름, 수상·점수는 옮기지 않는다.\n' +
  '- 사진·그림·손글씨도 읽어 내용에 넣는다. 읽기 어려운 곳은 [판독 어려움]이라고 쓴다.\n\n' +
  '# 출력 (아래 형식 그대로, 다른 말 없이)\n' +
  REPORT_POINTS.map(function (p) { return p + ': '; }).join('\n');

/** 요점 뽑기 요청문 — 보고서 글(있으면)과 첨부 파일 설명 */
function buildExtractUser(text, notes) {
  var L = ['# 학생 보고서'];
  var t = String(text || '').trim();
  if (t) L.push(t.length > 30000 ? t.slice(0, 30000) + '\n…(뒷부분 생략)' : t);
  if (notes && notes.length) L.push('', '(첨부: ' + notes.join(', ') + ')');
  if (!t && !(notes && notes.length)) L.push('(내용 없음)');
  return L.join('\n');
}

/** 요점 답 정리 — 코드 울타리·머리말을 걷고 항목 줄만 남긴다 */
function cleanPoints(text) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var lines = t.split(/\r?\n/).map(function (l) { return l.replace(/^\s*[-*•]\s*/, '').replace(/\*\*/g, '').trimEnd(); });
  var first = -1;
  for (var i = 0; i < lines.length; i++) {
    if (REPORT_POINTS.some(function (p) { return lines[i].indexOf(p) === 0; })) { first = i; break; }
  }
  return (first >= 0 ? lines.slice(first) : lines).join('\n').trim();
}

/** 셀 글 안의 구글 드라이브 파일 ID 들 (설문지 파일 업로드 · 공유 링크 · 문서 링크) */
function driveIdsIn(text) {
  var s = String(text || ''), out = [];
  var add = function (id) { if (id && id.length >= 20 && out.indexOf(id) < 0) out.push(id); };
  var m, re = /(?:drive|docs)\.google\.com\/(?:open\?id=|file\/d\/|document\/d\/|presentation\/d\/|spreadsheets\/d\/|uc\?(?:export=\w+&)?id=)([A-Za-z0-9_-]{20,})/g;
  while ((m = re.exec(s))) add(m[1]);
  return out;
}

/** 드라이브 폴더 ID */
function driveFolderIdIn(text) {
  var m = String(text || '').match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

/** 셀 글에서 링크를 뺀 나머지(학생이 함께 적은 설명 등) */
function textWithoutLinks(text) {
  return String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[,\s]+$/g, '').trim();
}

/** XML 에서 글자만 — docx(w:t)·hwpx(hp:t)·pptx(a:t). 문단 끝은 줄바꿈 */
function xmlText(xml, kind) {
  var s = String(xml || '');
  var para = kind === 'hwpx' ? /<\/hp:p>/g : kind === 'pptx' ? /<\/a:p>/g : /<\/w:p>/g;
  var run = kind === 'hwpx' ? /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g : kind === 'pptx' ? /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g
                            : /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  s = s.replace(para, '\u0001');
  var out = [], m;
  var chunks = s.split('\u0001');
  chunks.forEach(function (c) {
    var line = '';
    run.lastIndex = 0;
    while ((m = run.exec(c))) line += m[1];
    line = line.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
               .replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
    if (line) out.push(line);
  });
  return out.join('\n');
}

/** 파일 종류 → 읽는 방법: 'gdoc'·'text'·'docx'·'hwpx'·'pptx'·'pdf'·'image'·'hwp'·'' */
function fileKind(mime, name) {
  var m = String(mime || ''), n = String(name || '').toLowerCase();
  if (/application\/vnd\.google-apps\.(document|presentation)/.test(m)) return 'gdoc';
  if (/^text\//.test(m) || /\.(txt|md)$/.test(n)) return 'text';
  if (/wordprocessingml/.test(m) || /\.docx$/.test(n)) return 'docx';
  if (/presentationml/.test(m) || /\.pptx$/.test(n)) return 'pptx';
  if (/hwp\+zip|hwpx/.test(m) || /\.hwpx$/.test(n)) return 'hwpx';
  if (/\.hwp$/.test(n) || /x-hwp|haansoft/.test(m)) return 'hwp';
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return 'pdf';
  if (/^image\/(png|jpe?g|webp|gif|heic|heif)$/.test(m) || /\.(png|jpe?g|webp|gif|heic|heif)$/.test(n)) return 'image';
  return '';
}

/**
 * 폴더의 파일 이름 → 학생. 학번(20315) > 이름 > "3반 15번"/"3-15" 순으로 찾는다.
 * @param {string} fileName
 * @param {Array<{year?, cls, no, name}>} students
 * @return {number} students 의 위치, 못 찾으면 -1 (둘 이상이 맞으면 -1)
 */
function matchFileToStudent(fileName, students) {
  var f = String(fileName || '').replace(/\.[A-Za-z0-9]{2,5}$/, '');
  var hits = [];
  var push = function (i) { if (hits.indexOf(i) < 0) hits.push(i); };
  var sid = f.match(/(?:^|\D)(\d{5})(?:\D|$)/);
  if (sid) {
    var y = Number(sid[1].charAt(0)), c = Number(sid[1].slice(1, 3)), n = Number(sid[1].slice(3));
    students.forEach(function (st, i) {
      if (Number(st.cls) === c && Number(st.no) === n && (!st.year || Number(st.year) === y)) push(i);
    });
    if (hits.length === 1) return hits[0];
    hits = [];
  }
  students.forEach(function (st, i) {
    var nm = String(st.name || '').trim();
    if (nm.length >= 2 && f.indexOf(nm) >= 0) push(i);
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return -1;
  var cn = f.match(/(\d{1,2})\s*반\s*(\d{1,2})\s*번/) || f.match(/(?:^|\D)(\d{1,2})\s*-\s*(\d{1,2})(?:\D|$)/);
  if (cn) {
    students.forEach(function (st, i) { if (Number(st.cls) === Number(cn[1]) && Number(st.no) === Number(cn[2])) push(i); });
    if (hits.length === 1) return hits[0];
  }
  return -1;
}

/* ============================================================ 내 문체 */
var STYLE_SYSTEM =
  '# 역할\n당신은 학교생활기록부 문장의 문체를 분석하는 교사다.\n\n' +
  '# 할 일\n아래 [예전에 쓴 세특]들에서 "쓰는 방식"만 뽑아 문체 카드를 만든다. 학생·활동 내용은 옮기지 않는다.\n' +
  '다음을 각각 한 줄로: 한 편의 문장 수와 문장 길이, 첫 문장을 여는 방식, 내용을 펼치는 순서, 끝맺음 어미, 자주 쓰는 이음말, ' +
  '평가어를 쓰는 정도, 피하는 표현. 8줄 이내로, 줄마다 "- "로 시작한다. 다른 사람이 이 카드만 보고 같은 문체로 쓸 수 있게 구체적으로.\n\n' +
  '# 출력\n문체 카드만 출력한다.';

function buildStyleUser(samples) {
  return '# 예전에 쓴 세특\n' + samples.map(function (t, i) { return '## ' + (i + 1) + '\n' + String(t).trim(); }).join('\n\n');
}

/** 문체 카드를 학생 자료 바로 뒤에 한 번 더 — 글을 쓰기 직전에 본 것을 가장 잘 따르므로 */
function styleTail(card) {
  card = String(card || '').trim();
  return card ? '\n\n# 쓰기 직전 확인 — 내 문체 (예시·규칙과 함께 그대로 따른다)\n' + card : '';
}

/** 문장 나누기 — 마침표 기준(소수점 제외) */
function sentencesOf(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[가-힣a-zA-Z)\]])\.(?:\s|$)/).map(function (x) { return x.trim(); }).filter(String);
}

/** 문체 지표: 문장 평균 길이, '~하였음'류 끝맺음 비율 */
function styleProfile(texts) {
  var lens = [], past = 0, total = 0;
  (texts || []).forEach(function (t) {
    sentencesOf(t).forEach(function (s) {
      lens.push(s.length);
      total++;
      if (/(였|었|았|했)음$|하였음$/.test(s)) past++;
    });
  });
  if (!total) return null;
  var avg = lens.reduce(function (a, b) { return a + b; }, 0) / total;
  return { avgLen: Math.round(avg), pastRatio: past / total, sentences: total, texts: (texts || []).length };
}

/**
 * 예시·내 문체와 견줘 많이 다르면 [확인] 한 줄. 기준 글이 2편 미만이면 보지 않는다.
 * @return {{level, label, hit, why}|null}
 */
function styleDrift(ref, text) {
  if (!ref || ref.texts < 2) return null;
  var p = styleProfile([text]);
  if (!p) return null;
  var why = [];
  if (ref.pastRatio >= 0.6 && p.pastRatio < 0.3) why.push("끝맺음: 예시는 '~하였음' 쪽인데 이 글은 '~함' 쪽");
  else if (ref.pastRatio <= 0.2 && p.pastRatio >= 0.6) why.push("끝맺음: 예시는 '~함' 쪽인데 이 글은 '~하였음' 쪽");
  var r = p.avgLen / Math.max(ref.avgLen, 1);
  if (r > 1.6 || r < 0.6) why.push('문장 길이: 예시 평균 ' + ref.avgLen + '자, 이 글 ' + p.avgLen + '자');
  return why.length ? { level: 'check', label: '문체', hit: why.join(' / '), why: '예시·내 문체와 많이 다릅니다. 같은 문체로 맞추려면 고쳐 쓰세요.' } : null;
}

/* ============================================================ 구글 설문지 */
/** 설문지 머리글 한 칸 → 'ts'·'email'·'sid'·'year'·'cls'·'no'·'name'·'' */
function formHeadKind(title) {
  var raw = String(title === null || title === undefined ? '' : title).trim();
  if (!raw) return '';
  if (/타임스탬프|timestamp/i.test(raw)) return 'ts';
  if (/이메일|e-?mail/i.test(raw)) return 'email';
  var t = raw.replace(/\(.*?\)|\[.*?\]/g, '').replace(/[?？:：*.!]/g, '').replace(/\s+/g, '')
             .replace(/(을|를|은|는)?(입력|적어|써|선택)(하세요|주세요|해주세요|해 주세요|주십시오|하시오).*$/, '')
             .replace(/(이|가)?(인가요|입니까|이에요|예요|이요)$/, '').replace(/^몇/, '');
  var k = typeof rosterHeadKind === 'function' ? rosterHeadKind(t) : '';
  return k === 'level' ? '' : k;
}

/** 설문지 응답 시트 머리글 해석 — 학생 칸과 문항 칸을 나눈다 */
function parseFormHeader(head) {
  var info = { ts: -1, email: -1, sid: -1, year: -1, cls: -1, no: -1, name: -1, questions: [] };
  (head || []).forEach(function (h, i) {
    var k = formHeadKind(h);
    if (k && info[k] === -1) { info[k] = i; return; }
    if (String(h || '').trim()) info.questions.push({ i: i, title: String(h).trim() });
  });
  info.ok = info.sid >= 0 || (info.cls >= 0 && info.no >= 0) || info.name >= 0;
  return info;
}

/** 응답 한 줄 → 학생 표시 {year, cls, no, name} */
function formStudentOf(row, info) {
  var st = { year: '', cls: '', no: '', name: '' };
  if (info.sid >= 0) {
    var p = typeof splitStudentId === 'function' ? splitStudentId(row[info.sid]) : null;
    if (p) { st.year = p[0]; st.cls = p[1]; st.no = p[2]; }
  }
  var num = function (v) { var m = String(v === null || v === undefined ? '' : v).match(/\d+/); return m ? Number(m[0]) : ''; };
  if (info.year >= 0 && row[info.year] !== '') st.year = num(row[info.year]);
  if (info.cls >= 0 && row[info.cls] !== '') st.cls = num(row[info.cls]);
  if (info.no >= 0 && row[info.no] !== '') st.no = num(row[info.no]);
  if (info.name >= 0) st.name = String(row[info.name] || '').trim();
  return st;
}

/** 같은 학생이 여러 번 내면 마지막 응답만 (응답 시트는 시간 순) */
function latestResponses(rows, info) {
  var byKey = {}, order = [];
  (rows || []).forEach(function (r) {
    var st = formStudentOf(r, info);
    var key = (st.cls !== '' && st.no !== '') ? (st.year || '') + '|' + st.cls + '|' + st.no : 'n|' + st.name;
    if (key === 'n|') return;
    if (!byKey[key]) order.push(key);
    byKey[key] = { st: st, row: r };
  });
  return order.map(function (k) { return byKey[k]; });
}

/**
 * 문항 → 보낼 칸 자동 연결. 이름이 같은 칸, 보고서 시트면 파일·"보고서" 문항 → [보고서].
 * @param {Array<{title, isFile?}>} questions
 * @param {string[]} targetCols  활동의 입력 항목
 * @param {string} mode  '보고서' | '바로쓰기' | ''
 * @return {Object<string,string>} 문항 제목 → 칸 이름 ('' 이면 보내지 않음)
 */
function autoMapQuestions(questions, targetCols, mode) {
  var map = {};
  var norm = function (s) { return String(s || '').replace(/\s+/g, '').replace(/[?？:：().]/g, ''); };
  (questions || []).forEach(function (q) {
    var hit = '';
    (targetCols || []).forEach(function (c) { if (!hit && norm(c) === norm(q.title)) hit = c; });
    if (!hit && mode === '보고서' && (q.isFile || /보고서|탐구|산출물|과제/.test(q.title))) hit = REPORT_COL;
    if (!hit && mode === '바로쓰기' && targetCols.length === 1) hit = targetCols[0];
    map[q.title] = hit;
  });
  return map;
}

/** 여러 문항이 한 칸으로 갈 때 "문항: 답" 으로 잇는다(한 문항뿐이면 답만) */
function joinAnswers(parts) {
  var filled = (parts || []).filter(function (p) { return String(p.value === null || p.value === undefined ? '' : p.value).trim() !== ''; });
  if (filled.length === 1) return String(filled[0].value).trim();
  return filled.map(function (p) { return p.title + ': ' + String(p.value).trim(); }).join('\n');
}

/** 짧은 지문 — 설문지에서 넣은 값을 선생님이 고쳤는지 알아보는 데 쓴다 */
function textHash(s) {
  s = String(s === null || s === undefined ? '' : s);
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
var FORM_NOTE_PREFIX = '📝 설문지에서 가져옴';
function formNote(hash, when) { return FORM_NOTE_PREFIX + ' ' + (when || '') + ' #' + hash; }
function noteHash(note) { var m = String(note || '').match(/#([0-9a-z]+)\s*$/); return m ? m[1] : ''; }

/** 이 칸을 설문지 값으로 바꿔도 되는지: 비었거나, 지난번 설문지 값 그대로(선생님이 안 고침)일 때 */
function formCellWritable(current, note) {
  var cur = String(current === null || current === undefined ? '' : current);
  if (!cur.trim()) return true;
  var h = noteHash(note);
  return !!h && String(note).indexOf(FORM_NOTE_PREFIX) === 0 && textHash(cur) === h;
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REPORT_COLUMNS: REPORT_COLUMNS, REPORT_POINTS: REPORT_POINTS, EXTRACT_SYSTEM: EXTRACT_SYSTEM,
    buildExtractUser: buildExtractUser, cleanPoints: cleanPoints, driveIdsIn: driveIdsIn, driveFolderIdIn: driveFolderIdIn,
    textWithoutLinks: textWithoutLinks, xmlText: xmlText, fileKind: fileKind, matchFileToStudent: matchFileToStudent,
    STYLE_SYSTEM: STYLE_SYSTEM, buildStyleUser: buildStyleUser, styleTail: styleTail, sentencesOf: sentencesOf,
    styleProfile: styleProfile, styleDrift: styleDrift, formHeadKind: formHeadKind, parseFormHeader: parseFormHeader,
    formStudentOf: formStudentOf, latestResponses: latestResponses, autoMapQuestions: autoMapQuestions,
    joinAnswers: joinAnswers, textHash: textHash, formNote: formNote, noteHash: noteHash, formCellWritable: formCellWritable
  };
}
