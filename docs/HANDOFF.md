# 인수인계 (claude.ai Cowork → Claude Code)

현재 버전 **v3.3.0** (커밋 c705e25 이후 인수인계 커밋). 테스트 전부 통과.

## 지금까지의 흐름

| 버전 | 내용 |
|---|---|
| v3.0.0 | 7슬롯 프롬프트 엔진, 전 교과·창체·행발, 활동별 예시, 시작하기 온보딩, 단일 번들 |
| v3.0.1 | 처음 설치 시 시트 하나씩만 생기고 명단이 안 만들어지던 버그 수정(병합+열 고정) |
| v3.1.0 | 모델 직접 입력·모델별 연결 테스트·기본 Gemini |
| v3.2.0 | 명단 모드(반/학년반)·엑셀 양식, 키 여러 개·예비 모델, 모델 자동 확인, 묶음 생성 등 비용 절감 |
| v3.3.0 | 활동 입력 항목(열 머릿말) 직접 입력, 나중에 수정 |

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
