// ─────────────────────────────────────────────────────────────────────────────
// screens/MonDetail.tsx — 포켓몬 상세 팝업
//
// 팝업은 한 번에 한 포켓몬을 보여 주지만, 진화 계열·추천 후보를 누르면 **같은 창에서** 그 포켓몬으로 바뀐다.
// 떠난 화면은 쌓아 두고, ← 로 돌아오면 보던 탭 · 계산기 입력값 · 포획 CP 경로가 그대로다.
//
// v3 의 이 팝업은 "다시 그리지 않는다" 를 손으로 지키고 있었다 — 탭·스크롤·계산기 입력값이 날아가서다
// (v3.60.0 의 ★ 도, 📣 배지도 제자리에서 글자만 갈아 끼웠다). React 에서는 그 규칙이 공짜다.
//
// 구성 (v3 detailBuild 와 같은 자리):
//   .modal(dialog) > .modal__wrap > .modal__close + .modal__box > .detail#detail-{sprite}
//     .detail__bar   ‹ 상세로 · 제목 · ★ · 포켓몬 도감
//     .detail__body  .detail__side (그림·이름) + .detail__main (탭 · 내용 · 계산기)
//     .detail__dock  링크 복사 · CP 계산기 / 초기화 · 상세로 돌아가기
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDex, useFavEvents, useGameday, useMax, usePve, usePvp } from '../lib/data';
import { Sprite } from '../components/Bits';
import { PxIcon } from '../components/PxIcon';
import { NameNode } from '../components/Row';
import { cpOf } from '../lib/cp';
import { counterTypes, matchups } from '../lib/matchup';
import { favNewsFor, favNewsWhen, FAV_NEWS_LABEL } from '../lib/favnews';
import { useFavs } from '../lib/useFavs';
import { buildSearchIndex } from '../lib/search';
import { resolveMon, type MonPick, type MonRef } from '../lib/mon';
import { track } from '../lib/track';
import ShareBtn from '../components/detail/ShareBtn';
import DetailTabs from '../components/detail/DetailTabs';
import Hex from '../components/detail/Hex';
import IvRank from '../components/detail/IvRank';
import CalcScreen, { CALC_DEFAULT, type CalcInputs } from '../components/detail/CalcScreen';
import { Evo, MegaCompare } from '../components/detail/Evo';
import CatchCard from '../components/detail/CatchCard';
import UsageRanks from '../components/detail/UsageRanks';

export type { MonRef } from '../lib/mon';

/** 팝업 한 화면의 상태 — 떠날 때 통째로 쌓았다가 ← 로 돌아올 때 그대로 되돌린다 (v3 detailState) */
interface View { mon: MonRef; tab: Tab; screen: 'detail' | 'calc'; calc: CalcInputs; catchSeg: string }

type Tab = 'summary' | 'battle' | 'evo';
const TABS: [Tab, string][] = [['summary', '요약'], ['battle', '배틀 정보'], ['evo', '진화']];

const FORM_KIND: Record<string, string> = {
  메가: 'mega', 메가X: 'mega', 메가Y: 'mega', 원시: 'mega',
  다이맥스: 'max', 거다이맥스: 'max', 섀도우: 'shadow',
};

/**
 * 스프라이트 id → 도감번호. 폼 전용 번호(10000번대)는 **DEX_DATA.dex 표**가 원종을 알려 준다.
 * 폼 데이터에서 찾으려 했더니 그 칸이 없어 늘 null 이었고, 그러면 종 중복 제거가 이름 단위로 떨어져
 * '보스로 만났을 때' 에 화이트 큐레무와 블랙 큐레무가 나란히 섰다 (v3 는 한 마리만 남긴다).
 */
function dexOf(sprite: number, table: Record<string, number>): number | null {
  return table[String(sprite)] ?? (sprite < 10000 ? sprite : null);
}

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

/** 보스 이름이 다이맥스·거다이맥스로 시작하면 맥스 배틀, 아니면 레이드 (참전 가능한 풀이 다르다) */
const bossKind = (name: string) => (/^(거다이맥스|다이맥스)\s/.test(name) ? 'max' : 'raid');

function TypeChip({ type, extra, className }: { type: string; extra?: string; className?: string }) {
  const { data } = useDex();
  return (
    <span className={`tchips__item${className ? ` ${className}` : ''}`}>
      <span className="dot" style={{ ['--c' as string]: `var(--t-${type})` }} />
      {data.TYPE_KO[type] ?? type}{extra ? <small>{extra}</small> : null}
    </span>
  );
}

/** 추천 후보 줄 — 누르면 같은 창에서 그 포켓몬으로 바뀐다 */
function Recs({ rows, onSwitch }: { rows: MonRef[]; onSwitch: (mon: MonRef) => void }) {
  const { data } = useDex();
  return (
    <div className="detail__recs">
      {rows.map((row, index) => (
        <button key={`${row.sprite}-${index}`} className="detail__rec" onClick={() => onSwitch(row)}>
          <Sprite id={row.sprite} />
          <span className="detail__rec-name"><NameNode name={row.name} labels={data.FORM_LABELS} /></span>
          <span className="detail__rec-go" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}

export default function MonDetail({ pick, onClose }: { pick: MonPick; onClose: () => void }) {
  const { data } = useDex();
  const { data: pve } = usePve();
  const { data: max } = useMax();
  const { data: pvpData } = usePvp();
  const { data: gameday } = useGameday();
  const { data: favEvents } = useFavEvents();
  const { favs, toggle: toggleFav } = useFavs();
  const overlay = useRef<HTMLDialogElement>(null);

  // 지금 보는 것 + 떠나온 것들.
  // **떠날 때 화면 전체를 통째로 쌓는다** — ← 로 돌아오면 보던 탭·계산기 입력값·포획 CP 경로가 그대로여야 한다.
  // 포켓몬만 쌓았더니 배틀 정보 탭에서 추천 후보를 눌렀다 돌아왔을 때 요약 탭이 열렸다 (v3 는 배틀 정보로 돌아온다)
  // **이름은 연 쪽이 들고 있던 것을 쓴다.** 순위표 줄은 '거다이맥스 고릴타' 를 이미 알고 있다.
  // 이름이 없는 길은 공유 링크 하나뿐이고, 그때만 검색 색인에서 찾는다 (v3 openDetailBySprite).
  // 도감 이름표만 보던 시절에는 폼 스프라이트(10000번대)가 표에 없어 '#10209' 라고 적혔고,
  // 그 한 값이 활용 순위(이름으로 찾는다)와 '보스로 만났을 때'(이름 앞 '거다이맥스' 로 가른다)를 같이 무너뜨렸다
  const start = useMemo<MonRef>(
    () => resolveMon(pick, buildSearchIndex(data, max, pve, pvpData), data.DEX_DATA),
    [pick, data, max, pve, pvpData],
  );
  const [stack, setStack] = useState<View[]>([]);
  const [mon, setMon] = useState<MonRef>(start);
  const [tab, setTab] = useState<Tab>('summary');
  const [screen, setScreen] = useState<'detail' | 'calc'>('detail');
  const [calc, setCalc] = useState<CalcInputs>(CALC_DEFAULT);
  const [catchSeg, setCatchSeg] = useState('max');

  // <dialog> 로 열어야 Esc·배경 잠금이 브라우저 몫이 된다 (v3 modal.js 와 같다)
  useEffect(() => {
    const node = overlay.current;
    if (!node?.open) node?.showModal();
  }, []);

  const switchTo = (next: MonRef) => {
    setStack((now) => [...now, { mon, tab, screen, calc, catchSeg }]);
    setMon(next);
    setTab('summary');
    setScreen('detail');
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
  };

  const sprite = mon.sprite;
  const dexNo = dexOf(sprite, data.DEX_DATA.dex);
  // 폼 데이터는 스프라이트 id 로 먼저 찾고(메가·리전 폼), 없으면 원종 도감번호로 되돌아간다
  const form = data.DEX_DATA.forms[String(sprite)] ?? (dexNo != null ? data.DEX_DATA.forms[String(dexNo)] : undefined);
  const types = mon.types.length ? mon.types : (form?.types ?? []);
  const cpm = data.DEX_DATA.cpm;
  const { labels: formLabels, base: baseName } = splitName(mon.name, data.FORM_LABELS);
  const formKind = formLabels.map((label) => FORM_KIND[label]).find(Boolean) ?? '';

  const isFav = dexNo != null && favs.includes(dexNo);
  const news = dexNo != null ? favNewsFor(favEvents.FAV_EVENTS, dexNo) : [];

  const typePills = () => types.map((type) => (
    <span key={type} className="detail__type-pill" style={{ ['--c' as string]: `var(--t-${type})` }}>
      {data.TYPE_KO[type] ?? type}
    </span>
  ));

  // ── 보스로 만났을 때 — 보스 종류에 따라 참전 가능한 풀이 다르다 (v2.13.0 QA-49)
  const counter = (() => {
    if (!types.length) return null;
    const first = types[0]!;
    if (bossKind(mon.name) === 'max') {
      // 맥스 배틀에는 다이맥스·거다이맥스만 들어간다 — 메가·원시·섀도우는 참전할 수 없다.
      // 미구현은 추천하지 않는다: 지금 데려갈 수 있는 것만 보여 준다
      const rows = (max.DMAX_DATA[first] ?? []).filter((row) => !row.unrel).slice(0, 5)
        .map((row) => ({ sprite: row.sprite, name: row.name, en: row.en, types: row.types }));
      if (!rows.length) return null;
      return {
        sub: '맥스 배틀 추천 후보 — 다이맥스·거다이맥스만 참전',
        rows,
        foot: `${data.TYPE_KO[first] ?? first} 속성 맥스 배틀 보스 기준 · 메가·원시·섀도우는 맥스 배틀에 참전할 수 없어 제외`,
      };
    }
    const attackTypes = counterTypes(data.DEX_DATA.chart, data.TYPE_KO, types, 2);
    if (!attackTypes.length) return null;
    // **시트를 먼저 본다** (v3 raidDealerRows) — 그 속성 최강 대비 %(score)라 타입이 달라도 견줄 수 있다.
    //   자체 계산(PVE_DATA)은 같은 보스 가정의 절대 점수라 역시 타입 사이 비교가 된다. 둘을 섞지는 않는다.
    //   자체 계산만 쓰다가 v3 와 추천 순서가 달라져 찾았다 (뮤츠·마폭시·리자몽 → 다른 차례)
    const sheet = pvpData.SHEET_DATA.pve;
    const useSheet = attackTypes.every((type) => Array.isArray(sheet?.[type]) && sheet![type]!.length > 0);
    const source: Record<string, { sprite: number; name: string; en: string; types: readonly string[]; score?: number }[]> =
      useSheet ? sheet! : pve.PVE_DATA;
    const merged = attackTypes.flatMap((type) => (source[type] ?? []).slice(0, 15));
    merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const seen = new Set<string | number>();
    const picked: MonRef[] = [];
    for (const row of merged) {
      const key = dexOf(row.sprite, data.DEX_DATA.dex) ?? row.name;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push({ sprite: row.sprite, name: row.name, en: row.en, types: row.types });
      if (picked.length >= 5) break;
    }
    if (!picked.length) return null;
    const typeLabel = attackTypes.map((type) => data.TYPE_KO[type] ?? type).join('·');
    return {
      sub: `레이드 추천 후보 — ${typeLabel} 딜러`,
      rows: picked,
      foot: `일반·전설·메가 레이드는 전체 포켓몬 참전 · ${typeLabel} 타입 레이드 성능표 상위 (종 중복 제거)`,
    };
  })();

  const match = types.length ? matchups(data.DEX_DATA.chart, data.TYPE_KO, types) : { weak: [], resist: [] };
  const chipList = (rows: { type: string; mult: number }[]) => rows.length ? (
    <div className="tchips">
      {rows.map((row) => {
        const double = row.mult >= 2.5 || row.mult <= 0.4;
        const klass = row.mult >= 2.5 ? 'is-weak2' : row.mult <= 0.4 ? 'is-resist2' : '';
        return <TypeChip key={row.type} type={row.type} className={klass}
          extra={`×${+row.mult.toFixed(2)}${double ? ' 이중' : ''}`} />;
      })}
    </div>
  ) : <p className="detail__none-text">없음</p>;

  const changes = gameday.MOVE_CHANGES;
  const changed = changes?.affected?.[String(sprite)] ?? null;

  const previous = stack.at(-1);

  // 모르는 스프라이트 번호면 아무것도 열지 않는다 — v3 openDetailBySprite 도 조용히 돌아간다.
  // (틀린 공유 링크에 빈 팝업이 뜨면 '데이터가 없는 종' 처럼 읽힌다)
  if (mon.name === `#${sprite}`) return null;

  return (
    <dialog className="modal" ref={overlay} aria-label={`${mon.name} 상세`}
      data-route="mon" data-mon={mon.name} data-sprite={sprite}
      onClick={(event) => { if (event.target === overlay.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        {/* ✕ 는 카드 **밖** 오른쪽 위 — 안에 두면 카드 내용과 자리를 다툰다 (v2.34.0) */}
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="detail detail--mon" id={`detail-${sprite}`}
            data-route="mon" data-sprite={sprite} data-dex={dexNo ?? ''} data-mon={mon.name}
            data-form={formKind || 'base'} data-view="list" data-tab={tab} data-screen={screen}>

            <div className="detail__bar">
              <button className="detail__bar-back" aria-label="상세로 돌아가기" onClick={() => setScreen('detail')}>‹ 상세로</button>
              <p className="detail__bar-title">{screen === 'calc' ? 'CP 계산기' : '포켓몬 상세'}</p>
              <div className="detail__top-actions">
                {/* ★ 입구는 **여기 하나뿐**이다 (v3.60.0 의 규칙) — 목록 카드에는 달지 않는다.
                    담아 두면 그 포켓몬의 커뮤니티 데이·스포트라이트·레이드 일정을 챙겨 준다 */}
                {dexNo != null ? (
                  <button className={`detail__bar-btn detail__fav${isFav ? ' is-on' : ''}`} data-dex={dexNo}
                    aria-pressed={isFav}
                    title={isFav ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기 — 이 포켓몬의 일정을 챙겨 드려요'}
                    onClick={(event) => {
                      event.stopPropagation();
                      // 지표는 useFavs 안에서 한 번만 찍는다 — 여기서 또 찍으면 한 번 누른 것이 두 건이 된다
                      toggleFav(dexNo, '포켓몬 상세');
                    }}>
                    <span className="detail__fav-star" aria-hidden="true">{isFav ? '★' : '☆'}</span>
                    <span className="detail__fav-label">{isFav ? '담음' : '즐겨찾기'}</span>
                  </button>
                ) : null}

              </div>
            </div>

            <div className="detail__body">
              <div className="detail__side">
                <div className={`sprite-box${formKind ? ` sprite-box--${formKind}` : ''}`}>
                  <Sprite id={sprite} />
                  {types.length ? <div className="detail__types">{typePills()}</div> : null}
                </div>
                <div className="detail__info">
                  {/* 좁은 화면의 접힌 머리에서는 그림이 작아 모서리에 배지를 걸 자리가 없다 —
                      같은 배지를 이름 왼쪽에 한 벌 더 두고 어느 쪽을 보일지는 CSS 가 data-tab 으로 고른다 */}
                  {types.length ? <div className="detail__types detail__types--inline" aria-hidden="true">{typePills()}</div> : null}
                  <div className="detail__tags">
                    {dexNo != null ? <span className="tag detail__dexno">#{String(dexNo).padStart(4, '0')}</span> : null}
                    {formLabels.map((label) => (
                      <span key={label} className={`form-tag${FORM_KIND[label] ? ` form-tag--${FORM_KIND[label]}` : ''}`}>{label}</span>
                    ))}
                  </div>
                  <h2>{baseName}</h2>
                  {/* 이 줄은 늘 **반대 언어의 이름**이다 — 한국어 화면엔 Metagross, 영어 화면엔 메타그로스.
                      사전을 태우면(data-i18n 없이 두면) 영어 화면에서 이름 줄과 똑같은 Metagross 가 두 번 선다.
                      엔진이 data-alt-ko/en 을 보고 갈아 끼운다 (lib/i18n.ts) */}
                  {mon.en ? (
                    <div className="detail__en-inline" data-i18n="alt" data-alt-ko={mon.en} data-alt-en={baseName}>{mon.en}</div>
                  ) : null}
                  {/* 📣 소식 자리 — **담아 둔 포켓몬에만** 선다 (v3 favNewsNode 가 isFav 를 먼저 묻는다).
                      ★ 를 누를 이유가 여기서 생긴다. 머리줄이 아니라 이름 **아래**인 것은
                      390px 에서 버튼 넷이 제목을 15px 로 눌렀기 때문이다 (v3.60.0 실측).
                      가장 가까운 한 건만 쓰고 나머지는 개수로 접는다.
                      display:contents 라 비어 있을 때 빈 줄을 만들지 않는다 (modal.css) */}
                  <span className="detail__favnews-slot">
                    {isFav && news.length ? (
                      <button className="detail__favnews"
                        title={news.map((row) => `${FAV_NEWS_LABEL[row.event.type] ?? '일정'} ${favNewsWhen(row)} — ${row.event.title}`).join('\n')}
                        onClick={(event) => {
                          event.stopPropagation();
                          track('fav_news_open', { mon: String(dexNo), count: news.length });
                          onClose();
                          location.hash = '#/schedule';
                        }}>
                        <span className="detail__favnews-dot" aria-hidden="true">📣</span>
                        <b className="detail__favnews-kind">{FAV_NEWS_LABEL[news[0]!.event.type] ?? '일정'}</b>
                        <span className="detail__favnews-when">{favNewsWhen(news[0]!)}</span>
                        {news.length > 1 ? <span className="detail__favnews-more">외 {news.length - 1}</span> : null}
                      </button>
                    ) : null}
                  </span>
                </div>
              </div>

              <div className="detail__main">
                <div className="detail__main-detail">
                  {previous ? (
                    <button className="detail__back" onClick={back}>← {previous.mon.name}로 돌아가기</button>
                  ) : null}
                  <DetailTabs tabs={TABS} value={tab} onChange={setTab} />
                  <div className="detail__scroll">

                    {/* ── 요약: CP · 포획 CP · 기술 · (기술 변경) · 능력치 */}
                    <div className="detail__pane" role="tabpanel" data-pane="summary" id="detail-pane-summary" aria-labelledby="detail-tab-summary" hidden={tab !== 'summary'}>
                      {form && cpm['l50'] ? (
                        <>
                          {/* 만렙 큰 숫자는 접혀도 보이고 2×2 표만 접힌다 (v2.32.0) */}
                          <div className="detail__matchrows">
                          <details className="detail__cp-card">
                            <summary>
                              <div className="detail__cp-big">
                                <span className="meta">Lv.50 · 개체값 15/15/15</span>
                                <span className="detail__cp-line">
                                  <span className="detail__cp-label">CP</span><b>{cpOf(form, cpm['l50']!).toLocaleString()}</b>
                                </span>
                              </div>
                            </summary>
                            <div className="detail__cp-grid">
                              {([[max.MAX_POOL[String(sprite)] ? '레이드·맥스' : '레이드', 'l20'],
                                 ['부스트', 'l25'], ['야생', 'l30'], ['부스트', 'l35']] as const).map(([label, key], index) => (
                                <div key={index} className="detail__cp-tile">
                                  <span className="meta">{label}</span>
                                  <b>{cpm[key] ? cpOf(form, cpm[key]!).toLocaleString() : '-'}</b>
                                </div>
                              ))}
                            </div>
                          </details>
                            <section className="detail__card">
                              <h3>배틀 활용 순위</h3>
                              <UsageRanks name={mon.name} compact />
                            </section>
                          </div>
                          <CatchCard form={form} sprite={sprite} seg={catchSeg} onSeg={setCatchSeg} />
                        </>
                      ) : null}

                      {form ? (
                        <section className="detail__card">
                          <h3>배울 수 있는 기술</h3>
                          <div className="detail__moves">
                            <div>
                              {([['일반 기술', form.fast], ['스페셜 기술', form.charged]] as const).map(([label, moves]) => (
                                <div key={label} className="move-list__row">
                                  <em>{label}</em>
                                  <div className="move-list">
                                    {moves.map(([name, legacy]) => (
                                      <span key={name} className={`move-chip${legacy ? ' is-legacy' : ''}`}>{name}{legacy ? ' ★' : ''}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {form.fast.some((move) => move[1]) || form.charged.some((move) => move[1])
                                ? <p className="detail__foot">★ 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득</p>
                                : null}
                            </div>
                          </div>
                        </section>
                      ) : null}

                      {/* 적용 전후 모두 적는다 — 적용 뒤에도 "왜 순위가 움직였나" 의 답이 된다 */}
                      {changed && changes ? (
                        <section className="detail__card">
                          <h3>⚔️ {changes.date} 기술 변경 적용됨</h3>
                          <div>
                            <div className="changes__list">
                              {([['▲', changed.up, 'is-up'], ['▼', changed.down, 'is-down'],
                                 ['·', changed.energy, ''], ['＋', changed.new, 'is-up']] as const).map(([mark, names, klass]) =>
                                names?.length ? (
                                  <div key={mark} className={`changes__row ${klass}`}>
                                    <span className="changes__mark">{mark}</span>
                                    <div>
                                      <b>{names.join(' · ')}</b>
                                      {names.some((name: string) => changed.legacy?.includes(name))
                                        ? <div className="changes__sub">※ 일부는 지금 배울 수 없는 레거시 기술이에요</div>
                                        : null}
                                    </div>
                                  </div>
                                ) : null)}
                            </div>
                            <p className="detail__foot">위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → ⚔️ 기술 변경</p>
                          </div>
                        </section>
                      ) : null}

                      {/* 자주 보는 값이 아니라 접어 둔다 — 도감에서 보던 사람을 위해 남긴다 */}
                      {form ? (
                        <details className="detail__acc detail__acc--hex">
                          <summary>능력치 육각형</summary>
                          <div className="detail__acc-body"><Hex form={form} name={mon.name} types={types} /></div>
                        </details>
                      ) : <p className="detail__none-text">이 폼은 능력치 데이터가 없어요.</p>}
                    </div>

                    {/* ── 배틀 정보: 타입 상성 · 활용 순위 · PvP 개체값 · 메가 비교 · 보스로 만났을 때 */}
                    <div className="detail__pane" role="tabpanel" data-pane="battle" id="detail-pane-battle" aria-labelledby="detail-tab-battle" hidden={tab !== 'battle'}>
                      {types.length ? (
                        <section className="detail__card">
                          <h3>타입 상성</h3>
                          <div>
                            {/* 약점·내성을 각각 카드 한 장으로 — 칩만 두 줄로 늘어놓으면 경계가 섞인다 (v2.42.0) */}
                            <div className="detail__matchrows">
                              <div className="detail__match detail__match--weak">
                                <h3>약점 (더 큰 데미지)</h3>{chipList(match.weak)}
                              </div>
                              <div className="detail__match detail__match--resist">
                                <h3>내성 (덜 받는 데미지)</h3>{chipList(match.resist)}
                              </div>
                            </div>
                            {/* 줄은 늘 서고 **이중이 있을 때만 글자가 찬다** (v3 hasDouble) — 없는 데 설명이 붙으면 찾게 된다 */}
                            <p className="detail__foot">
                              {match.weak.some((row) => row.mult >= 2.5) || match.resist.some((row) => row.mult <= 0.4)
                                ? '이중 = 두 타입 모두에 걸려 ×2.56(약점) / ×0.39(내성·무효)' : ''}
                            </p>
                          </div>
                        </section>
                      ) : null}

                      <section className="detail__card">
                        <h3>활용 순위</h3>
                        <UsageRanks name={mon.name} />
                      </section>

                      {form ? <IvRank form={form} sprite={sprite} /> : null}
                      {dexNo != null ? (
                        <MegaCompareCard dexNo={dexNo} />
                      ) : null}

                      {counter ? (
                        <section className="detail__card detail__boss">
                          <h3>보스로 만났을 때</h3>
                          <p className="detail__card-sub">{counter.sub}</p>
                          <div>
                            <Recs rows={counter.rows} onSwitch={switchTo} />
                            <p className="detail__foot">{counter.foot}</p>
                          </div>
                        </section>
                      ) : null}
                    </div>

                    {/* ── 진화 */}
                    <div className="detail__pane" role="tabpanel" data-pane="evo" id="detail-pane-evo" aria-labelledby="detail-tab-evo" hidden={tab !== 'evo'}>
                      <section className="detail__card">
                        <h3>진화 계열</h3>
                        {dexNo != null
                          ? <Evo dex={dexNo} sprite={sprite} onSwitch={switchTo} />
                          : <p className="detail__none-text">진화가 없는 포켓몬이에요.</p>}
                      </section>
                      <p className="dex__hint">
                        진화 계열과 메가·맥스 폼을 구분해서 보여 줘요 · 포켓몬을 누르면 이 창에서 상세가 바뀌고, ← 로 돌아오면 보던 탭과 위치가 그대로예요
                      </p>
                    </div>
                  </div>
                </div>
                {form ? (
                  <div className="detail__calc">
                    <CalcScreen form={form} inputs={calc} onChange={setCalc} />
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── 하단 고정 — 상세: [링크 복사] [CP 계산기] · 계산기: [초기화] [상세로 돌아가기] */}
            <div className="detail__dock">
              <div className="detail__dock-row detail__dock-row--detail">
                <ShareBtn mon={mon} />
                <button className="detail__dock-btn detail__bar-dex" onClick={() => { location.hash = '#/dex'; onClose(); }}>
                  <PxIcon emoji="📕" />포켓몬 도감
                </button>
                {form ? (
                  <button className="detail__dock-btn detail__dock-btn--accent detail__dock-calc"
                    onClick={() => setScreen('calc')}><PxIcon emoji="🧮" />CP 계산기</button>
                ) : null}
              </div>
              <div className="detail__dock-row detail__dock-row--calc">
                <button className="detail__dock-btn detail__dock-reset" onClick={() => setCalc(CALC_DEFAULT)}>↻ 초기화</button>
                <button className="detail__dock-btn detail__dock-btn--accent detail__dock-return"
                  onClick={() => setScreen('detail')}>← 상세로 돌아가기</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** 메가X·메가Y 둘 다 있는 종에서만 선다 — 없으면 카드 자체를 만들지 않는다 */
function MegaCompareCard({ dexNo }: { dexNo: number }) {
  const { data } = useDex();
  const megas = data.DEX_DATA.megas[String(dexNo)] ?? [];
  if (!megas.some((one) => one.label === '메가X') || !megas.some((one) => one.label === '메가Y')) return null;
  return (
    <section className="detail__card">
      <h3>⚡ 메가X vs 메가Y 비교</h3>
      <MegaCompare dex={dexNo} />
    </section>
  );
}
