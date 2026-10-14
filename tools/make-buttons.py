# 시작하기 시트 버튼 그림 만들기 (윈도우 · 맑은 고딕 굵게 · PyMuPDF 필요: pip install pymupdf)
# python tools/make-buttons.py <pymupdf 경로 또는 .> <출력 폴더>  → 출력 폴더/assets.js 를 98_Assets.gs 의 BUTTON_PNG 안에 붙여 넣는다
import sys, base64, os
sys.path.insert(0, sys.argv[1])
import pymupdf

out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
FONT = r'C:\Windows\Fonts\malgunbd.ttf'
W, H = 380, 52

G = (0x35/255, 0x58/255, 0x3f/255)   # 초록(기본)
P = (0x4a/255, 0x3f/255, 0x6b/255)   # 보라(내 문체)
B = (0x1f/255, 0x4f/255, 0x8f/255)   # 파랑(함께 쓰는 도구)
W1 = (1, 1, 1)
BTNS = [
    ('start', '▶  시작하기 (처음이면 여기)', G, W1, None),
    ('quick', '＋  바로 쓰기 · 보고서 시트', W1, G, G),
    ('form',  '≡  구글 설문지 연결', W1, G, G),
    ('check', '◎  맞춤법 · 금지어 검사', W1, G, G),
    ('style', '◇  내 문체 카드', W1, P, P),
    ('ocr',   '■  스캔 문서 → 엑셀 사용 설명서', B, W1, None),
    ('subject', '□  새 교과 만들기', W1, G, G),
    ('bytes', '↔  활동별 바이트 한도', W1, G, G),
    ('studio', '◇  세특 프롬프트 공방', W1, G, G),
    ('help', '?  사용법 시트', W1, G, G),
]

js = []
for key, label, fill, color, border in BTNS:
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    r = pymupdf.Rect(1.5, 1.5, W - 1.5, H - 1.5)
    page.draw_rect(r, color=border or fill, fill=fill, width=1.6 if border else 0, radius=0.22)
    page.insert_font(fontname='mg', fontfile=FONT)
    fs = 17
    tw = pymupdf.Font(fontfile=FONT).text_length(label, fontsize=fs)
    x = (W - tw) / 2
    y = H / 2 + fs * 0.36
    page.insert_text((x, y), label, fontname='mg', fontsize=fs, color=color)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=True)
    path = os.path.join(out_dir, key + '.png')
    pix.save(path)
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    js.append("  %s: '%s'" % (key, b64))
    print(key, len(b64))

with open(os.path.join(out_dir, 'assets.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(',\n'.join(js))
