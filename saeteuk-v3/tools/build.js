/**
 * 설치용 합본 빌드
 *
 * apps-script/ 의 .gs 파일들을 dist/Code.gs 한 개로 합치고, HTML은 그대로 복사한다.
 * 마스터 사본을 만들 때 Apps Script 편집기에 붙여넣을 파일이 4개로 줄어든다.
 *
 *   node tools/build.js
 *
 * 개발은 계속 apps-script/ 의 모듈 파일에서 하고, 배포 직전에 이걸 돌린다.
 * 파일 이름순이 곧 실행 순서이므로 00_ → 95_ 순서를 지켜야 한다
 * (최상위 var 선언이 이 순서대로 평가된다).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'apps-script');
const OUT = path.join(__dirname, '..', 'dist');

function line(ch, n) { return ch.repeat(n); }

function build() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const gs = fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort();
  const html = fs.readdirSync(SRC).filter(f => f.endsWith('.html')).sort();
  const manifest = path.join(SRC, 'appsscript.json');

  const version = (fs.readFileSync(path.join(SRC, '00_Presets.gs'), 'utf8')
    .match(/VERSION:\s*'([^']+)'/) || [, '?'])[1];

  const head = [
    '/' + line('*', 78),
    ' * 세특 작성 도우미 ' + version + ' — 설치용 합본',
    ' *',
    ' * 이 파일 하나에 모든 스크립트가 들어 있습니다.',
    ' * Apps Script 편집기에서 Code.gs 의 내용을 전부 지우고 이 파일을 통째로 붙여넣으세요.',
    ' * HTML 파일 ' + html.length + '개는 각각 같은 이름으로 따로 만들어야 합니다:',
    ' *   ' + html.map(f => f.replace(/\.html$/, '')).join(', '),
    ' *',
    ' * 원본은 모듈별로 나뉘어 있습니다: github.com/sced9120/Prompt-Master',
    ' * 고칠 때는 apps-script/ 의 해당 파일을 고치고 node tools/build.js 를 다시 돌리세요.',
    ' * 이 파일을 직접 고치면 다음 빌드 때 덮어써집니다.',
    ' *',
    ' * 빌드: ' + new Date().toISOString().slice(0, 10) + '  ·  원본 ' + gs.length + '개 파일',
    ' ' + line('*', 77) + '/',
    ''
  ].join('\n');

  const body = gs.map(f => {
    const code = fs.readFileSync(path.join(SRC, f), 'utf8').trimEnd();
    return [
      '',
      '/* ' + line('=', 74),
      '   ' + f,
      '   ' + line('=', 74) + ' */',
      '',
      code,
      ''
    ].join('\n');
  }).join('\n');

  fs.writeFileSync(path.join(OUT, 'Code.gs'), head + body + '\n', 'utf8');
  html.forEach(f => fs.copyFileSync(path.join(SRC, f), path.join(OUT, f)));
  if (fs.existsSync(manifest)) fs.copyFileSync(manifest, path.join(OUT, 'appsscript.json'));

  const bytes = fs.statSync(path.join(OUT, 'Code.gs')).size;
  const lines = fs.readFileSync(path.join(OUT, 'Code.gs'), 'utf8').split('\n').length;

  console.log('dist/Code.gs      ' + gs.length + '개 파일 합침 · ' +
              lines.toLocaleString() + '줄 · ' + (bytes / 1024).toFixed(0) + 'KB');
  html.forEach(f => console.log('dist/' + f));
  console.log('dist/appsscript.json');
  console.log('\n마스터 사본을 만들 때 붙여넣을 파일: ' + (1 + html.length) + '개');
  return { gs, html, bytes };
}

if (require.main === module) build();
module.exports = build;
