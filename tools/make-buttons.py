# 시작하기 시트 버튼 그림 만들기 (윈도우 · 맑은 고딕 굵게 · PyMuPDF 필요: pip install pymupdf)
# python tools/make-buttons.py <pymupdf 경로 또는 .> <출력 폴더>  → 출력 폴더/assets.js 를 98_Assets.gs 의 BUTTON_PNG 안에 붙여 넣는다
#
# 아이콘은 Lucian Icons(MIT, https://lucianlabs.dev/icons/) — tools/icons/<id>.json 은 그 아이콘 정의(svg · 색 · 기본 모습)를 옮겨 둔 것.
# 움직임은 쓰지 않고 기본 모습만 정적 그림으로 그린다(시트 그림은 움직이지 않음). 라이선스: tools/icons/LICENSE-lucian-icons.txt
import sys, base64, os, json, re
sys.path.insert(0, sys.argv[1])
import pymupdf

out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
FONT = r'C:\Windows\Fonts\malgunbd.ttf'
W, H = 380, 52
TINT = 0.24
INK = '#1E2A24'
GREEN = '#35583F'
WHITE = '#FFFFFF'
LINE = '#C9D1C9'


def static_svg(d, accent=None, ink=INK, weight=1.75):
    """Lucian Icons staticSVG 와 같은 방식: 면(.s .t)은 아이콘 색을 옅게, 강조(.a .f)는 아이콘 색, 선은 잉크색"""
    accent = accent or d['color']
    rep = {
        's': 'fill="%s" fill-opacity="%s"' % (accent, TINT),
        't': 'fill="%s" fill-opacity="%s" stroke="none"' % (accent, TINT),
        'a': 'stroke="%s"' % accent, 'f': 'fill="%s" stroke="none"' % accent,
        'k': 'fill="%s" stroke="none"' % ink, 'y': 'fill="#F4AF2D" stroke="none"', 'e': 'stroke="#F05465"',
    }
    body = re.sub(r'class="([saftkye])"', lambda m: rep[m.group(1)], d['svg'])
    pose = {}
    for k, v in (d.get('poses') or {}).get('*', {}).items(): pose[k] = dict(v)
    for k, v in (d.get('poses') or {}).get(d.get('defaultState') or '', {}).items(): pose.setdefault(k, {}).update(v)
    hidden = lambda part: any((pose.get(part) or {}).get(x) == 0 for x in ('opacity', 'draw', 'scale'))
    body = re.sub(r'<(path|circle|rect|ellipse|line|polyline)\b[^>]*data-part="([\w-]+)"[^>]*/>', lambda m: '' if hidden(m.group(2)) else m.group(0), body)
    body = re.sub(r'<g data-part="([\w-]+)"[^>]*>.*?</g>', lambda m: '' if hidden(m.group(1)) else m.group(0), body, flags=re.S)
    body = re.sub(r'\sdata-part="[\w-]+"', '', body)
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%s" '
            'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</svg>') % (ink, weight, body)


def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# (그림 키, 아이콘, 글, 바탕, 글자색, 테두리) — 첫 버튼만 초록 바탕에 흰 아이콘
BTNS = [
    ('start',   'play',      '시작하기 (처음이면 여기)', GREEN, WHITE, None),
    ('quick',   'pen',       '바로 쓰기 · 보고서 시트',  WHITE, INK,   LINE),
    ('form',    'clipboard', '구글 설문지 연결',         WHITE, INK,   LINE),
    ('check',   'search',    '맞춤법 · 금지어 검사',     WHITE, INK,   LINE),
    ('style',   'signature', '내 문체 카드',             WHITE, INK,   LINE),
    ('ocr',     'scan',      '스캔 문서 → 엑셀 설명서',  WHITE, INK,   LINE),
    ('subject', 'book',      '새 교과 만들기',           WHITE, INK,   LINE),
    ('bytes',   'ruler',     '활동별 바이트 한도',       WHITE, INK,   LINE),
    ('studio',  'layers',    '세특 프롬프트 공방',       WHITE, INK,   LINE),
    ('help',    'help',      '사용법 시트',              WHITE, INK,   LINE),
]

font = pymupdf.Font(fontfile=FONT)
js = []
for key, icon_id, label, fill, color, border in BTNS:
    d = json.load(open(os.path.join(ICONS, icon_id + '.json'), encoding='utf-8'))
    on_green = fill == GREEN
    svg = static_svg(d, accent=WHITE if on_green else None, ink=WHITE if on_green else INK)
    icon_pdf = pymupdf.open('pdf', pymupdf.open(stream=svg.encode('utf-8'), filetype='svg').convert_to_pdf())
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.draw_rect(pymupdf.Rect(1.5, 1.5, W - 1.5, H - 1.5), color=rgb(border or fill), fill=rgb(fill), width=1.4 if border else 0, radius=0.22)
    isz, x0, fs = 24, 26, 16.5
    page.show_pdf_page(pymupdf.Rect(x0, (H - isz) / 2, x0 + isz, (H + isz) / 2), icon_pdf, 0)
    page.insert_font(fontname='mg', fontfile=FONT)
    page.insert_text((x0 + isz + 10, H / 2 + fs * 0.36), label, fontname='mg', fontsize=fs, color=rgb(color))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=True)
    path = os.path.join(out_dir, key + '.png')
    pix.save(path)
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    js.append("  %s: '%s'" % (key, b64))
    print(key, icon_id, len(b64))

with open(os.path.join(out_dir, 'assets.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(',\n'.join(js))
