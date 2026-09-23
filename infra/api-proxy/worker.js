// ─────────────────────────────────────────────────────────────────────────────
// infra/api-proxy/worker.js — api.moncamp.kr 을 받아 Cloud Run 으로 넘긴다 (v5 Phase 7)
//
// **왜 Worker 인가.** Cloud Run 을 서울(asia-northeast3)에 둔다 — 개인정보처리방침 4번 표에
// 그렇게 적혀 있다. 그런데 서울은 Cloud Run 도메인 연결을 지원하지 않고, 지원 지역에서도
// '운영에 권하지 않는 미리보기' 다(공식 문서). 대안인 글로벌 부하 분산기는 월 $18 쯤이라
// $1 예산과 안 맞는다. moncamp.kr 은 이미 Cloudflare 를 거치므로 여기서 넘기면 0원이다.
//
// **왜 api.moncamp.kr 이어야 하나.** 리프레시 쿠키는 httpOnly 로 서버 주소에 심긴다.
// *.run.app 이면 moncamp.kr 과 다른 사이트라 브라우저가 제3자 쿠키로 막는다 — 로그인이 안 선다.
//
// 지키는 셋
//   ① 리다이렉트를 따라가지 않는다 — 로그인 시작·콜백의 302 는 **브라우저가** 따라가야 한다
//   ② 접속 IP 는 Cloudflare 가 본 것으로 덮는다 — 사용자가 보낸 X-Forwarded-For 는 버린다.
//      서버의 분당 한도가 이 값을 키로 쓴다 (server/src/app.ts). 저장은 안 한다 (CLAUDE.md §3)
//   ③ 나라는 x-country-code 로 넘긴다 — cf-* 머리는 밖으로 나가는 요청에서 벗겨질 수 있다.
//      서버가 이 이름을 두 번째로 읽는다 (server/src/lib/country.ts)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

/** 들어온 요청을 Cloud Run 으로 갈 요청으로 바꾼다 — 검사가 이 함수를 직접 부른다 */
export function toOrigin(request, originUrl) {
  const target = new URL(request.url);
  const origin = new URL(originUrl);
  target.protocol = origin.protocol;
  target.host = origin.host;

  const headers = new Headers(request.headers);
  // Host 는 fetch 가 주소에서 새로 만든다. 남겨 두면 Cloud Run 이 모르는 이름이라 404 다
  headers.delete('host');
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  else headers.delete('x-forwarded-for');
  const country = request.cf?.country;
  if (typeof country === 'string' && /^[A-Z]{2}$/.test(country)) headers.set('x-country-code', country);
  else headers.delete('x-country-code');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(target.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : null,
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  });
}

export default {
  async fetch(request, env) {
    if (!env.ORIGIN_URL) return new Response('ORIGIN_URL 이 없습니다', { status: 500 });
    return fetch(toOrigin(request, env.ORIGIN_URL));
  },
};
