// ─────────────────────────────────────────────────────────────────────────────
// components/MonCard.tsx — v6 포켓몬 카드 한 장 (피그마 'Pokémon card' 272×282)
//
// 번호 · 순위 배지 · ☆ · 몬스터볼 틀 위 그림 · 이름 · 타입 · 메타 한 줄. 홈 · 도감 · 순위 · 레이드 · 알 · 내 포켓몬이 같은 카드를 쓴다 —
// 화면마다 카드를 새로 그리면 한 곳만 고쳐진다 (CLAUDE.md §3). 누르면 요약 팝업(onOpen), ☆ 는 즐겨찾기(lib/useFavs.ts) 다.
// 타입 이름은 도감 묶음의 TYPE_KO 로 적는다 — 묶음이 아직 안 왔으면 영문 키를 그대로 두지 않고 비운다(§1).
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { BASE } from '../lib/base';
import { useDexSoft } from '../lib/data';
import { useFavs } from '../lib/useFavs';
import type { OpenMon } from '../lib/mon';

export interface MonCardProps {
  sprite: number;
  /** 도감 번호 — ☆ 와 '#006' 에 쓴다. 폼 번호(10000대)면 원종 번호를 넘긴다 */
  dex?: number;
  name: string;
  en?: string;
  types?: readonly string[];
  /** 아래 초록 한 줄 — '최대 CP 3,266 · 활용 순위 12위' 처럼 실제 값으로 */
  meta?: ReactNode;
  /** 순위 배지 '01' — 순위표에서만 */
  rank?: number;
  /** 카드 머리에 더 얹을 배지 (미구현 · 메가 등) */
  badges?: ReactNode;
  /** ☆ 를 그릴지 — 기본 true. 즐겨찾기 화면은 ★ 로 해제한다 */
  fav?: boolean;
  /** 즐겨찾기 지표의 출처 (GA fav_toggle 의 from) */
  from?: string;
  onOpen?: OpenMon;
  className?: string;
}

export default function MonCard({ sprite, dex, name, en, types = [], meta, rank, badges, fav = true, from = 'card', onOpen, className }: MonCardProps) {
  const dexData = useDexSoft();
  const favs = useFavs();
  const no = dex ?? (sprite < 10000 ? sprite : undefined);
  const typeKo = (key: string) => dexData?.TYPE_KO[key as keyof typeof dexData.TYPE_KO] ?? '';
  const typeLine = types.map(typeKo).filter(Boolean).join(' · ');
  const on = no !== undefined && favs.has(no);
  return (
    <article className={`px-mon px-skin px-drop${className ? ` ${className}` : ''}`} data-sprite={sprite}>
      <div className="px-mon__head">
        {no !== undefined ? <span className="px-mon__no">{`#${String(no).padStart(3, '0')}`}</span> : null}
        {rank !== undefined ? <span className="px-badge px-skin px-mon__rank">{String(rank).padStart(2, '0')}</span> : null}
        {badges}
        {fav && no !== undefined ? (
          <button type="button" className="px-mon__fav" aria-pressed={on} aria-label={on ? `${name} 즐겨찾기 해제` : `${name} 즐겨찾기`}
            onClick={(event) => { event.stopPropagation(); favs.toggle(no, from); }}>
            {on ? '★' : '☆'}
          </button>
        ) : null}
      </div>
      {/* 카드 본문이 곧 단추다 — ☆ 는 위에서 따로 멈춘다 */}
      <button type="button" className="px-mon__body" onClick={() => onOpen?.({ sprite, name, en, types: [...types] })} aria-label={`${name} 상세 보기`}>
        <span className="px-mon__art"><span className="px-ball"><img src={`${BASE}sprites/${sprite}.png`} alt="" width="96" height="96" loading="lazy" decoding="async" /></span></span>
        <span className="px-mon__name">{name}</span>
        {typeLine ? <span className="px-mon__types">{typeLine}</span> : null}
        {meta ? <span className="px-mon__meta">{meta}</span> : null}
      </button>
    </article>
  );
}
