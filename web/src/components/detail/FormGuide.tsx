// ─────────────────────────────────────────────────────────────────────────────
// components/detail/FormGuide.tsx — 요약 맨 위 '폼별 쓰임새' 카드 (2026-09-30)
//
// 한 종의 일반 · 다이맥스 · 거다이맥스를 한 번에 보여 주고, 줄을 누르면 **같은 창에서** 그 폼으로 바뀐다.
// 폼을 바꾸면 '보스로 만났을 때' 도 따라 바뀐다 — 맥스 폼이면 맥스 배틀 후보(다이맥스만 참전), 일반이면 레이드 후보.
// 곁들이는 두 줄:
//   · 이 계열이 보스로 서는 맥스 일정 — 지금 잡을 수 있는지가 입수 난이도보다 먼저 궁금한 것이다
//   · 진화 계열에서 순위가 더 높은 폼 — 울머기를 찾은 사람이 실제로 키울 것은 거다이맥스 인텔리레온이다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useMemo } from 'react';
import { useDex, useMax, useUsage } from '../../lib/data';
import { dday } from '../../lib/maxSlides';
import { useMaxSlidesSoft } from '../../lib/weekBosses';
import { bossNow, evoBest, formKeyOf, formRows, FORM_KO, maxIndex, placeLine } from '../../lib/formGuide';
import type { MonRef } from '../../lib/mon';

export default function FormGuide({ mon, dexNo, onSwitch }: {
  mon: MonRef; dexNo: number | null; onSwitch: (next: MonRef) => void;
}) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: usage } = useUsage();
  const slides = useMaxSlidesSoft();
  const index = useMemo(() => maxIndex(max), [max]);

  const places = usage.USAGE_PLACES;
  const rows = formRows({ ...mon, dexNo }, index, places, dex.TYPE_KO);
  const family = dexNo != null ? dex.DEX_DATA.evo[String(dexNo)] : undefined;
  const best = evoBest(family, dex.DEX_DATA.names, mon.name, index, places, dex.TYPE_KO, dex.DEX_DATA.forms);
  const line = new Set<number>(family?.flat() ?? (dexNo != null ? [dexNo] : []));
  const boss = bossNow(slides, line);
  if (!rows.length && !best && !boss) return null;

  const now = formKeyOf(mon.name);
  const toMon = (one: { name: string; sprite: number; en: string; types: readonly string[] }): MonRef =>
    ({ sprite: one.sprite, name: one.name, en: one.en, types: one.types });

  return (
    <section className="detail__card detail__formguide">
      <h3>폼별 쓰임새</h3>
      {rows.length ? (
        <div className="detail__formrows">
          {rows.map((row) => {
            const on = row.key === now;
            return (
              <button key={row.key} type="button" className={`detail__formrow${on ? ' is-now' : ''}`}
                aria-current={on ? 'true' : undefined} disabled={on}
                onClick={() => onSwitch(toMon(row))}>
                <span className={`form-tag${row.key === 'base' ? '' : ' form-tag--max'}`}>{FORM_KO[row.key]}</span>
                <span className="detail__formrow-use">{placeLine(row.places)}</span>
                {row.unrel ? <span className="tag">미출시</span> : null}
                <span className="detail__formrow-go" aria-hidden="true">{on ? '보는 중' : '›'}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {boss ? (
        <p className="detail__formguide-boss">
          <span className="tag">{dday(boss.slide)}</span>
          <span>{`맥스 배틀 · ${boss.name}${boss.dex !== dexNo ? ' (같은 진화 계열)' : ''} · ${boss.slide.short}`}</span>
        </p>
      ) : null}
      {best ? (
        <button type="button" className="detail__formguide-evo" onClick={() => onSwitch(toMon(best))}>
          <span className="detail__formguide-evo-label">진화 계열 추천</span>
          <b>{best.name}</b>
          <span>{`${best.place.label} ${best.place.rank}위`}</span>
          <span className="detail__formrow-go" aria-hidden="true">›</span>
        </button>
      ) : null}
      {rows.length ? (
        <p className="detail__foot">
          맥스 개체는 레이드·트레이너 배틀에도 쓸 수 있어요 — 얻을 기회가 드문 맥스 개체부터 키우고, PvP용은 공격 개체값이 낮은 일반 개체를 따로 준비하세요.
        </p>
      ) : null}
    </section>
  );
}
