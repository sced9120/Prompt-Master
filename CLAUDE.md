# 세특 작성 도우미 (Prompt-Master) — Claude Code 작업 지침

Google Sheets + Apps Script로 학생부 세특(교과·창체·행발)을 AI API로 생성하는 교사용 도구.
교사가 `/copy` 링크로 시트를 복사하면 "🚀 시작하기" 온보딩 팝업이 뜨는 구조로 외부 공개 배포한다.
작성자: 정현서(김해분성고 수학 교사). 응답·UI 문구는 **한국어**, 교사(비개발자)가 읽기 쉬운 말로.

## 명령어

```
npm test          # 6개 테스트 파일 전부 실행 (총 약 250개, 모두 mock 기반)
npm run build     # apps-script/*.gs → dist/Code.gs 번들 + HTML/appsscript.json 복사
npm run kit       # dist → web/deploy-kit.html 재생성 (배포 키트)
```

수정 후 순서: `npm test` → `npm run build` → `npm run kit` → 커밋.

## 구조

- `apps-script/NN_*.gs` — 모듈(번호순으로 번들). 00 Presets, 10 Engine(순수), 12 Models(순수), 14 RosterParse(순수),
  20 Lib, 30 Setup, 32 Onboard, 35 Help, 40 Roster, 50 Activity, 52 Examples, 55 Wizard, 60 AI, 70 Generate, 80 Compile, 90 Forms, 95 Observe
- `apps-script/UI_*.html` — 다이얼로그 (Onboard, ApiKey, Roster, Wizard, Observe)
- `dist/` — 교사가 붙여 넣는 최종본 (Code.gs 1개 + HTML 5개 + appsscript.json). 직접 수정 금지, build로 생성
- `web/prompt-studio.html`, `web/deploy-kit.html` — 아티팩트로 게시한 웹 도구
- `test/` — engine, schema, install, models, roster, activity 테스트 + `sheets-mock.js`(엄격 mock)
- `docs/`, `PROMPT-ARCHITECTURE.md`, `MIGRATION-v2-to-v3.md`, `CHANGELOG.md`

## 핵심 설계

- 프롬프트 7슬롯 조립 엔진: 역할, 과제, 서술규칙, 기재금지, 관점·역량, 분량, 활동고유. NEIS 바이트: 한글 3, ASCII 1, 줄바꿈 2.
- 제공자: OpenAI / Gemini / Anthropic / Gemini(구독, `=AI()` 수식). 기본 모델 `gemini-flash-latest`. 모델명은 ⚙️ 설정 시트의 모델 표에서 사용자가 편집.
- 비용 절감: 여러 학생 묶음 생성(기본 5명), 생각 줄이기, 규칙을 앞에 둬 implicit caching, Claude `cache_control`. (Claude Skills는 시트→API 호출에 적용 불가)
- 명단 모드: 'class'(반·번호) / 'grade'(학년·반·번호). 헤더 이름 기반 파싱, 5자리 학번 분해.
- 활동 입력 항목은 직접 입력·프리셋·AI 제안 3경로, 이후 `updateActivity_`로 수정(이름 같은 열은 데이터 이월).

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
- 커밋 시 `git -c commit.gpgsign=false`. 푸시는 사용자가 직접 한다(`origin` = https://github.com/sced9120/Prompt-Master).

## 아직 검증되지 않은 것 (실제 환경)

모든 테스트는 mock이다. 실제 Google Sheets와 실제 API 키로는 검증하지 않았다.
1. 새 시트에 `dist/Code.gs`·HTML 붙여넣기 → `① 처음 설치 / 구조 복구` 한 번에 전 시트 생성되는지
2. `모델 연결 테스트` (Gemini/OpenAI/Anthropic 각각), 묶음 생성이 실제로 JSON 파싱되는지
3. 명단 xlsx 양식 다운로드·업로드(SheetJS CDN이 학교망에서 막힐 수 있음 → CSV/붙여넣기 대체 있음)
4. 사본 복사 후 온보딩 팝업이 자동으로 뜨는지(권한 승인 흐름 포함)

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
