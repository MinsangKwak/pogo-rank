// ─────────────────────────────────────────────────────────────────────────────
// screens/AdminHome.tsx — 운영 대시보드 (루트만, v6 피그마 A01 '오늘의 캠프 운영')
//
// 상세 통계(AdminStats)와 **같은 서버 숫자 · 같은 기간 규칙**을 쓴다 — 기간 판(components/admin/PeriodPicker)을 그대로 빌려
// "대시보드는 46명인데 통계는 48명" 같은 어긋남이 안 생기게. 여기는 한눈에 볼 넷(이용자 · 승인 대기 · 7일 활동 · ★)과
// 일별 조회 하나, 그리고 **다음에 할 일**(승인 대기 → 가입 승인 화면)만 둔다. 더 깊은 숫자는 상세 통계로 보낸다.
// 숫자는 전부 lib/cell.ts 를 지난다 — 받기 전 · 실패 · 옛 서버 필드 없음은 0 이 아니라 대시다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { serverApi, type AdminStats as Stats, type StatRange } from '../lib/serverApi';
import { routeById, routeHref } from '../routes';
import { useAuthStore } from '../stores/auth';
import { count, DASH } from '../lib/cell';
import { sinceLabel } from '../lib/statRange';
import { AdminHead } from '../components/AdminShell';
import { DayColumns } from '../components/StatChart';
import { PixelIcon } from '../components/PixelIcon';
import AdminDenied from '../components/admin/AdminDenied';
import MetricTile from '../components/admin/MetricTile';
import PeriodPicker, { statsError, useStatRange } from '../components/admin/PeriodPicker';
import { AdminPanel, KvList, Note, RankList, type LoadFail } from '../components/admin/Panels';
import { useMonName } from './AdminStats';

// 많이 담긴 포켓몬 — 대시보드에는 다섯 줄만. 전체는 상세 통계의 '가입 · ★' 구역
const FAV_ROWS = 5;

export default function AdminHome({ rest }: { rest?: string }) {
  void rest;
  const ctl = useStatRange();
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoadFail | null>(null);
  const adminRoot = useAuthStore((s) => s.adminRoot);
  const monName = useMonName();
  const route = routeById('admin')!;

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

  const since = stats ? sinceLabel(Date.parse(stats.generatedAt)) : sinceLabel();
  const head = <AdminHead route={route} title="오늘의 캠프 운영" desc="가입 현황과 이용 흐름을 한눈에 확인하세요." />;

  // 서버가 막았다 — 권한 판이 전부다. 숫자 틀을 세우지 않는다
  if (error?.kind === '403') {
    return <>{head}<AdminDenied kind={adminRoot ? '403' : 'root'} /></>;
  }

  const users = stats?.users;
  const favorites = stats?.favorites;
  const views = stats?.views;
  // 받기 전 · 실패 상태는 숫자 칸이 대시다 — 0 과 구분한다
  const num = (value: number | undefined) => (stats ? count(value) : DASH);
  const person = (value: number | undefined) => (stats ? `${count(value)}명` : DASH);
  const pending = users?.pending ?? 0;
  // 받기 전 · 실패일 때 판 안에 적는 한 마디
  const waiting = error ? '받지 못했어요 — 확인 불가' : '받는 중…';
  return (
    <>
      {head}
      <div className={`adm-page${busy ? ' is-busy' : ''}`} aria-busy={busy || undefined}>
        <PeriodPicker ctl={ctl} busy={busy} stats={stats} since={since} />
        {error ? <Note tone="warn" title={error.text} actions={<button type="button" className="px-btn px-btn--sm px-skin" onClick={ctl.reload}>다시 받기</button>} /> : null}
        {!stats && !error ? <p className="px-body px-muted" aria-busy="true">통계를 받는 중이에요…</p> : null}

        <div className="px-grid adm-tiles">
          <MetricTile label="전체 이용자" value={num(users?.total)} sub="DB · 현재 가입자" />
          <MetricTile label="승인 대기" value={num(users?.pending)} sub="DB · 루트만 확인" tone={pending > 0 ? 'orange' : undefined} />
          <MetricTile label="7일 활동 이용자" value={num(users?.active7d)} sub="DB · 로그인 기준" />
          <MetricTile label="담아 둔 포켓몬" value={num(favorites?.total)} sub={stats ? `DB · ${count(favorites?.people)}명이 저장` : 'DB · 담은 사람'} />
        </div>

        <div className="adm-grid adm-grid--wide">
          <AdminPanel title={views ? undefined : '일별 화면 조회'} note={views ? undefined : waiting}>
            {views ? <DayColumns title="일별 화면 조회" source="DB · 조회수" unit="회" rows={views.perDay.map((row) => ({ day: row.day, value: row.hits }))} /> : null}
            <p className="px-body px-muted">
              {`합계 ${num(views?.hits)}회 · 순방문 ${num(views?.visitors)}명`}<br />DB와 GA4는 집계 기준이 달라요.
            </p>
          </AdminPanel>
          <AdminPanel className="adm-pending">
            <h3 className="px-sub">승인 검토를 기다려요</h3>
            <p className="px-heading adm-pending__count">{stats ? `${count(pending)}명의 가입 요청` : `${DASH} 가입 요청`}</p>
            <p className="px-body px-muted">{pending > 0 ? '계정과 요청 상태를 확인한 뒤 한 명씩 승인해 주세요.' : '지금은 기다리는 요청이 없어요. 새 요청은 이 자리에 떠요.'}</p>
            <a className="px-btn px-btn--primary px-btn--block px-skin" href={routeHref('admin-users')}><PixelIcon name="team" /> 승인 대기 보기</a>
          </AdminPanel>
        </div>

        <div className="adm-grid">
          <AdminPanel title="많이 담긴 포켓몬" note="DB" more={{ href: routeHref('admin-stats'), label: '상세 통계에서 더 보기' }}>
            {favorites && favorites.top.length
              ? <RankList rows={favorites.top.slice(0, FAV_ROWS).map((row) => ({ key: String(row.dex), label: monName(row.dex), value: `${count(row.users)}명` }))} />
              : <p className="px-caption">{stats ? '아직 담긴 포켓몬이 없어요' : waiting}</p>}
          </AdminPanel>
          <AdminPanel title="가입 · 권한 현황" note="DB">
            <KvList rows={[
              { label: '루트', value: person(users?.root) }, { label: '관리자', value: person(users?.admin) }, { label: '승인', value: person(users?.approved) },
              { label: '승인 대기', value: person(users?.pending) }, { label: '실험 기능', value: person(users?.beta) },
            ]} />
          </AdminPanel>
        </div>
      </div>
    </>
  );
}
