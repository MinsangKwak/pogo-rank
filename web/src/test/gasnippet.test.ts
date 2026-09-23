// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// gasnippet.test.ts — GA 조각이 지켜야 할 셋 (lib/gaSnippet.ts)
//   ① '통계 끄기' 를 고른 사람에게서는 한 건도 안 나간다 (CLAUDE.md §3)
//   ② moncamp.kr 밖(미리보기 주소)에서는 안 센다
//   ③ id 가 비거나 모양이 틀리면 조각 자체를 안 만든다 — 문서에 엉뚱한 글자가 실리지 않게
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import { gaSnippet } from '../lib/gaSnippet';

type GaWindow = Window & { gtag?: unknown; dataLayer?: unknown[] };

function run(host: string, consent: string | null) {
  const win = window as GaWindow;
  delete win.gtag; delete win.dataLayer;
  document.head.querySelectorAll('script').forEach((one) => one.remove());
  if (consent === null) localStorage.removeItem('pogo_consent'); else localStorage.setItem('pogo_consent', consent);
  // 호스트는 jsdom 이 정한 것을 못 바꾼다 — 조각 안의 location 만 갈아 끼운다
  const code = gaSnippet('G-TEST123').replace(/location\./g, 'fake.');
  const fake = { hostname: host, pathname: '/', hash: '', origin: `https://${host}` };
  new Function('fake', code)(fake);
  return { gtag: typeof win.gtag, loader: document.head.querySelector('script[src*="googletagmanager"]') };
}

describe('GA 조각', () => {
  beforeEach(() => localStorage.clear());

  it('moncamp.kr 에서 통계를 안 껐으면 불러온다', () => {
    const got = run('moncamp.kr', null);
    expect(got.gtag).toBe('function');
    expect(got.loader).not.toBeNull();
  });

  it('★ 통계를 끈 사람에게서는 스크립트조차 안 불러온다', () => {
    const got = run('moncamp.kr', 'denied');
    expect(got.gtag).toBe('undefined');
    expect(got.loader).toBeNull();
  });

  it('미리보기 주소에서는 안 센다', () => {
    expect(run('pogo-rank.vercel.app', null).loader).toBeNull();
  });

  it('광고 저장은 거부로 둔다', () => {
    expect(gaSnippet('G-TEST123')).toContain("ad_storage: 'denied'");
  });

  it('id 가 비거나 모양이 틀리면 조각이 없다', () => {
    expect(gaSnippet('')).toBe('');
    expect(gaSnippet("G-1'});alert(1)//")).toBe('');
  });
});
