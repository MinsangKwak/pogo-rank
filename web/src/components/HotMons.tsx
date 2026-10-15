// ─────────────────────────────────────────────────────────────────────────────
// components/HotMons.tsx — 홈 상단 '이번 주 많이 본 포켓몬' 띠 (2026-09-29)
//
// 사람들이 상세를 연 포켓몬을 본 사람 수 순으로 한 줄에 세운다 (lib/hotMons.ts). 누르면 그 상세가 뜬다.
// 줄이 없으면 아무것도 안 그린다 — 빈 순위표는 서비스가 한산해 보인다. 숫자는 lib/cell.ts 로만 적는다.
// 본 사람 수는 당분간 안 적는다(2026-09-29 주인 결정) — 초기엔 '1명' 이 줄줄이 서서 순위가 아니라 한산함이 보인다.
// 열 자리가 남으면 맥스 보스 칩(D-MAX · G-MAX 표)으로 채운다 — 누르면 맥스 상세가 열리고 검색으로 센다(surface hot_fill).
// 어느 폭이든 열 자리까지, 가로로 넘겨 본다 — 폭을 채우려고 같은 줄을 이어 붙였다가 완성도가 떨어져 보여 걷었다 (2026-09-29 주인 결정)
// 줄마다 이유 한 마디('거다이맥스 보스' · '커뮤니티 데이 · D-3')를 붙인다 — 처음 온 사람도 왜 이 목록인지 알고 누른다 (2026-10-13 통계 개편).
// 이유가 없는 줄은 빈 채로 둔다 — 지어내지 않는다
// ─────────────────────────────────────────────────────────────────────────────
import { BASE } from '../lib/base';
import { count } from '../lib/cell';
import { track, trackSearchPick } from '../lib/track';
import { useHotMons } from '../lib/hotMons';
import { reasonFor } from '../lib/bossBoard';
import { useBossBoard } from '../lib/useBossBoard';
import { useGamedaySoft } from '../lib/data';
import type { OpenMon } from '../lib/mon';

export default function HotMons({ onOpen }: { onOpen: OpenMon }) {
  const { rows, caption, fill } = useHotMons();
  const { board, nowMs } = useBossBoard();
  const gameday = useGamedaySoft();
  if (!rows.length && !fill.length) return null;
  const whyOf = (dex: number) => reasonFor(board, gameday?.GAMEDAY.events, dex, nowMs);
  // 부제는 lib/hotMons.ts 가 정한다 — 순위가 하나도 없으면 보스 얘기, 있으면 '총 수집기간 7일 · 화면 표시 최근 1시간' 처럼 어느 창인지
  return (
    <section className="hot-mons" aria-label="지금 많이 보는 포켓몬">
      <div className="hot-mons__head">
        <h3 className="hot-mons__title">지금 많이 보는 포켓몬</h3>
        <span className="hot-mons__sub">{caption}</span>
      </div>
      <ol className="hot-mons__list">
        {rows.map((row, index) => (
          <li key={row.dex} className="hot-mons__item">
            <button type="button" className="hot-mons__btn"
              onClick={() => { track('hot_mon_open', { sprite: row.dex, rank: index + 1 }); onOpen({ sprite: row.dex, name: row.name, types: row.types, via: 'dex' }); }}>
              <span className="hot-mons__rank" aria-hidden="true">{count(index + 1)}</span>
              <img className="hot-mons__sprite" src={`${BASE}sprites/${row.dex}.png`} alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span className="hot-mons__text">
                <span className="hot-mons__name">{row.name}</span>
                {whyOf(row.dex) ? <span className="hot-mons__why">{whyOf(row.dex)}</span> : null}
              </span>
            </button>
          </li>
        ))}
        {fill.map((boss) => (
          <li key={`fill-${boss.dex}`} className="hot-mons__item">
            <button type="button" className="hot-mons__btn hot-mons__btn--fill"
              onClick={() => { trackSearchPick(boss.name, 'hot_fill'); onOpen({ sprite: boss.sprite, name: boss.detailName, types: boss.types, via: 'dex' }); }}>
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
