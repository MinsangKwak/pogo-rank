# 인프라 · 트래픽 대응 문서 — moncamp

[← README](../README.md) · [개발 문서](DEVELOPMENT.md) · [운영 문서](OPERATIONS.md) · **인프라 문서** · [변경 이력](../CHANGELOG.md)

**GitHub Pages 자체에서는 애플리케이션이 요청 제한이나 IP 차단을 제어할 수 없습니다.** 이 문서는 현재 보호 조치와 트래픽 증가 시 검토할 확장 순서를 정리합니다.

| 확인할 내용 | 바로가기 |
| --- | --- |
| 운영자가 점검할 항목 | [3. 운영 조치](#3-운영자가-해야-할-조치) |
| 이미 적용한 보호 조치 | [4. 적용 내역](#4-이-정적-사이트에-적용한-조치) |
| 확장이 필요한 시점 | [5. 판단 기준과 순서](#5-커졌을-때-로드맵--트리거와-순서) |
| 적용하지 않은 방식과 이유 | [6. 제외한 방안](#6-하지-않기로-한-것과-이유) |
| 수집 서버를 0원으로 유지하기 | [7. 수집 서버](#7-수집-서버--비용-0-을-유지하는-조건-2026-09-21-v470) |

> 아래 용량·방문량과 확장 판단은 작성 당시의 기준입니다. 현재 산출물 구성은 [개발 문서](DEVELOPMENT.md#1-설계-원칙), 도메인 운영 상태는 [운영 문서](OPERATIONS.md#12-커스텀-도메인-moncampkr-2026-09-14-v3270)를 함께 확인하세요.

### 전체 목차

- [1. 왜 지금은 불가능한가](#1-왜-지금은-불가능한가)
- [2. 지금 규모를 숫자로 보면](#2-지금-규모를-숫자로-보면)
- [3. 운영자가 해야 할 조치](#3-운영자가-해야-할-조치)
- [4. 이 정적 사이트에 적용한 조치](#4-이-정적-사이트에-적용한-조치)
- [5. 커졌을 때 로드맵 — 트리거와 순서](#5-커졌을-때-로드맵--트리거와-순서)
- [6. 하지 않기로 한 것과 이유](#6-하지-않기로-한-것과-이유)
- [7. 수집 서버 — 비용 0 을 유지하는 조건](#7-수집-서버--비용-0-을-유지하는-조건-2026-09-21-v470)
- [8. 광고 트래픽을 앞두고](#8-광고-트래픽을-앞두고-2026-09-22)

---

## 1. 왜 지금은 불가능한가

GitHub Pages는 **파일을 나눠주기만 하는 호스팅**입니다. 우리가 제어할 수 있는 서버 프로세스도, 미들웨어도, `.htaccess`도 없습니다. 요청을 받아서 "이 IP는 이번 분에 100번째니까 느리게 주자"라고 판단할 주체 자체가 없습니다.

| 하고 싶은 것 | GitHub Pages에서 | 실제로 가능한 곳 |
|---|---|---|
| 초당·분당 요청 제한(쓰로틀링) | ❌ 불가 | CDN 앞단 (Cloudflare 등) |
| 특정 IP 자동 차단 | ❌ 불가 | 같은 CDN 앞단 |
| 봇 차단 | △ robots.txt는 **부탁**일 뿐 강제력 없음 | Cloudflare Bot Fight Mode |
| 페이지 접근 제어(로그인 벽) | ❌ 정적 파일은 URL만 알면 누구나 | 데이터 접근만 Firestore 규칙으로 제어 |
| 사용량 한도 | 사이트 1GB · 대역폭 **월 100GB(소프트)** · 시간당 10빌드(소프트) | 초과 시 GitHub이 "CDN을 앞에 두라"고 메일 |

**클라이언트(JS)에서 하는 쓰로틀링은 보호 수단이 아닙니다.** 우리 자바스크립트는 "브라우저에서 사이트를 정상적으로 쓰는 사람"만 실행합니다. 트래픽을 유발하는 쪽(스크립트·크롤러·부하 도구)은 애초에 우리 JS를 돌리지 않고 파일만 직접 받아 갑니다. 따라서 클라이언트에서만 제한하면 **일반 사용자의 이용은 느려져도 직접 요청하는 트래픽은 막지 못합니다.** 이 방식은 도입하지 않았습니다.

> **2026-09-21 v4.7.0 이후로 서버가 하나 늘었습니다.** 수집·집계 서버([`server/`](../server/README.md))가
> Cloud Run 에 섭니다. 아래 "우리가 가진 유일한 서버는 Firebase" 는 그때까지의 이야기이고,
> 새 서버의 과금 위험과 그것을 0 으로 묶는 조건은 [7장](#7-수집-서버--비용-0-을-유지하는-조건-2026-09-21-v470)에 따로 적었습니다.
> **화면 표시용 데이터는 정적 파일에서 읽습니다** — 수집 서버가 중단되어도 기존 화면을 표시합니다.

### 진짜 위험은 트래픽이 아니라 Firestore 쪽입니다

정적 파일은 GitHub이 알아서 버텨 줍니다. 우리가 가진 유일한 "서버"는 Firebase입니다.

- 현재 **무료(Spark) 요금제** — 일 읽기 5만 / 쓰기 2만. 한도를 넘으면 **요금이 청구되는 게 아니라 그날 기능이 멈춥니다**(다음 날 리셋). 즉 최악의 경우도 "돈"이 아니라 "잠깐 불편"입니다.
- 데이터 접근은 이미 보안 규칙이 막고 있습니다. 승인 안 된 계정은 즐겨찾기·트레이너 코드를 아예 읽지 못합니다.
- 유료(Blaze)로 올리는 순간 이야기가 달라집니다 — 그때는 **예산 알림 설정이 필수**입니다.

---

## 2. 지금 규모를 숫자로 보면

| 항목 | 값 |
|---|---|
| 첫 방문 전송량 | 약 **1.4MB** (index.html 0.25MB + data.js 1.16MB + 스프라이트 일부) |
| 재방문 전송량 | 거의 0 — 서비스워커가 스프라이트를 캐시, data.js만 갱신 확인 |
| GitHub Pages 월 대역폭 | 100GB (소프트) |
| 환산 | 월 **약 7만 회 첫 방문**까지 여유 |

친구 6명이 하루에 열 번씩 들어와도 월 2,000회가 안 됩니다. **지금은 대비할 단계가 아니라 기록해 둘 단계**입니다.

---

## 3. 운영자가 해야 할 조치

### 지금 (10분, 권장)

- [ ] **Firebase 사용량 확인 습관** — 콘솔 → Firestore → 사용량 탭. 일 읽기가 평소의 10배로 튀면 그때 4번 항목을 본다
- [ ] **Blaze(유료)로 올리지 않기** — 지금은 Spark라 과금 위험이 0. 올릴 일이 생기면 **반드시 예산 알림부터** 설정
- [ ] **승인된 도메인 유지** — Authentication → 설정 → 승인된 도메인에 `minsangkwak.github.io` · `moncamp.kr` · `dev.moncamp.kr`(2026-09-14 v3.27.0)만 있으면 됨. 다른 사이트가 우리 Firebase로 로그인 못 함
- [ ] **Firestore 백업 시크릿 등록** — `FIREBASE_SA_JSON` · `BACKUP_PASSPHRASE` 둘을 넣어야 주간 백업이 돈다 (2026-09-16 v3.47.0, [운영 문서 14장](OPERATIONS.md#14-firestore-사용자-데이터-백업-2026-09-16-v3470)). 이게 없으면 사용자 데이터는 Firestore 한 곳뿐이다
- [ ] robots.txt는 이미 배포됨 (아래 4번). 별도 조치 불필요

### 판이 커지면 (반나절, 트리거는 5번)

> **2026-09-22 갱신** — 이 목록의 전제(도메인 구입)는 이미 끝났습니다(`moncamp.kr`). 광고를 띄우기로 한
> 이상 트리거도 이미 당겨졌습니다. **실제로 무엇을 어떻게 넣는지는 [8장](#8-광고-트래픽을-앞두고-2026-09-22)에 적었습니다.**

- [x] ~~**도메인 하나 구입**~~ — `moncamp.kr` 보유
- [ ] **Cloudflare 무료 플랜에 도메인 연결** → 네임서버 이관 → DNS에서 GitHub Pages를 가리키고 **프록시(주황 구름) 켜기**
- [ ] GitHub 저장소 Settings → Pages → **Custom domain**에 그 도메인 입력 + Enforce HTTPS
- [ ] Cloudflare에서 켤 것: **Bot Fight Mode**(봇 차단), **Security Level: Medium**, **rate limiting 룰 1개**(무료 플랜 제공량 — 예: 같은 IP가 10초에 50요청 넘으면 10초 차단)
- [ ] **Firebase App Check** 켜기 (reCAPTCHA) — 우리 사이트가 아닌 곳에서 우리 Firestore를 부르는 것을 막습니다. 로그인 기능이 있는 지금 구조에서 가장 값어치 있는 방어

> 순서가 중요합니다. **도메인 → Cloudflare → 그 다음에야 쓰로틀링·IP 차단**입니다. 도메인 없이 되는 것은 없습니다.

---

## 4. 이 정적 사이트에 적용한 조치

### 새로 추가 (2026-09-04)

- **`frontend/static/robots.txt`** → 빌드가 `dist/robots.txt`로 복사, 배포 시 `/pogo-rank/robots.txt`로 서비스
  - 일반 검색 엔진: 전체 허용 + `Crawl-delay: 10` (한 번에 몰아 긁지 말라는 요청)
  - AI 학습 크롤러(GPTBot·ClaudeBot·Google-Extended·CCBot·Bytespider): 차단 — 원 저작권이 Nintendo/Niantic에 있는 이미지·명칭이 실려 있어서
  - 공격적 SEO 크롤러(AhrefsBot·SemrushBot·MJ12bot·DotBot): 차단 — 순수하게 대역폭 절약 목적
  - **한계를 분명히**: robots.txt는 규칙을 지키는 봇에게만 통합니다. 무시하고 긁는 쪽은 못 막습니다

### 이미 되어 있던 것 (대역폭·남용 관점에서 다시 보면)

| 조치 | 효과 |
|---|---|
| 서비스워커 캐싱 (스프라이트 캐시 우선) | 재방문 전송량 ≈ 0 — 대역폭 방어에서 가장 큰 역할 |
| 산출물 분리 (HTML + data.js + 개별 스프라이트) | 첫 방문 3.0MB → 1.4MB |
| Firestore 보안 규칙 | 승인 안 된 계정은 데이터 접근 불가 (읽기 횟수 자체가 안 늘어남) |
| Authentication 승인된 도메인 | 다른 사이트가 우리 Firebase 인증을 빌려 쓰지 못함 |
| 트레이너 코드 Firestore 이전 | 소스에 개인 식별값이 남지 않음 |
| CI 스프라이트 캐시 | 빌드마다 1,100여 개 재다운로드 제거 (GitHub 빌드 한도 절약) |

---

## 5. 커졌을 때 로드맵 — 트리거와 순서

무엇을 보면 다음 단계로 넘어가는지, 기준을 미리 정해 둡니다.

| 트리거 | 할 일 | 비용 |
|---|---|---|
| 월 대역폭 10GB 초과 (GA 사용자 수로 환산: 월 7,000명 이상) | 도메인 + Cloudflare 무료 연결 | 도메인 값만 |
| Firestore 일 읽기 5,000회 초과 | Firebase App Check 활성화 | 무료 |
| 특정 시간대에 트래픽이 비정상적으로 튐 | Cloudflare rate limiting 룰 1개 추가 | 무료 |
| GitHub Support에서 대역폭 관련 메일 수신 | 즉시 Cloudflare 프록시 (이미 준비돼 있으면 5분) | 무료 |
| 친구용을 넘어 공개 서비스로 전환 | Blaze + 예산 알림, App Check 필수, Cloudflare Pro 검토 | 유료 |

지금 위치: **표의 어느 줄에도 해당하지 않음.** 이 문서는 해당하게 됐을 때 펼쳐 보려고 씁니다.

---

## 6. 하지 않기로 한 것과 이유

| 아이디어 | 왜 안 하는가 |
|---|---|
| 클라이언트 JS 쓰로틀링 (N회 넘으면 느리게) | 공격자는 우리 JS를 실행하지 않는다. 착한 사용자만 느려지는 순수한 손해 |
| localStorage로 접속 횟수 세서 차단 | 브라우저 저장소는 사용자가 지우면 끝. 시크릿 모드 한 번이면 무력화 |
| IP 자동 차단 | 정적 호스팅에는 IP를 볼 주체가 없다. Cloudflare 단계에서만 가능 |
| 캡차(reCAPTCHA)를 페이지에 삽입 | 정적 사이트에는 캡차 결과를 **검증할 서버**가 없다. Firebase App Check가 이 역할을 대신함 |
| Firebase Blaze로 올려 한도 늘리기 | 지금은 오히려 위험을 늘리는 선택 — Spark의 "멈춤"이 Blaze의 "청구서"보다 안전 |



---

## 7. 수집 서버 — 비용 0 을 유지하는 조건 (2026-09-21 v4.7.0)

**이 문서가 "Spark 의 멈춤이 Blaze 의 청구서보다 안전하다" 고 판단했는데, Cloud Run 은 카드가 걸립니다.**
그 판단을 뒤집은 것이 아니라 **조건을 붙여** 유지합니다.

### 배포 전에 반드시 (순서대로)

- [ ] **GCP 예산 알림을 걸었다.** 결제 → 예산 및 알림 → 월 **$1**, 임계값 50%·100%. **이걸 먼저 한다.**
      이 줄에 체크가 없으면 `deploy-server.yml` 을 돌리지 않는다
- [ ] Neon 프로젝트를 만들고 `DATABASE_URL` 을 저장소 시크릿에 넣었다 (무료 플랜 그대로 — 결제 수단 연결 안 함)
- [ ] `ADMIN_TOKEN` 을 만들었다 (`openssl rand -hex 32`). 32자 미만이면 서버가 부팅을 거부한다
- [ ] Cloud Run 을 **`--min-instances 0`** 으로 올린다. 1 로 올리는 순간 무료 구간을 벗어난다

### 이 부하에서 무료인 이유

| 항목 | 무료 한도(작성 시점) | 우리 예상 | 여유 |
| --- | --- | --- | --- |
| Cloud Run 요청 | 월 200만 | 월 1천 미만 | 2,000배 |
| Cloud Run 컴퓨트 | 월 36만 GB-초 | 놀 때 **0** (scale-to-zero) | — |
| Neon 저장 | 0.5GB | 연 수 MB | 100배 |

> 무료 한도 수치는 **작성 시점 기준**입니다. 바뀌는 값이므로 배포 전에 공식 가격 페이지에서 한 번 확인하고,
> 바뀌었으면 이 표의 날짜와 함께 고칩니다 (이 문서의 2장 용량 표와 같은 규칙).

### 콜드 스타트를 감수하는 이유

Cloud Run 이 인스턴스를 0 으로 내리므로 첫 요청이 1~3초 걸립니다. Neon 컴퓨트도 유휴 후 잠들었다 깹니다.
**화면 표시는 수집 서버의 응답을 기다리지 않습니다.**

- 수집은 답을 안 기다린다 (`sendBeacon` · `fire-and-forget`)
- 순위는 하루 두 번 도는 배포 워크플로가 받아 간다 — 3초가 아니라 30초여도 상관없다

사용자가 기다리는 API 가 생기면 그때 `--min-instances 1` 을 검토합니다. **그건 유료 구간입니다.**

### 새로 생기는 위험과 그물

| 위험 | 그물 |
| --- | --- |
| 공개 엔드포인트로 순위를 오염시킨다 | 겹 다섯 ([`server/README.md`](../server/README.md#순위가-오염되지-않게-하는-다섯-겹)). 마지막 겹(사람당 한도)만으로도 버틴다 |
| 과도한 요청으로 과금이 난다 | `--max-instances 3` · 분당 한도 · 예산 알림 |
| DB 가 죽었는데 200 을 준다 | `/healthz` 가 DB 를 함께 본다 — 못 닿으면 503 이라 Cloud Run 이 그 인스턴스를 뺀다 |
| 수집 실패가 화면을 망가뜨린다 | 보내는 쪽이 예외를 삼킨다. 검사로 못 박았다 (`화면을 망가뜨리지 않는다`) |

### 이 장이 5장 로드맵과 만나는 곳

수집 서버를 세우면 **Cloudflare 를 앞에 두는 일이 미뤄 둘 일이 아니게 됩니다.** 국가 판정(`cf-ipcountry`)이
Cloudflare 에서 나오고, rate limiting 과 봇 차단도 거기가 제자리입니다. 5장 표의 "도메인 + Cloudflare" 줄이
`api.moncamp.kr` 을 붙이는 시점과 같이 옵니다.

---

관련 문서: [운영 문서](OPERATIONS.md) · [개발 문서](DEVELOPMENT.md)
출처: [GitHub Pages 사용 한도](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Cloudflare Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)


---

## 8. 광고 트래픽을 앞두고 (2026-09-22)

**결론부터 — 지금 없는 것은 대역폭이 아니라 응답 헤더입니다.** 광고를 띄우기 전에 할 일은
Cloudflare 를 GitHub Pages 앞에 두는 것 하나이고, 그것으로 보안 헤더·봇 차단·rate limit·캐시가 같이 붙습니다.

### 먼저, 지금 상태를 숫자로

측정일 2026-09-22 · 운영(`https://moncamp.kr`) 실측입니다.

| 재 본 것 | 값 | 뜻 |
| --- | --- | --- |
| 첫 방문 1회 총 전송 | 1,606KB | 이 중 남의 CDN 이 절반 이상 |
| 그중 **moncamp.kr** | **743KB** | GitHub 대역폭에 잡히는 것은 이것뿐 |
| 그중 cdn.jsdelivr.net | 863KB | 글꼴. GitHub 대역폭과 무관하지만 **남의 서버에 걸린 절반** |
| 앞단 | 없음 (`server: GitHub.com`) | Cloudflare 가 안 껴 있다 |
| 응답 보안 헤더 | 없음 | HSTS · X-Frame-Options · X-Content-Type-Options · Referrer-Policy 전부 없음 |
| CSP | `<meta>` 로만 | **`frame-ancestors` 를 못 쓴다** — 클릭재킹을 헤더 없이는 막을 수 없다 |
| Firestore 익명 읽기 | 없음 | 광고 트래픽은 Firestore 쿼터를 **건드리지 않는다** |

`100GB ÷ 0.743MB ≈ 월 13만 5천 첫방문`이 GitHub Pages 소프트 한도입니다. 재방문은 서비스워커가
받아 내므로 실제 여유는 더 큽니다. **대역폭은 아직 병목이 아닙니다.**

### 왜 Vercel 이 아니라 Cloudflare 인가

| | Cloudflare 앞단 | Vercel Pro 이전 |
| --- | --- | --- |
| 비용 | **$0** | $20/월 — Hobby 는 광고를 금지합니다(아래) |
| 응답 보안 헤더 | ✅ Transform Rules | ✅ `vercel.json` |
| 대역폭 | GitHub 쪽이 **줄어든다**(캐시 적중분) | Hobby 도 100GB 로 동일 |
| 작업량 | 네임서버 이관뿐, 배포 파이프라인 무수정 | 배포 워크플로 2개·DNS·CNAME 재배선 |
| PR 미리보기 · `/storybook` 서버측 인증 | ❌ | ✅ |

> Vercel Fair Use Guidelines, Commercial usage —
> "**Hobby teams** are restricted to non-commercial personal use only. All commercial usage of the platform
> requires either a Pro or Enterprise plan. … Examples include … **The inclusion of advertisements, including
> but not limited to online advertising platforms like Google AdSense**"
>
> GitHub Pages 쪽 금지는 범위가 좁습니다 — "primarily directed at **facilitating commercial transactions**
> or providing commercial SaaS". 광고가 붙은 콘텐츠 사이트는 여기 해당하지 않습니다.

**광고 직전에 호스팅을 갈아타지 않습니다.** Cloudflare 로 구멍을 먼저 막고, Vercel Pro 는
① 월 13만 첫방문을 넘거나 ② PR 미리보기·`/storybook` 서버측 인증이 필요해질 때 검토합니다.
그때 Cloudflare DNS 는 Vercel 앞단으로 그대로 재사용됩니다.

### 넣을 것 (순서대로)

**1. 네임서버 이관** — Cloudflare 무료 플랜에 `moncamp.kr` 추가 → 도메인 등록처의 네임서버를 Cloudflare 것으로 교체.
DNS 레코드는 지금 것을 그대로 가져오되 `moncamp.kr` · `dev.moncamp.kr` 의 **프록시(주황 구름)를 켭니다.**

**2. SSL/TLS → Full (strict)** — GitHub Pages 가 제 인증서를 들고 있으므로 Flexible 로 두면 무한 리디렉션이 납니다.

**3. 응답 헤더** (Rules → Transform Rules → Modify Response Header, 모든 요청에 적용)

| 헤더 | 값 | 왜 |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 고정 |
| `X-Content-Type-Options` | `nosniff` | 확장자와 다른 타입으로 읽히는 것을 막는다 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 광고 스크립트에 전체 주소를 안 넘긴다 |
| `Content-Security-Policy` | `frame-ancestors 'self'` | **`<meta>` 로는 못 넣는 것.** 클릭재킹 방어 |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | 안 쓰는 권한을 닫는다 |

> 나머지 CSP 지시문은 `index.html` 의 `<meta>` 가 이미 들고 있습니다. 헤더로 통째로 옮기려면
> `backend/build.py` 의 `__CSP__` 자리와 값을 한 곳에서 맞춰야 하므로, **`frame-ancestors` 만 헤더로 더합니다.**

**4. 캐시 규칙** (Rules → Caching Rules)

| 대상 | 설정 | 왜 |
| --- | --- | --- |
| `/sprites/*` · `/sprites-anim/*` · `/assets/*` | Edge TTL 1년 · Browser TTL 1년 | 이름에 내용 해시가 있거나 id 별로 불변이다 |
| `/data/*.json` | Edge TTL 1시간 | 주소에 `?v=해시` 가 붙어 바뀌면 키가 바뀐다 |
| `/` · `*.html` | Edge TTL 5분 | GitHub 가 `max-age=600` 을 주는 것과 같은 결 |

**5. 보안 기능** — Bot Fight Mode 켜기 · Security Level: Medium ·
Rate limiting 룰 1개(무료 제공량): 같은 IP 가 10초에 50요청을 넘으면 10초 차단.

**6. 켠 뒤 확인**

```bash
curl -sI https://moncamp.kr/ | grep -iE "cf-ray|strict-transport|x-content-type|referrer-policy|content-security"
# cf-ray 가 보이면 프록시가 켜진 것이고, 나머지 넷이 보이면 헤더가 붙은 것이다
bash scripts/verify_deploy.sh https://moncamp.kr/ prod
```

### 여기서 안 하기로 한 것

| 안 한 것 | 이유 |
| --- | --- |
| Firebase App Check | 익명 읽기가 규칙에 **한 곳도 없다** — 광고 트래픽이 Firestore 에 닿지 않는다. 쓰기가 열린 자리가 생기면 그때 |
| Blaze 전환 | 6장 그대로 — Spark 의 '멈춤' 이 Blaze 의 '청구서' 보다 안전하다 |
| 서버 도입 | 수집 서버는 아직 미배포다(`COLLECT_URL` 이 비어 있고 `api.moncamp.kr` 는 무응답). 광고와 무관하다 |

### 남은 숙제 — 글꼴 863KB

첫 방문 무게의 절반이 남의 CDN 에 걸린 글꼴입니다.

```
493KB  cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2   ← 한 파일. unicode-range 가 없어 통째로 받는다
370KB  Pretendard 동적 서브셋 15개                                  ← 이쪽은 쓰는 범위만 받는 중(설계대로)
```

Galmuri 는 포켓몬 **이름**까지 그리므로(`base.css` 의 `.detail__name`) 글자를 골라 줄일 수 없습니다 —
데이터가 바뀌면 없는 글자가 두부(□)로 납니다. 줄이려면 Pretendard 처럼 **`unicode-range` 로 쪼개**
쓰는 구간만 받게 해야 하고, 그건 빌드 단계가 생기는 일이라 이 판에서는 하지 않았습니다.
자체 호스팅으로 옮기면 jsdelivr 의존도 같이 끊깁니다 — 다음 판의 후보입니다.

### 장애가 났을 때 (실측 2026-09-22)

바깥을 하나씩 끊고 D-MAX 순위표가 그려지는지 봤습니다.

| 끊은 것 | 결과 |
| --- | --- |
| jsdelivr (글꼴) | ✅ 그대로 그려짐 · JS 오류 0 |
| Firebase | ✅ 그대로 · 오류 0 |
| GA | ✅ 그대로 · 오류 0 |
| 바깥 전부 | ✅ 그대로 · 오류 0 |
| **제 데이터(`data/*.json`)** | ❌ **본문이 영원히 빈 채로 남았다** |

마지막 하나가 진짜 구멍이었습니다. `useSuspenseQuery` 는 실패하면 던지는데 받는 경계가 없어,
본문이 비거나(안쪽) 셸까지 통째로 사라졌습니다(`#content` 소멸). v4.9.5 에서 경계를 **두 겹**으로
달았습니다 — `src/components/DataBoundary.tsx`, 검사는 `src/test/boundary.test.tsx`.
