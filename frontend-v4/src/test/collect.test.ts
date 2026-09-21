// ─────────────────────────────────────────────────────────────────────────────
// test/collect.test.ts — 내 수집기로 보내는 쪽 (v4.7.0)
//
// **여기서 잡고 싶은 것 셋**
//   ① '통계 끄기' 를 고른 사람에게서 한 건도 안 나가는가 — 새면 약속을 어긴 것이다
//   ② 주소가 없을 때 조용히 꺼지는가 — 서버를 세우기 전에도 화면이 똑같이 돌아야 한다
//   ③ 미리보기(dev)가 운영 채널로 새지 않는가 — v4.5.6 이 검사로 못 박은 것과 같은 자리
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectSearch, configureCollect, flushCollect, resetCollect, visitorId } from '../lib/collect';

const URL_BASE = 'https://api.example.test';
let sent: { url: string; body: unknown }[] = [];

/** 보낸 몸통을 붙잡는다 — sendBeacon 이 먼저 잡히므로 그쪽을 본다 */
function captureBeacon() {
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (url: string, blob: Blob) => {
      // Blob.text() 는 비동기라 검사가 어렵다 — 생성자 인자를 그대로 담아 둔다
      sent.push({ url, body: (blob as Blob & { __body?: string }).__body });
      return true;
    },
  });
  // Blob 이 무엇을 담았는지 꺼낼 수 있게 감싼다
  const Original = globalThis.Blob;
  vi.stubGlobal('Blob', class extends Original {
    __body: string;
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      this.__body = String(parts[0]);
    }
  });
}

beforeEach(() => {
  sent = [];
  resetCollect();
  vi.useFakeTimers();
  captureBeacon();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetCollect();
});

const bodyOf = (index = 0) => JSON.parse(String(sent[index]?.body ?? '{}'));

describe('익명 방문자 ID', () => {
  it('모양이 서버 스키마와 맞는다 — 안 맞으면 400 이라 한 건도 안 쌓인다', () => {
    expect(visitorId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('두 번 불러도 같은 값 — 같은 사람을 한 사람으로 센다', () => {
    expect(visitorId()).toBe(visitorId());
  });

  it('저장소가 막혀 있어도 던지지 않는다', () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('막힘'); };
    try {
      expect(() => visitorId()).not.toThrow();
      expect(visitorId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    } finally {
      Storage.prototype.getItem = real;
    }
  });

  it('pogo_ 접두사를 쓴다 — 바깥이 물려 있는 이름 규칙이다 (CLAUDE.md §2)', () => {
    visitorId();
    expect(localStorage.getItem('pogo_visitor')).toBeTruthy();
  });
});

describe('보내는 조건', () => {
  it('주소가 없으면 한 건도 안 나간다 — 서버를 세우기 전에는 통째로 꺼져 있다', () => {
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(sent).toHaveLength(0);
  });

  it("'통계 끄기' 를 고른 사람에게서는 한 건도 안 나간다", () => {
    localStorage.setItem('pogo_consent', 'denied');
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(sent).toHaveLength(0);
  });

  it('아무것도 안 고른 사람에게서는 나간다 — 옵트아웃이다 (v3.39.0 의 판단)', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(sent).toHaveLength(1);
    expect(bodyOf().events[0]).toMatchObject({ name: 'search', term: '뮤츠', surface: 'dex' });
  });

  it('빈 검색어는 안 보낸다', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('   ', 'dex');
    vi.runAllTimers();
    expect(sent).toHaveLength(0);
  });
});

describe('채널', () => {
  it('미리보기 빌드는 dev 로 적힌다 — 운영 순위로 새지 않는다', () => {
    configureCollect(URL_BASE, 'v4.7.0-dev');
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(bodyOf().channel).toBe('dev');
  });

  it('운영 빌드는 prod 다', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(bodyOf().channel).toBe('prod');
  });
});

describe('모아 보내기', () => {
  it('여러 건을 한 번에 보낸다 — 고를 때마다 요청을 내지 않는다', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    collectSearch('리자몽', 'dex');
    collectSearch('잠만보', 'pvp_deck');
    expect(sent).toHaveLength(0);          // 아직 안 나갔다
    vi.runAllTimers();
    expect(sent).toHaveLength(1);
    expect(bodyOf().events).toHaveLength(3);
  });

  it('20건에 닿으면 기다리지 않고 보낸다 — 더 쌓으면 서버가 400 으로 되돌린다', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    for (let i = 0; i < 20; i += 1) collectSearch(`말${i}`, 'dex');
    expect(sent).toHaveLength(1);
    expect(bodyOf().events).toHaveLength(20);
  });

  it('보낼 것이 없으면 부르지 않는다', () => {
    configureCollect(URL_BASE, 'v4.7.0');
    flushCollect();
    expect(sent).toHaveLength(0);
  });

  it('주소 끝의 슬래시를 겹치지 않는다', () => {
    configureCollect(`${URL_BASE}/`, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    vi.runAllTimers();
    expect(sent[0]?.url).toBe(`${URL_BASE}/v1/events`);
  });
});

describe('화면을 망가뜨리지 않는다', () => {
  it('보내다 터져도 예외가 밖으로 안 나온다 — 수집 실패로 티어표가 멎으면 사고다', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: () => { throw new Error('네트워크 막힘'); },
    });
    configureCollect(URL_BASE, 'v4.7.0');
    collectSearch('뮤츠', 'dex');
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
