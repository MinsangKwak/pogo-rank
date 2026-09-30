// ─────────────────────────────────────────────────────────────────────────────
// UpdateBridge — 새 판이 올라오면 스스로 새로 고친다 (lib/autoUpdate.ts 머리말).
// CollectBridge 와 같은 자리 — 화면을 그리지 않고, Suspense 밖이라 데이터를 기다리지 않는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect } from 'react';
import { BUNDLE_BUILT, CHECK_EVERY, RELOAD_KEY, latestBuilt, needsReload, reloadFor, safeNow } from '../lib/autoUpdate';

export default function UpdateBridge() {
  useEffect(() => {
    // 기준은 이 번들이 구워진 판 — 켤 때 이미 새 판이 올라와 있었어도 알아챈다
    let first = BUNDLE_BUILT;
    let pending = '';
    let alive = true;
    const done = () => { try { return sessionStorage.getItem(RELOAD_KEY); } catch { return null; } };
    // resumed — 백그라운드에서 막 돌아왔다. 보던 것이 없으니 팝업이 열려 있어도 바로 고친다
    const check = async (resumed: boolean) => {
      const latest = await latestBuilt();
      if (!alive || !latest) return;
      if (!first) { first = latest; return; }
      if (!needsReload(first, latest, done())) return;
      pending = latest;
      if (resumed || safeNow(document)) void reloadFor(latest);
    };
    void check(false);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(true); };
    // 보고 있는 중에 알아챘으면 팝업이 닫히고 입력이 끝나기를 기다린다 — 30초마다 다시 본다
    const retry = window.setInterval(() => { if (pending && safeNow(document)) void reloadFor(pending); }, 30 * 1000);
    const poll = window.setInterval(() => { void check(false); }, CHECK_EVERY);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      alive = false;
      window.clearInterval(retry);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
  return null;
}
