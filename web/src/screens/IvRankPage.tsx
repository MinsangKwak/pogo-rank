// ─────────────────────────────────────────────────────────────────────────────
// screens/IvRankPage.tsx — 🧬 PvP 개체값 순위 (v3 components/ivrank.js renderIvRankPage · v6 피그마 14)
//
// 묻는 것 — **"내 개체가 이 리그에서 몇 위인가."**
// 서비스는 만렙 CP 와 리그 도달 레벨까지는 보여 줬지만 그 한 줄이 없어서
// 사람들이 바깥 사이트로 나가 다시 찾아봤다.
//
// 위에서 아래로 — 포켓몬 고르기 → 개체값 스테퍼 셋 · 정화 · 획득 경로 → 리그 넷 결과 → 판정 한 줄 → 고른 리그의 TOP 10 표.
// 저장(pogo_ivrank) · GA 이벤트 · 리그 store 는 그대로다. 표는 모바일에서 줄 카드가 된다(tools.css).
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Slot } from '../components/Slots';
import { PxChips, PxTabs, ToolBtn } from '../components/Bits';
import { CandList, CandRow, DataTable, Field, MetricTile, Note, PickedCard, SearchBox, SecHead, Stepper } from '../components/ToolBits';
import { LEAGUES } from '../lib/leagues';
import { buildSearchIndex, monSearch, searchVisible } from '../lib/search';
import {
  IVRANK_FLOORS, IVRANK_LEAGUES, IVRANK_MAX_LEVEL, IVRANK_STORE, LEAGUE_KO,
  ivRankOf, ivRankTable, purifyIvs,
} from '../lib/ivrank';
import { calcCp } from '../lib/cp';
import { count, num, percent, word } from '../lib/cell';
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

const IV_LABELS = ['공격', '방어', 'HP'] as const;
const TOTAL = 4096;   // 0~15 세 칸 = 16³ 조합

/** 리그 타일 한 장 — 순위 · 1위 대비 · 도달 레벨 · CP */
function LeagueTile({ form, cpms, league, cap, floor, ivs, on }: {
  form: DexForm; cpms: readonly number[]; league: LeagueKey; cap: number | null;
  floor: number; ivs: [number, number, number]; on: boolean;
}) {
  const name = `${LEAGUE_KO[league]}리그`;
  // 마스터는 CP 상한이 없어 개체값이 높을수록 좋다 — 순위를 매기면 15/15/15 가 늘 1위라 볼 것이 없다
  if (cap == null) {
    return <MetricTile className="px-drop pxt-league" on={on} tone="muted" label={`${name} · CP 상한 없음`} value="순위 없음"
      note={`개체값이 높을수록 좋아요 · Lv.${IVRANK_MAX_LEVEL} · CP ${count(calcCp(form, cpms, IVRANK_MAX_LEVEL, ivs[0], ivs[1], ivs[2]))}`} />;
  }
  const got = ivRankOf(form, cpms, cap, floor, ivs);
  if (!got) {
    return <MetricTile className="px-drop pxt-league" on={on} tone="muted" label={`${name} · CP ${count(cap)}`} value="참가 불가" note="레벨 1의 CP가 리그 상한을 초과해요" />;
  }
  return <MetricTile className="px-drop pxt-league" on={on} tone={got.rank === 1 ? 'mint' : undefined} label={`${name} · CP ${count(cap)}`} value={`#${count(got.rank)}`}
    note={`${num(got.percent, 1)}% · Lv.${num(got.level)} · CP ${count(got.cp)}`} caption={`1위는 ${got.best.ivs.join('/')} · 전체 ${count(got.total)} 조합`} />;
}

/** '어디에 쓸까' 한 줄 — 상한이 있는 세 리그 중 순위가 가장 앞선 곳 */
function Verdict({ form, cpms, floor, ivs }: { form: DexForm; cpms: readonly number[]; floor: number; ivs: [number, number, number] }) {
  const scored = IVRANK_LEAGUES
    .filter(([, cap]) => cap != null)
    .map(([league, cap]) => ({ league, got: ivRankOf(form, cpms, cap, floor, ivs) }))
    .filter((one): one is { league: LeagueKey; got: NonNullable<ReturnType<typeof ivRankOf>> } => one.got != null)
    .sort((left, right) => left.got.rank - right.got.rank || right.got.percent - left.got.percent);
  const best = scored[0];
  if (!best) return <p className="px-body pxt-verdict"><b>참가 가능한 리그가 없어요</b> 레벨 1의 CP가 각 리그의 상한을 초과해요.</p>;
  return (
    <p className="px-body pxt-verdict">
      <b>{`${LEAGUE_KO[best.league]}리그에서 개체값 순위가 가장 높아요`}</b>
      {` — ${count(TOTAL)} 조합 중 ${count(best.got.rank)}위 (1위의 ${num(best.got.percent, 1)}%).`}
    </p>
  );
}

/**
 * 상위 개체값 열 줄 — '그럼 뭘 노려야 하나' 에 답한다.
 * 리그는 화면 맨 위 탭 하나가 정한다 (v2.66.0) — 같은 화면에 리그를 고르는 컨트롤이
 * 둘이면 위에서 '슈퍼' 를 골라도 아래는 '리틀' 이 된다.
 */
function TopTable({ form, cpms, floor, ivs, league }: {
  form: DexForm; cpms: readonly number[]; floor: number; ivs: [number, number, number]; league: LeagueKey;
}) {
  const cap = IVRANK_LEAGUES.find(([id]) => id === league)?.[1] ?? null;
  const mineKey = ivs.join('/');
  const head = <SecHead title={`${LEAGUE_KO[league] ?? league}리그 TOP 10 개체값`} note={cap == null ? '상한 없음' : `공격 / 방어 / HP · CP ${count(cap)} · 전체 ${count(TOTAL)} 조합`} />;
  if (cap == null) {
    return (
      <section className="pxt-sec" aria-label="상위 개체값">{head}
        <p className="px-body px-muted">마스터리그는 CP 상한이 없어요 — 개체값이 높을수록 좋아서 순위를 매기지 않아요.</p>
      </section>
    );
  }
  const rows = ivRankTable(form, cpms, cap, floor).slice(0, 10);
  const best = rows[0]?.product ?? 0;
  return (
    <section className="pxt-sec" aria-label="상위 개체값">{head}
      {rows.length ? (
        <DataTable className="pxt-table--iv"
          columns={[{ key: 'rank', label: '순위' }, { key: 'iv', label: 'IV' }, { key: 'pct', label: '최고 대비', num: true }, { key: 'lv', label: '레벨', num: true }, { key: 'cp', label: 'CP', num: true }, { key: 'a', label: '공격', num: true }, { key: 'd', label: '방어', num: true }, { key: 'h', label: 'HP', num: true }]}
          rows={rows.map((row, index) => ({
            key: row.ivs.join('/'), mine: row.ivs.join('/') === mineKey,
            cells: { rank: <span className="px-mono">{`#${count(index + 1)}`}</span>, iv: <b className="px-mono">{row.ivs.join(' / ')}</b>, pct: percent(row.product, best), lv: num(row.level), cp: count(row.cp), a: num(row.ivs[0]), d: num(row.ivs[1]), h: num(row.ivs[2]) },
          }))} />
      ) : <p className="px-body px-muted">레벨 1의 CP가 리그 상한을 초과해 참가할 수 없어요.</p>}
    </section>
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
  // 지금 치고 있는 칸 — [칸, 글자]. 들어가면 비우고, 나가면 저장된 값으로 돌아간다
  const [draft, setDraft] = useState<[number, string] | null>(null);
  const [term, setTerm] = useState('');

  useEffect(() => { track('ivrank_view'); }, []);

  const cpms = dex.DEX_DATA.cpms;
  const save = (next: Picked) => { savePicked(next); setPicked(next); };
  const setIv = (index: number, value: number) => {
    const ivs = [...picked.ivs] as [number, number, number];
    ivs[index] = Math.max(0, Math.min(15, value));
    save({ ...picked, ivs });
  };

  // 미구현 폼도 뺀다 — 여기서 고르는 것은 **내가 실제로 가진 개체**다 (v3.61.2)
  const hits = useMemo(() => {
    const query = term.trim();
    if (!query) return [];
    const pool = searchVisible(buildSearchIndex(dex, max, pve, pvp))
      // 맥스 분류(다이맥스 · 거다이맥스 · 맥스 참가)는 PvP 개체값 찾기의 대상이 아니다 (Codex, PR #325)
      .filter((entry) => !/^(다이맥스|거다이맥스|맥스 참가) /.test(entry.name));
    return monSearch(pool, query, 8);
  }, [term, dex, max, pve, pvp]);

  const dexNo = picked.sprite == null ? null : (dex.DEX_DATA.dex[String(picked.sprite)] ?? (picked.sprite < 10000 ? picked.sprite : null));
  const pickedForm = picked.sprite == null ? null : (dex.DEX_DATA.forms[String(picked.sprite)] ?? null);
  const outForm = picked.sprite == null ? null
    : (dex.DEX_DATA.forms[String(picked.sprite)] ?? (dexNo != null ? dex.DEX_DATA.forms[String(dexNo)] : undefined) ?? null);
  const ko = (type: string) => dex.TYPE_KO[type] ?? type;

  return (
    <div className="pxt pxt-iv" id="page-ivrank" data-route="ivrank">
      <Slot name="headActions">
        {/* 켜 둔 도구가 그 줄의 제목 노릇을 한다 — 그래서 맨 앞이다 (v2.67.0 의 규칙) */}
        <ToolBtn label="🧬 개체값 순위" on onClick={() => { track('tool_ivrank', { on: 0 }); go('/pvp'); }} />
        <ToolBtn label="🃏 덱 짜기" onClick={() => { track('tool_pvpdeck', { on: 1 }); go('/pvp/deck'); }} />
      </Slot>

      {/* 리그 — TOP 10 표와 리그 타일의 '켜짐' 이 이 값을 본다 */}
      <div className="pxt-leagues"><PxTabs label="리그" items={LEAGUES.map((one) => ({ id: one.id, label: one.name }))} value={league} onPick={(id) => set('league', id as LeagueKey)} /></div>

      <div className="pxt-iv__split">
        {/* 왼쪽 — 무엇을 넣나 */}
        <div className="pxt-iv__form">
          <section className="px-panel px-skin px-drop pxt-pick" aria-labelledby="iv-pick-title">
            <SecHead id="iv-pick-title" title="포켓몬 선택" />
            {picked.sprite != null ? (
              <PickedCard sprite={picked.sprite} name={word(dex.DEX_DATA.names[String(dexNo ?? picked.sprite)] ?? String(picked.sprite))}
                lines={[pickedForm ? (pickedForm.types ?? []).map(ko).join(' · ') : '', pickedForm ? `종족값 공격 ${num(pickedForm.atk)} · 방어 ${num(pickedForm.def)} · 체력 ${num(pickedForm.hp)}` : '폼 데이터 없음']}
                clearLabel="다른 종 고르기" onClear={() => { setTerm(''); save({ ...picked, sprite: null }); }} />
            ) : null}
            <SearchBox value={term} placeholder={picked.sprite != null ? '다른 포켓몬 찾기' : '종 이름 검색 (예: 레지스틸, 앱솔)'} label="포켓몬 검색" onChange={setTerm} />
            {term.trim() ? (hits.length ? (
              <CandList label="검색 결과">
                {hits.map((hit) => (
                  <CandRow key={hit.name} sprite={hit.sprite} name={word(hit.name)}
                    badge={hit.unrel ? <span className="px-badge px-skin px-badge--ko px-badge--muted">미구현</span> : null}
                    lines={[hit.types.map(ko).join(' · ')]}
                    ops={<button type="button" className="px-btn px-btn--sm px-skin"
                      onClick={() => { trackSearchPick(hit.name, 'iv_rank'); setTerm(''); save({ ...picked, sprite: hit.sprite }); }}>선택</button>} />
                ))}
              </CandList>
            ) : <p className="px-body px-muted">검색 결과가 없어요</p>) : null}
          </section>

          <section className="px-panel px-skin px-drop pxt-ivs" aria-labelledby="iv-input-title">
            <SecHead id="iv-input-title" title="개체값" note="공격 · 방어 · HP · 0~15" />
            <div className="pxt-ivs__grid">
              {IV_LABELS.map((label, index) => (
                /* 칸에 들어가면 비운다 — 0 뒤에 15 를 치면 015 가 되던 것(제보). 비운 채 나가면 원래 값이 돌아온다 */
                <Stepper key={label} label={label} value={picked.ivs[index] ?? 0} min={0} max={15}
                  draft={draft?.[0] === index ? draft[1] : null}
                  onStep={(next) => setIv(index, next)}
                  onFocus={() => setDraft([index, ''])} onBlur={() => setDraft(null)}
                  onType={(raw) => { setDraft([index, raw]); if (raw !== '') setIv(index, Number(raw) || 0); }} />
              ))}
            </div>
            <div className="px-chips" role="group" aria-label="개체값 보정">
              {/* 정화 — 섀도우를 정화하면 세 칸이 2씩 오른다(15 까지). 하한 칩(획득 경로)과 다른 일이라 따로 둔다 (2026-09-29 제보) */}
              <button type="button" className="px-chip px-skin" title="섀도우를 정화하면 공격 · 방어 · 체력이 2씩 올라요 (최대 15)"
                onClick={() => { track('ivrank_purify', {}); save({ ...picked, ivs: purifyIvs(picked.ivs) }); }}>정화 +2</button>
            </div>
            <Field label="획득 경로 · 하한이 달라 순위도 달라져요">
              <PxChips label="획득 경로" items={IVRANK_FLOORS.map(([label, value]) => ({ id: String(value), label: `${label} ${num(value)}↑` }))} value={String(picked.floor)}
                onPick={(id) => {
                  const value = Number(id);
                  // 하한보다 낮은 칸은 하한으로 끌어올린다 — 있을 수 없는 조합을 물어보지 않게
                  save({ ...picked, floor: value, ivs: picked.ivs.map((iv) => Math.max(iv, value)) as [number, number, number] });
                }} />
            </Field>
            {/* v3 는 이 문단을 조각 넷으로 붙인다 — 사전이 줄 단위로 찾으므로 붙이는 자리도 같아야 한다 */}
            <p className="px-caption">
              {'실험 기능이에요. '}
              <b>CP 상한이 있는 리그에서는 공격 개체값이 낮은 조합</b>
              {'이 유리할 수 있어요. 같은 CP 상한 안에서 레벨을 더 높일 수 있기 때문이에요. '}
              {'최적 개체값은 포켓몬과 리그에 따라 달라요.'}
            </p>
          </section>
        </div>

        {/* 오른쪽 — 그래서 몇 위인가 */}
        <div className="pxt-iv__out">
          {picked.sprite == null ? (
            <Note title="포켓몬을 먼저 골라 주세요">포켓몬을 선택하면 리그별 개체값 순위와 노려 볼 상위 조합을 확인할 수 있어요.</Note>
          ) : !outForm ? (
            <Note title="종족값 정보가 아직 없어요">이 포켓몬의 종족값이 자료에 들어오면 순위를 계산할 수 있어요.</Note>
          ) : (
            <>
              {/* 네 장의 리그 타일은 남긴다 — '이 개체가 어느 리그용인가' 는 리그를 고르기 전에 답해야 하는 질문이다 */}
              <div className="px-grid pxt-iv__tiles">
                {IVRANK_LEAGUES.map(([one, cap]) => (
                  <LeagueTile key={one} form={outForm} cpms={cpms} league={one} cap={cap}
                    floor={picked.floor} ivs={picked.ivs} on={one === league} />
                ))}
              </div>
              <Verdict form={outForm} cpms={cpms} floor={picked.floor} ivs={picked.ivs} />
              <TopTable form={outForm} cpms={cpms} floor={picked.floor} ivs={picked.ivs} league={league} />
            </>
          )}
        </div>
      </div>

      {/* v3 는 이 각주를 네 문장으로 나눠 붙인다 — 사전이 줄 단위로 찾으므로 한 덩이로 합치면 못 옮긴다 */}
      <p className="px-caption pxt-foot">
        {'순위는 CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력(스탯 곱)으로 매겨요. '}
        {'체력의 소수점 이하를 버리는 게임 규칙을 반영하며, 도감과 동일한 종족값·레벨별 배율을 사용해요. '}
        {'베스트 버디의 레벨 보너스(+1)는 계산에서 제외해요. '}
        {'마스터리그는 CP 상한이 없어 개체값이 높을수록 좋아요(순위를 매기지 않아요).'}
      </p>
    </div>
  );
}
