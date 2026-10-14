// ─────────────────────────────────────────────────────────────────────────────
// lib/ads.ts — 광고 자리를 **누구에게 · 어느 모드로** 보이는지 정하는 한 곳 (2026-10-14)
//
// 자리 셋 — 넓은 화면은 본문 양옆 세로 띠(왼쪽 · 오른쪽, 160×600), 휴대폰은 바닥 띠(320×50).
// 주인 결정: **로그인한 사람에게는 광고가 없다.** 로그인 상태(stores/auth.ts)를 여기서 읽어 한 줄로 판정한다 —
// 컴포넌트 · 검사가 같은 함수를 쓴다. 둘이 다르면 어느 쪽이 맞는지 알 수 없다.
//
// 모드는 빌드 때 박힌다 (NEXT_PUBLIC_ADS, web/.env.production · dev-pipeline.yml):
//   off          — 자리 자체를 안 만든다. 운영 기본값 (약관이 아직 '광고 없음' 이라 운영은 끈 채 둔다)
//   placeholder  — 자리만 잡고 '준비 중' 을 적는다. dev 에서 배치를 보는 용도
// 실제 광고(Google AdSense)는 docs/ADS.md 의 절차를 밟은 뒤 모드 하나를 더해 붙인다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { AuthStatus } from '../stores/auth';

/** 판정에 쓰는 로그인 상태 조각 (stores/auth.ts) — ready 는 첫 확인이 끝났는가, recheckError 는 그 확인이 실패했는가 */
export interface AdsAuth { status: AuthStatus; ready: boolean; recheckError: string; trace: boolean }

export type AdsMode = 'off' | 'placeholder';

/** 자리 이름 — CSS 와 검사가 같은 글자를 쓴다 */
export type AdSlotId = 'left' | 'right' | 'bottom';

/** 자리마다 비워 두는 크기(px). Google 표준 단위 — 넓은 화면 세로 띠 160×600, 휴대폰 바닥 띠 320×50 */
export const AD_SLOT_SIZE: Readonly<Record<AdSlotId, { w: number; h: number }>> = {
  left: { w: 160, h: 600 },
  right: { w: 160, h: 600 },
  bottom: { w: 320, h: 50 },
};

/** 빌드가 박은 모드. 모르는 글자는 off 로 읽는다 — 오타로 광고가 켜지지 않게 */
export function adsMode(raw: string | undefined = process.env['NEXT_PUBLIC_ADS']): AdsMode {
  return raw === 'placeholder' ? 'placeholder' : 'off';
}

/**
 * 광고 자리를 보일지. 모드가 꺼져 있으면 아무에게도, 켜져 있어도 **첫 확인이 끝난(ready) 뒤 로그인 전(anon)인 사람에게만**.
 * loading(이 기기에 로그인 자취가 있어 확인 중) · pending(승인 대기) · ok 는 모두 '로그인한 사람' 으로 본다 —
 * 확인 중에 보였다가 사라지면 로그인한 사람이 광고를 한 번 보게 된다.
 * ready 를 함께 보는 이유 — 로그인 직후 첫 화면이나 사이트 저장소를 지운 뒤에는 자취(pogo_signed_in)가 없어 상태가 anon 으로
 * 시작하고, 쿠키로 확인이 끝난 뒤에야 ok 가 된다. 그 사이에도 자리가 서면 안 된다 (Codex, PR #364).
 * recheckError 까지 보는 이유 — 확인이 회선 문제로 실패하면 ready 는 true 가 되지만 상태는 anon 그대로다. 그 사람이 실제로는
 * 로그인돼 있을 수 있으니(쿠키는 살아 있는데 자취만 없음) 확인에 실패한 동안은 아무에게도 세우지 않는다 (Codex, PR #364).
 * trace(로그인 자취)까지 보는 이유 — 다른 탭에서 로그인하면 이 탭의 상태는 anon 그대로인데 자취는 바로 바뀐다.
 * 자취가 있으면 로그인한 사람으로 보고 내린다 (Codex, PR #364)
 */
export function adsVisible(mode: AdsMode, auth: AdsAuth): boolean {
  return mode !== 'off' && auth.ready && !auth.recheckError && !auth.trace && auth.status === 'anon';
}
