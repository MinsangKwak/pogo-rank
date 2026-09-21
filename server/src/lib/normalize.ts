// ─────────────────────────────────────────────────────────────────────────────
// lib/normalize.ts — 받은 몸통을 표에 들어갈 줄로 바꾼다. **순수 함수다.**
//
// 왜 갈라 뒀나 — 여기가 틀리면 DB 에 쓰레기가 남는데, HTTP 를 띄우고 DB 를 붙여야만
// 확인할 수 있으면 아무도 안 본다. 갈라 두면 검사가 한 줄이다 (프런트의 lib/cell.ts 와 같은 판단).
//
// 스키마(contract.ts)가 모양을 막고, 여기가 **뜻**을 막는다 —
// 모양은 맞지만 뜻이 없는 줄(term 없는 search)은 저장하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { CollectBody } from './contract.ts';

export interface EventRow {
  name: string;
  visitor: string;
  term: string | null;
  surface: string | null;
  country: string;
  channel: 'prod' | 'dev';
  occurred_at: Date | null;
}

/** 브라우저 시계는 틀어져 있을 수 있다. 이만큼 벗어난 시각은 안 믿고 버린다 (줄은 살린다) */
const TS_SLACK_MS = 7 * 24 * 60 * 60 * 1000;

function cleanText(value: string | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  // 줄바꿈·연속 공백을 한 칸으로 — '뮤츠' 와 '뮤츠 ' 가 다른 말로 세어지면 순위가 갈라진다
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return text ? text : null;
}

function occurredAt(raw: string | undefined, now: Date): Date | null {
  if (!raw) return null;
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return null;
  return Math.abs(when.getTime() - now.getTime()) > TS_SLACK_MS ? null : when;
}

export function toRows(body: CollectBody, country: string, now: Date = new Date()): EventRow[] {
  const visitor = body.visitor.trim();
  const channel = body.channel === 'dev' ? 'dev' : 'prod';
  const rows: EventRow[] = [];
  for (const one of body.events) {
    const term = cleanText(one.term, 100);
    // 검색어 없는 search 는 셀 것이 없다 — 표에 두면 '무엇을 찾았는지 모르는 검색' 이 쌓인다
    if (one.name === 'search' && !term) continue;
    rows.push({
      name: one.name,
      visitor,
      term,
      surface: cleanText(one.surface, 40),
      country,
      channel,
      occurred_at: occurredAt(one.ts, now),
    });
  }
  return rows;
}
