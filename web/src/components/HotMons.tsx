// ─────────────────────────────────────────────────────────────────────────────
// components/HotMons.tsx — 홈 상단 '이번 주 많이 본 포켓몬' 띠 (2026-09-29)
//
// 사람들이 상세를 연 포켓몬을 본 사람 수 순으로 한 줄에 세운다 (lib/hotMons.ts). 누르면 그 상세가 뜬다.
// 줄이 없으면 아무것도 안 그린다 — 빈 순위표는 서비스가 한산해 보인다. 숫자는 lib/cell.ts 로만 적는다.
// 본 사람 수는 당분간 안 적는다(2026-09-29 주인 결정) — 초기엔 '1명' 이 줄줄이 서서 순위가 아니라 한산함이 보인다.
// 열 자리가 남으면 맥스 보스 칩(D-MAX · G-MAX 표)으로 채운다 — 누르면 맥스 상세가 열리고 검색으로 센다(surface hot_fill).
// 넓은 화면은 한 바퀴가 칸보다 좁으면 같은 바퀴를 이어 붙여 폭을 채운다(뒤 바퀴는 보조기기에서 숨긴다). 한 바퀴가 더 넓으면 가로로 넘긴다
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { BASE } from '../lib/base';
import { count } from '../lib/cell';
import { track, trackSearchPick } from '../lib/track';
import { useHotMons, passesToFill, HOT_MON_MAX, HOT_MON_WIDE_FILL } from '../lib/hotMons';
import type { OpenMon } from '../lib/mon';

// 넓은 화면(shell.css 의 1000px 경계)은 한 줄이 폭을 다 채워야 한다 — 열 자리 뒤에도 보스를 붙이고, 그래도 모자라면 같은 줄을 이어 붙인다.
// 좁은 화면은 열 자리까지, 가로로 넘겨 본다 (2026-09-29 주인 결정)
const WIDE = '(min-width: 1000px)';

/** 첫 그림은 서버 그림과 같아야 한다(하이드레이션) — 붙은 뒤에 폭을 본다 */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return wide;
}

export default function HotMons({ onOpen }: { onOpen: OpenMon }) {
  const wide = useWide();
  const { rows, window, allTime, fill } = useHotMons(wide ? HOT_MON_WIDE_FILL : HOT_MON_MAX);
  const list = useRef<HTMLOListElement>(null);
  const [passes, setPasses] = useState(1);
  const [overflow, setOverflow] = useState(false);
  const total = rows.length + fill.length;
  // 첫 바퀴의 폭(첫 칩 왼끝 → 마지막 칩 오른끝)과 칸의 폭을 대어 바퀴 수를 정한다 — 칸이 늘어나면(창 크기) 다시 잰다
  useEffect(() => {
    const node = list.current;
    if (!node || !wide || !total) { setPasses(1); setOverflow(false); return undefined; }
    const measure = () => {
      const items = node.querySelectorAll<HTMLElement>('.hot-mons__item');
      const first = items[0];
      const last = items[total - 1];
      if (!first || !last) return;
      const pass = last.offsetLeft + last.offsetWidth - first.offsetLeft;
      setPasses(passesToFill(node.clientWidth, pass));
      setOverflow(pass >= node.clientWidth);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, [wide, total]);
  if (!total) return null;
  // 순위가 하나도 없으면 부제는 보스 얘기다 — '최근 7일' 이라 적고 보스만 서면 거짓말이 된다
  const sub = !rows.length ? '이번 시즌 맥스 배틀 보스' : allTime ? '누적' : `최근 ${count(window)}일`;
  return (
    <section className="hot-mons" aria-label="이번 주 많이 본 포켓몬">
      <div className="hot-mons__head">
        <h3 className="hot-mons__title">이번 주 많이 본 포켓몬</h3>
        <span className="hot-mons__sub">{sub}</span>
      </div>
      <ol className="hot-mons__list" ref={list} {...(overflow ? { 'data-overflow': '' } : {})}>
        {Array.from({ length: passes }, (_, pass) => {
          // 뒤 바퀴는 같은 칩의 복제 — 눈에는 이어지지만 보조기기 · 탭 순서에서는 뺀다
          const clone = pass > 0;
          const extra = clone ? { 'aria-hidden': true as const } : {};
          const tab = clone ? { tabIndex: -1 } : {};
          return [
            ...rows.map((row, index) => (
              <li key={`${pass}-${row.dex}`} className="hot-mons__item" {...extra}>
                <button type="button" className="hot-mons__btn" {...tab}
                  onClick={() => { track('hot_mon_open', { sprite: row.dex, rank: index + 1 }); onOpen({ sprite: row.dex, name: row.name, types: row.types }); }}>
                  <span className="hot-mons__rank" aria-hidden="true">{count(index + 1)}</span>
                  <img className="hot-mons__sprite" src={`${BASE}sprites/${row.dex}.png`} alt="" width="40" height="40" loading="lazy" decoding="async" />
                  <span className="hot-mons__name">{row.name}</span>
                </button>
              </li>
            )),
            ...fill.map((boss) => (
              <li key={`${pass}-fill-${boss.dex}`} className="hot-mons__item" {...extra}>
                <button type="button" className="hot-mons__btn hot-mons__btn--fill" {...tab}
                  onClick={() => { trackSearchPick(boss.name, 'hot_fill'); onOpen({ sprite: boss.sprite, name: boss.detailName, types: boss.types }); }}>
                  <span className="hot-mons__tag" aria-hidden="true">{boss.gmax ? 'G-MAX' : 'D-MAX'}</span>
                  <img className="hot-mons__sprite" src={`${BASE}sprites/${boss.sprite}.png`} alt="" width="40" height="40" loading="lazy" decoding="async" />
                  <span className="hot-mons__name">{boss.name}</span>
                </button>
              </li>
            )),
          ];
        })}
      </ol>
    </section>
  );
}
