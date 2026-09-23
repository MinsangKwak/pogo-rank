// ─────────────────────────────────────────────────────────────────────────────
// lib/mon.ts — '무엇의 상세를 여는가'
//
// **줄이 들고 있던 이름을 그대로 넘긴다.** v3 의 openDetail(pokemon) 이 그랬다 —
// 순위표 줄은 '섀도우 갸라도스' · '거다이맥스 고릴타' 처럼 폼까지 붙은 이름을 이미 들고 있다.
// v4 는 한동안 스프라이트 id 만 넘기고 상세가 도감 이름표에서 되찾게 했는데,
// 폼 스프라이트(10000번대)는 그 표에 없어 '#10209' 라고 적혔다. 그 한 줄이 어긋나자
// 활용 순위가 비고(이름으로 찾는다), '보스로 만났을 때' 가 맥스 배틀이 아니라
// 일반 레이드 후보를 냈다(이름 앞의 '거다이맥스' 로 가른다) — 한 값이 세 곳을 무너뜨렸다.
//
// 이름이 없는 길은 하나뿐이다 — 공유 링크(#/mon/<id>). 그때만 v3 openDetailBySprite 처럼
// 검색 색인에서 찾는다.
// ─────────────────────────────────────────────────────────────────────────────
import type { DexData } from '../types/data';
import type { SearchEntry } from './search';

export interface MonRef { sprite: number; name: string; en: string; types: readonly string[] }

/** 상세를 열어 달라고 넘기는 것. 이름을 아는 쪽은 적어 주고, 모르는 쪽(공유 링크)은 스프라이트만 준다 */
export interface MonPick { sprite: number; name?: string; en?: string; types?: readonly string[] }

export type OpenMon = (mon: MonPick) => void;

/**
 * 스프라이트 id 만으로 '무엇인지' 를 알아낸다 (v3 openDetailBySprite).
 * 섀도우·다이맥스는 일반 폼과 스프라이트 id 가 같다 — 색인에서 먼저 만난 항목이 아니라
 * **그 접두어가 없는 항목을 우선한다.** 없으면(섀도우만 등재된 종) 첫 항목을 쓴다.
 */
export function monBySprite(index: readonly SearchEntry[], dex: DexData, sprite: number): MonRef | null {
  const hits = index.filter((one) => Number(one.sprite) === Number(sprite));
  const found = hits.find((one) => !/^(섀도우|다이맥스|거다이맥스) /.test(one.name)) ?? hits[0];
  if (found) return { sprite, name: found.name, en: found.en, types: found.types };
  const dexNo = dex.dex[String(sprite)] ?? (sprite < 10000 ? sprite : null);
  const base = dex.names[String(dexNo ?? sprite)];
  if (!base) return null;   // 모르는 번호면 조용히 넘긴다
  const label = dex.forms[String(sprite)]?.name ?? '';
  return { sprite, name: label ? `${label} ${base}` : base, en: '', types: dex.forms[String(sprite)]?.types ?? [] };
}

/** 넘겨받은 것을 상세가 쓸 모양으로. 빠진 칸만 색인·도감에서 채운다 */
export function resolveMon(pick: MonPick, index: readonly SearchEntry[], dex: DexData): MonRef {
  if (pick.name) return { sprite: pick.sprite, name: pick.name, en: pick.en ?? '', types: pick.types ?? [] };
  const found = monBySprite(index, dex, pick.sprite);
  if (!found) return { sprite: pick.sprite, name: `#${pick.sprite}`, en: pick.en ?? '', types: pick.types ?? [] };
  return { ...found, en: pick.en || found.en, types: pick.types?.length ? pick.types : found.types };
}
