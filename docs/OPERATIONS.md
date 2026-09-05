# 운영 문서 — POGO SEARCH

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
| `dev` | 작업·미리보기. 기능은 여기서 만든다 | `deploy-dev.yml` → **pogo-rank-dev** 저장소의 `gh-pages`로 배포 | **https://minsangkwak.github.io/pogo-rank-dev/** |
| `main` | 통합. `dev`가 검증되면 머지 | 배포 없음 | — |
| `deploy` | 실서비스. `main`을 머지한 것만 | `deploy.yml` → GitHub Pages 배포 | **https://minsangkwak.github.io/pogo-rank/** |

- GitHub Pages는 저장소당 사이트 하나라서, `pogo-rank-dev` 주소는 **같은 이름의 별도 저장소**(MinsangKwak/pogo-rank-dev)가 서빙합니다. 그 저장소에는 소스가 없고 빌드 결과(`gh-pages`)만 실립니다.
- dev 빌드는 `BUILD_CHANNEL=dev`로 만들어져 화면 버전 배지에 `-dev`가 붙고, GA 통계가 꺼지고, `robots.txt`·`noindex`로 검색 색인을 막습니다. 로그인·즐겨찾기는 실서비스와 **같은 Firebase 프로젝트**를 씁니다(별도 데이터 아님).
- 매일 00:00 KST 자동 재빌드는 `deploy` 브랜치만 대상입니다. 순위 스냅샷(`snapshot/`) 자동 커밋도 `deploy`에 쌓이므로, `main → deploy` 머지는 fast-forward가 아닌 **머지 커밋**이 됩니다(정상).

### 순서

1. **기능 작업** — `dev`에서. 로컬은 `python3 backend/build.py`, 로그인 뒤 화면은 `localhost:5503/?mock=1`
2. **dev 푸시** → 2~3분 뒤 **pogo-rank-dev** 주소에서 친구들과 함께 확인. 기계 검증은 `bash scripts/verify_deploy.sh https://minsangkwak.github.io/pogo-rank-dev/ dev`
3. **버전 올리기** — `backend/build.py`의 `APP_VERSION` (화면 우측 상단 배지)
4. **기록 3곳 갱신**
   - `CHANGELOG.md` — 새 버전 섹션 추가 (추가/변경/수정/제거)
   - `frontend/scripts/components/release.js` — 사용자용 패치노트 항목 + `RELEASE_VER` 갱신(바뀌면 ☰에 빨간 점이 뜸)
   - `README.md` 버전 이력 표 (한 줄)
5. **main으로 머지** — `git checkout main && git merge dev && git push`
6. **deploy로 머지** — `git checkout deploy && git merge main && git push` → Actions가 빌드·배포 (2~3분) → `bash scripts/verify_deploy.sh https://minsangkwak.github.io/pogo-rank/ prod`
7. **노션 정리** — QA 트래커에서 해당 이슈를 `완료`로 바꾸고 `버전` 속성을 지정

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

**기록 위치가 넷이라 어긋나기 쉽습니다.** 릴리스 때 아래를 한 번에 확인하세요.

| 위치 | 목적 | 대상 |
|---|---|---|
| `backend/build.py` `APP_VERSION` | 화면 배지 | 사용자 |
| `frontend/.../release.js` | 앱 안 패치노트(#/release) + 새 소식 뱃지 | 사용자 |
| `CHANGELOG.md` | 개발 이력(상세) | 개발자 |
| 노션 QA 트래커 `버전` | 이슈 ↔ 버전 연결 | 운영 |

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

> **(v2.8.0) 설정값은 코드가 아니라 `.env`에 둔다.** `cp .env.example .env` 후 `FIREBASE_CONFIG_JSON`·`ADMIN_UID`·`GA_ID`·`CONTACT_EMAIL`을 채운다. GitHub Actions는 Settings → Secrets and variables → Actions → **Variables**에 같은 이름으로 넣는다(둘 다 채워야 로컬과 배포가 같은 빌드가 된다). 보안 규칙은 `firestore.rules`의 `__ADMIN_UID__`를 `bash scripts/render_rules.sh`로 채운 `firestore.rules.local`을 콘솔에 붙여넣는다. 저장소가 public이므로 실제 값이 든 파일(`.env`, `firestore.rules.local`)은 절대 커밋하지 않는다(.gitignore에 있음).


이미 설정된 프로젝트가 있다면 건너뛰세요. 새로 만들 때만 필요합니다.

1. [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 추가
2. `</>` 웹 앱 등록 → 나오는 `firebaseConfig`를 `backend/build.py`의 `FIREBASE_CONFIG`에 파이썬 dict로 입력 (Firebase 호스팅 체크는 불필요 — GitHub Pages 사용)
3. **Authentication** → 시작하기 → 로그인 방법 → **Google** 사용 설정 → 지원 이메일 선택
4. Authentication → 설정 → **승인된 도메인**에 `minsangkwak.github.io` 추가
5. **Firestore Database** → 만들기 → 위치 `asia-northeast3(서울)` → 프로덕션 모드 → **규칙** 탭에 저장소의 [`firestore.rules`](../firestore.rules) 붙여넣고 **게시**

`FIREBASE_CONFIG`가 비어 있으면 로그인 UI가 빌드에 들어가지 않아, 설정 전에 배포해도 나머지 기능은 정상입니다.
`apiKey`는 비밀이 아니라 공개 식별자입니다 — 실제 방어선은 5번의 보안 규칙과 4번의 승인된 도메인입니다.

---

## 7. 사용 통계(GA4) 보는 법

측정 ID `G-XXXXXXXXXX` (`backend/build.py`의 `GA_ID`, 비우면 추적 코드가 아예 안 들어감). `github.io` 도메인에서만 로드되어 로컬 개발은 집계되지 않습니다.

- **연결 확인 / 지금 접속자** — [analytics.google.com](https://analytics.google.com) → 보고서 → **실시간**. 사이트를 열면 1분 내 반영
- **일일 사용자** — 홈 또는 보고서의 **활성 사용자** 그래프 (일반 보고서는 하루 이틀 늦게 반영)
- **기능별 사용량** — 보고서 → 참여도 → **이벤트**

| 이벤트 | 의미 |
|---|---|
| `tab_max` `tab_pve` `tab_pvp` `tab_usage` `tab_if` | 그 탭을 눌러 이동한 횟수 — **탭 순서 재배치는 이 순위로 판단** |
| `tab_start` | 접속 시 처음 보이는 탭(클릭 아님, 통계 분리용) |
| `sub_pve_*` / `sub_if_*` | 탭 안 서브탭 전환 |
| `page_open` | 도감·일정표·패치노트 열기 (`page` 파라미터) |
| `detail_open` | 상세 팝업 열기 |
| `solo_calc_boss` / `pvp_deck_foe` | 솔플 계산기 보스 선택 / 커스텀 덱 상대 추가 |

이벤트를 추가하려면 원하는 위치에 `track('이벤트명', { 파라미터 })` 한 줄이면 됩니다 (`frontend/scripts/track.js`).

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

- [ ] 월 일정표 갱신 (`frontend/scripts/components/schedule.js`의 `SCHEDULE_YM`·`SCHEDULE_ITEMS`) — 안 하면 달력이 빈 화면
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
