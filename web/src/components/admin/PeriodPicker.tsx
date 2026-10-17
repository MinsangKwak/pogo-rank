// ─────────────────────────────────────────────────────────────────────────────
// components/admin/PeriodPicker.tsx — 기간 판 (v6 피그마 A01 · A02 공통)
//
// 칩 일곱 · 받은 기간 한 줄 · 달력 둘 · [적용] [새로고침]. 운영 대시보드와 상세 통계가 **같은 판 · 같은 훅**을 쓴다 —
// 기간 규칙(lib/statRange.ts)이 한 벌이어야 두 화면의 숫자가 맞는다.
// useStatRange: `range` 가 바뀌면 받는 쪽이 다시 묻고, 같은 범위를 다시 받고 싶을 때(새로고침)는 `tick` 이 오른다 —
// 탭을 켜 둔 채 자정을 넘기면 '오늘' 이 어제 날짜로 다시 받았다 (2026-10-02 점검). 범위가 그대로면 상태가 안 바뀌어 효과가 안 도니 tick 으로 돈다
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { ApiError, type AdminStats as Stats, type StatRange } from '../../lib/serverApi';
import { count, DASH } from '../../lib/cell';
import { customIssue, DAYS_MAX, kstToday, OPENED, periodItems, periodName, rangeLabel, sinceDays } from '../../lib/statRange';
import { PxChips } from '../Bits';

export function useStatRange() {
  const [period, setPeriod] = useState('since');
  // 달력의 시작 · 끝 — 기본은 연 날부터 오늘. '적용' 을 눌러야 range 가 된다 (날짜를 고르는 중에 받지 않는다)
  const [draft, setDraft] = useState({ from: OPENED, to: kstToday() });
  const [range, setRange] = useState<StatRange>({ days: sinceDays() });
  const [tick, setTick] = useState(0);
  const issue = customIssue(draft);
  // 고른 기간의 범위 — 오늘은 부르는 순간의 한국 날짜, '9/14부터' 는 그날까지의 날 수
  const rangeOf = (id: string): StatRange => {
    if (id === 'today') { const day = kstToday(); return { from: day, to: day }; }
    return { days: id === 'since' ? sinceDays() : Number(id) };
  };
  const pick = (id: string) => {
    setPeriod(id);
    if (id === 'custom') { if (!issue) setRange({ ...draft }); return; }
    setRange(rangeOf(id));
  };
  // 달력의 [적용] — 직접 고르기로 바꾸고 그 양끝을 받는다
  const apply = () => { if (issue) return; setPeriod('custom'); setRange({ ...draft }); };
  const reload = () => {
    if (period === 'custom') { setTick((n) => n + 1); return; }
    const next = rangeOf(period);
    if (JSON.stringify(next) === JSON.stringify(range)) setTick((n) => n + 1);
    else setRange(next);
  };
  return { period, draft, setDraft, range, tick, issue, pick, apply, reload };
}

export type StatRangeCtl = ReturnType<typeof useStatRange>;

/** 통계를 못 받았을 때 — 권한(403)과 회선 · 서버 문제를 가른다. 둘을 한 문구로 접으면 권한 문제를 회선 탓으로 읽는다 */
export function statsError(caught: unknown): { kind: '403' | 'fail'; text: string } {
  if (caught instanceof ApiError && caught.status === 403) return { kind: '403', text: '루트 관리자만 볼 수 있어요' };
  return { kind: 'fail', text: '통계를 받지 못했어요 — 이 상태는 0 과 다릅니다. 잠시 뒤 새로고침을 눌러 주세요.' };
}

/** `stats` 가 있으면 받은 기간의 양끝을 적고, 없으면(첫 받기 전) 고른 이름만 적는다. `children` 은 판 바닥(상세 통계의 받은 시각 · 구역 바로가기) */
export default function PeriodPicker({ ctl, busy, stats, since, children }: { ctl: StatRangeCtl; busy: boolean; stats: Stats | null; since: string; children?: ReactNode }) {
  const today = kstToday();
  const span = stats ? rangeLabel(stats.from, stats.to) : DASH;
  const name = stats ? periodName(ctl.period, stats, since) : '받는 중';
  return (
    <section className="px-panel px-skin px-drop adm-period" aria-label="기간">
      <PxChips items={periodItems(since)} value={ctl.period} onPick={ctl.pick} label="기간" />
      <p className="px-caption px-mono adm-period__span" data-i18n="off">{`${span} · ${name} · 한국 시간(KST)`}</p>
      <p className="px-caption">{`직접 선택: 오늘까지 · 최대 ${count(DAYS_MAX)}일`}</p>
      <form className="adm-period__dates" onSubmit={(event) => { event.preventDefault(); ctl.apply(); }}>
        <label className="px-input px-skin adm-period__date">
          <span className="px-caption">시작</span>
          <input type="date" value={ctl.draft.from} max={today} onChange={(event) => ctl.setDraft({ ...ctl.draft, from: event.target.value })} />
        </label>
        <label className="px-input px-skin adm-period__date">
          <span className="px-caption">끝</span>
          <input type="date" value={ctl.draft.to} max={today} onChange={(event) => ctl.setDraft({ ...ctl.draft, to: event.target.value })} />
        </label>
        <button type="submit" className="px-btn px-btn--primary px-skin" disabled={busy || !!ctl.issue}>적용</button>
        <button type="button" className="px-btn px-skin" onClick={ctl.reload} disabled={busy}>{busy ? '받는 중…' : '새로고침'}</button>
      </form>
      {ctl.issue ? <p className="px-caption adm-period__issue" role="alert">{ctl.issue}</p> : null}
      {children}
    </section>
  );
}
