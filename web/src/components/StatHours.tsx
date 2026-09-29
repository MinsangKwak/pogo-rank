// ─────────────────────────────────────────────────────────────────────────────
// components/StatHours.tsx — 시간대별 많이 본 포켓몬 (루트 통계, 2026-09-30)
//
// 하루를 24칸(00~01시 … 23~24시)으로 나눠 칸마다 상세 팝업을 연 포켓몬 상위를 적는다 — 주인 요청
// "24시 기준으로 시간대별로 나열하고 하루 단위로 탭". 날짜 탭은 위 기간의 날 가운데 최근 HOUR_DAYS_MAX 일이다.
// 홈의 '지금 많이 보는 포켓몬' 과 같은 수치(mon-<번호> view)라 "홈 띠가 왜 저렇게 서나" 를 여기서 읽는다.
// 날마다 서버(/v1/admin/stats/hours)에 따로 묻고 받은 날은 기억한다 — 탭을 오가도 다시 안 받는다.
// 빈 칸도 줄을 둔다 — 24줄이 늘 같은 자리에 서야 "몇 시에 보나" 가 한눈에 읽힌다
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { serverApi, type StatHours as Hours, type StatRanked } from '../lib/serverApi';
import { Segmented } from '../ds';
import { count, DASH } from '../lib/cell';
import { dayLabel } from './StatChart';

/** 탭에 올리는 날 수의 끝 — 30일 기간이 한 줄에 다 서고, 400일 기간은 최근 한 달만 */
export const HOUR_DAYS_MAX = 31;

/** '00~01시' — 24시 기준이라 마지막 칸은 '23~24시'. 밖의 값은 대시 */
export function hourLabel(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DASH;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(hour)}~${two(hour + 1)}시`;
}

/** 탭 이름 — '9/30'. 요일까지 붙이면 서른 개가 한 줄에 못 선다 */
export function tabLabel(day: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${Number(match[1])}/${Number(match[2])}` : DASH;
}

/** 탭에 올릴 날 — 기간의 날 가운데 최근 HOUR_DAYS_MAX 일, 오래된 날부터 */
export function hourDays(days: readonly string[]): string[] {
  return days.slice(-HOUR_DAYS_MAX);
}

/** 칸의 포켓몬 한 줄 — '보만다 4 · 망나뇽 2'. 비면 대시 */
export function monLine(mons: readonly StatRanked[], name: (dex: number) => string): string {
  if (!mons.length) return DASH;
  return mons.map((row) => `${name(Number(row.key))} ${count(row.hits)}`).join(' · ');
}

/** 지금의 한국 날짜와 시각 — 오늘 탭에서 지금 칸을 표시한다 */
export function kstNow(now: number = Date.now()): { day: string; hour: number } {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  return { day: kst.toISOString().slice(0, 10), hour: kst.getUTCHours() };
}

const EMPTY_HOURS = Array.from({ length: 24 }, (_, hour) => ({ hour, hits: 0, visitors: 0, mons: [] as StatRanked[] }));

/**
 * `stamp` 는 위 통계를 받은 시각(generatedAt) — [새로 받기] 로 위가 새로 오면 기억한 날도 다시 받는다.
 * 받은 날은 `stamp|day` 로 기억하고 실패는 기억하지 않는다 — 실패 줄의 [다시 받기] 가 같은 날을 다시 묻는다 (Codex, PR #253)
 */
export function StatHours({ days, monName, stamp }: { days: readonly string[]; monName: (dex: number) => string; stamp: string }) {
  const tabs = hourDays(days);
  const last = tabs[tabs.length - 1] ?? '';
  const [picked, setPicked] = useState(last);
  // 기간이 바뀌어 고른 날이 탭에서 사라지면 마지막 날로 — 없는 날을 붙들고 있지 않는다
  const day = tabs.includes(picked) ? picked : last;
  const key = `${stamp}|${day}`;
  const [got, setGot] = useState<Record<string, Hours>>({});
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!day || got[key]) return;
    let live = true;
    setBusy(true);
    setError('');
    serverApi.adminStatsHours(day)
      .then((hours) => { if (live) setGot((prev) => ({ ...prev, [key]: hours })); })
      .catch(() => { if (live) setError('시간대 표를 받지 못했어요.'); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [day, key, got, retry]);

  const hours = got[key]?.hours ?? EMPTY_HOURS;
  const total = hours.reduce((sum, one) => sum + one.hits, 0);
  const now = kstNow();
  return (
    <section className={`stat-hours${busy ? ' is-busy' : ''}`}>
      <div className="stat-hours__head">
        <h3 className="stat-rank__title">시간대별 많이 본 포켓몬</h3>
        <span className="stat-hours__sub">{day ? `${dayLabel(day)} · 팝업 ${count(total)}회 · 한국 시각` : ''}</span>
      </div>
      {tabs.length ? (
        <Segmented className="stat-hours__days" label="날짜" value={day} onPick={setPicked}
          items={tabs.map((one) => ({ id: one, label: tabLabel(one) }))} />
      ) : null}
      {error ? (
        <p className="stat-rank__empty" role="alert">
          {error}
          <button type="button" className="stat-rank__more" onClick={() => setRetry((n) => n + 1)} disabled={busy}>다시 받기</button>
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th scope="col">시간대</th>
            <th scope="col" className="stat-hours__num">페이지뷰</th>
            <th scope="col" className="stat-hours__num">방문자</th>
            <th scope="col">많이 본 포켓몬</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((one) => (
            <tr key={one.hour} className={day === now.day && one.hour === now.hour ? 'is-now' : undefined}>
              <th scope="row">{hourLabel(one.hour)}</th>
              <td className="stat-hours__num">{count(one.hits)}</td>
              <td className="stat-hours__num">{count(one.visitors)}</td>
              <td className="stat-hours__mons">{monLine(one.mons, monName)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="stat-page__note">상세 팝업을 연 수예요 — 홈의 '지금 많이 보는 포켓몬' 과 같은 수치. 한 사람은 한 칸에 같은 포켓몬 5회까지 세요.</p>
    </section>
  );
}
