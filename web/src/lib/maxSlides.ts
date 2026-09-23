// ─────────────────────────────────────────────────────────────────────────────
// lib/maxSlides.ts — 홈 배너가 굴리는 맥스 배틀 일정 (2026-09-23)
//
// **오늘 기준으로 아직 안 끝난 다이맥스·거다이맥스 일정을 전부** 슬라이드 한 장씩으로 만든다.
// 원본은 gameday 의 일정(LeekDuck 수집, 한국 시간)이다 — 코드에 보스를 박으면 다음 주에 틀린 말이 된다 (§3).
//
// 맥스 먼데이는 월요일 06–21시가 '행사' 지만 그 보스는 **한 주 내내** 파워 스폿에 선다.
// 그래서 월요일이 지나도 그 주 일요일까지는 '이번 주 보스' 로 남긴다 (일정표 schedule.json 의 dmax 칸과 같은 주 단위).
//
// 화면에 나갈 글자는 여기서 다 만든다 — 값이 비면 줄을 안 세운다 (CLAUDE.md §1)
// ─────────────────────────────────────────────────────────────────────────────
import type { GamedayEvent, DmaxRow } from '../types/data';

export type MaxKind = 'monday' | 'battle';

export interface MaxBoss {
  dex: number;
  /** 그릴 스프라이트 — 거다이맥스면 그 폼의 번호, 못 찾으면 도감 번호 */
  sprite: number;
  name: string;
  types: string[];
}

export interface MaxSlide {
  id: string;
  kind: MaxKind;
  gmax: boolean;
  /** 'MAX MONDAY' · 'MAX BATTLE DAY' */
  label: string;
  /** '9.21 (월) — 9.27 (일)' · '10.3 (토)' */
  when: string;
  /** '월 06:00–21:00' · '14:00–17:00' — 행사 시간. 모르면 빈 글자 */
  hours: string;
  bosses: MaxBoss[];
  /** 진행 중이면 true */
  live: boolean;
  /** 시작까지 남은 날 (진행 중이면 0) */
  days: number;
}

export interface MaxSlideSource {
  events: readonly GamedayEvent[] | undefined;
  names: Readonly<Record<string, string>> | undefined;
  en: Readonly<Record<string, string>> | undefined;
  forms: Readonly<Record<string, { types?: readonly string[] }>> | undefined;
  /** 거다이맥스 폼의 스프라이트를 찾는 표 (max.json DMAX_DATA.overall) — 없으면 도감 번호로 그린다 */
  maxRows?: readonly DmaxRow[] | undefined;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 원본 시각은 시간대 표기 없는 한국 시간이다 — 보는 사람의 시간대로 읽으면 해외에서 하루가 밀린다
function kst(iso: string): number {
  return Date.parse(`${iso.slice(0, 19)}+09:00`);
}

// 한국 날짜의 연·월·일·요일 — 시간대를 옮기지 않고 한국 기준으로 센다
function kstDate(ms: number) {
  const shifted = new Date(ms + 9 * 60 * 60 * 1000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), w: shifted.getUTCDay() };
}

function dayLabel(ms: number): string {
  const { m, d, w } = kstDate(ms);
  return `${m}.${d} (${WEEK_KO[w]})`;
}

function hhmm(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '';
}

// 한국 날짜로 며칠 남았나 — 시각이 아니라 날짜를 센다 (오늘 밤 행사도 'D-0' 이 아니라 '오늘' 이 되게)
function daysUntil(startMs: number, nowMs: number): number {
  const a = kstDate(startMs);
  const b = kstDate(nowMs);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / DAY);
}

// 그 주 일요일 23:59:59 (한국) — 맥스 먼데이 보스가 파워 스폿에 서는 끝
function weekEnd(startMs: number): number {
  const { y, m, d, w } = kstDate(startMs);
  const toSunday = (7 - w) % 7;
  return Date.UTC(y, m - 1, d + toSunday, 23, 59, 59) - 9 * 60 * 60 * 1000;
}

function bossesOf(event: GamedayEvent, gmax: boolean, src: MaxSlideSource): MaxBoss[] {
  const out: MaxBoss[] = [];
  for (const dex of event.dex ?? []) {
    const name = src.names?.[String(dex)];
    // 이름이 없으면 그 보스를 안 세운다 — 지어내지 않는다 (§3)
    if (!name) continue;
    let sprite = dex;
    if (gmax) {
      const en = src.en?.[String(dex)];
      const row = en ? src.maxRows?.find((one) => one.gmax && one.en === en) : undefined;
      if (row) sprite = row.sprite;
    }
    out.push({ dex, sprite, name, types: [...(src.forms?.[String(dex)]?.types ?? [])] });
  }
  return out;
}

/** 아직 안 끝난 맥스 일정 — 이른 것부터 */
export function maxSlides(src: MaxSlideSource, nowMs: number): MaxSlide[] {
  const out: { at: number; slide: MaxSlide }[] = [];
  for (const event of src.events ?? []) {
    if (event.type !== 'max-mondays' && event.type !== 'max-battles') continue;
    const start = kst(event.start);
    const end = kst(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const kind: MaxKind = event.type === 'max-mondays' ? 'monday' : 'battle';
    // 한 주 내내 서는 보스는 그 주 끝까지, 하루 행사는 행사 끝까지
    const until = kind === 'monday' ? weekEnd(start) : end;
    if (until < nowMs) continue;
    const gmax = /^gigantamax\b/i.test(event.title);
    const days = Math.max(0, daysUntil(start, nowMs));
    const from = hhmm(event.start);
    const to = hhmm(event.end);
    out.push({ at: start, slide: {
      id: event.id,
      kind,
      gmax,
      label: kind === 'monday' ? 'MAX MONDAY' : 'MAX BATTLE DAY',
      when: kind === 'monday' ? `${dayLabel(start)} — ${dayLabel(until)}` : dayLabel(start),
      // 맥스 먼데이는 첫날(월)에만 시간이 걸린다 — 한 주 내내가 아니라는 것을 요일로 밝힌다
      hours: from && to ? `${kind === 'monday' ? '월 ' : ''}${from}–${to}` : '',
      bosses: bossesOf(event, gmax, src),
      live: start <= nowMs,
      days,
    } });
  }
  return out.sort((left, right) => left.at - right.at).map((one) => one.slide);
}

/** 슬라이드 머리의 남은 날 표시 — '진행 중' · '오늘' · 'D-5' */
export function dday(slide: Pick<MaxSlide, 'live' | 'days'>): string {
  if (slide.live) return '진행 중';
  if (slide.days <= 0) return '오늘';
  return `D-${slide.days}`;
}
