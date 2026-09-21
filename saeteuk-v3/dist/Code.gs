/******************************************************************************
 * 세특 작성 도우미 v3.0.0 — 설치용 합본
 *
 * 이 파일 하나에 모든 스크립트가 들어 있습니다.
 * Apps Script 편집기에서 Code.gs 의 내용을 전부 지우고 이 파일을 통째로 붙여넣으세요.
 * HTML 파일 4개는 각각 같은 이름으로 따로 만들어야 합니다:
 *   UI_ApiKey, UI_Observe, UI_Onboard, UI_Wizard
 *
 * 원본은 모듈별로 나뉘어 있습니다: github.com/sced9120/Prompt-Master
 * 고칠 때는 apps-script/ 의 해당 파일을 고치고 node tools/build.js 를 다시 돌리세요.
 * 이 파일을 직접 고치면 다음 빌드 때 덮어써집니다.
 *
 * 빌드: 2026-09-21  ·  원본 15개 파일
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
  VERSION: 'v3.0.0',
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
    note: '공통과목은 학년 전체 500자. 2026학년도 기준.'
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
    body:
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
    key: 'INSTRUCTION',
    title: '마무리 지시문',
    body:
      '아래 학생 자료를 근거로, 위의 모든 규칙을 지켜 특기사항 본문만 출력한다.\n' +
      '제목, 머리말, 설명, 따옴표, 마크다운 기호 없이 완성된 한 문단만 출력한다.'
  }
];

/**
 * 결과 검증용 패턴
 * level: 'block'(기재 금지 · 반드시 수정) | 'check'(오탐 가능 · 눈으로 확인)
 */
var PRESET_BANNED = [
  { level: 'block', label: '공인어학시험', re: '토익|토플|텝스|지텔프|TOEIC|TOEFL|TEPS|G-TELP|HSK|JLPT|OPIc' },
  { level: 'block', label: '수상·등수', re: '수상|최우수상|우수상|장려상|금상|은상|동상|대상 수상|입상|[1-3]위 ?(입상|차지|기록)|메달' },
  { level: 'block', label: '자격증', re: '자격증|자격 ?취득|기능사|산업기사|기사 ?자격|정보처리기사|한국사능력검정' },
  { level: 'block', label: '논문·특허·출판', re: '논문|학회지|등재|특허 ?출원|실용신안|저서 ?출간|책을 ?출간' },
  { level: 'block', label: '모의고사·수능', re: '모의고사|전국연합학력평가|모평|수능 ?성적|백분위|표준점수' },
  { level: 'block', label: '해외활동', re: '어학연수|해외 ?연수|해외 ?봉사|교환학생' },
  { level: 'block', label: '사설기관·학원', re: '학원|과외|사설 ?기관|아카데미|인강|사교육' },
  { level: 'block', label: '부모 정보', re: '아버지|어머니|부모님(의)? ?(직업|회사|사업)|가정 ?형편' },
  { level: 'check', label: '대학·기관명 가능성', re: '[가-힣A-Za-z]{2,10}대학교|[가-힣]{2,10}연구원|[가-힣]{2,10}재단' },
  { level: 'check', label: '대회 언급', re: '대회|공모전|경시' },
  { level: 'check', label: '봉사시간', re: '봉사 ?\\d+ ?시간|헌혈' }
];

/** 형식 검증(어미·인칭·특수문자) */
var PRESET_FORMAT_RULES = [
  { level: 'block', label: '존댓말/평서형 어미', re: '습니다|입니다|했다\\.|이다\\.|였다\\.|한다\\.' },
  { level: 'block', label: "'학생' 주어", re: '학생(은|이|의|을|를|과|와|도)' },
  { level: 'block', label: '금지 특수문자', re: "[·‘’“”\"'\\-–—*#]" },
  { level: 'check', label: '줄바꿈 포함', re: '\\n' }
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
 *   ⑥ 분량      ← 글자수(한 곳에서만 관리) → 문장 자동 생성 + BYTE_RULE
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
 *   o.activity  {key,name,recordKey,subjectKey,chars,columns,desc,mode,custom}
 *   o.record    기록종류 1건
 *   o.subject   교과영역 1건
 *   o.common    {WRITING_RULES, NEIS_RULES, BYTE_RULE, GRADE_RULE, INSTRUCTION}
 *   o.examples  예시 합본 문자열 (없으면 빈 문자열)
 *   o.years     교직 경력 표기 (기본 15)
 * @return {string}
 */
function buildPrompt(o) {
  var act = o.activity || {};
  var rec = o.record || {};
  var sub = o.subject || {};
  var com = o.common || {};
  var chars = Number(act.chars || rec.chars || 500);
  var bytes = chars * 3;
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
      EXAMPLES: o.examples || '',
      CHARS: chars,
      BYTES: bytes,
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

  // ④ 기재 금지사항
  if (com.NEIS_RULES) P.push('# 학생부 기재 금지사항\n' + com.NEIS_RULES);

  // ⑤ 관점 · 역량
  var persp = [];
  if (rec.view) persp.push(rec.view);
  if (sub.comp) persp.push(sub.comp);
  if (persp.length) P.push('# 서술 관점과 역량\n' + persp.join('\n\n'));

  // ⑥ 분량 (단일 출처)
  var len = ['# 분량'];
  len.push('- ' + chars + '자(' + bytes + '바이트) 이내로 작성한다.');
  len.push('- ' + Math.round(bytes * 0.9) + '바이트 이상을 채워 충실하게 작성한다.');
  if (com.BYTE_RULE) len.push(com.BYTE_RULE);
  P.push(len.join('\n'));

  // ⑦-1 입력 형식
  if (cols.length) {
    P.push('# 입력 자료 형식\n아래 학생 자료는 다음 항목이 | 로 구분되어 제공된다.\n' + cols.join('|'));
  }

  // ⑦-2 예시
  if (o.examples && String(o.examples).trim()) {
    P.push('# 예시\n표현 방식과 서술 흐름을 참고한다. 문장을 그대로 베끼지 않는다.\n\n' + String(o.examples).trim());
  }

  // ⑦-3 성취수준 (해당 기록 종류에만)
  if (rec.useGrade && com.GRADE_RULE) {
    P.push('# 성취수준 반영\n' + com.GRADE_RULE);
  }

  // ⑦-4 마무리 지시문
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

/** 결과 검증 — 바이트 / 기재 금지 / 형식 */
function validateResult(text, limitBytes, banned, formatRules) {
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
      issues.push({ level: r.level || 'check', label: r.label, hit: uniq.slice(0, 5).join(', ') });
    }
  }

  var blocks = issues.filter(function (x) { return x.level === 'block'; });
  return { ok: blocks.length === 0, bytes: b, issues: issues };
}

/** 검증 결과를 셀에 넣을 짧은 문자열로 */
function formatIssues(v) {
  if (!v.issues.length) return '통과 (' + v.bytes + 'B)';
  var parts = v.issues.map(function (x) {
    return (x.level === 'block' ? '[수정] ' : '[확인] ') + x.label + (x.hit ? ' → ' + x.hit : '');
  });
  return (v.ok ? '확인필요 ' : '수정필요 ') + '(' + v.bytes + 'B)\n' + parts.join('\n');
}

/* Node 테스트용 export (Apps Script에서는 무시됨) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    byteLen: byteLen, trimToBytes: trimToBytes, parseColumns: parseColumns,
    findByKey: findByKey, fillTokens: fillTokens, buildPrompt: buildPrompt,
    buildRole: buildRole, buildStudentBlock: buildStudentBlock,
    validateResult: validateResult, formatIssues: formatIssues
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
      note: String(r['비고'] || '')
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
      chars: Number(r['글자수'] || 0) || 0,
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
  return buildPrompt({
    activity: act, record: rec, subject: sub, common: com,
    examples: examples === undefined ? readExamples_(act) : examples,
    years: Number(cfg_('교사 경력(년)', 15))
  });
}

/** 활동의 글자수(활동값 > 기록종류 기본값) */
function charsFor_(act) {
  if (act.chars) return act.chars;
  var rec = findByKey(getRecordTypes_(), act.recordKey);
  return rec ? rec.chars : 500;
}

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
  var cols = parseColumns(act.columns);
  var rows = readExampleRows_(act);
  var cap = typeof EXAMPLE_MAX === 'number' ? EXAMPLE_MAX : 8;
  var out = [];
  for (var i = 0; i < rows.length && i < cap; i++) {
    var parts = [];
    for (var c = 0; c < cols.length; c++) {
      if (rows[i].values[c]) parts.push(cols[c] + ': ' + rows[i].values[c].replace(/\n/g, ' '));
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
 * 1행에 제목과 안내문을 함께 넣는다.
 * 데이터 영역 아래에 안내문을 두면 readTable_ 이 그 줄을 데이터로 읽어
 * 유령 항목이 생기므로, 설정용 시트의 안내문은 반드시 1행에 둔다.
 */
function banner_(sheet, lastCol, title, note) {
  var text = note ? (title + '\n' + note) : title;
  var rng = sheet.getRange(1, 1, 1, Math.max(lastCol, 1));
  rng.merge().setBackground('#eceff1').setWrap(true).setVerticalAlignment('middle');
  var rt = SpreadsheetApp.newRichTextValue().setText(text)
    .setTextStyle(0, title.length, SpreadsheetApp.newTextStyle()
      .setBold(true).setFontSize(13).setForegroundColor('#263238').build());
  if (note) {
    rt.setTextStyle(title.length, text.length, SpreadsheetApp.newTextStyle()
      .setBold(false).setFontSize(10).setForegroundColor('#546e7a').build());
  }
  rng.setRichTextValue(rt.build());
  sheet.setRowHeight(1, note ? 62 : 34);
}

function noteRow_(sheet, row, lastCol, text) {
  var r = sheet.getRange(row, 1, 1, Math.max(lastCol, 1));
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
  var m = ui_().createMenu(APP.MENU);
  m.addItem('🚀 시작하기 (처음이면 여기)', 'openOnboard');
  m.addSeparator();
  m.addItem('① 처음 설치 / 구조 복구', 'installAll');
  m.addSeparator();
  m.addItem('② AI 연결 설정', 'openApiDialog');
  m.addItem('   연결 테스트', 'testConnection');
  m.addSeparator();
  m.addItem('③ 학생 명단 동기화', 'syncRoster');
  m.addSeparator();
  m.addItem('④ 활동 만들기 (AI 마법사) ★', 'openWizard');
  m.addItem('   활동 직접 추가', 'addActivityDialog');
  m.addItem('   활동 복제', 'duplicateActivityDialog');
  m.addItem('   활동 삭제', 'deleteActivityDialog');
  m.addSeparator();
  m.addItem('⑤ 예시 더 만들기 (AI)', 'generateMoreExamples');
  m.addItem('   예시 칸 늘리기', 'addExampleRows');
  m.addItem('   예시 검증', 'validateExamples');
  m.addSeparator();
  m.addItem('⑥ 체크된 행 생성', 'generateChecked');
  m.addItem('   선택한 행만 생성', 'generateSelection');
  m.addItem('   자동 생성(체크 즉시) 켜기', 'enableAutoTrigger');
  m.addItem('   자동 생성 끄기', 'disableAutoTrigger');
  m.addSeparator();
  m.addItem('⑦ 최종취합 시트 생성/갱신', 'buildCompile');
  m.addItem('   최종 압축본 생성(체크된 행)', 'compileChecked');
  m.addSeparator();
  m.addItem('⑧ 프롬프트 미리보기', 'previewPrompt');
  m.addItem('   결과 전체 재검증', 'revalidateAll');
  m.addSeparator();
  var sub = ui_().createMenu('부가 기능');
  sub.addItem('구글폼 응답 동기화', 'syncFormResponses');
  sub.addItem('수업관찰 기록 열기', 'openObserve');
  sub.addItem('수업관찰 웹앱 배포 안내', 'observeDeployHelp');
  sub.addItem('예시 시트 구조 복구', 'repairExampleSheet');
  sub.addItem('사용법 시트 갱신', 'buildHelp');
  sub.addItem('시작하기 안내 다시 켜기', 'onboardReset');
  sub.addItem('버전 정보', 'showVersion');
  m.addSubMenu(sub);
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
  ui_().alert(APP.MENU, '세특 작성 도우미 ' + APP.VERSION + '\n\n프롬프트 조립형 구조.\n교과·창체·행발을 한 틀로 지원합니다.', ui_().ButtonSet.OK);
}

/** 전체 설치 (여러 번 실행해도 안전 — 기존 데이터는 보존) */
function installAll() {
  installCore_();
  toast_('설치/복구 완료.', APP.MENU);
  ui_().alert(APP.MENU,
    '구조 설치가 끝났습니다.\n\n이어서 [🚀 시작하기]를 누르면 나머지를 단계별로 안내합니다.',
    ui_().ButtonSet.OK);
}

/** 알림 없이 시트 구조만 만든다 (온보딩 팝업에서도 호출) */
function installCore_() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('다른 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  try {
    buildStart();
    buildConfig();
    buildRecordTypes();
    buildSubjects();
    buildCommonRules();
    buildActivityList();
    buildRoster();
    buildReview();
    buildHelp();
    orderSheets_();
  } finally { lock.releaseLock(); }
}

function orderSheets_() {
  var order = [APP.SH.START, APP.SH.HELP, APP.SH.CONFIG, APP.SH.ROSTER, APP.SH.ACTIVITY,
               APP.SH.RECORD, APP.SH.SUBJECT, APP.SH.COMMON];
  var i = 1;
  order.forEach(function (n) {
    var s = sh_(n);
    if (s) { ss_().setActiveSheet(s); ss_().moveActiveSheet(i++); }
  });
  var h = sh_(APP.SH.START) || sh_(APP.SH.HELP);
  if (h) ss_().setActiveSheet(h);
}

/* ---------------------------------------------------------------- 설정 */
function buildConfig() {
  var s = shOrCreate_(APP.SH.CONFIG);
  var existing = {};
  if (s.getLastRow() >= 4) {
    s.getRange(4, 1, s.getLastRow() - 3, 2).getValues().forEach(function (r) {
      if (String(r[0]).trim()) existing[String(r[0]).trim()] = r[1];
    });
  }
  s.clear();
  s.getRange('A1').setValue('⚙️ 설정  —  ' + APP.VERSION)
    .setFontSize(14).setFontWeight('bold');
  noteRow_(s, 2, 3, 'API 키는 이 시트에 저장되지 않습니다. 메뉴 > ② AI 연결 설정 에서 입력하며, 사용자 계정별로 따로 보관되어 사본을 공유해도 남에게 넘어가지 않습니다.');
  s.getRange(3, 1, 1, 3).setValues([['항목', '값', '설명']]);
  styleHeader_(s, 3, 3);

  var rows = [
    ['교사 경력(년)', 15, '프롬프트의 역할 문장에 쓰입니다. 숫자만.'],
    ['기본 교과영역', '수학', '새 활동을 만들 때 기본으로 선택되는 교과. [📚 교과영역] 시트의 키.'],
    ['활동용 모델', 'gemini-2.5-flash', '활동별 세특 생성에 쓰는 모델. 저렴한 모델 권장.'],
    ['합본용 모델', 'gpt-5-mini', '최종 압축에 쓰는 모델. 조금 더 좋은 모델 권장.'],
    ['학생 이름 마스킹', true, 'TRUE면 학생 이름을 AI에 보내지 않습니다. 개인정보 보호 권장값.'],
    ['결과 자동검증', true, 'TRUE면 생성 직후 기재 금지사항·분량·어미를 자동 점검합니다.'],
    ['1회 최대 생성 건수', 25, '한 번에 처리할 최대 학생 수. 시간 초과 방지.'],
    ['추가 모델', '', '드롭다운에 없는 모델을 쉼표로 적으면 선택지에 추가됩니다.']
  ];
  rows.forEach(function (r) { if (existing.hasOwnProperty(r[0])) r[1] = existing[r[0]]; });
  s.getRange(4, 1, rows.length, 3).setValues(rows);
  s.getRange(4, 1, rows.length, 1).setFontWeight('bold');
  s.getRange(4, 2, rows.length, 1).setBackground(APP.COLORS.input);
  s.getRange(4, 3, rows.length, 1).setFontColor('#666666').setWrap(true);
  s.setColumnWidth(1, 160); s.setColumnWidth(2, 200); s.setColumnWidth(3, 460);
  s.setFrozenRows(3);
}

/* ------------------------------------------------------------ 기록종류 */
function buildRecordTypes() {
  var s = shOrCreate_(APP.SH.RECORD);
  if (s.getLastRow() > 2) return;   // 이미 있으면 보존
  s.clear();
  var head = ['키', '기록 항목명', '글자수', '성취수준 사용', '역할', '목표', '서술 관점', '비고'];
  banner_(s, head.length, '🧩 기록종류 — 항목별 기본 규칙',
    '⚠️ 글자수는 학년도마다 바뀝니다(2026학년도: 진로활동 700→500자, 행동특성 및 종합의견 500→300자). ' +
    '해당 연도 학교생활기록부 기재요령을 확인하고 이 표의 숫자를 고치세요. 숫자 하나만 고치면 프롬프트·검증·압축에 모두 반영됩니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  var rows = PRESET_RECORD_TYPES.map(function (r) {
    return [r.key, r.name, r.chars, r.useGrade, r.role, r.goal, r.view, r.note];
  });
  s.getRange(3, 1, rows.length, head.length).setValues(rows);
  s.getRange(3, 4, rows.length, 1).insertCheckboxes();
  s.getRange(3, 1, rows.length, head.length).setWrap(true).setVerticalAlignment('top');
  [90, 220, 80, 110, 260, 320, 380, 220].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2); s.setFrozenColumns(2);
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
  s.setFrozenRows(2); s.setFrozenColumns(2);
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
function buildActivityList() {
  var s = shOrCreate_(APP.SH.ACTIVITY);
  if (s.getLastRow() > 2) { refreshActivityValidation_(); return; }
  s.clear();
  var head = ['활동키', '활동명', '기록종류', '교과영역', '글자수', '입력 항목',
              '활동 개요', '프롬프트 모드', '직접 작성 프롬프트', '입력 시트', '예시 시트'];
  banner_(s, head.length, '🗂 활동목록 — 세특을 만들 활동의 정의',
    '직접 채우는 칸은 [활동명·기록종류·교과영역·입력 항목·활동 개요] 다섯 개뿐입니다. 프롬프트 본문은 엔진이 조립합니다. ' +
    '글자수를 비우면 기록종류 기본값이 쓰입니다. 통째로 직접 쓰려면 [프롬프트 모드]를 "직접작성"으로 바꾸고 I열에 작성하세요. ' +
    '새 활동은 메뉴 ④ 마법사로 만드는 것을 권장합니다.');
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  [110, 200, 100, 110, 80, 320, 340, 120, 300, 150, 150]
    .forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2); s.setFrozenColumns(2);
  s.getRange(3, 1, 300, head.length).setWrap(true).setVerticalAlignment('top');
  refreshActivityValidation_();
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
    SpreadsheetApp.newDataValidation().requireValueInList(['자동', '직접작성'], true).build());
}

/* -------------------------------------------------------------- 학생명단 */
function buildRoster() {
  var s = shOrCreate_(APP.SH.ROSTER);
  if (s.getLastRow() > 2) return;
  s.clear();
  var head = ['반', '번호', '이름', '성취수준'];
  s.getRange(2, 1, 1, head.length).setValues([head]);
  styleHeader_(s, 2, head.length);
  s.getRange(3, 1, 500, 4).setBackground(APP.COLORS.input);
  s.getRange(3, 4, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4', '5'], true).build());
  [70, 70, 110, 100].forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
  s.setFrozenRows(2);
  banner_(s, 4, '👤 학생명단',
    '반/번호/이름을 입력한 뒤 메뉴 ③ 학생 명단 동기화 를 누르면 모든 활동 시트에 반영됩니다. 성취수준(1~5)은 과세특에만 쓰이며 비워 둬도 됩니다.');
}

/* ---------------------------------------------------------------- 검토 */
function buildReview() {
  var s = shOrCreate_(APP.SH.REVIEW);
  s.clear();
  s.getRange('A1').setValue('✅ 검토  —  반·번호·기록종류를 고르면 그 학생의 최종본을 불러옵니다. 나이스 입력 전 확인용.')
    .setFontSize(13).setFontWeight('bold');
  s.getRange(3, 1, 1, 5).setValues([['반', '번호', '기록종류', '이름', '최종본 (자동)']]);
  styleHeader_(s, 3, 5);
  s.getRange('A4:C4').setBackground(APP.COLORS.input);

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
  var html = HtmlService.createHtmlOutputFromFile('UI_Onboard')
    .setWidth(640).setHeight(700);
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
    models: [], defaultModel: ''
  };
  try {
    st.installed = !!(sh_(APP.SH.CONFIG) && sh_(APP.SH.RECORD) && sh_(APP.SH.ACTIVITY) && sh_(APP.SH.ROSTER));
  } catch (e) {}
  ['gemini', 'openai', 'anthropic'].forEach(function (p) {
    if (getKey_(p)) { st.hasKey = true; st.keyNames.push(p); }
  });
  if (st.installed) {
    try { st.rosterCount = getRoster_().length; } catch (e) {}
    try {
      st.activities = getActivities_().map(function (a) {
        return { key: a.key, name: a.name, inSheet: a.inSheet, exSheet: a.exSheet };
      });
    } catch (e) {}
    try {
      st.models = modelChoices_().filter(function (m) { return m.indexOf('구독') < 0; });
      st.defaultModel = String(cfg_('활동용 모델', 'gemini-2.5-flash'));
    } catch (e) {}
    if (st.activities.length) {
      try { st.exampleCount = readExampleRows_(getActivity_(st.activities[0].key)).length; } catch (e) {}
    }
  }
  return st;
}

/* -------------------------------------------------------------- 1단계 */
function onboardInstall() {
  installCore_();
  return onboardStatus();
}

/* -------------------------------------------------------------- 2단계 */
function onboardSaveKey(p) {
  var provider = String(p.provider || 'gemini');
  var key = String(p.key || '').trim();
  if (!key) throw new Error('키를 입력하세요.');
  setKey_(provider, key);

  // 방금 넣은 키에 맞는 모델을 기본값으로 올려 둔다
  var model = provider === 'gemini' ? 'gemini-2.5-flash'
            : provider === 'openai' ? 'gpt-5-mini' : 'claude-haiku-4-5';
  try {
    var r = callAI_('한 단어로만 답한다.', '준비됐으면 "확인"이라고만 답해라.', model);
    setCfg_('활동용 모델', model);
    return { ok: true, message: '연결됐습니다. (' + String(r).slice(0, 20) + ')', status: onboardStatus() };
  } catch (e) {
    return { ok: false, message: e.message, status: onboardStatus() };
  }
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
function parseRoster_(text) {
  var out = [];
  String(text || '').split(/\r?\n/).forEach(function (line) {
    var t = line.trim();
    if (!t) return;
    if (/^(반|학급)\s*[\t, ]/.test(t)) return;              // 머리글 줄 건너뛰기
    var cells = t.split(/\t|,|\s{2,}/).map(function (x) { return x.trim(); }).filter(String);
    if (cells.length < 3) cells = t.split(/\s+/);
    var cls = String(cells[0] || '').replace(/[^0-9]/g, '');
    var no = String(cells[1] || '').replace(/[^0-9]/g, '');
    var name = String(cells[2] || '').trim();
    var grade = String(cells[3] || '').replace(/[^1-5]/g, '');
    if (!cls || !no || !name) return;
    out.push([Number(cls), Number(no), name, grade ? Number(grade) : '']);
  });
  return out;
}

function onboardPreviewRoster(text) {
  var rows = parseRoster_(text);
  return { count: rows.length, sample: rows.slice(0, 3) };
}

function onboardSaveRoster(text) {
  var rows = parseRoster_(text);
  if (!rows.length) throw new Error('명단을 알아보지 못했습니다. "1  3  김하늘" 처럼 반, 번호, 이름 순으로 한 줄에 한 명씩 넣어 주세요.');
  var s = shRequire_(APP.SH.ROSTER);
  if (s.getLastRow() >= 3) s.getRange(3, 1, s.getLastRow() - 2, 4).clearContent();
  var need = 2 + rows.length;
  if (s.getMaxRows() < need) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 5);
  s.getRange(3, 1, rows.length, 4).setValues(rows);
  syncRoster();
  return onboardStatus();
}

/* -------------------------------------------------------------- 4단계 */
function onboardCreateActivity(p) {
  var def = wizardSuggest({
    text: p.text, recordKey: p.recordKey, subjectKey: p.subjectKey,
    model: p.model, count: 2
  });
  var made = wizardCreate(def);
  return { made: made, def: def, status: onboardStatus() };
}

/* -------------------------------------------------------------- 5단계 */
/**
 * 시험 생성 — 학생 데이터를 건드리지 않고, 예시 시트의 1번 입력값으로
 * 실제 호출을 한 번 돌려 본다. 여기까지 결과가 나오면 설정이 끝난 것이다.
 */
function onboardTestGenerate(activityKey) {
  var act = getActivity_(activityKey);
  if (!act) throw new Error('활동을 찾을 수 없습니다.');
  var cols = parseColumns(act.columns);
  var rows = readExampleRows_(act);
  if (!rows.length) throw new Error('예시 시트가 비어 있어 시험할 자료가 없습니다. 활동을 다시 만들거나 예시를 한 줄 채워 주세요.');

  var rec = findByKey(getRecordTypes_(), act.recordKey);
  var user = buildStudentBlock(cols, rows[0].values, { grade: (rec && rec.useGrade) ? 3 : '' });
  var model = String(cfg_('활동용 모델', 'gemini-2.5-flash'));
  if (providerOf_(model) === 'subscription') model = 'gemini-2.5-flash';

  var txt = cleanResult_(callAI_(promptFor_(act), user, model));
  var limit = charsFor_(act) * 3;
  var v = validateResult(txt, limit, PRESET_BANNED, PRESET_FORMAT_RULES);
  return {
    text: txt, bytes: v.bytes, limit: limit,
    issues: v.issues.map(function (i) { return (i.level === 'block' ? '[수정] ' : '[확인] ') + i.label; })
  };
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
function buildStart() {
  var s = shOrCreate_(APP.SH.START);
  s.clear();
  var L = [];
  var H = function (t) { L.push(['§', t]); };
  var P = function (t) { L.push(['', t]); };

  L.push(['#', '세특 작성 도우미 ' + APP.VERSION]);
  P('학생부 특기사항을 활동 단위로 모으고, 프롬프트를 자동으로 조립해 AI에게 맡기는 도구입니다.');
  P('과목별 세특뿐 아니라 자율·동아리·진로·행동특성 및 종합의견까지 같은 방식으로 씁니다.');
  P('');

  H('1단계.  이 파일을 내 드라이브로 복사하세요');
  P('지금 보고 계신 파일이 남의 원본이라면, 상단 [파일] > [사본 만들기] 를 먼저 누르세요.');
  P('이미 내 사본이라면 다음으로 넘어가면 됩니다.');
  P('');

  H('2단계.  메뉴에서 [🚀 시작하기] 를 누르세요');
  P('상단 메뉴  [' + APP.MENU + ']  >  [🚀 시작하기]');
  P('나머지는 팝업이 순서대로 안내합니다. 중간에 닫아도 다시 누르면 이어서 진행됩니다.');
  P('');

  H('⚠️ 처음 한 번만 — 권한 승인 화면 넘는 법');
  P('메뉴를 처음 누르면 구글이 승인을 요구합니다. 아래 순서대로 누르시면 됩니다.');
  P('');
  P('   ①  [승인 필요] 창에서  [계속]  클릭');
  P('   ②  구글 계정 선택');
  P('   ③  "Google에서 확인하지 않은 앱입니다" 화면이 나오면');
  P('        →  왼쪽 아래  [고급]  클릭');
  P('        →  [세특 작성 도우미(안전하지 않음)(으)로 이동]  클릭');
  P('   ④  [허용]  클릭');
  P('');
  P('이 경고는 개인이 만든 스크립트라서 뜨는 것입니다. 구글 심사를 받은 앱이 아니면 모두 이 화면이 나옵니다.');
  P('코드는 이 파일 안에 그대로 들어 있고, [확장 프로그램] > [Apps Script] 에서 직접 확인할 수 있습니다.');
  P('');

  H('무엇이 필요한가요');
  P('· AI 키 하나.  Gemini 키가 가장 부담이 적습니다(무료 등급 있음). aistudio.google.com 에서 발급.');
  P('· 구글 워크스페이스 Gemini나 Google One AI Premium 구독이 있다면 키 없이도 쓸 수 있습니다.');
  P('   확인법: 빈 셀에  =AI("안녕")  을 넣어 답이 나오면 됩니다.');
  P('· 학생 명단(반·번호·이름). 엑셀에서 복사해 붙여넣으면 됩니다.');
  P('');

  H('꼭 알아 두실 것');
  P('· AI 키는 이 파일이 아니라 각자의 구글 계정에 저장됩니다. 사본을 나눠 줘도 키는 넘어가지 않습니다.');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다.');
  P('· 주민등록번호, 가정환경, 건강 정보 같은 민감정보는 입력하지 마세요.');
  P('· AI가 쓴 문장을 그대로 기재하지 마세요. 반드시 읽고 고쳐서 쓰는 것이 원칙이며,');
  P('   최종 문장에 대한 책임은 작성한 교사에게 있습니다.');
  P('· 학교·교육청의 생성형 AI 활용 지침을 먼저 확인하세요. 시도교육청마다 다릅니다.');
  P('');
  P('설정이 끝나면 이 탭은 닫아 두셔도 됩니다. 자세한 사용법은 [📖 사용법] 탭에 있습니다.');

  var rows = L.map(function (r) { return [r[1]]; });
  s.getRange(1, 1, rows.length, 1).setValues(rows);
  for (var i = 0; i < L.length; i++) {
    var c = s.getRange(i + 1, 1);
    if (L[i][0] === '#') c.setFontSize(18).setFontWeight('bold').setFontColor('#1b3a2a');
    else if (L[i][0] === '§') {
      c.setFontWeight('bold').setFontSize(13).setBackground('#e3ece4').setFontColor('#1b3a2a');
      s.setRowHeight(i + 1, 32);
    }
  }
  s.setColumnWidth(1, 820);
  s.getRange(1, 1, rows.length, 1).setWrap(true).setVerticalAlignment('middle');
  s.setHiddenGridlines(true);
  return s;
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
  P('결과는 반드시 선생님이 읽고 고쳐서 쓰세요. AI 결과를 그대로 기재하지 않는 것이 원칙입니다.');

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
  P('구조 설치 → AI 키 → 학생 명단 → 첫 활동 만들기 → 시험 생성까지 한 번에 끝납니다.');
  P('중간에 닫아도 다시 열면 끝난 단계는 완료로 표시되고 그다음부터 이어집니다.');
  P('');
  P('손으로 하고 싶다면 메뉴를 하나씩 눌러도 됩니다.');
  P('  ① 처음 설치 / 구조 복구  →  ② AI 연결 설정  →  👤 학생명단 입력 후 ③ 동기화  →  ④ 활동 만들기');
  P('');
  P('※ 사본을 남에게 나눠 줄 때: 공유 링크 끝의 /edit... 을 /copy 로 바꾸면');
  P('   링크를 연 순간 [사본 만들기] 창이 바로 떠서, 코드까지 통째로 복사됩니다.');
  P('   단, 자동 생성 트리거와 수업관찰 웹앱 배포는 사본마다 각자 한 번씩 눌러야 합니다.');

  H('2. 활동 만들기 — 마법사를 쓰세요');
  P('메뉴 ④ 활동 만들기 (AI 마법사) 를 열고, 활동을 편한 말로 설명합니다.');
  P('  예) "통합과학 실험 보고서인데 가설, 실험 설계, 결과 해석, 오차와 개선점을 받았어요"');
  P('AI가 입력 항목과 예시 초안을 제안합니다. 항목을 고친 뒤 [이 활동 만들기]를 누르면');
  P('입력 시트와 예시 시트가 한 번에 만들어집니다.');
  P('[프롬프트 미리보기]를 누르면 실제로 AI에게 갈 문장을 확인할 수 있습니다.');
  P('마법사를 쓰지 않고 [활동 직접 추가]로 손수 만들 수도 있습니다.');
  P('예시 개수를 1~3개로 골라 함께 만들 수 있고, 만들어진 예시는 예시 시트에 그대로 저장됩니다.');

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
  P('④ [검증] 칸에 분량 초과 · 기재 금지사항 · 어미 위반이 자동으로 표시됩니다.');

  H('5. 최종취합 — 기록종류별로 따로 모입니다');
  P('메뉴 ⑦ 최종취합 시트 생성/갱신 을 누르면 기록종류별로 취합 시트가 생깁니다.');
  P('  📦 취합 ▸과세특 / 📦 취합 ▸동아리 / 📦 취합 ▸행발 …');
  P('과세특과 동아리는 나이스에서 서로 다른 칸에 들어가므로 절대 한 덩어리로 합치지 않습니다.');
  P('합본이 글자수를 넘는 학생만 [압축]을 체크하고 메뉴 ⑦ 최종 압축본 생성 을 누르세요.');
  P('활동 결과를 고친 뒤에는 [최종취합 시트 생성/갱신]을 다시 눌러야 반영됩니다.');

  H('6. 검증이 잡아 주는 것');
  P('· 분량 : 글자수(바이트) 초과 또는 지나친 부족');
  P('· 기재 금지 : 수상, 자격증, 공인어학시험, 논문·특허, 모의고사, 해외활동, 학원·기관명, 부모 정보');
  P('· 형식 : 존댓말·평서형 어미, "학생은" 주어, 금지 특수문자');
  P('[수정]은 반드시 고쳐야 하는 것, [확인]은 오탐일 수 있으니 눈으로 볼 것입니다.');
  P('검증은 보조 장치일 뿐입니다. 최종 책임은 작성자에게 있습니다.');

  H('7. 우리 학교 방식으로 바꾸기');
  P('· 어미를 "~하였음"으로 : 📐 공통규칙 > WRITING_RULES 내용 수정');
  P('· 글자수가 바뀌었을 때 : 🧩 기록종류 > 글자수 숫자만 수정 (프롬프트·검증·압축에 모두 반영)');
  P('· 내 교과 추가 : 📚 교과영역 맨 아래에 한 줄 추가 (키, 표시명, 분류=교과, 역할 표현, 역량)');
  P('· 특정 활동만 프롬프트를 통째로 쓰고 싶을 때 : 🗂 활동목록의 [프롬프트 모드]를 "직접작성"으로');
  P('  바꾸고 I열에 작성. {ROLE} {NEIS_RULES} {EXAMPLES} {BYTES} 같은 중괄호는 자동 치환됩니다.');

  H('8. 개인정보와 비용');
  P('· 학생 이름은 기본적으로 AI에 전송되지 않습니다(⚙️ 설정 > 학생 이름 마스킹).');
  P('· API 키는 내 구글 계정에만 저장되며, 사본을 공유해도 넘어가지 않습니다.');
  P('· 주민등록번호, 가정환경, 건강 정보 등 민감정보는 입력하지 마세요.');
  P('· 유료 API는 호출한 만큼 과금됩니다. 결과 확인 후 체크박스를 꼭 해제하세요.');

  H('9. 자주 막히는 곳');
  P('Q. 호출이 실패해요 → 메뉴 ② 연결 테스트. 고른 모델이 내 키로 쓸 수 있는 모델인지 확인하세요.');
  P('Q. Gemini 무료 등급 → 분당 호출 제한이 있어 여러 명을 한꺼번에 돌리면 일부가 실패합니다. 나눠서 실행하세요.');
  P('Q. Gemini(구독)인데 결과가 없어요 → 결과 셀에 뜬 [생성] 버튼을 눌러야 합니다.');
  P('Q. 결과가 갱신 안 돼요 → 셀을 클릭하고 수식 끝에 공백 한 칸을 넣고 엔터(캐시 갱신).');
  P('Q. 새 활동이 취합에 없어요 → 메뉴 ⑦ 최종취합 시트 생성/갱신 을 다시 누르세요.');
  P('Q. 예시 시트에 [바이트]·[검증] 칸이 없어요 → 부가 기능 > 예시 시트 구조 복구 (예시 내용은 보존됩니다).');
  P('Q. 시트를 실수로 지웠어요 → 메뉴 ① 처음 설치 / 구조 복구 (기존 데이터는 보존됩니다).');

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
 * 명단 시트의 반/번호/이름/성취수준을 모든 활동 입력 시트와 최종취합에 반영.
 * 이미 입력된 학생 데이터는 반·번호를 키로 보존한다.
 */

function getRoster_() {
  var s = shRequire_(APP.SH.ROSTER);
  var last = s.getLastRow();
  if (last < 3) return [];
  var v = s.getRange(3, 1, last - 2, 4).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var cls = String(v[i][0]).trim(), no = String(v[i][1]).trim();
    if (!cls && !no) continue;
    out.push({ cls: v[i][0], no: v[i][1], name: v[i][2], grade: v[i][3], id: cls + '-' + no });
  }
  return out;
}

function syncRoster() {
  var roster = getRoster_();
  if (!roster.length) { ui_().alert(APP.MENU, '[👤 학생명단] 시트에 학생을 먼저 입력하세요.', ui_().ButtonSet.OK); return; }
  var acts = getActivities_();
  var done = 0;
  acts.forEach(function (a) {
    if (a.inSheet && sh_(a.inSheet)) { syncRosterInto_(sh_(a.inSheet), roster); done++; }
  });
  if (compileSheets_().length) { try { buildCompileCore_(); } catch (e) {} }
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

  var existing = {};
  if (lastRow >= first) {
    var vals = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getValues();
    var forms = sheet.getRange(first, 1, lastRow - first + 1, lastCol).getFormulas();
    for (var i = 0; i < vals.length; i++) {
      var id = String(vals[i][0]).trim() + '-' + String(vals[i][1]).trim();
      if (id === '-') continue;
      var row = [];
      for (var c = 0; c < lastCol; c++) row.push(forms[i][c] ? forms[i][c] : vals[i][c]);
      existing[id] = row;
    }
  }

  var out = [];
  roster.forEach(function (st) {
    var row = existing[st.id];
    if (!row) { row = []; for (var c = 0; c < lastCol; c++) row.push(''); }
    row[0] = st.cls; row[1] = st.no; row[2] = st.name; row[3] = st.grade;
    out.push(row);
  });

  var needRows = first + out.length - 1;
  if (sheet.getMaxRows() < needRows) sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows() + 5);
  if (lastRow >= first) sheet.getRange(first, 1, Math.max(lastRow - first + 1, out.length), lastCol).clearContent();
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
  if (cModel) {
    sheet.getRange(first, cModel, nRows, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(modelChoices_(), true).build());
  }
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
 * def = {key, name, recordKey, subjectKey, chars, columns, desc, examples:[{values:[],result:''}]}
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

  var cols = parseColumns(def.columns);
  if (!cols.length) throw new Error('입력 항목을 1개 이상 지정하세요.');
  var seen = {};
  cols.forEach(function (c) {
    if (RESERVED_NAMES.indexOf(c) >= 0) throw new Error('입력 항목에 "' + c + '"은(는) 쓸 수 없습니다. 시스템이 쓰는 이름입니다.');
    if (seen[c]) throw new Error('입력 항목이 중복됩니다: ' + c);
    seen[c] = 1;
  });
  if (cols.length > 12) throw new Error('입력 항목은 12개 이하로 해 주세요.');
  var recs = getRecordTypes_();
  var rec = findByKey(recs, def.recordKey) || recs[0];
  var chars = Number(def.chars || 0) || rec.chars;

  var inSheet = buildActivityInputSheet_(key, name, cols, rec);
  var exSheet = buildActivityExampleSheet_(key, name, cols, def.examples || []);

  var s = shRequire_(APP.SH.ACTIVITY);
  var row = [key, name, rec.key, def.subjectKey || cfg_('기본 교과영역', '공통'),
             chars, cols.join('|'), def.desc || '', '자동', '',
             inSheet.getName(), exSheet.getName()];
  s.appendRow(row);
  refreshActivityValidation_();

  try { syncRosterInto_(inSheet, getRoster_()); } catch (e) {}
  return { key: key, inSheet: inSheet.getName(), exSheet: exSheet.getName() };
}

function buildActivityInputSheet_(key, name, cols, rec) {
  var s = ss_().insertSheet(sheetNameIn_(key));
  var head = ['반', '번호', '이름', '성취수준']
    .concat(cols)
    .concat(['생성', '모델', 'AI 결과', '최종본', '바이트', '검증']);
  var n = head.length;

  noteRow_(s, 1, n,
    '▶ ' + name + '  (' + rec.name + ' · ' + rec.chars + '자 기준)\n' +
    '① 노란 칸에 학생 자료 입력  →  ② [모델] 선택  →  ③ [생성] 체크 또는 메뉴 ⑥ 체크된 행 생성  →  ' +
    '④ AI 결과를 확인하고 [최종본] 칸에 붙여넣어 다듬기  →  ⑤ 체크 해제(재호출·비용 방지)');
  s.getRange(2, 1).setValue('').setFontSize(8);
  s.setRowHeight(2, 8);

  s.getRange(APP.HEAD_ROW, 1, 1, n).setValues([head]);
  styleHeader_(s, APP.HEAD_ROW, n);
  s.setFrozenRows(APP.HEAD_ROW);
  s.setFrozenColumns(3);

  // 폭
  s.setColumnWidth(1, 55); s.setColumnWidth(2, 55); s.setColumnWidth(3, 90); s.setColumnWidth(4, 80);
  for (var i = 0; i < cols.length; i++) s.setColumnWidth(5 + i, 230);
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
  return s;
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
      chars: src.chars, columns: src.columns, desc: src.desc, examples: exs
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
  var html = HtmlService.createHtmlOutput(
    '<div style="font:13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;padding:8px">' +
    '<div style="color:#555;margin-bottom:8px">활동 <b>' + escHtml_(target.key) + '</b> · ' +
    byteLen(p) + '바이트</div>' +
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
  var limit = charsFor_(act) * 3;
  var rows = readExampleRows_(act);
  if (!rows.length) { toast_('채워진 예시가 없습니다.'); return; }

  var bad = 0, warn = 0;
  rows.forEach(function (e) {
    var v = validateResult(e.result, limit, PRESET_BANNED, PRESET_FORMAT_RULES);
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

  var model = String(cfg_('활동용 모델', 'gemini-2.5-flash'));
  if (providerOf_(model) === 'subscription') {
    ui_().alert(APP.MENU,
      '예시 생성에는 API 키가 필요합니다.\n[⚙️ 설정]의 활동용 모델을 gemini-2.5-flash 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.',
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
  var limit = charsFor_(act) * 3;
  readExampleRows_(act).forEach(function (e) {
    s.getRange(e.row, cValid).setValue(formatIssues(validateResult(e.result, limit, PRESET_BANNED, PRESET_FORMAT_RULES)));
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
  var chars = charsFor_(act);

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
    rec.name + ' — ' + chars + '자(' + (chars * 3) + '바이트) 이내',
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

  var raw = callAI_(sys, user, model);
  var obj = parseJsonLoose_(raw);
  var arr = (obj && Array.isArray(obj.examples)) ? obj.examples
          : (Array.isArray(obj) ? obj : []);
  var limit = chars * 3;
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
    defaultModel: String(cfg_('활동용 모델', 'gemini-2.5-flash')),
    hasKey: !!(getKey_('openai') || getKey_('gemini') || getKey_('anthropic'))
  };
}

/**
 * 말로 쓴 설명 → 활동 정의(JSON) 제안
 * @param {Object} p {text, recordKey, subjectKey, model, previous}
 */
function wizardSuggest(p) {
  var rec = findByKey(getRecordTypes_(), p.recordKey) || getRecordTypes_()[0];
  var sub = findByKey(getSubjects_(), p.subjectKey) || findByKey(getSubjects_(), '공통');
  var model = p.model || String(cfg_('활동용 모델', 'gemini-2.5-flash'));
  var want = Math.max(1, Math.min(3, Number(p.count) || 1));
  if (providerOf_(model) === 'subscription') {
    throw new Error('마법사는 API 키가 필요합니다. 모델을 gemini-2.5-flash 등으로 바꾸거나 메뉴 ②에서 키를 등록하세요.');
  }

  var system = [
    '당신은 학교생활기록부 기록 설계를 돕는 조수입니다.',
    '교사가 설명한 활동을 스프레드시트 입력 양식으로 바꾸는 것이 임무입니다.',
    '',
    '# 지켜야 할 것',
    '- 반드시 아래 JSON 하나만 출력한다. 설명, 머리말, 코드펜스를 붙이지 않는다.',
    '- name: 시트에 표시할 짧은 활동 이름(12자 이내).',
    '- key: 시트 이름에 쓸 짧은 식별자(공백 없이 8자 이내, 한글 가능).',
    '- columns: 교사가 학생 한 명당 채울 입력 항목 이름 배열. 3~6개.',
    '    · 교사가 실제로 타이핑할 수 있을 만큼 짧고 구체적인 항목으로 만든다.',
    '    · 결과(특기사항 문장) 자체를 입력 항목으로 넣지 않는다.',
    '    · 활동의 과정이 드러나도록 구성한다(무엇을, 왜, 어떻게, 무엇을 알게 되었는지, 한계 등).',
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

  var raw = callAI_(system, user, model);
  var def = parseJsonLoose_(raw);
  if (!def || !def.columns || !def.columns.length) {
    throw new Error('AI 응답을 이해하지 못했습니다. 설명을 조금 더 구체적으로 적어 주세요.');
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
 * 세특 작성 도우미 v3 — AI 연결
 * API 키는 UserProperties에 저장되어 사용자 계정별로 분리됩니다.
 * 사본을 다른 선생님과 공유해도 키는 넘어가지 않습니다.
 */

var SUBSCRIPTION_MODEL = 'Gemini(구독)';

function modelChoices_() {
  var extra = String(cfg_('추가 모델', '') || '').split(',').map(function (x) { return x.trim(); }).filter(String);
  return [
    SUBSCRIPTION_MODEL,
    'gemini-2.5-flash', 'gemini-2.5-pro',
    'gpt-5-mini', 'gpt-5',
    'claude-haiku-4-5', 'claude-sonnet-4-5'
  ].concat(extra);
}

function providerOf_(model) {
  var m = String(model || '').trim();
  if (!m || m === SUBSCRIPTION_MODEL) return 'subscription';
  if (/^gemini/i.test(m)) return 'gemini';
  if (/^claude/i.test(m)) return 'anthropic';
  return 'openai';
}

function props_() { return PropertiesService.getUserProperties(); }
function getKey_(p) { return props_().getProperty('KEY_' + p) || ''; }
function setKey_(p, v) {
  if (v) props_().setProperty('KEY_' + p, v);
  else props_().deleteProperty('KEY_' + p);
}

/* -------------------------------------------------------------- 설정 UI */
function openApiDialog() {
  var t = HtmlService.createTemplateFromFile('UI_ApiKey');
  t.has = {
    openai: !!getKey_('openai'), gemini: !!getKey_('gemini'), anthropic: !!getKey_('anthropic')
  };
  ui_().showModalDialog(t.evaluate().setWidth(560).setHeight(560), 'AI 연결 설정');
}

function saveKeys(obj) {
  ['openai', 'gemini', 'anthropic'].forEach(function (p) {
    if (obj[p] === undefined) return;
    var v = String(obj[p] || '').trim();
    if (v === '__KEEP__') return;
    setKey_(p, v);
  });
  return '저장했습니다. 이 키는 ' + Session.getActiveUser().getEmail() + ' 계정에만 저장됩니다.';
}

function testConnection() {
  var out = [];
  ['openai', 'gemini', 'anthropic'].forEach(function (p) {
    if (!getKey_(p)) { out.push('· ' + p + ' : 키 없음'); return; }
    var model = p === 'openai' ? 'gpt-5-mini' : (p === 'gemini' ? 'gemini-2.5-flash' : 'claude-haiku-4-5');
    try {
      var r = callAI_('한 단어로만 답한다.', '준비됐으면 "확인"이라고만 답해라.', model);
      out.push('· ' + p + ' : 정상 (' + String(r).slice(0, 20) + ')');
    } catch (e) {
      out.push('· ' + p + ' : 실패 — ' + e.message);
    }
  });
  out.push('');
  out.push('· ' + SUBSCRIPTION_MODEL + ' : 빈 셀에 =AI("안녕") 을 입력해 답이 나오면 사용 가능합니다.');
  ui_().alert('연결 테스트', out.join('\n'), ui_().ButtonSet.OK);
}

/* ------------------------------------------------------------- 호출 본체 */
/**
 * @param {string} system  조립된 프롬프트(규칙 전체)
 * @param {string} user    학생 자료
 * @param {string} model
 * @return {string}
 */
function callAI_(system, user, model) {
  var p = providerOf_(model);
  if (p === 'subscription') throw new Error(SUBSCRIPTION_MODEL + ' 은(는) 셀 수식으로 동작합니다. 메뉴 ⑤ 대신 체크박스를 사용하세요.');
  var key = getKey_(p);
  if (!key) throw new Error(p + ' API 키가 없습니다. 메뉴 > ② AI 연결 설정 에서 입력하세요.');

  if (p === 'openai') return callOpenAI_(key, model, system, user);
  if (p === 'gemini') return callGemini_(key, model, system, user);
  return callAnthropic_(key, model, system, user);
}

function fetchJson_(url, options, label) {
  var delays = [0, 2000, 5000];
  var last = '';
  for (var i = 0; i < delays.length; i++) {
    if (delays[i]) Utilities.sleep(delays[i]);
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 200 && code < 300) {
      try { return JSON.parse(body); }
      catch (e) { throw new Error(label + ' 응답 해석 실패'); }
    }
    last = code + ' ' + body.slice(0, 300);
    if (code === 429 || code >= 500) continue;   // 재시도
    break;
  }
  throw new Error(label + ' 호출 실패 (' + last + ')');
}

function callOpenAI_(key, model, system, user) {
  var json = fetchJson_('https://api.openai.com/v1/chat/completions', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    }),
    muteHttpExceptions: true
  }, 'OpenAI');
  var c = json.choices && json.choices[0];
  var txt = c && c.message && c.message.content;
  if (!txt) throw new Error('OpenAI 응답이 비었습니다.');
  return String(txt).trim();
}

function callGemini_(key, model, system, user) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  var json = fetchJson_(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }]
    }),
    muteHttpExceptions: true
  }, 'Gemini');
  var cand = json.candidates && json.candidates[0];
  var parts = cand && cand.content && cand.content.parts;
  var txt = '';
  if (parts) parts.forEach(function (p) { if (p.text) txt += p.text; });
  if (!txt) throw new Error('Gemini 응답이 비었습니다. (안전 필터 또는 모델명 확인)');
  return txt.trim();
}

function callAnthropic_(key, model, system, user) {
  var json = fetchJson_('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: model, max_tokens: 2000, system: system,
      messages: [{ role: 'user', content: user }]
    }),
    muteHttpExceptions: true
  }, 'Anthropic');
  var txt = '';
  (json.content || []).forEach(function (b) { if (b.type === 'text') txt += b.text; });
  if (!txt) throw new Error('Anthropic 응답이 비었습니다.');
  return txt.trim();
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
 */

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
  runGeneration_(act, sheet, rows);
}

function generateSelection() {
  var sheet = ss_().getActiveSheet();
  var act = activityOfSheet_(sheet.getName());
  if (!act) { ui_().alert(APP.MENU, '활동 입력 시트에서 실행하세요.', ui_().ButtonSet.OK); return; }
  var r = sheet.getActiveRange();
  var rows = [];
  for (var i = 0; i < r.getNumRows(); i++) {
    var row = r.getRow() + i;
    if (row >= APP.DATA_ROW) rows.push(row);
  }
  if (!rows.length) { toast_('데이터 행을 선택하세요.'); return; }
  runGeneration_(act, sheet, rows);
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

/** 실제 생성 루프 */
function runGeneration_(act, sheet, rows) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) { toast_('다른 생성 작업이 실행 중입니다.'); return; }
  try {
    var maxN = Number(cfg_('1회 최대 생성 건수', 25));
    if (rows.length > maxN) {
      ui_().alert(APP.MENU, '한 번에 ' + maxN + '건까지 처리합니다. 앞에서부터 ' + maxN + '건만 진행합니다.\n' +
        '(설정 시트에서 늘릴 수 있지만, 실행 시간 제한으로 실패할 수 있습니다.)', ui_().ButtonSet.OK);
      rows = rows.slice(0, maxN);
    }

    var cols = parseColumns(act.columns);
    var head = APP.HEAD_ROW;
    var cGen = colOf_(sheet, head, '생성');
    var cModel = colOf_(sheet, head, '모델');
    var cAi = colOf_(sheet, head, 'AI 결과');
    var cValid = colOf_(sheet, head, '검증');
    var limit = charsFor_(act) * 3;
    var system = promptFor_(act);
    var defModel = String(cfg_('활동용 모델', 'gemini-2.5-flash'));
    var autoValidate = cfgBool_('결과 자동검증', true);
    var banned = PRESET_BANNED, fmt = PRESET_FORMAT_RULES;

    var okN = 0, skipN = 0, errN = 0, subN = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var vals = sheet.getRange(row, 5, 1, cols.length).getValues()[0];
      var filled = vals.some(function (v) { return String(v).trim() !== ''; });
      if (!filled) { skipN++; if (cGen) sheet.getRange(row, cGen).setValue(false); continue; }

      var grade = sheet.getRange(row, 4).getValue();
      var rec = findByKey(getRecordTypes_(), act.recordKey);
      var user = buildStudentBlock(cols, vals, { grade: (rec && rec.useGrade) ? grade : '' });
      if (!maskName_()) user = '학생 이름: ' + sheet.getRange(row, 3).getValue() + '\n' + user;

      var model = cModel ? String(sheet.getRange(row, cModel).getValue()).trim() : '';
      if (!model) model = defModel;

      toast_((i + 1) + '/' + rows.length + ' 생성 중… (' + model + ')', act.name);

      try {
        if (providerOf_(model) === 'subscription') {
          sheet.getRange(row, cAi).setFormula(subscriptionFormula_(system, user));
          subN++;
          continue;   // 수식 결과는 시트가 계산하므로 체크 유지
        }
        var txt = cleanResult_(callAI_(system, user, model));
        sheet.getRange(row, cAi).setValue(txt);
        if (autoValidate && cValid) {
          sheet.getRange(row, cValid).setValue(formatIssues(validateResult(txt, limit, banned, fmt)));
        }
        if (cGen) sheet.getRange(row, cGen).setValue(false);
        okN++;
      } catch (e) {
        sheet.getRange(row, cAi).setValue('⚠ 실패: ' + e.message);
        if (cGen) sheet.getRange(row, cGen).setValue(false);
        errN++;
      }
      SpreadsheetApp.flush();
    }

    var msg = '완료 ' + okN + '건';
    if (subN) msg += ' / 구독수식 ' + subN + '건(셀에서 [생성] 버튼을 눌러 주세요)';
    if (skipN) msg += ' / 자료 없음 ' + skipN + '건';
    if (errN) msg += ' / 실패 ' + errN + '건';
    toast_(msg, act.name);
  } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------- 자동 생성 트리거 */
function enableAutoTrigger() {
  disableAutoTrigger();
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss_()).onEdit().create();
  ui_().alert(APP.MENU,
    '자동 생성을 켰습니다.\n[생성] 체크박스를 체크하면 그 줄이 바로 생성됩니다.\n\n' +
    '※ 여러 명을 한꺼번에 처리할 때는 메뉴 ⑥ [체크된 행 생성] 이 더 빠르고 안정적입니다.',
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
    runGeneration_(act, sheet, [e.range.getRow()]);
  } catch (err) {
    try { toast_('자동 생성 오류: ' + err.message); } catch (e2) {}
  }
}

/* ------------------------------------------------------------- 재검증 */
function revalidateAll() {
  var acts = getActivities_();
  var n = 0;
  var banned = PRESET_BANNED, fmt = PRESET_FORMAT_RULES;
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
    var limit = charsFor_(a) * 3;
    var out = [];
    for (var i = 0; i < cnt; i++) {
      var t = String(fin[i][0] || '').trim() || String(ai[i][0] || '').trim();
      out.push([t ? formatIssues(validateResult(t, limit, banned, fmt)) : '']);
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
      o2.push([t2 ? formatIssues(validateResult(t2, lim2, banned, fmt)) : '']);
      if (t2) n++;
    }
    cp.getRange(APP.DATA_ROW, cV, cnt2, 1).setValues(o2);
  });
  toast_(n + '건 재검증 완료', APP.MENU);
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
  var n = head.length;

  noteRow_(s, 1, n,
    '📦 ' + (rec ? rec.name : recKey) + ' 최종취합  —  ' + (rec ? rec.chars : 500) + '자(' + limit + '바이트) 기준\n' +
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
    s.getRange(APP.DATA_ROW, cModel, rows.length, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(modelChoices_(), true).build());
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
function compileChecked() {
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

  var defModel = String(cfg_('합본용 모델', 'gpt-5-mini'));
  var system = compressPrompt_(rec);
  var okN = 0, errN = 0;

  for (var k = 0; k < rows.length; k++) {
    var row = rows[k];
    var merged = String(s.getRange(row, cMerge).getValue() || '').trim();
    if (!merged) { s.getRange(row, cChk).setValue(false); continue; }
    var model = cModel ? String(s.getRange(row, cModel).getValue()).trim() : '';
    if (!model) model = defModel;
    toast_((k + 1) + '/' + rows.length + ' 압축 중…', APP.MENU);
    try {
      if (providerOf_(model) === 'subscription') {
        s.getRange(row, cAi).setFormula(subscriptionFormula_(system, merged));
        continue;
      }
      var txt = cleanResult_(callAI_(system, merged, model));
      if (byteLen(txt) > limit) txt = trimToBytes(txt, limit);
      s.getRange(row, cAi).setValue(txt);
      if (cValid) s.getRange(row, cValid).setValue(formatIssues(validateResult(txt, limit, PRESET_BANNED, PRESET_FORMAT_RULES)));
      s.getRange(row, cChk).setValue(false);
      okN++;
    } catch (e) {
      s.getRange(row, cAi).setValue('⚠ 실패: ' + e.message);
      s.getRange(row, cChk).setValue(false);
      errN++;
    }
    SpreadsheetApp.flush();
  }
  toast_('압축 완료 ' + okN + '건' + (errN ? ' / 실패 ' + errN + '건' : ''), APP.MENU);
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
   90_Forms.gs
   ========================================================================== */

/**
 * 세특 작성 도우미 v3 — 구글폼 응답 연동
 *
 * 전제: 폼의 첫 세 문항이 [반] [번호] [이름] (단답형)
 *       폼 응답을 이 스프레드시트로 연결해 두면 "설문지 응답 시트N" 이 생깁니다.
 */

/** 폼 응답 시트 후보 찾기 */
function formSheets_() {
  var known = {};
  known[APP.SH.HELP] = 1; known[APP.SH.CONFIG] = 1; known[APP.SH.ROSTER] = 1;
  known[APP.SH.RECORD] = 1; known[APP.SH.SUBJECT] = 1; known[APP.SH.COMMON] = 1;
  known[APP.SH.ACTIVITY] = 1; known[APP.SH.REVIEW] = 1;
  var actSheets = {};
  getActivities_().forEach(function (a) { actSheets[a.inSheet] = 1; actSheets[a.exSheet] = 1; });
  return ss_().getSheets().filter(function (s) {
    var n = s.getName();
    if (known[n] || actSheets[n]) return false;
    if (recordKeyOfCompile_(n)) return false;
    if (s.getLastRow() < 1) return false;
    var h = String(s.getRange(1, 1).getValue());
    return /타임스탬프|Timestamp/i.test(h) || /응답/.test(n);
  });
}

function syncFormResponses() {
  var forms = formSheets_();
  if (!forms.length) {
    ui_().alert(APP.MENU,
      '폼 응답 시트를 찾지 못했습니다.\n\n' +
      '1) 구글폼을 만들고 첫 세 문항을 [반] [번호] [이름] 단답형으로 넣으세요.\n' +
      '2) 폼의 [응답] 탭 → 스프레드시트 아이콘 → "기존 스프레드시트 선택" → 이 파일을 고르세요.\n' +
      '3) 응답이 한 건이라도 들어온 뒤 다시 실행하세요.', ui_().ButtonSet.OK);
    return;
  }
  var fList = forms.map(function (s, i) { return (i + 1) + '. ' + s.getName() + ' (' + Math.max(0, s.getLastRow() - 1) + '건)'; }).join('\n');
  var fAns = promptText_('구글폼 동기화 (1/2)', '어느 응답 시트를 쓸까요?\n\n' + fList);
  if (fAns === null) return;
  var fs = forms[Number(fAns) - 1];
  if (!fs) { ui_().alert('번호가 올바르지 않습니다.'); return; }

  var acts = getActivities_();
  var aList = acts.map(function (a, i) { return (i + 1) + '. ' + a.key + ' — ' + a.name; }).join('\n');
  var aAns = promptText_('구글폼 동기화 (2/2)',
    '어느 활동으로 보낼까요?\n0을 입력하면 이 폼의 문항으로 새 활동을 만듭니다.\n\n' + aList);
  if (aAns === null) return;

  var head = fs.getRange(1, 1, 1, fs.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  // 0:타임스탬프 1:반 2:번호 3:이름 4~:문항
  var qCols = head.slice(4).filter(function (h) { return h; });
  if (!qCols.length) { ui_().alert(APP.MENU, '문항을 찾지 못했습니다. 첫 세 문항이 [반][번호][이름]인지 확인하세요.', ui_().ButtonSet.OK); return; }

  var act;
  if (String(aAns).trim() === '0') {
    var nm = promptText_('새 활동 만들기', '활동 이름을 입력하세요.');
    if (!nm) return;
    var recs = getRecordTypes_();
    var rl = recs.map(function (r, i) { return (i + 1) + '. ' + r.key + ' (' + r.name + ')'; }).join('\n');
    var rAns = promptText_('새 활동 만들기', '기록종류 번호를 고르세요.\n\n' + rl);
    if (rAns === null) return;
    var rec = recs[Number(rAns) - 1];
    if (!rec) { ui_().alert('번호가 올바르지 않습니다.'); return; }
    try {
      var made = createActivity_({
        key: nm, name: nm, recordKey: rec.key,
        subjectKey: cfg_('기본 교과영역', '공통'),
        columns: qCols.join('|'), desc: '구글폼으로 받은 학생 응답'
      });
      act = getActivity_(made.key);
    } catch (e) { ui_().alert(APP.MENU, '오류: ' + e.message, ui_().ButtonSet.OK); return; }
  } else {
    act = acts[Number(aAns) - 1];
    if (!act) { ui_().alert('번호가 올바르지 않습니다.'); return; }
  }

  var n = pushFormInto_(fs, act, qCols);
  toast_('폼 응답 ' + n + '건을 [' + act.name + ']에 반영했습니다.', APP.MENU);
  var t = sh_(act.inSheet);
  if (t) ss_().setActiveSheet(t);
}

/** 응답 시트 → 활동 입력 시트 (반/번호로 매칭, 같은 학생은 최신 응답 사용) */
function pushFormInto_(formSheet, act, qCols) {
  var target = sh_(act.inSheet);
  if (!target) throw new Error('입력 시트를 찾을 수 없습니다: ' + act.inSheet);
  var cols = parseColumns(act.columns);
  var last = formSheet.getLastRow();
  if (last < 2) return 0;

  var vals = formSheet.getRange(2, 1, last - 1, formSheet.getLastColumn()).getValues();
  var byId = {};
  vals.forEach(function (r) {
    var id = String(r[1]).trim() + '-' + String(r[2]).trim();
    if (id === '-') return;
    byId[id] = r;   // 뒤에 오는(최신) 응답이 덮어씀
  });

  var tLast = target.getLastRow();
  if (tLast < APP.DATA_ROW) return 0;
  var cnt = tLast - APP.DATA_ROW + 1;
  var ab = target.getRange(APP.DATA_ROW, 1, cnt, 2).getValues();
  var out = target.getRange(APP.DATA_ROW, 5, cnt, cols.length).getValues();

  var n = 0;
  for (var i = 0; i < cnt; i++) {
    var id = String(ab[i][0]).trim() + '-' + String(ab[i][1]).trim();
    var r = byId[id];
    if (!r) continue;
    for (var c = 0; c < cols.length; c++) {
      // 활동의 c번째 입력 항목 ← 폼의 c번째 문항 (순서 기준)
      var v = (c < qCols.length) ? r[4 + c] : '';
      if (String(v).trim() !== '') out[i][c] = v;
    }
    n++;
  }
  target.getRange(APP.DATA_ROW, 5, cnt, cols.length).setValues(out);
  return n;
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
      return { id: s.id, label: s.cls + '반 ' + s.no + '번 ' + (s.name || '') };
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

