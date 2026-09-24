# v5 전환 절차 — 무엇을 어떤 차례로 누르나

[← README](../README.md) · [고도화 계획](ROADMAP.md) · [운영 문서](OPERATIONS.md) · [로그인 설계](../server/AUTH.md)

**이 문서는 손으로 하는 일만 적는다.** 코드로 끝난 것은 [`ROADMAP.md`](ROADMAP.md) 가 적는다.

전환은 되돌리기 어렵다. **차례를 지키면 각 단계마다 되돌아올 자리가 있다** — 마지막 단계
전까지는 지금 운영(GitHub Pages + Firebase)이 그대로 서 있는다.

---

## 0. 지금 어디까지 돼 있나 (2026-09-23)

| | 상태 |
| --- | --- |
| Neon (PostgreSQL, 싱가포르) | ✅ 스키마 · 사람 7 · ★ 10 이관 |
| 인증·권한 서버 | ✅ Cloud Run(서울) · `api.moncamp.kr` = Cloudflare Worker 중계 |
| dev | ✅ dev.moncamp.kr = Vercel `moncamp-dev` (Next.js) |
| 운영 화면 빌드 | ✅ Vercel `pogo-rank` (pogo-rank.vercel.app) — `deploy` 브랜치로만 올라간다 |
| 운영 주소 | moncamp.kr = GitHub Pages(v4) → **5장에서 넘긴다** |

**넘기기 전에 채운 빈자리 넷** (v5.0.0) — 이 문서의 옛 판에 없던 것이다. 넷 다 빠져도 화면은 멀쩡하다.
보안 헤더(`web/next.config.ts`) · GA 조각(`web/src/lib/gaSnippet.ts`) · 문의 이메일(배포 워크플로의 `CONTACT_EMAIL`) · 만료 세션 파기(`server/src/lib/retention.ts`).

---

## 1. 시크릿 넣기

`https://github.com/<소유자>/pogo-rank/settings/secrets/actions`

| 이름 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `JWT_SECRET` | `openssl rand -hex 32` 결과 | 서버 |
| `ROOT_EMAIL` | 루트 관리자 이메일 | 서버 |
| `GOOGLE_CLIENT_ID` | 구글 콘솔의 client_id | 서버 ✅ |
| `GOOGLE_CLIENT_SECRET` | 구글 콘솔의 client_secret | 서버 ✅ |
| `ADMIN_TOKEN` | `openssl rand -hex 32` 결과 | 서버 |
| `DATABASE_URL` | Neon 연결 문자열 — **풀링이든 직접이든 하나면 된다** | 서버 ✅ |
| `GCP_PROJECT_ID` · `GCP_SA_KEY` | Cloud Run 배포용 | 서버 |
| `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` | Vercel 배포용 | 화면 |

**`ADMIN_TOKEN` 이 없으면 서버가 부팅을 못 한다.** 운영에서 32자 미만이면 `env.ts` 가 세운다 —
롤업·관리 주소가 아무에게나 열린 채로 뜨는 것을 막는 자리다.

**DB 주소는 둘 중 아무거나 넣어도 된다.** 시크릿은 넣고 나면 아무도 못 읽어서 어느 쪽을
넣었는지 확인할 길이 없다. 그래서 서버가 맞춘다 — Neon 은 호스트에 `-pooler` 를 붙여
둘을 가르므로, 평소 요청은 풀링으로 마이그레이션은 직접으로 알아서 간다
(풀러 뒤에서는 세션에 거는 잠금이 안 살아 마이그레이션이 조용히 어긋난다).

**`JWT_SECRET` 이 이 중 제일 중요하다.** 이 값을 아는 사람은 아무 권한의 로그인 토큰이든
지어낼 수 있다 — 구글을 거치지 않고. 비밀번호 관리자에 같이 둔다.

넣은 뒤 `server/**` 에 아무거나 push 하면 CI 의 `secrets` 잡이 **값을 한 글자도 안 찍고**
모양만 확인해 준다 (길이 · 접두·접미 · 따옴표가 섞였는지).

---

## 2. 서버를 Cloud Run 에 올린다

1. GCP 예산 알림을 $1 로 걸어 둔다. **이 단계를 건너뛰고 배포하지 않는다.**
2. 서비스 계정에 `roles/run.admin` · `roles/iam.serviceAccountUser` · `roles/artifactregistry.writer`
3. `deploy` 브랜치에 push → `deploy-server.yml` 이 돈다
4. `https://api.moncamp.kr/health` 가 200 이면 선 것이다

구글 콘솔의 **승인된 리디렉션 URI** 에 `https://api.moncamp.kr/v1/auth/google/callback` 이
글자까지 같게 들어 있어야 한다.

**로그인 클라이언트는 옛 Firebase 프로젝트 `pogo-note`(번호 291922942424)에 있다** — 서버를 올린 `moncamp api` 가 아니다.
client_id 앞자리가 곧 프로젝트 번호라, 로그인 주소(`/v1/auth/google/start` 의 302)에서 확인할 수 있다 (2026-09-23 실측).

| 자리 | 값 (2026-09-23) |
| --- | --- |
| 클라이언트 | `moncamp server` · `291922942424-vhmu…` — 운영 · dev 로그인이 함께 쓴다 |
| 리디렉션 URI | `https://api.moncamp.kr/v1/auth/google/callback` · `http://localhost:8080/…`(로컬 시험) |
| 게시 상태 · 사용자 유형 | 프로덕션 단계 · 외부 — **'테스트로 돌아가기' 를 누르면 테스트 사용자 말고는 로그인이 막힌다** |
| 브랜딩 | 앱 이름 moncamp · 홈 · 방침 · 약관 = moncamp.kr · 브랜딩 인증 · 게시 완료 (로고 없음 — 넣으면 다시 심사) |
| 옆의 `Web client (auto created by Google Service)` | 옛 Firebase 로그인용 — 6장에서 지운다 |

콘솔: [대상](https://console.cloud.google.com/auth/audience?project=pogo-note) ·
[브랜딩](https://console.cloud.google.com/auth/branding?project=pogo-note) ·
[클라이언트](https://console.cloud.google.com/auth/clients?project=pogo-note)

---

## 3. 데이터를 옮긴다

**이 걸음은 되돌릴 수 없다.** 먼저 되돌리는 판으로 돌려 본다.

```bash
# ① 지금 Firestore 를 통째로 받는다 (이미 있는 스크립트)
FIREBASE_SA_JSON="$(cat sa.json)" python3 scripts/firestore_backup.py firestore-backup.json

# ② 되돌리는 판 — 진짜로 넣어 보고 통째로 되돌린다. 몇 명이 오고 무엇이 버려지는지 본다
cd server && DRY_RUN=1 npm run db:import -- ../firestore-backup.json

# ③ 눈으로 확인한 뒤 진짜로
npm run db:import -- ../firestore-backup.json
```

**버림 줄을 반드시 읽는다.** 승인 목록에도 가입 요청에도 없는 uid 의 ★ 는 옮길 자리가
없어 버려진다 — 조용히 넘어가면 "왜 한 명이 없지" 를 영영 못 찾는다.

### 옮겨 온 사람은 처음 로그인할 때 이어받는다

Firebase uid 는 구글이 준 값이 아니다. 이관은 `google_sub` 자리에 `firebase:<uid>` 라는
**자리표시자**를 넣어 두고, 그 사람이 처음 구글로 로그인하는 순간 서버가 진짜 값으로
갈아 끼운다. 승인도 ★ 도 그대로 이어진다.

진짜 `sub` 이 이미 붙은 줄은 안 이어받는다 — 열어 두면 이메일만 알면 남의 계정을 가져갈 수 있다.

---

## 4. 화면을 Vercel 에 올린다

1. vercel.com 에서 프로젝트를 만든다.

   **`web` 이 목록에 없을 수 있다.** Vercel 은 **기본 브랜치**를 읽는데, `web/` 은 아직
   `next` 에만 있다. 그때는 뿌리를 고르고 만든 뒤 `Settings` 에서 고친다 —
   `Git` → Production Branch 를 `next` 로 바꾸면 `General` → Root Directory 에 `web` 이 뜬다.

2. **`Settings` → `Git` → `Ignored Build Step` 에 `exit 0` 을 넣는다.**

   안 하면 Vercel 이 push 마다 스스로 빌드를 돌리는데, 화면 데이터(`public/data`)가
   저장소에 없어 **매번 실패한다.** 빨간 배포가 쌓이면 진짜 고장과 구별이 안 된다.
   빌드는 GitHub Actions 가 하고 여기는 다 구운 것만 받는다.

3. 프로젝트 환경변수에 `NEXT_PUBLIC_API_URL` = `https://api.moncamp.kr`

   **서버가 아직 없어도 지금 넣는다.** 비우면 화면이 로그인을 통째로 끄고 뜬다.

4. 저장소 시크릿 셋을 넣는다 (1번 표)
5. `deploy` 브랜치에 push → `deploy-web.yml` 이 돈다

배포 뒤 워크플로가 **내용이 든 HTML 인지** 직접 확인한다 — `/mon/25` 를 받아 제목 ·
'피카츄' · JSON-LD 가 다 있는지 본다. 200 만 보면 빈 껍데기가 올라가도 초록이다.

---

## 5. 주소를 넘긴다

여기서부터 되돌리기가 어려워진다. **앞의 넷이 다 초록인 뒤에 한다.** 누를 것은 워크플로 하나다 —
`운영 주소 전환` (`.github/workflows/cutover-prod.yml`, 손으로만 돈다).

1. **`status`** — 지금 DNS 를 찍는다. 되돌릴 자리(GitHub Pages)가 `scripts/vercel_prod.py` 의 `PAGES_*` 와 같은지 본다
2. **이관을 한 번 더** — `ops/migrate-firestore.request` 를 `mode = apply` 로. 이때부터 넘기기 전까지 v4 에서 누른 ★ 는 안 옮겨진다
3. **`attach`** — moncamp.kr · www 를 `pogo-rank` 프로젝트에 붙이고 Cloudflare 레코드를 Vercel 로 돌린다(**프록시 끔**).
   새 화면(`__next_f`) · 보안 헤더가 뜰 때까지 13분 기다린다. 넘기는 몇 분 동안 인증서 경고가 날 수 있다
4. `bash scripts/verify_deploy.sh https://moncamp.kr/ prod` · 로그인 · ★ 를 손으로

**되돌리기** — 같은 워크플로의 **`rollback`**. DNS 를 GitHub Pages 로 돌리고(프록시 켬) 옛 v4 가 뜰 때까지 잰다.
옛 Pages 배포(`deploy.yml`)는 그대로 둔다 — 그것이 되돌릴 곳이다. 저장소 Settings → Pages 의 Custom domain 도 건드리지 않는다.

**운영 배포의 입구는 `deploy` 하나다** — `deploy-web.yml` 의 `branches` 에서 전환 기간에 열어 둔 `next` 를 뺐다.

### 옛 주소는 두 겹으로 이어진다

| 옛 주소 | 어떻게 |
| --- | --- |
| `/rank/max` · `/favs` 같은 옛 경로 | `next.config.ts` 가 **308** 로 옮긴다 (검색엔진이 알아듣는다) |
| `#/mon/25` 같은 해시 주소 | 문서 머리의 작은 스크립트가 한 번 본다 — `#` 뒤는 서버로 안 가서 리다이렉트로는 못 잡는다 |

경로 문자열 자체는 안 바뀌므로 1:1 이다 (CLAUDE.md §2).

---

## 6. Firebase 를 내린다

**주소를 넘기고 최소 2주 뒤에 한다.** 되돌릴 곳을 그만큼 남겨 둔다.

1. Firestore 백업을 한 번 더 받아 보관한다
2. Firebase 콘솔에서 Firestore 규칙을 전부 거부로 바꾼다 (지우지 말고 **막는다**)
3. 한 주 더 두고 아무 일도 없으면 **Firestore 데이터와 Firebase 앱만 지운다 — 프로젝트(`pogo-note`)는 지우지 않는다.**
   운영 로그인 클라이언트가 이 프로젝트에 있어서, 프로젝트를 지우면 moncamp.kr 로그인이 그 자리에서 멈춘다 (2장).
   옛 `Web client (auto created by Google Service)` 와 승인된 도메인 `pogo-note.firebaseapp.com` 은 이때 지운다
4. 저장소에서 `firestore.rules` · `frontend-v4/` · `FIREBASE_SA_JSON` 을 지운다

프로젝트까지 비우고 싶으면 **로그인 클라이언트를 먼저 옮긴다** — `moncamp api` 에 새 클라이언트를 만들고
(같은 리디렉션 URI · 브랜딩 다시 인증) `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` 을 바꿔 서버를 다시 올린 뒤,
로그인이 되는 것을 보고 나서야 `pogo-note` 를 지운다.

---

## 7. 수집 (Phase 8) — **누를 것이 없다**

배포 워크플로가 **켠 채로 굽는다** (`deploy-web.yml`). 안 들어갔으면 빌드를 세운다 —
비면 화면이 수집을 통째로 끄는데, 그건 조용해서 몇 달을 모를 수 있다.

다른 주소로 보내고 싶을 때만 저장소 **변수**(시크릿이 아니다) `COLLECT_URL` 을 넣는다.
그쪽이 이긴다.

**시행일은 2026-09-23 으로 고쳤다** (v4.9.9) — 적어 둔 9/28 보다 새 화면이 먼저 떠서다.
고지와 실제가 어긋난 채로 두는 것이 제일 나쁘다.
