// ─────────────────────────────────────────────────────────────────────────────
// routes.ts — v3 router.js 의 ROUTES 표를 그대로 옮긴 것
//
// **경로 문자열을 바꾸지 않는다.** 공유된 링크·북마크·GA 지표가 전부 이 문자열에 달려 있다.
// legacy 표도 그대로다 — v3.61.0 에 두 화면을 합치면서 옛 주소 넷을 planner 로 이어 뒀다.
//
// v3 와 달라진 것은 하나 — `as const` 와 유니온 타입이 붙어, 없는 id 를 적으면 **컴파일이 선다.**
// v3 에서는 `routeHash('planner-collection')` 이 라우트가 사라진 뒤에도 그대로 남아
// 홈 화면 다섯 곳에서 죽은 링크가 됐다(v3.61.0 에 손으로 찾아 고쳤다).
// ─────────────────────────────────────────────────────────────────────────────

export type RouteKind = 'shell' | 'plan' | 'page' | 'detail';
export type GroupId = 'today' | 'pick' | 'mine';

export interface RouteDef {
  id: string;
  path: string;
  kind: RouteKind;
  tab?: string;
  tool?: string;
  nav?: string;
  icon?: string;
  group?: GroupId;
  parent?: string;
  title?: string;
  locked?: boolean;
  legacy?: string[];
}

export const ROUTES = [
  { id: 'home', path: '', kind: 'shell', tab: 'home', title: '서비스 홈' },

  // ── 이동 목록(메뉴)에 오르는 순서 그대로 ────────────────────────────────
  { id: 'planner', path: 'planner', kind: 'plan', tab: 'home', nav: '내 포켓몬', icon: '🎒', group: 'mine', title: '내 포켓몬', locked: true, legacy: ['plan', 'planner/collection', 'plan/collection', 'favs'] },
  { id: 'dex', path: 'dex', kind: 'page', nav: '포켓몬 도감', icon: '📕', group: 'pick', legacy: ['types'] },
  { id: 'dmax', path: 'dmax', kind: 'shell', tab: 'max', nav: 'D-MAX', icon: '✨', group: 'pick', legacy: ['rank/max'] },
  { id: 'pve', path: 'pve', kind: 'shell', tab: 'pve', nav: '레이드 · PvE', icon: '⚔️', group: 'pick', legacy: ['rank/pve'] },
  { id: 'pvp', path: 'pvp', kind: 'shell', tab: 'pvp', nav: '배틀 · PvP', icon: '🃏', group: 'pick', legacy: ['rank/pvp'] },
  { id: 'game-updates', path: 'game-updates', kind: 'page', nav: '게임 업데이트', icon: '📢', group: 'today' },
  { id: 'schedule', path: 'schedule', kind: 'page', nav: '이벤트 일정', icon: '📅', group: 'today' },
  { id: 'raids', path: 'raids', kind: 'page', nav: '레이드 보스', icon: '⚔️', group: 'today' },
  { id: 'eggs', path: 'eggs', kind: 'page', nav: '알 부화', icon: '🥚', group: 'today' },
  { id: 'finder', path: 'finder', kind: 'page', nav: '검색식 만들기', icon: '🔎', group: 'mine' },

  // ── 화면 아래 화면 (메뉴에 없다 — 갈 길은 부모 화면의 버튼 하나뿐) ──────
  { id: 'pvp-deck', path: 'pvp/deck', kind: 'shell', tab: 'pvp', tool: 'deck', parent: 'pvp', title: '덱 짜기', icon: '🃏' },
  { id: 'dmax-deck', path: 'dmax/deck', kind: 'shell', tab: 'max', tool: 'deck', parent: 'dmax', title: '덱 짜기', icon: '🧩' },
  { id: 'ivrank', path: 'pvp/ivrank', kind: 'shell', tab: 'pvp', tool: 'ivrank', parent: 'pvp', title: 'PvP 개체값 순위', icon: '🧬', legacy: ['ivrank'] },
  { id: 'pve-solo', path: 'pve/solo', kind: 'shell', tab: 'pve', tool: 'solo', parent: 'pve', title: '솔플 계산기', icon: '🧮' },
  { id: 'release', path: 'release', kind: 'page' },
  { id: 'changes', path: 'changes', kind: 'page' },
  { id: 'privacy', path: 'privacy', kind: 'page' },
  { id: 'terms', path: 'terms', kind: 'page' },
  { id: 'settings', path: 'settings', kind: 'page' },
  { id: 'mon', path: 'mon', kind: 'detail' },
] as const satisfies readonly RouteDef[];

export type RouteId = (typeof ROUTES)[number]['id'];

// 갈래 — 기능의 '종류' 가 아니라 사람이 하려는 일로 가른다 (v2.65.0 의 판단 그대로)
export const ROUTE_GROUPS: readonly [GroupId, string, string, string][] = [
  ['today', '지금 뭐 하지', '진행 중인 이벤트와 레이드 일정을 확인하세요.', '📅'],
  ['pick', '뭘 데려갈까', '상황에 맞는 포켓몬과 추천 덱을 찾아보세요.', '🎯'],
  ['mine', '뭘 키울까', '담아 둔 포켓몬의 일정을 챙기고, 게임에 붙여 넣을 검색식을 만들어요.', '🌱'],
];

export const ROUTE_DESC: Partial<Record<RouteId, string>> = {
  home: '찾고, 비교하고, 키우는 즐거움. 필요한 화면으로 바로 가요.',
  dex: '포켓몬을 찾아 종족값과 상성을 봐요.',
  dmax: '거대한 힘을 지닌 포켓몬의 티어를 봐요.',
  pve: '레이드 추천 딜러와 솔플 가능 여부를 계산해요.',
  pvp: '리그별 순위와 덱 구성을 봐요.',
  planner: '담아 둔 포켓몬의 다가오는 일정을 챙겨 드려요.',
  'game-updates': '게임의 규칙·밸런스·오류가 바뀐 소식이에요. 공식 발표를 확인한 것만 적어요.',
  schedule: '다가오는 레이드와 이벤트 일정이에요.',
  raids: '지금 도는 레이드 보스와 약점이에요.',
  eggs: '거리별로 무엇이 부화하는지 봐요.',
  ivrank: '내 개체가 그 리그에서 몇 위인지 봐요.',
  'pvp-deck': '상대할 셋을 넣으면 맞설 덱을 골라 드려요.',
  'dmax-deck': '맥스 배틀 보스를 고르면 데려갈 셋을 골라 드려요.',
  'pve-solo': '이 보스를 혼자 잡을 수 있는지 계산해요.',
  finder: '조건을 눌러 게임 검색창에 붙여 넣을 식을 만들어요.',
  release: '무엇이 언제 바뀌었는지 적어 둬요.',
  changes: '이번 시즌에 위력·에너지가 바뀌는 기술이에요.',
  privacy: '어떤 정보를 받고 어떻게 다루는지 알려 드려요.',
  terms: '이 서비스를 쓸 때의 약속이에요.',
  settings: '화면을 어떻게 볼지 정해요. 로그인하면 계정에 저장돼 어느 기기에서든 같아요.',
};

const byId = new Map<string, RouteDef>(ROUTES.map((route) => [route.id, route]));

/** 옛 경로 → 새 경로. 표를 손으로 두 번 적지 않도록 legacy 에서 뒤집어 만든다 (v3 와 같은 규칙) */
export const ROUTE_LEGACY = new Map<string, string>();
for (const route of ROUTES) {
  for (const old of (route as RouteDef).legacy ?? []) ROUTE_LEGACY.set(old, route.path);
}

export function routeById(id: string): RouteDef | undefined {
  return byId.get(id);
}

export function routeHash(id: RouteId, rest = ''): string {
  const route = byId.get(id);
  if (!route) return '#/';
  if (!route.path) return '#/';
  return `#/${route.path}${rest ? `/${rest}` : ''}`;
}

export function routeDesc(id: string): string {
  return ROUTE_DESC[id as RouteId] ?? '';
}

/** 메뉴 줄 — 자식은 부모 바로 뒤에 선다 (표에 적은 순서가 아니라 소속 순서) */
export const ROUTE_NAV = (() => {
  const rows = ROUTES.filter((route) => 'nav' in route) as unknown as RouteDef[];
  const ordered: RouteDef[] = [];
  for (const route of rows) {
    if (route.parent) continue;
    ordered.push(route, ...rows.filter((child) => child.parent === route.id));
  }
  for (const route of rows) if (!ordered.includes(route)) ordered.push(route);
  return ordered;
})();

/**
 * 경로 문자열(해시에서 '#/' 를 뗀 것) → 라우트.
 * 긴 경로를 먼저 잡는다 — 'pvp/deck' 이 'pvp' 에 먹히면 안 된다 (v3 와 같은 규칙).
 */
const byPathDesc = [...ROUTES].sort((a, b) => b.path.length - a.path.length);

export function routeOfPath(path: string): { route: RouteDef; rest: string } | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  for (const route of byPathDesc) {
    if (!route.path) continue;
    if (clean === route.path) return { route, rest: '' };
    if (clean.startsWith(`${route.path}/`)) return { route, rest: clean.slice(route.path.length + 1) };
  }
  return clean === '' ? { route: ROUTES[0], rest: '' } : null;
}

/** 옛 주소면 새 주소를 돌려준다. 아니면 null (바꿀 것이 없다는 뜻) */
export function routeCanonical(path: string): string | null {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const exact = ROUTE_LEGACY.get(clean);
  if (exact !== undefined) return exact;
  for (const [old, next] of ROUTE_LEGACY) {
    if (clean.startsWith(`${old}/`)) return `${next}/${clean.slice(old.length + 1)}`;
  }
  return null;
}
