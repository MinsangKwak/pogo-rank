// ─────────────────────────────────────────────────────────────────────────────
// lib/nav.ts — 주소를 옮기는 **유일한 자리** (v5 Phase 6)
//
// **왜 훅이 아닌가.** 이동하는 자리가 화면 스물여덟 곳에 흩어져 있다. 전부 `useRouter()` 로
// 고치면 그 컴포넌트들이 전부 훅 규칙에 묶이고, 콜백 안에서 부르던 자리는 구조를 바꿔야 한다.
// 라우터를 한 번 등록해 두고 부르면 바뀌는 것은 **줄 하나씩**이다.
//
// **등록 전에도 동작한다.** 아직 안 붙었으면 통째로 다시 연다 — 느리지만 죽지는 않는다.
// 서버에서 불리면 아무 일도 안 한다(그 자리에는 브라우저가 없다).
//
// 전에는 이 일을 `location.hash = '#/dex'` 가 했다. 해시는 서버로 안 가므로 색인될 주소가
// 없었고, 그것이 포켓몬 1,100종이 검색에 한 페이지로 잡히던 이유다 (docs/ROADMAP.md §1).
// ─────────────────────────────────────────────────────────────────────────────

type Push = (href: string) => void;

let push: Push | null = null;
let back: (() => void) | null = null;

/** 앱 껍데기가 뜰 때 한 번 부른다 (components/RouterBridge.tsx) */
export function bindRouter(next: Push, goBack: () => void): void {
  push = next;
  back = goBack;
}

/** 앱 안의 다른 화면으로 */
export function go(href: string): void {
  if (push) { push(href); return; }
  if (typeof window !== 'undefined') window.location.assign(href);
}

/** 뒤로. 뒤가 없으면 홈으로 — 공유 링크로 바로 들어온 사람이 막다른 곳에 갇히지 않게 */
export function goBack(): void {
  if (typeof window !== 'undefined' && window.history.length > 1 && back) { back(); return; }
  go('/');
}
