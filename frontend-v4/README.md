# moncamp v4 — React 전환 미리보기

**미리보기 주소 — https://dev.moncamp.kr/react/**

계획 문서는 노션 `05. moncamp v4.0.0 React 전환 계획` 에 있다. 이 폴더는 그 계획의 **Phase 0~3 일부**를 실제로 만들어 본 것이다.

## 무엇이 들어 있나

| | |
| --- | --- |
| 빌드 | Vite 6 |
| 언어 | TypeScript 5.7 (`strict` · `noUncheckedIndexedAccess`) |
| UI | React 19 |
| 클라이언트 상태 | Zustand 5 |
| 서버 상태 | TanStack Query 5 |
| 스타일 | **v3 의 `frontend/styles/**` 를 한 줄도 안 고치고 그대로** (`src/styles.ts`) |

## 디자인을 그대로 유지하는 방법

1. **CSS 를 옮기지 않는다.** CSS Modules·Tailwind 로 가면 클래스명이 바뀌고, 그 클래스명은 회귀 34 스위트가 붙잡고 있는 계약이다 — 디자인과 검사가 같이 깨진다.
2. **클래스명·DOM id·`data-*` 를 v3 와 같게 쓴다.** `.app-bar` · `#app-nav` · `#page-head` · `#menu-planner` · `body[data-route]` …
3. **구조까지 같아야 한다.** 클래스명만 맞추고 중간 칸을 빼먹었더니 홈의 `pick__row` 에서 이름이 세로로 한 글자씩 쪼개졌다. CSS 가 `.pick__row > .pick__body` 를 flex 자식으로 잡고 있어서다. (`src/screens/Home.tsx` 주석)

## 돌려 보기

```bash
python3 backend/build.py      # 저장소 루트에서 — dist/data.js 를 만든다
cd frontend-v4
npm install
npm run build                 # data 추출 → typecheck → vite build
```

`npm run data` 가 `dist/data.js` · `dist/data-lazy.js` 를 `vm` 으로 실행해 전역을 꺼내고 `public/data/*.json` 으로 가른다. **전환 기간의 다리다** — Phase 1 을 정식으로 끝내면 `backend/build.py` 가 바로 JSON 을 쓰고 이 스크립트는 지운다. 지금 이 방식의 이점은 JSON 이 v3 가 화면에 쓰는 값과 **정의상 같다**는 것이다.

## 지금까지 옮긴 것

| 화면 | 상태 |
| --- | --- |
| 셸 (머리줄 · 왼쪽 메뉴 · 서랍 · 화면 머리 · 바닥 · 맨 위로) | ✅ |
| 서비스 홈 | ✅ |
| 포켓몬 도감 (검색 · 타입 필터 · 그리드/리스트) | ✅ |
| 포켓몬 상세 팝업 (종족값 · CP · 기술 · 상성) | ✅ |
| D-MAX 티어표 (전체/딜러/탱커 · 보스 타입 칩 · 미구현 포함) | ✅ |
| 레이드 PvE (일반/전체 · 보스 타입 칩) | ✅ |
| 배틀 PvP (리그 넷) | ✅ |
| 레이드 보스 · 알 부화 · 이벤트 일정 | ✅ |
| 게임 업데이트 (목록) | ✅ |
| 솔플 계산기 · 덱 짜기 · 개체값 순위 · 검색식 | ⏳ Phase 4 |
| 로그인 · 내 포켓몬 · 관리자 | ⏳ Phase 5 |
| 도트 아이콘(pxicon) · i18n(EN) · PWA · GA | ⏳ |

## 번들

| | 크기 | gzip |
| --- | --- | --- |
| CSS | 209KB | 36KB |
| JS (앱) | 247KB | 77KB |
| JS (query) | 47KB | 15KB |
| JS (react) | 4KB | 2KB |

계획 문서의 예산은 **초기 JS 150KB(gzip)** 다. 지금 94KB.

v3 와의 비교는 데이터 로딩 방식이 달라 단순 비교가 안 된다 — v3 는 첫 화면에서 `data.js` 985KB + `app.js` 392KB 를 받고, v4 는 화면이 필요한 묶음만 받는다 (홈은 `max.json` · `updates.json` · `meta.json`).
