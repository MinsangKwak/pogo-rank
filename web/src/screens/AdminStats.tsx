// ─────────────────────────────────────────────────────────────────────────────
// screens/AdminStats.tsx — 상세 통계 (루트만, 2026-09-24 · 2026-09-28 개편 · 2026-10-16 v6 픽셀 판 A02)
//
// **한 화면에 세 원본.** 원본마다 세는 법이 달라 숫자를 섞지 않는다 — 칸마다 어디서 왔는지 적는다.
//   우리 DB   가입 · 로그인 · ★ · 검색(v4.7.0~) · 페이지뷰(2026-09-24~)   — Neon, 서버가 모아 센 값
//   GA4       방문자 · 페이지뷰                                             — 서버가 Data API 로 받아 준다
// 방문자 수는 두 원본이 다를 수밖에 없다 — GA4 는 쿠키 기준이고 '통계 끄기' 면 둘 다 안 센다.
//
// **기간 하나가 전부를 정한다.** 오늘 · 9/14부터 · 7 · 14 · 21 · 30일 · 달력으로 직접 — 위 한 줄의 고름이 아래 모든 칸에 같이 걸려야 숫자끼리 맞는다.
// '오늘' 은 한국 날짜 오늘 하루만 서버에 from = to 로 묻는다 (2026-10-02 주인 요청). 하루짜리라 숫자 칸의 7일 추세는 세우지 않는다.
// 기본은 '9/14부터' — 서비스를 연 날부터 오늘까지 한 번에 본다 (2026-09-24 주인 요청).
// '직접 고르기' 는 시작 · 끝 날짜를 달력(input type=date)으로 받아 서버에 from · to 로 묻는다 (2026-09-30 주인 요청).
// 화면 구역의 '시간대별 많이 본 포켓몬' 은 날짜 탭마다 24칸 — components/StatHours.tsx.
// 다시 받는 동안은 앞 숫자를 흐리게 둔다 — 빈 틀로 깜빡이지 않는다.
//
// **2026-09-28 개편 — 숫자만 늘어놓지 않고 "그래서 어떤가" 를 읽어 준다.**
//   - 고름 줄이 따라온다(sticky) — 다섯 구역 아래에서 기간을 바꾸려고 맨 위로 올라가지 않는다. 구역 바로가기도 그 줄에
//   - 숫자 칸마다 최근 14일 작은 선과 '최근 7일 vs 앞 7일' 이 선다 — 31명이 많은지 적은지는 방향이 말한다
//   - 검색 구역 맨 위에 **검색 순위 준비도** — 순위(/v1/hot)의 문턱을 이 기간의 검색에 대어 "세울 수 있나" 를 답한다.
//     v4.6.3 이 순위를 내리며 남긴 조건("하루 3회 이상인 이름 셋")을 화면이 늘 재서, 다시 올릴 때를 놓치지 않는다
//   - 순위 표는 여덟 줄에서 접는다 — 열다섯 줄 표 여섯 개가 한 화면에 서면 모바일이 5천 픽셀이었다
//
// **2026-10-16 v6 — 모양만 픽셀 판으로.** 구역 · 기능 · 계산은 그대로다. 기간 규칙은 lib/statRange.ts, 기간 판 · 숫자 칸 · 안내 판은
// components/admin/ 아래에서 운영 대시보드(AdminHome)와 나눠 쓴다 — 두 화면의 기간 규칙이 달라지면 숫자가 어긋난다.
// 화면 머리는 AdminHead(관리자 셸)가 아니라 여기서 세운다 — 일반 PageHead 는 관리자 셸에서 안 선다.
//
// 루트 판정은 화면(lib/useLocked 'root')과 서버(/v1/admin/stats) 둘 다 한다. 화면 쪽은 막힌 요청을 안 보내려는 것이다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { serverApi, type AdminStats as Stats, type StatRanked, type StatRange } from '../lib/serverApi';
import { useDexSoft } from '../lib/data';
import { dexNoOf } from '../lib/mon';
import { routeById } from '../routes';
import { useAuthStore } from '../stores/auth';
import { count, DASH } from '../lib/cell';
import { periodName, sinceLabel } from '../lib/statRange';
import { AdminHead } from '../components/AdminShell';
import AdminDenied from '../components/admin/AdminDenied';
import MetricTile from '../components/admin/MetricTile';
import PeriodPicker, { statsError, useStatRange } from '../components/admin/PeriodPicker';
import { AdminPanel, Note, type LoadFail } from '../components/admin/Panels';
import { DayColumns, RankTable, type RankRow, type DayValue } from '../components/StatChart';
import { StatHours } from '../components/StatHours';

// 기간 규칙은 lib/statRange.ts 한 벌 — 검사(statcells.test.ts)와 옛 호출이 이 화면에서 찾으므로 그대로 내보낸다
export { kstToday, daysSinceOpened, sinceDays, sinceLabel, PERIODS, periodItems, customIssue, periodName, rangeLabel } from '../lib/statRange';

// 구역 바로가기 — 고름 줄에 붙어 따라온다. 해시 링크는 같은 주소 안이라 라우터가 안 잡는다 (lib/nav.ts internalHref)
const SECTIONS = [
  { id: 'stat-glance', label: '한눈에' },
  { id: 'stat-visits', label: '방문' },
  { id: 'stat-views', label: '화면' },
  { id: 'stat-search', label: '검색' },
  { id: 'stat-users', label: '가입 · ★' },
];

// 순위(/v1/hot)의 문턱 — server/src/lib/hot.ts 와 같은 값. 검사(statcells.test.ts)가 두 쪽을 맞춘다.
// 한 사람이 순위를 못 만들게 두 겹이다: 한 이름이 이만큼 고른 수를 넘고, 그 이름을 찾은 사람이 이만큼 되고, 그런 이름이 이만큼 있어야 표가 선다
const HOT_MIN_HITS = 3;
const HOT_MIN_VISITORS = 2;
const HOT_MIN_ROWS = 3;
const HOT_PERSON_CAP = 5;

// 검색창 구분 — lib/track.ts trackSearchPick 을 부르는 자리의 이름
const SURFACE_KO: Record<string, string> = {
  dex: '도감 검색창',
  solo_boss: '솔플 계산기 · 보스',
  solo_deck: '솔플 계산기 · 덱',
  pvp_deck: 'PvP 덱 짜기',
  iv_rank: 'PvP 개체값 순위',
  palette: '검색 팔레트 · 입력',
  palette_recent: '검색 팔레트 · 최근 검색',
  palette_boss: '검색 팔레트 · 이번 주 보스',
  home_chip: '홈 · 이번 주 보스 칩',
  hot_fill: '홈 · 많이 본 포켓몬의 보스 채움',
  // 실루엣 퀴즈는 v5.5.0 에 내렸다 — 9/28 ~ 9/29 의 기록이 남아 이름표는 둔다
  quiz: '실루엣 퀴즈 · 추측',
};

function countryName(code: string): string {
  if (code === 'ZZ') return '알 수 없음';
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch { return code; }
}

const ranked = (rows: readonly StatRanked[], label: (key: string) => string, flag?: (row: StatRanked) => boolean): RankRow[] =>
  rows.map((row) => ({ key: row.key, label: label(row.key), value: row.hits, sub: row.visitors, ...(flag?.(row) ? { flag: '문턱 ↑' } : {}) }));

/**
 * 검색 순위 준비도 — "이 검색량으로 순위를 세울 수 있나" 를 숫자로.
 * 운영 순위는 기간이 아니라 **하루 · 이레** 창을 쓰므로, 이 기간에서 넘었다고 바로 서는 것은 아니다.
 * 넘은 이름은 서버가 순위와 같은 계산(사람당 한도 · 문턱)으로 고른 `hot`(이 기간) · `hotToday`(하루 창) 로 센다 —
 * `top` 은 한도 없이 센 상위 15 라 한 사람이 밀어 올린 말이 자리를 다 먹으면 문턱을 넘은 말이 그 안에 없을 수 있다 (Codex, PR #221).
 * 하루 창 판정은 **하루 창의 실제 줄 수**다 — 기간 줄 수와 하루 평균을 섞으면 어느 하루도 셋을 못 채웠는데 켤 수 있다고 적는다 (Codex, PR #229).
 * 하루 평균(perDay)은 참고 숫자로만 적는다
 */
export function hotReadiness(search: { hits: number; visitors: number; hot?: readonly StatRanked[] | undefined; hotToday?: readonly StatRanked[] | undefined }, days: number): {
  passing: number; passingToday: number; perDay: number; dailyNeed: number; ready: boolean; dailyReady: boolean; known: boolean;
} {
  // 옛 서버는 hot 을 안 준다 — 그때는 '모른다' 지 '0' 이 아니다
  const known = search.hot !== undefined && search.hotToday !== undefined;
  const passing = search.hot?.length ?? 0;
  const passingToday = search.hotToday?.length ?? 0;
  const perDay = days > 0 ? search.hits / days : 0;
  const dailyNeed = HOT_MIN_ROWS * HOT_MIN_HITS;
  return { passing, passingToday, perDay, dailyNeed, ready: passing >= HOT_MIN_ROWS, dailyReady: passingToday >= HOT_MIN_ROWS, known };
}

function Readiness({ search, days }: { search: Stats['search']; days: number }) {
  const ready = hotReadiness(search, days);
  const verdict = ready.dailyReady
    ? { tone: 'good' as const, title: '오늘 하루 창만으로 순위가 서요' }
    : ready.ready
      ? { tone: 'caution' as const, title: '이 기간 전체로는 문턱을 넘지만, 오늘 하루 창은 아직이에요' }
      : { tone: 'info' as const, title: '아직 순위를 세울 검색량이 아니에요' };
  return (
    <AdminPanel className="stat-ready" title="검색 순위 준비도"
      note={`운영 순위 문턱 — 한 이름 ${count(HOT_MIN_HITS)}회 이상 · 찾은 사람 ${count(HOT_MIN_VISITORS)}명 이상 · 그런 이름 ${count(HOT_MIN_ROWS)}개 · 사람당 하루 ${count(HOT_PERSON_CAP)}회까지`}>
      <div className="px-grid px-grid--3 adm-tiles">
        <MetricTile label="이 기간에 문턱을 넘은 이름" value={ready.known ? `${count(ready.passing)} / ${count(HOT_MIN_ROWS)}` : DASH}
          sub={ready.known ? "아래 표에서 '문턱 ↑' 딱지 · 순위와 같은 계산(사람당 한도 · 문턱)이에요" : '서버가 아직 이 줄을 안 줘요 — 서버 배포 뒤에 채워져요'} />
        <MetricTile label="오늘 하루 창에서 넘은 이름" value={ready.known ? `${count(ready.passingToday)} / ${count(HOT_MIN_ROWS)}` : DASH}
          sub={ready.known ? '/v1/hot?days=1 과 같은 계산 — 순위를 켜면 이 수가 곧 오늘 표예요' : '서버 배포 뒤에 채워져요'} />
        <MetricTile label="하루 평균 고른 수" value={count(ready.perDay)}
          sub={`참고 — 하루 창이 서려면 어림잡아 ${count(ready.dailyNeed)}회는 넘어야 해요 (이름 ${count(HOT_MIN_ROWS)}개 × ${count(HOT_MIN_HITS)}회)`} />
      </div>
      {ready.known ? <Note tone={verdict.tone} title={verdict.title}>
        {/* 성공 문구는 둘 다 넘을 때만 — 하루 9회를 넘어도 한 이름에 몰리면 제목은 '아직' 인데 본문이 '올릴 수 있다' 고 엇갈린다 (Codex, PR #221) */}
        <p>{ready.dailyReady
          ? `오늘 하루 창에서 이름 ${count(ready.passingToday)}개가 문턱을 넘었어요 — 하루 창 순위를 올릴 수 있어요.`
          : !ready.ready
            ? `문턱을 넘은 이름이 ${count(HOT_MIN_ROWS)}개는 돼야 표가 서요. 이 기간 ${count(ready.passing)}개 · 오늘 ${count(ready.passingToday)}개, 하루 평균 ${count(ready.perDay)}회예요.`
            : `오늘 하루 창은 ${count(ready.passingToday)}개라 아직이에요. 이레 창을 먼저 열 수 있고, 하루 창은 며칠 연속 ${count(HOT_MIN_ROWS)}개를 넘길 때 켜요.`}</p>
      </Note> : (
        <Note tone="info" title="순위 계산 줄을 아직 못 받았어요">
          <p>{`서버가 deploy 브랜치에서 올라가면 채워져요. 그때까지는 하루 평균 고른 수만 봐요 — 하루 창 최소 조건은 ${count(ready.dailyNeed)}회예요.`}</p>
        </Note>
      )}
    </AdminPanel>
  );
}

/**
 * 따라오는 고름 줄이 상단 바 바로 아래에 붙게 — 바 높이는 폭마다 다르다 (관리자 셸은 8rem 이지만 좁은 폭은 다르다).
 * rem 하나로 못 맞추니 바와 고름 줄을 재서 CSS 변수 둘로 준다: 줄이 붙는 자리(--stat-bar-top)와
 * 구역 바로가기가 제목을 세울 자리(--stat-bar-h). 바가 없으면 CSS 의 기본값이 선다.
 * `loaded` 를 받는 이유 — 받는 동안의 틀과 받은 뒤의 틀이 다른 요소라, 받은 뒤에 다시 재야 한다
 */
function useBarOffset(loaded: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = document.querySelector('.app-bar');
    const page = ref.current;
    if (!bar || !page) return;
    const measure = () => {
      page.style.setProperty('--stat-bar-top', `${Math.round(bar.getBoundingClientRect().height)}px`);
      const tool = page.querySelector('.stat-page__bar');
      if (tool) page.style.setProperty('--stat-bar-h', `${Math.round(tool.getBoundingClientRect().height)}px`);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(bar);
    const tool = page.querySelector('.stat-page__bar');
    if (tool) watch.observe(tool);
    return () => watch.disconnect();
  }, [loaded]);
  return ref;
}

/** 도감 번호 → 이름. 키는 도감 번호지만, 2026-10-04 전에는 폼 스프라이트(10000번대)가 그대로 쌓였다 — 그 기록도 원종 이름으로 보여 준다 */
export function useMonName(): (id: number) => string {
  const dex = useDexSoft();
  return useCallback((id: number) => {
    const table = dex?.DEX_DATA;
    const dexNo = table ? dexNoOf(id, table.dex) : null;
    const base = dexNo != null ? table?.names[String(dexNo)] : undefined;
    if (!base) return `#${id}`;
    const form = table?.forms[String(id)]?.name;
    return form && id !== dexNo ? `${form} ${base}` : base;
  }, [dex]);
}

export default function AdminStats() {
  const ctl = useStatRange();
  const [stats, setStats] = useState<Stats | null>(null);
  const page = useBarOffset(stats !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoadFail | null>(null);
  const adminRoot = useAuthStore((s) => s.adminRoot);
  const monName = useMonName();
  const route = routeById('admin-stats')!;

  const load = useCallback(async (which: StatRange) => {
    setBusy(true);
    setError(null);
    try {
      setStats(await serverApi.adminStats(which));
    } catch (caught) {
      setError(statsError(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(ctl.range); }, [ctl.range, ctl.tick, load]);

  const routeName = (id: string) => {
    // 상세 팝업(mon-<번호>)은 서버가 'mon' 하나로 접어 준다 — 라우터 표의 mon 은 이름이 없다
    if (id === 'mon') return '상세 팝업';
    const one = routeById(id);
    return one ? (one.title ?? one.nav ?? id) : id;
  };

  const head = (
    <AdminHead route={route} title="숫자 뒤의 이용 흐름" desc="방문, 화면, 검색을 같은 기간으로 확인합니다. 집계 원본은 구분해서 표시합니다." />
  );

  if (!stats) {
    return (
      <>
        {head}
        <div className="stat-page adm-page">
          {error?.kind === '403'
            ? <AdminDenied kind={adminRoot ? '403' : 'root'} />
            : error
              ? <Note tone="warn" title={error.text} actions={<button type="button" className="px-btn px-skin px-btn--sm" onClick={ctl.reload}>다시 받기</button>} />
              : <p className="px-body px-muted stat-page__wait" aria-busy="true">통계를 받는 중이에요…</p>}
        </div>
      </>
    );
  }

  const { users, favorites, search, views, ga4 } = stats;
  // 순위 계산으로 문턱을 넘은 이름 — 표의 딱지가 이것을 본다
  const hotKeys = new Set((search.hot ?? []).map((row) => row.key));
  const since = sinceLabel(Date.parse(stats.generatedAt));
  const name = periodName(ctl.period, stats, since);
  // 숫자 칸의 작은 선이 읽는 모양으로 — 칸마다 어느 수를 그리는지 여기서 보인다
  const daily = <T extends { day: string }>(rows: readonly T[], pick: (row: T) => number): DayValue[] =>
    rows.map((row) => ({ day: row.day, value: pick(row) }));
  // GA4 칸의 값 — 꺼짐 · 실패는 0 이 아니라 '확인 불가'
  const ga4Note = ga4.status === 'ok' ? null : ga4.status === 'off' ? 'GA4 꺼짐 · 확인 불가' : 'GA4 실패 · 확인 불가';
  return (
    <>
      {head}
      <div ref={page} className={`stat-page adm-page${busy ? ' is-busy' : ''}`} aria-busy={busy || undefined}>
        {/* 고름은 한 줄, 맨 위 — 아래 모든 칸에 같이 걸린다. 따라오는 줄이라 어느 구역에서든 바꾼다 */}
        <div className="stat-page__bar">
          <PeriodPicker ctl={ctl} busy={busy} stats={stats} since={since}>
            <p className="px-caption stat-page__stamp" data-i18n="off">{`${name} · ${stats.generatedAt.slice(0, 16).replace('T', ' ')} UTC 기준 · 운영 채널만`}</p>
            <nav className="px-chips stat-jump" aria-label="구역 바로가기">
              {SECTIONS.map((one) => <a key={one.id} className="px-chip px-skin" href={`#${one.id}`}>{one.label}</a>)}
            </nav>
          </PeriodPicker>
        </div>
        {error ? <Note tone="warn" title={error.text} /> : null}

        <section className="stat-sec adm-sec" id="stat-glance">
          <h3 className="px-sec px-heading">한눈에 <span className="px-sec__note">{name}</span></h3>
          <div className="px-grid adm-tiles">
            {/* 피그마 A02 의 네 칸이 앞에 선다 — GA4 둘 · DB 검색 둘. 나머지 넷은 그 뒤 */}
            <MetricTile label="GA4 이용자" value={ga4.status === 'ok' ? count(ga4.users) : DASH}
              // 비율을 안 적는다 — GA4 의 '처음 온 사람'(first_visit)과 '방문자'(활성 사용자)는 세는 법이 달라 100% 를 넘는다 (운영 101명에 104명)
              sub={ga4.status === 'ok' ? `GA4 · 처음 온 사람 ${count(ga4.newUsers)}` : ga4Note!}
              rows={ga4.status === 'ok' ? daily(ga4.perDay, (row) => row.users) : undefined} />
            <MetricTile label="GA4 페이지뷰" value={ga4.status === 'ok' ? count(ga4.views) : DASH}
              sub={ga4.status === 'ok' ? `GA4 · 방문 ${count(ga4.sessions)}회` : ga4Note!}
              rows={ga4.status === 'ok' ? daily(ga4.perDay, (row) => row.views) : undefined} />
            <MetricTile label="DB 검색 횟수" value={count(search.hits)} sub="DB · 검색에서 고른 수"
              rows={daily(search.perDay, (row) => row.hits)} />
            <MetricTile label="DB 검색 이용자" value={count(search.visitors)} sub="DB · 찾은 사람" />
            <MetricTile label="가입한 사람" value={count(users.total)} sub={`DB · 승인 대기 ${count(users.pending)} · 실험 기능 ${count(users.beta)}`}
              rows={daily(users.newPerDay, (row) => row.count)} />
            <MetricTile label="7일 안에 로그인" value={count(users.active7d)} sub={`DB · 오늘 ${count(users.active1d)} · 30일 ${count(users.active30d)}`} />
            <MetricTile label="살아 있는 로그인" value={count(stats.sessions.active)} sub="DB · 만료 · 로그아웃 안 된 기기" />
            <MetricTile label="★ 담긴 수" value={count(favorites.total)} sub={`DB · 담은 사람 ${count(favorites.people)}`} />
            <MetricTile label="페이지뷰 (moncamp)" value={count(views.hits)} sub={`DB · 방문자 ${count(views.visitors)} · 9월 24일부터`}
              rows={daily(views.perDay, (row) => row.hits)} />
          </div>
          <p className="px-caption stat-page__note">{stats.days >= 7
            ? '작은 선은 최근 14일, 화살표는 최근 7일을 그 앞 7일과 견준 값이에요. 7일 창에서는 앞 7일이 없어 화살표가 안 서요.'
            : '하루 · 며칠만 고르면 추세(작은 선 · 화살표)는 세우지 않아요. 7일 이상을 고르면 보여요.'}</p>
        </section>

        <section className="stat-sec adm-sec" id="stat-visits">
          <h3 className="px-sec px-heading">방문 <span className="px-sec__note">GA4</span></h3>
          {ga4.status === 'ok' ? (
            <>
              {/* 받기는 됐는데 기간 전체가 0 — 권한은 있으나 사이트가 쓰지 않는 속성일 때다 (2026-09-24 Firebase 속성으로 겪었다) */}
              {/* 셋 다 0 일 때만 '빈 속성' — 페이지뷰만 0 이면 기록은 있는 속성이다 */}
              {ga4.users === 0 && ga4.views === 0 && ga4.sessions === 0 ? (
                <Note tone="warn" title="GA4 속성에 이 기간 기록이 없어요">
                  <p>권한은 있지만 비어 있는 속성이에요. 저장소 변수 GA4_PROPERTY_ID 가 사이트 측정 ID(G-…)를 가진 속성의 ID 인지 확인해 주세요.</p>
                </Note>
              ) : null}
              <div className="px-grid px-grid--2 adm-grid">
                <AdminPanel><DayColumns title="방문자" source="GA4 · 명" unit="명" summable={false} rows={ga4.perDay.map((row) => ({ day: row.day, value: row.users }))} /></AdminPanel>
                <AdminPanel><DayColumns title="페이지뷰" source="GA4 · 회" unit="회" rows={ga4.perDay.map((row) => ({ day: row.day, value: row.views }))} /></AdminPanel>
              </div>
              <div className="px-grid px-grid--2 adm-grid">
                <RankTable title="많이 본 주소" source="GA4" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
                  rows={ga4.pages.map((row) => ({ key: row.key, label: row.key, value: row.views, sub: row.users }))} />
                <RankTable title="나라" source="GA4" valueHead="방문자" subHead="페이지뷰" empty="아직 없어요"
                  rows={ga4.countries.map((row) => ({ key: row.key, label: countryName(row.key), value: row.users, sub: row.views }))} />
              </div>
            </>
          ) : (
            <Note tone={ga4.status === 'off' ? 'info' : 'warn'} title={ga4.status === 'off' ? 'GA4 칸이 꺼져 있어요' : 'GA4 숫자를 못 받았어요'}>
              <p>{ga4.reason}</p>
              <p>켜는 법 — ① GA4 관리 → 속성 액세스 관리에 서버 서비스 계정을 뷰어로 추가 ② moncamp api 프로젝트에서 Google Analytics Data API 사용 ③ 저장소 변수 GA4_PROPERTY_ID 에 속성 ID(숫자) — docs/OPERATIONS.md 운영 통계 절</p>
            </Note>
          )}
        </section>

        <section className="stat-sec adm-sec" id="stat-views">
          <h3 className="px-sec px-heading">화면별 페이지뷰 <span className="px-sec__note">moncamp 수집</span></h3>
          <AdminPanel>
            <DayColumns title="페이지뷰" source="DB · 조회수" unit="회" rows={views.perDay.map((row) => ({ day: row.day, value: row.hits }))}
              note="9월 24일부터 셉니다 · 화면 id 만 — 주소 · 검색어는 안 받아요. 9월 29일부터 상세 팝업은 도감 번호로 세요" />
          </AdminPanel>
          <div className="px-grid px-grid--3 adm-grid">
            <RankTable title="많이 본 화면" source="DB" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
              rows={ranked(views.top, routeName)} />
            {/* 홈의 '이번 주 많이 본 포켓몬' 과 같은 계산(/v1/mons/hot) — 옛 서버는 이 칸을 안 준다 */}
            <RankTable title="많이 본 포켓몬" source="DB" valueHead="페이지뷰" subHead="방문자" empty={views.mons ? '아직 없어요' : '서버가 아직 안 줘요 — 옛 서버 필드 없음'}
              rows={ranked(views.mons ?? [], (key) => monName(Number(key)))} />
            <RankTable title="나라" source="DB" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
              rows={ranked(views.countries, countryName)} />
          </div>
          {/* 날짜 탭마다 24칸 — 홈 띠와 같은 수치를 "언제" 로 읽는다 */}
          <StatHours days={views.perDay.map((row) => row.day)} monName={monName} stamp={stats.generatedAt} />
        </section>

        <section className="stat-sec adm-sec" id="stat-search">
          <h3 className="px-sec px-heading">검색 <span className="px-sec__note">moncamp 수집</span></h3>
          <Readiness search={search} days={stats.days} />
          <AdminPanel>
            <DayColumns title="검색에서 고른 수" source="DB · 회" unit="회" rows={search.perDay.map((row) => ({ day: row.day, value: row.hits }))} />
          </AdminPanel>
          <div className="px-grid px-grid--3 adm-grid">
            <RankTable title="많이 찾은 포켓몬" source="DB" valueHead="고른 수" subHead="사람" empty="아직 없어요"
              rows={ranked(search.top, (key) => key, (row) => hotKeys.has(row.key))} />
            <RankTable title="검색창" source="DB" valueHead="고른 수" subHead="사람" empty="아직 없어요"
              rows={ranked(search.surfaces, (key) => SURFACE_KO[key] ?? key)} />
            <RankTable title="나라" source="DB" valueHead="고른 수" subHead="사람" empty="아직 없어요"
              rows={ranked(search.countries, countryName)} />
          </div>
        </section>

        <section className="stat-sec adm-sec" id="stat-users">
          <h3 className="px-sec px-heading">가입 · ★ <span className="px-sec__note">집계 더 보기</span></h3>
          <div className="px-grid px-grid--2 adm-grid">
            <AdminPanel><DayColumns title="새로 가입" source="DB · 명" unit="명" rows={users.newPerDay.map((row) => ({ day: row.day, value: row.count }))} /></AdminPanel>
            <RankTable title="많이 담긴 포켓몬 ★" source="DB" valueHead="담은 사람" empty="아직 없어요"
              rows={favorites.top.map((row) => ({ key: String(row.dex), label: monName(row.dex), value: row.users }))} />
          </div>
          <p className="px-caption stat-page__note">{`역할 — 루트 ${count(users.root)} · 관리자 ${count(users.admin)} · 승인 ${count(users.approved)} · 대기 ${count(users.pending)}`}</p>
        </section>
      </div>
    </>
  );
}
