// ─────────────────────────────────────────────────────────────────────────────
// test/swscope.test.ts — 앱 밖의 판을 서비스워커가 비켜 가는지 본다
//
// 2026-09-22 dev 에 도면(/storybook/)을 얹으면서 드러난 자리다.
// 서비스워커의 범위는 루트라 **같은 도메인의 다른 판까지 들어온다.** 그대로 두면 둘이 어긋난다 —
// 브라우저로 실측한 결과가 이랬다:
//   · /storybook/ 을 열면 navigate 갈래가 그 HTML 을 앱의 오프라인 자리('/')에 덮어썼다
//     (캐시를 열어 보니 앱 자리에 도면 HTML 이 들어 있었고, 도면 청크 9개까지 같이 들어와 있었다)
//   · 오프라인에서 /storybook/ 을 열면 그 자리가 200 으로 답해 엉뚱한 화면이 떴다
//
// 고친 뒤에는 앱 자리에 앱 HTML 만 남고, 오프라인 /storybook/ 은 평범한 네트워크 오류가 난다.
// 서비스워커는 jsdom 에서 돌릴 수 없으므로, 여기서는 **두 파일이 같은 주소를 말하는지**를 본다 —
// 배포가 얹는 자리와 서비스워커가 비켜 가는 자리가 갈라지면 그 사고가 조용히 돌아온다.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf-8');
const SW = read('public/sw.js');
const DEPLOY = read('../.github/workflows/deploy-dev.yml');

/** 서비스워커가 비켜 가기로 한 주소들 — `const OUTSIDE = /…/` 에서 뽑는다 */
function outsidePaths(): string[] {
  const line = /const OUTSIDE = \/\^(.*)\/;/.exec(SW);
  if (!line) return [];
  // `\/storybook\/` 처럼 이스케이프된 슬래시를 원래대로 편다
  return line[1]!.split('|').map((one) => one.replace(/\\\//g, '/'));
}

describe('서비스워커 범위', () => {
  it('앱 밖의 판을 비켜 가는 갈래가 있다', () => {
    expect(SW).toContain('const OUTSIDE');
    expect(outsidePaths()).toContain('/storybook/');
  });

  it('비켜 가기를 navigate 갈래보다 **먼저** 본다', () => {
    // 순서가 뒤집히면 도면 HTML 이 앱의 오프라인 자리에 덮인다 — 이 검사의 이유가 그것이다
    const skip = SW.indexOf('OUTSIDE.test(');
    const navigate = SW.indexOf("=== 'navigate'");
    expect(skip).toBeGreaterThan(-1);
    expect(navigate).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(navigate);
  });

  it('배포가 얹는 자리를 빠짐없이 비켜 간다', () => {
    // deploy-dev.yml 이 site/<이름> 으로 복사하는 자리가 곧 앱 밖의 판이다
    const landed = [...DEPLOY.matchAll(/cp -r \S+ site\/([a-z0-9-]+)/g)].map((hit) => `/${hit[1]}/`);
    expect(landed.length).toBeGreaterThan(0);
    for (const one of landed) expect(outsidePaths(), `${one} 를 서비스워커가 안 비켜 간다`).toContain(one);
  });
});
