// ─────────────────────────────────────────────────────────────────────────────
// components/HotMons.tsx — 홈 상단 '이번 주 많이 본 포켓몬' 띠 (2026-09-29)
//
// 사람들이 상세를 연 포켓몬을 본 사람 수 순으로 한 줄에 세운다 (lib/hotMons.ts). 누르면 그 상세가 뜬다.
// 줄이 없으면 아무것도 안 그린다 — 빈 순위표는 서비스가 한산해 보인다. 숫자는 lib/cell.ts 로만 적는다.
// 본 사람 수는 당분간 안 적는다(2026-09-29 주인 결정) — 초기엔 '1명' 이 줄줄이 서서 순위가 아니라 한산함이 보인다.
// 열 자리가 남으면 맥스 보스 칩(D-MAX · G-MAX 표)으로 채운다 — 누르면 맥스 상세가 열리고 검색으로 센다(surface hot_fill)
// ─────────────────────────────────────────────────────────────────────────────
import { BASE } from '../lib/base';
import { count } from '../lib/cell';
import { track, trackSearchPick } from '../lib/track';
import { useHotMons } from '../lib/hotMons';
import type { OpenMon } from '../lib/mon';

export default function HotMons({ onOpen }: { onOpen: OpenMon }) {
  const { rows, window, allTime, fill } = useHotMons();
  if (!rows.length && !fill.length) return null;
  // 순위가 하나도 없으면 부제는 보스 얘기다 — '최근 7일' 이라 적고 보스만 서면 거짓말이 된다
  const sub = !rows.length ? '이번 시즌 맥스 배틀 보스' : allTime ? '누적' : `최근 ${count(window)}일`;
  return (
    <section className="hot-mons" aria-label="이번 주 많이 본 포켓몬">
      <div className="hot-mons__head">
        <h3 className="hot-mons__title">이번 주 많이 본 포켓몬</h3>
        <span className="hot-mons__sub">{sub}</span>
      </div>
      <ol className="hot-mons__list">
        {rows.map((row, index) => (
          <li key={row.dex} className="hot-mons__item">
            <button type="button" className="hot-mons__btn"
              onClick={() => { track('hot_mon_open', { sprite: row.dex, rank: index + 1 }); onOpen({ sprite: row.dex, name: row.name, types: row.types }); }}>
              <span className="hot-mons__rank" aria-hidden="true">{count(index + 1)}</span>
              <img className="hot-mons__sprite" src={`${BASE}sprites/${row.dex}.png`} alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span className="hot-mons__name">{row.name}</span>
            </button>
          </li>
        ))}
        {fill.map((boss) => (
          <li key={`fill-${boss.dex}`} className="hot-mons__item">
            <button type="button" className="hot-mons__btn hot-mons__btn--fill"
              onClick={() => { trackSearchPick(boss.name, 'hot_fill'); onOpen({ sprite: boss.sprite, name: boss.detailName, types: boss.types }); }}>
              <span className="hot-mons__tag" aria-hidden="true">{boss.gmax ? 'G-MAX' : 'D-MAX'}</span>
              <img className="hot-mons__sprite" src={`${BASE}sprites/${boss.sprite}.png`} alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span className="hot-mons__name">{boss.name}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
