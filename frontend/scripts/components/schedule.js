// 2026-09-02 9월 일정표 달력: 달력 그리드 + 날짜 탭 상세 + 접힘 상태 오늘 일정 한 줄
// 일정 데이터: s/e는 일(day of month), cat은 범례 분류
const SCHEDULE_YM = { y: 2026, m: 9 };
const SCHEDULE_CATS = {
  event: { name: '이벤트', color: 'var(--t-fire)' },
  raid5: { name: '5성', color: 'var(--t-dragon)' },
  mega: { name: '메가', color: 'var(--t-psychic)' },
  dmax: { name: 'D-MAX', color: 'var(--t-water)' },
  hour: { name: '아워(18시)', color: 'var(--t-electric)' },
  shadow: { name: '섀도우(주말)', color: 'var(--t-dark)' },
};
const SCHEDULE_ITEMS = [
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
];

function scheduleItemsOn(day) {
  return SCHEDULE_ITEMS.filter(it => day >= it.s && day <= it.e);
}

function renderScheduleDetail(box, day) {
  box.replaceChildren(
    el('p', { class: 'schedule-sec' }, `9/${day} 일정`),
    ...scheduleItemsOn(day).map(it =>
      el('p', { class: 'schedule-item' },
        el('span', { class: 'dot', style: `background:${SCHEDULE_CATS[it.cat].color}` }), it.label)),
  );
  if (box.children.length === 1) box.append(el('p', { class: 'schedule-item' }, '등록된 일정이 없습니다.'));
}

function renderSchedule() {
  const today = new Date();
  const inMonth = today.getFullYear() === SCHEDULE_YM.y && today.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDay = inMonth ? today.getDate() : 0;

  // 접힘 상태에도 보이는 오늘 일정 한 줄
  const $today = document.getElementById('schedule-today');
  if (todayDay) {
    const items = scheduleItemsOn(todayDay).map(it => it.label.split(' (')[0].split(':').pop().trim());
    $today.textContent = items.length ? `오늘 · ${items.join(' · ')}` : '오늘 일정 없음';
  } else {
    $today.textContent = `${SCHEDULE_YM.m}월 일정`;
  }
  document.getElementById('schedule-body').replaceChildren(buildScheduleCal());
}

// 2026-09-03 달력+범례+상세를 노드로 생성 (드로어 미리보기 · 전체 페이지 공용)
function buildScheduleCal() {
  const today = new Date();
  const inMonth = today.getFullYear() === SCHEDULE_YM.y && today.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDay = inMonth ? today.getDate() : 0;
  const detail = el('div', { class: 'schedule-detail' });
  const first = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m - 1, 1).getDay();
  const last = new Date(SCHEDULE_YM.y, SCHEDULE_YM.m, 0).getDate();
  let selected = null;

  const grid = el('div', { class: 'schedule-cal' },
    ...['일', '월', '화', '수', '목', '금', '토'].map(d => el('span', { class: 'cal-head' }, d)),
    ...Array.from({ length: first }, () => el('span')),
    ...Array.from({ length: last }, (_, i) => {
      const day = i + 1;
      const cats = [...new Set(scheduleItemsOn(day).map(it => it.cat))];
      const cell = el('button', { class: `cal-day${day === todayDay ? ' today' : ''}`, onclick: () => {
        if (selected) selected.classList.remove('sel');
        selected = cell; cell.classList.add('sel');
        renderScheduleDetail(detail, day);
      } },
        el('span', { class: 'd' }, String(day)),
        el('span', { class: 'cal-dots' }, ...cats.map(c => el('span', { class: 'dot', style: `background:${SCHEDULE_CATS[c].color}` }))));
      return cell;
    }));

  const box = el('div', {},
    grid,
    el('p', { class: 'schedule-legend' },
      ...Object.values(SCHEDULE_CATS).flatMap(c => [el('span', { class: 'dot', style: `background:${c.color}` }), c.name + '  '])),
    detail,
    el('p', { class: 'schedule-note' }, '출처: LeekDuck 원본 데이터 + 포켓몬고 공식 한국 발표 (2026-09-02 수집, 한국 시간 기준). 스포트라이트 아워는 2026년부터 목요일. 날짜를 누르면 그날 일정이 보입니다.'),
  );
  if (todayDay) { grid.querySelector('.today').click(); }
  else { renderScheduleDetail(detail, 1); }
  return box;
}
renderSchedule();
