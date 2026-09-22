// ─────────────────────────────────────────────────────────────────────────────
// test/envFixture.ts — 검사가 서버를 세울 때 쓰는 환경변수 한 벌 (v5 Phase 4)
//
// **왜 한 곳인가.** Phase 4 에서 필수 환경변수가 다섯 늘었다. 검사 파일마다 손으로 적으면
// 다음에 하나 더 늘 때 파일 넷을 다 고쳐야 하고, 하나를 빼먹으면 그 파일만 부팅에서 죽는다.
//
// **진짜 값이 아니다.** 예약 도메인(.test)이라 누구의 주소도 아니고, 이 열쇠로 만든 토큰은
// 이 프로세스 밖에서 아무 뜻이 없다. 진짜 자격증명이 있어야 도는 검사는 CI 에서 못 돈다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export const TEST_AUTH_ENV = {
  JWT_SECRET: 'test-only-secret-'.padEnd(48, '0'),
  ROOT_EMAIL: 'owner@example.test',
  GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-test',
  OAUTH_REDIRECT_URI: 'http://localhost:8080/v1/auth/google/callback',
  APP_ORIGIN: 'https://moncamp.kr',
} as const;
