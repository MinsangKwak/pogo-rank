'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// scripts/merge-schedule.mjs — 손으로 적은 월 일정표와 자동 수집분을 한 표로 합친다 (v4.7.0 WBS-224)
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
