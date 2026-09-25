// ─────────────────────────────────────────────────────────────────────────────
// components/MaxPoster.tsx — 홈 배너 한 장 (2026-09-23)
//
// **모든 장이 대표 일러스트와 같은 구도다** — 그림 한 판 + 아래 캡션(날짜·종류 / 보스 / 시간).
// 첫 시안은 일정 장만 카드(머리줄·알약·단추)라 일러스트 장과 딴 판처럼 보였다 (제보).
//
// 그림은 일정마다 `lib/heroArt.ts` MAX_ART 에서 찾는다. 없으면 보스 도트로 같은 구도의 장면을 세운다 —
// 어두운 판 위 보스의 타입색 빛, 발밑 땅, 오른쪽 위 상대 자리(일러스트의 프리져 자리).
//
// Swiper 를 안 부른다 — 슬라이더를 받는 동안 홈이 이 장 하나를 그대로 세운다 (Home.tsx)
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, type CSSProperties } from 'react';
import type { MaxArt } from '../lib/heroArt';
import { dday, type MaxSlide } from '../lib/maxSlides';
import { routeHref } from '../routes';
import { track } from '../lib/track';
import { Sprite } from './Bits';

/** '프리져 · 썬더 · 파이어 다이맥스' · '거다이맥스 에이스번' — 이름 하나는 안 쪼개고 사이에서만 줄을 바꾼다 */
function BossLine({ slide }: { slide: MaxSlide }) {
  if (!slide.bosses.length) return <>보스 발표 전</>;
  return (
    <>
      {slide.gmax ? <><span>거다이맥스</span>{' '}</> : null}
      {slide.bosses.map((boss, index) => (
        <Fragment key={boss.dex}>{index ? ' · ' : ''}<span>{boss.name}</span></Fragment>
      ))}
      {slide.gmax ? null : <>{' '}<span>다이맥스</span></>}
    </>
  );
}

/** 그림 없이 서는 대표 일러스트 — 일정이 오기 전, 또는 그림이 붙은 일정이 다 지난 뒤 */
/** 좁은 화면에서 그림의 어느 자리를 보일지 — 값은 그림마다 다르고 CSS(cinema/home.css)가 좁은 화면에서만 읽는다 */
function focusStyle(art: MaxArt): CSSProperties {
  return { ['--hero-focus']: art.focus } as CSSProperties;
}

export function HeroPoster({ art, names, note }: {
  art: MaxArt;
  names: Readonly<Record<string, string>> | undefined;
  /** 캡션 한 줄 — 비우면 자리만 잡는다 (일정이 오면 같은 자리에 찬다) */
  note?: string;
}) {
  return (
    <figure className="max-hero">
      <img src={art.src} srcSet={art.srcSet} sizes={art.sizes} alt={names ? art.alt(names) : ''}
        width={art.width} height={art.height} style={focusStyle(art)} fetchPriority="high" decoding="async" />
      <figcaption>{note ? <small>{note}</small> : null}</figcaption>
    </figure>
  );
}

/** 맥스 일정 한 장 — 누르면 D-MAX 티어표 */
export function MaxPoster({ slide, art, names, first }: {
  slide: MaxSlide;
  art: MaxArt | undefined;
  names: Readonly<Record<string, string>> | undefined;
  /** 첫 장만 첫 그림(LCP)으로 서두른다 */
  first?: boolean;
}) {
  // 장면의 빛은 첫 보스의 첫 타입 — 게임 원작 타입색(--t-*)을 바꾸지 않고 판 위 빛으로만 쓴다 (§1-b)
  const tint = slide.bosses[0]?.types[0];
  const style = tint ? ({ ['--tint']: `var(--t-${tint})` } as CSSProperties) : undefined;
  return (
    <a className="max-poster" href={routeHref('dmax')} onClick={() => track('home_cta', { to: 'dmax' })}>
      <figure className={`max-hero${art ? '' : ' max-hero--scene'}`} style={style}>
        {art ? (
          <img src={art.src} srcSet={art.srcSet} sizes={art.sizes} alt={names ? art.alt(names) : ''}
            width={art.width} height={art.height} style={focusStyle(art)} decoding="async"
            {...(first ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })} />
        ) : (
          <span className="max-scene" data-count={Math.min(slide.bosses.length, 3)} aria-hidden="true">
            {slide.bosses.slice(0, 3).map((boss) => <Sprite key={boss.dex} id={boss.sprite} className="max-scene__mon" />)}
          </span>
        )}
        <span className="max-poster__tags">
          <span className={`max-poster__badge${slide.gmax ? ' is-gmax' : ''}`}>{slide.gmax ? 'G-MAX' : 'D-MAX'}</span>
          <span className={`max-poster__dday${slide.live ? ' is-live' : ''}`}>{dday(slide)}</span>
        </span>
        <figcaption>
          <span>{slide.short} · {slide.label}</span>
          <b><BossLine slide={slide} /></b>
          {slide.hours ? <small>{slide.hours}</small> : null}
        </figcaption>
      </figure>
    </a>
  );
}
