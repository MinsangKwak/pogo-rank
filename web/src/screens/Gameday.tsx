// ─────────────────────────────────────────────────────────────────────────────
// screens/Gameday.tsx — 레이드 보스 · 알 부화 (2026-10-16 v6 픽셀 시안 05 · 06)
//
// 두 화면 다 gameday.json 한 묶음을 본다. **한 번 받으면 같이 열린다** —
// v3 는 이 표가 data-lazy.js 에 있어 화면마다 지연 번들 도착을 기다렸다.
// react-query 캐시가 그 기다림을 한 번으로 줄인다.
//
// **카드는 공용 MonCard 다** (components/MonCard.tsx) — ☆ 즐겨찾기 · 몬스터볼 틀 · 타입 한국어 표기가 들어 있다.
// 여기서는 메타 한 줄("포획 CP 2217–2307 · 눈·바람 부스트 · 이로치")만 만들어 넘긴다.
//
// 레이드(05): 머리 오른쪽 '이벤트 일정' · '솔플 계산기' · 보기 전환 → '기준일' → 5성 히어로 판(기간 · 타입 · 날씨 부스트 · 이로치 · 포획 CP ·
//   날씨 부스트 CP · 추천 카운터 3) → 메가 격자 → 3성 · 1성 격자.
//   기간은 이번 주 보스판(lib/useBossBoard)에서 같은 이름의 5성 줄을 찾아 적고, 추천은 lib/bossCounters 를 그대로 쓴다 — 홈 · 팝업과 같은 세 마리.
// 알(06): 거리 칩 → 거리 요약 판 3(실제 종 수) → 구역별 격자(부화 CP · 이로치 · 지역 한정) → 안내 판.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { useGameday, useDex } from '../lib/data';
import { PxChips, PxViewSwitch, Sprite } from '../components/Bits';
import { NwBadge, NwFoot, NwMetric, NwNote, NwNoteBody, NwSecHead } from '../components/NewsBits';
import MonCard, { PokemonNumberRibbon } from '../components/MonCard';
import { PixelIcon } from '../components/PixelIcon';
import { dexNoOf, type OpenMon } from '../lib/mon';
import { Slot } from '../components/Slots';
import { NameNode } from '../components/Row';
import { usePrefStore, readCols } from '../stores/pref';
import { countersOf, useBossBoard, useCounterSource } from '../lib/useBossBoard';
import { num } from '../lib/cell';
import type { GamedayMon } from '../types/data';

/** 출처 한 줄 — v3 gamedayFoot. **한 문자열이다**: 사전은 줄 단위로 찾는다 */
function gamedayFoot(lead: string, fetched: string): string {
  const day = (fetched ?? '').slice(0, 10);
  return `${lead} 출처 LeekDuck(ScrapedDuck)${day ? ` · ${day} 수집` : ''} · 지역과 이벤트에 따라 실제와 다를 수 있어요`;
}

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' — 기준일 표기. 모양이 다르면 그대로 */
const dotDate = (date: string) => (/^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10).replace(/-/g, '.') : date);

/** CP 범위 — 같으면 한 숫자('637'), 다르면 '637–700'. 없으면 '—' */
function cpRange(cp: { min: number; max: number } | undefined): string {
  if (!cp?.min) return '—';
  return cp.min === cp.max ? num(cp.min) : `${num(cp.min)}–${num(cp.max)}`;
}

/**
 * 메타 한 줄 — **규칙이 둘이다** (v3 renderRaidsPage · renderEggsPage 의 notes).
 *   레이드  포획 CP 범위 · 날씨 부스트 · 이로치
 *   알      부화 CP(같으면 한 숫자) · 이로치 · 지역 한정
 */
function metaOf(mon: GamedayMon, kind: 'raid' | 'egg'): string {
  const cp = cpRange(mon.cp);
  return (kind === 'egg'
    ? [cp !== '—' ? `부화 CP ${cp}` : '', mon.shiny ? '이로치' : '', mon.regional ? '지역 한정' : '']
    : [cp !== '—' ? `포획 CP ${cp}` : '', mon.weather?.length ? `${mon.weather.join('·')} 부스트` : '', mon.shiny ? '이로치' : '']
  ).filter(Boolean).join(' · ');
}

/** 격자 카드 — 공용 MonCard 에 번호 · 메타를 얹는다. 폼 번호(10000대)는 도감 표에서 원종 번호를 찾는다 */
function Card({ mon, kind, onOpen }: { mon: GamedayMon; kind: 'raid' | 'egg'; onOpen: OpenMon }) {
  const { data } = useDex();
  const no = dexNoOf(mon.sprite, data.DEX_DATA.dex) ?? undefined;
  return (
    <MonCard sprite={mon.sprite} {...(no !== undefined ? { dex: no } : {})} name={mon.name} types={mon.types ?? []}
      meta={metaOf(mon, kind)} from={kind === 'raid' ? 'raids' : 'eggs'} onOpen={onOpen} />
  );
}

/** 줄 보기 한 줄 — 그림 · 이름 · 타입 · 메타. 보기 전환(ViewToggle)이 '리스트' 일 때 */
function RowItem({ mon, kind, onOpen }: { mon: GamedayMon; kind: 'raid' | 'egg'; onOpen: OpenMon }) {
  const { data } = useDex();
  const types = (mon.types ?? []).map((type) => data.TYPE_KO[type] ?? type).join(' · ');
  const no = dexNoOf(mon.sprite, data.DEX_DATA.dex) ?? undefined;
  return (
    <li className="nw-row-item">
      <PokemonNumberRibbon dex={no} className="nw-row__dex" />
      <button type="button" className="nw-row px-skin px-card--tap" aria-label={`${mon.name} 상세 보기`} onClick={() => onOpen({ sprite: mon.sprite, name: mon.name, types: mon.types })}>
        <span className="px-ball px-ball--sm"><Sprite id={mon.sprite} /></span>
        <span className="nw-row__body">
          <b className="px-sub"><NameNode name={mon.name} labels={data.FORM_LABELS} /></b>
          <span className="px-caption">{[types, metaOf(mon, kind)].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
    </li>
  );
}

/** 구역 하나 — 제목 줄 + 격자(또는 줄 목록) */
function Group({ title, note, mons, kind, view, onOpen, children }: {
  title: string; note?: string; mons: GamedayMon[]; kind: 'raid' | 'egg'; view: 'grid' | 'list'; onOpen: OpenMon; children?: ReactNode;
}) {
  return (
    <section className="nw-gsec">
      <NwSecHead className="nw-sechead" title={title} {...(note ? { note } : {})} right={`${mons.length}종`} />
      {children}
      {view === 'grid'
        ? <div className="px-grid">{mons.map((mon, index) => <Card key={`${mon.sprite}-${index}`} mon={mon} kind={kind} onOpen={onOpen} />)}</div>
        : <ul className="nw-rows">{mons.map((mon, index) => <RowItem key={`${mon.sprite}-${index}`} mon={mon} kind={kind} onOpen={onOpen} />)}</ul>}
    </section>
  );
}

/** 5성 히어로 판 — 기간 · 타입 · 이름 · 날씨 부스트 · 이로치 · 포획 CP · 날씨 부스트 CP · 추천 카운터 3 */
function Hero({ mon, onOpen }: { mon: GamedayMon; onOpen: OpenMon }) {
  const { data } = useDex();
  const { board } = useBossBoard();
  const src = useCounterSource();
  // 기간은 이번 주 보스판의 같은 이름 5성 줄에서 — gameday 레이드 목록에는 날짜가 없다. 없으면 줄을 비운다
  const card = board.find((one) => one.kind === 'raid5' && (one.detailName === mon.name || one.name === mon.name)) ?? null;
  const counters = countersOf(src, 'raid', mon.types ?? [], 3);
  const types = (mon.types ?? []).map((type) => data.TYPE_KO[type] ?? type);
  const no = dexNoOf(mon.sprite, data.DEX_DATA.dex) ?? undefined;
  return (
    <section className="nw-boss-frame" aria-label={`${mon.name} 전설 레이드`}>
      <PokemonNumberRibbon dex={no} className="nw-boss__dex" />
      <div className="nw-boss px-skin px-drop px-panel">
        <div className="nw-boss__main">
          <div className="nw-badges nw-boss__schedule">
            <NwBadge text="★★★★★ 전설 레이드" tone="yellow" />
            {card ? <NwBadge text={card.when} tone="muted" /> : null}
          </div>
          <div className="nw-boss__identity">
            <h2 className="px-display nw-boss__name"><NameNode name={mon.name} labels={data.FORM_LABELS} /></h2>
            <p className="px-caption nw-boss__types">{types.join(' · ')}</p>
            <div className="nw-badges nw-boss__conditions">
              {mon.weather?.length ? <NwBadge text={`${mon.weather.join(' · ')} 부스트`} tone="blue" /> : null}
              {mon.shiny ? <NwBadge text="이로치 가능" tone="mint" /> : null}
            </div>
          </div>
          <div className="nw-boss__metrics">
            <NwMetric sunk label="포획 CP" value={cpRange(mon.cp)} note="Lv.20" />
            <NwMetric sunk label="날씨 부스트 CP" value={cpRange(mon.cpBoost)} color="var(--blue)" note="Lv.25" />
          </div>
          <div className="nw-boss__actions">
            <button type="button" className="px-btn px-skin px-btn--primary" onClick={() => onOpen({ sprite: mon.sprite, name: mon.name, types: mon.types })}>보스 상세 보기</button>
            <a className="px-btn px-skin nw-boss__route-cta" href="/pve/solo">솔플 계산기</a>
          </div>
        </div>
        <div className="nw-boss__side">
          <span className="px-ball px-ball--lg nw-boss__art"><Sprite id={mon.sprite} /></span>
          {counters ? (
            <div className="nw-boss__counters">
              <p className="px-caption">{`추천 카운터 · ${counters.types.map((type) => data.TYPE_KO[type] ?? type).join(' · ')} 딜러`}</p>
              <ul className="nw-counters">
                {counters.rows.map((row, index) => (
                  <li className="nw-counter-item" key={row.sprite}>
                    <PokemonNumberRibbon rank={index + 1} className="nw-counter__rank" />
                    <button type="button" className="nw-counter px-skin px-skin--sunk px-card--tap" aria-label={`${row.name} 상세 보기`} onClick={() => onOpen({ sprite: row.sprite, name: row.name, en: row.en, types: [...row.types] })}>
                      <span className="px-ball px-ball--sm"><Sprite id={row.sprite} /></span>
                      <span className="px-body nw-counter__name"><NameNode name={row.name} labels={data.FORM_LABELS} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** 티어 머리 — gameday 의 티어 키('5성' · '메가' · '3성' · '1성') → 시안 제목 */
const RAID_HEAD: Record<string, { title: string; note: string }> = {
  '메가': { title: '메가 레이드', note: '보스 상세에서 카운터 확인' },
  '3성': { title: '★★★ 3성 레이드', note: '기간별 출현 보스' },
  '1성': { title: '★ 1성 레이드', note: '기간별 출현 보스' },
};

export function Raids({ onOpen }: { onOpen: OpenMon }) {
  const { data } = useGameday();
  // 레이드 보스는 그림이 커서 넓은 화면이 아니어도 카드가 기본이다 (v3 layoutInitial(RAIDS_COLS_KEY, true))
  const view = usePrefStore((s) => s.cols['raids']) ?? readCols('raids', 'grid');
  const setCols = usePrefStore((s) => s.setCols);
  const tiers = Object.entries(data.GAMEDAY.raids);
  const legends = tiers.find(([tier]) => tier === '5성')?.[1] ?? [];
  const others = tiers.filter(([tier]) => tier !== '5성');
  return (
    <div id="page-raids" className="page__body nw-raids" data-route="raids">
      <Slot name="headActions">
        <a className="px-btn px-skin px-btn--sm" href="/schedule"><PixelIcon name="calendar" /><span>이벤트 일정</span></a>
        <a className="px-btn px-skin px-btn--sm" href="/pve/solo"><PixelIcon name="sword" /><span>솔플 계산기</span></a>
        <PxViewSwitch view={view} onPick={(next) => setCols('raids', next)} />
      </Slot>
      {/* 이 줄이 화면의 경계를 긋는다 — '지금 도는 것' 과 '앞으로의 일정' 을 가르는 말이라 뺄 수 없다 (check_perf 가 .gameday__intro .note 를 기다린다) */}
      <div className="gameday__intro nw-intro">
        <p className="note px-caption">
          <span className="px-mono">{`${dotDate(data.GAMEDAY.fetched)} 기준`}</span>{' · '}
          <span>보스를 선택하면 약점과 추천 포켓몬을 확인할 수 있어요.</span>
        </p>
      </div>
      {legends.length ? (
        <div className="nw-boss-grid" data-view={view}>
          {legends.map((mon, index) => <Hero key={`${mon.sprite}-${index}`} mon={mon} onOpen={onOpen} />)}
        </div>
      ) : null}
      {others.map(([tier, mons]) => (
        <Group key={tier} title={RAID_HEAD[tier]?.title ?? `${tier} 레이드`} {...(RAID_HEAD[tier]?.note ? { note: RAID_HEAD[tier]!.note } : {})}
          mons={mons} kind="raid" view={view} onOpen={onOpen} />
      ))}
      <NwFoot>{gamedayFoot('현재 등장하는 레이드 보스 기준이에요. 예정된 일정은 이벤트 일정에서 확인해 주세요.', data.GAMEDAY.fetched)}</NwFoot>
    </div>
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
// '2km' → '2 km' — 시안 표기
const km = (distance: string) => distance.replace(/km$/, ' km');
// 획득 경로 → 시안 부제. 기본 알은 포켓스톱 · 체육관, 나머지는 그 경로
const TAIL_NOTE: Record<string, string> = { '': '포켓스톱 / 체육관 · 기본 알', '어드벤처 싱크 보상': '모험 싱크 보상', '루트 선물': '루트 선물', '친구 선물': '친구 선물' };

interface EggSection { distance: string; tail: string; list: GamedayMon[] }

function eggSections(eggs: Record<string, GamedayMon[]>): EggSection[] {
  const buckets: EggSection[] = [];
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
  return buckets;
}

/** 거리 요약 판 세 장 — 시안의 '2 km 가볍게 걷기 · 5 km 오늘의 산책 · 10 km 긴 모험 준비'. 종 수는 실제 데이터 */
const EGG_SUMMARY: [string, string][] = [['2km', '가볍게 걷기'], ['5km', '오늘의 산책'], ['10km', '긴 모험 준비']];

export function Eggs({ onOpen }: { onOpen: OpenMon }) {
  const { data } = useGameday();
  const view = usePrefStore((s) => s.cols['eggs']) ?? readCols('eggs', 'grid');
  const setCols = usePrefStore((s) => s.setCols);
  const [distance, setDistance] = useState('');
  const sections = eggSections(data.GAMEDAY.eggs);
  const distances = [...new Set(sections.map((one) => one.distance))];
  const shown = distance ? sections.filter((one) => one.distance === distance) : sections;
  const countOf = (which: string) => sections.filter((one) => one.distance === which).reduce((sum, one) => sum + one.list.length, 0);
  return (
    <div id="page-eggs" className="page__body nw-eggs" data-route="eggs">
      <Slot name="headActions">
        <PxViewSwitch view={view} onPick={(next) => setCols('eggs', next)} />
      </Slot>
      <div className="gameday__intro nw-intro">
        <p className="note px-caption">
          <span className="px-mono">{`${dotDate(data.GAMEDAY.fetched)} 기준`}</span>{' · '}
          <span>포켓몬을 누르면 종족값과 상성을 볼 수 있어요.</span>
        </p>
      </div>
      {/* 거리 칩 — '전체' 는 'all'. 요약 판을 눌러도 같은 거리로 좁혀진다(다시 누르면 전체) */}
      <PxChips label="알 거리" value={distance || 'all'} items={[{ id: 'all', label: '전체' }, ...distances.map((one) => ({ id: one, label: km(one) }))]}
        onPick={(id) => setDistance(id === 'all' ? '' : id)} />
      <div className="nw-eggsum">
        {EGG_SUMMARY.filter(([which]) => data.GAMEDAY.eggs[which]).map(([which, label]) => (
          <NwMetric key={which} label={label} value={km(which)} note={`${num(countOf(which))}종 부화 가능`}
            pressed={distance === which} onClick={() => setDistance(distance === which ? '' : which)} />
        ))}
      </div>
      {shown.map(({ distance: which, tail, list }) => (
        <Group key={`${which}-${tail}`} title={`${km(which)} · ${TAIL_NOTE[tail] ?? tail}`} mons={list} kind="egg" view={view} onOpen={onOpen} />
      ))}
      <NwNote title="알 종류가 같아도 획득 경로가 달라요">
        <NwNoteBody>같은 거리의 알이라도 포켓스톱 · 체육관에서 받은 알과 모험 싱크 보상, 친구 · 루트 선물로 받은 알은 부화하는 포켓몬이 달라요. 알을 받은 경로를 먼저 확인해 주세요.</NwNoteBody>
      </NwNote>
      <NwFoot>{gamedayFoot('현재 알에서 부화할 수 있는 포켓몬 목록이에요.', data.GAMEDAY.fetched)}</NwFoot>
    </div>
  );
}
