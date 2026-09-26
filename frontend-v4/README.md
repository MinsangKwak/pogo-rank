# frontend-v4 — 이전 웹 앱과 Storybook

[프로젝트 소개](../README.md) · [현재 개발 가이드](../docs/DEVELOPMENT.md) · [디자인 가이드](../docs/design/README.md)

**현재 서비스 앱은 `web/`입니다.** 이 디렉터리는 React·Vite로 만든 v4 앱을 보존하며, 데이터 추출 스크립트와 Storybook 빌드에도 사용합니다. 현재 화면 수정은 먼저 `web/`에서 위치를 확인하세요.

## 유지하는 이유

| 구성 | 현재 역할 |
| --- | --- |
| `scripts/extract-data.mjs` | Python 산출물을 화면용 JSON으로 변환. `web`의 `npm run data`도 이 스크립트를 호출 |
| `src/ds/` · `.storybook/` | 공통 UI 구성요소와 테마를 Storybook에서 확인 |
| Vite 앱·Firebase 연동 | 이전 구조와 복구 환경 검토. 현재 서버 인증과 혼동하지 않도록 주의 |
| `src/test/` | 이전 앱 규칙, 데이터 표시, 문서·릴리스 버전 일치 검사 |

React 19, TypeScript, Vite, TanStack Query, Zustand를 사용합니다. 정확한 의존성과 명령은 [package.json](package.json)을 확인하세요.

## 이전 앱 실행

먼저 저장소 루트에서 `bash scripts/build.sh --data-only`로 데이터를 생성합니다.

```bash
cd frontend-v4
npm ci
npm run data
npm run dev
```

이미지까지 보려면 루트 전체 빌드가 필요합니다. 현재 Next.js 앱의 실행 방법은 [루트 README](../README.md#로컬-실행)를 따릅니다.

## Storybook

```bash
npm run storybook
# 개발 서버: http://localhost:6006

STORYBOOK_BASE=/storybook/ npm run build-storybook
# 산출물: storybook-static/
```

Storybook 배포 경로는 `/storybook/`입니다. 하위 경로용 빌드에는 `STORYBOOK_BASE`를 설정해야 합니다. 스토리 ID와 테마 URL 값은 ASCII를 사용하고, 미리보기 서버는 쿼리스트링을 보존해야 합니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

`npm run build`에는 데이터 추출·타입 검사·테스트가 포함됩니다. Firebase 규칙을 수정한 경우에만 `npm run test:rules`로 에뮬레이터 검증을 추가합니다.

새 UI 구성요소에는 스토리를 추가하고 두 테마를 확인합니다. `Stack`·`Inline`의 간격, `Text`·`Label`의 크기는 [토큰 정의](src/ds/tokens.ts)를 사용합니다. 자세한 화면 규칙은 [작업 지침](../CLAUDE.md)에 있습니다.

## 수정 시 주의

- 이전 앱의 로그인·법적 고지를 현재 `web/`에 그대로 복사하지 않습니다. 두 앱은 인증·저장소 구조가 다릅니다.
- 데이터 추출 스크립트를 수정하면 `web` 빌드도 확인합니다.
- 이 디렉터리를 제거하기 전에 현재 데이터·Storybook 의존성을 먼저 분리해야 합니다.
