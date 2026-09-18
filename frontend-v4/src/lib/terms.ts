// ─────────────────────────────────────────────────────────────────────────────
// lib/terms.ts — 약관 동의를 이 기기에 남긴다 (v3 components/terms.js 와 같은 키·같은 규칙)
//
// 약관을 개정해 TERMS_VER 을 올리면 다음 로그인 때 다시 묻는다 — 버전을 그대로 값으로 쓴다.
// ─────────────────────────────────────────────────────────────────────────────
import { TERMS_VER } from '../screens/Legal';

const TERMS_OK_KEY = 'pogo_terms_ok';   // v3 와 같은 키

export function termsAccepted(): boolean {
  try { return localStorage.getItem(TERMS_OK_KEY) === TERMS_VER; } catch { return false; }
}

export function markTermsAccepted() {
  try { localStorage.setItem(TERMS_OK_KEY, TERMS_VER); } catch { /* 저장 불가 환경 */ }
}

export { TERMS_VER };
