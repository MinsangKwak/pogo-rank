// ─────────────────────────────────────────────────────────────────────────────
// components/SearchPalette.tsx — 어느 화면에서든 뜨는 포켓몬 검색 (2026-09-28 · v6 D05 '포켓몬 빠른 검색')
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
// 판은 **포켓몬 상세 팝업과 같은 판**(components/PxDialog.tsx)이다 (2026-09-30 주인 결정) — 머리 · 본문 · 바닥('도감에서 필터로 찾기')
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDexSoft } from '../lib/data';
import { monSearch } from '../lib/search';
import { trackSearchPick } from '../lib/track';
import { readRecent, pushRecent, clearRecent, type RecentPick } from '../lib/recentSearch';
import { useWeekBosses } from '../lib/weekBosses';
import { useSearchStore, openSearch } from '../stores/search';
import { BASE } from '../lib/base';
import { PixelIcon } from './PixelIcon';
import { PxDialog, PxDialogBody, PxDialogFoot, PxDialogHead } from './PxDialog';
import { NoteBox } from './detail/Pieces';
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

/** 작은 몬스터볼 틀 위 그림 — 결과 줄 · 칩이 같은 틀을 쓴다 */
function Art({ id, size = 32 }: { id: number; size?: number }) {
  return (
    <span className="px-ball pxd-palette__art" style={{ ['--ball' as string]: `${size / 10}rem` }}>
      <img src={`${BASE}sprites/${id}.png`} alt="" width={size} height={size} loading="lazy" decoding="async" />
    </span>
  );
}

function Palette({ onOpen, onClose }: { onOpen: OpenMon; onClose: () => void }) {
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentPick[]>([]);
  const dex = useDexSoft();
  const week = useWeekBosses();

  useEffect(() => {
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
  // 타입 이름은 도감 묶음의 TYPE_KO 로 — 아직 안 왔으면 영문 키를 그대로 내지 않고 비운다 (CLAUDE.md §1)
  const typeLine = (types: readonly string[]) => types.map((type) => dex?.TYPE_KO[type as keyof typeof dex.TYPE_KO] ?? '').filter(Boolean).join(' · ');

  const pick = (mon: Candidate | RecentPick, surface: string) => {
    trackSearchPick(mon.name, surface);
    setRecent(pushRecent({ sprite: mon.sprite, name: mon.name }));
    onClose();
    // 전체 검색의 답은 요약 팝업이다 — 자세한 것은 팝업 아래 '도감에서 자세히' 로 (2026-09-30 주인 결정)
    onOpen({ sprite: mon.sprite, name: mon.name, view: 'brief', ...('en' in mon ? { en: mon.en, types: mon.types } : {}) });
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((now) => Math.min(hits.length - 1, now + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((now) => Math.max(0, now - 1)); }
    else if (event.key === 'Enter' && hits[cursor]) { event.preventDefault(); pick(hits[cursor]!, 'palette'); }
  };

  // 칩 한 줄 — 최근 검색 · 이번 주 보스가 같은 칩이다
  const chips = (label: string, rows: { key: string; sprite: number; label: string; onPick: () => void }[], more?: React.ReactNode) => (
    <section className="pxd-palette__group" aria-label={label}>
      <h3 className="px-sec"><span className="px-sub">{label}</span>{more}</h3>
      <div className="px-chips">
        {rows.map((row) => (
          <button key={row.key} type="button" className="px-chip px-skin pxd-palette__chip" onClick={row.onPick}>
            <Art id={row.sprite} size={24} />{row.label}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <PxDialog onClose={onClose} label="포켓몬 검색" className="pxd-dialog pxd-dialog--palette" panelClassName="pxd-palette">
      <PxDialogHead title="포켓몬 빠른 검색" caption="↑ ↓ 이동 · Enter 선택 · Esc 닫기" onClose={onClose} closeLabel="검색 닫기" />
      <PxDialogBody>
        <label className="px-input px-skin pxd-palette__field">
          <PixelIcon name="search" />
          <input ref={field} type="search" placeholder="포켓몬 이름이나 영문명" aria-label="포켓몬 검색"
            autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
            role="combobox" aria-expanded={hits.length > 0} aria-controls="palette-list" aria-autocomplete="list"
            aria-activedescendant={hits[cursor] ? `palette-opt-${hits[cursor]!.sprite}` : undefined}
            value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKey} />
        </label>
        {query.trim() ? (
          hits.length ? (
            <ul className="pxd-palette__list" id="palette-list" role="listbox" aria-label="검색 결과">
              {hits.map((mon, index) => (
                <li key={mon.sprite} id={`palette-opt-${mon.sprite}`} role="option" aria-selected={index === cursor}>
                  <button type="button" className={`px-card px-card--tap px-skin px-skin--sunk pxd-palette__hit${index === cursor ? ' is-on' : ''}`}
                    onMouseMove={() => setActive(index)} onClick={() => pick(mon, 'palette')}>
                    <Art id={mon.sprite} />
                    <span className="pxd-palette__text">
                      <span className="px-sub">{mon.name}{mon.en ? <span className="px-caption px-mono" data-i18n="off">{` ${mon.en}`}</span> : null}</span>
                      <span className="px-caption" data-i18n="off">{[`#${String(mon.sprite).padStart(3, '0')}`, typeLine(mon.types)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="px-mono px-muted pxd-palette__enter" aria-hidden="true">↵</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <NoteBox title="결과 없음">검색어를 바꾸거나 도감 필터를 이용해 보세요.</NoteBox>
          )
        ) : (
          <>
            {recent.length ? chips('최근 검색', recent.map((mon) => ({ key: mon.name, sprite: mon.sprite, label: mon.name, onPick: () => pick(mon, 'palette_recent') })),
              <button type="button" className="px-sec__more pxd-palette__clear" onClick={() => { clearRecent(); setRecent([]); }}>지우기</button>) : null}
            {week.bosses.length ? chips(week.label, week.bosses.map((boss) => ({
              key: boss.name, sprite: boss.sprite, label: boss.name,
              onPick: () => pick({ sprite: boss.sprite, name: boss.detailName, en: '', types: boss.types }, 'palette_boss'),
            }))) : null}
            <p className="px-caption">이름을 치면 바로 찾아요 · ↑↓ 로 고르고 Enter</p>
          </>
        )}
      </PxDialogBody>
      <PxDialogFoot>
        <a className="px-btn px-skin px-btn--block" href="/dex" onClick={onClose}>도감에서 필터로 찾기 <PixelIcon name="arrow" /></a>
      </PxDialogFoot>
    </PxDialog>
  );
}
