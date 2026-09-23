// ─────────────────────────────────────────────────────────────────────────────
// headers.test.ts — 보안 헤더가 모든 주소에 붙는지 본다 (v5 운영 전환)
//
// 전에는 Cloudflare 가 붙였다. 프록시를 끄면 그 규칙이 더는 안 걸리고, 헤더가 빠져도
// 화면은 멀쩡해서 아무도 모른다. 설정은 여기서, 실제 응답은 배포 워크플로가 잰다
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import config, { SECURITY_HEADERS } from '../../next.config';

describe('보안 헤더 다섯 (docs/INFRA.md §8)', () => {
  it('이름이 다섯이고 값이 비지 않았다', () => {
    const names = SECURITY_HEADERS.map(([name]) => name.toLowerCase());
    expect(names).toEqual([
      'strict-transport-security', 'x-content-type-options', 'referrer-policy',
      'content-security-policy', 'permissions-policy',
    ]);
    for (const [, value] of SECURITY_HEADERS) expect(value.trim()).not.toBe('');
  });

  it('클릭재킹 방어가 들어 있다 — <meta> 로는 못 넣는 것이다', () => {
    expect(Object.fromEntries(SECURITY_HEADERS)['Content-Security-Policy']).toContain("frame-ancestors 'self'");
  });

  it('모든 주소에 붙는다', async () => {
    const rules = await config.headers!();
    const all = rules.find((rule) => rule.source === '/:path*');
    expect(all?.headers.map((one) => one.key)).toEqual(SECURITY_HEADERS.map(([name]) => name));
  });
});
