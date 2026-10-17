// ─────────────────────────────────────────────────────────────────────────────
// screens/GameUpdates.tsx — 📢 게임 업데이트 (v3 components/updates.js 이식 · 2026-10-16 v6 픽셀 시안 02 · 21)
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
//
// v6 배치(시안 02): 요약 히어로 판 → 검색 + '요약 글만 보기' 토글 → 분류 칩 · 기간 칩 → '최근 업데이트' 카드 목록 → 더 보기.
// 상세(시안 21): 머리 → 핵심 요약 판 → 변경 전 · 후 두 칸 → 플레이 영향 → 확인할 사항(□) → 관련 화면 칩 → 공식 원문 · 출처 → 정정 이력.
// 조각은 pixel/parts.css 의 px-* 를 쓰고, 자리는 pixel/news.css 의 nw-* 가 잡는다.
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUpdates } from '../lib/data';
import { UPDATE_CATS } from '../lib/notes';
import { word } from '../lib/cell';
import KoOnlyNote from '../components/KoOnlyNote';
import { PixelIcon } from '../components/PixelIcon';
import { PxChips, PxSwitch } from '../components/Bits';
import { NwBadge, NwEmpty, NwFoot, NwSecHead, type BadgeTone } from '../components/NewsBits';
import { routeById, routeHref, type RouteId } from '../routes';
import { track } from '../lib/track';
import type { ArchiveEntry, GameUpdate, UpdateSource } from '../types/data';

// 근거 — 무엇으로 확인했는가
const UPDATE_EVIDENCE: Record<string, string> = { official: '공식 근거 있음', observed: '관찰 보고', pending: '확인 대기' };
// 게임 적용 — 게임에서 언제 적용되는가
const UPDATE_ROLLOUT: Record<string, string> = { planned: '적용 예정', rolling: '순차 적용', live: '적용 확인', withdrawn: '철회', unknown: '시점 미확인' };

// 칩 묶음은 빈 id 를 못 받는다 — '전체' 는 'all' 로 두고 UI 에는 '' 로 옮겨 적는다 (v3 의 '' 계약 유지)
const CAT_CHIPS = [{ id: 'all', label: '전체 분류' }, ...Object.entries(UPDATE_CATS).map(([id, label]) => ({ id, label }))];
const PERIOD_CHIPS = [{ id: 'all', label: '전체 기간' }, { id: '7', label: '최근 7일' }, { id: '30', label: '최근 30일' }];
// 한 번에 보이는 글 수 — 글이 쌓이는 화면이라 처음부터 전부 그리면 스크롤만 길어진다
const PAGE = 5;

/** 목록 화면의 상태. 라우터가 화면을 다시 그리므로 컴포넌트 밖에 둔다 (v3 UPDATE_UI) */
const UI = { query: '', cat: '', period: '', shown: PAGE, articleOnly: false };

type Row = (GameUpdate & { kind: 'article' }) | (ArchiveEntry & { kind: 'archive' });

/** 이 글을 '언제 일' 로 볼지 — 적용일 > 발표일 > 우리가 확인한 날 */
function dateOf(row: { effectiveAt?: string; announcedAt?: string; checkedAt?: string; date?: string }): string {
  return row.effectiveAt || row.announcedAt || row.checkedAt || row.date || '';
}

/** 'YYYY-MM-DD' → 'YYYY.MM' — 근거 배지 옆의 달 표기. 날짜가 없으면 빈 글자(배지에 점만 남기지 않는다) */
function yearMonth(date: string): string {
  const hit = /^(\d{4})-(\d{2})/.exec(date);
  return hit ? `${hit[1]}.${hit[2]}` : '';
}

/** 오늘로부터 며칠 전 글인가. 날짜가 없으면 null — 기간 거르기에서 빠진다 */
function daysAgo(row: Row): number | null {
  const date = dateOf(row);
  if (!date) return null;
  const then = new Date(`${date}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

/** 상태 배지 — 색은 뜻이 있을 때만: 적용 확인은 민트, 공식 근거는 파랑, 철회 · 대기는 주황, 나머지는 흐리게 */
function Badge({ text, tone = 'muted' }: { text: string; tone?: BadgeTone }) {
  return <NwBadge text={text} tone={tone} />;
}

/** 분류 배지 + 적용 상태 배지 + 근거 배지('공식 근거 있음 · 2026.10') 한 줄 */
function Badges({ row, withCats = true }: { row: GameUpdate; withCats?: boolean }) {
  const evidence = UPDATE_EVIDENCE[row.evidenceStatus ?? ''];
  const rollout = UPDATE_ROLLOUT[row.rolloutStatus ?? ''];
  const month = yearMonth(dateOf(row));
  return (
    <div className="nw-badges">
      {withCats ? (row.category ?? []).map((key) => <Badge key={key} text={UPDATE_CATS[key] ?? key} tone="brand" />) : null}
      {rollout ? <Badge text={rollout} tone={row.rolloutStatus === 'live' ? 'mint' : row.rolloutStatus === 'withdrawn' ? 'orange' : 'muted'} /> : null}
      {evidence ? <Badge text={month ? `${evidence} · ${month}` : evidence} tone={row.evidenceStatus === 'official' ? 'blue' : 'orange'} /> : null}
    </div>
  );
}

/** 날짜 줄 — 발표일과 적용일은 다른 뜻이라 라벨을 붙여 따로 적는다 */
function Dates({ row, withChecked = false }: { row: Row | GameUpdate | ArchiveEntry; withChecked?: boolean }) {
  const one = (label: string, date: string) => (
    // 라벨은 제 노드에 둔다 — '발표 ' 처럼 공백이 붙은 글자는 사전(i18n)이 키를 못 찾는다
    <span key={label} className="nw-date"><em>{label}</em><b className="px-mono">{word(date)}</b></span>
  );
  const any = row as GameUpdate & ArchiveEntry;
  const parts: ReactNode[] = [];
  if (any.announcedAt || any.date) parts.push(one('발표', (any.announcedAt || any.date) as string));
  if (any.effectiveAt) parts.push(one('적용', any.effectiveAt));
  // 발표일·적용일이 없는 글(공식 릴리스 노트)은 확인일을 대신 보인다 — 목록에서도 '언제 것' 을 알 수 있게
  if ((withChecked || !parts.length) && any.checkedAt) parts.push(one(parts.length ? '마지막 확인' : '확인', any.checkedAt));
  if (!parts.length) parts.push(<span key="none" className="nw-date"><em>날짜 미확인</em></span>);
  return <div className="nw-dates">{parts}</div>;
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

/** 출처 링크 카드 — 판 한 장에 그림 · 제목 · 언어 · 호스트 · '공식 원문 보기 ↗'. 그림을 못 받으면 그 자리를 접는다 */
function SourceCard({ source }: { source: UpdateSource }) {
  const [broken, setBroken] = useState(false);
  let host = source.url;
  try { host = new URL(source.url).host; } catch { /* 주소가 아니면 그대로 */ }
  return (
    <a className="nw-source px-skin px-skin--sunk" href={source.url} target="_blank" rel="noopener noreferrer">
      {source.image && !broken
        ? <img className="nw-source__img" src={thumbUrl(source.image)} alt="" loading="lazy" decoding="async"
            referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : null}
      <span className="nw-source__body">
        <b className="px-sub">{source.label}</b>
        <span className="nw-source__meta px-caption">
          <span>{source.lang === 'ko' ? '한국어' : '영어'}</span>
          <span className="px-mono">{host}</span>
        </span>
        <span className="nw-source__go">공식 원문 보기 ↗</span>
      </span>
    </a>
  );
}

const open = (id: string, from: string) => {
  track('game_update_open', { id, from });   // GA4: 어느 글을 어디서 열었나
  go(routeHref('game-updates', id));
};

/** 카드 제목 — 카드와 같은 출처(from)로 센다. 'list' 로 박아 두면 맨 위 카드 · 아카이브 클릭이 목록으로 잡혔다 (#189 Codex) */
function TitleLink({ id, title, from }: { id: string; title: string; from: string }) {
  return (
    <a href={routeHref('game-updates', id)} onClick={(event) => {
      event.stopPropagation();
      // Ctrl · Cmd · Shift · Alt 클릭은 브라우저에 맡긴다 — 새 탭으로 열려는 사람을 이 탭에서 옮기지 않는다
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        track('game_update_open', { id, from });
        return;
      }
      event.preventDefault();
      open(id, from);
    }}>{title}</a>
  );
}

/** 목록 카드 — 배지 줄 · 결론형 제목 · 요약 · 날짜 · '내용 확인 ↗'. 장식용 그림보다 문장과 날짜를 먼저 둔다 */
function UpdateCard({ row, from = 'list' }: { row: GameUpdate; from?: string }) {
  return (
    <article className="nw-card px-skin px-drop px-card px-card--tap" onClick={() => open(row.id, from)}>
      <Badges row={row} />
      <h3 className="nw-card__title px-heading"><TitleLink id={row.id} title={row.title} from={from} /></h3>
      {row.summary ? <p className="nw-card__sum px-body px-muted">{row.summary}</p> : null}
      <div className="nw-card__foot">
        <Dates row={row} />
        <span className="nw-card__go">내용 확인 ↗</span>
      </div>
    </article>
  );
}

/** 아카이브 카드 — 우리 요약이 없으므로 **인용**을 보이고, 그렇다는 것을 배지로 밝힌다 */
function ArchiveCard({ row }: { row: ArchiveEntry }) {
  return (
    <article className="nw-card nw-card--archive px-skin px-drop px-card px-card--tap" onClick={() => open(row.id, 'archive')}>
      <div className="nw-badges"><Badge text="원문 보기" tone="muted" /></div>
      <h3 className="nw-card__title px-heading"><TitleLink id={row.id} title={row.title} from="archive" /></h3>
      {row.excerpt ? <blockquote className="nw-quote px-body px-muted">{row.excerpt}</blockquote> : null}
      <div className="nw-card__foot">
        <Dates row={row} />
        <span className="nw-card__go">내용 확인 ↗</span>
      </div>
    </article>
  );
}

/** 상세의 구역 한 판 — 제목 + 내용. 핵심 요약은 빨강 테두리로 한 번 더 세운다 */
function Section({ title, tone = 'plain', children }: { title: string; tone?: 'plain' | 'key'; children: ReactNode }) {
  return (
    <section className={`nw-sec px-skin px-drop px-panel${tone === 'key' ? ' nw-sec--key' : ''}`}>
      <h3 className="px-sub nw-sec__title">{title}</h3>
      <div className="nw-sec__content">{children}</div>
    </section>
  );
}

/** 글머리 목록 — check 면 □ 확인란 모양(확인할 사항) */
function Bullets({ items, mark = 'dot' }: { items: string[]; mark?: 'dot' | 'check' }) {
  return (
    <ul className={`nw-list nw-list--${mark}`}>
      {items.map((text, i) => <li key={i} className="px-body"><i aria-hidden="true" /><span>{text}</span></li>)}
    </ul>
  );
}

/** 히어로 판 — 운영자가 고른 글(featured) 첫 건, 없으면 가장 최근 기사. 분류 배지 뒤에 '요약' 을 붙여 한 줄 요약임을 밝힌다 */
function Hero({ row }: { row: GameUpdate }) {
  const cats = (row.category ?? []).map((key) => UPDATE_CATS[key] ?? key);
  return (
    <section className="nw-hero px-skin px-drop px-panel" aria-label="주요 업데이트 요약">
      <div className="nw-badges">
        <Badge text={`${cats.length ? `${cats.join(' · ')} · ` : ''}요약`} tone="brand" />
        {row.rolloutStatus && UPDATE_ROLLOUT[row.rolloutStatus] ? <Badge text={UPDATE_ROLLOUT[row.rolloutStatus]!} tone={row.rolloutStatus === 'live' ? 'mint' : 'muted'} /> : null}
      </div>
      <h2 className="px-title"><TitleLink id={row.id} title={row.title} from="top" /></h2>
      {row.summary ? <p className="px-body px-muted nw-hero__sum">{row.summary}</p> : null}
      <div className="nw-hero__actions">
        <button type="button" className="px-btn px-skin px-btn--primary" onClick={() => open(row.id, 'top')}>업데이트 자세히 읽기 →</button>
        <Dates row={row} />
      </div>
    </section>
  );
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
      <div className="page__body nw-upd" id="page-game-updates" data-route="game-updates">
        <NwEmpty>아직 등록된 게임 업데이트 소식이 없어요. 공식 발표를 확인한 후 게시해요.</NwEmpty>
      </div>
    );
  }

  // 히어로 한 장 — 운영자가 고른 글(featured)이 먼저, 없으면 가장 최근 기사. 전체가 그 한 건뿐이면 히어로를 세우지 않는다 —
  // 같은 카드가 두 번 서면 두 배가 있는 것처럼 읽힌다
  const articles = all.filter((row) => row.kind === 'article') as GameUpdate[];
  const hero = (articles.find((row) => row.featured) ?? articles[0]) ?? null;
  const showHero = hero && all.length > 1;

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
    <div className="page__body nw-upd" id="page-game-updates" data-route="game-updates">
      <KoOnlyNote kind="ko" />
      {showHero ? <Hero row={hero} /> : null}

      <div className="nw-tools">
        <label className="px-input px-skin nw-search">
          <PixelIcon name="search" />
          <input type="search" value={UI.query} placeholder="제목 · 포켓몬 · 기술 검색"
            aria-label="게임 업데이트 검색"
            onChange={(event) => { UI.query = event.target.value; reset(); bump(); }} />
        </label>
        {/* 기사만 — 우리 요약이 붙은 글만 보고 싶을 때. 아카이브는 인용뿐이라 성격이 다르다 */}
        <PxSwitch text="요약 글만 보기" checked={UI.articleOnly} onChange={(next) => { UI.articleOnly = next; reset(); bump(); }} />
      </div>
      {/* 분류는 다시 누르면 풀린다(v3 와 같다). 칩 id 는 '' 대신 'all' — 빈 id 는 칩 묶음이 못 받는다 */}
      <PxChips label="분류" value={UI.cat || 'all'} items={CAT_CHIPS}
        onPick={(id) => { const key = id === 'all' ? '' : id; UI.cat = UI.cat === key ? '' : key; reset(); bump(); }} />
      <PxChips label="기간" value={UI.period || 'all'} items={PERIOD_CHIPS}
        onPick={(id) => { UI.period = id === 'all' ? '' : id; reset(); bump(); }} />

      <NwSecHead className="nw-sechead" title="최근 업데이트" note="발표일 · 적용 상태를 함께 확인하세요." right={`${rows.length}건`} />

      <div className="nw-cards">
        {rows.length
          ? rows.slice(0, shown).map((row) => (row.kind === 'archive'
            ? <ArchiveCard key={row.id} row={row} />
            : <UpdateCard key={row.id} row={row} />))
          : <NwEmpty className="nw-empty">조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.</NwEmpty>}
      </div>
      <button type="button" className="px-btn px-skin px-btn--block nw-more" hidden={rest <= 0}
        onClick={() => { UI.shown += PAGE; bump(); }}>{rest > 0 ? `업데이트 더 보기 (${rest}건 남음)` : ''}</button>
      <NwFoot>[원문 보기]는 요약이 준비되지 않은 소식이에요. 공식 제목·날짜와 원문 일부를 먼저 제공하며, 확인이 끝나면 요약을 추가해요.</NwFoot>
    </div>
  );
}

function Back() {
  return (
    <button type="button" className="px-btn px-skin px-btn--ghost px-btn--sm nw-back" onClick={() => { go(routeHref('game-updates')); }}>
      <PixelIcon name="back" /><span>게임 업데이트</span>
    </button>
  );
}

/** 아카이브 상세 — 기사가 아직 없는 소식. 지어낸 요약 대신 인용과 원문 카드를 보인다 */
function ArchiveDetail({ row }: { row: ArchiveEntry }) {
  return (
    <div className="page__body nw-upd nw-detail" id="page-game-update" data-route="game-update">
      <Back />
      <KoOnlyNote kind="ko" />
      <header className="nw-head">
        <div className="nw-badges"><Badge text="원문 보기" tone="muted" /></div>
        <h2 className="px-title">{row.title}</h2>
        <Dates row={row} />
      </header>
      {row.excerpt
        ? <Section title="공식 원문 발췌"><blockquote className="nw-quote nw-quote--box px-body">{row.excerpt}</blockquote></Section>
        : null}
      <Section title="공식 원문 · 출처">
        <div className="nw-sources">{(row.sources ?? []).map((one) => <SourceCard key={one.url} source={one} />)}</div>
      </Section>
      <NwFoot>아직 요약이 준비되지 않은 소식이에요. 위 내용은 공식 발표의 일부이며, 전체 내용은 원문에서 확인할 수 있어요.</NwFoot>
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
      <div className="page__body nw-upd nw-detail" id="page-game-update" data-route="game-update">
        <Back />
        <NwEmpty>업데이트를 찾을 수 없어요. 아직 공개되지 않았거나 게시가 중단되었을 수 있어요.</NwEmpty>
      </div>
    );
  }
  // 메뉴 이름을 먼저 보고, 메뉴에 없는 화면은 title 을 쓴다 (v3 updateRouteName)
  const routeName = (routeId: string) => {
    const route = routeById(routeId);
    return route?.nav || route?.title || routeId;
  };
  return (
    <div className="page__body nw-upd nw-detail" id="page-game-update" data-route="game-update">
      <Back />
      <KoOnlyNote kind="ko" />
      <header className="nw-head">
        <Badges row={article} />
        <h2 className="px-title">{article.title}</h2>
        {article.summary ? <p className="px-body px-muted nw-head__sum">{article.summary}</p> : null}
        <Dates row={article} withChecked />
        {article.effectiveNote ? <p className="px-caption">{article.effectiveNote}</p> : null}
      </header>

      {article.key?.length ? <Section title="핵심 요약" tone="key"><Bullets items={article.key} /></Section> : null}

      {article.beforeAfter?.length ? (
        <Section title="변경 전 · 후">
          {/* 두 칸 판 — 왼쪽이 전, 오른쪽이 후. 줄마다 라벨을 위에 두어 좁은 화면에서는 한 칸씩 쌓인다 */}
          <div className="nw-ba">
            <div className="nw-ba__col px-skin px-skin--sunk">
              <p className="px-caption nw-ba__colhead">변경 전</p>
              {article.beforeAfter.map((row, i) => (
                <div key={i} className="nw-ba__cell">
                  <em className="px-caption">{row.label}</em>
                  {/* 이전 값을 모르면 지어내지 않고 그렇다고 적는다 */}
                  <span className="px-body">{row.before ? row.before : <span className="px-muted">이전 값 미확인</span>}</span>
                </div>
              ))}
            </div>
            <div className="nw-ba__col px-skin px-skin--sunk nw-ba__col--after">
              <p className="px-caption nw-ba__colhead">변경 후</p>
              {article.beforeAfter.map((row, i) => (
                <div key={i} className="nw-ba__cell">
                  <em className="px-caption">{row.label}</em>
                  <span className="px-body"><b>{row.after}</b></span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {article.playerImpact?.length ? <Section title="플레이에 미치는 영향"><Bullets items={article.playerImpact} /></Section> : null}
      {article.suggestedActions?.length ? <Section title="확인할 사항"><Bullets items={article.suggestedActions} mark="check" /></Section> : null}

      {/* 이 변경을 두고 우리 화면으로 무엇을 하면 되는지 한 문단 */}
      {article.moncampAdvice
        ? <Section title="moncamp 추천"><p className="px-body nw-advice">{article.moncampAdvice}</p></Section>
        : null}

      {article.related?.length ? (
        <Section title="관련 화면">
          {/* 칩 묶음을 길잡이로 — 켜진 칩은 없고, 누르면 그 화면으로 옮긴다 */}
          <PxChips label="관련 화면" value="" items={article.related.map((routeId) => ({ id: routeId, label: routeName(routeId) }))}
            onPick={(routeId) => { go(routeHref(routeId as RouteId)); }} />
        </Section>
      ) : null}

      <Section title="공식 원문 · 출처">
        {article.sources?.length
          ? <div className="nw-sources">{article.sources.map((one) => <SourceCard key={one.url} source={one} />)}</div>
          : <p className="px-body px-muted">등록된 원문 링크가 없어요.</p>}
      </Section>

      {article.revisions?.length ? (
        <Section title="정정 이력">
          <ul className="nw-list nw-list--dot">
            {article.revisions.map((one, i) => <li key={i} className="px-body"><i aria-hidden="true" /><span><b className="px-mono">{word(one.at)}</b>{` ${one.note}`}</span></li>)}
          </ul>
        </Section>
      ) : null}
      <NwFoot>원문을 그대로 옮기지 않고 요약한 글이에요. 정확한 문구는 공식 원문에서 확인해 주세요.</NwFoot>
    </div>
  );
}

/** 주소 뒷자리가 있으면 상세, 없으면 목록 */
export default function GameUpdates({ rest }: { rest: string }) {
  // 상세에서 뒤로 오면 떠날 때의 자리로 되돌린다 (v3 UPDATE_UI.scroll)
  useEffect(() => { if (rest) return; window.scrollTo(0, 0); }, [rest]);
  return rest ? <UpdateDetail id={rest} /> : <UpdatesList />;
}
