# moncamp 작업 지침

[개발 가이드](../docs/DEVELOPMENT.md) · [운영 가이드](../docs/OPERATIONS.md) · [디자인 가이드](../docs/design/README.md)

**코드·데이터·문서를 수정할 때 지켜야 하는 공통 규칙입니다.** 현재 앱은 `web/`, 이전 앱과 Storybook은 `frontend-v4/`, API는 `server/`입니다. 아래의 규칙은 현재 구조 기준이며 과거 장애 사례는 변경 이력에서 확인합니다.

## 1. 비정상 값을 화면에 표시하지 않는다

어떤 로그인·권한·데이터 상태에서도 사용자에게 `NaN`, `undefined`, `null`, `Infinity`, `[object Object]`가 노출되면 안 됩니다.

1. 숫자·문자 표시에는 공통 `lib/cell.ts` 함수를 사용합니다. JSX에서 원시 값의 직접 문자열 보간이나 `.toFixed()`를 사용하지 않습니다.
2. 데이터 형식이 다르면 표시 필드 선택을 한 함수로 모읍니다. `dmaxCells`, `pveCells`, `pvpCells`처럼 화면별 분기를 중복하지 않습니다.
3. 값이 없으면 `—`를 표시하되, 빌드가 완전한 값을 보장하는 순위표에서 대시가 나오면 결함으로 처리합니다.

| D-MAX 데이터 | 필드 예시 |
| --- | --- |
| 티어 | `pct`, `atk`, `power`, `stab`, `bulk` |
| 딜러 | `dmg`, `bulk`, `fast`, `charged` |
| 탱커 | `ehp`, `hp`, `def`, `mult`. 기술 필드 없음 |

표시 함수, 행별 매핑, 실제 데이터 전체, 그려진 화면을 각각 검증합니다. 새 표·화면에는 관련 데이터 검사와 `scripts/check_screens.mjs`의 경로를 추가합니다. 이전 앱의 `cellgate`, `rankcells`, `datasweep` 검사도 해당 코드를 수정하면 유지합니다.

## 2. 색상과 스타일은 공통 규칙을 따른다

- 채움 위 글자와 배경의 대비를 함께 확인합니다. 테마에 따라 달라지는 `--bg`, `--fg`를 용도에 맞게 사용합니다.
- 항상 어두운 콘솔·히어로·이미지 배너에는 `--plate` 팔레트를 사용합니다. 이미지 위에 일반 `--fg`를 적용해 밝은 모드에서 글자가 사라지게 하지 않습니다.
- 하드코딩 색상 대신 토큰을 사용합니다. 배경 이미지가 없어도 읽을 수 있는 바탕색을 둡니다.
- 공통 모양은 `web/src/styles/cinema/parts.css`에 모으고 화면별 파일에는 배치를 둡니다.
- 반경은 `--r-panel`, `--r-box`, `--r-ctl`, `--r-tag`를 사용합니다. `!important`로 이전 스타일을 덮지 말고 관련 토큰 값을 조정합니다.
- 테마를 선택한 적이 없는 경우 기본은 다크입니다. 밝은·어두운 모드를 함께 검증합니다.
- 게임 타입색 `--t-*`는 임의로 바꾸지 않습니다. 대비가 부족하면 윤곽·배경 처리로 보완합니다.

`designgrid.test.ts`의 토큰·격자 검사를 유지합니다. `scripts/check_contrast.mjs`의 3.0 기준은 보이지 않는 글자를 찾는 회귀 검사이며, WCAG 접근성 준수 전체를 보장하는 검사가 아닙니다.

## 3. UI 구성요소와 Storybook

공통 구성요소는 `src/ds/`를 재사용합니다. 같은 버튼·칩·배지를 새 클래스 체계로 중복 구현하지 않습니다. 기존 클래스명·태그·중첩 계약을 유지하고, 없는 구성만 추가합니다.

| 항목 | 허용 값 |
| --- | --- |
| `Stack`, `Inline` 간격 | `none`, `xs`, `sm`, `md`, `lg`, `xl` |
| `Text` 크기 | `sub`, `body`, `lead` |
| `Label` 크기 | `body`, `sec`, `title`, `hero` |

토큰 목록에 없는 이름은 사용하지 않습니다. 새 구성요소에는 스토리를 추가하고 두 테마를 확인합니다.

```bash
cd frontend-v4
npm run storybook
STORYBOOK_BASE=/storybook/ npm run build-storybook
```

Storybook 배포 경로는 `/storybook/`입니다. 앱 서비스워커가 이 경로를 캐시하지 않도록 제외 목록과 `swscope` 검사를 유지합니다. Storybook 검증 서버는 쿼리스트링을 보존해야 하고, 스토리 ID·테마 URL 값은 ASCII를 사용합니다. 표시 이름은 한국어를 사용할 수 있습니다.

Storybook 검증은 공통 명암비 검사기를 사용합니다. 배포에서 Storybook만 실패한 경우의 비차단 정책은 워크플로 설정을 유지합니다.

## 4. 기존 계약을 임의로 바꾸지 않는다

다음 값은 기존 데이터·링크·통계와 연결됩니다.

- 전역 이름, `state` 키, DOM ID
- localStorage 키와 값, 특히 `pogo_*`
- GA 이벤트명
- 이전 Firestore 필드명
- 저장소명 `pogo-rank`, `pogo-rank-dev`, 서비스워커 캐시 이름

새 이름에는 용도에 맞는 접두사를 사용합니다. 호환성을 바꿔야 한다면 이관과 기존 값 처리까지 포함합니다. v5의 Firestore→SQL 이관은 명시적인 예외이며 일반 이름 변경을 허용하는 규칙이 아닙니다.

## 5. 실제 데이터와 개인정보

- 한국어 이름은 실제 데이터만 사용합니다. 미공개·미확인 정보를 만들어 채우지 않습니다.
- 트레이너 코드·친구 이름은 DB에만 두고 소스·placeholder·문서 예시에 넣지 않습니다. 현재 저장소는 Neon이며 이전 앱은 Firestore입니다.
- 수집·세션 테이블에 IP를 저장하지 않습니다. 빈도 제한에서 일시적으로 사용하는 것과 저장하지 않는 것을 구분하여 설명합니다.
- `pogo_consent=denied`이면 자체 수집과 GA4 이벤트를 보내지 않습니다. 통계 방문자 ID를 계정 정보와 연결하지 않습니다.
- Fastify 응답 스키마의 `object`에는 실제 속성을 명시합니다. 빈 object 스키마로 응답 필드가 제거되지 않도록 OpenAPI 검사를 유지합니다.
- `infra/firebase/firestore.rules`를 수정하면 `frontend-v4`의 `npm run test:rules`로 검증합니다. 삭제 요청에는 `request.resource`가 없다는 점을 고려하고, 콘솔 게시가 코드 배포와 별도임을 기록합니다.

현재 약관·개인정보 고지는 `web/src/screens/Legal.tsx`, 동의 UI와 `web/src/lib/legalMeta.ts`를 함께 확인합니다. 이전 `frontend-v4` 고지는 복구 환경의 Firebase 사실을 설명하므로 현재 문구를 무조건 복사하지 않습니다.

수집 항목이 늘면 시행 7일 전 패치노트 고지 약속을 확인합니다. 시행일·실제 동작·한영 안내를 일치시키고, 이전 공지를 정정할 때는 정정 항목을 별도로 남깁니다. 검색 수집과 페이지뷰의 과거 시행일 정정은 [CHANGELOG](../docs/CHANGELOG.md)에 보존합니다.

## 6. 비밀 관리

`.env`, `firestore.rules.local`, 서비스 계정 JSON, DB 접속 정보와 서명 키를 커밋하거나 대화·문서에 붙이지 않습니다. `BACKUP_PASSPHRASE`는 비밀번호 관리자에 보관합니다. 공개 브라우저 식별자와 서버 비밀을 혼동하지 않습니다.

Firestore 규칙을 mock UID로 렌더하지 않습니다. `scripts/render_rules.sh`의 방어를 우회하지 않습니다.

## 7. 버전과 배포

서비스 버전의 원본은 **`content/version.json` 하나**입니다. `backend/build.py`와 데이터 추출기는 이를 읽습니다.

| 함께 확인할 문서 | 규칙 |
| --- | --- |
| `content/release-notes.mjs` | 최신 버전의 한국어 안내 |
| `content/release-notes.en.mjs` | 한국어와 날짜 키 일치 |
| `CHANGELOG.md`, `README.md` | 최신 날짜·버전·개수 일치, 기존 버전 검사 형식 유지 |

사용자에게 설명할 변경을 묶어 릴리스합니다. 커밋마다 버전을 올리지 않습니다.

`build.sh`는 데이터·이미지를 생성하며 현재 웹 화면은 `web`에서 별도로 빌드합니다. 데이터 빌드가 변경한 `snapshot/`은 diff를 확인하여 의도하지 않은 생성 변경만 제외합니다. 다른 작업자의 변경을 일괄 되돌리지 않습니다.

운영 배포는 `dev → main PR → deploy` 흐름입니다. v5 운영 웹은 Vercel이며 `deploy-web.yml`이 처리합니다. 도메인 전환은 `cutover-prod.yml`의 status·attach·rollback 절차를 따릅니다.

## 8. 문장·코드·간격

결론을 먼저 쓰고 중복을 줄입니다. 주석은 `//`를 줄마다 사용하며 구현 선택의 이유를 설명합니다. CSS는 변수화·공통화하고 override를 최소화합니다.

| 항목 | 기준 |
| --- | --- |
| Pretendard 본문 | 1.2 · 1.4 · 1.6rem |
| Galmuri | 1.4 · 2.2 · 2.8 · 4.2rem |
| 새 디자인 제목 | 굵은 Pretendard 2.2 · 2.8 · 4.2rem |
| 간격 | 0.4rem 배수. 0.2rem은 가는 선에만 예외 |
| 줄 높이 | 1 · 1.2 · 1.5 · 1.7 |
| 조작 영역 | 최소 높이 `var(--tap)` 44px |

읽는 글은 12px보다 작게 만들지 않습니다. Galmuri에는 1.2·1.6rem을 사용하지 않고, 작은 위계는 크기 대신 색과 굵기로 구분합니다. 격자 중간 값은 더 넓은 쪽으로 맞춥니다.

이전 v4 스킨 우선순위 조정에는 `html body #root` 접두사 하나를 사용합니다. `#page-head`의 margin·padding 단축 속성으로 기존 좌측 배치를 지우지 않습니다. 현재 cinema 스타일에서는 공통 토큰과 구성요소를 먼저 확인합니다.

## 9. 실행 환경

프로젝트 공통 실행 기준은 CI와 같은 Node 22·Python 3.12입니다. 특정 작업 환경의 Playwright 절대 경로나 인증서 우회 옵션을 공통 요건으로 추가하지 않습니다. 프로세스 종료 명령은 대상을 확인하고 다른 셸 작업과 묶어 실행하지 않습니다.
