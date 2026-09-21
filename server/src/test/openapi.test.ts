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
      ['/healthz', '/v1/admin/backups', '/v1/admin/rollup', '/v1/events', '/v1/hot'],
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
});
