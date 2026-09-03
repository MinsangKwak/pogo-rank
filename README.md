# POGO SEARCH — 편하게 검색하세요

(구 POGO NOTE)

포켓몬고 랭킹(D-MAX·PvE·PvP·활용처), 도감, 월 일정표, 솔플 레이드 계산기를 한 페이지에서 보는 친구용 정적 사이트입니다.
외부 API 없이 GitHub에 공개된 원본 데이터만으로 매일 자동 빌드·배포되며, 홈 화면에 설치(PWA)해 앱처럼 쓸 수 있습니다.

> https://minsangkwak.github.io/pogo-rank/

## 버전 관리

`vMAJOR.MINOR.PATCH` — 큰 기능이 들어가면 두 번째 자리(MINOR), 상세 기능·버그 수정은 세 번째 자리(PATCH)를 올립니다.
버전은 이 README의 버전 이력, `CHANGELOG.md`, 노션 QA 트래커의 버전 속성에서 함께 관리합니다.

### 버전 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| **v2.3.0** | 2026-09-03 | 첫 화면 로딩 가림막, 트레이너 코드 메뉴는 승인된 로그인 사용자에게만 노출, 관리자 판정을 이메일 → uid로 교체(공개 저장소에서 관리자 지메일 제거) |
| **v2.2.0** | 2026-09-03 | 🔐 Google 로그인 + 관리자 승인제 + 계정 즐겨찾기 ★(도감 채우기, Firebase Auth/Firestore, 서버 없음) — 기존 보유 ☆ 제거. 설정: docs/AUTH_SETUP.md |
| **v2.1.0** | 2026-09-03 | IF 탭 실험실 개편 — PvP 추천 덱 3종(이유 자동 생성)·커스텀 덱 짜기(상대 슬롯·분석·카운터 이유), 헤더 단순화, GA4 사용 통계 연결, 문의 이메일 |
| v2.0.1 | 2026-09-03 | 도감 2열 토글·[미구현] 태그, D-MAX 티어표 pogomate 대조 보정, 개발 문서 |
| **v2.0.0** | 2026-09-03 | 성능 개편 — 단일 HTML 분리(HTML 112KB + data.js + 개별 스프라이트 lazy 로딩), CI 스프라이트 캐시·병렬 다운로드 |
| v1.5.1 | 2026-09-03 | 상세 팝업 일반/도감 분리, 기술 간격 정리 |
| **v1.5.0** | 2026-09-03 | 📕 도감 페이지 신설(넘버링순 전 종·세대 점프·번호 검색), 상세 팝업 도감형 재배치 |
| v1.4.1 | 2026-09-03 | 모바일 목록 레이아웃 버그·입력 확대 방지, 검색 통합, 상세 팝업 개편(CP 헤더·내 개체 CP 계산기·능력치 육각형) |
| **v1.4.0** | 2026-09-03 | 드로어 메뉴·해시 라우팅 페이지·전역 검색·보유 체크·트레이너 코드·PWA 홈 화면 설치 |
| v1.3.1 | 2026-09-02 | 솔플 계산기 고도화 — 보스 검색형·부활 운용 실측 보정·내 덱 검증·딜 총량 결론 |
| **v1.3.0** | 2026-09-02 | IF 탭 신설 — 실측 제공자: 솔플 레이드 계산기 |
| **v1.2.0** | 2026-09-02 | D-MAX 고도화 — pogomate 기준 티어·티어 근거·이번 주 보스·카운터 추천 |
| v1.1.1 | 2026-09-02 | 일정 한국 기준 보정 — LeekDuck 원본·특별 기간·한국 전용 이벤트 |
| **v1.1.0** | 2026-09-02 | POGO NOTE 리브랜딩, 9월 일정표 달력, 업데이트 소식, PvE 탭 통합, D-MAX 표기 |
| **v1.0.0** | 2026-09-01 | 첫 정식판 — 랭킹 도감(다이맥스·PvE·PvP·활용처), 포켓몬 상세 팝업, 매일 자동 빌드 |

## 기능

**탭**
- **D-MAX** — 티어표(pogomate 기준: 공격 × 맥스무브 위력 × 자속, 1위 대비 %), 행을 누르면 선정 근거·카운터 한 줄, 상단 "⚔️ 이번 주 보스" 아코디언(추천 딜러 5개씩 더보기)
- **PvE** — 일반(구하기 쉬운 개체 티어표) / 전체(hawaii 성능표 + 자체 계산) 토글
- **PvP** — 리틀·슈퍼·하이퍼·마스터 리그, PvPoke 점수·추천 기술
- **활용처** — 포켓몬 하나가 어디서 상위권인지 한 줄 요약
- **IF** — 실측 제공자: 솔플 레이드 계산기. 보스 이름 검색 → 티어 자동 판정 → 부활 운용(기절 직전 이탈→부활→재진입) 시뮬레이션으로 필요 개체·예상 시간·딜 총량 결론. 내 덱 검증·풀강·버프 토글

**도감 (메뉴 → 📕)**
- 넘버링순 전 종 목록(스프라이트·타입), 이름/번호 검색 + 1~9세대 점프
- 상세 팝업: 타입 → 이름 → CP(만렙|야생·부스트) → 내 개체 CP 계산기(레벨·IV 슬라이더) → 능력치 육각형|기술 → 상성 → 활용처 → 진화

**공통**
- 📅 월 일정표 달력(LeekDuck 원본 + 한국 공식 발표, 드로어·전체 화면), 전역 포켓몬 검색, 🔐 Google 로그인(승인제)·즐겨찾기 ★(계정 저장, 도감 채우기), 트레이너 코드 복사(로그인·승인된 사용자만), 패치노트(#/release)
- PWA 홈 화면 설치·오프라인 열람(페이지·데이터는 네트워크 우선, 스프라이트는 캐시 우선), 다크 모드, 프레임워크·의존성 없는 바닐라 JS (v2.0.0부터 HTML + data.js + 개별 스프라이트 구조)

## 로그인 · 즐겨찾기 설정

Google 로그인은 Firebase Authentication + Firestore로 동작하며(정적 사이트, 서버 없음), 관리자가 승인한 친구만 즐겨찾기를 저장할 수 있습니다. 콘솔 설정 5단계와 데이터 구조는 [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md), 보안 규칙은 [firestore.rules](firestore.rules) 참고. `backend/build.py`의 `FIREBASE_CONFIG`가 비어 있으면 로그인 UI가 표시되지 않습니다.

## 개발 문서

데이터를 어디서 가져와 어떻게 가공·병합하는지, 프론트 구조와 캐싱 전략은 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)에 상세히 정리되어 있습니다.

## 데이터 소스

| 용도 | 출처 |
|---|---|
| PvP 랭킹, 기술 조합 | [PvPoke](https://github.com/pvpoke/pvpoke) `rankings/all/overall/rankings-{cp}.json` |
| 포켓몬·기술 마스터(PvP) | PvPoke `gamemaster.json` |
| 종족값·기술·상성표·CP 배율(PvE), 다이맥스·거다이맥스 목록 | [PokeMiners game_masters](https://github.com/PokeMiners/game_masters) `latest/latest.json` |
| 한글 이름, 폼 인덱스 | [PokeAPI](https://github.com/PokeAPI/pokeapi) CSV |
| 다이맥스·거다이맥스 출시 목록 | Bulbapedia (수동 관리, `backend/config/max_released.txt`) |
| 스프라이트 | [PokeAPI/sprites](https://github.com/PokeAPI/sprites) |
| 월 일정표 | [LeekDuck 원본 JSON(ScrapedDuck)](https://github.com/bigfoott/ScrapedDuck) + 포켓몬고 공식 한국 발표 |

## PvE 계산 기준

| 항목 | 값 |
|---|---|
| 레벨 / 개체값 | 40 / 15·15·15 |
| 보스 방어 · 초당 피해 | 200 · 30 (고정 가정) |
| 데미지 | `floor(0.5 × 위력 × 공격/방어 × 배율) + 1` |
| 배율 | STAB 1.2 · 상성 1.6 / 0.625 · 섀도우 공격 1.2, 방어 0.8333 |
| DPS | 차지기 1회 사이클 기준 `(스피드기 총합 + 차지기) / 소요 시간` |
| TDO | `DPS × 체력 / (보스 DPS × 100 / 방어)` |
| 종합 점수 | `DPS³ × TDO / 1000` |

보스 방어·DPS를 고정값으로 두어 내구형 포켓몬이 실제보다 높게 나올 수 있습니다. `backend/pve_build.py` 상단 상수로 조정할 수 있습니다.

## 구글 시트 수집 방식

`scripts/fetch_data.sh`가 시트의 "웹에 게시" 주소에 `output=csv`를 붙여 탭별 CSV를 받고, `backend/sheet_build.py`가 열 구조를 자동 감지해 파싱합니다.

- 탭 목록은 `backend/config/sheets.conf`에 `이름 gid` 한 줄씩. 시트 주인이 게시를 유지하는 한 계속 동작
- 섹션(타입) 행과 헤더 행(포켓몬·스피드·차지·DPS·TDO·종합·티어·순위 키워드)을 자동으로 찾음
- 시트 표기("그림자 뮤츠", "리자몽(메가X)")를 우리 표기("섀도우 뮤츠", "메가X 리자몽")로 정규화해 스프라이트·타입을 붙임
- 헤더 행(`포켓몬`·`일반공격`·`차징공격`·`DPS`·`TDO`·`ER`·`종합(%)`·`평가`)으로 열 위치를 잡고, 타입 블록은 0열 병합 셀로 판정
- 이름의 각주(¹ ²)는 같은 포켓몬의 기술 조합 변형, 줄바꿈·`|` 뒤 텍스트는 메모(`note`)로 분리. `그림자 X`·`X(메가Y)`·`X(APEX)`·`정화 X` 등을 우리 표기로 정규화
- PvPoke 출시 목록에 없는 항목(미출시 메가 등)은 `미출시` 태그를 붙이고 기본 종 스프라이트로 표시
- 시트 맨 아래 게임프레스 기준 전체 표는 출처가 달라 제외. PvE 탭의 `전체`는 자체 계산
- 빌드가 받은 원본 CSV와 감지 리포트는 `snapshot/` 폴더로 저장소에 자동 커밋됨(`[skip ci]`). 열이 잘못 잡히면 `snapshot/sheet_report.txt`를 보고 `backend/sheet_build.py`의 `COLS` 키워드를 손보면 됨
- 다운로드나 파싱이 실패해도 빌드는 멈추지 않고 자체 계산으로 대체

## 출시 여부 필터

게임마스터에는 미출시 콘텐츠(메가 개굴닌자·마폭시·브리가론·폭타, 섀도우 히스이 폼 등)가 먼저 들어가 있어 그대로 쓰면 없는 포켓몬이 순위에 오릅니다. 그래서 PvE·맥스·일반 티어·활용처의 모든 후보는 **PvPoke `gamemaster.json`의 `released` 플래그**로 걸러냅니다. 메가·섀도우·지역폼까지 개별 종 단위로 판정하며, 한글 이름이 PvPoke 출시 목록에 없으면 후보에서 빠집니다(빌드 로그에 `dropped` 개수와 예시가 찍힘). 폼 라벨은 `backend/names.py`의 `FORM_KO` 한 곳에서 관리해 PvP와 PvE의 이름이 항상 일치합니다.

## 맥스 배틀 계산 기준

| 항목 | 값 |
|---|---|
| 맥스어택 위력 | 350 (3레벨) — 게임마스터에 없어 공개 수치를 상수로 사용 |
| 거다이맥스 위력 | 450 (3레벨) |
| 맥스어택 타입 | 보유 스피드기 타입 중 보스 상대 최고 피해 |
| 거다이맥스 타입 | 게임마스터 `SOURDOUGH_MOVE_MAPPING_SETTINGS`의 종별 고정 타입 |
| 내구 | 방어 × 체력 ÷ 1000 |
| 정렬 | 1회 피해 × √내구 |

출시 여부는 게임마스터를 믿지 않고 `backend/config/max_released.txt`를 따릅니다. 게임마스터에는 미출시 거다이맥스(멜메탈, 우라오스 등)가 먼저 들어가 있어 그대로 쓰면 없는 포켓몬이 상위에 오릅니다. 목록 출처는 Bulbapedia [Dynamax (GO)](https://bulbapedia.bulbagarden.net/wiki/Dynamax_(GO)) · [Gigantamax (GO)](https://bulbapedia.bulbagarden.net/wiki/Gigantamax_(GO))이며 2026-08-25 기준 다이맥스 138종, 거다이맥스 17종입니다. 새로 출시되면 `D POKEMON_ID [FORM]` / `G POKEMON_ID [FORM]` 한 줄을 추가하면 됩니다(예정 종은 파일 안에 주석으로 미리 적어 둠).

거다이맥스로 계산된 행은 PokeAPI의 거다이맥스 전용 스프라이트(`*-gmax`)를 씁니다.

## PvE 일반 티어표 · 활용처 산식

| 항목 | 값 |
|---|---|
| 대상 | 전설 · 환상 · 울트라비스트 제외(PvPoke 태그), 메가 · 섀도우 폼 제외 |
| 속성 탭 | 그 속성 포켓몬만, 기술 제한 없이 최적 조합 (중립 보스 상대 자체 계산) |
| 점수 | 같은 속성 최강(전설·메가 포함) 대비 (자기 ÷ 최강)^¼ × 100, 속성별 상위 30종 |
| 티어 | 목록 안 상대 등급 — 상위 12% S · 35%까지 A · 65%까지 B · 나머지 C |
| 활용처 | PvP 4리그 · PvE 보스 19종 · 맥스 보스 19종 순위표에서 30위 안에 든 곳. 활용 점수 = Σ(31 − 순위) |

"후반까지 잘 쓰이는"의 정의를 **여러 리그·여러 보스에서 동시에 상위**로 두었습니다. 획득 난이도(진화 사탕, 지역 한정 등)는 반영하지 않습니다.

## 저장소 구조

```
.
├── frontend/              # 프론트엔드 (빌드 시 단일 HTML로 인라인 조립)
│   ├── index.html         #   뼈대 (__STYLES__ · __SCRIPTS__ · 데이터 자리표시자)
│   ├── styles/            #   CSS — tokens(색·다크모드) · base · layout
│   │   └── components/    #     tabs · seg · chips · list · tag
│   └── scripts/           #   JS — data(주입 데이터·상수) · dom(el 헬퍼) · app(상태·렌더)
│       ├── components/    #     type-dots · sprite · row · list · chips · seg
│       └── views/         #     pvp · pve · max · value · usage (탭별 화면)
├── backend/               # 백엔드 (데이터 파이프라인, 파이썬 표준 라이브러리만)
│   ├── build.py           #   PvP 가공 + frontend/ 번들·데이터 주입 → dist/index.html
│   ├── sheet_build.py     #   구글 시트 CSV 파싱 → data/sheet.json (+ sheet_report.txt)
│   ├── pve_build.py       #   PvE DPS/TDO 계산 → data/pve.json, data/pve_full.json
│   ├── value_build.py     #   맥스 배틀 랭킹 → data/dynamax.json, 일반 티어 → data/value.json
│   ├── dex_build.py       #   상세 팝업용 도감(진화·기술·상성·종족값) → data/dex.json
│   ├── names.py           #   한글 이름·폼 라벨·PvPoke 출시 목록 (공유 모듈)
│   ├── sprite.py          #   한글 폼 라벨 → PokeAPI 스프라이트 id 매핑 (거다이맥스 포함)
│   ├── sprites.py         #   랭킹에 쓰인 스프라이트만 다운로드 → base64
│   └── config/
│       ├── sheets.conf        # 수집할 시트 탭(gid) 목록
│       └── max_released.txt   # 출시된 다이맥스/거다이맥스 목록 (수동 관리, Bulbapedia 기준)
├── scripts/               # 실행 스크립트 (어디서 실행해도 저장소 루트 기준으로 동작)
│   ├── build.sh           #   전체 빌드
│   └── fetch_data.sh      #   원본 데이터 다운로드
├── snapshot/              # 매일 빌드가 남기는 시트 원본 CSV·파싱 리포트
├── data/ · dist/          # 빌드 산출물 (커밋 안 함)
└── .github/workflows/deploy.yml   # GitHub Pages 자동 배포
```

새 CSS/JS 파일을 추가하면 `backend/build.py`의 `STYLES` / `SCRIPTS` 목록에 순서에 맞게 등록해야 번들에 포함됩니다.

`data/`, `dist/`는 빌드 산출물이며 커밋하지 않습니다.

## 로컬 실행 절차

Python 3.10+ (표준 라이브러리만 사용), curl만 있으면 됩니다. pip 설치·가상환경 불필요.

**1. 전체 빌드** — 처음 받았거나 최신 데이터로 갱신하고 싶을 때 (원본 다운로드 포함, 몇 분 소요):

```bash
bash scripts/build.sh
```

**2. 결과 확인** — 정적 단일 HTML이라 서버 없이 열면 됩니다:

```bash
open dist/index.html
```

**3. 수정 후 재빌드** — 데이터를 다시 받을 필요 없이 고친 부분만:

| 고친 것 | 실행 |
|---|---|
| 화면 (`frontend/` 의 HTML·CSS·JS) | `python3 backend/build.py` |
| PvE 계산 (`backend/pve_build.py`) | `python3 backend/pve_build.py && python3 backend/build.py` |
| 맥스·일반 티어 (`backend/value_build.py`) | `python3 backend/value_build.py && python3 backend/build.py` |
| 시트 파싱 (`backend/sheet_build.py`) | `python3 backend/sheet_build.py && python3 backend/build.py` |
| 원본 데이터부터 다시 | `bash scripts/build.sh` |

모든 파이썬 스크립트는 저장소 루트에서 실행합니다 (셸 스크립트는 어디서든 가능).

## 배포 절차

최초 1회: 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정.

이후 배포는 전부 자동입니다:

1. 수정 사항을 `CHANGELOG.md`에 기록
2. `main`에 푸시 → GitHub Actions가 빌드·배포 (`.github/workflows/deploy.yml`)
3. 푸시가 없어도 **매일 00:00 KST**(15:00 UTC cron)에 원본 데이터를 다시 받아 자동 재빌드
4. 급하게 다시 배포하려면 GitHub → Actions → "Build and deploy to GitHub Pages" → **Run workflow** 수동 실행

로컬 빌드 산출물(`data/`, `dist/`)은 커밋하지 않습니다 — 배포 서버가 항상 새로 빌드합니다.

## 변경 이력

서비스에 영향을 주는 변경은 [CHANGELOG.md](CHANGELOG.md)에 **버전별**로 기록합니다. 큰 기능은 MINOR, 상세 기능·버그는 PATCH를 올리고, 노션 QA 트래커의 버전 속성과 맞춥니다.

## 설정 바꾸기

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 리그별 표시 개수 (기본 40) | `backend/build.py` → `TOP` |
| PvE 표시 개수 (기본 30) | `backend/pve_build.py` → `TOP` |
| 맥스 표시 개수, 맥스 기술 위력 | `backend/value_build.py` → `TOP`, `MAX_ATTACK_POWER`, `GMAX_POWER` |
| 일반 티어표 진입 조건, 티어 경계 | `backend/value_build.py` → `rel_tier()`, 진입 조건 상수 |
| 다이맥스/거다이맥스 출시 반영 | `backend/config/max_released.txt` |
| 수집할 시트 탭 | `backend/config/sheets.conf` |
| 시트 열 키워드 | `backend/sheet_build.py` → `COLS` |
| 기본 표시 개수 (기본 10) | `frontend/scripts/data.js` → `SHOW` |
| 보스 가정값, 레벨, 개체값 | `backend/pve_build.py` 상단 상수 |
| 폼 한글 라벨 | `backend/names.py` → `FORM_KO` |
| 색상·다크모드 팔레트 | `frontend/styles/tokens.css` |
| 자동 갱신 주기 | `.github/workflows/deploy.yml` → `cron` |

## 데이터 파이프라인

```
scripts/fetch_data.sh    원본 다운로드 (PvPoke · PokeMiners · PokeAPI)
   ↓
backend/pve_build.py    PvE DPS/TDO → data/pve.json, data/pve_full.json
   ↓
backend/build.py        PvP 가공 → data/pvp.json, data/pvp_all.json
   ↓
backend/value_build.py  맥스 랭킹 · 일반 티어 · 활용처 → data/dynamax.json, data/value.json
   ↓
backend/sheet_build.py  구글 시트 CSV 파싱 → data/sheet.json
   ↓
backend/dex_build.py    상세 팝업용 도감 데이터 → data/dex.json
   ↓
backend/sprites.py      등장 포켓몬 스프라이트만 다운로드 → data/sprites.json
   ↓
backend/build.py        frontend/ CSS·JS 번들 + 데이터 주입 → dist/index.html
   ↓
GitHub Pages             deploy.yml이 매일 00:00 KST와 main 푸시 시 실행
```

GitHub Actions의 예약 실행은 수 분~수십 분 늦어질 수 있고, PvPoke·PokeMiners의 갱신 시각은 별도라 하루 지연이 생길 수 있습니다.

## 알려진 한계

- 한글 이름은 본가 게임 번역표 기준이라 포켓몬고 전용 표기와 다를 수 있음. 매칭 실패 시 영문 그대로 노출
- 특수 습득 기술(예: 갈룡승천)이 게임마스터 기술 목록에 없으면 계산에서 빠짐
- 잠재파워는 타입 변형이 많아 타입을 표시하지 않음
- 출시 여부는 PvPoke `released` 플래그를 따르므로 PvPoke 갱신이 늦으면 새 메가·폼이 하루 이틀 늦게 반영될 수 있음
- 다이맥스/거다이맥스 출시 목록은 자동 갱신되지 않음. 새 출시는 `backend/config/max_released.txt`에 수동 추가 필요
- 맥스 배틀은 맥스가드 · 맥스스피릿, 맥스 게이지 충전 속도를 반영하지 않은 간이 지표

## 고지

이 서비스의 정보는 친구들을 위해 만들어졌으며 상업적 목적이 없습니다. Pokémon 및 관련 명칭·이미지는 Nintendo / Creatures Inc. / GAME FREAK inc. / Niantic의 자산이며 이 프로젝트는 원 저작자와 무관합니다. 데이터는 PvPoke, PokeMiners, PokeAPI 프로젝트의 공개 자료를 사용합니다.
