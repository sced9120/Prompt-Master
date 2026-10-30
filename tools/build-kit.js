/* 배포 키트 페이지 생성 — dist/ 의 파일을 페이지 안에 넣어 복사 버튼으로 꺼내 쓰게 한다.
   (예전 build-kit.py 를 옮긴 것. Python 없이 node 만으로 돈다) */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const order = ['Code.gs', 'UI_Onboard.html', 'UI_ApiKey.html', 'UI_Roster.html', 'UI_Wizard.html', 'UI_Observe.html'];
const extra = fs.readdirSync(dist).filter(f => f.endsWith('.html') && order.indexOf(f) < 0).sort();
order.push(...extra);   // 새 HTML 이 생겨도 빠뜨리지 않는다

const files = order.map(name => {
  const txt = fs.readFileSync(path.join(dist, name), 'utf8').replace(/\r\n/g, '\n');
  return { name, as: name.replace('.html', '').replace('.gs', ''),
           kind: name.endsWith('.gs') ? 'gs' : 'html',
           text: txt, lines: txt.split('\n').length };
});
const ver = fs.readFileSync(path.join(root, 'apps-script', '00_Presets.gs'), 'utf8').match(/VERSION:\s*'([^']+)'/)[1];
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
// 페이지의 <script> 를 깨지 않도록 꺾쇠·앰퍼샌드를 유니코드 이스케이프
const payload = JSON.stringify({ version: ver, built: today, files })
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

// 윈도우에서 받은 저장소는 줄끝이 CRLF 일 수 있어 LF 로 맞춘다 (예전 Python 판과 같은 결과)
const tpl = fs.readFileSync(path.join(root, 'tools', 'kit-template.html'), 'utf8').replace(/\r\n/g, '\n');
const nHtml = files.filter(f => f.kind === 'html').length;
const ko = { 1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟' };
const out = tpl.split('__KIT_DATA__').join(payload)
  .split('__N_HTML_KO__').join(ko[nHtml] || String(nHtml))
  .split('__N_HTML__').join(String(nHtml))
  .split('__N_ALL__').join(String(files.length));
if (out.indexOf('__N_') >= 0) throw new Error('kit-template.html 에 채우지 못한 자리표시가 남았습니다');
fs.writeFileSync(path.join(root, 'web', 'deploy-kit.html'), out, 'utf8');
console.log('web/deploy-kit.html  ' + Math.round(out.length / 1024) + 'KB  · ' + ver + ' · 파일 ' + files.length + '개 내장');
