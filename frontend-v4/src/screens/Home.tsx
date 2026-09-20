// ─────────────────────────────────────────────────────────────────────────────
// screens/Home.tsx — 서비스 홈
//
// v3 components/home.js 의 구성을 그대로 따른다 (v3.55.0 에 게임 업데이트를 맨 아래로 내렸다):
//   히어로 → 용도별 상위 포켓몬 → 갈래 카드 → 게임 업데이트
// 타일의 이름·아이콘·설명은 **전부 라우터 표에서** 온다 (v2.66.0 의 규칙 — 글을 두 곳에 적지 않는다).
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, type ReactNode } from 'react';
import { ROUTE_GROUPS, ROUTE_NAV, routeDesc, routeHash, type RouteDef } from '../routes';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { useMax, useUpdates, useMeta, usePve, useDex, useDexSoft } from '../lib/data';
import { Sprite } from '../components/Bits';
import { PxIcon } from '../components/PxIcon';
import { NameNode } from '../components/Row';
import type { GameUpdate } from '../types/data';
import { track } from '../lib/track';
import { UPDATE_CATS } from '../lib/notes';
import type { OpenMon } from '../lib/mon';
import HotSearch from '../components/HotSearch';

// 갈래마다 문 앞에 세우는 스타터 (v3 home.js 와 같은 번호 — 꼬부기 · 파이리 · 이상해씨)
const STARTER: Record<string, number> = { today: 7, pick: 4, mine: 1 };

// 주소는 라우터 표의 path 에서 온다 — 손으로 조립하면 v3.61.0 의 죽은 링크가 되풀이된다
// 내보내는 이유는 검사 하나뿐이다 (Shell 의 NavItem 과 같은 사정)
export function Tile({ route }: { route: RouteDef }) {
  // 메뉴 줄과 같은 표시 — 흐려지고 이름 뒤에 🔒 (planner.css .home__tile.is-locked)
  const reason = useLockReason(route.id);
  const lock = lockedAttrs(reason);
  return (
    <a className={`home__tile${lock.className}`} href={`#/${route.path}`} data-route={route.id}
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
      onClick={() => { location.hash = href; }}>
      <span className={`home-card-mascot home-card-mascot--${mascot}`} aria-hidden="true">
        <img className="home-card-mascot__body" src={`${import.meta.env.BASE_URL}sprites/${sprite}.png`}
          alt="" width={96} height={96} />
      </span>
      <span className="pick__discover-kicker">{kicker}</span>
      <strong>{head}</strong>
      <span className="pick__discover-copy">{copy}</span>
      <span className="pick__discover-action">전체 보기<span aria-hidden="true">↗</span></span>
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
export default function Home({ onOpen }: { onOpen: OpenMon }) {
  // 장면의 이름 한 글자 때문에 히어로를 세우지 않는다 — 도착하면 채워진다
  const dexSoft = useDexSoft();
  return (
    <div className="home-dashboard">
      {/* 마스코트와 버튼 줄은 .home__intro **밖**에 선다 — CSS 가 세 칸(글·그림·버튼)으로 잡는다.
          안에 넣었더니 그림이 글 아래로 내려가고 히어로 높이가 71px 줄었다 */}
      <section className="home__welcome" aria-label="소개">
        <div className="home__intro">
          <span className="home__eyebrow"><span className="home__eyebrow-dot" aria-hidden="true" />DYNAMAX · RAID · PVP</span>
          <h2>맥스 배틀에 데려갈 포켓몬,<br />여기서 골라요.</h2>
          <p>다이맥스 티어표와 추천 덱을 비교하고, 레이드·PvP까지 확인하세요.</p>
        </div>
        {/* 맥스 배틀 한 장면 — 꾸밈이라 aria-hidden. 이름은 도감 이름표에서 읽는다(코드에 한글을 박지 않는다 · §3).
            그림은 스프라이트 묶음의 거다이맥스 팬텀(10202)·인텔리레온(818) — 파일이 없으면 깨진 그림 대신 자리를 비운다 */}
        <div className="max-scene" aria-hidden="true">
          <div className="max-scene__status"><span>GIGANTAMAX</span><b>{dexSoft?.DEX_DATA.names['94'] ?? ''}</b><i /></div>
          <div className="max-scene__ring" />
          <img className="max-scene__boss" src={`${import.meta.env.BASE_URL}sprites/10202.png`} alt=""
            onError={(event) => { event.currentTarget.hidden = true; }} />
          <img className="max-scene__ally" src={`${import.meta.env.BASE_URL}sprites/818.png`} alt=""
            onError={(event) => { event.currentTarget.hidden = true; }} />
          <span className="max-scene__label">MAX BATTLE</span>
          <div className="max-scene__charge"><span>MAX ENERGY</span><i /><i /><i /></div>
        </div>
        <div className="home__cta">
          <a className="home__btn home__btn--primary" href={routeHash('dmax')}
            onClick={() => track('home_cta', { to: 'dmax' })}>다이맥스 티어표 보기<span aria-hidden="true"> →</span></a>
          <a className="home__btn" href={routeHash('dmax-deck')}
            onClick={() => track('home_cta', { to: 'dmax-deck' })}>맥스 배틀 덱 짜기</a>
        </div>
      </section>
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
      <section className="home__picks">
        <div className="home__section">
          <h3>용도별 상위 포켓몬</h3>
          <span>평가 조건에 따라 추천이 달라져요<span className="home__date"> · 기준일 {meta.DATA_FETCHED.slice(0, 10)}</span></span>
        </div>
        {/* 카드 셋이 한 격자 안에 선다 — 감싸는 .home__pick-grid 가 없으면 카드가 한 줄에 하나씩 늘어선다 */}
        <div className="home__pick-grid">
          <Discover mascot="machamp" sprite={68} kicker="다양한 활용처"
            head={<>한 마리로<br />여러 배틀을.</>} copy="레이드부터 PvP까지, 두루 쓰이는 포켓몬"
            href={routeHash('dex')} />
          <PickCard kind="dmax" title="다이맥스" hint="다이맥스 배틀에서 활약하는 포켓몬" rows={dmax}
            href={routeHash('dmax')} labels={dex.FORM_LABELS} onOpen={onOpen} />
          <PickCard kind="pve" title="레이드" hint="종합 점수 순 · DPS 와 버팀(TDO)을 함께 봐요" rows={raid}
            href={routeHash('pve')} labels={dex.FORM_LABELS} onOpen={onOpen} />
        </div>
        <span className="pick__foot">이름을 누르면 종족값·상성·활용처를 전부 볼 수 있어요</span>
      </section>

      {/* 줄이 없으면 스스로 아무것도 그리지 않는다 — 집계 전이거나 GA 가 조용할 때 */}
      <HotSearch onOpen={onOpen} />

      <section className="home__features" aria-label="서비스 기능">
        <div className="home__section">
          <h3>무엇이 필요한가요?</h3>
          <span>목적에 맞는 화면으로 바로 가요</span>
        </div>
        <div className="home__service-grid">
          {ROUTE_GROUPS.map(([id, label, desc]) => (
            <section key={id} className={`home__service-group home__service-group--${id}`}>
              <div className="home__group-head">
                <img className="home__starter" src={`${import.meta.env.BASE_URL}sprites/${STARTER[id]}.png`}
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
          <span>게임에서 무엇이 바뀌었는지 확인한 것만 적어요</span>
        </div>
        {/* 제목만 있는 <li> 줄이 아니라 요약과 두 날짜를 든 카드다 — '무엇이 언제 바뀌나' 가 제목만으로는 안 읽힌다 */}
        <div className="home-updates__list">
          {top.map((row) => (
            <button key={row.id} className="home-updates__item"
              onClick={() => { location.hash = `#/game-updates/${row.id}`; }}>
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
            href={routeHash('game-updates')} />
        </div>
      </section>
    </>
  );
}
