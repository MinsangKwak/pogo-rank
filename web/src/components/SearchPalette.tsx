// ─────────────────────────────────────────────────────────────────────────────
// components/SearchPalette.tsx — 어느 화면에서든 뜨는 포켓몬 검색 (2026-09-28)
//
// **왜 생겼나.** 상단 바의 '포켓몬을 검색하세요' 는 도감으로 가는 링크였다 — 검색이 아니라 이동이라
// 목록에서 스크롤로 찾고 끝났고, 검색 수집(trackSearchPick)은 도감 검색칸에 이름을 친 사람만 잡았다.
// 검색 순위를 세우려면 검색이 먼저 늘어야 한다 (v4.6.3 이 순위를 내린 이유). 그래서 검색을 화면 이동 없이,
// 어디서든, 두 번의 입력으로 끝나게 한다: 열고(/ · Ctrl+K · 상단 바 · 홈 단추) → 치거나 칩을 누르면 상세가 뜬다.
//
// 빈 칸일 때 내미는 것 — 이 브라우저의 최근 검색(lib/recentSearch.ts) · 이번 주 보스(lib/weekBosses.ts).
// 후보는 도감 이름표만 쓴다(useDexSoft) — 셸에 붙는 조각이라 순위표 넷을 기다리게 하지 않는다.
// 고르면 어디서 골랐는지 surface 로 남긴다 (palette · palette_recent · palette_boss) — 통계에서 갈라 본다.
//
// <dialog> 로 열어 Esc · 배경 잠금을 브라우저에 맡긴다 (TankPopup 과 같은 틀). 모양은 modal.css 의 .modal 을 잇고
// 검색칸 · 목록만 palette.css 가 더한다
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDexSoft } from '../lib/data';
import { monSearch } from '../lib/search';
import { trackSearchPick } from '../lib/track';
import { readRecent, pushRecent, clearRecent, type RecentPick } from '../lib/recentSearch';
import { useWeekBosses } from '../lib/weekBosses';
import { useSearchStore, openSearch } from '../stores/search';
import { BASE } from '../lib/base';
import { PxIcon } from './PxIcon';
import type { OpenMon } from '../lib/mon';

interface Candidate { sprite: number; name: string; en: string; types: string[] }

/** 글을 치는 자리면 단축키를 뺏지 않는다 */
function typing(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

export default function SearchPalette({ onOpen }: { onOpen: OpenMon }) {
  const open = useSearchStore((s) => s.open);
  const hide = useSearchStore((s) => s.hide);
  // / 와 Ctrl+K(맥은 ⌘K) — 상단 바의 kbd 가 약속한 글자다
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return;
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      const k = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
      if (!slash && !k) return;
      event.preventDefault();
      openSearch('key');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!open) return null;
  return <Palette onOpen={onOpen} onClose={hide} />;
}

function Palette({ onOpen, onClose }: { onOpen: OpenMon; onClose: () => void }) {
  const box = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentPick[]>([]);
  const dex = useDexSoft();
  const week = useWeekBosses();

  useEffect(() => {
    const node = box.current;
    if (node && !node.open && typeof node.showModal === 'function') node.showModal();
    field.current?.focus();
    setRecent(readRecent());
  }, []);

  // 후보 — 도감 이름표 전부. 폼(메가 · 섀도우)은 상세가 열린 뒤 그 안에서 고른다
  const candidates = useMemo<Candidate[]>(() => {
    if (!dex) return [];
    const { names, en, forms } = dex.DEX_DATA;
    return Object.entries(names).map(([dexNo, name]) => ({
      sprite: Number(dexNo), name, en: en?.[dexNo] ?? '', types: [...(forms[dexNo]?.types ?? [])],
    }));
  }, [dex]);
  // 마우스는 **움직일 때만** 줄을 고른다(onMouseMove) — enter 로 하면 팔레트가 뜨는 순간 멈춰 있던 포인터 아래 줄이
  // 골라져, 이름을 치고 Enter 를 눌렀는데 셋째 줄이 열렸다 (2026-09-28 실측)
  const hits = useMemo(() => monSearch(candidates, query, 8), [candidates, query]);
  const cursor = Math.min(active, Math.max(0, hits.length - 1));

  const pick = (mon: Candidate | RecentPick, surface: string) => {
    trackSearchPick(mon.name, surface);
    setRecent(pushRecent({ sprite: mon.sprite, name: mon.name }));
    onClose();
    onOpen({ sprite: mon.sprite, name: mon.name, ...('en' in mon ? { en: mon.en, types: mon.types } : {}) });
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((now) => Math.min(hits.length - 1, now + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((now) => Math.max(0, now - 1)); }
    else if (event.key === 'Enter' && hits[cursor]) { event.preventDefault(); pick(hits[cursor]!, 'palette'); }
  };

  const sprite = (id: number) => <img className="palette__sprite" src={`${BASE}sprites/${id}.png`} alt="" width="32" height="32" loading="lazy" decoding="async" />;

  return (
    <dialog className="modal palette" ref={box} aria-label="포켓몬 검색"
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap palette__wrap">
        <button className="modal__close" aria-label="검색 닫기" onClick={onClose}>✕</button>
        <div className="modal__box palette__box">
          <label className="palette__field">
            <span className="palette__ico" aria-hidden="true"><PxIcon emoji="🔍" /></span>
            <input ref={field} type="search" className="palette__input" placeholder="포켓몬 이름이나 영문명" aria-label="포켓몬 검색"
              autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
              role="combobox" aria-expanded={hits.length > 0} aria-controls="palette-list" aria-autocomplete="list"
              aria-activedescendant={hits[cursor] ? `palette-opt-${hits[cursor]!.sprite}` : undefined}
              value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKey} />
          </label>
          {query.trim() ? (
            hits.length ? (
              <ul className="palette__list" id="palette-list" role="listbox" aria-label="검색 결과">
                {hits.map((mon, index) => (
                  <li key={mon.sprite} id={`palette-opt-${mon.sprite}`} role="option" aria-selected={index === cursor}>
                    <button type="button" className={`palette__hit${index === cursor ? ' is-on' : ''}`}
                      onMouseMove={() => setActive(index)} onClick={() => pick(mon, 'palette')}>
                      {sprite(mon.sprite)}
                      <span className="palette__name">{mon.name}</span>
                      {mon.en ? <span className="palette__en" data-i18n="off">{mon.en}</span> : null}
                      <span className="palette__no" data-i18n="off">{`#${mon.sprite}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="palette__empty">맞는 포켓몬이 없어요. 다른 이름으로 찾아보세요</p>
            )
          ) : (
            <>
              {recent.length ? (
                <section className="palette__group" aria-label="최근 검색">
                  <h3 className="palette__head">최근 검색
                    <button type="button" className="palette__clear" onClick={() => { clearRecent(); setRecent([]); }}>지우기</button>
                  </h3>
                  <div className="palette__chips">
                    {recent.map((mon) => (
                      <button key={mon.name} type="button" className="palette__chip" onClick={() => pick(mon, 'palette_recent')}>
                        {sprite(mon.sprite)}{mon.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {week.bosses.length ? (
                <section className="palette__group" aria-label={week.label}>
                  <h3 className="palette__head">{week.label}</h3>
                  <div className="palette__chips">
                    {week.bosses.map((boss) => (
                      <button key={boss.name} type="button" className="palette__chip" onClick={() => pick({ sprite: boss.sprite, name: boss.detailName, en: '', types: boss.types }, 'palette_boss')}>
                        {sprite(boss.sprite)}{boss.name}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <p className="palette__hint">이름을 치면 바로 찾아요 · ↑↓ 로 고르고 Enter</p>
            </>
          )}
          <a className="palette__more" href="/dex" onClick={onClose}>도감에서 필터로 찾기<span aria-hidden="true"> ›</span></a>
        </div>
      </div>
    </dialog>
  );
}
