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
  locked?: boolean;        // 로그인·승인이 있어야 열린다
  beta?: boolean;          // 실험 기능 — 승인 위에 beta 깃발이 하나 더 있어야 열린다
  root?: boolean;          // 루트 관리자만 (2026-09-24 운영 통계) — 메뉴 · 사이트맵에 안 오르고 검색에 안 잡힌다
  legacy?: string[];
  actions?: boolean;       // 머리 오른쪽에 단추(보기 전환·도구)가 선다 — 좁은 화면은 그 줄 높이를 미리 비워 둔다 (CLS)
}

export const ROUTES = [
  { id: 'home', path: '', kind: 'shell', tab: 'home', title: '서비스 홈' },

  // ── 이동 목록(메뉴)에 오르는 순서 그대로 ────────────────────────────────
  { id: 'planner', path: 'planner', kind: 'plan', tab: 'home', nav: '내 포켓몬', icon: '🎒', group: 'mine', title: '내 포켓몬', locked: true, beta: true, legacy: ['plan', 'planner/collection', 'plan/collection', 'favs'] },
  { id: 'dex', path: 'dex', kind: 'page', nav: '포켓몬 도감', icon: '📕', group: 'pick', legacy: ['types'], actions: true },
  { id: 'dmax', path: 'dmax', kind: 'shell', tab: 'max', nav: 'D-MAX', icon: '✨', group: 'pick', legacy: ['rank/max'], actions: true },
  { id: 'pve', path: 'pve', kind: 'shell', tab: 'pve', nav: '레이드 · PvE', icon: '⚔️', group: 'pick', legacy: ['rank/pve'], actions: true },
  { id: 'pvp', path: 'pvp', kind: 'shell', tab: 'pvp', nav: '배틀 · PvP', icon: '🃏', group: 'pick', legacy: ['rank/pvp'], actions: true },
  { id: 'game-updates', path: 'game-updates', kind: 'page', nav: '게임 업데이트', icon: '📢', group: 'today' },
  { id: 'changes', path: 'changes', kind: 'page', nav: '기술 변경 내역', title: '기술 변경 내역', icon: '⚔️', group: 'today', parent: 'game-updates' },
  { id: 'schedule', path: 'schedule', kind: 'page', nav: '이벤트 일정', icon: '📅', group: 'today' },
  { id: 'raids', path: 'raids', kind: 'page', nav: '레이드 보스', icon: '⚔️', group: 'today', actions: true },
  { id: 'eggs', path: 'eggs', kind: 'page', nav: '알 부화', icon: '🥚', group: 'today', actions: true },
  { id: 'finder', path: 'finder', kind: 'page', nav: '검색식 만들기', icon: '🔎', group: 'mine' },

  // ── 화면 아래 화면 (메뉴에 없다 — 갈 길은 부모 화면의 버튼 하나뿐) ──────
  { id: 'pvp-deck', path: 'pvp/deck', kind: 'shell', tab: 'pvp', tool: 'deck', parent: 'pvp', title: '덱 짜기', icon: '🃏' },
  { id: 'dmax-deck', path: 'dmax/deck', kind: 'shell', tab: 'max', tool: 'deck', parent: 'dmax', title: '덱 짜기', icon: '🧩' },
  { id: 'ivrank', path: 'pvp/ivrank', kind: 'shell', tab: 'pvp', tool: 'ivrank', parent: 'pvp', title: 'PvP 개체값 순위', icon: '🧬', legacy: ['ivrank'] },
  { id: 'pve-solo', path: 'pve/solo', kind: 'shell', tab: 'pve', tool: 'solo', parent: 'pve', title: '솔플 계산기', icon: '🧮' },
  { id: 'release', path: 'release', kind: 'page', title: '패치노트', icon: '🎉' },
  { id: 'privacy', path: 'privacy', kind: 'page', title: '개인정보처리방침', icon: '🔒' },
  { id: 'terms', path: 'terms', kind: 'page', title: '이용약관', icon: '📜' },
  { id: 'settings', path: 'settings', kind: 'page', title: '설정', icon: '🛠' },
  // 루트만 — 설정의 관리 칸에서 단추 하나로 들어온다 (components/AdminPanel.tsx)
  { id: 'admin-stats', path: 'admin/stats', kind: 'page', title: '운영 통계', icon: '📊', locked: true, root: true },
  { id: 'mon', path: 'mon', kind: 'detail' },
] as const satisfies readonly RouteDef[];

export type RouteId = (typeof ROUTES)[number]['id'];

// 갈래 — 기능의 '종류' 가 아니라 사람이 하려는 일로 가른다 (v2.65.0 의 판단 그대로)
export const ROUTE_GROUPS: readonly [GroupId, string, string, string][] = [
  ['today', '지금 뭐 하지', '진행 중인 이벤트와 레이드 일정을 확인하세요.', '📅'],
  ['pick', '뭘 데려갈까', '상황에 맞는 포켓몬과 추천 덱을 찾아보세요.', '🎯'],
  ['mine', '뭘 키울까', '즐겨찾기 포켓몬의 일정을 확인하고 게임에서 사용할 검색식을 만들어 보세요.', '🌱'],
];

export const ROUTE_DESC: Partial<Record<RouteId, string>> = {
  home: '포켓몬 정보부터 배틀 준비까지, 필요한 기능을 한곳에서 찾아보세요.',
  dex: '이름·타입으로 포켓몬을 찾고 종족값과 상성을 확인해 보세요.',
  dmax: '맥스 배틀에 사용할 포켓몬의 등급과 역할별 순위를 비교해 보세요.',
  pve: '레이드에 적합한 공격 포켓몬을 찾고 솔플 가능성을 계산해 보세요.',
  pvp: '리그별 순위를 비교하고 상대에 맞는 덱을 구성해 보세요.',
  planner: '즐겨찾기에 담은 포켓몬의 다가오는 일정을 확인해 보세요.',
  'game-updates': '공식 발표를 바탕으로 게임 규칙·밸런스 변경과 오류 수정 소식을 전해요.',
  schedule: '레이드와 이벤트 일정을 날짜별로 확인해 보세요.',
  raids: '현재 등장하는 레이드 보스와 약점을 확인해 보세요.',
  eggs: '알의 부화 거리와 획득 경로에 따라 나오는 포켓몬을 확인해 보세요.',
  ivrank: '포켓몬의 개체값을 입력하고 리그별 개체값 순위를 확인해 보세요.',
  'pvp-deck': '상대 포켓몬을 최대 3마리 선택하면 맞춤 덱을 추천해요.',
  'dmax-deck': '보스의 타입에 맞는 맥스 배틀 포켓몬 3마리를 추천해요.',
  'pve-solo': '레이드 보스와 덱을 선택해 혼자 클리어할 수 있을지 계산해 보세요.',
  finder: '원하는 조건을 선택해 포켓몬 GO에서 사용할 검색식을 만들어 보세요.',
  release: 'moncamp의 기능 추가와 개선·수정 내역을 확인해 보세요.',
  changes: '이번 시즌의 기술 위력·에너지 변경 내용을 확인해 보세요.',
  privacy: '개인정보의 수집 항목, 이용 목적과 보관·삭제 기준을 안내합니다.',
  terms: '서비스 이용 조건과 이용자·운영자의 권리 및 책임을 안내합니다.',
  settings: '화면 테마와 포켓몬 이미지의 움직임을 설정할 수 있어요.',
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

/**
 * 라우트 id → 주소. **v5 Phase 6 에 해시를 뗐다** (`#/dex` → `/dex`).
 * 경로 문자열 자체는 그대로다 — 공유된 링크와 북마크가 거기 달려 있다 (CLAUDE.md §2)
 */
export function routeHref(id: RouteId, rest = ''): string {
  const route = byId.get(id);
  if (!route || !route.path) return '/';
  return `/${route.path}${rest ? `/${rest}` : ''}`;
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
