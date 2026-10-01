'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// scripts/merge-schedule.mjs — 손으로 적은 월 일정표와 자동 수집분을 한 표로 합친다 (v4.7.2 WBS-224)
//
// 규칙은 하나다 — **같은 자리면 손으로 적은 줄이 이긴다.**
//   · 같은 분류·같은 시작·같은 끝이면 자동 줄을 버린다 (사람이 적은 한글·시각·출처가 더 낫다)
//   · 보스 분류(raid5·mega·dmax·shadow)는 한 자리에 보스가 하나뿐이라, 날짜가 겹치기만 해도 손 줄이 이긴다
//   · 나머지 자동 줄은 뒤에 붙인다. 자동분에만 있는 달은 통째로 들어온다 —
//     단, 손 표가 시작되기 전 달은 세우지 않는다. 그 달은 원본에 끝물 이벤트 한둘만 남아 달 전체를 모른다
// 합친 결과의 모양은 손으로 적은 표와 같다 — 화면(Schedule · BossAcc · DmaxDeck)은 합쳐진 줄 알 필요가 없다
// ─────────────────────────────────────────────────────────────────────────────

// 한 자리에 하나만 서는 분류 — 겹치면 손 줄이 이긴다
const ONE_PER_SLOT = new Set(['raid5', 'mega', 'dmax', 'shadow']);
const CAT_ORDER = ['event', 'raid5', 'mega', 'dmax', 'hour', 'shadow'];

function covered(auto, hand) {
  if (auto.cat !== hand.cat) return false;
  if (auto.s === hand.s && auto.e === hand.e) return true;
  return ONE_PER_SLOT.has(auto.cat) && auto.s <= hand.e && auto.e >= hand.s;
}

const order = (item) => (CAT_ORDER.includes(item.cat) ? CAT_ORDER.indexOf(item.cat) : CAT_ORDER.length);

// 한국 한정 줄을 가르는 장소 — backend/schedule_build.py PLACE_REGION['kr'] 의 도시를 한글로 옮긴 것이다.
// 두 거름망이 어긋나면 한쪽에만 걸러진 줄이 유럽 달력으로 샌다 — 검사(schedule-merge.test.ts)가 두 목록을 견준다 (Codex, PR #290)
export const KOREA_PLACES = {
  seoul: '서울', busan: '부산', incheon: '인천', daegu: '대구', daejeon: '대전',
  gwangju: '광주', ulsan: '울산', jeju: '제주', suwon: '수원', korea: '한국',
};
// 도시 말고도 한국에만 걸리는 말 — '아시아 한정', 한국(아시아 · 태평양) 보스, 서울 안 구 이름
const KOREA_ONLY = new RegExp([...Object.values(KOREA_PLACES), '아시아', '종로'].join('|'));

/**
 * 다른 지역 달력의 제목을 한국어로 — 한국 달력에서 자동 줄과 짝지어진 손 줄(같은 자리, covered)의 **제목 · 출처만** 옮긴다.
 * 짝은 원제(자동 줄 label)와 달 · 분류 · 시작일로 잇는다 — 두 지역의 자동 줄은 같은 원본에서 같은 이름으로 나온다.
 * 날짜는 그 지역 자동 줄의 것을 그대로 둔다: UTC 행사는 지역마다 날짜가 달라, 손 줄을 통째로 옮기면
 * 한국 날짜가 유럽 달력에 서거나 보스 칸에서 제 날짜의 유럽 줄을 가렸다 (Codex, PR #290).
 * 한국 한정 손 줄은 짝에서 뺀다 — 유럽 자동 줄이 원제(한국어 보스 이름 등) 그대로 선다.
 * 자동 줄이 없는 손 줄(미공개 이벤트 등)은 옮기지 않는다. 처음에는 유럽 표를 자동분만으로 세워 같은 행사가 영문 원제로
 * 나와 '유럽을 누르면 영어가 된다' 로 읽혔다 (주인 제보)
 */
export function titlesForRegion(hand, autoKr, autoRegion) {
  // 짝은 **행사 한 번** 단위다 — 같은 달 · 같은 분류 · 같은 원제에 시작일이 하루 안(UTC 행사는 지역마다 하루 갈린다).
  // 원제 하나로만 묶었더니 10월 손 줄('슈퍼 메가 레이드 데이 · 세부 내용 미발표')이 11월의 같은 원제 줄에까지 붙었다 (Codex, PR #290)
  const pairs = {};
  for (const [key, month] of Object.entries(autoKr ?? {})) {
    const handItems = (hand?.[key]?.items ?? []).filter((item) => !KOREA_ONLY.test(item.label));
    pairs[key] = month.items.map((item) => ({ item, match: handItems.find((one) => covered(item, one)) })).filter((one) => one.match);
  }
  const titleOf = (key, item) => pairs[key]?.find((one) =>
    one.item.label === item.label && one.item.cat === item.cat && Math.abs(one.item.s - item.s) <= 1)?.match;
  return Object.fromEntries(Object.entries(autoRegion ?? {}).map(([key, month]) => [key, {
    ...month,
    items: month.items.map((item) => {
      const match = titleOf(key, item);
      return match ? { ...item, label: match.label, ...(match.source ? { source: match.source } : {}) } : item;
    }),
  }]));
}

export function mergeSchedule(hand, auto) {
  const months = {};
  const first = Object.keys(hand ?? {}).sort()[0] ?? '';
  for (const key of new Set([...Object.keys(hand ?? {}), ...Object.keys(auto ?? {})].sort())) {
    const handMonth = hand?.[key];
    const autoMonth = auto?.[key];
    if (!autoMonth) { months[key] = handMonth; continue; }
    if (!handMonth) { if (key >= first) months[key] = autoMonth; continue; }
    const added = autoMonth.items.filter((item) => !handMonth.items.some((one) => covered(item, one)));
    const items = [...handMonth.items, ...added].sort((a, b) => order(a) - order(b) || a.s - b.s || a.e - b.e);
    // 자동 줄이 하나라도 섞이면 안내 한 줄 — 영문 제목이 왜 있는지 읽는 사람이 알아야 한다
    const note = added.length ? `${handMonth.note} 나머지는 LeekDuck 자동 수집분이며, 영문 제목은 한글 이름표에 없는 항목이에요.` : handMonth.note;
    months[key] = { ...handMonth, note, items };
  }
  return months;
}
