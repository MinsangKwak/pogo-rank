// ─────────────────────────────────────────────────────────────────────────────
// components/WeekBosses.tsx — 홈 '이번 주 보스' 카드 줄 (2026-10-13)
//
// 배너 바로 아래. 카드 하나가 보스 · 기간 · 추천 세 마리 · 상세 단추를 든다 — 레이드 보스 화면과 일정 화면에
// 흩어져 있던 '지금 무엇이 나오나' 와, 솔플 계산기 · 덱 짜기 안쪽에 있던 '무엇으로 잡나' 를 한 자리에 모은다
// (10월 통계: 사람들이 가장 많이 연 상세가 보스 자신이었다 — lib/bossBoard.ts 머리말).
//
// 보스를 누르면 그 보스의 상세(맨 위 '상대할 때' 카드)가, 추천을 누르면 그 포켓몬의 상세가 열린다.
// 줄이 없으면 아무것도 안 그린다. 추천 묶음(pve · pvp · max)이 오기 전에는 보스만 세우고 추천 줄은 비워 둔다 —
// 홈은 데이터 Suspense 밖이라 기다리지 않는다. 숫자는 lib/cell.ts 로만 적는다 (여기는 숫자가 없다)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { SPRITE_BASE } from '../lib/base';
import { BOARD_KIND_KO, BOARD_MAX, cardDday, type BossCard } from '../lib/bossBoard';
import { countersOf, useBossBoard, useCounterSource } from '../lib/useBossBoard';
import { useDexSoft } from '../lib/data';
import { track } from '../lib/track';
import type { OpenMon } from '../lib/mon';
import type { CounterSource } from '../lib/bossCounters';

/** 카드 한 장의 추천 수 — 팝업 '상대할 때' 와 같은 세 마리 (components/detail/VsCard.tsx VS_RECS) */
export const WEEK_RECS = 3;

/** '다이맥스 거대코뿌리' → 폼 '다이맥스' · 이름 '거대코뿌리' — 칩이 좁아 폼은 윗줄 작은 글자로, 이름은 아랫줄로 (MonDetail splitName 과 같은 규칙) */
export function splitForm(name: string, labels: readonly string[]): { form: string; base: string } {
  const found: string[] = [];
  let base = name;
  for (let again = true; again;) {
    again = false;
    for (const label of labels) {
      if (base.startsWith(`${label} `)) { found.push(label); base = base.slice(label.length + 1); again = true; break; }
    }
  }
  return { form: found.join(' '), base };
}

function Card({ card, src, labels, onOpen }: { card: BossCard; src: CounterSource | null; labels: readonly string[]; onOpen: OpenMon }) {
  const counters = countersOf(src, card.battle, card.types, WEEK_RECS);
  return (
    <li className={`week-bosses__card${card.live ? ' is-live' : ''} week-bosses__card--${card.kind}`} data-boss={card.detailName}>
      <button type="button" className="week-bosses__boss"
        onClick={() => { track('week_boss_open', { boss: card.detailName, kind: card.kind }); onOpen({ sprite: card.sprite, name: card.detailName, types: card.types, boss: card.kind }); }}>
        <span className="week-bosses__tags">
          <span className={`week-bosses__dday${card.live ? ' is-live' : ''}`}>{cardDday(card)}</span>
          <span className="week-bosses__kind">{BOARD_KIND_KO[card.kind]}</span>
        </span>
        <img className="week-bosses__sprite" src={`${SPRITE_BASE}${card.sprite}.png`} alt="" width="72" height="72" loading="lazy" decoding="async" />
        {card.form ? <span className="week-bosses__form">{card.form}</span> : null}
        <b className="week-bosses__name">{card.name}</b>
        <span className="week-bosses__when">{[card.short, card.hours].filter(Boolean).join(' · ')}</span>
      </button>
      {counters ? (
        <div className="week-bosses__vs">
          <span className="week-bosses__vs-label">추천</span>
          {counters.rows.map((row) => {
            const { form, base } = splitForm(row.name, labels);
            return (
              <button key={row.sprite} type="button" className="week-bosses__rec" title={row.name}
                onClick={() => { track('week_boss_rec', { boss: card.detailName, mon: row.name }); onOpen({ sprite: row.sprite, name: row.name, en: row.en, types: row.types }); }}>
                <img className="week-bosses__rec-sprite" src={`${SPRITE_BASE}${row.sprite}.png`} alt="" width="32" height="32" loading="lazy" decoding="async" />
                {form ? <span className="week-bosses__rec-form">{form}</span> : null}
                <span className="week-bosses__rec-name">{base}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

export default function WeekBosses({ onOpen }: { onOpen: OpenMon }) {
  const { board } = useBossBoard();
  const src = useCounterSource();
  const labels = useDexSoft()?.FORM_LABELS ?? [];
  if (!board.length) return null;
  return (
    <section className="week-bosses" aria-label="이번 주 보스">
      <div className="week-bosses__head">
        <h3 className="week-bosses__title">이번 주 보스</h3>
        <span className="week-bosses__sub">진행 중이거나 7일 안에 시작하는 맥스 배틀 · 레이드 보스와 추천 포켓몬</span>
      </div>
      <ul className="week-bosses__list">
        {/* 여섯 장까지 — 자르는 것은 여기뿐이다. 판 자체는 다 들고 있어야 팝업 · 이유가 일곱 번째 보스도 안다 (Codex, PR #361) */}
        {board.slice(0, BOARD_MAX).map((card) => <Card key={card.id} card={card} src={src} labels={labels} onOpen={onOpen} />)}
      </ul>
    </section>
  );
}
