/******************************************************************************
 * 세특 작성 도우미 v3.8.1 — 설치용 합본
 *
 * 이 파일 하나에 모든 스크립트가 들어 있습니다.
 * Apps Script 편집기에서 Code.gs 의 내용을 전부 지우고 이 파일을 통째로 붙여넣으세요.
 * HTML 파일 15개는 각각 같은 이름으로 따로 만들어야 합니다:
 *   UI_ApiKey, UI_Bytes, UI_Check, UI_Export, UI_Form, UI_Manual, UI_Observe, UI_OcrGuide, UI_Onboard, UI_Quick, UI_Roster, UI_Studio, UI_Style, UI_Subject, UI_Wizard
 *
 * 원본은 모듈별로 나뉘어 있습니다: github.com/sced9120/Prompt-Master
 * 고칠 때는 apps-script/ 의 해당 파일을 고치고 node tools/build.js 를 다시 돌리세요.
 * 이 파일을 직접 고치면 다음 빌드 때 덮어써집니다.
 *
 * 빌드: 2026-10-14  ·  원본 31개 파일
 *****************************************************************************/

/* ==========================================================================
   00_Presets.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 기본 프리셋
 * ---------------------------------------------------------------
 * 이 파일의 값은 "최초 설치 시 시트에 채워지는 기본값"입니다.
 * 설치 후에는 스프레드시트의 [기록종류] · [교과영역] · [공통규칙] 시트에서
 * 자유롭게 수정하세요. 코드를 고칠 필요가 없습니다.
 * ---------------------------------------------------------------
 */

var APP = {
  VERSION: 'v3.8.1',
  MENU: '세특 도우미 v3',
  // 시트 이름 (바꾸려면 여기만 고치면 됩니다)
  SH: {
    START: '🚀 시작하기',
    HELP: '📖 사용법',
    CONFIG: '⚙️ 설정',
    ROSTER: '👤 학생명단',
    RECORD: '🧩 기록종류',
    SUBJECT: '📚 교과영역',
    COMMON: '📐 공통규칙',
    ACTIVITY: '🗂 활동목록',
    COMPILE_PREFIX: '📦 취합 ▸',
    REVIEW: '✅ 검토',
    RULES: '📏 기재요령',
    STYLE: '✒️ 내 문체',
    FORM_RAW: '📥 폼응답원본'
  },
  SUFFIX: { IN: ' ▸입력', EX: ' ▸예시' },
  // 활동 입력 시트의 고정 열 구조
  HEAD_ROW: 3,   // 헤더 행
  DATA_ROW: 4,   // 데이터 시작 행
  COLORS: {
    input: '#fff8e1',   // 교사가 채우는 칸
    output: '#e8f5e9',  // AI 결과
    paste: '#e3f2fd',   // 복붙용
    lock: '#eeeeee',    // 자동/수정금지
    warn: '#ffebee'
  }
};

/**
 * 기록 종류 프리셋
 * 출처: 2026학년도 학교생활기록부 기재요령(교육부·17개 시도교육청)
 * ※ 글자수는 학년도마다 바뀝니다. 반드시 해당 연도 기재요령으로 확인 후 시트에서 수정하세요.
 */
var PRESET_RECORD_TYPES = [
  {
    key: '과세특',
    name: '과목별 세부능력 및 특기사항',
    chars: 500,
    useGrade: true,
    role: '{교과} 교과를 {연차}년간 지도해 온 고등학교 교사',
    goal: '교과 수업과 평가 과정에서 관찰한 학생의 학업 역량·성장 과정을 학교생활기록부의 과목별 세부능력 및 특기사항으로 작성',
    view: '- 교과 수업·평가 장면에서 실제로 관찰된 사실을 근거로 서술할 것\n' +
          '- 결과물의 우수성보다 탐구 과정·사고의 전개·태도의 변화를 중심으로 서술할 것\n' +
          '- 해당 교과의 핵심역량이 드러나는 장면을 구체적으로 연결할 것',
    note: '과목별 최대 500자. 2022 개정 공통과목(공통국어·공통수학·공통영어·통합사회·통합과학·한국사·과학탐구실험)은 1·2를 합산해 500자, 전공실무과목은 학기별 500자. 2026학년도 기준(고 p.208).'
  },
  {
    key: '개세특',
    name: '개인별 세부능력 및 특기사항',
    chars: 500,
    useGrade: false,
    role: '학생의 학습 전반을 관찰해 온 고등학교 교사',
    goal: '특정 교과에 귀속되지 않는 학생의 학업 관련 특성을 개인별 세부능력 및 특기사항으로 작성',
    view: '- 특정 과목의 성취가 아니라 교과 전반에 걸친 학습 태도·방법·성장을 서술할 것\n' +
          '- 학교교육계획에 따라 이루어진 활동만 근거로 삼을 것',
    note: '교과별 세특에 담기 어려운 내용을 기재.'
  },
  {
    key: '자율',
    name: '자율·자치활동 특기사항',
    chars: 500,
    useGrade: false,
    role: '학급과 학교 활동을 함께해 온 담임교사',
    goal: '자율·자치활동에서 드러난 학생의 역할·참여도·성장을 창의적 체험활동 특기사항으로 작성',
    view: '- 학급·학교 단위 활동에서 학생이 맡은 구체적 역할과 기여를 중심으로 서술할 것\n' +
          '- 단순 참여 사실 나열이 아니라 참여의 동기·과정·변화가 드러나도록 할 것\n' +
          '- 교과 역량 문구를 억지로 넣지 말 것',
    note: ''
  },
  {
    key: '동아리',
    name: '동아리활동 특기사항',
    chars: 500,
    useGrade: false,
    role: '동아리를 지도해 온 고등학교 교사',
    goal: '정규 동아리활동에서 관찰한 학생의 탐구 과정·협력·성장을 창의적 체험활동 특기사항으로 작성',
    view: '- 동아리의 공동 활동과 그 안에서 학생 개인이 맡은 몫을 구분해 서술할 것\n' +
          '- 탐구 주제 선정 이유 → 과정 → 어려움과 해결 → 알게 된 점 흐름이 드러나게 할 것\n' +
          '- 학생의 진로와 자연스럽게 연결되는 지점이 있으면 드러낼 것',
    note: '자율동아리는 대입 미반영. 정규 동아리 활동만 기재.'
  },
  {
    key: '진로',
    name: '진로활동 특기사항',
    chars: 500,
    useGrade: false,
    role: '학생의 진로 탐색을 지도해 온 고등학교 교사',
    goal: '진로활동에서 관찰한 학생의 진로 탐색 과정과 자기이해의 심화를 특기사항으로 작성',
    view: '- 희망 진로 자체보다 그 진로에 도달하기 위한 탐색 과정과 근거를 서술할 것\n' +
          '- 진로가 바뀌었다면 변화의 계기와 사고의 확장을 긍정적으로 서술할 것\n' +
          '- 특정 대학·학과·기관명을 쓰지 말 것',
    note: '2026학년도부터 700자 → 500자로 축소.'
  },
  {
    key: '행발',
    name: '행동특성 및 종합의견',
    chars: 300,
    useGrade: false,
    role: '1년간 학생을 관찰해 온 담임교사',
    goal: '1년간의 관찰을 바탕으로 학생의 행동특성과 학습·인성 전반에 대한 종합의견을 작성',
    view: '- 담임교사의 관찰자 시점에서, 학생을 총체적으로 조망하여 서술할 것\n' +
          '- 인성·대인관계·자기관리·학습태도가 균형 있게 드러나도록 할 것\n' +
          '- 교과 성취나 특정 활동의 재탕이 되지 않도록 할 것\n' +
          '- 추천서에 준하는 서술이 되도록 하되 단정적 평가어는 피할 것',
    note: '2026학년도부터 500자 → 300자로 축소. 분량이 매우 짧으니 문장을 압축할 것.'
  }
];

/**
 * 교과·영역 프로필 프리셋
 * role      : 역할 문장에 들어갈 표현
 * comp      : 해당 교과/영역에서 드러나야 할 역량·관점 (프롬프트에 그대로 삽입)
 */
var PRESET_SUBJECTS = [
  {
    key: '공통',
    name: '(교과 무관 · 창체/행발용)',
    kind: '공통',
    role: '고등학교 교사',
    comp: '2022 개정 교육과정 핵심역량 중 다음이 드러나도록 서술한다.\n' +
          '자기관리, 지식정보처리, 창의적 사고, 심미적 감성, 협력적 소통, 공동체 역량.\n' +
          '역량 이름을 그대로 나열하지 말고, 관찰된 장면 속에서 자연스럽게 드러나게 한다.'
  },
  {
    key: '수학',
    name: '수학',
    kind: '교과',
    role: '고등학교 수학교사',
    comp: '수학과 핵심역량: 문제해결, 추론, 의사소통, 연결, 정보처리.\n' +
          '- 수학적 지식을 이해하고 활용하여 자신감 있게 문제를 해결하는 모습\n' +
          '- 수학적 사실에 흥미를 갖고 추측과 정당화를 통해 추론하는 모습\n' +
          '- 수학적 사고와 전략을 언어·기호·그래프로 표현하고 소통하는 모습\n' +
          '- 개념·원리·법칙 간 관련성을 탐구하고 실생활이나 타 교과에 적용하는 모습\n' +
          '- 공학 도구를 목적에 맞게 활용하고 자료를 처리하여 합리적으로 판단하는 모습'
  },
  {
    key: '국어',
    name: '국어',
    kind: '교과',
    role: '고등학교 국어교사',
    comp: '국어과 핵심역량: 비판적·창의적 사고, 자료·정보 활용, 의사소통, 공동체·대인관계, 문화향유, 자기성찰·계발.\n' +
          '- 텍스트를 맥락 속에서 해석하고 근거를 들어 비판적으로 읽는 모습\n' +
          '- 자신의 생각을 목적과 독자에 맞게 조직하여 표현하는 모습\n' +
          '- 토의·토론에서 상대의 논지를 정확히 파악하고 조정하는 모습'
  },
  {
    key: '영어',
    name: '영어',
    kind: '교과',
    role: '고등학교 영어교사',
    comp: '영어과 핵심역량: 영어 의사소통, 자기관리, 공동체, 지식정보처리.\n' +
          '- 주제와 상황에 맞게 듣고 읽은 내용을 이해·재구성하는 모습\n' +
          '- 자신의 생각을 영어로 조직하여 말하고 쓰는 모습\n' +
          '- 어휘·구문을 맥락 속에서 추론하며 학습 전략을 스스로 조절하는 모습\n' +
          '※ 공인어학시험 점수·등급은 절대 언급하지 않는다.'
  },
  {
    key: '과학',
    name: '과학(통합과학·물화생지)',
    kind: '교과',
    role: '고등학교 과학교사',
    comp: '과학과 핵심역량: 과학적 사고력, 탐구능력, 문제해결력, 의사소통능력, 참여와 평생학습능력.\n' +
          '- 가설 설정 → 변인 통제 → 자료 수집 → 해석 → 결론의 흐름을 스스로 설계하는 모습\n' +
          '- 오차와 한계를 인식하고 개선 방안을 제시하는 모습\n' +
          '- 과학 개념을 실생활·사회적 쟁점과 연결하여 설명하는 모습'
  },
  {
    key: '사회',
    name: '사회(통합사회·역사·지리·일반사회)',
    kind: '교과',
    role: '고등학교 사회교사',
    comp: '사회과 핵심역량: 창의적 사고력, 비판적 사고력, 문제해결력 및 의사결정력, 의사소통 및 협업능력, 정보활용능력.\n' +
          '- 자료를 근거로 사회 현상을 다각도에서 해석하는 모습\n' +
          '- 서로 다른 입장을 비교하고 합리적 대안을 도출하는 모습\n' +
          '- 공동체 문제에 관심을 갖고 참여적 태도를 보이는 모습'
  },
  {
    key: '정보',
    name: '정보·인공지능',
    kind: '교과',
    role: '고등학교 정보교사',
    comp: '정보과 핵심역량: 컴퓨팅 사고력, 디지털 문화 소양, 인공지능 소양, 협력적 문제해결력.\n' +
          '- 문제를 분해하고 추상화하여 알고리즘으로 표현하는 모습\n' +
          '- 코드를 스스로 디버깅하며 개선하는 과정\n' +
          '- 데이터·인공지능의 활용과 그 사회적 영향을 함께 고려하는 태도'
  },
  {
    key: '체육',
    name: '체육',
    kind: '교과',
    role: '고등학교 체육교사',
    comp: '체육과 핵심역량: 건강관리, 신체수련, 경기수행, 신체표현 능력.\n' +
          '- 자신의 체력 수준을 파악하고 목표를 세워 꾸준히 관리하는 모습\n' +
          '- 경기 상황에서 전략을 이해하고 동료와 협력하는 모습\n' +
          '- 규칙과 상대를 존중하는 스포츠맨십'
  },
  {
    key: '예술',
    name: '음악·미술',
    kind: '교과',
    role: '고등학교 예술교사',
    comp: '예술과 핵심역량: 심미적 감성, 창의적 사고, 문화적 공동체, 자기주도 학습 능력.\n' +
          '- 작품의 의도를 자신의 언어로 해석하고 표현하는 모습\n' +
          '- 재료·기법·매체를 선택하고 시도하며 완성도를 높여 가는 과정\n' +
          '- 서로의 작품을 존중하며 감상하고 피드백하는 태도'
  },
  {
    key: '진로교과',
    name: '진로와 직업',
    kind: '교과',
    role: '고등학교 진로교사',
    comp: '자기이해, 일과 직업세계 이해, 진로탐색, 진로디자인과 준비 역량.\n' +
          '- 자기 이해를 근거 자료와 연결하여 구체화하는 모습\n' +
          '- 관심 분야를 좁혀 가며 탐색의 깊이를 더하는 과정'
  }
];

/**
 * [📐 공통규칙]의 NEIS_RULES 기본 문구 — 2026학년도 학교생활기록부 기재요령 기준.
 * 프롬프트의 [학생부 기재 금지사항] 칸에 그대로 들어간다.
 * 해마다 바뀌는 부분은 16_Rules.gs 의 규칙판(RULES_2026)과 원격 규칙판이 이어받는다.
 */
var NEIS_RULES_2026 =
  '다음은 학교생활기록부에 기재할 수 없다(2026학년도 학교생활기록부 기재요령 기준). 결과물에 절대 포함하지 않는다.\n' +
  '- 교내·외 대회 참여 사실과 그 성적·수상실적, 수상 등수(수상경력란에만 기재). 대회 이름을 단순 행사로 바꿔 쓰는 것도 안 된다.\n' +
  '- 교외 기관·단체(장)에게 받은 상(표창장·감사장·공로상 포함)\n' +
  '- 공인어학시험(TOEIC, TOEFL, TEPS, HSK, JLPT, G-TELP 등)과 교내·외 인증시험의 참여 사실·점수·등급\n' +
  '- 자격증·인증 취득 사실, 기능사·산업기사 같은 자격명(자격증란에만 기재)\n' +
  '- 모의고사·전국연합학력평가 성적(원점수, 석차, 등급, 백분위)\n' +
  '- 논문(소논문)의 학회지 투고·등재·학회 발표 사실, 도서 출간 사실, 특허·실용신안·상표·디자인 출원·등록 사실\n' +
  '- 연구보고서(소논문) 관련 실적(제목, 연구 주제, 참여 인원, 소요 시간)\n' +
  '- K-MOOC·MOOC·KOCW 같은 온라인 공개강좌 수강 내용, 방과후학교 활동\n' +
  '- 해외 활동실적, 어학연수, 해외봉사\n' +
  '- 특정 대학명·학과명, 기관명, 사설 학원·강사명, 상호명(도서명·저자명에 들어 있는 경우만 예외)\n' +
  '- 부모 및 친인척의 사회적·경제적 지위를 암시하는 내용(직업, 직위, 직장명 등)\n' +
  '- 학교교육계획에 없거나 정규교육과정 밖에서 이루어진 활동\n' +
  '- 봉사활동 시간, 헌혈 횟수처럼 다른 항목에 적는 사항\n' +
  '- 도서명만 늘어놓는 식의 기재(도서가 필요하면 교육활동과 연결해 도서명(저자) 형식으로)\n' +
  '- 사교육을 유발할 수 있는 요소';

/**
 * 예전 판(v3.0~v3.5)이 설치하던 NEIS_RULES 문구.
 * [공통규칙] 칸이 이 문구 그대로면 선생님이 손대지 않은 것이므로, 새 학년도 문구로 바꿔도 된다.
 */
var OLD_NEIS_RULES = [
  '다음은 학교생활기록부에 기재할 수 없다. 결과물에 절대 포함하지 않는다.\n' +
  '- 교외 대회·경시대회 수상 실적, 교내외 수상 사실 및 등수(수상경력란에만 기재)\n' +
  '- 공인어학시험(TOEIC, TOEFL, TEPS, HSK, JLPT, 지텔프 등) 점수·등급\n' +
  '- 각종 자격증·인증 취득 사실, 기능사·산업기사 등 자격명\n' +
  '- 논문 학회지 등재, 도서 출간, 발명 특허 출원 사실\n' +
  '- 모의고사·전국연합학력평가 성적, 석차, 백분위, 등급\n' +
  '- 해외 활동실적, 어학연수, 해외봉사\n' +
  '- 특정 대학명, 학과명, 사설 기관·학원·강사명, 상호명, 프로그램 상품명\n' +
  '- 부모 및 친인척의 사회적·경제적 지위를 암시하는 내용\n' +
  '- 정규 교육과정 외에 이루어진 활동(학교교육계획에 없는 활동)\n' +
  '- 헌혈, 봉사활동 시간 등 별도 항목에 기재하는 사항\n' +
  '- 특정 도서명의 나열식 기재\n' +
  '- 사교육을 유발할 수 있는 요소'
];

/**
 * 공통규칙 프리셋 (교과와 무관하게 전 기록에 적용)
 */
var PRESET_COMMON = [
  {
    key: 'WRITING_RULES',
    title: '서술 규칙',
    body:
      '- 문장 종결은 명사형 어미(~함, ~음, ~임)를 사용한다.\n' +
      '- 존댓말·구어체를 쓰지 않고, 문단 구분 없이 한 문단으로 작성한다.\n' +
      '- \'학생은\', \'학생이\' 등 학생을 지칭하는 주어를 쓰지 않는다. 학생 이름도 쓰지 않는다.\n' +
      '- 하이픈(-), 가운뎃점(·), 따옴표 등 특수문자와 이모지를 쓰지 않는다. 쉼표와 마침표만 사용한다.\n' +
      '- 같은 표현의 반복을 피하고 유의어로 변주한다.\n' +
      '- 관찰된 사실 → 그 의미 → 성장 가능성 순서로 자연스럽게 잇는다.\n' +
      '- 부족한 점은 지적으로 끝내지 말고 개선 방향과 함께 서술한다.\n' +
      '- 근거 없는 과장, 상투적 미사여구, 모든 학생에게 해당하는 일반론을 쓰지 않는다.\n' +
      '- 입력된 자료에 없는 사실을 추측해서 만들어 내지 않는다.'
  },
  {
    key: 'NEIS_RULES',
    title: '학생부 기재 금지사항',
    body: NEIS_RULES_2026
  },
  {
    key: 'BYTE_RULE',
    title: '분량 계산법',
    body:
      '분량은 바이트로 계산한다.\n' +
      '- 한글 1글자 = 3바이트\n' +
      '- 영문 대소문자, 숫자, 공백, 마침표·쉼표 등 = 각 1바이트\n' +
      '- 줄바꿈 = 2바이트'
  },
  {
    key: 'GRADE_RULE',
    title: '성취수준 반영 지침',
    body:
      '학생의 성취수준은 5단계이며 1이 가장 높다(상위 약 10%).\n' +
      '- 1~2에 가까울수록 여러 역량이 높은 수준에서 함께 관찰되었다는 전제로 서술한다.\n' +
      '- 4~5에 가까울수록 특정 역량이 부분적으로 관찰된 수준임을 전제로 하되,\n' +
      '  노력한 지점과 성장 가능성을 반드시 함께 담아 긍정적으로 서술한다.\n' +
      '- 성취수준 자체나 등급, 석차를 결과물에 직접 언급하지 않는다.'
  },
  {
    key: 'STYLE_CARD',
    title: '내 문체 카드',
    // 비워 두면 쓰지 않는다. 메뉴 ⑧ [✒️ 내 문체 카드 만들기]가 [✒️ 내 문체] 시트의 예전 세특에서 만들어 채운다
    body: ''
  },
  {
    key: 'INSTRUCTION',
    title: '마무리 지시문',
    body:
      '아래 학생 자료를 근거로, 위의 모든 규칙을 지켜 특기사항 본문만 출력한다.\n' +
      '제목, 머리말, 설명, 따옴표, 마크다운 기호 없이 완성된 한 문단만 출력한다.'
  }
];

/**
 * 결과 검증용 패턴 (2026학년도 기재요령 기준)
 * level: 'block'(기재 금지 · 반드시 수정) | 'check'(오탐 가능 · 눈으로 확인)
 * why  : 검사 창·[📏 기재요령] 시트에 보이는 이유와 근거(기재요령 쪽수는 고등학교 판)
 * 설치하면 [📏 기재요령] 시트에 표로 채워지고, 그다음부터는 그 표가 우선합니다.
 */
var PRESET_BANNED = [
  { level: 'block', label: '공인어학시험', re: '토익|토플|텝스|지텔프|아이엘츠|오픽|TOEIC|TOEFL|TEPS|G-TELP|IELTS|HSK|JLPT|JPT|OPIc|DELF',
    why: '공인어학시험 참여 사실·점수·등급은 학생부 어느 항목에도 쓸 수 없음 (2026 기재요령 고 p.118)' },
  { level: 'block', label: '수상·등수', re: '수상|최우수상|우수상|장려상|금상|은상|동상|대상 수상|입상|[1-3]위 ?(입상|차지|기록)|메달',
    why: '대회 참여 사실·성적·수상실적은 수상경력란에만. 대회 이름을 행사로 바꿔 쓰는 것도 안 됨 (고 p.118)' },
  { level: 'block', label: '교외상', re: '표창장|감사장|공로상',
    why: '교외 기관·단체(장)에게 받은 상은 기재할 수 없음 (고 p.118)' },
  { level: 'block', label: '자격증·인증시험', re: '자격증|자격 ?취득|기능사|산업기사|기사 ?자격|정보처리기사|한국사능력검정|인증시험',
    why: '자격증·인증시험은 [자격증 및 인증 취득상황]란에만 (고 p.66·p.118)' },
  { level: 'block', label: '논문·특허·출판', re: '논문|학회지|학술지|학회 ?발표|특허 ?(출원|등록|취득)|실용신안|상표 ?(출원|등록)|저서 ?출간|책을 ?출간|도서 ?출간',
    why: '논문 투고·등재·학회 발표, 도서 출간, 지식재산권 출원·등록 사실은 기재 불가 (고 p.118)' },
  { level: 'block', label: '모의고사·석차', re: '모의고사|전국연합학력평가|모평|수능 ?성적|백분위|표준점수|석차|내신 ?[1-9] ?등급',
    why: '모의고사·전국연합학력평가 성적, 석차, 등급은 기재 불가 (고 p.118)' },
  { level: 'block', label: '온라인 공개강좌', re: '[Kk]-?MOOC|MOOC|KOCW|케이무크',
    why: 'K-MOOC·MOOC·KOCW 관련 사항은 세특에 쓸 수 없음 (2026 신설, 고 p.118)' },
  { level: 'block', label: '방과후학교', re: '방과후 ?학교|방과후 ?수업|방과후 ?강좌|방과후 ?활동',
    why: '방과후학교 활동은 세특·행발 어디에도 쓸 수 없음 (2026 신설, 고 p.118·p.159)' },
  { level: 'block', label: '해외활동', re: '어학연수|해외 ?연수|해외 ?봉사|교환학생|해외 ?캠프',
    why: '해외 활동실적은 기재 불가' },
  { level: 'block', label: '사설기관·학원', re: '학원|과외|사설 ?기관|아카데미|인강|사교육|입시 ?컨설팅',
    why: '사설 기관·학원·강사명 등 사교육을 유발하는 요소는 기재 불가' },
  { level: 'block', label: '부모 정보', re: '아버지|어머니|부모님?(의)? ?(직업|직장|회사|사업|직위)|가정 ?형편',
    why: '부모·친인척의 사회적·경제적 지위를 암시하는 내용은 기재 불가' },
  { level: 'check', label: '대학·기관명 가능성', re: '[가-힣A-Za-z]{2,10}대학교|[가-힣]{2,10}연구원|[가-힣]{2,10}재단|[가-힣]{2,8}학과',
    why: '특정 대학·학과·기관명은 쓰지 않음. 도서명·저자명 안에 든 것만 예외 (고 p.157)' },
  { level: 'check', label: '대회 언급', re: '대회|공모전|경시|올림피아드',
    why: '대회 참여 사실은 기재 불가 — 수업 중 활동이면 대회라는 말 없이 활동 내용으로' },
  { level: 'check', label: '봉사시간', re: '봉사 ?\\d+ ?시간|헌혈',
    why: '봉사활동 시간·헌혈은 다른 항목에 적는 사항' },
  { level: 'check', label: '청소년단체', re: '청소년 ?단체|스카우트|아람단|누리단|RCY|청소년적십자',
    why: '고등학교는 청소년단체 활동의 단체명·특기사항을 입력하지 않음' },
  { level: 'check', label: '학교스포츠클럽', re: '스포츠 ?클럽',
    why: '정규교육과정 밖 학교스포츠클럽은 특기사항을 입력하지 않음 — 동아리란에 클럽명만 (2026 고 p.78)' },
  { level: 'check', label: '자율동아리', re: '자율 ?동아리',
    why: '고등학교 자율동아리는 동아리명만 입력하고 특기사항은 쓰지 않음 (고 p.84)' },
  { level: 'check', label: '도서명 표기', re: '[『』《》]',
    why: '도서는 교육활동과 연결될 때 도서명(저자) 형식으로 (고 p.157)' }
];

/** 형식 검증(어미·인칭·특수문자) */
var PRESET_FORMAT_RULES = [
  { level: 'block', label: '존댓말/평서형 어미', re: '습니다|입니다|했다\\.|이다\\.|였다\\.|한다\\.',
    why: '학생부 문장은 명사형 어미(~함, ~음, ~임)로 끝냄' },
  { level: 'block', label: "'학생' 주어", re: '학생(은|이|의|을|를|과|와|도)',
    why: '학생을 지칭하는 주어를 쓰지 않음' },
  { level: 'block', label: '금지 특수문자', re: "[·‘’“”\"'\\-–—*#]",
    why: '[📐 공통규칙]의 서술 규칙: 쉼표와 마침표만 사용' },
  { level: 'check', label: '줄바꿈 포함', re: '\\n',
    why: '한 문단으로 씀. 줄바꿈은 2바이트로 셈' }
];

/* ================================================================ AI 모델 */
/**
 * 기본 모델 목록 — 설치할 때 [⚙️ 설정] 시트 아래 [🤖 모델 목록] 표에 한 번 채워지고,
 * 그다음부터는 선생님이 고친 표가 우선합니다. (2026년 10월 기준으로 확인한 이름)
 *
 * 모델 이름은 회사들이 몇 달마다 바꿉니다. 그래서 기본값은 '-latest' 이름을 씁니다.
 * gemini-flash-latest 는 구글이 새 Flash 모델을 낼 때마다 자동으로 그 모델을 가리키므로
 * 배포한 사본이 몇 년이 지나도 "모델을 찾을 수 없음"으로 멈추지 않습니다.
 *
 * level: 표의 [수준] 칸. memo: [언제 쓰나] 칸.
 */
var DEFAULT_MODEL = 'gemini-flash-latest';

/** 회사별 "이 정도면 충분" 모델 — 시작하기에서 키를 넣으면 이것으로 맞춘다 */
var PROVIDER_DEFAULT_MODEL = {
  gemini: 'gemini-flash-latest',
  openai: 'gpt-6-luna',
  anthropic: 'claude-haiku-5-5'
};

var PRESET_MODELS = [
  { model: 'gemini-flash-latest', level: '★ 기본 · 충분',
    memo: '세특·창체·행발 모두 이 정도면 충분합니다. 구글이 새 Flash를 내면 자동으로 바뀌어 이름이 낡지 않습니다. 무료 등급으로도 쓸 수 있습니다(호출 횟수 제한 있음).' },
  { model: 'gemini-flash-lite-latest', level: '가볍게',
    memo: '더 빠르고 저렴합니다. 행발처럼 짧은 글이나 한 번에 많은 학생을 돌릴 때. 문장이 조금 단조로울 수 있습니다.' },
  { model: 'gemini-3.8-flash', level: '버전 고정',
    memo: '학기 중에 문체가 바뀌지 않게 버전을 못 박고 싶을 때. 1년쯤 지나면 종료될 수 있으니 가끔 연결 테스트로 확인하세요.' },
  { model: 'gemini-pro-latest', level: '고급 · 유료',
    memo: '여러 활동을 합친 압축본이 글자수를 잘 못 맞출 때만. 느리고 비싸며, 무료 등급에서는 막힐 수 있습니다.' },
  { model: 'gpt-6-luna', level: '충분',
    memo: 'OpenAI 키를 쓸 때의 기본. 세특 작성에 충분합니다.' },
  { model: 'gpt-6-sol', level: '고급',
    memo: 'OpenAI 상위 모델. 압축본 품질을 더 올리고 싶을 때.' },
  { model: 'claude-haiku-5-5', level: '충분',
    memo: 'Claude 키를 쓸 때의 기본. 세특 작성에 충분합니다.' },
  { model: 'claude-sonnet-5-5', level: '고급',
    memo: 'Claude 상위 모델. 압축본 품질을 더 올리고 싶을 때.' }
];

/** v3.0.x 의 기본값 — 설치/복구 때 선생님이 손대지 않은 값이면 새 기본값으로 올린다 */
var OLD_DEFAULT_MODELS = { '활동용 모델': 'gemini-2.5-flash', '합본용 모델': 'gpt-5-mini' };

/** 최신 모델명을 확인하는 공식 페이지 */
var MODEL_LINKS = {
  gemini: 'https://ai.google.dev/gemini-api/docs/models',
  openai: 'https://platform.openai.com/docs/models',
  anthropic: 'https://platform.claude.com/docs/en/models/overview'
};

/* ============================================================ 입력 항목 */
/**
 * 활동을 만들 때 고를 수 있는 [입력 항목] 묶음.
 * 선생님이 직접 적는 것이 기본이고, 이 목록은 "이렇게들 많이 쓴다"는 출발점입니다.
 * for: 어울리는 기록종류 키. 비어 있으면 어디서나 보여 줍니다.
 */
var PRESET_COLUMN_SETS = [
  { label: '탐구·보고서', for: ['과세특', '개세특', '동아리', '진로'],
    cols: ['탐구 주제', '선정 이유', '탐구 과정', '알게 된 점', '한계와 개선점'] },
  { label: '실험', for: ['과세특', '동아리'],
    cols: ['실험 주제', '세운 가설', '실험 설계', '결과 해석', '오차와 개선점'] },
  { label: '수업 참여', for: ['과세특', '개세특'],
    cols: ['단원·주제', '수업 중 모습', '질문·발표', '어려움과 극복', '성장한 점'] },
  { label: '발표·토론', for: ['과세특', '동아리', '자율'],
    cols: ['주제', '맡은 역할', '준비 과정', '발표·토론 내용', '배운 점'] },
  { label: '독서 연계', for: ['과세특', '개세특', '진로'],
    cols: ['읽은 책·계기', '인상 깊은 내용', '교과와 연결한 점', '더 알아본 것'] },
  { label: '제작·산출물', for: ['과세특', '동아리', '진로'],
    cols: ['만든 것', '설계·계획', '만드는 과정', '어려움과 해결', '결과와 소감'] },
  { label: '자율·자치', for: ['자율'],
    cols: ['활동명', '맡은 역할', '준비와 과정', '기여한 점', '변화·성장'] },
  { label: '진로 탐색', for: ['진로'],
    cols: ['관심 분야', '탐색 방법', '알게 된 점', '진로 계획의 변화'] },
  { label: '행동특성', for: ['행발'],
    cols: ['학습 태도', '인성·관계', '자기관리', '성장한 점', '보완할 점'] },
  { label: '간단하게', for: [],
    cols: ['무엇을 했나', '어떻게 했나', '무엇을 알게 되었나'] }
];


/* ==========================================================================
   10_Engine.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 프롬프트 조립 엔진 (순수 로직)
 * ---------------------------------------------------------------
 * v2의 가장 큰 문제: 활동마다 프롬프트 "전체"를 사람이 복붙해서 관리
 *   → 활동이 늘수록 골격이 서로 달라지고, 공통 규칙을 고쳐도 활동별
 *     하드코딩 문구(예: "750바이트 이내") 때문에 반영되지 않음.
 *
 * v3의 해법: 프롬프트를 7개 슬롯으로 쪼개고 엔진이 자동 조립.
 *   교사가 쓰는 것은 [활동설명 한두 줄 + 입력컬럼 + 예시] 뿐.
 *
 *   ① 역할      ← 기록종류.role  ×  교과영역.role
 *   ② 맥락      ← 기록종류.goal  +  활동명/활동설명
 *   ③ 서술규칙  ← 공통규칙.WRITING_RULES
 *   ④ 기재요령  ← 공통규칙.NEIS_RULES
 *   ⑤ 관점·역량 ← 기록종류.view  +  교과영역.comp
 *   ⑥ 분량      ← 활동의 바이트 한도(없으면 기록종류 글자수×3) → 문장 자동 생성 + BYTE_RULE
 *   ⑦ 활동고유  ← 입력 형식 + 예시 + (성취수준 지침) + 마무리 지시문
 * ---------------------------------------------------------------
 * 이 파일은 Apps Script와 Node 양쪽에서 동작하도록 작성되어 있습니다.
 */

/** NEIS 기준 바이트 수 (한글 3, 그 외 1, 줄바꿈 2) */
function byteLen(s) {
  if (s === null || s === undefined) return 0;
  s = String(s);
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c === 10 || c === 13) n += 2;          // 줄바꿈
    else if (c > 127) n += 3;                   // 한글 등 멀티바이트
    else n += 1;
  }
  return n;
}

/** 바이트 한도에 맞게 자르되 문장 단위로 끊음 */
function trimToBytes(s, limit) {
  s = String(s || '');
  if (byteLen(s) <= limit) return s;
  var cut = '';
  for (var i = 0; i < s.length; i++) {
    if (byteLen(cut + s[i]) > limit) break;
    cut += s[i];
  }
  var last = cut.lastIndexOf('.');
  if (last > cut.length * 0.5) cut = cut.slice(0, last + 1);
  return cut;
}

/** "a|b|c" 또는 "a, b, c" → ['a','b','c'] */
function parseColumns(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[|,\n]/)
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x.length > 0; });
}

/**
 * 활동의 바이트 한도 — [🗂 활동목록]의 바이트 한도(예전 시트는 글자수×3), 비었으면 기록 항목 한도.
 * 기록 항목 한도(나이스 한 칸)를 넘지 않는다. 한 기록 항목을 여러 활동이 나눠 쓸 때 활동마다 작게 정한다.
 */
function activityBytes(act, rec) {
  var cap = Number(rec && rec.chars || 500) * 3;
  var b = Number(act && act.bytes) || Number(act && act.chars || 0) * 3;
  return b > 0 ? Math.min(Math.round(b), cap) : cap;
}

/**
 * 예시 학생 자료 글("항목: 값" 줄들) → 입력 항목 순서의 값 배열 (공방에서 만든 예시를 예시 시트로 옮길 때)
 * 항목 이름이 하나도 안 맞으면 글 전체를 첫 항목에 넣는다.
 */
function exampleValuesFrom(cols, text) {
  var vals = [], hit = false;
  for (var i = 0; i < cols.length; i++) vals.push('');
  String(text || '').replace(/\r/g, '').split('\n').forEach(function (line) {
    var m = /^\s*([^:：]{1,30}?)\s*[:：]\s*(.*)$/.exec(line);
    var at = m ? cols.indexOf(m[1].trim()) : -1;
    if (at >= 0) { vals[at] = (vals[at] ? vals[at] + ' ' : '') + m[2].trim(); hit = true; }
  });
  if (!hit && cols.length && String(text || '').trim()) vals[0] = String(text).trim();
  return vals;
}

/** 한도를 n 개 활동에 똑같이 나누기(남는 바이트는 앞 활동부터 1씩) */
function splitBytes(total, n) {
  total = Math.max(0, Math.floor(Number(total) || 0)); n = Math.max(1, Math.floor(Number(n) || 1));
  var each = Math.floor(total / n), rest = total - each * n, out = [];
  for (var i = 0; i < n; i++) out.push(each + (i < rest ? 1 : 0));
  return out;
}

/**
 * 같은 기록 항목(과세특은 같은 교과까지)을 나눠 쓰는 활동들의 한도 합 — 나이스 한 칸을 넘는지
 * @param {Array<{bytes?:number, chars?:number}>} acts
 * @return {{cap:number, sum:number, left:number, over:boolean}}
 */
function byteBudget(acts, rec) {
  var cap = Number(rec && rec.chars || 500) * 3, sum = 0;
  (acts || []).forEach(function (a) { sum += activityBytes(a, rec); });
  return { cap: cap, sum: sum, left: cap - sum, over: sum > cap };
}

/** 목록에서 key로 1건 찾기 */
function findByKey(list, key) {
  key = String(key || '').trim();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].key).trim() === key) return list[i];
  }
  return null;
}

/** {KEY} 치환 (없는 키는 빈 문자열로 제거) */
function fillTokens(tpl, map) {
  return String(tpl || '').replace(/\{([A-Za-z0-9_가-힣]+)\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(map, k) ? String(map[k]) : '';
  });
}

/**
 * 프롬프트 조립
 * @param {Object} o
 *   o.activity  {key,name,recordKey,subjectKey,bytes,columns,desc,mode,custom}  (bytes 대신 예전 chars 도 읽는다)
 *   o.record    기록종류 1건
 *   o.subject   교과영역 1건
 *   o.common    {WRITING_RULES, NEIS_RULES, BYTE_RULE, GRADE_RULE, INSTRUCTION}
 *   o.examples  예시 합본 문자열 (없으면 빈 문자열)
 *   o.years     교직 경력 표기 (기본 15)
 *   record.rules 이 기록 항목에만 붙는 기재 주의([🧩 기록종류]의 [기재 주의] — 기재요령 규칙판에서 옴)
 *   activity.mode '바로쓰기' 면 입력 자료가 교사의 자유 메모 한 칸이다
 *   activity.mode '보고서' 면 입력 자료가 [보고서 요점](교사가 확인한 것)과 [교사 관찰 메모]다
 *   o.styleSamples 예전에 쓴 세특 몇 편(쓰는 방식만 참고) · common.STYLE_CARD 내 문체 카드
 * @return {string}
 */
function buildPrompt(o) {
  var act = o.activity || {};
  var rec = o.record || {};
  var sub = o.subject || {};
  var com = o.common || {};
  var recBytes = Number(rec.chars || 500) * 3;
  var bytes = activityBytes(act, rec);
  var chars = Math.floor(bytes / 3);
  var cols = parseColumns(act.columns);

  // 직접 작성 모드: 교사가 쓴 본문을 토큰만 치환해서 사용
  if (String(act.mode || '').indexOf('직접') === 0) {
    return fillTokens(act.custom, {
      ROLE: buildRole(rec, sub, o.years),
      WRITING_RULES: com.WRITING_RULES || '',
      NEIS_RULES: com.NEIS_RULES || '',
      BYTE_RULE: com.BYTE_RULE || '',
      GRADE_RULE: com.GRADE_RULE || '',
      INSTRUCTION: com.INSTRUCTION || '',
      COMPETENCY: sub.comp || '',
      VIEW: rec.view || '',
      RECORD_RULES: rec.rules || '',
      STYLE_CARD: com.STYLE_CARD || '',
      EXAMPLES: o.examples || '',
      CHARS: chars,
      BYTES: bytes,
      RECORD_BYTES: recBytes,
      COLUMNS: cols.join('|'),
      ACTIVITY: act.name || '',
      RECORD: rec.name || ''
    }).trim();
  }

  var P = [];

  // ① 역할
  P.push('# 역할\n' + buildRole(rec, sub, o.years));

  // ② 맥락
  var ctx = ['# 과제'];
  ctx.push('- 목표: ' + (rec.goal || '학교생활기록부 특기사항 작성'));
  ctx.push('- 기록 항목: ' + (rec.name || act.recordKey || ''));
  if (act.name) ctx.push('- 대상 활동: ' + act.name);
  if (act.desc) ctx.push('- 활동 개요: ' + String(act.desc).replace(/\n/g, ' '));
  P.push(ctx.join('\n'));

  // ③ 서술 규칙
  if (com.WRITING_RULES) P.push('# 서술 규칙\n' + com.WRITING_RULES);

  // ④ 기재 금지사항 (+ 이 기록 항목에만 해당하는 기재 주의)
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);
  if (rec.rules && String(rec.rules).trim()) {
    P.push('# 이 기록 항목의 기재 주의 (' + (rec.name || act.recordKey || '') + ')\n' + String(rec.rules).trim());
  }

  // ⑤ 관점 · 역량
  var persp = [];
  if (rec.view) persp.push(rec.view);
  if (sub.comp) persp.push(sub.comp);
  if (persp.length) P.push('# 서술 관점과 역량\n' + persp.join('\n\n'));

  // ⑥ 분량 (단일 출처)
  // 2026 기재요령: 최대 글자 수 안에서 교사가 자율적으로 입력한다. 분량을 채우려 지어내면 허위·과장 기재가 된다.
  var len = ['# 분량'];
  if (bytes < recBytes) {
    len.push('- 이 활동은 ' + (rec.name || '이 기록 항목') + ' 한 칸(' + recBytes + '바이트) 가운데 한 부분이다. ' +
             '같은 학생의 다른 활동 기록과 합쳐 들어가므로 이 활동의 몫만 쓴다.');
  }
  len.push('- ' + bytes + '바이트(한글 약 ' + chars + '자) 이내로 작성한다. 넘으면 안 된다.');
  len.push('- 자료가 충분하면 ' + Math.round(bytes * 0.9) + '바이트 안팎으로 충실하게 쓰되, 자료에 없는 내용으로 분량을 채우지 않는다. 자료가 적으면 짧게 쓴다.');
  if (com.BYTE_RULE) len.push(com.BYTE_RULE);
  P.push(len.join('\n'));

  // ⑦-1 입력 형식
  if (String(act.mode || '') === '바로쓰기') {
    P.push('# 입력 자료 형식\n아래 학생 자료는 교사가 수업·활동 중에 관찰하고 자유롭게 적은 메모다. ' +
           '메모에 있는 사실만 근거로 문장을 다듬어 쓴다. 메모가 짧으면 짧게 쓴다.');
  } else if (String(act.mode || '') === '보고서') {
    P.push('# 입력 자료 형식\n아래 학생 자료는 학생이 수업 중에 쓴 보고서에서 뽑아 교사가 확인한 [보고서 요점]과, ' +
           '교사가 수업에서 직접 본 [교사 관찰 메모]다.\n' +
           '- 보고서 요점은 학생이 쓴 내용이다. 그대로 옮기지 말고, 교사가 수업과 평가에서 관찰한 탐구 과정과 사고의 변화로 서술한다.\n' +
           '- 교사 관찰 메모가 있으면 그것을 가장 앞세운다. 요점과 메모가 다르면 메모를 따른다.\n' +
           '- 보고서 제목, 참고문헌, 연구보고서 실적(제목·주제·참여 인원·소요 시간)은 쓰지 않는다.');
  } else if (cols.length) {
    P.push('# 입력 자료 형식\n아래 학생 자료는 다음 항목이 | 로 구분되어 제공된다.\n' + cols.join('|'));
  }

  // ⑦-2 예시 (문체 예시 → 활동 예시 순)
  if (o.styleSamples && String(o.styleSamples).trim()) {
    P.push('# 문체 예시 — 선생님이 예전에 쓴 세특\n내용·소재는 따르지 말고 문장 길이, 여는 방식, 끝맺음, 이음말 같은 쓰는 방식만 따른다.\n\n' +
           String(o.styleSamples).trim());
  }
  if (o.examples && String(o.examples).trim()) {
    P.push('# 예시\n표현 방식과 서술 흐름을 참고한다. 문장을 그대로 베끼지 않는다.\n\n' + String(o.examples).trim());
  }

  // ⑦-3 성취수준 (해당 기록 종류에만)
  if (rec.useGrade && com.GRADE_RULE) {
    P.push('# 성취수준 반영\n' + com.GRADE_RULE);
  }

  // ⑦-4 내 문체 카드 — 규칙 맨 끝(출력 바로 앞)에 두고, 학생 자료 뒤에도 한 번 더 붙인다(styleTail)
  if (com.STYLE_CARD && String(com.STYLE_CARD).trim()) {
    P.push('# 내 문체 (예시와 함께 가장 우선해서 따른다)\n' + String(com.STYLE_CARD).trim());
  }

  // ⑦-5 마무리 지시문
  P.push('# 출력\n' + (com.INSTRUCTION || '특기사항 본문만 한 문단으로 출력한다.'));

  return P.join('\n\n');
}

/** 역할 문장 조립 */
function buildRole(rec, sub, years) {
  years = years || 15;
  var base = rec && rec.role ? rec.role : '고등학교 교사';
  var filled = fillTokens(base, {
    교과: (sub && sub.kind === '교과' && sub.name) ? sub.name.replace(/\(.*?\)/g, '').trim() : '',
    연차: years
  });
  filled = filled.replace(/\s{2,}/g, ' ').replace(/^ /, '');
  // 교과 토큰이 비어 "  교과를" 처럼 남는 경우 정리
  filled = filled.replace(/^\s*교과를/, '여러 교과를');
  var who = (sub && sub.role) ? sub.role : '고등학교 교사';
  if (filled.indexOf(who) === -1 && sub && sub.kind === '교과') {
    return '당신은 ' + filled + '입니다. (' + who + ')';
  }
  return '당신은 ' + filled + '입니다.';
}

/** 학생 1명의 입력값들을 "컬럼|컬럼" 형태 1줄로 */
function buildStudentBlock(cols, values, opts) {
  opts = opts || {};
  var pairs = [];
  for (var i = 0; i < cols.length; i++) {
    var v = values[i];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    pairs.push(cols[i] + ': ' + String(v).trim().replace(/\n/g, ' '));
  }
  var out = pairs.join('\n');
  if (opts.grade) out += '\n성취수준: ' + opts.grade;
  return out;
}

/**
 * 결과 검증 — 바이트 / 기재 금지 / 형식 / 맞춤법
 * 규칙마다 fix(바른 표기)·why(이유·근거)가 있으면 issue 에 함께 싣는다.
 * spellIssues(16_Rules.gs)가 있으면 띄어쓰기·어미 검사도 더한다(opts.spell === false 면 뺀다).
 */
function validateResult(text, limitBytes, banned, formatRules, opts) {
  text = String(text || '');
  var issues = [];
  var b = byteLen(text);

  if (!text.trim()) return { ok: false, bytes: 0, issues: [{ level: 'block', label: '결과 없음', hit: '' }] };

  if (limitBytes && b > limitBytes) {
    issues.push({ level: 'block', label: '분량 초과', hit: b + ' / ' + limitBytes + '바이트' });
  } else if (limitBytes && b < limitBytes * 0.7) {
    issues.push({ level: 'check', label: '분량 부족', hit: b + ' / ' + limitBytes + '바이트' });
  }

  var all = (banned || []).concat(formatRules || []);
  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    if (!r || !r.re) continue;
    var m;
    try { m = text.match(new RegExp(r.re, 'g')); } catch (e) { continue; }
    if (m && m.length) {
      var uniq = [];
      for (var j = 0; j < m.length; j++) if (uniq.indexOf(m[j]) === -1) uniq.push(m[j]);
      var issue = { level: r.level || 'check', label: r.label, hit: uniq.slice(0, 5).join(', ') };
      if (r.fix) issue.fix = r.fix;
      if (r.why) issue.why = r.why;
      issues.push(issue);
    }
  }
  if (typeof spellIssues === 'function' && !(opts && opts.spell === false)) {
    issues = issues.concat(spellIssues(text));
  }

  var blocks = issues.filter(function (x) { return x.level === 'block'; });
  return { ok: blocks.length === 0, bytes: b, issues: issues };
}

/** 검증 결과를 셀에 넣을 짧은 문자열로 */
function formatIssues(v) {
  if (!v.issues.length) return '통과 (' + v.bytes + 'B)';
  var parts = v.issues.map(function (x) {
    return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : '') +
           (x.fix ? ' (바르게: ' + x.fix + ')' : '');
  });
  return (v.ok ? '확인필요 ' : '수정필요 ') + '(' + v.bytes + 'B)\n' + parts.join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    byteLen: byteLen, trimToBytes: trimToBytes, parseColumns: parseColumns,
    findByKey: findByKey, fillTokens: fillTokens, buildPrompt: buildPrompt,
    activityBytes: activityBytes, splitBytes: splitBytes, byteBudget: byteBudget, exampleValuesFrom: exampleValuesFrom,
    buildRole: buildRole, buildStudentBlock: buildStudentBlock,
    validateResult: validateResult, formatIssues: formatIssues
  };
}


/* ==========================================================================
   12_Models.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 모델 이름 다루기 (순수 로직)
 * ---------------------------------------------------------------
 * 선생님이 모델 이름을 직접 적으므로, 오타·복사 흔적·회사 판별·오류 해석을 여기서 처리한다.
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/models.test.js).
 * ---------------------------------------------------------------
 */

/** 복사해 온 이름 정리: 앞뒤 공백·따옴표, API 목록의 'models/' 접두어 */
function normModel(m) {
  return String(m === null || m === undefined ? '' : m)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .replace(/^models\//i, '')
    .trim();
}

/** 이름만 보고 회사를 짐작한다. 모르면 '' */
function guessProvider(m) {
  m = normModel(m).toLowerCase();
  if (!m) return '';
  if (/^(gemini|learnlm)/.test(m)) return 'gemini';
  if (/^claude/.test(m)) return 'anthropic';
  if (/^(gpt|chatgpt|o\d|ft:gpt|ft:o\d)/.test(m)) return 'openai';
  return '';
}

/** 표의 [회사] 칸 값 → 내부 이름. '자동'이나 빈칸이면 '' */
function companyToProvider(label) {
  var s = String(label || '').trim().toLowerCase();
  if (!s || s === '자동') return '';
  if (/gemini|google|구글|제미나이/.test(s)) return 'gemini';
  if (/openai|gpt|오픈/.test(s)) return 'openai';
  if (/claude|anthropic|클로드|앤트로픽/.test(s)) return 'anthropic';
  return '';
}

function providerLabel(p) {
  return { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude', subscription: 'Gemini(구독)' }[p] || '?';
}

/**
 * 지금 쓸 수 있는 회사인지. 회사 모델은 키가 있어야, 구독(=AI 수식)은 구독을 켜 두어야 쓸 수 있다.
 * @param {string} provider  'gemini' | 'openai' | 'anthropic' | 'subscription' | ''
 * @param {Object<string,boolean>} has  회사별 키 보관 여부 + subscription(구독 사용 여부)
 */
function providerUsable(provider, has) {
  return !!(provider && has && has[provider]);
}

/**
 * 키를 넣은 회사의 모델(과 켜 둔 구독)만 남긴다 (순서 유지).
 * @param {string[]} models
 * @param {Object<string,boolean>} has
 * @param {function(string):string} provOf  모델 → 회사
 */
function usableModels(models, has, provOf) {
  return (models || []).filter(function (m) { return providerUsable(provOf(m), has); });
}

/**
 * API 오류를 선생님이 알아들을 말로 바꾼다.
 * @return {{kind:string, hint:string, retry:boolean}}
 *   kind: model | key | free | billing | rate | access | region | request | server | other
 */
function explainApiError(code, body) {
  code = Number(code) || 0;
  var b = String(body || '').toLowerCase();

  if (/api[ _-]?key not valid|invalid[ _-]api[ _-]key|incorrect api key|invalid x-api-key|api_key_invalid|authentication_error|unauthenticated/.test(b) || code === 401) {
    return { kind: 'key', retry: false, hint: 'API 키가 올바르지 않습니다. 키를 처음부터 다시 복사해 넣으세요.' };
  }
  if (code === 404 || /model_not_found|not_found_error|is not found|was not found|does not exist|unknown model|not supported for generatecontent|no such model/.test(b)) {
    return { kind: 'model', retry: false, hint: '모델명을 찾을 수 없습니다. 철자를 확인하거나, 종료된 모델이면 최신 이름으로 바꾸세요.' };
  }
  if (/insufficient_quota|credit balance|billing_hard_limit|payment required/.test(b) || code === 402) {
    return { kind: 'billing', retry: false, hint: '결제 잔액(크레딧)이 없습니다. 해당 회사 콘솔에서 결제 수단이나 충전을 확인하세요.' };
  }
  if (code === 429 && /limit:\s*0\b|free_tier[^,]*limit:\s*0/.test(b)) {
    return { kind: 'free', retry: false, hint: '무료 등급에서는 이 모델을 쓸 수 없습니다. 다른 모델을 고르거나 결제(유료 등급)를 등록하세요.' };
  }
  if (code === 429) {
    return { kind: 'rate', retry: true, hint: '호출 한도를 넘었습니다(무료 등급은 분당·하루 횟수 제한). 잠시 뒤 다시 하거나 나눠서 실행하세요.' };
  }
  if (/location is not supported|user location|unsupported_country|region/.test(b) && code === 400) {
    return { kind: 'region', retry: false, hint: '이 지역에서는 쓸 수 없는 모델입니다.' };
  }
  if (code === 403) {
    return { kind: 'access', retry: false, hint: '이 키로는 이 모델을 쓸 권한이 없습니다. 콘솔에서 사용 권한이나 프로젝트 설정을 확인하세요.' };
  }
  if (code >= 500 || code === 529) {
    return { kind: 'server', retry: true, hint: '회사 서버가 잠시 불안정합니다. 잠시 뒤 다시 시도하세요.' };
  }
  if (code === 400) {
    return { kind: 'request', retry: false, hint: '이 모델이 요청을 받지 않습니다. 글을 쓰는(대화용) 모델이 맞는지 확인하세요 — 이미지·음성·임베딩 모델은 쓸 수 없습니다.' };
  }
  return { kind: 'other', retry: false, hint: '' };
}

/** "내 키로 쓸 수 있는 모델" 목록에서 글쓰기에 못 쓰는 모델을 뺀다 */
function isTextModel(provider, id) {
  var m = normModel(id).toLowerCase();
  if (!m) return false;
  var common = /embed|image|imagen|tts|audio|speech|live|realtime|transcri|whisper|veo|lyria|robotics|computer-use|deep-research|antigravity|omni|aqa|moderation|dall-e|sora|search/;
  if (common.test(m)) return false;
  if (provider === 'gemini') return /^gemini/.test(m);
  if (provider === 'openai') return /^(gpt|chatgpt|o\d)/.test(m) && !/instruct|codex|oss|babbage|davinci/.test(m);
  if (provider === 'anthropic') return /^claude/.test(m);
  return false;
}

/** 목록 정렬: -latest 별칭 → 버전 숫자가 큰 것 → 이름순 */
function sortModelIds(ids) {
  var ver = function (s) {
    var m = String(s).match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };
  return ids.slice().sort(function (a, b) {
    var la = /-latest$/.test(a) ? 1 : 0, lb = /-latest$/.test(b) ? 1 : 0;
    if (la !== lb) return lb - la;
    var d = ver(b) - ver(a);
    if (d) return d;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** 연결 확인 결과를 표에 적을 한 줄로 */
function modelStatusText(res, stamp) {
  if (!res) return '';
  var tail = stamp ? ' · ' + stamp : '';
  if (res.ok === true) return '✓ 연결됨 · ' + res.sec + '초' + tail;
  if (res.skipped) return '– ' + res.message + tail;
  if (res.ok === null) return 'ⓘ ' + res.message;
  return '✗ ' + (res.short || res.message) + tail;
}

/* ------------------------------------------------------------ 비용 줄이기 */
/**
 * "생각(추론)을 줄이는" 요청 옵션. 모르는 모델이면 null (아무것도 안 보냄).
 * 세특 한 편은 깊은 추론이 필요 없는 글쓰기라, 생각을 줄여도 품질 차이가 거의 없고
 * 생각 토큰은 출력 요금으로 청구되므로 비용과 시간이 크게 준다.
 *   Gemini 3 이후·-latest : thinkingLevel 'low'   (3.8 Flash 기본은 medium)
 *   Gemini 2.5 Flash 계열 : thinkingBudget 0      (끄기)
 *   Gemini 2.5 Pro        : thinkingBudget 128    (끌 수 없어 최소값)
 *   OpenAI gpt-5·gpt-6·o  : reasoning_effort 'low' (gpt-5.x 기본은 medium)
 */
function thinkingFor(provider, model) {
  var m = normModel(model).toLowerCase();
  if (provider === 'gemini') {
    if (/^gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 };
    if (/^gemini-2\.5-flash/.test(m)) return { thinkingBudget: 0 };
    var v = m.match(/^gemini-(\d+)/);
    if (v && Number(v[1]) >= 3) return { thinkingLevel: 'low' };
    if (/^gemini-(flash|flash-lite|pro)-latest$/.test(m)) return { thinkingLevel: 'low' };
    return null;
  }
  if (provider === 'openai') {
    if (/^(gpt-5|gpt-6|gpt-7|o\d)/.test(m) && !/chat-latest/.test(m)) return { reasoning_effort: 'low' };
    return null;
  }
  return null;
}

/** 여러 학생을 한 번에 보낼 때의 응답 형식 (Gemini responseSchema 형식) */
var BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
        required: ['id', 'text']
      }
    }
  },
  required: ['results']
};

/**
 * 여러 학생 자료를 한 번의 요청으로 묶는다. 규칙(시스템 프롬프트)은 그대로 두고
 * 학생 자료만 여기 모으므로, 규칙을 학생 수만큼 되풀이해 보내지 않아도 된다.
 * @param {Array<{id:string, block:string}>} items
 */
function buildBatchUser(items) {
  var L = [];
  L.push('# 이번에 작성할 학생 ' + items.length + '명');
  L.push('아래 학생들의 특기사항을 한 명씩 따로 작성한다.');
  L.push('- 위의 모든 규칙(분량 포함)을 학생마다 따로 지킨다. 분량은 학생 한 명 기준이다.');
  L.push('- 다른 학생의 자료를 섞지 않는다. 그 학생 자료에 없는 내용을 지어내지 않는다.');
  L.push('- 학생마다 첫 문장과 문장 구조를 다르게 하고, 같은 표현을 여러 학생에게 되풀이하지 않는다.');
  items.forEach(function (it) {
    L.push('');
    L.push('## ' + it.id);
    L.push(String(it.block || '').trim());
  });
  L.push('');
  L.push('# 출력 형식 (위의 [출력] 규칙은 학생 한 명의 text 에 적용한다)');
  L.push('JSON 하나만 출력한다. 설명이나 코드 블록 표시를 붙이지 않는다.');
  L.push('{"results":[' + items.map(function (it) { return '{"id":"' + it.id + '","text":"특기사항 본문"}'; }).join(',') + ']}');
  return L.join('\n');
}

/**
 * 묶음 응답을 id → 본문으로 푼다. 형식이 조금 달라도 최대한 살린다.
 * @return {{map:Object, missing:string[]}}
 */
function parseBatchResult(text, ids) {
  var map = {}, t = String(text || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var data = null;
  var tryParse = function (s) { try { return JSON.parse(s); } catch (e) { return null; } };
  data = tryParse(t);
  if (!data) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) data = tryParse(t.slice(a, b + 1));
  }
  if (!data) {
    var c = t.indexOf('['), d = t.lastIndexOf(']');
    if (c >= 0 && d > c) data = tryParse(t.slice(c, d + 1));
  }
  var list = null;
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.results)) list = data.results;
  else if (data && typeof data === 'object') {
    list = Object.keys(data).map(function (k) { return { id: k, text: data[k] }; });
  }
  (list || []).forEach(function (x, i) {
    if (!x) return;
    var id = String(x.id || x.ID || x.student || '').trim();
    var body = typeof x === 'string' ? x : (x.text || x.result || x.content || '');
    if (!id && ids[i]) id = ids[i];                     // id 를 빼먹었으면 순서로
    if (ids.indexOf(id) < 0) {
      var n = id.match(/(\d+)/);                        // "학생1" 처럼 바꿔 쓴 경우
      if (n && ids[Number(n[1]) - 1]) id = ids[Number(n[1]) - 1];
    }
    body = String(body || '').trim();
    if (id && body && ids.indexOf(id) >= 0 && !map[id]) map[id] = body;
  });
  return { map: map, missing: ids.filter(function (id) { return !map[id]; }) };
}

/** 대략의 토큰 수 (한글은 1.4자에 1토큰, 나머지는 3.5자에 1토큰 정도로 어림) */
function estimateTokens(text) {
  var s = String(text || ''), h = 0, o = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xAC00 && c <= 0xD7A3) h++;
    else if (c > 32) o++;
  }
  return Math.round(h / 1.4 + o / 3.5);
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normModel: normModel, guessProvider: guessProvider, companyToProvider: companyToProvider,
    providerLabel: providerLabel, providerUsable: providerUsable, usableModels: usableModels,
    explainApiError: explainApiError, isTextModel: isTextModel,
    sortModelIds: sortModelIds, modelStatusText: modelStatusText,
    thinkingFor: thinkingFor, BATCH_SCHEMA: BATCH_SCHEMA, buildBatchUser: buildBatchUser,
    parseBatchResult: parseBatchResult, estimateTokens: estimateTokens
  };
}


/* ==========================================================================
   14_RosterParse.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 학생 명단 해석 (순수 로직)
 * ---------------------------------------------------------------
 * 붙여넣은 글이든, 엑셀·CSV 파일에서 읽은 표든 같은 함수로 해석한다.
 *
 *   명단 방식 'class' : 반 · 번호 · 이름 · 성취수준          (담임·교과)
 *   명단 방식 'grade' : 학년 · 반 · 번호 · 이름 · 성취수준   (동아리·방과후처럼 학년이 섞일 때)
 *   'auto'           : 머리글이나 값을 보고 알아서 고른다
 *
 * 머리글이 있으면 이름으로 열을 찾고(순서 무관), 없으면 자리 순서로 읽는다.
 * "학번"(20315 = 2학년 3반 15번) 칸이나 "2학년 3반 15번 김하늘" 같은 글도 알아본다.
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/roster.test.js).
 * ---------------------------------------------------------------
 */

var ROSTER_HEAD = {
  'class': ['반', '번호', '이름', '성취수준'],
  'grade': ['학년', '반', '번호', '이름', '성취수준']
};

/** 머리글 한 칸이 무엇인지 */
function rosterHeadKind(cell) {
  var t = String(cell === null || cell === undefined ? '' : cell).replace(/\s+/g, '');
  if (!t) return '';
  if (/학번/.test(t)) return 'sid';
  if (/^(학년|년)$/.test(t)) return 'year';
  if (/^(반|학급|반명)$/.test(t)) return 'cls';
  if (/^(번호|번|출석번호)$/.test(t)) return 'no';
  if (/^(이름|성명|학생명|학생이름|성함)$/.test(t)) return 'name';
  if (/성취|수준|성취도/.test(t)) return 'level';
  return '';
}

/** 학번 → [학년, 반, 번호]. 5자리 20315, 4자리 2315(반이 한 자리일 때) */
function splitStudentId(v) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
  if (s.length === 5) return [Number(s.charAt(0)), Number(s.slice(1, 3)), Number(s.slice(3))];
  if (s.length === 4) return [Number(s.charAt(0)), Number(s.charAt(1)), Number(s.slice(2))];
  return null;
}

function numOf_(v) {
  var m = String(v === null || v === undefined ? '' : v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function levelOf_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return '';
  var n = Number(s.replace(/[^0-9.]/g, ''));
  return (n >= 1 && n <= 5 && Math.floor(n) === n) ? n : null;   // null = 잘못된 값
}

function isSampleName_(name) {
  return /^(예시|\(예\)|예\)|홍길동)/.test(String(name || '').trim());
}

/** 붙여넣은 글 → 칸 나눈 줄들 */
function rosterTextToRows(text) {
  var out = [];
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var t = line.replace(/\u00A0/g, ' ').trim();
    if (!t) return;
    var cells = t.split(/\t|,|\s{2,}/).map(function (x) { return x.trim(); }).filter(String);
    if (cells.length < 3) cells = t.split(/\s+/);
    out.push(cells);
  });
  return out;
}

/**
 * 표(2차원 배열) → 학생 목록
 * @param {Array<Array>} rows
 * @param {string} mode 'class' | 'grade' | 'auto'
 * @return {{mode:string, students:Array<{year,cls,no,name,level}>, skipped:Array<{line:number, text:string, reason:string}>,
 *           warnings:string[], header:boolean}}
 */
function parseRosterRows(rows, mode) {
  rows = (rows || []).map(function (r) {
    return (Array.isArray(r) ? r : [r]).map(function (c) { return c === null || c === undefined ? '' : String(c).trim(); });
  });
  var res = { mode: mode, students: [], skipped: [], warnings: [], header: false };

  // 1) 머리글 줄 찾기 (앞쪽 10줄 안에서, '이름' 칸과 반/번호/학번 칸이 함께 있는 줄)
  var hIdx = -1, map = null;
  for (var i = 0; i < Math.min(rows.length, 10); i++) {
    var m = {};
    rows[i].forEach(function (c, j) { var k = rosterHeadKind(c); if (k && m[k] === undefined) m[k] = j; });
    if (m.name !== undefined && (m.cls !== undefined || m.no !== undefined || m.sid !== undefined)) { hIdx = i; map = m; break; }
  }

  var picked = [];
  if (map) {
    res.header = true;
    if (mode === 'auto') mode = (map.year !== undefined || map.sid !== undefined) ? 'grade' : 'class';
    for (var r = hIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row.some(String)) continue;
      var st = { year: '', cls: '', no: '', name: '', level: '' };
      if (map.sid !== undefined && (map.cls === undefined || !row[map.cls])) {
        var sp = splitStudentId(row[map.sid]);
        if (sp) { st.year = sp[0]; st.cls = sp[1]; st.no = sp[2]; }
      }
      if (map.year !== undefined && row[map.year] !== '') st.year = numOf_(row[map.year]);
      if (map.cls !== undefined && row[map.cls] !== '') st.cls = numOf_(row[map.cls]);
      if (map.no !== undefined && row[map.no] !== '') st.no = numOf_(row[map.no]);
      st.name = String(row[map.name] || '').trim();
      if (map.level !== undefined) st.level = levelOf_(row[map.level]);
      else if (!rows[hIdx][map.name + 1]) {   // 머리글 없는 바로 옆 칸에 1~5 가 있으면 성취수준으로 (예전 붙여넣기 호환)
        st.level = /^[1-5]$/.test(String(row[map.name + 1] || '').trim()) ? Number(row[map.name + 1]) : '';
      }
      picked.push({ st: st, line: r + 1, text: row.filter(String).join(' ') });
    }
  } else {
    // 2) 머리글 없음: 줄마다 값을 보고 읽는다
    var three = 0, sidN = 0, total = 0;
    var parsed = rows.map(function (row, r) {
      var cells = row.filter(String);
      if (!cells.length) return null;
      total++;
      var tagged = { year: null, cls: null, no: null }, nums = [], name = '', after = [];
      cells.forEach(function (c) {
        if (!name) {
          if (/^\d+\s*학년$/.test(c)) { tagged.year = numOf_(c); return; }
          if (/^\d+\s*반$/.test(c)) { tagged.cls = numOf_(c); return; }
          if (/^\d+\s*번$/.test(c)) { tagged.no = numOf_(c); return; }
          if (/^\d+$/.test(c)) { nums.push(c); return; }
          if (/[가-힣A-Za-z]/.test(c)) { name = c; return; }
        } else after.push(c);
      });
      var lv = '';
      for (var a = 0; a < after.length; a++) { if (/^\d$/.test(after[a])) { lv = levelOf_(after[a]); break; } }
      if (nums.length === 1 && /^\d{4,5}$/.test(nums[0]) && tagged.cls === null) sidN++;
      if (nums.length + (tagged.year !== null) + (tagged.cls !== null) + (tagged.no !== null) >= 3) three++;
      return { tagged: tagged, nums: nums, name: name, level: lv, line: r + 1, text: cells.join(' ') };
    });
    if (mode === 'auto') mode = (three + sidN > total / 2) ? 'grade' : 'class';
    parsed.forEach(function (p) {
      if (!p) return;
      var st = { year: '', cls: '', no: '', name: p.name, level: p.level };
      var nums = p.nums.slice();
      if (nums.length === 1 && /^\d{4,5}$/.test(nums[0]) && p.tagged.cls === null) {
        var sp = splitStudentId(nums[0]);
        st.year = sp[0]; st.cls = sp[1]; st.no = sp[2];
      } else {
        var order = mode === 'grade' ? ['year', 'cls', 'no'] : ['cls', 'no'];
        order.forEach(function (k) {
          if (p.tagged[k] !== null) st[k] = p.tagged[k];
          else if (nums.length) st[k] = Number(nums.shift());
        });
        if (mode === 'class' && p.tagged.year !== null) st.year = p.tagged.year;
      }
      picked.push({ st: st, line: p.line, text: p.text });
    });
  }
  res.mode = mode === 'grade' ? 'grade' : 'class';

  // 3) 걸러 내기 · 경고
  var seen = {}, badLevel = 0, noYear = 0;
  picked.forEach(function (p) {
    var st = p.st;
    if (!st.name) { res.skipped.push({ line: p.line, text: p.text, reason: '이름 없음' }); return; }
    if (isSampleName_(st.name)) { res.skipped.push({ line: p.line, text: p.text, reason: '양식의 예시 줄' }); return; }
    if (rosterHeadKind(st.name)) return;                             // 머리글이 한 번 더 나온 줄
    if (st.cls === '' || st.cls === null || st.no === '' || st.no === null) {
      res.skipped.push({ line: p.line, text: p.text, reason: '반 또는 번호 없음' }); return;
    }
    if (st.level === null) { badLevel++; st.level = ''; }
    if (res.mode === 'grade' && (st.year === '' || st.year === null)) noYear++;
    var key = (res.mode === 'grade' ? st.year + '-' : '') + st.cls + '-' + st.no;
    if (seen[key]) res.warnings.push('같은 ' + (res.mode === 'grade' ? '학년·' : '') + '반·번호가 두 번 있습니다: ' +
      key.replace(/-/g, ' ') + ' (' + seen[key] + ', ' + st.name + ')');
    else seen[key] = st.name;
    res.students.push(st);
  });
  if (badLevel) res.warnings.push('성취수준이 1~5가 아닌 값 ' + badLevel + '개는 비워 두었습니다.');
  if (noYear) res.warnings.push('학년이 비어 있는 학생이 ' + noYear + '명 있습니다.');

  res.students.sort(function (a, b) {
    return (Number(a.year) || 0) - (Number(b.year) || 0) || (Number(a.cls) || 0) - (Number(b.cls) || 0) ||
           (Number(a.no) || 0) - (Number(b.no) || 0);
  });
  return res;
}

/** 학생 → 명단 시트 한 줄 */
function rosterRowOf(st, mode) {
  return mode === 'grade' ? [st.year, st.cls, st.no, st.name, st.level] : [st.cls, st.no, st.name, st.level];
}

/** 활동 시트 A열에 보일 반 표시: 반 방식은 "3", 학년 방식은 "2-3" */
function classLabel(year, cls) {
  var y = String(year === null || year === undefined ? '' : year).trim();
  return y ? y + '-' + cls : cls;
}

/** "2학년 3반 15번 김하늘" */
function studentLabel(st) {
  return (st.year !== '' && st.year !== undefined && st.year !== null ? st.year + '학년 ' : '') +
         st.cls + '반 ' + st.no + '번 ' + (st.name || '');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROSTER_HEAD: ROSTER_HEAD, rosterHeadKind: rosterHeadKind, splitStudentId: splitStudentId,
    rosterTextToRows: rosterTextToRows, parseRosterRows: parseRosterRows, rosterRowOf: rosterRowOf,
    classLabel: classLabel, studentLabel: studentLabel
  };
}


/* ==========================================================================
   16_Rules.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 기재요령 규칙판 · 맞춤법 · 고쳐쓰기 (순수 로직)
 * ---------------------------------------------------------------
 * 해마다 바뀌는 학교생활기록부 기재요령을 "규칙판" 하나로 묶는다.
 *   · 금지어·형식·맞춤법 검사 표       → [📏 기재요령] 시트
 *   · 프롬프트의 [학생부 기재 금지사항] → [📐 공통규칙] NEIS_RULES
 *   · 기록 항목별 기재 주의            → [🧩 기록종류] [기재 주의] 칸 (그 항목 프롬프트에만 붙는다)
 *   · 기록 항목별 최대 글자 수         → [🧩 기록종류] [글자수] 칸
 * 새 학년도 기재요령이 나오면 만든이가 rules/latest.json 하나만 고치고,
 * 사본들은 그것을 받아 선생님이 손대지 않은 칸만 바꾼다(손댄 칸은 그대로 두고 알린다).
 *
 * 이 파일은 Apps Script와 Node 양쪽에서 동작한다(테스트: test/rules.test.js).
 * ---------------------------------------------------------------
 */

/** 원격 규칙판 주소 — 구글 서버에서 받으므로 학교망에서 github 가 막혀도 된다 */
var RULES_URL = 'https://raw.githubusercontent.com/sced9120/Prompt-Master/main/rules/latest.json';
/** 원격 규칙판을 저절로 확인하는 간격 */
var RULES_CHECK_DAYS = 7;

/** 2026 기재요령의 생성형 AI 원칙 — 시작하기·사용법·검사 창·복사 창에 보여 준다 */
var AI_NOTICE_2026 =
  'AI로 생성한 자료를 학교생활기록부 서술형 항목에 그대로 입력하는 것은 금지입니다(2026학년도 기재요령 고 p.19). ' +
  '이 도구의 결과는 초안입니다. 교사가 평소 직접 관찰·평가한 내용을 바탕으로 고쳐 쓰고, 최종 입력 전에 ' +
  '학생의 실제 수행과 무관한 허위·과장 기재가 없는지, 기재요령을 지켰는지 반드시 확인하세요.';

/** 맞춤법 표(자주 틀리는 표기) — [📏 기재요령] 시트에 함께 채워져 선생님이 더할 수 있다 */
var PRESET_SPELL_RULES = [
  ['역활', '역할'], ['됬', '됐'], ['몇 ?일', '며칠'], ['왠만', '웬만'], ['웬지', '왠지'],
  ['금새', '금세'], ['희안', '희한'], ['설레임', '설렘'], ['오랫만', '오랜만'],
  ['일일히', '일일이'], ['깨끗히', '깨끗이'], ['틈틈히', '틈틈이'], ['곰곰히', '곰곰이'],
  ['꼼꼼이', '꼼꼼히'], ['솔직이', '솔직히'], ['꾸준이', '꾸준히'], ['열심이', '열심히'],
  ['번번히', '번번이'], ['어떻해', '어떻게 해'], ['할께', '할게'], ['내노라', '내로라'],
  ['어의없', '어이없'], ['문안하게', '무난하게'], ['뒤쳐', '뒤처'], ['짜집기', '짜깁기'],
  ['염두해', '염두에 두어'], ['단언컨데', '단언컨대'], ['요컨데', '요컨대'], ['생각컨대', '생각건대'],
  ['할려고', '하려고'], ['볼려고', '보려고'], ['갈려고', '가려고'], ['들어나', '드러나'], ['들어남', '드러남'],
  ['가르키', '가리키'], ['어줍잖', '어쭙잖'], ['안밖', '안팎'], ['되여', '되어'], ['바뀌였', '바뀌었']
].map(function (p) { return { level: 'check', label: '맞춤법', re: p[0], fix: p[1], why: '바른 표기: ' + p[1] }; });

/* ============================================================ 2026 규칙판 */
/**
 * 기록 항목별 기재 주의 — 그 기록 항목의 프롬프트에만 붙는다(필요한 규칙만 꺼내 쓰기).
 * 출처: 2026학년도 학교생활기록부 기재요령 주요 개정사항 안내(고등학교, 교육부·KERIS)
 */
var RECORD_RULES_2026 = {
  '과세특':
    '- 교사가 수업과 수업에 연계한 수행평가 등에서 수시·상시로 관찰·평가한 내용만 바탕으로 쓴다(고 p.117).\n' +
    '- 성취기준에 따른 성취수준의 특성, 학습활동 참여도, 자기주도적 학습에 의한 변화와 성장 정도를 중심으로 쓴다.\n' +
    '- 수업 활동을 단순히 나열하거나 성취기준에 이미 적힌 지식을 그대로 옮기지 않는다(고 p.95).\n' +
    '- 교내·외 대회, 방과후학교 활동, K-MOOC·MOOC·KOCW, 연구보고서(소논문) 실적은 쓰지 않는다(고 p.118).\n' +
    '- 수학과제 탐구·사회문제 탐구·융합과학 탐구·과학과제 연구·사회과제 연구·윤리문제 탐구 과목은 연구보고서의 제목·주제·참여 인원·소요 시간을 빼고 과정만 쓸 수 있다.',
  '개세특':
    '- 정규교육과정의 교육활동에서 교사가 직접 관찰·평가한 내용만 쓴다.\n' +
    '- 교내·외 대회, 방과후학교 활동, K-MOOC·MOOC·KOCW, 연구보고서(소논문) 실적은 쓰지 않는다(고 p.118).',
  '자율':
    '- 학교교육계획에 따른 정규교육과정의 자율·자치활동만 쓴다(고 p.81).\n' +
    '- 이 영역과 연계해 학교교육계획에 따라 실시한 봉사활동은 이 영역 특기사항에 쓸 수 있다(2026학년도 1·2학년, 고 p.86).',
  '동아리':
    '- 정규교육과정의 동아리활동만 특기사항을 쓴다(고 p.81).\n' +
    '- 자율동아리, 정규교육과정 밖의 학교스포츠클럽, 청소년단체 활동은 특기사항을 쓰지 않는다(고등학교, 고 p.78·p.84).\n' +
    '- 이 영역과 연계해 학교교육계획에 따라 실시한 봉사활동은 이 영역 특기사항에 쓸 수 있다(2026학년도 1·2학년).',
  '진로':
    '- 정규교육과정의 진로활동만 쓴다(고 p.81).\n' +
    '- 희망 진로를 특정 대학명·학과명으로 쓰지 않는다.\n' +
    '- 최대 500자다(2026학년도부터 700자에서 줄어듦, 고 p.208).',
  '행발':
    '- 학습·행동·인성 등 학교 교육활동 전반에서 지속적으로 관찰한 행동특성을 바탕으로, 학생의 성장을 지원하는 교육적 관점에서 쓴다(고 p.158).\n' +
    '- 부정적 행동특성을 쓸 때는 구체적 관찰 사실과 함께 변화 가능성을 쓴다.\n' +
    '- 다른 항목에 입력할 수 없는 내용(방과후학교 활동 등)은 여기에도 쓰지 않는다(고 p.159).\n' +
    '- 최대 300자다(2026학년도부터 500자에서 줄어듦, 고 p.208).'
};

/** 2026학년도 규칙판 — 원격 규칙판(rules/latest.json)도 같은 모양이다 */
var RULES_2026 = {
  id: '2026.1',
  year: 2026,
  checked: '2026-10-13',
  source: '2026학년도 학교생활기록부 기재요령 · 주요 개정사항 안내(고등학교, 교육부·KERIS, 2026-02)',
  aiNotice: AI_NOTICE_2026,
  neisRules: NEIS_RULES_2026,
  chars: { '과세특': 500, '개세특': 500, '자율': 500, '동아리': 500, '진로': 500, '행발': 300 },
  byRecord: RECORD_RULES_2026,
  rules: PRESET_BANNED.concat(PRESET_FORMAT_RULES).concat(PRESET_SPELL_RULES),
  // 직전 기준 — 이 값 그대로인 칸은 손대지 않은 옛 기본값으로 보고 새 값으로 바꾼다
  history: [{ id: '2025', chars: { '진로': 700, '행발': 500 } }]
};

/**
 * 규칙판이 바뀌기 전 판들의 [기재 주의]·NEIS 문구 — 이 문구 그대로면 선생님이 손대지 않은 것.
 * 다음 학년도 규칙판을 만들 때 직전 판의 문구가 여기에 남도록 rules/latest.json 의 history 에 넣는다.
 */
function knownOldTexts(pack, field, key) {
  var out = [];
  var add = function (t) { t = normText(t); if (t && out.indexOf(t) < 0) out.push(t); };
  if (field === 'neisRules') (typeof OLD_NEIS_RULES !== 'undefined' ? OLD_NEIS_RULES : []).forEach(add);
  [RULES_2026].concat(pack && pack.history ? pack.history : []).forEach(function (h) {
    if (!h) return;
    if (field === 'neisRules') add(h.neisRules);
    else if (field === 'byRecord' && h.byRecord) add(h.byRecord[key]);
  });
  return out;
}

/** 비교용으로 줄 끝 공백·줄바꿈 종류를 맞춘다 */
function normText(t) {
  return String(t === null || t === undefined ? '' : t).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

/** 규칙판 번호 비교: '2026.1' < '2026.2' < '2027.1' */
function packNewer(a, b) {
  var p = function (x) { return String(x || '0').split('.').map(function (n) { return Number(n) || 0; }); };
  var x = p(a), y = p(b);
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

/**
 * 원격에서 받은 규칙판 검사. 깨진 정규식·너무 긴 값은 빼고, 쓸 수 있는 것만 남긴다.
 * @return {{ok:boolean, pack?:Object, errors:string[]}}
 */
function validatePack(raw) {
  var errors = [];
  var p = raw;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { return { ok: false, errors: ['JSON 이 아님'] }; } }
  if (!p || typeof p !== 'object') return { ok: false, errors: ['비어 있음'] };
  if (!/^\d{4}\.\d+$/.test(String(p.id || ''))) errors.push('id 형식이 아님(예: 2027.1)');
  var rules = [];
  (Array.isArray(p.rules) ? p.rules : []).forEach(function (r, i) {
    if (!r || !r.re || String(r.re).length > 400) { errors.push('rules[' + i + '] 비었거나 너무 김'); return; }
    try { new RegExp(r.re); } catch (e) { errors.push('rules[' + i + '] 정규식 오류: ' + r.re); return; }
    rules.push({ level: r.level === 'block' ? 'block' : 'check', label: String(r.label || '기타').slice(0, 40),
                 re: String(r.re), fix: r.fix ? String(r.fix).slice(0, 60) : '', why: String(r.why || '').slice(0, 300) });
  });
  if (!rules.length) errors.push('rules 가 비었음');
  var chars = {};
  Object.keys(p.chars || {}).forEach(function (k) {
    var n = Number(p.chars[k]);
    if (n >= 50 && n <= 3000) chars[k] = Math.round(n);
  });
  var byRecord = {};
  Object.keys(p.byRecord || {}).forEach(function (k) {
    var t = String(p.byRecord[k] || '');
    if (t.length <= 3000) byRecord[k] = t;
  });
  var fatal = !/^\d{4}\.\d+$/.test(String(p.id || '')) || !rules.length;
  if (fatal) return { ok: false, errors: errors };
  return {
    ok: true, errors: errors,
    pack: {
      id: String(p.id), year: Number(p.year) || Number(String(p.id).slice(0, 4)),
      checked: String(p.checked || ''), source: String(p.source || '').slice(0, 300),
      aiNotice: String(p.aiNotice || AI_NOTICE_2026).slice(0, 1200),
      neisRules: String(p.neisRules || '').slice(0, 6000),
      chars: chars, byRecord: byRecord, rules: rules,
      history: Array.isArray(p.history) ? p.history.slice(0, 10) : []
    }
  };
}

/** 규칙판 → [📏 기재요령] 표의 줄 [사용, 수준, 분류, 찾을 말, 바르게, 이유·근거, 출처] */
function packRuleRows(pack) {
  var src = (pack.year || '') + ' 기재요령';
  return (pack.rules || []).map(function (r) {
    return [true, r.level === 'block' ? '수정' : '확인', r.label, r.re, r.fix || '', r.why || '',
            r.label === '맞춤법' ? '맞춤법(기본)' : src];
  });
}

/** 표의 한 줄 → 검사 규칙. 사용을 끈 줄·빈 줄·깨진 정규식은 null */
function ruleFromRow(row) {
  var use = row[0] === true || String(row[0]).toUpperCase() === 'TRUE';
  var re = String(row[3] || '').trim();
  if (!use || !re) return null;
  try { new RegExp(re); } catch (e) { return null; }
  var lv = String(row[1] || '').trim();
  return { level: (lv === '수정' || lv === 'block') ? 'block' : 'check', label: String(row[2] || '기타').trim() || '기타',
           re: re, fix: String(row[4] || '').trim(), why: String(row[5] || '').trim() };
}

/** 표의 [출처]가 기본(규칙판)에서 온 줄인지 — 선생님이 더한 '내 학교' 줄은 업데이트 때 남긴다 */
function isPackRow(src) {
  src = String(src || '').trim();
  return !src || /기재요령|맞춤법\(기본\)/.test(src);
}

/* ============================================================ 맞춤법 */
var JONG_RIEUL = 8, JONG_NIEUN = 4, JONG_SS = 20, JONG_BS = 18;
/** '안'·'않' 뒤에 오는 되·돼·하·해 (받침이 붙은 된·됨·한·했… 까지) */
var NEG_NEXT = /^[돼-됳하-햏]/;
function jongOf_(ch) {
  var c = ch ? ch.charCodeAt(0) : 0;
  if (c < 0xAC00 || c > 0xD7A3) return -1;
  return (c - 0xAC00) % 28;
}

/**
 * 표로 잡기 어려운 띄어쓰기·어미 오류 (정확도가 높은 것만, 모두 [확인] 수준)
 *   · 할수 있다 → 할 수 있다,  할것 → 할 것,  할때 → 할 때,  할줄 알다 → 할 줄 알다
 *   · 있슴/했슴 → 있음/했음,  않하다 → 안 하다,  해서는 안된다 → 안 된다
 *   · 같은 낱말 연속, 빈칸 두 번, 문장부호 앞 빈칸, 마침표·쉼표 뒤 붙여 쓰기
 * @return {Array<{level, label, hit, fix, why}>}
 */
function spellIssues(text) {
  var s = String(text || ''), out = [], seen = {};
  var push = function (hit, fix, why) {
    var k = hit + '→' + fix;
    if (seen[k]) return;
    seen[k] = 1;
    out.push({ level: 'check', label: '맞춤법', hit: hit, fix: fix, why: why });
  };
  for (var i = 1; i < s.length; i++) {
    var prev = s.charAt(i - 1), ch = s.charAt(i), next = s.charAt(i + 1), j = jongOf_(prev);
    if (ch === '수' && j === JONG_RIEUL) {
      var rest = s.slice(i + 1).replace(/^ +/, '');
      if (/^(있|없)/.test(rest)) push(prev + '수', prev + ' 수', "의존명사 '수'는 띄어 씀");
    } else if (ch === '것' && (j === JONG_RIEUL || j === JONG_NIEUN) && ['날', '별', '온', '산'].indexOf(prev) < 0) {
      push(prev + '것', prev + ' 것', "의존명사 '것'은 띄어 씀");
    } else if (ch === '때' && j === JONG_RIEUL) {
      push(prev + '때', prev + ' 때', "'~ㄹ 때'는 띄어 씀");
    } else if (ch === '줄' && j === JONG_RIEUL && /^ ?(알|몰)/.test(s.slice(i + 1))) {
      push(prev + '줄', prev + ' 줄', "의존명사 '줄'은 띄어 씀");
    } else if (ch === '슴' && (j === JONG_SS || j === JONG_BS)) {
      push(prev + '슴', prev + '음', "명사형은 '~음' (있음, 했음)");
    } else if (ch === '않' && NEG_NEXT.test(next)) {
      push('않' + next, '안 ' + next, "부정은 '안 ~' (않은 '~지 않다'에만)");
    }
  }
  var m, re1 = new RegExp('(^|[\\s,.])안(' + NEG_NEXT.source.slice(1) + ')', 'g');
  while ((m = re1.exec(s))) push('안' + m[2], '안 ' + m[2], "부정의 '안'은 띄어 씀");
  var re2 = /(^|\s)([가-힣A-Za-z]{2,})\s+\2(?=[\s.,]|$)/g;
  while ((m = re2.exec(s))) push(m[2] + ' ' + m[2], m[2], '같은 낱말이 잇따라 나옴');
  if (/ {2,}/.test(s)) push('빈칸 두 번', '빈칸 한 번', '빈칸이 겹침');
  if ((m = s.match(/\S\s+[.,]/))) push(m[0], m[0].replace(/\s+/, ''), '문장부호 앞에는 빈칸을 두지 않음');
  if ((m = s.match(/[가-힣][.,][가-힣A-Za-z]/))) push(m[0], m[0].charAt(0) + m[0].charAt(1) + ' ' + m[0].charAt(2), '마침표·쉼표 뒤는 한 칸 띄움');
  return out;
}

/* ============================================================ 고쳐쓰기 (하네스) */
/**
 * 생성 → 자동 검사 → 걸린 것만 짚어 다시 쓰게 하는 "고쳐쓰기" 요청문.
 * 규칙(시스템 프롬프트)은 처음 생성과 똑같이 보내므로 회사 쪽 캐시 할인도 그대로 받는다.
 * @param {string} block      학생 자료
 * @param {string} draft      첫 결과
 * @param {Array} issues      validateResult 의 issues 중 고칠 것
 * @param {number} limitBytes
 */
function buildRepairUser(block, draft, issues, limitBytes) {
  var L = ['# 학생 자료', String(block || '').trim(), '', '# 고쳐 쓸 초안', String(draft || '').trim(), '',
           '# 자동 검사에서 걸린 점 — 이것만 바로잡는다'];
  (issues || []).forEach(function (x) {
    if (x.label === '분량 초과') L.push('- 분량 초과(' + x.hit + '): ' + limitBytes + '바이트 이내가 되도록 덜 중요한 문장을 줄인다.');
    else if (x.fix) L.push('- ' + x.label + ': "' + x.hit + '" → "' + x.fix + '"');
    else L.push('- ' + x.label + ': "' + x.hit + '" ' + (x.why ? '— ' + x.why : '') + ' → 이 내용을 빼거나 기재요령에 맞게 바꾼다.');
  });
  L.push('', '# 출력', '위 점만 바로잡은 특기사항 본문만 한 문단으로 출력한다. 학생 자료에 없는 내용을 새로 넣지 않는다. 설명을 붙이지 않는다.');
  return L.join('\n');
}

/** 고쳐 쓸 만한지: [수정] 수준이 하나라도 있으면 */
function needsRepair(v) {
  return !!(v && v.issues && v.issues.some(function (x) { return x.level === 'block' && x.label !== '결과 없음'; }));
}

/** 두 검사 결과 중 나은 쪽: [수정] 수가 적은 쪽, 같으면 [확인] 수가 적은 쪽 */
function betterResult(a, b) {
  var cnt = function (v, lv) { return v.issues.filter(function (x) { return x.level === lv; }).length; };
  var ab = cnt(a, 'block'), bb = cnt(b, 'block');
  if (ab !== bb) return bb < ab ? 'b' : 'a';
  return cnt(b, 'check') < cnt(a, 'check') ? 'b' : 'a';
}

/* ============================================================ 근거 확인 */
/**
 * "AI 결과가 학생 자료에 있는 내용인가" — 2026 기재요령의 허위·과장 확인을 돕는 검토 요청.
 * 결과는 JSON {"unsupported":[{"quote","why"}]}.
 */
var GROUND_SYSTEM =
  '# 역할\n당신은 학교생활기록부 문장을 검토하는 교사다.\n\n' +
  '# 할 일\n[학생 자료]와 [특기사항 초안]을 비교해, 초안에서 학생 자료로 뒷받침되지 않는 내용을 찾는다.\n' +
  '- 자료에 없는 활동, 결과, 수치, 횟수, 도서·인물, 과장된 평가(예: 탁월함, 뛰어남)를 찾는다.\n' +
  '- 자료의 표현을 자연스럽게 바꾼 것, 자료에서 바로 읽히는 의미 부여는 문제 삼지 않는다.\n' +
  '- 근거가 없는 구절만 초안 원문 그대로 짧게 뽑는다.\n\n' +
  '# 출력\nJSON 하나만 출력한다. {"unsupported":[{"quote":"초안의 구절","why":"자료에 없는 이유"}]}\n없으면 {"unsupported":[]}';

function buildGroundUser(source, draft) {
  return '# 학생 자료\n' + String(source || '').trim() + '\n\n# 특기사항 초안\n' + String(draft || '').trim();
}

function parseGroundResult(text) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var j = null;
  try { j = JSON.parse(t); } catch (e) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { j = JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
  }
  var list = j && Array.isArray(j.unsupported) ? j.unsupported : (Array.isArray(j) ? j : []);
  return list.map(function (x) {
    return { quote: String((x && (x.quote || x.text)) || '').trim(), why: String((x && x.why) || '').trim() };
  }).filter(function (x) { return x.quote; });
}

/* ============================================================ 맞춤법 (AI) */
var SPELL_SYSTEM =
  '# 역할\n당신은 한국어 맞춤법·띄어쓰기 교정자다.\n\n' +
  '# 할 일\n[글]의 맞춤법, 띄어쓰기, 오탈자, 문장부호만 바로잡는다.\n' +
  '- 내용, 낱말 선택, 문장 순서, 문체는 바꾸지 않는다. 학교생활기록부 문장이라 "~함.", "~음." 처럼 끝나는 것은 그대로 둔다.\n' +
  '- 고칠 곳마다 글에 있는 그대로의 짧은 구절(from)과 바른 표기(to)를 쓴다.\n\n' +
  '# 출력\nJSON 하나만 출력한다. {"changes":[{"from":"틀린 구절","to":"바른 구절","why":"짧은 이유"}]}\n고칠 것이 없으면 {"changes":[]}';

function parseSpellResult(text, original) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var j = null;
  try { j = JSON.parse(t); } catch (e) {
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { j = JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
  }
  var src = String(original || '');
  return (j && Array.isArray(j.changes) ? j.changes : []).map(function (c) {
    return { from: String((c && c.from) || ''), to: String((c && c.to) || ''), why: String((c && c.why) || '') };
  }).filter(function (c) { return c.from && c.from !== c.to && src.indexOf(c.from) >= 0; });
}

/** 고칠 목록을 글에 적용 (앞에서부터 한 번씩) */
function applyChanges(text, changes) {
  var s = String(text || '');
  (changes || []).forEach(function (c) {
    var i = s.indexOf(c.from);
    if (i >= 0) s = s.slice(0, i) + c.to + s.slice(i + c.from.length);
  });
  return s;
}

/* ============================================================ 키 없이 (복사·붙여넣기) */
/**
 * Gemini 앱(학교 계정)·ChatGPT·Claude 같은 대화창에 붙여 넣을 요청문.
 * 대화창은 JSON 대신 [S1] 같은 표시로 나눠 받는 편이 안정적이다.
 * @param {Array<{id:string, block:string}>} items
 * @param {string=} heading  한 명일 때 자료 제목 (기본 '학생 자료', 압축은 '통합할 문장들')
 */
function buildManualUser(items, heading) {
  heading = heading || '학생 자료';
  if (items.length === 1) {
    return '# ' + heading + '\n' + String(items[0].block || '').trim() + '\n\n# 출력\n위 규칙대로 특기사항 본문만 한 문단으로 출력한다. 설명, 제목, 따옴표를 붙이지 않는다.';
  }
  var L = ['# 이번에 작성할 학생 ' + items.length + '명',
           '아래 학생들의 특기사항을 한 명씩 따로 작성한다.',
           '- 위의 모든 규칙(분량 포함)을 학생마다 따로 지킨다. 분량은 학생 한 명 기준이다.',
           '- 다른 학생의 자료를 섞지 않는다. 그 학생 자료에 없는 내용을 지어내지 않는다.',
           '- 학생마다 첫 문장과 문장 구조를 다르게 한다.'];
  items.forEach(function (it) { L.push('', '## ' + it.id, String(it.block || '').trim()); });
  L.push('', '# 출력 형식',
         '학생마다 [번호] 한 줄을 쓰고 다음 줄에 특기사항 본문만 쓴다. 다른 설명은 붙이지 않는다.',
         items.map(function (it) { return '[' + it.id + ']\n(본문)'; }).join('\n'));
  return L.join('\n');
}

/**
 * 대화창에서 복사해 온 답 → id → 본문.
 * [S1] / S1: / **S1** / ## S1 같은 표시를 모두 받고, JSON 으로 왔으면 그것도 읽는다.
 */
function parseManualAnswer(text, ids) {
  var t = String(text || '').replace(/\r\n?/g, '\n').trim();
  var map = {};
  if (!t) return { map: map, missing: ids.slice() };
  if (ids.length === 1 && !/\[?\*{0,2}#*\s*S1\b/.test(t)) {
    map[ids[0]] = t;
    return { map: map, missing: [] };
  }
  var re = /(^|\n)\s*(?:#+\s*)?(?:\*\*)?\[?\s*(S\d+)\s*\]?(?:\*\*)?\s*[:：]?[ \t]*/g, m, marks = [];
  while ((m = re.exec(t))) marks.push({ id: m[2], start: m.index + m[0].length, at: m.index });
  if (marks.length) {
    marks.forEach(function (mk, i) {
      var body = t.slice(mk.start, i + 1 < marks.length ? marks[i + 1].at : t.length).trim();
      if (ids.indexOf(mk.id) >= 0 && body && !map[mk.id]) map[mk.id] = body;
    });
  } else if (typeof parseBatchResult === 'function') {
    map = parseBatchResult(t, ids).map;
  }
  return { map: map, missing: ids.filter(function (id) { return !map[id]; }) };
}

/* ============================================================ AI 앱으로 내보내기 */
var RECORD_SLUG = { '과세특': 'subject', '개세특': 'individual', '자율': 'autonomy', '동아리': 'club', '진로': 'career', '행발': 'behavior' };

/** 스킬 이름: 영문 소문자·숫자·하이픈만, 64자 이내 */
function skillName(recordKey, n) {
  return ('saeteuk-' + (RECORD_SLUG[recordKey] || 'record') + '-' + (Number(n) || 1)).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
}

/** Gemini Gem 안내 · ChatGPT/Claude 프로젝트 지침에 붙여 넣을 글 */
function buildGemText(system) {
  return String(system || '').trim() + '\n\n# 사용법\n교사가 학생 자료를 붙여 넣으면 위 규칙대로 특기사항 본문만 쓴다. ' +
    '여러 명이면 [S1] [S2] 처럼 학생마다 표시 한 줄을 쓰고 다음 줄에 본문을 쓴다.';
}

/**
 * Claude 스킬(SKILL.md) — 시트가 조립한 규칙을 그대로 담는다. 시트를 고치면 다시 내보내야 한다.
 * @param {{name:string, activity:string, record:string, system:string, notice:string, rulesId:string}} o
 */
function buildSkillMd(o) {
  var desc = (o.activity + ' 활동의 학교생활기록부 ' + o.record + ' 초안을 2026학년도 기재요령에 맞춰 쓴다. ' +
              '교사가 학생 관찰 자료(메모·입력 항목)를 주고 세특·특기사항 초안을 부탁할 때 쓴다.').replace(/\s+/g, ' ');
  return [
    '---',
    'name: ' + o.name,
    'description: ' + desc.slice(0, 1000),
    '---',
    '',
    '# ' + o.activity + ' — ' + o.record + ' 초안 쓰기',
    '',
    '세특 작성 도우미(구글 시트)에서 내보낸 규칙입니다. 기재요령 규칙판 ' + o.rulesId + '.',
    '',
    '## 규칙',
    '',
    String(o.system || '').trim(),
    '',
    '## 여러 학생을 한 번에 받을 때',
    '',
    '학생마다 [S1] [S2] 처럼 표시 한 줄을 쓰고 다음 줄에 그 학생의 본문만 쓴다. 학생 자료를 서로 섞지 않는다.',
    '',
    '## 꼭 지킬 것',
    '',
    '- ' + String(o.notice || '').trim(),
    '- 결과는 초안이다. 교사가 직접 관찰한 사실과 맞는지 확인하고 고쳐 쓰도록 답 끝에 한 줄로 알린다.',
    ''
  ].join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RULES_2026: RULES_2026, PRESET_SPELL_RULES: PRESET_SPELL_RULES, RECORD_RULES_2026: RECORD_RULES_2026,
    knownOldTexts: knownOldTexts, normText: normText, packNewer: packNewer, validatePack: validatePack,
    packRuleRows: packRuleRows, ruleFromRow: ruleFromRow, isPackRow: isPackRow, spellIssues: spellIssues,
    buildRepairUser: buildRepairUser, needsRepair: needsRepair, betterResult: betterResult,
    buildGroundUser: buildGroundUser, parseGroundResult: parseGroundResult,
    parseSpellResult: parseSpellResult, applyChanges: applyChanges,
    buildManualUser: buildManualUser, parseManualAnswer: parseManualAnswer,
    skillName: skillName, buildGemText: buildGemText, buildSkillMd: buildSkillMd
  };
}


/* ==========================================================================
   18_Reports.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 보고서 · 내 문체 · 설문지 (순수 로직)
 * ---------------------------------------------------------------
 * 📄 보고서 세특: 완성된 보고서를 곧바로 세특으로 바꾸지 않고 두 단계로 나눈다.
 *   ① 보고서 → [보고서 요점] (AI 가 정해진 칸에 뽑고, 교사가 확인·수정)
 *   ② [보고서 요점] + [교사 관찰 메모] + 예시 → 세특 (원래 생성 흐름 그대로)
 *   긴 보고서를 통째로 넣으면 예시가 묻혀 덜 따르게 되므로, ②에는 요점만 보낸다.
 * ✒️ 내 문체: 예전에 쓴 세특에서 "쓰는 방식"만 뽑은 문체 카드 + 문체 예시 몇 편.
 *   카드는 규칙 끝과 학생 자료 바로 뒤에 한 번 더 붙여, 몇 번째 학생이든 똑같이 따르게 한다.
 * 📝 구글 설문지: 응답 시트의 머리글을 이름으로 읽고(순서·이메일 칸에 흔들리지 않게) 학생과 맞춘다.
 *
 * Apps Script와 Node 양쪽에서 동작한다(테스트: test/reports.test.js).
 * ---------------------------------------------------------------
 */

/** 보고서 시트의 입력 항목 — 이름이 곧 열 머리글 */
var REPORT_COL = '보고서', POINTS_COL = '보고서 요점', TEACHER_COL = '교사 관찰 메모';
var REPORT_COLUMNS = [REPORT_COL, POINTS_COL, TEACHER_COL];

/** 보고서에서 뽑을 요점 칸 (교사가 확인하기 쉬운 순서) */
var REPORT_POINTS = ['탐구 주제와 동기', '탐구 과정과 방법', '결과와 해석', '한계와 개선점', '활용한 교과 개념', '학생의 생각과 질문'];

var EXTRACT_SYSTEM =
  '# 역할\n당신은 고등학교 교사의 학교생활기록부 작성을 돕는 조교다. 학생이 수업 중에 쓴 보고서를 읽고, 세특의 근거가 될 요점만 정리한다.\n\n' +
  '# 지킬 것\n' +
  '- 보고서에 실제로 쓰여 있는 내용만 쓴다. 추측, 평가, 칭찬을 덧붙이지 않는다.\n' +
  '- 항목마다 1~3문장으로 짧게. 보고서에 없으면 "없음".\n' +
  '- 보고서 제목, 참고문헌 목록, 참여 인원·소요 시간, 대학·기관·인물 이름, 수상·점수는 옮기지 않는다.\n' +
  '- 사진·그림·손글씨도 읽어 내용에 넣는다. 읽기 어려운 곳은 [판독 어려움]이라고 쓴다.\n\n' +
  '# 출력 (아래 형식 그대로, 다른 말 없이)\n' +
  REPORT_POINTS.map(function (p) { return p + ': '; }).join('\n');

/** 요점 뽑기 요청문 — 보고서 글(있으면)과 첨부 파일 설명 */
function buildExtractUser(text, notes) {
  var L = ['# 학생 보고서'];
  var t = String(text || '').trim();
  if (t) L.push(t.length > 30000 ? t.slice(0, 30000) + '\n…(뒷부분 생략)' : t);
  if (notes && notes.length) L.push('', '(첨부: ' + notes.join(', ') + ')');
  if (!t && !(notes && notes.length)) L.push('(내용 없음)');
  return L.join('\n');
}

/** 요점 답 정리 — 코드 울타리·머리말을 걷고 항목 줄만 남긴다 */
function cleanPoints(text) {
  var t = String(text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  var lines = t.split(/\r?\n/).map(function (l) { return l.replace(/^\s*[-*•]\s*/, '').replace(/\*\*/g, '').trimEnd(); });
  var first = -1;
  for (var i = 0; i < lines.length; i++) {
    if (REPORT_POINTS.some(function (p) { return lines[i].indexOf(p) === 0; })) { first = i; break; }
  }
  return (first >= 0 ? lines.slice(first) : lines).join('\n').trim();
}

/** 셀 글 안의 구글 드라이브 파일 ID 들 (설문지 파일 업로드 · 공유 링크 · 문서 링크) */
function driveIdsIn(text) {
  var s = String(text || ''), out = [];
  var add = function (id) { if (id && id.length >= 20 && out.indexOf(id) < 0) out.push(id); };
  var m, re = /(?:drive|docs)\.google\.com\/(?:open\?id=|file\/d\/|document\/d\/|presentation\/d\/|spreadsheets\/d\/|uc\?(?:export=\w+&)?id=)([A-Za-z0-9_-]{20,})/g;
  while ((m = re.exec(s))) add(m[1]);
  return out;
}

/** 드라이브 폴더 ID */
function driveFolderIdIn(text) {
  var m = String(text || '').match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

/** 셀 글에서 링크를 뺀 나머지(학생이 함께 적은 설명 등) */
function textWithoutLinks(text) {
  return String(text || '').replace(/https?:\/\/\S+/g, '').replace(/[,\s]+$/g, '').trim();
}

/** XML 에서 글자만 — docx(w:t)·hwpx(hp:t)·pptx(a:t). 문단 끝은 줄바꿈 */
function xmlText(xml, kind) {
  var s = String(xml || '');
  var para = kind === 'hwpx' ? /<\/hp:p>/g : kind === 'pptx' ? /<\/a:p>/g : /<\/w:p>/g;
  var run = kind === 'hwpx' ? /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g : kind === 'pptx' ? /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g
                            : /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  s = s.replace(para, '\u0001');
  var out = [], m;
  var chunks = s.split('\u0001');
  chunks.forEach(function (c) {
    var line = '';
    run.lastIndex = 0;
    while ((m = run.exec(c))) line += m[1];
    line = line.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
               .replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
    if (line) out.push(line);
  });
  return out.join('\n');
}

/** 파일 종류 → 읽는 방법: 'gdoc'·'text'·'docx'·'hwpx'·'pptx'·'pdf'·'image'·'hwp'·'' */
function fileKind(mime, name) {
  var m = String(mime || ''), n = String(name || '').toLowerCase();
  if (/application\/vnd\.google-apps\.(document|presentation)/.test(m)) return 'gdoc';
  if (/^text\//.test(m) || /\.(txt|md)$/.test(n)) return 'text';
  if (/wordprocessingml/.test(m) || /\.docx$/.test(n)) return 'docx';
  if (/presentationml/.test(m) || /\.pptx$/.test(n)) return 'pptx';
  if (/hwp\+zip|hwpx/.test(m) || /\.hwpx$/.test(n)) return 'hwpx';
  if (/\.hwp$/.test(n) || /x-hwp|haansoft/.test(m)) return 'hwp';
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return 'pdf';
  if (/^image\/(png|jpe?g|webp|gif|heic|heif)$/.test(m) || /\.(png|jpe?g|webp|gif|heic|heif)$/.test(n)) return 'image';
  return '';
}

/**
 * 폴더의 파일 이름 → 학생. 학번(20315) > 이름 > "3반 15번"/"3-15" 순으로 찾는다.
 * @param {string} fileName
 * @param {Array<{year?, cls, no, name}>} students
 * @return {number} students 의 위치, 못 찾으면 -1 (둘 이상이 맞으면 -1)
 */
function matchFileToStudent(fileName, students) {
  var f = String(fileName || '').replace(/\.[A-Za-z0-9]{2,5}$/, '');
  var hits = [];
  var push = function (i) { if (hits.indexOf(i) < 0) hits.push(i); };
  var sid = f.match(/(?:^|\D)(\d{5})(?:\D|$)/);
  if (sid) {
    var y = Number(sid[1].charAt(0)), c = Number(sid[1].slice(1, 3)), n = Number(sid[1].slice(3));
    students.forEach(function (st, i) {
      if (Number(st.cls) === c && Number(st.no) === n && (!st.year || Number(st.year) === y)) push(i);
    });
    if (hits.length === 1) return hits[0];
    hits = [];
  }
  students.forEach(function (st, i) {
    var nm = String(st.name || '').trim();
    if (nm.length >= 2 && f.indexOf(nm) >= 0) push(i);
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return -1;
  var cn = f.match(/(\d{1,2})\s*반\s*(\d{1,2})\s*번/) || f.match(/(?:^|\D)(\d{1,2})\s*-\s*(\d{1,2})(?:\D|$)/);
  if (cn) {
    students.forEach(function (st, i) { if (Number(st.cls) === Number(cn[1]) && Number(st.no) === Number(cn[2])) push(i); });
    if (hits.length === 1) return hits[0];
  }
  return -1;
}

/* ============================================================ 내 문체 */
var STYLE_SYSTEM =
  '# 역할\n당신은 학교생활기록부 문장의 문체를 분석하는 교사다.\n\n' +
  '# 할 일\n아래 [예전에 쓴 세특]들에서 "쓰는 방식"만 뽑아 문체 카드를 만든다. 학생·활동 내용은 옮기지 않는다.\n' +
  '다음을 각각 한 줄로: 한 편의 문장 수와 문장 길이, 첫 문장을 여는 방식, 내용을 펼치는 순서, 끝맺음 어미, 자주 쓰는 이음말, ' +
  '평가어를 쓰는 정도, 피하는 표현. 8줄 이내로, 줄마다 "- "로 시작한다. 다른 사람이 이 카드만 보고 같은 문체로 쓸 수 있게 구체적으로.\n\n' +
  '# 출력\n문체 카드만 출력한다.';

function buildStyleUser(samples) {
  return '# 예전에 쓴 세특\n' + samples.map(function (t, i) { return '## ' + (i + 1) + '\n' + String(t).trim(); }).join('\n\n');
}

/** 문체 카드를 학생 자료 바로 뒤에 한 번 더 — 글을 쓰기 직전에 본 것을 가장 잘 따르므로 */
function styleTail(card) {
  card = String(card || '').trim();
  return card ? '\n\n# 쓰기 직전 확인 — 내 문체 (예시·규칙과 함께 그대로 따른다)\n' + card : '';
}

/** 문장 나누기 — 마침표 기준(소수점 제외) */
function sentencesOf(text) {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[가-힣a-zA-Z)\]])\.(?:\s|$)/).map(function (x) { return x.trim(); }).filter(String);
}

/** 문체 지표: 문장 평균 길이, '~하였음'류 끝맺음 비율 */
function styleProfile(texts) {
  var lens = [], past = 0, total = 0;
  (texts || []).forEach(function (t) {
    sentencesOf(t).forEach(function (s) {
      lens.push(s.length);
      total++;
      if (/(였|었|았|했)음$|하였음$/.test(s)) past++;
    });
  });
  if (!total) return null;
  var avg = lens.reduce(function (a, b) { return a + b; }, 0) / total;
  return { avgLen: Math.round(avg), pastRatio: past / total, sentences: total, texts: (texts || []).length };
}

/**
 * 예시·내 문체와 견줘 많이 다르면 [확인] 한 줄. 기준 글이 2편 미만이면 보지 않는다.
 * @return {{level, label, hit, why}|null}
 */
function styleDrift(ref, text) {
  if (!ref || ref.texts < 2) return null;
  var p = styleProfile([text]);
  if (!p) return null;
  var why = [];
  if (ref.pastRatio >= 0.6 && p.pastRatio < 0.3) why.push("끝맺음: 예시는 '~하였음' 쪽인데 이 글은 '~함' 쪽");
  else if (ref.pastRatio <= 0.2 && p.pastRatio >= 0.6) why.push("끝맺음: 예시는 '~함' 쪽인데 이 글은 '~하였음' 쪽");
  var r = p.avgLen / Math.max(ref.avgLen, 1);
  if (r > 1.6 || r < 0.6) why.push('문장 길이: 예시 평균 ' + ref.avgLen + '자, 이 글 ' + p.avgLen + '자');
  return why.length ? { level: 'check', label: '문체', hit: why.join(' / '), why: '예시·내 문체와 많이 다릅니다. 같은 문체로 맞추려면 고쳐 쓰세요.' } : null;
}

/* ============================================================ 구글 설문지 */
/** 설문지 머리글 한 칸 → 'ts'·'email'·'sid'·'year'·'cls'·'no'·'name'·'' */
function formHeadKind(title) {
  var raw = String(title === null || title === undefined ? '' : title).trim();
  if (!raw) return '';
  if (/타임스탬프|timestamp/i.test(raw)) return 'ts';
  if (/이메일|e-?mail/i.test(raw)) return 'email';
  var t = raw.replace(/\(.*?\)|\[.*?\]/g, '').replace(/[?？:：*.!]/g, '').replace(/\s+/g, '')
             .replace(/(을|를|은|는)?(입력|적어|써|선택)(하세요|주세요|해주세요|해 주세요|주십시오|하시오).*$/, '')
             .replace(/(이|가)?(인가요|입니까|이에요|예요|이요)$/, '').replace(/^몇/, '');
  var k = typeof rosterHeadKind === 'function' ? rosterHeadKind(t) : '';
  return k === 'level' ? '' : k;
}

/** 설문지 응답 시트 머리글 해석 — 학생 칸과 문항 칸을 나눈다 */
function parseFormHeader(head) {
  var info = { ts: -1, email: -1, sid: -1, year: -1, cls: -1, no: -1, name: -1, questions: [] };
  (head || []).forEach(function (h, i) {
    var k = formHeadKind(h);
    if (k && info[k] === -1) { info[k] = i; return; }
    if (String(h || '').trim()) info.questions.push({ i: i, title: String(h).trim() });
  });
  info.ok = info.sid >= 0 || (info.cls >= 0 && info.no >= 0) || info.name >= 0;
  return info;
}

/** 응답 한 줄 → 학생 표시 {year, cls, no, name} */
function formStudentOf(row, info) {
  var st = { year: '', cls: '', no: '', name: '' };
  if (info.sid >= 0) {
    var p = typeof splitStudentId === 'function' ? splitStudentId(row[info.sid]) : null;
    if (p) { st.year = p[0]; st.cls = p[1]; st.no = p[2]; }
  }
  var num = function (v) { var m = String(v === null || v === undefined ? '' : v).match(/\d+/); return m ? Number(m[0]) : ''; };
  if (info.year >= 0 && row[info.year] !== '') st.year = num(row[info.year]);
  if (info.cls >= 0 && row[info.cls] !== '') st.cls = num(row[info.cls]);
  if (info.no >= 0 && row[info.no] !== '') st.no = num(row[info.no]);
  if (info.name >= 0) st.name = String(row[info.name] || '').trim();
  return st;
}

/** 같은 학생이 여러 번 내면 마지막 응답만 (응답 시트는 시간 순) */
function latestResponses(rows, info) {
  var byKey = {}, order = [];
  (rows || []).forEach(function (r) {
    var st = formStudentOf(r, info);
    var key = (st.cls !== '' && st.no !== '') ? (st.year || '') + '|' + st.cls + '|' + st.no : 'n|' + st.name;
    if (key === 'n|') return;
    if (!byKey[key]) order.push(key);
    byKey[key] = { st: st, row: r };
  });
  return order.map(function (k) { return byKey[k]; });
}

/**
 * 문항 → 보낼 칸 자동 연결. 이름이 같은 칸, 보고서 시트면 파일·"보고서" 문항 → [보고서].
 * @param {Array<{title, isFile?}>} questions
 * @param {string[]} targetCols  활동의 입력 항목
 * @param {string} mode  '보고서' | '바로쓰기' | ''
 * @return {Object<string,string>} 문항 제목 → 칸 이름 ('' 이면 보내지 않음)
 */
function autoMapQuestions(questions, targetCols, mode) {
  var map = {};
  var norm = function (s) { return String(s || '').replace(/\s+/g, '').replace(/[?？:：().]/g, ''); };
  (questions || []).forEach(function (q) {
    var hit = '';
    (targetCols || []).forEach(function (c) { if (!hit && norm(c) === norm(q.title)) hit = c; });
    if (!hit && mode === '보고서' && (q.isFile || /보고서|탐구|산출물|과제/.test(q.title))) hit = REPORT_COL;
    if (!hit && mode === '바로쓰기' && targetCols.length === 1) hit = targetCols[0];
    map[q.title] = hit;
  });
  return map;
}

/** 여러 문항이 한 칸으로 갈 때 "문항: 답" 으로 잇는다(한 문항뿐이면 답만) */
function joinAnswers(parts) {
  var filled = (parts || []).filter(function (p) { return String(p.value === null || p.value === undefined ? '' : p.value).trim() !== ''; });
  if (filled.length === 1) return String(filled[0].value).trim();
  return filled.map(function (p) { return p.title + ': ' + String(p.value).trim(); }).join('\n');
}

/** 짧은 지문 — 설문지에서 넣은 값을 선생님이 고쳤는지 알아보는 데 쓴다 */
function textHash(s) {
  s = String(s === null || s === undefined ? '' : s);
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
var FORM_NOTE_PREFIX = '📝 설문지에서 가져옴';
function formNote(hash, when) { return FORM_NOTE_PREFIX + ' ' + (when || '') + ' #' + hash; }
function noteHash(note) { var m = String(note || '').match(/#([0-9a-z]+)\s*$/); return m ? m[1] : ''; }

/** 이 칸을 설문지 값으로 바꿔도 되는지: 비었거나, 지난번 설문지 값 그대로(선생님이 안 고침)일 때 */
function formCellWritable(current, note) {
  var cur = String(current === null || current === undefined ? '' : current);
  if (!cur.trim()) return true;
  var h = noteHash(note);
  return !!h && String(note).indexOf(FORM_NOTE_PREFIX) === 0 && textHash(cur) === h;
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    REPORT_COLUMNS: REPORT_COLUMNS, REPORT_POINTS: REPORT_POINTS, EXTRACT_SYSTEM: EXTRACT_SYSTEM,
    buildExtractUser: buildExtractUser, cleanPoints: cleanPoints, driveIdsIn: driveIdsIn, driveFolderIdIn: driveFolderIdIn,
    textWithoutLinks: textWithoutLinks, xmlText: xmlText, fileKind: fileKind, matchFileToStudent: matchFileToStudent,
    STYLE_SYSTEM: STYLE_SYSTEM, buildStyleUser: buildStyleUser, styleTail: styleTail, sentencesOf: sentencesOf,
    styleProfile: styleProfile, styleDrift: styleDrift, formHeadKind: formHeadKind, parseFormHeader: parseFormHeader,
    formStudentOf: formStudentOf, latestResponses: latestResponses, autoMapQuestions: autoMapQuestions,
    joinAnswers: joinAnswers, textHash: textHash, formNote: formNote, noteHash: noteHash, formCellWritable: formCellWritable
  };
}


/* ==========================================================================
   19_Subjects.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 📚 새 교과 만들기 (순수 함수: 시트·네트워크 없음, Node 시험 가능)
 * ---------------------------------------------------------------
 * 교과 이름 + 교육과정 자료(성취기준·교과 역량을 붙여 넣거나 드라이브 PDF) → [📚 교과영역] 한 줄
 * (키·표시명·분류·역할 표현·역량·서술 관점)과 추천 입력 항목.
 *
 * 같은 "이름: 값" 글 모양 하나를 AI 답, 세특 프롬프트 공방(웹)에서 만든 교과, 선생님끼리 나누는 글에
 * 함께 쓴다 — 어느 쪽에서 만든 것이든 [📚 새 교과 만들기] 창의 붙여 넣기 칸에 넣으면 읽힌다.
 *
 * 자료 없이 만든 줄에는 [교육과정 확인 필요] 를 붙이게 하고, 저장 전에 교사에게 보여 준다
 * (AI 가 교과 역량 이름을 그럴듯하게 지어내는 일을 막으려고).
 */

var SUBJECT_UNSURE = '[교육과정 확인 필요]';
var SUBJECT_SOURCE_MAX = 30000;   // 붙여 넣은 교육과정 글은 이만큼만 보낸다(글자)

/** 답에서 알아듣는 이름들 → 필드 */
var SUBJECT_FIELDS = [
  { f: 'key', names: ['키'] },
  { f: 'name', names: ['표시명', '과목명', '교과명'] },
  { f: 'kind', names: ['분류'] },
  { f: 'role', names: ['역할 표현', '역할'] },
  { f: 'comps', names: ['핵심역량', '교과 역량', '역량'] },
  { f: 'look', names: ['관찰 모습', '관찰할 모습'] },
  { f: 'comp', names: ['역량·서술 관점', '역량 서술 관점', '서술 관점'] },
  { f: 'columns', names: ['입력 항목', '추천 입력 항목'] },
  { f: 'basis', names: ['근거', '출처'] }
];

var SUBJECT_SYSTEM = [
  '당신은 2022 개정 교육과정에 밝은 고등학교 교육과정 전문가입니다.',
  '교사가 학교생활기록부 과목별 세부능력 및 특기사항(세특)을 AI 로 쓸 때 프롬프트에 넣을 "교과 정보"를 만듭니다.',
  '',
  '# 지킬 것',
  '- 교사가 준 교육과정 자료(교과 역량·핵심 아이디어·성취기준)가 있으면 그 자료의 말로 쓴다. 자료에 없는 역량 이름을 지어내지 않는다.',
  '- 자료가 없거나 모자라면 일반적인 교과 지식으로 쓰되, 확실하지 않은 줄 끝에 ' + SUBJECT_UNSURE + ' 를 붙인다.',
  '- 관찰 모습은 교사가 수업·평가 장면에서 실제로 볼 수 있는 학생의 행동으로 4~6줄 쓴다. 각 줄은 "~하는 모습"으로 끝낸다.',
  '- 관찰 모습에는 결과보다 탐구 과정·사고의 전개·태도의 변화가 드러나게 한다.',
  '- 입력 항목은 교사가 학생마다 적을 칸 이름 3~5개. 짧은 명사구로 쓰고 | 로 나눈다. 반·번호·이름·성취수준·최종본은 쓰지 않는다.',
  '- 대학명·기관명·수상·자격증·공인어학시험처럼 학생부에 쓸 수 없는 것을 예로 들지 않는다.',
  '',
  '# 출력 — 아래 모양 그대로. 머리말·설명·마크다운 없이',
  '키: (짧은 이름, 띄어쓰기 없이. 예: 화학, 공통국어1, 인공지능기초)',
  '표시명: (교과·과목의 정식 이름)',
  '분류: 교과',
  '역할 표현: 고등학교 ○○교사',
  '핵심역량: (교과 역량 이름을 쉼표로)',
  '관찰 모습:',
  '- …하는 모습',
  '- …하는 모습',
  '입력 항목: 항목1|항목2|항목3',
  '근거: (무엇을 보고 썼는지 — 교사가 준 자료의 어느 부분 / 일반 지식)'
].join('\n');

/**
 * AI 에게 보낼 사용자 글
 * @param {{name:string, level?:string, source?:string, note?:string, files?:string[]}} p
 */
function buildSubjectUser(p) {
  p = p || {};
  var L = [];
  L.push('교과(과목) 이름: ' + String(p.name || '').trim());
  L.push('학교급: ' + (String(p.level || '').trim() || '고등학교'));
  if (p.note && String(p.note).trim()) L.push('우리 학교·수업에서 강조할 점: ' + String(p.note).trim().replace(/\s*\n\s*/g, ' '));
  var src = String(p.source || '').trim();
  var files = (p.files || []).filter(String);
  if (src || files.length) {
    L.push('');
    L.push('# 교육과정 자료 (교사가 준 것 — 이 자료의 말로 쓴다)');
    if (files.length) L.push('첨부 파일: ' + files.join(', '));
    if (src) L.push(src.length > SUBJECT_SOURCE_MAX ? src.slice(0, SUBJECT_SOURCE_MAX) + '\n…(뒤는 줄임)' : src);
  } else {
    L.push('');
    L.push('# 교육과정 자료');
    L.push('(없음 — 일반적인 교과 지식으로 쓰고, 확실하지 않은 줄 끝에 ' + SUBJECT_UNSURE + ' 를 붙인다)');
  }
  return L.join('\n');
}

/** 시트 이름·키에 못 쓰는 문자를 지우고 띄어쓰기를 없앤 짧은 키 */
function subjectKeyOf(raw) {
  return String(raw || '').replace(/\(.*?\)/g, '').replace(/[\[\]\*\/\\\?:'"\s]/g, '').trim().slice(0, 20);
}

/** "이름: 값" 줄이면 [필드, 값], 아니면 null */
function subjectFieldOf_(line) {
  var m = /^\s*(?:[-*•]\s*)?\**\s*([가-힣·\s]{1,12}?)\s*\**\s*[:：]\s*(.*)$/.exec(line);
  if (!m) return null;
  var label = m[1].replace(/\s+/g, ' ').trim();
  for (var i = 0; i < SUBJECT_FIELDS.length; i++) {
    if (SUBJECT_FIELDS[i].names.indexOf(label) >= 0) return [SUBJECT_FIELDS[i].f, m[2].trim()];
  }
  return null;
}

/**
 * AI 답(또는 공방·다른 선생님이 준 글) → 교과 한 줄
 * @return {{key,name,kind,role,comp,columns:string[],basis,unsure:boolean,missing:string[]}}
 */
function parseSubjectAnswer(text) {
  var t = String(text || '').replace(/\r/g, '').replace(/^\s*```[a-z]*\s*$/gim, '').replace(/\*\*/g, '');
  var got = {}, cur = null;
  t.split('\n').forEach(function (raw) {
    var line = raw.replace(/\s+$/, '');
    var fv = subjectFieldOf_(line);
    if (fv) { cur = fv[0]; got[cur] = got[cur] ? got[cur] + '\n' + fv[1] : fv[1]; return; }
    if (!line.trim() || /^\s*#/.test(line)) return;
    if (cur === 'look' || cur === 'comp' || cur === 'comps' || cur === 'basis') got[cur] = (got[cur] ? got[cur] + '\n' : '') + line.trim();
  });
  var name = String(got.name || '').trim();
  var key = subjectKeyOf(got.key || name);
  if (!name) name = key;
  var plain = name.replace(/\(.*?\)/g, '').trim() || key;
  var kind = /공통/.test(got.kind || '') ? '공통' : '교과';
  var role = String(got.role || '').trim() || ('고등학교 ' + plain + '교사');

  var comp = String(got.comp || '').trim();
  if (!comp) {
    var comps = String(got.comps || '').trim().replace(/\.$/, '');
    var look = String(got.look || '').split('\n').map(function (x) { return x.trim(); }).filter(String)
      .map(function (x) { return /^[-•·*]\s*/.test(x) ? '- ' + x.replace(/^[-•·*]\s*/, '') : '- ' + x; });
    var lines = [];
    if (comps) lines.push(plain + '과 핵심역량: ' + comps + '.');
    comp = lines.concat(look).join('\n');
  }

  var columns = String(got.columns || '').split(/[|,\n]/).map(function (x) { return x.trim(); })
    .filter(function (x) { return x && ['반', '번호', '이름', '성취수준', '최종본', 'AI 결과', '생성', '모델', '바이트', '검증'].indexOf(x) < 0; });
  var seen = {};
  columns = columns.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).slice(0, 8);

  var missing = [];
  if (!key) missing.push('키');
  if (!comp) missing.push('역량·관찰 모습');
  return {
    key: key, name: name, kind: kind, role: role, comp: comp, columns: columns,
    basis: String(got.basis || '').trim(),
    unsure: (comp + '\n' + (got.basis || '')).indexOf(SUBJECT_UNSURE) >= 0,
    missing: missing
  };
}

/** 교과 한 줄 → 나누는 글(공방·시트·다른 선생님 모두 이 모양을 읽는다) */
function formatSubjectBlock(sub) {
  sub = sub || {};
  var L = ['키: ' + (sub.key || ''), '표시명: ' + (sub.name || sub.key || ''), '분류: ' + (sub.kind || '교과'),
           '역할 표현: ' + (sub.role || ''), '역량·서술 관점:'];
  String(sub.comp || '').split('\n').forEach(function (x) { if (x.trim()) L.push(x); });
  var cols = Array.isArray(sub.columns) ? sub.columns : String(sub.columns || '').split('|');
  cols = cols.map(function (x) { return String(x).trim(); }).filter(String);
  if (cols.length) L.push('입력 항목: ' + cols.join('|'));
  if (sub.basis) L.push('근거: ' + String(sub.basis).replace(/\s*\n\s*/g, ' '));
  return L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUBJECT_SYSTEM: SUBJECT_SYSTEM, SUBJECT_UNSURE: SUBJECT_UNSURE, buildSubjectUser: buildSubjectUser,
    subjectKeyOf: subjectKeyOf, parseSubjectAnswer: parseSubjectAnswer, formatSubjectBlock: formatSubjectBlock
  };
}


/* ==========================================================================
   20_Lib.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 시트 접근 공통 라이브러리
 */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function ui_() { return SpreadsheetApp.getUi(); }
function toast_(msg, title) { try { ss_().toast(msg, title || APP.MENU, 6); } catch (e) {} }

/** 시트 가져오기(없으면 null) */
function sh_(name) { return ss_().getSheetByName(name); }

/** 시트 가져오기(없으면 생성) */
function shOrCreate_(name) {
  var s = sh_(name);
  if (!s) s = ss_().insertSheet(name);
  return s;
}

/** 시트 필수 — 없으면 안내 후 예외 */
function shRequire_(name) {
  var s = sh_(name);
  if (!s) throw new Error('[' + name + '] 시트가 없습니다. 메뉴 > 처음 설치/복구 를 실행하세요.');
  return s;
}

/** 표 읽기: headerRow 기준으로 [{헤더:값}] 배열 반환 */
function readTable_(sheet, headerRow) {
  headerRow = headerRow || 1;
  var last = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (last <= headerRow || lastCol === 0) return [];
  var values = sheet.getRange(headerRow, 1, last - headerRow + 1, lastCol).getValues();
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = {}, empty = true;
    for (var c = 0; c < head.length; c++) {
      if (!head[c]) continue;
      row[head[c]] = values[r][c];
      if (String(values[r][c]).trim() !== '') empty = false;
    }
    if (empty) continue;
    row.__row = headerRow + r;
    out.push(row);
  }
  return out;
}

/** 설정 시트에서 값 읽기 (A=키, B=값) */
function cfg_(key, dflt) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) return dflt;
  var v = s.getRange(1, 1, s.getLastRow(), 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) {
      var val = v[i][1];
      return (val === '' || val === null) ? dflt : val;
    }
  }
  return dflt;
}

function cfgBool_(key, dflt) {
  var v = cfg_(key, null);
  if (v === null) return dflt;
  return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '예';
}

/** 기록종류 목록 */
function getRecordTypes_() {
  var s = shRequire_(APP.SH.RECORD);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['키'] || '').trim(),
      name: String(r['기록 항목명'] || '').trim(),
      chars: Number(r['글자수'] || 500),
      useGrade: r['성취수준 사용'] === true || String(r['성취수준 사용']).toUpperCase() === 'TRUE',
      role: String(r['역할'] || ''),
      goal: String(r['목표'] || ''),
      view: String(r['서술 관점'] || ''),
      note: String(r['비고'] || ''),
      rules: String(r['기재 주의'] || '')
    };
  }).filter(function (r) { return r.key; });
}

/** 교과·영역 목록 */
function getSubjects_() {
  var s = shRequire_(APP.SH.SUBJECT);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['키'] || '').trim(),
      name: String(r['표시명'] || '').trim(),
      kind: String(r['분류'] || '').trim(),
      role: String(r['역할 표현'] || ''),
      comp: String(r['역량·서술 관점'] || '')
    };
  }).filter(function (r) { return r.key; });
}

/** 공통규칙 맵 */
function getCommon_() {
  var s = shRequire_(APP.SH.COMMON);
  var map = {};
  readTable_(s, 2).forEach(function (r) {
    var k = String(r['키'] || '').trim();
    if (k) map[k] = String(r['내용'] || '');
  });
  return map;
}

/** 활동 목록 */
function getActivities_() {
  var s = shRequire_(APP.SH.ACTIVITY);
  return readTable_(s, 2).map(function (r) {
    return {
      key: String(r['활동키'] || '').trim(),
      name: String(r['활동명'] || '').trim(),
      recordKey: String(r['기록종류'] || '').trim(),
      subjectKey: String(r['교과영역'] || '').trim(),
      bytes: Number(r['바이트 한도'] || 0) || (Number(r['글자수'] || 0) || 0) * 3,   // 예전 시트는 [글자수]
      columns: String(r['입력 항목'] || ''),
      desc: String(r['활동 개요'] || ''),
      mode: String(r['프롬프트 모드'] || '자동'),
      custom: String(r['직접 작성 프롬프트'] || ''),
      inSheet: String(r['입력 시트'] || '').trim(),
      exSheet: String(r['예시 시트'] || '').trim(),
      __row: r.__row
    };
  }).filter(function (a) { return a.key; });
}

function getActivity_(key) {
  var list = getActivities_();
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return null;
}

/** 활동 1건에 대한 완성 프롬프트 */
function promptFor_(act, examples) {
  var recs = getRecordTypes_(), subs = getSubjects_(), com = getCommon_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var sub = findByKey(subs, act.subjectKey) || findByKey(subs, '공통') || subs[0];
  var useStyle = styleOn_();
  if (!useStyle) com.STYLE_CARD = '';
  return buildPrompt({
    activity: act, record: rec, subject: sub, common: com,
    examples: examples === undefined ? readExamples_(act) : examples,
    styleSamples: useStyle ? readStyleSamples_() : '',
    years: Number(cfg_('교사 경력(년)', 15))
  });
}

/** [⚙️ 설정] 내 문체 적용 (없으면 켬) */
function styleOn_() { return cfgBool_('내 문체 적용', true); }

/** 학생 자료 바로 뒤에 붙일 문체 카드 (꺼 두었거나 카드가 없으면 '') */
function styleTail_() {
  if (!styleOn_()) return '';
  try { return styleTail(getCommon_().STYLE_CARD || ''); } catch (e) { return ''; }
}

/**
 * AI 에게 보낼 입력 항목 — 보고서 시트는 [보고서] 원문 대신 확인된 요점과 관찰 메모만 보낸다
 * (긴 원문이 예시를 덮지 않게).
 * @return {Array<{name:string, i:number}>}  i = 입력 항목 안에서의 위치
 */
function modelCols_(act) {
  var cols = parseColumns(act.columns);
  return cols.map(function (c, i) { return { name: c, i: i }; })
    .filter(function (x) { return !(act.mode === '보고서' && x.name === REPORT_COL); });
}

/** 한 학생의 입력값 → AI 에게 보낼 자료 한 덩어리 */
function blockFor_(act, values, grade) {
  var mc = modelCols_(act);
  return buildStudentBlock(mc.map(function (x) { return x.name; }),
    mc.map(function (x) { var v = values[x.i]; return x.name === POINTS_COL ? String(v || '').replace(/\s*\n\s*/g, ' / ') : v; }),
    { grade: grade });
}

/** 활동의 바이트 한도(활동값 > 기록종류 글자수×3). 기록종류 한도를 넘지 않는다 */
function bytesFor_(act) {
  return activityBytes(act, findByKey(getRecordTypes_(), act.recordKey));
}

/** 바이트 한도를 한글 글자 수로(안내 문구용) */
function charsFor_(act) { return Math.floor(bytesFor_(act) / 3); }

/** 예시 시트에서 채워진 예시들을 객체 배열로 읽기 */
function readExampleRows_(act) {
  var out = [];
  if (!act.exSheet) return out;
  var s = sh_(act.exSheet);
  if (!s) return out;
  var cols = parseColumns(act.columns);
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return out;
  var cResult = colOf_(s, APP.HEAD_ROW, '결과') || (1 + cols.length + 1);
  var vals = s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, cResult).getValues();
  for (var i = 0; i < vals.length; i++) {
    var result = String(vals[i][cResult - 1] || '').trim();
    if (!result) continue;
    var values = [];
    for (var c = 0; c < cols.length; c++) values.push(String(vals[i][1 + c] || '').trim());
    out.push({ row: APP.DATA_ROW + i, values: values, result: result });
  }
  return out;
}

/** 예시 시트에서 예시 합본(프롬프트용 문자열) 읽기 */
function readExamples_(act) {
  var mc = modelCols_(act);
  var rows = readExampleRows_(act);
  var cap = typeof EXAMPLE_MAX === 'number' ? EXAMPLE_MAX : 8;
  var out = [];
  for (var i = 0; i < rows.length && i < cap; i++) {
    var parts = [];
    for (var k = 0; k < mc.length; k++) {
      var v = rows[i].values[mc[k].i];
      if (v) parts.push(mc[k].name + ': ' + v.replace(/\s*\n\s*/g, mc[k].name === POINTS_COL ? ' / ' : ' '));
    }
    out.push('## 예시' + (i + 1) + ' 입력\n' + parts.join('\n') +
             '\n## 예시' + (i + 1) + ' 결과\n' + rows[i].result);
  }
  return out.join('\n\n');
}

/** 헤더 행에서 특정 헤더의 열 번호(1-based). 없으면 0 */
function colOf_(sheet, headerRow, name) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) return 0;
  var head = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < head.length; i++) {
    if (String(head[i]).trim() === name) return i + 1;
  }
  return 0;
}

/** 시트 보호 없이 서식만 입히는 헬퍼 */
function styleHeader_(sheet, row, lastCol, bg) {
  sheet.getRange(row, 1, 1, lastCol)
    .setBackground(bg || '#37474f').setFontColor('#ffffff')
    .setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(row, 40);
}

/**
 * 시트 머리말 규칙 — 구글 시트의 두 가지 제약을 피한다.
 *   1) 병합된 셀을 가르는 열 고정은 금지된다.
 *      → 왼쪽 열을 고정하는 시트는 splitBanner_ 로 [고정 구역]과 [나머지]를 따로 병합한다.
 *   2) 기존 병합과 일부만 겹치는 병합은 금지된다.
 *      → 병합하기 전에 그 행의 병합을 먼저 푼다(unmergeRow_).
 * v3.0.0 초판은 1번을 어겨서 [처음 설치]가 시트를 하나씩만 만들고 멈췄다.
 */
function unmergeRow_(sheet, row) {
  sheet.getRange(row, 1, 1, sheet.getMaxColumns()).breakApart();
}

function ensureCols_(sheet, n) {
  var max = sheet.getMaxColumns();
  if (max < n) sheet.insertColumnsAfter(max, n - max);
}

/** 1행 전체에 제목+안내문 (열 고정을 쓰지 않는 시트용) */
function banner_(sheet, lastCol, title, note) {
  var n = Math.max(lastCol, 1);
  ensureCols_(sheet, n);
  unmergeRow_(sheet, 1);
  var rng = sheet.getRange(1, 1, 1, n);
  rng.merge().setBackground('#eceff1').setWrap(true).setVerticalAlignment('middle');
  var text = note ? (title + '\n' + note) : title;
  var cell = sheet.getRange(1, 1);
  try {
    var rt = SpreadsheetApp.newRichTextValue().setText(text)
      .setTextStyle(0, title.length, SpreadsheetApp.newTextStyle()
        .setBold(true).setFontSize(13).setForegroundColor('#263238').build());
    if (note) {
      rt.setTextStyle(title.length, text.length, SpreadsheetApp.newTextStyle()
        .setBold(false).setFontSize(10).setForegroundColor('#546e7a').build());
    }
    cell.setRichTextValue(rt.build());
  } catch (e) {
    cell.setValue(text).setFontSize(11);    // 서식이 실패해도 설치는 계속된다
  }
  sheet.setRowHeight(1, note ? 62 : 34);
}

/**
 * 왼쪽 열을 고정하는 시트용 1행 머리말.
 * [A~고정열] 에 제목, [그다음~끝] 에 안내문을 각각 병합한다. 고정 경계를 가르지 않는다.
 */
function splitBanner_(sheet, frozenCols, lastCol, title, note) {
  ensureCols_(sheet, lastCol);
  unmergeRow_(sheet, 1);
  sheet.getRange(1, 1, 1, frozenCols).merge()
    .setValue(title).setBackground('#dfe8e0').setFontColor('#1b3a2a')
    .setFontWeight('bold').setFontSize(12).setWrap(true).setVerticalAlignment('middle');
  if (lastCol > frozenCols) {
    sheet.getRange(1, frozenCols + 1, 1, lastCol - frozenCols).merge()
      .setValue(note).setBackground('#eceff1').setFontSize(10)
      .setWrap(true).setVerticalAlignment('middle');
  }
  sheet.setRowHeight(1, 62);
}

function noteRow_(sheet, row, lastCol, text) {
  var n = Math.max(lastCol, 1);
  ensureCols_(sheet, n);
  unmergeRow_(sheet, row);
  var r = sheet.getRange(row, 1, 1, n);
  r.merge().setValue(text).setBackground('#eceff1').setFontSize(10)
    .setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(row, 46);
}

/** 학생 이름 마스킹 여부 */
function maskName_() { return cfgBool_('학생 이름 마스킹', true); }


/* ==========================================================================
   30_Setup.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 메뉴 · 초기 설치
 */

function onOpen() {
  var ui = ui_();
  // 화면이 작은 노트북에서도 메뉴가 아래로 잘리지 않게, 자주 쓰는 것만 맨 위에 두고 나머지는 하위 메뉴로 묶는다.
  // 항목 이름의 ①~⑧ 번호는 안내문·오류 메시지가 가리키는 이름이라 그대로 둔다.
  var m = ui.createMenu(APP.MENU);
  m.addItem('🚀 시작하기 (처음이면 여기)', 'openOnboard');
  m.addItem('✍️ 바로 쓰기 · 📄 보고서 시트 추가', 'openQuickSheetDialog');
  m.addItem('📝 구글 설문지 연결 (응답 → 시트, 파일 업로드 포함)', 'openFormDialog');
  m.addItem('🔍 맞춤법 · 금지어 검사', 'openCheckSidebar');
  m.addSeparator();
  m.addItem('⑥ 체크된 행 생성', 'generateChecked');
  m.addItem('⑦ 최종취합 시트 생성/갱신', 'buildCompile');
  m.addSeparator();
  m.addSubMenu(ui.createMenu('①②③ 준비 — 설치 · AI 연결 · 학생 명단')
    .addItem('① 처음 설치 / 구조 복구', 'installAll')
    .addItem('② AI 연결 · 모델 설정', 'openApiDialog')
    .addItem('   모델 연결 테스트', 'testAllModels')
    .addItem('③ 학생 명단 불러오기 (엑셀·붙여넣기)', 'openRosterDialog')
    .addItem('   학생 명단 동기화', 'syncRoster'));
  m.addSubMenu(ui.createMenu('④⑤ 활동 · 예시 · 보고서')
    .addItem('④ 활동 만들기 · 입력 항목 바꾸기 ★', 'openWizard')
    .addItem('📚 새 교과 만들기 (교과 역량 · 입력 항목 초안)', 'openSubjectDialog')
    .addItem('📏 활동별 바이트 한도 (한 칸을 여러 활동이 나눌 때)', 'openBytesDialog')
    .addItem('🧪 세특 프롬프트 공방 (설계하며 프롬프트 보기 · 복사)', 'openStudio')
    .addItem('   활동 직접 추가 (질문에 답하기)', 'addActivityDialog')
    .addItem('   활동 복제', 'duplicateActivityDialog')
    .addItem('   활동 삭제', 'deleteActivityDialog')
    .addSeparator()
    .addItem('⑤ 예시 더 만들기 (AI)', 'generateMoreExamples')
    .addItem('   예시 칸 늘리기', 'addExampleRows')
    .addItem('   예시 검증', 'validateExamples')
    .addItem('⭐ 선택한 학생 글을 예시로 등록', 'promoteToExample')
    .addSeparator()
    .addItem('📄 보고서 요점 뽑기 (선택한 행)', 'extractReportPoints')
    .addItem('   보고서 폴더에서 파일 가져오기 (파일 이름으로 학생 찾기)', 'importReportFolder'));
  m.addSubMenu(ui.createMenu('⑥ 생성 더 보기')
    .addItem('📋 키 없이 — 프롬프트 복사 · 답 붙여넣기 (체크된 행)', 'openManualForChecked')
    .addItem('   선택한 행만 생성', 'generateSelection')
    .addItem('   자동 생성(체크 즉시) 켜기', 'enableAutoTrigger')
    .addItem('   자동 생성 끄기', 'disableAutoTrigger')
    .addSeparator()
    .addItem('⑦ 최종 압축본 생성 (체크된 행)', 'compileChecked'));
  m.addSubMenu(ui.createMenu('⑧ 점검 · 기재요령 2026')
    .addItem('🔍 맞춤법 · 금지어 검사', 'openCheckSidebar')
    .addItem('   근거 확인 — AI 결과가 학생 자료에 있는 내용인지 (선택한 행)', 'groundCheckSelection')
    .addItem('   결과 전체 재검증', 'revalidateAll')
    .addItem('⑧ 프롬프트 미리보기', 'previewPrompt')
    .addItem('   AI 앱용 지침 내보내기 (Gemini Gem · Claude 스킬)', 'openExportDialog')
    .addSeparator()
    .addItem('✒️ 내 문체 카드 만들기', 'openStyleDialog')
    .addItem('   ✒️ 내 문체 시트 열기 (예전 세특 붙여 넣기)', 'openStyleSheet')
    .addSeparator()
    .addItem('📏 기재요령 규칙 보기 · 고치기', 'openRulesSheet')
    .addItem('   기재요령 규칙 업데이트 확인', 'checkRulesUpdate'));
  m.addSubMenu(ui.createMenu('도움말 · 부가 기능')
    .addItem('📄 스캔 문서 → 엑셀 사용 설명서 (업무 대시보드)', 'openOcrGuide')
    .addItem('📖 사용법 시트 열기', 'openHelpSheet')
    .addSeparator()
    .addItem('구글 설문지 응답 지금 받아 오기 (연결해 둔 것 모두)', 'syncFormResponses')
    .addItem('수업관찰 기록 열기', 'openObserve')
    .addItem('수업관찰 웹앱 배포 안내', 'observeDeployHelp')
    .addItem('예시 시트 구조 복구', 'repairExampleSheet')
    .addItem('사용법 시트 갱신', 'buildHelp')
    .addItem('시작하기 시트 다시 만들기 (버튼 포함)', 'rebuildStart')
    .addItem('시작하기 안내 다시 켜기', 'onboardReset')
    .addItem('버전 정보', 'showVersion'));
  m.addToUi();

  // 아직 설정을 끝내지 않은 사본이면 [🚀 시작하기] 탭을 열어 준다.
  // 단순 트리거라 권한 승인 전에도 여기까지는 동작한다.
  try {
    if (needsOnboarding_()) {
      var st = sh_(APP.SH.START);
      if (st) ss_().setActiveSheet(st);
      ss_().toast('메뉴 [' + APP.MENU + '] > [🚀 시작하기] 를 눌러 시작하세요.', APP.MENU, 10);
    }
  } catch (e) {}
}

function showVersion() {
  var info = { id: '', year: '' };
  try { info = currentPackInfo_(); } catch (e) {}
  ui_().alert(APP.MENU, '세특 작성 도우미 ' + APP.VERSION + '\n\n프롬프트 조립형 구조.\n교과·창체·행발을 한 틀로 지원합니다.' +
    (info.id ? '\n\n기재요령 규칙판: ' + info.id + ' (' + info.year + '학년도)' : ''), ui_().ButtonSet.OK);
}

/** 메뉴: [📖 사용법] 시트로 */
function openHelpSheet() {
  var s = sh_(APP.SH.HELP) || (buildHelp(), sh_(APP.SH.HELP));
  if (s) ss_().setActiveSheet(s);
}

/** 메뉴: [🚀 시작하기] 시트를 버튼까지 새로 만든다 */
function rebuildStart() {
  var s = buildStart();
  ss_().setActiveSheet(s);
  toast_('시작하기 시트를 새로 만들었습니다.');
}

/** 전체 설치 (여러 번 실행해도 안전 — 기존 데이터는 보존) */
function installAll() {
  try {
    installCore_();
  } catch (e) {
    ui_().alert(APP.MENU, e.message, ui_().ButtonSet.OK);
    return;
  }
  toast_('설치/복구 완료.', APP.MENU);
  ui_().alert(APP.MENU,
    '구조 설치가 끝났습니다.\n\n이어서 [🚀 시작하기]를 누르면 나머지를 단계별로 안내합니다.',
    ui_().ButtonSet.OK);
}

/**
 * 알림 없이 시트 구조만 만든다 (온보딩 팝업에서도 호출).
 * 단계마다 따로 실행해서, 하나가 실패해도 나머지는 끝까지 만든다.
 * 실패한 단계가 있으면 마지막에 모아서 알린다.
 */
function installCore_() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('다른 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  var steps = [
    ['🚀 시작하기', buildStart], ['⚙️ 설정', buildConfig], ['🧩 기록종류', buildRecordTypes],
    ['📚 교과영역', buildSubjects], ['📐 공통규칙', buildCommonRules], ['📏 기재요령', buildRulesSheet],
    ['2026 기재요령 반영', migrateRules_], ['✒️ 내 문체', buildStyleSheet], ['내 문체 카드 칸', ensureStyleCardRow_],
    ['🗂 활동목록', buildActivityList],
    ['👤 학생명단', buildRoster], ['✅ 검토', buildReview], ['📖 사용법', buildHelp],
    ['시트 순서 정리', orderSheets_]
  ];
  var failed = [];
  try {
    steps.forEach(function (st) {
      try { st[1](); } catch (e) { failed.push('· ' + st[0] + ' — ' + e.message); }
    });
  } finally { lock.releaseLock(); }
  if (failed.length) {
    throw new Error('설치 중 일부를 만들지 못했습니다.\n\n' + failed.join('\n') +
      '\n\n나머지는 모두 만들었습니다. 이 창을 캡처해 제작자에게 보내 주세요.');
  }
}

function orderSheets_() {
  var order = [APP.SH.START, APP.SH.HELP, APP.SH.CONFIG, APP.SH.ROSTER, APP.SH.ACTIVITY,
               APP.SH.RECORD, APP.SH.SUBJECT, APP.SH.COMMON, APP.SH.RULES, APP.SH.STYLE];
  var i = 1;
  order.forEach(function (n) {
    var s = sh_(n);
    if (s) { ss_().setActiveSheet(s); ss_().moveActiveSheet(i++); }
  });
  var h = sh_(APP.SH.START) || sh_(APP.SH.HELP);
  if (h) ss_().setActiveSheet(h);
}

/* ---------------------------------------------------------------- 설정 */
/**
 * [⚙️ 설정] 시트
 *   1~3행   머리말 · 안내 · 헤더
 *   4행~    항목 | 값 | 설명
 *   그 아래 🤖 모델 목록 표 (모델명 | 회사 | 수준 | 언제 쓰나 | 연결 확인)
 * 다시 실행해도 선생님이 바꾼 값과 모델 목록은 그대로 둔다.
 */
function buildConfig() {
  var s = shOrCreate_(APP.SH.CONFIG);
  var existing = {}, oldModels = null;
  var last = s.getLastRow();
  var tHead = modelTableRow_(s);
  if (last >= 4) {
    var endSet = tHead ? tHead - 1 : last;
    if (endSet >= 4) {
      s.getRange(4, 1, endSet - 3, 2).getValues().forEach(function (r) {
        var k = String(r[0]).trim();
        if (k && !existing.hasOwnProperty(k)) existing[k] = r[1];
      });
    }
  }
  if (tHead) oldModels = readModelRowsAt_(s, tHead);

  // v3.0.x → v3.1: 손대지 않은 옛 기본 모델은 새 기본값으로, [추가 모델]은 모델 목록으로 옮긴다
  Object.keys(OLD_DEFAULT_MODELS).forEach(function (k) {
    if (normModel(existing[k]) === OLD_DEFAULT_MODELS[k]) delete existing[k];
  });
  var extra = String(existing['추가 모델'] || '').split(',').map(normModel).filter(String);

  s.clear();
  s.getRange(1, 1, s.getMaxRows(), s.getMaxColumns()).breakApart().clearDataValidations();
  s.getRange('A1').setValue('⚙️ 설정  —  ' + APP.VERSION)
    .setFontSize(14).setFontWeight('bold');
  noteRow_(s, 2, MODEL_HEAD.length, 'API 키는 이 시트에 저장되지 않습니다. 메뉴 > ② AI 연결 · 모델 설정 에서 입력하며, 사용자 계정별로 따로 보관되어 사본을 공유해도 남에게 넘어가지 않습니다.');
  s.getRange(3, 1, 1, 3).setValues([['항목', '값', '설명']]);
  styleHeader_(s, 3, 3);

  var rows = [
    ['교사 경력(년)', 15, '프롬프트의 역할 문장에 쓰입니다. 숫자만.'],
    ['기본 교과영역', '수학', '새 활동을 만들 때 기본으로 선택되는 교과. [📚 교과영역] 시트의 키.'],
    ['활동용 모델', DEFAULT_MODEL, '활동별 세특 생성에 쓰는 모델. 아래 모델 목록에서 고르거나 직접 적으세요. Flash급이면 충분합니다.'],
    ['합본용 모델', DEFAULT_MODEL, '여러 활동을 한 편으로 압축할 때 쓰는 모델. 대개 활동용과 같아도 되고, 글자수를 잘 못 맞추면 한 단계 위 모델로.'],
    ['학생 이름 마스킹', true, 'TRUE면 학생 이름을 AI에 보내지 않습니다. 개인정보 보호 권장값.'],
    ['결과 자동검증', true, 'TRUE면 생성 직후 기재 금지사항·분량·어미를 자동 점검합니다.'],
    ['1회 최대 생성 건수', 25, '한 번에 처리할 최대 학생 수. 실행 시간(약 6분) 제한 때문에 넘치면 나눠서 처리합니다.'],
    ['예비 모델', '', '활동용·합본용 모델이 한도 초과·서버 오류 등으로 실패하면 이 모델로 한 번 더 시도합니다. 다른 회사 모델을 적어 두면 좋습니다(예: gpt-5.6-luna). 비우면 쓰지 않습니다.'],
    ['생각 줄이기', true, 'TRUE면 모델의 생각(추론) 단계를 줄여 더 빠르고 싸게 씁니다. 생각 토큰은 출력 요금으로 청구됩니다. 세특 품질에는 거의 영향이 없습니다.'],
    ['한 번에 묶을 학생 수', 5, '여러 학생을 한 번의 호출로 생성합니다. 규칙 부분을 한 번만 보내 비용과 호출 횟수가 줄어듭니다. 1이면 한 명씩(가장 꼼꼼, 가장 비쌈). 최대 10.'],
    ['자동 고쳐쓰기', true, 'TRUE면 생성 직후 검사에서 [수정]이 나온 학생만 걸린 점을 짚어 한 번 더 고쳐 쓰게 합니다(분량 초과·기재 금지어·어미). 그 학생만 호출이 한 번 늘어납니다.'],
    ['근거 자동 확인', false, 'TRUE면 생성할 때마다 AI 결과가 학생 자료에 있는 내용인지 한 번 더 확인합니다(호출이 학생마다 한 번 늘어남). FALSE여도 메뉴 ⑧ [근거 확인]으로 골라서 할 수 있습니다.'],
    ['내 문체 적용', true, 'TRUE면 [✒️ 내 문체] 시트의 예전 세특(앞 3편)과 [📐 공통규칙]의 내 문체 카드를 모든 생성에 함께 보냅니다. 카드는 학생 자료 바로 뒤에도 한 번 더 붙어 몇 번째 학생이든 같은 문체로 씁니다.']
  ];
  rows.forEach(function (r) { if (existing.hasOwnProperty(r[0])) r[1] = existing[r[0]]; });
  s.getRange(4, 1, rows.length, 3).setValues(rows);
  s.getRange(4, 1, rows.length, 1).setFontWeight('bold');
  s.getRange(4, 2, rows.length, 1).setBackground(APP.COLORS.input);
  s.getRange(4, 3, rows.length, 1).setFontColor('#666666').setWrap(true);

  // 🤖 모델 목록
  var note = 4 + rows.length + 1;
  var head = note + 1;
  noteRow_(s, note, MODEL_HEAD.length,
    '🤖 모델 목록 — 여기 적힌 이름이 모든 [모델] 드롭다운의 선택지가 됩니다. 새 이름을 직접 적어도 되고, ' +
    '메뉴 ② [AI 연결 · 모델 설정]에서 한 줄씩 연결 테스트를 하면 [연결 확인] 칸에 ✓/✗ 가 남습니다. ' +
    '최신 이름: Gemini ' + MODEL_LINKS.gemini + ' · OpenAI ' + MODEL_LINKS.openai + ' · Claude ' + MODEL_LINKS.anthropic);
  s.setRowHeight(note, 62);
  var models = (oldModels && oldModels.length) ? oldModels : presetModelRows_();
  extra.forEach(function (m) {
    if (!models.some(function (r) { return r.model === m; })) models.push({ model: m, company: '자동', level: '', memo: '직접 추가', status: '' });
  });
  writeModelTable_(s, head, models);
  applyConfigModelDropdown_();

  // 폭: A 항목/모델명 · B 값/수준 · C 설명/언제 쓰나(넓게) · D 회사 · E 연결 확인
  s.setColumnWidth(1, 190); s.setColumnWidth(2, 190); s.setColumnWidth(3, 460);
  s.setColumnWidth(4, 90); s.setColumnWidth(5, 230);
  s.setFrozenRows(3);
}

/* ------------------------------------------------------------ 기록종류 */
var RECORD_BANNER_TITLE = '🧩 기록종류 — 항목별 기본 규칙';
var RECORD_BANNER_NOTE =
  '⚠️ 글자수는 학년도마다 바뀝니다(2026학년도: 진로활동 700→500자, 행동특성 및 종합의견 500→300자, 2022 개정 공통과목 세특은 1·2 합산 500자). ' +
  '숫자 하나만 고치면 프롬프트·검증·압축에 모두 반영됩니다. [기재 주의]는 그 기록 항목의 프롬프트에만 붙는 2026 기재요령 주의점으로, ' +
  '새 학년도 규칙판이 나오면 손대지 않은 칸만 저절로 바뀝니다(메뉴 ⑧ 기재요령 규칙 업데이트 확인).';

function buildRecordTypes() {
  var s = shOrCreate_(APP.SH.RECORD);
  if (s.getLastRow() > 2) return;   // 이미 있으면 보존 ([기재 주의] 칸은 migrateRules_ 가 채운다)
  s.clear();
  var head = ['키', '기록 항목명', '글자수', '성취수준 사용', '역할', '목표', '서술 관점', '비고', '기재 주의'];
  banner_(s, head.length, RECORD_BANNER_TITLE, RECORD_BANNER_NOTE);
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_RECORD_TYPES.map(function (r) {
    var caution = RECORD_RULES_2026.hasOwnProperty(r.key) ? RECORD_RULES_2026[r.key] : '';
    return [r.key, r.name, r.chars, r.useGrade, r.role, r.goal, r.view, r.note, caution];
  });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 4, rows.length, 1).insertCheckboxes();
  s.getRange(3, 1, rows.length, head.length).setWrap(true).setVerticalAlignment('top');
  [90, 220, 80, 110, 260, 320, 380, 220, 380].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 교과영역 */
function buildSubjects() {
  var s = shOrCreate_(APP.SH.SUBJECT);
  if (s.getLastRow() > 2) return;
  s.clear();
  var head = ['키', '표시명', '분류', '역할 표현', '역량·서술 관점'];
  banner_(s, head.length, '📚 교과영역 — 교과별 역량과 관점',
    '새 교과는 맨 아래에 한 줄 추가하면 됩니다. 키는 짧고 유일하게(예: 화학, 지구과학). ' +
    '분류가 "교과"면 역할 문장에 교과명이 들어가고, "공통"이면 창체·행발용 일반 역량이 쓰입니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_SUBJECTS.map(function (r) { return [r.key, r.name, r.kind, r.role, r.comp]; });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 1, rows.length, head.length).setWrap(true).setVerticalAlignment('top');
  s.getRange(3, 3, 200, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['교과', '공통'], true).build());
  [110, 220, 80, 200, 620].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 공통규칙 */
function buildCommonRules() {
  var s = shOrCreate_(APP.SH.COMMON);
  if (s.getLastRow() > 2) return;
  s.clear();
  var head = ['키', '제목', '내용'];
  banner_(s, head.length, '📐 공통규칙 — 모든 기록에 공통 적용',
    'A열(키)은 코드가 찾는 이름이라 수정하면 안 됩니다. C열(내용)만 고치세요. ' +
    '예: 우리 학교는 "~하였음" 어미를 쓴다 → WRITING_RULES 내용을 그렇게 바꾸면 모든 활동에 즉시 반영됩니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_COMMON.map(function (r) { return [r.key, r.title, r.body]; });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 1, rows.length, 2).setBackground(APP.COLORS.lock);
  s.getRange(3, 3, rows.length, 1).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
  s.setColumnWidth(1, 160); s.setColumnWidth(2, 180); s.setColumnWidth(3, 800);
  s.setFrozenRows(2);
}

/* ------------------------------------------------------------ 활동목록 */
var ACTIVITY_BANNER = ['🗂 활동목록 — 세특을 만들 활동의 정의',
  '직접 채우는 칸은 [활동명·기록종류·교과영역·입력 항목·활동 개요] 다섯 개뿐입니다. 프롬프트 본문은 엔진이 조립합니다. ' +
  '[바이트 한도]를 비우면 기록종류 글자수×3(나이스 한 칸 전체)이 쓰입니다. 한 기록 항목을 여러 활동이 나눠 쓰면 메뉴 [📏 활동별 바이트 한도]에서 나누세요. ' +
  '통째로 직접 쓰려면 [프롬프트 모드]를 "직접작성"으로 바꾸고 I열에 작성하세요. 새 활동은 메뉴 ④ 마법사로 만드는 것을 권장합니다.'];
var BYTES_NOTE = '나이스 바이트(한글 3, 영문·숫자·공백 1, 줄바꿈 2). 비우면 기록종류 글자수×3. ' +
  '기록종류 한도보다 크게 적어도 기록종류 한도까지만 씁니다.';

function buildActivityList() {
  var s = shOrCreate_(APP.SH.ACTIVITY);
  if (s.getLastRow() > 2) { migrateActivityBytes_(); refreshActivityValidation_(); return; }
  s.clear();
  var head = ['활동키', '활동명', '기록종류', '교과영역', '바이트 한도', '입력 항목',
              '활동 개요', '프롬프트 모드', '직접 작성 프롬프트', '입력 시트', '예시 시트'];
  banner_(s, head.length, ACTIVITY_BANNER[0], ACTIVITY_BANNER[1]);
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  s.getRange(2, 5).setNote(BYTES_NOTE);
  [110, 200, 100, 110, 80, 320, 340, 120, 300, 150, 150]
    .forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
  s.getRange(3, 1, 300, head.length).setWrap(true).setVerticalAlignment('top');
  refreshActivityValidation_();
}

/**
 * v3.8 이전 [🗂 활동목록]의 [글자수] → [바이트 한도](값 ×3). 바꿨으면 true.
 * 읽을 때는 두 머리글을 다 알아듣지만(getActivities_), 새 활동을 적기 전에 꼭 바꿔 둔다(createActivity_).
 */
function migrateActivityBytes_() {
  var s = sh_(APP.SH.ACTIVITY);
  if (!s || s.getLastRow() < 2) return false;
  var c = colOf_(s, 2, '글자수');
  if (!c) return false;
  var n = s.getLastRow() - 2;
  if (n > 0) {
    var rg = s.getRange(3, c, n, 1);
    rg.setValues(rg.getValues().map(function (x) { var k = Number(x[0]); return [k > 0 ? k * 3 : x[0]]; }));
  }
  s.getRange(2, c).setValue('바이트 한도').setNote(BYTES_NOTE);
  try { banner_(s, Math.max(s.getLastColumn(), 11), ACTIVITY_BANNER[0], ACTIVITY_BANNER[1]); } catch (e) {}
  return true;
}

/** 활동목록의 드롭다운을 현재 기록종류/교과영역으로 갱신 */
function refreshActivityValidation_() {
  var s = sh_(APP.SH.ACTIVITY);
  if (!s) return;
  var recKeys = getRecordTypes_().map(function (r) { return r.key; });
  var subKeys = getSubjects_().map(function (r) { return r.key; });
  var n = 300;
  if (recKeys.length) s.getRange(3, 3, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(recKeys, true).build());
  if (subKeys.length) s.getRange(3, 4, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(subKeys, true).build());
  s.getRange(3, 8, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['자동', '직접작성', '바로쓰기', '보고서'], true).build());
}

/* -------------------------------------------------------------- 학생명단 */
function buildRoster() {
  var s = shOrCreate_(APP.SH.ROSTER);
  if (s.getLastRow() > 2) return;          // 이미 명단이 있으면 보존
  writeRosterSheet_([], rosterMode_());    // 머리글 방식(반·번호 / 학년·반·번호)은 그대로 둔다
}

/* ---------------------------------------------------------------- 검토 */
function buildReview() {
  var s = shOrCreate_(APP.SH.REVIEW);
  s.clear();
  s.getRange('A1').setValue('✅ 검토  —  반·번호·기록종류를 고르면 그 학생의 최종본을 불러옵니다. 나이스 입력 전 확인용.')
    .setFontSize(13).setFontWeight('bold');
  s.getRange(3, 1, 1, 5).setValues([['반', '번호', '기록종류', '이름', '최종본 (자동)']]);
  s.getRange(3, 1).setValue(classHead_());
  styleHeader_(s, 3, 5);
  s.getRange('A4:C4').setBackground(APP.COLORS.input);
  s.getRange('A4').setNumberFormat('@');   // "2-3"(학년-반)이 날짜로 바뀌지 않게

  var recKeys = getRecordTypes_().map(function (r) { return r.key; });
  if (recKeys.length) {
    s.getRange('C4').setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(recKeys, true).build());
    s.getRange('C4').setValue(recKeys[0]);
  }

  var pre = APP.SH.COMPILE_PREFIX;
  var ind = function (suffix) { return 'INDIRECT("\'" & "' + pre + '" & $C$4 & "\'!' + suffix + '")'; };
  var pick = function (headerName) {
    return '=IFERROR(INDEX(FILTER(' + ind('$A:$BZ') + ', ' + ind('$A:$A') + '=$A$4, ' + ind('$B:$B') + '=$B$4), 1, ' +
           'MATCH("' + headerName + '", ' + ind('$3:$3') + ', 0)), "")';
  };
  s.getRange('D4').setFormula(pick('이름'));
  s.getRange('E4').setFormula(pick('최종본'));

  s.getRange('A6').setValue('▼ 아래 칸에서 고쳐 쓴 뒤, 값만 복사해 최종취합 시트의 [최종본] 칸에 붙여넣으세요.')
    .setFontColor('#555555').setFontWeight('bold');
  s.getRange('A7:D7').merge().setBackground(APP.COLORS.paste).setWrap(true).setVerticalAlignment('top');
  s.getRange('E7').setFormula('=IF($A$7="","",saeteukBytes($A$7)&"바이트")');
  s.getRange('A9').setValue('▼ 위 칸에 쓴 글의 자동 검사 (기재 금지어 · 어미 · 맞춤법 — [📏 기재요령] 시트의 규칙). 더 자세히는 메뉴 [🔍 맞춤법 · 금지어 검사]')
    .setFontColor('#555555').setFontWeight('bold');
  s.getRange('A10:E10').merge().setWrap(true).setVerticalAlignment('top').setFontSize(10).setBackground('#fafafa');
  s.getRange('A10').setFormula('=IF($A$7="","",SAETEUK_CHECK($A$7, IFERROR(VLOOKUP($C$4, ' +
    "'" + APP.SH.RECORD + "'!$A$3:$C, 3, FALSE), 500)))");
  s.setRowHeight(10, 90);
  s.getRange('A12').setValue('⚠️ ' + AI_NOTICE_2026).setWrap(true).setFontColor('#7f1d1d').setFontSize(10);
  s.getRange('A12:E12').merge();
  s.setRowHeight(12, 54);
  s.setColumnWidth(1, 70); s.setColumnWidth(2, 70); s.setColumnWidth(3, 110);
  s.setColumnWidth(4, 110); s.setColumnWidth(5, 620);
  s.getRange('E4').setWrap(true).setVerticalAlignment('top');
  s.setRowHeight(4, 130); s.setRowHeight(7, 160);
}

/** 사용자 정의 함수: 바이트 수 */
function saeteukBytes(text) {
  if (text === null || text === undefined) return 0;
  if (Array.isArray(text)) return text.map(function (r) { return r.map(function (c) { return byteLen(c); }); });
  return byteLen(text);
}


/* ==========================================================================
   32_Onboard.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 시작하기 (온보딩)
 *
 * 배포 방식: 제작자가 마스터 사본을 한 번 만들어 두고, 공유 링크 끝의
 * /edit 를 /copy 로 바꿔 나눠 줍니다. 받는 사람은 [사본 만들기] 한 번이면
 * 코드까지 통째로 복사됩니다. 그 사본에서 처음 열었을 때 길을 잃지 않도록
 * 하는 것이 이 파일의 역할입니다.
 */

var ONBOARD_KEY = 'ONBOARD_DONE';

/**
 * onOpen 은 단순 트리거라 권한 승인 전에도 실행된다.
 * 그때는 PropertiesService 를 쓸 수 없으므로(승인 필요) 시트만 보고 판단한다.
 * 사본을 막 받은 사람에게 안내가 안 뜨는 일이 없어야 한다.
 */
function needsOnboarding_() {
  var r = sh_(APP.SH.ROSTER);
  if (!r) return true;                 // 아직 설치 전
  return r.getLastRow() < APP.DATA_ROW - 1;   // 학생 명단이 비어 있으면 아직 준비 전
}

/** 팝업 내부에서만 쓰는 완료 표시 (승인 이후에 호출된다) */
function isOnboardDone_() {
  try {
    return PropertiesService.getDocumentProperties().getProperty(ONBOARD_KEY) === '1';
  } catch (e) { return false; }
}

function openOnboard() {
  try { if (sh_(APP.SH.RULES)) autoRulesCheck_(); } catch (e) {}
  var html = HtmlService.createHtmlOutputFromFile('UI_Onboard')
    .setWidth(660).setHeight(720);
  ui_().showModelessDialog(html, '시작하기 — ' + APP.MENU);
}

/* ---------------------------------------------------------- 현재 상태 */
/**
 * 각 단계가 끝났는지를 "결과물이 실제로 있는지"로 판단한다.
 * 진행 상황을 따로 저장하지 않으므로, 중간에 창을 닫거나 나중에 다시 열어도
 * 항상 지금 상태에서 이어진다.
 */
function onboardStatus() {
  var st = {
    installed: false, hasKey: false, keyNames: [],
    rosterCount: 0, activities: [], exampleCount: 0, done: isOnboardDone_(),
    models: [], defaultModel: '', compileModel: '',
    providerDefaults: PROVIDER_DEFAULT_MODEL, presets: presetModelRows_(), links: MODEL_LINKS,
    manual: false, manualModel: MANUAL_MODEL, account: accountInfo_(), aiNotice: AI_NOTICE_2026
  };
  try { st.manual = manualOn_(); } catch (e) {}
  try {
    st.installed = !!(sh_(APP.SH.CONFIG) && sh_(APP.SH.RECORD) && sh_(APP.SH.ACTIVITY) && sh_(APP.SH.ROSTER));
  } catch (e) {}
  ['gemini', 'openai', 'anthropic'].forEach(function (p) {
    if (getKey_(p)) { st.hasKey = true; st.keyNames.push(p); }
  });
  try { st.subscription = subOn_(); } catch (e) { st.subscription = false; }
  if (st.installed) {
    try { st.rosterCount = getRoster_().length; st.rosterMode = rosterMode_(); } catch (e) {}
    try {
      st.activities = getActivities_().map(function (a) {
        return { key: a.key, name: a.name, inSheet: a.inSheet, exSheet: a.exSheet, quick: a.mode === '바로쓰기' };
      });
    } catch (e) {}
    try {
      st.backupModel = normModel(cfg_('예비 모델', ''));
      st.models = modelChoices_().filter(function (m) { return m !== SUBSCRIPTION_MODEL && m !== MANUAL_MODEL; });
      st.defaultModel = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
      st.compileModel = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
    } catch (e) {}
    if (st.activities.length) {
      try { st.exampleCount = readExampleRows_(getActivity_(st.activities[0].key)).length; } catch (e) {}
    }
    try { st.rules = currentPackInfo_(); } catch (e) {}
  }
  return st;
}

/* -------------------------------------------------------------- 1단계 */
function onboardInstall() {
  installCore_();
  return onboardStatus();
}

/* -------------------------------------------------------------- 2단계 */
/**
 * 키를 저장하고, 고른(또는 기본) 모델로 한 번 불러 본다.
 * 성공하면 그 모델을 활동용·합본용 모델로 맞추고, 모델 목록 표에 ✓ 를 남긴다.
 * @param {{provider:string, key?:string, model?:string}} p  key 가 비면 저장된 키로 모델만 다시 시험
 */
function onboardSaveKey(p) {
  var provider = String(p.provider || 'gemini');
  if (PROVIDERS.indexOf(provider) < 0) throw new Error('알 수 없는 회사: ' + provider);
  var key = String(p.key || '').trim();
  if (key) setKey_(provider, key);
  else if (!getKey_(provider)) throw new Error('키를 입력하세요.');

  var model = normModel(p.model) || PROVIDER_DEFAULT_MODEL[provider];
  var guess = guessProvider(model);
  if (guess && guess !== provider) {
    return { ok: false, status: onboardStatus(),
      message: model + ' 은(는) ' + providerLabel(guess) + ' 모델입니다. 위에서 회사를 ' + providerLabel(guess) +
               '(으)로 바꾸거나, ' + providerLabel(provider) + ' 모델 이름을 적어 주세요.' };
  }
  var res = testModel({ model: model, company: providerLabel(provider) });
  try {
    var preset = PRESET_MODELS.filter(function (x) { return x.model === model; })[0] || {};
    recordModelStatus_(res, { company: guess ? '자동' : providerLabel(provider), level: preset.level, memo: preset.memo });
  } catch (e) {}
  if (res.ok) {
    // 이미 다른 회사 키로 잘 쓰고 있으면 주 모델은 두고, 새 모델을 예비 모델로 둔다
    var cur = normModel(cfg_('활동용 모델', DEFAULT_MODEL));
    var curProv = providerOf_(cur);
    var keep = curProv && curProv !== 'subscription' && curProv !== provider && !!getKey_(curProv);
    var msg = '연결됐습니다 · ' + model + ' · ' + res.sec + '초. ';
    if (keep) {
      if (!normModel(cfg_('예비 모델', ''))) { setCfg_('예비 모델', model); msg += '지금 쓰는 ' + cur + ' 은 그대로 두고, ' + model + ' 을 예비 모델로 두었습니다(주 모델이 한도 초과 등으로 실패하면 대신 씀).'; }
      else msg += '지금 쓰는 ' + cur + ' 은 그대로 두었습니다. 바꾸려면 메뉴 ② [모델] 탭에서 고르세요.';
    } else {
      setCfg_('활동용 모델', model);
      setCfg_('합본용 모델', model);
      msg += '활동용·합본용 모델을 이것으로 맞췄습니다.';
    }
    try { refreshModelDropdowns_(); } catch (e) {}
    return { ok: true, model: model, kept: keep, status: onboardStatus(), message: msg };
  }
  // 시험은 실패해도 새 키는 저장됐으므로, 그 회사 모델이 드롭다운에 나오게 한다
  if (key) { try { refreshModelDropdowns_(); } catch (e) {} }
  return { ok: false, model: model, kind: res.kind || '', status: onboardStatus(), message: res.message };
}

/**
 * 2단계를 키 대신 "Gemini 구독(학교 계정·Google AI Pro)"으로 마친다.
 * 이미 키로 잘 쓰고 있는 모델이 있으면 그대로 두고, 아니면 활동용·합본용을 Gemini(구독)으로 맞춘다.
 */
function onboardUseSubscription() {
  setSub_(true);
  var changed = [];
  ['활동용 모델', '합본용 모델'].forEach(function (k) {
    var cur = normModel(cfg_(k, DEFAULT_MODEL));
    if (cur === SUBSCRIPTION_MODEL) return;
    if (providerOf_(cur) !== 'subscription' && modelUsable_(cur)) return;   // 키로 쓰는 모델은 둔다
    setCfg_(k, SUBSCRIPTION_MODEL);
    changed.push(k);
  });
  try { refreshModelDropdowns_(); } catch (e) {}
  var msg = 'Gemini 구독을 켰습니다. ';
  msg += changed.length ? changed.join('·') + '을 Gemini(구독)으로 맞췄습니다.'
                        : '지금 쓰는 모델은 키로 그대로 쓰고, Gemini(구독)도 목록에서 고를 수 있게 했습니다.';
  return { ok: true, status: onboardStatus(), message: msg };
}

/**
 * 2단계를 [키 없이 — 복사·붙여넣기]로 마친다. 키로 잘 쓰는 모델이 있으면 그대로 두고,
 * 키가 없는 모델이 골라져 있으면 활동용·합본용을 [키 없이(복사·붙여넣기)]로 맞춘다.
 */
function onboardUseManual() {
  setManual_(true);
  var changed = [];
  ['활동용 모델', '합본용 모델'].forEach(function (k) {
    var cur = normModel(cfg_(k, DEFAULT_MODEL));
    if (cur === MANUAL_MODEL || modelUsable_(cur)) return;
    setCfg_(k, MANUAL_MODEL);
    changed.push(k);
  });
  try { refreshModelDropdowns_(); } catch (e) {}
  return { ok: true, status: onboardStatus(),
           message: '키 없이 쓰기로 시작합니다. ' + (changed.length ? changed.join('·') + '을 [' + MANUAL_MODEL + ']로 맞췄습니다. ' : '') +
                    '나중에 키를 넣으면 메뉴 ⑥ 한 번으로 자동 생성됩니다.' };
}

/** 설정 시트의 값 하나를 바꾼다 */
function setCfg_(key, value) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) return;
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) { s.getRange(i + 1, 2).setValue(value); return; }
  }
}

/* -------------------------------------------------------------- 3단계 */
/**
 * 붙여넣은 명단을 해석한다.
 * 탭·쉼표·여러 칸 공백 어느 것으로 나뉘어 있어도 받고,
 * "1반 3번 김하늘" 같은 한 줄 표기도 받는다.
 */
/** 붙여넣은 명단 → 명단 시트 줄들 (해석은 14_RosterParse.gs) */
function parseRoster_(text, mode) {
  var r = parseRosterRows(rosterTextToRows(text), mode || 'class');
  return r.students.map(function (st) { return rosterRowOf(st, r.mode); });
}

/** @param {string} text  @param {string=} mode 'class' | 'grade' | 'auto' */
function onboardPreviewRoster(text, mode) {
  var r = rosterPreview({ text: text, mode: mode || 'auto' });
  return { count: r.count, mode: r.mode, warnings: r.warnings,
           sample: r.students.slice(0, 3).map(studentLabel), skippedCount: r.skippedCount };
}

function onboardSaveRoster(text, mode) {
  rosterSave({ text: text, mode: mode || 'auto' });
  return onboardStatus();
}

/* -------------------------------------------------------------- 4단계 */
/**
 * @param {{text:string, recordKey:string, subjectKey:string, model:string,
 *          columns?:(string|string[]), name?:string, direct?:boolean}} p
 *   direct: AI 없이 적어 준 항목 그대로 만든다
 */
function onboardCreateActivity(p) {
  var cols = p.columns ? validateColumns_(p.columns) : null;
  var def;
  if (p.direct) {
    if (!cols) throw new Error('입력 항목을 적어 주세요.');
    var name = String(p.name || '').trim() || String(p.text || '').trim().slice(0, 12) || '활동';
    def = { name: name, key: name, columns: cols, desc: String(p.text || '').trim(),
            recordKey: p.recordKey, subjectKey: p.subjectKey, examples: [] };
  } else {
    def = wizardSuggest({
      text: p.text, recordKey: p.recordKey, subjectKey: p.subjectKey,
      model: p.model, count: 2, columns: cols, name: p.name
    });
  }
  var made = wizardCreate(def);
  return { made: made, def: def, status: onboardStatus() };
}

/** 4단계를 [✍️ 바로 쓰기 시트]로 — 입력 항목 없이 */
function onboardCreateQuick(p) {
  var r = createQuickSheet({ name: p.name, recordKey: p.recordKey, subjectKey: p.subjectKey, desc: p.text });
  return { made: { inSheet: r.inSheet, exSheet: '' }, status: onboardStatus() };
}

/* -------------------------------------------------------------- 5단계 */
/** 시험에 쓸 학생 자료 한 건 — 예시 시트 1번, 없으면(바로 쓰기) 보기 메모 */
function testBlockFor_(act) {
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var rows = readExampleRows_(act);
  var values = rows.length ? rows[0].values : null;
  if (!values && act.mode === '바로쓰기') values = [SAMPLE_MEMO[act.recordKey] || SAMPLE_MEMO['과세특']];
  if (!values && act.mode === '보고서') values = ['', SAMPLE_POINTS, ''];
  if (!values) throw new Error('예시 시트가 비어 있어 시험할 자료가 없습니다. 활동을 다시 만들거나 예시를 한 줄 채워 주세요.');
  return blockFor_(act, values, (rec && rec.useGrade) ? 3 : '');
}

/** 키 없이 시험: 요청문을 만들어 준다 */
function onboardManualTest(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = buildManualUser([{ id: 'S1', block: testBlockFor_(act) }]);
  return { prompt: promptFor_(act) + '\n\n' + user, limit: bytesFor_(act), gem: buildGemText(promptFor_(act)) };
}

/** 키 없이 시험: 받아 온 답을 검사만 한다(시트에 쓰지 않음) */
function onboardManualCheck(p) {
  var txt = cleanResult_(parseManualAnswer(p.answer, ['S1']).map.S1 || '');
  if (!txt) return { ok: false, message: '받은 답을 붙여 넣어 주세요.' };
  var limit = Number(p.limit) || 1500;
  var v = inspect_(txt, limit);
  return { ok: true, text: txt, bytes: v.bytes, limit: limit,
           issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label + (i.hit ? ' → ' + i.hit : ''); }) };
}

/**
 * 시험 생성 — 학생 데이터를 건드리지 않고, 예시 시트의 1번 입력값으로
 * 실제 호출을 한 번 돌려 본다. 여기까지 결과가 나오면 설정이 끝난 것이다.
 */
function onboardTestGenerate(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = testBlockFor_(act);
  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  if (providerOf_(model) === 'subscription' || providerOf_(model) === 'manual' || !modelUsable_(model)) {
    var withKey = PROVIDERS.filter(function (x) { return getKey_(x); })[0];
    if (!withKey) throw new Error('API 키가 없어 스크립트로 바로 시험할 수 없습니다. [키 없이] 시험이나 [구독으로 시험하기]를 쓰세요.');
    model = PROVIDER_DEFAULT_MODEL[withKey];
  }

  var system = promptFor_(act);
  var txt = cleanResult_(callAI_(system, user, model));
  var limit = bytesFor_(act);
  var v = inspect_(txt, limit), fixed = false;
  // 시험에서도 실제 생성과 같은 흐름: [수정]이 나오면 한 번 고쳐 쓰게 한다
  if (needsRepair(v) && cfgBool_('자동 고쳐쓰기', true)) {
    try {
      var t2 = cleanResult_(callAI_(system, buildRepairUser(user, txt, v.issues.filter(function (x) { return x.level === 'block'; }), limit), model));
      var v2 = inspect_(t2, limit);
      if (t2 && betterResult(v, v2) === 'b') { txt = t2; v = v2; fixed = true; }
    } catch (e) {}
  }
  return {
    text: txt, bytes: v.bytes, limit: limit, model: model, repaired: fixed,
    issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; })
  };
}

/**
 * 구독만 쓰는 경우의 시험 생성.
 * =AI 수식은 선생님이 셀에서 [생성 및 삽입]을 눌러야 결과가 나오므로(구글 정책), 스크립트가 끝까지 할 수 없다.
 * [🚀 시작하기] 시트 아래쪽에 시험 셀을 만들어 그 셀로 데려가고, 결과는 onboardReadSubTest 로 읽는다.
 */
function onboardTestSubscription(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var user = testBlockFor_(act);

  var s = sh_(APP.SH.START) || buildStart();
  var r = s.getLastRow() + 2;
  if (r + 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + 1 - s.getMaxRows());
  s.getRange(r, 1).setValue('🧪 구독 시험 — 바로 아래 셀을 누르면 뜨는 [생성 및 삽입](Generate and insert)을 누르세요. ' +
                            '답이 들어오면 시작하기 창에서 [결과 확인]을 누릅니다. 확인이 끝나면 이 두 줄은 지워도 됩니다.')
    .setFontWeight('bold').setBackground(APP.COLORS.input);
  var cell = s.getRange(r + 1, 1);
  cell.setFormula(subscriptionFormula_(promptFor_(act), user));
  cell.activate();
  return { a1: cell.getA1Notation(), limit: bytesFor_(act) };
}

/** 구독 시험 셀의 결과를 읽어 검사한다. 아직 [생성 및 삽입] 전이면 ok:false */
function onboardReadSubTest(p) {
  var s = sh_(APP.SH.START);
  var cell = s && p && p.a1 ? s.getRange(p.a1) : null;
  var v = cell ? String(cell.getDisplayValue() || '').trim() : '';
  if (!v || /^#/.test(v) || /^(loading|로드 중)/i.test(v)) {
    return { ok: false, message: '아직 결과가 없습니다. 시험 셀을 선택하고 [생성 및 삽입]을 누른 뒤, 답이 들어오면 다시 눌러 주세요.' +
             (/^#/.test(v) ? ' (지금 셀에 ' + v.slice(0, 20) + ' 이(가) 보입니다 — 이 계정에서는 =AI 함수를 쓸 수 없는 것일 수 있습니다)' : '') };
  }
  var txt = cleanResult_(v);
  var limit = Number(p.limit) || 1500;
  var res = inspect_(txt, limit);
  return { ok: true, text: txt, bytes: res.bytes, limit: limit,
           issues: res.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; }) };
}

/* -------------------------------------------------------------- 마무리 */
function onboardFinish() {
  try { PropertiesService.getDocumentProperties().setProperty(ONBOARD_KEY, '1'); } catch (e) {}
  return true;
}

function onboardReset() {
  try { PropertiesService.getDocumentProperties().deleteProperty(ONBOARD_KEY); } catch (e) {}
  toast_('시작하기 안내를 다시 켰습니다.');
}

/** 특정 시트로 이동 */
function onboardGoto(name) {
  var s = sh_(name);
  if (s) ss_().setActiveSheet(s);
  return !!s;
}

/* ------------------------------------------------------ 시작하기 시트 */
/** [🚀 시작하기] 시트 위쪽 버튼 — 그림에 함수를 붙인다(휴대폰 앱에서는 동작하지 않아 메뉴 안내를 함께 둔다) */
var START_BUTTONS = [
  { img: 'start', fn: 'openOnboard', alt: '시작하기 (처음이면 여기)', row: 0, col: 0 },
  { img: 'quick', fn: 'openQuickSheetDialog', alt: '바로 쓰기 · 보고서 시트 추가', row: 0, col: 1 },
  { img: 'form', fn: 'openFormDialog', alt: '구글 설문지 연결', row: 1, col: 0 },
  { img: 'check', fn: 'openCheckSidebar', alt: '맞춤법 · 금지어 검사', row: 1, col: 1 },
  { img: 'style', fn: 'openStyleDialog', alt: '내 문체 카드', row: 2, col: 0 },
  { img: 'ocr', fn: 'openOcrGuide', alt: '스캔 문서 → 엑셀 사용 설명서', row: 2, col: 1 },
  { img: 'subject', fn: 'openSubjectDialog', alt: '새 교과 만들기', row: 3, col: 0 },
  { img: 'bytes', fn: 'openBytesDialog', alt: '활동별 바이트 한도', row: 3, col: 1 },
  { img: 'studio', fn: 'openStudio', alt: '세특 프롬프트 공방', row: 4, col: 0 },
  { img: 'help', fn: 'openHelpSheet', alt: '사용법 시트', row: 4, col: 1 }
];

function buildStart() {
  var s = shOrCreate_(APP.SH.START);
  s.clear();
  var L = [];
  var H = function (t) { L.push(['§', t]); };
  var P = function (t) { L.push(['', t]); };

  L.push(['#', '세특 작성 도우미 ' + APP.VERSION]);
  P('학생부 특기사항을 활동 단위로 모으고, 프롬프트를 자동으로 조립해 AI에게 맡기는 도구입니다. 과목별 세특 · 자율 · 동아리 · 진로 · 행발까지 같은 방식으로 씁니다.');
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  L.push(['btn', '']);
  P('버튼이 안 눌리면 상단 메뉴 [' + APP.MENU + '] 에서 같은 이름을 누르세요. (휴대폰·태블릿 앱에서는 버튼이 동작하지 않습니다)');
  L.push(['!', '⚠️ 2026학년도 기재요령: ' + AI_NOTICE_2026]);
  P('');

  H('1단계.  이 파일을 내 드라이브로 복사하세요');
  P('지금 보고 계신 파일이 남의 원본이라면, 상단 [파일] > [사본 만들기] 를 먼저 누르세요. 이미 내 사본이라면 다음으로 넘어가면 됩니다.');
  P('');

  H('2단계.  위 초록 버튼 [▶ 시작하기] 를 누르세요');
  P('또는 상단 메뉴  [' + APP.MENU + ']  >  [🚀 시작하기].  팝업이 순서대로 안내합니다. 중간에 닫아도 다시 누르면 이어서 진행됩니다.');
  P('');

  H('⚠️ 처음 한 번만 — 권한 승인 화면 넘는 법');
  P('버튼이나 메뉴를 처음 누르면 구글이 승인을 요구합니다. 아래 순서대로 누르시면 됩니다.');
  P('   ①  [승인 필요] 창에서  [계속]  클릭');
  P('   ②  구글 계정 선택');
  P('   ③  "Google에서 확인하지 않은 앱입니다" 화면이 나오면  →  왼쪽 아래  [고급]  →  [세특 작성 도우미(안전하지 않음)(으)로 이동]');
  P('   ④  [허용]  클릭');
  P('이 경고는 개인이 만든 스크립트라서 뜨는 것입니다. 코드는 이 파일 안에 그대로 있고 [확장 프로그램] > [Apps Script] 에서 볼 수 있습니다.');
  P('');

  H('API 키가 없어도 됩니다 — 세 가지 방법 중 하나');
  P('①  키 없이 (복사·붙여넣기) — 처음이라면 이것부터.  시트가 요청문을 만들어 주면 Gemini 앱(gemini.google.com)에 붙여 넣고, 받은 답을 다시 붙여 넣습니다.');
  P('     학교 구글 계정으로 Gemini 앱에 들어가면 무료이고 입력 내용이 AI 학습에 쓰이지 않습니다(학교에서 Gemini를 켜 두었을 때). 학생 이름은 보내지 않습니다.');
  P('②  Gemini API 키 — 생성 · 검사가 버튼 한 번.  aistudio.google.com/apikey 에서 무료 발급. 무료 등급은 보낸 내용이 서비스 개선에 쓰일 수 있어, 학생 자료는 결제를 켠 키를 권합니다.');
  P('③  Gemini 구독(=AI 함수) — 학교에 Google AI Pro for Education 이 있거나 개인 Google AI Pro·Ultra 일 때.  무료 학교 계정(Education Fundamentals)에는 아직 없습니다.');
  P('     확인법: 시작하기 2단계 [구독으로]에서 [구독 확인하기] — 시험 셀을 만들어 [생성 및 삽입]이 되는지 봅니다.');
  P('');

  H('이 도구로 할 수 있는 것');
  P('· 활동별 세특·창체·행발 초안 — 메뉴 ④ 활동 만들기 (입력 항목은 직접 적거나 AI에게 맡김)');
  P('· ✍️ 바로 쓰기 — 입력 항목을 정하지 않고 학생마다 메모만 적어 초안 받기, 또는 직접 쓴 글을 바로 검사하기');
  P('· 📄 보고서 세특 — 학생 보고서(본문·PDF·사진·구글 문서·HWPX) → AI가 요점 뽑기 → 선생님 확인 → 직접 쓴 3~5편을 ⭐예시로 → 나머지 생성');
  P('· 📝 구글 설문지 연결 — 응답이 오면 저절로 시트에(파일 업로드 보고서 포함), 원하면 바로 생성');
  P('· ✒️ 내 문체 — 예전에 쓴 세특을 넣으면 "나처럼" 쓰도록 문체 카드를 만들어 모든 학생에게 똑같이 적용');
  P('· 📚 새 교과 만들기 — 목록에 없는 교과(화학 · 공통국어1 · 인공지능 기초 …)의 교과 역량과 입력 항목을 교육과정 자료로 AI가 초안, 선생님끼리 글로 나누기');
  P('· 📏 활동별 바이트 한도 — 한 칸(예: 수학 과세특 1500바이트)을 탐구 · 발표 · 수업 태도처럼 여러 활동이 나눠 쓰게');
  P('· 🧪 세특 프롬프트 공방 — 활동을 설계하면서 조립되는 프롬프트를 바로 보고 복사(어느 AI에든), 마음에 들면 그대로 활동 시트로');
  P('· 🔍 맞춤법 · 금지어 검사 — 2026 기재요령 금지어, 어미 · 특수문자, 맞춤법 · 띄어쓰기, 나이스 바이트');
  P('· 생성 직후 자동 검사 → [수정]이 나온 학생만 걸린 점을 짚어 한 번 더 고쳐 쓰기, 원하면 근거 확인(학생 자료에 없는 내용 찾기)');
  P('· 📏 기재요령 규칙판은 해마다 저절로 업데이트 — 직접 고친 칸은 그대로 둡니다');
  P('');

  H('꼭 알아 두실 것');
  P('· AI 키는 이 파일이 아니라 각자의 구글 계정에 저장됩니다. 사본을 나눠 줘도 키는 넘어가지 않습니다.');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다. 주민등록번호, 가정환경, 건강 정보 같은 민감정보는 입력하지 마세요.');
  P('· AI가 쓴 문장을 그대로 기재하지 마세요. 교사가 직접 관찰·평가한 내용을 바탕으로 고쳐 쓰고, 최종 문장의 책임은 작성한 교사에게 있습니다.');
  P('· 학교·교육청의 생성형 AI 활용 지침을 먼저 확인하세요. 시도교육청마다 다릅니다.');
  P('');

  H('함께 쓰면 좋은 도구');
  P('📄 스캔 문서 → 엑셀 (업무 인수인계 대시보드) — 손글씨 활동지 · 신청서를 글자 그대로 표로 읽어 엑셀로. 위 파란 버튼을 누르면 설치 · 사용법이 열립니다.');
  P('');
  P('설정이 끝나면 이 탭은 닫아 두셔도 됩니다. 자세한 사용법은 [📖 사용법] 탭에 있습니다.');

  var rows = L.map(function (r) { return [r[1]]; });
  s.getRange(1, 1, rows.length, 1).setValues(rows);
  var btnRows = [];
  for (var i = 0; i < L.length; i++) {
    var c = s.getRange(i + 1, 1);
    if (L[i][0] === '#') c.setFontSize(18).setFontWeight('bold').setFontColor('#1b3a2a');
    else if (L[i][0] === '§') {
      c.setFontWeight('bold').setFontSize(13).setBackground('#e3ece4').setFontColor('#1b3a2a');
      s.setRowHeight(i + 1, 32);
    } else if (L[i][0] === '!') {
      c.setBackground('#fdecea').setFontColor('#7f1d1d').setFontWeight('bold').setFontSize(10);
      s.setRowHeight(i + 1, 50);
    } else if (L[i][0] === 'btn') {
      s.setRowHeight(i + 1, 62);
      btnRows.push(i + 1);
    }
  }
  s.setColumnWidth(1, 820);
  s.getRange(1, 1, rows.length, 1).setWrap(true).setVerticalAlignment('middle');
  s.setHiddenGridlines(true);
  try { placeStartButtons_(s, btnRows); } catch (e) {}   // 그림을 못 넣어도 시트는 그대로 쓴다
  return s;
}

/** 버튼 그림을 지우고 다시 붙인다 (여러 번 만들어도 겹치지 않게) */
function placeStartButtons_(s, btnRows) {
  s.getImages().forEach(function (img) { img.remove(); });
  START_BUTTONS.forEach(function (b) {
    var row = btnRows[b.row];
    if (!row || !BUTTON_PNG[b.img]) return;
    var blob = Utilities.newBlob(Utilities.base64Decode(BUTTON_PNG[b.img]), 'image/png', b.img + '.png');
    var img = s.insertImage(blob, 1, row, 6 + b.col * 400, 5);
    img.setWidth(380).setHeight(52);
    img.assignScript(b.fn);
    try { img.setAltTextTitle(b.alt).setAltTextDescription('누르면 ' + b.alt + ' 창이 열립니다'); } catch (e) {}
  });
}


/* ==========================================================================
   35_Help.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 사용법 시트
 */

function buildHelp() {
  var s = shOrCreate_(APP.SH.HELP);
  s.clear();
  var L = [];
  var H = function (t) { L.push(['§', t]); };
  var P = function (t) { L.push(['', t]); };

  L.push(['', '세특 작성 도우미 ' + APP.VERSION]);
  P('학생부 특기사항을 활동 단위로 모으고, 프롬프트를 자동으로 조립해 AI에게 맡기는 도구입니다.');
  P('교과 세특뿐 아니라 자율·동아리·진로·행동특성 및 종합의견까지 같은 방식으로 씁니다.');
  P('⚠️ ' + AI_NOTICE_2026);

  H('메뉴 한눈에 보기 (화면이 작아도 잘리지 않게 묶었습니다)');
  P('  맨 위: 🚀 시작하기 · ✍️ 바로 쓰기 · 📄 보고서 시트 추가 · 📝 구글 설문지 연결 · 🔍 맞춤법·금지어 검사 · ⑥ 체크된 행 생성 · ⑦ 최종취합');
  P('  ①②③ 준비 — 처음 설치 / AI 연결 · 모델 설정 / 학생 명단');
  P('  ④⑤ 활동 · 예시 · 보고서 — 활동 만들기 · 📚 새 교과 만들기 · 📏 활동별 바이트 한도 · 🧪 세특 프롬프트 공방 · 복제 · 삭제 / 예시 더 만들기 · 늘리기 · 검증 / ⭐ 예시로 등록 / 📄 보고서 요점 뽑기 · 폴더에서 가져오기');
  P('  ⑥ 생성 더 보기 — 📋 키 없이(복사·붙여넣기) · 선택한 행만 · 자동 생성 켜기/끄기 · 최종 압축본');
  P('  ⑧ 점검 · 기재요령 2026 — 검사 · 근거 확인 · 재검증 · 프롬프트 미리보기 · AI 앱용 지침 내보내기 · ✒️ 내 문체 카드 · 📏 기재요령 규칙');
  P('  도움말 · 부가 기능 — 📄 스캔 문서 → 엑셀 사용 설명서 · 사용법 · 설문지 응답 지금 받아 오기 · 수업관찰 · 구조 복구 · 버전');
  P('  [🚀 시작하기] 시트 위쪽 버튼 10개로도 같은 창을 엽니다.');

  H('0. 이 도구의 핵심 — 프롬프트를 직접 쓰지 않습니다');
  P('프롬프트는 네 개의 시트에서 자동으로 조립됩니다.');
  P('  🧩 기록종류 : 항목별 글자수 · 서술 관점 (과세특 500자, 행발 300자 …)');
  P('  📚 교과영역 : 교과별 핵심역량과 관점 (수학 · 과학 · 국어 …)');
  P('  📐 공통규칙 : 어미, 기재 금지사항 등 모든 기록에 공통인 규칙');
  P('  🗂 활동목록 : 활동 이름 · 입력 항목 · 활동 개요');
  P('선생님이 채우는 것은 [활동 개요 한두 줄]과 [입력 항목]뿐입니다. 나머지는 엔진이 붙입니다.');
  P('바꾸고 싶은 문장이 있으면 위 시트의 해당 칸만 고치면 모든 활동에 한꺼번에 반영됩니다.');

  H('1. 처음 준비 — 메뉴 [🚀 시작하기] 하나면 됩니다');
  P('상단 메뉴 [' + APP.MENU + '] > [🚀 시작하기] 를 누르면 팝업이 순서대로 안내합니다.');
  P('구조 설치 → AI 연결(키가 없어도 됨) → 학생 명단 → 첫 활동 만들기 → 시험 생성까지 한 번에 끝납니다.');
  P('중간에 닫아도 다시 열면 끝난 단계는 완료로 표시되고 그다음부터 이어집니다.');
  P('');
  P('손으로 하고 싶다면 메뉴를 하나씩 눌러도 됩니다.');
  P('  ① 처음 설치 / 구조 복구  →  ② AI 연결 · 모델 설정  →  ③ 학생 명단 불러오기  →  ④ 활동 만들기');
  P('');
  P('학생 명단 넣기 (메뉴 ③ 학생 명단 불러오기)');
  P('  · 명단 방식을 고릅니다: [반·번호] 담임·교과 / [학년·반·번호] 동아리·방과후처럼 학년이 섞일 때');
  P('  · [엑셀 양식]을 내려받아 채운 뒤 그 파일을 올리면 한 번에 들어옵니다. CSV·붙여넣기도 됩니다.');
  P('  · 나이스에서 받은 명렬표도 머리글(학년·반·번호·이름/성명·학번)을 보고 알아서 읽습니다. 학번 20315 = 2학년 3반 15번.');
  P('  · 학년·반·번호 방식이면 활동 시트 첫 열에 2-3 처럼 [학년-반]으로 보입니다.');
  P('  · 명단을 바꿔도 활동 시트에 적어 둔 학생 자료는 반·번호로, 그게 바뀌었으면 이름으로 찾아 따라갑니다.');
  P('');
  P('※ 사본을 남에게 나눠 줄 때: 공유 링크 끝의 /edit... 을 /copy 로 바꾸면');
  P('   링크를 연 순간 [사본 만들기] 창이 바로 떠서, 코드까지 통째로 복사됩니다.');
  P('   단, 자동 생성 트리거와 수업관찰 웹앱 배포는 사본마다 각자 한 번씩 눌러야 합니다.');

  H('1-1. API 키가 없어도 됩니다 — 키 없이(복사·붙여넣기)');
  P('모든 [모델] 드롭다운 맨 끝에 [' + MANUAL_MODEL + '] 이 늘 있습니다. 키가 하나도 없으면 생성할 때 저절로 이 방식이 됩니다.');
  P('  ① [생성] 체크 → 메뉴 ⑥ 체크된 행 생성 → 창이 열립니다');
  P('  ② [📋 전체 복사] → Gemini(gemini.google.com, 학교 계정 권장)·ChatGPT·Claude 대화창에 붙여 넣기');
  P('  ③ 받은 답을 통째로 복사해 창에 붙여 넣고 [시트에 넣고 검사] → [S1] [S2] 표시를 보고 학생별 [AI 결과]에 들어가고 바로 검사됩니다');
  P('  · 학생 이름은 요청문에 들어가지 않습니다(S1, S2 … 로 바뀜). 한 번에 5~10명씩 묶어 줍니다.');
  P('  · 창의 [Gem(지침)으로 만들어 두기] 탭: 규칙을 Gemini Gem 에 한 번 저장하면 다음부터 [학생 자료만 복사]로 짧게 붙여 넣습니다.');
  P('  · 학교 구글 계정으로 Gemini 앱에 들어가면 무료이고 입력 내용이 AI 학습에 쓰이지 않습니다(학교 관리자가 켜 두었을 때). 개인 무료 계정은 학습·검토에 쓰일 수 있습니다.');
  P('  · 메뉴 ② 창 맨 위에 지금 로그인한 계정이 보입니다. Gemini 구독(=AI 함수)이 있는지는 [지금 계정에 구독이 있는지 확인]으로 시험 셀을 만들어 봅니다.');

  H('2. 활동 만들기 — 입력 항목은 직접 적어도, AI에게 맡겨도 됩니다');
  P('메뉴 ④ 활동 만들기 · 입력 항목 바꾸기 를 엽니다. 두 가지 길이 있습니다.');
  P('');
  P('① 직접 적기 (빠르고 비용 없음)');
  P('  · [활동 이름]과 [입력 항목]을 적고 [입력 항목대로 바로 만들기].');
  P('  · 입력 항목은 쉼표로 구분합니다. 예) 탐구 주제, 선정 이유, 탐구 과정, 알게 된 점, 한계와 개선점');
  P('  · 아래 [많이 쓰는 묶음]을 누르면 기록종류에 맞는 항목 묶음이 한 번에 채워집니다. 거기서 고쳐 쓰세요.');
  P('  · 여기 적은 이름이 그대로 입력 시트의 열 머리글이 됩니다.');
  P('');
  P('② AI에게 맡기기');
  P('  · 활동을 편한 말로 설명하고 [AI 초안 만들기]. 예) "통합과학 실험 보고서인데 가설, 실험 설계, 결과 해석, 오차와 개선점을 받았어요"');
  P('  · 입력 항목을 적어 두면 AI도 그 항목을 그대로 쓰고, 예시만 만들어 줍니다.');
  P('  · 예시 개수를 1~3개로 고를 수 있고, 만들어진 예시는 예시 시트에 저장됩니다.');
  P('');
  P('③ 나중에 입력 항목 바꾸기');
  P('  · 같은 창 맨 위에서 [이미 만든 활동의 입력 항목 고치기]를 고르면 항목을 더하거나 빼거나 순서를 바꿀 수 있습니다.');
  P('  · 학생이 채워 둔 자료는 항목 이름을 따라 옮겨집니다. 이름이 바뀐 항목은 새 항목으로 보고 비웁니다(창에서 미리 알려 줍니다).');
  P('  · AI 결과·최종본·예시는 그대로 남습니다.');
  P('[프롬프트 미리보기]를 누르면 실제로 AI에게 갈 문장을 확인할 수 있습니다.');

  H('2-1. ✍️ 바로 쓰기 시트 — 입력 항목을 정하지 않고 바로');
  P('메뉴 맨 위 [✍️ 바로 쓰기 시트 추가] 또는 [🚀 시작하기] 시트의 버튼. 시트 이름 · 기록 항목 · 교과만 고르면 됩니다. 몇 개든 만들 수 있습니다.');
  P('  · 학생마다 [관찰 메모] 한 칸에 자유롭게 적고 [생성] → AI 초안 (키가 없으면 복사·붙여넣기 창)');
  P('  · 또는 [최종본]에 직접 쓰면 [검증] 칸이 바로 금지어·어미·맞춤법·바이트를 검사합니다(AI를 부르지 않음).');
  P('  · 최종취합·검토는 보통 활동과 똑같이 됩니다. 학생 명단이 없으면 반·번호·이름을 직접 적어도 되고, 나중에 명단을 넣어도 적어 둔 줄은 지워지지 않습니다.');

  H('2-2. 📄 보고서 세특 — 완성된 보고서를 보고 쓰기');
  P('메뉴 [✍️ 바로 쓰기 · 📄 보고서 시트 추가] 에서 [📄 보고서 세특]을 고릅니다. 칸은 [보고서] [보고서 요점] [교사 관찰 메모] 셋입니다.');
  P('  ① [보고서]: 본문을 붙이거나 구글 드라이브 파일 링크. 📝 설문지(파일 업로드)를 연결하거나, 메뉴 ④⑤ [보고서 폴더에서 파일 가져오기]로');
  P('     클래스룸 과제 폴더 같은 곳의 파일을 이름(학번·이름·"3반 15번")으로 학생에게 한 번에 붙입니다.');
  P('     읽는 파일: 구글 문서 · PDF(스캔본 포함) · 사진 · HWPX · docx · pptx · txt.  .hwp 는 한글에서 PDF나 HWPX로 저장해 주세요.');
  P('  ② [생성]을 체크하거나 학생 줄을 고르고 메뉴 ④⑤ [📄 보고서 요점 뽑기] → AI가 탐구 주제·과정·결과·한계·교과 개념·학생의 질문을 뽑습니다. 읽고 고치세요.');
  P('     수업에서 직접 본 것은 [교사 관찰 메모]에. 생성할 때는 요점과 관찰 메모만 갑니다(긴 원문이 예시를 덮지 않게).');
  P('  ③ 수준이 다른 3~5명은 선생님이 직접 세특을 쓰고 [⭐ 선택한 학생 글을 예시로 등록] → 나머지 [생성] 체크 → 메뉴 ⑥.');
  P('     요점이 빈 학생은 ⑥ 을 누르면 요점부터 뽑고 이어서 씁니다. 보고서 시트는 늘 한 명씩 생성합니다.');
  P('  · 키 없이: 요점 뽑기도 복사·붙여넣기 창으로 합니다. 파일은 Gemini 대화창의 [+] → 드라이브로 첨부하라는 안내가 뜹니다.');
  P('  · 드라이브 파일은 읽기만 합니다(승인 창의 "Google 드라이브 파일 보기"). 고치거나 지우지 않습니다.');
  P('  · 2026 기재요령: 수업 중에 쓴 보고서만 쓰세요(학교 밖 과제형 수행평가 금지). 연구보고서(소논문) 실적은 쓰지 않습니다.');

  H('2-3. 예시가 뒤로 갈수록 잊히지 않게 — ⭐ 예시 등록 · ✒️ 내 문체');
  P('· ⭐ 예시로 등록: 입력 시트에서 학생 줄을 고르고 메뉴 ④⑤ [⭐ 선택한 학생 글을 예시로 등록] → [최종본](없으면 AI 결과)이 예시 시트로 갑니다.');
  P('  선생님이 직접 쓰거나 고친 글일수록 좋고, 수준이 다른 3~5편이면 충분합니다.');
  P('· ✒️ 내 문체: [✒️ 내 문체] 시트에 예전에 쓴 세특을 한 칸에 한 편씩(이름은 지우고) 넣고 메뉴 ⑧ [✒️ 내 문체 카드 만들기].');
  P('  쓰는 방식만 뽑은 카드가 [📐 공통규칙] STYLE_CARD 에 저장됩니다. 다른 활동에도 그대로 씁니다.');
  P('· 잊히지 않는 까닭: 학생마다(보고서는 한 명씩) 같은 규칙·예시·문체 예시를 처음부터 다시 보내고, 문체 카드는 학생 자료 바로 뒤에 한 번 더 붙입니다.');
  P('  그래서 30번째 학생도 첫 번째와 똑같은 예시를 봅니다. 생성 뒤 문장 길이·끝맺음이 예시와 많이 다르면 [검증]에 [확인] 문체가 뜹니다.');
  P('· 키 없이 대화창에 붙여 넣을 때는 한 대화에 계속 이어 붙이지 말고 묶음마다 새 대화로 하세요. 대화가 길어지면 앞쪽 예시가 흐려집니다.');

  H('2-4. 📚 새 교과 만들기 — 목록에 없는 교과');
  P('[📚 교과영역]에 없는 교과(화학 · 공통국어1 · 인공지능 기초 · 학교 지정 과목 …)는 메뉴 ④⑤ [📚 새 교과 만들기] 또는 시작하기 버튼.');
  P('  ① 교과 이름 + 교육과정 자료(교과 역량 · 성취기준을 붙여 넣거나 드라이브 PDF · HWPX 링크) → ② AI 초안(키가 없으면 요청문 복사 → Gemini → 답 붙여 넣기)');
  P('  ③ 교과 역량 · 수업에서 볼 수 있는 모습 · 추천 입력 항목을 읽고 고쳐 저장 → 원하면 그 입력 항목으로 활동 시트까지 바로 만듭니다.');
  P('· 자료 없이 만들면 확실하지 않은 줄에 [교육과정 확인 필요]가 붙고, 교육과정과 맞춰 봤다고 체크해야 저장됩니다(역량 이름을 지어내지 않게).');
  P('· [나누는 글 복사]로 같은 교과 선생님께 보내면, 받은 분은 같은 창에 붙여 넣고 [읽기] → 저장. 세특 프롬프트 공방(웹)에서 만든 교과도 같은 글 모양입니다.');

  H('2-5. 📏 활동별 바이트 한도 — 한 칸을 여러 활동이 나눌 때');
  P('나이스 한 칸(예: 수학 과세특 1500바이트)에 여러 활동 기록이 합쳐 들어간다면, 메뉴 ④⑤ [📏 활동별 바이트 한도]에서 활동마다 바이트를 나누세요.');
  P('  예) 탐구 보고서 750 + 발표 450 + 수업 태도 300 = 1500.  [똑같이 나누기] 버튼도 있고, 합계가 한 칸을 넘으면 빨갛게 알려 줍니다.');
  P('· 생성할 때 그 활동의 몫만큼만 쓰게 프롬프트에 들어가고, 검증 · 🔍 검사도 그 한도로 셉니다. 나눠 두면 ⑦ 최종취합의 합본이 한 칸을 넘지 않아 압축이 필요 없습니다.');
  P('· 2022 개정 공통과목(공통국어 · 공통수학 등)은 1 · 2 합산 500자(1500바이트) — 학기 활동을 750바이트씩 나누면 됩니다.');
  P('· [🗂 활동목록]의 [바이트 한도] 칸을 직접 고쳐도 됩니다. 비우면 기록 항목 한 칸 전체, 한 칸보다 크게 적으면 한 칸까지만 씁니다.');

  H('2-6. 🧪 세특 프롬프트 공방 — 설계하며 프롬프트 보기');
  P('메뉴 ④⑤ 또는 시작하기 버튼. 기록 종류 · 교과 · 바이트 한도 · 입력 항목 · 개요 · 예시를 바꿀 때마다 조립되는 프롬프트가 오른쪽에 바로 보입니다.');
  P('· [프롬프트 복사] → ChatGPT · Gemini · Claude 어디에든 붙여 넣어 쓸 수 있습니다(시트 없이 프롬프트만 필요한 선생님께도).');
  P('· [시트에 만들기] 탭 → 그 설계 그대로 이 시트에 활동 시트(입력 · 예시)를 만듭니다. [결과 검증] 탭은 이 시트의 기재요령 규칙으로 검사합니다.');
  P('· 아래 [새 교과 만들기]에서 만든 교과는 이 시트의 [📚 교과영역]에 바로 저장됩니다. 시트 안의 공방은 GitHub나 다른 사이트에 들어갈 필요가 없습니다.');

  H('3. 예시 채우기 — 품질을 가장 크게 좌우합니다');
  P('「활동명 ▸예시」 시트에 모범 예시를 채웁니다. 예시가 한 개라도 있으면 결과의 톤과 구조가 눈에 띄게 안정됩니다.');
  P('· 칸이 모자라면 메뉴 ⑤ 예시 칸 늘리기');
  P('· 직접 쓰기 막막하면 메뉴 ⑤ 예시 더 만들기 (AI) — 기존 예시의 문체를 따라가며 소재와 수준이 다른 초안을 만들어 줍니다');
  P('· 다 쓴 뒤에는 메뉴 ⑤ 예시 검증 을 한 번 누르세요');
  P('');
  P('⚠ 예시 검증이 중요한 이유: AI는 예시의 표현을 그대로 따라 씁니다.');
  P('   예시에 "수상", "토익", "○○대학교" 같은 표현이 남아 있으면 모든 학생 결과에 번집니다.');
  P('예시는 앞에서부터 최대 8개까지 프롬프트에 들어갑니다. 많을수록 좋지는 않고, 호출 비용도 함께 늘어납니다.');
  P('서로 다른 수준과 소재로 3~5개 정도가 적당합니다.');

  H('4. 세특 생성');
  P('① 「활동명 ▸입력」 시트의 노란 칸에 학생별 자료를 넣습니다.');
  P('② [모델]을 고르고 [생성]을 체크한 뒤, 메뉴 ⑥ 체크된 행 생성 을 누릅니다.');
  P('   체크하자마자 생성되게 하려면 메뉴 ⑥ 자동 생성 켜기 를 한 번 실행하세요.');
  P('③ [AI 결과]를 읽고 고쳐서 파란 [최종본] 칸에 붙여넣습니다. 여기 있는 글이 최종본입니다.');
  P('④ [검증] 칸에 분량 초과 · 기재 금지사항 · 어미 위반 · 맞춤법이 자동으로 표시됩니다. [최종본]을 고치면 바로 다시 검사합니다.');
  P('');
  P('생성 한 번에 이렇게 돕니다 (하네스)');
  P('  규칙 조립(그 기록 항목에 필요한 것만) → 생성 → 자동 검사 → [수정]이 나온 학생만 걸린 점을 짚어 한 번 더 고쳐 쓰기 → (켜 두면) 근거 확인');
  P('  · [⚙️ 설정] 자동 고쳐쓰기(기본 TRUE): 분량 초과·기재 금지어·어미가 걸리면 그 학생만 한 번 더 부릅니다. 고친 글이 더 나을 때만 바꿉니다. [검증]에 "(자동 고쳐쓰기 1회)".');
  P('  · [⚙️ 설정] 근거 자동 확인(기본 FALSE): AI 결과에 학생 자료에 없는 활동·수치·과장이 들어갔는지 한 번 더 봅니다. 메뉴 ⑧ [근거 확인]으로 고른 행만 해도 됩니다.');
  P('  · 2026 기재요령은 AI 도움을 받았으면 입력 전에 허위·과장 여부를 확인하라고 합니다. 근거 확인은 그 확인을 돕는 도구일 뿐, 판단은 교사가 합니다.');

  H('5. 최종취합 — 기록종류별로 따로 모입니다');
  P('메뉴 ⑦ 최종취합 시트 생성/갱신 을 누르면 기록종류별로 취합 시트가 생깁니다.');
  P('  📦 취합 ▸과세특 / 📦 취합 ▸동아리 / 📦 취합 ▸행발 …');
  P('과세특과 동아리는 나이스에서 서로 다른 칸에 들어가므로 절대 한 덩어리로 합치지 않습니다.');
  P('합본이 글자수를 넘는 학생만 [압축]을 체크하고 메뉴 ⑦ 최종 압축본 생성 을 누르세요.');
  P('활동 결과를 고친 뒤에는 [최종취합 시트 생성/갱신]을 다시 눌러야 반영됩니다.');

  H('6. 검증 · 🔍 맞춤법 · 금지어 검사');
  P('· 분량 : 글자수(바이트) 초과 또는 지나친 부족');
  P('· 기재 금지(2026) : 대회·수상, 교외상, 자격증·인증시험, 공인어학시험, 논문·특허·출판, 모의고사·석차, K-MOOC, 방과후학교, 해외활동, 학원·기관명, 부모 정보');
  P('· 눈으로 볼 것 : 대학·학과·기관명, 대회 언급, 청소년단체·학교스포츠클럽·자율동아리, 봉사 시간, 도서명 표기');
  P('· 형식 : 존댓말·평서형 어미, "학생은" 주어, 금지 특수문자');
  P('· 맞춤법 : 자주 틀리는 표기(역활→역할 등), 할수 있다·한것·있슴·안된다 같은 띄어쓰기·어미');
  P('[수정]은 반드시 고쳐야 하는 것, [확인]은 오탐일 수 있으니 눈으로 볼 것입니다. 검사 창에는 이유와 기재요령 쪽수가 함께 나옵니다.');
  P('');
  P('🔍 검사 창(메뉴 맨 위 또는 시작하기 버튼) — 오른쪽에 열립니다');
  P('  · 셀을 고르고 [선택한 셀 가져오기] → 검사 → 고친 뒤 [그 셀에 다시 넣기]. 아무 글이나 붙여 넣어도 됩니다.');
  P('  · 키가 있으면 [AI 맞춤법 검사](고칠 곳을 골라서 고침)와 [근거 확인], 없으면 Gemini 앱에 붙여 넣을 요청문을 복사해 줍니다.');
  P('  · 셀 함수: 어느 칸에서든 =SAETEUK_CHECK(A2) 또는 =SAETEUK_CHECK(A2, 300) (300 = 최대 글자 수). [✅ 검토] 시트에도 들어 있습니다.');
  P('검증은 보조 장치일 뿐입니다. 최종 책임은 작성자에게 있습니다.');

  H('6-1. 📏 기재요령 규칙 — 해마다 저절로 바뀝니다');
  P('[📏 기재요령] 시트의 표가 모든 검사 규칙입니다. 찾을 말은 정규식(| 는 "또는")이고, [사용] 체크를 풀면 그 줄은 쓰지 않습니다.');
  P('  · 우리 학교 규칙을 더하려면 맨 아래 줄에 적고 [출처]에 "내 학교"라고 쓰세요. 업데이트 때도 남습니다.');
  P('  · 기록 항목마다 프롬프트에 붙는 주의점은 [🧩 기록종류]의 [기재 주의] 칸에 있습니다(예: 동아리 — 자율동아리·학교스포츠클럽 특기사항 미입력).');
  P('  · 만든이가 새 학년도 규칙판을 올리면 7일 안에 저절로 받아, 선생님이 손대지 않은 칸(금지어 표·NEIS_RULES·기재 주의·글자수)만 바꿉니다. 직접 고친 칸은 그대로 두고 알려 줍니다.');
  P('  · 바로 확인: 메뉴 ⑧ [기재요령 규칙 업데이트 확인]. 지금 판은 메뉴 [버전 정보]에서도 보입니다.');

  H('7. 우리 학교 방식으로 바꾸기');
  P('· 어미를 "~하였음"으로 : 📐 공통규칙 > WRITING_RULES 내용 수정');
  P('· 글자수가 바뀌었을 때 : 🧩 기록종류 > 글자수 숫자만 수정 (프롬프트·검증·압축에 모두 반영. 활동별 바이트 한도는 새 한 칸을 넘지 않게 줄어듭니다)');
  P('· 내 교과 추가 : 메뉴 [📚 새 교과 만들기] (AI 초안) 또는 📚 교과영역 맨 아래에 한 줄 직접 추가 (키, 표시명, 분류=교과, 역할 표현, 역량)');
  P('· 특정 활동만 프롬프트를 통째로 쓰고 싶을 때 : 🗂 활동목록의 [프롬프트 모드]를 "직접작성"으로');
  P('  바꾸고 I열에 작성. {ROLE} {NEIS_RULES} {EXAMPLES} {BYTES}(활동 한도) {RECORD_BYTES}(한 칸 전체) 같은 중괄호는 자동 치환됩니다.');

  H('8. 개인정보와 비용');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다(⚙️ 설정 > 학생 이름 마스킹).');
  P('· API 키는 내 구글 계정에만 저장되며, 사본을 공유해도 넘어가지 않습니다.');
  P('· 주민등록번호, 가정환경, 건강 정보 등 민감정보는 입력하지 마세요.');
  P('· 유료 API는 호출한 만큼 과금됩니다. 결과 확인 후 체크박스를 꼭 해제하세요.');

  H('9. AI 모델 — 직접 적고, 시험하고, 고르기');
  P('모델 목록은 [⚙️ 설정] 시트 아래 [🤖 모델 목록] 표에 있습니다. 여기 적힌 이름이 모든 [모델] 드롭다운의 선택지입니다.');
  P('단, 드롭다운과 메뉴 ② 창에는 내가 API 키를 넣은 회사의 모델만, 구독을 켰을 때만 Gemini(구독)이, 그리고 늘 [' + MANUAL_MODEL + '] 이 나옵니다.');
  P('예) Claude 키를 넣지 않았으면 Claude 모델은 드롭다운에 아예 없습니다. 키는 계정마다 따로라, 같은 사본을 여러 선생님이 함께 쓰면 마지막에 드롭다운을 새로 입힌 사람의 키 기준으로 보입니다.');
  P('메뉴 ② AI 연결 · 모델 설정 > [② 모델] 탭에서 이름을 적고 [시험]을 누르면 ✓/✗ 와 걸린 시간이 표에 남습니다.');
  P('메뉴 ② 아래 [모델 연결 테스트]는 목록 전체를 한 번에 확인합니다. 학기 초에 한 번 눌러 두세요.');
  P('');
  P('어느 수준이면 충분할까?');
  P('  ★ 충분(기본) : ' + PROVIDER_DEFAULT_MODEL.gemini + ' · ' + PROVIDER_DEFAULT_MODEL.openai + ' · ' + PROVIDER_DEFAULT_MODEL.anthropic + '  → 과세특·창체·행발 거의 모든 경우');
  P('  가볍게       : gemini-flash-lite-latest  → 행발처럼 짧은 글, 한 번에 많은 학생');
  P('  고급         : gemini-pro-latest · gpt-6-sol · claude-sonnet-5-5  → 합본 압축이 글자수를 자꾸 넘길 때만 (느리고 몇 배 비쌈)');
  P('  결과 품질은 모델 등급보다 예시와 학생 자료가 훨씬 크게 좌우합니다. 상위 모델부터 쓰지 마세요.');
  P('');
  P('최신 모델명은 어디서?');
  P('  Gemini : ' + MODEL_LINKS.gemini + '  (각 모델의 Model code)');
  P('  OpenAI : ' + MODEL_LINKS.openai);
  P('  Claude : ' + MODEL_LINKS.anthropic + '  (Claude API ID)');
  P('  또는 메뉴 ② > [③ 도움말] > [목록 불러오기] 를 누르면 내 키로 쓸 수 있는 모델을 회사에 직접 물어봐 줍니다.');
  P('  "Gemini 3.8 Flash" 같은 표시 이름이 아니라 gemini-3.8-flash 같은 영문 소문자 코드를 적습니다.');
  P('  -latest 로 끝나는 Gemini 이름은 새 모델이 나오면 자동으로 바뀌어 낡지 않습니다. 그래서 기본값입니다.');
  P('  버전 번호가 든 이름은 결과가 일정한 대신, 1년쯤 지나면 종료될 수 있습니다.');

  P('');
  P('키를 여러 개 함께 쓰기');
  P('  · Gemini·OpenAI(ChatGPT)·Claude 키를 모두 넣어 둘 수 있습니다. 모델 이름을 보고 알맞은 키로 보냅니다.');
  P('  · [⚙️ 설정]의 [예비 모델]에 다른 회사 모델을 적어 두면, 주 모델이 한도 초과 등으로 실패할 때 대신 씁니다.');
  P('  · 입력 시트 [모델] 칸에서 학생마다 다른 모델을 골라도 됩니다. ChatGPT(Plus) 구독과 API 키는 따로입니다(API는 선불 충전).');
  P('  · 메뉴 ② 창에서 모델명을 적으면 저절로 연결을 확인하고 저장합니다. 시트에서 직접 고치면 ⏳ 확인 전 으로 표시되고, 창을 열면 확인합니다.');

  H('10. 비용 줄이기');
  P('AI API는 호출할 때마다 기억이 없어서 규칙을 매번 함께 보내야 합니다. 이 도구는 네 가지로 비용을 줄입니다.');
  P('  · 필요한 규칙만 조립: 그 활동의 기록종류·교과 규칙만 붙입니다(항상 켜짐).');
  P('  · 묶어 보내기: [⚙️ 설정] 한 번에 묶을 학생 수(기본 5). 규칙을 5번이 아니라 1번만 보내고, 호출 횟수도 1/5이라 무료 한도에도 유리합니다.');
  P('  · 생각 줄이기: [⚙️ 설정] 생각 줄이기(기본 TRUE). 모델의 "생각" 토큰은 출력 요금으로 청구되는데, 세특 글쓰기에는 깊은 추론이 필요 없습니다.');
  P('  · 자동 캐시 할인: 규칙 부분이 늘 앞에 같은 모양으로 가서, 같은 활동을 연달아 만들면 그 부분은 약 1/10 가격이 됩니다(조건이 맞을 때 회사가 자동 적용).');
  P('생성이 끝나면 알림에 실제로 쓴 토큰 수가 나옵니다. ⑧ 프롬프트 미리보기에서 규칙 부분의 길이도 볼 수 있습니다.');
  P('· 자동 고쳐쓰기는 [수정]이 나온 학생만 한 번 더 부르므로, 모든 학생을 두 번 부르는 것보다 훨씬 쌉니다.');
  P('');
  P('※ 스킬(Skills)·하네스와의 관계: 이 도구는 같은 생각을 시트 안에서 씁니다 — 필요한 규칙만 꺼내 조립하고(기록 항목별 기재 주의),');
  P('   생성 뒤 정해진 검사 → 걸린 것만 고쳐 쓰기를 돌립니다. 규칙을 Claude 스킬(zip)·Gemini Gem 으로 옮기려면 메뉴 ⑧ [AI 앱용 지침 내보내기].');

  H('11. 자주 막히는 곳');
  P('Q. 호출이 실패해요 → 메뉴 ② 아래 [모델 연결 테스트]. ✗ 옆에 이유가 나옵니다(모델명 오류 · 무료 등급 불가 · 한도 초과 · 키 오류).');
  P('Q. "모델명을 찾을 수 없습니다" → 모델이 종료됐거나 철자가 틀렸습니다. 위 9번의 공식 목록에서 새 이름으로 바꾸세요.');
  P('Q. 한 번에 많이 돌리면 중간에 멈춰요 → 실행 시간 제한(약 6분) 때문입니다. 남은 행은 체크가 그대로 있으니 한 번 더 누르세요.');
  P('Q. Gemini 무료 등급 → 분당 호출 제한이 있어 여러 명을 한꺼번에 돌리면 일부가 실패합니다. 나눠서 실행하세요.');
  P('Q. Gemini(구독)인데 결과가 없어요 → 결과 셀을 선택하고 [생성 및 삽입]을 눌러야 합니다(한 번에 350칸까지 함께 선택 가능).');
  P('Q. Gemini(구독)이 목록에 없어요 → 메뉴 ② [① 키 · 구독] 탭에서 [Gemini 구독으로 쓰기]를 켜세요.');
  P('   학교 계정은 학교에 Google AI Pro for Education 이 있어야 합니다. 빈 셀에 =AI("안녕") 을 넣어 [생성 및 삽입]이 뜨는지 보세요.');
  P('Q. 결과가 갱신 안 돼요 → 셀을 클릭하고 수식 끝에 공백 한 칸을 넣고 엔터(캐시 갱신).');
  P('Q. 새 활동이 취합에 없어요 → 메뉴 ⑦ 최종취합 시트 생성/갱신 을 다시 누르세요.');
  P('Q. 예시 시트에 [바이트]·[검증] 칸이 없어요 → 부가 기능 > 예시 시트 구조 복구 (예시 내용은 보존됩니다).');
  P('Q. 시트를 실수로 지웠어요 → 메뉴 ① 처음 설치 / 구조 복구 (기존 데이터는 보존됩니다).');
  P('Q. 메뉴가 화면 아래로 잘려요 → v3.6 부터 하위 메뉴로 묶었습니다. 예전 사본이면 이 판으로 다시 받아 주세요.');
  P('Q. 시작하기 시트의 버튼이 안 눌려요 → 휴대폰·태블릿 앱에서는 버튼이 동작하지 않습니다. 컴퓨터 브라우저에서 쓰거나 같은 이름의 메뉴를 누르세요. 버튼이 사라졌으면 [도움말 · 부가 기능] > [시작하기 시트 다시 만들기].');
  P('Q. 복사·붙여넣기 창에서 "빠진 학생"이 나와요 → 대화창 답에 [S번호] 표시가 없거나 비었습니다. 그 학생만 다시 요청하거나, 답을 고쳐 붙여 넣으세요.');
  P('Q. 기재요령이 바뀌었는데 규칙이 그대로예요 → 메뉴 ⑧ [기재요령 규칙 업데이트 확인]. 직접 고친 칸은 그대로 두므로 [📏 기재요령] 2행 문구와 비교해 보세요.');

  H('12. 📝 구글 설문지 연결');
  P('① 구글 설문지 편집 화면 → [응답] → [Sheets에 연결] → "기존 스프레드시트 선택" → 이 파일. 응답이 "설문지 응답 시트1" 탭으로 들어옵니다.');
  P('   학생 문항은 학번(또는 반·번호)과 이름을 단답형으로. 순서는 상관없고 이메일 수집을 켜도 됩니다. 보고서는 [파일 업로드] 문항으로.');
  P('② 메뉴 맨 위 [📝 구글 설문지 연결] → 응답 시트 · 학생 칸 · 보낼 곳(있는 시트, 새 📄 보고서 · ✍️ 바로 쓰기 · 새 활동) · 문항 → 칸을 고르고 [연결하고 지금 받아 오기].');
  P('   · 문항은 이름으로 맞춥니다(순서를 바꿔도 됨). 여러 문항을 한 칸으로 보내면 "문항: 답"으로 이어 붙입니다.');
  P('   · 같은 학생이 여러 번 내면 마지막 응답을 씁니다. 명단에 없는 학생은 줄을 더하거나(선택) 목록으로 알려 줍니다.');
  P('   · 선생님이 시트에서 고친 칸은 다시 받아 와도 덮어쓰지 않습니다(칸 메모 "📝 설문지에서 가져옴"으로 알아봄).');
  P('   · [응답이 오면 저절로 받아 오기]를 켜면 제출 때마다 받아 오고, [바로 세특 생성]을 켜면 그 학생만 생성합니다(API 키 필요).');
  P('   · 한 번에 다시 받으려면 [도움말 · 부가 기능] > [구글 설문지 응답 지금 받아 오기].');

  H('13. 함께 쓰면 좋은 도구 — 📄 스캔 문서 → 엑셀');
  P('업무 인수인계 대시보드(윈도우 프로그램, 같은 만든이)의 기능입니다. 손글씨 활동지·신청서를 스캔하면 AI가 글자 그대로 표로 읽어 엑셀로 저장합니다.');
  P('표를 복사해 이 시트의 ▸입력 노란 칸(또는 바로 쓰기의 [관찰 메모])에 붙여 넣으면 됩니다. 설치·사용법: 메뉴 [도움말 · 부가 기능] > [📄 스캔 문서 → 엑셀 사용 설명서].');

  var rows = L.map(function (r) { return [r[0] === '§' ? r[1] : r[1]]; });
  s.getRange(1, 1, rows.length, 1).setValues(rows);
  s.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  for (var i = 0; i < L.length; i++) {
    if (L[i][0] === '§') {
      s.getRange(i + 1, 1).setFontWeight('bold').setFontSize(13)
        .setBackground('#eceff1').setFontColor('#263238');
    }
  }
  s.setColumnWidth(1, 900);
  s.getRange(1, 1, rows.length, 1).setWrap(true).setVerticalAlignment('middle');
  s.getRange(rows.length + 2, 1).setValue('제작: 김해분성고 정현서 · 구조 개선 v3 · 문의와 개선 제안 환영합니다.')
    .setFontColor('#78909c');
}


/* ==========================================================================
   40_Roster.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 학생 명단 동기화
 * 명단 시트의 (학년)/반/번호/이름/성취수준을 모든 활동 입력 시트와 최종취합에 반영.
 * 이미 입력된 학생 데이터는 반·번호를 키로 보존하고, 키가 바뀌면 이름으로 한 번 더 찾는다.
 * 명단은 붙여넣기·엑셀·CSV 파일 어느 것으로도 넣을 수 있다(해석은 14_RosterParse.gs).
 */

/** 명단 방식: 명단 시트 머리글 첫 칸이 '학년'이면 'grade', 아니면 'class' */
function rosterMode_() {
  var s = sh_(APP.SH.ROSTER);
  if (!s || s.getLastRow() < 2) return 'class';
  return String(s.getRange(2, 1).getValue()).trim() === '학년' ? 'grade' : 'class';
}

/** 활동·취합·검토 시트의 첫 열 머리글 */
function classHead_(mode) { return (mode || rosterMode_()) === 'grade' ? '학년-반' : '반'; }

/**
 * 명단 읽기 — 머리글 이름으로 열을 찾으므로 [반·번호]·[학년·반·번호] 어느 방식이든 읽힌다.
 * cls 는 활동 시트 A열에 쓰는 표시값(학년 방식이면 "2-3"), id 는 "A열-번호".
 */
function getRoster_() {
  var s = shRequire_(APP.SH.ROSTER);
  var last = s.getLastRow();
  if (last < 3) return [];
  var width = Math.max(s.getLastColumn(), 4);
  var head = s.getRange(2, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  var ix = function (n) { return head.indexOf(n); };
  var iY = ix('학년'), iC = ix('반'), iN = ix('번호'), iName = ix('이름'), iL = ix('성취수준');
  if (iC < 0 || iN < 0 || iName < 0) { iY = -1; iC = 0; iN = 1; iName = 2; iL = 3; }   // 머리글이 지워진 옛 명단
  var v = s.getRange(3, 1, last - 2, width).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var year = iY >= 0 ? String(v[i][iY]).trim() : '';
    var clsRaw = v[i][iC], no = v[i][iN];
    if (!String(clsRaw).trim() && !String(no).trim()) continue;
    var cls = classLabel(year, clsRaw);
    var st = { year: year, clsRaw: clsRaw, cls: cls, no: no, name: v[i][iName],
               grade: iL >= 0 ? v[i][iL] : '', id: String(cls).trim() + '-' + String(no).trim() };
    st.label = studentLabel({ year: year, cls: clsRaw, no: no, name: st.name });
    out.push(st);
  }
  return out;
}

/* --------------------------------------------------------- 명단 불러오기 */
/** 메뉴 ③ — 파일·붙여넣기로 명단 넣기 */
function openRosterDialog(fromOnboard) {
  var t = HtmlService.createTemplateFromFile('UI_Roster');
  t.fromOnboard = !!fromOnboard;
  ui_().showModalDialog(t.evaluate().setWidth(720).setHeight(660), '학생 명단 불러오기');
}

function rosterDialogContext() {
  var cnt = 0;
  try { cnt = getRoster_().length; } catch (e) {}
  return { mode: rosterMode_(), count: cnt, head: ROSTER_HEAD, masked: maskName_() };
}

/**
 * 미리 보기 — 저장하지 않는다
 * @param {{rows?:Array<Array>, text?:string, mode:string}} p  파일에서 읽은 표(rows) 또는 붙여넣은 글(text)
 */
function rosterPreview(p) {
  var rows = p.rows || rosterTextToRows(p.text || '');
  var r = parseRosterRows(rows, p.mode || 'auto');
  var detected = (p.mode && p.mode !== 'auto') ? parseRosterRows(rows, 'auto').mode : r.mode;
  return {
    mode: r.mode, detected: detected, header: r.header, count: r.students.length,
    labels: r.students.slice(0, 300).map(studentLabel),
    students: r.students.slice(0, 300), skipped: r.skipped.slice(0, 20), skippedCount: r.skipped.length,
    warnings: r.warnings.slice(0, 10)
  };
}

/** 저장 — 명단 시트를 통째로 바꾸고 모든 활동 시트에 반영한다 */
function rosterSave(p) {
  var rows = p.rows || rosterTextToRows(p.text || '');
  var r = parseRosterRows(rows, p.mode || 'auto');
  if (!r.students.length) {
    throw new Error('명단을 알아보지 못했습니다. ' + (r.mode === 'grade' ? '학년, 반, 번호, 이름' : '반, 번호, 이름') +
                    ' 순서로 한 줄에 한 명씩 넣거나, 양식 파일을 내려받아 채워 주세요.');
  }
  writeRosterSheet_(r.students, r.mode);
  var n = syncRosterAll_();
  return { count: r.students.length, mode: r.mode, synced: n, warnings: r.warnings };
}

/** 명단 시트 다시 쓰기 (방식이 바뀌면 머리글과 열 수도 바뀐다) */
function writeRosterSheet_(students, mode) {
  var s = shOrCreate_(APP.SH.ROSTER);
  var head = ROSTER_HEAD[mode] || ROSTER_HEAD['class'];
  var n = head.length, W = 5;
  ensureCols_(s, W);
  var last = s.getLastRow();
  if (last >= 2) s.getRange(2, 1, last - 1, W).clearContent();
  s.getRange(2, 1, 1, W).setBackground(null).setFontColor(null);
  s.getRange(3, 1, Math.max(s.getMaxRows() - 2, 1), W).clearDataValidations().setBackground(null);
  s.getRange(2, 1, 1, n).setValues([head]);
  styleHeader_(s, 2, n);
  var need = 2 + students.length + 50;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows());
  if (students.length) {
    s.getRange(3, 1, students.length, n).setValues(students.map(function (st) { return rosterRowOf(st, mode); }));
  }
  s.getRange(3, 1, students.length + 50, n).setBackground(APP.COLORS.input);
  s.getRange(3, n, students.length + 50, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4', '5'], true).setAllowInvalid(true).build());
  (mode === 'grade' ? [60, 60, 60, 110, 100] : [70, 70, 110, 100]).forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
  rosterBanner_(s, mode);
}

function rosterBanner_(s, mode) {
  var n = (ROSTER_HEAD[mode] || ROSTER_HEAD['class']).length;
  banner_(s, Math.max(n, 5), '👤 학생명단 — ' + (mode === 'grade' ? '학년·반·번호 방식 (동아리·방과후)' : '반·번호 방식'),
    '메뉴 ③ [학생 명단 불러오기]에서 엑셀 양식을 내려받아 채운 뒤 파일을 올리면 한 번에 들어옵니다. ' +
    '여기서 직접 고쳤다면 메뉴 ③ 아래 [학생 명단 동기화]를 누르세요. 성취수준(1~5)은 과세특에만 쓰이며 비워 둬도 됩니다.');
}

/** 모든 활동 시트·취합 시트·검토 시트에 명단 반영. 반영한 활동 시트 수 */
function syncRosterAll_() {
  var roster = getRoster_();
  var done = 0;
  getActivities_().forEach(function (a) {
    if (a.inSheet && sh_(a.inSheet)) { syncRosterInto_(sh_(a.inSheet), roster); done++; }
  });
  if (compileSheets_().length) { try { buildCompileCore_(); } catch (e) {} }
  var rv = sh_(APP.SH.REVIEW);
  if (rv) { try { rv.getRange(3, 1).setValue(classHead_()); rv.getRange(4, 1).setNumberFormat('@'); } catch (e) {} }
  return done;
}

function syncRoster() {
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단] 시트에 학생을 먼저 입력하세요.\n(메뉴 ③ 학생 명단 불러오기)', ui_().ButtonSet.OK); return; }
  var done = syncRosterAll_();
  toast_('학생 ' + roster.length + '명 → 활동 시트 ' + done + '개 동기화 완료', APP.MENU);
}

/**
 * 시트의 A~D열(반/번호/이름/성취수준)을 명단에 맞춰 재배치.
 * 기존 행은 "반-번호"로 매칭해 E열 이후 내용을 그대로 따라 옮긴다.
 */
function syncRosterInto_(sheet, roster) {
  var head = APP.HEAD_ROW, first = APP.DATA_ROW;
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastCol < 4) return;

  var existing = {}, byName = {}, nameCount = {}, all = [];
  if (lastRow >= first) {
    var vals = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getValues();
    var forms = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getFormulas();
    for (var i = 0; i < vals.length; i++) {
      var id = String(vals[i][0]).trim() + '-' + String(vals[i][1]).trim();
      if (id === '-' && !String(vals[i][2]).trim()) continue;
      var row = [];
      for (var c = 0; c < lastCol; c++) row.push(forms[i][c] ? forms[i][c] : vals[i][c]);
      all.push(row);
      if (id !== '-') existing[id] = row;
      var nm = String(vals[i][2]).trim();
      if (nm) { nameCount[nm] = (nameCount[nm] || 0) + 1; byName[nm] = row; }
    }
  }

  var out = [], used = {}, taken = [];
  roster.forEach(function (st) {
    var row = existing[st.id];
    // 명단 방식을 바꿨거나 반이 바뀌어 id 가 달라져도, 이름이 한 명뿐이면 그 학생 자료를 따라 옮긴다
    var nm = String(st.name).trim();
    if (!row && nm && nameCount[nm] === 1 && !used[nm]) row = byName[nm];
    if (row) { used[nm] = true; taken.push(row); }
    row = row ? row.slice() : [];
    while (row.length < lastCol) row.push('');
    row[0] = st.cls; row[1] = st.no; row[2] = st.name; row[3] = st.grade;
    out.push(row);
  });
  // 명단에 없지만 학생 자료가 적힌 줄(직접 적은 줄, 명단에서 빠진 학생)은 지우지 않고 맨 아래에 남긴다
  all.forEach(function (row) {
    if (taken.indexOf(row) >= 0) return;
    var hasData = row.slice(4).some(function (v) {
      return v !== '' && v !== false && v !== null && !(typeof v === 'string' && v.charAt(0) === '=');
    });
    if (hasData) out.push(row);
  });
  sheet.getRange(head, 1).setValue(classHead_());

  var needRows = first + out.length - 1;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows() + 5);
  if (lastRow >= first) sheet.getRange(first, 1, Math.max(lastRow - first + 1, out.length), lastCol).clearContent();
  // "2-3" 이 날짜(2월 3일)로 바뀌지 않도록 첫 열은 글자 서식
  sheet.getRange(first, 1, Math.max(out.length, 1), 1).setNumberFormat('@');
  if (out.length) sheet.getRange(first, 1, out.length, lastCol).setValues(out);

  applyRowFormat_(sheet, out.length);
}

/** 데이터 영역 서식·체크박스·수식을 다시 입힌다 */
function applyRowFormat_(sheet, nRows) {
  if (!nRows) return;
  var first = APP.DATA_ROW, head = APP.HEAD_ROW;
  var cGen = colOf_(sheet, head, '생성');
  var cModel = colOf_(sheet, head, '모델');
  var cAi = colOf_(sheet, head, 'AI 결과');
  var cFinal = colOf_(sheet, head, '최종본');
  var cBytes = colOf_(sheet, head, '바이트');
  var cValid = colOf_(sheet, head, '검증');

  if (cGen) {
    sheet.getRange(first, cGen, nRows, 1).insertCheckboxes();
    var blanks = [];
    var cur = sheet.getRange(first, cGen, nRows, 1).getValues();
    for (var i = 0; i < nRows; i++) blanks.push([cur[i][0] === true]);
    sheet.getRange(first, cGen, nRows, 1).setValues(blanks);
  }
  if (cModel) sheet.getRange(first, cModel, nRows, 1).setDataValidation(modelValidation_());
  if (cAi) sheet.getRange(first, cAi, nRows, 1).setBackground(APP.COLORS.output).setWrap(true).setVerticalAlignment('top');
  if (cFinal) sheet.getRange(first, cFinal, nRows, 1).setBackground(APP.COLORS.paste).setWrap(true).setVerticalAlignment('top');
  if (cBytes && cFinal) {
    var f = [];
    for (var r = 0; r < nRows; r++) {
      var a1 = sheet.getRange(first + r, cFinal).getA1Notation();
      f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
    }
    sheet.getRange(first, cBytes, nRows, 1).setFormulas(f);
  }
  if (cValid) sheet.getRange(first, cValid, nRows, 1).setWrap(true).setVerticalAlignment('top').setFontSize(9);
  sheet.setRowHeights(first, nRows, 84);
}


/* ==========================================================================
   45_Rules.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — [📏 기재요령] 시트 · 규칙판 업데이트
 *
 * 검사(금지어·형식·맞춤법)는 이 시트의 표를 읽는다. 표가 없으면 코드에 든 2026 규칙판을 쓴다.
 * 새 학년도 규칙판은 RULES_URL(만든이의 GitHub)에서 받는다. 7일에 한 번 저절로 확인하고,
 * 메뉴 ⑧ [기재요령 규칙 업데이트 확인]으로 바로 확인할 수도 있다.
 * 업데이트는 "선생님이 손대지 않은 칸"만 바꾼다 — 고친 칸은 그대로 두고 무엇을 남겼는지 알린다.
 */

var RULES_HEAD = ['사용', '수준', '분류', '찾을 말(정규식)', '바르게(맞춤법)', '이유 · 근거', '출처'];
var RULES_PROP_ID = 'RULES_ID';
var RULES_PROP_AT = 'RULES_CHECKED_AT';
var __rulesCache = null;

/* ------------------------------------------------------------ 시트 */
/** 설치·복구: 표가 없으면 규칙판으로 채우고, 있으면 머리말만 새로 */
function buildRulesSheet() {
  var s = shOrCreate_(APP.SH.RULES);
  var n = RULES_HEAD.length;
  var hasRows = s.getLastRow() >= APP.DATA_ROW;
  if (!hasRows) {
    s.clear();
    writeRuleRows_(s, packRuleRows(RULES_2026));
    try { PropertiesService.getDocumentProperties().setProperty(RULES_PROP_ID, RULES_2026.id); } catch (e) {}
  }
  rulesBanner_(s, currentPackInfo_());
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([RULES_HEAD]);
  styleHeader_(s, APP.HEAD_ROW, n, '#5d4037');
  s.setFrozenRows(APP.HEAD_ROW);
  [56, 60, 120, 300, 120, 420, 120].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  __rulesCache = null;
  return s;
}

function rulesBanner_(s, info) {
  var n = RULES_HEAD.length;
  banner_(s, n, '📏 기재요령 규칙 — ' + info.year + '학년도 (규칙판 ' + info.id + ')',
    '맞춤법·금지어 검사, 생성 직후 [검증], 자동 고쳐쓰기가 이 표를 씁니다. 찾을 말은 정규식입니다(| 는 "또는"). ' +
    '[출처]가 "기재요령"·"맞춤법(기본)"인 줄은 새 학년도 규칙판이 나오면 저절로 바뀌고, [출처]에 "내 학교"라고 적어 더한 줄은 그대로 남습니다. ' +
    '줄을 끄려면 [사용] 체크를 푸세요. 확인: ' + (info.checked || '-') + ' · 출처: ' + (info.source || ''));
  ensureCols_(s, n);
  unmergeRow_(s, 2);
  s.getRange(2, 1, 1, n).merge().setValue('⚠️ ' + (info.aiNotice || AI_NOTICE_2026))
    .setBackground('#fdecea').setFontColor('#7f1d1d').setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  s.setRowHeight(2, 46);
}

/** 표 쓰기 — 규칙판 줄 + (있으면) 선생님이 더한 줄 */
function writeRuleRows_(s, rows) {
  var n = RULES_HEAD.length;
  var last = s.getLastRow();
  if (last >= APP.DATA_ROW) s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, n).clearContent().clearDataValidations();
  ensureRows_(s, APP.DATA_ROW + rows.length + 20);
  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, n).setValues(rows);
  var body = rows.length + 20;
  s.getRange(APP.DATA_ROW, 1, body, 1).insertCheckboxes();
  s.getRange(APP.DATA_ROW, 2, body, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['수정', '확인'], true).build());
  s.getRange(APP.DATA_ROW, 1, body, n).setWrap(true).setVerticalAlignment('top').setFontSize(10);
  s.getRange(APP.DATA_ROW, 4, body, 1).setBackground(APP.COLORS.input);
  __rulesCache = null;
}

/** 지금 표의 줄 [[...7칸]] (빈 줄 제외) */
function readRuleRows_(s) {
  var last = s.getLastRow();
  if (last < APP.DATA_ROW) return [];
  return s.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, RULES_HEAD.length).getValues()
    .filter(function (r) { return String(r[3]).trim() !== '' || String(r[2]).trim() !== ''; });
}

/** 검사에 쓸 규칙 전부 (실행 한 번 동안 기억) */
function rulesAll_() {
  if (__rulesCache) return __rulesCache;
  var list = [];
  try {
    var s = sh_(APP.SH.RULES);
    if (s) list = readRuleRows_(s).map(ruleFromRow).filter(function (r) { return r; });
  } catch (e) { list = []; }
  __rulesCache = list.length ? list : RULES_2026.rules;
  return __rulesCache;
}

/** 모든 검증이 부르는 한 곳 — 금지어·형식·맞춤법(+띄어쓰기) */
function inspect_(text, limitBytes) {
  return validateResult(text, limitBytes, rulesAll_(), []);
}

/** 지금 반영된 규칙판 정보 */
function currentPackInfo_() {
  var id = '';
  try { id = PropertiesService.getDocumentProperties().getProperty(RULES_PROP_ID) || ''; } catch (e) {}
  var p = RULES_2026;
  try {
    var saved = PropertiesService.getDocumentProperties().getProperty('RULES_INFO');
    if (saved) { var j = JSON.parse(saved); if (j && j.id) p = j; }
  } catch (e) {}
  return { id: id || p.id, year: p.year, checked: p.checked, source: p.source, aiNotice: p.aiNotice };
}

/** 메뉴: [📏 기재요령] 시트 열기 */
function openRulesSheet() {
  var s = sh_(APP.SH.RULES) || buildRulesSheet();
  ss_().setActiveSheet(s);
}

/* ------------------------------------------------------- 처음 설치 · 옛 사본 */
/**
 * v3.5 이전 사본을 2026 규칙으로 올린다 (처음 설치 / 구조 복구에서 부른다).
 *   · [📐 공통규칙] NEIS_RULES 가 예전 기본 문구 그대로면 2026 문구로
 *   · [🧩 기록종류]에 [기재 주의] 칸이 없으면 만들고 2026 주의를 채운다
 */
function migrateRules_() {
  var info = currentPackInfo_();
  var pack = RULES_2026;
  if (info.id !== RULES_2026.id) {
    try { var saved = JSON.parse(PropertiesService.getDocumentProperties().getProperty('RULES_PACK') || 'null'); if (saved && saved.id) pack = saved; } catch (e) {}
  }
  return {
    neis: syncNeisRules_(pack),
    records: syncRecordRules_(pack),
    chars: syncRecordChars_(pack)
  };
}

/** NEIS_RULES 칸: 'same' | 'updated' | 'kept' */
function syncNeisRules_(pack) {
  var s = sh_(APP.SH.COMMON);
  if (!s || !pack.neisRules) return 'same';
  var v = s.getRange(1, 1, Math.max(s.getLastRow(), 1), 3).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() !== 'NEIS_RULES') continue;
    var cur = normText(v[i][2]);
    if (cur === normText(pack.neisRules)) return 'same';
    if (!cur || knownOldTexts(pack, 'neisRules').indexOf(cur) >= 0) {
      s.getRange(i + 1, 3).setValue(pack.neisRules);
      return 'updated';
    }
    return 'kept';
  }
  return 'same';
}

/** [🧩 기록종류]의 [기재 주의] 칸 — 없으면 만들고, 손대지 않은 칸만 새 문구로. {updated:[], kept:[]} */
function syncRecordRules_(pack) {
  var out = { updated: [], kept: [] };
  var s = sh_(APP.SH.RECORD);
  if (!s || s.getLastRow() < 2) return out;
  var c = colOf_(s, 2, '기재 주의');
  if (!c) {
    c = s.getLastColumn() + 1;
    ensureCols_(s, c);
    s.getRange(2, c).setValue('기재 주의');
    styleHeader_(s, 2, c);
    s.setColumnWidth(c, 380);
    try { banner_(s, c, RECORD_BANNER_TITLE, RECORD_BANNER_NOTE); } catch (e) {}
  }
  var last = s.getLastRow();
  if (last < 3) return out;
  var keys = s.getRange(3, 1, last - 2, 1).getValues();
  var cells = s.getRange(3, c, last - 2, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim();
    if (!k || !pack.byRecord || pack.byRecord[k] === undefined) continue;
    var cur = normText(cells[i][0]), want = normText(pack.byRecord[k]);
    if (cur === want) continue;
    if (!cur || knownOldTexts(pack, 'byRecord', k).indexOf(cur) >= 0) {
      s.getRange(3 + i, c).setValue(pack.byRecord[k]).setWrap(true).setVerticalAlignment('top');
      out.updated.push(k);
    } else out.kept.push(k);
  }
  return out;
}

/** [🧩 기록종류]의 글자수 — 예전 기본값 그대로인 칸만 새 학년도 값으로. {updated:['진로 700→500'], kept:[]} */
function syncRecordChars_(pack) {
  var out = { updated: [], kept: [] };
  var s = sh_(APP.SH.RECORD);
  if (!s || s.getLastRow() < 3 || !pack.chars) return out;
  var cK = 1, cC = colOf_(s, 2, '글자수');
  if (!cC) return out;
  var last = s.getLastRow();
  var keys = s.getRange(3, cK, last - 2, 1).getValues();
  var vals = s.getRange(3, cC, last - 2, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim(), want = pack.chars[k];
    if (!k || !want) continue;
    var cur = Number(vals[i][0]) || 0;
    if (cur === want) continue;
    var known = [RULES_2026.chars[k]];
    PRESET_RECORD_TYPES.forEach(function (r) { if (r.key === k) known.push(r.chars); });
    (pack.history || []).forEach(function (h) { if (h && h.chars && h.chars[k]) known.push(Number(h.chars[k])); });
    if (known.indexOf(cur) >= 0) { s.getRange(3 + i, cC).setValue(want); out.updated.push(k + ' ' + cur + '→' + want + '자'); }
    else out.kept.push(k + ' ' + cur + '자(새 기준 ' + want + '자)');
  }
  return out;
}

/* ------------------------------------------------------- 원격 규칙판 */
function fetchRulePack_() {
  try {
    var res = UrlFetchApp.fetch(RULES_URL, { muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode();
    if (code === 404) return { ok: false, error: '업데이트 서버에 아직 규칙판이 없습니다' };
    if (code < 200 || code >= 300) return { ok: false, error: '업데이트 서버 응답 ' + code };
    var v = validatePack(res.getContentText());
    if (!v.ok) return { ok: false, error: '규칙판이 올바르지 않습니다: ' + v.errors.join(', ') };
    return { ok: true, pack: v.pack, warnings: v.errors };
  } catch (e) {
    return { ok: false, error: '업데이트 서버에 연결하지 못했습니다(' + String(e.message || e).slice(0, 80) + ')' };
  }
}

/**
 * 규칙판 반영 — 표의 기본 줄은 바꾸고 '내 학교' 줄은 남긴다. 손대지 않은 칸만 바꾼다.
 * @return {{id, rules:number, mine:number, neis:string, records:Object, chars:Object}}
 */
function applyRulePack_(pack) {
  var s = sh_(APP.SH.RULES) || buildRulesSheet();
  var mine = readRuleRows_(s).filter(function (r) { return !isPackRow(r[6]); });
  var rows = packRuleRows(pack).concat(mine);
  writeRuleRows_(s, rows);
  var dp = PropertiesService.getDocumentProperties();
  dp.setProperty(RULES_PROP_ID, pack.id);
  dp.setProperty('RULES_INFO', JSON.stringify({ id: pack.id, year: pack.year, checked: pack.checked, source: pack.source, aiNotice: pack.aiNotice }));
  try { dp.setProperty('RULES_PACK', JSON.stringify({ id: pack.id, neisRules: pack.neisRules, byRecord: pack.byRecord, chars: pack.chars, history: pack.history || [] })); } catch (e) {}
  rulesBanner_(s, currentPackInfo_());
  var rep = { id: pack.id, rules: rows.length - mine.length, mine: mine.length,
              neis: syncNeisRules_(pack), records: syncRecordRules_(pack), chars: syncRecordChars_(pack) };
  __rulesCache = null;
  return rep;
}

function packReportText_(rep) {
  var L = ['규칙판 ' + rep.id + ' 을(를) 반영했습니다.', '',
           '· 검사 규칙 ' + rep.rules + '줄' + (rep.mine ? ' (선생님이 더한 줄 ' + rep.mine + '개는 그대로)' : '')];
  L.push('· 기재 금지사항(공통규칙): ' + ({ updated: '새 문구로 바꿈', kept: '직접 고친 내용이 있어 그대로 둠 — [📏 기재요령] 2행과 비교해 보세요', same: '이미 같음' }[rep.neis] || rep.neis));
  if (rep.records.updated.length) L.push('· 기재 주의 바꿈: ' + rep.records.updated.join(', '));
  if (rep.records.kept.length) L.push('· 기재 주의 직접 고친 것 그대로: ' + rep.records.kept.join(', '));
  if (rep.chars.updated.length) L.push('· 글자수 바꿈: ' + rep.chars.updated.join(', '));
  if (rep.chars.kept.length) L.push('· 글자수 직접 바꾼 것 그대로: ' + rep.chars.kept.join(', ') + ' — 확인해 주세요');
  return L.join('\n');
}

/** 메뉴: 기재요령 규칙 업데이트 확인 */
function checkRulesUpdate() {
  var info = currentPackInfo_();
  var r = fetchRulePack_();
  try { PropertiesService.getDocumentProperties().setProperty(RULES_PROP_AT, String(Date.now())); } catch (e) {}
  if (!r.ok) {
    ui_().alert(APP.MENU, r.error + '\n\n지금 규칙판(' + info.id + ', ' + info.year + '학년도)을 그대로 씁니다.', ui_().ButtonSet.OK);
    return;
  }
  if (!packNewer(r.pack.id, info.id)) {
    ui_().alert(APP.MENU, '최신 규칙판을 쓰고 있습니다.\n\n규칙판 ' + info.id + ' · ' + info.year + '학년도 · 확인 ' + (info.checked || '-') +
      '\n\n7일마다 저절로 확인합니다.', ui_().ButtonSet.OK);
    return;
  }
  var go = ui_().alert(APP.MENU, '새 규칙판이 있습니다: ' + r.pack.id + ' (' + r.pack.year + '학년도, ' + r.pack.checked + ')\n' + r.pack.source +
    '\n\n지금 반영할까요? 선생님이 직접 고친 칸과 "내 학교" 규칙은 그대로 둡니다.', ui_().ButtonSet.YES_NO);
  if (go !== ui_().Button.YES) return;
  ui_().alert(APP.MENU, packReportText_(applyRulePack_(r.pack)), ui_().ButtonSet.OK);
}

/**
 * 7일에 한 번 저절로 확인 (생성·검사·시작하기에서 부른다). 실패해도 조용히 넘어간다.
 * 새 판이면 손대지 않은 칸만 바꾸고 알림을 띄운다.
 */
function autoRulesCheck_() {
  try {
    var dp = PropertiesService.getDocumentProperties();
    var at = Number(dp.getProperty(RULES_PROP_AT) || 0);
    if (Date.now() - at < RULES_CHECK_DAYS * 86400000) return null;
    dp.setProperty(RULES_PROP_AT, String(Date.now()));
    var r = fetchRulePack_();
    if (!r.ok || !packNewer(r.pack.id, currentPackInfo_().id)) return null;
    var rep = applyRulePack_(r.pack);
    toast_('기재요령 규칙판이 ' + rep.id + '(으)로 바뀌었습니다. [📏 기재요령] 시트를 확인하세요.', APP.MENU);
    return rep;
  } catch (e) { return null; }
}

/* ------------------------------------------------------- 셀 함수 */
/**
 * 시트 어디서나: =SAETEUK_CHECK(A2) 또는 =SAETEUK_CHECK(A2, 300)
 * 바이트 · 기재 금지 · 형식 · 맞춤법을 한 칸에 요약한다. AI 를 부르지 않는다.
 * @param {string} text  검사할 글
 * @param {number} chars 최대 글자 수(비우면 500)
 * @customfunction
 */
function SAETEUK_CHECK(text, chars) {
  var one = function (t) {
    t = String(t === null || t === undefined ? '' : t).trim();
    if (!t) return '';
    return formatIssues(inspect_(t, (Number(chars) || 500) * 3));
  };
  if (Array.isArray(text)) return text.map(function (r) { return r.map(one); });
  return one(text);
}


/* ==========================================================================
   50_Activity.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 활동 추가 / 복제 / 삭제 / 시트 생성
 */

var EXAMPLE_ROWS_DEFAULT = 3;   // 새 활동을 만들 때 준비되는 빈 예시 칸
var EXAMPLE_MAX = 8;            // 프롬프트에 넣을 예시 최대 개수

function sheetNameIn_(key) { return key + APP.SUFFIX.IN; }
function sheetNameEx_(key) { return key + APP.SUFFIX.EX; }

/** 시트 이름에 못 쓰는 문자 제거 */
function safeKey_(raw) {
  return String(raw || '').replace(/[\[\]\*\/\\\?:']/g, '').trim().slice(0, 20);
}

/** 시스템이 쓰는 열 이름 — 입력 항목이나 활동명으로 쓸 수 없습니다 */
var RESERVED_NAMES = ['반', '번호', '이름', '성취수준', '생성', '모델', 'AI 결과', '최종본',
                      '바이트', '검증', '합본', '합본 바이트', '압축', 'AI 압축결과', '예시번호'];

/**
 * 활동 생성 (마법사·직접추가 공용)
 * def = {key, name, recordKey, subjectKey, bytes(없으면 chars×3 → 기록종류 한도), columns, desc, examples:[{values:[],result:''}],
 *        mode?:'자동'|'바로쓰기'|'보고서', noExamples?:boolean}
 *   바로쓰기: 입력 항목을 정하지 않고 [관찰 메모] 한 칸에 자유롭게 적는 시트 (예시 시트 없이)
 */
function createActivity_(def) {
  var key = safeKey_(def.key || def.name);
  if (!key) throw new Error('활동키가 비었습니다.');
  if (getActivity_(key)) throw new Error('이미 같은 활동키가 있습니다: ' + key);
  if (sh_(sheetNameIn_(key)) || sh_(sheetNameEx_(key))) throw new Error('같은 이름의 시트가 이미 있습니다: ' + key);

  var name = String(def.name || key).trim();
  if (RESERVED_NAMES.indexOf(name) >= 0) {
    throw new Error('"' + name + '"은(는) 시스템이 쓰는 이름이라 활동명으로 쓸 수 없습니다. 다른 이름을 쓰세요.');
  }
  getActivities_().forEach(function (a) {
    if (a.name === name) throw new Error('같은 활동명이 이미 있습니다: ' + name + ' (최종취합에서 구분되지 않습니다)');
  });

  var cols = validateColumns_(def.columns);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, def.recordKey) || recs[0];
  var bytes = activityBytes({ bytes: def.bytes, chars: def.chars }, rec);
  migrateActivityBytes_();   // 예전 시트의 [글자수] 칸에 바이트를 적지 않게

  var mode = (def.mode === '바로쓰기' || def.mode === '보고서') ? def.mode : '자동';
  var inSheet = buildActivityInputSheet_(key, name, cols, rec, mode, bytes);
  var exSheet = def.noExamples ? null : buildActivityExampleSheet_(key, name, cols, def.examples || []);

  var s = shRequire_(APP.SH.ACTIVITY);
  var row = [key, name, rec.key, def.subjectKey || cfg_('기본 교과영역', '공통'),
             bytes, cols.join('|'), def.desc || '', mode, '',
             inSheet.getName(), exSheet ? exSheet.getName() : ''];
  s.appendRow(row);
  refreshActivityValidation_();

  try { syncRosterInto_(inSheet, getRoster_()); } catch (e) {}
  return { key: key, inSheet: inSheet.getName(), exSheet: exSheet ? exSheet.getName() : '' };
}

function buildActivityInputSheet_(key, name, cols, rec, mode, bytes) {
  return layoutInputSheet_(ss_().insertSheet(sheetNameIn_(key)), name, cols, rec, mode, bytes);
}

/** 입력 시트 왼쪽 위 제목 — 활동 이름과 분량(나눠 쓰면 "전체 ○ 중") */
function inputTitle_(name, rec, mode, bytes) {
  var cap = rec.chars * 3, b = Math.min(Number(bytes) || cap, cap);
  var mark = mode === '바로쓰기' ? '✍️ ' : mode === '보고서' ? '📄 ' : '▶ ';
  return mark + name + '\n' + rec.name + ' · ' +
    (b < cap ? b + '바이트(전체 ' + cap + ' 중)' : rec.chars + '자(' + cap + '바이트)');
}

/** 바이트 한도를 바꾼 뒤 입력 시트 제목만 다시 쓰기 */
function refreshInputTitle_(act) {
  var s = act.inSheet && sh_(act.inSheet);
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  if (!s || !rec) return;
  try { s.getRange(1, 1).setValue(inputTitle_(act.name, rec, act.mode, bytesFor_(act))); } catch (e) {}
}

/** 입력 시트의 머리말·헤더·폭·서식 (활동 만들 때와 입력 항목 바꿀 때 함께 씀) */
function layoutInputSheet_(s, name, cols, rec, mode, bytes) {
  var quick = mode === '바로쓰기', report = mode === '보고서';
  var head = ['반', '번호', '이름', '성취수준']
    .concat(cols)
    .concat(['생성', '모델', 'AI 결과', '최종본', '바이트', '검증']);
  head[0] = classHead_();                 // 학년·반·번호 방식이면 '학년-반'
  var n = head.length;

  splitBanner_(s, 3, n,
    inputTitle_(name, rec, mode, bytes),
    report
      ? '📄 보고서 세특 — ① [보고서]에 본문이나 드라이브 파일 링크(설문지 연결·폴더에서 가져오기)  →  ② 메뉴 ④⑤ [📄 보고서 요점 뽑기] 후 요점을 읽고 고치기, ' +
        '수업에서 본 것은 [교사 관찰 메모]  →  ③ 3~5명은 직접 써서 [⭐ 예시로 등록]  →  ④ 나머지 [생성] 체크 → 메뉴 ⑥ (요점이 빈 학생은 요점부터 뽑음)'
      : quick
      ? '바로 쓰기 — 입력 항목을 정하지 않고 [관찰 메모]에 자유롭게 적습니다.  AI 초안: [생성] 체크 → 메뉴 ⑥ (키가 없으면 복사·붙여넣기 창)  ·  ' +
        '직접 쓰기: [최종본]에 바로 쓰면 [검증]이 즉시 금지어·맞춤법을 검사합니다.  학생 줄은 명단에서 채워지고, 명단이 없으면 반·번호·이름을 직접 적어도 됩니다.'
      : '① 노란 칸에 학생 자료 입력  →  ② [모델] 선택  →  ③ [생성] 체크 또는 메뉴 ⑥ 체크된 행 생성  →  ' +
        '④ AI 결과를 확인하고 [최종본] 칸에 붙여넣어 다듬기(고치면 [검증]이 바로 다시 검사)  →  ⑤ 체크 해제(재호출·비용 방지)');
  s.getRange(2, 1).setValue('').setFontSize(8);
  s.setRowHeight(2, 8);

  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n);
  s.setFrozenRows(APP.HEAD_ROW);
  s.setFrozenColumns(3);

  // 폭
  s.setColumnWidth(1, 55); s.setColumnWidth(2, 55); s.setColumnWidth(3, 90); s.setColumnWidth(4, 80);
  var reportW = [260, 380, 260];   // 보고서 · 보고서 요점 · 교사 관찰 메모
  for (var i = 0; i < cols.length; i++) s.setColumnWidth(5 + i, quick ? 420 : report ? (reportW[i] || 230) : 230);
  var base = 4 + cols.length;
  s.setColumnWidth(base + 1, 60);   // 생성
  s.setColumnWidth(base + 2, 150);  // 모델
  s.setColumnWidth(base + 3, 420);  // AI 결과
  s.setColumnWidth(base + 4, 420);  // 최종본
  s.setColumnWidth(base + 5, 70);   // 바이트
  s.setColumnWidth(base + 6, 220);  // 검증

  s.getRange(APP.DATA_ROW, 5, 500, cols.length).setBackground(APP.COLORS.input)
    .setWrap(true).setVerticalAlignment('top');
  s.getRange(APP.DATA_ROW, 1, 500, 4).setBackground(APP.COLORS.lock);
  try { applyModelDropdown_(s, 500); } catch (e) {}   // 비워 두면 [⚙️ 설정]의 활동용 모델
  return s;
}

/**
 * 이미 만든 활동의 [입력 항목]·이름·개요 바꾸기.
 * 학생이 채워 둔 자료는 항목 이름으로 따라간다. 이름이 바뀐 항목은 새 항목으로 보고 비운다.
 * @param {string} key
 * @param {{name?:string, columns:(string|string[]), desc?:string}} p
 * @return {{kept:string[], added:string[], removed:string[], rows:number}}
 */
function updateActivity_(key, p) {
  var act = getActivity_(key);
  if (!act) throw new Error('활동을 찾을 수 없습니다: ' + key);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var oldCols = parseColumns(act.columns);
  var cols = validateColumns_(p.columns);
  var name = String(p.name || act.name).trim() || act.name;
  if (name !== act.name) {
    if (RESERVED_NAMES.indexOf(name) >= 0) throw new Error('"' + name + '"은(는) 시스템이 쓰는 이름이라 활동명으로 쓸 수 없습니다.');
    getActivities_().forEach(function (a) {
      if (a.key !== key && a.name === name) throw new Error('같은 활동명이 이미 있습니다: ' + name);
    });
  }
  var desc = p.desc === undefined ? act.desc : String(p.desc);

  var moved = { kept: [], added: [], removed: [] };
  cols.forEach(function (c) { (oldCols.indexOf(c) >= 0 ? moved.kept : moved.added).push(c); });
  oldCols.forEach(function (c) { if (cols.indexOf(c) < 0) moved.removed.push(c); });

  // 1) 입력 시트 — 학생별 자료를 항목 이름으로 옮겨 담는다
  var rows = 0;
  var inS = sh_(act.inSheet);
  if (inS) {
    var head = APP.HEAD_ROW, first = APP.DATA_ROW;
    var lastRow = inS.getLastRow(), lastCol = inS.getLastColumn();
    var oldHead = inS.getRange(head, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var ix = function (n) { return oldHead.indexOf(n); };
    var keep = ['생성', '모델', 'AI 결과', '최종본', '검증'];
    var data = lastRow >= first ? inS.getRange(first, 1, lastRow - first + 1, lastCol).getValues() : [];
    var out = data.map(function (r) {
      var row = [r[0], r[1], r[2], r[3]];
      cols.forEach(function (c) { var i = ix(c); row.push(i >= 0 ? r[i] : ''); });
      keep.forEach(function (h) { var i = ix(h); row.push(i >= 0 ? r[i] : (h === '생성' ? false : '')); });
      return row;
    }).filter(function (r) { return String(r[0]).trim() !== '' || String(r[2]).trim() !== ''; });
    rows = out.length;

    inS.clear();
    layoutInputSheet_(inS, name, cols, rec, act.mode, bytesFor_(act));
    if (out.length) {
      var n = 4 + cols.length + 6;
      ensureRows_(inS, first + out.length - 1);
      inS.getRange(first, 1, out.length, 1).setNumberFormat('@');
      // [바이트]는 수식이라 비워 두고 applyRowFormat_ 이 다시 넣는다
      var write = out.map(function (r) {
        return r.slice(0, 4 + cols.length + 4).concat(['', r[4 + cols.length + 4]]);
      });
      inS.getRange(first, 1, out.length, n).setValues(write);
      applyRowFormat_(inS, out.length);
    }
  }

  // 2) 예시 시트 — 같은 방식으로 옮긴다
  var exS = sh_(act.exSheet);
  if (exS) {
    var exHead = exS.getRange(APP.HEAD_ROW, 1, 1, exS.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    var exRows = [];
    var exLast = exS.getLastRow();
    if (exLast >= APP.DATA_ROW) {
      exS.getRange(APP.DATA_ROW, 1, exLast - APP.DATA_ROW + 1, exHead.length).getValues().forEach(function (r) {
        var values = cols.map(function (c) { var i = exHead.indexOf(c); return i >= 0 ? String(r[i] || '') : ''; });
        var ri = exHead.indexOf('결과');
        var result = ri >= 0 ? String(r[ri] || '').trim() : '';
        if (result || values.some(String)) exRows.push({ values: values, result: result });
      });
    }
    exS.clear();
    exampleLayout_(exS, name, cols);
    writeExampleRows_(exS, cols, exRows, APP.DATA_ROW, Math.max(EXAMPLE_ROWS_DEFAULT, exRows.length));
  }

  // 3) 활동목록 줄
  var list = shRequire_(APP.SH.ACTIVITY);
  var lh = list.getRange(2, 1, 1, list.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var set = function (colName, v) {
    var c = lh.indexOf(colName);
    if (c >= 0) list.getRange(act.__row, c + 1).setValue(v);
  };
  set('활동명', name);
  set('입력 항목', cols.join('|'));
  set('활동 개요', desc);

  // 4) 최종취합 시트의 활동 이름 열도 갱신
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { kept: moved.kept, added: moved.added, removed: moved.removed, rows: rows,
           inSheet: act.inSheet, exSheet: act.exSheet, name: name };
}

/** 입력 항목 검사 — 만들 때와 바꿀 때 같은 규칙 */
function validateColumns_(columns) {
  var cols = Array.isArray(columns) ? columns.map(function (c) { return String(c).trim(); }).filter(String) : parseColumns(columns);
  if (!cols.length) throw new Error('입력 항목을 1개 이상 적어 주세요.');
  if (cols.length > 12) throw new Error('입력 항목은 12개 이하로 해 주세요.');
  var seen = {};
  cols.forEach(function (c) {
    if (RESERVED_NAMES.indexOf(c) >= 0) throw new Error('입력 항목에 "' + c + '"은(는) 쓸 수 없습니다. 시스템이 쓰는 이름입니다.');
    if (seen[c]) throw new Error('입력 항목이 중복됩니다: ' + c);
    seen[c] = 1;
  });
  return cols;
}

function ensureRows_(sheet, need) {
  if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows() + 5);
}

function buildActivityExampleSheet_(key, name, cols, examples) {
  var s = ss_().insertSheet(sheetNameEx_(key));
  exampleLayout_(s, name, cols);
  var rows = Math.max(EXAMPLE_ROWS_DEFAULT, (examples || []).length);
  writeExampleRows_(s, cols, examples || [], APP.DATA_ROW, rows);
  return s;
}

/** 예시 시트의 머리말·헤더·폭 (구조가 깨졌을 때 복구용으로도 씀) */
function exampleLayout_(s, name, cols) {
  var head = ['예시번호'].concat(cols).concat(['결과', '바이트', '검증']);
  var n = head.length;
  banner_(s, n, '▶ ' + name + ' 예시',
    '모범 예시를 채울수록 AI 결과의 톤과 구조가 안정됩니다. 왼쪽에는 학생 자료를, [결과] 칸에는 선생님이 직접 쓴 문장을 넣으세요. ' +
    '비워 두어도 동작합니다. 칸이 모자라면 메뉴 [예시 칸 늘리기], 초안이 필요하면 [예시 더 만들기(AI)], ' +
    '써 놓은 예시가 기재요령에 걸리는지는 [예시 검증]으로 확인하세요.');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n, '#455a64');
  s.setFrozenRows(APP.HEAD_ROW);
  s.setColumnWidth(1, 70);
  for (var i = 0; i < cols.length; i++) s.setColumnWidth(2 + i, 230);
  s.setColumnWidth(n - 2, 440);  // 결과
  s.setColumnWidth(n - 1, 70);   // 바이트
  s.setColumnWidth(n, 220);      // 검증
  return n;
}

/**
 * 예시 행을 채우고 서식을 입힌다.
 * @param startRow 쓰기 시작 행, count 행 수
 */
function writeExampleRows_(s, cols, examples, startRow, count) {
  var n = 1 + cols.length + 3;
  var cResult = 1 + cols.length + 1;
  var need = startRow + count - 1;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 2);

  var firstNo = startRow - APP.DATA_ROW + 1;
  var rows = [];
  for (var e = 0; e < count; e++) {
    var ex = examples[e];
    var r = [firstNo + e];
    for (var c = 0; c < cols.length; c++) r.push(ex && ex.values ? (ex.values[c] || '') : '');
    r.push(ex ? (ex.result || '') : '');
    rows.push(r);
  }
  s.getRange(startRow, 1, count, cResult).setValues(rows)
    .setWrap(true).setVerticalAlignment('top');
  s.getRange(startRow, 2, count, cols.length).setBackground(APP.COLORS.input);
  s.getRange(startRow, cResult, count, 1).setBackground(APP.COLORS.output);

  var f = [];
  for (var i = 0; i < count; i++) {
    var a1 = s.getRange(startRow + i, cResult).getA1Notation();
    f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
  }
  s.getRange(startRow, cResult + 1, count, 1).setFormulas(f);
  s.getRange(startRow, cResult + 2, count, 1)
    .setWrap(true).setVerticalAlignment('top').setFontSize(9);
  s.setRowHeights(startRow, count, 96);
  return n;
}

/* --------------------------------------------------------- 직접 추가 UI */
function addActivityDialog() {
  var ui = ui_();
  var name = promptText_('활동 만들기 (1/4)', '활동 이름을 입력하세요.\n예) 수학탐구저널, 실험보고서, 전기전자 동아리 탐구');
  if (name === null) return;

  var recs = getRecordTypes_();
  var recList = recs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' (' + r.name + ', ' + r.chars + '자)'; }).join('\n');
  var recAns = promptText_('활동 만들기 (2/4)', '어떤 기록인가요? 번호를 입력하세요.\n\n' + recList);
  if (recAns === null) return;
  var rec = recs[Number(recAns) - 1];
  if (!rec) { ui.alert('번호가 올바르지 않습니다.'); return; }

  var subs = getSubjects_();
  var subList = subs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' — ' + r.name; }).join('\n');
  var subAns = promptText_('활동 만들기 (3/4)', '어느 교과·영역인가요? 번호를 입력하세요.\n창체·행발이면 "공통"을 고르세요.\n\n' + subList);
  if (subAns === null) return;
  var sub = subs[Number(subAns) - 1];
  if (!sub) { ui.alert('번호가 올바르지 않습니다.'); return; }

  var cols = promptText_('활동 만들기 (4/4)',
    '학생에게 받을 자료 항목을 쉼표로 나열하세요.\n예) 탐구주제, 선정이유, 탐구과정, 알게된점, 한계와 개선점');
  if (cols === null) return;

  try {
    var r = createActivity_({ key: name, name: name, recordKey: rec.key, subjectKey: sub.key, columns: cols, desc: '' });
    ui.alert(APP.MENU, '활동을 만들었습니다.\n\n입력 시트: ' + r.inSheet + '\n예시 시트: ' + r.exSheet +
      '\n\n[🗂 활동목록] 시트의 [활동 개요] 칸에 한두 줄 설명을 적으면 결과가 더 좋아집니다.', ui.ButtonSet.OK);
    ss_().setActiveSheet(sh_(r.inSheet));
  } catch (e) { ui.alert(APP.MENU, '오류: ' + e.message, ui.ButtonSet.OK); }
}

function promptText_(title, msg) {
  var res = ui_().prompt(title, msg, ui_().ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui_().Button.OK) return null;
  return res.getResponseText().trim();
}

/* ------------------------------------------------------------- 복제/삭제 */
function duplicateActivityDialog() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('복제할 활동이 없습니다.'); return; }
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_('활동 복제', '복제할 활동 번호를 입력하세요.\n\n' + list);
  if (ans === null) return;
  var src = acts[Number(ans) - 1];
  if (!src) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  var newName = promptText_('활동 복제', '새 활동 이름을 입력하세요.');
  if (!newName) return;
  try {
    var exs = readExampleRows_(src).map(function (e) {
      return { values: e.values, result: e.result };
    });
    var r2 = createActivity_({
      key: newName, name: newName, recordKey: src.recordKey, subjectKey: src.subjectKey,
      bytes: src.bytes, columns: src.columns, desc: src.desc, examples: exs
    });
    ui_().alert(APP.MENU, '복제 완료: ' + r2.inSheet, ui_().ButtonSet.OK);
  } catch (e) { ui_().alert(APP.MENU, '오류: ' + e.message, ui_().ButtonSet.OK); }
}

function deleteActivityDialog() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('삭제할 활동이 없습니다.'); return; }
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_('활동 삭제', '삭제할 활동 번호를 입력하세요.\n\n' + list);
  if (ans === null) return;
  var a = acts[Number(ans) - 1];
  if (!a) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  var c = ui_().alert(APP.MENU,
    '[' + a.key + '] 활동과 시트 2개(' + a.inSheet + ', ' + a.exSheet + ')를 삭제합니다.\n' +
    '입력한 학생 자료와 생성 결과도 함께 사라집니다. 되돌릴 수 없습니다.\n\n계속할까요?',
    ui_().ButtonSet.YES_NO);
  if (c !== ui_().Button.YES) return;
  [a.inSheet, a.exSheet].forEach(function (n) { var s = sh_(n); if (s) ss_().deleteSheet(s); });
  shRequire_(APP.SH.ACTIVITY).deleteRow(a.__row);
  toast_('삭제 완료: ' + a.key);
}

/* --------------------------------------------------------- 프롬프트 확인 */
function previewPrompt() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert('먼저 활동을 만드세요.'); return; }
  var cur = ss_().getActiveSheet().getName();
  var target = null;
  acts.forEach(function (a) { if (a.inSheet === cur || a.exSheet === cur) target = a; });
  if (!target) {
    var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key; }).join('\n');
    var ans = promptText_('프롬프트 미리보기', '활동 번호를 입력하세요.\n\n' + list);
    if (ans === null) return;
    target = acts[Number(ans) - 1];
    if (!target) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  }
  var p = promptFor_(target);
  var tok = estimateTokens(p);
  var batchN = Math.max(1, Math.min(10, Number(cfg_('한 번에 묶을 학생 수', 5)) || 1));
  var costLine = '규칙 부분 약 ' + fmtNum_(tok) + '토큰(추정)' +
    (batchN > 1 ? ' · 학생 ' + batchN + '명씩 묶어 보내므로 학생 1명당 약 ' + fmtNum_(Math.round(tok / batchN)) + '토큰' : ' · 학생마다 이만큼 보냄') +
    ' · 생각 줄이기 ' + (cfgBool_('생각 줄이기', true) ? '켜짐' : '꺼짐');
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:8px">' +
    '<div style="color:#555;margin-bottom:8px">활동 <b>' + escHtml_(target.key) + '</b> · ' +
    byteLen(p) + '바이트 · ' + escHtml_(costLine) + '</div>' +
    '<textarea style="width:100%;height:520px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;' +
    'border:1px solid #ccd;border-radius:6px;padding:10px" readonly>' + escHtml_(p) + '</textarea>' +
    '<p style="color:#777;font-size:12px">이 프롬프트는 [기록종류]·[교과영역]·[공통규칙]·[활동목록]에서 자동 조립됩니다. ' +
    '바꾸고 싶은 문장이 있으면 해당 시트를 고치면 모든 활동에 반영됩니다.</p></div>')
    .setWidth(820).setHeight(660);
  ui_().showModalDialog(html, '프롬프트 미리보기 — ' + target.name);
}

function escHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/* ==========================================================================
   52_Examples.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 예시 관리
 *
 * 예시는 결과 품질에 가장 크게 작용하는 입력입니다.
 * 동시에 가장 위험한 입력이기도 합니다. 예시가 기재요령을 어기면
 * AI가 그 표현을 그대로 따라 쓰기 때문입니다. 그래서 예시도 검증합니다.
 */

/** 현재(또는 지정) 시트가 어떤 활동의 예시 시트인지 */
function activityOfExampleSheet_(name) {
  var acts = getActivities_();
  for (var i = 0; i < acts.length; i++) if (acts[i].exSheet === name) return acts[i];
  return null;
}

/** 예시 시트를 고른다. 현재 시트가 예시/입력 시트면 그 활동을 쓰고, 아니면 물어본다. */
function pickExampleActivity_(title) {
  var cur = ss_().getActiveSheet().getName();
  var act = activityOfExampleSheet_(cur) || activityOfSheet_(cur);
  if (act) return act;
  var acts = getActivities_();
  if (!acts.length) { ui_().alert(APP.MENU, '먼저 활동을 만드세요.', ui_().ButtonSet.OK); return null; }
  if (acts.length === 1) return acts[0];
  var list = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var ans = promptText_(title || '활동 선택', '어느 활동인가요? 번호를 입력하세요.\n\n' + list);
  if (ans === null) return null;
  var a = acts[Number(ans) - 1];
  if (!a) { ui_().alert('번호가 올바르지 않습니다.'); return null; }
  return a;
}

/** 예시 시트의 마지막 데이터 행 (비어 있으면 DATA_ROW - 1) */
function lastExampleRow_(sheet) {
  var last = sheet.getLastRow();
  return last < APP.DATA_ROW ? APP.DATA_ROW - 1 : last;
}

/* ------------------------------------------------------------ 칸 늘리기 */
function addExampleRows() {
  var act = pickExampleActivity_('예시 칸 늘리기');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다: ' + act.exSheet, ui_().ButtonSet.OK); return; }
  var ans = promptText_('예시 칸 늘리기', '몇 칸을 더 만들까요? (1~10)\n\n현재 ' +
    readExampleRows_(act).length + '개가 채워져 있습니다.');
  if (ans === null) return;
  var n = Math.max(1, Math.min(10, Number(ans) || 3));
  var cols = parseColumns(act.columns);
  writeExampleRows_(s, cols, [], lastExampleRow_(s) + 1, n);
  ss_().setActiveSheet(s);
  toast_(n + '칸을 추가했습니다.', act.name);
}

/* -------------------------------------------------------------- 검증 */
function validateExamples() {
  var act = pickExampleActivity_('예시 검증');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cValid) {
    ui_().alert(APP.MENU,
      '이 예시 시트에는 [검증] 열이 없습니다.\n메뉴 [예시 시트 구조 복구]를 먼저 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var limit = bytesFor_(act);
  var rows = readExampleRows_(act);
  if (!rows.length) { toast_('채워진 예시가 없습니다.'); return; }

  var bad = 0, warn = 0;
  rows.forEach(function (e) {
    var v = inspect_(e.result, limit);
    s.getRange(e.row, cValid).setValue(formatIssues(v));
    if (!v.ok) bad++;
    else if (v.issues.length) warn++;
  });

  var used = Math.min(rows.length, EXAMPLE_MAX);
  var promptBytes = byteLen(readExamples_(act));
  var msg = '예시 ' + rows.length + '개 검증 완료.\n' +
    '· 수정 필요 ' + bad + '개 / 확인 권장 ' + warn + '개\n\n' +
    '프롬프트에 들어가는 예시: ' + used + '개 (' + promptBytes.toLocaleString() + '바이트)';
  if (rows.length > EXAMPLE_MAX) {
    msg += '\n※ 앞에서부터 ' + EXAMPLE_MAX + '개만 프롬프트에 들어갑니다.';
  }
  if (bad) {
    msg += '\n\n⚠ 예시에 남아 있는 위반 표현은 AI가 그대로 따라 씁니다. 먼저 고쳐 주세요.';
  }
  ss_().setActiveSheet(s);
  ui_().alert('예시 검증 — ' + act.name, msg, ui_().ButtonSet.OK);
}

/* ------------------------------------------------- 구조 복구 (구버전 시트) */
function repairExampleSheet() {
  var act = pickExampleActivity_('예시 시트 구조 복구');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }
  var cols = parseColumns(act.columns);
  var keep = readExampleRows_(act).map(function (e) {
    return { values: e.values, result: e.result };
  });
  s.clear();
  s.setFrozenRows(0);
  exampleLayout_(s, act.name, cols);
  writeExampleRows_(s, cols, keep, APP.DATA_ROW, Math.max(EXAMPLE_ROWS_DEFAULT, keep.length));
  ss_().setActiveSheet(s);
  toast_('구조를 복구했습니다. 예시 ' + keep.length + '개 보존.', act.name);
}

/* --------------------------------------------------- AI 로 예시 더 만들기 */
function generateMoreExamples() {
  var act = pickExampleActivity_('예시 더 만들기');
  if (!act) return;
  var s = sh_(act.exSheet);
  if (!s) { ui_().alert(APP.MENU, '예시 시트를 찾을 수 없습니다.', ui_().ButtonSet.OK); return; }

  var existing = readExampleRows_(act);
  var ans = promptText_('예시 더 만들기 (AI)',
    '몇 개를 더 만들까요? (1~5)\n\n' +
    '현재 채워진 예시: ' + existing.length + '개\n' +
    (existing.length ? '기존 예시의 톤을 따라가되 소재와 수준이 겹치지 않게 만듭니다.'
                     : '기존 예시가 없으면 활동 개요만 보고 만듭니다. 한 개라도 직접 써 두면 결과가 훨씬 좋아집니다.'));
  if (ans === null) return;
  var want = Math.max(1, Math.min(5, Number(ans) || 2));

  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  if (providerOf_(model) === 'subscription') {
    ui_().alert(APP.MENU,
      '예시 생성에는 API 키가 필요합니다.\n[⚙️ 설정]의 활동용 모델을 ' + DEFAULT_MODEL + ' 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.',
      ui_().ButtonSet.OK);
    return;
  }

  toast_('예시 ' + want + '개 생성 중…', act.name);
  var made;
  try {
    made = suggestExamples_(act, existing, want, model);
  } catch (e) {
    ui_().alert(APP.MENU, '생성 실패: ' + e.message, ui_().ButtonSet.OK);
    return;
  }
  if (!made.length) { ui_().alert(APP.MENU, 'AI 응답에서 예시를 찾지 못했습니다. 다시 시도해 보세요.', ui_().ButtonSet.OK); return; }

  var cols = parseColumns(act.columns);
  writeExampleRows_(s, cols, made, lastExampleRow_(s) + 1, made.length);
  ss_().setActiveSheet(s);

  // 만들어진 예시도 바로 검증해 둔다
  try { validateExamplesQuiet_(act); } catch (e) {}

  ui_().alert('예시 더 만들기 — ' + act.name,
    made.length + '개를 추가했습니다.\n\n' +
    '※ AI가 만든 초안입니다. 실제 학생 활동과 맞지 않는 내용이 섞일 수 있으니\n' +
    '   내용을 본인 수업에 맞게 고친 뒤 쓰세요. [검증] 칸도 함께 확인하세요.',
    ui_().ButtonSet.OK);
}

/** 알림 없이 검증만 다시 적는다 */
function validateExamplesQuiet_(act) {
  var s = sh_(act.exSheet);
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cValid) return;
  var limit = bytesFor_(act);
  readExampleRows_(act).forEach(function (e) {
    s.getRange(e.row, cValid).setValue(formatIssues(inspect_(e.result, limit)));
  });
}

/**
 * AI에게 예시를 요청한다.
 * @return [{values:[], result:''}]
 */
function suggestExamples_(act, existing, want, model) {
  var recs = getRecordTypes_(), subs = getSubjects_(), com = getCommon_();
  var rec = findByKey(recs, act.recordKey) || recs[0];
  var sub = findByKey(subs, act.subjectKey) || findByKey(subs, '공통');
  var cols = parseColumns(act.columns);
  var bytes = bytesFor_(act), chars = Math.floor(bytes / 3);

  var sys = [
    '당신은 학교생활기록부 특기사항 예시를 만드는 조수입니다.',
    '교사가 AI에게 보여 줄 "모범 예시"를 만드는 것이 임무입니다.',
    '',
    '# 출력 형식',
    '반드시 아래 JSON 하나만 출력한다. 설명·머리말·코드펜스를 붙이지 않는다.',
    '{"examples":[{"values":["항목1값","항목2값"],"result":"특기사항 예문"}]}',
    '- examples 는 정확히 ' + want + '개.',
    '- values 는 아래 입력 항목과 같은 순서, 같은 개수의 문자열 배열.',
    '- result 는 그 자료로 쓴 특기사항 본문 한 문단.',
    '',
    '# 입력 항목 (순서 고정)',
    cols.join(' | '),
    '',
    '# 대상 기록',
    rec.name + ' — ' + bytes + '바이트(한글 약 ' + chars + '자) 이내',
    rec.view || '',
    '',
    '# 활동',
    (act.name || '') + (act.desc ? ' — ' + act.desc : ''),
    '',
    '# 교과·영역 관점',
    (sub ? sub.comp : ''),
    '',
    '# result 가 지켜야 할 규칙',
    com.WRITING_RULES || '',
    '',
    com.NEIS_RULES || '',
    '',
    '# 다양성',
    '- ' + want + '개가 서로 다른 소재와 다른 수준을 다루도록 한다.',
    (rec.useGrade
      ? '- 성취수준이 높은 학생, 중간인 학생, 아직 부족한 학생이 고루 섞이게 한다. 부족한 경우도 노력한 지점과 성장 가능성을 담아 긍정적으로 쓴다.'
      : '- 적극적으로 주도한 경우, 묵묵히 맡은 몫을 해낸 경우, 시행착오를 겪은 경우가 섞이게 한다.'),
    '- 기존 예시와 소재가 겹치지 않게 한다.',
    '- values 는 교사가 실제로 적어 넣을 법한 길이로 짧게 쓴다. 한 항목당 한두 문장.'
  ].join('\n');

  var user;
  if (existing.length) {
    var shown = existing.slice(0, 3).map(function (e, i) {
      var parts = [];
      cols.forEach(function (c, ci) { if (e.values[ci]) parts.push(c + ': ' + e.values[ci]); });
      return '## 기존 예시' + (i + 1) + ' 입력\n' + parts.join('\n') + '\n## 기존 예시' + (i + 1) + ' 결과\n' + e.result;
    }).join('\n\n');
    user = '아래는 교사가 이미 써 둔 예시다. 이 톤과 문체를 그대로 따라가되, 소재와 수준이 겹치지 않는 새 예시 ' +
           want + '개를 만들어라.\n\n' + shown;
  } else {
    user = '기존 예시가 없다. 위 활동 설명과 입력 항목만 보고 예시 ' + want + '개를 만들어라.';
  }

  var raw = callWithBackup_(sys, user, model).text;
  var obj = parseJsonLoose_(raw);
  var arr = (obj && Array.isArray(obj.examples)) ? obj.examples
          : (Array.isArray(obj) ? obj : []);
  var limit = bytes;
  var out = [];
  arr.forEach(function (e) {
    if (!e || !e.result) return;
    var vals = Array.isArray(e.values) ? e.values : [];
    var norm = [];
    for (var c = 0; c < cols.length; c++) norm.push(String(vals[c] || '').trim());
    var res = cleanResult_(e.result);
    if (byteLen(res) > limit) res = trimToBytes(res, limit);
    out.push({ values: norm, result: res });
  });
  return out.slice(0, want);
}


/* ==========================================================================
   55_Wizard.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 활동 만들기 AI 마법사
 *
 * "프롬프트를 쓰는 일"을 없애는 것이 목적입니다.
 * 교사는 활동을 말로 설명하고, AI가 입력 항목·활동 개요·예시 초안을 제안하며,
 * 프롬프트 본문은 엔진이 조립합니다. 교사는 검토하고 [만들기]만 누릅니다.
 */

function openWizard() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Wizard')
    .setWidth(620).setHeight(680);
  // 모델리스: 대화상자를 열어 둔 채 시트를 계속 볼 수 있습니다.
  SpreadsheetApp.getUi().showModelessDialog(html, '활동 만들기 마법사');
}

/** 사이드바 초기 데이터 */
function wizardContext() {
  return {
    records: getRecordTypes_().map(function (r) {
      return { key: r.key, name: r.name, chars: r.chars, useGrade: r.useGrade };
    }),
    subjects: getSubjects_().map(function (s) {
      return { key: s.key, name: s.name, kind: s.kind };
    }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    models: modelChoices_(),
    defaultModel: normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL,
    hasKey: !!(getKey_('openai') || getKey_('gemini') || getKey_('anthropic')),
    columnSets: PRESET_COLUMN_SETS,
    activities: getActivities_().map(function (a) {
      return { key: a.key, name: a.name, columns: parseColumns(a.columns), desc: a.desc,
               recordKey: a.recordKey, subjectKey: a.subjectKey, inSheet: a.inSheet };
    })
  };
}

/**
 * 말로 쓴 설명 → 활동 정의(JSON) 제안
 * 선생님이 [입력 항목]이나 [활동 이름]을 직접 적었으면 그것을 그대로 쓰고, AI 는 나머지만 채운다.
 * @param {Object} p {text, recordKey, subjectKey, model, count, columns, name, previous}
 */
function wizardSuggest(p) {
  var fixedCols = p.columns ? validateColumns_(p.columns) : null;
  var fixedName = String(p.name || '').trim();
  var rec = findByKey(getRecordTypes_(), p.recordKey) || getRecordTypes_()[0];
  var sub = findByKey(getSubjects_(), p.subjectKey) || findByKey(getSubjects_(), '공통');
  var model = normModel(p.model) || normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var want = Math.max(1, Math.min(3, Number(p.count) || 1));
  if (providerOf_(model) === 'subscription') {
    throw new Error('마법사는 API 키가 필요합니다. 모델을 ' + DEFAULT_MODEL + ' 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.');
  }

  var system = [
    '당신은 학교생활기록부 기록 설계를 돕는 조수입니다.',
    '교사가 설명한 활동을 스프레드시트 입력 양식으로 바꾸는 것이 임무입니다.',
    '',
    '# 지켜야 할 것',
    '- 반드시 아래 JSON 하나만 출력한다. 설명, 머리말, 코드펜스를 붙이지 않는다.',
    '- name: 시트에 표시할 짧은 활동 이름(12자 이내).',
    '- key: 시트 이름에 쓸 짧은 식별자(공백 없이 8자 이내, 한글 가능).',
    (fixedCols
      ? '- columns: 교사가 직접 정했다. 아래 항목을 순서·글자까지 그대로 출력한다. 바꾸거나 더하거나 빼지 않는다.\n    ' +
        JSON.stringify(fixedCols)
      : '- columns: 교사가 학생 한 명당 채울 입력 항목 이름 배열. 3~6개.\n' +
        '    · 교사가 실제로 타이핑할 수 있을 만큼 짧고 구체적인 항목으로 만든다.\n' +
        '    · 결과(특기사항 문장) 자체를 입력 항목으로 넣지 않는다.\n' +
        '    · 활동의 과정이 드러나도록 구성한다(무엇을, 왜, 어떻게, 무엇을 알게 되었는지, 한계 등).'),
    (fixedName ? '- name: "' + fixedName + '" 을(를) 그대로 쓴다.' : ''),
    '- desc: 이 활동이 무엇인지 교사 시점에서 1~2문장으로 요약. AI가 맥락을 잡는 데 쓰인다.',
    '- examples: 예시 ' + want + '개. values는 columns와 같은 순서·같은 개수의 문자열 배열,',
    '    result는 그 자료로 쓴 특기사항 예문.',
    '    result는 명사형 어미(~함/~음/~임)를 쓰고, 학생을 지칭하는 주어와 특수문자를 쓰지 않으며,',
    '    ' + rec.chars + '자 이내여야 한다. 수상·자격증·어학점수·대학명은 절대 넣지 않는다.',
    (want > 1
      ? '    ' + want + '개는 서로 다른 소재와 다른 수준을 다루어야 한다. ' +
        (rec.useGrade
          ? '성취수준이 높은 학생과 아직 부족한 학생이 섞이게 하되, 부족한 경우도 노력한 지점과 성장 가능성을 담아 긍정적으로 쓴다.'
          : '주도한 경우와 시행착오를 겪은 경우가 섞이게 한다.')
      : ''),
    '',
    '# 대상 기록',
    rec.name + ' (' + rec.chars + '자 이내)',
    rec.view || '',
    '',
    '# 교과·영역',
    (sub ? sub.name : '공통'),
    '',
    '# 출력 형식',
    '{"name":"","key":"","columns":["",""],"desc":"","examples":[{"values":["",""],"result":""}]}'
  ].filter(function (x) { return x !== ''; }).join('\n');

  var user = '교사의 설명:\n' + String(p.text || '').trim();
  if (p.previous) {
    user += '\n\n직전에 제안한 초안:\n' + JSON.stringify(p.previous) +
            '\n\n위 초안을 교사의 요청에 맞게 수정해서 같은 JSON 형식으로 다시 출력하라.';
  }

  var raw = callWithBackup_(system, user, model).text;
  var def = parseJsonLoose_(raw);
  if (!def) def = {};
  if (fixedCols) def.columns = fixedCols;            // 선생님이 적은 항목이 우선
  if (fixedName) def.name = fixedName;
  if (!def.columns || !def.columns.length) {
    throw new Error('AI 응답을 이해하지 못했습니다. 설명을 조금 더 구체적으로 적거나, [입력 항목]을 직접 적어 주세요.');
  }
  def.key = safeKey_(def.key || def.name);
  def.chars = rec.chars;
  def.recordKey = rec.key;
  def.subjectKey = sub ? sub.key : '공통';
  if (!Array.isArray(def.examples)) def.examples = [];
  // 예문이 한도를 넘거나 마크다운이 섞여 오는 경우를 정리
  var limit = rec.chars * 3;
  def.examples = def.examples.filter(function (e) { return e && e.result; }).map(function (e) {
    var res = cleanResult_(e.result);
    if (byteLen(res) > limit) res = trimToBytes(res, limit);
    var vals = Array.isArray(e.values) ? e.values : [];
    var norm = [];
    for (var c = 0; c < def.columns.length; c++) norm.push(String(vals[c] || '').trim());
    return { values: norm, result: res };
  }).slice(0, want);
  return def;
}

/** 코드펜스·앞뒤 설명이 섞여 있어도 JSON을 뽑아낸다 */
function parseJsonLoose_(raw) {
  var t = String(raw || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {}
  // 흔한 깨짐: 말미 쉼표
  try { return JSON.parse(t.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1')); } catch (e2) {}
  return null;
}

/** 만들기 전에 실제 프롬프트를 확인 */
function wizardPreview(def) {
  var recs = getRecordTypes_(), subs = getSubjects_();
  if ((!def.examples || !def.examples.length) && def.key) {      // 이미 있는 활동이면 예시 시트의 예시를 함께 보여 준다
    var cur = getActivity_(def.key);
    if (cur) def.examples = readExampleRows_(cur).map(function (r) { return { values: r.values, result: r.result }; });
  }
  var rec = findByKey(recs, def.recordKey) || recs[0];
  var sub = findByKey(subs, def.subjectKey) || findByKey(subs, '공통');
  var cols = Array.isArray(def.columns) ? def.columns : parseColumns(def.columns);
  var blocks = [];
  (def.examples || []).forEach(function (ex, i) {
    if (!ex || !ex.result) return;
    var parts = [];
    cols.forEach(function (c, ci) {
      var v = ex.values ? ex.values[ci] : '';
      if (v) parts.push(c + ': ' + v);
    });
    blocks.push('## 예시' + (i + 1) + ' 입력\n' + parts.join('\n') +
                '\n## 예시' + (i + 1) + ' 결과\n' + ex.result);
  });
  var examples = blocks.join('\n\n');
  return buildPrompt({
    activity: {
      key: def.key, name: def.name, recordKey: rec.key, subjectKey: sub ? sub.key : '공통',
      chars: def.chars || rec.chars, columns: cols.join('|'), desc: def.desc, mode: '자동'
    },
    record: rec, subject: sub, common: getCommon_(),
    examples: examples, years: Number(cfg_('교사 경력(년)', 15))
  });
}

/**
 * 이미 만든 활동의 입력 항목·이름·개요 바꾸기 (AI 없이)
 * @param {{key:string, name?:string, columns:(string|string[]), desc?:string}} p
 */
function wizardApply(p) {
  var r = updateActivity_(p.key, { name: p.name, columns: p.columns, desc: p.desc });
  var s = sh_(r.inSheet);
  if (s) ss_().setActiveSheet(s);
  return r;
}

/** 확정 → 시트 생성 */
function wizardCreate(def) {
  var cols = Array.isArray(def.columns) ? def.columns : parseColumns(def.columns);
  var r = createActivity_({
    key: def.key, name: def.name, recordKey: def.recordKey, subjectKey: def.subjectKey,
    chars: def.chars, columns: cols.join('|'), desc: def.desc, examples: def.examples || []
  });
  var s = sh_(r.inSheet);
  if (s) ss_().setActiveSheet(s);
  return r;
}


/* ==========================================================================
   60_AI.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — AI 연결 · 모델
 * API 키는 UserProperties에 저장되어 사용자 계정별로 분리됩니다.
 * 사본을 다른 선생님과 공유해도 키는 넘어가지 않습니다.
 *
 * 모델은 [⚙️ 설정] 시트 아래 [🤖 모델 목록] 표에서 선생님이 직접 적습니다.
 * 표가 곧 드롭다운의 선택지이고, 연결 테스트 결과도 그 표에 남습니다.
 */

var SUBSCRIPTION_MODEL = 'Gemini(구독)';
/**
 * 키 없이 쓰기 — 시트가 프롬프트를 만들어 주면 선생님이 Gemini 앱(학교 계정)·ChatGPT·Claude 대화창에
 * 붙여 넣고, 받은 답을 다시 창에 붙여 넣는다. 키·비용·구독이 필요 없어 모든 계정에서 늘 고를 수 있다.
 */
var MANUAL_MODEL = '키 없이(복사·붙여넣기)';
var PROVIDERS = ['gemini', 'openai', 'anthropic'];
// [⚙️ 설정]의 항목|값|설명 열 폭에 맞춰 순서를 정했다 (C열이 넓은 설명 칸)
var MODEL_HEAD = ['모델명', '수준', '언제 쓰나', '회사', '연결 확인'];
var MODEL_FIELDS = ['model', 'level', 'memo', 'company', 'status'];
function modelCol_(field) { return MODEL_FIELDS.indexOf(field) + 1; }
var COMPANY_CHOICES = ['자동', 'Gemini', 'OpenAI', 'Claude'];
var TEST_SYSTEM = '짧게 답한다.';
var TEST_USER = '연결 확인입니다. "확인"이라고만 답하세요.';

var __modelCache = null;   // 한 번 실행하는 동안만 쓰는 표 캐시

/* ------------------------------------------------------------ 모델 표 */
/** [⚙️ 설정] 시트에서 모델 표 헤더가 있는 행. 없으면 0 */
function modelTableRow_(s) {
  if (!s) return 0;
  var last = s.getLastRow();
  if (!last) return 0;
  var v = s.getRange(1, 1, last, 2).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === MODEL_HEAD[0] && String(v[i][1]).trim() === MODEL_HEAD[1]) return i + 1;
  }
  return 0;
}

/** 표 읽기 → [{model, company, level, memo, status, row}] */
function readModelRowsAt_(s, head) {
  var out = [];
  var last = s.getLastRow();
  if (!head || last <= head) return out;
  var v = s.getRange(head + 1, 1, last - head, MODEL_HEAD.length).getValues();
  var seen = {};
  for (var i = 0; i < v.length; i++) {
    var get = function (f) { return v[i][modelCol_(f) - 1]; };
    var m = normModel(get('model'));
    if (!m || seen[m]) continue;
    seen[m] = true;
    out.push({
      model: m, company: String(get('company') || '자동').trim() || '자동',
      level: String(get('level') || ''), memo: String(get('memo') || ''), status: String(get('status') || ''),
      row: head + 1 + i
    });
  }
  return out;
}

function presetModelRows_() {
  return PRESET_MODELS.map(function (p) {
    return { model: p.model, company: '자동', level: p.level, memo: p.memo, status: '' };
  });
}

/** 지금 쓸 수 있는 모델 표 (표가 없으면 기본 목록) */
function readModelTable_() {
  if (__modelCache) return __modelCache;
  var s = sh_(APP.SH.CONFIG);
  var head = modelTableRow_(s);
  __modelCache = head ? readModelRowsAt_(s, head) : presetModelRows_();
  return __modelCache;
}

/** 표 쓰기 — head 행에 헤더, 그 아래에 rows. 아래쪽 남은 줄은 비운다 */
function writeModelTable_(s, head, rows) {
  var n = MODEL_HEAD.length;
  ensureCols_(s, n);
  var last = s.getLastRow();
  if (last > head) s.getRange(head + 1, 1, last - head, n).clearContent();
  s.getRange(head, 1, 1, n).setValues([MODEL_HEAD]);
  styleHeader_(s, head, n, '#35583f');
  if (rows.length) {
    s.getRange(head + 1, 1, rows.length, n).setValues(rows.map(modelRowValues_));
  }
  var body = Math.max(rows.length + 10, 20);   // 빈 줄도 몇 개 서식을 입혀 둔다
  if (head + body > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), head + body - s.getMaxRows());
  s.getRange(head + 1, 1, body, n).setWrap(true).setVerticalAlignment('top');
  s.getRange(head + 1, modelCol_('model'), body, 1).setBackground(APP.COLORS.input).setFontWeight('bold');
  s.getRange(head + 1, modelCol_('level'), body, 1).setFontWeight('bold').setFontColor('#35583f');
  s.getRange(head + 1, modelCol_('memo'), body, 1).setFontColor('#555555');
  s.getRange(head + 1, modelCol_('company'), body, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(COMPANY_CHOICES, true).setAllowInvalid(true).build());
  s.getRange(head + 1, modelCol_('status'), body, 1).setFontColor('#37474f');
  __modelCache = null;
}

function modelRowValues_(r) {
  var d = { model: r.model, level: r.level || '', memo: r.memo || '', company: r.company || '자동', status: r.status || '' };
  return MODEL_FIELDS.map(function (f) { return d[f]; });
}

/** 표에서 [회사]를 직접 고른 모델 → 회사 */
function companyMap_() {
  var map = {};
  readModelTable_().forEach(function (r) {
    var p = companyToProvider(r.company);
    if (p) map[r.model] = p;
  });
  return map;
}

/**
 * 드롭다운 선택지: 구독 + 표의 모델 + 설정에 적힌 모델.
 * 키를 넣은 회사의 모델과, 구독을 켰을 때만 Gemini(구독)을 보여 준다 — 못 쓰는 모델을 골랐다가 생성 때 실패하지 않도록.
 */
function modelChoices_() {
  var out = [SUBSCRIPTION_MODEL], seen = {};
  seen[SUBSCRIPTION_MODEL] = true;
  var add = function (m) { m = normModel(m); if (m && !seen[m]) { seen[m] = true; out.push(m); } };
  readModelTable_().forEach(function (r) { add(r.model); });
  add(cfg_('활동용 모델', DEFAULT_MODEL));
  add(cfg_('합본용 모델', DEFAULT_MODEL));
  var list = usableModels(out.filter(function (m) { return m !== MANUAL_MODEL; }), keyStatus_(), providerOf_);
  list.push(MANUAL_MODEL);          // 키가 없어도 늘 쓸 수 있는 길 — 맨 끝에
  return list;
}

/** 모델 칸의 드롭다운. 쓸 수 있는 모델이 하나도 없으면 null (드롭다운을 걷어 낸다) */
function modelValidation_() {
  var list = modelChoices_();
  if (!list.length) return null;    // 빈 목록은 구글이 받지 않는다
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(list, true)
    .setAllowInvalid(true)          // 목록에 없는 이름도 직접 적을 수 있게
    .setHelpText('API 키를 넣은 회사의 모델(구독을 켰으면 Gemini(구독)도)과 [키 없이(복사·붙여넣기)]만 나옵니다. 메뉴 ② [AI 연결 · 모델 설정]에서 키를 넣거나 구독을 켜세요.')
    .build();
}

/** 시트의 [모델] 열에 드롭다운을 입힌다 (헤더가 HEAD_ROW 에 있는 입력·취합 시트) */
function applyModelDropdown_(sheet, rows) {
  var c = colOf_(sheet, APP.HEAD_ROW, '모델');
  if (!c) return false;
  var n = rows || (sheet.getMaxRows() - APP.DATA_ROW + 1);
  if (n < 1) return false;
  sheet.getRange(APP.DATA_ROW, c, n, 1).setDataValidation(modelValidation_());
  return true;
}

/** 모델 목록이 바뀐 뒤 모든 입력·취합 시트와 설정 칸의 드롭다운을 새로 입힌다 */
function refreshModelDropdowns_() {
  __modelCache = null;
  var n = 0;
  try {
    getActivities_().forEach(function (a) {
      var s = a.inSheet && sh_(a.inSheet);
      if (s && applyModelDropdown_(s)) n++;
    });
  } catch (e) {}
  try {
    compileSheets_().forEach(function (s) {
      var rows = s.getLastRow() - APP.DATA_ROW + 1;
      if (rows > 0 && applyModelDropdown_(s, rows)) n++;
    });
  } catch (e) {}
  applyConfigModelDropdown_();
  return n;
}

/** [⚙️ 설정]의 활동용/합본용 모델 칸 */
function applyConfigModelDropdown_() {
  var s = sh_(APP.SH.CONFIG);
  if (!s || !s.getLastRow()) return;
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    var k = String(v[i][0]).trim();
    if (k === '활동용 모델' || k === '합본용 모델') s.getRange(i + 1, 2).setDataValidation(modelValidation_());
  }
}

/* ------------------------------------------------------------ 회사 판별 */
function providerOf_(model) {
  var m = normModel(model);
  if (!m || m === SUBSCRIPTION_MODEL) return 'subscription';
  if (m === MANUAL_MODEL) return 'manual';
  return companyMap_()[m] || guessProvider(m);
}

/* ------------------------------------------------------------ 키 보관 */
function props_() { return PropertiesService.getUserProperties(); }
function getKey_(p) { return props_().getProperty('KEY_' + p) || ''; }
function setKey_(p, v) {
  if (v) props_().setProperty('KEY_' + p, v);
  else props_().deleteProperty('KEY_' + p);
}
/** 회사별 키 보관 여부 + 구독 사용 여부 {gemini:true, openai:false, anthropic:false, subscription:false} */
function keyStatus_() {
  var has = {};
  PROVIDERS.forEach(function (p) { has[p] = !!getKey_(p); });
  has.subscription = subOn_();
  has.manual = true;
  return has;
}

/**
 * 지금 이 시트를 쓰는 구글 계정 — 학교(기관) 계정인지 개인 계정인지.
 * 학교 계정은 Gemini 앱(gemini.google.com)을 무료로 쓰고 입력 내용이 학습에 쓰이지 않는다(관리자가 켜 두었을 때).
 * @return {{email:string, domain:string, kind:'school'|'personal'|''}}
 */
function accountInfo_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  var domain = email.indexOf('@') > 0 ? email.split('@')[1].toLowerCase() : '';
  var kind = !domain ? '' : (/^(gmail|googlemail)\.com$/.test(domain) ? 'personal' : 'school');
  return { email: email, domain: domain, kind: kind };
}

/** 시작하기 2단계를 [키 없이]로 마쳤는지 (내 계정에 둔다) */
var MANUAL_PROP = 'MANUAL_OK';
function manualOn_() { try { return props_().getProperty(MANUAL_PROP) === '1'; } catch (e) { return false; } }
function setManual_(on) { props_().setProperty(MANUAL_PROP, on ? '1' : '0'); }
/** 이 모델을 지금 쓸 수 있는지(그 회사 키가 있는지, 구독이면 구독을 켰는지) */
function modelUsable_(model) { return providerUsable(providerOf_(model), keyStatus_()); }

/**
 * Gemini 구독(=AI 수식)을 쓰는지. 키처럼 내 계정(UserProperties)에 둔다 — 구독은 계정마다 다르므로.
 * 한 번도 정한 적이 없는데 설정에 Gemini(구독)이 골라져 있으면(v3.4 이전) 켠 것으로 본다.
 */
var SUB_PROP = 'SUB_GEMINI';
function subOn_() {
  var v = props_().getProperty(SUB_PROP);
  if (v === null || v === undefined) {
    var uses = false;
    try {
      uses = ['활동용 모델', '합본용 모델'].some(function (k) { return normModel(cfg_(k, '')) === SUBSCRIPTION_MODEL; });
    } catch (e) {}
    if (uses) setSub_(true);
    return uses;
  }
  return v === '1';
}
function setSub_(on) { props_().setProperty(SUB_PROP, on ? '1' : '0'); }

/** 설정 창 [① 키 · 구독] 의 구독 스위치 */
function saveSubscription(on) {
  var before = subOn_();
  setSub_(!!on);
  if (before !== !!on) { try { refreshModelDropdowns_(); } catch (e) {} }
  return { has: keyStatus_(),
           message: on ? 'Gemini 구독을 켰습니다. 모델 목록에 Gemini(구독)이 나옵니다.' : 'Gemini 구독을 껐습니다.' };
}

/** 설정 창: 구독이 있는지 시험 셀(=AI("안녕"))을 만들어 데려간다 */
function subProbeCreate() {
  var s = sh_(APP.SH.START) || buildStart();
  var r = s.getLastRow() + 2;
  if (r + 1 > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), r + 1 - s.getMaxRows());
  s.getRange(r, 1).setValue('🧪 구독 확인 — 바로 아래 셀을 누르면 뜨는 [생성 및 삽입]을 누르세요. 답이 들어오면 설정 창에서 [결과 확인]. 확인 뒤 두 줄은 지워도 됩니다.')
    .setFontWeight('bold').setBackground(APP.COLORS.input);
  var cell = s.getRange(r + 1, 1);
  cell.setFormula('=AI("한 단어로만 답하세요: 안녕")');
  ss_().setActiveSheet(s);
  cell.activate();
  return { a1: cell.getA1Notation() };
}

/** 시험 셀을 읽어 답이 있으면 구독을 켠다 */
function subProbeRead(p) {
  var s = sh_(APP.SH.START);
  var v = s && p && p.a1 ? String(s.getRange(p.a1).getDisplayValue() || '').trim() : '';
  if (!v || /^(loading|로드 중)/i.test(v)) {
    return { ok: false, message: '아직 답이 없습니다. 시험 셀을 누르고 [생성 및 삽입]을 누른 뒤 다시 확인하세요.' };
  }
  if (/^#/.test(v)) {
    return { ok: false, message: '셀에 ' + v.slice(0, 20) + ' 이(가) 보입니다 — 지금 계정(' + (accountInfo_().email || '?') +
      ')에서는 =AI 함수를 쓸 수 없습니다. [키 없이(복사·붙여넣기)]나 API 키를 쓰세요.' };
  }
  setSub_(true);
  try { refreshModelDropdowns_(); } catch (e) {}
  return { ok: true, has: keyStatus_(), message: '✓ 이 계정은 Gemini 구독(=AI)을 쓸 수 있습니다. 구독을 켰습니다. 답: ' + v.slice(0, 30) };
}

/* -------------------------------------------------------------- 설정 창 */
function openApiDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_ApiKey').setWidth(760).setHeight(640);
  ui_().showModalDialog(html, 'AI 연결 · 모델 설정');
}

/** 설정 창이 처음 열릴 때 필요한 것 전부 */
function getAiSettings() {
  return {
    has: keyStatus_(),
    rows: readModelTable_().map(function (r) {
      return { model: r.model, company: r.company, level: r.level, memo: r.memo, status: r.status };
    }),
    activity: normModel(cfg_('활동용 모델', DEFAULT_MODEL)),
    compile: normModel(cfg_('합본용 모델', DEFAULT_MODEL)),
    backup: normModel(cfg_('예비 모델', '')),
    thinkingLow: cfgBool_('생각 줄이기', true),
    batch: Number(cfg_('한 번에 묶을 학생 수', 5)) || 1,
    presets: presetModelRows_(),
    links: MODEL_LINKS,
    defaults: PROVIDER_DEFAULT_MODEL,
    fallback: DEFAULT_MODEL,
    manual: MANUAL_MODEL,
    account: accountInfo_()
  };
}

function saveKeys(obj) {
  var before = JSON.stringify(keyStatus_());
  PROVIDERS.forEach(function (p) {
    if (obj[p] === undefined) return;
    var v = String(obj[p] || '').trim();
    if (v === '__KEEP__') return;
    if (v === '__DELETE__') v = '';
    setKey_(p, v);
  });
  var has = keyStatus_();
  // 키가 생기거나 없어지면 시트의 [모델] 드롭다운에 나올 모델도 달라진다
  if (JSON.stringify(has) !== before) { try { refreshModelDropdowns_(); } catch (e) {} }
  var who = '';
  try { who = Session.getActiveUser().getEmail(); } catch (e) {}
  return { has: has, message: '저장했습니다. 키는 ' + (who || '내') + ' 계정에만 보관됩니다.' };
}

/**
 * 모델 표 저장 (설정 창은 바뀔 때마다 자동으로 부른다)
 * @param {{rows:Array, activity:string, compile:string, backup?:string, thinkingLow?:boolean, batch?:number}} p
 */
function saveModelSettings(p) {
  var s = sh_(APP.SH.CONFIG);
  if (!s) throw new Error('[⚙️ 설정] 시트가 없습니다. 메뉴 ① 처음 설치 / 구조 복구 를 먼저 실행하세요.');
  var seen = {}, rows = [];
  (p.rows || []).forEach(function (r) {
    var m = normModel(r.model);
    if (!m || m === SUBSCRIPTION_MODEL || m === MANUAL_MODEL || seen[m]) return;
    seen[m] = true;
    rows.push({ model: m, company: r.company || '자동', level: r.level || '', memo: r.memo || '', status: r.status || '' });
  });
  if (!rows.length) throw new Error('모델을 한 개 이상 적어 주세요.');

  var head = modelTableRow_(s);
  if (!head) { buildConfig(); head = modelTableRow_(s); }
  var before = readModelRowsAt_(s, head).map(function (r) { return r.model; }).join('|') +
               '#' + normModel(cfg_('활동용 모델', DEFAULT_MODEL)) + '#' + normModel(cfg_('합본용 모델', DEFAULT_MODEL));
  writeModelTable_(s, head, rows);

  var act = normModel(p.activity) || rows[0].model;
  var cmp = normModel(p.compile) || act;
  setCfg_('활동용 모델', act);
  setCfg_('합본용 모델', cmp);
  if (p.backup !== undefined) setCfg_('예비 모델', normModel(p.backup));
  if (p.thinkingLow !== undefined) setCfg_('생각 줄이기', !!p.thinkingLow);
  if (p.batch !== undefined) setCfg_('한 번에 묶을 학생 수', Math.max(1, Math.min(10, Number(p.batch) || 1)));

  // 이름이 바뀐 때만 모든 시트의 드롭다운을 새로 입힌다 (연결 확인 결과만 바뀐 저장은 가볍게)
  var after = rows.map(function (r) { return r.model; }).join('|') + '#' + act + '#' + cmp;
  var n = before === after ? 0 : refreshModelDropdowns_();
  return '저장됨 · 활동용 ' + act + ' · 합본용 ' + cmp +
         (n ? ' · 시트 ' + n + '곳의 모델 드롭다운 갱신' : '');
}

/**
 * 시트에서 모델 표를 직접 고치면 [연결 확인]을 "확인 전"으로 바꿔 둔다.
 * 단순 트리거라 여기서 AI를 부를 수는 없고(구글 제한), 메뉴 ② 창을 열면 자동으로 확인한다.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var s = e.range.getSheet();
    if (s.getName() === APP.SH.RULES) { markBadRegex_(e); return; }
    if (s.getName() !== APP.SH.CONFIG) { recheckOnEdit_(e); return; }
    var head = modelTableRow_(s);
    var r1 = e.range.getRow(), nr = e.range.getNumRows();
    if (!head || r1 + nr - 1 <= head) return;
    var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
    var hit = function (c) { return c1 <= c && c <= c2; };
    if (!hit(modelCol_('model')) && !hit(modelCol_('company'))) return;
    for (var r = Math.max(r1, head + 1); r < r1 + nr; r++) {
      var name = String(s.getRange(r, modelCol_('model')).getValue()).trim();
      s.getRange(r, modelCol_('status')).setValue(name ? UNCHECKED_MARK + ' — 메뉴 ② 를 열면 자동으로 확인합니다' : '');
    }
  } catch (err) {}
}
var UNCHECKED_MARK = '⏳ 확인 전';

/** [📏 기재요령]에서 찾을 말(정규식)을 고치면 깨진 식은 붉게 표시한다 */
function markBadRegex_(e) {
  var s = e.range.getSheet();
  var r1 = Math.max(e.range.getRow(), APP.DATA_ROW), r2 = e.range.getRow() + e.range.getNumRows() - 1;
  var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
  if (c1 > 4 || c2 < 4) return;
  for (var r = r1; r <= r2; r++) {
    var cell = s.getRange(r, 4), re = String(cell.getValue() || '');
    var bad = false;
    try { if (re) new RegExp(re); } catch (err) { bad = true; }
    cell.setBackground(bad ? APP.COLORS.warn : APP.COLORS.input);
    if (bad) s.getRange(r, 6).setValue('⚠ 정규식 오류 — 이 줄은 검사에 쓰이지 않습니다. 괄호·| 를 확인하세요.');
  }
}

/* ------------------------------------------------------------ 연결 확인 */
/**
 * 모델 하나 시험 호출 (설정 창에서 한 줄씩 부른다)
 * @param {{model:string, company?:string}} p
 * @return {{ok:boolean|null, model, provider, sec?, message, short?, kind?, skipped?}}
 */
function testModel(p) {
  var m = normModel(p && p.model);
  if (!m) return { ok: false, model: '', message: '모델명이 비었습니다.' };
  if (m === SUBSCRIPTION_MODEL) {
    return { ok: null, model: m, provider: 'subscription',
      message: '스크립트로는 시험할 수 없습니다. 빈 셀에 =AI("안녕")을 넣어 답이 나오면 사용 가능합니다.' };
  }
  if (m === MANUAL_MODEL) {
    return { ok: null, model: m, provider: 'manual',
      message: '키가 필요 없습니다. 생성할 때 복사·붙여넣기 창이 열립니다.' };
  }
  var prov = companyToProvider(p.company) || providerOf_(m);
  if (!prov || prov === 'subscription') {
    return { ok: false, model: m, provider: '', short: '회사를 모름',
      message: '어느 회사 모델인지 알 수 없습니다. [회사] 칸에서 Gemini·OpenAI·Claude 중 하나를 고르세요.' };
  }
  if (!getKey_(prov)) {
    return { ok: false, skipped: true, model: m, provider: prov, message: providerLabel(prov) + ' 키 없음' };
  }
  var t0 = Date.now();
  try {
    var r = callAI_(TEST_SYSTEM, TEST_USER, m, prov);
    return { ok: true, model: m, provider: prov, sec: ((Date.now() - t0) / 1000).toFixed(1),
             reply: String(r).slice(0, 20), message: '연결됨' };
  } catch (e) {
    return { ok: false, model: m, provider: prov, kind: e.kind || '', hint: e.hint || '',
             short: e.hint ? e.hint.split('.')[0] : '', message: e.message };
  }
}

function stamp_() {
  try { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d HH:mm'); }
  catch (e) { return ''; }
}

/** 표의 한 모델에 연결 확인 결과를 적는다 (표에 없으면 맨 아래에 추가) */
function recordModelStatus_(res, extra) {
  var s = sh_(APP.SH.CONFIG);
  var head = modelTableRow_(s);
  if (!head || !res || !res.model || res.model === MANUAL_MODEL || res.model === SUBSCRIPTION_MODEL) return;
  var rows = readModelRowsAt_(s, head);
  var text = modelStatusText(res, stamp_());
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].model === res.model) { s.getRange(rows[i].row, modelCol_('status')).setValue(text); __modelCache = null; return; }
  }
  var r = (rows.length ? rows[rows.length - 1].row : head) + 1;
  extra = extra || {};
  s.getRange(r, 1, 1, MODEL_HEAD.length).setValues([modelRowValues_({ model: res.model, company: extra.company,
    level: extra.level, memo: extra.memo || '직접 추가', status: text })]);
  __modelCache = null;
}

/** 메뉴: 모델 목록 전체 연결 테스트 → 표에 ✓/✗ 를 적고 요약을 띄운다 */
function testAllModels() {
  var t0 = Date.now();
  var list = readModelTable_().slice();
  var cur = [normModel(cfg_('활동용 모델', DEFAULT_MODEL)), normModel(cfg_('합본용 모델', DEFAULT_MODEL))];
  cur.forEach(function (m) {
    if (m && m !== SUBSCRIPTION_MODEL && m !== MANUAL_MODEL && !list.some(function (r) { return r.model === m; })) list.push({ model: m, company: '자동' });
  });
  var lines = [], okN = 0, badN = 0, noKey = {};
  for (var i = 0; i < list.length; i++) {
    if (Date.now() - t0 > 240000) { lines.push('… 시간이 오래 걸려 여기서 멈췄습니다. 다시 누르면 이어서 확인합니다.'); break; }
    toast_((i + 1) + '/' + list.length + ' ' + list[i].model + ' 확인 중…', '모델 연결 테스트');
    var res = testModel({ model: list[i].model, company: list[i].company });
    recordModelStatus_(res);
    if (res.skipped) { noKey[providerLabel(res.provider)] = true; continue; }
    if (res.ok) { okN++; lines.push('✓ ' + res.model + ' — ' + res.sec + '초'); }
    else { badN++; lines.push('✗ ' + res.model + ' — ' + (res.short || res.message)); }
  }
  var head = ['사용 중: 활동용 ' + cur[0] + ' · 합본용 ' + cur[1], ''];
  var tail = [];
  var nk = Object.keys(noKey);
  if (nk.length) tail.push('', '– 키가 없어 건너뜀: ' + nk.join(', ') + ' 모델');
  tail.push('', '결과는 [⚙️ 설정] 아래 모델 목록의 [연결 확인] 칸에도 적어 두었습니다.');
  if (badN) tail.push('✗ 가 뜬 모델은 이름을 고치거나 지우세요. 최신 이름은 메뉴 ② [AI 연결 · 모델 설정] > 도움말에서 확인할 수 있습니다.');
  ui_().alert('모델 연결 테스트 — 통과 ' + okN + ' / 실패 ' + badN,
    head.concat(lines.length ? lines : ['(시험할 모델이 없습니다 — 먼저 API 키를 넣으세요)']).concat(tail).join('\n'),
    ui_().ButtonSet.OK);
}

/** 예전 메뉴 이름 호환 */
function testConnection() { testAllModels(); }

/* ------------------------------------------------- 내 키로 쓸 수 있는 모델 */
/**
 * 각 회사에 "이 키로 쓸 수 있는 모델 목록"을 물어본다. 키가 있는 회사만.
 * @return {{gemini?:{ok, models?:string[], message?}, openai?:…, anthropic?:…}}
 */
function listAvailableModels() {
  var out = {};
  PROVIDERS.forEach(function (p) {
    var key = getKey_(p);
    if (!key) return;
    try {
      var ids = [];
      if (p === 'gemini') {
        var token = '', guard = 0;
        do {
          var j = fetchJson_('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000' +
            (token ? '&pageToken=' + encodeURIComponent(token) : '') + '&key=' + encodeURIComponent(key),
            { method: 'get', muteHttpExceptions: true }, 'Gemini');
          (j.models || []).forEach(function (x) {
            var methods = x.supportedGenerationMethods || [];
            if (methods.indexOf('generateContent') >= 0) ids.push(normModel(x.name));
          });
          token = j.nextPageToken || '';
        } while (token && ++guard < 5);
      } else if (p === 'openai') {
        var o = fetchJson_('https://api.openai.com/v1/models',
          { method: 'get', headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true }, 'OpenAI');
        (o.data || []).forEach(function (x) { ids.push(normModel(x.id)); });
      } else {
        var a = fetchJson_('https://api.anthropic.com/v1/models?limit=100',
          { method: 'get', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, muteHttpExceptions: true }, 'Anthropic');
        (a.data || []).forEach(function (x) { ids.push(normModel(x.id)); });
      }
      var seen = {};
      ids = ids.filter(function (m) { if (seen[m] || !isTextModel(p, m)) return false; seen[m] = true; return true; });
      out[p] = { ok: true, models: sortModelIds(ids) };
    } catch (e) {
      out[p] = { ok: false, message: e.hint || e.message };
    }
  });
  return out;
}

/* ------------------------------------------------------------- 호출 본체 */
/**
 * @param {string} system  조립된 프롬프트(규칙 전체) — 학생이 바뀌어도 똑같아서 회사 쪽 캐시 할인을 받는다
 * @param {string} user    학생 자료
 * @param {string} model
 * @param {string=} provider  회사를 직접 지정할 때(연결 테스트)
 * @param {{json?:boolean, schema?:Object, thinking?:boolean, parts?:Array<{mime:string, b64:string, name?:string}>}=} opts
 *        json: JSON 으로만 답하게(묶음 생성) · thinking:false 면 생각 줄이기를 끈다
 *        parts: 함께 보낼 파일(PDF·사진) — 보고서 요점 뽑기에서 쓴다
 * @return {string}
 */
function callAI_(system, user, model, provider, opts) {
  var m = normModel(model);
  var p = provider || providerOf_(m);
  if (p === 'subscription') throw new Error(SUBSCRIPTION_MODEL + ' 은(는) 셀 수식으로 동작합니다. 메뉴 ⑥ 대신 체크박스를 사용하세요.');
  if (p === 'manual') throw new Error(MANUAL_MODEL + ' 은(는) 스크립트가 부르지 않습니다. 메뉴 ⑥ 을 누르면 복사·붙여넣기 창이 열립니다.');
  if (!p) {
    throw new Error('"' + m + '" 이(가) 어느 회사 모델인지 알 수 없습니다. [⚙️ 설정] 아래 모델 목록의 [회사] 칸을 골라 주세요.');
  }
  var key = getKey_(p);
  if (!key) throw new Error(providerLabel(p) + ' API 키가 없습니다. 메뉴 > ② AI 연결 · 모델 설정 에서 입력하세요.');
  opts = opts || {};
  if (opts.thinking === undefined) opts.thinking = thinkLow_();

  if (p === 'openai') return callOpenAI_(key, m, system, user, opts);
  if (p === 'gemini') return callGemini_(key, m, system, user, opts);
  return callAnthropic_(key, m, system, user, opts);
}

/**
 * 주 모델이 실패하면 [⚙️ 설정]의 예비 모델로 한 번 더.
 * @return {{text:string, model:string, backup:boolean, reason?:string}}
 */
function callWithBackup_(system, user, model, opts) {
  try {
    return { text: callAI_(system, user, model, null, opts), model: normModel(model), backup: false };
  } catch (e) {
    var bk = normModel(cfg_('예비 모델', ''));
    if (!bk || bk === normModel(model) || bk === SUBSCRIPTION_MODEL || bk === MANUAL_MODEL) throw e;
    var bp = providerOf_(bk);
    if (!bp || !getKey_(bp)) throw e;
    var t = callAI_(system, user, bk, null, opts);
    return { text: t, model: bk, backup: true, reason: e.hint || e.message };
  }
}

/* 실행 한 번 동안만 기억하는 것들 */
var __thinkLow = null;       // [생각 줄이기] 설정
var __noThink = {};          // 생각 옵션을 거절한 모델
var __noJsonMode = {};       // JSON 모드를 거절한 모델
var __usage = null;          // 토큰 사용량

function thinkLow_() {
  if (__thinkLow === null) { try { __thinkLow = cfgBool_('생각 줄이기', true); } catch (e) { __thinkLow = true; } }
  return __thinkLow;
}

function usageReset_() { __usage = { calls: 0, input: 0, output: 0, cached: 0 }; }
function usageAdd_(input, output, cached) {
  if (!__usage) usageReset_();
  __usage.calls++;
  __usage.input += Number(input) || 0;
  __usage.output += Number(output) || 0;
  __usage.cached += Number(cached) || 0;
}
function fmtNum_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/** "호출 3번 · 입력 12,340 · 출력 5,210 토큰 (그중 캐시 할인 8,000)" */
function usageText_() {
  var u = __usage;
  if (!u || !u.calls) return '';
  return '호출 ' + u.calls + '번 · 입력 ' + fmtNum_(u.input) + ' · 출력 ' + fmtNum_(u.output) + ' 토큰' +
         (u.cached ? ' (입력 중 ' + fmtNum_(u.cached) + '은 캐시 할인)' : '');
}

function fetchJson_(url, options, label) {
  var delays = [0, 2000, 5000];
  var last = '', info = null, code = 0;
  for (var i = 0; i < delays.length; i++) {
    if (delays[i]) Utilities.sleep(delays[i]);
    var res;
    try { res = UrlFetchApp.fetch(url, options); }
    catch (e) {                              // 네트워크 오류·시간 초과
      last = String(e.message || e).slice(0, 160);
      info = { kind: 'server', retry: true, hint: '인터넷 연결이 잠시 끊겼거나 응답이 늦습니다. 잠시 뒤 다시 시도하세요.' };
      continue;
    }
    code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 200 && code < 300) {
      try { return JSON.parse(body); }
      catch (e) { throw new Error(label + ' 응답 해석 실패'); }
    }
    last = body.replace(/\s+/g, ' ').slice(0, 220);
    info = explainApiError(code, body);
    if (!info.retry) break;
  }
  var err = new Error(label + ' — ' + (info && info.hint ? info.hint + ' ' : '') + '[' + (code || '연결') + '] ' + last);
  err.kind = info ? info.kind : 'other';
  err.hint = info ? info.hint : '';
  err.code = code;
  throw err;
}

/** 400 오류가 특정 옵션 때문인지 */
function rejects_(e, re) { return e && e.code === 400 && re.test(String(e.message || '')); }

function callOpenAI_(key, model, system, user, opts) {
  opts = opts || {};
  var body = {
    model: model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: userContent_('openai', user, opts.parts) }]
  };
  var think = opts.thinking && !__noThink[model] ? thinkingFor('openai', model) : null;
  if (think) body.reasoning_effort = think.reasoning_effort;
  if (opts.json && !__noJsonMode[model]) body.response_format = { type: 'json_object' };
  var json;
  try {
    json = fetchJson_('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify(body), muteHttpExceptions: true
    }, 'OpenAI');
  } catch (e) {
    if (think && rejects_(e, /reasoning/i)) { __noThink[model] = true; return callOpenAI_(key, model, system, user, opts); }
    if (body.response_format && rejects_(e, /response_format|json/i)) { __noJsonMode[model] = true; return callOpenAI_(key, model, system, user, opts); }
    throw e;
  }
  var u = json.usage || {};
  usageAdd_(u.prompt_tokens, u.completion_tokens, u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens);
  var c = json.choices && json.choices[0];
  var txt = c && c.message && c.message.content;
  if (!txt) throw new Error('OpenAI 응답이 비었습니다.');
  return String(txt).trim();
}

function callGemini_(key, model, system, user, opts) {
  opts = opts || {};
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  var body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: userContent_('gemini', user, opts.parts) }]
  };
  var gen = {};
  var think = opts.thinking && !__noThink[model] ? thinkingFor('gemini', model) : null;
  if (think) gen.thinkingConfig = think;
  if (opts.json && !__noJsonMode[model]) {
    gen.responseMimeType = 'application/json';
    if (opts.schema) gen.responseSchema = opts.schema;
  }
  if (Object.keys(gen).length) body.generationConfig = gen;
  var json;
  try {
    json = fetchJson_(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true
    }, 'Gemini');
  } catch (e) {
    if (think && rejects_(e, /thinking/i)) { __noThink[model] = true; return callGemini_(key, model, system, user, opts); }
    if (gen.responseMimeType && rejects_(e, /schema|mime|json/i)) { __noJsonMode[model] = true; return callGemini_(key, model, system, user, opts); }
    throw e;
  }
  var um = json.usageMetadata || {};
  usageAdd_(um.promptTokenCount, (Number(um.candidatesTokenCount) || 0) + (Number(um.thoughtsTokenCount) || 0),
            um.cachedContentTokenCount);
  var cand = json.candidates && json.candidates[0];
  var parts = cand && cand.content && cand.content.parts;
  var txt = '';
  if (parts) parts.forEach(function (p) { if (p.text && !p.thought) txt += p.text; });
  if (!txt) throw new Error('Gemini 응답이 비었습니다. (안전 필터 또는 모델명 확인)');
  return txt.trim();
}

function callAnthropic_(key, model, system, user, opts) {
  opts = opts || {};
  // 규칙 부분에 캐시 표시 — 5분 안에 같은 활동을 다시 부르면 이 부분은 할인된 값으로 읽는다
  var json = fetchJson_('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model, max_tokens: (opts && opts.json) ? 8000 : 2000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent_('anthropic', user, opts.parts) }]
    }),
    muteHttpExceptions: true
  }, 'Anthropic');
  var u = json.usage || {};
  usageAdd_((Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0) + (Number(u.cache_creation_input_tokens) || 0),
            u.output_tokens, u.cache_read_input_tokens);
  var txt = '';
  (json.content || []).forEach(function (b) { if (b.type === 'text') txt += b.text; });
  if (!txt) throw new Error('Anthropic 응답이 비었습니다.');
  return txt.trim();
}

/**
 * 학생 자료 + 첨부 파일 → 회사별 메시지 모양. 첨부가 없으면 글 그대로(예전과 같은 요청).
 * HEIC 사진은 Gemini 만 읽는다 — 다른 회사면 빼고 그 사실을 글에 적는다.
 */
function userContent_(provider, user, parts) {
  if (!parts || !parts.length) return provider === 'gemini' ? [{ text: user }] : user;
  var skipped = [];
  var ok = parts.filter(function (f) {
    if (provider !== 'gemini' && /heic|heif/i.test(f.mime)) { skipped.push(f.name || 'HEIC 사진'); return false; }
    return true;
  });
  var text = user + (skipped.length ? '\n(이 모델이 읽지 못해 뺀 파일: ' + skipped.join(', ') + ' — JPG·PNG로 바꿔 주세요)' : '');
  if (provider === 'gemini') {
    return [{ text: text }].concat(ok.map(function (f) { return { inlineData: { mimeType: f.mime, data: f.b64 } }; }));
  }
  if (provider === 'openai') {
    return [{ type: 'text', text: text }].concat(ok.map(function (f) {
      return /pdf/.test(f.mime)
        ? { type: 'file', file: { filename: f.name || 'report.pdf', file_data: 'data:application/pdf;base64,' + f.b64 } }
        : { type: 'image_url', image_url: { url: 'data:' + f.mime + ';base64,' + f.b64 } };
    }));
  }
  return ok.map(function (f) {
    return /pdf/.test(f.mime)
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mime, data: f.b64 } };
  }).concat([{ type: 'text', text: text }]);
}

/** Gemini 구독(=AI 함수)용 수식 문자열 */
function subscriptionFormula_(system, user) {
  var text = system + '\n\n# 학생 자료\n' + user;
  return '=AI("' + text.replace(/"/g, '""') + '")';
}

/** 결과 문자열 정리 (마크다운·따옴표·줄바꿈 제거) */
function cleanResult_(t) {
  return String(t || '')
    .replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '')
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();
}


/* ==========================================================================
   70_Generate.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 생성 실행
 *
 * 한 학생의 흐름 (하네스):
 *   ① 규칙 조립(기록종류·교과·공통규칙·기재 주의 — 그 활동에 필요한 것만)
 *   ② 생성 → ③ 자동 검사([📏 기재요령] 표 + 맞춤법)
 *   ④ [수정]이 나오면 걸린 점만 짚어 한 번 더 고쳐 쓰게 한다(자동 고쳐쓰기)
 *   ⑤ (켜 두었으면) 학생 자료에 없는 내용이 들어갔는지 근거 확인
 * 키가 없거나 모델이 [키 없이(복사·붙여넣기)] 인 줄은 ②~⑤ 대신 복사·붙여넣기 창으로 넘긴다.
 * 📄 보고서 시트는 ①앞에 [보고서 요점]이 빈 학생의 요점을 먼저 뽑고, 한 명씩 생성한다(긴 자료가 예시를 덮지 않게).
 * ✒️ 내 문체 카드가 있으면 학생 자료 바로 뒤에 한 번 더 붙여 몇 번째 학생이든 같은 문체로 쓰게 한다.
 */

/** 한 번 실행에서 AI 호출에 쓸 시간 (Apps Script 한도 6분보다 여유 있게) */
var RUN_BUDGET_MS = 300000;

/** 현재 시트가 어떤 활동의 입력 시트인지 */
function activityOfSheet_(name) {
  var acts = getActivities_();
  for (var i = 0; i < acts.length; i++) if (acts[i].inSheet === name) return acts[i];
  return null;
}

function generateChecked() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) {
    if (recordKeyOfCompile_(sheet.getName())) { compileChecked(); return; }
    ui_().alert(APP.MENU, '활동 입력 시트에서 실행하세요.\n(시트 이름이 "○○ ▸입력" 인 시트)', ui_().ButtonSet.OK);
    return;
  }
  var rows = checkedRows_(sheet);
  if (!rows.length) { toast_('[생성] 체크된 행이 없습니다.'); return; }
  autoRulesCheck_();
  runGeneration_(act, sheet, rows);
}

function generateSelection() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트에서 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('데이터 행을 선택하세요.'); return; }
  runGeneration_(act, sheet, rows);
}

/** 메뉴 ⑥: 모델과 상관없이 체크된 행을 복사·붙여넣기로 */
function openManualForChecked() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) {
    if (recordKeyOfCompile_(sheet.getName())) { compileChecked({ manual: true }); return; }
    ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)나 최종취합 시트에서 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var rows = checkedRows_(sheet);
  if (!rows.length) rows = selectedRows_(sheet);
  if (!rows.length) { toast_('[생성]을 체크하거나 행을 선택하세요.'); return; }
  runGeneration_(act, sheet, rows, { manual: true });
}

function selectedRows_(sheet) {
  var r = sheet.getActiveRange();
  var rows = [];
  if (!r) return rows;
  for (var i = 0; i < r.getNumRows(); i++) {
    var row = r.getRow() + i;
    if (row >= APP.DATA_ROW) rows.push(row);
  }
  return rows;
}

function checkedRows_(sheet) {
  var c = colOf_(sheet, APP.HEAD_ROW, '생성');
  if (!c) return [];
  var last = sheet.getLastRow();
  if (last < APP.DATA_ROW) return [];
  var v = sheet.getRange(APP.DATA_ROW, c, last - APP.DATA_ROW + 1, 1).getValues();
  var rows = [];
  for (var i = 0; i < v.length; i++) if (v[i][0] === true) rows.push(APP.DATA_ROW + i);
  return rows;
}

/**
 * 이 학생 줄의 AI 자료(이름은 마스킹 설정을 따름). 자료가 비었으면 null.
 * block = 학생 자료만(근거 확인·고쳐쓰기에 씀), user = block + 문체 카드(생성 요청에 씀).
 * 보고서 시트에서 [보고서 요점]이 비고 [보고서]가 있으면 needsExtract.
 */
function studentJob_(act, sheet, row, rec, masked, tail) {
  var cols = parseColumns(act.columns);
  var vals = sheet.getRange(row, 5, 1, cols.length).getValues()[0];
  var filled = vals.some(function (v) { return String(v).trim() !== ''; });
  if (!filled) return null;
  var needsExtract = false;
  if (act.mode === '보고서') {
    var iR = cols.indexOf(REPORT_COL), iP = cols.indexOf(POINTS_COL);
    needsExtract = iP >= 0 && !String(vals[iP]).trim() && iR >= 0 && !!String(vals[iR]).trim();
  }
  var grade = sheet.getRange(row, 4).getValue();
  var block = blockFor_(act, vals, (rec && rec.useGrade) ? grade : '');
  if (!masked) block = '학생 이름: ' + sheet.getRange(row, 3).getValue() + '\n' + block;
  var who = sheet.getRange(row, 1, 1, 3).getValues()[0];
  return { row: row, block: block, user: block + (tail || ''), needsExtract: needsExtract,
           label: String(who[0]) + '반 ' + String(who[1]) + '번 ' + String(who[2]) };
}

/** 규칙 검사 + (기준 글이 있으면) 문체 검사 */
function inspectStyled_(txt, limit, ref) {
  var v = inspect_(txt, limit);
  var d = ref ? styleDrift(ref, txt) : null;
  if (d) v.issues.push(d);
  return v;
}

/**
 * 실제 생성 루프
 * @param {{manual?:boolean}=} opt  manual: 모든 줄을 복사·붙여넣기로
 */
function runGeneration_(act, sheet, rows, opt) {
  opt = opt || {};
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) { toast_('다른 생성 작업이 실행 중입니다.'); return; }
  var manualJobs = [], manualNote = '', extractPending = null;
  try {
    var maxN = Number(cfg_('1회 최대 생성 건수', 25));
    if (rows.length > maxN && !opt.manual) {
      ui_().alert(APP.MENU, '한 번에 ' + maxN + '건까지 처리합니다. 앞에서부터 ' + maxN + '건만 진행합니다.\n' +
        '(설정 시트에서 늘릴 수 있지만, 실행 시간 제한으로 실패할 수 있습니다.)', ui_().ButtonSet.OK);
      rows = rows.slice(0, maxN);
    }

    var head = APP.HEAD_ROW;
    var cGen = colOf_(sheet, head, '생성');
    var cModel = colOf_(sheet, head, '모델');
    var cAi = colOf_(sheet, head, 'AI 결과');
    var cValid = colOf_(sheet, head, '검증');
    var limit = bytesFor_(act);
    var system = promptFor_(act);
    var defModel = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
    var autoValidate = cfgBool_('결과 자동검증', true);
    var autoRepair = cfgBool_('자동 고쳐쓰기', true);
    var autoGround = cfgBool_('근거 자동 확인', false);
    var batchN = Math.max(1, Math.min(10, Number(cfg_('한 번에 묶을 학생 수', 5)) || 1));
    if (act.mode === '보고서') batchN = 1;     // 보고서는 자료가 길어 한 명씩 — 예시가 묻히지 않게
    var rec = findByKey(getRecordTypes_(), act.recordKey);
    var masked = maskName_();
    var tail = styleTail_();
    var styleRef = styleReference_(act);
    var has = keyStatus_();
    var anyApi = has.gemini || has.openai || has.anthropic;
    usageReset_();

    var okN = 0, skipN = 0, errN = 0, subN = 0, leftN = 0, backupN = 0, fixN = 0;
    var t0 = Date.now();

    // 1) 행마다 학생 자료와 모델을 먼저 모은다
    var jobs = [], extractRows = [];
    rows.forEach(function (row) {
      var job = studentJob_(act, sheet, row, rec, masked, tail);
      if (!job) { skipN++; if (cGen) sheet.getRange(row, cGen).setValue(false); return; }
      if (job.needsExtract) { extractRows.push(row); return; }
      var model = cModel ? normModel(sheet.getRange(row, cModel).getValue()) : '';
      job.model = model || defModel;
      var prov = providerOf_(job.model);
      // 키 없이 쓰기: 고른 모델이 복사·붙여넣기이거나, API 키가 하나도 없는데 키가 필요한 모델이면
      if (opt.manual || prov === 'manual' || (!anyApi && prov !== 'subscription' && !providerUsable(prov, has))) {
        if (!opt.manual && prov !== 'manual') {
          manualNote = 'API 키가 없어 [키 없이 — 복사·붙여넣기]로 진행합니다. 키를 넣으면 메뉴 ⑥ 한 번으로 자동 생성됩니다.';
        }
        manualJobs.push(job);
        return;
      }
      jobs.push(job);
    });

    // 1-1) 📄 보고서: 요점이 빈 학생은 요점부터 — API 면 뽑고 바로 이어서 생성, 키가 없으면 요점 창만 연다
    if (extractRows.length) {
      if (!opt.manual && apiModelForChecks_()) {
        var ex = runExtraction_(act, sheet, extractRows, { quiet: true });
        ex.rows.forEach(function (row) {
          var j = studentJob_(act, sheet, row, rec, masked, tail);
          if (!j) return;
          var pv = providerOf_(j.model = (cModel ? normModel(sheet.getRange(row, cModel).getValue()) : '') || defModel);
          if (pv === 'manual' || (!anyApi && pv !== 'subscription' && !providerUsable(pv, has))) manualJobs.push(j); else jobs.push(j);
        });
        if (ex.failed) errN += ex.failed;
      } else {
        extractPending = extractRows;
      }
    }

    var finish = function (job, res, repaired) {
      var txt = cleanResult_(res.text);
      sheet.getRange(job.row, cAi).setValue(txt);
      if (autoValidate && cValid) {
        var v = formatIssues(inspectStyled_(txt, limit, styleRef));
        if (repaired) v += '\n(자동 고쳐쓰기 1회)';
        if (res.backup) v += '\n(예비 모델 ' + res.model + ' 로 생성)';
        if (res.ground) v += '\n' + res.ground;
        sheet.getRange(job.row, cValid).setValue(v);
      }
      if (cGen) sheet.getRange(job.row, cGen).setValue(false);
      okN++; if (res.backup) backupN++;
    };
    var fail = function (job, e) {
      sheet.getRange(job.row, cAi).setValue('⚠ 실패: ' + e.message);
      if (cGen) sheet.getRange(job.row, cGen).setValue(false);
      errN++;
    };
    /** ③~⑤ 검사 → 고쳐쓰기 → 근거 확인 */
    var polish = function (job, res) {
      var repaired = false;
      if (autoRepair && Date.now() - t0 < RUN_BUDGET_MS) {
        var draft = cleanResult_(res.text);
        var v1 = inspect_(draft, limit);
        if (needsRepair(v1)) {
          try {
            var fixList = v1.issues.filter(function (x) { return x.level === 'block'; });
            var r2 = callWithBackup_(system, buildRepairUser(job.block, draft, fixList, limit) + tail, res.model || job.model);
            var t2 = cleanResult_(r2.text);
            if (t2 && betterResult(v1, inspect_(t2, limit)) === 'b') {
              res = { text: t2, model: r2.model, backup: res.backup || r2.backup };
              repaired = true; fixN++;
            }
          } catch (e) {}
        }
      }
      if (autoGround && Date.now() - t0 < RUN_BUDGET_MS) {
        try { res.ground = groundText_(groundCheck_(job.block, cleanResult_(res.text), res.model || job.model)); } catch (e) {}
      }
      finish(job, res, repaired);
    };

    // 2) 같은 모델끼리 batchN 명씩 묶어서 부른다
    var i = 0;
    while (i < jobs.length) {
      // Apps Script 한 번 실행은 약 6분까지. 넘기기 전에 멈추고, 남은 행은 체크를 그대로 둔다.
      if (Date.now() - t0 > RUN_BUDGET_MS) { leftN = jobs.length - i; break; }
      var first = jobs[i];
      if (providerOf_(first.model) === 'subscription') {
        sheet.getRange(first.row, cAi).setFormula(subscriptionFormula_(system, first.user));
        subN++; i++;
        continue;   // 수식 결과는 시트가 계산하므로 체크 유지
      }
      var chunk = [first], k = i + 1;
      while (chunk.length < batchN && k < jobs.length && jobs[k].model === first.model) { chunk.push(jobs[k]); k++; }
      i = k;
      toast_((i) + '/' + jobs.length + ' 생성 중… (' + first.model + (chunk.length > 1 ? ' · ' + chunk.length + '명 묶음' : '') + ')', act.name);

      var got = chunk.length > 1 ? generateBatch_(system, chunk, first.model, tail) : {};
      if (got.error) { chunk.forEach(function (job) { fail(job, got.error); }); SpreadsheetApp.flush(); continue; }
      chunk.forEach(function (job) {
        try {
          polish(job, got[job.row] || callWithBackup_(system, job.user, job.model));
        } catch (e) { fail(job, e); }
      });
      SpreadsheetApp.flush();
    }

    var msg = '완료 ' + okN + '건';
    if (fixN) msg += ' (그중 자동 고쳐쓰기 ' + fixN + '건)';
    if (subN) msg += ' / 구독수식 ' + subN + '건(AI 결과 칸을 선택하고 [생성 및 삽입]을 눌러 주세요)';
    if (skipN) msg += ' / 자료 없음 ' + skipN + '건';
    if (errN) msg += ' / 실패 ' + errN + '건';
    if (backupN) msg += ' / 예비 모델 ' + backupN + '건';
    var used = usageText_();
    if (leftN) {
      ui_().alert(APP.MENU, msg + '\n\n실행 시간 제한(약 6분)에 가까워져 ' + leftN + '건을 남기고 멈췄습니다.\n' +
        '남은 행은 [생성] 체크가 그대로 있으니 메뉴 ⑥ 을 한 번 더 누르세요.\n' +
        '(자주 멈춘다면 [⚙️ 설정]의 1회 최대 생성 건수를 줄이거나 더 빠른 모델을 쓰세요)' +
        (used ? '\n\n' + used : ''), ui_().ButtonSet.OK);
    } else if (jobs.length || skipN) toast_(msg + (used ? '\n' + used : ''), act.name);
  } finally { lock.releaseLock(); }

  // 3) 키 없이 + 보고서 요점이 빈 학생 — 요점 창부터 (창은 한 번에 하나만 열린다)
  if (extractPending && extractPending.length) {
    runExtraction_(act, sheet, extractPending, { manual: true });
    return;
  }
  // 4) 키 없이 쓰는 줄 — 복사·붙여넣기 창 (잠금을 푼 뒤에 연다)
  if (manualJobs.length) {
    openManualDialog_({
      kind: 'generate', sheet: sheet.getName(), target: 'AI 결과', check: '생성',
      title: act.name, limit: bytesFor_(act), system: promptFor_(act), jobs: manualJobs, note: manualNote
    });
  }
}

/**
 * 여러 학생을 한 번의 호출로 생성한다.
 * @return {Object} row → {text, model, backup}. 호출 자체가 실패하면 {error: Error}.
 *         응답에서 빠진 학생은 결과에 없으므로, 부르는 쪽이 한 명씩 다시 부른다.
 */
function generateBatch_(system, chunk, model, tail) {
  var ids = chunk.map(function (job, n) { return 'S' + (n + 1); });
  var user = buildBatchUser(chunk.map(function (job, n) { return { id: ids[n], block: job.block || job.user }; })) + (tail || '');
  var res;
  try {
    res = callWithBackup_(system, user, model, { json: true, schema: BATCH_SCHEMA });
  } catch (e) {
    return e.kind ? { error: e } : {};     // API 오류면 모두 실패로, 그 밖(빈 응답 등)은 한 명씩 다시
  }
  var parsed = parseBatchResult(res.text, ids);
  var out = {};
  chunk.forEach(function (job, n) {
    var t = parsed.map[ids[n]];
    if (t) out[job.row] = { text: t, model: res.model, backup: res.backup };
  });
  return out;
}

/* ------------------------------------------------------- 근거 확인 */
/** 학생 자료 ↔ 초안 → 자료에 없는 구절 목록 */
function groundCheck_(source, draft, model) {
  var res = callWithBackup_(GROUND_SYSTEM, buildGroundUser(source, draft), model, { json: true });
  return parseGroundResult(res.text);
}

function groundText_(list) {
  if (!list || !list.length) return '[근거] 학생 자료에 없는 내용 못 찾음';
  return list.slice(0, 4).map(function (x) {
    return '[확인] 자료에 없는 내용 → "' + x.quote.slice(0, 40) + '"' + (x.why ? ' (' + x.why.slice(0, 40) + ')' : '');
  }).join('\n');
}

/** 근거 확인·검사 창에 쓸 모델 — 활동용 모델의 키가 없으면 키가 있는 회사의 기본 모델. 없으면 '' */
function apiModelForChecks_() {
  var model = normModel(cfg_('활동용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var p = providerOf_(model);
  if (p !== 'subscription' && p !== 'manual' && modelUsable_(model)) return model;
  var withKey = PROVIDERS.filter(function (x) { return getKey_(x); })[0];
  return withKey ? PROVIDER_DEFAULT_MODEL[withKey] : '';
}

/** 메뉴 ⑧: 선택한 행의 AI 결과(또는 최종본)가 학생 자료에 있는 내용인지 */
function groundCheckSelection() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)에서 확인할 행을 선택한 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('확인할 학생 행을 선택하세요.'); return; }
  var model = apiModelForChecks_();
  if (!model) {
    ui_().alert(APP.MENU, '근거 확인은 API 키가 있어야 자동으로 됩니다.\n\n키 없이 하려면 메뉴 [🔍 맞춤법 · 금지어 검사] 창에 글과 학생 자료를 넣고 ' +
      '[Gemini 앱에서 근거 확인 — 요청 복사]를 누르세요.', ui_().ButtonSet.OK);
    return;
  }
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var cAi = colOf_(sheet, APP.HEAD_ROW, 'AI 결과'), cFi = colOf_(sheet, APP.HEAD_ROW, '최종본'), cV = colOf_(sheet, APP.HEAD_ROW, '검증');
  var n = 0, found = 0, t0 = Date.now();
  usageReset_();
  for (var i = 0; i < rows.length; i++) {
    if (Date.now() - t0 > RUN_BUDGET_MS) break;
    var job = studentJob_(act, sheet, rows[i], rec, true, '');
    var draft = String(cFi ? sheet.getRange(rows[i], cFi).getValue() : '').trim() || String(sheet.getRange(rows[i], cAi).getValue()).trim();
    if (!job || !draft || draft.indexOf('⚠') === 0) continue;
    toast_((i + 1) + '/' + rows.length + ' 근거 확인 중…', APP.MENU);
    try {
      var list = groundCheck_(job.block, draft, model);
      if (list.length) found++;
      var prev = String(sheet.getRange(rows[i], cV).getValue()).split('\n')
        .filter(function (l) { return !/^\[근거\]|자료에 없는 내용/.test(l); }).join('\n');
      sheet.getRange(rows[i], cV).setValue((prev ? prev + '\n' : '') + groundText_(list));
      n++;
    } catch (e) {
      sheet.getRange(rows[i], cV).setValue('근거 확인 실패: ' + e.message);
    }
  }
  toast_('근거 확인 ' + n + '건 · 자료에 없는 내용이 보인 학생 ' + found + '명 — [검증] 칸을 보세요.' +
         (usageText_() ? '\n' + usageText_() : ''), APP.MENU);
}

/* ------------------------------------------------------- 자동 생성 트리거 */
function enableAutoTrigger() {
  disableAutoTrigger();
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss_()).onEdit().create();
  ui_().alert(APP.MENU,
    '자동 생성을 켰습니다.\n[생성] 체크박스를 체크하면 그 줄이 바로 생성됩니다.\n\n' +
    '※ 여러 명을 한꺼번에 처리할 때는 메뉴 ⑥ [체크된 행 생성] 이 더 빠르고 안정적입니다.\n' +
    '※ 모델이 [키 없이(복사·붙여넣기)]인 줄은 자동으로 하지 않고, 메뉴 ⑥ 에서 창을 엽니다.',
    ui_().ButtonSet.OK);
}

function disableAutoTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
}

function onEditInstalled(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var act = activityOfSheet_(sheet.getName());
    if (!act) return;
    var cGen = colOf_(sheet, APP.HEAD_ROW, '생성');
    if (!cGen || e.range.getColumn() !== cGen) return;
    if (e.range.getRow() < APP.DATA_ROW) return;
    if (e.value !== 'TRUE' && e.range.getValue() !== true) return;
    var cModel = colOf_(sheet, APP.HEAD_ROW, '모델');
    var model = (cModel ? normModel(sheet.getRange(e.range.getRow(), cModel).getValue()) : '') ||
                normModel(cfg_('활동용 모델', DEFAULT_MODEL));
    // 복사·붙여넣기 창은 메뉴에서 연다 — 트리거에서는 창을 띄울 수 없다(키가 하나도 없을 때도 같음)
    if (providerOf_(model) === 'manual' || !PROVIDERS.some(function (p) { return getKey_(p); })) return;
    runGeneration_(act, sheet, [e.range.getRow()]);
  } catch (err) {
    try { toast_('자동 생성 오류: ' + err.message); } catch (e2) {}
  }
}

/* ------------------------------------------------------------- 재검증 */
function revalidateAll() {
  var acts = getActivities_();
  var n = 0;
  acts.forEach(function (a) {
    var s = sh_(a.inSheet);
    if (!s) return;
    var cAi = colOf_(s, APP.HEAD_ROW, 'AI 결과');
    var cFinal = colOf_(s, APP.HEAD_ROW, '최종본');
    var cValid = colOf_(s, APP.HEAD_ROW, '검증');
    if (!cValid) return;
    var last = s.getLastRow();
    if (last < APP.DATA_ROW) return;
    var cnt = last - APP.DATA_ROW + 1;
    var ai = s.getRange(APP.DATA_ROW, cAi, cnt, 1).getValues();
    var fin = cFinal ? s.getRange(APP.DATA_ROW, cFinal, cnt, 1).getValues() : ai;
    var limit = bytesFor_(a);
    var out = [];
    for (var i = 0; i < cnt; i++) {
      var t = String(fin[i][0] || '').trim() || String(ai[i][0] || '').trim();
      out.push([t ? formatIssues(inspect_(t, limit)) : '']);
      if (t) n++;
    }
    s.getRange(APP.DATA_ROW, cValid, cnt, 1).setValues(out);
  });
  // 최종취합 (기록종류별)
  compileSheets_().forEach(function (cp) {
    var cF = colOf_(cp, APP.HEAD_ROW, '최종본');
    var cV = colOf_(cp, APP.HEAD_ROW, '검증');
    var last2 = cp.getLastRow();
    if (!cF || !cV || last2 < APP.DATA_ROW) return;
    var cnt2 = last2 - APP.DATA_ROW + 1;
    var f2 = cp.getRange(APP.DATA_ROW, cF, cnt2, 1).getValues();
    var lim2 = compileLimitOf_(cp.getName());
    var o2 = [];
    for (var j = 0; j < cnt2; j++) {
      var t2 = String(f2[j][0] || '').trim();
      o2.push([t2 ? formatIssues(inspect_(t2, lim2)) : '']);
      if (t2) n++;
    }
    cp.getRange(APP.DATA_ROW, cV, cnt2, 1).setValues(o2);
  });
  toast_(n + '건 재검증 완료', APP.MENU);
}

/* ------------------------------------------------- 고쳐 쓰면 바로 검사 */
/**
 * 단순 트리거(onEdit)에서 부른다 — 입력·취합 시트의 [최종본]이나 [AI 결과]를 고치면
 * [검증] 칸을 바로 새로 쓴다. AI 를 부르지 않으므로 권한 승인 없이도 돈다.
 * @return {boolean} 이 편집을 처리했는지
 */
function recheckOnEdit_(e) {
  var s = e.range.getSheet();
  var name = s.getName();
  var limit = 0, act = null;
  if (name.indexOf(APP.SH.COMPILE_PREFIX) === 0) limit = compileLimitOf_(name);
  else if (name.slice(-APP.SUFFIX.IN.length) === APP.SUFFIX.IN) { act = activityOfSheet_(name); if (act) limit = bytesFor_(act); }
  if (!limit) return false;
  var r1 = e.range.getRow(), nr = e.range.getNumRows();
  if (r1 + nr - 1 < APP.DATA_ROW) return false;
  var cFi = colOf_(s, APP.HEAD_ROW, '최종본');
  var cAi = colOf_(s, APP.HEAD_ROW, act ? 'AI 결과' : 'AI 압축결과');
  var cV = colOf_(s, APP.HEAD_ROW, '검증');
  var c1 = e.range.getColumn(), c2 = c1 + e.range.getNumColumns() - 1;
  var hit = function (c) { return c && c1 <= c && c <= c2; };
  if (!cV || (!hit(cFi) && !hit(cAi))) return false;
  for (var r = Math.max(r1, APP.DATA_ROW); r < r1 + nr && r < APP.DATA_ROW + 500; r++) {
    var fin = cFi ? String(s.getRange(r, cFi).getValue()).trim() : '';
    var t = fin || (cAi ? String(s.getRange(r, cAi).getValue()).trim() : '');
    if (t.indexOf('⚠') === 0) continue;
    s.getRange(r, cV).setValue(t ? formatIssues(inspect_(t, limit)) + (fin ? '\n(최종본 기준)' : '') : '');
  }
  return true;
}


/* ==========================================================================
   72_Manual.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 키 없이 쓰기 (복사 · 붙여넣기)
 *
 * API 키가 없는 선생님도 처음부터 끝까지 쓸 수 있게 하는 길.
 *   ① 시트가 규칙(프롬프트)과 학생 자료를 한 덩어리로 만들어 준다 — 학생 이름은 보내지 않는다(마스킹)
 *   ② 선생님이 Gemini 앱(학교 계정 권장)·ChatGPT·Claude 대화창에 붙여 넣는다
 *   ③ 받은 답을 창에 붙여 넣으면 학생별로 나눠 [AI 결과]에 넣고 바로 검사한다
 * 스크립트는 바깥으로 아무것도 보내지 않는다. 대화창에 무엇을 붙여 넣을지는 선생님이 본다.
 */

/**
 * @param {{kind:string, sheet:string, target:string, check:string, title:string, limit:number,
 *          system:string, jobs:Array<{row:number, user:string, label:string, links?:string[]}>, note?:string,
 *          heading?:string, chunk?:number}} p
 *   kind: 'generate' | 'compile' | 'extract'(보고서 요점 — 줄바꿈을 살리고 검사하지 않음)
 *   chunk: 한 번에 묶을 학생 수(보고서 파일을 첨부해야 하면 1)
 */
function openManualDialog_(p) {
  var size = p.chunk || Math.min(10, Math.max(5, Number(cfg_('한 번에 묶을 학생 수', 5)) || 5));
  var tail = p.kind === 'extract' ? '' : styleTail_();
  var chunks = [];
  for (var i = 0; i < p.jobs.length; i += size) {
    var part = p.jobs.slice(i, i + size);
    var items = part.map(function (j, n) { return { id: 'S' + (n + 1), block: j.user }; });
    chunks.push({
      rows: part.map(function (j) { return j.row; }),
      ids: items.map(function (x) { return x.id; }),
      labels: part.map(function (j) { return j.label; }),
      links: part.map(function (j) { return j.links || []; }),
      user: p.kind === 'extract' ? items.map(function (x) { return x.block; }).join('\n\n') : buildManualUser(items, p.heading) + tail
    });
  }
  var data = {
    kind: p.kind, sheet: p.sheet, target: p.target, check: p.check, title: p.title, limit: p.limit,
    system: p.system, gem: buildGemText(p.system), chunks: chunks, note: p.note || '', aiNotice: AI_NOTICE_2026,
    account: accountInfo_(), masked: maskName_()
  };
  var t = HtmlService.createTemplateFromFile('UI_Manual');
  t.data = JSON.stringify(data).replace(/</g, '\\u003c');
  ui_().showModalDialog(t.evaluate().setWidth(800).setHeight(690), '📋 키 없이 쓰기 — ' + p.title);
}

/**
 * 대화창에서 복사해 온 답을 학생별로 나눠 시트에 넣는다.
 * @param {{sheet:string, target:string, check:string, limit:number, rows:number[], ids:string[], labels:string[], answer:string}} p
 * @return {{written:number, missing:string[], results:Array<{label, bytes, limit, ok, issues:string[]}>}}
 */
function manualApply(p) {
  var s = sh_(p.sheet);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + p.sheet);
  var cT = colOf_(s, APP.HEAD_ROW, p.target);
  if (!cT) throw new Error('[' + p.target + '] 칸이 없습니다. 시트 구조를 확인하세요.');
  var cV = colOf_(s, APP.HEAD_ROW, '검증');
  var cC = p.check ? colOf_(s, APP.HEAD_ROW, p.check) : 0;
  var parsed = parseManualAnswer(p.answer, p.ids || []);
  var results = [], written = 0;
  var extract = p.kind === 'extract';
  var ref = null;
  if (!extract) { try { var act = activityOfSheet_(p.sheet); if (act) ref = styleReference_(act); } catch (e) {} }
  (p.ids || []).forEach(function (id, n) {
    var row = p.rows[n];
    var raw = parsed.map[id];
    if (!raw || !row) return;
    if (extract) {
      s.getRange(row, cT).setValue(cleanPoints(raw)).setWrap(true);
      written++;
      results.push({ label: (p.labels || [])[n] || id, bytes: 0, limit: 0, ok: true, issues: ['요점을 넣었습니다 — 읽고 고친 뒤 생성하세요'] });
      return;
    }
    var txt = cleanResult_(raw);
    var v = inspectStyled_(txt, Number(p.limit) || 1500, ref);
    s.getRange(row, cT).setValue(txt);
    if (cV) s.getRange(row, cV).setValue(formatIssues(v) + '\n(키 없이 · 복사·붙여넣기)');
    if (cC) s.getRange(row, cC).setValue(false);
    written++;
    results.push({ label: (p.labels || [])[n] || id, bytes: v.bytes, limit: Number(p.limit) || 1500, ok: v.ok,
                   issues: v.issues.map(function (x) { return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : ''); }) });
  });
  SpreadsheetApp.flush();
  var missing = parsed.missing.map(function (id) { var k = (p.ids || []).indexOf(id); return (p.labels || [])[k] || id; });
  return { written: written, missing: missing, results: results };
}

/** 선택한 행을 시트에서 보여 주기(창에서 학생 이름을 누르면) */
function manualGoto(p) {
  var s = sh_(p.sheet);
  if (!s) return false;
  ss_().setActiveSheet(s);
  var c = colOf_(s, APP.HEAD_ROW, p.target) || 1;
  s.getRange(p.row, c).activate();
  return true;
}


/* ==========================================================================
   74_Check.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 맞춤법 · 금지어 검사 (사이드바)
 *
 * 선생님이 직접 쓴 글, 다듬은 최종본, 다른 데서 가져온 글을 붙여 넣고 바로 검사한다.
 *   · 규칙 검사(늘): 바이트 · 2026 기재 금지어 · 어미·특수문자 · 맞춤법/띄어쓰기 — AI 를 부르지 않는다
 *   · AI 맞춤법 검사 · 근거 확인(키가 있을 때): 고칠 곳을 목록으로 받아 골라서 고친다
 *   · 키가 없으면: Gemini 앱에 붙여 넣을 검사 요청문을 복사해 준다
 * 시트의 셀을 골라 [선택한 셀 가져오기] → 고친 뒤 [그 셀에 다시 넣기] 로 돌려놓을 수 있다.
 */

function openCheckSidebar() {
  try { autoRulesCheck_(); } catch (e) {}
  var html = HtmlService.createHtmlOutputFromFile('UI_Check').setTitle('🔍 맞춤법 · 금지어 검사');
  ui_().showSidebar(html);
}

function checkContext() {
  var recs = [];
  try { recs = getRecordTypes_().map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }); } catch (e) {}
  if (!recs.length) recs = PRESET_RECORD_TYPES.map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; });
  // 바이트 한도를 따로 정한(한 칸을 나눠 쓰는) 활동은 검사 한도로도 고를 수 있게
  var acts = [];
  try {
    var rs = getRecordTypes_();
    getActivities_().forEach(function (a) {
      var rec = findByKey(rs, a.recordKey);
      if (!rec) return;
      var b = activityBytes(a, rec);
      if (b < rec.chars * 3) acts.push({ key: a.key, name: a.name, bytes: b });
    });
  } catch (e) {}
  var model = '';
  try { model = apiModelForChecks_(); } catch (e) {}
  return {
    records: recs, activities: acts, model: model, rules: currentPackInfo_(), aiNotice: AI_NOTICE_2026,
    account: accountInfo_(), spellSystem: SPELL_SYSTEM, groundSystem: GROUND_SYSTEM
  };
}

/** 규칙 검사 — @param {{text:string, bytes?:number, chars?:number}} p  bytes(활동 한도)가 있으면 그것, 없으면 chars×3 */
function checkTextNow(p) {
  var limit = Math.round(Number(p && p.bytes) || (Number(p && p.chars) || 500) * 3);
  var v = inspect_(String((p && p.text) || ''), limit);
  return { bytes: v.bytes, limit: limit, chars: Math.floor(limit / 3), ok: v.ok, issues: v.issues };
}

/** AI 맞춤법 검사 — 고칠 목록과 고친 글 */
function aiSpellCheck(p) {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없어 AI 맞춤법 검사를 할 수 없습니다. 아래 [Gemini 앱에서 검사 — 요청 복사]를 쓰세요.');
  var text = String((p && p.text) || '').trim();
  if (!text) throw new Error('검사할 글이 없습니다.');
  usageReset_();
  var res = callWithBackup_(SPELL_SYSTEM, '# 글\n' + text, model, { json: true });
  var changes = parseSpellResult(res.text, text);
  return { changes: changes, fixed: applyChanges(text, changes), model: res.model, usage: usageText_() };
}

/** AI 근거 확인 — 학생 자료에 없는 구절 */
function aiGroundCheck(p) {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없어 자동 근거 확인을 할 수 없습니다. [Gemini 앱에서 근거 확인 — 요청 복사]를 쓰세요.');
  if (!String((p && p.source) || '').trim()) throw new Error('학생 자료(관찰 메모·입력 항목)를 함께 넣어 주세요.');
  usageReset_();
  var list = groundCheck_(p.source, p.text, model);
  return { list: list, model: model, usage: usageText_() };
}

/** 지금 선택한 셀의 글 (+ 그 시트의 기록 항목을 짐작해 글자수를 맞춘다) */
function readActiveCell() {
  var r = SpreadsheetApp.getActiveRange();
  if (!r) throw new Error('먼저 시트에서 셀 하나를 선택하세요.');
  var s = r.getSheet();
  var c = s.getRange(r.getRow(), r.getColumn());
  var name = s.getName(), recordKey = '', activityKey = '';
  try {
    var act = activityOfSheet_(name);
    if (act) { recordKey = act.recordKey; activityKey = act.key; }
    else if (recordKeyOfCompile_(name)) recordKey = recordKeyOfCompile_(name);
  } catch (e) {}
  return { sheet: name, a1: c.getA1Notation(), text: String(c.getValue() === null ? '' : c.getValue()), recordKey: recordKey, activityKey: activityKey };
}

/** 가져왔던 바로 그 셀에 다시 넣는다 */
function writeBackCell(p) {
  var s = sh_(p.sheet);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + p.sheet);
  var c = s.getRange(p.a1);
  if (c.getFormula()) throw new Error('수식이 든 셀(' + p.a1 + ')에는 넣지 않습니다. [최종본] 칸에 넣어 주세요.');
  c.setValue(String(p.text || ''));
  try { recheckOnEdit_({ range: c }); } catch (e) {}   // 스크립트가 쓴 값은 onEdit 이 안 돌아서 직접 다시 검사
  SpreadsheetApp.flush();
  return '✓ ' + p.sheet + ' ' + p.a1 + ' 에 넣었습니다.';
}


/* ==========================================================================
   76_Quick.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — ✍️ 바로 쓰기 시트
 *
 * 활동을 설계하지 않고(입력 항목·예시 없이) 바로 쓰고 싶을 때.
 *   · 학생마다 [관찰 메모] 한 칸에 자유롭게 적고 → [생성] 하면 AI 초안 (키가 없으면 복사·붙여넣기)
 *   · 또는 [최종본]에 직접 쓰면 → [검증]이 바로 금지어·형식·맞춤법을 검사
 * 속은 보통 활동과 똑같아서 생성·검사·최종취합·검토가 모두 그대로 된다(프롬프트 모드 '바로쓰기').
 * 기록종류·교과마다 몇 개든 만들 수 있다.
 */

var QUICK_COLUMN = '관찰 메모';

/** 시험 생성·안내에 쓰는 보기 메모 (실제 학생 자료가 아님) */
var SAMPLE_MEMO = {
  '과세특': '이차함수 단원에서 그래프 이동을 모둠원에게 설명함. 처음에는 꼭짓점 좌표를 헷갈렸으나 표를 그려 비교한 뒤 스스로 규칙을 찾아냄. 발표 뒤 받은 질문에 예를 들어 다시 설명함.',
  '개세특': '수업 중 모르는 낱말을 따로 적어 두고 쉬는 시간에 사전으로 찾아 정리하는 습관이 있음. 학기 말에는 정리한 낱말장을 친구들과 나누어 봄.',
  '자율': '학급 환경 개선 회의에서 분리배출 표시판 만들기를 제안하고 역할을 나눔. 2주 동안 표시판을 고쳐 가며 붙였고 학급 분리배출이 눈에 띄게 나아짐.',
  '동아리': '과학 실험 동아리에서 식물 성장과 빛의 색 관계를 실험함. 변인 통제가 어려워 실험을 두 번 다시 설계했고, 결과 발표에서 한계와 개선점을 말함.',
  '진로': '진로 탐색 시간에 간호사 직업 인터뷰 자료를 읽고 하루 일과를 정리함. 관심 분야를 노인 돌봄으로 좁히고 필요한 역량을 스스로 표로 만듦.',
  '행발': '맡은 청소 구역을 끝까지 책임지고 정리함. 친구가 어려워할 때 먼저 다가가 도와주는 모습이 자주 보임. 수업 시간 집중력이 학기 초보다 좋아짐.'
};

function openQuickSheetDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Quick').setWidth(560).setHeight(640);
  ui_().showModalDialog(html, '✍️ 바로 쓰기 · 📄 보고서 시트 추가');
}

function quickContext() {
  if (!sh_(APP.SH.RECORD) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var recs = getRecordTypes_(), subs = getSubjects_();
  var n = 1;
  while (getActivity_('바로쓰기' + n) || sh_(sheetNameIn_('바로쓰기' + n))) n++;
  var m = 1;
  while (getActivity_('보고서' + m) || sh_(sheetNameIn_('보고서' + m))) m++;
  var roster = 0;
  try { roster = getRoster_().length; } catch (e) {}
  return {
    records: recs.map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }),
    subjects: subs.map(function (s) { return { key: s.key, name: s.name, kind: s.kind }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    suggestName: '바로쓰기' + n, suggestReport: '보고서' + m, rosterCount: roster
  };
}

/**
 * @param {{kind?:string, name:string, recordKey:string, subjectKey:string, chars?:number, desc?:string}} p  kind '보고서'면 보고서 시트
 * @return {{inSheet:string, name:string}}
 */
function createQuickSheet(p) {
  if (p && p.kind === '보고서') return createReportSheet(p);
  var name = safeKey_(p.name) || ('바로쓰기' + Date.now() % 1000);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, p.recordKey) || recs[0];
  var made = createActivity_({
    key: name, name: name, recordKey: rec.key,
    subjectKey: p.subjectKey || (rec.key === '과세특' ? cfg_('기본 교과영역', '공통') : '공통'),
    chars: Number(p.chars) || 0, columns: [QUICK_COLUMN], desc: String(p.desc || '').trim(),
    mode: '바로쓰기', noExamples: true
  });
  var s = sh_(made.inSheet);
  if (s) ss_().setActiveSheet(s);
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { inSheet: made.inSheet, name: name };
}

/** 이 활동이 바로 쓰기 시트인지 */
function isQuickActivity_(act) { return !!act && act.mode === '바로쓰기'; }


/* ==========================================================================
   78_Export.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — AI 앱용 지침 내보내기
 *
 * 시트가 조립한 규칙(프롬프트)을 다른 AI 앱에 "한 번 저장해 두는" 형태로 내보낸다.
 *   · Gemini Gem / ChatGPT GPT·프로젝트 / Claude 프로젝트 지침 — 붙여 넣을 글
 *   · Claude 스킬 — SKILL.md 를 담은 zip (claude.ai 설정 › 기능 › 스킬 에서 올림)
 * 학생 자료는 들어가지 않는다. 규칙(기록종류·교과·공통규칙·기재요령·예시)만 담는다.
 * 예시 시트에 실제 학생 글을 넣었다면 내보내기 전에 지우거나 [예시 넣지 않기]를 고른다.
 */

function openExportDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Export').setWidth(760).setHeight(640);
  ui_().showModalDialog(html, 'AI 앱용 지침 내보내기 — Gem · 프로젝트 · 스킬');
}

function exportContext() {
  var acts = getActivities_();
  var cur = ss_().getActiveSheet().getName(), pick = '';
  acts.forEach(function (a) { if (a.inSheet === cur || a.exSheet === cur) pick = a.key; });
  return {
    activities: acts.map(function (a) { return { key: a.key, name: a.name, recordKey: a.recordKey }; }),
    pick: pick || (acts[0] ? acts[0].key : '')
  };
}

/** @param {{key:string, examples?:boolean}} p */
function exportFor(p) {
  var acts = getActivities_();
  var idx = -1;
  acts.forEach(function (a, i) { if (a.key === p.key) idx = i; });
  if (idx < 0) throw new Error('활동을 찾을 수 없습니다.');
  var act = acts[idx];
  var rec = findByKey(getRecordTypes_(), act.recordKey) || {};
  var system = promptFor_(act, p.examples === false ? '' : undefined);
  var name = skillName(act.recordKey, idx + 1);
  return {
    gem: buildGemText(system), name: name,
    skill: buildSkillMd({ name: name, activity: act.name, record: rec.name || act.recordKey, system: system,
                          notice: AI_NOTICE_2026, rulesId: currentPackInfo_().id }),
    examples: readExampleRows_(act).length
  };
}

/** Claude 스킬 zip (폴더/SKILL.md) — 화면에서 내려받을 수 있게 base64 로 */
function exportSkillZip(p) {
  var r = exportFor(p);
  var blob = Utilities.newBlob(r.skill, 'text/markdown', r.name + '/SKILL.md');
  var zip = Utilities.zip([blob], r.name + '.zip');
  return { file: r.name + '.zip', b64: Utilities.base64Encode(zip.getBytes()) };
}


/* ==========================================================================
   80_Compile.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 최종취합
 *
 * v2와 달라진 점: 취합 시트를 "기록종류별"로 나눕니다.
 * 과세특·동아리·자율·진로·행발은 나이스에서 서로 다른 칸에 들어가므로
 * 한 덩어리로 합치면 안 됩니다. 기록종류별로 합치고, 그 종류의 글자수에 맞춰 압축합니다.
 */

function compileSheetName_(recKey) { return APP.SH.COMPILE_PREFIX + recKey; }

function recordKeyOfCompile_(sheetName) {
  if (String(sheetName).indexOf(APP.SH.COMPILE_PREFIX) !== 0) return '';
  return String(sheetName).slice(APP.SH.COMPILE_PREFIX.length);
}

function compileSheets_() {
  return ss_().getSheets().filter(function (s) {
    return String(s.getName()).indexOf(APP.SH.COMPILE_PREFIX) === 0;
  });
}

function compileLimitOf_(sheetName) {
  var rec = findByKey(getRecordTypes_(), recordKeyOfCompile_(sheetName));
  return (rec ? rec.chars : 500) * 3;
}

/** 메뉴: 최종취합 시트 생성/갱신 */
function buildCompile() {
  var acts = getActivities_();
  if (!acts.length) { ui_().alert(APP.MENU, '먼저 활동을 만드세요.', ui_().ButtonSet.OK); return; }
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단]을 먼저 입력하세요.', ui_().ButtonSet.OK); return; }
  var made = buildCompileCore_();
  toast_('최종취합 갱신: ' + made.join(', '), APP.MENU);
}

/** 알림 없이 기록종류별 취합 시트를 갱신. 만들어진 기록종류 키 배열 반환 */
function buildCompileCore_() {
  var acts = getActivities_();
  var roster = getRoster_();
  if (!acts.length || !roster.length) return [];
  var byRec = {};
  acts.forEach(function (a) {
    if (!a.recordKey) return;
    (byRec[a.recordKey] = byRec[a.recordKey] || []).push(a);
  });
  var made = [];
  Object.keys(byRec).forEach(function (rk) {
    buildCompileFor_(rk, byRec[rk], roster);
    made.push(rk);
  });
  return made;
}

function buildCompileFor_(recKey, acts, roster) {
  var rec = findByKey(getRecordTypes_(), recKey);
  var limit = (rec ? rec.chars : 500) * 3;
  var name = compileSheetName_(recKey);
  var s = sh_(name);

  // 기존 [최종본] 보존
  var keepFinal = {};
  if (s) {
    var cF = colOf_(s, APP.HEAD_ROW, '최종본');
    if (cF && s.getLastRow() >= APP.DATA_ROW) {
      var cnt = s.getLastRow() - APP.DATA_ROW + 1;
      var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
      var fv = s.getRange(APP.DATA_ROW, cF, cnt, 1).getValues();
      for (var i = 0; i < cnt; i++) {
        var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
        if (String(fv[i][0]).trim()) keepFinal[id] = fv[i][0];
      }
    }
    s.clear();
    s.setFrozenRows(0);
    s.setFrozenColumns(0);
  } else {
    s = ss_().insertSheet(name);
  }

  var head = ['반', '번호', '이름', '성취수준']
    .concat(acts.map(function (a) { return a.name; }))
    .concat(['합본', '합본 바이트', '압축', '모델', 'AI 압축결과', '최종본', '바이트', '검증']);
  head[0] = classHead_();
  var n = head.length;

  splitBanner_(s, 3, n,
    '📦 ' + (rec ? rec.name : recKey) + '\n' + (rec ? rec.chars : 500) + '자(' + limit + '바이트)',
    '① 메뉴 ⑦ [최종취합 시트 생성/갱신]으로 활동 결과를 모읍니다  →  ② 합본이 한도를 넘는 학생만 [압축] 체크  →  ' +
    '③ 메뉴 ⑦ [최종 압축본 생성]  →  ④ [최종본] 칸에서 다듬어 나이스에 붙여넣기');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n, '#4e342e');
  s.setFrozenRows(APP.HEAD_ROW);
  s.setFrozenColumns(3);

  // 활동별 결과를 값으로 끌어오기
  var pulled = acts.map(function (a) { return pullResults_(a); });

  var rows = [];
  roster.forEach(function (st) {
    var r = [st.cls, st.no, st.name, st.grade];
    var texts = [];
    pulled.forEach(function (map) {
      var t = map[st.id] || '';
      r.push(t);
      if (t) texts.push(t);
    });
    var merged = texts.join(' ');
    r.push(merged);
    r.push(merged ? byteLen(merged) : '');
    r.push(false);                    // 압축 체크박스
    r.push('');                       // 모델
    r.push('');                       // AI 압축결과
    r.push(keepFinal[st.id] || (merged && byteLen(merged) <= limit ? merged : ''));
    r.push('');                       // 바이트(수식)
    r.push('');                       // 검증
    rows.push(r);
  });

  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, 1).setNumberFormat('@');
  if (rows.length) s.getRange(APP.DATA_ROW, 1, rows.length, n).setValues(rows);

  var base = 4 + acts.length;
  var cMerge = base + 1, cMB = base + 2, cChk = base + 3, cModel = base + 4,
      cAi = base + 5, cFinal = base + 6, cBytes = base + 7, cValid = base + 8;

  s.setColumnWidth(1, 55); s.setColumnWidth(2, 55); s.setColumnWidth(3, 90); s.setColumnWidth(4, 80);
  for (var i = 0; i < acts.length; i++) s.setColumnWidth(5 + i, 300);
  s.setColumnWidth(cMerge, 340); s.setColumnWidth(cMB, 80); s.setColumnWidth(cChk, 60);
  s.setColumnWidth(cModel, 150); s.setColumnWidth(cAi, 400); s.setColumnWidth(cFinal, 420);
  s.setColumnWidth(cBytes, 70); s.setColumnWidth(cValid, 220);

  if (rows.length) {
    s.getRange(APP.DATA_ROW, 1, rows.length, n).setWrap(true).setVerticalAlignment('top');
    s.getRange(APP.DATA_ROW, 1, rows.length, 4).setBackground(APP.COLORS.lock);
    s.getRange(APP.DATA_ROW, 5, rows.length, acts.length + 2).setBackground(APP.COLORS.lock);
    s.getRange(APP.DATA_ROW, cChk, rows.length, 1).insertCheckboxes();
    s.getRange(APP.DATA_ROW, cModel, rows.length, 1).setDataValidation(modelValidation_());
    s.getRange(APP.DATA_ROW, cAi, rows.length, 1).setBackground(APP.COLORS.output);
    s.getRange(APP.DATA_ROW, cFinal, rows.length, 1).setBackground(APP.COLORS.paste);
    var f = [];
    for (var r2 = 0; r2 < rows.length; r2++) {
      var a1 = s.getRange(APP.DATA_ROW + r2, cFinal).getA1Notation();
      f.push(['=IF(' + a1 + '="","",saeteukBytes(' + a1 + '))']);
    }
    s.getRange(APP.DATA_ROW, cBytes, rows.length, 1).setFormulas(f);
    s.setRowHeights(APP.DATA_ROW, rows.length, 90);

    // 합본 바이트가 한도를 넘으면 붉게
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(limit)
      .setBackground(APP.COLORS.warn)
      .setRanges([s.getRange(APP.DATA_ROW, cMB, rows.length, 1)]).build();
    s.setConditionalFormatRules([rule]);
  }
}

/** 활동 입력 시트에서 "반-번호 → 최종본(없으면 AI 결과)" 맵 */
function pullResults_(act) {
  var map = {};
  var s = sh_(act.inSheet);
  if (!s || s.getLastRow() < APP.DATA_ROW) return map;
  var cAi = colOf_(s, APP.HEAD_ROW, 'AI 결과');
  var cFi = colOf_(s, APP.HEAD_ROW, '최종본');
  var cnt = s.getLastRow() - APP.DATA_ROW + 1;
  var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var ai = cAi ? s.getRange(APP.DATA_ROW, cAi, cnt, 1).getValues() : null;
  var fi = cFi ? s.getRange(APP.DATA_ROW, cFi, cnt, 1).getValues() : null;
  for (var i = 0; i < cnt; i++) {
    var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
    if (id === '-') continue;
    var t = fi ? String(fi[i][0] || '').trim() : '';
    if (!t && ai) t = String(ai[i][0] || '').trim();
    if (t.indexOf('⚠') === 0) t = '';
    map[id] = t;
  }
  return map;
}

/* ----------------------------------------------------------- 압축 생성 */
/** @param {{manual?:boolean}=} opt  manual: 체크된 행을 모두 복사·붙여넣기로 */
function compileChecked(opt) {
  opt = (opt && typeof opt === 'object' && !opt.authMode) ? opt : {};
  var s = ss_().getActiveSheet();
  var recKey = recordKeyOfCompile_(s.getName());
  if (!recKey) {
    var list = compileSheets_();
    if (list.length === 1) { s = list[0]; recKey = recordKeyOfCompile_(s.getName()); ss_().setActiveSheet(s); }
    else { ui_().alert(APP.MENU, '압축할 최종취합 시트를 연 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  }
  var rec = findByKey(getRecordTypes_(), recKey);
  var limit = (rec ? rec.chars : 500) * 3;

  var cChk = colOf_(s, APP.HEAD_ROW, '압축');
  var cMerge = colOf_(s, APP.HEAD_ROW, '합본');
  var cModel = colOf_(s, APP.HEAD_ROW, '모델');
  var cAi = colOf_(s, APP.HEAD_ROW, 'AI 압축결과');
  var cValid = colOf_(s, APP.HEAD_ROW, '검증');
  if (!cChk || !cMerge) { ui_().alert(APP.MENU, '시트 구조가 올바르지 않습니다. 메뉴 ⑥으로 다시 생성하세요.', ui_().ButtonSet.OK); return; }

  var last = s.getLastRow();
  var cnt = last - APP.DATA_ROW + 1;
  if (cnt < 1) return;
  var chk = s.getRange(APP.DATA_ROW, cChk, cnt, 1).getValues();
  var rows = [];
  for (var i = 0; i < cnt; i++) if (chk[i][0] === true) rows.push(APP.DATA_ROW + i);
  if (!rows.length) { toast_('[압축] 체크된 행이 없습니다.'); return; }

  var defModel = normModel(cfg_('합본용 모델', DEFAULT_MODEL)) || DEFAULT_MODEL;
  var system = compressPrompt_(rec);
  var okN = 0, errN = 0, leftN = 0, backupN = 0, t0 = Date.now();
  var has = keyStatus_(), anyApi = has.gemini || has.openai || has.anthropic, manualJobs = [];
  usageReset_();

  for (var k = 0; k < rows.length; k++) {
    var row = rows[k];
    if (Date.now() - t0 > RUN_BUDGET_MS) { leftN = rows.length - k; break; }
    var merged = String(s.getRange(row, cMerge).getValue() || '').trim();
    if (!merged) { s.getRange(row, cChk).setValue(false); continue; }
    var model = cModel ? String(s.getRange(row, cModel).getValue()).trim() : '';
    if (!model) model = defModel;
    var prov = providerOf_(model);
    if (opt.manual || prov === 'manual' || (!anyApi && prov !== 'subscription' && !providerUsable(prov, has))) {
      var who = s.getRange(row, 1, 1, 3).getValues()[0];
      manualJobs.push({ row: row, user: merged, label: String(who[0]) + '반 ' + String(who[1]) + '번 ' + String(who[2]) });
      continue;
    }
    toast_((k + 1) + '/' + rows.length + ' 압축 중…', APP.MENU);
    try {
      if (providerOf_(model) === 'subscription') {
        s.getRange(row, cAi).setFormula(subscriptionFormula_(system, merged));
        continue;
      }
      var res = callWithBackup_(system, merged, model);
      var txt = cleanResult_(res.text);
      if (byteLen(txt) > limit) txt = trimToBytes(txt, limit);
      s.getRange(row, cAi).setValue(txt);
      if (cValid) s.getRange(row, cValid).setValue(formatIssues(inspect_(txt, limit)) +
        (res.backup ? '\n(예비 모델 ' + res.model + ' 로 생성)' : ''));
      if (res.backup) backupN++;
      s.getRange(row, cChk).setValue(false);
      okN++;
    } catch (e) {
      s.getRange(row, cAi).setValue('⚠ 실패: ' + e.message);
      s.getRange(row, cChk).setValue(false);
      errN++;
    }
    SpreadsheetApp.flush();
  }
  if (manualJobs.length) {
    openManualDialog_({ kind: 'compile', sheet: s.getName(), target: 'AI 압축결과', check: '압축',
      title: (rec ? rec.name : recKey) + ' 압축', limit: limit, system: system, jobs: manualJobs, heading: '통합할 문장들',
      note: opt.manual ? '' : (anyApi ? '' : 'API 키가 없어 [키 없이 — 복사·붙여넣기]로 진행합니다.') });
    if (!okN && !errN) return;
  }
  var done = '압축 완료 ' + okN + '건' + (errN ? ' / 실패 ' + errN + '건' : '') + (backupN ? ' / 예비 모델 ' + backupN + '건' : '');
  var used = usageText_();
  if (used) done += '\n' + used;
  if (leftN) {
    ui_().alert(APP.MENU, done + '\n\n실행 시간 제한(약 6분)에 가까워져 ' + leftN + '건을 남기고 멈췄습니다.\n' +
      '남은 행은 [압축] 체크가 그대로 있으니 한 번 더 실행하세요.', ui_().ButtonSet.OK);
  } else toast_(done, APP.MENU);
}

/** 압축용 프롬프트 (기록종류 규칙을 그대로 따름) */
function compressPrompt_(rec) {
  var com = getCommon_();
  var chars = rec ? rec.chars : 500;
  var bytes = chars * 3;
  var P = [];
  P.push('# 역할\n당신은 ' + (rec && rec.role ? rec.role.replace(/\{[^}]+\}/g, '').replace(/\s{2,}/g, ' ').trim() : '고등학교 교사') + '입니다.');
  P.push('# 과제\n여러 활동에서 작성된 특기사항 문장들이 주어진다. 이를 중복 없이 하나의 ' +
         (rec ? rec.name : '특기사항') + '으로 통합한다.\n' +
         '- 내용을 새로 지어내지 않는다. 주어진 문장에 있는 사실만 쓴다.\n' +
         '- 같은 역량이 반복되면 한 번으로 합치고, 서로 다른 장면은 살린다.\n' +
         '- 시간 순서 또는 역량의 흐름에 따라 자연스럽게 잇는다.');
  if (com.WRITING_RULES) P.push('# 서술 규칙\n' + com.WRITING_RULES);
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);
  P.push('# 분량\n- 반드시 ' + chars + '자(' + bytes + '바이트) 이내로 작성한다.\n' +
         '- ' + Math.round(bytes * 0.9) + '바이트 이상을 채운다.\n' + (com.BYTE_RULE || ''));
  P.push('# 출력\n통합된 특기사항 본문만 한 문단으로 출력한다. 설명이나 머리말을 붙이지 않는다.');
  return P.join('\n\n');
}


/* ==========================================================================
   82_Report.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 📄 보고서 세특 · 보고서 파일 읽기 · 예시 등록 · ✒️ 내 문체
 *
 * 보고서 시트(프롬프트 모드 '보고서')의 입력 항목은 [보고서] [보고서 요점] [교사 관찰 메모] 세 칸.
 *   [보고서]      : 본문을 붙여 넣거나, 구글 드라이브 파일 링크(설문지 파일 업로드·클래스룸·직접 붙인 링크)
 *   [보고서 요점]  : AI 가 보고서에서 뽑고 교사가 확인·수정한다 — 생성에는 이 칸과 관찰 메모만 간다
 *   [교사 관찰 메모]: 교사가 수업에서 직접 본 것 (2026 기재요령: 세특은 교사가 관찰·평가한 내용 바탕)
 * 드라이브 파일은 읽기만 한다(drive.readonly). 구글 문서·PDF·사진·docx·hwpx·pptx·txt 를 읽고, .hwp 는 PDF 로 바꿔 달라고 안내한다.
 */

var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
// base64 로 보내면 4/3 배가 된다 — Gemini 한 요청 20MB 안쪽에 들도록
var REPORT_FILE_MAX = 10 * 1024 * 1024;     // 한 파일
var REPORT_PARTS_MAX = 13 * 1024 * 1024;    // 한 학생 첨부 합계
var STYLE_SAMPLE_MAX = 3;                   // 프롬프트에 넣을 문체 예시 수

/** 시작하기 시험 생성에 쓰는 보기 요점 (실제 학생 자료가 아님) */
var SAMPLE_POINTS =
  '탐구 주제와 동기: 급식 잔반량이 요일마다 다른 까닭이 궁금해 잔반 기록을 분석함\n' +
  '탐구 과정과 방법: 4주 동안 요일별 잔반 무게를 표로 정리하고 평균과 분산을 구함\n' +
  '결과와 해석: 금요일 잔반이 가장 많았고 메뉴 선호도 설문과 비교해 원인을 추측함\n' +
  '한계와 개선점: 조사 기간이 짧아 계절 영향을 보지 못했다고 스스로 밝힘\n' +
  '활용한 교과 개념: 평균, 분산, 표준편차\n' +
  '학생의 생각과 질문: 분산이 크면 무엇을 바꿔야 하는지 질문함';

function isReportActivity_(act) { return !!act && act.mode === '보고서'; }

/** 보고서 시트 만들기 (바로 쓰기 창에서 [📄 보고서]를 고르면) */
function createReportSheet(p) {
  var name = safeKey_(p.name) || ('보고서' + Date.now() % 1000);
  var recs = getRecordTypes_();
  var rec = findByKey(recs, p.recordKey) || recs[0];
  var made = createActivity_({
    key: name, name: name, recordKey: rec.key,
    subjectKey: p.subjectKey || cfg_('기본 교과영역', '공통'),
    chars: Number(p.chars) || 0, columns: REPORT_COLUMNS, desc: String(p.desc || '').trim(),
    mode: '보고서'
  });
  var s = sh_(made.inSheet);
  if (s) ss_().setActiveSheet(s);
  try { if (compileSheets_().length) buildCompileCore_(); } catch (e) {}
  return { inSheet: made.inSheet, exSheet: made.exSheet, name: name };
}

/* ------------------------------------------------------- 드라이브 읽기 */
/** 드라이브 읽기 권한 — 처음 승인 때 체크를 풀었으면 여기서 다시 묻는다 */
function ensureDriveScope_() {
  try {
    if (ScriptApp.requireScopes) ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [DRIVE_SCOPE]);
  } catch (e) {
    throw new Error('보고서 파일을 읽으려면 "Google 드라이브 파일 보기" 권한이 필요합니다. 메뉴를 다시 눌러 승인 창에서 그 항목을 체크하고 [계속]을 누르세요. (' + e.message + ')');
  }
}

/** 구글 문서·프레젠테이션 → 글자 (Drive API 내보내기) */
function exportGoogleText_(id) {
  var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '/export?mimeType=text%2Fplain',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('구글 문서를 글자로 내보내지 못했습니다(' + res.getResponseCode() + ')');
  return res.getContentText('UTF-8');
}

/** zip 안 XML 들 → 글자 (docx·pptx·hwpx) */
function zipText_(blob, kind) {
  var entries = Utilities.unzip(blob.setContentType('application/zip'));
  var pick = kind === 'docx' ? /^word\/document\.xml$/ : kind === 'pptx' ? /^ppt\/slides\/slide(\d+)\.xml$/ : /^Contents\/section(\d+)\.xml$/;
  var found = entries.filter(function (b) { return pick.test(b.getName()); })
    .sort(function (a, b) {
      var na = Number((a.getName().match(/(\d+)\.xml$/) || [0, 0])[1]), nb = Number((b.getName().match(/(\d+)\.xml$/) || [0, 0])[1]);
      return na - nb;
    });
  return found.map(function (b) { return xmlText(b.getDataAsString('UTF-8'), kind); }).join('\n');
}

/**
 * [보고서] 칸 → 보낼 것. 링크가 없으면 글 그대로.
 * @return {{text:string, parts:Array<{mime,b64,name}>, files:string[], errors:string[]}}
 */
function readReportSource_(value) {
  var out = { text: '', parts: [], files: [], errors: [] };
  var ids = driveIdsIn(value);
  if (!ids.length) { out.text = String(value || '').trim(); return out; }
  ensureDriveScope_();
  var texts = [], rest = textWithoutLinks(value), total = 0;
  if (rest) texts.push(rest);
  ids.forEach(function (id) {
    var f;
    try { f = DriveApp.getFileById(id); } catch (e) { out.errors.push('파일을 열 수 없습니다(권한이 없거나 지워짐): …' + id.slice(-6)); return; }
    var name = f.getName(), mime = f.getMimeType(), kind = fileKind(mime, name);
    out.files.push(name);
    try {
      if (kind === 'gdoc') {
        try { texts.push(exportGoogleText_(id)); }
        catch (ex) {   // 글자 내보내기가 막히면 PDF 로 바꿔 그림째 보낸다
          var pdf = f.getAs('application/pdf');
          if (pdf.getBytes().length > REPORT_FILE_MAX) throw ex;
          out.parts.push({ mime: 'application/pdf', b64: Utilities.base64Encode(pdf.getBytes()), name: name + '.pdf' });
        }
      }
      else if (kind === 'text') texts.push(f.getBlob().getDataAsString('UTF-8'));
      else if (kind === 'docx' || kind === 'pptx' || kind === 'hwpx') texts.push(zipText_(f.getBlob(), kind));
      else if (kind === 'pdf' || kind === 'image') {
        var size = f.getSize();
        if (size > REPORT_FILE_MAX || total + size > REPORT_PARTS_MAX) { out.errors.push(name + ': 파일이 너무 큽니다(한 학생 10MB까지) — 쪽을 나누거나 사진 해상도를 줄여 올려 주세요'); return; }
        total += size;
        var m = kind === 'pdf' ? 'application/pdf' : (/jpe?g$/i.test(mime) ? 'image/jpeg' : mime);
        out.parts.push({ mime: m, b64: Utilities.base64Encode(f.getBlob().getBytes()), name: name });
      }
      else if (kind === 'hwp') out.errors.push(name + ': 한글(.hwp) 파일은 읽지 못합니다 — 한글에서 PDF나 HWPX로 저장해 올려 주세요');
      else out.errors.push(name + ': 읽을 수 없는 파일 형식(' + mime + ')');
    } catch (e) { out.errors.push(name + ': ' + e.message); }
  });
  out.text = texts.join('\n\n').trim();
  return out;
}

/* ------------------------------------------------------- 요점 뽑기 */
/** 한 학생 보고서 → 요점 (API). @return {{points:string, errors:string[], model:string}} */
function extractPoints_(reportValue, model) {
  var src = readReportSource_(reportValue);
  if (!src.text && !src.parts.length) throw new Error(src.errors.length ? src.errors.join(' / ') : '보고서가 비었습니다.');
  var res = callWithBackup_(EXTRACT_SYSTEM, buildExtractUser(src.text, src.files.filter(function (n, i) { return i < 5; })), model,
                            { parts: src.parts });
  return { points: cleanPoints(res.text), errors: src.errors, model: res.model };
}

/** 메뉴: 선택한(없으면 체크된) 학생의 보고서 요점 뽑기 */
function extractReportPoints() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!isReportActivity_(act)) {
    ui_().alert(APP.MENU, '📄 보고서 시트(○○ ▸입력)에서 학생 줄을 고른 뒤 실행하세요.\n보고서 시트는 메뉴 [✍️ 바로 쓰기 · 📄 보고서 시트 추가]에서 만듭니다.', ui_().ButtonSet.OK);
    return;
  }
  // [생성]을 체크한 학생이 있으면 그 학생들, 없으면 고른 줄
  var rows = checkedRows_(sheet);
  if (!rows.length) rows = selectedRows_(sheet);
  if (!rows.length) { toast_('[생성]을 체크하거나 학생 줄을 고르세요.'); return; }
  var c = function (n) { return colOf_(sheet, APP.HEAD_ROW, n); };
  var withReport = rows.filter(function (r) { return String(sheet.getRange(r, c(REPORT_COL)).getValue()).trim(); });
  if (!withReport.length) { toast_('고른 줄의 [보고서] 칸이 비었습니다.'); return; }
  var filled = withReport.filter(function (r) { return String(sheet.getRange(r, c(POINTS_COL)).getValue()).trim(); });
  var redo = false;
  if (filled.length) {
    var ans = ui_().alert(APP.MENU, filled.length + '명은 [보고서 요점]이 이미 있습니다. 다시 뽑아 덮어쓸까요?\n[아니요]를 누르면 빈 줄만 뽑습니다.', ui_().ButtonSet.YES_NO_CANCEL);
    if (ans === ui_().Button.CANCEL) return;
    redo = ans === ui_().Button.YES;
  }
  var todo = redo ? withReport : withReport.filter(function (r) { return filled.indexOf(r) < 0; });
  runExtraction_(act, sheet, todo, { manual: !apiModelForChecks_() });
}

/**
 * 요점 뽑기 실행 — API 면 학생마다 한 번씩, 키가 없으면 복사·붙여넣기 창(파일은 학생마다 한 명씩, 첨부 안내).
 * @return {{done:number, failed:number, rows:number[]}}  API 로 채운 줄
 */
function runExtraction_(act, sheet, rows, opt) {
  opt = opt || {};
  var c = function (n) { return colOf_(sheet, APP.HEAD_ROW, n); };
  var cR = c(REPORT_COL), cP = c(POINTS_COL), cV = c('검증');
  var model = apiModelForChecks_();
  if (opt.manual || !model) {
    var jobs = rows.map(function (r) {
      var v = String(sheet.getRange(r, cR).getValue());
      var who = sheet.getRange(r, 1, 1, 3).getValues()[0];
      var links = driveIdsIn(v).map(function (id) { return 'https://drive.google.com/open?id=' + id; });
      return { row: r, label: String(who[0]) + '반 ' + String(who[1]) + '번 ' + String(who[2]), links: links,
               user: buildExtractUser(textWithoutLinks(v) || (links.length ? '' : v), links.length ? ['보고서 파일 ' + links.length + '개를 이 대화에 첨부했습니다'] : []) };
    });
    openManualDialog_({ kind: 'extract', sheet: sheet.getName(), target: POINTS_COL, check: '', title: act.name + ' — 보고서 요점 뽑기',
      limit: 0, system: EXTRACT_SYSTEM, jobs: jobs, chunk: 1,   // 요점 답에는 [S1] 표시가 없어 한 명씩
      note: '요점을 시트에 넣은 뒤 읽어 보고 고치세요. 그다음 [생성]을 체크하고 메뉴 ⑥ 을 누르면 세특을 씁니다.' });
    return { done: 0, failed: 0, rows: [] };
  }
  var done = 0, failed = 0, okRows = [], t0 = Date.now();
  usageReset_();
  rows.forEach(function (r, k) {
    if (Date.now() - t0 > RUN_BUDGET_MS) return;
    toast_((k + 1) + '/' + rows.length + ' 보고서 읽는 중…', act.name);
    try {
      var x = extractPoints_(sheet.getRange(r, cR).getValue(), model);
      sheet.getRange(r, cP).setValue(x.points).setWrap(true);
      if (x.errors.length && cV) sheet.getRange(r, cV).setValue('[확인] 보고서 파일: ' + x.errors.join(' / '));
      done++; okRows.push(r);
    } catch (e) {
      if (cV) sheet.getRange(r, cV).setValue('⚠ 요점 뽑기 실패: ' + e.message);
      failed++;
    }
    SpreadsheetApp.flush();
  });
  if (!opt.quiet) toast_('보고서 요점 ' + done + '건' + (failed ? ' / 실패 ' + failed + '건([검증] 칸)' : '') +
                         ' — 요점을 읽고 고친 뒤 생성하세요.' + (usageText_() ? '\n' + usageText_() : ''), act.name);
  return { done: done, failed: failed, rows: okRows };
}

/* ------------------------------------------------------- 폴더에서 가져오기 */
/** 메뉴: 드라이브 폴더(클래스룸 과제 폴더 등)의 보고서 파일을 파일 이름으로 학생에게 붙인다 */
function importReportFolder() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!isReportActivity_(act)) { ui_().alert(APP.MENU, '📄 보고서 시트에서 실행하세요.', ui_().ButtonSet.OK); return; }
  var url = promptText_('보고서 폴더에서 가져오기',
    '보고서 파일이 든 구글 드라이브 폴더의 링크를 붙여 넣으세요.\n(클래스룸 과제 폴더도 됩니다. 파일 이름에 학번(20315)·이름·"3반 15번" 중 하나가 있어야 학생을 찾습니다)');
  if (!url) return;
  var r = importReportFolderCore_(sheet, url);
  ui_().alert(APP.MENU, '학생 ' + r.matched + '명에게 파일을 붙였습니다.' +
    (r.kept ? '\n이미 [보고서]에 내용이 있어 건너뛴 학생: ' + r.kept + '명' : '') +
    (r.unmatched.length ? '\n\n누구 것인지 모르는 파일 ' + r.unmatched.length + '개:\n· ' + r.unmatched.slice(0, 12).join('\n· ') + (r.unmatched.length > 12 ? '\n…' : '') : '') +
    (r.noFile ? '\n\n파일을 못 찾은 학생: ' + r.noFile + '명' : '') +
    '\n\n다음: 학생 줄을 고르고 메뉴 ⑥ 생성 더 보기 > [📄 보고서 요점 뽑기].', ui_().ButtonSet.OK);
}

function importReportFolderCore_(sheet, url) {
  var fid = driveFolderIdIn(url) || (String(url).trim().match(/^[A-Za-z0-9_-]{20,}$/) || [''])[0];
  if (!fid) throw new Error('폴더 링크를 알아보지 못했습니다. 드라이브에서 폴더를 열고 주소창의 링크를 복사하세요.');
  ensureDriveScope_();
  var folder = DriveApp.getFolderById(fid);
  var last = sheet.getLastRow();
  var n = Math.max(0, last - APP.DATA_ROW + 1);
  var who = n ? sheet.getRange(APP.DATA_ROW, 1, n, 3).getValues() : [];
  var students = who.map(function (w) {
    var a = String(w[0]).trim(), m = a.match(/^(\d)-(\d+)$/);
    return { year: m ? Number(m[1]) : '', cls: m ? Number(m[2]) : Number(a), no: Number(w[1]), name: String(w[2]).trim() };
  });
  var cR = colOf_(sheet, APP.HEAD_ROW, REPORT_COL);
  var cur = n ? sheet.getRange(APP.DATA_ROW, cR, n, 1).getValues().map(function (x) { return String(x[0]); }) : [];
  var add = {}, unmatched = [], count = 0;
  var it = folder.getFiles();
  while (it.hasNext() && count < 1000) {
    var f = it.next(); count++;
    var i = matchFileToStudent(f.getName(), students);
    if (i < 0) { unmatched.push(f.getName()); continue; }
    (add[i] = add[i] || []).push('https://drive.google.com/open?id=' + f.getId());
  }
  var matched = 0, kept = 0;
  Object.keys(add).forEach(function (k) {
    var i = Number(k);
    if (String(cur[i]).trim() && !driveIdsIn(cur[i]).length) { kept++; return; }   // 본문을 붙여 둔 학생은 그대로
    var have = driveIdsIn(cur[i]);
    var links = add[i].filter(function (l) { return have.indexOf(driveIdsIn(l)[0]) < 0; });
    var v = (String(cur[i]).trim() ? String(cur[i]).trim() + '\n' : '') + links.join('\n');
    sheet.getRange(APP.DATA_ROW + i, cR).setValue(v);
    matched++;
  });
  return { matched: matched, kept: kept, unmatched: unmatched, noFile: students.filter(function (s, i) { return s.name && !add[i]; }).length };
}

/* ------------------------------------------------------- 예시로 등록 */
/** 메뉴: 선택한 학생의 [최종본](없으면 AI 결과)을 이 활동의 예시로 */
function promoteToExample() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트(○○ ▸입력)에서 예시로 쓸 학생 줄을 고른 뒤 실행하세요.', ui_().ButtonSet.OK); return; }
  var rows = selectedRows_(sheet);
  if (!rows.length) { toast_('예시로 쓸 학생 줄을 고르세요.'); return; }
  var ok = ui_().alert(APP.MENU, '선택한 ' + rows.length + '명의 [최종본](비었으면 AI 결과)을 [' + act.name + ']의 예시로 등록합니다.\n\n' +
    '예시는 다른 학생을 생성할 때 AI 에게 함께 갑니다(학생 이름은 가지 않음). 선생님이 직접 쓰거나 고친 글일수록 좋습니다.\n' +
    '수준이 다른 학생 3~5명이 알맞습니다. 계속할까요?', ui_().ButtonSet.YES_NO);
  if (ok !== ui_().Button.YES) return;
  var r = promoteRows_(act, sheet, rows);
  toast_('예시 ' + r.added + '건 등록 → [' + r.exSheet + '] (지금 예시 ' + r.total + '건, 프롬프트에는 앞에서 ' + EXAMPLE_MAX + '건까지)' +
         (r.skipped ? ' · 글이 없어 건너뜀 ' + r.skipped + '명' : ''), act.name);
}

function promoteRows_(act, sheet, rows) {
  var cols = parseColumns(act.columns);
  var cFi = colOf_(sheet, APP.HEAD_ROW, '최종본'), cAi = colOf_(sheet, APP.HEAD_ROW, 'AI 결과');
  var exs = [], skipped = 0;
  rows.forEach(function (r) {
    var result = String(cFi ? sheet.getRange(r, cFi).getValue() : '').trim() || String(cAi ? sheet.getRange(r, cAi).getValue() : '').trim();
    if (!result || result.indexOf('⚠') === 0) { skipped++; return; }
    exs.push({ values: sheet.getRange(r, 5, 1, cols.length).getValues()[0].map(function (v) { return String(v); }), result: result });
  });
  var ex = act.exSheet && sh_(act.exSheet);
  if (!ex) {
    ex = buildActivityExampleSheet_(act.key, act.name, cols, []);
    var list = shRequire_(APP.SH.ACTIVITY);
    var c = colOf_(list, 2, '예시 시트');
    if (c && act.__row) list.getRange(act.__row, c).setValue(ex.getName());
  }
  var cResult = colOf_(ex, APP.HEAD_ROW, '결과') || (1 + cols.length + 1);
  var last = Math.max(ex.getLastRow(), APP.DATA_ROW - 1);
  var empty = [];
  if (last >= APP.DATA_ROW) {
    var v = ex.getRange(APP.DATA_ROW, 1, last - APP.DATA_ROW + 1, cResult).getValues();
    v.forEach(function (row, i) { if (row.slice(1).every(function (x) { return String(x).trim() === ''; })) empty.push(APP.DATA_ROW + i); });
  }
  exs.forEach(function (e) {
    var at = empty.length ? empty.shift() : Math.max(ex.getLastRow(), APP.DATA_ROW - 1) + 1;
    writeExampleRows_(ex, cols, [e], at, 1);
  });
  try { validateExamplesQuiet_(getActivity_(act.key) || act); } catch (e) {}
  return { added: exs.length, skipped: skipped, exSheet: ex.getName(), total: readExampleRows_(getActivity_(act.key) || act).length };
}

/* ------------------------------------------------------- ✒️ 내 문체 */
var STYLE_HEAD = ['사용', '예전에 쓴 세특 (한 칸에 한 편)', '기록 항목', '메모'];

function buildStyleSheet() {
  var s = shOrCreate_(APP.SH.STYLE);
  var n = STYLE_HEAD.length;
  banner_(s, n, '✒️ 내 문체 — 예전에 쓴 세특으로 "나처럼" 쓰게 하기',
    '예전에 직접 쓴 세특을 한 칸에 한 편씩 붙여 넣으세요(학생 이름은 지우고). [사용]을 켠 앞의 ' + STYLE_SAMPLE_MAX + '편이 "문체 예시"로 모든 생성에 함께 가고, ' +
    '메뉴 ⑧ [✒️ 내 문체 카드 만들기]를 누르면 쓰는 방식만 뽑은 카드가 [📐 공통규칙]의 STYLE_CARD 에 저장되어 학생마다 쓰기 직전에 한 번 더 보여 줍니다. ' +
    '끄려면 [⚙️ 설정]의 내 문체 적용을 FALSE 로.');
  s.setRowHeight(2, 8);
  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([STYLE_HEAD]);
  styleHeader_(s, APP.HEAD_ROW, n, '#4a3f6b');
  s.setFrozenRows(APP.HEAD_ROW);
  ensureRows_(s, APP.DATA_ROW + 30);
  s.getRange(APP.DATA_ROW, 1, 30, 1).insertCheckboxes();
  s.getRange(APP.DATA_ROW, 2, 30, 1).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
  [56, 640, 110, 200].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  return s;
}

/** [📐 공통규칙]에 STYLE_CARD 줄이 없으면 맨 아래에 더한다 (옛 사본) */
function ensureStyleCardRow_() {
  var s = sh_(APP.SH.COMMON);
  if (!s) return;
  var last = s.getLastRow();
  var keys = last >= 3 ? s.getRange(3, 1, last - 2, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  if (keys.indexOf('STYLE_CARD') >= 0) return;
  s.getRange(last + 1, 1, 1, 3).setValues([['STYLE_CARD', '내 문체 카드', '']]);
  s.getRange(last + 1, 1, 1, 2).setBackground(APP.COLORS.lock);
  s.getRange(last + 1, 3).setBackground(APP.COLORS.input).setWrap(true).setVerticalAlignment('top');
}

/** [사용]을 켠 예전 세특 (앞에서부터) */
function styleSampleTexts_(max) {
  var s = sh_(APP.SH.STYLE);
  if (!s || s.getLastRow() < APP.DATA_ROW) return [];
  return s.getRange(APP.DATA_ROW, 1, s.getLastRow() - APP.DATA_ROW + 1, 2).getValues()
    .filter(function (r) { return (r[0] === true || String(r[0]).toUpperCase() === 'TRUE') && String(r[1]).trim(); })
    .map(function (r) { return String(r[1]).trim(); })
    .slice(0, max || STYLE_SAMPLE_MAX);
}

var __styleSamples = null;
function readStyleSamples_() {
  if (__styleSamples !== null) return __styleSamples;
  var t = styleSampleTexts_(STYLE_SAMPLE_MAX);
  __styleSamples = t.map(function (x, i) { return '## 문체 예시' + (i + 1) + '\n' + x; }).join('\n\n');
  return __styleSamples;
}

/** 문체 검사의 기준 글: 이 활동의 예시 결과 + 내 문체 예시 */
function styleReference_(act) {
  var texts = [];
  try { texts = readExampleRows_(act).map(function (e) { return e.result; }); } catch (e) {}
  if (styleOn_()) texts = texts.concat(styleSampleTexts_(6));
  return styleProfile(texts.slice(0, 12)) ;
}

function openStyleDialog() {
  if (!sh_(APP.SH.STYLE)) buildStyleSheet();
  ensureStyleCardRow_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Style').setWidth(720).setHeight(640);
  ui_().showModalDialog(html, '✒️ 내 문체 카드');
}

function styleContext() {
  return { samples: styleSampleTexts_(20).length, card: String(getCommon_().STYLE_CARD || ''), on: styleOn_(),
           model: apiModelForChecks_(), request: STYLE_SYSTEM + '\n\n' + buildStyleUser(styleSampleTexts_(10)) };
}

/** AI 로 문체 카드 만들기 (저장은 하지 않고 돌려준다 — 창에서 보고 [저장]) */
function styleMakeCard() {
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없습니다. [요청문 복사]로 Gemini 앱에서 만들어 붙여 넣으세요.');
  var samples = styleSampleTexts_(10);
  if (samples.length < 2) throw new Error('[✒️ 내 문체] 시트에 예전 세특을 2편 이상 넣고 [사용]을 켜 주세요.');
  usageReset_();
  var res = callWithBackup_(STYLE_SYSTEM, buildStyleUser(samples), model);
  return { card: String(res.text || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim(), usage: usageText_() };
}

function styleSaveCard(text) {
  ensureStyleCardRow_();
  var s = shRequire_(APP.SH.COMMON);
  var v = s.getRange(1, 1, s.getLastRow(), 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === 'STYLE_CARD') { s.getRange(i + 1, 3).setValue(String(text || '').trim()); return '저장했습니다. 다음 생성부터 모든 활동에 적용됩니다.'; }
  }
  throw new Error('공통규칙에 STYLE_CARD 줄을 만들지 못했습니다.');
}

function openStyleSheet() { var s = sh_(APP.SH.STYLE) || buildStyleSheet(); ss_().setActiveSheet(s); }


/* ==========================================================================
   84_Subject.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 📚 새 교과 만들기 (시트 쪽)
 * 요청문·답 읽기·나누는 글은 19_Subjects.gs(순수). 여기서는 창 열기, AI 부르기, [📚 교과영역] 저장.
 *
 * 흐름: 교과 이름 + 교육과정 자료(붙여 넣기·드라이브 PDF/HWPX/구글 문서)
 *   → API 가 있으면 바로 초안, 없으면 요청문 복사 → Gemini 앱 → 답 붙여 넣기
 *   → 창에서 읽고 고침([교육과정 확인 필요] 줄은 확인 체크) → 저장 → (선택) 그 입력 항목으로 활동 만들기
 */

function openSubjectDialog() {
  if (!sh_(APP.SH.SUBJECT) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Subject').setWidth(780).setHeight(720);
  ui_().showModalDialog(html, '📚 새 교과 만들기');
}

function subjectContext() {
  var model = '';
  try { model = apiModelForChecks_(); } catch (e) {}
  return {
    model: model,
    subjects: getSubjects_().map(function (s) { return { key: s.key, name: s.name, kind: s.kind }; }),
    records: getRecordTypes_().map(function (r) { return { key: r.key, name: r.name, chars: r.chars }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통'))
  };
}

/** 키 없이 — Gemini 앱에 붙여 넣을 요청문. 드라이브 파일은 Gemini [+] 로 직접 붙이게 한다 */
function subjectRequest(p) {
  p = p || {};
  if (!String(p.name || '').trim()) throw new Error('교과(과목) 이름을 적어 주세요.');
  var files = driveIdsIn(p.link || '').length ? ['교육과정 파일(Gemini [+] → 드라이브에서 붙임)'] : [];
  return SUBJECT_SYSTEM + '\n\n' + buildSubjectUser({ name: p.name, level: p.level, note: p.note, source: p.source, files: files });
}

/** API 로 초안 — 저장하지 않고 돌려준다(창에서 읽고 고친 뒤 저장) */
function subjectDraft(p) {
  p = p || {};
  if (!String(p.name || '').trim()) throw new Error('교과(과목) 이름을 적어 주세요.');
  var model = apiModelForChecks_();
  if (!model) throw new Error('API 키가 없습니다. [요청문 복사]로 Gemini 앱에서 만들어 답을 붙여 넣으세요.');
  var src = { text: '', parts: [], files: [], errors: [] };
  if (String(p.link || '').trim()) {
    src = readReportSource_(p.link);
    if (!src.text && !src.parts.length) throw new Error(src.errors.length ? src.errors.join(' / ') : '링크에서 읽을 파일을 찾지 못했습니다.');
  }
  var source = [String(p.source || '').trim(), src.text].filter(String).join('\n\n');
  usageReset_();
  var res = callWithBackup_(SUBJECT_SYSTEM,
    buildSubjectUser({ name: p.name, level: p.level, note: p.note, source: source, files: src.files }), model, { parts: src.parts });
  var sub = parseSubjectAnswer(res.text);
  if (sub.missing.length) throw new Error('AI 답을 읽지 못했습니다(' + sub.missing.join('·') + ' 없음). 한 번 더 누르거나 [요청문 복사]로 해 보세요.');
  return { sub: sub, exists: !!findByKey(getSubjects_(), sub.key), errors: src.errors, model: res.model, usage: usageText_() };
}

/** 붙여 넣은 답(또는 공방·다른 선생님이 나눈 교과 글) 읽기 */
function subjectParse(text) {
  var sub = parseSubjectAnswer(text);
  if (sub.missing.length) {
    throw new Error('읽지 못한 것: ' + sub.missing.join('·') + ' — "키: …", "관찰 모습:" 같은 줄이 든 답을 통째로 붙여 넣으세요.');
  }
  return { sub: sub, exists: !!findByKey(getSubjects_(), sub.key) };
}

/**
 * [📚 교과영역]에 저장. 같은 키가 있으면 opts.overwrite 일 때만 덮어쓴다.
 * @param {{key,name,kind,role,comp,columns}} sub
 * @param {{overwrite?:boolean, confirmed?:boolean, makeDefault?:boolean,
 *          activity?:{name:string, recordKey?:string, desc?:string}}} opts  activity 가 있으면 그 입력 항목으로 활동도 만든다
 * @return {{key:string, message:string, inSheet:string}}
 */
function subjectSave(sub, opts) {
  sub = sub || {}; opts = opts || {};
  var key = subjectKeyOf(sub.key || sub.name);
  if (!key) throw new Error('키가 비었습니다.');
  var comp = String(sub.comp || '').trim();
  if (!comp) throw new Error('역량·서술 관점이 비었습니다.');
  if (comp.indexOf(SUBJECT_UNSURE) >= 0 && !opts.confirmed) {
    throw new Error(SUBJECT_UNSURE + ' 표시가 남아 있습니다. 교육과정 문서와 맞춰 본 뒤 [확인했습니다]를 체크하세요.');
  }
  comp = comp.split(SUBJECT_UNSURE).join('').replace(/[ \t]+(\n|$)/g, '$1').trim();
  var name = String(sub.name || key).trim();
  var role = String(sub.role || '').trim() || ('고등학교 ' + name.replace(/\(.*?\)/g, '').trim() + '교사');
  var row = [key, name, sub.kind === '공통' ? '공통' : '교과', role, comp];

  var s = shRequire_(APP.SH.SUBJECT);
  var at = 0;
  readTable_(s, 2).forEach(function (r) { if (String(r['키'] || '').trim() === key) at = r.__row; });
  if (at && !opts.overwrite) throw new Error('이미 "' + key + '" 교과가 있습니다. [같은 키 덮어쓰기]를 체크하거나 키를 바꾸세요.');
  if (at) s.getRange(at, 1, 1, row.length).setValues([row]);
  else { s.appendRow(row); at = s.getLastRow(); }
  s.getRange(at, 1, 1, row.length).setWrap(true).setVerticalAlignment('top');
  refreshActivityValidation_();
  if (opts.makeDefault) setCfg_('기본 교과영역', key);

  var msg = '[📚 교과영역]에 "' + key + '"을(를) ' + (opts.overwrite ? '저장' : '더') + '했습니다.', inSheet = '';
  if (opts.activity && String(opts.activity.name || '').trim()) {
    var cols = Array.isArray(sub.columns) ? sub.columns : parseColumns(sub.columns);
    if (!cols.length) throw new Error('교과는 저장했습니다. 활동을 만들려면 입력 항목을 1개 이상 적어 주세요.');
    var made = createActivity_({
      key: opts.activity.name, name: String(opts.activity.name).trim(), recordKey: opts.activity.recordKey || '과세특',
      subjectKey: key, columns: cols, desc: String(opts.activity.desc || '').trim()
    });
    inSheet = made.inSheet;
    msg += ' 활동 시트 [' + inSheet + ']도 만들었습니다.';
    try { ss_().setActiveSheet(sh_(inSheet)); } catch (e) {}
  }
  return { key: key, message: msg, inSheet: inSheet };
}


/* ==========================================================================
   86_Bytes.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 📏 활동별 바이트 한도
 * 나이스 한 칸(기록 항목)을 여러 활동이 나눠 쓸 때 활동마다 바이트를 정한다.
 * 예) 수학 과세특 1500바이트 = 탐구보고서 750 + 발표 450 + 수업 태도 300
 * 나눠 두면 ⑦ 최종취합의 합본이 한 칸을 넘지 않아 압축(AI 한 번 더)이 필요 없다.
 *
 * 묶음: 교과 기록(과세특)은 교과마다 다른 칸이라 (기록종류, 교과영역)으로, 창체·행발은 기록종류로.
 */

function openBytesDialog() {
  migrateActivityBytes_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Bytes').setWidth(720).setHeight(640);
  ui_().showModalDialog(html, '📏 활동별 바이트 한도');
}

/** @return {Array<{id,title,cap,chars,note,acts:Array<{key,name,bytes,mode}>}>} */
function bytesContext() {
  var recs = getRecordTypes_(), subs = getSubjects_(), groups = {}, order = [];
  getActivities_().forEach(function (a) {
    var rec = findByKey(recs, a.recordKey);
    if (!rec) return;
    var sub = findByKey(subs, a.subjectKey);
    var bySubject = !!(sub && sub.kind === '교과');
    var id = rec.key + (bySubject ? '·' + sub.key : '');
    if (!groups[id]) {
      groups[id] = { id: id, recordKey: rec.key, title: rec.name + (bySubject ? ' — ' + (sub.name || sub.key) : ''),
                     cap: rec.chars * 3, chars: rec.chars, note: String(rec.note || ''), acts: [] };
      order.push(id);
    }
    groups[id].acts.push({ key: a.key, name: a.name, bytes: activityBytes(a, rec), mode: a.mode });
  });
  return order.map(function (id) { return groups[id]; });
}

/**
 * @param {Array<{key:string, bytes:number}>} list  비우거나 0 이면 기록 항목 한도 전체
 * @return {string}
 */
function bytesSave(list) {
  migrateActivityBytes_();
  var s = shRequire_(APP.SH.ACTIVITY);
  var c = colOf_(s, 2, '바이트 한도');
  if (!c) throw new Error('[🗂 활동목록]에 [바이트 한도] 칸이 없습니다. 메뉴 ① 처음 설치 / 구조 복구 를 먼저 눌러 주세요.');
  var recs = getRecordTypes_(), acts = getActivities_(), n = 0;
  (list || []).forEach(function (x) {
    var a = acts.filter(function (k) { return k.key === x.key; })[0];
    if (!a) return;
    var rec = findByKey(recs, a.recordKey), cap = (rec ? rec.chars : 500) * 3;
    var b = Math.floor(Number(x.bytes) || 0);
    if (b <= 0 || b > cap) b = cap;
    if (b < 60) throw new Error(a.name + ': 60바이트(한글 20자)보다 작게는 정할 수 없습니다.');
    if (b === activityBytes(a, rec) && Number(a.bytes) === b) return;
    s.getRange(a.__row, c).setValue(b);
    a.bytes = b;
    if (rec) refreshInputTitle_(a);
    n++;
  });
  return n ? n + '개 활동의 바이트 한도를 저장했습니다. 다음 생성부터 적용됩니다.' : '바뀐 것이 없습니다.';
}


/* ==========================================================================
   88_Studio.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 🧪 세특 프롬프트 공방 (시트 안에서 열기)
 *
 * 웹 공방(web/prompt-studio.html)과 같은 파일이 UI_Studio.html 로 들어온다(tools/build-studio.js 가 만듦).
 * 시트 안에서 열면 페이지가 studioContext() 로 이 시트의 [🧩 기록종류]·[📚 교과영역]·[📐 공통규칙]·[📏 기재요령]을 받아 쓰고,
 * 복사·붙여넣기 대신 [활동 시트 만들기]·[교과영역에 저장](subjectSave)으로 바로 시트에 넣는다.
 * GitHub 나 다른 사이트에 들어갈 필요가 없고, 사본마다 그대로 따라간다.
 */

function openStudio() {
  if (!sh_(APP.SH.RECORD) || !sh_(APP.SH.SUBJECT) || !sh_(APP.SH.ACTIVITY)) installCore_();
  var html = HtmlService.createHtmlOutputFromFile('UI_Studio').setWidth(1120).setHeight(780);
  ui_().showModalDialog(html, '🧪 세특 프롬프트 공방');
}

/** 페이지가 쓸 이 시트의 기록종류·교과·공통규칙·기재요령 규칙 */
function studioContext() {
  var com = getCommon_(), common = {};
  ['WRITING_RULES', 'NEIS_RULES', 'BYTE_RULE', 'GRADE_RULE', 'INSTRUCTION'].forEach(function (k) {
    if (String(com[k] || '').trim()) common[k] = com[k];
  });
  var info = currentPackInfo_();
  return {
    records: getRecordTypes_(),
    subjects: getSubjects_(),
    common: common,
    rules: rulesAll_(),
    rulesId: info.id,
    activities: getActivities_().map(function (a) { return a.name; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    years: Number(cfg_('교사 경력(년)', 15)) || 15,
    version: APP.VERSION
  };
}

/**
 * 공방에서 설계한 활동을 이 시트에 만든다 (입력 시트 + 예시 시트 + 명단).
 * @param {{name:string, recordKey:string, subjectKey:string, bytes:number, columns:string[], desc?:string, exIn?:string, exOut?:string}} p
 * @return {{inSheet:string, exSheet:string, message:string}}
 */
function studioCreateActivity(p) {
  p = p || {};
  var name = String(p.name || '').trim();
  if (!name) throw new Error('활동 이름을 적어 주세요.');
  var cols = validateColumns_(p.columns);
  var examples = [];
  if (String(p.exOut || '').trim()) examples.push({ values: exampleValuesFrom(cols, p.exIn), result: cleanResult_(p.exOut) });
  var made = createActivity_({
    key: name, name: name, recordKey: p.recordKey, subjectKey: p.subjectKey,
    bytes: Number(p.bytes) || 0, columns: cols, desc: String(p.desc || '').trim(), examples: examples
  });
  return {
    inSheet: made.inSheet, exSheet: made.exSheet,
    message: '[' + made.inSheet + '] 시트를 만들었습니다' + (examples.length ? ' (예시 1편은 [' + made.exSheet + ']에)' : '') + '.'
  };
}

/** 만든 시트로 가기 */
function studioOpenSheet(name) {
  var s = sh_(String(name || ''));
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + name);
  ss_().setActiveSheet(s);
  return true;
}


/* ==========================================================================
   90_Forms.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 📝 구글 설문지 연결
 *
 * 설문지 응답 시트(폼의 [응답] → [Sheets에 연결] → 이 파일)를 활동 시트에 잇는다.
 *   · 학생 칸(학번·학년·반·번호·이름)과 문항을 머리글 "이름"으로 읽는다 — 문항 순서를 바꾸거나 이메일 수집을 켜도 흔들리지 않는다
 *   · 문항 → 칸 연결은 창에서 고른다(이름이 같으면 저절로). 여러 문항을 한 칸에 모을 수 있다
 *   · 같은 학생이 여러 번 내면 마지막 응답, 명단에 없는 학생은 줄을 더하거나(선택) 목록으로 알려 준다
 *   · 선생님이 고친 칸은 덮어쓰지 않는다(설문지에서 넣은 값의 지문을 칸 메모에 남겨 비교)
 *   · [응답이 오면 저절로 받아 오기]를 켜면 제출 때마다 받아 오고, 원하면 그 학생만 바로 생성한다
 *   · 파일 업로드 문항(보고서)은 드라이브 링크로 들어오고, 📄 보고서 시트가 그 파일을 읽어 요점을 뽑는다
 * 연결 정보는 이 파일(DocumentProperties)에 저장한다.
 */

var FORM_LINKS_PROP = 'FORM_LINKS';
var FORM_NEW_COL = '＋';    // 새 활동: 이 문항 이름으로 새 입력 항목

/** 설문지 응답 시트 후보 — 1행 첫 칸이 타임스탬프 */
function formSheets_() {
  var acts = {};
  try { getActivities_().forEach(function (a) { acts[a.inSheet] = 1; acts[a.exSheet] = 1; }); } catch (e) {}
  return ss_().getSheets().filter(function (s) {
    if (acts[s.getName()] || s.getLastRow() < 1 || s.getLastColumn() < 2) return false;
    return /타임스탬프|timestamp/i.test(String(s.getRange(1, 1).getValue()));
  });
}

function formLinks_() {
  try { return JSON.parse(PropertiesService.getDocumentProperties().getProperty(FORM_LINKS_PROP) || '[]') || []; }
  catch (e) { return []; }
}
function saveFormLinks_(links) {
  PropertiesService.getDocumentProperties().setProperty(FORM_LINKS_PROP, JSON.stringify(links));
  ensureFormTrigger_(links);
}

/** 저절로 받아 오기를 켠 연결이 있으면 제출 트리거 하나, 없으면 지운다 */
function ensureFormTrigger_(links) {
  var want = (links || formLinks_()).some(function (l) { return l.auto; });
  var have = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'onFormSubmitInstalled'; });
  if (want && !have.length) ScriptApp.newTrigger('onFormSubmitInstalled').forSpreadsheet(ss_()).onFormSubmit().create();
  if (!want) have.forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

/* ------------------------------------------------------- 창 */
function openFormDialog() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Form').setWidth(780).setHeight(700);
  ui_().showModalDialog(html, '📝 구글 설문지 연결');
}

/** 응답 시트 하나의 머리글 해석 + 파일 업로드 문항 찾기 */
function formSheetInfo_(s) {
  var head = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var info = parseFormHeader(head);
  var n = Math.min(Math.max(s.getLastRow() - 1, 0), 30);
  var sample = n ? s.getRange(2, 1, n, head.length).getValues() : [];
  info.questions.forEach(function (q) {
    q.isFile = sample.some(function (r) { return driveIdsIn(r[q.i]).length > 0; });
  });
  return { name: s.getName(), rows: Math.max(s.getLastRow() - 1, 0), head: head, info: info };
}

function formDialogContext() {
  var acts = getActivities_();
  return {
    sheets: formSheets_().map(formSheetInfo_),
    activities: acts.map(function (a) { return { key: a.key, name: a.name, mode: a.mode, cols: parseColumns(a.columns) }; }),
    records: getRecordTypes_().map(function (r) { return { key: r.key, name: r.name }; }),
    subjects: getSubjects_().map(function (s) { return { key: s.key, name: s.name }; }),
    defaultSubject: String(cfg_('기본 교과영역', '공통')),
    links: formLinks_().map(function (l) {
      var a = getActivity_(l.act);
      return { sheet: l.sheet, act: l.act, actName: a ? a.name : '(지워진 활동)', auto: !!l.auto, autoGen: !!l.autoGen, last: l.last || '' };
    }),
    hasKey: !!apiModelForChecks_(), rosterCount: (function () { try { return getRoster_().length; } catch (e) { return 0; } })(),
    reportCols: REPORT_COLUMNS
  };
}

/**
 * 연결 저장 + 지금 받아 오기
 * @param {{sheet:string, keys:Object, map:Object<string,string>, target:{type:string, key?:string, kind?:string, name?:string,
 *          recordKey?:string, subjectKey?:string}, auto:boolean, autoGen:boolean, addMissing:boolean}} p
 */
function formSave(p) {
  var fs = sh_(p.sheet);
  if (!fs) throw new Error('응답 시트를 찾을 수 없습니다: ' + p.sheet);
  var keys = p.keys || {};
  if (!(keys.sid >= 0 || (keys.cls >= 0 && keys.no >= 0) || keys.name >= 0)) {
    throw new Error('학생을 알아볼 칸(학번, 또는 반·번호, 또는 이름)을 하나 이상 골라 주세요.');
  }
  var map = p.map || {};
  var act;
  if (p.target.type === 'existing') {
    act = getActivity_(p.target.key);
    if (!act) throw new Error('활동을 찾을 수 없습니다.');
  } else {
    var name = safeKey_(p.target.name);
    if (!name) throw new Error('새 시트 이름을 적어 주세요.');
    var base = { name: name, recordKey: p.target.recordKey, subjectKey: p.target.subjectKey, desc: '구글 설문지로 받은 학생 응답' };
    if (p.target.kind === '보고서') act = getActivity_(createReportSheet(base).name);
    else if (p.target.kind === '바로쓰기') act = getActivity_(createQuickSheet(base).name);
    else {
      var cols = Object.keys(map).filter(function (q) { return map[q] === FORM_NEW_COL; });
      if (!cols.length) throw new Error('새 활동의 입력 항목으로 쓸 문항을 하나 이상 고르세요.');
      cols.forEach(function (q) { map[q] = q.replace(/[|,\n]/g, ' ').trim().slice(0, 40); });
      var made = createActivity_({ key: name, name: name, recordKey: p.target.recordKey, subjectKey: p.target.subjectKey,
                                   columns: cols.map(function (q) { return map[q]; }), desc: base.desc, examples: [] });
      act = getActivity_(made.key);
    }
  }
  var target = parseColumns(act.columns);
  Object.keys(map).forEach(function (q) { if (map[q] && target.indexOf(map[q]) < 0) map[q] = ''; });
  if (!Object.keys(map).some(function (q) { return map[q]; })) throw new Error('시트로 보낼 문항을 하나 이상 연결해 주세요.');
  var links = formLinks_().filter(function (l) { return l.sheet !== p.sheet; });
  var link = { sheet: p.sheet, act: act.key, keys: keys, map: map, auto: !!p.auto, autoGen: !!p.autoGen, addMissing: !!p.addMissing };
  links.push(link);
  saveFormLinks_(links);
  var r = pushFormLink_(link);
  link.last = stamp_();
  saveFormLinks_(links);
  return { act: act.name, inSheet: act.inSheet, result: r, text: formResultText_(r) };
}

function formUnlink(sheetName) {
  saveFormLinks_(formLinks_().filter(function (l) { return l.sheet !== sheetName; }));
  return '연결을 끊었습니다. 응답 시트와 이미 받아 온 내용은 그대로 있습니다.';
}

function formRunNow(sheetName) {
  var links = formLinks_();
  var l = links.filter(function (x) { return x.sheet === sheetName; })[0];
  if (!l) throw new Error('연결이 없습니다.');
  var r = pushFormLink_(l);
  l.last = stamp_();
  saveFormLinks_(links);
  return formResultText_(r);
}

/** 메뉴: 연결해 둔 설문지를 모두 지금 받아 온다 (없으면 연결 창) */
function syncFormResponses() {
  var links = formLinks_();
  if (!links.length) { openFormDialog(); return; }
  var lines = [];
  links.forEach(function (l) {
    try { lines.push('· ' + l.sheet + ' → ' + formResultText_(pushFormLink_(l))); l.last = stamp_(); }
    catch (e) { lines.push('· ' + l.sheet + ' — ' + e.message); }
  });
  saveFormLinks_(links);
  ui_().alert(APP.MENU, '설문지 응답을 받아 왔습니다.\n\n' + lines.join('\n'), ui_().ButtonSet.OK);
}

function formResultText_(r) {
  var t = '학생 ' + r.students + '명 반영';
  if (r.appended) t += ' · 새 줄 ' + r.appended;
  if (r.kept) t += ' · 선생님이 고친 칸 ' + r.kept + '개는 그대로';
  if (r.unmatched.length) t += ' · 명단에 없는 응답 ' + r.unmatched.length + '건(' + r.unmatched.slice(0, 5).join(', ') + (r.unmatched.length > 5 ? ' …' : '') + ')';
  return t;
}

/* ------------------------------------------------------- 받아 오기 */
/**
 * 응답 시트 → 활동 입력 시트
 * @return {{students:number, appended:number, kept:number, unmatched:string[], rows:number[]}}  rows = 이번에 값이 바뀐 줄
 */
function pushFormLink_(link) {
  var fs = sh_(link.sheet);
  if (!fs) throw new Error('응답 시트가 없습니다: ' + link.sheet);
  var act = getActivity_(link.act);
  if (!act) throw new Error('보낼 활동이 지워졌습니다. 연결을 다시 만드세요.');
  var t = sh_(act.inSheet);
  if (!t) throw new Error('입력 시트가 없습니다: ' + act.inSheet);
  var out = { students: 0, appended: 0, kept: 0, unmatched: [], rows: [] };
  var last = fs.getLastRow();
  if (last < 2) return out;

  var head = fs.getRange(1, 1, 1, fs.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var info = parseFormHeader(head);
  ['sid', 'year', 'cls', 'no', 'name'].forEach(function (k) {
    if (link.keys && link.keys[k] !== undefined && link.keys[k] !== null) info[k] = Number(link.keys[k]);
  });
  var resps = latestResponses(fs.getRange(2, 1, last - 1, head.length).getValues(), info);
  if (!resps.length) return out;

  var cols = parseColumns(act.columns);
  var byCol = {};       // 칸 이름 → [{title, i}]
  head.forEach(function (h, i) {
    var c = link.map && link.map[h];
    if (c && cols.indexOf(c) >= 0) (byCol[c] = byCol[c] || []).push({ title: h, i: i });
  });
  var grade = classHead_() === '학년-반';
  var labelOf = function (st) { return grade && st.year !== '' ? st.year + '-' + st.cls : String(st.cls); };

  // 학생 줄 찾기 — 반(학년-반)·번호, 안 되면 이름이 한 명뿐일 때
  var n0 = Math.max(t.getLastRow() - APP.DATA_ROW + 1, 0);
  var who = n0 ? t.getRange(APP.DATA_ROW, 1, n0, 3).getValues() : [];
  var byId = {}, byName = {}, nameCnt = {};
  who.forEach(function (w, i) {
    var id = String(w[0]).trim() + '-' + String(w[1]).trim();
    if (id !== '-') byId[id] = APP.DATA_ROW + i;
    var nm = String(w[2]).trim();
    if (nm) { nameCnt[nm] = (nameCnt[nm] || 0) + 1; byName[nm] = APP.DATA_ROW + i; }
  });
  var targets = [];
  resps.forEach(function (r) {
    var st = r.st;
    var row = (st.cls !== '' && st.no !== '') ? byId[labelOf(st) + '-' + st.no] : 0;
    if (!row && st.name && nameCnt[st.name] === 1) row = byName[st.name];
    if (!row) {
      var lab = (st.cls !== '' ? labelOf(st) + '반 ' : '') + (st.no !== '' ? st.no + '번 ' : '') + (st.name || '');
      if (!link.addMissing || st.cls === '' || st.no === '') { out.unmatched.push(lab.trim() || '(학생 칸 비어 있음)'); return; }
      row = Math.max(t.getLastRow(), APP.DATA_ROW - 1) + 1;
      ensureRows_(t, row);
      t.getRange(row, 1).setNumberFormat('@');
      t.getRange(row, 1, 1, 3).setValues([[labelOf(st), st.no, st.name]]);
      byId[labelOf(st) + '-' + st.no] = row;
      out.appended++;
    }
    targets.push({ row: row, resp: r });
  });
  if (out.appended) applyRowFormat_(t, t.getLastRow() - APP.DATA_ROW + 1);

  // 칸마다 한 번에 읽고 한 번에 쓴다 (선생님이 고친 칸은 남김)
  var nRows = t.getLastRow() - APP.DATA_ROW + 1;
  var when = stamp_();
  var touched = {}, changedRows = {};   // touched: 응답이 반영돼 있는 학생 · changedRows: 이번에 값이 바뀐 학생(바로 생성 대상)
  Object.keys(byCol).forEach(function (c) {
    var col = 5 + cols.indexOf(c);
    var rng = t.getRange(APP.DATA_ROW, col, nRows, 1);
    var vals = rng.getValues(), notes = rng.getNotes();
    var changed = false;
    targets.forEach(function (x) {
      var v = joinAnswers(byCol[c].map(function (q) { return { title: q.title, value: x.resp.row[q.i] }; }));
      if (!String(v).trim()) return;
      var k = x.row - APP.DATA_ROW;
      if (String(vals[k][0]) === v) { touched[x.row] = 1; return; }
      if (!formCellWritable(vals[k][0], notes[k][0])) { out.kept++; return; }
      vals[k][0] = v; notes[k][0] = formNote(textHash(v), when);
      changed = true; touched[x.row] = 1; changedRows[x.row] = 1;
    });
    if (changed) { rng.setValues(vals); rng.setNotes(notes); }
  });
  out.rows = Object.keys(changedRows).map(Number).sort(function (a, b) { return a - b; });
  out.students = Object.keys(touched).length;
  SpreadsheetApp.flush();
  return out;
}

/** 설치형 트리거: 설문지 제출 때마다 그 응답 시트를 받아 오고, 켜 두었으면 받은 학생만 생성 */
function onFormSubmitInstalled(e) {
  try {
    var name = e && e.range ? e.range.getSheet().getName() : '';
    var links = formLinks_();
    links.forEach(function (l) {
      if (!l.auto || (name && l.sheet !== name)) return;
      var r = pushFormLink_(l);
      l.last = stamp_();
      if (l.autoGen && r.rows.length && PROVIDERS.some(function (p) { return getKey_(p); })) {
        var act = getActivity_(l.act);
        var t = act && sh_(act.inSheet);
        if (t) runGeneration_(act, t, r.rows);
      }
    });
    PropertiesService.getDocumentProperties().setProperty(FORM_LINKS_PROP, JSON.stringify(links));
  } catch (err) {
    try { toast_('설문지 받아 오기 오류: ' + err.message); } catch (e2) {}
  }
}


/* ==========================================================================
   95_Observe.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 수업/활동 관찰 기록
 * 시트 사이드바에서, 또는 웹앱으로 배포해 휴대폰에서 기록할 수 있습니다.
 * 기록은 해당 활동 입력 시트의 첫 번째 입력 항목 칸에 날짜와 함께 누적됩니다.
 */

function openObserve() {
  var html = HtmlService.createHtmlOutputFromFile('UI_Observe').setTitle('관찰 기록');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** 웹앱 진입점 (배포 후 휴대폰에서 사용) */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('UI_Observe')
    .setTitle('관찰 기록')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function observeContext() {
  return {
    activities: getActivities_().map(function (a) {
      return { key: a.key, name: a.name, firstCol: parseColumns(a.columns)[0] || '관찰 내용' };
    }),
    students: getRoster_().map(function (s) {
      return { id: s.id, label: s.label };
    })
  };
}

/**
 * 관찰 기록 저장
 * @param {Object} p {activityKey, studentId, text, append}
 */
function observeSave(p) {
  var act = getActivity_(p.activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var s = sh_(act.inSheet);
  if (!s) throw new Error('입력 시트를 찾을 수 없습니다.');
  var text = String(p.text || '').trim();
  if (!text) throw new Error('내용이 비었습니다.');

  var last = s.getLastRow();
  if (last < APP.DATA_ROW) throw new Error('학생 명단을 먼저 동기화하세요.');
  var cnt = last - APP.DATA_ROW + 1;
  var ab = s.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var row = 0;
  for (var i = 0; i < cnt; i++) {
    if (String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim() === p.studentId) { row = APP.DATA_ROW + i; break; }
  }
  if (!row) throw new Error('명단에서 학생을 찾지 못했습니다. 메뉴 ③ 동기화를 실행하세요.');

  var cell = s.getRange(row, 5);   // 첫 번째 입력 항목
  var prev = String(cell.getValue() || '').trim();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d');
  var line = stamp + ' ' + text;
  cell.setValue(p.append === false || !prev ? line : prev + '\n' + line);
  return '저장했습니다 (' + act.name + ' · ' + p.studentId + ')';
}

function observeDeployHelp() {
  ui_().alert('수업관찰 웹앱 배포 안내',
    '수업 중 휴대폰으로 기록하고 싶을 때만 필요합니다. 시트 안에서만 쓸 거라면 [수업관찰 기록 열기]로 충분합니다.\n\n' +
    '1) 상단 [확장 프로그램] > [Apps Script]\n' +
    '2) 오른쪽 위 [배포] > [새 배포]\n' +
    '3) 유형 선택(톱니바퀴) > [웹 앱]\n' +
    '4) 실행 사용자: 나\n   액세스 권한: 나만 (또는 우리 학교 도메인)\n' +
    '5) [배포] > 나오는 URL을 휴대폰 홈 화면에 추가\n\n' +
    '※ 배포는 사본마다 한 번씩 직접 해야 하며, 사본을 복사해도 배포는 따라오지 않습니다.',
    ui_().ButtonSet.OK);
}


/* ==========================================================================
   96_Guide.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 함께 쓰면 좋은 도구 안내
 *
 * 업무 인수인계 대시보드(같은 만든이의 윈도우 프로그램)의 [스캔 문서 → 엑셀] 사용 설명서.
 * 손글씨 활동지·신청서를 스캔해 표로 만든 뒤 이 시트의 입력 칸에 붙여 넣는 흐름을 안내한다.
 * [🚀 시작하기] 시트의 버튼과 메뉴 [도움말 · 부가 기능]에서 연다.
 */

var DASHBOARD = {
  repo: 'https://github.com/sced9120/work-dashboard',
  latest: 'https://github.com/sced9120/work-dashboard/releases/latest',
  since: 'v3.3.0'
};

function openOcrGuide() {
  var t = HtmlService.createTemplateFromFile('UI_OcrGuide');
  t.links = JSON.stringify(DASHBOARD);
  ui_().showModalDialog(t.evaluate().setWidth(780).setHeight(660), '📄 스캔 문서 → 엑셀 사용 설명서 (업무 인수인계 대시보드)');
}


/* ==========================================================================
   98_Assets.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 그림 자료 ([🚀 시작하기] 시트의 버튼)
 * PNG 를 base64 로 넣어 두었다(760x104, 시트에는 절반 크기로 붙음). 바꾸려면 tools/make-buttons.py 로 다시 만든다.
 */
var BUTTON_PNG = {
  start: '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',
  quick: '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',
  form: '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',
  check: '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',
  style: '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',
  ocr: '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',
  subject: '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',
  bytes: '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',
  studio: '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',
  help: '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'
};

