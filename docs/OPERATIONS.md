# 운영 가이드

[프로젝트 소개](../README.md) · [개발 가이드](DEVELOPMENT.md) · [인프라](INFRA.md) · [전환 기록](V5-CUTOVER.md)

**v5의 배포, 계정 운영, 장애 대응과 데이터 점검 절차입니다.** 기준일은 2026-09-26입니다. 이전 Firebase·GitHub Pages 절차는 하단의 과거 기록으로 분리했습니다.

## 운영 작업 찾기

| 작업 | 참고 |
| --- | --- |
| 배포 | [배포 흐름](#deployment) |
| 계정·권한 문제 | [계정 운영](#accounts) · [인증 설계](../server/AUTH.md) |
| 사이트·API 장애 | [장애 대응](#incidents) |
| 수집·통계 확인 | [통계 운영](#analytics) |
| 데이터 복구·보존 | [백업과 보존](#backup) |

<a id="deployment"></a>
## 배포 흐름

| 브랜치 | 역할 | 현재 웹 배포 |
| --- | --- | --- |
| `dev` | 작업·통합 전 검증 | `deploy-dev.yml` → `dev-pipeline.yml` → Vercel |
| `main` | 검증된 변경 통합 | 운영 배포 승인 전 통합 단계 |
| `deploy` | 운영 릴리스 | `deploy-web.yml` → Vercel, moncamp.kr |

서버 배포는 `deploy-server.yml`에서 별도로 처리합니다. GitHub Pages 관련 워크플로와 이전 산출물은 전환·복구 맥락으로 남아 있습니다. 현재 웹을 Vite 앱으로 배포하지 않습니다.

1. 최신 `dev`를 기준으로 변경과 diff를 검토합니다.
2. 변경 영역에 맞는 [검증](DEVELOPMENT.md#verification)을 실행합니다.
3. dev 반영 후 해당 기능과 버전을 확인합니다.
4. 운영 릴리스로 승인된 변경만 `dev → main` PR로 통합합니다.
5. 운영 배포 시 `main → deploy`를 병합하고 워크플로 결과와 실제 응답을 확인합니다.

강제 푸시로 원격 변경을 덮지 않습니다.

```bash
# 상태 확인
bash scripts/status.sh

# 배포된 서비스 확인
bash scripts/verify_deploy.sh https://moncamp.kr/ prod
```

검증 스크립트의 기대 버전과 작업 트리가 일치하는지 확인합니다. Actions 성공뿐 아니라 실제 주소의 내용·버전·핵심 기능을 확인합니다.

### 릴리스 기록

| 파일 | 역할 |
| --- | --- |
| `content/version.json` | 서비스 버전 원본 |
| `content/release-notes.mjs` | 한국어 사용자 안내 |
| `content/release-notes.en.mjs` | 같은 날짜 키의 영어 안내 |
| `docs/CHANGELOG.md` | 개발 변경과 수정 근거 |
| `README.md` | 최신 릴리스 요약 |

문서만 수정할 때 앱 버전을 올리지 않습니다. 최신 날짜·버전 표시는 `frontend-v4/src/test/version.test.ts`와 일치해야 합니다. 릴리스는 커밋마다 나누기보다 사용자에게 설명할 수 있는 단위로 묶습니다.

<a id="accounts"></a>
## 계정 운영

가입 승인, 관리자 지정, 실험 기능 권한 변경은 루트만 수행합니다. 위임 관리자는 트레이너 코드 운영을 맡고 가입 승인은 하지 않습니다. `beta`는 관리자 역할과 별도입니다.

현재 계정·즐겨찾기는 Neon에 저장하며 API가 권한을 확인합니다. 이전 Firebase 콘솔의 승인 목록을 수정해도 현재 계정 권한이 바뀌지 않습니다. `ROOT_EMAIL`과 Google OAuth 클라이언트는 서버 설정입니다.

권한 변경 후 기존 액세스 JWT는 최대 15분 유효할 수 있습니다. 세션 폐기는 이후 갱신을 차단하므로 즉시 모든 요청을 무효화하는 것으로 안내하지 않습니다. [인증 설계](../server/AUTH.md)를 참고합니다.

<a id="incidents"></a>
## 장애 대응

| 증상 | 먼저 확인할 항목 | 후속 조치 |
| --- | --- | --- |
| 배포 후 내용이 이전 버전 | 배포 대상 브랜치·커밋, 실제 응답, 서비스워커 | 잘못된 대상 빌드인지 확인 후 재배포·캐시 문제 구분 |
| 상세 HTML 부족·빈 본문 | 데이터 추출과 `web-test.yml` | 빌드 성공 여부만으로 정상 판정하지 않음 |
| 데이터 stale 경고 | 원본 응답과 `backend/guard.py` 대체 결과 | 출처 변경·일시 실패를 구분하고 정상 데이터 회복 |
| 필수 데이터 누락 | 정상 스냅샷 존재 여부 | 잘못된 데이터로 배포하지 않고 원본 복구 |
| 로그인 실패 | OAuth 리디렉션 URI, 허용 Origin, 필수 시크릿 | 로그에서 실패 단계를 확인. 비밀 값은 출력하지 않음 |
| API 401 / 403 | 토큰 만료·권한·Origin | 재로그인 문제와 권한 부족을 구분 |
| 수집 400 | `contract.ts` 요청 스키마 | 허용 이벤트·필드·길이 확인 |
| `/health` 지속 실패 | Cloud Run 부팅 로그·DB 연결 | 환경 설정, 네트워크, DB 상태를 구분 |
| GA4만 실패 | 속성 ID·서비스 계정 권한·Data API | 다른 통계와 독립적으로 복구 |

계정 API 장애는 로그인·저장 기능에 영향을 줍니다. 정적 게임 콘텐츠와 수집 기능의 상태를 각각 확인하며 “사이트 전체에 영향 없음”으로 단정하지 않습니다.

<a id="analytics"></a>
## 통계 운영

`/admin/stats`는 루트 전용이며 공개 메뉴·사이트맵에서 제외합니다. 사용자 목록이 아니라 집계값을 제공합니다. 검색과 화면별 페이지뷰는 자체 수집, 방문자·페이지뷰 일부는 GA4 Data API를 사용합니다.

| 설정 | 확인 |
| --- | --- |
| `COLLECT_URL` | 웹 빌드 시 수집 주소. 실제 산출물에 반영됐는지 확인 |
| `ALLOWED_ORIGINS` | dev·운영 Origin을 명시적으로 허용 |
| `GA4_PROPERTY_ID` | 숫자 속성 ID. `G-...` 측정 ID와 구분 |
| Cloud Run 서비스 계정 | 대상 GA4 속성 읽기 권한과 Data API 사용 설정 |

GA4는 메타데이터 서버의 서비스 계정 인증을 사용하며 별도 키 파일을 화면에 전달하지 않습니다. GA4와 자체 집계는 차단기·집계 상한·필터가 달라 정확히 일치하지 않을 수 있습니다.

통계를 거부한 브라우저에서는 수집하지 않습니다. 수집 항목을 바꾸면 실제 동작, 개인정보처리방침, 시행일과 정정 공지를 함께 확인합니다. v5.2.1의 페이지뷰 시행일 기록은 2026-09-24입니다.

<a id="backup"></a>
## 백업과 보존

현재 Neon의 계정 데이터와 이전 Firestore 백업을 구분합니다. `backup-firestore.yml`과 `backup_runs`는 기존 Firestore 백업·진단 흐름이므로 이것만으로 Neon 복원 가능 여부를 판단하지 않습니다.

- 현재 DB의 백업 범위, 보존 기간, 복원 대상과 실제 복원 절차를 별도로 확인합니다.
- 복원 전 대상 환경을 확인하고, 먼저 격리된 DB에서 검증합니다.
- 백업 평문에는 사용자 정보가 포함될 수 있으므로 저장소에 넣지 않습니다.
- 수집 원본은 일별 집계 후 12개월 보존 경계에 따라 삭제합니다.
- 만료 세션 정리와 집계·삭제 워크플로가 실행되는지 확인합니다.

기존 백업 감소 경고는 정상 계정 삭제일 수도 있습니다. 확인 없이 기준을 낮추지 않고, 정상 감소라면 사유와 기준을 기록합니다. [스키마](../server/SCHEMA.md)에 진단 규칙이 있습니다.

## 정기 점검

| 주기 | 항목 |
| --- | --- |
| 릴리스마다 | 대상 커밋·버전·주요 화면·로그인·저장·두 테마 |
| 주기적으로 | 데이터 갱신, 집계·삭제 실행, API 오류와 지연 |
| 월별 | 사용량·비용 알림, DB 용량·연결, 실제 백업 가능 상태 |
| 구성 변경 시 | 비밀 값 관리, 권한, 리전·수집 항목과 법적 고지 일치 |

콘솔 설정은 저장소만으로 현재 적용 여부를 확정할 수 없습니다. 변경한 날짜와 확인 근거를 기록합니다.


## 이전 운영 기록

다음은 v2~v5 전환 중 작성한 운영 기록입니다. 특히 Firebase 설정, Pages 배포, 당시 일정·비용·계정 수는 현재 상태를 뜻하지 않습니다. 역사적 장애 대응 근거를 보존하기 위해 남깁니다.

<details>
<summary>4. 로그인 · 가입 승인 운영</summary>

## 4. 로그인 · 가입 승인 운영

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**사용자 흐름** — 헤더 👤 → Google 로그인 → 처음이면 "⏳ 승인 대기" → 관리자 승인 후 즐겨찾기·트레이너 코드 사용 가능.

**승인하기** — ☰ 메뉴 → **🔑 가입 승인**(관리자에게만 보임)

- **승인 대기** 목록에서 `승인` → 그 사람이 새로고침하면 바로 사용 가능
- **승인된 친구** 목록에서 `해제` → 접근 차단(개인 즐겨찾기 데이터는 남지만 읽을 수 없음)
- 맨 아래 **"내 uid 복사"** — 관리자를 바꾸거나 규칙을 손볼 때 쓰는 값

**깃발 둘은 서로 다른 것을 엽니다 (v4.0.1)** — 운영을 돕는 자리와 먼저 써 보는 자리는 다릅니다. 한 깃발로 둘을 다 열면 실험 기능을 열어 주려다 유저 목록까지 넘기게 됩니다.

| 깃발 | 여는 것 | 주는 자리 |
| --- | --- | --- |
| `admin` | 유저 관리 — 승인된 사람 목록 · 트레이너 코드 관리 | 승인된 친구 줄 → `관리자 지정` |
| `beta` | 실험 기능 — 🎒 내 포켓몬 · D-MAX `[미구현]` | 승인된 친구 줄 → `🧪 실험 기능` |

둘 다 `allowlist/{이메일}` 문서에 적히고 **루트 관리자만** 켜고 끕니다. 루트는 만든 사람이라 둘 다 켜져 있습니다. **관리자가 됐다고 실험 기능이 함께 열리지는 않습니다.** 승인을 해제하면 문서가 지워져 두 깃발도 같이 내려갑니다.

> 손으로 준 깃발은 **그 사람이 다시 로그인해야** 적용됩니다 — 판정은 로그인 한 번에 한 번만 읽습니다.

**계정 삭제(v2.18.0 · v4.9.7)** — 사용자가 ☰ → 계정 카드 → "계정 삭제"로 직접 지웁니다(`users`·`allowlist`·`requests` 본인 문서 + 인증 계정). 이메일로 요청이 오면 콘솔에서 같은 네 곳을 지우면 됩니다. **v4.9.7 규칙(`firestore.rules`)을 콘솔에 다시 게시해야** `users` 문서 delete 가 허용됩니다 — 그전 규칙은 삭제 요청을 오류로 거부해 `permission-denied` 가 났습니다(삭제 요청에는 `request.resource` 가 없는데 본문 크기를 읽었다). 규칙을 고칠 때는 `cd frontend-v4 && npm run test:rules` 로 에뮬레이터 검사를 먼저 돌립니다.

**관리자를 바꾸려면** `backend/build.py`의 `ADMIN_UID`와 `firestore.rules`의 `isAdmin()` uid를 **둘 다** 바꾸고, 규칙은 콘솔에서 다시 게시해야 합니다.

> ⚠️ 규칙을 바꿨는데 **콘솔에서 게시를 안 하면** 저장이 `permission-denied`로 막힙니다. 코드 배포와 규칙 게시는 별개입니다.

**요금** — 무료(Spark) 한도는 일 읽기 5만·쓰기 2만. 친구 규모에선 여유롭습니다.

---

</details>

<details>
<summary>5. 트레이너 코드 운영</summary>

## 5. 트레이너 코드 운영

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

코드는 공개 저장소에 두지 않고 Firestore `trainers` 컬렉션에 있습니다. 승인된 사람에게만 보이고, 비로그인 상태에서는 메뉴 항목 자체가 나타나지 않습니다.

**등록·수정** — 관리자로 로그인 → ☰ → 👥 트레이너 코드 → **🛠 코드 관리**

- 한 줄에 하나씩 `이름 1234 5678 9012` 형식으로 붙여넣고 **일괄 저장**
- 같은 이름은 덮어쓰기, 형식이 안 맞는 줄은 건너뛰고 결과가 버튼 위에 표시됨
- 삭제는 목록의 `삭제` 버튼

새 친구가 들어오면: 가입 승인 → 코드 관리에서 코드 추가, 두 단계면 끝입니다.

---

</details>

<details>
<summary>6. Firebase 최초 설정</summary>

## 6. Firebase 최초 설정

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

> **(v2.8.0) 설정값은 코드가 아니라 `.env`에 둔다.** `cp .env.example .env` 후 `FIREBASE_CONFIG_JSON`·`ADMIN_UID`·`GA_ID`·`CONTACT_EMAIL`을 채운다. GitHub Actions는 Settings → Secrets and variables → Actions → **Variables**에 같은 이름으로 넣는다(둘 다 채워야 로컬과 배포가 같은 빌드가 된다). 다만 `GA_ID`(v3.27.1)와 `CONTACT_EMAIL`(v3.32.0)은 **워크플로 파일에 직접 적혀 있어** 저장소 변수를 더 읽지 않는다 — 값을 바꾸려면 `.github/workflows/deploy.yml`·`deploy-dev.yml` 두 곳을 고친다. 보안 규칙은 `firestore.rules`의 `__ADMIN_UID__`를 `bash scripts/render_rules.sh`로 채운 `firestore.rules.local`을 콘솔에 붙여넣는다. 저장소가 public이므로 실제 값이 든 파일(`.env`, `firestore.rules.local`)은 절대 커밋하지 않는다(.gitignore에 있음).


이미 설정된 프로젝트가 있다면 건너뛰세요. 새로 만들 때만 필요합니다.

1. [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 추가
2. `</>` 웹 앱 등록 → 나오는 `firebaseConfig`를 `backend/build.py`의 `FIREBASE_CONFIG`에 파이썬 dict로 입력 (Firebase 호스팅 체크는 불필요 — GitHub Pages 사용)
3. **Authentication** → 시작하기 → 로그인 방법 → **Google** 사용 설정 → 지원 이메일 선택
4. Authentication → 설정 → **승인된 도메인**에 `minsangkwak.github.io` · `moncamp.kr` · `dev.moncamp.kr` 추가 (2026-09-14 v3.27.0 커스텀 도메인 — 12절)
5. **Firestore Database** → 만들기 → 위치 `asia-northeast3(서울)` → 프로덕션 모드 → **규칙** 탭에 저장소의 [`firestore.rules`](../infra/firebase/firestore.rules) 붙여넣고 **게시**

`FIREBASE_CONFIG`가 비어 있으면 로그인 UI가 빌드에 들어가지 않아, 설정 전에 배포해도 나머지 기능은 정상입니다.
`apiKey`는 비밀이 아니라 공개 식별자입니다 — 실제 방어선은 5번의 보안 규칙과 4번의 승인된 도메인입니다.

---

</details>

<details>
<summary>7. 사용 통계(GA4) 보는 법</summary>

## 7. 사용 통계(GA4) 보는 법

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

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

</details>

<details>
<summary>8. 노션 운영 방안</summary>

## 8. 노션 운영 방안

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

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

</details>

<details>
<summary>9. 시즌 기술 변경 갱신</summary>

## 9. 시즌 기술 변경 갱신

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

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

</details>

<details>
<summary>10. 정기 점검 체크리스트</summary>

## 10. 정기 점검 체크리스트

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**매달 초**

- [ ] 월 일정표 갱신 (`frontend/scripts/components/schedule.js`의 `SCHEDULE_MONTHS`에 새 달 키 `'YYYY-MM'` 추가 + 확정 일정 기입, 지난 달은 그대로 둔다) — 새 달 데이터가 없으면 지난 달 달력이 폴백으로 보이고 이번 주 보스 카드는 숨는다 (v2.13.0 QA-20). 수집 기준: 현지시간=KST, 스포트라이트=목요일, 한국 전용 이벤트 별도 확인, 메가·5성·D-MAX·섀도우 분류. 로테이션은 대략 전달 말 발표
- [ ] 새 다이맥스·거다이맥스 출시분을 `backend/config/max_released.txt`에 추가
- [ ] 새 폼이 나왔는데 화면에 안 보이면: 게임마스터 폼 접미사가 `FORM_KO`에 있는지 확인 (없으면 `names.py`의 `GM_FORM_EXCEPTIONS`, PokeAPI에 그림이 없으면 `sprite.py`의 `LOCAL_FORMS`)
- [ ] ★ 즐겨찾기에서 '기타'로 떨어지는 비율이 높으면 `roles_build.py`의 `PVE_CUT`·`PVP_CUT` 완화 검토
- [ ] 새 GO 배틀리그 시즌이 시작됐으면 [9장](#9-시즌-기술-변경-갱신)대로 `move_changes.txt` 교체

**수시**

- [ ] 배포 성공 여부 (Actions 탭에 빨간 X가 없는지) — 노란 경고 `직전 정상본으로 대체` 가 이틀 넘게 이어지면 원본 쪽 변화다 ([3장](#incidents))
- [ ] 매주 월요일 **Backup Firestore user data** 가 초록인지 — 빨간 X 면 시크릿이 빠졌거나 만료된 것 ([14장](#14-firestore-사용자-데이터-백업-2026-09-16-v3470))
- [ ] GA 이벤트로 탭 사용 순위 확인 → 탭 순서 재검토
- [ ] 가입 승인 대기자 확인 (☰ → 🔑 가입 승인)
- [ ] 새 폼·메가가 도감에 정상 표기되는지 (PvPoke `released` 반영 지연 확인)

---

</details>

<details>
<summary>11. 트래픽·남용 대응</summary>

## 11. 트래픽·남용 대응

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

접속이 몰릴 때의 쓰로틀링·IP 차단은 **GitHub Pages에서는 불가능**합니다(제어할 서버가 없음). 무엇이 가능하고 언제 무엇을 하면 되는지는 [인프라 문서](INFRA.md)에 정리했습니다.

요약만 옮기면:

- 지금 규모는 월 대역폭 100GB 한도 대비 **첫 방문 약 7만 회분 여유** — 대비할 단계가 아님
- 진짜 한도는 Firestore(무료 Spark: 일 읽기 5만). 초과해도 **과금이 아니라 그날 기능 정지**
- 커지면 순서는 **도메인 구입 → Cloudflare 무료 연결 → rate limiting·봇 차단 → Firebase App Check**
- `robots.txt`는 배포에 포함되어 있으나 규칙을 지키는 봇에게만 유효 (강제력 없음)

---

</details>

<details>
<summary>12. 커스텀 도메인 moncamp.kr (2026-09-14 v3.27.0)</summary>

## 12. 커스텀 도메인 moncamp.kr (2026-09-14 v3.27.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

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

- **origin 이 바뀐다** — `pogo_*` localStorage(테마 · 언어 · 동의 · 로그인 전에 담아 둔 ★ `pogo_favs`)는 새 주소에서 빈 상태로 시작한다. 승인 로그인한 사용자의 ★ 는 Firestore 에 있어 무사.
- **GA4** — 측정 ID 노출 조건에 `moncamp.kr` 을 넣었다(v3.27.0). GA 속성 설정의 스트림 URL 은 콘솔에서 바꾼다(통계는 URL 과 무관하게 같은 ID 로 이어진다).
- **CAA 레코드는 넣지 않는다.** 넣어야 한다면 `letsencrypt.org` 를 허용해야 인증서가 나온다.
- 가비아 만기 **2028-09-14**. 두 달 · 한 달 · 2주 전 알림을 캘린더에 따로.

---

</details>

<details>
<summary>13. 검색 색인 (2026-09-14 v3.28.0)</summary>

## 13. 검색 색인 (2026-09-14 v3.28.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

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

---

</details>

<details>
<summary>14. Firestore 사용자 데이터 백업 (2026-09-16 v3.47.0)</summary>

## 14. Firestore 사용자 데이터 백업 (2026-09-16 v3.47.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

가입 승인 목록(`allowlist`) · 가입 요청(`requests`) · 내 포켓몬(`users`) · 트레이너 코드(`trainers`)는 Firestore 한 곳에만 있고, Spark 요금제에는 자동 백업이 없습니다. `.github/workflows/backup-firestore.yml` 이 **매주 월요일 01:00 KST** 에 네 컬렉션을 받아 암호화한 아티팩트로 **90일** 보관합니다(최대 13벌). 시크릿 둘이 없으면 워크플로는 첫 단계에서 멈추고 무엇이 없는지 말합니다.

### 최초 1회 설정 (10분)

1. **서비스 계정** — [Google Cloud 콘솔 → IAM → 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts) 에서 Firebase 프로젝트를 고르고 **계정 만들기** → 이름 `moncamp-backup` → 역할 **Cloud Datastore 뷰어**(`roles/datastore.viewer`) 하나만. 만든 계정 → 키 → **새 키 만들기(JSON)** → 내려받은 파일을 한 줄로 만든다: `python3 -c "import json,sys;print(json.dumps(json.load(open(sys.argv[1]))))" <파일>`
   - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정의 "새 비공개 키" 도 되지만 그 계정은 **편집자** 권한이라 백업용으로는 과합니다. 읽기만 되는 전용 계정을 권장합니다
2. **시크릿 등록** — 저장소 Settings → Secrets and variables → Actions → **Secrets**(Variables 아님)
   - `FIREBASE_SA_JSON` — 위 한 줄 JSON
   - `BACKUP_PASSPHRASE` — 긴 무작위 문자열(예: `openssl rand -base64 32`). **비밀번호 관리자에 따로 보관** — 잃어버리면 백업을 못 풉니다
3. **한 번 돌려 본다** — Actions → Backup Firestore user data → Run workflow. 로그에 `backup ok: allowlist N · requests N · users N · trainers N` 이 찍히고 아티팩트 `firestore-backup-<날짜>.json.enc` 가 붙으면 됩니다

### 되돌리기

```bash
# 1. Actions 실행 화면에서 아티팩트를 받아 푼다 → firestore-backup-20260916.json.enc
openssl enc -d -aes-256-cbc -pbkdf2 -in firestore-backup-20260916.json.enc -out firestore-backup.json
# 2. 무엇을 되돌릴지 먼저 본다 (아무것도 안 바꾼다)
python3 scripts/firestore_restore.py firestore-backup.json --only users --id <uid>
# 3. 맞으면 실제로 쓴다 — 쓰기에는 "Cloud Datastore 사용자" 역할의 키가 필요하다 (백업용 뷰어 키로는 안 된다)
FIREBASE_SA_JSON='<한 줄 JSON>' python3 scripts/firestore_restore.py firestore-backup.json --only users --id <uid> --apply
```

`--only` · `--id` 없이 `--apply` 하면 네 컬렉션 전부를 백업 시점으로 되돌립니다. 백업에 있는 문서만 덮어쓰므로 **백업 뒤에 생긴 문서는 남습니다**. 다 끝나면 평문 `firestore-backup.json` 을 지우세요 — 이메일과 트레이너 코드가 들어 있습니다.

### 알아둘 것

- 백업 파일은 이메일·트레이너 코드가 든 개인정보입니다. 아티팩트가 암호화돼 있는 이유이고, 평문을 저장소·노션·채팅에 올리지 않습니다
- 90일이 지나면 GitHub 이 아티팩트를 지웁니다. 더 오래 남기려면 분기마다 한 벌을 받아 로컬 비밀번호 관리자·암호화 드라이브에 두세요
- 컬렉션이 늘면 `scripts/firestore_backup.py` 의 `COLLECTIONS` 에 이름을 더합니다

---

</details>

<details>
<summary>15. 포켓몬 검색순위 — 보류 (2026-09-20 v4.6.3)</summary>

## 15. 포켓몬 검색순위 — 보류 (2026-09-20 v4.6.3)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**화면·집계는 내렸고, 기록은 계속 쌓인다.** 실측(GA4 최근 7일)이 page_view 408회 · 사용자 54명이라 순위가 서지 않는다.
검색순위 보드 · `#/hot` 전체 보기 · `backend/hotsearch_build.py` · 낮 12시 집계 cron 은 v4.6.2 까지 만든 그대로
`ranking` 브랜치에 있다. 백로그 행은 Notion 'moncamp 버전·백로그 WBS' 에 있다.

남아 있는 것 —
- **GA4 `search` 이벤트** (`frontend-v4/src/lib/track.ts` `trackSearchPick`). 검색창에서 **골라 연 완성어**만 보낸다.
  다시 올릴 때 이 수가 밑천이라 계속 쌓는다. 통계를 끈 사람은 안 센다.
- **저장소 시크릿 `GA_SA_JSON` · `GA_PROPERTY_ID`** — 서비스 계정은 GA 속성 뷰어로 이미 들어가 있다. 지우지 않는다.

다시 올릴 때 볼 신호 — GA 탐색 보고서에서 `search` 이벤트의 `search_term` 상위가 **하루 3회 이상인 이름이 셋**을 넘기 시작하면
하루 창으로 순위가 선다. 그 전에는 일주일 창(`ranking` 브랜치 v4.6.1 의 `WINDOWS`)으로 시작한다.

---

</details>

<details>
<summary>16. 수집 서버 운영 (2026-09-21 v4.7.0)</summary>

## 16. 수집 서버 운영 (2026-09-21 v4.7.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**GA4 가 안 돌려주는 원본을 내 DB 에 남기는 서버다.** 구조와 설계 배경은
[`server/README.md`](../server/README.md) · [개발 문서 §2.28](DEVELOPMENT.md#228-기록할-자리를-만든다--화면은-그대로-정적-v472) 에 있다.
여기는 **운영자가 하는 일**만 적는다.

### 16.1 최초 설정 — 순서를 지킨다

| # | 할 일 | 확인 |
| --- | --- | --- |
| 1 | **GCP 예산 알림 $1** ([인프라 §7](INFRA.md#7-수집-서버--비용-0-을-유지하는-조건-2026-09-21-v470)) | 결제 → 예산 및 알림에 줄이 보인다 |
| 2 | Neon 프로젝트 생성 → `DATABASE_URL` 복사 | `?sslmode=require` 가 붙어 있다 |
| 3 | `openssl rand -hex 32` → `ADMIN_TOKEN` | 64자다 |
| 4 | GCP 서비스 계정 + Artifact Registry 저장소 `moncamp` | `roles/run.admin` · `roles/iam.serviceAccountUser` · `roles/artifactregistry.writer` |
| 5 | 저장소 **시크릿** 넣기 | `GCP_PROJECT_ID` · `GCP_SA_KEY` · `DATABASE_URL` · `ADMIN_TOKEN` · `COLLECT_BASE_URL` |
| 6 | `server 배포 (Cloud Run)` 수동 실행 | 마지막 단계 `health 200` |

> **4번 전까지 이 워크플로는 아무것도 안 하고 초록으로 끝난다.** 시크릿 셋(`GCP_PROJECT_ID` ·
> `GCP_SA_KEY` · `DATABASE_URL`)이 다 있어야 배포로 들어간다 — 설정을 안 한 것은 고장이 아니라서,
> `deploy` 브랜치에 밀 때마다 빨간 줄을 남기지 않는다. 로그의 `notice` 한 줄로 건너뛴 것을 알린다.

| 7 | 도메인 `api.moncamp.kr` → Cloud Run 매핑 | `curl https://api.moncamp.kr/health` |
| 8 | ~~저장소 **변수** `COLLECT_URL`~~ → **v5 부터는 배포 워크플로가 켠 채로 굽는다** (`deploy-web.yml`). 변수는 덮어쓸 때만 쓴다 | 다음 사이트 배포부터 수집이 켜진다 |

**8번을 안 하면 아무것도 안 쌓인다.** 화면은 `COLLECT_URL` 이 비면 수집을 통째로 끈다 —
`FIREBASE_CONFIG.apiKey` 가 없으면 로그인이 꺼지는 것과 같은 규칙이다. **1번을 안 했으면 6번을 하지 않는다.**

### 지킬 것 둘 — 날짜와 리전

**① 방침에 적힌 시행일과 실제로 켜는 날이 같아야 한다.** 개인정보처리방침 10번이 "방침을 바꾸면 시행 7일 전에
패치노트로 알린다" 고 약속했고, v4.7.1 의 패치노트가 그 알림이다. 1~7번은 미리 해 둬도 된다 —
서버가 떠 있어도 `COLLECT_URL` 이 비면 브라우저가 한 건도 안 보낸다.

> **2026-09-23 (v4.9.9) — 시행일을 9/28 에서 9/23 으로 앞당겼다.** 운영자가 수집을 바로 켜기로 했다(CLAUDE.md §3).
> 새 화면이 dev 에 뜨는 날부터 쌓이므로 방침 본문 · `PRIVACY_VER` · `TERMS_VER` · 옛 공지의 날짜를 9/23 으로 고치고,
> 패치노트 맨 위에는 "이제부터 개인정보를 수집합니다" 한 줄을 세웠다 (운영자가 정한 문구).
> 날짜를 고치는 곳은 web · frontend-v4 **두 벌**이다 (`src/lib/legalMeta.ts` · `src/screens/Legal.tsx`).

**② Neon 리전은 `ap-southeast-1`(싱가포르) 로 만든다.** 방침 4번의 국외 이전 표에 그렇게 적혀 있다.
다른 리전을 골랐으면 **표를 그 값으로 고친다** — 처리위탁 표는 실제와 달라지면 안 되는 자리다
(`web/src/screens/Legal.tsx` 와 `frontend-v4/src/screens/Legal.tsx` **둘 다** — v3 의 `privacy.js` 는 Phase 1-C 에 지웠다).

### 16.2 잘 쌓이는지 보는 법

```bash
# 최근 7일 순위 (문턱 적용 — 초기에는 빈 표가 정상이다)
curl -s 'https://api.moncamp.kr/v1/hot?days=7' | python3 -m json.tool

# 문턱 없이 날것으로. 한 건이라도 들어왔는지는 이쪽으로 본다
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" 'https://api.moncamp.kr/v1/hot?days=7&raw=true' | python3 -m json.tool
```

브라우저에서는 콘솔에 `window.__collectLog` — 이 탭에서 무엇을 고쳤는지 그대로 보인다.
**`__collectLog` 에는 쌓이는데 서버에는 없다**면 `COLLECT_URL` 이 비었거나 `Origin` 이 허용 목록에 없다 (`403`).

### 16.3 GA4 와 견주기

**둘을 나란히 두는 동안이 유일한 검증 기회다.** GA4 탐색 보고서의 `search` 이벤트 수와
`/v1/hot?raw=true` 의 합이 **비슷한 자릿수**면 수집기가 제대로 붙은 것이다. 정확히 같을 수는 없다 —

| 왜 다른가 | 어느 쪽이 더 많나 |
| --- | --- |
| GA4 는 봇 트래픽을 걸러낸다 (v2.37.0) | 내 DB |
| 내 DB 는 사람당 한도(5)를 건다 | GA4 |
| 광고 차단기가 GA 스크립트를 막는다 (`sendBeacon` 은 대체로 통과) | 내 DB |

### 16.4 막혔을 때

| 증상 | 먼저 볼 것 |
| --- | --- |
| `health` 가 503 | `DATABASE_URL`. Neon 컴퓨트가 자고 있으면 몇 초 뒤 200 이 된다 — 계속 503 이면 접속 문자열이다 |
| 수집 요청이 403 | `ALLOWED_ORIGINS` 에 그 주소가 없다. `deploy-server.yml` 의 `ENV_VARS` 를 본다 |
| 수집 요청이 400 | 스키마를 못 넘었다. Cloud Run 로그에 어느 칸인지 찍힌다 |
| 배포가 `health` 에서 멈춘다 | 부팅에서 죽은 것이다 — 환경변수 관문(`src/env.ts`)이 무엇이 없다고 말한다 |
| 집계 워크플로가 빨갛다 | `COLLECT_BASE_URL` · `ADMIN_TOKEN` 시크릿. 열쇠가 틀리면 401 이다 |

**어느 경우에도 사이트는 멀쩡하다.** 화면은 이 서버를 런타임에 읽지 않는다 — 급하게 고칠 일이 아니다.

### 16.5 정기 점검에 더할 줄

[10장](#10-정기-점검-체크리스트) 에 함께 본다.

- [ ] GCP 결제 대시보드가 **$0** 인가 (월 1회)
- [ ] `/v1/hot?raw=true` 의 줄 수가 늘고 있는가 (월 1회) — 안 늘면 `COLLECT_URL` 부터 본다
- [ ] Neon 저장 용량 (분기 1회). 12개월 파기가 자동으로 도니 손볼 일은 거의 없다

### 16.6 12개월 파기 (2026-09-21 v4.7.2)

**방침 5번에 적은 기간을 코드가 지킨다.** 적어 두고 안 지우면 그게 위반이라,
`server 일별 집계·파기` 워크플로(매일 01:30 KST)가 집계와 함께 파기까지 한 부름에서 한다.

| 순서 | 무엇 |
| --- | --- |
| 1 | 최근 며칠을 다시 세어 `search_daily` 에 굳힌다 (늦게 온 이벤트 반영) |
| 2 | **12개월 넘은 구간을 먼저 굳히고**, 그다음 `events` 에서 지운다 |

**순서가 반대면 그 기간의 순위 역사가 통째로 사라진다.** 한 판(transaction)이라 중간에 끊겨도
반쯤 지워진 표가 남지 않는다. 이미 굳힌 날은 덮어쓰지 않는다 — 같은 셈이라 덮을 이유가 없다.

응답으로 확인한다.

```json
{ "ok": true, "written": 12, "purged": { "rolled": 0, "deleted": 0 }, "keepMonths": 12 }
```

`deleted` 가 계속 0 인 것이 정상이다 — 첫 12개월 동안은 지울 것이 없다.

`throughDay` 가 **어느 KST 날짜까지 지웠나**를 말한다. 이 날짜는 `날짜 - 12개월` 이 아니라
약속(`D + 12개월 <= 오늘`)이 참인 가장 늦은 날이다 — 달을 빼면 월말이 당겨 붙어
4년에 한 번 2/29 가 하루 더 살아남는다 (v4.8.1, `server/SCHEMA.md` 12개월 파기).

---

</details>

<details>
<summary>17. 백업본을 GCS 에도 (2026-09-21 v4.8.0)</summary>

## 17. 백업본을 GCS 에도 (2026-09-21 v4.8.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**Actions 아티팩트는 90일 뒤 사라진다.** 그보다 오래된 사본이 한 벌도 없었다.
같은 암호화본을 GCS 에 한 벌 더 두고 12개월 뒤 자동 삭제한다.

수탁자는 **Google LLC 로 이미 표에 있는 곳**이다(Firestore · Cloud Run) — 새 업체가 늘지 않는다.
방침 4번에 Cloud Storage 줄을, 5번에 백업 보유 기간을 적었다(시행 2026-09-28).

### 17.1 한 번만 해 두면 되는 것

| # | 무엇 | 확인 |
| --- | --- | --- |
| 1 | 버킷 만들기 — **서울 `asia-northeast3`**, 균일 액세스, 공개 안 함 | 방침 4번 표에 그 리전이 적혀 있다 |
| 2 | **수명 주기 규칙: 365일 뒤 삭제** | 방침 5번의 "12개월 뒤 자동 삭제" 를 지키는 것이 이 규칙 하나다 |
| 3 | `GCP_SA_KEY` 의 서비스 계정에 `roles/storage.objectCreator` | 없으면 올리기에서 403 |
| 4 | 저장소 시크릿 `BACKUP_BUCKET` = 버킷 이름 | 없으면 **조용히 건너뛴다** (고장이 아니다) |

**2번을 빠뜨리면 방침이 거짓이 된다.** 버킷에 규칙을 안 걸면 12개월 뒤에도 안 지워진다 —
코드로 지우는 게 아니라 **버킷이 지운다.**

### 17.2 백업이 살아 있는지

```bash
curl -s "$BASE/v1/admin/backups" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

```json
{ "ok": true, "problems": [], "latest": { "ran_at": "…", "location": "gs://…", "counts": {…} } }
```

**백업의 진짜 실패는 조용하다.** 워크플로는 초록인데 받아 온 문서가 절반이 됐거나, 몇 주째 안 돌았는데
아무도 모르는 쪽이다. 넷을 본다.

| 판정 | 언제 | 무슨 뜻 |
| --- | --- | --- |
| `마지막 백업이 N일 전` | 8일 초과 | 주 1회인데 한 번은 걸렀다 |
| `지난번 백업과 N일 벌어졌습니다` | 8일 초과 | 그 사이 한 번은 걸렀다 (v4.8.1) |
| `문서 수가 A → B 로 줄었습니다` | 총합 30% 초과 감소 | 아래 줄이 아무것도 못 짚었을 때만 — **여럿이 조금씩** 줄어든 경우다 |
| `컬렉션 X 가 … / 아예 없습니다` | **여태 최대치** 대비 30% 초과 감소 | 총합이 가리던 자리다 (v4.8.1). 잣대에 창을 두면 망가진 판이 그만큼 쌓였을 때 사고가 지워진다 (v4.8.5) |

**묻는 자리가 둘이다** (v4.8.1).

| 어디서 | 언제 | 왜 |
| --- | --- | --- |
| `backup-firestore.yml` 마지막 단계 | 백업 직후, 주 1회 | 방금 올린 것이 이상한지 바로 본다 |
| `server-rollup.yml` 마지막 단계 | **매일** | 백업 워크플로가 **멈춰 있으면 그쪽 경보도 멈춘다** |

둘 다 문제가 있으면 실행 로그에 `warning` 으로 남기고, **못 물었으면 단계를 빨갛게 세운다** (v4.8.6).

| 답 | 어떻게 되나 |
| --- | --- |
| `200` · `ok: true` | `백업 상태: 괜찮음` |
| `200` · `ok: false` | 짚은 것마다 `::warning::` |
| `500` · `401` · 연결 끊김 | `::error::` + **단계 실패** — 판정이 없는 것은 '괜찮음' 이 아니다 |
| `200` 인데 `ok` 가 없음 | `::error::` + 단계 실패 — 주소가 바뀌었거나 열쇠가 막혔다 |

**감시자가 조용히 초록이 되는 것이 가장 나쁘다.** 예전에는 연결이 끊겨도 빈 값으로 넘어가
`problems` 가 없다고 읽혔다 — 아무 일도 없는 것처럼 보였다.

**진짜로 줄어든 것이면 사람이 끊는다** (v4.8.5). 잣대가 "여태 최대" 라 계정을 정말 정리한 경우
영영 시끄러워진다 — 시끄러우면 아무도 안 본다. 그 하나를 Neon 콘솔에서 SQL 한 줄로 끊는다.

```sql
insert into backup_ack (collection, baseline, reason)
values ('users', 40, '2026-10-02 계정 정리 — 확인함')
on conflict (collection) do update
  set baseline = excluded.baseline, reason = excluded.reason, acked_at = now();
```

**기계가 스스로 잊지는 못한다.** 못 박은 수보다 더 줄면 다시 묻고,
되살아나면 못 박지 않아도 그 판에서 바로 조용해진다.

**못 박은 뒤 되살아나면 못을 지울 필요가 없다** (v4.8.5). 잣대는 못 박은 수와
`acked_at` 이후에 본 가장 큰 수 중 **큰 쪽**이라, 40 으로 못 박고 100 으로 돌아온 뒤
다시 40 이 되면 새 사고로 다시 묻는다 — 옛 못이 새 사고를 덮지 않는다. 백업 워크플로 쪽은 기록을 **넣고 나서**
묻기 때문에 '마지막 백업의 나이' 로는 걸른 주가 안 보인다 — 그래서 간격 판정이 따로 있다.

### 17.3 되돌리기

바뀐 것이 없다 — 받는 곳만 하나 늘었다.

**이름에 실행 번호와 차수가 붙는다** (v4.8.4) — `firestore-backup-<날짜>-r<실행ID>.<차수>.json.enc`.
아티팩트도 GCS 도 같은 이름을 쓰므로, 같은 날 다시 돌려도 앞선 사본을 덮지 않고
**재시도 자체가 막히지도 않는다** (`upload-artifact@v4` 는 한 실행에서 같은 이름을 두 번 못 올린다). 어느 것을 받을지는 `GET /v1/admin/backups` 의
`location` 이 정확히 말해 준다.

```bash
gcloud storage ls gs://<버킷>/firestore/           # 어떤 것이 있나
gcloud storage cp gs://<버킷>/firestore/<위 location 의 파일> .
openssl enc -d -aes-256-cbc -pbkdf2 -in firestore-backup-<날짜>-r<실행ID>.<차수>.json.enc -out firestore-backup.json
python3 scripts/firestore_restore.py            # 미리보기
python3 scripts/firestore_restore.py --apply    # 실제 쓰기
```

끝나면 평문 `firestore-backup.json` 을 지운다 — 이메일과 트레이너 코드가 들어 있다.

### 17.4 정기 점검에 더할 줄

- [ ] `/v1/admin/backups` 의 `ok` 가 `true` 인가 (월 1회)
- [ ] GCS 버킷에 파일이 매주 하나씩 늘고 있는가 · 365일 규칙이 살아 있는가 (분기 1회)

</details>

<details>
<summary>18. 브랜치 보호 (2026-09-22 v4.9.7)</summary>

## 18. 브랜치 보호 (2026-09-22 v4.9.7)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**여덟 브랜치가 전부 무방비였다** (`protected: false`). `deploy` 는 운영 배포 방아쇠라 푸시 한 번에 사이트가 나간다.
저장소가 private 이 되면서 보호 규칙은 Pro 에서만 쓸 수 있는데, Pro 라 문제없다.

**설정은 저장소 Settings → Rules → Rulesets → New branch ruleset** 에서 한다. 코드로 못 하는 일이라 표로 둔다.

| 브랜치 | 켤 것 | 안 켤 것과 이유 |
| --- | --- | --- |
| `deploy` | **Block force pushes** · **Restrict deletions** | *Require PR* 은 안 켠다 — 배포가 `main` 을 머지해 **직접 푸시**하는 흐름이다(§6). 빨리감기 푸시는 그대로 통한다 |
| `main` | Block force pushes · Restrict deletions · **Require a pull request before merging** (approvals 0) | 혼자라 승인 수는 0. dev → main 이 PR 로만 가게 못 박는 것이 목적이다 |
| `dev` | Block force pushes · Restrict deletions | 봇(`bot/game-update-candidates`)과 작업 가지가 PR 로 들어오는 자리라 PR 강제는 안 한다 |

**Bypass list 에 자기 자신을 넣지 않는다.** 넣으면 규칙이 아무것도 안 막는다. 급할 때는 규칙을 잠시 끄고 다시 켠다 — 그 흔적이 남는 것이 규칙의 값이다.

확인은 실제로 밀어 보지 않는다. Rulesets 화면에서 세 줄이 **Active** 인지 본다.

**2026-09-22 저녁에 셋 다 Active 다.** 규칙 아래서 첫 병합이 #141(dev) · #142(main) 이고, `deploy` 는 머지 커밋 직접 푸시(7fab346)가 그대로 통했다 — 설계대로다.

</details>

<details>
<summary>19. 2026-09-22 운영 반영 — v4.9.8 · 광고 앞 다지기</summary>

## 19. 2026-09-22 운영 반영 — v4.9.8 · 광고 앞 다지기

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**dev 에서 검증이 끝난 v4.9.2 ~ v4.9.8 을 한 번에 운영에 올렸다.** 한 장 요약은 [`docs/hardening-2026-09-22.png`](hardening-2026-09-22.png) 다.

| 걸음 | 근거 |
| --- | --- |
| dev → main | PR #142 (merge commit `a9ba960`) — main 룰셋(PR 필수) 아래서 |
| main → deploy | 머지 커밋 `7fab346` (deploy 는 스냅샷 커밋이 있어 빨리감기가 안 된다 — §1 의 "정상") |
| 운영 Actions | run 35689783060 성공 |
| 검증 | `bash scripts/verify_deploy.sh https://moncamp.kr/ prod v4.9.8` 전 항목 통과 — 화면 46장 `NaN`·`undefined` 없음 · 명암비 42장 0 |

> `verify_deploy.sh` 는 기대 버전을 **작업 트리의 `backend/build.py`** 에서 읽는다. 작업 브랜치가 낡아 있으면
> "판 번호가 v4.9.6 가 아님 (실제: v4.9.8)" 처럼 스크립트 쪽이 틀린다. 셋째 인자로 버전을 주거나 main 을 먼저 당긴다.

### 같은 날 코드 밖에서 한 조치

| 어디 | 무엇 | 자세히 |
| --- | --- | --- |
| Cloudflare | 네임서버 이관 · Full (strict) · HTTPS 강제 · HSTS · 보안 헤더 넷 · 자산 캐시 1년 · Bot Fight · Rate limit | [INFRA §8](INFRA.md) |
| GitHub | 브랜치 룰셋 셋(`deploy` · `main` · `dev`) · 워크플로 7개의 액션을 커밋 SHA 로 고정 · `pogo-rank` public / `pogo-rank-dev` private | §18 · [INFRA §9](INFRA.md) |
| Firebase | `firestore.rules` v4.9.7(삭제 분리)을 콘솔에 게시 — 루트 uid 는 콘솔에서만 채움 | §4 · [CLAUDE.md §4](../.claude/CLAUDE.md) |
| CI | dev 배포가 규칙 파일이 바뀐 푸시에서만 에뮬레이터(JDK 21)로 규칙 검사 11개를 돈다 | `.github/workflows/deploy-dev.yml` |

**남은 둘**(`/data/*.json` 캐시 규칙 · Rate limit 완화)도 같은 날 저녁에 대시보드에서 끝냈다 — [INFRA §8](INFRA.md) 의 "남은 둘" 밑 "한 것" 표. 이로써 광고 전 다지기 목록은 비었다.

</details>

<details>
<summary>20. 운영 통계 화면 (2026-09-24 v5.2.0)</summary>

## 20. 운영 통계 화면 (2026-09-24 v5.2.0)

> 과거 기록입니다. 현재 설정·실행 절차는 이 문서 상단을 확인하세요.

**루트 관리자만 여는 `/admin/stats`.** 설정 창의 [📊 운영 통계] (또는 🔑 가입 승인 팝업의 [📊 운영 통계 보기]) 로 들어온다. 메뉴 · 사이트맵에 없고 검색에 안 잡힌다(noindex).
서버 `GET /v1/admin/stats` 가 루트 토큰만 받고, **모아 센 값만** 준다(이메일 · 이름 · 방문자 ID 없음).

| 칸 | 원본 | 켜는 데 필요한 것 |
| --- | --- | --- |
| 가입 · 로그인 · ★ | Neon `users` · `sessions` · `favorites` | 없음 |
| 검색 | Neon `events` (name=search, 운영 채널) | 없음 |
| 화면별 페이지뷰 | Neon `events` (name=view) — **2026-09-24 부터** (v5.2.1 바로 시행) | 없음 |
| 방문자 · 페이지뷰 (GA4) | GA4 Data API | 아래 셋 |

### GA4 칸 켜기 — 한 번만

1. **서비스 계정에 뷰어 권한** — GA4 관리 → 속성 액세스 관리 → [+] → `930214645157-compute@developer.gserviceaccount.com` 를 **뷰어**로.
   서버(Cloud Run `moncamp-api`)가 도는 계정이다 — 열쇠 파일 없이 메타데이터 서버에서 토큰을 받는다.
2. **API 켜기** — `moncamp api` 프로젝트에서 **Google Analytics Data API** 사용 설정.
3. **속성 ID** — GA4 관리 → 속성 세부정보의 **숫자 ID**(측정 ID `G-…` 가 아니다)를 저장소 **변수**(`Settings → Secrets and variables → Actions → Variables`) `GA4_PROPERTY_ID` 에 넣고 서버를 다시 올린다.

안 되면 화면의 GA4 칸이 이유를 적는다 — '뷰어 권한이 없습니다' 면 1, 'Data API 가 꺼져 있습니다' 면 2, 'GA4_PROPERTY_ID 가 설정되지 않았습니다' 면 3.
성공한 값은 10분, 실패는 1분 동안 기억한다 — 권한을 고친 뒤 1분 안에 다시 받으면 이전 오류가 남아 있을 수 있다.

**페이지뷰는 시행일 문 없이 바로 센다** (v5.2.1, 운영 결정). 방침(`Legal.tsx`) · `legalMeta.ts` 의 날짜가 9/24 이고,
`web/src/test/viewgate.test.ts` 가 서버 · 브라우저에 날짜 문이 다시 생기지 않았는지와 방침 날짜 · 본문 · 정정 공지가 맞는지 본다.

**루트가 아니면 없는 화면** — 로그인 전 · 위임 관리자 모두 🧭 '없는 화면이에요' 를 본다. 제목줄 · 정적 머리 제목도 '운영 통계' 를 말하지 않고,
루트 화면은 GA4 · 우리 수집에 안 센다. 루트는 설정 창 [📊 운영 통계] 로 들어온다. 기본 기간은 '9/14부터'(서버 긴 끝 400일).

</details>
