// ─────────────────────────────────────────────────────────────────────────────
// lib/calBars.ts — 달력의 여러 날 일정을 주마다 한 줄 막대로 잇는 배치 (2026-10-02)
//
// 전에는 날짜 칸마다 그날 걸친 일정 이름을 따로 세워, 10/3~10/20 행사가 열여덟 번 되풀이됐다 (주인 제보).
// 이제 한 주(7칸)를 한 줄로 보고, 일정 하나를 시작 칸부터 끝 칸까지 이어지는 막대 하나로 놓는다.
// 주가 바뀌면 막대도 끊긴다 — 달력은 주마다 줄이 바뀌기 때문이다. 끊긴 쪽 끝은 둥글리지 않아 이어짐을 보인다.
//
// 줄(lane)은 주마다 새로 고른다: 그 막대가 걸친 날이 모두 비어 있는 가장 위 줄에 넣는다.
// 놓는 순서는 분류 순(행사 → 5성 → 메가 → D-MAX → 아워 → 섀도우)이 먼저다 — 날짜 순으로만 놓았더니
// 일주일씩 서는 보스 막대가 위 세 줄을 차지해 행사가 '+N개' 뒤로 숨었다.
// 같은 분류 안에서도 두 주 넘게 이어지는 배경 행사(한 달 내내 서는 리서치 · 카드 게임 기념 등)는 뒤로 미룬다 —
// 한글날 · 커뮤니티 데이 같은 짧은 행사가 먼저 보여야 한다.
// 보이는 줄 수를 넘는 일정은 그 날짜 칸에 '+N개 더 보기' 로 센다 — 전체는 아래 고른 날 목록이 보여 준다
// ─────────────────────────────────────────────────────────────────────────────
import type { ScheduleItem } from '../types/data';

export interface CalSegment {
  item: ScheduleItem;
  // 주 안의 칸 — 1(일요일) ~ 7(토요일)
  col: number;
  span: number;
  lane: number;
  // 막대가 실제 시작 · 끝 날짜에서 시작 · 끝나는가 — 아니면 앞 · 다음 주로 이어진다
  head: boolean;
  tail: boolean;
}

export interface CalWeek {
  // 주 안의 7칸 — 이 달 날짜가 아니면 null
  days: (number | null)[];
  // 보이는 줄 안의 막대만 담는다
  segments: CalSegment[];
  // 날짜 → 보이는 줄 밖으로 밀린 일정 수
  hidden: Record<number, number>;
}

// 두 주(14일) 넘게 이어지는 일정 — 달력 위 칸을 내어 줄 배경 행사로 본다
const BACKDROP_DAYS = 14;
const isBackdrop = (item: ScheduleItem) => item.e - item.s + 1 > BACKDROP_DAYS;

export function calWeeks(y: number, m: number, items: ScheduleItem[], lanes = 3, catOrder: string[] = []): CalWeek[] {
  const rank = (cat: string) => (catOrder.includes(cat) ? catOrder.indexOf(cat) : catOrder.length);
  const offset = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const weeks: CalWeek[] = [];
  for (let start = 1 - offset; start <= last; start += 7) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = start + index;
      return day >= 1 && day <= last ? day : null;
    });
    const from = Math.max(1, start);
    const to = Math.min(last, start + 6);
    const pieces = items
      .map((item, order) => ({ item, order, s: Math.max(item.s, from), e: Math.min(item.e, to) }))
      .filter((piece) => piece.s <= piece.e)
      // 분류 순 → 배경 행사는 뒤로 → 일찍 시작하는 것 → 긴 것 순 — 같은 날 시작이면 긴 막대가 위에 서야 짧은 것들이 아래 빈 줄을 나눠 쓴다
      .sort((a, b) => rank(a.item.cat) - rank(b.item.cat) || Number(isBackdrop(a.item)) - Number(isBackdrop(b.item))
        || a.s - b.s || (b.item.e - b.item.s) - (a.item.e - a.item.s) || a.order - b.order);
    // 줄마다 차지한 날 — 놓는 순서가 시작일 순이 아니라서 마지막 끝날 하나로는 빈 자리를 알 수 없다
    const taken: Set<number>[] = [];
    const segments: CalSegment[] = [];
    const hidden: Record<number, number> = {};
    for (const piece of pieces) {
      const span = Array.from({ length: piece.e - piece.s + 1 }, (_, index) => piece.s + index);
      let lane = taken.findIndex((days) => span.every((day) => !days.has(day)));
      if (lane < 0) lane = taken.push(new Set()) - 1;
      span.forEach((day) => taken[lane]!.add(day));
      if (lane >= lanes) {
        for (let day = piece.s; day <= piece.e; day += 1) hidden[day] = (hidden[day] ?? 0) + 1;
        continue;
      }
      segments.push({
        item: piece.item, col: piece.s - start + 1, span: piece.e - piece.s + 1, lane,
        head: piece.s === piece.item.s, tail: piece.e === piece.item.e,
      });
    }
    weeks.push({ days, segments, hidden });
  }
  return weeks;
}

// 막대 색 — 분류 색 하나로 칠했더니 행사가 모두 같은 주황이라 겹치면 구분이 안 됐다 (주인 제보, 2026-10-02).
// 일정마다 색을 따로 주되, 테마마다 맞춰 둔 게임 타입 색 토큰에서 고른다(새 색을 만들지 않는다).
// 차례는 이웃한 색끼리 색상환에서 멀게 — 주황 · 파랑 · 초록 · 분홍 · 노랑 · 보라 …
export const BAR_COLORS = ['fire', 'water', 'grass', 'psychic', 'electric', 'dragon', 'ice', 'fighting', 'poison', 'fairy', 'ground', 'ghost']
  .map((type) => `var(--t-${type})`);

/**
 * 일정마다 막대 색 번호. 같은 날에 걸치는 일정끼리는 겹치지 않는 가장 앞 색을 받는다(그래프 칠하기를 앞에서부터 욕심껏).
 * 달 전체에서 한 번 정하므로 같은 일정은 주가 바뀌어도 같은 색이다
 */
export function barColors(items: ScheduleItem[]): Map<ScheduleItem, number> {
  const picked = new Map<ScheduleItem, number>();
  const order = [...items].sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  for (const item of order) {
    const used = new Set<number>();
    for (const [other, color] of picked) if (other.s <= item.e && other.e >= item.s) used.add(color);
    let color = 0;
    while (used.has(color) && color < BAR_COLORS.length - 1) color += 1;
    // 색이 모자라면(한 날에 열둘 넘게 겹치면) 겹친 수로 돌려 쓴다 — 바로 옆 막대와는 여전히 다르다
    picked.set(item, used.has(color) ? used.size % BAR_COLORS.length : color);
  }
  return picked;
}
