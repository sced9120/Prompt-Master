# 시작하기 시트 버튼 그림 만들기 (윈도우 · 맑은 고딕 굵게 · PyMuPDF 필요: pip install pymupdf)
# python tools/make-buttons.py <pymupdf 경로 또는 .> <출력 폴더>  → 출력 폴더/assets.js 를 98_Assets.gs 의 BUTTON_PNG 안에 붙여 넣는다
import sys, base64, os
sys.path.insert(0, sys.argv[1])
import pymupdf

out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
FONT = r'C:\Windows\Fonts\malgunbd.ttf'
W, H = 380, 52

BTNS = [
    ('start', '▶  시작하기 (처음이면 여기)', (0x35/255, 0x58/255, 0x3f/255), (1, 1, 1), None),
    ('quick', '＋  바로 쓰기 시트 만들기', (1, 1, 1), (0x35/255, 0x58/255, 0x3f/255), (0x35/255, 0x58/255, 0x3f/255)),
    ('check', '◎  맞춤법 · 금지어 검사', (1, 1, 1), (0x35/255, 0x58/255, 0x3f/255), (0x35/255, 0x58/255, 0x3f/255)),
    ('ocr',   '■  스캔 문서 → 엑셀 사용 설명서', (0x1f/255, 0x4f/255, 0x8f/255), (1, 1, 1), None),
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
