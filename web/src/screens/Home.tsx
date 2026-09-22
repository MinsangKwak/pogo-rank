// ─────────────────────────────────────────────────────────────────────────────
// screens/Home.tsx — 서비스 홈
//
// v3 components/home.js 의 구성을 그대로 따른다 (v3.55.0 에 게임 업데이트를 맨 아래로 내렸다):
//   히어로 → 용도별 상위 포켓몬 → 갈래 카드 → 게임 업데이트
// 타일의 이름·아이콘·설명은 **전부 라우터 표에서** 온다 (v2.66.0 의 규칙 — 글을 두 곳에 적지 않는다).
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { BASE } from '../lib/base';
import { HERO_ART } from '../lib/heroArt';

import { Suspense, type ReactNode } from 'react';
import { ROUTE_GROUPS, ROUTE_NAV, routeDesc, routeHref, type RouteDef } from '../routes';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { useMax, useUpdates, useMeta, usePve, useDex, useDexSoft, useGamedaySoft } from '../lib/data';
import { Sprite } from '../components/Bits';
import { PxIcon } from '../components/PxIcon';
import { NameNode } from '../components/Row';
import type { GameUpdate } from '../types/data';
import { track } from '../lib/track';
import { UPDATE_CATS } from '../lib/notes';
import type { OpenMon } from '../lib/mon';
import { TankPopupEntry } from '../components/TankPopup';

// 갈래마다 문 앞에 세우는 스타터 (v3 home.js 와 같은 번호 — 꼬부기 · 파이리 · 이상해씨)
const STARTER: Record<string, number> = { today: 7, pick: 4, mine: 1 };

// 주소는 라우터 표의 path 에서 온다 — 손으로 조립하면 v3.61.0 의 죽은 링크가 되풀이된다
// 내보내는 이유는 검사 하나뿐이다 (Shell 의 NavItem 과 같은 사정)
export function Tile({ route }: { route: RouteDef }) {
  // 메뉴 줄과 같은 표시 — 흐려지고 이름 뒤에 🔒 (planner.css .home__tile.is-locked)
  const reason = useLockReason(route.id);
  const lock = lockedAttrs(reason);
  return (
    <a className={`home__tile${lock.className}`} href={`/${route.path}`} data-route={route.id}
      title={reason ? lock.title : routeDesc(route.id)}
      {...(lock['aria-disabled'] ? { 'aria-disabled': lock['aria-disabled'] } : {})}
      {...(route.id === 'planner' ? { id: 'home-tile-planner' } : {})}>
      <span className="home__icon" aria-hidden="true">{route.icon}</span>
      <strong>{route.nav}</strong>
      <span className="home__arrow" aria-hidden="true">›</span>
    </a>
  );
}

// v3 components/home.js homePickGroup 과 **같은 마크업**이다.
// 처음에 pick__row 안에 그림과 이름을 바로 넣었더니 이름이 세로로 한 글자씩 쪼개졌다 —
// CSS 가 .pick__row > .pick__body 를 flex 자식으로 잡고 있어 중간 칸이 꼭 있어야 한다.
// 클래스명을 그대로 쓰면서 **구조까지** 같아야 디자인이 같다는 것을 여기서 배웠다.
interface PickRow { sprite: number; name: string; en: string; meta: string }

/**
 * 갈래 카드 옆에 서는 '발견' 카드 (v3 home.js pickDiscoverNode).
 * 순위 셋만 늘어놓으면 "그래서 어디로 가지" 가 안 남는다 — 이 카드가 그 자리에서 다음 화면을 가리킨다.
 */
function Discover({ mascot, sprite, kicker, head, copy, extra, href }: {
  mascot: string; sprite: number; kicker: string; head: ReactNode; copy: string; extra?: string; href: string;
}) {
  return (
    <button className={`pick__discover${extra ? ` ${extra}` : ''}`} type="button"
      onClick={() => { go(href); }}>
      <span className={`home-card-mascot home-card-mascot--${mascot}`} aria-hidden="true">
        <img className="home-card-mascot__body" src={`${BASE}sprites/${sprite}.png`}
          alt="" width={96} height={96} />
      </span>
      <span className="pick__discover-kicker">{kicker}</span>
      <strong>{head}</strong>
      <span className="pick__discover-copy">{copy}</span>
      <span className="pick__discover-action">전체 보기<span aria-hidden="true">↗</span></span>
    </button>
  );
}

/**
 * 배너 바닥의 '아래로' — 배너가 세로 600 이라 첫 화면이 배너 하나로 찬다.
 * 아래에 무엇이 더 있는지 몰라 스크롤을 안 하는 사람이 있어서, 갈 곳을 눈에 보이게 둔다.
 *
 * **자리(#home-more)가 아직 없을 수 있다.** 아래쪽은 데이터를 기다리는 Suspense 안이라
 * 데이터가 오기 전에는 그 자리에 기다림 판만 있다 — 그때는 한 화면만큼 내린다.
 */
function ScrollDown() {
  const go = () => {
    const target = document.getElementById('home-more');
    // 움직임을 줄여 달라고 한 사람에게는 부드럽게 흐르지 않는다 (§1-b 와 같은 결)
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    if (target) target.scrollIntoView({ behavior, block: 'start' });
    else window.scrollTo({ top: window.innerHeight, behavior });
  };
  return (
    <button className="home__scroll" type="button" onClick={go}>
      <span>아래로</span>
      <PxIcon emoji="↓" />
    </button>
  );
}

function PickCard({ kind, title, hint, rows, href, labels, onOpen }: {
  kind: string; title: string; hint: string; rows: PickRow[]; href: string | null;
  labels: readonly string[]; onOpen: OpenMon;
}) {
  const first = rows[0];
  if (!first) return null;
  return (
    <section className={`pick__group pick__group--${kind}`} aria-label={title}>
      <div className="pick__head">
        <h4><span className="pick__crown" aria-hidden="true">👑</span>{title}</h4>
        <p className="pick__hint">{hint}</p>
        {href ? <a className="pick__all" href={href}>전체 보기 <PxIcon emoji="↗" /></a> : null}
      </div>
      <div className="pick__grid">
        <button className="pick__hero" type="button" aria-label={`1위 ${first.name}`} onClick={() => onOpen(first)}>
          <span className="pick__spotlight" aria-hidden="true">NO.01</span>
          <Sprite id={first.sprite} />
          <span className="pick__inspect" aria-hidden="true">상세 보기 ↗</span>
        </button>
        <ol className="pick__list">
          {rows.map((row, index) => (
            <li key={`${row.sprite}-${index}`}>
              <button className="pick__row" type="button" onClick={() => onOpen(row)}>
                <span className="pick__rank">{index + 1}</span>
                <span className="pick__body">
                  <span className="pick__name"><NameNode name={row.name} labels={labels} /></span>
                  <span className="pick__meta">{row.meta}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * 날짜 줄 — 발표일과 적용일은 뜻이 달라 라벨을 붙여 따로 적는다.
 * 둘 다 없는 글(공식 릴리스 노트)은 확인일을 대신 보인다 — 목록에서도 '언제 것' 은 알아야 한다.
 */
function UpdateDates({ row }: { row: GameUpdate }) {
  const parts: [string, string][] = [];
  const announced = row.announcedAt || row.date;
  if (announced) parts.push(['발표', announced]);
  if (row.effectiveAt) parts.push(['적용', row.effectiveAt]);
  if (!parts.length && row.checkedAt) parts.push(['확인', row.checkedAt]);
  return (
    <div className="upd__dates">
      {parts.length
        ? parts.map(([label, date]) => <span key={label} className="upd__date"><em>{label}</em><b>{date}</b></span>)
        : <span className="upd__date"><em>날짜 미확인</em></span>}
    </div>
  );
}

/** 홈 — 히어로는 데이터 없이 바로 서고, 그 아래(추천·안내·소식)만 기다린다.
    전에는 화면 전체가 max·pve·updates 를 기다려 첫 내용(LCP)이 5초였다 — 히어로는 글자뿐인데도 (v4.4.2 측정) */
/** 다음 맥스 배틀 한 건 — 지금 진행 중이거나 다가오는 것 중 가장 이른 것. 없으면 null */
function nextMaxBattle(events: readonly { type: string; title: string; start: string; end: string }[] | undefined) {
  if (!events) return null;
  const now = Date.now();
  return events
    .filter((event) => (event.type === 'max-mondays' || event.type === 'max-battles') && Date.parse(event.end) >= now)
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))[0] ?? null;
}

// 'Dynamax Articuno, Zapdos, and Moltres during Max Monday' → ['프리져', '썬더', '파이어'].
// 일정 원본에 dex 번호가 없어 영문 제목의 낱말을 도감 영문 이름표에 대 본다.
// 못 찾는 낱말은 그냥 버린다 — 이름을 지어내지 않는다 (§3)
function bossNamesFromTitle(title: string, en: Record<string, string> | undefined, ko: Record<string, string> | undefined): string[] {
  if (!en || !ko) return [];
  const byEn = new Map(Object.entries(en).map(([id, name]) => [name.toLowerCase(), id]));
  const out: string[] = [];
  for (const word of title.replace(/[^A-Za-z' -]/g, ' ').split(/\s+/)) {
    const id = byEn.get(word.toLowerCase());
    const name = id ? ko[id] : undefined;
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

// '2026-09-21T06:00:00.000' → '9.21'. 시간대를 안 옮긴다 — 값이 이미 한국 기준이다
function monthDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${Number(match[2])}.${Number(match[3])}` : '';
}

export default function Home({ onOpen }: { onOpen: OpenMon }) {
  // 장면의 이름 한 글자 때문에 히어로를 세우지 않는다 — 도착하면 채워진다
  const dexSoft = useDexSoft();
  const gameday = useGamedaySoft();
  const battle = nextMaxBattle(gameday?.GAMEDAY.events);
  const bosses = battle ? bossNamesFromTitle(battle.title, dexSoft?.DEX_DATA.en, dexSoft?.DEX_DATA.names) : [];
  // 같은 날이면 날짜 하나, 다른 날이면 '9.21 — 9.27'
  const when = battle
    ? (monthDay(battle.start) === monthDay(battle.end) ? monthDay(battle.start) : `${monthDay(battle.start)} — ${monthDay(battle.end)}`)
    : '';
  const kind = battle?.type === 'max-battles' ? 'MAX BATTLE DAY' : 'MAX MONDAY';
  return (
    <div className="home-dashboard">
      {/* 검색 보드는 v4.6.3 에 내렸다 — 검색이 모자라 순위가 서지 않는다 (ranking 브랜치 · 백로그). 포스터가 한 열을 다 쓴다 */}
      <div className="home__top-layout">
      {/* 마스코트와 버튼 줄은 .home__intro **밖**에 선다 — CSS 가 세 칸(글·그림·버튼)으로 잡는다.
          안에 넣었더니 그림이 글 아래로 내려가고 히어로 높이가 71px 줄었다 */}
      <section className="home__welcome" aria-label="소개">
        <div className="home__intro">
          <span className="home__eyebrow"><span className="home__eyebrow-dot" aria-hidden="true" />BATTLE GUIDE / 01</span>
          <h2>다음 맥스 배틀,<br /><em>누구와 갈까요?</em></h2>
          <p>티어를 비교하고, 나만의 팀을 준비하세요.<br />첫 선택부터 배틀 준비까지 함께해요.</p>
        </div>
        {/* 손에는 720w, PC 에는 1200w — 원본 1536w·292KB 를 첫 그림(LCP)으로 실을 이유가 없다 (v4.4.2 의 성능 작업을 지키려고).
            캡션의 날짜·보스는 gameday 일정에서 온다 — 코드에 박아 두면 다음 주에 틀린 말이 된다 (§3) */}
        <figure className="max-battle-art">
          <img
            src={HERO_ART.src}
            srcSet={HERO_ART.srcSet}
            sizes={HERO_ART.sizes}
            alt={`${dexSoft?.DEX_DATA.names['464'] ?? ''}·${dexSoft?.DEX_DATA.names['242'] ?? ''}·${dexSoft?.DEX_DATA.names['249'] ?? ''}·${dexSoft?.DEX_DATA.names['530'] ?? ''}가 다이맥스 ${dexSoft?.DEX_DATA.names['144'] ?? ''}와 맞서는 배틀 일러스트`}
            width={HERO_ART.width} height={HERO_ART.height} fetchPriority="high" decoding="async" />
          <figcaption>
            {when ? <span>{when} · {kind}</span> : null}
            {bosses.length ? <b>{bosses.join(' · ')}</b> : null}
            <small>대표 보스 배틀 일러스트</small>
          </figcaption>
        </figure>
        <div className="home__cta">
          <a className="home__btn home__btn--primary" href={routeHref('dmax')}
            onClick={() => track('home_cta', { to: 'dmax' })}>다이맥스 티어표 보기<span aria-hidden="true"> →</span></a>
          <a className="home__btn" href={routeHref('dmax-deck')}
            onClick={() => track('home_cta', { to: 'dmax-deck' })}>맥스 배틀 덱 짜기</a>
        </div>
        <ScrollDown />
      </section>
      {/* 배너 옆 세로 칸 — 넓은 화면에서만 옆에 서고, 좁으면 배너 아래로 내려온다 (home-editorial.css).
          데이터를 안 쓰는 카드라 Suspense 밖에 둘 수 있다 — 그래서 첫 화면에 바로 선다 */}
      <Discover mascot="machamp" sprite={68} kicker="다양한 활용처" extra="pick__discover--aside"
        head={<>한 마리로<br />여러 배틀을.</>} copy="레이드부터 PvP까지, 두루 쓰이는 포켓몬"
        href={routeHref('dex')} />
      </div>
      {/* 기다리는 자리도 한 화면을 채운다 — 바닥글이 먼저 보였다가 밀리면 CLS 다 */}
      <Suspense fallback={<div className="home__loading" aria-busy="true" />}>
        <HomeData onOpen={onOpen} />
      </Suspense>
    </div>
  );
}

/** 데이터가 있어야 그리는 아래쪽 — 추천 셋 · 서비스 안내 · 소식 */
function HomeData({ onOpen }: { onOpen: OpenMon }) {
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const { data: updates } = useUpdates();
  const { data: meta } = useMeta();

  // 2026-09-17 **미구현(데이터만 등록된 개체)은 뺀다** — 홈은 '지금 셀 수 있는 셋' 을 보여 주는 자리다.
  //   제보: 홈 1위에 아직 게임에 없는 '거다이맥스 검왕 자시안' 이 서 있었다.
  //   v3 home.js 의 HOME_PICKS.dmax 가 같은 필터를 이미 걸고 있었는데 그걸 빠뜨렸다.
  //   D-MAX 화면 쪽은 [미구현 포함] 체크가 따로 있어 거기서는 고를 수 있다 (v3 와 같은 규칙).
  const dmax = (max.DMAX_TIER['overall'] ?? []).filter((row) => !row.unrel).slice(0, 3)
    // 티어표는 공격 × 맥스무브 위력 × 자속이라 내구가 안 들어간다 — 그래서 티어와 맥스무브 속성을 적는다
    .map((row) => ({ sprite: row.sprite, name: row.name, en: row.en, meta: `${row.tier} 티어 · ${dex.TYPE_KO[row.charged] ?? ''} 맥스` }));
  const raid = (pve.PVE_DATA['overall'] ?? []).slice(0, 3)
    .map((row) => ({ sprite: row.sprite, name: row.name, en: row.en, meta: `DPS ${row.dps} · 버팀 ${row.tdo}` }));
  // 골라 둔 글(featured)이 있으면 그것부터 — 없을 때만 최신순으로 떨어진다 (v3 homeUpdatesNode)
  const featured = updates.GAME_UPDATES.filter((row) => row.featured);
  const top = (featured.length ? featured : updates.GAME_UPDATES).slice(0, 2);

  return (
    <>
      {/* 11월 레이드 탱커 준비(예상) — 안내 띠 + 하루 한 번 열리는 팝업. 데이터가 있어야 그리므로 여기(Suspense 안)다 */}
      <TankPopupEntry onOpen={onOpen} />
      {/* id 는 배너의 '아래로' 단추가 내려가는 자리다 — 새 이름이라 home- 를 붙였다 (§2) */}
      <section className="home__picks" id="home-more">
        <div className="home__section">
          <h3>용도별 상위 포켓몬</h3>
          <span>평가 조건에 따라 추천이 달라져요<span className="home__date"> · 기준일 {meta.DATA_FETCHED.slice(0, 10)}</span></span>
        </div>
        {/* 카드 둘이 한 격자 안에 선다 — 감싸는 .home__pick-grid 가 없으면 카드가 한 줄에 하나씩 늘어선다.
            「다양한 활용처」는 v4.9.4 에 배너 옆으로 올라갔다 (위 .home__top-layout) */}
        <div className="home__pick-grid">
          <PickCard kind="dmax" title="다이맥스" hint="다이맥스 배틀에서 활약하는 포켓몬" rows={dmax}
            href={routeHref('dmax')} labels={dex.FORM_LABELS} onOpen={onOpen} />
          <PickCard kind="pve" title="레이드" hint="종합 점수 순 · 초당 피해량(DPS)과 총 피해량(TDO) 기준" rows={raid}
            href={routeHref('pve')} labels={dex.FORM_LABELS} onOpen={onOpen} />
        </div>
        <span className="pick__foot">이름을 누르면 종족값·상성·배틀 활용 순위를 확인할 수 있어요</span>
      </section>


      <section className="home__features" aria-label="서비스 기능">
        <div className="home__section">
          <h3>무엇이 필요한가요?</h3>
          <span>필요한 기능을 선택해 바로 시작해 보세요</span>
        </div>
        <div className="home__service-grid">
          {ROUTE_GROUPS.map(([id, label, desc]) => (
            <section key={id} className={`home__service-group home__service-group--${id}`}>
              <div className="home__group-head">
                <img className="home__starter" src={`${BASE}sprites/${STARTER[id]}.png`}
                  alt="" aria-hidden="true" width={96} height={96} />
                <h4 className="home__group">{label}</h4>
                <p className="home__group-desc">{desc}</p>
              </div>
              <div className="home__grid">
                {ROUTE_NAV.filter((route) => route.group === id && !route.parent).map((route) => (
                  <Tile key={route.id} route={route} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* v3.55.0 게임 업데이트는 맨 아래 — 매일 보는 것이 아니라 가끔 확인하는 것이라서 */}
      <section className="home-updates">
        <div className="home__section">
          <h3>게임 업데이트</h3>
          <span>공식 발표로 확인한 게임 변경 소식을 전해요</span>
        </div>
        {/* 제목만 있는 <li> 줄이 아니라 요약과 두 날짜를 든 카드다 — '무엇이 언제 바뀌나' 가 제목만으로는 안 읽힌다 */}
        <div className="home-updates__list">
          {top.map((row) => (
            <button key={row.id} className="home-updates__item"
              onClick={() => { go(`/game-updates/${row.id}`); }}>
              <div className="upd__cats">
                {(row.category ?? []).map((key) => <span key={key} className="upd__cat">{UPDATE_CATS[key] ?? key}</span>)}
              </div>
              <b>{row.title}</b>
              <span className="home-updates__sum">{row.summary ?? ''}</span>
              <UpdateDates row={row} />
            </button>
          ))}
          <Discover mascot="gengar" sprite={94} kicker="게임 업데이트" extra="pick__discover--updates"
            head={<>새로운 소식,<br />놓치지 마세요.</>} copy="패치부터 이벤트까지 한눈에 확인해요"
            href={routeHref('game-updates')} />
        </div>
      </section>
    </>
  );
}
