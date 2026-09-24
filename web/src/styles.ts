// ─────────────────────────────────────────────────────────────────────────────
// src/styles.ts — 화면의 CSS 를 싣는 곳
//
// 2026-09-22 v5 Phase 1-C — 아래 v3/ 는 **v3 저장소에서 옮겨 온 것이 아니라, 지금 화면이
// 실제로 쓰는 디자인이다.** v3 의 화면 코드(JS·HTML)는 지웠지만 CSS 는 v4 가 그대로 쓰고 있어
// frontend-v4/src/styles/v3/ 로 옮겨 v4 가 소유하게 했다. 클래스 계약(이름·태그·중첩)은
// ds/ 의 조각들이 그대로 내보내므로 이름을 바꾸지 않는다 (CLAUDE.md §1-c).
//
// **순서가 계층을 정한다.** 같은 선택자를 여러 파일이 덮어쓰고 있어 순서가 곧 우선순위다 —
// v3.56.0 에 shell-notebook.css 를 뒤로 옮겼다가 상세 팝업 ✕ 가 2px 밀린 적이 있다.
// ─────────────────────────────────────────────────────────────────────────────
import './styles/v3/tokens.css';
import './styles/v3/base.css';
import './styles/v3/layout.css';
import './styles/v3/components/home.css';
import './styles/v3/components/shell-notebook.css';
import './styles/v3/components/tabs.css';
import './styles/v3/components/seg.css';
import './styles/v3/components/chips.css';
import './styles/v3/components/list.css';
import './styles/v3/components/finder.css';
import './styles/v3/components/ivrank.css';
import './styles/v3/components/tag.css';
import './styles/v3/components/modal.css';
import './styles/v3/components/search.css';
import './styles/v3/components/drawer.css';
import './styles/v3/components/pages.css';
import './styles/v3/components/planner.css';
import './styles/v3/components/updates.css';
import './styles/v3/components/consent.css';
import './styles/v3/components/trial.css';
import './styles/v3/components/app-shell.css';
import './styles/v3/components/pc-theme.css';
import './styles/v3/pixel.css';
// 마지막 — v3 CSS 를 다 실은 뒤에 래퍼 하나만 지운다
import './root.css';

// v4 가 소유한 화면의 디자인. 영역마다 파일 하나다 — v3 의 components/ 규칙과 같은 방식이다.
// 토큰은 여기 없다 (styles/tokens.css 한곳) — 값이 흩어지면 어디서 왔는지를 매번 다시 찾는다
import './styles/brand.css';
import './styles/surfaces.css';
import './styles/detail.css';
// v4.4.0 — 홈 · 목록 카드 · 검색식. v3 스킨(home.css · shell-notebook.css)이 같은 자리를
// `html body[data-route]` 로 잡고 있어 순서만으로는 못 이긴다. 이 셋은 `html body #root` 한 가지
// 접두사로 올린다(장치는 하나만). v3 스킨 쪽 규칙을 걷어내는 일은 남은 정리 항목이다
import './styles/home-editorial.css';
import './styles/catalog.css';
import './styles/finder.css';
// v4.9.x 디자인 시스템 — ds/ 의 조각만 쓰는 규칙. v3 스킨 뒤에 실어야 덮이지 않는다
import './styles/ds.css';
// 11월 탱커 팝업 — 배치만. 조각은 ds 것이다
import './styles/tankpop.css';
// 운영 통계 (루트만, 2026-09-24)
import './styles/admin-stats.css';
// 앱이 붙기 전 사람이 보는 화면. 맨 뒤다 — 이 블록은 앱이 붙으면 사라지므로 아무것도 안 덮는다
import './styles/facts.css';
