// ─────────────────────────────────────────────────────────────────────────────
// screens/Planner.tsx — 🎒 내 포켓몬 (v3 planner/home.js 이식, v3.61.0 판)
//
// **일정이 먼저, 목록이 나중.** v3.4.0 에 ★ 목록 화면을 걷어낸 이유가
// "도감을 이름순으로 거른 것과 다르지 않아서" 였다. 그래서 목록이 맨 위면 안 된다 —
// 이 화면의 주인공은 📣 소식이고, ★ 목록은 그 소식이 누구 것인지 대는 자리다.
//
//   (0) 히어로        이 화면이 무엇인지 + 주 동작 하나(담으러 가기)
//   (1) 📣 다가오는 소식  담아 둔 종에 잡힌 일정
//   (2) ★ 담아 둔 포켓몬  소식이 걸린 줄에는 D-day 가 붙는다
//
// ★ 는 로그인하면 계정, 로그인 전이면 이 기기에 둔다 (lib/useFavs.ts).
// (3) 🎒 내 개체는 v3 에서도 스위치가 내려가 있다 (PLAN_MONS_ENABLED=false) — 옮기지 않았다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { useDex, useFavEvents } from '../lib/data';
import { useFavs } from '../lib/useFavs';
import { favNewsFor, favNewsList, favNewsWhen, FAV_NEWS_LABEL, type FavNewsRow } from '../lib/favnews';
import { Sprite } from '../components/Bits';
import { NameNode } from '../components/Row';
import { routeHref } from '../routes';
import { track } from '../lib/track';

/** 덩이 하나 — 제목 줄 + 내용. 비어 있을 때 할 말이 있어야 빈 칸이 안내가 된다 */
function Section({ icon, title, desc, children }: {
  icon: string; title: string; desc: string; children: ReactNode;
}) {
  return (
    <section className="plan__card plan__sec">
      <div className="plan__guide-head">
        <span className="plan__guide-ico" aria-hidden="true">{icon}</span>
        <div><b>{title}</b><span className="plan__summary-desc">{desc}</span></div>
      </div>
      {children}
    </section>
  );
}

/** 소식 카드 — 상세의 배지와 달리 여기서는 **누구인지**가 먼저다 (여러 마리가 한 줄씩 서므로) */
function NewsCard({ row, nameOf }: { row: FavNewsRow; nameOf: (dex: number) => string }) {
  return (
    <a className={`favnews__card${row.days <= 0 ? ' is-now' : ''}`} href="/schedule">
      <span className="favnews__mons">{row.dex.map((dex) => <Sprite key={dex} id={dex} />)}</span>
      <span className="favnews__main">
        <b className="favnews__who">{row.dex.map(nameOf).join(' · ')}</b>
        <span className="favnews__kind">{FAV_NEWS_LABEL[row.event.type] ?? '일정'}</span>
      </span>
      <span className={`favnews__when${row.days <= 0 ? ' is-now' : ''}`}>{favNewsWhen(row)}</span>
    </a>
  );
}

export default function Planner() {
  const { data: dex } = useDex();
  const { data: fav } = useFavEvents();
  const { favs, toggle } = useFavs();

  // 이름표에 없으면 번호를 그대로 쓴다 — 이름을 지어내지 않는다
  const nameOf = (id: number) => dex.DEX_DATA.names[String(id)] ?? `#${id}`;
  const news = favNewsList(fav.FAV_EVENTS, favs);

  return (
    <>
      <section className="plan__hero">
        <div className="plan__hero-head">
          <span className="plan__hero-ico" aria-hidden="true">🎒</span>
          <h2>즐겨찾기 포켓몬의 일정을 확인해 보세요</h2>
        </div>
        <p className="plan__hero-desc">
          포켓몬 상세에서 ★를 눌러 즐겨찾기에 추가해 보세요. 해당 포켓몬의 커뮤니티 데이·스포트라이트 아워·레이드 일정이 등록되면 아래에 표시돼요.
        </p>
        <a className="plan__hero-go" href={routeHref('dex')}>
          <span className="plan__hero-go-ico" aria-hidden="true">＋</span>
          도감에서 담을 포켓몬 찾기
          <span className="plan__hero-go-arrow" aria-hidden="true">›</span>
        </a>
      </section>

      <Section icon="📣" title="다가오는 소식" desc="즐겨찾기 포켓몬의 일정을 가까운 날짜순으로 보여 드려요.">
        {news.length
          ? <div className="favnews__list">{news.map((row, index) => <NewsCard key={index} row={row} nameOf={nameOf} />)}</div>
          : (
            <p className="empty">
              {favs.length
                ? '즐겨찾기 포켓몬의 예정된 일정이 없어요. 새 일정이 등록되면 여기에 표시돼요.'
                : '아직 담아 둔 포켓몬이 없어요. 도감에서 ★ 를 눌러 담아 보세요.'}
            </p>
          )}
      </Section>

      <Section icon="★" title={`담아 둔 포켓몬 ${favs.length}마리`} desc="이름을 누르면 상세 정보를 보고, ★를 다시 누르면 즐겨찾기에서 삭제할 수 있어요.">
        {favs.length
          ? (
            <div className="plan__fav-list">
              {favs.map((id) => {
                // 소식이 걸린 줄에만 D-day 를 붙인다 — '없음' 을 적으면 없는 줄이 있는 줄보다 눈에 띈다
                const soon = favNewsFor(fav.FAV_EVENTS, id)[0];
                return (
                  <div key={id} className="plan__fav-row">
                    <a className="plan__fav-go" href={`/mon/${id}`}>
                      <Sprite id={id} />
                      <span className="plan__fav-name"><NameNode name={nameOf(id)} labels={dex.FORM_LABELS} /></span>
                      {soon ? <span className={`tag plan__fav-when${soon.days <= 0 ? ' is-now' : ''}`}>{favNewsWhen(soon)}</span> : null}
                    </a>
                    <button className="plan__fav-off" aria-label={`${nameOf(id)} 즐겨찾기에서 빼기`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggle(id, '내 포켓몬');
                        track('fav_off', { mon: String(id), from: '내 포켓몬' });
                      }}>★</button>
                  </div>
                );
              })}
            </div>
          )
          : <p className="empty">[도감에서 담을 포켓몬 찾기]를 눌러 즐겨찾기를 추가해 보세요.</p>}
      </Section>
    </>
  );
}
