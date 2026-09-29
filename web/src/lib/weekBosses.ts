// ─────────────────────────────────────────────────────────────────────────────
// lib/weekBosses.ts — "지금 찾을 만한 보스" 몇 마리 (2026-09-28)
//
// 검색 팔레트가 빈 칸일 때, 홈의 검색 칩이 무엇을 내밀지 정하는 자리다. 홈 배너가 굴리는 맥스 일정
// (lib/maxSlides.ts)에서 **진행 중인 장, 없으면 가장 가까운 장**의 보스를 꺼낸다 — 사람들이 이번 주에 찾는 이름은 그것이다.
// 이름으로 겹치는 것은 하나만, 넉 마리까지 — 칩 한 줄이다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useMemo, useState } from 'react';
import { useDexSoft, useGamedaySoft, useMaxSoft, useScheduleSoft } from './data';
import { maxSlides, weeksFromSchedule, type MaxBoss, type MaxSlide } from './maxSlides';

export const WEEK_BOSS_MAX = 4;

/** 칩 하나 — 보이는 이름(name)과 상세를 열 이름(detailName)이 다르다 */
export interface WeekBoss extends MaxBoss {
  /**
   * '다이맥스 울머기' · '거다이맥스 리자몽' — 상세(MonDetail)는 이름 앞의 접두어로 맥스 배틀을 가른다(bossKind).
   * 기본 종 이름으로 열면 일반 레이드 길로 가서 맥스 전용이 아닌 딜러를 추천한다 (Codex, PR #224)
   */
  detailName: string;
}

/** 진행 중인 장, 없으면 첫 장(가장 가까운 장)의 보스. 이름이 같으면 하나만 */
export function weekBosses(slides: readonly MaxSlide[], max = WEEK_BOSS_MAX): { label: string; bosses: WeekBoss[] } {
  const slide = slides.find((one) => one.live) ?? slides[0];
  if (!slide) return { label: '', bosses: [] };
  const prefix = slide.gmax ? '거다이맥스' : '다이맥스';
  const seen = new Set<string>();
  const bosses = slide.bosses.filter((boss) => {
    if (!boss.name || seen.has(boss.name)) return false;
    seen.add(boss.name);
    return true;
  }).slice(0, max).map((boss) => ({ ...boss, detailName: `${prefix} ${boss.name}` }));
  return { label: slide.live ? '이번 주 보스' : `${slide.short} 보스`, bosses };
}

/** 채움 칩 하나 — 홈 '많이 본 포켓몬' 의 빈 자리를 메우는 맥스 보스 (2026-09-29 주인 결정: 검색이 늘어야 한다) */
export interface FillBoss extends WeekBoss { gmax: boolean }

/**
 * 남은 자리(need)를 앞으로 남은 맥스 일정의 보스로 채운다 — 진행 중인 장부터 가까운 순, 같은 종은 한 번, 순위에 이미 선 번호는 뺀다.
 * 상세는 detailName(다이맥스 · 거다이맥스 접두어)으로 열어 맥스 전용 추천이 나오게 한다 (weekBosses 와 같은 이유)
 */
export function fillBosses(slides: readonly MaxSlide[], need: number, exclude: ReadonlySet<number> = new Set()): FillBoss[] {
  if (need <= 0) return [];
  const seen = new Set<number>(exclude);
  const out: FillBoss[] = [];
  for (const slide of slides) {
    const prefix = slide.gmax ? '거다이맥스' : '다이맥스';
    for (const boss of slide.bosses) {
      if (!boss.name || seen.has(boss.dex)) continue;
      seen.add(boss.dex);
      out.push({ ...boss, detailName: `${prefix} ${boss.name}`, gmax: slide.gmax });
      if (out.length >= need) return out;
    }
  }
  return out;
}

/** 남은 맥스 일정 — 홈 배너 · 보스 칩 · 채움 칩이 같은 장을 본다 */
export function useMaxSlidesSoft(): MaxSlide[] {
  // '지금' 은 처음 그릴 때 한 번 — 그릴 때마다 새로 재면 useMemo 가 매번 다시 돈다
  const [nowMs] = useState(() => Date.now());
  const dex = useDexSoft();
  const gameday = useGamedaySoft();
  const max = useMaxSoft();
  const schedule = useScheduleSoft();
  return useMemo(() => maxSlides({
    events: gameday?.GAMEDAY.events,
    names: dex?.DEX_DATA.names,
    en: dex?.DEX_DATA.en,
    forms: dex?.DEX_DATA.forms,
    maxRows: max?.DMAX_DATA['overall'],
    weeks: weeksFromSchedule(schedule?.SCHEDULE_MONTHS),
  }, nowMs), [dex, gameday, max, schedule, nowMs]);
}

/** 홈과 팔레트가 같은 계산을 쓴다 — 두 곳의 칩이 다르면 어느 쪽이 맞는지 알 수 없다 */
export function useWeekBosses(): { label: string; bosses: WeekBoss[] } {
  const slides = useMaxSlidesSoft();
  return useMemo(() => weekBosses(slides), [slides]);
}
