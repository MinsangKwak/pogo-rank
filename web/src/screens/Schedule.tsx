// ─────────────────────────────────────────────────────────────────────────────
// screens/Schedule.tsx — 이벤트 일정 (달력 · 기간 막대 · 이번 달 전체)
//
// v3 components/schedule.js + pages.js renderSchedulePage 이식.
// 처음에는 다가오는 이벤트를 `ul.row-list` 한 줄씩 세웠는데, **화면이 통째로 다른 것**이 됐다 —
// 이 화면의 물음은 "무엇이 있나" 가 아니라 **"언제 무엇이 열리나"** 이고, 그 답은 달력 모양이어야 한다.
//
// 세 벌이 같은 분류 필터(cat)를 본다:
//   달력      날짜 칸에 그날 걸친 일정의 분류 점 + 이름 최대 셋
//   기간 막대  한 줄에 일정 하나, 시작~종료를 분류 색으로 잇는다 (좁은 드로어에는 안 들어가 이 화면 전용)
//   전체 목록  분류별로 묶은 날짜 + 문구
//
// 일정 값(SCHEDULE_MONTHS)은 손으로 적은 실제 공지라 **옮겨 적지 않고** 빌드가 그대로 꺼내 온다
// (scripts/extract-data.mjs). 날짜 한 글자가 틀리면 사람이 이벤트를 놓친다.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useMemo, useState } from 'react';
import { useSchedule } from '../lib/data';
import { Chips, type ChipDef } from '../components/Bits';
import { track } from '../lib/track';
import KoOnlyNote from '../components/KoOnlyNote';
import type { ScheduleCat, ScheduleItem, ScheduleMonth } from '../types/data';

const SCHED_CAT_KEY = 'pogo_sched_cat';   // v3 와 같은 키
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 오늘 기준으로 보여 줄 달을 고른다.
 *   1) 오늘이 속한 달 → 2) 없으면 오늘보다 앞선 달 중 가장 늦은 달 → 3) 그것도 없으면 등재된 첫 달.
 * 미래 달로는 가지 않는다 — 다음 달 일정은 이번 달 달력이 끝난 뒤에 자연히 나타난다.
 */
function pickMonth(months: Record<string, ScheduleMonth>, today = new Date()): ScheduleMonth | undefined {
  const keys = Object.keys(months).sort();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (months[todayKey]) return months[todayKey];
  const past = keys.filter((key) => key < todayKey);
  const pick = past.length ? past[past.length - 1] : keys[0];
  return pick ? months[pick] : undefined;
}

const readCat = () => {
  try { return localStorage.getItem(SCHED_CAT_KEY) || 'all'; } catch { return 'all'; }
};

/** 달력 — 날짜를 누르면 아래 상세가 그날 일정으로 바뀐다 */
function Cal({ month, cats, items, picked, onPick }: {
  month: ScheduleMonth; cats: Record<string, ScheduleCat>; items: ScheduleItem[];
  picked: number; onPick: (day: number) => void;
}) {
  const { y, m } = month.ym;
  const today = new Date();
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const todayDay = isThisMonth ? today.getDate() : 0;
  const offset = new Date(y, m - 1, 1).getDay();        // 1일을 제 요일 칸으로 밀어낸다
  const last = new Date(y, m, 0).getDate();             // 다음 달 0일 = 이 달 마지막 날
  const on = (day: number) => items.filter((item) => day >= item.s && day <= item.e);

  return (
    <div className="schedule__cal">
      {WEEKDAYS.map((name) => <span key={name} className="cal__head">{name}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`pad-${index}`} />)}
      {Array.from({ length: last }, (_, index) => {
        const day = index + 1;
        const dayItems = on(day);
        const keys = [...new Set(dayItems.map((item) => item.cat))];
        const klass = `cal__day${day === todayDay ? ' is-today' : ''}${day === picked ? ' is-selected' : ''}`;
        return (
          <button key={day} className={klass} aria-label={`${m}월 ${day}일, 일정 ${dayItems.length}개`}
            onClick={() => onPick(day)}>
            <span className="cal__num">{day}</span>
            <span className="cal__dots">
              {keys.map((key) => <span key={key} className="dot" style={{ background: cats[key]?.color }} />)}
            </span>
            {/* 넓은 화면은 칸 안에서 이름을 셋까지 읽는다 — 나머지 건수는 아래 상세로 안내한다 */}
            <span className="cal__events" aria-hidden="true">
              {dayItems.slice(0, 3).map((item, i) => (
                <span key={i} className="cal__event" title={item.label}
                  style={{ ['--event-color' as string]: cats[item.cat]?.color }}>
                  {item.label.split(' (')[0]}
                </span>
              ))}
              {dayItems.length > 3 ? <span className="cal__more">{`+${dayItems.length - 3}개 더 보기`}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 기간 막대 — 한 줄이 일정 하나. 막대 위치는 (s-1)/일수, 폭은 (e-s+1)/일수 의 백분율이라
 * 화면 폭이 달라도 그대로 맞는다. 시작이 달 후반(60% 이후)이면 라벨을 막대 끝에 오른쪽 정렬해 잘리지 않게 한다.
 */
function Timeline({ month, cats, items }: {
  month: ScheduleMonth; cats: Record<string, ScheduleCat>; items: ScheduleItem[];
}) {
  const { y, m } = month.ym;
  const today = new Date();
  const todayDay = today.getFullYear() === y && today.getMonth() + 1 === m ? today.getDate() : 0;
  const last = new Date(y, m, 0).getDate();
  const pct = (day: number) => `${((day - 1) / last) * 100}%`;
  const width = (from: number, to: number) => `${((to - from + 1) / last) * 100}%`;
  const order = Object.keys(cats);
  const rows = [...items].sort((a, b) =>
    order.indexOf(a.cat) - order.indexOf(b.cat) || a.s - b.s || (b.e - b.s) - (a.e - a.s));
  const days = Array.from({ length: last }, (_, index) => {
    const day = index + 1;
    const weekday = new Date(y, m - 1, day).getDay();
    const mark = `${weekday === 0 || weekday === 6 ? ' is-weekend' : ''}${day === todayDay ? ' is-today' : ''}`;
    return { day, mark };
  });

  return (
    <div className="timeline">
      <div className="timeline__ruler">
        {days.map(({ day, mark }) => (
          <span key={day} className={`timeline__tick${mark}`} style={{ left: pct(day), width: width(day, day) }}>
            {day === 1 || day % 5 === 0 ? <i>{day}</i> : null}
          </span>
        ))}
      </div>
      <div className="timeline__body">
        {/* 주말 음영·오늘 선을 행 전체 높이로 깔기 위해 눈금과 같은 좌표의 배경 칸을 한 번 더 둔다 */}
        <div className="timeline__grid">
          {days.map(({ day, mark }) => (
            <span key={day} className={`timeline__col${mark}`} style={{ left: pct(day), width: width(day, day) }} />
          ))}
        </div>
        {rows.map((item, index) => {
          return (
            <div key={index} className="timeline__row"
              title={`${m}/${item.s}${item.e !== item.s ? `–${item.e}` : ''} ${item.label}`}>
              <span className="timeline__bar"
                style={{ left: pct(item.s), width: width(item.s, item.e), background: cats[item.cat]?.color }} />
              {/* 괄호 안 설명은 막대와 아래 목록이 이미 말해 준다 — 여기서는 떼고 title 로만 남긴다 */}
              <span className="timeline__label">
                {`${m}/${item.s}${item.e !== item.s ? `–${item.e}` : ''} · ${item.label.split(' (')[0]}`}
              </span>
            </div>
          );
        })}
        {rows.length ? null : <p className="schedule__item">선택한 분류에 등록된 일정이 없어요.</p>}
      </div>
    </div>
  );
}

export default function Schedule() {
  const { data } = useSchedule();
  const months = data.SCHEDULE_MONTHS;
  const monthKeys = Object.keys(months).sort();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const initial = pickMonth(months);
    return monthKeys.find((key) => months[key] === initial) ?? '';
  });
  const month = months[selectedMonth];
  const monthIndex = monthKeys.indexOf(selectedMonth);
  const cats = data.SCHEDULE_CATS;
  const [view, setView] = useState<'list' | 'timeline'>('list');
  const [cat, setCat] = useState(() => {
    const saved = readCat();
    return saved === 'all' || cats[saved] ? saved : 'all';
  });
  const today = new Date();
  const [day, setDay] = useState(() => {
    if (!month) return 1;
    const thisMonth = today.getFullYear() === month.ym.y && today.getMonth() + 1 === month.ym.m;
    return thisMonth ? today.getDate() : 1;
  });

  const items = useMemo(
    () => (month ? (cat === 'all' ? month.items : month.items.filter((item) => item.cat === cat)) : []),
    [month, cat],
  );
  if (!month) return <div className="page__body"><p className="empty">아직 일정 정보를 불러오지 못했어요.</p></div>;

  const { m } = month.ym;
  const changeMonth = (index: number) => {
    const key = monthKeys[index];
    if (!key) return;
    const next = months[key]!;
    setSelectedMonth(key);
    setDay(today.getFullYear() === next.ym.y && today.getMonth() + 1 === next.ym.m ? today.getDate() : 1);
  };
  const chipItems: ChipDef[] = [{ id: 'all', label: '전체' },
    ...Object.entries(cats).map(([id, one]) => ({ id, label: one.name, type: one.type }))];
  const onDay = items.filter((item) => day >= item.s && day <= item.e);

  return (
    <div className="page__body schedule__page" id="page-schedule" data-route="schedule">
      <KoOnlyNote kind="kst" />
      <nav className="schedule__month-nav" aria-label="달력 월 이동">
        <button type="button" aria-label="이전 달" disabled={monthIndex <= 0} onClick={() => changeMonth(monthIndex - 1)}>‹</button>
        <div aria-live="polite"><span>{month.ym.y}년</span><h2>{m}월 일정</h2></div>
        <button type="button" aria-label="다음 달" disabled={monthIndex >= monthKeys.length - 1} onClick={() => changeMonth(monthIndex + 1)}>›</button>
      </nav>
      <div className="page__filters">
        <Chips items={chipItems} value={cat} onPick={(id) => {
          setCat(id);
          try { localStorage.setItem(SCHED_CAT_KEY, id); } catch { /* 저장 불가 환경 */ }
          track('sched_cat', { cat: id });
        }} />
      </div>
      {/* 달력과 ⚔️ 레이드 보스는 **다른 것**을 말한다 — 밝히지 않으면 두 화면이 서로 다른 보스를 가리켜 보인다 */}
      <p className="note schedule__bridge">
        <span>날짜를 선택하면 그날의 이벤트를 확인할 수 있어요.</span>{' '}
        <a href="/raids">현재 레이드 보스 보기</a>
      </p>

      <div>
        <div>
          <Cal month={month} cats={cats} items={items} picked={day} onPick={setDay} />
          {/* 점과 이름은 감싸지 않고 나란히 둔다 — 감싸면 한 덩이가 돼 줄바꿈 자리가 달라진다 */}
          <p className="schedule__legend">
            {Object.values(cats).map((one) => (
              <Fragment key={one.name}>
                <span className="dot" style={{ background: one.color }} />{one.name}{'  '}
              </Fragment>
            ))}
          </p>
          <div className="schedule__detail">
            <p className="schedule__sec">{`${m}/${day} 일정`}</p>
            {onDay.length
              ? onDay.map((item, index) => (
                <p key={index} className="schedule__item">
                  <span className="dot" style={{ background: cats[item.cat]?.color }} />{item.label}
                  {item.source ? <a className="schedule__source" href={item.source} target="_blank" rel="noreferrer">공식 공지 ↗</a> : null}
                </p>
              ))
              : <p className="schedule__item">등록된 일정이 없어요.</p>}
          </div>
          <p className="schedule__note">{month.note} 날짜를 선택하면 해당일의 일정을 확인할 수 있어요.</p>
        </div>
      </div>

      <div className="schedule__view-tabs" aria-label="일정 보기 방식">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>전체 일정</button>
        <button type="button" aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>기간 한눈에 보기</button>
      </div>
      {view === 'timeline' ? <section aria-label="기간 한눈에 보기">
        <div className="schedule__timeline-scroll"><Timeline month={month} cats={cats} items={items} /></div>
      </section> : null}
      <section hidden={view !== 'list'} aria-label={`${m}월 전체 일정`}>
      {/* 겉의 <div> 는 자리, 안의 <div> 가 목록이다 (v3 $list ← scheduleMonthList).
          한 겹으로 줄이면 `.schedule__page > p` 규칙이 걸려 문단 여백이 달라진다 */}
      <div>
        <div className="schedule__catalog">
          {Object.entries(cats).map(([key, one]) => {
            if (cat !== 'all' && cat !== key) return null;
            const rows = month.items.filter((item) => item.cat === key);
            if (!rows.length) return null;
            return (
              <div key={key} className="schedule__category" style={{ ['--category-color' as string]: one.color }}>
                <p className="schedule__sec">{one.name}</p>
                {rows.map((item, index) => (
                  <p key={index} className="schedule__item">
                    <span className="dot" style={{ background: one.color }} />
                    <b className="schedule__date">{m}/{item.s}{item.e !== item.s ? `–${item.e}` : ''}</b> {item.label}
                    {item.source ? <a className="schedule__source" href={item.source} target="_blank" rel="noreferrer">공식 공지 ↗</a> : null}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      </section>
    </div>
  );
}
