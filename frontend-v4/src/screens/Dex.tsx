// ─────────────────────────────────────────────────────────────────────────────
// screens/Dex.tsx — 포켓몬 도감
//
// 상태가 가장 복잡한 화면이라 먼저 옮겼다 (검색어 · 타입 필터 · 보기 방식).
// v3 에서는 셋이 전역 `state` 와 모듈 지역 변수에 섞여 있었고 고칠 때마다 `render()` 를 손으로 불렀다.
// 여기서는 셋 다 이 컴포넌트의 지역 상태다 — **화면 밖에서 아무도 안 보는 값**이라서다.
// 다만 보기 방식(그리드/리스트)만은 기기에 남으므로 스토어로 뺀다 (`pogo_dex_cols`).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useDex, useUsage } from '../lib/data';
import { usePrefStore, readCols } from '../stores/pref';
import { TypeDot, Sprite, ViewToggle } from '../components/Bits';
import { Slot } from '../components/Slots';
import { track } from '../lib/track';

// v3 pages.js DEX_GENS — 도감번호 구간으로 세대를 정한다
const DEX_GENS: [number, number][] = [
  [1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025],
];

// 한 번에 100종씩 — 1025종을 한 번에 세우면 휴대폰에서 첫 화면이 3만 픽셀이 된다 (v3 와 같은 쪽수)
const DEX_PAGE = 100;

function cpOf(atk: number, def: number, hp: number, cpm: number): number {
  return Math.max(10, Math.floor(((atk + 15) * Math.sqrt(def + 15) * Math.sqrt(hp + 15) * cpm * cpm) / 10));
}

/**
 * 이 포켓몬이 어디서 쓰이는가 — [PvP 63] [PvE 31] 두 알약 (v3 dexUseNode, v3.24.0).
 * 검색해서 들어온 사람의 첫 물음이 "이거 PvP 용이야 레이드 용이야" 인데
 * 줄에는 세대·CP 만 있었다. 높은 쪽이 진하다(.is-lead).
 */
function DexUse({ name }: { name: string }) {
  const { data } = useUsage();
  const meter = data.METER[name];
  if (!meter) return null;
  const [pve, pvp] = meter;
  if (!pve && !pvp) return null;
  const lead = pvp === pve ? '' : pvp > pve ? 'pvp' : 'pve';
  // 값은 <b> 가 아니라 <span> — CSS·회귀가 '.dex__row b' 를 "이름" 으로 읽는다
  const pill = (key: string, label: string, value: number) => (
    <span key={key} className={`dex__use-pill${lead === key ? ' is-lead' : ''}${value ? '' : ' is-none'}`}>
      <em>{label}</em><span className="dex__use-val">{value ? String(value) : '-'}</span>
    </span>
  );
  return (
    <span className="dex__use" title="PvP 는 리그 점수 상위 2개 평균, PvE 는 가장 잘 통하는 보스 3종 대비 비율 평균 (0~100, 가성비 화면과 같은 기준)">
      {pill('pvp', 'PvP', pvp)}{pill('pve', 'PvE', pve)}
    </span>
  );
}

export default function Dex({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
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

  // 출시된 종만, 도감번호 순. v3 는 DEX_DATA.rel 을 같은 뜻으로 쓴다
  const rows = useMemo(() => {
    const names = data.DEX_DATA.names;
    const forms = data.DEX_DATA.forms;
    const needle = term.trim().toLowerCase();
    return data.DEX_DATA.rel
      .map((dex) => ({ dex, name: names[String(dex)] ?? `#${dex}`, form: forms[String(dex)] }))
      .filter((row) => {
        if (!row.form) return false;
        if (gen) { const span = DEX_GENS[gen - 1]; if (!span || row.dex < span[0] || row.dex > span[1]) return false; }
        if (mega && !data.DEX_DATA.megas[String(row.dex)]?.length) return false;
        if (types.length && !types.every((type) => row.form!.types.includes(type))) return false;
        if (!needle) return true;
        const en = (data.DEX_DATA.en[String(row.dex)] ?? '').toLowerCase();
        return row.name.toLowerCase().includes(needle) || en.includes(needle) || String(row.dex) === needle;
      });
  }, [data, term, types, gen, mega]);

  const toggleType = (type: string) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((one) => one !== type) : [...prev, type].slice(-2)));
    track('dex_filter', { type });
  };

  return (
    <div id="page-dex" className="page__body dex-page" data-route="dex">
      {/* 보기 전환은 본문이 아니라 **화면 머리 오른쪽**에 선다 — 도감·레이드·순위표가 같은 자리다.
          본문 꼬리에 뒀더니 목록을 다 내려야 보여, 있으나 마나 한 버튼이 됐다 */}
      <Slot name="headActions">
        <ViewToggle view={saved} onToggle={() => setCols('dex', saved === 'grid' ? 'list' : 'grid')}
          extraClass="dex__layout" />
      </Slot>
      {/* 세대·메가 칩 줄. v3 는 이 줄을 .screen-tabs 로 부른다 — 검색창 위 제 줄에 선다 */}
      <div className="screen-tabs dex__toolbar">
        <div className="tchips">
          {DEX_GENS.map((_, index) => (
            <button key={index} className="uchip" aria-pressed={gen === index + 1}
              onClick={() => { setGen(gen === index + 1 ? 0 : index + 1); setShown(DEX_PAGE); }}>
              {index + 1}세대
            </button>
          ))}
          <button className="uchip" aria-pressed={mega} title="메가진화 또는 원시회귀가 있는 종만 보기"
            onClick={() => { setMega(!mega); setShown(DEX_PAGE); }}>⚡ 메가·원시</button>
        </div>
      </div>

      <input
        id="dex-search"
        className="boss__search dex__search"
        type="search"
        placeholder="이름 · 영문명 · 도감번호로 찾기"
        value={term}
        onChange={(event) => { setTerm(event.target.value); setShown(DEX_PAGE); }}
      />

      <details className="filter-box dex__type-box">
        <summary>타입으로 좁히기{types.length ? ` (${types.length})` : ''}</summary>
        <div className="chips dex__types-filter">
          {Object.keys(data.DEX_DATA.chart).map((type) => (
            <button
              key={type}
              type="button"
              className="chips__item"
              aria-pressed={types.includes(type)}
              onClick={() => { toggleType(type); setShown(DEX_PAGE); }}
            >
              <span className="dot" style={{ ['--c' as string]: `var(--t-${type})` }} />
              {data.TYPE_KO[type] ?? type}
            </button>
          ))}
        </div>
      </details>

      <div className="dex__found" hidden={!term && !types.length && !gen && !mega}>
        <b>{rows.length.toLocaleString()}종</b>
        <button className="uchip dex__found-clear"
          onClick={() => { setTerm(''); setTypes([]); setGen(0); setMega(false); setShown(DEX_PAGE); }}>지우기</button>
      </div>

      <div className={`dex__list dex-catalog${saved === 'grid' ? ' is-grid' : ''}`}>
        {rows.slice(0, shown).map((row) => {
            const form = row.form!;
            const gen = DEX_GENS.findIndex(([from, to]) => row.dex >= from && row.dex <= to);
            return (
              <button key={row.dex} className="dex__row" data-sprite={row.dex} onClick={() => onOpen(row.dex)}>
                <span className="dex__no">#{String(row.dex).padStart(4, '0')}</span>
                <Sprite id={row.dex} />
                {/* 메가 딱지는 그림 **바로 뒤**, 이름 앞에 선다 — 이름 안에 넣었더니 이름 줄이 밀렸다 */}
                {data.DEX_DATA.megas[String(row.dex)]?.length
                  ? <span className="tag dex__mega" title="메가진화 가능">메가</span>
                  : null}
                <span className="dex__name"><b>{row.name}</b><DexUse name={row.name} /></span>
                <span className="dex__stats">
                  {gen >= 0 ? <span className="dex__stat dex__stat--gen"><em>세대</em><b>{gen + 1}</b></span> : null}
                  <span className="dex__stat dex__stat--cp">
                    <em>CP 100%</em><b>{cpOf(form.atk, form.def, form.hp, cpm).toLocaleString()}</b>
                  </span>
                </span>
                <span className="dex__types">
                  {form.types.map((type) => <TypeDot key={type} type={type} />)}
                </span>
              </button>
            );
        })}
      </div>

      <p className="dex__hint" hidden={rows.length > 0}>찾는 포켓몬이 없어요. 이름 일부만 넣어 보세요.</p>
      {rows.length > shown
        ? (
          <button className="boss__more" onClick={() => setShown(shown + DEX_PAGE)}>
            더보기 ({shown}/{rows.length})
          </button>
        )
        : null}
      <p className="detail__foot">
        미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분).
        ⚡ 메가 · 원시 딱지는 그 종에 메가진화나 원시회귀가 있다는 뜻이에요 — 줄을 누르면 진화 칸에서 그 폼의 능력치를 볼 수 있어요.
        섀도우·리전 폼은 🔍 검색으로 찾으면 이 목록에 함께 나와요.
      </p>

    </div>
  );
}
