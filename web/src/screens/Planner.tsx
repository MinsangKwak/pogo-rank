// ─────────────────────────────────────────────────────────────────────────────
// screens/Planner.tsx — 🎒 내 포켓몬 (v6 피그마 15 '내 포켓몬' 판)
//
// **일정이 먼저, 목록이 나중.** v3.4.0 에 ★ 목록 화면을 걷어낸 이유가
// "도감을 이름순으로 거른 것과 다르지 않아서" 였다. 그래서 목록이 맨 위면 안 된다 —
// 이 화면의 주인공은 소식이고, ★ 목록은 그 소식이 누구 것인지 대는 자리다.
//
//   (0) 지표 판 둘 + 안내 판   담은 수 · 다가오는 일정 수 · 담는 법(도감으로 가는 단추)
//   (1) 관련 소식 카드          담아 둔 종에 잡힌 일정 — 진행 중 · D-day 배지와 기간
//   (2) 즐겨찾는 포켓몬 격자    공용 MonCard 4열(모바일 2열). ★ 를 다시 누르면 해제
//
// ★ 는 로그인하면 계정, 로그인 전이면 이 기기에 둔다 (lib/useFavs.ts).
// 🎒 내 개체는 v3 에서도 스위치가 내려가 있다 (PLAN_MONS_ENABLED=false) — 옮기지 않았다.
// ─────────────────────────────────────────────────────────────────────────────
import { useDex, useFavEvents } from '../lib/data';
import { useFavs } from '../lib/useFavs';
import { favNewsFor, favNewsList, favNewsWhen, FAV_NEWS_LABEL, type FavNewsRow } from '../lib/favnews';
import { count, DASH } from '../lib/cell';
import { Sprite } from '../components/Bits';
import MonCard from '../components/MonCard';
import { PxBadge, PxButton, PxMetric, PxNote, PxPanel, PxSectionHead } from '../components/PxParts';
import { PixelIcon } from '../components/PixelIcon';
import { routeHref } from '../routes';
import { go } from '../lib/nav';

/** 날짜 한 토막 — '10.12'. 못 읽는 날짜는 대시 (빈 값에 NaN 을 내지 않는다, CLAUDE.md §1) */
function dayOf(iso: string): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return DASH;
  return `${String(at.getMonth() + 1).padStart(2, '0')}.${String(at.getDate()).padStart(2, '0')}`;
}

/** 기간 한 줄 — '10.12–10.18'. 하루짜리는 날짜 하나만 */
function spanOf(row: FavNewsRow): string {
  const from = dayOf(row.event.start);
  const to = dayOf(row.event.end || row.event.start);
  return from === to ? from : `${from}–${to}`;
}

/** D-day 배지 — 진행 중은 빨강 채움, 다가오는 것은 민트. 지금 할 수 있는 일이 먼저 보인다 */
function WhenBadge({ row, className }: { row: FavNewsRow; className?: string }) {
  return <PxBadge ko tone={row.days <= 0 ? 'fill' : 'mint'} className={className}>{favNewsWhen(row)}</PxBadge>;
}

/** 소식 카드 — 상세의 배지와 달리 여기서는 **누구인지**가 먼저다 (여러 마리가 한 줄씩 서므로) */
function NewsCard({ row, nameOf }: { row: FavNewsRow; nameOf: (dex: number) => string }) {
  const who = row.dex.map(nameOf).join(' · ');
  return (
    <PxPanel as="article" pad="card" className={`pxp-news${row.days <= 0 ? ' is-now' : ''}`}>
      <div className="pxp-news__head">
        <WhenBadge row={row} />
        <PxBadge ko tone="muted">{FAV_NEWS_LABEL[row.event.type] ?? '일정'}</PxBadge>
      </div>
      <div className="pxp-news__body">
        <span className="pxp-news__mons" aria-hidden="true">{row.dex.map((dex) => <Sprite key={dex} id={dex} />)}</span>
        <div className="pxp-news__text">
          <h4 className="px-sub">{row.event.title || who}</h4>
          <p className="px-caption">{who}</p>
        </div>
      </div>
      <div className="pxp-news__foot">
        <span className="px-caption"><span className="px-muted">기간 </span><span className="px-mono">{spanOf(row)}</span></span>
        <PxButton size="sm" href="/schedule">일정 보기 <PixelIcon name="arrow" /></PxButton>
      </div>
    </PxPanel>
  );
}

export default function Planner() {
  const { data: dex } = useDex();
  const { data: fav } = useFavEvents();
  // ★ 해제는 공용 카드(MonCard)가 useFavs 로 한다 — 여기서는 목록만 읽는다
  const { favs } = useFavs();

  // 이름표에 없으면 번호를 그대로 쓴다 — 이름을 지어내지 않는다
  const nameOf = (id: number) => dex.DEX_DATA.names[String(id)] ?? `#${id}`;
  const news = favNewsList(fav.FAV_EVENTS, favs);
  const toDex = <PxButton kind="primary" href={routeHref('dex')}>도감에서 담을 포켓몬 찾기 <PixelIcon name="arrow" /></PxButton>;

  return (
    <div className="pxp pxp-plan" id="page-planner" data-route="planner">
      {/* (0) 지표 판 둘 + 안내 판 */}
      <div className="pxp-plan__top">
        <PxMetric label="즐겨찾기" value={count(favs.length)} note="같은 계정으로 로그인하면 이어서 볼 수 있어요." />
        <PxMetric label="다가오는 관련 일정" value={count(news.length)} note="관심 포켓몬과 연결된 소식" tone="mint" />
        <PxNote className="pxp-plan__guide" eyebrow="YOUR COLLECTION" title="관심 포켓몬의 일정을 한곳에서"
          body="도감이나 포켓몬 상세에서 ☆를 누르면 저장돼요. 관련 레이드와 이벤트 일정이 등록되면 이 페이지에서 바로 확인할 수 있어요."
          actions={toDex} />
      </div>

      {/* (1) 소식 */}
      <section className="pxp-sec" aria-labelledby="planner-news-title">
        <PxSectionHead id="planner-news-title" title="다가오는 일정" note={`${count(news.length)}건 · 즐겨찾기 포켓몬 기준`}
          more={<PxButton size="sm" href="/schedule">전체 일정 <PixelIcon name="arrow" /></PxButton>} />
        {news.length
          ? <div className="px-grid px-grid--3 pxp-news-grid">{news.map((row, index) => <NewsCard key={index} row={row} nameOf={nameOf} />)}</div>
          : <PxNote body={favs.length
              ? '즐겨찾기 포켓몬의 예정된 일정이 없어요. 새 일정이 등록되면 여기에 표시돼요.'
              : '아직 즐겨찾기한 포켓몬이 없어요. 도감에서 ★를 눌러 추가해 보세요.'} />}
      </section>

      {/* (2) 담아 둔 포켓몬 */}
      <section className="pxp-sec" aria-labelledby="planner-favs-title">
        <PxSectionHead id="planner-favs-title" title="즐겨찾는 포켓몬" note={`${count(favs.length)}마리 · 별표를 눌러 해제할 수 있어요.`}
          more={<PxButton size="sm" href={routeHref('dex')}>포켓몬 추가 <PixelIcon name="arrow" /></PxButton>} />
        {favs.length
          ? (
            <div className="px-grid pxp-fav-grid">
              {favs.map((id) => {
                // 소식이 걸린 줄에만 D-day 를 붙인다 — '없음' 을 적으면 없는 줄이 있는 줄보다 눈에 띈다
                const soon = favNewsFor(fav.FAV_EVENTS, id)[0];
                // 카드는 공용 MonCard — ★ 토글(useFavs, from '내 포켓몬')이 안에 들어 있다.
                // 이 화면은 App 에서 onOpen 을 받지 않으므로 누르면 전처럼 상세 페이지(/mon/<번호>)로 간다
                return (
                  <MonCard key={id} sprite={id} dex={id} name={nameOf(id)} from="내 포켓몬"
                    types={dex.DEX_DATA.forms[String(id)]?.types ?? []}
                    badges={soon ? <WhenBadge row={soon} className="px-mon__rank" /> : null}
                    meta={soon ? `${FAV_NEWS_LABEL[soon.event.type] ?? '일정'} · ${favNewsWhen(soon)}` : undefined}
                    onOpen={() => go(`/mon/${id}`)} />
                );
              })}
            </div>
          )
          : <PxNote title="아직 즐겨찾기가 없나요?" body="포켓몬 상세에서 ☆를 누르면 이곳에 모을 수 있어요."
              actions={<PxButton href={routeHref('dex')}>포켓몬 도감 열기 <PixelIcon name="arrow" /></PxButton>} />}
      </section>
    </div>
  );
}
