// ─────────────────────────────────────────────────────────────────────────────
// components/MaxSlider.tsx — 홈 배너를 굴린다 (Swiper, 2026-09-23)
//
// 첫 장은 늘 대표 일러스트다 — 첫 그림(LCP)이고 머리에서 미리 받는 그림이라 자리를 안 바꾼다.
// 그 뒤로 **아직 안 끝난 다이맥스·거다이맥스 일정이 한 장씩** 선다 (lib/maxSlides.ts).
//
// Swiper 는 이 파일에서만 부른다 — 홈에서만 쓰는 30KB 를 모든 화면의 첫 묶음에 싣지 않으려고
// Home.tsx 가 lazy 로 부르고, 받는 동안은 일러스트 한 장이 같은 자리에 선다.
//
// 저절로 넘어가는 판은 **멈출 단추**가 있어야 한다 (WCAG 2.2.2) — 손으로 넘기거나 올려 두면 쉬고,
// 움직임 줄이기를 켠 사람에게는 처음부터 안 넘긴다.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, Keyboard, Pagination } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import { dday, type MaxSlide } from '../lib/maxSlides';
import { routeHref } from '../routes';
import { track } from '../lib/track';
import { Sprite } from './Bits';
import { useDexSoft } from '../lib/data';
import { spriteSrc } from '../lib/sprite';

// 한 장에 머무는 시간 — 보스 이름과 날짜 두 줄을 읽기에 넉넉하게
const DELAY = 5000;

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function EventSlide({ slide, typeKo }: { slide: MaxSlide; typeKo: Readonly<Record<string, string>> }) {
  const lead = slide.bosses[0];
  // 슬라이드 색은 첫 보스의 첫 타입 — 게임 원작 타입색(--t-*)을 바꾸지 않고 판 위 빛으로만 쓴다 (§1-b)
  const tint = lead?.types[0];
  const style = tint ? ({ ['--tint']: `var(--t-${tint})` } as CSSProperties) : undefined;
  const types = [...new Set(slide.bosses.flatMap((boss) => boss.types))];
  return (
    <a className={`max-slide${slide.gmax ? ' max-slide--gmax' : ''}`} href={routeHref('dmax')} style={style}
      onClick={() => track('home_cta', { to: 'dmax' })}>
      <span className="max-slide__head">
        <span className="max-slide__badge">{slide.gmax ? 'G-MAX' : 'D-MAX'}</span>
        <span className="max-slide__kind">{slide.label}</span>
        <span className={`max-slide__dday${slide.live ? ' is-live' : ''}`}>{dday(slide)}</span>
      </span>
      <span className="max-slide__stage" aria-hidden="true" data-count={Math.min(slide.bosses.length, 3)}>
        {slide.bosses.slice(0, 3).map((boss) => <Sprite key={boss.dex} id={boss.sprite} className="max-slide__mon" />)}
      </span>
      <span className="max-slide__body">
        <b className="max-slide__name">
          {/* 이름 하나는 안 쪼개고 사이 칸에서만 줄을 바꾼다 — 셋이면 좁은 칸에서 글자마다 꺾였고, 통째로 묶으면 그림을 덮었다 */}
          {slide.bosses.length
            ? slide.bosses.map((boss, index) => (
              <Fragment key={boss.dex}>
                {index ? ' · ' : ''}
                {slide.gmax ? <><span>거다이맥스</span>{' '}</> : null}
                <span>{boss.name}</span>
              </Fragment>
            ))
            : '보스 발표 전'}
        </b>
        <span className="max-slide__when">{slide.when}</span>
        {slide.hours ? <small className="max-slide__hours">{slide.hours}</small> : null}
        {types.length ? (
          <span className="max-slide__types">
            {types.map((type) => (
              <span key={type} className="max-slide__type" style={{ ['--c']: `var(--t-${type})` } as CSSProperties}>
                {typeKo[type] ?? type}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <span className="max-slide__cta">티어표에서 준비하기<span aria-hidden="true"> →</span></span>
    </a>
  );
}

export default function MaxSlider({ hero, slides, typeKo }: {
  hero: ReactNode;
  slides: readonly MaxSlide[];
  typeKo: Readonly<Record<string, string>>;
}) {
  const swiper = useRef<SwiperCore | null>(null);
  const [still] = useState(reducedMotion);
  const [playing, setPlaying] = useState(!still);
  const total = slides.length + 1;

  // 뒤 장의 보스 그림을 미리 받는다 — 그림은 화면에 들어올 때 받는데(loading=lazy), 옆으로 숨은 장은
  // 넘어오는 그 순간에야 들어와 빈 칸이 먼저 보인다
  const dex = useDexSoft();
  useEffect(() => {
    if (!dex) return;
    const ids = new Set(dex.SPRITE_IDS);
    for (const boss of slides.flatMap((slide) => slide.bosses)) {
      const src = spriteSrc(boss.sprite, ids);
      if (src) new Image().src = src;
    }
  }, [dex, slides]);

  // 멈춤은 사람이 고른 것이다 — 마우스를 올렸다 내려도 다시 굴리지 않는다
  useEffect(() => {
    const auto = swiper.current?.autoplay;
    if (!auto) return;
    if (playing) auto.start(); else auto.stop();
  }, [playing]);

  return (
    <div className="max-slider">
      <Swiper
        modules={[A11y, Autoplay, Keyboard, Pagination]}
        onSwiper={(instance) => { swiper.current = instance; }}
        slidesPerView={1}
        loop={total > 2}
        speed={500}
        autoplay={still ? false : { delay: DELAY, disableOnInteraction: false, pauseOnMouseEnter: true }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        pagination={{ clickable: true }}
        a11y={{
          prevSlideMessage: '이전 배너',
          nextSlideMessage: '다음 배너',
          paginationBulletMessage: '{{index}}번째 배너로',
          slideLabelMessage: '{{index}} / {{slidesLength}}',
          containerRoleDescriptionMessage: '배너',
          itemRoleDescriptionMessage: '배너',
        }}
      >
        <SwiperSlide>{hero}</SwiperSlide>
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}><EventSlide slide={slide} typeKo={typeKo} /></SwiperSlide>
        ))}
      </Swiper>
      {/* 움직임 줄이기를 켠 사람에게는 처음부터 안 넘기므로 멈출 것도 없다 */}
      {still ? null : (
        <button type="button" className="max-slider__toggle"
          aria-label={playing ? '배너 넘기기 멈춤' : '배너 넘기기 다시 시작'}
          onClick={() => setPlaying((now) => !now)}>
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
        </button>
      )}
    </div>
  );
}
