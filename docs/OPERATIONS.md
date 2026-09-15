# 운영 문서 — moncamp

배포·릴리스, 로그인 승인, 사용 통계, 노션 관리 — **서비스를 굴리는 방법**을 모았습니다.
구조·산식·설계 배경은 [개발 문서](DEVELOPMENT.md)를 보세요.

- [1. 릴리스 절차](#1-릴리스-절차)
- [2. 버전 규칙과 패치노트](#2-버전-규칙과-패치노트)
- [3. 배포 실패 대응](#3-배포-실패-대응)
- [4. 로그인 · 가입 승인 운영](#4-로그인--가입-승인-운영)
- [5. 트레이너 코드 운영](#5-트레이너-코드-운영)
- [6. Firebase 최초 설정](#6-firebase-최초-설정)
- [7. 사용 통계(GA4) 보는 법](#7-사용-통계ga4-보는-법)
- [8. 노션 운영 방안](#8-노션-운영-방안)
- [9. 시즌 기술 변경 갱신](#9-시즌-기술-변경-갱신)
- [10. 정기 점검 체크리스트](#10-정기-점검-체크리스트)
- [11. 트래픽·남용 대응](#11-트래픽남용-대응)

---

## 1. 릴리스 절차

배포는 GitHub Actions가 전부 합니다. 사람이 하는 일은 **브랜치 옮기고, 버전 올리고, 기록 남기고, 푸시**뿐입니다.

### 브랜치 전략 (2026-09-05, v2.7.3부터)

| 브랜치 | 역할 | 푸시하면 | 확인 주소 |
|---|---|---|---|
| `dev` | 작업·미리보기. 기능은 여기서 만든다 | `deploy-dev.yml` → **pogo-rank-dev** 저장소의 `gh-pages`로 배포 | **https://dev.moncamp.kr/** (2026-09-14 v3.27.0 전에는 minsangkwak.github.io/pogo-rank-dev/) |
| `main` | 통합. `dev`가 검증되면 머지 | 배포 없음 | — |
| `deploy` | 실서비스. `main`을 머지한 것만 | `deploy.yml` → GitHub Pages 배포 | **https://moncamp.kr/** (전에는 minsangkwak.github.io/pogo-rank/) |

- GitHub Pages는 저장소당 사이트 하나라서, `pogo-rank-dev` 주소는 **같은 이름의 별도 저장소**(MinsangKwak/pogo-rank-dev)가 서빙합니다. 그 저장소에는 소스가 없고 빌드 결과(`gh-pages`)만 실립니다.
- dev 빌드는 `BUILD_CHANNEL=dev`로 만들어져 화면 버전 배지에 `-dev`가 붙고, GA 통계가 꺼지고, `robots.txt`·`noindex`로 검색 색인을 막습니다. 로그인·즐겨찾기는 실서비스와 **같은 Firebase 프로젝트**를 씁니다(별도 데이터 아님).
- 매일 00:00 KST 자동 재빌드는 `deploy` 브랜치만 대상입니다. 순위 스냅샷(`snapshot/`) 자동 커밋도 `deploy`에 쌓이므로, `main → deploy` 머지는 fast-forward가 아닌 **머지 커밋**이 됩니다(정상).

### 순서

1. **기능 작업** — `dev`에서. 로컬은 `python3 backend/build.py`, 로그인 뒤 화면은 `localhost:5503/?mock=1`
2. **dev 푸시** — `bash scripts/ship_dev.sh --no-wait` 가 작업 브랜치를 `dev` 로 머지·푸시한다. 2~3분 뒤 **dev.moncamp.kr** 에서 확인하고, 기계 검증은 `bash scripts/verify_deploy.sh https://dev.moncamp.kr/ dev`. 반영 여부는 `curl -s https://dev.moncamp.kr/build.json` 의 `version` 이 `-dev` 를 달고 올라왔는지로 본다
3. **버전 올리기** — `backend/build.py`의 `APP_VERSION` (화면 우측 상단 배지)
4. **기록 4곳 갱신** — 버전을 올리면 **같이** 손봐야 하는 자리다. 하나라도 빠지면 화면과 문서가 어긋난다
   - `frontend/scripts/components/release.js` — 사용자용 패치노트 항목 + `RELEASE_VER` 갱신(바뀌면 ☰에 빨간 점이 뜸)
   - `frontend/scripts/i18n-release-en.js` — 그 패치노트의 영문판. 날짜 묶음 키(`2026-09-14 · v3.31.0`)가 한 글자까지 같아야 짝이 맞는다
   - `CHANGELOG.md` — 그날 날짜 묶음 안에 버전 `<details>` 를 하나 더 얹고, 머리말의 판 수와 그 날짜 줄의 `N판 · 버전 범위` 를 갱신
   - `README.md` 버전 이력 — 같은 2단 아코디언. 머리말의 전체 판 수도 함께
5. **main으로 머지** — 풀 리퀘스트로 연다(`dev` → `main`). 머지 방식은 **merge commit**
6. **deploy로 머지** — `git checkout deploy && git merge main && git push` → Actions가 빌드·배포 (2~3분) → `bash scripts/verify_deploy.sh https://moncamp.kr/ prod`
7. **노션 정리** — QA 트래커에서 해당 이슈를 `완료`로 바꾸고, 릴리스 노트 페이지에 그 판을 적는다 (`버전` 속성은 선택지가 낡아 비워 두는 편이 안전하다 — 8절)

> 급하면 GitHub → Actions → "Build and deploy to GitHub Pages" → **Run workflow** (deploy 브랜치를 다시 빌드). dev 쪽은 "Build and deploy dev preview".

### 최초 1회 설정

- 저장소 Settings → Pages → Source를 **GitHub Actions**로 (이미 됨).
- Settings → Environments → `github-pages` → Deployment branches에 **`deploy`** 허용 (이미 됨 — 없으면 `deploy`에서 배포가 "environment protection rules"로 거부된다).
- **dev 배포 키** — 아래를 한 번 실행하면 키 생성 → pogo-rank-dev에 쓰기 deploy key 등록 → pogo-rank 시크릿 `DEV_DEPLOY_KEY` 저장까지 끝난다. 이게 없으면 dev 워크플로 첫 단계가 안내 메시지와 함께 실패한다.

```bash
bash scripts/setup_dev_deploy_key.sh
```

## 2. 버전 규칙과 패치노트

`vMAJOR.MINOR.PATCH`

| 자리 | 올리는 때 | 예 |
|---|---|---|
| MAJOR | 서비스 구조가 바뀔 때 | v1 → v2 (산출물 분리) |
| MINOR | 새 기능 | 로그인, IF 탭 개편, 도감 |
| PATCH | 상세 기능·버그·문구 | 로딩 화면, 계산 보정 |

**기록 위치가 여섯이라 어긋나기 쉽습니다.** 릴리스 때 아래를 한 번에 확인하세요.

| 위치 | 목적 | 대상 |
|---|---|---|
| `backend/build.py` `APP_VERSION` | 화면 배지 | 사용자 |
| `frontend/.../release.js` | 앱 안 패치노트(#/release) + 새 소식 뱃지(`RELEASE_VER`) | 사용자 |
| `frontend/.../i18n-release-en.js` | 그 패치노트의 영문판 — 날짜 묶음 키가 한 글자까지 같아야 짝이 맞는다 | 사용자 |
| `CHANGELOG.md` | 개발 이력(상세) — 날짜 → 버전 2단 아코디언 | 개발자 |
| `README.md` 버전 이력 | 같은 2단 아코디언의 요약판 | 개발자 |
| 노션 릴리스 노트 · QA 트래커 | 이슈 ↔ 버전 연결 | 운영 |

> `CHANGELOG.md` · `README.md` 는 아코디언 머리말에 **전체 판 수**를, 각 날짜 줄에 **그날 판 수와 버전 범위**를 적습니다. 판을 더할 때 그 숫자도 같이 고치세요 — 안 고치면 조용히 틀린 채로 남습니다(2026-09-14 기준 실제 142판인데 머리말은 134로 적혀 있었습니다).

---

## 3. 배포 실패 대응

Actions에서 빨간 X가 뜨면 **build 잡의 빨간 단계**를 펼쳐 마지막 줄을 봅니다.

| 증상 | 원인 | 조치 |
|---|---|---|
| `JSON 깨짐: data/xxx.json` | 원본 다운로드가 429/5xx를 받음 | 대개 일시적 — Run workflow로 재실행. 반복되면 소스 URL 확인 |
| `FETCH FAIL: <url>` | 소스 경로 변경·삭제 | `scripts/fetch_data.sh`의 URL 갱신 |
| `sheet ... download failed` | 구글 시트 게시 중단 | 저장소 `snapshot/` 사본으로 자동 대체됨. 시트 주인에게 게시 상태 확인 |
| 스냅샷 커밋 단계 실패 | 푸시 권한·경합 | **배포를 막지 않음**(continue-on-error). 무시 가능 |
| 배포는 성공인데 화면이 그대로 | 서비스워커 캐시 | 새로고침(또는 캐시 삭제). 페이지·data.js는 네트워크 우선이라 대개 즉시 반영 |

다운로드는 `-f` + 재시도 5회 + JSON 파싱 검증이 걸려 있어, 깨진 응답이 조용히 통과하지 않습니다.

---

## 4. 로그인 · 가입 승인 운영

**사용자 흐름** — 헤더 👤 → Google 로그인 → 처음이면 "⏳ 승인 대기" → 관리자 승인 후 즐겨찾기·트레이너 코드 사용 가능.

**승인하기** — ☰ 메뉴 → **🔑 가입 승인**(관리자에게만 보임)

- **승인 대기** 목록에서 `승인` → 그 사람이 새로고침하면 바로 사용 가능
- **승인된 친구** 목록에서 `해제` → 접근 차단(개인 즐겨찾기 데이터는 남지만 읽을 수 없음)
- 맨 아래 **"내 uid 복사"** — 관리자를 바꾸거나 규칙을 손볼 때 쓰는 값

**계정 삭제(v2.18.0)** — 사용자가 ☰ → 계정 카드 → "계정 삭제"로 직접 지웁니다(`users`·`allowlist`·`requests` 본인 문서 + 인증 계정). 이메일로 요청이 오면 콘솔에서 같은 네 곳을 지우면 됩니다. **v2.18.0 규칙(`firestore.rules`)을 콘솔에 다시 게시해야** 본인 문서 delete가 허용됩니다 — 게시 전에는 삭제 버튼이 `permission-denied`로 실패하고 안내 문구가 뜹니다.

**관리자를 바꾸려면** `backend/build.py`의 `ADMIN_UID`와 `firestore.rules`의 `isAdmin()` uid를 **둘 다** 바꾸고, 규칙은 콘솔에서 다시 게시해야 합니다.

> ⚠️ 규칙을 바꿨는데 **콘솔에서 게시를 안 하면** 저장이 `permission-denied`로 막힙니다. 코드 배포와 규칙 게시는 별개입니다.

**요금** — 무료(Spark) 한도는 일 읽기 5만·쓰기 2만. 친구 규모에선 여유롭습니다.

---

## 5. 트레이너 코드 운영

코드는 공개 저장소에 두지 않고 Firestore `trainers` 컬렉션에 있습니다. 승인된 사람에게만 보이고, 비로그인 상태에서는 메뉴 항목 자체가 나타나지 않습니다.

**등록·수정** — 관리자로 로그인 → ☰ → 👥 트레이너 코드 → **🛠 코드 관리**

- 한 줄에 하나씩 `이름 1234 5678 9012` 형식으로 붙여넣고 **일괄 저장**
- 같은 이름은 덮어쓰기, 형식이 안 맞는 줄은 건너뛰고 결과가 버튼 위에 표시됨
- 삭제는 목록의 `삭제` 버튼

새 친구가 들어오면: 가입 승인 → 코드 관리에서 코드 추가, 두 단계면 끝입니다.

---

## 6. Firebase 최초 설정

> **(v2.8.0) 설정값은 코드가 아니라 `.env`에 둔다.** `cp .env.example .env` 후 `FIREBASE_CONFIG_JSON`·`ADMIN_UID`·`GA_ID`·`CONTACT_EMAIL`을 채운다. GitHub Actions는 Settings → Secrets and variables → Actions → **Variables**에 같은 이름으로 넣는다(둘 다 채워야 로컬과 배포가 같은 빌드가 된다). 다만 `GA_ID`(v3.27.1)와 `CONTACT_EMAIL`(v3.32.0)은 **워크플로 파일에 직접 적혀 있어** 저장소 변수를 더 읽지 않는다 — 값을 바꾸려면 `.github/workflows/deploy.yml`·`deploy-dev.yml` 두 곳을 고친다. 보안 규칙은 `firestore.rules`의 `__ADMIN_UID__`를 `bash scripts/render_rules.sh`로 채운 `firestore.rules.local`을 콘솔에 붙여넣는다. 저장소가 public이므로 실제 값이 든 파일(`.env`, `firestore.rules.local`)은 절대 커밋하지 않는다(.gitignore에 있음).


이미 설정된 프로젝트가 있다면 건너뛰세요. 새로 만들 때만 필요합니다.

1. [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 추가
2. `</>` 웹 앱 등록 → 나오는 `firebaseConfig`를 `backend/build.py`의 `FIREBASE_CONFIG`에 파이썬 dict로 입력 (Firebase 호스팅 체크는 불필요 — GitHub Pages 사용)
3. **Authentication** → 시작하기 → 로그인 방법 → **Google** 사용 설정 → 지원 이메일 선택
4. Authentication → 설정 → **승인된 도메인**에 `minsangkwak.github.io` · `moncamp.kr` · `dev.moncamp.kr` 추가 (2026-09-14 v3.27.0 커스텀 도메인 — 12절)
5. **Firestore Database** → 만들기 → 위치 `asia-northeast3(서울)` → 프로덕션 모드 → **규칙** 탭에 저장소의 [`firestore.rules`](../firestore.rules) 붙여넣고 **게시**

`FIREBASE_CONFIG`가 비어 있으면 로그인 UI가 빌드에 들어가지 않아, 설정 전에 배포해도 나머지 기능은 정상입니다.
`apiKey`는 비밀이 아니라 공개 식별자입니다 — 실제 방어선은 5번의 보안 규칙과 4번의 승인된 도메인입니다.

---

## 7. 사용 통계(GA4) 보는 법

> **v3.39.0 부터 옵트아웃입니다** — 들어오면 바로 집계되고, 배너의 [통계 끄기] 또는 ☰ → 통계·저장소 설정에서 끈 사람만 빠집니다(`components/consent.js`). v2.18.0~v3.38.0 은 동의한 사람만 집계하는 옵트인이었고, 대부분 아무것도 누르지 않아 사실상 비어 있었습니다. 배너는 dev·로컬에서도 뜨지만 측정 ID 가 없어 선택만 저장됩니다.

측정 ID 는 `G-1L6ENS8PVK` — GA4 속성의 **moncamp 스트림**(스트림 ID `15780045801`)입니다. 2026-09-14 v3.27.1 부터 `.github/workflows/deploy.yml` · `deploy-dev.yml` 에 직접 적혀 있습니다(저장소 변수 `GA_ID` 는 더 읽지 않음). `github.io` · `moncamp.kr` 도메인에서만 로드되어 로컬 개발은 집계되지 않습니다.

> **측정 ID 를 바꿀 때는 먼저 살아 있는지 확인합니다.**
>
> ```bash
> curl -so /dev/null -w '%{http_code}\n' "https://www.googletagmanager.com/gtag/js?id=G-1L6ENS8PVK"
> ```
>
> **200 이어야 합니다.** 존재하지 않는 스트림이면 404 가 오고, 그러면 gtag 라이브러리 자체가 안 받아져 **히트가 한 건도 나가지 않습니다.** 아무 ID 나(`G-1234567890`) 넣어도 200 이 나오므로 404 는 오해의 여지가 없는 신호입니다.

**지나온 사고 둘** — 둘 다 "화면에는 아무 증상이 없고 보고서만 빈다" 는 같은 모양이라 늦게 잡혔습니다.

| 언제 | 무엇 | 증상 |
| --- | --- | --- |
| ~v3.27.0 | 저장소 변수 `GA_ID` 가 같은 속성의 `blog` 스트림(`G-KVRX9FBNDC`) | 사이트 통계가 blog 스트림에 섞여 쌓임. 속성 단위 보고서에서는 합쳐 보여 안 보였음 (그 스트림은 2026-09-15 에 삭제) |
| v3.27.1~v3.42.0 | 적어 넣은 `G-8MSZM80JHZ`(옛 스트림 `15750161968`)가 그 뒤 사라짐 | `gtag/js` 404 → **집계 0건**. 콘솔에 "데이터 수집이 활성화되어 있지 않습니다" 배너 |

**남아 있는 데이터는 2026-09-15 이후뿐입니다.**

- v3.27.0 까지의 데이터는 `blog` 스트림에 쌓여 있었는데, 2026-09-15 스트림 정리에서 **그 스트림을 지웠습니다**. 스트림을 지우면 그 데이터도 함께 사라지며 되돌릴 수 없습니다
- v3.27.1~v3.42.0 구간은 **히트 자체가 나가지 않았습니다** — 지울 데이터도 없었습니다
- 지금 속성에 남은 스트림은 `moncamp`(`15780045801`) **하나뿐**입니다. 그래서 실시간·보고서에 보이는 숫자는 전부 moncamp.kr 것입니다 (전에는 속성 단위 보고서에서 blog 와 섞여 보였습니다)

> 스트림 목록의 `최근 48시간 동안 수신한 데이터가 없습니다` 와 스트림 상세의 노란 배너는 **48시간 창으로 늦게 갱신되는 표시**입니다. 방금 들어온 히트는 **실시간** 보고서에서 확인하세요 — 이쪽이 1분 안에 반영됩니다.

- **연결 확인 / 지금 접속자** — [analytics.google.com](https://analytics.google.com) → 보고서 → **실시간**. 사이트를 열면 1분 내 반영
- **일일 사용자** — 홈 또는 보고서의 **활성 사용자** 그래프 (일반 보고서는 하루 이틀 늦게 반영)
- **기능별 사용량** — 보고서 → 참여도 → **이벤트**

| 이벤트 | 의미 |
|---|---|
| `tab_max` `tab_pve` `tab_pvp` (`tab_usage` `tab_if`는 v2.16.0에 탭 제거로 더 안 쌓임) | 그 탭을 눌러 이동한 횟수 — **탭 순서 재배치는 이 순위로 판단** |
| `tab_start` | 접속 시 처음 보이는 탭(클릭 아님, 통계 분리용) |
| `sub_pve_*` / `tool_solo` `tool_pvpdeck` (on=1 펼침) / `usage_pick` | 탭 안 서브탭 전환 / 도구 버튼(v2.16.0) / 활용처 순위 클릭 (v3.22.0 에 `home_pick` 으로 대체, 옛 이벤트는 남겨 둔다) |
| `home_pick` (kind · mon · rank) | 서비스 홈의 순위 카드 클릭 — kind 는 `dmax` · `pve` · `usage` (v3.22.0) |
| `page_open` | 도감·일정표·패치노트 열기 (`page` 파라미터) |
| `detail_open` | 상세 팝업 열기 |
| `solo_calc_boss` / `pvp_deck_foe` | 솔플 계산기 보스 선택 / 커스텀 덱 상대 추가 |
| `search_pick` / `search_none` (v2.9.0) | 검색으로 고른 포켓몬(`mon`) / 결과 없던 검색어(`q`) — 별칭·표기 보강 근거 |
| `fav_toggle` (v2.9.0) | ★ 켜기·끄기(`on`, `dex`) — 즐겨찾기 기능이 실제로 쓰이는지 |
| `login` (v2.9.0) | 로그인 세션(`status`: ok/pending) |
| `pwa_install` (v2.9.0) | 홈 화면 설치 완료. `tab_start`의 `standalone`=1이면 설치된 앱으로 연 세션 |
| `share` (v2.9.0) | 상세 팝업 🔗 공유(`mon`). 링크로 들어온 쪽은 `detail_open`의 `from=link` |
| `solo_fill_favs` (v2.9.0) | 즐겨찾기로 덱 채우기(`n`) |
| `type_search` (v2.10.0) | 상성 검색에서 고른 타입 조합(`t`=`water,dark`)·포켓몬(`mon`)·고른 방법(`how`: chip/search/preset/clear, v2.10.1) |
| `types_rec_click` (v2.10.1) | 상성 검색의 추천 딜러 클릭 — `list`(raid/max)·`boss`(속성)·`rank`·`mon` |
| `page_open` `from=detail` / `tab_*` `from=types` | 상세 팝업 → 상성 검색 진입 / 상성 검색 → 탭 이동 |

이벤트를 추가하려면 원하는 위치에 `track('이벤트명', { 파라미터 })` 한 줄이면 됩니다 (`frontend/scripts/track.js`).

**누가 눌렀나 — GA User-ID (v2.10.1)**

로그인하면 Firebase uid가 GA `user_id`로, 승인 상태가 사용자 속성 `login_status`(ok/pending/anon)로 붙습니다. 비로그인은 기기 단위(client_id)로만 구분됩니다.

1. 콘솔 1회 설정: 관리 → 보고 ID → **혼합** 또는 **관측** (기본 "기기 기반"이면 User-ID가 보고서에 안 나온다). 맞춤 정의 → 사용자 속성 `login_status` 등록
2. 사람별 흐름: 탐색 → 템플릿 갤러리 → **사용자 개별화 분석**(한국어 UI에서 User explorer의 이름. "탐색"으로 검색해도 안 나온다). 표의 "유효 사용자 ID" 열이 User-ID가 있으면 uid를, 없으면 기기 ID(숫자.숫자)를 보여 주므로 행 항목을 바꿀 필요가 없다. 한 줄을 누르면 기기·OS·브라우저와 이벤트 타임라인. 승인된 친구만 보려면 세그먼트에 `login_status = ok`. 탐색 보고서는 하루쯤 늦게 채워진다 — 오늘 것은 실시간 개요에서만 보인다
3. uid ↔ 사람 대조: 사이트 메뉴 → 가입 승인 패널의 "승인된 친구" 줄에 uid가 적혀 있다(`requests/{email}` 계정 카드에서 읽는다. v2.10.1 이후 한 번이라도 로그인한 사람만). GA에는 이메일·이름을 보내지 않으므로 대조는 이 패널에서만 한다
4. 고지: `#/privacy`와 노션 개인정보처리방침에 적혀 있다. 이 항목을 끄려면 `auth.js`의 `setTrackingUser` 호출 한 줄을 지운다

**맞춤 정의 등록 (v2.9.0, 1회)** — 매개변수는 등록하지 않으면 보고서에 안 보입니다. GA 관리 → 데이터 표시 → 맞춤 정의 → 맞춤 측정기준 만들기, 범위 "이벤트"로 다음 10개: `tab` · `page` · `mon` · `boss` · `from` · `status` · `t` · `how` · `list` · `rank`(v2.10.1). 등록 시점 이후 데이터부터 잡히고, 이벤트 보고서에서 보조 측정기준으로 "어떤 포켓몬을 많이 열었나", "도감은 탭 줄과 ☰ 중 어디서 들어오나"를 볼 수 있습니다. 기간은 GA를 붙인 2026-09-03 이후로 잡아야 그래프가 왜곡되지 않습니다.

---

## 8. 노션 운영 방안

노션은 **두 축**으로 나눠 씁니다. 저장소 문서가 원본이고, 노션은 "지금 무엇을 할 차례인가"를 다룹니다.

| 섹션 | 무엇을 두나 | 원본 |
|---|---|---|
| 🛠 **개발** | 아키텍처 요약, 의사결정 기록 요약, 아이디어 백로그, 기술 부채 | `docs/DEVELOPMENT.md` |
| 📋 **운영** | QA 트래커, 릴리스 절차, 승인·코드 관리, 사용 통계, 장애 대응 | `docs/OPERATIONS.md` (이 문서) |

**QA 트래커 사용 규칙**

- 새 요청·버그는 **먼저 트래커에 등록**하고 `시작 전`으로 둔다 — 곧바로 개발하지 않는다(검토 후 착수 원칙)
- 착수하면 `진행 중`, 배포되면 `완료` + `버전` 지정
- 뷰 세 개를 용도별로: **작업 전**(우선순위순) / **작업 후(버전별)** / **상태 보드**
- 완료 처리할 때 페이지 본문에 **처리 결과**(무엇을 어떻게 바꿨는지, 관련 파일)를 남긴다 — 나중에 "왜 이렇게 했지"의 답이 된다

**중복 관리 피하기** — 같은 내용을 문서와 노션에 두 번 쓰지 않습니다. 노션에는 요약과 링크만 두고, 상세는 저장소 문서를 참조합니다.

---

## 9. 시즌 기술 변경 갱신

GO 배틀리그 시즌이 바뀔 때(보통 3개월마다) 하는 유일한 수동 작업입니다. **파일 하나만 갈아끼우면 됩니다.**

### 언제

새 시즌 공지가 뜨면 곧바로. 적용일 전에 올려야 "예고"로서 의미가 있습니다.

### 어떻게

1. 공식 공지 `pokemongo.com/news/go-battle-league-<시즌명>` 에서 기술 변경과 새로 배우는 기술 목록을 확인합니다.
2. `backend/config/move_changes.txt` 를 **통째로 새로 씁니다** (지난 시즌 내용은 남기지 않습니다 — 화면에는 "다가오는/방금 적용된 변경" 하나만 보이면 됩니다).
   - `SEASON` 시즌 이름, `DATE` 적용일
   - `M up|down <기술ID> <이전위력> <이후위력> | 비고` — up/down은 **위력 기준으로만** 판단합니다. 에너지가 같이 움직였으면 비고에 적습니다
   - `E <기술ID> | 비고` — 위력은 그대로고 에너지만 바뀐 기술
   - `N <포켓몬ID> <폼|-> <기술ID>` — 새로 배우는 기술
   - 기술ID·포켓몬ID는 게임마스터 표기(`IRON_HEAD`, `RAICHU_ALOLA`). 빠른 기술의 `_FAST`는 붙여도 되고 빼도 됩니다
3. `python3 backend/change_build.py` 로 확인합니다. 오타가 있으면 `⚠ move_changes: 게임마스터에 없는 기술 id: ...` 가 뜹니다. 경고가 없어야 정상입니다.
4. `python3 backend/build.py` 로 다시 빌드하고 커밋·푸시합니다.

### 시즌이 끝났는데 다음 공지가 아직 없다면

`backend/config/move_changes.txt` 를 지우면 됩니다. 안내 페이지·메뉴 항목·예고 뱃지가 전부 자동으로 사라집니다.

### 손대지 않아도 되는 것

- **티어표 수치** — 적용일 다음 자동 갱신에서 새 게임마스터를 읽어 저절로 바뀝니다.
- **예고 뱃지 제거** — 적용일이 지나면 조건이 거짓이 돼 스스로 사라집니다.
- **▲▼ 변동 표시** — 갱신 결과를 직전 순위와 비교해 자동으로 붙습니다. 단 `snapshot/ranks.json`·`snapshot/rank_delta.json` 이 저장소에 커밋돼 있어야 합니다. 배포 워크플로가 자동으로 커밋하지만, 그 스텝이 실패하면(권한·푸시 거부) 변동이 계속 비어 있게 되니 Actions 로그에서 `snapshot push 생략` 이 반복되는지 확인하세요.

---

## 10. 정기 점검 체크리스트

**매달 초**

- [ ] 월 일정표 갱신 (`frontend/scripts/components/schedule.js`의 `SCHEDULE_MONTHS`에 새 달 키 `'YYYY-MM'` 추가 + 확정 일정 기입, 지난 달은 그대로 둔다) — 새 달 데이터가 없으면 지난 달 달력이 폴백으로 보이고 이번 주 보스 카드는 숨는다 (v2.13.0 QA-20). 수집 기준: 현지시간=KST, 스포트라이트=목요일, 한국 전용 이벤트 별도 확인, 메가·5성·D-MAX·섀도우 분류. 로테이션은 대략 전달 말 발표
- [ ] 새 다이맥스·거다이맥스 출시분을 `backend/config/max_released.txt`에 추가
- [ ] 새 폼이 나왔는데 화면에 안 보이면: 게임마스터 폼 접미사가 `FORM_KO`에 있는지 확인 (없으면 `names.py`의 `GM_FORM_EXCEPTIONS`, PokeAPI에 그림이 없으면 `sprite.py`의 `LOCAL_FORMS`)
- [ ] ★ 즐겨찾기에서 '기타'로 떨어지는 비율이 높으면 `roles_build.py`의 `PVE_CUT`·`PVP_CUT` 완화 검토
- [ ] 새 GO 배틀리그 시즌이 시작됐으면 [9장](#9-시즌-기술-변경-갱신)대로 `move_changes.txt` 교체

**수시**

- [ ] 배포 성공 여부 (Actions 탭에 빨간 X가 없는지)
- [ ] GA 이벤트로 탭 사용 순위 확인 → 탭 순서 재검토
- [ ] 가입 승인 대기자 확인 (☰ → 🔑 가입 승인)
- [ ] 새 폼·메가가 도감에 정상 표기되는지 (PvPoke `released` 반영 지연 확인)

---

## 11. 트래픽·남용 대응

접속이 몰릴 때의 쓰로틀링·IP 차단은 **GitHub Pages에서는 불가능**합니다(제어할 서버가 없음). 무엇이 가능하고 언제 무엇을 하면 되는지는 [인프라 문서](INFRA.md)에 정리했습니다.

요약만 옮기면:

- 지금 규모는 월 대역폭 100GB 한도 대비 **첫 방문 약 7만 회분 여유** — 대비할 단계가 아님
- 진짜 한도는 Firestore(무료 Spark: 일 읽기 5만). 초과해도 **과금이 아니라 그날 기능 정지**
- 커지면 순서는 **도메인 구입 → Cloudflare 무료 연결 → rate limiting·봇 차단 → Firebase App Check**
- `robots.txt`는 배포에 포함되어 있으나 규칙을 지키는 봇에게만 유효 (강제력 없음)

---

## 12. 커스텀 도메인 moncamp.kr (2026-09-14 v3.27.0)

**실서비스는 `moncamp.kr`, 미리보기는 `dev.moncamp.kr`. 두 저장소의 배포 방식이 달라 도메인을 정하는 자리도 다릅니다.**

| 저장소 | 배포 방식 | 도메인을 정하는 곳 |
|---|---|---|
| `pogo-rank` (실서비스) | `deploy.yml` → `actions/deploy-pages` (Actions 배포) | 저장소 **Settings → Pages → Custom domain** 값만. `CNAME` 파일은 무시됨 |
| `pogo-rank-dev` (미리보기) | `deploy-dev.yml` → `peaceiris/actions-gh-pages` 가 `gh-pages` 브랜치에 push (브랜치 배포) | `gh-pages` 루트의 `CNAME` 파일. 워크플로의 `cname: dev.moncamp.kr` 이 매 배포마다 실어 준다 (`force_orphan` 이라 파일이 없으면 설정이 날아간다) |

### 12-1. DNS (가비아, 입력 완료)

| 타입 | 호스트 | 값 |
|---|---|---|
| A | `@` | `185.199.108.153` · `185.199.109.153` · `185.199.110.153` · `185.199.111.153` |
| CNAME | `www` | `minsangkwak.github.io.` |
| CNAME | `dev` | `minsangkwak.github.io.` |

전파 확인 (8.8.8.8 을 지정해 로컬·통신사 캐시를 건너뜀):

```
nslookup -type=A moncamp.kr 8.8.8.8
nslookup -type=CNAME dev.moncamp.kr 8.8.8.8
```

A 레코드 넷이 다 나오고 dev 가 `minsangkwak.github.io` 로 풀리면 다음으로.

### 12-2. 순서 — 반드시 이 차례

1. **Firebase 승인 도메인 먼저** — [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 → Authentication → 설정 탭 → **승인된 도메인** → 도메인 추가 → `moncamp.kr` 저장, 다시 도메인 추가 → `dev.moncamp.kr` 저장. `minsangkwak.github.io` 는 지우지 않는다(옛 주소가 리다이렉트되는 동안도 로그인이 돼야 한다). 이걸 빼먹으면 새 주소에서 Google 로그인이 `auth/unauthorized-domain` 으로 전부 실패한다.
2. **미리보기 저장소 Pages** — github.com/MinsangKwak/pogo-rank-dev → Settings → 왼쪽 **Pages** → Build and deployment 의 Source 가 `Deploy from a branch` · Branch `gh-pages` / `/ (root)` 인지 확인 → 아래 **Custom domain** 칸에 `dev.moncamp.kr` 입력 → Save. 저장하면 GitHub 이 DNS 검사를 시작한다("DNS check in progress" → 성공하면 초록 체크). v3.27.0 부터는 dev 배포가 `CNAME` 파일을 함께 올리므로 이 칸이 자동으로 채워지기도 한다 — 이미 채워져 있으면 그대로 둔다.
3. **실서비스 저장소 Pages** — github.com/MinsangKwak/pogo-rank → Settings → **Pages** → Source 는 `GitHub Actions` 그대로 → **Custom domain** 에 `moncamp.kr` 입력 → Save → DNS 검사 통과 확인. `www.moncamp.kr` 은 따로 적지 않는다 — apex(`moncamp.kr`)를 적으면 GitHub 이 `www` → apex 리다이렉트를 자동으로 처리한다.
4. **Enforce HTTPS** — 두 저장소 모두, DNS 검사가 통과한 뒤 같은 화면의 **Enforce HTTPS** 체크박스가 활성화되면 켠다. 인증서(Let's Encrypt)는 GitHub 이 발급하며 보통 몇 분, 길면 24시간. 체크박스가 회색이면 아직 발급 전이니 기다렸다가 다시 연다.
5. **deploy** — 이 순서가 끝난 뒤에 실서비스를 배포한다(`main` → `deploy`). 빌드의 canonical · og:url · sitemap 이 이미 `moncamp.kr` 로 찍히므로, Pages 설정 전에 배포하면 공유 카드가 아직 열리지 않는 주소를 가리킨다.

### 12-3. 확인

1. `https://moncamp.kr` — 홈 대시보드, 자물쇠(인증서) 정상
2. `https://www.moncamp.kr` → `moncamp.kr` 로 넘어가는가
3. `https://dev.moncamp.kr` — 미리보기(`-dev` 라벨), `https://minsangkwak.github.io/pogo-rank-dev/` 가 여기로 넘어오는가
4. Google 로그인 (1번 승인 도메인)
5. PWA — 주소창 설치 아이콘, 설치 후 오프라인 열람(`sw.js` 등록 조건에 `moncamp.kr` 포함, v3.27.0)
6. 딥링크 `#/dmax` · `#/pve` · `#/dex` · `#/mon/260`
7. `bash scripts/verify_deploy.sh https://moncamp.kr/ prod` · `bash scripts/verify_deploy.sh https://dev.moncamp.kr/ dev`

### 12-4. 알아둘 것

- **origin 이 바뀐다** — `pogo_*` localStorage(테마 · 언어 · 동의 · 게스트 플래너 `plan_guest_mons`)는 새 주소에서 빈 상태로 시작한다. 로그인 사용자는 Firestore 에 있어 무사.
- **GA4** — 측정 ID 노출 조건에 `moncamp.kr` 을 넣었다(v3.27.0). GA 속성 설정의 스트림 URL 은 콘솔에서 바꾼다(통계는 URL 과 무관하게 같은 ID 로 이어진다).
- **CAA 레코드는 넣지 않는다.** 넣어야 한다면 `letsencrypt.org` 를 허용해야 인증서가 나온다.
- 가비아 만기 **2028-09-14**. 두 달 · 한 달 · 2주 전 알림을 캘린더에 따로.

---

## 13. 검색 색인 (2026-09-14 v3.28.0)

**v3.6.0 에 뺐던 검색 색인 표시를 도메인이 생기면서 되살렸다.** 실서비스 HTML 에 `<meta name="robots" content="index, follow, max-image-preview:large">` 와 구조화 데이터(JSON-LD: WebSite · WebApplication)가 들어간다. dev 빌드는 `build.py` 가 그 robots 줄을 `noindex, nofollow` 로 바꿔 끼우고 `robots.txt` 도 전체 차단이라 미리보기는 검색에 잡히지 않는다.

이미 있던 것: `robots.txt`(일반 검색엔진 허용, 무거운 산출물·AI 크롤러 차단, `Sitemap:` 줄) · `sitemap.xml`(첫 화면 하나 — 해시 라우팅이라 색인되는 주소는 그것뿐) · canonical · description · og.

### 사람이 할 것 — 검색엔진에 등록

코드는 "색인해도 된다" 고 말할 뿐이고, 언제 오는지는 검색엔진이 정한다. 등록해 두면 몇 주가 며칠로 준다.

**Google Search Console** — [search.google.com/search-console](https://search.google.com/search-console)
1. 속성 추가 → **도메인** 유형 → `moncamp.kr` (URL 접두어 대신 도메인 유형을 고르면 dev·www 까지 한 속성으로 묶인다)
2. 소유 확인 → **DNS 레코드** → 보여 주는 `google-site-verification=…` 값을 복사
3. 가비아 → My가비아 → DNS 관리 → 레코드 추가: 타입 **TXT** · 호스트 `@` · 값 방금 복사한 문자열 · TTL 3600 → 저장
4. Search Console 에서 **확인** (DNS 전파 몇 분 ~ 1시간)
5. 확인되면 왼쪽 **Sitemaps** → `https://moncamp.kr/sitemap.xml` 제출
6. **URL 검사** → `https://moncamp.kr/` → **색인 생성 요청** (첫 크롤을 앞당긴다)

**네이버 서치어드바이저** — [searchadvisor.naver.com](https://searchadvisor.naver.com) (한국어 사이트라 네이버 유입이 구글만큼 크다)
1. 웹마스터 도구 → 사이트 등록 → `https://moncamp.kr`
2. 소유 확인 → **HTML 태그** 방식 → `<meta name="naver-site-verification" content="…">` 한 줄. **2026-09-14 v3.28.1 에 `index.html` `<head>` 에 넣어 배포했다** (네이버는 DNS 방식이 없다). 값이 바뀌면 그 줄만 갈아 끼우면 된다
3. 확인되면 요청 → **사이트맵 제출** → `https://moncamp.kr/sitemap.xml`, 요청 → **웹 페이지 수집** → `https://moncamp.kr/`

### 확인

- `curl -s https://moncamp.kr/ | grep -c 'name="robots" content="index'` → 1, `https://dev.moncamp.kr/` 는 `noindex`
- Search Console → 색인 생성 → 페이지: 며칠 뒤 "색인 생성됨" 1건. 구조화 데이터는 [리치 결과 테스트](https://search.google.com/test/rich-results)에 주소를 넣어 오류 없음 확인
- 검색창에 `site:moncamp.kr` — 첫 색인까지 보통 며칠 ~ 2주
