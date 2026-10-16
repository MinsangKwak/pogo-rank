// ─────────────────────────────────────────────────────────────────────────────
// screens/MonDetail.tsx — 포켓몬 상세 (v6 피그마 22 독립 페이지 · D01 자세한 팝업 · D02 배틀 정보 · D03 CP 계산기 · D04 요약 팝업)
//
// 팝업은 한 번에 한 포켓몬을 보여 주지만, 진화 계열·추천 후보를 누르면 **같은 창에서** 그 포켓몬으로 바뀐다.
// 떠난 화면은 쌓아 두고, ← 로 돌아오면 보던 탭 · 계산기 입력값 · 포획 CP 경로가 그대로다.
//
// v3 의 이 팝업은 "다시 그리지 않는다" 를 손으로 지키고 있었다 — 탭·스크롤·계산기 입력값이 날아가서다
// (v3.60.0 의 ★ 도, 📣 배지도 제자리에서 글자만 갈아 끼웠다). React 에서는 그 규칙이 공짜다.
//
// 구성 — 팝업 판은 parts.css 의 px-dialog 한 벌(머리 · 본문만 스크롤 · 바닥 고정)이고, 여기는 그 안의 자리만 둔다 (modal.css):
//   px-dialog > px-dialog__panel.pxd > __head(그림 · #번호 이름 · 타입 · ☆ · ✕) > __body(.pxd__cols = 프로필 판 + 탭 · 판들 | 계산기) > __foot(동작)
//   페이지(/mon/<번호>)는 dialog 가 아니라 본문이다 — 화면 머리는 셸이 그리고, 맨 위 줄(← 도감으로 · 링크 복사 · CP 계산기) 뒤에 같은 판들이 선다
//   요약(brief)은 프로필 판 · 탭 없이 진화 계열 · 폼별 정보만, 바닥은 '도감에서 자세히' 입구다 (CLAUDE.md §3-1)
// ─────────────────────────────────────────────────────────────────────────────
import { monDocTitle } from '../lib/docTitle';
import { useRankStore } from '../stores/rank';
import { go } from '../lib/nav';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDex, useFavEvents, useGameday, useMax, usePve, usePvp } from '../lib/data';
import { Sprite } from '../components/Bits';
import { PxIcon } from '../components/PxIcon';
import { PixelIcon } from '../components/PixelIcon';
import { cpOf } from '../lib/cp';
import { count, num } from '../lib/cell';
import { matchups } from '../lib/matchup';
import { bossCounters, bossKindOf } from '../lib/bossCounters';
import { favNewsFor, favNewsWhen, FAV_NEWS_LABEL } from '../lib/favnews';
import { useFavs } from '../lib/useFavs';
import { buildSearchIndex } from '../lib/search';
import { resolveMon, type MonPick, type MonRef, dexNoOf } from '../lib/mon';
import { track } from '../lib/track';
import ShareBtn from '../components/detail/ShareBtn';
import DetailTabs from '../components/detail/DetailTabs';
import Hex from '../components/detail/Hex';
import IvRank from '../components/detail/IvRank';
import CalcScreen, { CALC_DEFAULT, type CalcInputs } from '../components/detail/CalcScreen';
import { Evo, MegaCompare } from '../components/detail/Evo';
import CatchCard from '../components/detail/CatchCard';
import UsageRanks from '../components/detail/UsageRanks';
import FormGuide, { DeepDock, FormStats, TrainCard } from '../components/detail/FormGuide';
import Recs from '../components/detail/Recs';
import VsCard from '../components/detail/VsCard';
import { speciesOf } from '../lib/formGuide';
import { PxDialog, PxDialogBody, PxDialogFoot, PxDialogHead } from '../components/PxDialog';
import { Foot, Metric, Sec } from '../components/detail/Pieces';

export type { MonRef } from '../lib/mon';

/** 팝업 한 화면의 상태 — 떠날 때 통째로 쌓았다가 ← 로 돌아올 때 그대로 되돌린다 (v3 detailState) */
interface View { mon: MonRef; tab: Tab; screen: 'detail' | 'calc'; calc: CalcInputs; catchSeg: string; deep: boolean }

// 탭은 둘 — 진화 계열이 요약 맨 위로 올라왔다. 진화 탭만 따로 두면 '이 종이 무엇이 되는가' 를 보려고 탭을 한 번 더 넘겼다 (2026-09-30 주인 요청)
type Tab = 'summary' | 'battle';
const TABS: [Tab, string][] = [['summary', '진화 · 요약'], ['battle', '배틀 정보']];

const FORM_KIND: Record<string, string> = {
  메가: 'mega', 메가X: 'mega', 메가Y: 'mega', 원시: 'mega',
  다이맥스: 'max', 거다이맥스: 'max', '맥스 참가': 'max', 섀도우: 'shadow',
};

/** 이름 앞의 폼 라벨을 뗀다 (v3 splitFormName) */
function splitName(name: string, labels: readonly string[]) {
  const found: string[] = [];
  let base = name;
  for (let again = true; again;) {
    again = false;
    for (const label of labels) {
      if (base.startsWith(`${label} `)) { found.push(label); base = base.slice(label.length + 1); again = true; break; }
    }
  }
  return { labels: found, base };
}

/** 상성 칩 — 타입 색 점 + 이름 + 배율. 이중(×2.56 · ×0.39)은 채운 배지 */
function TypeChip({ type, extra, double }: { type: string; extra?: string; double?: boolean }) {
  const { data } = useDex();
  return (
    <span className={`px-badge px-skin px-badge--ko pxd-type${double ? ' px-badge--fill' : ''}`}>
      <i className="pxd-type__dot" aria-hidden="true" style={{ color: `var(--t-${type})` }} />
      {data.TYPE_KO[type] ?? type}{extra ? <small className="px-mono">{extra}</small> : null}
    </span>
  );
}

export interface MonDetailProps {
  pick: MonPick;
  /** 팝업으로 열렸을 때만 있다 — 페이지로 열리면 닫을 것이 없다 */
  onClose?: () => void;
  /**
   * **페이지로 그린다** (v5 Phase 6). `/mon/<id>` 로 바로 들어온 경우다.
   *
   * 전에는 이 자리도 팝업이었다. 그러면 크롤러가 받는 HTML 의 본문은 홈이고 상세는 닫힌
   * `<dialog>` 안인데, 닫힌 dialog 는 `display: none` 이라 내용이 없는 것과 같다.
   * 사람에게도 팝업은 틀린 모양이었다 — 공유 링크로 들어오면 뒤로 갈 곳이 없는데 ✕ 만 있었다.
   * v6 에서는 dialog 가 아니라 본문 판이다 — 화면 머리(이름표 · 제목)는 셸이 그린다
   */
  inline?: boolean;
  /** 요약 팝업의 '도감에서 자세히' — 도감 화면으로 옮겨 자세한 팝업을 연다 (App.tsx openDeep) */
  onDeep?: (pick: MonPick) => void;
  /**
   * 팝업 뒤에 깔린 화면(route id). 그 화면으로 옮겨 가는 단추는 화면을 옮기지 않고 이 팝업을 배틀 정보로 바꾼다 —
   * D-MAX 화면의 'D-MAX 더보기' 가 방금 누른 그 줄로 되돌아와 2.4초 밝히고 끝이라 '그 다음이 없다' 로 읽혔다 (2026-10-02 주인 결정).
   * 바닥의 'D-MAX 순위' · 'PvP 순위' 도 같은 자리라 같게 하고, 도감 화면에서는 '포켓몬 도감' 단추를 두지 않는다 (2026-10-02 점검)
   */
  here?: string;
}

export default function MonDetail({ pick, onClose, inline = false, onDeep, here = '' }: MonDetailProps) {
  // 요약 팝업 — 전체 검색 · 홈에서 열었다. 진화 · 폼별 정보만 두고, 나머지(육성 추천 · 배틀 정보 · CP · 기술)는 아래 '도감에서 자세히' 로 넘긴다.
  // 페이지(공유 링크 본문)는 늘 자세히다 — 옮겨 갈 곳이 아니라 그 자체가 도착한 곳이다
  // 요약으로 열었어도 D-MAX 화면의 'D-MAX 더보기' 로 자세히 들어가면(deep) 자세한 판이 된다
  const [deep, setDeep] = useState(false);
  const brief = pick.view === 'brief' && !inline && !deep;
  const { data } = useDex();
  const { data: pve } = usePve();
  const { data: max } = useMax();
  // '보스로 만났을 때' 추천 풀 — D-MAX 화면의 [맥스 참가 가능 다른 유닛] 체크를 따른다 (2026-10-06)
  const showJoin = useRankStore((s) => s.maxShowJoin);
  const { data: pvpData } = usePvp();
  const { data: gameday } = useGameday();
  const { data: favEvents } = useFavEvents();
  const { favs, toggle: toggleFav } = useFavs();
  const overlay = useRef<HTMLDialogElement>(null);
  // 본문 스크롤 상자 — 계산기로 바꾸거나 다른 포켓몬으로 옮기면 맨 위로 (같은 상자를 다시 쓰므로 스크롤이 남는다)
  const body = useRef<HTMLDivElement>(null);

  // 지금 보는 것 + 떠나온 것들.
  // **떠날 때 화면 전체를 통째로 쌓는다** — ← 로 돌아오면 보던 탭·계산기 입력값·포획 CP 경로가 그대로여야 한다.
  // 포켓몬만 쌓았더니 배틀 정보 탭에서 추천 후보를 눌렀다 돌아왔을 때 요약 탭이 열렸다 (v3 는 배틀 정보로 돌아온다)
  // **이름은 연 쪽이 들고 있던 것을 쓴다.** 순위표 줄은 '거다이맥스 고릴타' 를 이미 알고 있다.
  // 이름이 없는 길은 공유 링크 하나뿐이고, 그때만 검색 색인에서 찾는다 (v3 openDetailBySprite).
  // 도감 이름표만 보던 시절에는 폼 스프라이트(10000번대)가 표에 없어 '#10209' 라고 적혔고,
  // 그 한 값이 활용 순위(이름으로 찾는다)와 '보스로 만났을 때'(이름 앞 '거다이맥스' 로 가른다)를 같이 무너뜨렸다
  const searchIndex = useMemo(() => buildSearchIndex(data, max, pve, pvpData), [data, max, pve, pvpData]);
  const start = useMemo<MonRef>(() => resolveMon(pick, searchIndex, data.DEX_DATA), [pick, searchIndex, data]);
  const [stack, setStack] = useState<View[]>([]);
  const [mon, setMon] = useState<MonRef>(start);
  const [tab, setTab] = useState<Tab>('summary');
  const [screen, setScreen] = useState<'detail' | 'calc'>('detail');
  const [calc, setCalc] = useState<CalcInputs>(CALC_DEFAULT);
  const [catchSeg, setCatchSeg] = useState('max');

  // <dialog> 로 열어야 Esc·배경 잠금이 브라우저 몫이 된다 (v3 modal.js 와 같다).
  // **페이지로 그릴 때는 dialog 자체가 없다** — showModal() 은 배경을 잠그고 위에 덮는다
  useEffect(() => {
    if (inline) return;
    const node = overlay.current;
    if (!node?.open) node?.showModal();
  }, [inline]);
  // 화면이 바뀌면(다른 포켓몬 · 계산기) 본문을 맨 위로
  useEffect(() => { body.current?.scrollTo?.(0, 0); }, [mon.sprite, screen]);

  const switchTo = (next: MonRef) => {
    setStack((now) => [...now, { mon, tab, screen, calc, catchSeg, deep }]);
    setMon(next);
    setTab('summary');
    setScreen('detail');
  };
  // 뒤에 깔린 화면으로 가는 단추 — 그 폼의 배틀 정보(D-MAX 티어 · 딜러 · 탱커, PvP 리그 순위)로. ← 로 요약에 돌아온다
  const showHere = (next: MonRef) => {
    setStack((now) => [...now, { mon, tab, screen, calc, catchSeg, deep }]);
    setMon(next);
    setTab('battle');
    setScreen('detail');
    setDeep(true);
    track('detail_more', { to: 'battle', mon: next.name });
  };
  const back = () => {
    const previous = stack.at(-1);
    if (!previous) return;
    setStack((now) => now.slice(0, -1));
    setMon(previous.mon);
    setTab(previous.tab);
    setScreen(previous.screen);
    setCalc(previous.calc);
    setCatchSeg(previous.catchSeg);
    setDeep(previous.deep);
  };

  const sprite = mon.sprite;
  const dexNo = dexNoOf(sprite, data.DEX_DATA.dex);
  // 폼 데이터는 스프라이트 id 로 먼저 찾고(메가·리전 폼), 없으면 원종 도감번호로 되돌아간다
  const form = data.DEX_DATA.forms[String(sprite)] ?? (dexNo != null ? data.DEX_DATA.forms[String(dexNo)] : undefined);
  const types = mon.types.length ? mon.types : (form?.types ?? []);
  const cpm = data.DEX_DATA.cpm;
  const { labels: formLabels, base: baseName } = splitName(mon.name, data.FORM_LABELS);
  const formKind = formLabels.map((label) => FORM_KIND[label]).find(Boolean) ?? '';
  // 일반 줄의 이름표 — 맥스 · 메가는 제 줄이 따로 있으니 빼고 남은 라벨(섀도우 · 리전 폼)만
  const otherLabels = formLabels.filter((label) => !/^(다이맥스|거다이맥스|맥스 참가|메가X?|메가Y|원시)$/.test(label));
  // 종 이름 — '거다이맥스 인텔리레온' → '인텔리레온', '메가X 리자몽' → '리자몽', '섀도우 리자몽' 은 그대로
  const stemOfName = speciesOf(mon.name);

  const isFav = dexNo != null && favs.includes(dexNo);
  const news = dexNo != null ? favNewsFor(favEvents.FAV_EVENTS, dexNo) : [];
  // '#006' — 도감 번호는 세 자리로 채운다 (카드 · 시안과 같은 표기)
  const dexTag = dexNo != null ? `#${String(dexNo).padStart(3, '0')}` : '';
  const typeLine = types.map((type) => data.TYPE_KO[type] ?? type).join(' · ');
  const maxCp = form && cpm['l50'] ? cpOf(form, cpm['l50']!) : null;

  // ── 보스로 만났을 때 — 보스 종류에 따라 참전 가능한 풀이 다르다 (v2.13.0 QA-49). 셈은 lib/bossCounters.ts 한 곳이다 —
  //    맨 위 '상대할 때' 카드(VsCard) · 홈 '이번 주 보스' 와 같은 후보가 서야 한다 (2026-10-13)
  const counter = useMemo(() => bossCounters(bossKindOf(mon.name), types, {
    chart: data.DEX_DATA.chart, typeKo: data.TYPE_KO, dexTable: data.DEX_DATA.dex,
    dmax: max.DMAX_DATA, pve: pve.PVE_DATA, sheet: pvpData.SHEET_DATA.pve, showJoin,
  }, 5), [mon.name, types, data, max, pve, pvpData, showJoin]);

  const match = types.length ? matchups(data.DEX_DATA.chart, data.TYPE_KO, types) : { weak: [], resist: [] };
  const chipList = (rows: { type: string; mult: number }[]) => rows.length ? (
    <div className="px-chips pxd-chips">
      {rows.map((row) => {
        const double = row.mult >= 2.5 || row.mult <= 0.4;
        return <TypeChip key={row.type} type={row.type} double={double} extra={`×${num(+row.mult.toFixed(2))}`} />;
      })}
    </div>
  ) : <p className="px-caption">없음</p>;

  const changes = gameday.MOVE_CHANGES;
  const changed = changes?.affected?.[String(sprite)] ?? null;

  const previous = stack.at(-1);

  // 상세 본문(/mon/<번호>)의 탭 제목 — 화면 이동이 서버를 거치지 않아(components/RouterBridge.tsx) 여기서 고친다. 팝업은 제목을 안 바꾼다
  useEffect(() => {
    if (inline && mon.name !== `#${sprite}`) document.title = monDocTitle(mon.name);
  }, [inline, mon.name, sprite]);

  // 모르는 스프라이트 번호면 아무것도 열지 않는다 — v3 openDetailBySprite 도 조용히 돌아간다.
  // (틀린 공유 링크에 빈 팝업이 뜨면 '데이터가 없는 종' 처럼 읽힌다)
  if (mon.name === `#${sprite}`) return null;

  // ── ☆ — 입구는 **여기 하나뿐**이다 (v3.60.0 의 규칙) — 목록 카드에는 달지 않는다.
  //    담아 두면 그 포켓몬의 커뮤니티 데이·스포트라이트·레이드 일정을 챙겨 준다
  const favBtn = dexNo != null ? (
    <button type="button" className={`px-btn px-btn--icon px-skin detail__fav${isFav ? ' is-on' : ''}`} data-dex={dexNo}
      aria-pressed={isFav} aria-label="즐겨찾기"
      title={isFav ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가 — 관련 일정을 확인할 수 있어요'}
      onClick={(event) => {
        event.stopPropagation();
        // 지표는 useFavs 안에서 한 번만 찍는다 — 여기서 또 찍으면 한 번 누른 것이 두 건이 된다
        toggleFav(dexNo, '포켓몬 상세');
      }}>
      {/* 별은 글자가 아니라 SVG — 글자 ★ 는 운영체제마다 다른 글꼴로 그려져 Windows 에서 글자보다 위에 떴다 (2026-09-30 주인 제보) */}
      <svg className="detail__fav-star" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M12 2.6 14.9 8.5l6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"
          fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <span className="detail__fav-label btn-label">{isFav ? '담음' : '즐겨찾기'}</span>
    </button>
  ) : null;

  // 📣 소식 — **담아 둔 포켓몬에만** 선다 (v3 favNewsNode 가 isFav 를 먼저 묻는다). ★ 를 누를 이유가 여기서 생긴다.
  //    가장 가까운 한 건만 쓰고 나머지는 개수로 접는다
  const favNews = isFav && news.length ? (
    <button type="button" className="px-btn px-btn--sm px-skin pxd-favnews"
      title={news.map((row) => `${FAV_NEWS_LABEL[row.event.type] ?? '일정'} ${favNewsWhen(row)} — ${row.event.title}`).join('\n')}
      onClick={(event) => {
        event.stopPropagation();
        track('fav_news_open', { mon: String(dexNo), count: news.length });
        onClose?.();
        go('/schedule');
      }}>
      <PixelIcon name="calendar" />
      <b >{FAV_NEWS_LABEL[news[0]!.event.type] ?? '일정'}</b>
      <span >{favNewsWhen(news[0]!)}</span>
      {news.length > 1 ? <span className="px-caption">외 {num(news.length - 1)}</span> : null}
    </button>
  ) : null;

  // ── 프로필 판 — 큰 몬스터볼 그림 · 영문명 배지 · 폼 라벨 · MAX CP · 종족값 (요약 팝업에는 없다)
  const statTiles = form ? ([['공격', form.atk], ['방어', form.def], ['체력', form.hp]] as const).map(([label, value]) => (
    <Metric key={label} className="pxd-stat" sunk label={label} value={num(value)} />
  )) : null;
  const profile = (
    <aside className={`pxd-profile px-skin${inline ? ' px-drop' : ' px-skin--sunk'}`} aria-label="프로필">
      <div className={`px-ball px-ball--lg pxd-profile__art`} data-form-kind={formKind || undefined}><Sprite id={sprite} /></div>
      <div className="pxd-profile__text">
        {/* 이 줄은 늘 **반대 언어의 이름**이다 — 한국어 화면엔 Charizard, 영어 화면엔 리자몽. 엔진이 data-alt-ko/en 을 보고 갈아 끼운다 (lib/i18n.ts) */}
        {mon.en ? <span className="px-badge px-skin pxd-profile__en" data-i18n="alt" data-alt-ko={mon.en} data-alt-en={baseName}>{mon.en}</span> : null}
        {formLabels.length ? <p className="px-caption">{formLabels.join(' · ')} 폼</p> : null}
        {inline ? <p className="px-body px-muted">{typeLine}</p> : null}
        {maxCp != null ? (
          <div className="pxd-profile__cp">
            <p className="px-eyebrow">MAX CP · LV.50</p>
            <p className="px-number pxd-profile__cp-value">{count(maxCp)}</p>
          </div>
        ) : <p className="px-caption">이 폼은 능력치 데이터가 없어요.</p>}
        {inline ? null : form ? <p className="px-body px-muted pxd-profile__stats">{`공격 ${num(form.atk)} · 방어 ${num(form.def)} · 체력 ${num(form.hp)}`}</p> : null}
        {favNews}
      </div>
      {inline && statTiles ? <div className="px-grid px-grid--3 pxd-profile__tiles">{statTiles}</div> : null}
    </aside>
  );

  // ── 요약 탭 (D01) — 상대할 때 · 진화 계열 · 육성 추천 · 폼별 정보 · 포획 CP · 기술 · (기술 변경) · 육각형
  const summaryPane = (
    <div className="pxd-pane" role="tabpanel" data-pane="summary" id="detail-pane-summary" aria-labelledby="detail-tab-summary" hidden={tab !== 'summary'}>
      {/* 맨 위는 '상대할 때' — 이 계열이 지금(또는 7일 안에) 맥스 · 레이드 보스로 서면 기간 · 추천 세 마리 · 셈 단추.
          보스가 아니면 카드가 없다. 요약 팝업에도 선다 — 홈 · 검색에서 보스를 연 사람의 첫 물음이라서 (2026-10-13 통계 개편) */}
      <VsCard mon={mon} dexNo={dexNo} kind={mon.name === start.name && mon.sprite === start.sprite ? pick.boss : undefined} onSwitch={switchTo} onLeave={onClose} />
      {/* 진화 계열 — 이 종이 무엇이 되는지 · 계열에서 무엇을 키울지 · 지금 잡을 수 있는지 */}
      <Sec title="진화 계열" >
        {dexNo != null
          ? <Evo dex={dexNo} sprite={sprite} onSwitch={switchTo} />
          : <p className="px-body px-muted">진화가 없는 포켓몬이에요.</p>}
      </Sec>
      {/* 육성 추천은 자세히 보기에서만 — 도감 · 순위 화면에서 찾아 연 팝업의 답이다. 전체 검색의 요약 팝업에는 세우지 않는다 (2026-09-30 주인 결정) */}
      {brief ? null : <TrainCard mon={mon} dexNo={dexNo} stem={stemOfName} onLeave={onClose} />}
      {/* 폼별 정보 — 요약 한 줄씩. 일반은 펼치고, 맥스 폼은 D-MAX 화면의 그 줄로. 메가 · 섀도우를 보고 있으면 일반 줄의 이름표가 그 라벨이다 */}
      <FormGuide mon={mon} dexNo={dexNo} baseLabel={otherLabels.join(' ') || '일반'} onSwitch={switchTo} onLeave={onClose}
        {...(here === 'dmax' ? { onMaxHere: showHere } : {})} />
      {/* 여기부터는 자세히 보기에서만 — 펼쳐 둔다 (도감 · 순위 화면에서 연 팝업은 다 보려고 연 것이다).
          만렙 CP 는 프로필 판으로 올라갔고, 레벨별 2×2 표는 포획 CP 확인이 같은 값(Lv.20 · 25 · 30 · 35)을 경로별로 보여 준다 */}
      {!brief && form && cpm['l50'] ? <CatchCard form={form} sprite={sprite} seg={catchSeg} onSeg={setCatchSeg} /> : null}

      {!brief && form ? (
        <Sec title="배울 수 있는 기술" >
          <dl className="pxd-moves">
            {([['노말 기술', form.fast], ['스페셜 기술', form.charged]] as const).map(([label, moves]) => (
              <div key={label} className="pxd-moves__row">
                <dt className="px-caption">{label}</dt>
                <dd className="px-body">
                  {moves.map(([name, legacy], index) => (
                    <span key={name} className={`pxd-move${legacy ? ' is-legacy' : ''}`}>{index ? ' · ' : ''}{name}{legacy ? ' ★' : ''}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          {form.fast.some((move) => move[1]) || form.charged.some((move) => move[1])
            ? <Foot>★ 레거시 기술 — 대단한 기술머신 또는 특정 이벤트를 통해 습득</Foot>
            : null}
        </Sec>
      ) : null}

      {/* 적용 전후 모두 적는다 — 적용 뒤에도 "왜 순위가 움직였나" 의 답이 된다 */}
      {!brief && changed && changes ? (
        <Sec title={`${changes.date} 기술 변경 적용됨`}>
          <ul className="pxd-changes">
            {([['▲', changed.up, 'is-up'], ['▼', changed.down, 'is-down'],
               ['·', changed.energy, ''], ['＋', changed.new, 'is-up']] as const).map(([mark, names, klass]) =>
              names?.length ? (
                <li key={mark} className={`pxd-changes__row ${klass}`}>
                  <span className="px-mono">{mark}</span>
                  <div>
                    <b>{names.join(' · ')}</b>
                    {names.some((name: string) => changed.legacy?.includes(name))
                      ? <p className="px-caption">※ 일부는 지금 배울 수 없는 레거시 기술이에요</p>
                      : null}
                  </div>
                </li>
              ) : null)}
          </ul>
          <Foot>위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → 기술 변경 내역</Foot>
        </Sec>
      ) : null}

      {brief ? null : form ? (
        <Sec title="능력치 육각형" >
          <Hex form={form} name={mon.name} types={types} />
          <p className="px-caption">비교를 돕는 정규화 시각화 · 원 능력치는 위 숫자로 확인</p>
        </Sec>
      ) : <p className="px-body px-muted">이 폼은 능력치 데이터가 없어요.</p>}
    </div>
  );

  // ── 배틀 정보 탭 (D02) — 지표 판 · 타입 상성 · 모든 폼 활용 순위 · PvP 추천 개체값 · 메가 비교 · 보스로 만났을 때
  const battlePane = (
    <div className="pxd-pane" role="tabpanel" data-pane="battle" id="detail-pane-battle" aria-labelledby="detail-tab-battle" hidden={tab !== 'battle'}>
      {/* 맨 위는 지금 보는 폼의 성적 — D-MAX 에서 열었으면 맥스 표, PvP · 레이드에서 열었으면 그쪽 순위 */}
      <FormStats mon={mon} dexNo={dexNo} baseLabel={otherLabels.join(' ') || '일반'} onLeave={onClose} here={here} />
      {types.length ? (
        <Sec title="타입 상성">
          {/* 약점·내성을 각각 한 묶음으로 — 칩만 두 줄로 늘어놓으면 경계가 섞인다 (v2.42.0) */}
          <div className="pxd-match">
            <div className="pxd-match__col">
              <h4 className="px-caption">약점 (더 큰 데미지)</h4>{chipList(match.weak)}
            </div>
            <div className="pxd-match__col">
              <h4 className="px-caption">내성 (덜 받는 데미지)</h4>{chipList(match.resist)}
            </div>
          </div>
          {/* 이중이 있을 때만 글자가 찬다 (v3 hasDouble) — 없는 데 설명이 붙으면 찾게 된다 */}
          {match.weak.some((row) => row.mult >= 2.5) || match.resist.some((row) => row.mult <= 0.4)
            ? <Foot>채운 칩 = 두 타입 모두에 걸려 ×2.56(이중 약점) / ×0.39(이중 내성·무효)</Foot>
            : null}
        </Sec>
      ) : null}

      <Sec title="모든 폼 활용 순위">
        {/* 종 이름으로 일반 · 다이맥스 · 거다이맥스를, 메가 라벨로 메가 폼을 모은다 — 메가를 보고 있어도 같은 목록 */}
        <UsageRanks name={stemOfName}
          megas={dexNo != null && stemOfName === data.DEX_DATA.names[String(dexNo)]
            ? (data.DEX_DATA.megas[String(dexNo)] ?? []).map((one) => one.label) : []} />
      </Sec>

      {/* PvP 개체값은 일반 폼에서만 — 맥스 폼은 PvP 에서 다이맥스하지 않아 따로 볼 까닭이 없다 */}
      {form && !/^(거다이맥스|다이맥스|맥스 참가) /.test(mon.name) ? <IvRank form={form} sprite={sprite} onLeave={onClose} /> : null}
      {dexNo != null ? <MegaCompareCard dexNo={dexNo} /> : null}

      {counter ? (
        <Sec title="보스로 만났을 때" >
          <p className="px-body px-muted">{counter.sub}</p>
          <Recs rows={counter.rows} onSwitch={switchTo} />
          <Foot>{counter.foot}</Foot>
        </Sec>
      ) : null}
    </div>
  );

  // ── 본문 — 자세히: 프로필 판 + (← 돌아가기 · 탭 · 판들) / 요약: 타입 줄 · 진화 · 폼별 정보 / 계산기
  const main = screen === 'calc' && form ? (
    <div className="pxd-main"><CalcScreen form={form} inputs={calc} onChange={setCalc} /></div>
  ) : (
    <div className="pxd-main">
      {previous ? (
        <button type="button" className="px-btn px-btn--sm px-skin pxd-back" onClick={back}><PixelIcon name="back" />{`${previous.mon.name}로 돌아가기`}</button>
      ) : null}
      {brief ? (
        // 요약의 머리 아래 한 줄 — 타입 · 번호. 설명 · 분류는 데이터에 없어 적지 않는다 (CLAUDE.md §5)
        <p className="px-body px-muted pxd-brief__line">{[typeLine, dexTag, formLabels.length ? `${formLabels.join(' · ')} 폼` : ''].filter(Boolean).join(' · ')}</p>
      ) : <DetailTabs tabs={TABS} value={tab} onChange={setTab} />}
      {summaryPane}
      {brief ? null : battlePane}
    </div>
  );

  // ── 바닥 동작 — 자세히: 링크 복사 · 포켓몬 도감 · CP 계산기 열기 / 계산기: 초기화 · 상세로 돌아가기 / 요약: 도감에서 자세히 · D-MAX · PvP
  const dock = screen === 'calc' ? (
    <>
      <button type="button" className="px-btn px-skin" data-act="reset" onClick={() => setCalc(CALC_DEFAULT)}>초기화</button>
      <button type="button" className="px-btn px-btn--primary px-skin" data-act="return" onClick={() => setScreen('detail')}>상세로 돌아가기 <PixelIcon name="arrow" /></button>
    </>
  ) : brief ? (
    <DeepDock mon={mon} dexNo={dexNo} onDeep={onDeep} onLeave={onClose} here={here}
      onHere={(name) => {
        const found = searchIndex.find((one) => one.name === name);
        showHere(found ? { sprite: found.sprite, name: found.name, en: found.en, types: found.types } : mon);
      }} />
  ) : (
    <>
      <ShareBtn mon={mon} />
      {/* 도감 화면 위의 팝업이면 두지 않는다 — 누르면 팝업만 닫혀 ✕ 와 같았다. 페이지는 맨 위 줄의 '← 도감으로' 가 그 자리다 */}
      {here === 'dex' || inline ? null : (
        <button type="button" className="px-btn px-skin" onClick={() => { go('/dex'); onClose?.(); }}>
          <PxIcon emoji="📕" /><span className="btn-label">포켓몬 도감</span>
        </button>
      )}
      {form ? (
        <button type="button" className="px-btn px-btn--primary px-skin" data-act="calc" onClick={() => setScreen('calc')}>
          <PxIcon emoji="🧮" /><span className="btn-label">CP 계산기</span> 열기 <PixelIcon name="arrow" />
        </button>
      ) : null}
    </>
  );

  const dataAttrs = {
    'data-route': 'mon', 'data-sprite': sprite, 'data-dex': dexNo ?? '', 'data-mon': mon.name,
    'data-form': formKind || 'base', 'data-view': 'list', 'data-tab': tab, 'data-screen': screen, 'data-depth': brief ? 'brief' : 'full',
  };

  // ── 페이지 (/mon/<번호>) — 화면 머리는 셸이 그린다. 맨 위 줄 → 프로필 판 → 탭 + 판들. 바닥 동작은 맨 위 줄에 함께 둔다
  if (inline) {
    return (
      <div className={`pxd pxd--page${screen === 'calc' ? ' is-calc' : ''}`} id={`detail-${sprite}`} {...dataAttrs}>
        <div className="pxd-page__bar">
          <a className="px-btn px-skin" href="/dex" onClick={(event) => { event.preventDefault(); go('/dex'); }}><PixelIcon name="back" />도감으로</a>
          {favBtn}
          <div className="pxd-page__dock">{dock}</div>
        </div>
        {screen === 'calc' ? (
          <p className="pxd-page__title"><span className="px-mono px-muted">CP 계산기</span><b className="px-heading">{mon.name}</b></p>
        ) : profile}
        {main}
      </div>
    );
  }

  // ── 팝업 — 머리(그림 · 번호 · 이름 · 타입 · ☆ · ✕) · 본문(프로필 판 | 탭 · 판들) · 바닥(동작). 판 네 조각은 components/PxDialog.tsx 의 것이다
  // 머리줄이 곧 이름표다 — 번호 · 이름 · 타입만 두고 폼(다이맥스 등)은 프로필 판 · 요약 줄에 적는다 (2026-09-30 주인 요청).
  // 계산기에서도 이름표를 남긴다 — 어느 폼의 CP 인지 알 수 있게 (Codex, PR #266)
  return (
    <PxDialog dialogRef={overlay} className={`pxd-dialog${brief ? ' pxd-dialog--brief' : ''}`} label={`${mon.name} 상세`}
      onClose={() => onClose?.()} panelId={`detail-${sprite}`}
      panelClassName={`pxd detail detail--mon${screen === 'calc' ? ' is-calc' : ''}`} panelProps={dataAttrs}>
      <PxDialogHead className="pxd__head" onClose={() => onClose?.()}
        art={<span className="px-ball px-ball--sm pxd__head-art"><Sprite id={sprite} className="detail__bar-sprite" /></span>}
        title={<span className="pxd__title">
          {dexTag ? <span className="px-mono px-muted">{dexTag}</span> : null}
          <b >{screen === 'calc' ? mon.name : baseName}</b>
        </span>}
        caption={screen === 'calc' ? 'CP 계산기 · 레벨과 개체값으로 예상 CP 확인' : brief ? '간단 정보 · 현재 화면을 유지하며 확인' : typeLine}
        actions={favBtn} />
      <PxDialogBody className="pxd__body" bodyRef={body}>
        {brief || screen === 'calc' ? main : (
          <div className="pxd__cols">
            {profile}
            {main}
          </div>
        )}
      </PxDialogBody>
      <PxDialogFoot className="pxd__foot" hint={brief ? '자세한 건 도감을 참고하세요!' : undefined}>{dock}</PxDialogFoot>
    </PxDialog>
  );
}

/** 메가X·메가Y 둘 다 있는 종에서만 선다 — 없으면 카드 자체를 만들지 않는다 */
function MegaCompareCard({ dexNo }: { dexNo: number }) {
  const { data } = useDex();
  const megas = data.DEX_DATA.megas[String(dexNo)] ?? [];
  if (!megas.some((one) => one.label === '메가X') || !megas.some((one) => one.label === '메가Y')) return null;
  return (
    <Sec title="메가X vs 메가Y 비교">
      <MegaCompare dex={dexNo} />
    </Sec>
  );
}
