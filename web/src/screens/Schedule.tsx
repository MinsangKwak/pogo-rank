// ─────────────────────────────────────────────────────────────────────────────
// screens/Schedule.tsx — 이벤트 일정 (달력 · 기간 막대 · 이번 달 전체) · 2026-10-16 v6 픽셀 시안 04
//
// v3 components/schedule.js + pages.js renderSchedulePage 이식.
// 처음에는 다가오는 이벤트를 `ul.row-list` 한 줄씩 세웠는데, **화면이 통째로 다른 것**이 됐다 —
// 이 화면의 물음은 "무엇이 있나" 가 아니라 **"언제 무엇이 열리나"** 이고, 그 답은 달력 모양이어야 한다.
//
// 세 벌이 같은 분류 필터(cat)를 본다:
//   달력      주마다 한 줄 — 여러 날 일정은 시작~끝 칸을 막대 하나로 잇고, 보이는 줄은 셋까지. 좁은 화면은 점만 찍는다(CSS)
//   기간 막대  한 줄에 일정 하나, 시작~종료를 분류 색으로 잇는다 (좁은 드로어에는 안 들어가 이 화면 전용)
//   전체 목록  분류별로 묶은 날짜 + 문구
//
// v6 배치: 월 이동 ‹ 2026년 10월 › · '한국 · 지역 시간 기준' · [오늘] · [기간 한눈에 보기] → 분류 칩 → 7열 달력 판
// → 선택일 판("10월 16일 금요일 / 오늘 진행 중 / 항목") → "전체 일정  기간별로 이어서 보기" 목록.
//
// 일정 값(SCHEDULE_MONTHS)은 손으로 적은 실제 공지라 **옮겨 적지 않고** 빌드가 그대로 꺼내 온다
// (scripts/extract-data.mjs). 날짜 한 글자가 틀리면 사람이 이벤트를 놓친다.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useMemo, useState } from 'react';
import { useSchedule } from '../lib/data';
import { track } from '../lib/track';
import KoOnlyNote from '../components/KoOnlyNote';
import { PixelIcon } from '../components/PixelIcon';
import { PxChips, type ChipDef } from '../components/Bits';
import { NwBadge, NwEmpty, NwNote, NwNoteBody, NwSecHead } from '../components/NewsBits';
import { regionMonths, regionToday, useRegion, type Region } from '../lib/region';
import { BAR_COLORS, barColors, calWeeks } from '../lib/calBars';
import type { ScheduleCat, ScheduleItem, ScheduleMonth } from '../types/data';

const SCHED_CAT_KEY = 'pogo_sched_cat';   // v3 와 같은 키
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_LONG = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
// 분류 → 보스 상세가 있는 화면. 레이드 보스 화면은 5성 · 메가, D-MAX 화면은 맥스 배틀. 이벤트 · 아워 · 섀도우는 상세 화면이 없다
const BOSS_HREF: Record<string, string> = { raid5: '/raids', mega: '/raids', dmax: '/dmax' };

/**
 * 오늘 기준으로 보여 줄 달을 고른다.
 *   1) 오늘이 속한 달 → 2) 없으면 오늘보다 앞선 달 중 가장 늦은 달 → 3) 그것도 없으면 등재된 첫 달.
 * 미래 달로는 가지 않는다 — 다음 달 일정은 이번 달 달력이 끝난 뒤에 자연히 나타난다.
 */
function pickMonth(months: Record<string, ScheduleMonth>, today: Date): ScheduleMonth | undefined {
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

/** 'm/s–e' — 하루짜리는 날짜 하나 */
const span = (m: number, item: ScheduleItem) => `${m}/${item.s}${item.e !== item.s ? `–${item.e}` : ''}`;

/**
 * 달력 — 날짜를 누르면 아래 상세가 그날 일정으로 바뀐다.
 * 주마다 한 줄(cal__week)이고, 여러 날 일정은 시작 칸부터 끝 칸까지 막대 하나로 잇는다 (lib/calBars.ts).
 * 막대는 누름을 받지 않는다 — 막대 위를 눌러도 그 아래 날짜 칸이 골라진다
 */
function Cal({ month, cats, items, picked, onPick, today }: {
  month: ScheduleMonth; cats: Record<string, ScheduleCat>; items: ScheduleItem[];
  picked: number; onPick: (day: number) => void; today: Date;
}) {
  const { y, m } = month.ym;
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const todayDay = isThisMonth ? today.getDate() : 0;
  const weeks = useMemo(() => calWeeks(y, m, items, 3, Object.keys(cats)), [y, m, items, cats]);
  // 색은 분류 필터와 상관없이 그달 전체 일정으로 정한다 — 거른 목록으로 정하면 '이벤트' 만 골랐을 때 같은 행사의 색이 바뀌었다 (2026-10-02 점검)
  const colors = useMemo(() => barColors(month.items), [month.items]);
  const count = (day: number) => items.filter((item) => day >= item.s && item.e >= day);

  return (
    <div className="nw-cal px-skin px-drop" role="grid" aria-label={`${y}년 ${m}월 달력`}>
      <div className="nw-cal__heads" role="row">
        {WEEKDAYS.map((name, index) => <span key={name} role="columnheader" className={`nw-cal__head px-caption${index === 0 ? ' is-sun' : index === 6 ? ' is-sat' : ''}`}>{name}</span>)}
      </div>
      {weeks.map((week) => (
        <div key={week.days.find(Boolean)} className="nw-cal__week" role="row">
          {/* 칸(숫자 · 점)은 눌리지 않는 바탕이고, 누름은 맨 뒤의 투명 단추가 받는다. 막대 줄(2~4행)에 걸치는 요소는 막대뿐이다 — 칠 · 테두리가 있는 요소가 그 줄에 걸치면 크롬(clip-path + filter 판 안)이 막대를 그 칸에서 끊어 그렸다 (2026-10-16 실측). 그래서 고른 칸 표시는 숫자 줄(1행)에만 선다 */}
          {week.days.map((day, index) => {
            if (!day) return <span key={`pad-${index}`} className="nw-cal__pad" style={{ gridColumn: index + 1 }} />;
            const keys = [...new Set(count(day).map((item) => item.cat))];
            const klass = `nw-cal__day${day === todayDay ? ' is-today' : ''}${day === picked ? ' is-selected' : ''}`;
            return (
              <span key={day} className={klass} style={{ gridColumn: index + 1 }} aria-hidden="true">
                <span className="nw-cal__num px-mono">{day}</span>
                <span className="nw-cal__dots">
                  {keys.map((key) => <span key={key} className="nw-cal__dot" style={{ background: cats[key]?.color }} />)}
                </span>
              </span>
            );
          })}
          {week.segments.map((seg) => (
            <span key={`${seg.lane}-${seg.col}`} aria-hidden="true" title={seg.item.label}
              className={`nw-cal__bar${seg.head ? ' is-head' : ''}${seg.tail ? ' is-tail' : ''}`}
              style={{ gridColumn: `${seg.col} / span ${seg.span}`, gridRow: seg.lane + 2,
                ['--event-color' as string]: BAR_COLORS[colors.get(seg.item) ?? 0], ['--cat-color' as string]: cats[seg.item.cat]?.color }}>
              {/* 막대 색은 일정마다 다르다 — 분류는 앞의 점(분류 색)이 말한다. 범례의 점과 같은 색이다 */}
              <i className="nw-cal__bar-cat" />
              {/* 앞 주에서 이어진 막대에도 이름을 단다 — 주마다 줄이 바뀌어 앞 줄을 보지 않고도 읽혀야 한다 */}
              {seg.item.label.split(' (')[0]}
            </span>
          ))}
          {week.days.map((day, index) => (day && week.hidden[day] ? (
            <span key={`more-${day}`} aria-hidden="true" className="nw-cal__more px-caption" style={{ gridColumn: index + 1 }}>
              {`+${week.hidden[day]}개 더 보기`}
            </span>
          ) : null))}
          {week.days.map((day, index) => (day ? (
            <button key={`hit-${day}`} type="button" role="gridcell" className="nw-cal__hit" style={{ gridColumn: index + 1 }} aria-selected={day === picked}
              aria-label={`${m}월 ${day}일, 일정 ${count(day).length}개`} onClick={() => onPick(day)} />
          ) : null))}
        </div>
      ))}
    </div>
  );
}

/**
 * 기간 막대 — 한 줄이 일정 하나. 막대 위치는 (s-1)/일수, 폭은 (e-s+1)/일수 의 백분율이라
 * 화면 폭이 달라도 그대로 맞는다. 시작이 달 후반(60% 이후)이면 라벨을 막대 끝에 오른쪽 정렬해 잘리지 않게 한다.
 */
function Timeline({ month, cats, items, today }: {
  month: ScheduleMonth; cats: Record<string, ScheduleCat>; items: ScheduleItem[]; today: Date;
}) {
  const { y, m } = month.ym;
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
    <div className="nw-tl">
      <div className="nw-tl__ruler">
        {days.map(({ day, mark }) => (
          <span key={day} className={`nw-tl__tick${mark}`} style={{ left: pct(day), width: width(day, day) }}>
            {day === 1 || day % 5 === 0 ? <i className="px-mono">{day}</i> : null}
          </span>
        ))}
      </div>
      <div className="nw-tl__body">
        {/* 주말 음영·오늘 선을 행 전체 높이로 깔기 위해 눈금과 같은 좌표의 배경 칸을 한 번 더 둔다 */}
        <div className="nw-tl__grid">
          {days.map(({ day, mark }) => (
            <span key={day} className={`nw-tl__col${mark}`} style={{ left: pct(day), width: width(day, day) }} />
          ))}
        </div>
        {rows.map((item, index) => {
          return (
            <div key={index} className="nw-tl__row" title={`${span(m, item)} ${item.label}`}>
              <span className="nw-tl__bar" style={{ left: pct(item.s), width: width(item.s, item.e), background: cats[item.cat]?.color }} />
              {/* 괄호 안 설명은 막대와 아래 목록이 이미 말해 준다 — 여기서는 떼고 title 로만 남긴다 */}
              <span className="nw-tl__label px-caption">{`${span(m, item)} · ${item.label.split(' (')[0]}`}</span>
            </div>
          );
        })}
        {rows.length ? null : <p className="px-body px-muted">선택한 분류에 등록된 일정이 없어요.</p>}
      </div>
    </div>
  );
}

/** 일정 한 줄 — 분류 배지 · 이름 · 기간 · 보스 상세 확인 · 공식 안내 ↗ */
function Item({ item, cat, m, withSpan = true }: { item: ScheduleItem; cat: ScheduleCat | undefined; m: number; withSpan?: boolean }) {
  const boss = BOSS_HREF[item.cat];
  return (
    <li className="nw-ev">
      <span className="nw-ev__cat">
        <NwBadge text={cat?.name ?? item.cat} color={cat?.color}><i className="nw-cal__dot" style={{ background: cat?.color }} aria-hidden="true" /></NwBadge>
      </span>
      <span className="nw-ev__body">
        <b className="px-body nw-ev__name">{item.label}</b>
        <span className="nw-ev__meta px-caption">
          {withSpan ? <span className="px-mono">{span(m, item)}</span> : null}
          {boss ? <a className="nw-ev__link" href={boss}>보스 상세 확인</a> : null}
          {item.source ? <a className="nw-ev__link" href={item.source} target="_blank" rel="noreferrer">공식 안내 ↗</a> : null}
        </span>
      </span>
    </li>
  );
}

// 지역을 바꾸면 달 · 고른 날을 처음부터 다시 고른다 — key 로 화면을 새로 세운다
export default function Schedule() {
  const region = useRegion();
  return <ScheduleBody key={region} region={region} />;
}

function ScheduleBody({ region }: { region: Region }) {
  const { data } = useSchedule();
  const months = regionMonths(data, region);
  const monthKeys = Object.keys(months).sort();
  // 오늘은 고른 지역의 날짜다 — 브라우저 시계가 어느 나라에 있든 달력이 같은 날을 가리킨다
  const [today] = useState(() => regionToday(region));
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const initial = pickMonth(months, today);
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
  const [day, setDay] = useState(() => {
    if (!month) return 1;
    const thisMonth = today.getFullYear() === month.ym.y && today.getMonth() + 1 === month.ym.m;
    return thisMonth ? today.getDate() : 1;
  });

  const items = useMemo(
    () => (month ? (cat === 'all' ? month.items : month.items.filter((item) => item.cat === cat)) : []),
    [month, cat],
  );
  if (!month) return <div className="page__body nw-sched" id="page-schedule" data-route="schedule"><NwEmpty>아직 일정 정보를 불러오지 못했어요.</NwEmpty></div>;

  const { y, m } = month.ym;
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const isToday = isThisMonth && day === today.getDate();
  const changeMonth = (index: number) => {
    const key = monthKeys[index];
    if (!key) return;
    const next = months[key]!;
    setSelectedMonth(key);
    setDay(today.getFullYear() === next.ym.y && today.getMonth() + 1 === next.ym.m ? today.getDate() : 1);
  };
  // [오늘] — 오늘이 든 달이 등재돼 있을 때만 산다. 없으면 단추를 흐리게 둔다(없는 달로 보내지 않는다)
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayIndex = monthKeys.indexOf(todayKey);
  const goToday = () => { if (todayIndex >= 0) { changeMonth(todayIndex); setDay(today.getDate()); } };
  const pickCat = (id: string) => {
    setCat(id);
    try { localStorage.setItem(SCHED_CAT_KEY, id); } catch { /* 저장 불가 환경 */ }
    track('sched_cat', { cat: id });
  };
  const onDay = items.filter((item) => day >= item.s && item.e >= day);
  // 분류 칩 — '전체' 뒤에 분류 순서대로. 타입색 점은 칩 묶음이 type 으로 그린다
  const chipItems: ChipDef[] = [{ id: 'all', label: '전체' }, ...Object.entries(cats).map(([id, one]) => ({ id, label: one.name, type: one.type }))];
  const weekday = WEEKDAY_LONG[new Date(y, m - 1, day).getDay()];

  return (
    <div className="page__body nw-sched" id="page-schedule" data-route="schedule">
      <KoOnlyNote kind={region === 'eu' ? 'cet' : 'kst'} />
      {/* 어느 지역 달력인지 늘 밝힌다 — 같은 행사가 지역에 따라 하루 다르게 설 수 있다.
          지역별 일정은 시험 기능이라 **한국 · 유럽 모두** 실제와 다를 수 있음을 먼저 알린다 (2026-10-01 주인 결정) */}
      <NwNote title="지역별 일정은 시험 중인 기능이에요." className="nw-region">
        <NwNoteBody>
          {region === 'eu'
            ? '유럽 기준 일정이에요. 중부 유럽 시간(서머타임 반영)으로 날짜를 맞추고, 유럽 도시 행사와 전 세계 이벤트만 실어요.'
            : '한국 기준 일정이에요. 한국 시간으로 날짜를 맞춰요.'}
          {' '}자동으로 모은 일정이 섞여 있어 실제 날짜 · 시간과 다를 수 있으니, 게임 안 공지로 한 번 더 확인해 주세요.
          {' '}오른쪽 위 지역 단추로 바꿀 수 있어요.
        </NwNoteBody>
      </NwNote>

      <nav className="schedule__month-nav nw-monthnav" aria-label="달력 월 이동">
        <div className="nw-monthnav__move">
          <button type="button" className="px-btn px-skin px-btn--icon" aria-label="이전 달" disabled={monthIndex <= 0} onClick={() => changeMonth(monthIndex - 1)}>‹</button>
          <div className="nw-monthnav__title" aria-live="polite">
            <h2 className="px-heading">{`${y}년 ${m}월`}</h2>
            <span className="px-caption">{region === 'eu' ? '유럽 · 중부 유럽 시간 기준' : '한국 · 지역 시간 기준'}</span>
          </div>
          <button type="button" className="px-btn px-skin px-btn--icon" aria-label="다음 달" disabled={monthIndex >= monthKeys.length - 1} onClick={() => changeMonth(monthIndex + 1)}>›</button>
        </div>
        <div className="nw-monthnav__tools" aria-label="일정 보기 방식">
          <button type="button" className="px-btn px-skin px-btn--sm" disabled={todayIndex < 0} onClick={goToday}>오늘</button>
          <button type="button" className="px-btn px-skin px-btn--sm" aria-pressed={view === 'timeline'}
            onClick={() => setView((now) => (now === 'timeline' ? 'list' : 'timeline'))}>
            <PixelIcon name="chart" /><span>기간 한눈에 보기</span>
          </button>
        </div>
      </nav>

      <PxChips label="일정 분류" items={chipItems} value={cat} onPick={pickCat} />
      {/* 달력과 ⚔️ 레이드 보스는 **다른 것**을 말한다 — 밝히지 않으면 두 화면이 서로 다른 보스를 가리켜 보인다 */}
      <p className="px-caption nw-bridge">
        <span>날짜를 선택하면 그날의 이벤트를 확인할 수 있어요.</span>{' '}
        <a href="/raids">현재 레이드 보스 보기</a>
      </p>

      {view === 'timeline' ? (
        <section className="px-skin px-drop px-panel nw-tlwrap" aria-label="기간 한눈에 보기">
          <div className="nw-tl__scroll"><Timeline month={month} cats={cats} items={items} today={today} /></div>
        </section>
      ) : null}

      <Cal month={month} cats={cats} items={items} picked={day} onPick={setDay} today={today} />
      {/* 점과 이름은 감싸지 않고 나란히 둔다 — 감싸면 한 덩이가 돼 줄바꿈 자리가 달라진다 */}
      <p className="px-caption nw-legend">
        {Object.values(cats).map((one) => (
          <Fragment key={one.name}>
            <i className="nw-cal__dot" style={{ background: one.color }} aria-hidden="true" />{one.name}{'  '}
          </Fragment>
        ))}
      </p>

      <section className="px-skin px-drop px-panel nw-day" aria-live="polite">
        <NwSecHead as="h3" title={`${m}월 ${day}일 ${weekday}`} right={`${onDay.length}건`} />
        {isToday ? <div className="nw-badges nw-day__today"><NwBadge text="오늘 진행 중" tone="mint" /></div> : null}
        {onDay.length
          ? <ul className="nw-evs">{onDay.map((item, index) => <Item key={index} item={item} cat={cats[item.cat]} m={m} />)}</ul>
          : <p className="px-body px-muted">등록된 일정이 없어요.</p>}
      </section>
      <p className="px-caption nw-monthnote">{month.note} 날짜를 선택하면 해당일의 일정을 확인할 수 있어요.</p>

      <section aria-label={`${m}월 전체 일정`} className="nw-all">
        <NwSecHead className="nw-sechead" title="전체 일정" note="기간별로 이어서 보기" />
        <div className="nw-catalog">
          {Object.entries(cats).map(([key, one]) => {
            if (cat !== 'all' && cat !== key) return null;
            const rows = month.items.filter((item) => item.cat === key);
            if (!rows.length) return null;
            return (
              <section key={key} className="px-skin px-drop px-panel nw-catsec" style={{ ['--category-color' as string]: one.color }}>
                <NwSecHead as="h3" size="sub" title={one.name} right={`${rows.length}건`}
                  lead={<i className="nw-cal__dot" style={{ background: one.color }} aria-hidden="true" />} />
                <ul className="nw-evs">{rows.map((item, index) => <Item key={index} item={item} cat={one} m={m} />)}</ul>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
