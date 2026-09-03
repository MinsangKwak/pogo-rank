# POGO NOTE 개발 문서

이 문서는 POGO NOTE가 어떤 데이터를 어디서 가져와, 어떻게 가공·병합해, 어떤 구조로 화면에 올리는지를 상세히 기록합니다. README가 "무엇을 하는 서비스인가"라면, 이 문서는 "어떻게 만들어져 있는가"입니다.

## 1. 개발 방식 개요

- **프레임워크 없는 바닐라 JS 정적 사이트**입니다. 서버·DB·외부 API 호출이 전혀 없고, 모든 데이터는 **빌드 시점에** 수집·계산되어 정적 파일로 구워집니다. 사용자는 완성된 파일만 내려받습니다.
- 백엔드는 **파이썬 표준 라이브러리만** 사용합니다 (pip 설치 불필요). 프론트는 `el()` 헬퍼 하나로 DOM을 조립하는 컴포넌트 함수들입니다.
- 배포는 GitHub Actions가 **매일 00:00 KST**와 main 푸시 시 전체 파이프라인을 돌려 GitHub Pages에 올립니다. 즉 "데이터 갱신 = 재빌드"입니다.
- v2.0.0부터 산출물은 세 덩어리입니다: `index.html`(앱 껍데기+JS+CSS, ~110KB) + `data.js`(모든 게임 데이터, ~1.2MB) + `sprites/*.png`(개별 이미지, lazy 로딩).

## 2. 데이터 소스 (API)

전부 GitHub에 공개된 정적 파일이며, raw.githubusercontent.com 또는 "웹에 게시"된 구글 시트에서 받습니다. 인증 키가 필요한 API는 없습니다.

| 소스 | URL | 가져오는 것 | 쓰이는 곳 |
|---|---|---|---|
| **PvPoke** | `pvpoke/pvpoke` 저장소 `src/data/rankings/all/overall/rankings-{500,1500,2500,10000}.json` | 리그별 PvP 순위·점수·추천 기술 | PvP 탭 |
| **PvPoke gamemaster** | 같은 저장소 `src/data/gamemaster.json` | 종별 `released` 플래그(출시 여부), speciesId·폼 이름 | 미출시 필터, 도감 [미구현] 태그, 한글 이름 매칭 |
| **PokeMiners game_masters** | `PokeMiners/game_masters` `latest/latest.json` | 게임 원본 추출본 — 종족값·기술 목록·타입·상성 배율·CPM 배열·다이맥스/거다이맥스 매핑·전설/환상/UB 클래스·메가 폼 스탯 | PvE/맥스 계산, 상세 팝업, CP 계산기, 티어 자동 판정 |
| **PokeAPI CSV** | `PokeAPI/pokeapi` `data/v2/csv/{pokemon_species_names,move_names,pokemon,pokemon_species}.csv` | 한글 종·기술 이름, 폼 인덱스 | 모든 한글 표기 |
| **PokeAPI sprites** | `PokeAPI/sprites` `sprites/pokemon/{id}.png` | 도트 스프라이트 (기본 폼 + 메가 `-mega` + 거다이 `-gmax`) | 전 화면 |
| **hawaii 성능표** | 구글 시트 "웹에 게시" URL + `output=csv` | 속성별 레이드 성능표 (DPS·TDO·ER·평가) | PvE 전체 탭 |
| **LeekDuck (ScrapedDuck)** | `bigfoott/ScrapedDuck` `data/events.json` | 전 세계 이벤트·레이드 일정 (현지시간) | 9월 일정표 (수동 반영) |
| **포켓몬고 공식 한국 발표** | pokemongo.com 뉴스 | 한국 전용 이벤트 (피카츄의 한국 나들이 등) | 일정표 보강 (수동) |
| **Bulbapedia** | Dynamax(GO)/Gigantamax(GO) 문서 | 다이맥스·거다이맥스 출시 목록 | `backend/config/max_released.txt` (수동 관리) |
| **pogomate** | pogomate.com (역산 검증) | D-MAX 티어 산정 공식의 기준점 | value_build 티어 공식 |

수동 보정 파일 두 개가 소스를 보완합니다: `backend/config/max_released.txt`(다이맥스 출시), `backend/config/dex_released_extra.txt`(PvPoke released가 놓치는 실출시 종 — 메타몽 등).

## 3. 수집 (scripts/fetch_data.sh)

- 위 소스들을 `data/` 폴더로 내려받습니다. v2.0.0부터 **전부 병렬**(`curl … &` + `wait`)로 받습니다.
- 구글 시트는 탭(gid)별 CSV로 받으며, 탭 목록은 `backend/config/sheets.conf`가 정의합니다. 다운로드 실패해도 빌드는 계속되고 자체 계산으로 대체합니다.
- 스프라이트는 `backend/sprites.py`가 **없는 파일만** 16개 병렬로 받습니다. CI에서는 `actions/cache`가 `data/sprites/`를 배포 간에 유지하므로 신규 종 몇 개만 받습니다.

## 4. 가공·병합 파이프라인 (실행 순서)

각 단계는 `data/`의 원본을 읽어 중간 JSON을 만들고, 마지막에 `build.py`가 전부 병합합니다.

```
fetch_data.sh                 원본 다운로드 (병렬)
  ↓
backend/pve_build.py          [핵심 병합 지점 1: 후보 목록]
  · PokeMiners 게임마스터에서 종·폼·메가·섀도우 후보 생성
  · PvPoke released로 미출시 제거, PokeAPI CSV로 한글 이름 결합 (names.py 공유 모듈)
  · 보스 타입별 DPS/TDO 계산 → data/pve.json, pve_full.json
  · 도감·솔플 계산기용 전 종 목록(이름·타입·종족값) → data/bosses.json
  ↓
backend/build.py (1차)        PvPoke 랭킹 가공 → data/pvp.json
  ↓
backend/value_build.py        맥스 배틀 순위(dynamax.json) · D-MAX 티어표(dynamax_tier.json,
  ·                           pogomate 공식: 공격×위력×자속) · 활용처(value.json)
  ↓
backend/sheet_build.py        시트 CSV 파싱 — 열 자동 감지, 시트 표기→우리 표기 정규화,
  ·                           PvPoke 출시 목록과 대조해 미출시 태그 → data/sheet.json
  ↓
backend/dex_build.py          [핵심 병합 지점 2: 도감]
  · 상성표(chart) · CPM 배열 · 진화 계보(evo) · 전 종 이름(names)
  · 폼별 종족값·기술(forms, 게임마스터+PokeAPI 한글 기술명 병합)
  · 전설/환상/UB 클래스(cls) · 출시 목록(rel = PvPoke released ∪ 수동 보정) → data/dex.json
  ↓
backend/sprites.py            등장 스프라이트 다운로드 (없는 것만, 병렬)
  ↓
backend/build.py (2차)        [최종 조립]
  · frontend/ CSS·JS를 순서대로 이어붙여 index.html의 __STYLES__/__SCRIPTS__ 치환
  · 중간 JSON 전부를 const 선언으로 묶어 dist/data.js 생성
  · data/sprites/*.png → dist/sprites/ 복사, 유효 id 목록(SPRITE_IDS) 주입
  · APP_VERSION·기준일 치환, PWA 정적 파일 복사
```

**이름이 병합의 축**입니다. 서로 다른 소스(PvPoke speciesId, 게임마스터 form 접미사, 시트의 "그림자 뮤츠" 표기)를 `backend/names.py`의 `FORM_KO` 라벨 사전 하나로 "섀도우 뮤츠"·"메가X 리자몽" 같은 표준 한글 이름으로 정규화한 뒤, 그 이름으로 데이터를 잇습니다. 스프라이트 id도 같은 라벨에서 `backend/sprite.py`가 유도합니다(`-mega`, `-gmax` 등).

## 5. 프론트엔드 구조

- `frontend/index.html` — 뼈대. `__STYLES__`/`__SCRIPTS__`/`__VERSION__` 자리표시자.
- `frontend/scripts/dom.js` — `el(tag, attrs, ...children)` 헬퍼 하나가 전체 렌더링의 기반.
- `frontend/scripts/app.js` — 전역 `state` 객체 + `render()`. 탭 전환 = state 변경 후 전체 리렌더.
- `components/` — row(공통 목록 행)·list(더보기)·modal(팝업)·detail(상세)·schedule(달력)·search(전역 검색)·drawer(메뉴)·pages(해시 라우팅: #/dex·#/schedule·#/release)·owned(보유 ☆)·release(패치노트) 등.
- `views/` — 탭별 화면 (pvp·pve·max·tier·usage·ifsolo).
- 상세 팝업은 **여는 곳에 따라** 구성이 달라집니다: 도감에서 열면 능력치 육각형 포함, 순위표·검색에서는 기술 중심 (openDetail의 isDex 플래그).
- 새 CSS/JS 파일은 `backend/build.py`의 `STYLES`/`SCRIPTS` 목록에 등록해야 번들에 포함됩니다.

## 6. 캐싱·오프라인 (PWA)

- `sw.js`(서비스워커, github.io에서만 등록): 페이지와 `data.js`는 **네트워크 우선**(항상 최신, 실패 시 캐시), `sprites/*.png`는 id별 불변이라 **캐시 우선**입니다.
- 따라서 재방문 시 실질 다운로드는 data.js 1.2MB뿐이고, 이미지·앱은 캐시에서 즉시 뜹니다.

## 7. 버전·기록 관리

- `vMAJOR.MINOR.PATCH` — 큰 기능은 MINOR, 상세·버그는 PATCH. 릴리스 시 갱신 위치: `backend/build.py`의 `APP_VERSION`(화면 표기) · `CHANGELOG.md` · README 버전 이력 표 · 노션 QA 트래커의 버전 속성 · `release.js`의 패치노트.
- 이슈는 노션 "pogo-rank QA 트래커"에서 관리합니다 (작업 전 / 작업 후(버전별) 뷰).
