// ─────────────────────────────────────────────────────────────────────────────
// screens/Dex.tsx — 포켓몬 도감
//
// 상태가 가장 복잡한 화면이라 먼저 옮겼다 (검색어 · 타입 필터 · 보기 방식).
// v3 에서는 셋이 전역 `state` 와 모듈 지역 변수에 섞여 있었고 고칠 때마다 `render()` 를 손으로 불렀다.
// 여기서는 셋 다 이 컴포넌트의 지역 상태다 — **화면 밖에서 아무도 안 보는 값**이라서다.
// 다만 보기 방식(그리드/리스트)만은 기기에 남으므로 스토어로 뺀다 (`pogo_dex_cols`).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from 'react';
import { useDex, useUsage } from '../lib/data';
import { usePrefStore, readCols } from '../stores/pref';
import { PxChips, PxViewSwitch, type ChipDef } from '../components/Bits';
import { PixelIcon } from '../components/PixelIcon';
import MonCard from '../components/MonCard';
import { RankList, RankRow } from '../components/Row';
import { track, trackSearchPick } from '../lib/track';
import { num } from '../lib/cell';
import type { OpenMon } from '../lib/mon';

// v3 pages.js DEX_GENS — 도감번호 구간으로 세대를 정한다
const DEX_GENS: [number, number][] = [
  [1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025],
];

// 도감 전체 종 수 — 구역 제목의 '전체 1,025종' 은 이름표 수를 센 값이다 (지어내지 않는다)

// 한 번에 100종씩 — 1025종을 한 번에 세우면 휴대폰에서 첫 화면이 3만 픽셀이 된다 (v3 와 같은 쪽수)
const DEX_PAGE = 100;

function cpOf(atk: number, def: number, hp: number, cpm: number): number {
  return Math.max(10, Math.floor(((atk + 15) * Math.sqrt(def + 15) * Math.sqrt(hp + 15) * cpm * cpm) / 10));
}

/**
 * 이 포켓몬이 어디서 쓰이는가 — PvP 63 · PvE 31 (v3 dexUseNode, v3.24.0).
 * 검색해서 들어온 사람의 첫 물음이 "이거 PvP 용이야 레이드 용이야" 인데
 * 줄에는 세대·CP 만 있었다. 높은 쪽이 진하다(is-lead).
 * v6 — 카드는 메타 한 줄의 글자로, 목록 줄은 배지로 받는다 (같은 값, 자리만 다르다)
 */
const USE_TITLE = 'PvP 는 리그 점수 상위 2개 평균, PvE 는 가장 잘 통하는 보스 3종 대비 비율 평균 (0~100, 가성비 화면과 같은 기준)';

function useMeter(name: string): { pve: number; pvp: number; lead: '' | 'pvp' | 'pve' } | null {
  const { data } = useUsage();
  const meter = data.METER[name];
  if (!meter) return null;
  const [pve, pvp] = meter;
  if (!pve && !pvp) return null;
  return { pve, pvp, lead: pvp === pve ? '' : pvp > pve ? 'pvp' : 'pve' };
}

function DexUse({ name, as }: { name: string; as: 'text' | 'badge' }) {
  const meter = useMeter(name);
  if (!meter) return null;
  if (as === 'text') {
    return <span className="dex__use" title={USE_TITLE}>{`PvP ${meter.pvp ? num(meter.pvp) : '—'} · PvE ${meter.pve ? num(meter.pve) : '—'}`}</span>;
  }
  const pill = (key: 'pvp' | 'pve', label: string, value: number) => (
    <span key={key} className={`px-badge px-skin px-badge--ko ${meter.lead === key ? 'px-badge--mint' : 'px-badge--muted'}`}>
      {`${label} ${value ? num(value) : '—'}`}
    </span>
  );
  return <span className="dex__use" title={USE_TITLE}>{pill('pvp', 'PvP', meter.pvp)}{pill('pve', 'PvE', meter.pve)}</span>;
}

/**
 * 도감 줄의 메가·원시 딱지 (v3 dexMegaTag).
 * 라벨은 게임마스터가 준 그대로 — '메가' · '메가X' · '메가Y' · '원시'.
 * X·Y 둘 다 있으면 '메가 X·Y' 한 칸으로 접는다 (딱지 둘이 이름을 밀어낸다).
 * 원시회귀는 메가와 다른 것이라 글자도 색도 따로 간다.
 * 아직 안 나온 메가도 딱지를 단다 — 대신 흐리게 하고 말풍선에 그 사실을 적는다.
 * 출시분과 미출시분이 섞인 종은 **출시분만** 딱지 글자로 삼는다.
 */
function MegaTag({ megas }: { megas?: { sprite: number; label: string; rel?: boolean }[] }) {
  const entries = megas ?? [];
  if (!entries.length) return null;
  const released = entries.filter((entry) => entry.rel !== false);
  const shown = released.length ? released : entries;
  const labels = shown.map((entry) => entry.label);
  const primal = labels.includes('원시');
  const text = primal ? '원시'
    : labels.length > 1 ? `메가 ${labels.map((label) => label.replace('메가', '')).join('·')}`
      : '메가';
  const unrel = !released.length;
  const title = unrel
    ? (primal ? '원시회귀 데이터는 있지만 아직 미구현' : '메가진화 데이터는 있지만 아직 미구현')
    : primal ? '원시회귀 가능' : '메가진화 가능';
  return <span className={`px-badge px-skin px-badge--ko ${primal ? 'px-badge--orange' : 'px-badge--purple'}${unrel ? ' is-unreleased' : ''}`} title={title}>{text}</span>;
}

export default function Dex({ onOpen }: { onOpen: OpenMon }) {
  const { data } = useDex();
  const [term, setTerm] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [gen, setGen] = useState(0);        // 0 이면 전 세대
  const [mega, setMega] = useState(false);  // ⚡ 메가·원시가 있는 종만
  const [shown, setShown] = useState(DEX_PAGE);
  const saved = usePrefStore((s) => s.cols['dex']) ?? readCols('dex');
  const setCols = usePrefStore((s) => s.setCols);

  // v3 는 만렙(l50) 기준으로 'CP 100%' 를 적는다 — l40 을 쓰면 숫자가 통째로 어긋난다
  const cpm = data.DEX_DATA.cpm['l50'] ?? 0.84;
  const total = Object.keys(data.DEX_DATA.names).length;

  /**
   * 도감 이름표에 있는 **모든 종**, 도감번호 순.
   * `DEX_DATA.rel` 은 거르는 조건이 아니라 **딱지**다 (v3 dexEntries) — 아직 안 나온 종을 목록에서
   * 빼면 '없는 종' 과 '아직 안 나온 종' 이 화면에서 같아 보인다. 오거폰처럼 60종이 조용히 사라져 있었다.
   */
  const rows = useMemo(() => {
    const names = data.DEX_DATA.names;
    const forms = data.DEX_DATA.forms;
    const rel = new Set(data.DEX_DATA.rel ?? []);
    const needle = term.trim().toLowerCase();
    return Object.keys(names).map(Number).sort((a, b) => a - b)
      .map((dex) => ({ dex, name: names[String(dex)] ?? `#${dex}`, form: forms[String(dex)], unrel: rel.size > 0 && !rel.has(dex) }))
      .filter((row) => {
        if (gen) { const span = DEX_GENS[gen - 1]; if (!span || row.dex < span[0] || row.dex > span[1]) return false; }
        if (mega && !data.DEX_DATA.megas[String(row.dex)]?.length) return false;
        if (types.length && !types.every((type) => (row.form?.types ?? []).includes(type))) return false;
        if (!needle) return true;
        const en = (data.DEX_DATA.en[String(row.dex)] ?? '').toLowerCase();
        return row.name.toLowerCase().includes(needle) || en.includes(needle) || String(row.dex) === needle;
      });
  }, [data, term, types, gen, mega]);

  // 타입은 최대 둘 — 셋째를 누르면 가장 오래된 것이 빠진다 (v3 와 같다). '전체' 는 비운다
  const toggleType = (type: string) => {
    if (type === 'all') { setTypes([]); return; }
    setTypes((prev) => (prev.includes(type) ? prev.filter((one) => one !== type) : [...prev, type].slice(-2)));
    track('dex_filter', { type });
  };
  const filtered = !!(term || types.length || gen || mega);
  const clear = () => { setTerm(''); setTypes([]); setGen(0); setMega(false); setShown(DEX_PAGE); };

  // 세대 칩 — '전체' · 1~9세대 · '메가·원시'. 전체는 세대도 메가도 고르지 않은 상태다
  const genChips: ChipDef[] = [{ id: 'all', label: '전체' },
    ...DEX_GENS.map((_, index) => ({ id: String(index + 1), label: `${index + 1}세대` })),
    { id: 'mega', label: '메가·원시' }];
  const genOn = mega ? ['mega'] : gen ? [String(gen)] : ['all'];
  const typeChips: ChipDef[] = [{ id: 'all', label: '전체' },
    ...Object.keys(data.DEX_DATA.chart).map((type) => ({ id: type, label: data.TYPE_KO[type] ?? type, type }))];
  const typeOn = types.length ? types : ['all'];

  return (
    <div id="page-dex" className="page__body dex-page rk-page" data-route="dex">
      {/* 검색 + 카드/목록 전환이 한 줄 — 보기 전환은 옛 화면 머리 자리에서 검색 옆으로 왔다 (피그마 07) */}
      <div className="dx-search">
        <label className="px-input px-skin dx-search__box">
          <PixelIcon name="search" />
          <input
            id="dex-search"
            className="dex__search"
            type="search"
            placeholder="한국어 · English · 도감 번호로 검색"
            aria-label="포켓몬 검색"
            value={term}
            onChange={(event) => { setTerm(event.target.value); setShown(DEX_PAGE); }}
          />
        </label>
        <PxViewSwitch view={saved} onPick={(next) => setCols('dex', next)} />
      </div>

      <div className="dx-filters">
        <PxChips label="세대" items={genChips} pressed={genOn} onPick={(id) => {
          if (id === 'all') { setGen(0); setMega(false); }
          else if (id === 'mega') { setMega(!mega); }
          else { setGen(gen === Number(id) ? 0 : Number(id)); }
          setShown(DEX_PAGE);
        }} />
        <PxChips label="타입" items={typeChips} pressed={typeOn} onPick={(id) => { toggleType(id); setShown(DEX_PAGE); }} />
        <p className="px-caption dx-filters__hint">타입은 최대 2개까지 선택할 수 있어요</p>
      </div>

      <div className="px-sec rk-head">
        <h2 className="px-heading rk-head__title">도감 탐색</h2>
        <span className="px-sec__note">
          {`전체 ${total.toLocaleString('ko-KR')}종`}{filtered ? ` · 현재 필터 ${rows.length.toLocaleString('ko-KR')}종` : ''}
        </span>
        {filtered ? <button type="button" className="px-btn px-btn--sm px-skin dex__found-clear" onClick={clear}>지우기</button> : null}
      </div>

      <RankList view={saved}>
        {rows.slice(0, shown).map((row) => {
          // 종족값이 아직 없는 종도 목록에는 선다 — 빈 칸으로 그릴 뿐 빼지 않는다 (v3 와 같다)
          const form = row.form;
          const genAt = DEX_GENS.findIndex(([from, to]) => row.dex >= from && row.dex <= to);
          const open = () => {
            if (term.trim()) trackSearchPick(row.name, 'dex');
            onOpen({ sprite: row.dex, name: row.name, types: form?.types ?? [] });
          };
          const cp = form ? cpOf(form.atk, form.def, form.hp, cpm) : null;
          const badges: ReactNode = (
            <>
              {row.unrel ? <span className="px-badge px-skin px-badge--muted px-badge--ko">미구현</span> : null}
              <MegaTag megas={data.DEX_DATA.megas[String(row.dex)]} />
            </>
          );
          if (saved === 'grid') {
            // 메타 한 줄 — 최대 CP · 세대 · 활용(PvP · PvE). 없는 값은 안 적는다 (§1)
            const meta = (
              <>
                {cp !== null ? `최대 CP ${cp.toLocaleString('ko-KR')}` : ''}
                {genAt >= 0 ? `${cp !== null ? ' · ' : ''}${genAt + 1}세대` : ''}
                <DexUseText name={row.name} />
              </>
            );
            return (
              <li key={row.dex} className={row.unrel ? 'is-unreleased' : undefined}>
                <MonCard sprite={row.dex} dex={row.dex} name={row.name} types={form?.types ?? []} meta={meta} badges={badges} from="도감" onOpen={open} />
              </li>
            );
          }
          return (
            <RankRow key={row.dex} sprite={row.dex} no={row.dex} name={row.name} types={form?.types ?? []}
              score={cp !== null ? cp.toLocaleString('ko-KR') : '—'} label="최대 CP"
              lines={genAt >= 0 ? [`${genAt + 1}세대`] : []}
              badges={<>{badges}<DexUse name={row.name} as="badge" /></>}
              unrel={row.unrel} onOpen={open} />
          );
        })}
      </RankList>

      <p className="px-body px-muted dex__hint" hidden={rows.length > 0}>검색 결과가 없어요. 이름 일부로 검색하거나 필터를 바꿔 보세요.</p>
      {rows.length > shown
        ? (
          <button type="button" className="px-btn px-btn--block px-skin rk-more" onClick={() => setShown(shown + DEX_PAGE)}>
            {`더 보기 (${shown}/${rows.length})`}
          </button>
        )
        : null}
      <p className="px-caption detail__foot">
        미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분).
        메가·원시 배지는 메가진화 또는 원시회귀가 가능한 종을 뜻해요. 포켓몬을 선택한 뒤 진화 탭에서 해당 폼의 능력치를 확인할 수 있어요.
        섀도우·리전 폼은 검색을 통해 이 목록에서 함께 확인할 수 있어요.
      </p>
    </div>
  );
}

/** 카드 메타 줄 끝의 ' · PvP 63 · PvE 31' — 값이 없으면 아무것도 안 붙인다 */
function DexUseText({ name }: { name: string }) {
  const meter = useMeter(name);
  if (!meter) return null;
  return <> · <DexUse name={name} as="text" /></>;
}
