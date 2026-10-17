// ─────────────────────────────────────────────────────────────────────────────
// components/SwapDialog.tsx — 포켓몬 교체 팝업 (v6 피그마 D12)
//
// D-MAX 덱 짜기 · 솔플 계산기 · PvP 덱 짜기가 **같은 팝업 하나**로 한 칸을 갈아 끼운다 — 화면마다 슬롯 아래 칩을
// 펼치던 방식은 후보가 열두 마리를 넘으면 읽을 수 없었고, 모양도 셋이 제각각이었다 (CLAUDE.md §3).
// 호출처는 후보 목록과 한 줄 설명(note)만 넘긴다 — 검색 · 즐겨찾기 거르기는 여기서 한다. 고른 것은 '선택한 포켓몬 적용' 을
// 눌러야 돌아간다(onPick). 바로 닫히면 잘못 눌렀을 때 되돌릴 길이 없다.
// 팝업 조각은 px-dialog(parts.css) 그대로다 — 바닥 단추가 고정이고 본문만 흐른다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDexSoft } from '../lib/data';
import { monSearch } from '../lib/search';
import { useFavs } from '../lib/useFavs';
import { word } from '../lib/cell';
import { PixelIcon } from './PixelIcon';
import { PxChips } from './Bits';
import { CandList, CandRow, Note, SearchBox } from './ToolBits';

export interface SwapCandidate {
  sprite: number;
  name: string;
  en?: string;
  types?: readonly string[];
  /** 한 줄 근거 — '맥스 피해 340 · 내구 34' 처럼 호출처가 실제 값으로 만들어 넘긴다 */
  note?: string;
}

export interface SwapDialogProps {
  title?: string;
  /** '슬롯 01 · 딜러 후보' — 어느 칸을 바꾸는지 */
  subtitle: string;
  candidates: readonly SwapCandidate[];
  /** 지금 그 칸에 든 것 — 목록에서 '현재' 로 표시한다 */
  current?: number | null;
  onPick: (candidate: SwapCandidate) => void;
  onClose: () => void;
  /** 즐겨찾기 도감 번호 — 안 넘기면 lib/useFavs 의 ★ 를 쓴다 */
  favorites?: readonly number[];
  /** '추천 순' 탭이 보여 주는 윗줄 수 — 넘기면 '전체' 로 나머지를 본다 */
  topCount?: number;
}

type Tab = 'top' | 'fav' | 'all';

export default function SwapDialog({ title = '포켓몬 교체', subtitle, candidates, current = null, onPick, onClose, favorites, topCount = 12 }: SwapDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const dexSoft = useDexSoft();
  const favStore = useFavs();
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<Tab>('top');
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  // 즐겨찾기는 도감 번호로 담겨 있다 — 폼 번호(10000대)는 dex 표로 원종을 찾는다
  const favSet = useMemo(() => new Set((favorites ?? favStore.favs).map(Number)), [favorites, favStore.favs]);
  const dexNoOf = (sprite: number) => dexSoft?.DEX_DATA.dex[String(sprite)] ?? (sprite < 10000 ? sprite : null);
  const typeKo = (key: string) => dexSoft?.TYPE_KO[key as keyof typeof dexSoft.TYPE_KO] ?? '';

  const shown = useMemo(() => {
    const query = term.trim();
    // 검색어가 있으면 탭과 무관하게 전체에서 찾는다 — 찾는 이름이 '추천 순' 윗줄에 없다고 빈 화면이 되면 안 된다
    if (query) return monSearch(candidates, query, 40);
    if (tab === 'fav') return candidates.filter((one) => { const no = dexNoOf(one.sprite); return no != null && favSet.has(no); });
    if (tab === 'all') return candidates;
    return candidates.slice(0, topCount);
  }, [term, tab, candidates, favSet, topCount, dexSoft]);   // eslint-disable-line react-hooks/exhaustive-deps

  const picked = chosen == null ? null : candidates.find((one) => one.sprite === chosen) ?? null;

  const tabs = [
    { id: 'top', label: '추천 순' },
    { id: 'fav', label: '즐겨찾기' },
    { id: 'all', label: '전체' },
  ];

  return (
    <dialog ref={ref} className="px-dialog" aria-labelledby="swap-dialog-title" onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="px-dialog__panel px-skin pxt-swap">
        <header className="px-dialog__head">
          <div>
            <h2 className="px-heading" id="swap-dialog-title">{title}</h2>
            <p className="px-caption">{subtitle}</p>
          </div>
          <button type="button" className="px-btn px-btn--icon px-skin" aria-label="닫기" onClick={onClose}><PixelIcon name="close" /></button>
        </header>
        <div className="px-dialog__body">
          <SearchBox value={term} placeholder="포켓몬 이름 검색" onChange={setTerm} />
          <PxChips label="후보 보기" items={tabs} value={term.trim() ? '' : tab} onPick={(id) => { setTab(id as Tab); setTerm(''); }} />
          {shown.length ? (
            <CandList>
              {shown.map((one) => {
                const on = chosen === one.sprite;
                const now = current != null && Number(current) === one.sprite;
                const types = (one.types ?? []).map(typeKo).filter(Boolean).join(' · ');
                return (
                  <CandRow key={one.sprite} sprite={one.sprite} name={word(one.name)}
                    badge={now ? <span className="px-badge px-skin px-badge--ko px-badge--muted">현재</span> : null}
                    lines={[[types, one.note].filter(Boolean).join(' · ')]}
                    ops={<button type="button" className={`px-btn px-btn--sm px-skin${on ? ' px-btn--primary' : ''}`} aria-pressed={on}
                      onClick={() => setChosen(on ? null : one.sprite)}>{on ? '선택됨' : '선택'}</button>} />
                );
              })}
            </CandList>
          ) : (
            <Note sunk title={term.trim() ? '검색 결과가 없어요' : tab === 'fav' ? '즐겨찾기한 후보가 없어요' : '후보가 없어요'}>
              {term.trim() ? '이름을 바꿔 보거나 전체 목록에서 골라 보세요.' : tab === 'fav' ? '도감이나 순위 화면에서 ☆ 를 눌러 담아 두면 여기서 바로 고를 수 있어요.' : '이 조건에 맞는 포켓몬이 아직 없어요.'}
            </Note>
          )}
        </div>
        <footer className="px-dialog__foot">
          <button type="button" className="px-btn px-skin" onClick={onClose}>취소</button>
          <button type="button" className="px-btn px-btn--primary px-skin" disabled={!picked} onClick={() => { if (picked) onPick(picked); }}>
            {picked ? `${picked.name} 적용` : '선택한 포켓몬 적용'}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
