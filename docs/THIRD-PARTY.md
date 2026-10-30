# 제3자 자료

## im-not-ai — 한글 AI 티 제거기 (Humanize KR)

- 저장소: https://github.com/epoko77-ai/im-not-ai
- 쓴 곳: `apps-script/16_Rules.gs` 의 `AI_TELL_RULES`(🪶 AI 투 검사 — 일반 글 패턴, 괄호 안 번호가 원본 분류 번호), `AVOID_RULES_DEFAULT`, `POLISH_SYSTEM`(다듬기의 원칙).
- 원본의 「한글 AI 티」 분류(skills/humanize-korean/references/quick-rules.md)에서 학생부 문장에 해당하는 것만 골라 이 도구가 정규식과 문구를 새로 썼다.
  세특 상투어(중요성을 깨달음 · 계기가 됨 · 함양함 …)와 되풀이 규칙은 이 도구가 더한 것이다. 원본의 코드 · 분류 본문은 옮기지 않았다.

```
MIT License

Copyright (c) 2026 epoko77-ai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Lucian Icons — 시작하기 · 공방 버튼 아이콘

- 저장소: https://github.com/Seokwoooo/lucian-icons · 갤러리 https://lucianlabs.dev/icons/
- 쓴 곳: `tools/icons/*.json`(play · pen · clipboard · search · signature · scan · book · ruler · layers · help 의 정의를 옮김), `tools/make-buttons.py` 가 정적 그림으로 그려 `apps-script/98_Assets.gs` 에 넣는다.
  공방 페이지는 copy · plus · wand · sparkle · diamond · arrow · document · check · undo · grid · next · save · close · trash 정의를 더 옮겨, `tools/build-studio.js` 가 같은 방식의 인라인 SVG로 `web/prompt-studio.html` 에 넣는다.
- 아이콘 모음은 MIT 라이선스(Copyright (c) 2026 Lucian, 전문은 `tools/icons/LICENSE-lucian-icons.txt`). Lucian · lucianLabs 이름과 로고는 라이선스에 들어 있지 않아 쓰지 않는다.

## 업무 인수인계 대시보드 — 스캔 문서 → 엑셀 지침

- 같은 만든이의 저장소 https://github.com/sced9120/work-dashboard 의 `shared/ocrPrompt.ts`(OCR_RULES · OCR_AGENT_PROMPT)의 판독 규칙(한글 이름 대조, `[불확실: …]`, 취소선 빼기)을 바탕으로
  `apps-script/97_OcrGem.gs` 의 Gem 전용 지침(학생 1명 = 1행, 반 · 번호 · 이름 · 양식 항목별 열)을 따로 썼다. 대시보드 지침과 자동으로 맞추지 않는다.
