// ─────────────────────────────────────────────────────────────────────────────
// screens/Finder.tsx — 🔎 검색식 만들기 (v3 components/finder.js 이식)
//
// 포켓몬 GO 안의 검색창에 그대로 붙여 넣을 **검색식 한 줄**을 만들어 준다.
// 박스가 수천 마리가 되면 "뭘 정리할지" 를 눈으로 고를 수 없다. 게임의 검색식이 그 일을 하는데
// 문법이 낯설어(`4*` · `!` · `&` · `,`) 대부분 쓰지 않는다 — 여기서는 고르면 식이 되고,
// 식을 보면서 문법을 배우게 된다.
//
// **무엇을 넣지 않았나가 이 화면의 경계다** (v3 의 판단 그대로)
//   · 게임 버전마다 되고 안 되는 문법(사탕 수 등)은 넣지 않았다. 틀린 식을 주면
//     사용자가 게임에서 빈 결과를 보고 "이 서비스가 틀렸다" 고 알게 된다.
//   · 게임이 지원하지 않는 조건(교환 상대 닉네임 등)은 아예 두지 않았다.
//     없는 것을 만들어 주는 것보다 없다고 말하지 않는 편이 낫다 — 대신 화면 아래에 적어 둔다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDex } from '../lib/data';
import { PxLabel } from '../components/PxIcon';
import { track } from '../lib/track';

// 고른 조건은 화면을 떠나도 남는다 — 검색식은 한 번 만들고 게임과 오가며 여러 번 쓴다.
// **v3 와 같은 키·같은 모양**이라 두 판을 오가도 고른 것이 그대로다
const FINDER_KEY = 'pogo_finder';

interface FinderItem { id: string; q: string; why: string }

// 조건 한 칸: id 는 저장 키, q 는 그대로 식에 들어갈 조각, why 는 "이게 뭘 거르나"
const FINDER_GROUPS: { id: string; label: string; items: FinderItem[] }[] = [
  { id: 'basic', label: '기본', items: [
    { id: 'iv4', q: '4*', why: '개체값 100% (네 별)' },
    { id: 'iv3', q: '3*', why: '개체값 82~98% (세 별)' },
    { id: 'shiny', q: 'shiny', why: '색이 다른 모습' },
    { id: 'lucky', q: 'lucky', why: '행운' },
    { id: 'shadow', q: 'shadow', why: '그림자' },
    { id: 'purified', q: 'purified', why: '정화됨' },
    { id: 'fav', q: 'favorite', why: '즐겨찾기로 표시한 것' },
    { id: 'costume', q: 'costume', why: '의상 입은 개체' },
  ] },
  { id: 'kind', label: '분류', items: [
    { id: 'legendary', q: 'legendary', why: '전설' },
    { id: 'mythical', q: 'mythical', why: '환상' },
    { id: 'ultra', q: 'ultrabeast', why: '울트라비스트' },
    { id: 'mega', q: 'mega', why: '메가진화 가능' },
    { id: 'evolve', q: 'evolve', why: '지금 진화할 수 있는 것' },
    { id: 'item', q: 'item', why: '진화에 도구가 필요한 것' },
    { id: 'defender', q: 'defender', why: '체육관에 넣어 둔 것' },
  ] },
  { id: 'trade', label: '교환·정리', items: [
    { id: 'tradable', q: 'tradable', why: '교환할 수 있는 것' },
    { id: 'traded', q: 'traded', why: '교환으로 받은 것' },
    { id: 'hatched', q: 'hatched', why: '알에서 깬 것' },
    { id: 'raid', q: 'raid', why: '레이드에서 잡은 것' },
    { id: 'research', q: 'research', why: '리서치 보상' },
    { id: 'gbl', q: 'gbl', why: 'GO 배틀리그 보상' },
  ] },
];

// 자주 쓰는 묶음 — 처음 여는 사람이 "이런 걸 할 수 있구나" 를 한눈에 보게 한다
const FINDER_PRESETS = [
  { id: 'box', label: '🧹 박스 정리', why: '교환할 수 있고, 즐겨찾기·그림자·전설이 아닌 것',
    on: ['tradable'], off: ['fav', 'shadow', 'legendary', 'mythical'] },
  { id: 'raise', label: '🌱 육성 후보', why: '개체값이 높고 지금 진화할 수 있는 것',
    on: ['iv4', 'evolve'], off: [] },
  { id: 'trade', label: '🤝 교환용', why: '교환할 수 있고 아직 행운이 아닌 것',
    on: ['tradable'], off: ['lucky', 'fav'] },
];

type Sign = 'on' | 'off';
interface Picked { flags: Record<string, Sign>; types: string[]; cpMin: string; cpMax: string; name: string }
const EMPTY: Picked = { flags: {}, types: [], cpMin: '', cpMax: '', name: '' };

const ALL_ITEMS = FINDER_GROUPS.flatMap((group) => group.items);

/**
 * 고른 것들을 게임 문법으로 잇는다.
 * 같은 줄의 조건은 `&`(그리고), 빼는 조건은 앞에 `!`.
 * **타입만 한 덩이로 `,`(또는)** — 여러 개를 `&` 로 이으면 "둘 다인 것" 이 되어 거의 안 걸린다.
 */
export function finderQuery(picked: Picked): string {
  const parts: string[] = [];
  for (const [id, sign] of Object.entries(picked.flags)) {
    const item = ALL_ITEMS.find((one) => one.id === id);
    if (!item || !sign) continue;
    parts.push(sign === 'off' ? `!${item.q}` : item.q);
  }
  if (picked.types.length) parts.push(picked.types.join(','));
  if (picked.cpMin || picked.cpMax) parts.push(`cp${picked.cpMin || ''}-${picked.cpMax || ''}`);
  if (picked.name) parts.push(picked.name.trim());
  return parts.join('&');
}

function load(): Picked {
  try {
    const saved = JSON.parse(localStorage.getItem(FINDER_KEY) ?? '{}');
    return {
      flags: saved.flags ?? {}, types: saved.types ?? [],
      cpMin: saved.cpMin ?? '', cpMax: saved.cpMax ?? '', name: saved.name ?? '',
    };
  } catch { return EMPTY; }
}

export default function Finder() {
  const { data } = useDex();
  const [picked, setPickedState] = useState<Picked>(load);
  const [copied, setCopied] = useState('');

  const setPicked = (next: Picked) => {
    setPickedState(next);
    try { localStorage.setItem(FINDER_KEY, JSON.stringify(next)); } catch { /* 저장 불가 환경 */ }
  };

  const query = finderQuery(picked);
  const count = Object.values(picked.flags).filter(Boolean).length + (picked.types.length ? 1 : 0);

  /**
   * 한 번 누르면 '포함', 다시 누르면 '제외', 또 누르면 해제 — 세 상태를 한 칸으로 돌린다.
   * 버튼을 둘로 나누면 같은 조건이 화면에 두 번 나와 어느 쪽이 켜졌는지 헷갈린다
   */
  const cycle = (id: string) => {
    const flags = { ...picked.flags };
    const now = flags[id];
    if (now === 'on') flags[id] = 'off';
    else if (now === 'off') delete flags[id];
    else flags[id] = 'on';
    track('finder_flag', { id });
    setPicked({ ...picked, flags });
  };

  const copy = async () => {
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      setCopied('복사됨 ✓');
    } catch {
      // 클립보드가 막힌 환경(비보안 출처 등) — 사용자가 직접 고르게 안내한다
      setCopied('길게 눌러 복사');
    }
    track('finder_copy', { len: query.length });
    setTimeout(() => setCopied(''), 1600);
  };

  const numberBox = (key: 'cpMin' | 'cpMax', label: string) => (
    <input className="finder__num" type="number" min="0" inputMode="numeric" placeholder={label} aria-label={label}
      value={picked[key]}
      onChange={(event) => setPicked({ ...picked, [key]: event.target.value.replace(/\D/g, '') })} />
  );

  return (
    <div className="page__body finder" id="page-finder" data-route="finder">
      <p className="note">
        조건을 한 번 누르면 <b>＋포함</b>, 다시 누르면 <b>－제외</b>, 또 누르면 해제돼요.
      </p>

      {/* 만들어진 식을 **맨 위에** — 조건을 고르는 내내 결과가 눈에 있어야 무엇이 달라지는지 보인다 */}
      <div className="finder__result">
        <div className="finder__result-label">READY TO SEARCH <span>포켓몬 GO 검색식</span></div>
        <code className={`finder__out${query ? '' : ' is-empty'}`}>
          {query || '(조건을 고르면 여기에 검색식이 만들어져요)'}
        </code>
        <div className="finder__actions">
          <button className="finder__copy uchip" disabled={!query} onClick={copy}>
            {copied || <PxLabel label="📋 복사" />}
          </button>
          <button className="uchip finder__clear"
            onClick={() => { track('finder_clear'); setPicked(EMPTY); }}>↺ 비우기</button>
        </div>
        <p className="finder__hint note">
          {query ? `조건 ${count}개 · 게임 검색창에 그대로 붙여 넣으세요.` : '아래에서 조건을 누르면 검색식이 만들어져요.'}
        </p>
      </div>

      <div className="row-head"><h2>자주 쓰는 묶음</h2></div>
      <div className="finder__chips finder__presets">
        {FINDER_PRESETS.map((preset) => (
          <button key={preset.id} className="uchip finder__preset" title={preset.why}
            onClick={() => {
              const flags: Record<string, Sign> = {};
              for (const id of preset.on) flags[id] = 'on';
              for (const id of preset.off) flags[id] = 'off';
              track('finder_preset', { id: preset.id });
              setPicked({ ...picked, flags });
            }}>
            <PxLabel label={preset.label} />
            <span className="finder__preset-description">{preset.why}</span>
          </button>
        ))}
      </div>

      {FINDER_GROUPS.map((group) => (
        <section key={group.id} className="finder__section">
          <div className="row-head"><h2>{group.label}</h2></div>
          <div className="finder__chips">
            {group.items.map((item) => {
              const sign = picked.flags[item.id];
              const mark = sign === 'on' ? '＋' : sign === 'off' ? '－' : '';
              return (
                <button key={item.id} className={`uchip finder__flag${sign ? ` is-${sign}` : ''}`}
                  title={item.why} aria-pressed={!!sign} onClick={() => cycle(item.id)}>
                  {mark}{item.why}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="finder__section">
      <div className="row-head"><h2>타입</h2><span className="meta">여러 개면 “또는”</span></div>
      <div className="finder__chips">
        {Object.keys(data.TYPE_KO).map((key) => {
          const on = picked.types.includes(key);
          return (
            <button key={key} className={`uchip finder__type${on ? ' is-on' : ''}`} aria-pressed={on}
              onClick={() => {
                track('finder_type', { type: key });
                setPicked({ ...picked, types: on ? picked.types.filter((one) => one !== key) : [...picked.types, key] });
              }}>
              {data.TYPE_KO[key] ?? key}
            </button>
          );
        })}
      </div>

      </section>
      <section className="finder__section">
      <div className="row-head"><h2>CP · 이름</h2></div>
      <div className="finder__row">
        {numberBox('cpMin', 'CP 최소')}
        <span className="finder__dash">–</span>
        {numberBox('cpMax', 'CP 최대')}
        <input className="finder__name" type="text" placeholder="이름 (예: 파이리)" aria-label="포켓몬 이름" value={picked.name}
          onChange={(event) => setPicked({ ...picked, name: event.target.value })} />
      </div>

      </section>

      {/* v3 는 두 문장으로 나눠 붙인다 — 사전이 줄 단위로 찾으므로 붙이는 자리도 같아야 한다 */}
      <p className="detail__foot">
        {'게임이 지원하지 않아 넣지 않은 것: 교환 상대 닉네임, 리모트 레이드 전용. '}
        {'버전에 따라 달라지는 문법(사탕 수 등)도 빼 뒀어요 — 틀린 식을 드리지 않기 위해서예요.'}
      </p>
    </div>
  );
}
