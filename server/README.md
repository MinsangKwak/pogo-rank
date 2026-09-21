# moncamp 수집·집계 서버

**GA4 가 돌려주지 않는 원본 이벤트를 내 DB 에 남긴다.** 화면은 그대로 정적 사이트이고,
이 서버는 그 옆에서 기록만 맡는다.

[← 저장소 README](../README.md) · [개발 문서](../docs/DEVELOPMENT.md) · [인프라 문서](../docs/INFRA.md) · [운영 문서](../docs/OPERATIONS.md)

| 보려는 것 | 어디 |
| --- | --- |
| 표·칸·제약·인덱스와 **왜** | [`SCHEMA.md`](SCHEMA.md) |
| 표 관계 한 장 | [`docs/server-erd.png`](../docs/server-erd.png) |
| 주소마다의 요청·응답 | [`docs/server-api.html`](../docs/server-api.html) (열면 바로 보인다) · [`openapi.json`](openapi.json) · 서버가 뜨면 `/docs` |

---

## 왜 있나

GA4 Data API 는 **집계만** 돌려준다. 원본 이벤트를 못 꺼내고, 지역 측정기준이 섞이면 방문자
적은 행을 제 임계값으로 숨기고, 기본 보존은 14개월이다. v4.6.3 에서 검색순위를 내린 것도
이 셋 때문이었다 — 하루 3회짜리 검색어는 내 DB 에서는 정확히 3 이지만 GA4 에서는 영영 안 보인다.

| 맡는 것 | 안 맡는 것 |
| --- | --- |
| 이벤트 수집 · 일별 집계 · 순위 조회 | 로그인 · 권한 (Firebase Auth + `firestore.rules` 그대로) |
| Firestore 백업 미러 *(3판)* | 화면 렌더링 (GitHub Pages 정적 그대로) |

---

## 빠른 시작

```bash
docker compose up -d                       # 로컬 Postgres (:5433)
cp .env.example .env                       # DATABASE_URL 채우기
npm install
npm run db:migrate
npm run dev                                # http://localhost:8080
```

```bash
npm test                                   # 36건 (DB 없이)
DATABASE_URL=postgres://moncamp:moncamp@localhost:5433/moncamp npm test   # +9건 (진짜 Postgres)
npm run typecheck
```

---

## 주소 넷

| 메서드 | 주소 | 누가 부르나 | 열쇠 |
| --- | --- | --- | --- |
| `GET` | `/healthz` | Cloud Run | — |
| `POST` | `/v1/events` | 브라우저 (답을 안 기다린다) | — (CORS · 한도) |
| `GET` | `/v1/hot?days=7&limit=10&country=KR` | 배포 워크플로 | — (`raw=true` 는 필요) |
| `POST` | `/v1/admin/rollup` | 배포 워크플로 | `Authorization: Bearer $ADMIN_TOKEN` |

### `POST /v1/events`

```json
{
  "visitor": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "channel": "prod",
  "events": [{ "name": "search", "term": "뮤츠", "surface": "dex", "ts": "2026-09-21T12:00:00Z" }]
}
```

`204 No Content`. 몸통이 없다 — 프런트는 답을 안 기다린다.

---

## 순위가 오염되지 않게 하는 다섯 겹

수집 엔드포인트는 공개다. 누구나 `curl` 로 밀어 넣을 수 있으니, 한 겹이 뚫려도 다음이 잡게 둔다.

| 겹 | 무엇 | 막는 것 | 어디 |
| --- | --- | --- | --- |
| 출처 | `Origin` 헤더를 **서버가 직접 본다** | 남의 사이트에서 쏘는 beacon | `app.ts` `preHandler` |
| 스키마 | 모양이 틀리면 400. 모르는 칸도 400 | 아무 값이나 실려 오는 것 | `lib/contract.ts` |
| 한도 | 같은 앞단에서 분당 N 건 | 쏟아지는 요청 | `app.ts` · `RATE_LIMIT_PER_MINUTE` |
| 뜻 | 셀 것이 없는 줄은 버린다 (`term` 없는 `search`) | 표의 쓰레기 | `lib/normalize.ts` |
| **사람당 한도** | 한 사람이 하루에 한 말로 셀 수 있는 최대 5회 | **한 사람이 순위를 만드는 것** | `lib/hot.ts` `PERSON_CAP` |

**CORS 는 이 목록에 없다.** CORS 는 브라우저가 *응답을 읽는 것*을 막을 뿐이고,
`sendBeacon` 이 보내는 단순 요청(`text/plain`)은 프리플라이트 없이 그냥 도착한다 — 응답을 안 읽으니
막힐 이유가 없다. 그래서 출처 판정을 서버가 직접 한다.

**`curl` 은 어느 겹도 못 막는다.** `Origin` 은 지어낼 수 있다. 그쪽을 맡는 것이 마지막 겹이다 —
앞의 넷을 다 뚫어도 **한 사람은 순위를 만들 수 없다.**
반대쪽은 문턱이 막는다 — 3회를 못 넘긴 말은 안 세우고, 줄이 셋을 못 채우면 표를 통째로 비운다
(v4.6.0 의 `MIN_ROW_COUNT` · `MIN_ROWS` 와 같은 값).

---

## 개인정보

- **IP 를 저장하지 않는다.** 나라는 앞단이 판정해 둔 코드를 읽는다 (`lib/country.ts`).
  앞단이 없으면 `ZZ` 다 — 모른다고 적지, 지어내지 않는다.
  **다만 '아예 안 본다' 는 아니다** — 분당 한도가 `req.ip` 를 키로 쓴다. 보고 버릴 뿐 어디에도 안 남긴다.
- **원본은 12개월 뒤 지운다** (`lib/retention.ts`). 지우기 전에 `search_daily` 로 굳히므로 순위 역사는 남는다.
- 방문자는 브라우저가 만든 난수 ID(`pogo_visitor`)다. 사람과 이어지지 않는다.
- `pogo_consent=denied` 인 사람은 **한 건도 안 보낸다** — GA4 와 같은 게이트를 탄다.
- 수집 항목은 개인정보처리방침에 적혀 있어야 한다 (CLAUDE.md §3).

---

## 설계 메모

- **ORM 을 안 쓴다.** 표가 둘이고 집계는 SQL 로 쓴다. 마이그레이션은 `migrations/*.sql` 과 40줄짜리 러너뿐이다.
- **마이그레이션을 부팅에서 돌린다.** 배포에 단계를 하나 더 두면 그걸 빠뜨린 배포가 언젠가 난다.
- **`/v1/hot` 은 `events` 를 직접 센다.** `search_daily` 는 원본을 언젠가 잘라내도 역사가 남게 하는 보험이지 캐시가 아니다.
- **화면은 이 서버를 런타임에 안 부른다.** 배포 워크플로가 받아 정적 파일로 굽는다 —
  서버가 내려가도 어제 구운 순위가 그대로 보인다 ([개발 문서 §1](../docs/DEVELOPMENT.md#1-설계-원칙)).
