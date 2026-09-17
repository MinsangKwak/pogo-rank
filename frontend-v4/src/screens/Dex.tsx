// ─────────────────────────────────────────────────────────────────────────────
// screens/Dex.tsx — 포켓몬 도감
//
// 상태가 가장 복잡한 화면이라 먼저 옮겼다 (검색어 · 타입 필터 · 보기 방식).
// v3 에서는 셋이 전역 `state` 와 모듈 지역 변수에 섞여 있었고 고칠 때마다 `render()` 를 손으로 불렀다.
// 여기서는 셋 다 이 컴포넌트의 지역 상태다 — **화면 밖에서 아무도 안 보는 값**이라서다.
// 다만 보기 방식(그리드/리스트)만은 기기에 남으므로 스토어로 뺀다 (`pogo_dex_cols`).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { useDex } from '../lib/data';
import { usePrefStore, readCols } from '../stores/pref';
import { Sprite, TypeDot } from '../components/Bits';
import { track } from '../lib/track';

const CP_MULT_L40 = 0.7903;   // v3 DEX_DATA.cpm.l40 과 같은 값 — 목록의 'CP 100%' 칸

function cpOf(atk: number, def: number, hp: number, cpm: number): number {
  return Math.max(10, Math.floor(((atk + 15) * Math.sqrt(def + 15) * Math.sqrt(hp + 15) * cpm * cpm) / 10));
}

export default function Dex({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data } = useDex();
  const [term, setTerm] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const saved = usePrefStore((s) => s.cols['dex']) ?? readCols('dex', 'grid');
  const setCols = usePrefStore((s) => s.setCols);

  const cpm = data.DEX_DATA.cpm['l40'] ?? CP_MULT_L40;

  // 출시된 종만, 도감번호 순. v3 는 DEX_DATA.rel 을 같은 뜻으로 쓴다
  const rows = useMemo(() => {
    const names = data.DEX_DATA.names;
    const forms = data.DEX_DATA.forms;
    const needle = term.trim().toLowerCase();
    return data.DEX_DATA.rel
      .map((dex) => ({ dex, name: names[String(dex)] ?? `#${dex}`, form: forms[String(dex)] }))
      .filter((row) => {
        if (!row.form) return false;
        if (types.length && !types.every((type) => row.form!.types.includes(type))) return false;
        if (!needle) return true;
        const en = (data.DEX_DATA.en[String(row.dex)] ?? '').toLowerCase();
        return row.name.toLowerCase().includes(needle) || en.includes(needle) || String(row.dex) === needle;
      });
  }, [data, term, types]);

  const toggleType = (type: string) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((one) => one !== type) : [...prev, type].slice(-2)));
    track('dex_filter', { type });
  };

  return (
    <div id="page-dex" className="page__body dex-page">
      <input
        id="dex-search"
        className="boss__search dex__search"
        type="search"
        placeholder="이름 · 영문명 · 도감번호로 찾기"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />

      <details className="filter-box dex__type-box">
        <summary>타입으로 좁히기{types.length ? ` (${types.length})` : ''}</summary>
        <div className="chips dex__types-filter">
          {Object.keys(data.DEX_DATA.chart).map((type) => (
            <button
              key={type}
              type="button"
              className={`chips__item${types.includes(type) ? ' is-on' : ''}`}
              aria-pressed={types.includes(type)}
              onClick={() => toggleType(type)}
            >
              {data.TYPE_KO[type] ?? type}
            </button>
          ))}
        </div>
      </details>

      <div className="dex__found" hidden={!term && !types.length}>
        <b>{rows.length.toLocaleString()}종</b>
        <button className="uchip dex__found-clear" onClick={() => { setTerm(''); setTypes([]); }}>지우기</button>
      </div>

      <div className={`dex__list dex-catalog${saved === 'grid' ? ' is-grid' : ''}`}>
        {rows.slice(0, 300).map((row) => {
          const form = row.form!;
          return (
            <button key={row.dex} className="dex__row" data-sprite={row.dex} onClick={() => onOpen(row.dex)}>
              <span className="dex__no">#{String(row.dex).padStart(4, '0')}</span>
              <Sprite id={row.dex} />
              <span className="dex__name"><b>{row.name}</b></span>
              <span className="dex__stats">
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
      <p className="detail__foot">
        {rows.length > 300 ? `앞의 300종만 보여 드려요 (전체 ${rows.length.toLocaleString()}종). 검색으로 좁혀 보세요.` : null}
      </p>

      {/* 보기 방식은 화면 머리 오른쪽에 있어야 v3 와 같지만, 미리보기에서는 여기 둔다 */}
      <button
        className="icon-btn view-toggle dex__layout"
        aria-live="polite"
        data-view={saved}
        onClick={() => setCols('dex', saved === 'grid' ? 'list' : 'grid')}
      >
        <span className="view-toggle__text">{saved === 'grid' ? '리스트로 보기' : '그리드로 보기'}</span>
      </button>
    </div>
  );
}
