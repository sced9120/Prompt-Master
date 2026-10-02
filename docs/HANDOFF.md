# 인수인계 (claude.ai Cowork → Claude Code)

현재 버전 **v3.5.0** (Claude Code에서 작업). 테스트 전부 통과.

## 지금까지의 흐름

| 버전 | 내용 |
|---|---|
| v3.0.0 | 7슬롯 프롬프트 엔진, 전 교과·창체·행발, 활동별 예시, 시작하기 온보딩, 단일 번들 |
| v3.0.1 | 처음 설치 시 시트 하나씩만 생기고 명단이 안 만들어지던 버그 수정(병합+열 고정) |
| v3.1.0 | 모델 직접 입력·모델별 연결 테스트·기본 Gemini |
| v3.2.0 | 명단 모드(반/학년반)·엑셀 양식, 키 여러 개·예비 모델, 모델 자동 확인, 묶음 생성 등 비용 절감 |
| v3.3.0 | 활동 입력 항목(열 머릿말) 직접 입력, 나중에 수정 |
| v3.4.0 | API 키를 넣은 회사의 모델만 고를 수 있게(드롭다운·설정 창·마법사) |
| v3.5.0 | Gemini 구독(학교 계정)으로 키 없이 쓰기 — 시작하기에서 키 단계 건너뛰기, 내 키·구독 모델만 표시 |

## 계정 연결(구독으로 쓰기) 조사 — 2026-10-02

- **OpenAI "Sign in with ChatGPT"** (2026-09-29 DevDay 발표): Plus·Pro 구독 사용량을 다른 앱에서 쓰게 해 주는 OAuth.
  상용·원격 호스팅 앱은 제휴 대기 명단(interest form), 오픈소스는 내 컴퓨터에서 도는 앱(루프백 콜백)만.
  Apps Script는 구글 서버에서 돌아 루프백 콜백을 받을 수 없으므로 지금은 붙일 수 없다. 대기 명단 승인 시 재검토.
- **Google AI Pro·Ultra**: 제3자 앱이 구독으로 Gemini API를 부르는 공식 방법 없음(2026-02 프록시 금지, 2026-06 Gemini CLI 개인 구독 OAuth 중단).
  구독으로 쓰는 공식 경로는 시트의 `=AI()` 함수뿐 → 이미 `Gemini(구독)` 으로 지원 중.
- **학교 계정 `=AI()`** (2026-10 기준): Google AI Pro for Education 부가 서비스(유료, 18세 이상, 월 25,000회)에 포함.
  Education Fundamentals·Standard 는 "No access", Education Plus 도 이 기능은 없음(Sheets Gemini 일부를 "몇 달 안에" 준다고만 발표).
  한국어 지원됨. 결과는 사용자가 [생성 및 삽입]을 눌러야 함(한 번에 350칸).

## 남은 일

- 사용자가 마스터 시트에 v3.3.0 파일(Code.gs, UI_Wizard, UI_Onboard 등)을 붙여넣고 ① 처음 설치 실행
- 실제 API 키로 연결 테스트·생성 검증 (CLAUDE.md "아직 검증되지 않은 것" 참고)
- 사용자가 `git push` (세션 환경에서는 푸시 불가였음)
- 새 기능 요청은 없음. 다음 요청은 사용자에게서 받을 것.

## 시작 방법 (Claude Code)

```
unzip Prompt-Master.zip -d Prompt-Master   # 또는 git clone https://github.com/sced9120/Prompt-Master
cd Prompt-Master
npm install        # 의존성 없음이면 생략 가능
npm test
claude
```
