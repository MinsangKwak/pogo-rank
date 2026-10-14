'use strict';
// Cloudflare Pages 이전 (2026-10-15) — _headers · _redirects 가 Vercel 의 서버 설정과 같은 표에서 나오는가
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import config, { SECURITY_HEADERS } from '../../next.config';
import { headersFile, redirectsFile } from '../lib/hosting';
import { ROUTES } from '../routes';

describe('_headers', () => {
  it('모든 주소에 보안 헤더 다섯 — next.config 의 headers() 와 같은 이름 · 값', async () => {
    const text = headersFile();
    expect(text.startsWith('/*\n')).toBe(true);
    for (const [name, value] of SECURITY_HEADERS) expect(text).toContain(`  ${name}: ${value}\n`);
    const served = (await config.headers!()).find((one) => one.source === '/:path*');
    expect(served?.headers.map((one) => one.key)).toEqual(SECURITY_HEADERS.map(([name]) => name));
  });
  it('해시가 박힌 번들만 1년 캐시 — 데이터 · 서비스워커는 건드리지 않는다', () => {
    expect(headersFile()).toContain('/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headersFile()).not.toMatch(/\/data\/|sw\.js/);
  });
});

describe('_redirects', () => {
  it('옛 주소마다 정확히 그 주소 · 그 아래 두 줄, 308 — next.config 의 redirects() 와 같은 짝', async () => {
    const lines = redirectsFile().trim().split('\n');
    const served = await config.redirects!();
    for (const rule of served) {
      // 그 아래 주소는 맨 주소로 — 정적 빌드에는 뒷부분 주소가 구워져 있지 않다
      const line = `${rule.source.replace('/:rest*', '/*')} ${rule.destination.replace('/:rest*', '')} 308`;
      expect(lines, line).toContain(line);
    }
  });
  it('뒷부분이 구운 화면이면 그 화면으로 — 와일드카드보다 먼저 (Codex, PR #374)', () => {
    const lines = redirectsFile().trim().split('\n');
    const cases: [string, string][] = [['rank/pve/solo', 'pve/solo'], ['rank/pvp/deck', 'pvp/deck'], ['rank/pvp/ivrank', 'pvp/ivrank'], ['rank/max/deck', 'dmax/deck']];
    for (const [from, to] of cases) {
      const exact = lines.indexOf(`/${from} /${to} 308`);
      expect(exact, from).toBeGreaterThanOrEqual(0);
      const parent = from.slice(0, from.lastIndexOf('/'));
      expect(exact, from).toBeLessThan(lines.indexOf(`/${parent}/* /${to.slice(0, to.indexOf('/'))} 308`));
    }
  });
  it('옮겨 간 곳은 모두 구운 주소 — 뒷부분을 붙여 404 로 보내지 않는다 (Codex, PR #372)', () => {
    const paths = new Set<string>(ROUTES.map((route) => route.path));
    for (const line of redirectsFile().trim().split('\n')) {
      const to = line.split(' ')[1]!;
      expect(to, line).not.toContain(':splat');
      expect(paths.has(to.slice(1)), line).toBe(true);
    }
  });
  it('Cloudflare 한도(정적 2,000줄) 안', () => {
    expect(redirectsFile().trim().split('\n').length).toBeLessThan(2000);
  });
});

describe('정적 빌드 설정', () => {
  it('BUILD_TARGET=static 일 때만 정적 내보내기 — Vercel(값 없음)은 지금과 같다', () => {
    const text = readFileSync('next.config.ts', 'utf8');
    expect(text).toContain("const STATIC = process.env['BUILD_TARGET'] === 'static';");
    expect(text).toContain("...(STATIC ? { output: 'export' as const } : {})");
    expect(config.output).toBeUndefined();
  });
  it('요청마다 도는 경로가 없다 — 정적 내보내기가 거부한다 (dynamicParams · sitemap · robots · ads.txt)', () => {
    expect(readFileSync('app/[...slug]/page.tsx', 'utf8')).toContain('export const dynamicParams = false;');
    for (const path of ['app/sitemap.ts', 'app/robots.ts', 'app/ads.txt/route.ts', 'app/%5Fheaders/route.ts', 'app/%5Fredirects/route.ts']) {
      expect(readFileSync(path, 'utf8'), path).toContain("export const dynamic = 'force-static';");
    }
  });
});
