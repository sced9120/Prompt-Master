# 세특 작성 도우미 (Prompt-Master) — Claude Code 작업 지침

Google Sheets + Apps Script로 학생부 세특(교과·창체·행발)을 AI API로 생성하는 교사용 도구.
교사가 `/copy` 링크로 시트를 복사하면 "🚀 시작하기" 온보딩 팝업이 뜨는 구조로 외부 공개 배포한다.
작성자: 정현서(김해분성고 수학 교사). 응답·UI 문구는 **한국어**, 교사(비개발자)가 읽기 쉬운 말로.

## 명령어

```
npm test          # 9개 테스트 파일 전부 실행 (총 약 410개, 모두 mock 기반)
npm run build     # 공방 페이지(build-studio) → apps-script/*.gs → dist/Code.gs 번들 + HTML/appsscript.json 복사 + rules/latest.json(규칙판)
npm run kit       # build + dist → web/deploy-kit.html 재생성 (배포 키트)
```

수정 후 순서: `npm test` → `npm run build` → `npm run kit` → 커밋.

## 구조

- `apps-script/NN_*.gs` — 모듈(번호순으로 번들). 00 Presets, 10 Engine(순수), 12 Models(순수), 14 RosterParse(순수), 16 Rules(순수: 규칙판·맞춤법·고쳐쓰기·근거·키 없이·내보내기), 17 Design(순수: 예시로 칸 채우기), 18 Reports(순수: 보고서 요점·드라이브 링크·문체·설문지 머리글), 19 Subjects(순수: 새 교과 요청문·답 읽기·나누는 글),
  20 Lib, 30 Setup(메뉴), 32 Onboard(시작하기 시트·버튼), 35 Help, 40 Roster, 45 Rules(📏 시트·원격 규칙판·SAETEUK_CHECK), 50 Activity, 52 Examples, 55 Wizard, 60 AI,
  70 Generate(하네스 루프), 72 Manual(복사·붙여넣기), 74 Check(검사 사이드바), 76 Quick(바로 쓰기), 78 Export(Gem·스킬), 80 Compile, 82 Report(보고서 시트·드라이브 파일 읽기·폴더·예시 등록·내 문체), 84 Subject(📚 새 교과 창·저장), 86 Bytes(📏 활동별 바이트 한도 창), 88 Studio(🧪 공방을 시트 안에서·studioContext), 90 Forms(설문지 연결·제출 트리거), 95 Observe, 96 Guide(OCR 설명서), 98 Assets(버튼 PNG base64)
- `apps-script/UI_*.html` — 다이얼로그 (Onboard, ApiKey, Roster, Wizard, Observe, Manual, Check(사이드바), Quick(바로 쓰기·보고서), Export, OcrGuide, Form, Style, Subject, Bytes, Studio — **UI_Studio 는 web/prompt-studio.html 에서 빌드가 만든다. 직접 고치지 말 것**)
- `rules/latest.json` — 원격 규칙판. **빌드가 `16_Rules.gs` 의 RULES_2026 에서 만든다(직접 고치지 말 것)**. 해마다 고치는 법은 `rules/README.md`
- `dist/` — 교사가 붙여 넣는 최종본 (Code.gs 1개 + HTML 5개 + appsscript.json). 직접 수정 금지, build로 생성
- `web/prompt-studio.html`, `web/deploy-kit.html` — 아티팩트로 게시한 웹 도구. 공방의 `@@ENGINE` 사이는 `tools/build-studio.js` 가 00·10·16·17·19 모듈로 채운다(손으로 고치지 말 것)
- `test/` — engine, schema, install, models, roster, activity 테스트 + `sheets-mock.js`(엄격 mock)
- `docs/`, `PROMPT-ARCHITECTURE.md`, `MIGRATION-v2-to-v3.md`, `CHANGELOG.md`

## 핵심 설계

- 프롬프트 7슬롯 조립 엔진: 역할, 과제, 서술규칙, 기재금지, 관점·역량, 분량, 활동고유. NEIS 바이트: 한글 3, ASCII 1, 줄바꿈 2.
- 제공자: OpenAI / Gemini / Anthropic / Gemini(구독, `=AI()` 수식) / 키 없이(복사·붙여넣기). 기본 모델 `gemini-flash-latest`. 모델명은 ⚙️ 설정 시트의 모델 표에서 사용자가 편집.
- 모델 목록(드롭다운·설정 창·마법사)은 **키를 넣은 회사 + 구독을 켰을 때의 Gemini(구독) + 늘 키 없이** 만. `keyStatus_()` 가 `{gemini, openai, anthropic, subscription, manual}` 을 돌려주고 `usableModels` 로 거른다.
  구독 사용 여부는 UserProperties `SUB_GEMINI` ('1'/'0', 없으면 설정에 Gemini(구독)이 골라져 있을 때 켠 것으로 이어받음).
- `=AI()` 결과는 사용자가 셀에서 [생성 및 삽입]을 눌러야 나온다(스크립트로 불가). 학교 계정은 Google AI Pro for Education 이 있어야 함.
- 비용 절감: 여러 학생 묶음 생성(기본 5명), 생각 줄이기, 규칙을 앞에 둬 implicit caching, Claude `cache_control`. (스킬·하네스와의 관계는 `docs/HARNESS.md`)
- 명단 모드: 'class'(반·번호) / 'grade'(학년·반·번호). 헤더 이름 기반 파싱, 5자리 학번 분해.
- 활동 입력 항목은 직접 입력·프리셋·AI 제안 3경로, 이후 `updateActivity_`로 수정(이름 같은 열은 데이터 이월).
- **키 없이(v3.6)**: `MANUAL_MODEL = '키 없이(복사·붙여넣기)'`, `providerOf_` → 'manual', `keyStatus_().manual` 은 늘 true → 드롭다운 맨 끝에 늘 있음.
  API 키가 하나도 없으면 생성·압축이 저절로 복사·붙여넣기 창(UI_Manual)으로. 답은 `parseManualAnswer`(`[S1]`·`**S1**`·`S1:`·JSON).
- **검사(v3.6)**: 모든 검증은 `inspect_(text, limit)` 하나 — [📏 기재요령] 표(`rulesAll_`, 없으면 RULES_2026) + `spellIssues`. 예전 `PRESET_BANNED` 직접 호출 금지.
- **하네스(v3.6)**: `runGeneration_` 의 polish — 생성 → inspect → [수정]이면 `buildRepairUser` 로 한 번 더(설정 `자동 고쳐쓰기`), `betterResult` 가 b 일 때만 교체 → (설정 `근거 자동 확인`) `groundCheck_`.
- **규칙판 업데이트**: `autoRulesCheck_` 7일 간격(DocumentProperties RULES_CHECKED_AT), 손대지 않은 칸만 — `knownOldTexts`(OLD_NEIS_RULES + history), 글자수는 `history[].chars`. '내 학교' 출처 줄은 보존.
- **바로 쓰기**: 활동목록 프롬프트 모드 `바로쓰기`, 입력 항목 `관찰 메모` 하나, 예시 시트 없음(`exSheet` ''). onEdit 가 [최종본]·[AI 결과] 편집 때 [검증] 재작성(`recheckOnEdit_`).
- **보고서(v3.7)**: 모드 `보고서`, 입력 항목 [보고서|보고서 요점|교사 관찰 메모]. `modelCols_` 가 [보고서] 원문을 AI 자료에서 뺀다. 요점이 빈 학생은 `runExtraction_` 먼저, 보고서 시트는 묶음 1.
  드라이브는 `drive.readonly`만(매니페스트). 파일은 `readReportSource_` — 구글 문서는 Drive API 내보내기(실패 시 getAs PDF), PDF·사진은 parts(base64, 한 학생 13MB), docx·hwpx·pptx 는 unzip.
- **내 문체(v3.7)**: [✒️ 내 문체] 시트 앞 3편 → buildPrompt styleSamples, 공통규칙 STYLE_CARD → 규칙 끝 + `styleTail_()` 로 학생 자료 뒤. 문체 검사 `styleDrift`(check).
- **설문지(v3.7)**: 연결은 DocumentProperties FORM_LINKS. 머리글 이름으로 학생 칸·문항(`parseFormHeader`), 고친 칸 보존은 칸 메모의 `textHash`. 제출 트리거 `onFormSubmitInstalled` — 바로 생성은 값이 바뀐 줄(`rows`)만.
- **바이트 한도(v3.8)**: 활동목록 5열 [바이트 한도](예전 [글자수]는 `migrateActivityBytes_` 가 ×3 으로 옮김 — createActivity_·구조 복구). 한도는 늘 `bytesFor_(act)` → `activityBytes(act, rec)`(기록 항목 한 칸을 넘지 않음). `charsFor_*3` 쓰지 말 것.
  나눠 쓰면 buildPrompt 가 "한 칸 가운데 한 부분" 문장을 넣는다. 묶음: 교과(kind 교과)면 (기록종류, 교과영역), 아니면 기록종류.
- **공방 칸 채우기(v3.8.2)**: 예시 결과 → `buildDesignUser` → `parseDesignAnswer`(입력 항목 순서의 "항목: 값"), 바이트는 `suggestBytes`. 시트는 프롬프트 글을 저장하지 않고 재료(입력 항목·개요·바이트·예시)만 저장한다.
- **공방(v3.8.1)**: 한 파일(web/prompt-studio.html)이 웹·시트 둘 다. `google.script.run` 이 있으면 시트 모드 — studioContext 로 RECORDS·BUILTIN·COMMON·RULESET 을 바꿔 끼우고, 활동은 studioCreateActivity, 교과는 subjectSave.
- **새 교과(v3.8)**: AI 답·공방·나누는 글이 모두 "이름: 값" 한 모양 → `parseSubjectAnswer`. `[교육과정 확인 필요]` 가 남으면 `subjectSave` 는 opts.confirmed 없이 거절.
- 시작하기 버튼: `insertImage` + `assignScript` — 함수 이름 끝에 `_` 금지. 휴대폰 앱에선 동작 안 함(메뉴 안내 병기).

## 반드시 지킬 규칙

- **API 키는 UserProperties에만.** 시트·코드·로그에 쓰지 않는다. 학생 이름은 기본 마스킹(설정 OFF일 때만 전송).
- 순수 파일(10/12/14)은 `module.exports` 가드 유지 (테스트가 vm으로 로드).
- 제로폭 문자·NBSP는 소스에 리터럴로 넣지 말고 `​-‍﻿`, ` ` 이스케이프로.
- 모든 HTML 다이얼로그: `<meta charset="utf-8">`, `[hidden]{display:none!important}`.
- Sheets 규칙(mock이 강제): 병합을 가르는 열 고정 불가, 기존 병합과 부분 겹침 불가, 고정 경계 넘는 병합 불가. 1행 배너는 `splitBanner_/unmergeRow_/ensureCols_` 사용. 설치 단계는 각각 try/catch.
- onOpen(단순 트리거)에서 PropertiesService 사용 금지 → `needsOnboarding_()`(시트 기반).
- onEdit(단순 트리거)에서 AI 호출 불가 → `⏳ 확인 전` 표시 후 모델 대화상자 열 때 자동 확인.
- 컨테이너 바인딩 스크립트: 설치형 트리거·웹앱 배포는 복사되지 않음.
- 버전 올릴 때: `00_Presets.gs`의 `APP.VERSION`, `package.json`, `CHANGELOG.md`, deploy-kit 재생성을 함께.
- 메뉴 맨 위 항목은 8개 이하(작은 화면에서 잘림 — 시험이 강제). 나머지는 하위 메뉴로.
- 윈도우에서 한글이 든 편집 스크립트를 stdin(heredoc)으로 python 에 넘기지 말 것(cp949 로 읽힘) — 파일로 만들어 `python -I 파일` 로.
- 2026 기재요령 근거는 「2026 학교생활기록부 기재요령 주요 개정사항 안내(고등학교)」 쪽수(고 p.○)로 why 에 적는다.
- 커밋 시 `git -c commit.gpgsign=false`. 푸시는 사용자가 직접 한다(`origin` = https://github.com/sced9120/Prompt-Master).

## 아직 검증되지 않은 것 (실제 환경)

모든 테스트는 mock이다. 실제 Google Sheets와 실제 API 키로는 검증하지 않았다.
1. 새 시트에 `dist/Code.gs`·HTML 붙여넣기 → `① 처음 설치 / 구조 복구` 한 번에 전 시트 생성되는지
2. `모델 연결 테스트` (Gemini/OpenAI/Anthropic 각각), 묶음 생성이 실제로 JSON 파싱되는지
3. 명단 xlsx 양식 다운로드·업로드(SheetJS CDN이 학교망에서 막힐 수 있음 → CSV/붙여넣기 대체 있음)
4. 사본 복사 후 온보딩 팝업이 자동으로 뜨는지(권한 승인 흐름 포함)
5. 스크립트가 넣은 긴 `=AI("…")` 수식(규칙 수천 자 + 줄바꿈)이 실제 구독 계정에서 [생성 및 삽입]으로 생성되는지
6. (v3.6) 시작하기 시트 버튼(insertImage·assignScript), 검사 사이드바, 복사·붙여넣기 창의 복사 버튼(execCommand), 스킬 zip 내려받기, `=SAETEUK_CHECK`(사용자 정의 함수)가 실제 시트에서 되는지
7. (v3.6) `rules/latest.json` 을 main 에 올린 뒤 사본이 RULES_URL 에서 받아 오는지(올리기 전에는 404 → 조용히 넘어감)

## 알려진 한계

- 마스터를 고쳐도 이미 복사된 사본은 자동 갱신되지 않는다.
- 묶음 생성 시 문장이 서로 비슷해질 수 있음 → `한 번에 묶을 학생 수`를 1로.
- 입력 항목 이름을 바꾸면 새 항목으로 취급(기존 열 데이터 삭제, UI에서 경고).

## 배포 흐름

1. `npm run build` → `dist/Code.gs` + `UI_*.html` + `appsscript.json`을 마스터 시트의 Apps Script에 붙여넣기
2. 시트에서 `① 처음 설치` 실행·권한 승인, 마스터를 "링크가 있는 모든 사용자 보기"로 공유
3. 교사에게 `.../copy` 로 끝나는 링크 배포 → 사본에서 시작하기 팝업
4. 배포 키트 아티팩트(https://claude.ai/artifact/EgzKxsdsC2ZxLMji683bfK)는 `web/deploy-kit.html`을 같은 경로로 재게시(먼저 live 버전 read 필요)

자세한 이력은 `CHANGELOG.md`, 인수인계 요약은 `docs/HANDOFF.md`.
