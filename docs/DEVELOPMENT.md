# 개발 문서 — POGO SEARCH

무엇을 하는 서비스인지는 [README](../README.md), 배포·운영 방법은 [운영 문서](OPERATIONS.md)에 있습니다.
이 문서는 **어떻게 만들어져 있고, 왜 그렇게 만들었는가**를 기록합니다.

- [1. 설계 원칙](#1-설계-원칙)
- [2. 의사결정 기록 — 어떤 고민을 했고 어떻게 바꿨나](#2-의사결정-기록--어떤-고민을-했고-어떻게-바꿨나)
- [3. 데이터 소스](#3-데이터-소스)
- [4. 수집 · 가공 파이프라인](#4-수집--가공-파이프라인)
- [5. 계산 기준 (산식)](#5-계산-기준-산식)
- [6. 프론트엔드 구조](#6-프론트엔드-구조)
- [7. 로그인 · 개인 데이터 설계](#7-로그인--개인-데이터-설계)
- [8. 저장소 구조와 로컬 실행](#8-저장소-구조와-로컬-실행)
- [9. 설정 바꾸기](#9-설정-바꾸기)
- [10. 알려진 한계](#10-알려진-한계)

---

## 1. 설계 원칙

| 원칙 | 내용 |
|---|---|
| **서버를 두지 않는다** | GitHub Pages 정적 호스팅. 런타임에 외부 API를 부르지 않고, 모든 데이터는 **빌드 시점**에 계산해 정적 파일로 굽는다. "데이터 갱신 = 재빌드" |
| **의존성을 늘리지 않는다** | 백엔드는 파이썬 표준 라이브러리만(pip 불필요), 프론트는 프레임워크 없이 `el()` 헬퍼 하나로 DOM 조립 |
| **친구 6명 규모에 맞춘다** | 과설계보다 손으로 고칠 수 있는 단순함. 수동 보정 파일(`backend/config/*.txt`)을 부끄러워하지 않는다 |
| **판단 근거를 화면에 남긴다** | 티어·추천에는 "왜 이 값인지" 한 줄을 같이 보여준다. 숫자만 있는 표는 신뢰받지 못한다 |
| **모바일 우선** | 실제 사용처가 게임 중 폰. 입력 확대 방지, 한 손 조작, 첫 화면 로딩 최소화 |

산출물은 세 덩어리입니다 (v2.0.0~): `index.html`(앱 껍데기+JS+CSS, ~110KB) + `data.js`(게임 데이터, ~1.2MB) + `sprites/*.png`(개별 이미지, lazy 로딩).

---

## 2. 의사결정 기록 — 어떤 고민을 했고 어떻게 바꿨나

### 2.1 성능: React로 갈 것인가 (v2.0.0)

**문제** — 단일 HTML에 스프라이트를 base64로 인라인하다 보니 3.0MB 한 덩어리가 됐고, 배포도 느려졌다.

**검토** — React/Vue 마이그레이션을 후보에 올렸지만 채택하지 않았다. 데이터가 빌드 타임에 고정되고 상호작용이 "목록 렌더 + 팝업" 수준이라 가상 DOM의 이득이 적고, 런타임 번들이 오히려 초기 전송량을 늘린다. 병목은 렌더링 방식이 아니라 **한 파일에 다 넣은 구조**였다.

**결정** — 프레임워크 대신 산출물 분리: HTML / `data.js` / 개별 스프라이트(lazy). 서비스워커는 페이지·데이터를 네트워크 우선, 스프라이트를 캐시 우선으로 나눴다.

**결과** — 초기 전송 3.0MB → 1.2MB, 첫 목록 표시 1.47s → 1.05s(CPU 4× 스로틀 기준). CI에는 스프라이트 캐시를 붙여 배포 시간도 줄였다.

### 2.2 D-MAX 티어를 커뮤니티 기준에 맞춤 (v2.0.1)

**문제** — 자체 공식으로 만든 티어가 친구들이 보는 pogomate와 어긋나 "이 표 맞아?"가 반복됐다.

**분석** — pogomate를 역산해 보니 내구를 빼고 **공격 × 맥스무브 위력 × 자속(1.2)** 만 쓰고, 다이맥스와 거다이맥스를 분리하고 있었다. 우리 표는 (a) 내구를 섞었고 (b) 타입 탭을 "그 타입을 보유한 종"으로 나눠 할비롱(드래곤 맥스무브)이 노말 탭에 올라와 있었다.

**결정** — 공식을 pogomate와 동일하게 맞추고, 타입 탭 분류 기준을 **그 타입 맥스무브를 쓰는 딜러**로 바꿨다. 연격의 우라오스처럼 이중 자속인 종은 양쪽 탭에 각각 표시하고 전체 탭에서만 중복을 제거한다.

**결과** — 노말·물·불꽃·풀·격투 상위권이 pogomate와 ±2%p 안에서 일치. 판단 근거(점수 분해)를 행 펼침에 노출해 다음 이견은 화면 안에서 확인 가능하게 했다.

### 2.3 일정표는 "전 세계"가 아니라 "한국" (v1.3.x~)

**문제** — 글로벌 이벤트 데이터를 그대로 넣었더니 한국에 없는 레이드(레지 계열)가 표에 남고, 한국 전용 이벤트는 빠졌다.

**결정** — LeekDuck 원본 JSON(ScrapedDuck)을 기준선으로 삼되, 한국 공식 발표를 **수동으로 덧대는** 방식으로 바꿨다. 스포트라이트 아워 요일처럼 해마다 바뀌는 값은 출처를 재검증해 반영한다(2026년은 목요일).

**남은 부채** — `schedule.js`에 월 데이터가 하드코딩돼 있어 달이 바뀌면 손이 필요하다. 자동화는 백로그.

### 2.4 솔플 계산기: 이론값에서 실측 보정으로 (v1.x~v2.x)

**문제** — 초기 계산은 "친구를 부르라"는 결론만 냈다. 실제로는 혼자 잡히는 레이드가 있었다.

**분석** — 실제 클리어 경험을 들어보니 (a) 전멸 후 재입장이 아니라 **기절 직전에 나가서 부활시키고 재진입**하는 운용이었고(로스 13초 → 5.5초), (b) 고정 가정(보스 초당 피해 30)이 어태커 생존을 과소평가했다.

**결정** — 운용 모델을 부활 사이클 시뮬레이션으로 바꾸고, 실측에 맞춰 TDO ×3 · DPS ×1.2로 캘리브레이션. 보스별 방어·공격 종족값으로 다시 스케일링하고, 풀강50·버프 토글을 노출했다.

**원칙** — 캘리브레이션 상수는 코드 상단에 이름을 붙여 모아둔다(`TDO_CAL`, `DPS_CAL`, `REVIVE_LOSS`). 실측이 더 쌓이면 상수만 고친다.

### 2.5 "출시 여부"를 한 소스에 맡기지 않음

**문제** — 게임마스터에는 미출시 콘텐츠가 미리 들어 있어 없는 포켓몬이 순위에 오른다. 그래서 PvPoke의 `released`로 걸렀는데, 이번엔 메타몽·껍질몬 같은 실제 출시 종이 도감에서 [미구현]으로 표시됐다.

**원인** — PvPoke의 `released`는 "PvP에서 쓸 수 있는가"에 가까운 플래그다. 대체 소스(pogoapi.net)는 네트워크 정책상 사용 불가.

**결정** — `PvPoke released ∪ 수동 화이트리스트`(`backend/config/dex_released_extra.txt`, 15종)로 합쳤다. 다이맥스 출시 목록도 같은 이유로 Bulbapedia 기준 수동 관리(`max_released.txt`).

### 2.6 이름을 병합의 축으로 (전 구간)

세 소스가 같은 포켓몬을 다르게 부른다(PvPoke `speciesId`, 게임마스터 form 접미사, 시트의 "그림자 뮤츠"). 중간 키를 새로 만들지 않고 **표준 한글 이름 하나**로 정규화한 뒤 그 이름으로 잇는다. 라벨 사전은 `backend/names.py`의 `FORM_KO` 한 곳뿐이고, 스프라이트 id도 같은 라벨에서 `backend/sprite.py`가 유도한다(`-mega`, `-gmax`). 새 폼이 생기면 고칠 곳이 한 군데다.

### 2.7 로그인: 서버 없이 승인제 (v2.2.0)

**요구** — 구글 계정만 허용하고, 관리자가 승인한 사람만 쓰게 한다. 즐겨찾기는 계정에 저장해 기기를 바꿔도 유지한다.

**결정** — Firebase Authentication(Google) + Firestore. 접근 제어는 클라이언트 코드가 아니라 **보안 규칙**이 한다(코드는 UI만 가린다). 승인 목록 `allowlist`, 요청 `requests`, 개인 데이터 `users/{uid}`로 분리.

**초기 로딩 보호** — SDK를 첫 렌더 뒤에 지연 로드한다. `FIREBASE_CONFIG`가 비어 있으면 로그인 UI 자체가 빌드에 들어가지 않아, 설정 없이도 나머지 기능이 그대로 동작한다.

**대체된 것** — 기기 localStorage에 저장하던 보유 ☆와 "★ 보유만" 필터는 계정 즐겨찾기로 흡수해 제거했다.

### 2.8 공개 저장소에서 개인정보 걷어내기 (v2.2.1 / v2.3.0)

- **트레이너 코드 10개 + 친구 별명** — 공개 저장소에 평문으로 있었다. Firestore `trainers` 컬렉션으로 옮기고(관리자만 쓰기, 승인자만 읽기), 비로그인 상태에서는 메뉴 항목 자체를 감춘다. 관리자용 일괄 등록 UI를 붙여 코드가 소스로 돌아올 여지를 없앴다.
- **푸터 헌정 문구(To. …)** — 실명 노출이라 삭제.
- **관리자 이메일** — 규칙과 빌드 설정에 지메일이 박혀 있었다. 로그인 후 발급되는 **uid**로 교체(`ADMIN_UID` ↔ 규칙 `isAdmin()`). 둘은 항상 같은 값이어야 한다.
- **과거 커밋** — 파일에서 지워도 히스토리에는 남으므로, 저장소 히스토리를 새로 시작(orphan 커밋 + force push)했다.
- **공개돼도 되는 값** — Firebase `apiKey`, GA4 측정 ID는 비밀이 아니라 식별자다. 실제 방어선은 Firestore 규칙과 승인된 도메인 설정이다.

### 2.9 사용 통계를 "탭 재배치"에 쓸 수 있게 (v2.1.0~)

**목적** — 어떤 탭을 많이 쓰는지 보고 탭 순서를 바꾸려는 것.

**설계** — 파라미터로 넣으면 GA에서 맞춤 측정기준을 등록해야 순위가 보인다. 그래서 **탭 이름을 이벤트 이름에 포함**(`tab_max`, `tab_pvp` …)해 설정 없이 이벤트 목록이 곧 순위표가 되게 했다. 접속 시 기본으로 보이는 탭은 클릭이 아니므로 `tab_start`로 분리해 통계를 오염시키지 않는다. 서브탭은 `sub_pve_*`, `sub_if_*`.

### 2.10 CI가 조용히 실패하던 문제 (v2.3.0)

**증상** — 배포가 계속 실패하는데 로컬 빌드는 정상.

**원인** — `curl -sSL`에 `-f`가 없어 429/5xx 응답 본문이 그대로 `*.json`으로 저장되고, 다음 단계가 깨진 JSON을 읽다 죽었다. 짧은 간격으로 여러 번 푸시할 때 재현.

**결정** — 다운로드에 `-f` + 재시도(5회), 받은 JSON 파싱 검증, 구글 시트 실패 시 저장소 `snapshot/` 사본으로 대체. 배포를 막을 이유가 없는 보조 커밋 단계는 `continue-on-error`로 내렸다.

**원칙** — 외부 의존은 반드시 "실패를 실패로 드러내되, 배포는 막지 않는" 형태로 감싼다.

---

## 3. 데이터 소스

전부 GitHub 공개 정적 파일 또는 "웹에 게시"된 구글 시트입니다. 인증 키가 필요한 API는 없습니다.

| 소스 | 위치 | 가져오는 것 | 쓰이는 곳 |
|---|---|---|---|
| **PvPoke** | `pvpoke/pvpoke` → `src/data/rankings/all/overall/rankings-{500,1500,2500,10000}.json` | 리그별 순위·점수·추천 기술 | PvP 탭, PvP 덱 짜기 |
| **PvPoke gamemaster** | 같은 저장소 `src/data/gamemaster.json` | `released` 플래그, speciesId·폼 이름 | 미출시 필터, 도감 [미구현], 이름 매칭 |
| **PokeMiners** | `PokeMiners/game_masters` → `latest/latest.json` | 종족값·기술·타입 상성·CPM·다이맥스 매핑·클래스·메가 스탯 | PvE/맥스 계산, 상세 팝업, CP 계산기 |
| **PokeAPI CSV** | `PokeAPI/pokeapi` → `data/v2/csv/*.csv` | 한글 종·기술 이름, 폼 인덱스 | 모든 한글 표기 |
| **PokeAPI sprites** | `PokeAPI/sprites` → `sprites/pokemon/{id}.png` | 도트 스프라이트(기본·`-mega`·`-gmax`) | 전 화면 |
| **hawaii 성능표** | 구글 시트 "웹에 게시" + `output=csv` | 속성별 레이드 성능표(DPS·TDO·ER·평가) | PvE 전체 탭 |
| **LeekDuck (ScrapedDuck)** | `bigfoott/ScrapedDuck` → `data/events.json` | 이벤트·레이드 일정 | 월 일정표 (수동 반영) |
| **포켓몬고 공식 한국 발표** | pokemongo.com 뉴스 | 한국 전용 이벤트 | 일정표 보강 (수동) |
| **Bulbapedia** | Dynamax(GO) / Gigantamax(GO) | 다이맥스·거다이맥스 출시 목록 | `config/max_released.txt` (수동) |
| **pogomate** | pogomate.com | D-MAX 티어 공식의 기준점 | `value_build.py` 티어 공식 |

수동 보정 파일: `backend/config/max_released.txt`(다이맥스 출시), `backend/config/dex_released_extra.txt`(PvPoke가 놓치는 실출시 종).

---

## 4. 수집 · 가공 파이프라인

```
scripts/fetch_data.sh          원본 병렬 다운로드 (-f + 재시도 5회 + JSON 검증)
  ↓                             시트 실패 시 snapshot/ 사본으로 대체
backend/pve_build.py           [병합 지점 1: 후보 목록]
  · 게임마스터에서 종·폼·메가·섀도우 후보 생성
  · PvPoke released로 미출시 제거, PokeAPI CSV로 한글 이름 결합 (names.py)
  · 보스 타입별 DPS/TDO 계산            → data/pve.json, pve_full.json
  · 도감·솔플 계산기용 전 종 목록        → data/bosses.json
  ↓
backend/build.py (1차)         PvPoke 랭킹 가공 → data/pvp.json
  ↓
backend/value_build.py         맥스 순위 · D-MAX 티어(pogomate 공식) · 활용처
  ↓
backend/sheet_build.py         시트 CSV 파싱(열 자동 감지·표기 정규화) → data/sheet.json
  ↓
backend/dex_build.py           [병합 지점 2: 도감]
  · 상성표 · CPM(l20/l25/l30/l35/l50) · 진화 계보 · 전 종 이름
  · 폼별 종족값·기술 · 메가/원시 폼(megas) · 클래스 · 출시 목록 → data/dex.json
  ↓
backend/sprites.py             없는 스프라이트만 16개 병렬 다운로드
  ↓
backend/build.py (2차)         [최종 조립]
  · frontend/ CSS·JS를 순서대로 이어붙여 __STYLES__ / __SCRIPTS__ 치환
  · 중간 JSON을 const 선언으로 묶어 dist/data.js 생성
  · 스프라이트 복사 + 유효 id 목록(SPRITE_IDS) 주입
  · APP_VERSION · 기준일 · GA 스니펫 · Firebase 설정 주입, PWA 파일 복사
```

`SPRITE_INLINE=1 python3 backend/build.py`로 빌드하면 예전 방식(단일 HTML, 이미지 인라인)이 나옵니다 — 미리보기 공유용.

---

## 5. 계산 기준 (산식)

### PvE (자체 계산)

| 항목 | 값 |
|---|---|
| 레벨 / 개체값 | 40 / 15·15·15 |
| 보스 방어 · 초당 피해 | 200 · 30 (고정 가정) |
| 데미지 | `floor(0.5 × 위력 × 공격/방어 × 배율) + 1` |
| 배율 | STAB 1.2 · 상성 1.6 / 0.625 · 섀도우 공격 1.2, 방어 0.8333 |
| DPS | 차지기 1회 사이클 기준 `(스피드기 총합 + 차지기) / 소요 시간` |
| TDO | `DPS × 체력 / (보스 DPS × 100 / 방어)` |
| 종합 점수 | `DPS³ × TDO / 1000` |

보스 방어·DPS가 고정값이라 내구형이 실제보다 높게 나올 수 있습니다(`backend/pve_build.py` 상단 상수).

### 맥스 배틀 · D-MAX 티어

| 항목 | 값 |
|---|---|
| 맥스어택 위력 | 350 (3레벨, 게임마스터에 없어 공개 수치 사용) |
| 거다이맥스 위력 | 450 (3레벨) |
| 맥스어택 타입 | 보유 스피드기 타입 중 보스 상대 최고 피해 |
| 거다이맥스 타입 | 게임마스터 `SOURDOUGH_MOVE_MAPPING_SETTINGS` 종별 고정 |
| 맥스 배틀 정렬 | 1회 피해 × √내구 (내구 = 방어 × 체력 ÷ 1000) |
| **D-MAX 티어 점수** | `round(공격) × 위력(거다이 450 / 다이 350) × 1.2(자속)` — 1위 대비 % 표시 |
| 타입 탭 분류 | 그 타입 **맥스무브를 쓰는** 딜러 (이중 자속은 양쪽 표시, 전체 탭만 중복 제거) |

### PvE 일반 티어표 · 활용처

| 항목 | 값 |
|---|---|
| 대상 | 전설·환상·울트라비스트 제외, 메가·섀도우 제외 |
| 점수 | 같은 속성 최강(전설·메가 포함) 대비 `(자기 ÷ 최강)^¼ × 100`, 속성별 상위 30 |
| 티어 | 상위 12% S · 35%까지 A · 65%까지 B · 나머지 C |
| 활용처 | PvP 4리그 + PvE 보스 19 + 맥스 보스 19에서 30위 안. 점수 = Σ(31 − 순위) |

### 솔플 레이드 계산기 (IF 탭)

| 항목 | 값 |
|---|---|
| 티어 체력·제한 | 1성 600 / 3성 3,600 / 4성 9,000 / 5성·메가 15,000 · 제한 180s(1·3성) / 300s |
| 티어 자동 판정 | 메가·원시 → 메가, 전설·환상·UB → 4성, 최종 진화 → 3성, 그 외 1성 (배지 탭으로 수동 변경) |
| 운용 모델 | 정예 1~2마리를 기절 직전 이탈 → 부활 → 재진입 (교체 1초, 부활 5.5초) |
| 실측 보정 | TDO ×3 · DPS ×1.2, 보스 종족값으로 재스케일(200/def, 200/atk) |
| 토글 | 풀강50(딜 ×1.063, TDO ×1.2), 버프(메가 1.3 / 풀버프 1.6) |
| 레이드 CP | `floor((공격+15) × √(방어+15) × √(티어 체력) / 10)` — 뮤츠 5성 54,148로 검증 |

### PvP 덱 짜기 (IF 탭, 실험)

- 상성 계수 `fit = max(내 자속이 상대를 때리는 배율) ÷ max(상대 타입이 나를 때리는 배율)`
- 커스텀 덱: 리그 점수 × 상대별 fit의 기하평균 순
- 추천 덱 3종: 정석 코어(점수 + 약점 상호 보완 그리디) / 안티 메타(상위 10 상대 평균 상성) / 타입 분산(방어 타입 비중복)
- GO배틀리그 규칙상 **같은 종은 파티에 1마리** — 섀도우·일반도 같은 종으로 보고 종 단위 중복 제거
- 실드·기술 사이클·CP 최적화는 미반영 (근사)

---

## 6. 프론트엔드 구조

- `frontend/index.html` — 뼈대. `__STYLES__` / `__SCRIPTS__` / `__APP_CONFIG__` / `__GA_SNIPPET__` / `__VERSION__` 자리표시자. 첫 화면 로딩 가림막(`#splash`)은 번들 CSS보다 먼저 적용되도록 head에 최소 스타일을 직접 둔다.
- `scripts/dom.js` — `el(tag, attrs, ...children)` 하나가 렌더링의 기반.
- `scripts/app.js` — 전역 `state` + `render()`. 탭 전환 = state 변경 후 전체 리렌더.
- `components/` — row · list · modal · detail · schedule · search · drawer · pages(해시 라우팅 `#/dex`·`#/schedule`·`#/release`) · auth(로그인·즐겨찾기) · trainers · release · track(GA) · totop.
- `views/` — 탭별 화면 (max · pve · tier · pvp · usage · ifsolo).
- 상세 팝업은 **여는 곳에 따라** 구성이 다르다: 도감에서 열면 능력치 육각형 포함, 순위표·검색에서는 기술 중심(`openDetail(p, isDex)`).
- 새 CSS/JS 파일은 `backend/build.py`의 `STYLES` / `SCRIPTS` 목록에 등록해야 번들에 포함된다.

### 캐싱 · 오프라인 (PWA)

`sw.js`는 github.io에서만 등록되며, 페이지와 `data.js`는 **네트워크 우선**(항상 최신, 실패 시 캐시), `sprites/*.png`는 id별 불변이라 **캐시 우선**입니다. 재방문 시 실질 다운로드는 `data.js`뿐입니다.

---

## 7. 로그인 · 개인 데이터 설계

| 컬렉션 | 문서 ID | 내용 | 규칙 |
|---|---|---|---|
| `allowlist` | 이메일(소문자) | 승인된 사용자 | 관리자만 쓰기, 본인 문서 읽기 |
| `requests` | 이메일(소문자) | 가입 요청 | 본인 생성·갱신, 관리자 열람·삭제 |
| `users` | Firebase uid | 즐겨찾기 `favs` 등 | 본인 + 승인된 경우만 |
| `trainers` | 이름 | 트레이너 코드 | 승인자 읽기, 관리자만 쓰기 |

- 상태는 `anon` / `pending`(승인 대기) / `ok` 셋. 화면 요소는 상태에 따라 **숨기고**, 실제 차단은 규칙이 한다.
- 관리자 판정은 `ADMIN_UID`(빌드 설정) ↔ `firestore.rules`의 `isAdmin()` 두 곳이 같은 uid일 때만 성립한다. 규칙은 **콘솔에서 다시 게시**해야 적용된다 — 코드만 배포하면 `permission-denied`.
- 즐겨찾기는 종 단위(도감번호)로 저장해 폼이 달라도 한 마리로 센다.

설정 절차와 운영(승인·해제·코드 등록)은 [운영 문서](OPERATIONS.md)에 있습니다.

---

## 8. 저장소 구조와 로컬 실행

```
.
├── frontend/                     빌드 시 인라인 조립되는 화면 소스
│   ├── index.html                뼈대(자리표시자)
│   ├── styles/ · styles/components/
│   └── scripts/ · scripts/components/ · scripts/views/
├── backend/                      데이터 파이프라인 (파이썬 표준 라이브러리만)
│   ├── build.py                  PvP 가공 + 번들·설정 주입 → dist/
│   ├── pve_build.py              PvE DPS/TDO, 보스 목록
│   ├── value_build.py            맥스 순위 · D-MAX 티어 · 활용처
│   ├── sheet_build.py            구글 시트 파싱
│   ├── dex_build.py              도감(진화·기술·상성·종족값·메가)
│   ├── names.py · sprite.py      이름·폼 라벨 ↔ 스프라이트 id (공유 모듈)
│   ├── sprites.py                스프라이트 다운로드
│   └── config/                   sheets.conf · max_released.txt · dex_released_extra.txt
├── scripts/                      build.sh · fetch_data.sh
├── docs/                         DEVELOPMENT.md(이 문서) · OPERATIONS.md
├── snapshot/                     빌드가 남기는 시트 원본·리포트 (자동 커밋)
├── firestore.rules               Firestore 보안 규칙 (콘솔에 붙여넣어 게시)
├── data/ · dist/                 빌드 산출물 (커밋 안 함)
├── .vscode/                      편집기 공통 설정 (settings·tasks·extensions)
├── .claude/settings.json         Claude Code 공용 권한 설정
└── .github/workflows/deploy.yml  자동 배포
```

Python 3.10+와 curl만 있으면 됩니다.

```bash
bash scripts/build.sh      # 원본 다운로드부터 전체 빌드 (몇 분)
open dist/index.html       # 정적 파일이라 서버 불필요
```

수정 후 재빌드는 고친 범위만:

| 고친 것 | 실행 |
|---|---|
| 화면(`frontend/`) | `python3 backend/build.py` |
| PvE 계산 | `python3 backend/pve_build.py && python3 backend/build.py` |
| 맥스·일반 티어 | `python3 backend/value_build.py && python3 backend/build.py` |
| 시트 파싱 | `python3 backend/sheet_build.py && python3 backend/build.py` |
| 도감·메가 | `python3 backend/dex_build.py && python3 backend/build.py` |
| 원본부터 다시 | `bash scripts/build.sh` |

파이썬 스크립트는 저장소 루트에서 실행합니다(셸 스크립트는 어디서든 가능).

### 편집기 설정 (`.vscode/`)

주 작업 환경이 GitHub Codespaces라 세션을 새로 열 때마다 편집기 설정이 초기화됩니다. 그래서 설정을 저장소에 함께 커밋해 코드 컨벤션이 사람·기기와 무관하게 유지되도록 했습니다.

| 파일 | 역할 |
|---|---|
| `.vscode/settings.json` | 들여쓰기·저장 시 서식·제외 경로 등 편집 규칙 |
| `.vscode/tasks.json` | `Ctrl+Shift+B`로 빌드, 미리보기 서버 실행 |
| `.vscode/extensions.json` | 권장 확장(파이썬·Pylance·Firestore 규칙), 비권장 확장(Prettier) |

정한 규칙과 이유:

- **들여쓰기는 기본 2칸, 파이썬만 4칸.** `editor.detectIndentation`을 꺼서 파일 내용으로 추측하지 않고 항상 이 값을 씁니다.
- **저장 시 서식(`formatOnSave`)은 켜되 자바스크립트·파이썬·마크다운은 끔.** 이 세 곳은 손으로 맞춘 줄바꿈 자체가 가독성 장치입니다. 특히 `el(...)` 호출은 DOM 구조가 보이도록 줄을 나눠 뒀는데 자동 서식이 이를 한 줄로 붙입니다. 마크다운은 표 정렬과 줄 끝 공백이 깨집니다. HTML·CSS·JSON은 켠 채로 둡니다.
- **Prettier는 비권장 확장으로 명시.** 설치되어 있으면 위 규칙과 충돌합니다.
- **줄바꿈 문자는 `\n` 고정.** 윈도우에서 열어도 Codespaces와 같은 diff가 나오도록.
- **`data/`·`dist/`·`snapshot/`·`__pycache__/`는 검색·파일 감시에서 제외.** 원본 JSON이 20MB대이고 스프라이트가 1,100장이 넘어 검색이 느려집니다.
- **`python.analysis.extraPaths: ["./backend"]`** — `from names import ...` 같은 파이프라인 내부 import를 편집기가 해석하도록.
- **`*.rules`는 자바스크립트로 인식.** `firestore.rules` 문법 강조용.

---

## 9. 설정 바꾸기

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 화면 표시 버전 | `backend/build.py` → `APP_VERSION` |
| GA4 측정 ID (비우면 추적 코드 미삽입) | `backend/build.py` → `GA_ID` |
| Firebase 설정 (비우면 로그인 UI 미표시) | `backend/build.py` → `FIREBASE_CONFIG` |
| 관리자 | `backend/build.py` → `ADMIN_UID` **+** `firestore.rules` → `isAdmin()` |
| 리그별 표시 개수 (기본 40) | `backend/build.py` → `TOP` |
| PvE 표시 개수 (기본 30) | `backend/pve_build.py` → `TOP` |
| 맥스 표시 개수·기술 위력 | `backend/value_build.py` → `TOP`, `MAX_ATTACK_POWER`, `GMAX_POWER` |
| 일반 티어 진입 조건·경계 | `backend/value_build.py` → `rel_tier()` |
| 솔플 계산 보정 상수 | `frontend/scripts/views/ifsolo.js` → `TDO_CAL`, `DPS_CAL`, `REVIVE_LOSS`, `SWAP_LOSS` |
| 다이맥스 출시 반영 | `backend/config/max_released.txt` |
| 도감 출시 수동 보정 | `backend/config/dex_released_extra.txt` |
| 수집할 시트 탭 | `backend/config/sheets.conf` |
| 시트 열 키워드 | `backend/sheet_build.py` → `COLS` |
| 폼 한글 라벨 | `backend/names.py` → `FORM_KO` |
| 색상·다크모드 팔레트 | `frontend/styles/tokens.css` |
| 자동 갱신 주기 | `.github/workflows/deploy.yml` → `cron` |

---

## 10. 알려진 한계

- 한글 이름은 본가 번역표 기준이라 포켓몬고 표기와 다를 수 있음. 매칭 실패 시 영문 노출
- 특수 습득 기술(예: 갈룡승천)이 게임마스터에 없으면 계산에서 빠짐
- 잠재파워는 타입 변형이 많아 타입 미표시
- 출시 여부가 PvPoke `released` + 수동 보정이라 새 폼 반영이 하루 이틀 늦을 수 있음
- 다이맥스 출시 목록은 자동 갱신되지 않음 (`max_released.txt` 수동 추가)
- 맥스 배틀은 맥스가드·맥스스피릿·게이지 충전 속도 미반영 간이 지표
- 월 일정표가 `schedule.js`에 하드코딩 — 달이 바뀌면 수동 갱신 필요 (자동화는 백로그)
- PvP 덱 짜기는 타입 상성 근사 — 실드·기술 사이클·CP 최적화 미반영
- 솔플 계산기는 실측 표본이 아직 적어 5성·특수 보스에서 오차 가능
