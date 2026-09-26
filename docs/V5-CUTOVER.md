# v5 전환·복구 기록

[프로젝트 소개](../README.md) · [로드맵](ROADMAP.md) · [운영 가이드](OPERATIONS.md) · [인증 설계](../server/AUTH.md)

**GitHub Pages·Firebase에서 Vercel·Fastify·Neon으로 전환한 절차와 복구 시 주의점을 정리합니다.** v5.0.0 전환은 2026-09-23 릴리스에 기록되어 있습니다. 이 문서는 초기 상태로 다시 설치하라는 실행 지시가 아닙니다.

## 구성과 확인 범위

| 구성 | 전환 결과·용도 |
| --- | --- |
| `web/` | Next.js 앱, dev·운영 Vercel 프로젝트로 배포 |
| `server/` | Cloud Run API, Google OAuth와 개인 데이터 처리 |
| Neon | 사용자·세션·즐겨찾기·트레이너 데이터 |
| 기존 Pages·Firebase | 전환 시 되돌리기 위한 자원. 정리 여부는 콘솔에서 별도 확인 |

콘솔의 현재 DNS·프로젝트·백업 상태는 저장소만으로 확정하지 않습니다. 동작 확인과 변경 시각을 운영 기록에 남깁니다.

## 전환 순서와 완료 기준

| 단계 | 작업 | 확인 |
| --- | --- | --- |
| 1 | 필수 시크릿과 허용 Origin 준비 | 서버 환경 검증 통과, 값은 로그에 남기지 않음 |
| 2 | API 배포 | `/health`, Google 콜백, DB 연결 |
| 3 | Firestore 백업과 이관 미리보기 | 이관·제외 건수와 제외 사유 검토 |
| 4 | 실제 데이터 이관·웹 빌드 | 로그인·권한·즐겨찾기 확인 |
| 5 | 도메인 전환 | 실제 HTML, 보안 헤더, 주요 기능 |
| 6 | 복구 기간 유지 후 자원 정리 | OAuth·도구 의존성 및 백업 확인 |

### 필요한 설정

`DATABASE_URL`, `JWT_SECRET`, `ROOT_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`, `APP_ORIGIN`, `ALLOWED_ORIGINS`, `ADMIN_TOKEN`은 [서버 설정](../server/.env.example)을 기준으로 합니다. 배포 자격 증명은 해당 GitHub Actions 시크릿으로 관리합니다.

Neon의 평상시 연결과 마이그레이션 직접 연결을 구분합니다. 서버 부팅은 `MIGRATION_DATABASE_URL` 또는 직접 주소를 사용하지만 수동 `db:migrate`는 `DATABASE_URL`을 읽습니다.

GCP 예산 알림은 배포 전에 설정합니다. 운영 JWT 키·관리 토큰의 길이 검증을 우회하지 않습니다.

## 데이터 이관

이관 도구는 `server/scripts/import-firestore.ts`입니다. 먼저 백업을 준비하고 미리보기 결과를 확인합니다.

```bash
# server/에서, 검토한 백업 파일과 대상 DB 설정을 사용
DRY_RUN=1 npm run db:import -- ../firestore-backup.json
```

실제 적용은 `DRY_RUN=1` 없이 실행합니다. 대상 DB와 백업을 검토한 뒤에만 진행합니다. 승인·가입 기록이 없는 사용자 데이터 등 제외 항목의 사유를 확인합니다.

이관 계정은 임시 `firebase:<uid>` 신원값을 사용하고 첫 Google 로그인에서 연결합니다. 이미 실제 Google 신원이 연결된 계정에 같은 이메일 연결을 다시 적용하지 않습니다.

전환 직전까지 이전 앱에서 쓰기가 가능하면 마지막 이관 이후 변경이 누락될 수 있습니다. 이관 시점과 쓰기 중지·전환 시점을 함께 관리합니다. 백업 평문은 저장소에 넣지 않고 사용 후 정리합니다.

## 웹 배포와 주소 전환

GitHub Actions가 데이터와 앱을 빌드하여 Vercel에 prebuilt 결과를 전달합니다. Vercel 자체 자동 빌드와 중복되지 않도록 프로젝트 설정을 확인합니다. Root Directory는 `web`입니다.

도메인 작업은 `.github/workflows/cutover-prod.yml`의 수동 동작을 사용합니다.

| 동작 | 목적 |
| --- | --- |
| `status` | 현재 DNS와 전환 대상 확인 |
| `attach` | Vercel 프로젝트 연결과 DNS 전환 |
| `rollback` | 이전 Pages 대상으로 DNS 복귀 |

전환 후 `scripts/verify_deploy.sh`와 실제 로그인·즐겨찾기를 확인합니다. `/mon/25`가 이름·canonical·JSON-LD를 포함하는지 확인합니다.

**DNS rollback은 데이터 rollback이 아닙니다.** 새 서비스에서 추가한 사용자 데이터가 이전 Firebase에 자동 복사되지 않습니다. 화면을 되돌릴 수 있다는 이유만으로 데이터 손실 없는 복구가 보장되지는 않습니다.

## 이전 주소 호환

기존 경로는 `next.config.ts`의 리디렉션과 라우트 매핑으로 연결합니다. `#/mon/25`처럼 해시가 있는 주소는 서버에 전달되지 않으므로 브라우저에서 현재 경로로 변환합니다. 공유 링크와 북마크 검증을 포함합니다.

## 이전 자원 정리 전 확인

- 전환 후 최소 2주 복구 기간을 유지한다는 기존 운영 방침을 확인합니다.
- 마지막 Firestore 백업과 필요한 보관 기간을 확인합니다.
- Firebase 프로젝트를 삭제하기 전에 **현행 Google OAuth 클라이언트가 그 프로젝트에 남아 있는지** 확인합니다. 전환 당시 로그인 클라이언트는 `pogo-note` 프로젝트에 있었습니다.
- OAuth 클라이언트를 옮겨야 한다면 새 리디렉션·브랜딩·로그인을 검증한 뒤 이전 프로젝트를 정리합니다.
- `frontend-v4/`는 현재 데이터 추출·Storybook에도 사용하므로 디렉터리를 먼저 삭제하지 않습니다.
- 현재 Neon 데이터의 복원 가능 여부는 Firestore 백업과 별도로 확인합니다.

## 수집·고지

웹 배포는 `COLLECT_URL`을 반영합니다. 수집 주소 설정, 동의 상태, 방침 시행일과 실제 이벤트를 함께 확인합니다. 검색 수집의 2026-09-23 정정과 페이지뷰의 2026-09-24 정정은 [CHANGELOG](../CHANGELOG.md)에 보존합니다. 초기 전환 계획의 9/28 예정일을 현재 시행일로 사용하지 않습니다.
