import type { TemplateBlueprint } from "./blueprint";

type Section = TemplateBlueprint["sections"][number];

type OperationsInput = Omit<TemplateBlueprint, "table"> & {
  tableTitle: string;
  columns: string[];
};

const defineTemplate = ({ tableTitle, columns, ...template }: OperationsInput): TemplateBlueprint => ({
  ...template,
  table: {
    title: tableTitle,
    columns,
    rows: [columns.map(() => "")],
  },
});

const source = {
  sop: { title: "업무 설명으로 SOP 만들기 2026 템플릿", url: "https://www.notion.com/ko/templates/sop-from-a-process-description" },
  interview: { title: "인터뷰 가이드 2026 템플릿", url: "https://www.notion.com/ko/templates/interview-guide" },
  scorecard: { title: "면접 평가표 2026 템플릿", url: "https://www.notion.com/ko/templates/interview-scorecard-skill" },
  recruit: { title: "채용 시스템 템플릿", url: "https://www.notion.com/ko/templates/recruitment-system" },
  onboarding: { title: "온보딩 매니저 템플릿", url: "https://www.notion.com/ko/templates/onboarding-manager" },
  career: { title: "커리어 성장 템플릿 제작자 desbyseb", url: "https://www.notion.com/ko/templates/career-growth-os" },
  leave: { title: "직원 연차 관리 템플릿 제작자 DJM", url: "https://www.notion.com/ko/templates/leave-balance-tracker" },
  payroll: { title: "직원 급여·인건비 관리 시스템 템플릿", url: "https://www.notion.com/ko/templates/employee-payroll-manager-kr" },
  company: { title: "회사 박스 템플릿 제작자 Notion", url: "https://www.notion.com/ko/templates/company-in-a-box" },
  companyHome: { title: "회사 홈 구조 템플릿", url: "https://www.notion.com/ko/templates/company-home-structure" },
  docs: { title: "문서 관리(Documents Management) 템플릿 제작자 mrpugo", url: "https://www.notion.com/ko/templates/docs-documents-management" },
  inventory: { title: "재고 추적기 템플릿", url: "https://www.notion.com/ko/templates/inventory-tracker-502" },
  purchasing: { title: "재고·발주 관리 템플릿", url: "https://www.notion.com/ko/templates/inventory-order-management-kr" },
  finance: { title: "프로 재무 트래커 템플릿", url: "https://www.notion.com/ko/templates/pro-finance-tracker" },
  bank: { title: "계좌, 카드 관리 템플릿 제작자 Hexagon", url: "https://www.notion.com/ko/templates/bank-account-card-tracker" },
  nonprofitFundraising: { title: "비영리 모금 활동 템플릿 제작자 Notion", url: "https://www.notion.com/ko/templates/nonprofit-fundraising" },
  donations: { title: "후원 관리 2026 템플릿", url: "https://www.notion.com/ko/templates/donation-management" },
  volunteer: { title: "자원봉사자 관리 2026 템플릿", url: "https://www.notion.com/ko/templates/volunteer-management" },
  volunteerLog: { title: "Volunteer Activity Log 템플릿", url: "https://www.notion.com/ko/templates/volunteer-activity-log" },
  board: { title: "비영리 이사회 페이지 2026 템플릿", url: "https://www.notion.com/ko/templates/our-board" },
  afterSchool: { title: "After-School Program Starter 템플릿 제작자 RunBook Systems", url: "https://www.notion.com/ko/templates/after-school-program-starter" },
  investor: { title: "Angel Investor OS — 거래 및 포트폴리오 시스템 템플릿 제작자 MH Systems", url: "https://www.notion.com/ko/templates/angel-investor-os-deal-portfolio-system" },
  diligence: { title: "Venture Capital Due Diligence Workflow 템플릿", url: "https://www.notion.com/ko/templates/venture-capital-due-diligence-workflow" },
  capital: { title: "헤지펀드 자금 흐름 추적기 템플릿 제작자 Nation4Business", url: "https://www.notion.com/ko/templates/hedge-fund-capital-flow-tracker" },
  portfolio: { title: "Venture Capital Portfolio Performance Dashboard 템플릿", url: "https://www.notion.com/ko/templates/venture-capital-portfolio-performance-dashboard" },
  investorCrm: { title: "Investor CRM & Fundraising Tracker 템플릿 제작자 NotoMantra", url: "https://www.notion.com/ko/templates/investor-crm-fundraising-tracker-for-startups" },
  kpi: { title: "사장님 월간 KPI | 목표만 적으면 달성률 자동 템플릿", url: "https://www.notion.com/ko/templates/business-ceo-kpi" },
  okr: { title: "OKRs 추적기 템플릿", url: "https://www.notion.com/ko/templates/okrs-tracker-1" },
  yearEnd: { title: "Year-End Review & Lessons Archive 템플릿", url: "https://www.notion.com/ko/templates/year-end-review-lessons-archive" },
};

const section = (title: string, prompt: string, bullets: string[]): Section => ({ title, prompt, bullets });

export const operationsTemplates: TemplateBlueprint[] = [
  defineTemplate({
    id: "ops-workforce-plan", title: "분기 인력 수요 가설표", description: "팀별 업무량과 공석을 바탕으로 채용 필요성을 검토하는 계획 기록입니다.", purpose: "인원 목표, 근거, 불확실성을 한 화면에서 비교하고 변경 이유를 남깁니다.", icon: "🧭", category: "people", tags: ["인력계획", "채용", "용량"], source: source.recruit,
    sections: [section("계획 범위", "대상 분기와 조직 범위를 적고, 계획과 확정 인원을 구분하세요.", ["기준일과 계획 기간", "대상 팀과 역할군", "현재 인원·공석·확정 이동"]), section("수요 근거", "업무량 변화가 인력 수요에 미치는 경로를 기록하세요.", ["수요를 만든 업무·고객·제품 변화", "현재 처리 용량과 병목", "외주·자동화·재배치 대안"]), section("가정과 검토", "수치보다 가정의 출처와 검토 시점을 남기세요.", ["낙관·기준·보수 시나리오의 전제", "결정권자와 미결 질문", "다음 재검토 날짜"])],
    tableTitle: "역할별 수요 기록", columns: ["팀", "역할", "현재 인원", "필요 인원 가설", "업무량 근거", "가정", "검토일"],
  }),
  defineTemplate({
    id: "ops-role-requisition", title: "채용 요청 사전 브리프", description: "새 역할 또는 대체 채용을 열기 전에 범위와 승인 근거를 정리합니다.", purpose: "채용 공고 문안과 인터뷰 기준을 만들기 전에 역할 필요성을 합의합니다.", icon: "📝", category: "people", tags: ["채용", "요청", "역할정의"], source: source.recruit,
    sections: [section("요청 배경", "신규 역할인지 대체인지와 해결할 업무 공백을 설명하세요.", ["요청 팀과 협업자", "공석 발생 또는 수요 변화", "채용하지 않을 때의 업무 영향"]), section("역할 범위", "첫 6개월에 맡길 결과와 제외할 업무를 써 보세요.", ["핵심 책임 세 가지", "필수 역량과 학습 가능한 역량", "성과를 확인할 관찰 가능한 결과"]), section("승인·공개 준비", "공고 공개 전에 결정되어야 할 항목을 확인하세요.", ["채용 책임자와 최종 승인자", "근무 형태·시작 가능 시점", "예산 검토 상태와 미결 질문"])],
    tableTitle: "요청 검토표", columns: ["요청 ID", "팀", "역할명", "신규/대체", "요청자", "승인 상태", "미결 항목"],
  }),
  defineTemplate({
    id: "ops-recruiting-pipeline", title: "후보자 단계 인계 기록", description: "지원자 명단을 복제하지 않고 각 전형 단계의 담당자와 다음 인계를 추적합니다.", purpose: "중복 연락과 단계 누락을 줄이고 후보자 상태를 명확히 기록합니다.", icon: "🪜", category: "people", tags: ["채용", "인계", "전형"], source: source.recruit,
    sections: [section("단계 정의", "팀에서 실제 사용하는 전형만 적고 각 단계의 목적을 분리하세요.", ["단계명과 진행 기준", "단계 담당자와 대체 담당자", "후보자에게 안내할 예상 소요"]), section("인계 기준", "다음 담당자가 바로 이어갈 수 있도록 최소 정보를 정하세요.", ["평가 요약과 확인된 근거", "후보자에게 안내한 다음 일정", "추가 확인이 필요한 주장·자료"]), section("접근과 보관", "지원자 정보의 범위와 내부 공유 대상을 제한하세요.", ["가명 ID로 기록하는 기본 원칙", "민감정보를 기록하지 않기", "종료 후 보관·삭제 담당자 확인"])],
    tableTitle: "전형 인계표 · 예시 데이터 없음", columns: ["가명 후보 ID", "역할", "현재 단계", "단계 담당자", "마지막 안내", "다음 단계", "다음 연락 예정"],
  }),
  defineTemplate({
    id: "ops-interview-loop", title: "면접 라운드 설계서", description: "면접관별 확인 주제와 질문 중복을 사전에 조정하는 라운드 계획입니다.", purpose: "각 라운드가 역할의 다른 역량을 살피고 후보자에게 일관된 흐름을 제공하도록 돕습니다.", icon: "🎙️", category: "people", tags: ["면접", "채용", "설계"], source: source.interview,
    sections: [section("평가 범위", "역할 브리프에서 평가할 역량과 관찰 근거를 가져오세요.", ["필수 역량과 보조 역량", "사례 질문으로 확인할 행동", "평가하지 않을 개인 특성 명시"]), section("라운드 구성", "면접 시간과 패널별 초점을 명확하게 분배하세요.", ["라운드 순서와 소요 시간", "면접관별 책임 질문", "패널 간 중복 질문 제거"]), section("후보자 경험", "접근성 요청과 사전 안내를 담당자에게 연결하세요.", ["면접 형식·참석자 사전 공유", "과제·준비물이 있다면 목적과 예상 시간", "후보자 질문과 후속 안내 담당자"])],
    tableTitle: "라운드 계획", columns: ["라운드", "평가 주제", "질문 담당자", "시간", "준비물", "후보자 안내 시점"],
  }),
  defineTemplate({
    id: "ops-interview-evidence", title: "면접 근거 메모 카드", description: "평가 점수와 관찰 사실을 분리해 기록하는 구조화 면접 메모입니다.", purpose: "인상 위주의 평을 줄이고 역할 관련 행동 근거를 비교 가능하게 남깁니다.", icon: "📋", category: "people", tags: ["면접", "평가", "근거기록"], source: source.scorecard,
    sections: [section("역량 기준", "각 역량의 기대 행동을 면접 전에 합의하세요.", ["역량 정의와 질문 연결", "낮음·기준·높음의 관찰 예시", "모든 후보자에게 공통 적용할 기준"]), section("관찰 기록", "해석보다 실제 발언·행동과 맥락을 적으세요.", ["상황과 후보자가 한 행동", "결과 또는 확인 질문", "평가 근거와 불확실성 분리"]), section("종합 회고", "면접관 의견을 모으기 전에 개별 기록을 마무리하세요.", ["역할 기준에 맞는 강점", "확인되지 않은 영역", "추가 질문 또는 판단 보류 사유"])],
    tableTitle: "역량별 근거", columns: ["가명 후보 ID", "역량", "질문", "관찰 사실", "근거 수준", "추가 확인"],
  }),
  defineTemplate({
    id: "ops-reference-check", title: "경력 확인 연락 기록", description: "후보자 동의와 조직 절차를 확인한 뒤 참고인 연락 결과를 사실 중심으로 정리합니다.", purpose: "확인 범위, 연락 상태, 사실과 해석을 구분해 과도한 수집을 피합니다.", icon: "🔎", category: "people", tags: ["채용", "확인기록", "개인정보"], source: source.recruit,
    sections: [section("사전 확인", "연락 전에 후보자 동의 범위와 내부 절차를 확인하세요.", ["동의 확인 담당자와 일자", "확인 가능한 업무 관계·기간", "연락처 접근 권한 확인"]), section("질문 범위", "역할 관련 사실 확인에 필요한 질문만 준비하세요.", ["함께 일한 기간과 관계", "관찰 가능한 업무 사례", "확인 범위 밖 사적 질문 제외"]), section("결과와 보관", "연락 결과를 평가 결론과 분리해 보관하세요.", ["연락 시도·완료 상태", "참고인의 직접 진술과 확인 불가 사항", "접근·보관 정책 재확인"])],
    tableTitle: "가명 확인 기록", columns: ["후보 ID", "동의 확인일", "연락 상태", "확인 범위", "사실 메모", "후속 담당", "보관 검토일"],
  }),
  defineTemplate({
    id: "ops-offer-review", title: "입사 제안 승인 요약", description: "제안 조건의 버전과 승인 상태를 관리하는 채용 행정 기록입니다.", purpose: "구두 안내와 최종 문서 사이의 차이를 줄이고 미확정 조건을 표시합니다.", icon: "✉️", category: "people", tags: ["채용", "제안", "승인"], source: source.recruit,
    sections: [section("제안 기준", "승인된 역할 브리프와 현재 조건안을 연결하세요.", ["역할·보고 관계·근무 형태", "조건안 버전과 작성 날짜", "확정 항목과 아직 협의 중인 항목"]), section("검토 흐름", "필요한 내부 검토자와 책임 범위를 정리하세요.", ["인사·재무·역할 책임자의 검토", "승인 근거가 된 문서 링크", "수정 요청과 응답 담당자"]), section("후속 안내", "후보자에게 전달한 내용을 기록하고 다음 단계를 안내하세요.", ["제안 발송·응답 상태", "기한이 있다면 출처와 합의 내용", "합류 전 문의 창구와 담당자"])],
    tableTitle: "조건 승인표 · 빈 기록", columns: ["가명 후보 ID", "역할", "문서 버전", "검토자", "승인 상태", "발송일", "후속 예정"],
  }),
  defineTemplate({
    id: "ops-day-one", title: "첫 출근일 준비 보드", description: "신규 구성원의 첫날에 필요한 사람, 공간, 계정, 안내를 연결합니다.", purpose: "담당자별 준비 상태를 확인해 첫날의 불필요한 대기와 누락을 줄입니다.", icon: "🌱", category: "people", tags: ["온보딩", "첫날", "준비"], source: source.onboarding,
    sections: [section("도착 안내", "첫날 동선과 환영 담당을 구체적으로 적으세요.", ["시작 시간·장소·연락 방법", "맞이할 동료와 점심 계획", "접근성·장비 요청 확인 담당자"]), section("업무 환경", "계정과 도구 준비는 필요한 범위만 기록하세요.", ["요청된 장비와 전달 상태", "필수 시스템 계정 생성 담당자", "권한 확인 완료 여부"]), section("첫 주 약속", "필수 소개와 자기 주도 학습을 균형 있게 배치하세요.", ["팀·협업자 소개", "첫 주 목표와 질문 창구", "첫 체크인 일정과 참석자"])],
    tableTitle: "첫날 체크 항목", columns: ["준비 항목", "담당자", "기한", "상태", "완료 확인", "막힘·지원 요청"],
  }),
  defineTemplate({
    id: "ops-30-60-90", title: "입사 30·60·90일 합의표", description: "신규 구성원과 관리자가 단계별 학습·기여 기대를 함께 조정합니다.", purpose: "성과를 단정하는 평가표가 아니라 입사 초기 지원 약속과 대화를 기록합니다.", icon: "📈", category: "people", tags: ["온보딩", "성장", "체크인"], source: source.onboarding,
    sections: [section("시작점", "경험과 필요한 지원을 본인이 설명할 수 있게 여지를 둡니다.", ["이미 익숙한 업무와 도구", "새로 익혀야 할 맥락", "편한 피드백·질문 방식"]), section("단계별 합의", "기간별로 결과보다 학습과 관찰 가능한 일을 정하세요.", ["30일: 사람·제품·절차 이해", "60일: 작은 업무를 독립 수행", "90일: 책임 범위와 지원 재합의"]), section("점검과 조정", "계획 변경을 실패로 보지 않고 이유와 도움을 남깁니다.", ["구성원 관점의 진행 상황", "관리자가 제공할 지원", "다음 대화 전까지의 작은 실험"])],
    tableTitle: "단계별 지원 계획", columns: ["기간", "학습·업무 초점", "구성원 제안", "지원 담당", "점검 날짜", "조정 메모"],
  }),
  defineTemplate({
    id: "ops-manager-onboarding", title: "신임 관리자 전환 안내서", description: "관리 역할로 이동한 구성원이 팀 운영에 필요한 관계와 지원을 확인합니다.", purpose: "개인 기여자 업무에서 사람·우선순위 지원으로 바뀌는 책임을 명시합니다.", icon: "🧑‍💼", category: "people", tags: ["관리자", "전환", "온보딩"], source: source.onboarding,
    sections: [section("역할 경계", "결정 권한과 상위 보고가 필요한 사안을 나누세요.", ["팀 운영에서 맡을 결정", "상위 책임자와 합의할 사항", "이전 역할의 업무 인계 계획"]), section("팀 관계", "팀원과의 대화 계획을 세우되 민감한 평가는 저장하지 마세요.", ["팀원별 업무 맥락을 듣는 일정", "공동 작업자의 기대와 지원 요청", "신뢰 형성을 위한 반복 약속"]), section("관리 도구", "조직에서 실제 쓰는 절차와 연락처를 연결하세요.", ["피드백·휴가·채용 문의 창구", "팀 목표와 정기 운영 주기", "첫 달 관리자 멘토 체크인"])],
    tableTitle: "전환 준비표", columns: ["준비 항목", "함께할 사람", "자료·링크", "상태", "확인일", "후속 질문"],
  }),
  defineTemplate({
    id: "ops-internal-mobility", title: "내부 역할 이동 인계서", description: "팀·직무 이동 시 업무와 권한의 전환 시점을 조율합니다.", purpose: "이동 전후 두 팀의 소유권 공백과 접근 권한 혼선을 줄입니다.", icon: "🔁", category: "people", tags: ["내부이동", "인계", "역할전환"], source: source.career,
    sections: [section("전환 범위", "이동 전후 역할과 효력 발생 시점을 합의하세요.", ["새 역할의 업무 범위", "기존 업무의 새 책임자", "전환 기간 중 이중 담당 항목"]), section("지식 인계", "문서와 진행 중 결정의 맥락을 전달하세요.", ["진행 중 업무·마감·외부 의존성", "결정 기록과 남은 선택지", "정기 연락처·자료 위치"]), section("접근 정리", "새 역할에 필요한 권한을 별도로 요청하고 이전 권한을 검토하세요.", ["필요한 시스템·공간", "기존 권한 회수 확인 담당자", "팀별 최종 인계 확인 날짜"])],
    tableTitle: "업무 전환 목록", columns: ["업무·자료", "현재 책임자", "새 책임자", "전환 날짜", "접근 정리", "확인 상태"],
  }),
  defineTemplate({
    id: "ops-skills-matrix", title: "팀 역량·학습 매트릭스", description: "팀이 함께 갖춘 역량과 학습 의존을 계획 단위로 살펴봅니다.", purpose: "개인의 등급을 매기지 않고 업무 연속성과 교육 기회를 보이는 표입니다.", icon: "🧩", category: "people", tags: ["역량", "학습", "팀운영"], source: source.career,
    sections: [section("역량 정의", "업무 수행에 실제 필요한 행동과 도구로 역량을 표현하세요.", ["역량 설명과 쓰이는 업무", "필수와 선택 구분", "기준을 정한 팀과 날짜"]), section("팀 커버리지", "이름 대신 역할 또는 팀 단위로 기록해도 충분합니다.", ["현재 업무를 수행할 수 있는 범위", "한 명에게만 의존하는 지식", "본인이 배우고 싶은 주제"]), section("학습 계획", "격차를 평가 낙인으로 쓰지 않고 지원 활동으로 바꾸세요.", ["동료 학습·문서화·외부 교육 선택", "연습 기회와 페어 담당자", "다음 매트릭스 점검 시점"])],
    tableTitle: "역량 커버리지 · 개인 점수 금지", columns: ["역량", "업무 연결", "팀 커버리지", "단일 의존 지점", "학습 활동", "점검일"],
  }),
  defineTemplate({
    id: "ops-learning-plan", title: "교육 신청·학습 적용 기록", description: "교육 목표, 승인, 배운 내용을 실제 업무에 적용하는 후속을 기록합니다.", purpose: "수강 내역만 쌓지 않고 필요한 지원과 학습 결과를 연결합니다.", icon: "📚", category: "people", tags: ["교육", "학습", "성장"], source: source.career,
    sections: [section("학습 필요", "교육을 통해 해결하고 싶은 업무 상황을 적으세요.", ["현재 업무에서 막히는 지점", "필요한 기술·지식", "이미 시도한 학습 방식"]), section("선택·지원", "교육 내용과 시간 투자를 미리 검토하세요.", ["과정·자료와 제공자", "필요 시간·비용의 검토 상태", "참여 접근성이나 일정 조정"]), section("적용 회고", "수료 여부와 별도로 업무에 적용한 경험을 남기세요.", ["적용할 작은 과업", "도움이 된 점과 추가 질문", "팀에 공유할 자료·학습"])],
    tableTitle: "학습 계획", columns: ["학습 주제", "업무 맥락", "자료·과정", "승인 상태", "적용 실험", "회고 날짜"],
  }),
  defineTemplate({
    id: "ops-performance-evidence", title: "성과 대화 근거 아카이브", description: "정기 성과 대화 전에 합의된 목표와 결과 사례를 정리합니다.", purpose: "점수 자동화 없이 사실·맥락·의견을 분리해 대화의 정확성을 높입니다.", icon: "🗂️", category: "people", tags: ["성과대화", "기록", "회고"], source: source.career,
    sections: [section("범위와 기준", "해당 기간에 합의한 목표와 역할 변화를 먼저 적으세요.", ["대화 기간과 역할 범위", "기간 중 목표 변경 이유", "본인이 중요하게 본 결과"]), section("사례 정리", "결과만 나열하지 말고 기여와 협업 맥락을 붙이세요.", ["관찰 가능한 성과·사례", "함께한 사람과 의존성", "어려움·실패에서 배운 점"]), section("대화 준비", "성과 결론을 미리 고정하지 않고 질문과 지원을 준비하세요.", ["구성원 본인의 해석", "다음 기간의 지원·성장 질문", "합의한 후속과 재검토 날짜"])],
    tableTitle: "기간별 근거 메모", columns: ["기간", "합의 목표", "사례·결과", "맥락·협업", "구성원 해석", "대화 후속"],
  }),
  defineTemplate({
    id: "ops-growth-plan", title: "개인 성장 실험 계획", description: "구성원이 선택한 성장 방향을 작은 업무 실험과 지원 약속으로 연결합니다.", purpose: "승진 약속이나 자동 평가 없이 학습과 경력 대화를 구조화합니다.", icon: "🌿", category: "people", tags: ["경력개발", "성장", "코칭"], source: source.career,
    sections: [section("방향 탐색", "현재 흥미와 다음에 경험해 보고 싶은 일을 본인 표현으로 적으세요.", ["즐겁거나 힘이 났던 업무", "넓히고 싶은 책임·기술", "당장 결정하지 않아도 되는 선택지"]), section("성장 실험", "작고 되돌릴 수 있는 업무 경험을 고르세요.", ["실험 업무와 기간", "성공을 판단할 학습 신호", "함께 검토할 동료·관리자"]), section("지원·회고", "시간과 피드백을 제공할 책임을 팀과 나눕니다.", ["필요한 시간·자료·소개", "중간 체크인 질문", "계속·수정·중단 결정과 이유"])],
    tableTitle: "성장 실험", columns: ["학습 방향", "업무 실험", "기간", "지원 담당", "학습 신호", "회고 결과"],
  }),
  defineTemplate({
    id: "ops-development-checkin", title: "성장 대화 체크인 카드", description: "일반 회의록과 분리해 구성원의 에너지·성장·지원 요청을 정기적으로 살핍니다.", purpose: "관리자 일방 평가가 아니라 구성원이 의제를 정하는 대화의 후속을 기록합니다.", icon: "💬", category: "people", tags: ["관리자", "성장대화", "체크인"], source: source.yearEnd,
    sections: [section("구성원 의제", "먼저 구성원이 다루고 싶은 주제를 선택하도록 합니다.", ["최근 몰입을 높인 일", "에너지를 소모한 반복 장애", "다음 기간에 바라는 변화"]), section("지원 대화", "문제 해결을 서두르기 전에 필요한 지원 방식을 확인하세요.", ["경청·조언·결정 중 원하는 도움", "관리자가 제거할 수 있는 장애", "공유 범위를 합의할 민감한 내용"]), section("합의된 후속", "약속의 소유자와 점검 날짜만 요약합니다.", ["관리자 후속 약속", "구성원 선택 과제", "다음 체크인에서 다시 볼 질문"])],
    tableTitle: "합의된 후속", columns: ["대화 날짜", "구성원 주제", "지원 약속", "담당", "확인 날짜", "완료·조정 메모"],
  }),
  defineTemplate({
    id: "ops-leave-coverage", title: "부재 기간 업무 커버리지", description: "휴가나 장기 부재 중 업무 책임과 연락 경계를 미리 합의합니다.", purpose: "휴가 잔여 계산을 반복하지 않고 부재 중 업무 연속성에 초점을 둡니다.", icon: "🏖️", category: "people", tags: ["부재", "업무인계", "커버리지"], source: source.leave,
    sections: [section("부재 범위", "조직에서 승인한 부재 기간과 연락 가능 여부만 기록하세요.", ["부재 시작·복귀 일정", "긴급 연락 경로 합의", "개인 사유 상세정보는 적지 않기"]), section("업무 대체", "기한이 있는 업무와 대체 책임자를 정합니다.", ["부재 전 완료할 일", "임시 책임자와 권한", "복귀 후 다시 넘길 자료"]), section("복귀 지원", "복귀 첫 주에 필요한 맥락과 업무량 조정을 계획하세요.", ["재개할 우선 업무", "변경 사항을 공유할 동료", "부하 점검과 조정 대화"])],
    tableTitle: "부재 중 커버리지", columns: ["업무", "기한·주기", "임시 책임자", "자료 위치", "긴급도 합의", "복귀 인계"],
  }),
  defineTemplate({
    id: "ops-payroll-documents", title: "급여 처리 자료 전달 점검", description: "급여 담당자 간 변경 자료의 제출·검토 상태를 추적하는 행정 기록입니다.", purpose: "개인 급여를 문서에 복제하지 않고 자료의 도착과 검토만 기록합니다.", icon: "🧾", category: "people", tags: ["급여행정", "자료관리", "검토"], source: source.payroll,
    sections: [section("처리 주기", "조직이 정한 내부 마감과 책임자만 입력하세요.", ["대상 기간과 내부 마감 출처", "제출 담당자와 검토 담당자", "처리 시스템·보관 위치 링크"]), section("변경 자료", "개별 금액 대신 필요한 자료 종류와 상태를 적으세요.", ["입·퇴사·변경 등 자료 유형", "누락 여부와 수정 요청 상태", "완료 확인을 남긴 담당자"]), section("검토·접근", "권한 있는 담당자만 세부 자료에 접근하도록 확인하세요.", ["자료 접근 권한 검토", "보관 위치와 내부 보존 절차 참조", "오류 발견 시 책임자에게 전달"])],
    tableTitle: "자료 전달 상태 · 개인 금액 기록 금지", columns: ["기간", "자료 유형", "가명 건 ID", "제출 상태", "검토자", "오류·재요청", "완료일"],
  }),
  defineTemplate({
    id: "ops-employee-offboarding", title: "직원 퇴직 인계 체크리스트", description: "퇴직 전후 업무, 장비, 문서, 계정 처리 담당을 연결합니다.", purpose: "사유나 민감한 인사 판단을 기록하지 않고 업무 전환과 접근 정리를 관리합니다.", icon: "🚪", category: "people", tags: ["오프보딩", "인계", "접근정리"], source: source.company,
    sections: [section("일정과 소통", "합의된 마지막 근무일과 필요한 안내 담당을 확인하세요.", ["일정 출처와 공유 대상", "팀에 알릴 내용과 시점", "최종 질문 창구"]), section("업무 인계", "진행 업무와 결정 맥락을 새 책임자에게 전달하세요.", ["진행 중 업무·기한·외부 약속", "반복 업무의 문서화 상태", "인수자 확인과 미결 위험"]), section("자산·권한", "장비 반환과 계정 정리는 책임자가 완료를 확인하도록 합니다.", ["조직 자산 반환 확인", "시스템 권한 종료 요청·확인", "자료 접근·보관 규칙에 따른 마무리"])],
    tableTitle: "퇴직 업무 체크", columns: ["항목", "담당자", "예정일", "확인 근거", "상태", "후속"],
  }),
  defineTemplate({
    id: "ops-policy-receipt", title: "내부 정책 열람 확인대장", description: "정책 버전, 전달 대상, 확인 완료 상태를 관리합니다.", purpose: "수신 확인을 정책 준수의 자동 증거나 법적 판단으로 취급하지 않습니다.", icon: "📑", category: "people", tags: ["정책", "확인기록", "문서관리"], source: source.company,
    sections: [section("문서 식별", "정책의 소유자와 최신 승인본을 연결하세요.", ["문서 제목·버전·발효 안내일", "정책 책임자와 문의 창구", "이전 버전과 변경 요약 링크"]), section("전달 대상", "실제로 안내가 필요한 집단과 채널을 기록하세요.", ["대상 팀·역할 범위", "전달 채널과 발송 담당자", "열람 가능한 문서 링크"]), section("확인 후속", "미확인자에게 정중한 안내와 질문 경로를 제공합니다.", ["확인 상태와 마지막 알림", "질문·오해를 해소할 담당자", "확인 로그 접근·보관 위치"])],
    tableTitle: "문서별 안내 현황", columns: ["문서·버전", "대상 범위", "안내일", "확인 상태", "질문 담당자", "다음 알림일"],
  }),
  defineTemplate({
    id: "ops-process-capture", title: "현행 업무 흐름 인터뷰 노트", description: "현장에서 하는 일을 단계와 예외 중심으로 받아 적어 절차 문서의 초안을 만듭니다.", purpose: "이상적인 흐름을 덮어쓰지 않고 실제 입력, 판단, 결과를 먼저 보존합니다.", icon: "🗒️", category: "operations", tags: ["업무분석", "SOP", "프로세스"], source: source.sop,
    sections: [section("업무 경계", "시작 신호와 완료 상태, 다음 업무의 수신자를 확인하세요.", ["업무가 시작되는 요청·이벤트", "최종 산출물과 사용자", "업무에 포함되지 않는 단계"]), section("단계별 실행", "실행자, 도구, 입력, 판단 기준을 순서대로 기록하세요.", ["실제 실행 순서와 역할", "사용하는 문서·시스템", "분기 조건과 확인 질문"]), section("예외와 검증", "오류, 대기, 되돌림이 발생할 때의 실제 대응을 확인하세요.", ["반복되는 예외 사례", "완료를 확인하는 방법", "인터뷰 후 현장 검증할 미확인 항목"])],
    tableTitle: "실제 업무 단계", columns: ["순서", "시작 입력", "실행 역할", "수행 작업", "판단·도구", "완료 신호", "예외"],
  }),
  defineTemplate({
    id: "ops-sop-review", title: "절차 문서 소유·검토 대장", description: "업무 절차의 책임자, 근거 자료, 변경 이력과 재검토 일정을 관리합니다.", purpose: "절차가 현장과 어긋나거나 관리 책임이 사라지는 일을 줄입니다.", icon: "📘", category: "operations", tags: ["SOP", "문서관리", "검토"], source: source.sop,
    sections: [section("문서 책임", "문서가 설명하는 업무와 승인 책임자를 지정하세요.", ["사용자·적용 범위", "내용 소유자와 승인자", "원본 자료·관련 문서 연결"]), section("변경 기록", "무엇이 바뀌었고 어떤 운영 영향이 있는지 적으세요.", ["수정 전후 차이", "변경 근거와 요청자", "교육·안내가 필요한 팀"]), section("현장 확인", "검토 날짜를 달력 기준으로 정하고 실제 수행자에게 확인하세요.", ["마지막 검토일과 다음 검토일", "현장 테스트 결과", "폐기·교체 여부와 링크"])],
    tableTitle: "절차 문서 현황", columns: ["문서명", "업무 소유자", "승인자", "버전", "현장 확인일", "다음 검토일", "상태"],
  }),
  defineTemplate({
    id: "ops-risk-register", title: "운영 위험·대응 기록부", description: "사업 수행을 방해할 수 있는 불확실성과 대응 책임을 조직 내부 언어로 정리합니다.", purpose: "규정 준수 판정이나 수치 예측을 대신하지 않고 관찰·완화·검토를 연결합니다.", icon: "⚠️", category: "operations", tags: ["위험관리", "대응", "검토"], source: source.company,
    sections: [section("위험 서술", "위험을 원인, 발생 상황, 영향으로 분리해 적으세요.", ["관찰된 징후와 출처", "영향을 받을 업무·사용자", "아직 확인되지 않은 가정"]), section("대응 선택", "위험을 없애기 어렵다면 영향 축소와 조기 탐지 방안을 기록하세요.", ["예방·완화 실험", "발생 시 임시 대응과 연락자", "책임자와 필요한 지원"]), section("검토 주기", "변화가 생기면 다시 살피도록 트리거를 정하세요.", ["관찰 지표와 확인 담당", "대응이 효과 있었는지 평가할 날짜", "수용·수정·상향 보고 결정 근거"])],
    tableTitle: "운영 위험대장", columns: ["위험 ID", "원인·상황", "업무 영향", "관찰 신호", "대응 책임자", "조치", "검토일"],
  }),
  defineTemplate({
    id: "ops-incident-learning", title: "운영 장애 타임라인·학습 기록", description: "업무 중단이나 반복 오류를 비난 없이 시간순으로 복기합니다.", purpose: "책임자 찾기보다 영향, 대응, 시스템 개선을 문서화합니다.", icon: "🧯", category: "operations", tags: ["장애", "회고", "개선"], source: source.companyHome,
    sections: [section("영향과 범위", "누가 어떤 서비스·업무에서 영향을 받았는지 확인된 사실을 적으세요.", ["발생·인지·복구 시각", "영향 업무와 사용자 범위", "현재도 남아 있는 영향"]), section("대응 타임라인", "선택과 근거를 시간순으로 기록하세요.", ["감지와 최초 안내", "대응 작업과 결정", "복구 확인 방법"]), section("후속 개선", "사람의 실수보다 예방·탐지·복구 시스템의 변화를 제안하세요.", ["기여한 조건과 조기 신호", "재발 가능성을 낮출 작은 변경", "책임자·기한·효과 재검토일"])],
    tableTitle: "이벤트 타임라인", columns: ["시간", "관찰·행동", "영향", "근거 링크", "담당", "상태"],
  }),
  defineTemplate({
    id: "ops-continuity-map", title: "업무 연속성 의존성 지도", description: "핵심 업무가 멈출 때 필요한 사람, 장소, 도구, 공급 경로를 정리합니다.", purpose: "복구 시간을 보장하는 문서가 아니라 조직이 확인한 의존성과 연락 체계를 모읍니다.", icon: "🛟", category: "operations", tags: ["연속성", "의존성", "복구"], source: source.company,
    sections: [section("업무 우선순위", "조직이 복구 우선순위를 정할 때 고려할 사용자 영향을 적으세요.", ["업무 중단의 실제 영향", "대체 수작업 가능 여부", "중단 사실을 알릴 담당자"]), section("의존 관계", "업무 수행에 필요한 자원과 공급 경로를 확인하세요.", ["담당 역할과 대체 연락자", "시스템·공간·외부 공급자", "문서와 비상 접근 경로"]), section("복구 연습", "담당자가 직접 대체 경로를 확인하는 날짜를 정하세요.", ["모의 상황과 성공 신호", "실행 중 발견한 공백", "자료 갱신 책임자와 검토 날짜"])],
    tableTitle: "업무 의존성", columns: ["업무", "사용자 영향", "필수 자원", "대체 경로", "책임자", "연습일", "발견된 공백"],
  }),
  defineTemplate({
    id: "ops-maintenance", title: "장비 점검·수리 이력표", description: "조직 자산의 상태 점검, 수리 요청, 다음 확인을 기록합니다.", purpose: "장비별 실제 사용 환경을 고려해 유지보수 지식이 개인에게만 남지 않도록 합니다.", icon: "🛠️", category: "operations", tags: ["장비", "점검", "유지보수"], source: source.inventory,
    sections: [section("자산 식별", "장비를 식별할 수 있는 내부 ID와 위치를 적으세요.", ["자산 ID·유형·담당 팀", "사용 위치와 주요 사용자", "보증·매뉴얼·제조사 문서 링크"]), section("상태 확인", "실제 이상 징후와 점검 일자를 기록하세요.", ["점검자와 관찰 내용", "운영 영향과 사용 중지 여부", "사진·수리 요청 연결"]), section("수리·다음 점검", "수리 완료 여부와 확인 책임을 분명히 하세요.", ["수리 업체·작업 요약", "수리 후 동작 확인자", "다음 확인 일정과 기준"])],
    tableTitle: "장비 이력", columns: ["자산 ID", "장비·위치", "점검일", "관찰 상태", "수리 요청", "확인자", "다음 점검"],
  }),
  defineTemplate({
    id: "ops-stock-reorder", title: "재고 소진·발주 판단표", description: "품목, 실제 사용량, 조달 기간을 바탕으로 보충 필요성을 검토합니다.", purpose: "단순 수량 집계와 발주 승인을 분리해 과잉 주문과 품절 원인을 살핍니다.", icon: "📦", category: "operations", tags: ["재고", "발주", "수급"], source: source.purchasing,
    sections: [section("품목 기준", "같은 품목의 단위·보관 위치·사용 부서를 통일하세요.", ["품목 ID와 단위", "사용 팀과 보관 위치", "대체 가능한 품목 여부"]), section("보충 판단", "최소 수량은 조직이 관찰한 실제 사용 패턴으로 조정하세요.", ["현재 재고·예약 수량", "최근 소진·입고 변동", "조달 소요 시간과 공급 위험"]), section("주문 후 확인", "요청과 수령을 연결해 실제 납품 상태를 확인하세요.", ["승인된 주문 참조", "입고 수량·불일치", "기준 재검토에 반영할 사용량"])],
    tableTitle: "품목별 보충 기록", columns: ["품목 ID", "단위·위치", "현재 수량", "최근 사용", "조달 기간", "보충 요청", "입고 확인"],
  }),
  defineTemplate({
    id: "ops-procurement-intake", title: "구매 요청 사전 검토대", description: "구매 필요, 요구 조건, 대안, 승인 경로를 주문 전에 정리합니다.", purpose: "요청의 목적과 비교 근거를 남겨 예산·조달 검토가 빠르게 진행되도록 합니다.", icon: "🛒", category: "operations", tags: ["구매", "요청", "승인"], source: source.purchasing,
    sections: [section("필요 설명", "구매하려는 물품·서비스가 해결할 일을 설명하세요.", ["요청 부서와 사용할 사람", "필요 시점과 업무 영향", "현재 보유 자원으로 대체 가능한지"]), section("조건과 비교", "요구 사항과 선호 사항을 분리하세요.", ["필수 사양·수량·호환성", "검토한 선택지와 비교 근거", "데이터·서비스 이전 필요 여부"]), section("승인과 수령", "결재 완료 후 주문과 실물 확인을 연결하세요.", ["내부 검토자와 결정을 남길 링크", "발주 담당과 주문 참조", "수령·검수 후 완료 담당"])],
    tableTitle: "구매 요청", columns: ["요청 ID", "목적", "필수 조건", "대안 검토", "검토 담당", "승인 상태", "수령 확인"],
  }),
  defineTemplate({
    id: "ops-vendor-onboarding", title: "공급업체 시작 전 자료 목록", description: "신규 공급처와 업무를 시작하기 전에 계약·연락·운영 자료의 확보 상태를 확인합니다.", purpose: "법률·보안 인증 판단을 대신하지 않고 담당자가 확인해야 할 자료와 미결 사항을 추적합니다.", icon: "🤝", category: "operations", tags: ["공급업체", "시작준비", "문서"], source: source.company,
    sections: [section("업무 범위", "공급자가 제공할 일과 내부 소유자를 명확히 적으세요.", ["서비스·납품 범위와 제외 범위", "내부 업무 책임자", "업무를 시작할 조건과 예정일"]), section("자료 수집", "조직 기준에서 요구하는 자료와 검토자를 연결하세요.", ["사업·결제·연락 자료 위치", "계약·운영 문서 검토 담당", "자료 미제출·갱신 필요 항목"]), section("운영 준비", "실제 업무 시작에 필요한 연락 경로와 수신 확인을 준비하세요.", ["지원·장애 연락 창구", "업무 시간·인계 방식", "초기 운영 확인 날짜"])],
    tableTitle: "공급자 준비 현황", columns: ["공급자 ID", "서비스 범위", "내부 책임자", "자료 요청", "검토 담당", "시작 조건", "상태"],
  }),
  defineTemplate({
    id: "ops-vendor-review", title: "공급자 분기 서비스 회고", description: "납기, 품질, 의사소통의 실제 사례를 토대로 공급 관계를 점검합니다.", purpose: "자동 점수로 계약 결정을 내리지 않고 근거, 미해결 이슈, 다음 대화를 남깁니다.", icon: "📊", category: "operations", tags: ["공급업체", "서비스리뷰", "갱신"], source: source.company,
    sections: [section("약속과 결과", "계약·업무 합의에서 확인할 서비스 항목을 선택하세요.", ["약속한 범위와 기간", "실제 납품·응답 사례", "자료 부족으로 판단할 수 없는 부분"]), section("이슈와 개선", "반복 이슈의 영향과 공동 개선 책임을 나누세요.", ["발생일·영향·대응", "공급자와 내부 담당 조치", "재발 여부 확인 방식"]), section("다음 주기", "갱신 여부를 미리 단정하지 않고 선택 기준을 정리하세요.", ["계속 확인할 운영 신호", "관계자와 논의할 질문", "다음 검토 날짜와 자료 책임"])],
    tableTitle: "서비스 근거", columns: ["검토 기간", "합의 항목", "관찰 사례", "영향", "후속 조치", "담당자", "재검토일"],
  }),
  defineTemplate({
    id: "ops-facility-workorder", title: "공간 수리 요청·인계대", description: "사무실과 작업 공간의 수리 요청을 위치·영향·완료 확인과 연결합니다.", purpose: "메신저에 흩어진 작은 시설 문제의 우선순위와 처리 상태를 보입니다.", icon: "🏢", category: "operations", tags: ["시설", "수리", "요청"], source: source.companyHome,
    sections: [section("위치와 문제", "요청자가 현장에서 찾을 수 있게 위치와 증상을 적으세요.", ["공간·설비 식별", "처음 관찰한 증상과 시각", "사용 중단·우회가 필요한지"]), section("처리 조정", "작업 책임자와 공간 이용자의 일정을 맞추세요.", ["긴급도 판단 근거", "담당자·외부 업체", "예상 작업 시간과 출입 안내"]), section("완료 확인", "요청자 또는 공간 책임자가 실제 개선을 확인합니다.", ["작업 내역과 부품·비용 문서", "정상 사용 확인자", "재발 모니터링 또는 추가 요청"])],
    tableTitle: "시설 요청", columns: ["요청 ID", "공간·설비", "증상", "업무 영향", "담당", "작업 예정", "완료 확인"],
  }),
  defineTemplate({
    id: "ops-asset-checkout", title: "공용 장비 대여·반납대", description: "노트북·회의 장비 등 공용 자산의 인계 상태와 다음 이용 가능 여부를 기록합니다.", purpose: "자산 현황과 담당 위치를 확인하고 분실·중복 예약을 줄입니다.", icon: "🔌", category: "operations", tags: ["자산", "대여", "인계"], source: source.inventory,
    sections: [section("자산 등록", "식별 가능한 내부 자산 번호와 보관 위치를 지정하세요.", ["자산 ID·종류·구성품", "관리 책임자와 보관 장소", "이용 가능 상태와 확인일"]), section("대여 인계", "개인 식별 정보 대신 필요한 연락 수단만 내부 기준으로 다루세요.", ["대여 목적·기간", "인계 시 외관·구성품 상태", "반납 예정일과 안내 방법"]), section("반납 확인", "반납된 장비를 점검해 다음 사용자에게 넘길 준비를 합니다.", ["반납 일시와 확인자", "상태 변화·수리 요청", "자료 삭제·초기화는 내부 절차 참조"])],
    tableTitle: "자산 대여 기록 · 실명·연락처 예시 없음", columns: ["자산 ID", "대여 목적", "대여 기간", "인계 확인", "반납 상태", "다음 이용 가능일"],
  }),
  defineTemplate({
    id: "ops-software-inventory", title: "업무용 도구 소유·갱신 목록", description: "조직에서 쓰는 소프트웨어, 담당 팀, 계약·갱신 자료 위치를 관리합니다.", purpose: "개인 인증정보를 저장하지 않고 서비스 책임과 운영 상태만 보입니다.", icon: "🧰", category: "operations", tags: ["소프트웨어", "자산관리", "갱신"], source: source.companyHome,
    sections: [section("서비스 책임", "각 도구의 사업상 소유자와 기술 연락자를 지정하세요.", ["도구 이름과 업무 목적", "사업 책임자·기술 담당", "사용 팀과 주요 연동"]), section("사용·비용 맥락", "실제 사용 범위와 검토 자료를 연결하세요.", ["계약·주문·비용 문서 위치", "사용자 수의 추세 또는 확인 담당", "겹치는 도구와 이전 위험"]), section("갱신 준비", "갱신 시점 전에 계속 쓸 근거와 대안을 검토하세요.", ["계약상 주요 일정 출처", "갱신 결정권자와 검토 질문", "계정·자료 이전 필요성"])],
    tableTitle: "도구 현황", columns: ["도구", "업무 목적", "소유 팀", "계약 자료", "다음 검토일", "대체·이전 위험", "상태"],
  }),
  defineTemplate({
    id: "ops-change-readiness", title: "운영 변경 영향·준비 점검", description: "업무 흐름이나 도구 변경 전 영향 받는 역할과 안내·복구 계획을 정리합니다.", purpose: "변경 승인 하나로 끝내지 않고 실제 사용 준비와 안정화 확인까지 연결합니다.", icon: "🔀", category: "operations", tags: ["변경관리", "운영준비", "영향분석"], source: source.sop,
    sections: [section("변경 내용", "바뀌는 업무·도구와 바꾸지 않는 범위를 구분하세요.", ["현재 방식과 새 방식", "변경 이유·요청자", "실행 시점과 되돌릴 조건"]), section("영향 확인", "실제 수행자와 수신자가 겪을 변경을 살펴보세요.", ["영향 받는 팀·역할·외부 의존", "전환 중 수작업·중복 입력", "접근성·교육·지원 요구"]), section("출시 후 점검", "변경이 안정적으로 쓰이는지 관찰하고 조정합니다.", ["사전 시험과 결과", "문의 창구와 임시 복구 경로", "안정화 확인자·재검토 날짜"])],
    tableTitle: "영향·준비 항목", columns: ["영향 영역", "대상", "필요한 안내·작업", "담당자", "완료 기준", "상태"],
  }),
  defineTemplate({
    id: "ops-internal-service-intake", title: "내부 운영 요청 분류대", description: "시설·구매·계정·문서 등 내부 지원 요청을 유형별 담당자에게 연결합니다.", purpose: "요청자가 현재 상태와 다음 응답 시점을 알 수 있게 합니다.", icon: "📥", category: "operations", tags: ["요청관리", "내부지원", "분류"], source: source.companyHome,
    sections: [section("요청 내용", "요청자가 원하는 결과, 제약, 필요한 날짜를 짧게 적습니다.", ["요청 유형과 영향 업무", "희망 완료일과 이유", "이미 시도한 방법·참조 자료"]), section("분류·배정", "요청을 받은 뒤 담당자와 우선순위 근거를 지정하세요.", ["담당 팀·수신자", "긴급도 판단 근거와 미결 정보", "요청자에게 보낸 접수 안내"]), section("완료·재사용", "해결 방법과 지식 문서화 필요성을 확인하세요.", ["처리 결과와 완료 확인자", "반복 문의를 줄일 안내 문서", "재개방 사유와 다음 응답"])],
    tableTitle: "요청 인박스", columns: ["요청 ID", "유형", "요청 결과", "영향·기한", "담당자", "다음 응답", "상태"],
  }),
  defineTemplate({
    id: "ops-capacity-roster", title: "교대·현장 커버리지 계획", description: "시간대·역할별 필수 커버리지와 대체 담당을 조정합니다.", purpose: "개인 근무 일정 수집보다 업무에 필요한 역할 커버와 공백 해결에 초점을 둡니다.", icon: "🗓️", category: "operations", tags: ["용량", "교대", "커버리지"], source: source.company,
    sections: [section("운영 범위", "현장 운영 시간, 역할, 최소 인계 지점을 팀 기준으로 적으세요.", ["대상 기간과 업무 장소", "시간대별 필수 역할", "수요가 달라지는 요일·시즌"]), section("배치와 대체", "가능 인원과 필요한 기술 범위를 맞추세요.", ["역할별 배치자와 대체자", "교육·승인 조건 확인 담당", "휴식·중복 배치 확인 책임자"]), section("변경 대응", "결원이나 수요 변화에 대응할 연락 경로를 적습니다.", ["당일 변경 요청 방식", "대체 확보 우선순위", "기간 종료 후 과부하·공백 회고"])],
    tableTitle: "역할별 커버리지", columns: ["일자·시간대", "운영 역할", "필요 커버", "배치 상태", "대체 경로", "인계 메모"],
  }),
  defineTemplate({
    id: "ops-site-opening", title: "현장 개점·마감 인계표", description: "장소를 열고 닫을 때 필요한 환경 확인과 다음 담당자 인계를 기록합니다.", purpose: "조직의 자체 운영 기준을 문서화하며 공식 안전 점검을 대체하지 않습니다.", icon: "🚪", category: "operations", tags: ["현장운영", "체크리스트", "인계"], source: source.companyHome,
    sections: [section("시작 전 준비", "해당 장소에서 실제 필요한 준비 항목만 팀과 정하세요.", ["공간 사용 준비 상태", "작업 도구·비품 확인", "문제 발생 시 책임자 연락"]), section("운영 중 인계", "근무자 교대 시 미완료 작업과 현장 변화를 전달하세요.", ["진행 중 요청과 담당자", "비품 부족·장비 이상", "다음 교대에 알릴 변경 사항"]), section("마감 확인", "다음 사용자가 시작할 때 필요한 정보를 남기세요.", ["정리·보관 완료 확인", "문 잠금·장비 전원 등 자체 기준", "이상 징후와 조치 요청"])],
    tableTitle: "현장 루틴", columns: ["운영 단계", "확인 항목", "담당 역할", "확인 방법", "이상 시 연락", "완료 메모"],
  }),
  defineTemplate({
    id: "ops-evidence-index", title: "내부 점검 근거 자료 목록", description: "조직이 자체 점검하기로 한 운영 절차와 증빙 위치·소유자를 정리합니다.", purpose: "외부 규정의 충족 여부를 단정하지 않고 내부 검토에 필요한 자료를 찾기 쉽게 합니다.", icon: "🗃️", category: "operations", tags: ["근거자료", "점검", "문서색인"], source: source.docs,
    sections: [section("점검 질문", "무엇을 확인할지와 이 질문을 만든 내부 근거를 기록하세요.", ["운영 질문·소유 팀", "점검 범위와 기간", "확인 책임자와 승인 필요 여부"]), section("자료 위치", "최신 자료와 원본에 접근할 수 있는 경로를 연결하세요.", ["자료명·버전·소유자", "읽기 권한과 저장 위치", "자료가 없는 이유 또는 대체 근거"]), section("발견·후속", "자료 공백을 숨기지 않고 담당자와 재점검일을 정하세요.", ["확인된 사실과 추정 구분", "미해결 질문과 조치 소유자", "다음 자체 검토 날짜"])],
    tableTitle: "점검 자료 색인", columns: ["점검 질문", "자료·버전", "소유자", "위치", "검토 상태", "공백·후속", "재검토일"],
  }),
  defineTemplate({
    id: "ops-volunteer-activity-evidence", title: "자원봉사 활동 집계 기록", description: "프로그램별 봉사 활동의 역할 범위, 총 참여 시간, 결과 자료를 익명 집계로 연결합니다.", purpose: "봉사자 CRM이나 교대 일정표가 아니라 비영리 프로그램의 활동·성과 보고 근거를 보관합니다.", icon: "🕊️", category: "operations", tags: ["비영리", "자원봉사", "활동기록"], source: source.volunteerLog,
    sections: [section("활동 맥락", "프로그램과 활동의 목적, 운영 책임자를 적으세요.", ["프로그램 코드와 활동 날짜", "활동 목적·장소의 내부 자료", "프로그램 책임자와 검토자"]), section("참여 집계", "이름 대신 역할 집단과 합산 시간을 기록하세요.", ["역할 유형과 참여 인원 집계", "집계 방식·중복 참여 처리", "개인 연락처·민감정보 기재 금지"]), section("활동 결과", "수행한 일과 산출 증거를 연결하고 한계를 표시합니다.", ["활동 내용·산출물 위치", "확인 가능한 참여 시간 합계", "보고 대상·기간·누락 가능성"])],
    tableTitle: "활동별 집계 · 실명·수혜자 정보 없음", columns: ["프로그램 코드", "활동 날짜", "역할 집단", "참여 인원", "총 시간", "산출물 참조", "보고 기간"],
  }),
  defineTemplate({
    id: "ops-document-ownership", title: "업무 문서 오너·갱신 색인", description: "중요 운영 문서의 최신 버전, 독자, 유지 책임을 관리합니다.", purpose: "문서가 오래되었을 때 누구에게 확인할지와 어디가 기준본인지 명확히 합니다.", icon: "🗂️", category: "operations", tags: ["문서관리", "지식", "소유권"], source: source.docs,
    sections: [section("독자와 목적", "문서를 누가 언제 사용하는지 구체적으로 적으세요.", ["대표 독자와 업무 상황", "문서의 목적·제외 범위", "연결된 절차·양식"]), section("기준본 관리", "최신본 위치와 내용 변경 책임을 지정하세요.", ["원본 위치·버전", "문서 소유자와 대체 담당자", "내용 확인에 참여할 현장 사용자"]), section("갱신 신호", "정기 날짜 외에도 변화가 있을 때 업데이트하도록 계기를 둡니다.", ["업무·도구 변경 시 검토", "마지막 실사용 확인일", "폐기·병합 결정의 근거와 안내"])],
    tableTitle: "문서 책임 목록", columns: ["문서", "독자·목적", "기준본 위치", "소유자", "실사용 확인일", "갱신 신호", "상태"],
  }),
  defineTemplate({
    id: "ops-receiving-exceptions", title: "납품 불일치·반품 기록", description: "발주, 실제 수령, 검수 결과의 차이를 공급자와 내부 담당자에게 연결합니다.", purpose: "재고 수량을 단순 업데이트하는 일과 불일치 원인을 해결하는 일을 분리합니다.", icon: "📬", category: "operations", tags: ["입고", "납품", "반품"], source: source.purchasing,
    sections: [section("주문 참조", "주문 번호와 요청 품목·수량을 확인 가능한 문서에 연결하세요.", ["발주 참조와 품목 ID", "예정 수량·도착일", "납품 책임자와 현장 수신자"]), section("차이 확인", "실물과 문서 사이에서 관찰된 차이만 적으세요.", ["실제 수량·외관 상태", "부족·초과·오배송 구분", "검수 일시·확인자"]), section("수정·종결", "반품·추가 납품·정산 중 선택한 후속을 연결하세요.", ["공급자 응답·회수 일정", "재고·지급 기록 수정 담당", "요청자 완료 확인과 재발 패턴"])],
    tableTitle: "입고 차이표", columns: ["주문 참조", "품목 ID", "예정 수량", "실제 확인", "차이 유형", "공급자 조치", "종결일"],
  }),
  defineTemplate({
    id: "ops-travel-logistics", title: "출장 승인·현장 준비 기록", description: "출장 목적, 이동·숙박 준비, 현장 일정과 사후 자료를 연결합니다.", purpose: "여행 추천이나 경비 판단 대신 조직 내부 승인과 운영 준비를 기록합니다.", icon: "🧳", category: "operations", tags: ["출장", "일정", "준비"], source: source.company,
    sections: [section("출장 목적", "업무상 필요한 현장 결과와 참석자를 정리하세요.", ["방문 장소·업무 목적", "동행자와 현장 연락자", "원격 대안 검토 여부"]), section("이동·준비", "조직의 여행 절차와 승인 경로를 참조해 준비하세요.", ["승인 기록과 예약 담당", "이동·숙박 확인 자료 위치", "접근성·장비·시간대 고려"]), section("현장·정산 후속", "현장 결과와 비용 자료의 전달 책임을 남깁니다.", ["약속·결정·후속 담당자", "영수 자료의 보관 위치", "업무 공유와 종료 확인"])],
    tableTitle: "출장 일정 관리", columns: ["출장 ID", "목적·장소", "일정", "승인 상태", "현장 연락자", "예약 자료", "후속"],
  }),
  defineTemplate({
    id: "ops-cross-team-handoff", title: "팀 간 업무 인계 협약", description: "업무가 팀 경계를 넘을 때 수신 조건, 담당자, 완료 신호를 합의합니다.", purpose: "요청을 보낸 뒤 책임이 사라지는 구간을 드러내고 양쪽 팀의 기대를 조정합니다.", icon: "🔗", category: "operations", tags: ["팀간협업", "인계", "책임"], source: source.companyHome,
    sections: [section("인계 경계", "보내는 팀과 받는 팀이 각자의 책임 범위를 적으세요.", ["입력 자료와 품질 조건", "수신 확인 책임자", "요청을 되돌려야 하는 조건"]), section("응답 합의", "팀이 실제로 지킬 수 있는 응답 방식과 시간대를 정하세요.", ["접수 확인 방식", "정보가 부족할 때 질문 담당", "긴급 사안의 별도 연락 경로"]), section("완료 정의", "업무가 완료되었음을 양쪽이 확인할 신호를 선택하세요.", ["결과물·기록 위치", "요청자가 확인할 항목", "반복 지연 시 협의할 운영 변경"])],
    tableTitle: "인계 계약", columns: ["업무 유형", "보내는 팀", "받는 팀", "필수 입력", "접수 신호", "완료 신호", "예외 처리"],
  }),
  defineTemplate({
    id: "ops-metrics-dictionary", title: "운영 지표 정의 사전", description: "운영 보고에서 같은 단어가 서로 다른 수치로 쓰이는 일을 막는 정의표입니다.", purpose: "수치 목표를 정하지 않고 지표의 의미, 출처, 갱신 책임을 문서화합니다.", icon: "📐", category: "operations", tags: ["운영지표", "정의", "데이터"], source: source.kpi,
    sections: [section("정의와 목적", "지표가 답하려는 질문과 포함 범위를 먼저 적으세요.", ["지표명·의사결정 맥락", "분자·분모 또는 집계 기준", "포함·제외 사례"]), section("데이터 출처", "수치가 만들어지는 시스템과 갱신 책임을 연결하세요.", ["원천 자료와 접근 담당", "갱신 주기·시간 기준", "누락·중복 점검 방법"]), section("해석 한계", "수치만으로 판단할 수 없는 요소를 분명하게 남기세요.", ["대표적인 왜곡·편향 위험", "함께 살펴야 할 정성 맥락", "정의 변경 이력과 검토일"])],
    tableTitle: "지표 카탈로그", columns: ["지표명", "질문·목적", "정의", "원천", "갱신 책임", "한계", "버전"],
  }),
  defineTemplate({
    id: "ops-site-observation", title: "현장 관찰·개선 발견 기록", description: "업무 공간 방문 중 관찰한 환경·흐름과 후속 확인을 기록합니다.", purpose: "공식 인증 점검이나 법률상 검사 목록으로 오해하지 않도록 관찰과 판단을 구분합니다.", icon: "👀", category: "operations", tags: ["현장관찰", "개선", "후속"], source: source.afterSchool,
    sections: [section("관찰 맥락", "언제 어디서 어떤 작업을 보았는지 기록하세요.", ["방문 일시·공간", "관찰 대상 업무와 참석자 동의", "관찰 질문과 범위"]), section("사실과 영향", "평가보다 보인 행동·흐름과 이용자 영향을 적으세요.", ["실제 흐름과 대기·반복 작업", "작업자가 직접 설명한 어려움", "추정과 직접 관찰 구분"]), section("후속 제안", "작업자와 개선 아이디어를 확인하고 담당자를 정합니다.", ["작은 개선 실험", "필요한 승인·자원", "재방문·결과 확인 날짜"])],
    tableTitle: "관찰 및 조치", columns: ["관찰 날짜", "업무·공간", "확인 사실", "영향", "개선 아이디어", "협의자", "재확인일"],
  }),
  defineTemplate({
    id: "ops-handover-brief", title: "운영 당직 인수인계 브리프", description: "운영 담당이 교대할 때 현재 상태, 열린 이슈, 다음 확인 시점을 전달합니다.", purpose: "일반 회의록과 달리 진행 중인 운영 책임과 즉시 필요한 다음 행동에 집중합니다.", icon: "🔄", category: "operations", tags: ["당직", "인계", "상태"], source: source.companyHome,
    sections: [section("현재 상태", "인계 시점의 정상·주의·중단 상태를 사실대로 적으세요.", ["운영 상태와 마지막 확인 시각", "영향 범위와 진행 중 대응", "변경된 연락·담당 경로"]), section("열린 항목", "다음 담당자가 이어갈 일의 우선순위와 근거를 적습니다.", ["미완료 요청·외부 응답 대기", "다음 체크 시점", "지연·확대 시 연락할 사람"]), section("수신 확인", "새 담당자가 자료 접근과 책임 인수를 확인하도록 합니다.", ["필요한 대시보드·문서 링크", "중요한 예외 처리 지식", "인계받은 사람이 남긴 질문"])],
    tableTitle: "열린 운영 항목", columns: ["항목", "현재 상태", "다음 행동", "책임자", "기한·확인 시각", "영향", "인수 확인"],
  }),
  defineTemplate({
    id: "ops-operations-calendar", title: "반복 운영 주기 달력", description: "반복되는 마감·점검·갱신 업무와 사전 준비 시점을 한곳에 정리합니다.", purpose: "행사 일정표가 아니라 매주·매월 반복되는 운영 책임의 사전 알림 지도로 씁니다.", icon: "📅", category: "operations", tags: ["주기관리", "운영", "달력"], source: source.company,
    sections: [section("업무 주기", "반복 업무의 목적과 놓쳤을 때의 운영 영향을 설명하세요.", ["업무명과 반복 간격", "업무 소유자·대체자", "기한을 정한 내부 합의·출처"]), section("준비 선행", "마감 전에 필요한 자료와 의존 관계를 앞당겨 표시하세요.", ["필요 입력·승인", "외부 응답·다른 팀 의존", "예상 소요와 대체 진행 경로"]), section("완료 점검", "완료 후 실제 업무 부담과 일정 정확도를 조정하세요.", ["완료 기록 위치", "최근 누락·지연 원인", "다음 주기 수정 사항"])],
    tableTitle: "반복 업무 달력", columns: ["운영 업무", "주기", "다음 날짜", "소유자", "사전 준비", "완료 근거", "다음 검토"],
  }),
  defineTemplate({
    id: "ops-branch-handover", title: "지점·장소 책임자 교체 브리프", description: "현장 관리자가 바뀔 때 공간, 업체, 재고, 미결 요청을 구조적으로 넘깁니다.", purpose: "기억에 의존한 구두 인계를 줄이고 새 책임자가 먼저 확인할 항목을 정리합니다.", icon: "🏬", category: "operations", tags: ["지점운영", "관리자교체", "인계"], source: source.companyHome,
    sections: [section("장소 현황", "공간·장비와 지금 진행 중인 시설 이슈를 요약하세요.", ["공간·설비 현황과 자료 위치", "열린 작업·납품·수리", "다음 일정과 방문 예정자"]), section("운영 연락망", "실제 업무 상대와 지원 경로를 최신으로 확인하세요.", ["내부 책임자와 대체 연락자", "외부 공급자·건물 관리 연락 경로", "긴급도에 따른 내부 보고 경로"]), section("첫 주 확인", "새 책임자가 현장에서 직접 확인할 항목을 배치하세요.", ["재고·자산 상태 확인", "팀별 미결 요청 청취", "인계 완료 확인과 추가 질문"])],
    tableTitle: "장소 인계 목록", columns: ["영역", "현재 상태", "자료·연락처 위치", "기존 담당", "새 담당", "첫 확인일", "미결"],
  }),
  defineTemplate({
    id: "ops-service-provider-contact", title: "공급사 연락·에스컬레이션 지도", description: "서비스 종류에 따라 누구에게 어떤 증거와 함께 연락할지 정리합니다.", purpose: "응답 시간 약속을 만들어내지 않고 계약·합의된 연락 경로를 찾아가기 쉽게 합니다.", icon: "☎️", category: "operations", tags: ["공급업체", "연락망", "운영"], source: source.company,
    sections: [section("서비스 구분", "공급자와 계약 범위별로 담당 창구를 정리하세요.", ["서비스·계약 참조", "일상 문의와 긴급 문의 분기", "연락 가능한 시간·채널 출처"]), section("연락 시 준비", "공급자가 문제를 재현·확인할 수 있는 최소 정보를 준비하세요.", ["발생 시점과 영향", "요청 ID·관련 로그 위치", "이미 시도한 우회 조치"]), section("대체 경로", "응답 지연 시 조직 내 의사결정과 우회 경로를 확인하세요.", ["내부 서비스 소유자", "백업 공급 경로·임시 운영안", "계약 갱신 전 연락망 검토일"])],
    tableTitle: "연락 경로", columns: ["공급 서비스", "문의 유형", "공급자 창구", "연락 경로 출처", "내부 소유자", "대체 경로", "마지막 확인일"],
  }),
  defineTemplate({
    id: "ops-month-close", title: "월간 마감 준비·검토표", description: "기간 마감에 필요한 자료 수집, 대사, 검토, 보류 항목을 순서대로 관리합니다.", purpose: "회계 판단이나 세무 조언을 대신하지 않고 담당자와 근거 자료의 진행 상태를 추적합니다.", icon: "🧮", category: "finance", tags: ["마감", "회계운영", "체크리스트"], source: source.finance,
    sections: [section("기간과 책임", "조직의 자체 회계 일정과 책임자를 입력하세요.", ["마감 기간과 내부 일정 출처", "자료 제출·검토 담당자", "대체 담당과 연락 방법"]), section("자료·대사", "계정별 원본 자료와 검토 근거를 연결하세요.", ["은행·지출·청구 자료 링크", "대사 완료 여부와 차이", "미확인 항목의 소유자"]), section("검토·종결", "조정 사항과 다음 기간으로 넘길 항목을 기록하세요.", ["검토자 확인과 질문", "수정 근거·문서 위치", "마감 승인 상태와 다음 조치"])],
    tableTitle: "기간 마감 작업", columns: ["기간", "자료·계정 영역", "담당자", "근거 자료", "검토 상태", "차이·보류", "완료 확인"],
  }),
  defineTemplate({
    id: "ops-ap-intake", title: "매입 청구서 접수·승인대", description: "매입 청구서의 수신, 주문·수령 근거, 검토와 지급 준비 상태를 기록합니다.", purpose: "지급 지시를 실행하지 않고 문서 검토 책임과 누락 정보를 관리합니다.", icon: "📥", category: "finance", tags: ["매입", "청구서", "승인"], source: source.finance,
    sections: [section("접수 정보", "원본 문서 위치와 공급자 참조를 연결하세요.", ["수신일과 청구 참조 ID", "공급자·구매 요청 연결", "내부 제출자와 원본 위치"]), section("근거 검토", "주문·납품·승인 문서 사이의 일치 여부를 확인하세요.", ["주문 및 수령 확인 링크", "금액·기간 불일치 확인 담당", "수정 요청과 답변 상태"]), section("지급 준비 인계", "검토 완료 후 권한 있는 지급 담당자에게 상태를 넘기세요.", ["승인된 검토자와 기록", "지급 조건은 원본 문서에서 재확인", "미결 문서와 인계 일자"])],
    tableTitle: "청구서 접수 기록 · 계좌정보 기재 금지", columns: ["청구 참조 ID", "공급자", "수신일", "주문·수령 근거", "검토 담당", "불일치", "인계 상태"],
  }),
  defineTemplate({
    id: "ops-ar-followup", title: "미수 청구 후속 일정표", description: "발행한 청구의 전달, 문의, 약속된 후속 일정을 관리합니다.", purpose: "독촉 문구를 자동화하거나 채무 판단을 하지 않고 업무 연락과 확인 기록을 남깁니다.", icon: "📨", category: "finance", tags: ["매출채권", "청구", "후속"], source: source.finance,
    sections: [section("청구 확인", "청구 문서와 계약상 연락 창구를 원본에서 확인하세요.", ["청구 ID·발행일·통화", "수신자와 전달 확인", "변경·분쟁이 접수되었는지"]), section("연락 기록", "예의 있고 사실 중심의 연락과 응답을 기록하세요.", ["연락 날짜·채널·담당자", "고객이 전달한 지급 예상·질문", "내부 확인이 필요한 쟁점"]), section("후속 조정", "다음 연락과 내부 상향 검토를 책임자와 합의하세요.", ["합의한 다음 연락일", "청구 수정·지원 요청 소유자", "종결 조건과 자료 보관 위치"])],
    tableTitle: "청구 후속표 · 고객 개인정보 예시 없음", columns: ["청구 ID", "고객 코드", "발행일", "전달 상태", "최근 연락", "합의한 후속일", "내부 담당"],
  }),
  defineTemplate({
    id: "ops-budget-variance", title: "예산 변경·차이 설명 기록", description: "예산 대비 실제 지출 차이의 원인, 예상 지속 여부, 검토 결정을 정리합니다.", purpose: "자동 예산 조언 대신 소유자와 데이터 출처가 있는 설명을 남깁니다.", icon: "📊", category: "finance", tags: ["예산", "차이분석", "검토"], source: source.finance,
    sections: [section("기준 확인", "사용 중인 예산 버전과 실제 데이터 범위를 맞추세요.", ["예산 승인본과 기간", "실제 비용 데이터 출처", "조정·재분류 내역"]), section("차이 설명", "차이가 발생한 업무 사건과 반복 여부를 적으세요.", ["주요 원인과 문서 근거", "일회성·반복성 가설", "예상 영향과 불확실성"]), section("결정 기록", "추가 지출·계획 변경은 권한자 검토와 연결하세요.", ["검토자가 선택한 조치", "수정 예산 버전·승인 링크", "다음 재예측 또는 확인 시점"])],
    tableTitle: "예산 차이 검토", columns: ["기간·비용 영역", "예산 버전", "실제 자료", "차이 설명", "검토자", "결정·후속", "다음 확인"],
  }),
  defineTemplate({
    id: "ops-expense-reimbursement", title: "경비 정산 증빙 인계표", description: "지출 증빙의 제출과 검토 상태를 관리하는 기록입니다.", purpose: "세율이나 환급 기준을 제시하지 않고 조직이 정한 절차와 원본 증빙을 따릅니다.", icon: "🧾", category: "finance", tags: ["경비", "증빙", "정산"], source: source.finance,
    sections: [section("제출 준비", "조직에서 요구하는 항목과 제출 기한의 원본 출처를 연결하세요.", ["지출 업무 목적과 날짜", "영수 자료 보관 위치", "비용 코드·승인 참조"]), section("검토 기록", "금액 판단보다 자료 완전성과 업무 맥락을 확인하세요.", ["제출·검토 담당자", "누락·읽을 수 없는 증빙", "요청자에게 보낸 보완 요청"]), section("처리 인계", "지급·반려 결정과 기록 시스템을 연결하세요.", ["검토 결과와 승인 참조", "시스템 처리 상태 확인", "문서 보관·접근 검토"])],
    tableTitle: "정산 자료 상태 · 실명·카드정보 기록 금지", columns: ["가명 건 ID", "업무 목적", "지출일", "증빙 상태", "검토 담당", "보완 요청", "시스템 상태"],
  }),
  defineTemplate({
    id: "ops-cash-scenarios", title: "현금흐름 가정 기록지", description: "조직의 현금 수입·지출 계획에 사용된 가정과 확인 날짜를 비교합니다.", purpose: "개인 투자 조언이 아닌 내부 운영 예산 계획용으로 실제 데이터와 가정을 분리합니다.", icon: "💧", category: "finance", tags: ["현금흐름", "가정", "계획"], source: source.finance,
    sections: [section("계획 범위", "예측 기간, 기준 자료, 계획 소유자를 명시하세요.", ["계획 버전과 기간", "사용한 실제 잔액 자료 위치", "현금 계획 책임자"]), section("가정 구분", "확정된 입출금과 추정 항목을 눈에 띄게 나누세요.", ["예정 수입과 근거 문서", "반복·일회 지출의 출처", "지연·감소·증가 시나리오"]), section("민감도·갱신", "결과를 단정하지 않고 변화에 따른 재검토 조건을 기록하세요.", ["현금에 큰 영향을 주는 가정", "가정 확인 담당과 날짜", "변화가 생기면 다시 계산할 조건"])],
    tableTitle: "기간별 계획 가정", columns: ["기간", "입출금 항목", "확정·추정", "가정 근거", "변동 시나리오", "확인 담당", "갱신일"],
  }),
  defineTemplate({
    id: "ops-fixed-cost-review", title: "반복 비용 소유자 검토표", description: "매월·매년 반복되는 조직 비용의 목적, 소유자, 변경 근거를 검토합니다.", purpose: "비용 절감 권고가 아니라 유지·변경 질문과 결정 책임을 정리합니다.", icon: "🔁", category: "finance", tags: ["반복비용", "예산", "검토"], source: source.finance,
    sections: [section("비용 출처", "원본 청구·계약과 내부 비용 분류를 연결하세요.", ["반복 주기·문서 출처", "비용을 쓰는 팀·업무", "금액이 바뀐 이력"]), section("가치·대안 검토", "지출이 지원하는 업무와 사용 실태를 확인하세요.", ["현재 사용 사례·대상", "사용되지 않는 범위", "대체·축소 시 영향 질문"]), section("결정·갱신", "변경 권한자와 다음 검토 날짜를 기록하세요.", ["계속·조정·종료 검토 상태", "결정 근거·승인 기록", "공급자·내부 일정 후속"])],
    tableTitle: "반복 비용 목록", columns: ["비용 항목", "주기", "소유 팀", "사용 목적", "계약·청구 위치", "검토 결정", "다음 검토"],
  }),
  defineTemplate({
    id: "ops-subscription-renewals", title: "업무 구독 갱신 사전 검토대", description: "소프트웨어·콘텐츠 구독의 계약 종료 전 사용 현황과 갱신 책임을 확인합니다.", purpose: "무단 해지나 자동 결제를 막기 위해 계약 문서, 소유자, 자료 이전 필요성을 정리합니다.", icon: "🔔", category: "finance", tags: ["구독", "갱신", "비용관리"], source: source.finance,
    sections: [section("계약 기준", "계약 기간·갱신 방식은 원본 문서의 위치와 함께 적으세요.", ["계약명·공급자", "갱신·취소 일정의 문서 출처", "통화·청구 주기와 검토자"]), section("사용 가치", "누가 어떤 업무에 이용하는지 소유 부서와 함께 확인하세요.", ["최근 사용 범위 확인 방법", "업무 의존과 대체 도구", "겹치는 서비스·자료 이동 위험"]), section("갱신 결정", "권한자 검토와 공급자 연락 일정을 연결하세요.", ["계속·변경·종료 검토자", "결정 마감과 전달 담당", "접근·자료 종료 확인 책임"])],
    tableTitle: "구독 갱신 현황", columns: ["서비스", "소유 팀", "사용 목적", "계약 자료", "갱신 검토일", "결정 담당", "자료 이전 위험"],
  }),
  defineTemplate({
    id: "ops-payment-reconciliation", title: "지급·청구 대사 차이 기록", description: "내부 청구·지급 자료와 은행·결제 시스템 내역 사이 차이를 분류해 검토합니다.", purpose: "계좌 비밀정보나 지급 지시를 기록하지 않고 불일치 확인과 종결 상태만 관리합니다.", icon: "🧷", category: "finance", tags: ["대사", "지급", "불일치"], source: source.finance,
    sections: [section("비교 범위", "대사 기간, 원본 파일, 담당자를 기록하세요.", ["기간과 통화 범위", "자료 추출 경로와 일자", "검토 권한자"]), section("차이 분류", "예상 가능한 시차와 실제 오류 가능성을 분리하세요.", ["중복·누락·수수료·시차 구분", "금액 대신 내부 참조로 연결", "추가 원본 확인이 필요한 항목"]), section("종결 확인", "수정·재분류 결정과 승인 근거를 남기세요.", ["수정이 반영된 시스템 참조", "검토자가 확인한 날짜", "미결 잔여 항목의 소유자"])],
    tableTitle: "대사 차이", columns: ["내부 참조 ID", "자료 기간", "차이 유형", "원본 위치", "검토 담당", "조치 상태", "종결 확인"],
  }),
  defineTemplate({
    id: "ops-project-cost", title: "프로젝트 비용 근거표", description: "프로젝트 범위·기간별 비용 자료를 업무 결정과 연결합니다.", purpose: "회계 분류 기준을 정하지 않고 비용 원본, 배부 가정, 승인 변경을 정리합니다.", icon: "🧱", category: "finance", tags: ["프로젝트비용", "예산", "근거"], source: source.finance,
    sections: [section("범위 설정", "프로젝트 ID, 기간, 포함·제외 비용을 합의하세요.", ["승인된 프로젝트 범위", "예산 기준 버전", "공유 비용 처리 가정과 승인자"]), section("비용 근거", "비용 자료와 업무 소유자가 확인한 맥락을 연결하세요.", ["계약·구매·시간 자료 위치", "실제·예상·약정 상태 구분", "통화·기간·분류 기준"]), section("차이·결정", "변경 사유와 일정·범위 영향을 함께 기록하세요.", ["예산 차이 원인", "범위 변경과 승인 참조", "다음 비용 검토 시점"])],
    tableTitle: "프로젝트별 비용 근거", columns: ["프로젝트 ID", "기간", "비용 영역", "자료 위치", "실제·예상", "변경 근거", "검토자"],
  }),
  defineTemplate({
    id: "ops-payroll-reconciliation", title: "급여 처리 결과 검토 로그", description: "급여 시스템 결과의 집계·변경 건 검토 상태와 수정 확인을 관리합니다.", purpose: "개인 보상액을 복제하지 않고 접근 권한이 있는 담당자가 원본에서 검토하도록 연결합니다.", icon: "🔐", category: "finance", tags: ["급여", "검토", "접근제한"], source: source.payroll,
    sections: [section("검토 범위", "조직의 급여 처리 기간과 승인 일정 출처를 기록하세요.", ["대상 기간·처리 버전", "검토자와 대체 검토자", "원본 시스템·자료 위치"]), section("변경 건 확인", "입·퇴사·변경 자료의 반영 확인만 집계로 기록하세요.", ["가명 변경 건 ID", "예상 자료와 시스템 반영 상태", "차이 발생 시 수정 요청 경로"]), section("승인·기록", "완료 확인과 증빙을 권한 있는 공간에 연결하세요.", ["독립 검토 확인", "수정 반영 후 재검토", "접근 로그·보관 절차 담당자"])],
    tableTitle: "급여 결과 통제 · 개인 금액 입력 금지", columns: ["기간", "가명 변경 건", "예상 반영", "시스템 확인", "검토자", "수정 후 확인", "종결"],
  }),
  defineTemplate({
    id: "ops-grant-fund-stewardship", title: "지정 지원금 지출 구분대", description: "지원 목적별 예산, 승인, 지출 자료와 제한 사항 확인을 연결합니다.", purpose: "적격 비용이나 법률·세무 판단을 만들지 않고 지원 약정 원문과 기관 검토를 추적합니다.", icon: "🎗️", category: "finance", tags: ["비영리", "지원금", "재원관리"], source: source.nonprofitFundraising,
    sections: [section("재원 약정", "지원 문서에서 목적·기간·보고 약속을 발췌해 원문에 연결하세요.", ["지원금 내부 코드", "지원 약정·수정본 위치", "기관 내 책임자와 승인 경로"]), section("지출 연결", "지출 자료와 활동을 연결하고 목적 검토를 기록하세요.", ["예산 항목과 승인 참조", "지출 증빙·활동 자료 위치", "검토 중인 적격성 질문은 담당자에게 이관"]), section("잔액·보고", "잔액과 보고 산출 근거를 회계 원본에서 확인하세요.", ["기간 내 집계의 기준일", "보고 자료와 검토자", "사용 잔액·반환 등 미결 질문"])],
    tableTitle: "재원별 지출 근거", columns: ["재원 코드", "약정 기간", "지출 영역", "승인 참조", "증빙 위치", "검토 질문", "보고 상태"],
  }),
  defineTemplate({
    id: "ops-grant-report-pack", title: "지원금 결과 보고 자료 꾸러미", description: "지원자별 보고 항목, 제출 근거, 내부 검토와 전달 일정을 조율합니다.", purpose: "지원금 신청 기회를 영업 파이프라인처럼 관리하지 않고 약정 후 보고 행정에 집중합니다.", icon: "📚", category: "finance", tags: ["비영리", "보고", "증빙"], source: source.nonprofitFundraising,
    sections: [section("보고 기준", "보고 기간과 형식은 최신 약정·요청 문서에 연결하세요.", ["보고 주기와 제출 창구", "필수 항목의 출처 링크", "제출 책임자와 최종 검토자"]), section("성과 근거", "수치·사례·지출 증빙의 원본 담당을 구분합니다.", ["활동·산출 자료 소유자", "재무 수치 원본 링크", "표본·누락·정의 확인"]), section("작성·제출", "초안 검토와 제출 확인을 일정으로 나눕니다.", ["자료 요청과 내부 마감", "승인된 버전 위치", "제출 영수·수신 확인과 후속"])],
    tableTitle: "보고 항목·자료", columns: ["지원자 코드", "보고 항목", "근거 소유자", "자료 위치", "내부 검토", "제출 상태", "후속"],
  }),
  defineTemplate({
    id: "ops-donation-reconciliation", title: "후원 기록·입금 대사표", description: "후원 접수 기록과 실제 입금 내역의 연결·확인 상태를 관리합니다.", purpose: "세액 공제·영수증 자격을 단정하지 않고 단체가 사용하는 공식 재무 절차를 참조합니다.", icon: "💛", category: "finance", tags: ["비영리", "후원", "대사"], source: source.donations,
    sections: [section("접수 채널", "후원금이 접수된 채널과 시스템 기록 위치를 확인하세요.", ["채널·접수 기간", "중복 기록 점검 방법", "재무 담당자와 원본 위치"]), section("대사 확인", "입금 묶음과 후원 거래 식별자를 안전한 시스템에서 비교하세요.", ["정산 보고서 기준일", "미확인·환불·수수료 차이", "개별 후원자 정보를 여기에 복제하지 않기"]), section("후속 안내", "확인 완료와 문의 응대 책임을 지정하세요.", ["대사 완료 확인자", "후원 확인 안내 상태", "미결 금액·오류 검토와 보관"])],
    tableTitle: "채널별 대사 · 후원자 개인정보 없음", columns: ["기간", "채널", "가명 묶음 ID", "입금 자료", "미결 유형", "검토자", "종결 확인"],
  }),
  defineTemplate({
    id: "ops-capital-notices", title: "펀드 자금 통지 행정대장", description: "출자 납입·분배 통지의 문서 버전, 대상 범위, 수신과 확인 상태를 기록합니다.", purpose: "투자 권유나 계산 모델이 아닌 펀드 운영 문서 관리용입니다.", icon: "🏦", category: "finance", tags: ["펀드운영", "통지", "문서"], source: source.capital,
    sections: [section("통지 문서", "펀드 관리자 원본 공지와 기준 버전을 연결하세요.", ["통지 유형과 기간", "기준 문서·개정본 위치", "내부 작성·승인 책임자"]), section("수신·확인", "전달 대상 명단은 접근 제한된 원본 시스템을 참조하세요.", ["전달 배치 ID", "문서 수신·확인 상태", "개별 투자자 정보 복제 금지"]), section("기록 정합성", "최종 확인 결과와 후속 질문을 권한 있는 담당자에게 연결합니다.", ["금액·날짜는 원본에서 검증", "문의·정정 요청 담당", "완료 확인과 자료 보관 위치"])],
    tableTitle: "통지 행정 상태 · 계좌·투자자 실명 금지", columns: ["펀드 코드", "통지 유형", "문서 버전", "발송 묶음 ID", "수신 확인", "문의 담당", "종결일"],
  }),
  defineTemplate({
    id: "ops-cap-table-snapshot", title: "지분표 스냅샷 버전 보관대", description: "회사 승인 자료의 기준일, 파일 버전, 검토자와 차이 설명을 기록합니다.", purpose: "지분 계산·투자 조언을 제공하지 않고 승인된 자료가 무엇인지 추적합니다.", icon: "📸", category: "finance", tags: ["투자행정", "지분표", "버전관리"], source: source.investor,
    sections: [section("스냅샷 기준", "회사가 공유한 자료와 기준일을 명확히 연결하세요.", ["기준일과 자료 버전", "회사 측 제공·승인 담당", "접근 제한된 원본 위치"]), section("차이 검토", "이전 보관본과 달라진 부분은 회사 확인 없이 해석하지 마세요.", ["이전 버전과 변경 표시", "미확인 차이 질문", "외부 회계·법무 검토가 필요하면 담당자에게 전달"]), section("열람·갱신", "열람자, 목적, 다음 자료 요청 시점을 제한된 기록에 남기세요.", ["내부 열람 권한자", "요청·응답 이력", "만료·폐기 절차는 내부 정책 참조"])],
    tableTitle: "스냅샷 목록 · 개인 실명·수치는 예시 없음", columns: ["회사 코드", "기준일", "문서 버전", "원본 위치", "제공 확인", "차이 질문", "다음 확인"],
  }),
  defineTemplate({
    id: "ops-annual-assumptions", title: "연간 전략 가정·근거 장부", description: "연간 계획에 영향을 준 핵심 가정, 근거 수준, 재검토 신호를 기록합니다.", purpose: "숫자 목표 목록과 분리해 계획이 의존하는 믿음과 불확실성을 드러냅니다.", icon: "🧭", category: "strategy", tags: ["전략", "가정", "계획"], source: source.yearEnd,
    sections: [section("가정 수집", "조직이 무엇을 사실로 간주했는지 한 문장씩 적으세요.", ["고객·업무·역량·환경 가정", "가정이 영향을 주는 선택", "가정 소유자와 만든 날짜"]), section("근거 수준", "관찰, 추정, 외부 주장, 미확인을 구분하세요.", ["근거의 출처와 시점", "반대 사례·다른 해석", "아직 모르는 정보"]), section("검증 신호", "가정이 바뀌었다고 판단할 관찰과 검토 시점을 정하세요.", ["관찰 가능한 조기 신호", "검증 책임자·방법", "유지·수정·보류 결정 기록"])],
    tableTitle: "계획 가정", columns: ["가정", "영향 받는 선택", "근거·시점", "불확실성", "검증 신호", "소유자", "재검토일"],
  }),
  defineTemplate({
    id: "ops-strategy-charter", title: "전략 이니셔티브 결정 브리프", description: "큰 변화 제안이 어떤 전략 선택을 실행하는지와 비용·기회비용을 정리합니다.", purpose: "범용 프로젝트 보드가 아니라 조직 방향과의 연결·선택 이유를 검토하는 문서입니다.", icon: "🚩", category: "strategy", tags: ["전략", "이니셔티브", "선택"], source: source.company,
    sections: [section("전략 연결", "이니셔티브가 해결하려는 방향 문제와 현재 근거를 설명하세요.", ["전략 목표·가정과의 연결", "해결하려는 구체적 문제", "이 선택을 제안한 관찰"]), section("선택과 포기", "진행할 때 얻는 것과 의도적으로 미루는 것을 함께 적으세요.", ["성공으로 보일 사용자·조직 결과", "필요한 역량·예산·시간", "우선순위에서 밀리는 대안"]), section("검토 게이트", "중단·변경 여부를 다시 열어볼 시점과 신호를 정합니다.", ["초기 검증과 증거", "책임자·협의자·결정권자", "다음 전략 검토에서 답할 질문"])],
    tableTitle: "전략 선택 요약", columns: ["이니셔티브", "전략 연결", "기대 결과", "비용·기회비용", "근거", "결정자", "재검토 신호"],
  }),
  defineTemplate({
    id: "ops-quarterly-strategy-review", title: "분기 전략 가정 검토 세션", description: "분기말에 계획의 가정이 여전히 맞는지, 어떤 선택을 수정할지 검토합니다.", purpose: "진행 중 작업 목록을 보는 회의가 아니라 전략 선택의 근거와 변화 여부를 다룹니다.", icon: "🔭", category: "strategy", tags: ["분기검토", "전략", "회고"], source: source.okr,
    sections: [section("변화 감지", "지난 분기 이후 달라진 외부·내부 신호를 자료로 확인하세요.", ["핵심 가정의 최신 관찰", "기대와 달랐던 결과", "자료가 없거나 비교가 어려운 항목"]), section("선택 재검토", "계속할 선택, 수정할 선택, 중단 후보를 근거와 함께 토론하세요.", ["전략상 중요한 진전·지연", "새로운 의존성과 희생", "결정하지 않고 보류한 질문"]), section("결정 후속", "추가 분석보다 누가 언제 어떤 증거를 가져올지 정합니다.", ["수정한 전략 설명·버전", "결정 책임자와 영향을 받는 팀", "다음 분기 전 검증 날짜"])],
    tableTitle: "전략 질문·결정", columns: ["전략 주제", "이전 가정", "최근 증거", "해석 차이", "결정", "소유자", "다음 검증"],
  }),
  defineTemplate({
    id: "ops-strategy-decisions", title: "전략 선택·번복 기록부", description: "장기 영향을 주는 선택의 대안, 근거, 책임자와 다시 열 조건을 보존합니다.", purpose: "회의록과 달리 결정의 배경과 되돌릴 수 있는 조건에 집중합니다.", icon: "🪶", category: "strategy", tags: ["전략", "의사결정", "기록"], source: source.yearEnd,
    sections: [section("결정 질문", "결정해야 할 대상과 영향 받는 범위를 간결히 정의하세요.", ["결정 날짜와 결정자", "되돌리기 어려운 영향", "결정이 필요해진 이유"]), section("선택 근거", "검토한 선택지와 포기한 이유를 남기세요.", ["현 상태 유지 포함 대안", "판단에 사용한 근거·가정", "의견 불일치와 반대 증거"]), section("재검토 조건", "새 증거가 생기면 판단을 되돌릴 기준을 정하세요.", ["수정 결정을 촉발할 신호", "결정 만료·재검토 날짜", "후속 결과를 관찰할 책임자"])],
    tableTitle: "전략 결정 이력", columns: ["결정 ID", "질문", "선택·대안", "근거", "의견 차이", "결정자", "재검토 조건"],
  }),
  defineTemplate({
    id: "ops-scenario-planning", title: "전략 시나리오 비교 노트", description: "불확실한 미래 상황에 대비해 조직이 취할 수 있는 대응 선택지를 비교합니다.", purpose: "예측이나 투자 조언을 제시하지 않고 시나리오별 운영 선택과 관찰 신호를 정리합니다.", icon: "🌦️", category: "strategy", tags: ["시나리오", "불확실성", "계획"], source: source.finance,
    sections: [section("불확실성 정의", "조직의 결정에 영향을 주지만 아직 알기 어려운 변수를 고르세요.", ["불확실성 축과 출처", "변수가 영향을 주는 선택", "확정 사실과 가정을 분리"]), section("상황별 대응", "가능성을 단정하지 않고 여러 조건에서 작동할 대응을 검토하세요.", ["상황 묘사와 운영 영향", "각 경우에 유지할 핵심 역량", "선택 가능한 임시 조치"]), section("준비 신호", "시나리오를 현실과 연결할 관찰 지점을 정하세요.", ["조건이 달라졌다는 증거", "자료를 점검할 담당자", "대응안 재검토·훈련 일정"])],
    tableTitle: "상황별 대응", columns: ["시나리오", "가정", "운영 영향", "선택지", "관찰 신호", "책임자", "재검토일"],
  }),
  defineTemplate({
    id: "ops-strategy-signals", title: "전략 환경 신호 관찰일지", description: "계획의 핵심 가정과 연결되는 변화·반증 자료를 출처와 함께 보관합니다.", purpose: "뉴스 링크 모음이나 시장조사 보고서가 아니라 조직이 이미 선택한 전략 가정의 관찰 기록입니다.", icon: "📡", category: "strategy", tags: ["가정검증", "전략", "관찰"], source: source.kpi,
    sections: [section("전략 연결", "관찰이 어떤 기존 가정이나 결정과 관련되는지 표시하세요.", ["연결된 가정·결정 ID", "관찰된 변화와 날짜", "관찰 자료의 출처"]), section("확인과 반증", "유리한 증거뿐 아니라 가정과 맞지 않는 신호도 남기세요.", ["관찰 가능한 사실", "출처가 뒷받침하는 주장 범위", "반대 자료·대체 설명"]), section("대응 판단", "즉시 실행보다 추가 확인이 필요한지 먼저 결정하세요.", ["신호의 지속·일회 가능성", "추가 자료를 가져올 담당자", "전략 검토에 올릴 시점"])],
    tableTitle: "전략 신호", columns: ["관찰일", "연결 가정", "신호·사실", "출처", "반대 증거", "추가 확인자", "검토 회의"],
  }),
  defineTemplate({
    id: "ops-partnership-fit", title: "전략 제휴 적합성 검토표", description: "조직 간 제휴 아이디어의 목적, 상호 기여, 실험 조건을 합의합니다.", purpose: "투자 평가나 고객 CRM과 분리해 공동 활동을 시작할지 결정하는 전략 기록입니다.", icon: "🫱🏻‍🫲🏽", category: "strategy", tags: ["제휴", "협력", "전략"], source: source.company,
    sections: [section("공동 목적", "각 조직이 함께 해결하려는 문제와 상대의 목표를 적으세요.", ["함께 만들 사용자·공공 가치", "각 조직이 제안한 목적", "불일치하는 기대"]), section("기여와 의존", "양쪽이 실제로 제공할 역량·시간·접근을 구체화하세요.", ["우리 조직의 약속과 소유자", "상대 조직의 확인된 기여", "브랜드·데이터·운영 의존 질문"]), section("작은 실험", "큰 약정 전에 기간·성공 신호·종료 조건을 정합니다.", ["실험의 범위와 참여자", "성공·실패를 판단할 증거", "결과 검토·중단·확장 결정자"])],
    tableTitle: "제휴 검토", columns: ["제휴 주제", "공동 목적", "상호 기여", "주요 의존", "실험 범위", "결정자", "검토일"],
  }),
  defineTemplate({
    id: "ops-theory-of-change", title: "비영리 변화 경로 캔버스", description: "활동에서 장기 변화까지 조직이 기대하는 연결과 전제 조건을 설명합니다.", purpose: "효과를 보장하거나 인과를 증명한다고 주장하지 않고 검증할 가정을 드러냅니다.", icon: "🌍", category: "strategy", tags: ["비영리", "임팩트", "이론"], source: source.afterSchool,
    sections: [section("문제와 대상", "함께 정의한 문제와 영향을 받는 공동체의 관점을 적으세요.", ["문제 맥락과 자료 출처", "함께 설계한 사람·집단", "현재 접근에서 빠진 목소리"]), section("변화 경로", "활동, 직접 산출, 단기·장기 변화를 구분하세요.", ["우리가 제공할 활동", "기대하는 가까운 변화", "장기 변화로 이어지는 가정"]), section("검증과 책임", "어떤 결과를 누구와 확인하고 계획을 어떻게 바꿀지 정합니다.", ["관찰할 변화와 자료 출처", "해석을 함께 검토할 공동체", "부정적 영향·예상 밖 결과와 대응"])],
    tableTitle: "변화 경로 구성요소", columns: ["문제·대상", "활동", "직접 산출", "단기 변화", "장기 변화 가정", "검증 근거", "공동 검토자"],
  }),
  defineTemplate({
    id: "ops-impact-indicators", title: "비영리 성과 지표 정의 사전", description: "프로그램 결과를 관찰할 지표, 정의, 자료 수집 부담, 해석 한계를 합의합니다.", purpose: "임팩트 수치를 자체 인증하거나 사람의 가치를 점수화하지 않는 측정 설계 문서입니다.", icon: "📏", category: "strategy", tags: ["비영리", "성과측정", "지표"], source: source.nonprofitFundraising,
    sections: [section("측정 질문", "지표가 프로그램의 어떤 변화 질문에 답하는지 적으세요.", ["프로그램·변화 경로 연결", "지표 선택에 참여한 사람", "자료로 답할 수 없는 질문"]), section("정의와 자료", "분모·기간·수집 주체를 정의하고 부담을 살피세요.", ["지표 산식 또는 질적 관찰 방식", "자료 출처·수집 주기", "참여자 동의·비식별 고려"]), section("해석 한계", "숫자의 왜곡과 예상 밖 영향을 정기적으로 점검하세요.", ["누락·표본 편향·인과 추론 한계", "공동체와 결과 해석 방식", "지표 변경 기준과 다음 검토일"])],
    tableTitle: "변화 지표 카탈로그", columns: ["프로그램", "측정 질문", "지표 정의", "자료·주기", "수집 책임", "해석 한계", "검토일"],
  }),
  defineTemplate({
    id: "ops-board-governance-roster", title: "이사회 임기·위원회 행정대장", description: "비영리 이사회 구성원의 공개된 역할, 임기 일정, 위원회 인계를 관리합니다.", purpose: "선임 자격이나 법정 정족수를 추정하지 않고 조직 정관·공식 기록을 확인하기 쉽게 합니다.", icon: "🏛️", category: "strategy", tags: ["비영리", "이사회", "거버넌스"], source: source.board,
    sections: [section("공식 기준", "정관·의결 기록 등 조직이 승인한 기준 문서를 연결하세요.", ["기준 문서 버전과 소유자", "현재 조직 구조·위원회", "외부 법률·규정 질문의 담당자"]), section("임기·역할", "기록이 허용된 역할과 일정만 내부 자료에서 확인하세요.", ["역할·위원회와 시작·종료 일정", "의결로 정한 변경 기록", "개인 연락처는 권한 있는 원본에 보관"]), section("인계 준비", "임기 변경이 다가오면 자료·책임의 전환을 계획하세요.", ["차기 담당자 확인 경로", "진행 중 의사결정·약정", "공식 회의록 업데이트 확인"])],
    tableTitle: "역할·임기 현황 · 개인 민감정보 없음", columns: ["역할 코드", "위원회", "임기 일정", "기준 의결 링크", "인계 예정", "확인 담당", "갱신일"],
  }),
  defineTemplate({
    id: "ops-board-packet", title: "이사회 자료·결정 후속 패킷", description: "이사회에 배포할 사전 자료, 결정 질문, 확정된 후속 책임을 관리합니다.", purpose: "일반 회의록을 복제하지 않고 의사결정에 필요한 검토 자료와 공식 후속 확인을 연결합니다.", icon: "📂", category: "strategy", tags: ["이사회", "의사결정", "비영리"], source: source.board,
    sections: [section("사전 자료", "각 안건의 결정 질문, 읽을 자료, 자료 소유자를 표시하세요.", ["자료 제목·버전·읽기 링크", "자료를 만든 책임자", "검토에 필요한 선택지·질문"]), section("결정 기록", "공식 의결과 논의 중인 질문을 구분해 적으세요.", ["결정 문구와 승인된 회의록 링크", "추가 정보 요청·보류 안건", "후속 논의가 필요한 날짜"]), section("후속 추적", "결정에서 파생된 업무와 다음 보고 시점을 연결하세요.", ["책임자·완료 신호", "외부 약속·예산과의 연결", "완료 여부를 확인할 담당자"])],
    tableTitle: "안건·후속 목록", columns: ["안건", "결정 질문", "사전 자료", "결정 상태", "후속 책임자", "예정일", "공식 기록"],
  }),
  defineTemplate({
    id: "ops-diligence-evidence-index", title: "투자 검토 요청·자료 응답 인덱스", description: "투자 검토 과정에서 요청한 자료, 회사 측 응답, 검토자와 미결 질문을 추적합니다.", purpose: "투자 추천이나 기업 점수표가 아닌 비공개 자료 접근을 제한하는 행정 색인입니다.", icon: "🗄️", category: "strategy", tags: ["투자행정", "자료실", "실사"], source: source.diligence,
    sections: [section("요청 통제", "요청 목적과 내부 승인된 접근 범위를 먼저 확인하세요.", ["가명 회사 코드와 검토 책임자", "자료 요청 승인·목적 기록", "민감 파일의 접근 권한 담당"]), section("자료 응답", "요청·응답 버전을 보관 위치와 함께 기록하세요.", ["요청 항목과 날짜", "회사 측 응답·버전·범위", "누락·대체 자료·후속 질문"]), section("검토 종료", "자료 접근 회수와 검토 종료 상태를 확인하세요.", ["내부 검토 담당자와 열린 질문", "결정은 별도 공식 기록과 연결", "보관·삭제는 조직 절차 책임자 확인"])],
    tableTitle: "자료 요청·응답 · 실데이터 미포함", columns: ["회사 코드", "요청 항목", "요청 승인자", "응답 버전", "접근 담당", "미결 질문", "종료 확인"],
  }),
  defineTemplate({
    id: "ops-portfolio-report-cycle", title: "투자 후 포트폴리오 자료 요청 주기표", description: "투자 이후 정기 자료 요청의 범위, 수신 확인, 질문과 다음 보고 기간을 관리합니다.", purpose: "투자 전 실사 자료실과 분리된 투자 후 운영 행정으로, 점수화나 투자 조언 없이 자료 흐름을 정리합니다.", icon: "📬", category: "strategy", tags: ["투자행정", "포트폴리오", "자료요청"], source: source.portfolio,
    sections: [section("요청 범위", "조직이 합의한 보고 항목, 기간, 접근 권한을 확인하세요.", ["요청 목적·보고 기간", "필수·선택 자료와 정의", "회사별 접근 소유자"]), section("수신·질문", "제출 버전과 보완 질문을 구분하고 응답 책임자를 지정하세요.", ["요청일·수신일·자료 버전", "누락·정의 변경·시차 질문", "회사 측 설명을 확인한 담당자"]), section("검토와 다음 주기", "자료를 해석하기 전에 맥락을 확인하고 다음 요청을 조정하세요.", ["자료 범위·비교 가능성의 한계", "후속 논의와 책임자", "다음 기간에 유지·수정할 요청 항목"])],
    tableTitle: "보고 주기 현황 · 실데이터 없음", columns: ["회사 코드", "보고 기간", "요청 패킷", "수신 버전", "열린 질문", "내부 담당", "다음 주기"],
  }),
];
