// ─────────────────────────────────────────────────────────────────────────────
// lib/consent.ts — 통계(GA4) 켜고 끄기 · 캐시 비우기 (v3 components/consent.js)
//
// **옵트아웃이다** (v3.39.0 의 판단). 전에는 배너에서 '동의' 를 누른 사람만 GA 가 켜졌는데,
// 아무것도 안 누르고 떠나는 사람이 대부분이라 방문의 대다수가 한 건도 안 찍혔다 —
// 통계를 보려고 붙인 것이 통계를 못 보게 막고 있었다. 이제 들어오면 켜지고, 끄고 싶은 사람이 끈다.
// 광고·개인화는 계속 꺼 둔다. 끄는 길은 ☰ 메뉴 → 통계·저장소 설정 하나다 (첫 방문 배너는 v3.45.0 에 걷어냈다).
//
// 저장 값은 'granted' | 'denied'. **값이 없으면 켜짐**(기본).
// ─────────────────────────────────────────────────────────────────────────────
const CONSENT_KEY = 'pogo_consent';   // v3 와 같은 키

export function consentValue(): 'granted' | 'denied' | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch { return null; }
}

/** 통계를 켤 것인가 — '끄기' 를 고른 적이 없으면 켠다 */
export function analyticsWanted(): boolean {
  return consentValue() !== 'denied';
}

export function setConsent(value: 'granted' | 'denied') {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* 저장 불가 환경 */ }
}

/**
 * 서비스워커 캐시 + 등록 해제 → 새로고침.
 * **로컬 설정(pogo_*)은 지우지 않는다** — 동의 선택을 포함해 사용자가 고른 값이라서다.
 */
export async function clearAppCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch { /* 지원 안 하는 브라우저 */ }
  location.reload();
}
