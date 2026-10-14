/**
 * 세특 작성 도우미 v3 — 📏 활동별 바이트 한도
 * 나이스 한 칸(기록 항목)을 여러 활동이 나눠 쓸 때 활동마다 바이트를 정한다.
 * 예) 수학 과세특 1500바이트 = 탐구보고서 750 + 발표 450 + 수업 태도 300
 * 나눠 두면 ⑦ 최종취합의 합본이 한 칸을 넘지 않아 압축(AI 한 번 더)이 필요 없다.
 *
 * 묶음: 교과 기록(과세특)은 교과마다 다른 칸이라 (기록종류, 교과영역)으로, 창체·행발은 기록종류로.
 */

function openBytesDialog() {
  migrateActivityBytes_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Bytes').setWidth(720).setHeight(640);
  ui_().showModalDialog(html, '📏 활동별 바이트 한도');
}

/** @return {Array<{id,title,cap,chars,note,acts:Array<{key,name,bytes,mode}>}>} */
function bytesContext() {
  var recs = getRecordTypes_(), subs = getSubjects_(), groups = {}, order = [];
  getActivities_().forEach(function (a) {
    var rec = findByKey(recs, a.recordKey);
    if (!rec) return;
    var sub = findByKey(subs, a.subjectKey);
    var bySubject = !!(sub && sub.kind === '교과');
    var id = rec.key + (bySubject ? '·' + sub.key : '');
    if (!groups[id]) {
      groups[id] = { id: id, recordKey: rec.key, title: rec.name + (bySubject ? ' — ' + (sub.name || sub.key) : ''),
                     cap: rec.chars * 3, chars: rec.chars, note: String(rec.note || ''), acts: [] };
      order.push(id);
    }
    groups[id].acts.push({ key: a.key, name: a.name, bytes: activityBytes(a, rec), mode: a.mode });
  });
  return order.map(function (id) { return groups[id]; });
}

/**
 * @param {Array<{key:string, bytes:number}>} list  비우거나 0 이면 기록 항목 한도 전체
 * @return {string}
 */
function bytesSave(list) {
  migrateActivityBytes_();
  var s = shRequire_(APP.SH.ACTIVITY);
  var c = colOf_(s, 2, '바이트 한도');
  if (!c) throw new Error('[🗂 활동목록]에 [바이트 한도] 칸이 없습니다. 메뉴 ① 처음 설치 / 구조 복구 를 먼저 눌러 주세요.');
  var recs = getRecordTypes_(), acts = getActivities_(), n = 0;
  (list || []).forEach(function (x) {
    var a = acts.filter(function (k) { return k.key === x.key; })[0];
    if (!a) return;
    var rec = findByKey(recs, a.recordKey), cap = (rec ? rec.chars : 500) * 3;
    var b = Math.floor(Number(x.bytes) || 0);
    if (b <= 0 || b > cap) b = cap;
    if (b < 60) throw new Error(a.name + ': 60바이트(한글 20자)보다 작게는 정할 수 없습니다.');
    if (b === activityBytes(a, rec) && Number(a.bytes) === b) return;
    s.getRange(a.__row, c).setValue(b);
    a.bytes = b;
    if (rec) refreshInputTitle_(a);
    n++;
  });
  return n ? n + '개 활동의 바이트 한도를 저장했습니다. 다음 생성부터 적용됩니다.' : '바뀐 것이 없습니다.';
}
