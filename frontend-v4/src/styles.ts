// ─────────────────────────────────────────────────────────────────────────────
// src/styles.ts — v3 의 CSS 를 **한 줄도 고치지 않고** 그대로 싣는다
//
// 이것이 "현재 디자인을 그대로 유지" 를 지키는 방법이다.
// CSS Modules·Tailwind 로 옮기면 클래스명이 바뀌고, 그 클래스명은 회귀 34 스위트가
// 붙잡고 있는 계약이다 — 디자인과 검사가 같이 깨진다.
//
// **순서가 계층을 정한다.** backend/build.py 의 STYLES 배열과 같은 차례여야 한다.
// v3.56.0 에 shell-notebook.css 를 뒤로 옮겼다가 상세 팝업 ✕ 가 2px 밀린 적이 있다 —
// 같은 선택자를 여러 파일이 덮어쓰고 있어 순서가 곧 우선순위다.
// ─────────────────────────────────────────────────────────────────────────────
import '../../frontend/styles/tokens.css';
import '../../frontend/styles/base.css';
import '../../frontend/styles/layout.css';
import '../../frontend/styles/components/home.css';
import '../../frontend/styles/components/shell-notebook.css';
import '../../frontend/styles/components/tabs.css';
import '../../frontend/styles/components/seg.css';
import '../../frontend/styles/components/chips.css';
import '../../frontend/styles/components/list.css';
import '../../frontend/styles/components/finder.css';
import '../../frontend/styles/components/ivrank.css';
import '../../frontend/styles/components/tag.css';
import '../../frontend/styles/components/modal.css';
import '../../frontend/styles/components/search.css';
import '../../frontend/styles/components/drawer.css';
import '../../frontend/styles/components/pages.css';
import '../../frontend/styles/components/planner.css';
import '../../frontend/styles/components/updates.css';
import '../../frontend/styles/components/consent.css';
import '../../frontend/styles/components/trial.css';
import '../../frontend/styles/components/app-shell.css';
import '../../frontend/styles/components/pc-theme.css';
import '../../frontend/styles/pixel.css';
// 마지막 — v3 CSS 를 다 실은 뒤에 래퍼 하나만 지운다
import './root.css';
import './design.css';
