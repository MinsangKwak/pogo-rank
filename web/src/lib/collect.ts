// ─────────────────────────────────────────────────────────────────────────────
// lib/collect.ts — 내 수집기로 **GA4 와 나란히** 보낸다 (v4.7.0).
//
// **왜 GA 를 끄지 않나** — 두 수치를 견줄 기준이 있어야 내 수집기가 맞는지 안다.
// GA 만 보던 때에 v4.6.3 이 났다: 하루 3회짜리 검색어는 GA4 의 임계값 아래라 영영 안 보이고,
// 원본 이벤트는 Data API 가 돌려주지 않는다. 그래서 같은 이벤트를 한 벌 더 남긴다.
//
// **화면은 이 파일이 실패해도 멀쩡해야 한다.** 여기서 던지는 예외는 하나도 밖으로 안 나간다 —
// 수집이 안 되는 것은 불편이지만, 그 때문에 티어표가 안 그려지면 사고다.
//
// 동의는 track() 과 **같은 게이트**를 탄다 (lib/consent.ts) — '통계 끄기' 면 한 건도 안 나간다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { analyticsWanted } from './consent';

declare global {
  interface Window { __collectLog?: unknown[][] }
}

// server/src/lib/contract.ts 와 **같은 값**이다. 판정은 서버가 한다 —
// 번들은 공개라 누구나 고쳐 보낼 수 있어, 여기 적힌 것은 약속이지 방어가 아니다
const BATCH_MAX = 20;
const TERM_MAX = 100;
/** 모아 보내는 틈. 한 번 고를 때마다 한 번씩 부르면 짧은 요청이 줄줄이 난다 */
const FLUSH_MS = 2000;

const VISITOR_KEY = 'pogo_visitor';   // v3 부터 이어 온 pogo_ 접두사 (CLAUDE.md §2)

interface Queued { name: 'search' | 'view'; term?: string; surface?: string; ts: string }

/**
 * 페이지뷰를 보내기 시작하는 때 — **개인정보처리방침 개정 시행일**이다 (2026-09-24 고지, 7일 뒤).
 * server/src/lib/contract.ts VIEW_COLLECT_FROM 과 **같은 값**이다. 서버도 그 전의 것은 버린다 —
 * 여기는 보내지 않아서 요청을 아끼는 쪽이다. 방침 본문(screens/Legal.tsx)과 패치노트의 날짜도 같아야 한다
 * (src/test/viewgate.test.ts 가 넷을 견준다)
 */
export const VIEW_COLLECT_FROM = '2026-10-02T00:00:00+09:00';
const ROUTE_ID = /^[a-z0-9-]{1,40}$/;

let endpoint = '';
let channel: 'prod' | 'dev' = 'prod';
let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/** 저장소를 막은 브라우저용. 이 탭에서만 사는 ID 라 새로고침하면 새 사람이 된다 */
let memoryId = '';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch { /* 지원 안 하는 브라우저 */ }
  // getRandomValues 도 없으면 Math.random 으로 — 순위를 세는 용도라 암호학적 강도가 필요 없다
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('').slice(0, 32);
}

/**
 * 익명 방문자 ID. **사람과 이어지지 않는다** — 브라우저가 만든 난수일 뿐이다 (CLAUDE.md §3).
 * 이게 없으면 '같은 사람이 같은 말을 백 번' 을 구별할 수 없어 사람당 한도를 걸 수 없다.
 */
export function visitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
    const made = randomId();
    localStorage.setItem(VISITOR_KEY, made);
    return made;
  } catch {
    return (memoryId ||= randomId());
  }
}

/**
 * 보낼 곳을 알려 준다. 주소가 없으면 이 기능은 **통째로 꺼진다** —
 * 로그인이 FIREBASE_CONFIG.apiKey 없이 꺼지는 것과 같은 규칙이다.
 */
export function configureCollect(url: string, appVersion: string): void {
  endpoint = (url || '').trim().replace(/\/+$/, '');
  // 미리보기 빌드는 판 번호 끝에 -dev 가 붙는다 (backend/build.py). 채널을 따로 싣지 않는 이유다
  channel = appVersion.endsWith('-dev') ? 'dev' : 'prod';
}

function send(body: unknown): void {
  const url = `${endpoint}/v1/events`;
  const json = JSON.stringify(body);
  try {
    // 떠나는 길에도 닿게 — fetch 는 탭이 닫히면 취소되지만 beacon 은 브라우저가 끝까지 보낸다
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // text/plain 인 이유 — application/json 은 프리플라이트를 부른다. 서버가 몸통을 JSON 으로 읽는다
      if (navigator.sendBeacon(url, new Blob([json], { type: 'text/plain;charset=UTF-8' }))) return;
    }
    void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json, keepalive: true })
      .catch(() => { /* 수집 실패는 화면에 아무 영향이 없다 */ });
  } catch { /* 저장소·네트워크를 막은 환경 */ }
}

export function flushCollect(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!endpoint || !queue.length) return;
  const events = queue;
  queue = [];
  send({ visitor: visitorId(), channel, events });
}

function enqueue(event: Queued): void {
  queue.push(event);
  // 한도에 닿으면 기다리지 않고 보낸다 — 더 쌓으면 서버가 400 으로 되돌린다
  if (queue.length >= BATCH_MAX) { flushCollect(); return; }
  timer ??= setTimeout(flushCollect, FLUSH_MS);
}

/** 고른 검색어 하나. track.ts 의 trackSearchPick 이 GA 와 함께 부른다 */
export function collectSearch(term: string, surface: string): void {
  const word = term.trim().slice(0, TERM_MAX);
  if (!word) return;
  // 무엇이 나가는지 눈으로 볼 수 있게 남긴다 (콘솔에서 window.__collectLog) — 주소가 없어도 쌓인다
  const log = (window.__collectLog ??= []);
  log.push([word, surface]);
  if (log.length > 200) log.splice(0, log.length - 200);

  if (!endpoint || !analyticsWanted()) return;
  enqueue({ name: 'search', term: word, surface, ts: new Date().toISOString() });
}

let lastView = '';

/**
 * 화면 하나를 연 것 — **화면 id 하나만** 보낸다(주소 · 질의 · 상세의 포켓몬 번호는 안 보낸다).
 * 시행일 전 · 통계를 끈 사람 · 주소 없는 빌드에서는 아무것도 안 나간다. 같은 화면을 연달아 열면 한 번만 센다
 */
export function collectView(routeId: string, now: number = Date.now()): void {
  if (now < Date.parse(VIEW_COLLECT_FROM)) return;
  if (!ROUTE_ID.test(routeId) || routeId === lastView) return;
  lastView = routeId;
  if (!endpoint || !analyticsWanted()) return;
  enqueue({ name: 'view', surface: routeId, ts: new Date(now).toISOString() });
}

/**
 * 탭을 떠날 때 남은 것을 보낸다.
 * **visibilitychange 를 쓴다** — 모바일 사파리는 탭을 닫을 때 unload 를 안 부른다.
 */
export function watchPageHide(): () => void {
  const onHide = () => { if (document.visibilityState === 'hidden') flushCollect(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushCollect);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flushCollect);
  };
}

/** 검사에서 판을 새로 깔 때만 쓴다 */
export function resetCollect(): void {
  endpoint = '';
  channel = 'prod';
  queue = [];
  lastView = '';
  if (timer) { clearTimeout(timer); timer = null; }
}
