// ─────────────────────────────────────────────────────────────────────────────
// lib/deck.ts — PvP 덱 짜기의 셈 (v3 views/ifsolo.js 의 덱 부분 이식)
//
// 상성 계수 foeFit = (내 자속이 상대를 때리는 최대 배율) ÷ (상대 자속이 나를 때리는 최대 배율).
// 1보다 크면 '때리는 게 받는 것보다 세다'. 기술 구성이 아니라 타입만 보는 근사치라
// 자속(STAB)으로 찌른다고 가정한다.
//
// GO배틀리그 규칙상 **같은 종은 파티에 1마리만**(섀도우·일반도 같은 종)이라
// 모든 추천이 종 단위(speciesKey)로 중복을 제거한다.
// ─────────────────────────────────────────────────────────────────────────────
import { multAgainst } from './matchup';

export interface DeckMon {
  sprite: number;
  name: string;
  types: readonly string[];
}

export interface ScoredMon extends DeckMon {
  score: number;
}

type Chart = Record<string, Record<string, number>>;

/** 배율 표시용 반올림 (소수 둘째 자리까지, 불필요한 0 은 안 붙게) */
export function fmtMult(mult: number): string {
  return String(Math.round(mult * 100) / 100);
}

/**
 * 받침 유무에 따라 조사를 고른다 — josa('두드리짱','이','가') → '두드리짱이'.
 * 이유 문장을 자동으로 만들다 보면 '○○가/○○이' 가 어색해진다.
 * (한글 음절 0xAC00~0xD7A3 에서 (코드 − 0xAC00) % 28 이 종성 인덱스)
 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const code = word.charCodeAt(word.length - 1);
  const hasFinal = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 > 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

export function makeDeckTools(chart: Chart, typeKo: Record<string, string>, dexMap: Record<string, number>) {
  const typeKeys = Object.keys(typeKo);
  const ko = (type: string) => typeKo[type] ?? type;
  const against = (type: string, defTypes: readonly string[]) => multAgainst(chart, type, defTypes);

  /** 폼·섀도우가 달라도 같은 도감 번호면 같은 키 — 이 키로 걸러야 리그 규칙에 맞는 덱이 된다 */
  const speciesKey = (mon: DeckMon) => String(dexMap[String(mon.sprite)] ?? mon.sprite);

  const foeFit = (candidate: DeckMon, foe: DeckMon) => {
    const offense = Math.max(...(candidate.types.length ? candidate.types : ['normal']).map((type) => against(type, foe.types)));
    const defense = Math.max(...(foe.types.length ? foe.types : ['normal']).map((type) => against(type, candidate.types)));
    return offense / defense;
  };

  /** 타입 t 공격이 이 포켓몬에 들어가는 배율 */
  const defMultOn = (type: string, mon: DeckMon) => against(type, mon.types);
  /** 이 포켓몬이 아프게 받는(배율 > 1) 공격 타입 = 약점 */
  const weakOf = (mon: DeckMon) => typeKeys.filter((type) => defMultOn(type, mon) > 1);
  /** 덱에서 둘 이상이 같이 아픈 공격 타입 — 한 타입 기술에 덱 절반이 쓸려나가는 구성을 피하는 지표 */
  const sharedWeak = (deck: readonly DeckMon[]) => typeKeys.filter((type) => deck.filter((member) => defMultOn(type, member) > 1).length >= 2);

  /** 점수순 + 종 단위 중복 제거 상위 n */
  const topBySpecies = <T extends ScoredMon>(pool: readonly T[], limit: number): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const candidate of [...pool].sort((left, right) => right.score - left.score)) {
      if (seen.has(speciesKey(candidate))) continue;
      seen.add(speciesKey(candidate));
      out.push(candidate);
      if (out.length === limit) break;
    }
    return out;
  };

  /**
   * 정석 코어 — 1위에서 시작해 '점수 + 파트너 약점 반감 보너스 − 겹치는 약점 페널티' 그리디.
   * 세 컨셉 중 유일하게 이미 뽑은 멤버와의 궁합을 매 단계 다시 계산한다.
   * 보너스 2점 / 페널티 4점은 리그 점수(보통 80~100 스케일)에 맞춘 경험적 가중치다.
   */
  const buildBalanced = <T extends ScoredMon>(top: readonly T[]): T[] => {
    const first = top[0];
    if (!first) return [];
    const deck: T[] = [first];
    while (deck.length < 3) {
      let best: T | null = null;
      let bestVal = -Infinity;
      for (const candidate of top) {
        if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
        let cover = 0;
        for (const member of deck) {
          for (const weak of weakOf(member)) if (defMultOn(weak, candidate) < 1) cover += 1;
        }
        const val = candidate.score + cover * 2 - sharedWeak([...deck, candidate]).length * 4;
        if (val > bestVal) { bestVal = val; best = candidate; }
      }
      if (!best) break;
      deck.push(best);
    }
    return deck;
  };

  /**
   * 안티 메타 — 리그 상위 10마리 상대 평균 상성 × 점수 순.
   * 궁합은 안 보고 '지금 자주 만나는 얼굴들 전체에 평균적으로 강한지' 만 본다.
   */
  const buildAntiMeta = <T extends ScoredMon>(top: readonly T[], exclude: readonly DeckMon[]): T[] => {
    const meta = top.slice(0, 10);
    const deck: T[] = [];
    if (!meta.length) return deck;
    const ranked = top
      .filter((candidate) => !exclude.some((member) => speciesKey(member) === speciesKey(candidate)))
      .map((candidate) => ({ candidate, avg: meta.reduce((sum, foe) => sum + foeFit(candidate, foe), 0) / meta.length }))
      .sort((left, right) => right.avg * right.candidate.score - left.avg * left.candidate.score);
    for (const { candidate } of ranked) {
      if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
      deck.push(candidate);
      if (deck.length === 3) break;
    }
    return deck;
  };

  /**
   * 타입 분산 — 방어 타입이 하나도 안 겹치는 점수 상위 3마리.
   * 상대가 한 타입 기술로 셋을 다 뚫지 못하게 하는 게 목적이라 상성 계산은 아예 안 쓴다.
   */
  const buildSpread = <T extends ScoredMon>(top: readonly T[], exclude: readonly DeckMon[]): T[] => {
    const used = new Set<string>();
    const deck: T[] = [];
    for (const candidate of top) {
      if (exclude.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
      if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
      if (candidate.types.some((type) => used.has(type))) continue;
      deck.push(candidate);
      candidate.types.forEach((type) => used.add(type));
      if (deck.length === 3) break;
    }
    // 타입이 안 겹치는 조합만으로 3마리를 못 채웠으면 점수순으로 빈 자리를 메운다
    for (const candidate of top) {
      if (deck.length === 3) break;
      if ([...exclude, ...deck].some((member) => speciesKey(member) === speciesKey(candidate))) continue;
      deck.push(candidate);
    }
    return deck;
  };

  /** 추천 덱 이유 문장 — 서로 메워 주는 관계·겹치는 약점을 실제로 계산해 설명한다 */
  const recReason = (deck: readonly DeckMon[], intro: string): string => {
    const parts = [intro];
    const covers: string[] = [];
    for (const member of deck) {
      for (const weak of weakOf(member)) {
        const helper = deck.find((other) => other !== member && defMultOn(weak, other) < 1);
        if (helper) covers.push(`${member.name}의 ${ko(weak)} 약점은 ${josa(helper.name, '이', '가')} 반감으로 받아줌`);
      }
    }
    if (covers.length) parts.push([...new Set(covers)].slice(0, 3).join(', '));
    const shared = sharedWeak(deck);
    parts.push(shared.length
      ? `⚠️ 둘 이상 같이 아픈 타입: ${shared.map(ko).join('·')} — 이 타입 상대가 나오면 조심`
      : '둘 이상 같이 아픈 타입이 없어 한 상성에 쓸리지 않음');
    return `${parts.join('. ')}.`;
  };

  /** 왜 카운터인지 한 줄 — 무슨 자속으로 찌르고, 상대 자속을 어떻게 받는지 */
  const counterWhy = (candidate: DeckMon, foe: DeckMon): string => {
    const foeKo = foe.types.map(ko).join('·');
    const offense = candidate.types.map((type) => [type, against(type, foe.types)] as const)
      .sort((left, right) => right[1] - left[1])[0] ?? ['normal', 1] as const;
    const incoming = foe.types.map((type) => [type, against(type, candidate.types)] as const)
      .sort((left, right) => right[1] - left[1])[0] ?? ['normal', 1] as const;
    const offenseText = offense[1] > 1
      ? `${foeKo} 타입은 ${josa(ko(offense[0]), '이', '가')} 약점 → ${ko(offense[0])} 자속 ×${fmtMult(offense[1])}`
      : offense[1] === 1 ? `${ko(offense[0])} 자속은 동등(×1)`
        : `자속(${ko(offense[0])})은 ×${fmtMult(offense[1])}로 반감되지만`;
    const incomingText = incoming[1] < 1
      ? `받는 ${ko(incoming[0])} 공격은 ×${fmtMult(incoming[1])} 반감`
      : incoming[1] === 1 ? '받는 공격은 ×1'
        : `단 ${ko(incoming[0])} 공격은 ×${fmtMult(incoming[1])}로 아프게 받음`;
    return `${offenseText} · ${incomingText}`;
  };

  /** 상대를 가장 아프게 때리는 공격 타입 (분석 카드의 보완 추천용) */
  const topAtkType = (foe: DeckMon): string => {
    const best = [...typeKeys].sort((left, right) => against(right, foe.types) - against(left, foe.types))[0];
    return best ? ko(best) : '';
  };

  return { ko, against, speciesKey, foeFit, defMultOn, weakOf, sharedWeak, topBySpecies, buildBalanced, buildAntiMeta, buildSpread, recReason, counterWhy, topAtkType, typeKeys };
}

export type DeckTools = ReturnType<typeof makeDeckTools>;
