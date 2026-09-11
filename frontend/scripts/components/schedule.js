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
const SCHEDULE_CATS = {
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
const SCHEDULE_MONTHS = {
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
      { s: 29, e: 30, cat: 'event', label: '수확 축제 (9/29 10시 ~ 10/5 20시)' },
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
    note: '출처: 포켓몬고 공식 한국 발표 (2026-09-07 수집, 한국 시간 기준). 10/6 이후 레이드·맥스 배틀 로테이션은 아직 발표 전 — 발표되면 추가돼요.',
    items: [
      { s: 1, e: 5, cat: 'event', label: '수확 축제 (9/29 10시 ~ 10/5 20시)' },
      { s: 1, e: 11, cat: 'event', label: '피카츄의 가을 소풍 (9/18~10/11 · 서울 종로·중구, 인천공항 한정)' },
      { s: 10, e: 10, cat: 'event', label: '커뮤니티 데이 (10/10 14–17시, 포켓몬 미발표)' },
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
function pickScheduleMonth(today = new Date()) {
  const keys = Object.keys(SCHEDULE_MONTHS).sort();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (SCHEDULE_MONTHS[todayKey]) return SCHEDULE_MONTHS[todayKey];
  const past = keys.filter((key) => key < todayKey);
  return SCHEDULE_MONTHS[past.length ? past[past.length - 1] : keys[0]];
}
const SCHEDULE_MONTH = pickScheduleMonth();
const SCHEDULE_YM = SCHEDULE_MONTH.ym;
const SCHEDULE_NOTE = SCHEDULE_MONTH.note;
const SCHEDULE_ITEMS = SCHEDULE_MONTH.items;

// 2026-09-07 v2.13.1 분류 필터 — cat 이 'all'/빈 값이면 전부, 아니면 그 분류만
function scheduleFiltered(cat) {
  return !cat || cat === 'all' ? SCHEDULE_ITEMS : SCHEDULE_ITEMS.filter(item => item.cat === cat);
}

// 주어진 일(day)에 "걸쳐 있는" 일정만 골라낸다.
// 하루짜리든 여러 날짜에 걸친 기간이든 s ≤ day ≤ e 로 똑같이 판정한다.
function scheduleItemsOn(day, cat) {
  return scheduleFiltered(cat).filter(item => day >= item.s && day <= item.e);
}

// 2026-09-07 v2.13.1 기간 막대 타임라인 (일정 페이지 전용 — 드로어 폭에는 31칸이 안 들어간다)
// 한 줄 = 일정 하나. 시작일~종료일을 그 분류 색 막대로 잇고, 위에는 날짜 눈금(주말 음영·오늘 세로선)을 둔다.
// 막대 위치는 (s-1)/일수, 폭은 (e-s+1)/일수 의 백분율이라 화면 폭이 달라도 그대로 맞는다.
// 라벨은 막대 시작점에 붙이되, 시작이 달 후반(60% 이후)이면 막대 끝에 오른쪽 정렬해 잘리지 않게 한다.
function buildScheduleTimeline(cat) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === SCHEDULE_YM.y && today.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDayOfMonth = isCurrentMonth ? today.getDate() : 0;
  const lastDayOfMonth = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m, 0).getDate();
  const pct = (day) => `${(day - 1) / lastDayOfMonth * 100}%`;
  const width = (from, to) => `${(to - from + 1) / lastDayOfMonth * 100}%`;
  // 눈금: 1·5·10·15·20·25·30일 숫자, 주말은 옅은 음영, 오늘은 세로선
  const ruler = el('div', { class: 'timeline__ruler' },
    ...Array.from({ length: lastDayOfMonth }, (_, index) => {
      const day = index + 1;
      const weekday = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m - 1, day).getDay();
      const showNumber = day === 1 || day % 5 === 0;
      return el('span', { class: `timeline__tick${weekday === 0 || weekday === 6 ? ' is-weekend' : ''}${day === todayDayOfMonth ? ' is-today' : ''}`, style: `left:${pct(day)};width:${width(day, day)}` },
        showNumber ? el('i', {}, String(day)) : '');
    }));
  // 같은 분류끼리 모으고, 그 안에서 시작일 → 긴 기간 순
  const catOrder = Object.keys(SCHEDULE_CATS);
  const items = [...scheduleFiltered(cat)].sort((a, b) => catOrder.indexOf(a.cat) - catOrder.indexOf(b.cat) || a.s - b.s || (b.e - b.s) - (a.e - a.s));
  const rows = items.map((item) => {
    const late = (item.s - 1) / lastDayOfMonth > 0.6;
    // 라벨 폭 상한 = 앵커에서 행 끝(또는 행 시작)까지 — 넘치면 말줄임, 행 밖으로는 절대 안 나간다
    const labelStyle = late
      ? `right:${100 - (item.e / lastDayOfMonth * 100)}%;max-width:${item.e / lastDayOfMonth * 100}%`
      : `left:${pct(item.s)};max-width:${100 - (item.s - 1) / lastDayOfMonth * 100}%`;
    // 괄호 안 설명(기간·시간·지역)은 막대와 아래 목록이 이미 말해 주므로 타임라인 라벨에서는 뗀다. 전체 문구는 title 로
    const label = el('span', { class: `timeline__label${late ? ' is-end' : ''}`, style: labelStyle }, item.label.split(' (')[0]);
    return el('div', { class: 'timeline__row', title: `${SCHEDULE_YM.m}/${item.s}${item.e !== item.s ? `–${item.e}` : ''} ${item.label}` },
      el('span', { class: 'timeline__bar', style: `left:${pct(item.s)};width:${width(item.s, item.e)};background:${SCHEDULE_CATS[item.cat].color}` }),
      label);
  });
  const body = el('div', { class: 'timeline__body' },
    // 주말 음영·오늘 선을 행 전체 높이로 깔기 위해 눈금과 같은 좌표의 배경 칸을 한 번 더 둔다
    el('div', { class: 'timeline__grid' }, ...Array.from({ length: lastDayOfMonth }, (_, index) => {
      const day = index + 1;
      const weekday = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m - 1, day).getDay();
      return el('span', { class: `timeline__col${weekday === 0 || weekday === 6 ? ' is-weekend' : ''}${day === todayDayOfMonth ? ' is-today' : ''}`, style: `left:${pct(day)};width:${width(day, day)}` });
    })),
    ...rows);
  if (!rows.length) body.append(el('p', { class: 'schedule__item' }, '이 분류의 일정이 없어요.'));
  return el('div', { class: 'timeline' }, ruler, body);
}

// 달력 아래 상세 영역을 그 날짜의 일정 목록으로 교체한다.
// 각 줄 앞의 점은 그 일정 분류(cat)의 색을 그대로 쓴다 — 달력 칸의 점과 같은 색 규칙.
function renderScheduleDetail(detailBox, day, cat) {
  detailBox.replaceChildren(
    el('p', { class: 'schedule__sec' }, `${SCHEDULE_YM.m}/${day} 일정`),  // 2026-09-07 v2.13.0 (QA-20) 달 하드코딩 제거
    ...scheduleItemsOn(day, cat).map(item =>
      el('p', { class: 'schedule__item' },
        el('span', { class: 'dot', style: `background:${SCHEDULE_CATS[item.cat].color}` }), item.label)),
  );
  // 제목 줄만 남았다면(= 그날 일정 0건) 안내 문구를 덧붙인다.
  if (detailBox.children.length === 1) detailBox.append(el('p', { class: 'schedule__item' }, '등록된 일정이 없어요.'));
}

// 드로어 안의 일정표를 채운다: 접힘 상태용 한 줄 요약 + 달력 본문.
function renderSchedule() {
  const today = new Date();
  // 실제 오늘이 이 일정표가 다루는 달(SCHEDULE_YM) 안에 있을 때만 "오늘"을 표시한다.
  // 달이 바뀌었는데 데이터를 갱신하지 않으면 여기서 어긋나 "9월 일정" 같은 제목만 남는다.
  const isCurrentMonth = today.getFullYear() === SCHEDULE_YM.y && today.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDayOfMonth = isCurrentMonth ? today.getDate() : 0;

  // 접힘 상태에도 보이는 오늘 일정 한 줄
  // 긴 label에서 핵심만 남긴다: 괄호 앞까지 자르고(" ("), 콜론 뒤 부분만 취한다.
  const $today = document.getElementById('schedule-today');
  if (todayDayOfMonth) {
    const summaries = scheduleItemsOn(todayDayOfMonth).map(item => item.label.split(' (')[0].split(':').pop().trim());
    $today.textContent = summaries.length ? `오늘 · ${summaries.join(' · ')}` : '오늘 일정 없음';
  } else {
    $today.textContent = `${SCHEDULE_YM.m}월 일정`;
  }
  // 2026-09-07 v2.13.0 (QA-20) 드로어 제목의 달도 데이터에서 — index.html 에 '9월'이 박혀 있었다
  const $title = document.getElementById('schedule-title');
  if ($title) $title.textContent = `📅 ${SCHEDULE_YM.m}월 일정표`;
  // 2026-09-08 v2.29.1 드로어 미리보기에도 같은 안내를 단다 — 좁은 화면에서는 이쪽이 일정표의 첫 화면이다.
  // 영어로 볼 때만 보이고(base.css .i18n-note), 한국어에는 이미 아래 각주에 "한국 시간 기준"이 있다
  document.getElementById('schedule-body').replaceChildren(i18nKoOnlyNote('kst'), buildScheduleCal());
}

// 2026-09-03 달력+범례+상세를 노드로 생성 (드로어 미리보기 · 전체 페이지 공용)
// 그리드 계산:
//   firstWeekdayOffset = 1일의 요일(일=0 … 토=6). 그만큼 빈 <span>을 앞에 깔아 1일을 제 요일 칸으로 밀어낸다.
//   lastDayOfMonth     = 다음 달 0일 = 이 달 마지막 날. 이 수만큼 날짜 버튼을 만든다.
// 2026-09-07 v2.13.1 cat: 분류 필터 (일정 페이지의 칩). 드로어는 필터 없이(전체) 부른다
function buildScheduleCal(cat) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === SCHEDULE_YM.y && today.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDayOfMonth = isCurrentMonth ? today.getDate() : 0;
  const detail = el('div', { class: 'schedule__detail' });
  const firstWeekdayOffset = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m - 1, 1).getDay();
  const lastDayOfMonth = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m, 0).getDate();
  let selectedCell = null;  // 현재 선택된 날짜 칸 (다시 누를 때 .sel을 떼기 위해 붙들어 둔다)

  const grid = el('div', { class: 'schedule__cal' },
    // 1행: 요일 머리글
    ...['일', '월', '화', '수', '목', '금', '토'].map(weekdayName => el('span', { class: 'cal__head' }, weekdayName)),
    // 1일 앞의 빈 칸 (요일 오프셋만큼)
    ...Array.from({ length: firstWeekdayOffset }, () => el('span')),
    // 날짜 칸: 그날 걸친 일정의 분류를 중복 없이 모아 점으로 찍는다
    ...Array.from({ length: lastDayOfMonth }, (_, index) => {
      const day = index + 1;
      const dayItems = scheduleItemsOn(day, cat);
      const categoryKeys = [...new Set(dayItems.map(item => item.cat))];
      const cell = el('button', { class: `cal__day${day === todayDayOfMonth ? ' is-today' : ''}`, onclick: () => {
        // 날짜를 누르면 선택 표시를 옮기고 상세 영역을 그날 일정으로 다시 그린다
        if (selectedCell) selectedCell.classList.remove('is-selected');
        selectedCell = cell;
        cell.classList.add('is-selected');
        renderScheduleDetail(detail, day, cat);
      } },
        el('span', { class: 'cal__num' }, String(day)),
        el('span', { class: 'cal__dots' }, ...categoryKeys.map(categoryKey => el('span', { class: 'dot', style: `background:${SCHEDULE_CATS[categoryKey].color}` }))));
      // 넓은 일정 페이지는 날짜 안에서 일정 이름을 최대 3개까지 읽는다.
      // 나머지 건수는 상세 영역으로 안내하고, 모바일·드로어는 기존 점 표시를 유지한다.
      cell.setAttribute('aria-label', `${SCHEDULE_YM.m}월 ${day}일, 일정 ${dayItems.length}개`);
      cell.append(el('span', { class: 'cal__events', 'aria-hidden': 'true' },
        ...dayItems.slice(0, 3).map(item => el('span', {
          class: 'cal__event', title: item.label,
          style: `--event-color:${SCHEDULE_CATS[item.cat].color}`
        }, item.label.split(' (')[0])),
        ...(dayItems.length > 3 ? [el('span', { class: 'cal__more' }, `+${dayItems.length - 3}개 더 보기`)] : [])
      ));
      return cell;
    }));

  const container = el('div', {},
    grid,
    // 범례: 분류별 점 색이 무엇을 뜻하는지 (달력 점과 같은 색)
    el('p', { class: 'schedule__legend' },
      ...Object.values(SCHEDULE_CATS).flatMap(category => [el('span', { class: 'dot', style: `background:${category.color}` }), category.name + '  '])),
    detail,
    el('p', { class: 'schedule__note' }, `${SCHEDULE_NOTE} 날짜를 누르면 그날 일정이 보여요.`),  // 2026-09-07 v2.13.0 (QA-20) 달별 각주
  );
  // 초기 선택: 이 달이면 오늘 칸을 눌러 둔 상태로, 아니면 1일 상세를 그려 둔다.
  if (todayDayOfMonth) { grid.querySelector('.is-today').click(); }
  else { renderScheduleDetail(detail, 1, cat); }
  return container;
}
renderSchedule();
