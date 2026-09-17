// ─────────────────────────────────────────────────────────────────────────────
// screens/Gameday.tsx — 레이드 보스 · 알 부화 · 이벤트 일정
//
// 세 화면 다 gameday.json 한 묶음을 본다. **한 번 받으면 셋이 같이 열린다** —
// v3 는 이 표가 data-lazy.js 에 있어 화면마다 지연 번들 도착을 기다렸다.
// react-query 캐시가 그 기다림을 한 번으로 줄인다.
//
// **레이드·알 줄은 순위표 줄이 아니다.** 처음에 <Row> 를 억지로 썼더니 v3 와 다른 모양이 나왔다.
// v3 gameday.js 는 도감 카드(.dex__row)를 쓴다 — 순위가 없고 그림이 주인공인 목록이라서다:
//
//   <section class="gameday__sec">
//     <h2 class="page__sec">5성 레이드<span class="meta"> 2종</span></h2>
//     <div class="dex__list is-grid">
//       <button class="dex__row gameday__row">
//         <img class="sprite">
//         <div class="gameday__main">
//           <b><span class="form-tag">마이티폼</span><b>자시안</b></b>
//           <span class="meta gameday__note">페어리 · CP 2100–2188 · 흐림 부스트 · ✨</span>
//         </div>
//       </button>
//
// 보조줄은 **한 문자열**이다 (타입 · CP · 날씨 · ✨ 를 가운뎃점으로 이어 붙인다).
// ─────────────────────────────────────────────────────────────────────────────
import { useGameday, useDex } from '../lib/data';
import { Sprite, ViewToggle } from '../components/Bits';
import { Slot } from '../components/Slots';
import { NameNode } from '../components/Row';
import { usePrefStore, readCols } from '../stores/pref';
import type { GamedayMon } from '../types/data';

function MonCard({ mon, onOpen }: { mon: GamedayMon; onOpen: (sprite: number, en?: string) => void }) {
  const { data } = useDex();
  // v3 와 같은 순서·같은 구분자 — 없는 조각은 넣지 않는다
  const note = [
    mon.types?.map((type) => data.TYPE_KO[type] ?? type).join('·'),
    `CP ${mon.cp.min}–${mon.cp.max}`,
    mon.weather?.length ? `${mon.weather.join('·')} 부스트` : '',
    mon.shiny ? '✨' : '',
  ].filter(Boolean).join(' · ');
  return (
    <button className="dex__row gameday__row" onClick={() => onOpen(mon.sprite)}>
      <Sprite id={mon.sprite} />
      <div className="gameday__main">
        <b><NameNode name={mon.name} labels={data.FORM_LABELS} /></b>
        <span className="meta gameday__note">{note}</span>
      </div>
    </button>
  );
}

function Grouped({ sections, view, onOpen }: {
  sections: [string, GamedayMon[]][]; view: 'grid' | 'list'; onOpen: (sprite: number, en?: string) => void;
}) {
  return (
    <>
      {sections.map(([label, mons]) => (
        <section key={label} className="gameday__sec">
          <h2 className="page__sec">{label}<span className="meta"> {mons.length}종</span></h2>
          {/* 도감 목록은 **줄이 기본**이라 .is-grid 하나만 켜고 끈다 (순위표와 반대다 — v3.9.1) */}
          <div className={`dex__list${view === 'grid' ? ' is-grid' : ''}`}>
            {mons.map((mon, index) => <MonCard key={`${mon.sprite}-${index}`} mon={mon} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * 알 칸 나누기 — **거리만으로 묶지 않는다** (v3.53.0 의 판단 그대로).
 * 같은 5km 라도 걸어서 깐 알과 어드벤처 싱크 보상은 나오는 종이 아예 다르다.
 * 거리로만 묶었더니 걸어서는 절대 안 나오는 5종이 같은 칸에 섞여 "3종인데 8종처럼" 보였다.
 * 한 마리는 한 칸에만 들어간다 — 위에서부터 먼저 맞는 조건을 쓴다.
 */
const EGG_SOURCES: [string, (egg: GamedayMon, distance: string) => boolean][] = [
  ['어드벤처 싱크 보상', (egg) => !!egg.sync],
  // 7km 는 둘로 갈린다 — 업스트림의 gift 표시가 루트 선물 쪽이다
  ['루트 선물', (egg, distance) => distance === '7km' && !!egg.gift],
  ['친구 선물', (_egg, distance) => distance === '7km'],
];

// 거리는 숫자로 센다 — 글자로 세면 '10km' 가 '2km' 앞에 서고, 원본 순서대로 두면 1km 가 맨 뒤로 간다
const eggOrder = (distance: string) => parseInt(distance, 10) || 0;

function eggSections(eggs: Record<string, GamedayMon[]>): [string, GamedayMon[]][] {
  const buckets: { distance: string; tail: string; list: GamedayMon[] }[] = [];
  for (const [distance, list] of Object.entries(eggs)) {
    const rest: GamedayMon[] = [];
    for (const egg of list) {
      const hit = EGG_SOURCES.find(([, match]) => match(egg, distance));
      if (!hit) { rest.push(egg); continue; }
      const found = buckets.find((one) => one.distance === distance && one.tail === hit[0]);
      if (found) found.list.push(egg);
      else buckets.push({ distance, tail: hit[0], list: [egg] });
    }
    if (rest.length) buckets.unshift({ distance, tail: '', list: rest });
  }
  buckets.sort((a, b) => eggOrder(a.distance) - eggOrder(b.distance) || (a.tail ? 1 : 0) - (b.tail ? 1 : 0));
  return buckets.map(({ distance, tail, list }) => [tail ? `${distance} 알 · ${tail}` : `${distance} 알`, list]);
}

export function Raids({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
  const { data } = useGameday();
  // 레이드 보스는 그림이 커서 넓은 화면이 아니어도 카드가 기본이다 (v3 layoutInitial(RAIDS_COLS_KEY, true))
  const view = usePrefStore((s) => s.cols['raids']) ?? readCols('raids', 'grid');
  const setCols = usePrefStore((s) => s.setCols);
  return (
    <div id="page-raids" className="page__body">
      <Slot name="headActions">
        <ViewToggle view={view} onToggle={() => setCols('raids', view === 'grid' ? 'list' : 'grid')} extraClass="" />
      </Slot>
      {/* 이 줄이 화면의 경계를 긋는다 — '지금 도는 것' 과 '앞으로의 일정' 을 가르는 말이라 뺄 수 없다 */}
      <div className="gameday__intro page__filters">
        <p className="note">
          보스를 누르면 약점과 추천 딜러가 열려요. 혼자 잡을 수 있는지는 <a href="#/pve/solo">🧮 솔플 계산기</a> 에서,
          앞으로의 일정은 <a href="#/schedule">📅 이벤트 일정</a> 에서 봐요.
        </p>
      </div>
      <Grouped sections={Object.entries(data.GAMEDAY.raids).map(([tier, list]) => [`${tier} 레이드`, list])}
        view={view} onOpen={onOpen} />
      <p className="detail__foot">
        이 화면은 지금 도는 로테이션만 말해요 — 앞으로의 일정은 달력이 맡아요.
        출처 LeekDuck(ScrapedDuck) · {data.GAMEDAY.fetched.slice(0, 10)} 수집 · 지역과 이벤트에 따라 실제와 다를 수 있어요
      </p>
    </div>
  );
}

export function Eggs({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
  const { data } = useGameday();
  const view = usePrefStore((s) => s.cols['eggs']) ?? readCols('eggs', 'grid');
  const setCols = usePrefStore((s) => s.setCols);
  return (
    <div id="page-eggs" className="page__body">
      <Slot name="headActions">
        <ViewToggle view={view} onToggle={() => setCols('eggs', view === 'grid' ? 'list' : 'grid')} extraClass="" />
      </Slot>
      <div className="gameday__intro page__filters">
        <p className="note">포켓몬을 누르면 종족값과 상성을 볼 수 있어요.</p>
      </div>
      <Grouped sections={eggSections(data.GAMEDAY.eggs)} view={view} onOpen={onOpen} />
      <p className="detail__foot">
        지금 도는 알 부화 풀. 출처 LeekDuck(ScrapedDuck) · {data.GAMEDAY.fetched.slice(0, 10)} 수집 ·
        지역과 이벤트에 따라 실제와 다를 수 있어요
      </p>
    </div>
  );
}
