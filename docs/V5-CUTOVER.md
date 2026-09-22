# v5 전환 절차 — 무엇을 어떤 차례로 누르나

[← README](../README.md) · [고도화 계획](ROADMAP.md) · [운영 문서](OPERATIONS.md) · [로그인 설계](../server/AUTH.md)

**이 문서는 손으로 하는 일만 적는다.** 코드로 끝난 것은 [`ROADMAP.md`](ROADMAP.md) 가 적는다.

전환은 되돌리기 어렵다. **차례를 지키면 각 단계마다 되돌아올 자리가 있다** — 마지막 단계
전까지는 지금 운영(GitHub Pages + Firebase)이 그대로 서 있는다.

---

## 0. 지금 어디까지 돼 있나

| | 상태 |
| --- | --- |
| Neon (PostgreSQL) | 프로젝트 있음 · 스키마 코드로 끝남 |
| 구글 OAuth 클라이언트 | 만들어짐 (`pogo-note` 프로젝트) |
| 인증·권한 서버 | 코드로 끝남 · 아직 **배포 안 됨** |
| Next.js 앱 | 코드로 끝남 · 아직 **배포 안 됨** |
| 운영 | v4.9.8 (GitHub Pages + Firebase) 그대로 |

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
4. `https://api.moncamp.kr/healthz` 가 200 이면 선 것이다

구글 콘솔의 **승인된 리디렉션 URI** 에 `https://api.moncamp.kr/v1/auth/google/callback` 이
글자까지 같게 들어 있어야 한다.

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

1. vercel.com 에서 프로젝트를 만든다 — **Root Directory 를 `web` 으로** 지정한다
2. 프로젝트 환경변수에 `NEXT_PUBLIC_API_URL` = `https://api.moncamp.kr`
3. 저장소 시크릿 셋을 넣는다 (1번 표)
4. `deploy` 브랜치에 push → `deploy-web.yml` 이 돈다

배포 뒤 워크플로가 **내용이 든 HTML 인지** 직접 확인한다 — `/mon/25` 를 받아 제목 ·
'피카츄' · JSON-LD 가 다 있는지 본다. 200 만 보면 빈 껍데기가 올라가도 초록이다.

---

## 5. 주소를 넘긴다

여기서부터 되돌리기가 어려워진다. **앞의 넷이 다 초록인 뒤에 한다.**

1. Vercel 프로젝트에 `moncamp.kr` 을 붙인다
2. Cloudflare 에서 DNS 를 Vercel 로 돌린다
3. 옛 GitHub Pages 배포는 그대로 둔다 — 되돌릴 곳이다
4. 하루 지켜본 뒤 `scripts/verify_deploy.sh https://moncamp.kr/ prod`

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
3. 한 주 더 두고 아무 일도 없으면 프로젝트를 지운다
4. 저장소에서 `firestore.rules` · `frontend-v4/` · `FIREBASE_SA_JSON` 을 지운다

---

## 7. 수집을 켠다 (Phase 8)

**2026-09-28 전에는 켜지 않는다.** 개인정보처리방침 10번이 "수집 항목이 늘면 시행 7일 전에
패치노트로 알린다" 고 약속했고, 그 고지가 2026-09-21 에 나갔다 ([운영 §16](OPERATIONS.md)).

그날 이후 저장소 **변수**(시크릿이 아니다) `COLLECT_URL` 에 `https://api.moncamp.kr` 을
넣고 다음 배포를 돌린다. 비어 있으면 화면이 수집을 통째로 끈다 — 서버가 있어도 한 건도 안 나간다.
