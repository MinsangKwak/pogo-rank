// ─────────────────────────────────────────────────────────────────────────────
// datasweep — **실데이터 전량을 칸 함수에 넣어 본다.**
//
// rankcells 는 손으로 적은 한 줄씩을 본다. 그 줄이 진짜 데이터와 같은 모양이라는
// 보장이 없다 — v4.2.4 탱커 사고가 바로 그 틈이었다(표는 바뀌었는데 읽는 쪽이 안 바뀜).
// 여기서는 표의 **모든 키 · 모든 줄**을 돌린다. 빌드가 표 모양을 바꾸면 그 순간 빨개진다.
//
// 데이터는 빌드 산출물이라 저장소에 없다. 있는 쪽을 골라 쓴다:
//   frontend-v4/public/data/*.json  — 브라우저가 실제로 받는 꾸러미 (npm run data 뒤)
//   data/*.json                     — v3 빌드가 내놓는 원본 (CI 는 이 시점에 이것만 있다)
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { dmaxCells, pveCells, pvpCells } from '../screens/Ranks';
import { leak, DASH } from '../lib/cell';
import type { DmaxRow, PveRow, PvpRow } from '../types/data';

type Table = Record<string, Record<string, unknown>[]>;
const read = (path: string) => JSON.parse(readFileSync(path, 'utf-8'));

// 꾸러미 쪽을 먼저 본다 — 화면이 실제로 먹는 모양이라서다.
function fromBundle() {
  const dir = resolve(__dirname, '../../public/data');
  if (!existsSync(resolve(dir, 'max.json'))) return null;
  const max = read(resolve(dir, 'max.json'));
  const pve = read(resolve(dir, 'pve.json'));
  return {
    where: 'public/data',
    typeKo: read(resolve(dir, 'dex.json')).TYPE_KO as Record<string, string>,
    tier: max.DMAX_TIER as Table, dealer: max.DMAX_DATA as Table, tank: max.DMAX_TANK as Table,
    easy: pve.PVE_EASY as Table, byType: pve.PVE_BY_TYPE as Table, counters: pve.PVE_DATA as Table,
    pvp: read(resolve(dir, 'pvp.json')).PVP_DATA as Table,
  };
}

function fromRaw() {
  const dir = resolve(__dirname, '../../../data');
  if (!existsSync(resolve(dir, 'dynamax_tier.json'))) return null;
  const at = (name: string) => read(resolve(dir, `${name}.json`)) as Table;
  return {
    where: 'data',
    typeKo: {} as Record<string, string>,   // 원본에는 한글 표가 없다 — 없으면 영문 키로 떨어진다
    tier: at('dynamax_tier'), dealer: at('dynamax'), tank: at('dynamax_tank'),
    easy: at('pve_easy'), byType: at('pve_by_type'), counters: at('pve'),
    pvp: at('pvp'),
  };
}

const src = fromBundle() ?? fromRaw();

// 표 한 장을 통째로 돌려 **두 가지**를 본다.
//   1. 새는 글자 — `NaN` · `undefined` 가 그대로 찍힌 칸
//   2. 대시 — 관문이 접어 준 빈 칸. 이 표들은 빌드가 모든 칸을 채우므로
//      대시가 보이면 데이터가 빈 게 아니라 **읽는 쪽이 딴 키를 보고 있다는 뜻이다.**
//      관문을 세운 뒤로는 모양이 어긋나도 화면이 안 깨지고 조용히 비므로, 이쪽이 진짜 그물이다.
type Cells = { score?: string; sub?: string; lines?: string[] };
function sweep(table: Table, build: (key: string, row: Record<string, unknown>) => Cells) {
  const bad: string[] = [];
  for (const [key, rows] of Object.entries(table)) {
    for (const row of rows) {
      const cells = build(key, row);
      const text = [cells.score, cells.sub, ...(cells.lines ?? [])].filter(Boolean).join(' | ');
      const found = leak(cells) || (text.includes(DASH) ? text : '');
      if (found) bad.push(`${key} · ${String(row.name)} → ${found}`);
    }
  }
  return bad;
}

// **describe 의 몸통은 skipIf 여도 읽힌다.** vitest 는 검사를 모으려고 콜백을 한 번 돌리고,
// 건너뛰기는 그다음에 정한다 — 그래서 데이터가 없을 때 `src!.where` 를 제목에 쓰면
// 건너뛰는 대신 TypeError 로 죽었다(빌드를 안 돌린 새 작업 환경에서 바로 난다).
// 제목은 모으는 시점에 만들어지므로, 데이터가 없어도 읽히는 값만 쓴다.
describe.skipIf(!src)('실데이터 전량 — 어떤 줄도 NaN·undefined 를 흘리지 않는다', () => {
  const data = src!;

  it(`데이터를 찾았다 (${src?.where ?? '없음'})`, () => {
    expect(Object.keys(data.tier).length).toBeGreaterThan(0);
    expect(Object.keys(data.pvp).length).toBeGreaterThan(0);
  });

  it('D-MAX 티어표', () => {
    expect(sweep(data.tier, (key, row) => dmaxCells('all', key, row as unknown as DmaxRow, data.typeKo))).toEqual([]);
  });

  it('D-MAX 딜러', () => {
    expect(sweep(data.dealer, (key, row) => dmaxCells('dealer', key, row as unknown as DmaxRow, data.typeKo))).toEqual([]);
  });

  // 이 표가 딜러 문법을 타서 `NaN 맥스 피해 · 내구 undefined` 가 나왔다 (v4.2.4)
  it('D-MAX 탱커', () => {
    expect(sweep(data.tank, (key, row) => dmaxCells('tank', key, row as unknown as DmaxRow, data.typeKo))).toEqual([]);
  });

  it('레이드 일반', () => {
    expect(sweep(data.easy, (_key, row) => pveCells('easy', row as unknown as PveRow))).toEqual([]);
  });

  it('레이드 전체 (타입별)', () => {
    expect(sweep(data.byType, (_key, row) => pveCells('all', row as unknown as PveRow))).toEqual([]);
  });

  it('레이드 카운터 (상세의 활용처)', () => {
    expect(sweep(data.counters, (_key, row) => pveCells('all', row as unknown as PveRow))).toEqual([]);
  });

  it('배틀 — 전체 순위', () => {
    expect(sweep(data.pvp, (_key, row) => pvpCells('all', row as unknown as PvpRow))).toEqual([]);
  });

  // 속성 칩을 고르면 `전체 N위` 칸이 하나 더 붙는다 — 그 칸도 같이 본다
  it('배틀 — 속성 칩', () => {
    expect(sweep(data.pvp, (_key, row) => pvpCells('fire', row as unknown as PvpRow))).toEqual([]);
  });
});
