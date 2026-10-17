// ─────────────────────────────────────────────────────────────────────────────
// screens/Home.tsx — 서비스 홈 (v6 피그마 '01 · 서비스 홈')
//
// 풍경 히어로 → 주간 브리핑 + 체크포인트 → 많이 보는 포켓몬
// → 이번 주 보스(폭에 따라 1~3장 보이는 정보 Swiper)와 팀 만들기 → 용도별 상위(비주얼 왼쪽 + 순위 정보 오른쪽) → 게임 업데이트.
// 데이터는 전부 기존 훅(lib/useBossBoard · lib/hotMons · lib/weekBosses · lib/data)에서 온다 — 문구를 지어내지 않는다.
// 히어로는 데이터 없이 바로 서고(LCP), 그 아래만 기다린다. 보스 목록은 Swiper loop 로 순환하고 직접 넘길 수도 있다.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import { go } from '../lib/nav';
import { SPRITE_BASE } from '../lib/base';
import { ROUTE_EYEBROW, routeDesc, routeHref, type RouteDef } from '../routes';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { useMax, useUpdates, usePve, usePvp, useDex, useDexSoft } from '../lib/data';
import { BOARD_KIND_KO, BOARD_MAX, cardDday, type BossCard } from '../lib/bossBoard';
import { countersOf, useBossBoard, useCounterSource } from '../lib/useBossBoard';
import { useMaxSlidesSoft } from '../lib/weekBosses';
import { useHotMons } from '../lib/hotMons';
import { reasonFor } from '../lib/bossBoard';
import { useGamedaySoft } from '../lib/data';
import { maxVisible } from '../lib/maxVisible';
import { count, num } from '../lib/cell';
import { dexNoOf as dexNo } from '../lib/mon';
import { track } from '../lib/track';
import { UPDATE_CATS } from '../lib/notes';
import type { OpenMon } from '../lib/mon';
import MonCard, { PokemonNumberRibbon } from '../components/MonCard';
import { PixelIcon } from '../components/PixelIcon';
import { TankPopupEntry, NOV_TANK_LIVE } from '../components/TankPopup';

/** 몬스터볼 틀 위 그림 — 카드 밖(브리핑 · 팀 CTA · 용도별)에서 쓰는 작은 조각 */
function Ball({ sprite, size = 'md', onClick, label }: { sprite: number; size?: 'sm' | 'md' | 'lg'; onClick?: () => void; label?: string }) {
  const cls = `px-ball${size === 'sm' ? ' px-ball--sm' : size === 'lg' ? ' px-ball--lg' : ''}`;
  const img = <img src={`${SPRITE_BASE}${sprite}.png`} alt="" width="96" height="96" loading="lazy" decoding="async" />;
  if (!onClick) return <span className={cls}>{img}</span>;
  return <button type="button" className={`${cls} home__ball-btn`} aria-label={label} onClick={onClick}>{img}</button>;
}

// 내보내는 이유는 검사 하나뿐이다(lockgate.test) — 잠긴 줄이 흐려지고 🔒 가 붙는지 본다
export function Tile({ route }: { route: RouteDef }) {
  const reason = useLockReason(route.id);
  const lock = lockedAttrs(reason);
  return (
    <a className={`px-btn px-skin home__tile${lock.className}`} {...(lock.inert ? {} : { href: `/${route.path}` })} data-route={route.id}
      title={reason ? lock.title : routeDesc(route.id)}
      {...(lock['aria-disabled'] ? { 'aria-disabled': lock['aria-disabled'] } : {})}
      {...(route.id === 'planner' ? { id: 'home-tile-planner' } : {})}>
      <strong>{route.nav}</strong><span aria-hidden="true">→</span>
    </a>
  );
}

/** 브리핑 한 장의 글 — 종류에 따라 가는 곳이 다르다. 맥스는 D-MAX, 레이드는 레이드 보스 · 솔플 계산기 */
function briefingOf(card: BossCard): { title: string; body: string; primary: [string, string]; secondary: [string, string] } {
  const max = card.battle === 'max';
  const kind = BOARD_KIND_KO[card.kind];
  const name = card.form ? `${card.form} ${card.name}` : card.name;
  return {
    title: `${kind}, ${name}에 도전하세요.`,
    body: max
      ? `${card.when} · ${kind}. 보스 타입에 맞는 딜러와 탱커를 확인하고 나만의 맥스 팀을 준비해 보세요.`
      : `${card.when} · ${kind}. 추천 카운터와 포획 CP를 확인하고 나만의 공략 팀을 준비해 보세요.`,
    primary: max ? ['D-MAX 순위 보기 →', routeHref('dmax')] : ['레이드 보스 보기 →', routeHref('raids')],
    secondary: max ? ['D-MAX 덱 짜기', routeHref('dmax-deck')] : ['솔플 가능할까?', routeHref('pve-solo')],
  };
}

/** 주간 브리핑 — 이번 주 보스 판(lib/bossBoard)을 한 장씩. 저절로 넘기지 않는다(움직임 없이도 읽힌다) */
function Briefing({ board, onOpen }: { board: BossCard[]; onOpen: OpenMon }) {
  const cards = board.slice(0, 3);
  const [index, setIndex] = useState(0);
  useEffect(() => { if (index >= cards.length) setIndex(0); }, [cards.length, index]);
  const card = cards[index];
  if (!card) {
    return (
      <section className="home__brief px-skin px-drop px-panel" aria-label="주간 브리핑">
        <span className="px-badge px-skin px-badge--mint">WEEKLY BRIEFING</span>
        <h2 className="px-heading">이번 주 보스 일정을 준비하고 있어요.</h2>
        <p className="px-body px-muted">일정이 발표되면 추천 카운터와 포획 CP를 여기서 바로 확인할 수 있어요.</p>
        <div className="home__brief-actions">
          <a className="px-btn px-btn--primary px-skin" href={routeHref('schedule')}>이벤트 일정 보기 →</a>
          <a className="px-btn px-skin" href={routeHref('raids')}>레이드 보스</a>
        </div>
      </section>
    );
  }
  const text = briefingOf(card);
  const pager = cards.map((_, at) => (at === index ? '━━━━━' : '─────')).join('  ');
  return (
    <section className="home__brief px-skin px-drop px-panel" aria-label="주간 브리핑" aria-roledescription="배너">
      <span className="px-corner" aria-hidden="true" />
      <span className="px-badge px-skin px-badge--mint">WEEKLY BRIEFING</span>
      <div className="home__brief-row">
        <div className="home__brief-copy">
          <h2 className="px-heading">{text.title}</h2>
          <p className="px-body px-muted">{text.body}</p>
        </div>
        <Ball sprite={card.sprite} size="lg" label={`${card.detailName} 상세 보기`}
          onClick={() => { track('week_boss_open', { boss: card.detailName, kind: card.kind }); onOpen({ sprite: card.sprite, name: card.detailName, types: card.types, boss: card.kind }); }} />
      </div>
      <div className="home__brief-actions">
        <a className="px-btn px-btn--primary px-skin" href={text.primary[1]} onClick={() => track('home_cta', { to: text.primary[1] })}>{text.primary[0]}</a>
        <a className="px-btn px-skin" href={text.secondary[1]} onClick={() => track('home_cta', { to: text.secondary[1] })}>{text.secondary[0]}</a>
      </div>
      <div className="home__brief-pager px-mono" aria-label={`${cards.length}장 중 ${index + 1}번째`}>
        <span aria-hidden="true">{`${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}    ${pager}`}</span>
        {cards.length > 1 ? (
          <span className="home__brief-nav">
            <button type="button" className="px-btn px-btn--sm px-skin" aria-label="이전 보스" onClick={() => setIndex((at) => (at + cards.length - 1) % cards.length)}>‹</button>
            <button type="button" className="px-btn px-btn--sm px-skin" aria-label="다음 보스" onClick={() => setIndex((at) => (at + 1) % cards.length)}>›</button>
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** 이번 주 체크포인트 — 진행 중인 맥스 배틀과 다음 주 (lib/weekBosses 의 맥스 장) */
function Checkpoint() {
  const slides = useMaxSlidesSoft();
  const now = slides.find((slide) => slide.live) ?? slides[0];
  const next = slides.find((slide) => slide !== now && !slide.live);
  const nameOf = (slide: typeof now) => slide?.bosses.map((boss) => boss.name).join(' · ') || '보스 발표 전';
  return (
    <aside className="home__check px-skin px-drop px-panel" aria-label="이번 주 체크포인트">
      <h2 className="px-heading">이번 주 체크포인트</h2>
      <hr className="px-divider" />
      {now ? (
        <>
          <span className="px-badge px-skin">{now.live ? 'NOW · 맥스 배틀' : `D-${now.days} · 맥스 배틀`}</span>
          <h3 className="px-heading">{nameOf(now)}</h3>
          <p className="px-caption">{`${now.when} · 한국 기준${now.hours ? ` · ${now.hours}` : ''}`}</p>
          <p className="px-body px-muted">참가할 팀을 미리 준비하세요.</p>
          <a className="px-btn px-btn--block px-skin" href={routeHref('dmax-deck')} onClick={() => track('home_cta', { to: 'dmax-deck' })}>D-MAX 덱 짜기 ↗</a>
        </>
      ) : (
        <p className="px-body px-muted">맥스 배틀 일정을 기다리고 있어요. 발표되면 보스와 준비할 팀을 여기서 알려 드려요.</p>
      )}
      <hr className="px-divider" />
      {next ? (
        <>
          <p className="px-sub home__check-next">{`다음 주 · ${nameOf(next)}`}</p>
          <a className="px-caption home__check-more" href={routeHref('schedule')}>{`${next.when}   일정에서 더 보기 →`}</a>
        </>
      ) : (
        <a className="px-caption home__check-more" href={routeHref('schedule')}>일정에서 더 보기 →</a>
      )}
    </aside>
  );
}

/** 지금 많이 보는 포켓몬 — 넷. 줄이 모자라면 맥스 보스 칩으로 채운다 (lib/hotMons) */
function HotFour({ onOpen }: { onOpen: OpenMon }) {
  const { rows, caption, fill } = useHotMons();
  const { board, nowMs } = useBossBoard();
  const gameday = useGamedaySoft();
  const dexSoft = useDexSoft();
  const whyOf = (dex: number) => reasonFor(board, gameday?.GAMEDAY.events, dex, nowMs);
  const dexNoOf = (sprite: number) => (dexSoft ? dexNo(sprite, dexSoft.DEX_DATA.dex) ?? undefined : (sprite < 10000 ? sprite : undefined));
  const shown = rows.slice(0, 4);
  const filler = fill.slice(0, Math.max(0, 4 - shown.length));
  if (!shown.length && !filler.length) return null;
  return (
    <section className="home__hot" aria-label="지금 많이 보는 포켓몬">
      <h2 className="px-sec"><span className="px-heading">지금 많이 보는 포켓몬</span><span className="px-sec__note">{caption}</span></h2>
      <div className="px-grid">
        {shown.map((row, index) => (
          <MonCard key={row.dex} sprite={row.dex} dex={row.dex} rank={index + 1} name={row.name} types={row.types} from="home_hot"
            meta={whyOf(row.dex) || '육성 · 순위 · 진화 한 번에 보기'}
            onOpen={(pick) => { track('hot_mon_open', { sprite: row.dex, rank: index + 1 }); onOpen({ ...pick, via: 'dex' }); }} />
        ))}
        {filler.map((boss) => (
          <MonCard key={`fill-${boss.sprite}`} sprite={boss.sprite} dex={dexNoOf(boss.sprite)} name={boss.detailName} types={boss.types} from="home_hot"
            meta={boss.gmax ? '거다이맥스 보스 · 이번 주' : '다이맥스 보스 · 이번 주'}
            onOpen={(pick) => onOpen({ ...pick, via: 'dex' })} />
        ))}
      </div>
    </section>
  );
}

/** 이번 주 보스 — 폭에 따라 1~3장을 보여 주는 순환형 Swiper. 왼쪽 그림, 오른쪽 일정·추천 정보; 선택하면 보스 상세를 연다. */
export function WeekList({ board, onOpen }: { board: BossCard[]; onOpen: OpenMon }) {
  const src = useCounterSource();
  const rows = board.slice(0, BOARD_MAX);
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  return (
    <section className="home__week px-skin px-drop px-panel" aria-label="이번 주 보스">
      <h2 className="px-sec">
        <span className="px-heading">이번 주 보스</span>
        {rows.length ? <span className="home__week-summary px-caption">{rows.length}개 일정{rows.length > 1 ? ' · 자동 순환' : ''}</span> : null}
        {rows.length > 1 ? (
          <span className="home__week-controls" aria-label="보스 슬라이드 조작">
            <button type="button" className="px-btn px-btn--sm px-skin" aria-label="이전 보스" onClick={() => swiper?.slidePrev()}>←</button>
            <button type="button" className="px-btn px-btn--sm px-skin" aria-label="다음 보스" onClick={() => swiper?.slideNext()}>→</button>
          </span>
        ) : null}
        <a className="px-sec__more" href={routeHref('schedule')}>전체 일정 ↗</a>
      </h2>
      {rows.length ? (
        <div className="home__week-carousel">
          <Swiper
            className="home__week-swiper"
            modules={[A11y, Autoplay, Keyboard]}
            onSwiper={setSwiper}
            loop={rows.length > 1}
            autoplay={rows.length > 1 ? { delay: 4800, disableOnInteraction: false, pauseOnMouseEnter: true } : false}
            keyboard={{ enabled: true, onlyInViewport: true }}
            speed={450}
            slidesPerView="auto"
            spaceBetween={12}
            a11y={{ prevSlideMessage: '이전 보스', nextSlideMessage: '다음 보스' }}
          >
          {rows.map((card) => {
            const counter = countersOf(src, card.battle, card.types, 1)?.rows[0];
            return (
              <SwiperSlide key={card.id} className="home__week-slide home__week-row">
                <PokemonNumberRibbon dex={card.dex} />
                <div className="home__week-panel px-skin px-skin--sunk">
                  <button type="button" className="home__week-boss" onClick={() => { track('week_boss_open', { boss: card.detailName, kind: card.kind }); onOpen({ sprite: card.sprite, name: card.detailName, types: card.types, boss: card.kind }); }}>
                    <span className="home__week-art"><Ball sprite={card.sprite} size="lg" /></span>
                    <span className="home__week-text">
                      <b className="px-sub">{card.form ? `${card.form} ${card.name}` : card.name}</b>
                      <span className="home__week-meta">
                        <span className="px-caption">{BOARD_KIND_KO[card.kind]}</span>
                        <span className={`home__week-status px-badge px-skin px-badge--ko${card.live ? '' : ' px-badge--muted'}`}>{cardDday(card)}</span>
                      </span>
                      <span className="home__week-when px-caption">
                        <span>{card.short}</span>{card.hours ? <span>{card.hours}</span> : null}
                      </span>
                    </span>
                  </button>
                  {counter ? (
                    <button type="button" className="home__week-rec" title={`추천 · ${counter.name}`}
                      onClick={() => { track('week_boss_rec', { boss: card.detailName, mon: counter.name }); onOpen({ sprite: counter.sprite, name: counter.name, en: counter.en, types: counter.types }); }}>
                      <span className="home__week-rec-label px-caption">추천</span>
                      <img className="home__week-rec-sprite" src={`${SPRITE_BASE}${counter.sprite}.png`} alt="" width="32" height="32" loading="lazy" decoding="async" />
                      <span className="home__week-rec-name px-caption">{counter.name}</span>
                    </button>
                  ) : null}
                </div>
              </SwiperSlide>
            );
          })}
          </Swiper>
        </div>
      ) : <p className="px-body px-muted">이번 주 보스 일정이 아직 없어요. 발표되면 여기에 추천 포켓몬과 함께 올라와요.</p>}
    </section>
  );
}

/** 홈 — 히어로는 데이터 없이 바로 서고, 그 아래(브리핑 · 카드 · 추천)만 기다린다 */
export default function Home({ onOpen }: { onOpen: OpenMon }) {
  const { board } = useBossBoard();
  return (
    <div className="home" id="home">
      <section className="home__hero" aria-label="소개">
        <p className="px-eyebrow" data-i18n="off">{ROUTE_EYEBROW.home}</p>
        <h2 className="px-display home__title">모험은,<br />여기서 시작돼요.</h2>
        <p className="px-body home__lead">숲을 지나, 새로운 배틀로.<br />오늘의 일정과 나만의 팀을 준비하세요.</p>
        <div className="home__hero-actions">
          <a className="px-btn px-btn--primary px-skin" href={routeHref('schedule')} onClick={() => track('home_cta', { to: 'schedule' })}>오늘의 모험 보기 →</a>
          <a className="px-btn px-skin" href={routeHref('dex')} onClick={() => track('home_cta', { to: 'dex' })}>포켓몬 도감</a>
        </div>
      </section>

      <div className="home__adventure">
        <Briefing board={board} onOpen={onOpen} />
        <Checkpoint />
      </div>

      <HotFour onOpen={onOpen} />

      {/* 기다리는 자리도 한 화면을 채운다 — 바닥글이 먼저 보였다가 밀리면 CLS 다 */}
      <Suspense fallback={<div className="home__loading px-skel" aria-busy="true" />}>
        <HomeData board={board} onOpen={onOpen} />
      </Suspense>
    </div>
  );
}

/** 데이터가 있어야 그리는 아래쪽 — 보스 목록 · 팀 만들기 · 용도별 상위 · 소식 */
function HomeData({ board, onOpen }: { board: BossCard[]; onOpen: OpenMon }) {
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const { data: dex } = useDex();
  const { data: updates } = useUpdates();

  // 미구현 · 맥스 참가 종은 뺀다 — 홈은 '지금 셀 수 있는 셋' 을 보여 주는 자리다 (2026-09-17 제보)
  const dmaxTop = useMemo(() => maxVisible(max.DMAX_TIER['overall']).slice(0, 3), [max]);
  const pveTop = (pve.PVE_DATA['overall'] ?? []).slice(0, 3);
  const pvpTop = (pvp.PVP_DATA['great'] ?? pvp.PVP_DATA[Object.keys(pvp.PVP_DATA)[0] as keyof typeof pvp.PVP_DATA] ?? []).slice(0, 3);
  const featured = updates.GAME_UPDATES.filter((row) => row.featured);
  const latest = (featured.length ? featured : updates.GAME_UPDATES)[0];
  const typeKo = (key: string | undefined) => (key ? dex.TYPE_KO[key as keyof typeof dex.TYPE_KO] ?? '' : '');

  const shortcuts = [
    { id: 'dmax', title: 'D-MAX', sub: '맥스 기술 · 딜러와 탱커', row: dmaxTop[0], rank: dmaxTop.length ? 1 : undefined, href: routeHref('dmax') },
    { id: 'pve', title: '레이드 · PvE', sub: 'DPS · TDO로 비교', row: pveTop[0], rank: pveTop.length ? 1 : undefined, href: routeHref('pve') },
    { id: 'pvp', title: '배틀 · PvP', sub: '리그별 추천과 기술', row: pvpTop[0], rank: pvpTop[0]?.rank, href: routeHref('pvp') },
  ];

  return (
    <>
      <div className="home__week-row2" id="home-more">
        <WeekList board={board} onOpen={onOpen} />
        <section className="home__team px-skin px-drop px-panel" aria-label="나만의 배틀 팀 만들기">
          <span className="px-corner" aria-hidden="true" />
          <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">READY, TRAINER?</p>
          <h2 className="px-heading">나만의 배틀 팀 만들기</h2>
          <p className="px-body px-muted">상대에 맞는 딜러와 탱커를 골라<br />세 마리의 균형을 완성하세요.</p>
          <div className="home__team-balls">
            {dmaxTop.map((row) => <Ball key={row.sprite} sprite={row.sprite} label={`${row.name} 상세 보기`} onClick={() => onOpen({ sprite: row.sprite, name: row.name, en: row.en, types: row.types })} />)}
          </div>
          <a className="px-btn px-btn--primary px-btn--block px-skin" href={routeHref('dmax-deck')} onClick={() => track('home_cta', { to: 'dmax-deck' })}>D-MAX 덱 짜기 →</a>
          <div className="home__team-links" aria-label="일정과 레이드 바로가기">
            <a href={routeHref('raids')}><span><b>레이드 보스</b><small>현재 보스와 추천 포켓몬</small></span><span aria-hidden="true">↗</span></a>
            <a href={routeHref('schedule')}><span><b>이벤트 일정</b><small>날짜별 진행 일정을 확인</small></span><span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </div>
      {NOV_TANK_LIVE ? <div className="portal-prep-note"><TankPopupEntry onOpen={onOpen} compact /></div> : null}

      <section className="home__ranks" aria-label="용도별 상위 포켓몬">
        <h2 className="px-sec"><span className="px-heading">용도별 상위 포켓몬</span><span className="px-sec__note">어디에서 활약하는지 먼저 확인하세요.</span></h2>
        <div className="px-grid px-grid--3">
          {shortcuts.map((one) => (
            <article key={one.id} className="home__rank" data-kind={one.id}>
              {one.row ? <PokemonNumberRibbon rank={one.rank} dex={dexNo(one.row.sprite, dex.DEX_DATA.dex) ?? undefined} /> : null}
              <div className="home__rank-panel px-skin px-drop px-card">
                <div className="home__rank-art" aria-hidden={!one.row}>
                  <span className="home__rank-kind px-caption">{one.title}</span>
                  {one.row ? <Ball sprite={one.row.sprite} size="lg" label={`${one.row.name} 상세 보기`} onClick={() => onOpen({ sprite: one.row!.sprite, name: one.row!.name, en: one.row!.en, types: one.row!.types })} /> : <span className="home__rank-art-empty" />}
                  {one.rank ? <span className="home__rank-place px-mono">TOP {String(one.rank).padStart(2, '0')}</span> : null}
                </div>
                <div className="home__rank-details">
                  <div className="home__rank-copy">
                    <h3 className="px-sub">{one.row?.name ?? one.title}</h3>
                    {one.row ? <p className="px-caption">{one.row.types.map(typeKo).filter(Boolean).join(' · ')}</p> : null}
                  </div>
                  <p className="px-caption">
                    {one.sub}
                    {one.id === 'pve' && one.row && 'dps' in one.row ? ` · DPS ${num(one.row.dps, 1)}` : ''}
                    {one.id === 'dmax' && one.row && 'charged' in one.row ? ` · ${typeKo(one.row.charged)} 맥스` : ''}
                    {one.id === 'pvp' && one.row && 'score' in one.row ? ` · ${count(one.row.score)}점` : ''}
                  </p>
                  <a className="px-btn px-btn--block px-skin" href={one.href} onClick={() => track('home_cta', { to: one.id })}>순위 보기 →</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home__news" aria-label="게임 업데이트">
        <h2 className="px-sec"><span className="px-heading">게임 업데이트</span><span className="px-sec__note">모험 전에 확인해 두세요.</span><a className="px-sec__more" href={routeHref('game-updates')}>전체 보기 ↗</a></h2>
        {latest ? (
          <button type="button" className="home__news-card px-skin px-drop px-card px-card--tap" onClick={() => { go(`/game-updates/${latest.id}`); }}>
            <span className="home__news-cats">{(latest.category ?? []).map((key) => <span key={key} className="px-badge px-skin px-badge--ko px-badge--muted">{UPDATE_CATS[key] ?? key}</span>)}</span>
            <b className="px-sub">{latest.title}</b>
            {latest.summary ? <span className="px-body px-muted">{latest.summary}</span> : null}
            <span className="px-caption">{[latest.announcedAt || latest.date ? `발표 ${latest.announcedAt || latest.date}` : '', latest.effectiveAt ? `적용 ${latest.effectiveAt}` : ''].filter(Boolean).join(' · ')}</span>
          </button>
        ) : <p className="px-body px-muted">새 소식이 올라오면 여기에 먼저 보여 드려요.</p>}
      </section>
      <span className="home__arrow-hint" hidden><PixelIcon name="arrow" /></span>
    </>
  );
}
