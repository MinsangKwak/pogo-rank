# moncamp v4 — React 전환 미리보기

**개발 미리보기: https://dev.moncamp.kr/** — 2026-09-17부터 dev 전체에 React 화면을 적용했습니다. 기존 /react/ 경로는 사용하지 않습니다.

이 폴더는 React 화면의 소스입니다. 초기 계획은 노션 `05. moncamp v4.0.0 React 전환 계획`에 있으며, 아래 전환 표와 번들 수치는 **Phase 0~3 일부를 구현한 당시의 기록**입니다. 현재 구현 범위는 src/screens와 src/components, 최신 변경 이력에서 확인해 주세요.

## 무엇이 들어 있나

| | |
| --- | --- |
| 빌드 | Vite 6 |
| 언어 | TypeScript 5.7 (`strict` · `noUncheckedIndexedAccess`) |
| UI | React 19 |
| 클라이언트 상태 | Zustand 5 |
| 서버 상태 | TanStack Query 5 |
| 스타일 | **초기 전환 시 v3 스타일을 그대로 재사용** (`src/styles.ts`) |

## 디자인을 그대로 유지하는 방법

1. **기존 CSS를 재사용합니다.** CSS Modules·Tailwind로 전환하면 클래스명이 달라져 디자인과 회귀 검사에 영향을 줍니다. 초기 전환에서는 회귀 34개 스위트가 사용하는 이름을 유지했습니다.
2. **클래스명·DOM id·`data-*`는 v3와 동일하게 유지합니다.** `.app-bar` · `#app-nav` · `#page-head` · `#menu-planner` · `body[data-route]` …
3. **CSS가 참조하는 DOM 구조도 유지합니다.** 홈의 중간 요소를 생략했을 때 포켓몬 이름이 한 글자씩 줄바꿈되는 문제가 있었습니다. `.pick__row > .pick__body`가 flex 자식으로 지정되어 있으므로 해당 구조를 유지해야 합니다. (`src/screens/Home.tsx` 주석)

## 돌려 보기

```bash
python3 backend/build.py      # 저장소 루트에서 — dist/data.js 를 만든다
cd frontend-v4
npm install
npm run build                 # data 추출 → typecheck → vite build
```

`npm run data`는 `dist/data.js`·`dist/data-lazy.js`를 `vm`으로 실행하여 데이터를 읽고 `public/data/*.json`으로 분리합니다. v3와 같은 원본을 사용하므로 계산 결과의 차이를 줄일 수 있습니다. Phase 1 계획은 `backend/build.py`가 JSON을 직접 생성하도록 전환한 뒤 이 추출 단계를 제거하는 것입니다.

## 지금까지 옮긴 것

아래 표는 초기 전환 당시의 상태이며 현재 미구현 목록이 아닙니다.

| 화면 | 초기 전환 당시 상태 |
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

초기 계획의 JS 예산은 **150KB(gzip)**이며, 당시 측정값은 94KB였습니다. 위 수치는 현재 빌드 크기를 의미하지 않습니다.

v3와 v4는 데이터 로딩 방식이 달라 번들 크기만으로 비교하기 어렵습니다. 당시 v3는 첫 화면에서 `data.js` 985KB와 `app.js` 392KB를 받았고, v4는 화면에 필요한 데이터만 나누어 받았습니다 (홈은 `max.json` · `updates.json` · `meta.json`).
