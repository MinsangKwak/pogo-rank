# moncamp API 서버

[프로젝트 소개](../README.md) · [인증 설계](AUTH.md) · [DB 스키마](SCHEMA.md) · [OpenAPI](openapi.json) · [운영 가이드](../docs/OPERATIONS.md)

**Google 로그인, 권한, 즐겨찾기, 트레이너 코드와 통계를 처리하는 Fastify API입니다.** v4에서는 수집 서버로 시작했고, v5부터 계정 기능도 담당합니다.

| 항목 | 구성 |
| --- | --- |
| 런타임 | Node.js 22 이상 · TypeScript · Fastify |
| 저장소 | PostgreSQL, `postgres` 드라이버로 SQL 직접 실행 |
| 운영 | Cloud Run, Neon PostgreSQL |
| 인증 | Google OAuth 인가 코드·PKCE, 액세스 JWT, 리프레시 토큰 회전 |
| 검증 | Vitest 단위·통합 테스트, OpenAPI 응답 스키마 검사 |

## 로컬 실행

Node.js 22와 Docker Compose가 필요합니다. 명령은 이 디렉터리에서 실행합니다.

```bash
npm ci
npm run db:up
cp .env.example .env
```

`.env`의 필수 값을 채웁니다. [예시 파일](.env.example)과 [환경변수 검증](src/env.ts)이 기준입니다.

| 변수 | 로컬 설정 |
| --- | --- |
| `DATABASE_URL` | `postgres://moncamp:moncamp@localhost:5433/moncamp` |
| `ALLOWED_ORIGINS` | 로컬 웹 Origin. 예: `http://localhost:5503` |
| `APP_ORIGIN` | 로그인 후 돌아갈 웹 Origin. 허용 목록과 일치해야 함 |
| `OAUTH_REDIRECT_URI` | `http://localhost:8080/v1/auth/google/callback` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 개발용 Google OAuth 클라이언트 값 |
| `ROOT_EMAIL` | 개발용 루트 계정 이메일 |
| `JWT_SECRET` | 32바이트 이상. `openssl rand -hex 32`로 생성 가능 |
| `ADMIN_TOKEN` | 운영에서는 32자 이상 필수. 로컬 관리 API 확인 시에도 설정 권장 |

현재 개발 명령은 `.env`를 자동으로 읽지 않습니다. 셸에 값을 로드한 뒤 실행합니다. 아래 방식은 직접 작성한 로컬 설정 파일에만 사용하세요.

```bash
set -a
. ./.env
set +a
npm run db:migrate
npm run dev
```

기본 주소는 `http://localhost:8080`이며 `/health`로 상태를 확인합니다. OAuth 리디렉션 URI를 Google 콘솔에도 정확히 등록해야 합니다. 웹의 `NEXT_PUBLIC_API_URL`은 이 로컬 API 주소로 설정합니다.

## API 구성

| 경로 | 역할 | 접근 |
| --- | --- | --- |
| `/health` | 서버·DB 상태 | 공개 |
| `/v1/auth/*` | Google 로그인, 토큰 갱신, 로그아웃, 세션 | 기능별 인증 조건 적용 |
| `/v1/me` | 본인 정보·계정 삭제 | 로그인 |
| `/v1/favorites` | 본인 즐겨찾기 | 로그인, 역할별 수량 제한 |
| `/v1/trainers` | 트레이너 코드 조회·관리 | 조회는 승인 이상, 수정은 관리자 이상 |
| `/v1/events` | 검색·페이지뷰 수집 | 허용 Origin, 요청 검증·빈도 제한 |
| `/v1/hot` | 검색 집계 | 공개 결과에는 최소 집계 기준 적용 |
| `/v1/admin/*` | 계정 관리·통계·백업 점검 | API별 루트 JWT 또는 관리 토큰 필요 |

정확한 HTTP 메서드와 요청·응답은 [OpenAPI](openapi.json), 계정별 인가는 [AUTH.md](AUTH.md)를 확인합니다. `ADMIN_TOKEN`과 로그인용 JWT는 서로 다른 용도입니다.

## 검증과 빌드

```bash
npm test
npm run build
npm run openapi
```

`npm test`는 타입 검사와 Vitest를 실행합니다. DB를 사용하는 검증은 별도 `TEST_DATABASE_URL`이 필요합니다. 값이 없으면 해당 검증을 건너뛸 수 있습니다. CI는 `REQUIRE_TEST_DB=1`로 누락을 실패 처리합니다. 테스트는 스키마를 초기화하므로 폐기 가능한 DB만 연결합니다. 운영 DB를 연결하지 말고, [테스트 DB 설정](src/test/dbUrl.ts)을 확인하세요. `npm run openapi`는 `openapi.json`을 갱신하므로 API 변경 때 실행하고 diff를 검토합니다.

## 데이터 처리 원칙

- 게임 순위 데이터는 Python 빌드에서 생성합니다. API는 사용자 데이터와 수집·집계를 담당합니다.
- 요청 스키마의 허용되지 않은 필드를 거부하고, Origin 확인과 빈도 제한을 적용합니다. 이는 모든 자동화 요청을 차단한다는 보장은 아닙니다.
- 수집·세션 테이블에 IP를 저장하지 않습니다. 빈도 제한에서는 요청 IP를 일시적으로 사용합니다.
- 수집 원본은 12개월 보존 경계에 따라 삭제합니다. 날짜별 검색 집계는 별도로 남깁니다.
- 통계를 거부한 브라우저에서는 수집 요청을 보내지 않습니다. 방문자 난수 ID를 계정 ID와 연결하지 않습니다.
- API 장애 시 로그인·저장 기능은 영향을 받습니다. 정적 게임 콘텐츠는 별도로 제공됩니다.

마이그레이션·보존 경계·백업 진단은 [스키마 문서](SCHEMA.md), 배포와 장애 대응은 [운영 가이드](../docs/OPERATIONS.md)에 정리합니다.
