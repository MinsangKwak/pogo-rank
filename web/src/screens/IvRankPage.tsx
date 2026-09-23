// ─────────────────────────────────────────────────────────────────────────────
// screens/IvRankPage.tsx — 🧬 PvP 개체값 순위 (v3 components/ivrank.js renderIvRankPage)
//
// 묻는 것 — **"내 개체가 이 리그에서 몇 위인가."**
// 서비스는 만렙 CP 와 리그 도달 레벨까지는 보여 줬지만 그 한 줄이 없어서
// 사람들이 바깥 사이트로 나가 다시 찾아봤다.
//
// 넓은 화면은 왼쪽에 '무엇을 넣나', 오른쪽에 '그래서 몇 위인가' 로 가른다 (.ivrank__split).
// 가르는 일은 CSS 가 한다 — JS 에 폭 분기를 만들지 않는다(v3 와 같은 원칙).
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Slot } from '../components/Slots';
import { ScreenTabs, Sprite, ToolBtn } from '../components/Bits';
import { NameNode } from '../components/Row';
import { LEAGUES } from '../lib/leagues';
import { buildSearchIndex, monSearch, searchVisible, type SearchEntry } from '../lib/search';
import {
  IVRANK_FLOORS, IVRANK_LEAGUES, IVRANK_MAX_LEVEL, IVRANK_STORE, LEAGUE_KO,
  ivRankOf, ivRankTable,
} from '../lib/ivrank';
import { calcCp } from '../lib/cp';
import { track, trackSearchPick } from '../lib/track';
import type { DexForm, LeagueKey } from '../types/data';

interface Picked { sprite: number | null; ivs: [number, number, number]; floor: number }

function readPicked(): Picked {
  try {
    const raw = localStorage.getItem(IVRANK_STORE);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') return saved as Picked;
  } catch { /* 저장 불가 환경 */ }
  return { sprite: null, ivs: [0, 15, 15], floor: 0 };
}

function savePicked(picked: Picked) {
  try { localStorage.setItem(IVRANK_STORE, JSON.stringify(picked)); } catch { /* 저장 불가 환경 */ }
}

/** 검색 결과 한 줄 — v3 components/search.js monSuggestRow 와 같은 마크업 */
function SuggestRow({ mon, typeKo, labels, onPick }: {
  mon: SearchEntry; typeKo: Record<string, string>; labels: readonly string[]; onPick: () => void;
}) {
  return (
    <button className={`sugg__item${mon.unrel ? ' is-unreleased' : ''}`} onClick={onPick}>
      <Sprite id={mon.sprite} />
      <span className="sugg__main">
        <span className="sugg__name">
          <NameNode name={mon.name} labels={labels} />
          {mon.unrel ? <span className="tag dex__unrel">미구현</span> : null}
        </span>
        <span className="sugg__meta">
          {mon.types.map((type) => (
            <span key={type} className="dex__type" style={{ ['--c' as string]: `var(--t-${type})` }}>
              <i className="dot" aria-hidden="true" />
              <b>{typeKo[type] ?? type}</b>
            </span>
          ))}
          <span className="dex__no sugg__no">#{String(mon.sprite).padStart(4, '0')}</span>
        </span>
      </span>
      <span className="sugg__go" aria-hidden="true">›</span>
    </button>
  );
}

/** 리그 카드 한 장 — 순위 · 1위 대비 · 도달 레벨 · CP */
function LeagueCard({ form, cpms, league, cap, floor, ivs, on }: {
  form: DexForm; cpms: readonly number[]; league: LeagueKey; cap: number | null;
  floor: number; ivs: [number, number, number]; on: boolean;
}) {
  const name = `${LEAGUE_KO[league]}리그`;
  const mark = on ? ' is-on' : '';
  // 마스터는 CP 상한이 없어 개체값이 높을수록 좋다 — 순위를 매기면 15/15/15 가 늘 1위라 볼 것이 없다
  if (cap == null) {
    return (
      <div className={`ivrank__card ivrank__card--master${mark}`}>
        <div className="ivrank__lg">{name}<span className="meta">CP 상한 없음</span></div>
        <b className="ivrank__rank">순위 없음</b>
        <span className="meta">개체값이 높을수록 좋아요 · Lv{IVRANK_MAX_LEVEL} CP {calcCp(form, cpms, IVRANK_MAX_LEVEL, ivs[0], ivs[1], ivs[2]).toLocaleString()}</span>
      </div>
    );
  }
  const got = ivRankOf(form, cpms, cap, floor, ivs);
  if (!got) {
    return (
      <div className={`ivrank__card is-out${mark}`}>
        <div className="ivrank__lg">{name}<span className="meta">CP {cap}</span></div>
        <b className="ivrank__rank">참가 불가</b>
        <span className="meta">레벨 1의 CP가 리그 상한을 초과해요</span>
      </div>
    );
  }
  return (
    <div className={`ivrank__card${got.rank === 1 ? ' is-top' : ''}${mark}`}>
      <div className="ivrank__lg">{name}<span className="meta">CP {cap}</span></div>
      <b className="ivrank__rank">{`${got.rank.toLocaleString()}위`}<span className="ivrank__total">{` / ${got.total.toLocaleString()}`}</span></b>
      <span className="ivrank__pct">1위의 {got.percent}%</span>
      <span className="meta">Lv{got.level} · CP {got.cp.toLocaleString()}</span>
      <span className="meta ivrank__best">1위는 {got.best.ivs.join('/')}</span>
    </div>
  );
}

/** '어디에 쓸까' 한 줄 — 상한이 있는 세 리그 중 순위가 가장 앞선 곳 */
function Verdict({ form, cpms, floor, ivs }: { form: DexForm; cpms: readonly number[]; floor: number; ivs: [number, number, number] }) {
  const scored = IVRANK_LEAGUES
    .filter(([, cap]) => cap != null)
    .map(([league, cap]) => ({ league, got: ivRankOf(form, cpms, cap, floor, ivs) }))
    .filter((one): one is { league: LeagueKey; got: NonNullable<ReturnType<typeof ivRankOf>> } => one.got != null)
    .sort((left, right) => left.got.rank - right.got.rank || right.got.percent - left.got.percent);
  const best = scored[0];
  if (!best) return <p className="ivrank__verdict"><b>참가 가능한 리그가 없어요</b> 레벨 1의 CP가 각 리그의 상한을 초과해요.</p>;
  return (
    <p className="ivrank__verdict">
      <b>{LEAGUE_KO[best.league]}리그에서 개체값 순위가 가장 높아요</b>
      {` — 4,096 조합 중 ${best.got.rank.toLocaleString()}위 (1위의 ${best.got.percent}%).`}
    </p>
  );
}

/**
 * 상위 개체값 열 줄 — '그럼 뭘 노려야 하나' 에 답한다.
 * 리그는 화면 맨 위 세그먼트 하나가 정한다 (v2.66.0) — 같은 화면에 리그를 고르는 컨트롤이
 * 둘이면 위에서 '슈퍼' 를 골라도 아래는 '리틀' 이 된다.
 */
function TopList({ form, cpms, floor, ivs, league }: {
  form: DexForm; cpms: readonly number[]; floor: number; ivs: [number, number, number]; league: LeagueKey;
}) {
  const cap = IVRANK_LEAGUES.find(([id]) => id === league)?.[1] ?? null;
  const mineKey = ivs.join('/');
  const head = (
    <div className="row-head">
      <h2>{LEAGUE_KO[league] ?? league}리그 상위 10</h2>
      <span className="meta">{cap == null ? '상한 없음' : `CP ${cap} · 개체값 조합 4,096개 중`}</span>
    </div>
  );
  if (cap == null) {
    return (
      <div className="ivrank__top">{head}
        <p className="empty">마스터리그는 CP 상한이 없어요 — 개체값이 높을수록 좋아서 순위를 매기지 않아요.</p>
      </div>
    );
  }
  const rows = ivRankTable(form, cpms, cap, floor).slice(0, 10);
  return (
    <div className="ivrank__top">{head}
      {rows.length ? (
        <ol className="ivrank__list">
          {rows.map((row, index) => (
            <li key={row.ivs.join('/')} className={row.ivs.join('/') === mineKey ? 'is-mine' : ''}>
              <span className="ivrank__no">{index + 1}</span>
              <b>{row.ivs.join('/')}</b>
              <span className="meta">Lv{row.level} · CP {row.cp.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      ) : <p className="empty">레벨 1의 CP가 리그 상한을 초과해 참가할 수 없어요.</p>}
    </div>
  );
}

export default function IvRankPage() {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const league = useRankStore((s) => s.league);
  const set = useRankStore((s) => s.set);
  const [picked, setPicked] = useState<Picked>(readPicked);
  const [term, setTerm] = useState('');

  useEffect(() => { track('ivrank_view'); }, []);

  const cpms = dex.DEX_DATA.cpms;
  const save = (next: Picked) => { savePicked(next); setPicked(next); };

  // 미구현 폼도 뺀다 — 여기서 고르는 것은 **내가 실제로 가진 개체**다 (v3.61.2)
  const hits = useMemo(() => {
    const query = term.trim();
    if (!query) return [];
    const pool = searchVisible(buildSearchIndex(dex, max, pve, pvp))
      .filter((entry) => !/^(다이맥스|거다이맥스) /.test(entry.name));
    return monSearch(pool, query, 8);
  }, [term, dex, max, pve, pvp]);

  const dexNo = picked.sprite == null ? null : (dex.DEX_DATA.dex[String(picked.sprite)] ?? (picked.sprite < 10000 ? picked.sprite : null));
  const pickedForm = picked.sprite == null ? null : (dex.DEX_DATA.forms[String(picked.sprite)] ?? null);
  const outForm = picked.sprite == null ? null
    : (dex.DEX_DATA.forms[String(picked.sprite)] ?? (dexNo != null ? dex.DEX_DATA.forms[String(dexNo)] : undefined) ?? null);

  return (
    <div className="page__body" id="page-ivrank" data-route="ivrank">
      <Slot name="tabs">
        <ScreenTabs items={LEAGUES.map((one) => ({ id: one.id, label: one.name }))} value={league}
          onPick={(id) => set('league', id as LeagueKey)} />
      </Slot>
      <Slot name="headActions">
        {/* 켜 둔 도구가 그 줄의 제목 노릇을 한다 — 그래서 맨 앞이다 (v2.67.0 의 규칙) */}
        <ToolBtn label="🧬 개체값 순위" on onClick={() => { track('tool_ivrank', { on: 0 }); go('/pvp'); }} />
        <ToolBtn label="🃏 덱 짜기" onClick={() => { track('tool_pvpdeck', { on: 1 }); go('/pvp/deck'); }} />
      </Slot>

      {/* v3 는 이 문단을 조각 넷으로 붙인다 — 사전이 줄 단위로 찾으므로 붙이는 자리도 같아야 한다 */}
      <p className="note">
        {'실험 기능이에요. '}
        <b>CP 상한이 있는 리그에서는 공격 개체값이 낮은 조합</b>
        {'이 유리할 수 있어요. 같은 CP 상한 안에서 레벨을 더 높일 수 있기 때문이에요. '}
        {'최적 개체값은 포켓몬과 리그에 따라 달라요.'}
      </p>

      <div className="ivrank__split">
        <div className="ivrank__form">
          <div className="row-head"><h2>포켓몬 선택</h2></div>
          <div className="ivrank__pick">
            {picked.sprite != null ? (
              <div className="ivrank__picked">
                <Sprite id={picked.sprite} />
                <div className="ivrank__picked-main">
                  <b>{dex.DEX_DATA.names[String(dexNo ?? picked.sprite)] ?? String(picked.sprite)}</b>
                  <span className="meta">{pickedForm ? `공격 ${pickedForm.atk} · 방어 ${pickedForm.def} · 체력 ${pickedForm.hp}` : '폼 데이터 없음'}</span>
                </div>
                <button className="ivrank__swap" aria-label="다른 종 고르기"
                  onClick={() => { setTerm(''); save({ ...picked, sprite: null }); }}>✕</button>
              </div>
            ) : (
              <>
                <input className="boss__search" placeholder="종 이름 검색 (예: 레지스틸, 앱솔)" autoComplete="off"
                  value={term} onChange={(event) => setTerm(event.target.value)} />
                <div className="boss__sugg">
                  {term.trim() ? (hits.length
                    ? hits.map((hit) => (
                      <SuggestRow key={hit.name} mon={hit} typeKo={dex.TYPE_KO} labels={dex.FORM_LABELS}
                        onPick={() => { trackSearchPick(hit.name, 'iv_rank'); save({ ...picked, sprite: hit.sprite }); }} />
                    ))
                    : <span className="sugg__none">검색 결과가 없어요</span>) : null}
                </div>
              </>
            )}
          </div>

          <div className="row-head"><h2>개체값</h2><span className="meta">공격 · 방어 · 체력</span></div>
          <div className="ivrank__ivs">
            {(['공격', '방어', '체력'] as const).map((label, index) => (
              <label key={label} className="ivrank__ivbox">
                <span className="meta">{label}</span>
                <input className="ivrank__iv" type="number" min="0" max="15" inputMode="numeric"
                  value={String(picked.ivs[index])}
                  onChange={(event) => {
                    const value = Math.max(0, Math.min(15, Number(event.target.value) || 0));
                    const ivs = [...picked.ivs] as [number, number, number];
                    ivs[index] = value;
                    save({ ...picked, ivs });
                  }} />
              </label>
            ))}
          </div>

          <div className="row-head"><h2>획득 경로</h2><span className="meta">하한이 달라 순위도 달라져요</span></div>
          <div className="tchips ivrank__floors">
            {IVRANK_FLOORS.map(([label, value, why]) => (
              <button key={label} className={`uchip${picked.floor === value ? ' is-on' : ''}`} title={why}
                onClick={() => save({
                  ...picked,
                  floor: value,
                  // 하한보다 낮은 칸은 하한으로 끌어올린다 — 있을 수 없는 조합을 물어보지 않게
                  ivs: picked.ivs.map((iv) => Math.max(iv, value)) as [number, number, number],
                })}>
                {label}<b>{` ${value}↑`}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="ivrank__out">
          {picked.sprite == null
            ? <p className="empty">포켓몬을 선택하면 해당 리그의 개체값 순위를 확인할 수 있어요.</p>
            : !outForm
              ? <p className="empty">이 포켓몬의 종족값 정보가 아직 없어요.</p>
              : (
                <>
                  <Verdict form={outForm} cpms={cpms} floor={picked.floor} ivs={picked.ivs} />
                  {/* 네 장의 리그 카드는 남긴다 — '이 개체가 어느 리그용인가' 는 리그를 고르기 전에 답해야 하는 질문이다 */}
                  <div className="ivrank__cards">
                    {IVRANK_LEAGUES.map(([one, cap]) => (
                      <LeagueCard key={one} form={outForm} cpms={cpms} league={one} cap={cap}
                        floor={picked.floor} ivs={picked.ivs} on={one === league} />
                    ))}
                  </div>
                  <TopList form={outForm} cpms={cpms} floor={picked.floor} ivs={picked.ivs} league={league} />
                </>
              )}
        </div>
      </div>

      {/* v3 는 이 각주를 네 문장으로 나눠 붙인다 — 사전이 줄 단위로 찾으므로 한 덩이로 합치면 못 옮긴다 */}
      <p className="detail__foot">
        {'순위는 CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력(스탯 곱)으로 매겨요. '}
        {'체력의 소수점 이하를 버리는 게임 규칙을 반영하며, 도감과 동일한 종족값·레벨별 배율을 사용해요. '}
        {'베스트 버디의 레벨 보너스(+1)는 계산에서 제외해요. '}
        {'마스터리그는 CP 상한이 없어 개체값이 높을수록 좋아요(순위를 매기지 않아요).'}
      </p>
    </div>
  );
}
