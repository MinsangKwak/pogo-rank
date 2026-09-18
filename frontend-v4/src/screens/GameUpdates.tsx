// ─────────────────────────────────────────────────────────────────────────────
// screens/GameUpdates.tsx — 📢 게임 업데이트 (v3 components/updates.js 이식)
//
// Pokémon GO 쪽에서 무엇이 바뀌었는지, 그게 나에게 어떤 영향인지를 한곳에서 읽는다.
// 목록(#/game-updates)에서 결론을 읽고, 한 번 더 열면(#/game-updates/<id>) 근거까지 본다.
//
// **두 층이 한 목록에 선다.**
//   기사(GAME_UPDATES)     사람이 검증해 쓴 글 — 요약 · 변경 전후 · 플레이 영향 · moncamp 추천 · 상태 배지
//   아카이브(GAME_ARCHIVE) 공식 제목 · 날짜 · 원문 링크 + **원문에서 그대로 따온 인용** 한 문단.
//                          우리 요약이 아니라 인용이라 검증 없이도 내보낼 수 있다.
// 아카이브 항목에 사람이 요약을 쓰면 그 자리는 기사가 된다(승격).
//
// 고른 검색어·분류·기간은 **화면 밖**에 둔다 — 상세를 보고 뒤로 왔을 때 그대로여야 해서다.
// v3 도 같은 이유로 UPDATE_UI 를 모듈 밖에 뒀다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUpdates } from '../lib/data';
import { UPDATE_CATS } from '../lib/notes';
import KoOnlyNote from '../components/KoOnlyNote';
import { routeById, routeHash, type RouteId } from '../routes';
import { track } from '../lib/track';
import type { ArchiveEntry, GameUpdate, UpdateSource } from '../types/data';

// 근거 — 무엇으로 확인했는가
const UPDATE_EVIDENCE: Record<string, string> = { official: '공식 확인', observed: '관찰 보고', pending: '확인 대기' };
// 게임 적용 — 게임에서 언제 적용되는가
const UPDATE_ROLLOUT: Record<string, string> = { planned: '적용 예정', rolling: '순차 적용', live: '적용 확인', withdrawn: '철회', unknown: '시점 미확인' };

const PERIODS: [string, string][] = [['', '전체'], ['7', '최근 7일'], ['30', '최근 30일']];
// 한 번에 보이는 글 수 — 글이 쌓이는 화면이라 처음부터 전부 그리면 스크롤만 길어진다
const PAGE = 5;

/** 목록 화면의 상태. 라우터가 화면을 다시 그리므로 컴포넌트 밖에 둔다 (v3 UPDATE_UI) */
const UI = { query: '', cat: '', period: '', shown: PAGE, articleOnly: false };

type Row = (GameUpdate & { kind: 'article' }) | (ArchiveEntry & { kind: 'archive' });

/** 이 글을 '언제 일' 로 볼지 — 적용일 > 발표일 > 우리가 확인한 날 */
function dateOf(row: { effectiveAt?: string; announcedAt?: string; checkedAt?: string; date?: string }): string {
  return row.effectiveAt || row.announcedAt || row.checkedAt || row.date || '';
}

/** 오늘로부터 며칠 전 글인가. 날짜가 없으면 null — 기간 거르기에서 빠진다 */
function daysAgo(row: Row): number | null {
  const date = dateOf(row);
  if (!date) return null;
  const then = new Date(`${date}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

/** 상태 알약. 색은 뜻이 있을 때만 — 사람이 한 번 더 봐야 하는 값만 칠한다 */
function Badge({ text, kind }: { text: string; kind?: string }) {
  return <span className={`upd__badge${kind ? ` upd__badge--${kind}` : ''}`}>{text}</span>;
}

function Badges({ row }: { row: GameUpdate }) {
  const evidence = UPDATE_EVIDENCE[row.evidenceStatus ?? ''];
  const rollout = UPDATE_ROLLOUT[row.rolloutStatus ?? ''];
  return (
    <div className="upd__badges">
      {evidence ? <Badge text={evidence} kind={row.evidenceStatus === 'official' ? 'ok' : 'warn'} /> : null}
      {rollout ? <Badge text={rollout} kind={row.rolloutStatus === 'live' ? 'ok' : row.rolloutStatus === 'withdrawn' ? 'warn' : ''} /> : null}
    </div>
  );
}

function CatChips({ row }: { row: GameUpdate }) {
  return (
    <div className="upd__cats">
      {(row.category ?? []).map((key) => <span key={key} className="upd__cat">{UPDATE_CATS[key] ?? key}</span>)}
    </div>
  );
}

/** 날짜 줄 — 발표일과 적용일은 다른 뜻이라 라벨을 붙여 따로 적는다 */
function Dates({ row, withChecked = false }: { row: Row | GameUpdate | ArchiveEntry; withChecked?: boolean }) {
  const one = (label: string, date: string) => (
    // 라벨은 제 노드에 둔다 — '발표 ' 처럼 공백이 붙은 글자는 사전(i18n)이 키를 못 찾는다
    <span key={label} className="upd__date"><em>{label}</em><b>{date}</b></span>
  );
  const any = row as GameUpdate & ArchiveEntry;
  const parts: ReactNode[] = [];
  if (any.announcedAt || any.date) parts.push(one('발표', (any.announcedAt || any.date) as string));
  if (any.effectiveAt) parts.push(one('적용', any.effectiveAt));
  // 발표일·적용일이 없는 글(공식 릴리스 노트)은 확인일을 대신 보인다 — 목록에서도 '언제 것' 을 알 수 있게
  if ((withChecked || !parts.length) && any.checkedAt) parts.push(one(parts.length ? '마지막 확인' : '확인', any.checkedAt));
  if (!parts.length) parts.push(<span key="none" className="upd__date"><em>날짜 미확인</em></span>);
  return <div className="upd__dates">{parts}</div>;
}

/**
 * 미리보기 그림 주소 → 썸네일 크기로.
 * 공식 og:image 는 원본 그대로라 무겁다(실측 2.7MB GIF). 구글 이미지 호스트는 주소 뒤 옵션으로
 * 크기·형식을 바꿔 준다 — w320-h180-c(16:9 로 잘라 맞춤) · -no(움직임 제거) · -rj(JPEG).
 */
function thumbUrl(url: string): string {
  if (!/^https:\/\/lh3\.googleusercontent\.com\//.test(url) || url.includes('=')) return url;
  return `${url}=w320-h180-c-no-rj`;
}

/** 출처 링크 카드. 그림을 못 받으면 그 자리를 접는다 — 깨진 그림을 남기지 않는다 */
function SourceCard({ source }: { source: UpdateSource }) {
  const [broken, setBroken] = useState(false);
  let host = source.url;
  try { host = new URL(source.url).host; } catch { /* 주소가 아니면 그대로 */ }
  return (
    <a className="upd__source" href={source.url} target="_blank" rel="noopener noreferrer">
      {source.image && !broken
        ? <img className="upd__source-img" src={thumbUrl(source.image)} alt="" loading="lazy" decoding="async"
            referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : null}
      <span className="upd__source-body">
        <b>{source.label}</b>
        <span className="upd__source-meta">
          <span className="upd__source-lang">{source.lang === 'ko' ? '한국어' : '영어'}</span>
          <span className="upd__source-host">{host}</span>
          <span className="upd__source-go" aria-hidden="true">↗</span>
        </span>
      </span>
    </a>
  );
}

const open = (id: string, from: string) => {
  track('game_update_open', { id, from });   // GA4: 어느 글을 어디서 열었나
  location.hash = routeHash('game-updates', id);
};

/** 목록 카드 — 결론형 제목 · 요약 · 분류 · 상태 · 날짜. 장식용 그림보다 문장과 날짜를 먼저 둔다 */
function UpdateCard({ row, from = 'list' }: { row: GameUpdate; from?: string }) {
  return (
    <article className="upd__card" onClick={() => open(row.id, from)}>
      <CatChips row={row} />
      <h3 className="upd__title">{row.title}</h3>
      <p className="upd__summary">{row.summary}</p>
      <Badges row={row} />
      <Dates row={row} />
    </article>
  );
}

/** 아카이브 카드 — 우리 요약이 없으므로 **인용**을 보이고, 그렇다는 것을 배지로 밝힌다 */
function ArchiveCard({ row }: { row: ArchiveEntry }) {
  return (
    <article className="upd__card upd__card--archive" onClick={() => open(row.id, 'archive')}>
      <div className="upd__badges"><Badge text="원문 보기" kind="plain" /></div>
      <h3 className="upd__title">{row.title}</h3>
      {row.excerpt ? <p className="upd__quote">{row.excerpt}</p> : null}
      <Dates row={row} />
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="upd__sec"><h3>{title}</h3>{children}</section>;
}

function Bullets({ items, className }: { items: string[]; className?: string }) {
  return <ul className={`upd__list${className ? ` ${className}` : ''}`}>{items.map((text, i) => <li key={i}>{text}</li>)}</ul>;
}

/** 목록 화면 */
function UpdatesList() {
  const { data } = useUpdates();
  const [, redraw] = useState(0);
  const bump = () => redraw((n) => n + 1);

  // 기사가 먼저 만들어지고 아카이브가 뒤를 채운다. 차례는 날짜 하나로 센다
  const all = useMemo<Row[]>(() => {
    const rows: Row[] = [
      ...data.GAME_UPDATES.map((one) => ({ ...one, kind: 'article' as const })),
      ...data.GAME_ARCHIVE.map((one) => ({ ...one, kind: 'archive' as const })),
    ];
    rows.sort((left, right) => (dateOf(right) || '').localeCompare(dateOf(left) || ''));
    return rows;
  }, [data]);

  if (!all.length) {
    return (
      <div className="page__body" id="page-game-updates" data-route="game-updates">
        <p className="dex__hint">아직 공개된 게임 업데이트 글이 없어요. 공식 발표를 확인한 글만 올라와요.</p>
      </div>
    );
  }

  // 운영자가 고른 글 최대 3건. 고른 것과 전체가 같으면 이 덩이를 만들지 않는다 —
  // 같은 카드가 두 번 서면 두 배가 있는 것처럼 읽힌다
  const featured = all.filter((row) => row.kind === 'article' && (row as GameUpdate).featured).slice(0, 3) as GameUpdate[];

  const query = UI.query.trim().toLowerCase();
  const rows = all.filter((row) => {
    if (UI.articleOnly && row.kind !== 'article') return false;
    // 아카이브 항목에는 분류가 없다 — 분류로 좁히면 기사만 남는 것이 맞다
    if (UI.cat && !((row as GameUpdate).category ?? []).includes(UI.cat)) return false;
    if (UI.period) {
      const days = daysAgo(row);
      if (days == null || days > Number(UI.period)) return false;
    }
    if (!query) return true;
    // 제목·요약·핵심 요약까지 훑는다 — 본문에만 있는 말로도 찾을 수 있어야 한다
    const one = row as GameUpdate & ArchiveEntry;
    const hay = [one.title, one.summary, one.excerpt, ...(one.key ?? []), ...(one.playerImpact ?? [])]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(query);
  });

  // 남은 수보다 많이 펼쳐 달라고 해도 목록 길이에서 자른다(되돌리지 않는다) —
  // 되돌리면 마지막 [더보기] 가 첫 장으로 돌아가 5↔10 을 오간다
  const shown = Math.min(Math.max(UI.shown, PAGE), rows.length);
  UI.shown = shown;
  const rest = rows.length - shown;
  // 검색·분류·기간을 바꾸면 펼친 만큼은 되돌린다 (새 조건의 첫 장부터 읽는다)
  const reset = () => { UI.shown = PAGE; };

  return (
    <div className="page__body" id="page-game-updates" data-route="game-updates">
      {featured.length && featured.length < all.length ? (
        <>
          <h2 className="page__sec">주요 변경</h2>
          <div className="upd__cards upd__cards--top">
            {featured.map((row) => <UpdateCard key={row.id} row={row} from="top" />)}
          </div>
        </>
      ) : null}

      <KoOnlyNote kind="ko" />
      <h2 className="page__sec">전체 소식</h2>
      <div className="upd__tools">
        <input type="search" className="upd__search" value={UI.query} placeholder="제목·내용으로 찾기"
          aria-label="게임 업데이트 검색"
          onChange={(event) => { UI.query = event.target.value; reset(); bump(); }} />
        <div className="upd__filter">
          {[['', '전체 분류'] as [string, string], ...Object.entries(UPDATE_CATS)].map(([key, label]) => (
            <button key={key || 'all'} className="uchip" data-cat={key} aria-pressed={UI.cat === key}
              onClick={() => { UI.cat = UI.cat === key ? '' : key; reset(); bump(); }}>{label}</button>
          ))}
        </div>
        <div className="upd__filter">
          {/* 기사만 — 우리 요약이 붙은 글만 보고 싶을 때. 아카이브는 인용뿐이라 성격이 다르다 */}
          <button className="uchip" data-only="1" aria-pressed={UI.articleOnly}
            onClick={() => { UI.articleOnly = !UI.articleOnly; reset(); bump(); }}>요약 있는 글만</button>
          {PERIODS.map(([key, label]) => (
            <button key={key || 'all'} className="uchip" data-period={key} aria-pressed={UI.period === key}
              onClick={() => { UI.period = key; reset(); bump(); }}>{label}</button>
          ))}
        </div>
        <p className="upd__count">{`${rows.length}건`}</p>
      </div>

      <div className="upd__cards">
        {rows.length
          ? rows.slice(0, shown).map((row) => (row.kind === 'archive'
            ? <ArchiveCard key={row.id} row={row} />
            : <UpdateCard key={row.id} row={row} />))
          : <p className="dex__hint">조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.</p>}
      </div>
      <button className="upd__more" hidden={rest <= 0}
        onClick={() => { UI.shown += PAGE; bump(); }}>{rest > 0 ? `지난 소식 더 보기 (${rest}건 남음)` : ''}</button>
      <p className="detail__foot">[원문 보기] 는 아직 moncamp 요약이 없는 소식이에요 — 공식 제목·날짜와 원문에서 따온 인용만 보여 드려요. 요약이 붙으면 그 자리가 기사가 돼요.</p>
    </div>
  );
}

function Back() {
  return <button className="upd__back" onClick={() => { location.hash = routeHash('game-updates'); }}>← 게임 업데이트</button>;
}

/** 아카이브 상세 — 기사가 아직 없는 소식. 지어낸 요약 대신 인용과 원문 카드를 보인다 */
function ArchiveDetail({ row }: { row: ArchiveEntry }) {
  return (
    <div className="page__body" id="page-game-update" data-route="game-update">
      <Back />
      <KoOnlyNote kind="ko" />
      <header className="upd__head">
        <div className="upd__badges"><Badge text="원문 보기" kind="plain" /></div>
        <h2 className="upd__head-title">{row.title}</h2>
        <Dates row={row} />
      </header>
      {row.excerpt
        ? <Section title="공식 원문에서"><blockquote className="upd__quote-box">{row.excerpt}</blockquote></Section>
        : null}
      <Section title="공식 원문">
        <div className="upd__sources">{(row.sources ?? []).map((one) => <SourceCard key={one.url} source={one} />)}</div>
      </Section>
      <p className="dex__hint">이 소식은 아직 moncamp 요약이 없어요. 위 문단은 공식 원문에서 그대로 옮긴 인용이고, 전체 내용은 원문에서 확인해 주세요.</p>
    </div>
  );
}

/** 상세 — 핵심 → 변경 전·후 → 플레이 영향 → 확인할 것 → 관련 화면 → 원문 → 정정 이력 */
function UpdateDetail({ id }: { id: string }) {
  const { data } = useUpdates();
  const article = data.GAME_UPDATES.find((one) => one.id === id) ?? null;
  const entry = data.GAME_ARCHIVE.find((one) => one.id === id) ?? null;
  if (!article && entry) return <ArchiveDetail row={entry} />;
  if (!article) {
    // 철회됐거나 아직 공개되지 않은 글의 주소로 들어온 경우 — 없는 것을 있는 척하지 않는다
    return (
      <div className="page__body" id="page-game-update" data-route="game-update">
        <Back />
        <p className="dex__hint">그 글을 찾을 수 없어요. 아직 공개되지 않았거나 내려간 글일 수 있어요.</p>
      </div>
    );
  }
  // 메뉴 이름을 먼저 보고, 메뉴에 없는 화면은 title 을 쓴다 (v3 updateRouteName)
  const routeName = (routeId: string) => {
    const route = routeById(routeId);
    return route?.nav || route?.title || routeId;
  };
  return (
    <div className="page__body" id="page-game-update" data-route="game-update">
      <Back />
      <KoOnlyNote kind="ko" />
      <header className="upd__head">
        <CatChips row={article} />
        <h2 className="upd__head-title">{article.title}</h2>
        <p className="upd__head-sum">{article.summary}</p>
        <Badges row={article} />
        <Dates row={article} withChecked />
        {article.effectiveNote ? <p className="detail__foot">{article.effectiveNote}</p> : null}
      </header>

      {article.key?.length ? <Section title="핵심 요약"><Bullets items={article.key} className="upd__list--key" /></Section> : null}

      {article.beforeAfter?.length ? (
        <Section title="변경 전 · 후">
          <div className="upd__ba">
            {article.beforeAfter.map((row, i) => (
              <div key={i} className="upd__ba-row">
                <em>{row.label}</em>
                {/* 이전 값을 모르면 지어내지 않고 그렇다고 적는다 */}
                <div className="upd__ba-before">{row.before ? row.before : <span className="upd__ba-none">이전 값 미확인</span>}</div>
                <div className="upd__ba-arrow" aria-hidden="true">→</div>
                <div className="upd__ba-after">{row.after}</div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {article.playerImpact?.length ? <Section title="플레이에 미치는 영향"><Bullets items={article.playerImpact} /></Section> : null}
      {article.suggestedActions?.length ? <Section title="확인하면 좋은 것"><Bullets items={article.suggestedActions} /></Section> : null}

      {/* 이 변경을 두고 우리 화면으로 무엇을 하면 되는지 한 문단 */}
      {article.moncampAdvice
        ? <Section title="moncamp 는 이렇게 추천해요"><div className="upd__advice"><p>{article.moncampAdvice}</p></div></Section>
        : null}

      {article.related?.length ? (
        <Section title="관련 화면">
          <div className="upd__related">
            {article.related.map((routeId) => (
              <button key={routeId} className="uchip"
                onClick={() => { location.hash = routeHash(routeId as RouteId); }}>
                {`${routeById(routeId)?.icon ?? ''} ${routeName(routeId)}`.trim()}
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="공식 원문">
        {article.sources?.length
          ? <div className="upd__sources">{article.sources.map((one) => <SourceCard key={one.url} source={one} />)}</div>
          : <p className="dex__hint">원문 링크가 없어요.</p>}
      </Section>

      {article.revisions?.length ? (
        <Section title="정정 이력">
          <ul className="upd__list">{article.revisions.map((one, i) => <li key={i}><b>{one.at}</b> {one.note}</li>)}</ul>
        </Section>
      ) : null}
      <p className="detail__foot">원문을 그대로 옮기지 않고 요약한 글이에요. 정확한 문구는 공식 원문에서 확인해 주세요.</p>
    </div>
  );
}

/** 주소 뒷자리가 있으면 상세, 없으면 목록 */
export default function GameUpdates({ rest }: { rest: string }) {
  // 상세에서 뒤로 오면 떠날 때의 자리로 되돌린다 (v3 UPDATE_UI.scroll)
  useEffect(() => { if (rest) return; window.scrollTo(0, 0); }, [rest]);
  return rest ? <UpdateDetail id={rest} /> : <UpdatesList />;
}
