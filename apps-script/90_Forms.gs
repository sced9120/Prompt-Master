/**
 * 세특 작성 도우미 v3 — 구글폼 응답 연동
 *
 * 전제: 폼의 첫 세 문항이 [반] [번호] [이름] (단답형)
 *       폼 응답을 이 스프레드시트로 연결해 두면 "설문지 응답 시트N" 이 생깁니다.
 */

/** 폼 응답 시트 후보 찾기 */
function formSheets_() {
  var known = {};
  known[APP.SH.HELP] = 1; known[APP.SH.CONFIG] = 1; known[APP.SH.ROSTER] = 1;
  known[APP.SH.RECORD] = 1; known[APP.SH.SUBJECT] = 1; known[APP.SH.COMMON] = 1;
  known[APP.SH.ACTIVITY] = 1; known[APP.SH.REVIEW] = 1;
  var actSheets = {};
  getActivities_().forEach(function (a) { actSheets[a.inSheet] = 1; actSheets[a.exSheet] = 1; });
  return ss_().getSheets().filter(function (s) {
    var n = s.getName();
    if (known[n] || actSheets[n]) return false;
    if (recordKeyOfCompile_(n)) return false;
    if (s.getLastRow() < 1) return false;
    var h = String(s.getRange(1, 1).getValue());
    return /타임스탬프|Timestamp/i.test(h) || /응답/.test(n);
  });
}

function syncFormResponses() {
  var forms = formSheets_();
  if (!forms.length) {
    ui_().alert(APP.MENU,
      '폼 응답 시트를 찾지 못했습니다.\n\n' +
      '1) 구글폼을 만들고 첫 세 문항을 [반] [번호] [이름] 단답형으로 넣으세요.\n' +
      '2) 폼의 [응답] 탭 → 스프레드시트 아이콘 → "기존 스프레드시트 선택" → 이 파일을 고르세요.\n' +
      '3) 응답이 한 건이라도 들어온 뒤 다시 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var fList = forms.map(function (s, i) { return (i + 1) + '. ' + s.getName() + ' (' + Math.max(0, s.getLastRow() - 1) + '건)'; }).join('\n');
  var fAns = promptText_('구글폼 동기화 (1/2)', '어느 응답 시트를 쓸까요?\n\n' + fList);
  if (fAns === null) return;
  var fs = forms[Number(fAns) - 1];
  if (!fs) { ui_().alert('번호가 올바르지 않습니다.'); return; }

  var acts = getActivities_();
  var aList = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var aAns = promptText_('구글폼 동기화 (2/2)',
    '어느 활동으로 보낼까요?\n0을 입력하면 이 폼의 문항으로 새 활동을 만듭니다.\n\n' + aList);
  if (aAns === null) return;

  var head = fs.getRange(1, 1, 1, fs.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  // 0:타임스탬프 1:반 2:번호 3:이름 4~:문항
  var qCols = head.slice(4).filter(function (h) { return h; });
  if (!qCols.length) { ui_().alert(APP.MENU, '문항을 찾지 못했습니다. 첫 세 문항이 [반][번호][이름]인지 확인하세요.', ui_().ButtonSet.OK); return; }

  var act;
  if (String(aAns).trim() === '0') {
    var nm = promptText_('새 활동 만들기', '활동 이름을 입력하세요.');
    if (!nm) return;
    var recs = getRecordTypes_();
    var rl = recs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' (' + r.name + ')'; }).join('\n');
    var rAns = promptText_('새 활동 만들기', '기록종류 번호를 고르세요.\n\n' + rl);
    if (rAns === null) return;
    var rec = recs[Number(rAns) - 1];
    if (!rec) { ui_().alert('번호가 올바르지 않습니다.'); return; }
    try {
      var made = createActivity_({
        key: nm, name: nm, recordKey: rec.key,
        subjectKey: cfg_('기본 교과영역', '공통'),
        columns: qCols.join('|'), desc: '구글폼으로 받은 학생 응답'
      });
      act = getActivity_(made.key);
    } catch (e) { ui_().alert(APP.MENU, '오류: ' + e.message, ui_().ButtonSet.OK); return; }
  } else {
    act = acts[Number(aAns) - 1];
    if (!act) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  }

  var n = pushFormInto_(fs, act, qCols);
  toast_('폼 응답 ' + n + '건을 [' + act.name + ']에 반영했습니다.', APP.MENU);
  var t = sh_(act.inSheet);
  if (t) ss_().setActiveSheet(t);
}

/** 응답 시트 → 활동 입력 시트 (반/번호로 매칭, 같은 학생은 최신 응답 사용) */
function pushFormInto_(formSheet, act, qCols) {
  var target = sh_(act.inSheet);
  if (!target) throw new Error('입력 시트를 찾을 수 없습니다: ' + act.inSheet);
  var cols = parseColumns(act.columns);
  var last = formSheet.getLastRow();
  if (last < 2) return 0;

  var vals = formSheet.getRange(2, 1, last - 1, formSheet.getLastColumn()).getValues();
  var byId = {};
  vals.forEach(function (r) {
    var id = String(r[1]).trim() + '-' + String(r[2]).trim();
    if (id === '-') return;
    byId[id] = r;   // 뒤에 오는(최신) 응답이 덮어씀
  });

  var tLast = target.getLastRow();
  if (tLast < APP.DATA_ROW) return 0;
  var cnt = tLast - APP.DATA_ROW + 1;
  var ab = target.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var out = target.getRange(APP.DATA_ROW, 5, cnt, cols.length).getValues();

  var n = 0;
  for (var i = 0; i < cnt; i++) {
    var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
    var r = byId[id];
    if (!r) continue;
    for (var c = 0; c < cols.length; c++) {
      // 활동의 c번째 입력 항목 ← 폼의 c번째 문항 (순서 기준)
      var v = (c < qCols.length) ? r[4 + c] : '';
      if (String(v).trim() !== '') out[i][c] = v;
    }
    n++;
  }
  target.getRange(APP.DATA_ROW, 5, cnt, cols.length).setValues(out);
  return n;
}
