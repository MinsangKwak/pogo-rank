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

// 앞으로 간 이동인가 — 새 화면이 선 뒤 맨 위로 올릴지 가른다. 뒤로 가기(popstate)는 브라우저가 제자리를 되돌린다.
// Next 는 페이지 본문의 첫 요소로 스크롤하는데, 그 본문(검색엔진용)은 앱이 붙은 뒤 화면에 없다 — 그래서 우리가 올린다
let scrollOnArrive = false;

/** 라우터로 앞으로 옮길 때 부른다 (components/RouterBridge.tsx) */
export function markForward(): void { scrollOnArrive = true; }

/** 새 화면이 서면 한 번 묻는다 — 앞으로 온 이동이면 true 를 주고 잊는다 */
export function takeForward(): boolean {
  const was = scrollOnArrive;
  scrollOnArrive = false;
  return was;
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

// ── 앱 안 링크 (2026-09-23) ─────────────────────────────────────────────────
// 메뉴 줄 · 홈 타일 · 카드는 평범한 <a href> 다. 그대로 두면 누를 때마다 문서를 통째로 다시 열어
// (실측 2~3.4초) 서버가 그린 검색엔진용 본문이 비쳤다가 앱으로 바뀐다 — '깨졌다가 다시 그려진다'.
// 스물여덟 곳을 <Link> 로 바꾸는 대신 문서에서 한 번 가로챈다. 판정은 여기 한 곳이다.

/** 라우터로 옮겨도 되는 클릭이면 그 주소(경로+질의)를, 아니면 null */
export function internalHref(
  click: Pick<MouseEvent, 'defaultPrevented' | 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
  anchor: Pick<HTMLAnchorElement, 'href' | 'target' | 'hasAttribute'>,
  here: Pick<Location, 'origin' | 'pathname' | 'search'>,
): string | null {
  // 이미 누가 처리했거나(<Link>) · 가운데 버튼 · 새 탭·창으로 여는 누름은 브라우저 몫이다
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download') || anchor.hasAttribute('data-reload')) return null;
  let url: URL;
  try { url = new URL(anchor.href); } catch { return null; }
  if (url.origin !== here.origin) return null;
  // 도면(/storybook)은 앱 밖의 판이다 — 서비스워커도 비켜 간다(public/sw.js 의 OUTSIDE)
  if (/^\/storybook(\/|$)/.test(url.pathname)) return null;
  // 파일(그림 · 데이터 · robots 같은 것)은 문서가 아니다
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return null;
  // 같은 문서 안의 자리 이동(#content 같은 건너뛰기 링크)은 브라우저가 한다
  if (url.hash && url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}`;
}
