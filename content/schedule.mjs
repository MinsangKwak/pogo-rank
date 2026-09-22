// ─────────────────────────────────────────────────────────────────────────────
// content/schedule.mjs — 손으로 적는 월 일정표
//
// 2026-09-22 v5 Phase 1: frontend/scripts/components/schedule.js 의 **표 선언 부분만** 옮겨 왔다.
// 그 파일은 표 선언과 달력 그리는 코드가 한 덩이라, 데이터를 꺼내려고 extract-data.mjs 가
// `const SCHEDULE_ITEMS` 앞에서 잘라 VM 으로 돌리고 있었다 — 화면 코드가 자료의 집이면
// 그 화면을 지울 수 없다. 이제 자료가 제 집을 가진다.
//
// 아래 원본 주석은 그대로 둔다 — 갱신 규칙과 출처가 적혀 있다.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 월 일정표 달력 (드로어 미리보기 · 전체 페이지 공용)
//
// 무엇을 보여주나
//   - 한 달치 달력 그리드. 각 날짜 칸에는 그날 진행 중인 일정의 분류를 색 점(dot)으로 찍는다.
//   - 날짜를 누르면 그 아래 상세 영역에 "그날 걸쳐 있는 일정"만 전부 펼쳐 보여준다.
//   - 드로어가 접혀 있어도 보이는 "오늘 일정 한 줄" 요약(#schedule-today)도 여기서 채운다.
//
// 어떤 데이터를 읽나
//   - SCHEDULE_MONTHS: 이 파일 안에 하드코딩된 달별 일정. 서버·API에서 받아오지 않는다.
//     2026-09-07 v2.13.0 (QA-20) 달 하나만 담던 SCHEDULE_YM·SCHEDULE_ITEMS 를 'YYYY-MM' 키의 달별 묶음으로 바꿨다.
//       로드 시 오늘이 속한 달을 골라 SCHEDULE_YM·SCHEDULE_ITEMS 에 넣으므로 소비자(max.js·pages.js)는 그대로다.
//       오늘 달 데이터가 없으면 가장 가까운 과거 달로 폴백한다 (제목이 "N월 일정표"라 지난 달임이 드러난다).
//     ★ 갱신 프로세스: 매달 SCHEDULE_MONTHS 에 새 달 키 하나를 추가하고 확정 일정을 적는다. 지난 달은 기록으로 남긴다.
//     출처는 LeekDuck(ScrapedDuck) 원본 데이터 + 포켓몬고 공식 한국 발표를 합쳐 재구성한 것이며,
//     시간은 모두 한국 시간(KST) 기준이다.
//   - SCHEDULE_CATS: 분류별 표시 이름과 점 색상. 달력 점·범례·상세 줄이 모두 이 색을 쓴다.
//
// 제공하는 전역
//   - SCHEDULE_MONTHS  : 달별 일정 { 'YYYY-MM': { ym, note, items } }
//   - SCHEDULE_YM      : 지금 보여 주는 달의 연·월 ({ y, m }). max.js·pages.js도 함께 쓴다.
//   - SCHEDULE_NOTE    : 그 달의 수집 출처·미확정 안내 문구 (달력 아래 각주)
//   - SCHEDULE_CATS    : 분류 정의(범례). pages.js의 분류별 목록이 함께 쓴다.
//   - SCHEDULE_ITEMS   : 지금 보여 주는 달의 일정 배열. max.js가 D-MAX 보스 주차를 찾을 때도 쓴다.
//   - pickScheduleMonth: 오늘 기준으로 보여 줄 달을 고른다 (없으면 가장 가까운 과거 달)
//   - scheduleFiltered(cat) · scheduleItemsOn(day, cat) : 분류 필터 · 특정 일(day)에 걸쳐 있는 일정 추출
//   - renderScheduleDetail / renderSchedule / buildScheduleCal(cat) / buildScheduleTimeline(cat) (v2.13.1 기간 막대)
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-02 9월 일정표 달력: 달력 그리드 + 날짜 탭 상세 + 접힘 상태 오늘 일정 한 줄
// 일정 데이터: s/e는 일(day of month), cat은 범례 분류

// 분류(cat) → 범례 이름 + 점 색상. 값은 CSS 타입 색 변수를 그대로 재사용한다.
//   event  이벤트 전반          → 불꽃색
//   raid5  5성 레이드 보스      → 드래곤색
//   mega   메가 레이드 보스     → 에스퍼색
//   dmax   다이맥스 보스 주차   → 물색  (max.js가 t 속성과 함께 "이번 주 보스"로 읽는다)
//   hour   시간제 이벤트(18시)  → 전기색 (레이드 아워 · 스포트라이트 아워)
//   shadow 주말 섀도우 레이드   → 악색
// 2026-09-07 v2.13.1 type: 색의 원천인 타입 키 — 일정 페이지의 분류 칩(chips())이 같은 색 점을 찍는 데 쓴다
export const SCHEDULE_CATS = {
  event: { name: '이벤트', color: 'var(--t-fire)', type: 'fire' },
  raid5: { name: '5성', color: 'var(--t-dragon)', type: 'dragon' },
  mega: { name: '메가', color: 'var(--t-psychic)', type: 'psychic' },
  dmax: { name: 'D-MAX', color: 'var(--t-water)', type: 'water' },
  hour: { name: '아워(18시)', color: 'var(--t-electric)', type: 'electric' },
  shadow: { name: '섀도우(주말)', color: 'var(--t-dark)', type: 'dark' },
};

// 일정 한 건의 모양: { s: 시작일, e: 종료일, cat: 분류, label: 표시 문구, t?: 타입키 }
//   s·e는 "이 달의 몇 일"이며 양끝 포함(inclusive)이다. 달을 넘기는 일정은 이 달 안에서 끊어 적는다.
//   t는 dmax 분류에만 붙는 보스 속성 키로, max.js가 이번 주 보스 카드를 만들 때 쓴다.
// ※ 사용자에게 그대로 보이는 실제 일정이므로 날짜·문구를 임의로 고치지 않는다.
// 달별 일정. 키는 'YYYY-MM'. 새 달이 오면 키 하나를 추가하고 확정 일정을 적는다 (지난 달은 기록으로 유지)
//   ym    그 달의 연·월
//   note  달력 아래 각주 — 수집일·출처, 아직 발표되지 않은 로테이션 안내
//   items 일정 배열 (모양은 위 설명과 같다)
export const SCHEDULE_MONTHS = {
  '2026-09': {
    ym: { y: 2026, m: 9 },
    note: '출처: LeekDuck 원본 데이터 + 포켓몬고 공식 한국 발표 (2026-09-02 수집, 한국 시간 기준). 스포트라이트 아워는 2026년부터 목요일.',
    items: [
      // 2026-09-02 LeekDuck(ScrapedDuck) 원본 데이터 기준 재구성, KST/현지시간
      { s: 1, e: 4, cat: 'event', label: '메가 어센션 (~9/4 23:59)' },
      { s: 1, e: 6, cat: 'event', label: '메가 피날레 특별 기간: 데일리 디스커버리·맥스 먼데이 휴식, 이벤트 레이드 진행 (8/31~9/6)' },
      { s: 5, e: 6, cat: 'event', label: 'GO Fest 2026: 메가 피날레 (10–18시)' },
      { s: 8, e: 8, cat: 'event', label: '새 시즌 시작: 황혼의 길 (Twilight Trails)' },
      { s: 8, e: 14, cat: 'event', label: '메가 스쿼드 (9/8 10시 ~ 9/14 20시)' },
      { s: 12, e: 12, cat: 'event', label: '커뮤데이 클래식: 딥상어동 14–17시 (한카리아스 — 대지의힘)' },
      { s: 16, e: 22, cat: 'event', label: '미공개 이벤트 (9/16 10시 ~ 9/22 20시)' },
      { s: 19, e: 19, cat: 'event', label: '찌르호크 슈퍼 메가 레이드 데이 14–17시' },
      { s: 26, e: 26, cat: 'event', label: '캐치 마스터리: 나목령 10–20시' },
      { s: 18, e: 30, cat: 'event', label: '피카츄의 가을 소풍 (9/18~10/11 · 서울 종로·중구, 인천공항 한정)' },
      { s: 23, e: 27, cat: 'event', label: '달맞이댄스: 야생 삐삐 대량 등장 (한국 포함 아시아 한정, 9/23 10시~9/27)' },
      { s: 24, e: 26, cat: 'event', label: '2026 피카츄의 한국 나들이 (전국, 9/24 10시~9/26 20시)' },
      { s: 29, e: 30, cat: 'event', label: '수확 축제: 과사삭벌레 모으기 (9/29 10시 ~ 10/5 20시)', source: 'https://pokemongo.com/ko/news/harvest-festival-2026' },
      { s: 7, e: 8, cat: 'raid5', label: '레지락 · 레지아이스 · 레지스틸 (특별 기간 종료 후 막차, ~9/8 22시)' },
      { s: 5, e: 6, cat: 'raid5', label: '아머드 뮤츠 (GO Fest 한정)' },
      { s: 9, e: 15, cat: 'raid5', label: '자시안 (역전의 용사)' },
      { s: 16, e: 22, cat: 'raid5', label: '자마젠타 (역전의 용사)' },
      { s: 23, e: 29, cat: 'raid5', label: '울트라비스트 — 한국(아시아·태평양): 전수목' },
      { s: 30, e: 30, cat: 'raid5', label: '제르네아스 (9/30~10/6)' },
      { s: 1, e: 8, cat: 'mega', label: '메가 갸라도스 (~9/8 22시)' },
      { s: 8, e: 15, cat: 'mega', label: '메가 독침붕' },
      { s: 11, e: 15, cat: 'mega', label: '메가 헬가' },
      { s: 16, e: 22, cat: 'mega', label: '메가 이상해꽃' },
      { s: 23, e: 29, cat: 'mega', label: '메가 칼라마네로' },
      { s: 30, e: 30, cat: 'mega', label: '메가 우츠보트 (9/30~10/6)' },
      { s: 7, e: 13, cat: 'dmax', label: 'D-MAX 랄토스 (맥스 먼데이 9/7 06–21시)', t: 'psychic' },
      { s: 14, e: 20, cat: 'dmax', label: 'D-MAX 뿔카노 (맥스 먼데이 9/14)', t: 'ground' },
      { s: 21, e: 27, cat: 'dmax', label: 'D-MAX 프리져 · 썬더 · 파이어 (맥스 먼데이 9/21)', t: 'ice' },
      { s: 28, e: 30, cat: 'dmax', label: 'D-MAX 울머기 (맥스 먼데이 9/28)', t: 'water' },
      { s: 1, e: 8, cat: 'shadow', label: '주말 섀도우 레이드: 기라티나 (어나더폼, ~9/8)' },
      { s: 9, e: 30, cat: 'shadow', label: '주말 섀도우 레이드: 볼트로스 (화신폼, 9/9~10/6)' },
      { s: 2, e: 2, cat: 'hour', label: '레이드 아워 (특별 기간 — 이벤트 레이드 위주)' },
      { s: 9, e: 9, cat: 'hour', label: '레이드 아워: 자시안' },
      { s: 16, e: 16, cat: 'hour', label: '레이드 아워: 자마젠타' },
      { s: 23, e: 23, cat: 'hour', label: '레이드 아워: 울트라비스트 (한국: 전수목)' },
      { s: 30, e: 30, cat: 'hour', label: '레이드 아워: 제르네아스' },
      { s: 10, e: 10, cat: 'hour', label: '스포트라이트(목): 뿔충이·딱충이·독침붕 — 교환 사탕 2배' },
      { s: 13, e: 13, cat: 'hour', label: '스포트라이트 특별편(일): 델빌·헬가 — 교환 사탕 2배' },
      { s: 17, e: 17, cat: 'hour', label: '스포트라이트(목): 미공개 — 포획 별의모래 2배' },
      { s: 24, e: 24, cat: 'hour', label: '스포트라이트(목): 꼬렛 — 진화 XP 2배' },
    ],
  },
  '2026-10': {
    ym: { y: 2026, m: 10 },
    // 2026-09-07 v2.13.0 (QA-20) 9월 발표분에서 10월로 넘어가는 확정 일정만 먼저 등재. 10/6 이후 로테이션(5성·메가·D-MAX·스포트라이트)은
    // 대략 9월 말 발표되므로 발표 뒤 이 배열을 채운다
    note: '공식 한국 공지 확인: 2026-09-20 · 한국시간 기준. 확인된 일정만 수록했으며, 세부 내용 미발표 행사는 날짜만 확정된 상태예요. 미등재 일정은 추후 공지 확인이 필요해요.',
    items: [
      { s: 1, e: 5, cat: 'event', label: '수확 축제: 과사삭벌레 모으기 (9/29 10시 ~ 10/5 20시)', source: 'https://pokemongo.com/ko/news/harvest-festival-2026' },
      { s: 1, e: 11, cat: 'event', label: '피카츄의 가을 소풍 (9/18~10/11 · 서울 종로·중구, 인천공항 한정)' },
      { s: 2, e: 5, cat: 'event', label: '수확 축제: 점령 (10/2 00시 ~ 10/5 20시 · 그림자 제크로무)', source: 'https://pokemongo.com/ko/news/harvest-festival-tgr-2026' },
      { s: 3, e: 3, cat: 'event', label: '거다이맥스 에이스번 맥스배틀 데이 (14–17시)', source: 'https://pokemongo.com/ko/news/gigantamax-cinderace-max-battle-day-2026' },
      { s: 10, e: 10, cat: 'event', label: '조로아 커뮤니티 데이 (14–17시)', source: 'https://pokemongo.com/ko/news/communityday-october-2026-zorua' },
      { s: 17, e: 17, cat: 'event', label: '부화데이 (날짜 확정 · 세부 내용 미발표)', source: 'https://pokemongo.com/ko/news/save-the-date-s24' },
      { s: 24, e: 24, cat: 'event', label: '맥스배틀 데이 (날짜 확정 · 세부 내용 미발표)', source: 'https://pokemongo.com/ko/news/save-the-date-s24' },
      { s: 31, e: 31, cat: 'event', label: '슈퍼 메가 레이드 데이 (날짜 확정 · 세부 내용 미발표)', source: 'https://pokemongo.com/ko/news/save-the-date-s24' },
      { s: 1, e: 6, cat: 'raid5', label: '제르네아스 (9/30~10/6)' },
      { s: 1, e: 6, cat: 'mega', label: '메가 우츠보트 (9/30~10/6)' },
      { s: 1, e: 4, cat: 'dmax', label: 'D-MAX 울머기 (맥스 먼데이 9/28 주차, ~10/4)', t: 'water' },
      { s: 1, e: 6, cat: 'shadow', label: '주말 섀도우 레이드: 볼트로스 (화신폼, 9/9~10/6)' },
    ],
  },
};

// 오늘 기준으로 보여 줄 달을 고른다.
//   1) 오늘이 속한 달 → 2) 없으면 오늘보다 앞선 달 중 가장 늦은 달 → 3) 그것도 없으면 등재된 첫 달
// 미래 달로는 가지 않는다 — 다음 달 일정은 이번 달 달력이 끝난 뒤에 자연히 나타난다.
