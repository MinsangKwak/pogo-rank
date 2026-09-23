# moncamp 수집·집계 서버

**GA4에서 조회할 수 없는 개별 이벤트를 별도 데이터베이스에 저장합니다.** 화면은 기존의 정적 사이트로 제공하며,
이 서버는 이벤트 수집과 집계를 담당합니다.

[← 저장소 README](../README.md) · [개발 문서](../docs/DEVELOPMENT.md) · [인프라 문서](../docs/INFRA.md) · [운영 문서](../docs/OPERATIONS.md)

| 확인할 내용 | 문서 |
| --- | --- |
| 테이블·컬럼·제약 조건·인덱스와 설계 배경 | [`SCHEMA.md`](SCHEMA.md) |
| 테이블 관계도 | [`docs/server-erd.png`](../docs/server-erd.png) |
| API별 요청·응답 | [`docs/server-api.html`](../docs/server-api.html) (브라우저에서 열람) · [`openapi.json`](openapi.json) · 서버 실행 후 `/docs` |

---

## 왜 있나

GA4 Data API는 **집계 결과**를 제공합니다. 개별 이벤트를 직접 조회할 수 없으며, 지역별 조회에는 개인정보 보호 임계값이 적용되어 일부 항목이 표시되지 않을 수 있습니다. 프로젝트의 보관 설정은 14개월입니다. 이러한 제약으로 v4.6.3에서 검색순위 제공을 중단했고, 정확한 검색 횟수를 별도로 집계하기 위해 수집 서버를 도입했습니다.

| 맡는 것 | 안 맡는 것 |
| --- | --- |
| 이벤트 수집 · 일별 집계 · 순위 조회 | 로그인 · 권한 (Firebase Auth + `firestore.rules` 그대로) |
| **백업 실행 결과와 데이터 누락 여부 점검** | **백업 자체** — 기존 주간 워크플로가 수행하며, 서버는 결과만 확인합니다 |
| | 화면 렌더링 (GitHub Pages 정적 그대로) |

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
| `GET` | `/health` | Cloud Run | — |
| `POST` | `/v1/events` | 브라우저 (비동기 전송) | — (CORS · 한도) |
| `GET` | `/v1/hot?days=7&limit=10&country=KR` | 배포 워크플로 | — (`raw=true` 는 필요) |
| `POST` | `/v1/admin/rollup` | 집계 워크플로 | `Authorization: Bearer $ADMIN_TOKEN` |
| `POST` | `/v1/admin/backups` | 주간 백업 워크플로 (올린 **뒤에**) | 〃 |
| `GET` | `/v1/admin/backups` | 운영자 — 백업 상태 조회 | 〃 |

### `POST /v1/events`

```json
{
  "visitor": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "channel": "prod",
  "events": [{ "name": "search", "term": "뮤츠", "surface": "dex", "ts": "2026-09-21T12:00:00Z" }]
}
```

`204 No Content`. 응답 본문은 없으며, 화면은 응답을 기다리지 않습니다.

---

## 순위가 오염되지 않게 하는 다섯 겹

수집 엔드포인트는 공개되어 있습니다. 외부에서도 `curl` 로 요청할 수 있으므로 여러 단계에서 검증합니다.

| 겹 | 무엇 | 막는 것 | 어디 |
| --- | --- | --- | --- |
| 출처 | `Origin` 헤더를 **서버가 직접 본다** | 다른 사이트에서 전송한 beacon 요청 | `app.ts` `preHandler` |
| 스키마 | 형식이 잘못되거나 정의되지 않은 필드가 있으면 400 반환 | 정의되지 않은 데이터 입력 | `lib/contract.ts` |
| 한도 | 같은 앞단에서 분당 N 건 | 과도한 요청 | `app.ts` · `RATE_LIMIT_PER_MINUTE` |
| 뜻 | 집계에 필요한 값이 없는 이벤트는 제외합니다 (`term` 없는 `search`) | 집계에 사용할 수 없는 데이터 | `lib/normalize.ts` |
| **사람당 한도** | 방문자 ID별 동일 검색어를 하루 최대 5회 집계 | **동일 방문자의 반복 검색에 따른 순위 왜곡** | `lib/hot.ts` `PERSON_CAP` |

**CORS만으로는 이벤트 전송을 막을 수 없습니다.** CORS는 브라우저의 응답 읽기를 제한합니다. `sendBeacon`의 단순 요청(`text/plain`)은 프리플라이트 없이 전송될 수 있으므로, 서버에서도 요청 출처를 직접 검사합니다.

**요청 출처 검사만으로 외부 입력을 완전히 차단할 수는 없습니다.** `Origin` 헤더와 방문자 ID는 외부에서 임의로 지정할 수 있습니다. 방문자별 집계 한도는 동일 ID의 반복 검색 영향을 줄이는 보완 장치입니다. 표본이 적은 항목은 최소 검색 횟수와 최소 행 수 기준으로 제외합니다 (v4.6.0 의 `MIN_ROW_COUNT` · `MIN_ROWS` 와 같은 값).

---

## 개인정보

- **IP는 저장하지 않습니다.** 국가 정보는 요청에 전달된 국가 코드를 사용합니다 (`lib/country.ts`). 확인할 수 없으면 `ZZ`로 기록합니다. 분당 요청 제한에는 `req.ip`를 일시적으로 사용하지만 데이터베이스나 로그에는 남기지 않습니다.
- **원본 이벤트는 12개월 후 삭제합니다** (`lib/retention.ts`). 삭제 전에 `search_daily`에 집계값을 저장하여 과거 통계를 보관합니다.
- 방문자는 브라우저에서 생성한 난수 ID(`pogo_visitor`)로 구분하며 로그인 계정과 연결하지 않습니다.
- `pogo_consent=denied`이면 **이벤트를 전송하지 않습니다**. GA4와 동일한 통계 설정을 적용합니다.
- 수집 항목은 개인정보처리방침에 명시해야 합니다 (CLAUDE.md §3).

---

## 설계 메모

- **ORM 없이 SQL로 집계합니다.** 마이그레이션은 `migrations/*.sql`과 실행 스크립트로 관리합니다.
- **서버 시작 시 마이그레이션을 실행합니다.** 별도 배포 단계를 누락해 테이블 없이 실행되는 상황을 방지합니다.
- **`/v1/hot`은 `events`를 직접 집계합니다.** `search_daily` 는 원본 삭제 후에도 과거 집계값을 보관하기 위한 테이블이며 캐시가 아닙니다.
- **화면 표시용 데이터는 수집 서버에서 실시간으로 조회하지 않습니다.** 배포 워크플로가 조회 결과를 정적 파일로 생성합니다.
  서버가 중단되어도 마지막으로 빌드한 순위를 표시합니다 ([개발 문서 §1](../docs/DEVELOPMENT.md#1-설계-원칙)).
