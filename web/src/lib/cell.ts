// ─────────────────────────────────────────────────────────────────────────────
// lib/cell.ts — 화면에 값을 내보내는 단 하나의 관문
//
// 약속 하나 — **`NaN` · `undefined` · `null` 은 어떤 상태에서도 화면에 못 나간다.**
//
// 왜 관문이 필요한가. 표마다 줄 모양이 다르기 때문이다.
// D-MAX 만 해도 티어표는 `pct·atk·power`, 딜러는 `dmg·bulk`, 탱커는 `ehp·hp·def` 다.
// 탱커 줄이 딜러 문법을 타면 `NaN 맥스 피해 · 내구 undefined` 가 그대로 찍힌다(v4.2.4 제보).
// 줄 모양을 읽는 자리가 화면 곳곳에 흩어져 있으면 이런 어긋남을 사람이 다 볼 수 없다.
//
// 그래서 규칙은 둘이다:
//   1. 값을 글자로 바꾸는 일은 여기서만 한다 — 화면에서 `.toFixed()` 나 `${row.x}` 를 직접 쓰지 않는다
//   2. 값이 비면 대시를 찍는다 — 틀린 숫자를 지어내느니 빈 칸이 정직하다
// ─────────────────────────────────────────────────────────────────────────────

// 값이 없을 때 그 자리에 남는 글자. 사람이 "아직 없구나" 로 읽는 기호다.
export const DASH = '—';

// 숫자 칸. digits 를 주면 자릿수를 맞추고, 안 주면 있는 그대로 편다.
// 숫자가 아닌 것(undefined · null · NaN · Infinity · 빈 문자열)은 전부 대시로 접힌다.
//
// 2026-09-21 **공백뿐인 글자가 '0' 으로 찍히고 있었다.** `Number('   ')` 는 0 이라
// 빈 칸이 "값이 0 이다" 라는 거짓말로 나갔다 — 대시보다 나쁘다. 앞뒤 공백을 먼저 뗀다.
// 받는 것도 글자와 숫자로 좁힌다. `Number(true)` 는 1, `Number([5])` 는 5 라
// 뜻이 없는 값이 숫자 행세를 하던 자리다.
export function num(value: unknown, digits?: number): string {
  if (typeof value !== 'number' && typeof value !== 'string') return DASH;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') return DASH;
  const one = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(one)) return DASH;
  return digits === undefined ? String(one) : one.toFixed(digits);
}

// 글자 칸. 비어 있거나 공백뿐이면 대시로 접힌다.
//
// 2026-09-21 **이 관문이 새고 있었다.** 글자가 아닌 값을 `String()` 에 그대로 넘겨서,
// `word(NaN)` 은 'NaN' 을, `word({})` 는 '[object Object]' 를 화면으로 내보냈다 —
// LEAK 이 잡으라고 적어 둔 바로 그 글자들이다. 받는 것을 글자와 유한한 숫자로 좁힌다.
export function word(value: unknown): string {
  if (typeof value === 'string') return value.trim() || DASH;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : DASH;
  // 나머지(객체 · 불리언 · null · undefined)는 전부 대시. 지어낸 글자보다 빈 칸이 정직하다
  return DASH;
}

// 줄 목록. 빈 줄은 대시로 때우지 않고 **아예 걷어낸다** —
// 기술이 없는 탱커 줄에 `— 타입` 을 세우면 없는 정보를 있는 척하게 된다.
export function lines(...items: unknown[]): string[] {
  return items.filter((one): one is string => typeof one === 'string' && one.trim() !== '');
}

// 검사와 배포 확인이 같은 잣대를 쓰도록 여기서 한 번만 정의한다.
export const LEAK = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object Object\]/;

// 칸 묶음에서 새는 글자를 찾아 돌려준다. 깨끗하면 빈 문자열.
export function leak(cells: { score?: string; sub?: string; lines?: string[] }): string {
  const text = [cells.score, cells.sub, ...(cells.lines ?? [])].filter(Boolean).join(' | ');
  return LEAK.test(text) ? text : '';
}
