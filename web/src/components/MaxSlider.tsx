// ─────────────────────────────────────────────────────────────────────────────
// components/MaxSlider.tsx — 홈 배너를 굴린다 (Swiper, 2026-09-23)
//
// **아직 안 끝난 다이맥스·거다이맥스 일정이 한 장씩** 선다 (lib/maxSlides.ts). 장의 모양은 components/MaxPoster.tsx —
// 여기는 넘기기만 한다.
//
// Swiper 는 이 파일에서만 부른다 — 홈에서만 쓰는 30KB 를 모든 화면의 첫 묶음에 싣지 않으려고
// Home.tsx 가 lazy 로 부르고, 받는 동안은 일러스트 한 장이 같은 자리에 선다.
//
// 저절로 넘어가는 판은 **멈출 단추**가 있어야 한다 (WCAG 2.2.2) — 손으로 넘기거나 올려 두면 쉬고,
// 움직임 줄이기를 켠 사람에게는 처음부터 안 넘긴다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, Keyboard, Pagination } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import type { MaxSlide } from '../lib/maxSlides';
import { useDexSoft } from '../lib/data';
import { spriteSrc } from '../lib/sprite';

// 한 장에 머무는 시간 — 보스 이름과 날짜 두 줄을 읽기에 넉넉하게
const DELAY = 5000;

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export default function MaxSlider({ items, slides }: {
  /** 장마다 그려진 판 (components/MaxPoster.tsx) — 첫 장이 홈이 받는 동안 세워 둔 그 장이다 */
  items: readonly { key: string; node: ReactNode }[];
  /** 뒤 장 보스 그림을 미리 받는 데만 쓴다 */
  slides: readonly MaxSlide[];
}) {
  const swiper = useRef<SwiperCore | null>(null);
  const [still] = useState(reducedMotion);
  const [playing, setPlaying] = useState(!still);
  const progress = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const total = items.length;
  const [active, setActive] = useState(0);

  // 탭은 두 칸(넓으면 네 칸)만 보인다 — 여덟 칸을 한 줄에 다 세우면 글자가 '프‥' 로 잘려 하나도 안 읽힌다 (2026-09-25 제보).
  // 넘어간 장의 탭을 맨 왼쪽으로 당겨 지금 장과 다음 장이 늘 보이게 한다. 페이지는 안 움직이게 띠만 민다
  useEffect(() => {
    const row = strip.current;
    const tab = row?.children[active] as HTMLElement | undefined;
    if (!row || !tab) return;
    row.scrollTo({ left: tab.offsetLeft, behavior: still ? 'auto' : 'smooth' });
  }, [active, still]);

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
        onAutoplayTimeLeft={(_, __, remaining) => { progress.current?.style.setProperty('--banner-progress', String(1 - remaining)); }}
        onSlideChange={(instance) => setActive(instance.realIndex)}
        slidesPerView={1}
        // 세로로 넘기다 손가락이 조금만 옆으로 가도 장이 끌려 옆 장이 삐져나왔다 — 8px 까지는 끌지 않는다
        threshold={8}
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
        {items.map((item) => <SwiperSlide key={item.key}>{item.node}</SwiperSlide>)}
      </Swiper>
      {/* 일정 탭 — 장마다 하나. 누르면 그 장으로 가고 넘기기를 멈춘다 */}
      {/* 위 막대가 다음 장까지 남은 시간이다 — 저절로 넘어간다는 것을 눈에 보이게 한다 */}
      <div ref={progress} className="portal-banner-nav">
        {still ? null : (
          <div className="portal-banner-bar" aria-hidden="true">
            <span className="banner-progress"><i /></span>
            <span className="portal-banner-count">{String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
          </div>
        )}
        <div ref={strip} className="portal-banner-tabs" aria-label="배너 선택">
          {items.map((item, index) => {
            const slide = slides.find((row) => row.id === item.key);
            return (
              <button key={item.key} type="button" aria-pressed={active === index}
                onClick={() => { swiper.current?.slideToLoop(index); setPlaying(false); }}>
                <small>{slide?.short ?? 'BATTLE GUIDE'}</small>
                <strong>{slide?.bosses.map((boss) => boss.name).join(' · ') || '맥스 배틀 준비하기'}</strong>
              </button>
            );
          })}
        </div>
      </div>
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
