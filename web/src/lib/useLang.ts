// ─────────────────────────────────────────────────────────────────────────────
// lib/useLang.ts — 지금 언어를 화면이 구독하는 길
//
// 엔진(lib/i18n.ts)은 React 밖에서 DOM 을 직접 고친다 — 그래야 화면 코드를 한 줄도 안 건드린다.
// 다만 **사전이 못 옮기는 곳**이 하나 있다: 패치노트는 `**굵게**` 가 섞인 문장 덩어리라
// 그려진 뒤에는 텍스트 노드가 여럿으로 쪼개져 문장을 못 맞춘다. 그쪽은 다른 배열로 갈아 끼우므로
// 그 화면이 다시 그려져야 한다 — 그래서 언어만 구독한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { lang, onLangChange, type Lang } from './i18n';

export { setLang } from './i18n';
export type { Lang } from './i18n';

export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, lang, () => 'ko' as Lang);
}
