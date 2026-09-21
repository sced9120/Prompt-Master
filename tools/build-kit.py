"""배포 키트 페이지 생성 — dist/ 의 파일을 페이지 안에 넣어 복사 버튼으로 꺼내 쓰게 한다."""
import json, os, re, datetime
root = os.path.join(os.path.dirname(__file__), '..')
dist = os.path.join(root, 'dist')
order = ['Code.gs', 'UI_Onboard.html', 'UI_ApiKey.html', 'UI_Wizard.html', 'UI_Observe.html']
files = []
for name in order:
    txt = open(os.path.join(dist, name), encoding='utf-8').read()
    files.append({'name': name, 'as': name.replace('.html', '').replace('.gs', ''),
                  'kind': 'gs' if name.endswith('.gs') else 'html',
                  'text': txt, 'lines': txt.count('\n') + 1})
ver = re.search(r"VERSION:\s*'([^']+)'", open(os.path.join(root, 'apps-script', '00_Presets.gs'), encoding='utf-8').read()).group(1)
payload = json.dumps({'version': ver, 'built': datetime.date.today().isoformat(), 'files': files}, ensure_ascii=False)
# 페이지의 <script> 를 깨지 않도록 꺾쇠·앰퍼샌드를 유니코드 이스케이프
payload = payload.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
tpl = open(os.path.join(root, 'tools', 'kit-template.html'), encoding='utf-8').read()
out = tpl.replace('__KIT_DATA__', payload)
open(os.path.join(root, 'web', 'deploy-kit.html'), 'w', encoding='utf-8').write(out)
print(f"web/deploy-kit.html  {len(out)/1024:.0f}KB  · {ver} · 파일 {len(files)}개 내장")
