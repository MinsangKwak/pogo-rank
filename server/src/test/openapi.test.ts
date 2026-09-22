// ─────────────────────────────────────────────────────────────────────────────
// openapi — **설명서가 코드와 어긋나지 않는다.**
//
// 저장소의 openapi.json 은 손으로 쓴 것이 아니라 라우트 스키마에서 구운 것이다.
// 주소를 고치고 다시 굽는 것을 잊으면 리뷰어가 옛 설명서를 읽고 짠다 —
// 어긋난 설명서는 없느니만 못하다. 그래서 검사가 대어 본다.
//
//   어긋나면: npm run openapi
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openapiSpec, specText } from '../lib/spec.ts';

const file = resolve(__dirname, '../../openapi.json');

describe('OpenAPI 설명서', () => {
  it('저장소의 openapi.json 이 지금 코드와 같다 (다르면 npm run openapi)', async () => {
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf-8')).toBe(specText(await openapiSpec()));
  });

  it('주소가 다 적혀 있다', async () => {
    const spec = await openapiSpec() as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths).sort()).toEqual(
      [
        '/healthz',
        '/v1/admin/backups', '/v1/admin/rollup',
        // v5 Phase 4 — 로그인
        '/v1/auth/google/callback', '/v1/auth/google/start',
        '/v1/auth/logout', '/v1/auth/logout-all', '/v1/auth/refresh', '/v1/auth/sessions',
        '/v1/events', '/v1/hot', '/v1/me',
      ],
    );
  });

  it('열쇠가 필요한 자리에 자물쇠가 붙어 있다', async () => {
    const spec = await openapiSpec() as {
      paths: Record<string, Record<string, { security?: unknown[] }>>;
      components: { securitySchemes: Record<string, unknown> };
    };
    expect(spec.components.securitySchemes['adminToken']).toBeDefined();
    expect(spec.paths['/v1/admin/rollup']?.['post']?.security).toEqual([{ adminToken: [] }]);
    // 수집은 누구나 부르는 자리다 — 자물쇠가 붙으면 그게 사고다
    expect(spec.paths['/v1/events']?.['post']?.security).toBeUndefined();
  });

  it('수집 몸통이 모르는 칸을 막는다고 적혀 있다', async () => {
    const spec = await openapiSpec() as Record<string, any>;
    const body = spec['paths']['/v1/events']['post']['requestBody']['content']['application/json']['schema'];
    expect(body.additionalProperties).toBe(false);
    expect(body.properties.events.maxItems).toBe(20);
  });

  it('sendBeacon 이 보내는 text/plain 도 받는다고 적혀 있다', async () => {
    const spec = await openapiSpec() as Record<string, any>;
    // 설명에만 적고 스펙에 안 실으면, 이 스펙으로 만든 클라이언트는 프리플라이트가 붙는
    // 쪽으로 보낸다 — 탭을 떠나며 보낸 것이 그때 사라진다
    const content = spec['paths']['/v1/events']['post']['requestBody']['content'];
    expect(Object.keys(content).sort()).toEqual(['application/json', 'text/plain']);
  });

  // **빈 object 스키마는 값을 통째로 지운다.** fast-json-stringify 는 적힌 칸만 내보내므로
  // `{ type: 'object' }` 로 둔 자리는 핸들러가 무엇을 담아도 `{}` 로 나간다.
  // 자리마다 검사를 세우면 새 주소에서 또 샌다 — 스펙 전체를 훑는다
  it('칸을 안 적은 object 가 스펙 어디에도 없다', async () => {
    const spec = await openapiSpec() as Record<string, any>;
    const bare: string[] = [];
    const walk = (node: unknown, where: string): void => {
      if (Array.isArray(node)) return node.forEach((one, i) => walk(one, `${where}[${i}]`));
      if (!node || typeof node !== 'object') return;
      const one = node as Record<string, unknown>;
      const type = one['type'];
      const isObject = type === 'object' || (Array.isArray(type) && type.includes('object'));
      if (isObject && !one['properties'] && !one['additionalProperties']) bare.push(where);
      for (const [key, value] of Object.entries(one)) walk(value, `${where}.${key}`);
    };
    walk(spec['paths'], 'paths');
    expect(bare).toEqual([]);
  });

  // **3.0.3 문서에 3.1 문법을 섞지 않는다.** 배열 `type` 은 JSON Schema·OpenAPI 3.1 것이라
  // 3.0 검증기와 클라이언트 생성기는 문서를 통째로 거부한다
  it('없는 값은 3.0 문법(nullable)으로 적힌다', async () => {
    const spec = await openapiSpec() as Record<string, any>;
    expect(spec['openapi']).toBe('3.0.3');

    const arrays: string[] = [];
    const walk = (node: unknown, where: string): void => {
      if (Array.isArray(node)) return node.forEach((one, i) => walk(one, `${where}[${i}]`));
      if (!node || typeof node !== 'object') return;
      const one = node as Record<string, unknown>;
      if (Array.isArray(one['type'])) arrays.push(where);
      for (const [key, value] of Object.entries(one)) walk(value, `${where}.${key}`);
    };
    walk(spec, '');
    expect(arrays).toEqual([]);

    // 바꿔 끼운 자리가 뜻을 잃지 않았는가 — 문턱은 raw 면 null 이다
    const thresholds = spec['paths']['/v1/hot']['get']['responses']['200']
      ['content']['application/json']['schema']['properties']['thresholds'];
    expect(thresholds).toMatchObject({ type: 'object', nullable: true });
  });
});
