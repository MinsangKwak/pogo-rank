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
//   live         — 실제 광고(Google AdSense). 게시자 ID 가 없으면 off 로 읽는다 (2026-10-15)
// **어느 모드든 약관의 시행일(legalMeta ADS_FROM) 0시 전에는 off** — 주인 결정: AdSense 승인 당일 시행일을 넣고 그날부터 켠다(사전 고지 없음)
//
// **광고를 세우지 않는 화면이 있다** (AdSense '게시자 콘텐츠가 없는 화면' 정책, 2026-10-14 점검) — 약관 · 개인정보처리방침 · 설정과,
// 로그인해야 열리는 화면(로그아웃한 사람에게는 잠금 카드뿐이다). 판정은 adFreeRoute 하나 — 화면 안 판정과 첫 그림 전 스크립트가 같이 쓴다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { AuthStatus } from '../stores/auth';
import { ROUTES } from '../routes';
import { ADS_FROM } from './legalMeta';

/**
 * 판정에 쓰는 상태 — 로그인(stores/auth.ts) · 통계 동의(lib/consent.ts) · 지금 화면.
 * ready 는 첫 확인이 끝났는가, recheckError 는 그 확인이 실패했는가, trace 는 이 기기의 로그인 자취,
 * consentDenied 는 '통계 끄기' 를 골랐는가, adFree 는 광고를 세우지 않는 화면인가(잠금 카드가 선 화면 포함)
 */
export interface AdsAuth { status: AuthStatus; ready: boolean; recheckError: string; trace: boolean; consentDenied: boolean; adFree: boolean }

export type AdsMode = 'off' | 'placeholder' | 'live';

/** 자리 이름 — CSS 와 검사가 같은 글자를 쓴다 */
export type AdSlotId = 'left' | 'right' | 'bottom';

/** 자리마다 비워 두는 크기(px). Google 표준 단위 — 넓은 화면 세로 띠 160×600, 휴대폰 바닥 띠 320×50 */
export const AD_SLOT_SIZE: Readonly<Record<AdSlotId, { w: number; h: number }>> = {
  left: { w: 160, h: 600 },
  right: { w: 160, h: 600 },
  bottom: { w: 320, h: 50 },
};

/** 빌드가 박은 모드. 모르는 글자는 off 로 읽는다 — 오타로 광고가 켜지지 않게. live 는 게시자 ID 와 단위 셋이 모두 꼴에 맞을 때만 */
export function adsMode(raw: string | undefined = process.env['NEXT_PUBLIC_ADS'], client: string | undefined = process.env['NEXT_PUBLIC_ADSENSE_CLIENT']): AdsMode {
  if (raw === 'placeholder') return 'placeholder';
  // 단위가 하나라도 없으면 live 로 안 연다 — 자리 없이 본문만 비켜서거나(첫 그림 전 스크립트) 빈 띠가 서는 일을 막는다
  if (raw === 'live' && adsClient(client) !== null && (['left', 'right', 'bottom'] as const).every((id) => adsSlotUnit(id) !== null)) return 'live';
  return 'off';
}

/** 게시자 ID(ca-pub-16자리) — 꼴이 틀리면 null */
export function adsClient(client: string | undefined = process.env['NEXT_PUBLIC_ADSENSE_CLIENT']): string | null {
  return /^ca-pub-\d{16}$/.test(client ?? '') ? client! : null;
}

/** 자리마다의 광고 단위 ID(숫자) — AdSense 승인 뒤 만든 단위. 없거나 꼴이 틀리면 null 이고 그 자리는 live 에서 안 선다 */
export function adsSlotUnit(id: AdSlotId, env: Readonly<Record<string, string | undefined>> = {
  left: process.env['NEXT_PUBLIC_ADSENSE_SLOT_LEFT'],
  right: process.env['NEXT_PUBLIC_ADSENSE_SLOT_RIGHT'],
  bottom: process.env['NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM'],
}): string | null {
  const unit = env[id];
  return unit && /^\d{6,12}$/.test(unit) ? unit : null;
}

/** AdSense 스크립트 주소 — 자리가 보일 때만 한 번 심는다(components/AdSlots.tsx) */
export function adsScriptSrc(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
}

/**
 * 광고 시작 시각(ms) — 약관의 시행일(ADS_FROM) 한국 시간 0시. 시행일이 없으면 null(영영 안 연다).
 * **약관이 말한 날보다 먼저 자리가 서면 안 된다** — 빌드 모드가 켜져 있어도 이 시각 전에는 off 로 본다 (2026-10-15 주인 결정: 10/22 까지 가려 둔다).
 * 정적 빌드라 날짜는 빌드 때가 아니라 보는 사람의 시계로 가른다 — 10/22 0시에 다시 배포하지 않아도 저절로 열린다
 */
export const ADS_START_MS: number | null = ADS_FROM ? Date.parse(`${ADS_FROM}T00:00:00+09:00`) : null;

/** 지금 광고를 세울 수 있는 때인가 */
export function adsStarted(now: number = Date.now(), start: number | null = ADS_START_MS): boolean {
  return start !== null && now >= start;
}

/** 빌드 모드에 시작 시각을 얹는다 — 시작 전이면 off. 화면 안 판정과 첫 그림 전 스크립트가 같은 시각을 본다 */
export function adsModeNow(mode: AdsMode = adsMode(), now: number = Date.now(), start: number | null = ADS_START_MS): AdsMode {
  return adsStarted(now, start) ? mode : 'off';
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
  // 통계를 끈 사람에게도 세우지 않는다 — '끄면 아무것도 보내지 않는다'(CLAUDE.md §5)와 같은 결. 광고 스크립트가 붙으면 Google 로 요청이 나간다
  return mode !== 'off' && auth.ready && !auth.recheckError && !auth.trace && !auth.consentDenied && !auth.adFree && auth.status === 'anon';
}

/** 내용 없이 광고만 서면 안 되는 화면 — 약관 · 방침 · 설정 (정책상 '탐색 · 법적 고지' 화면) */
const AD_FREE_IDS: ReadonlySet<string> = new Set(['privacy', 'terms', 'settings']);

/** 이 화면에 광고를 세우지 않는가 — 위 셋과, 로그인해야 열리는 화면(로그아웃한 사람에게는 잠금 카드만 선다) */
export function adFreeRoute(route: { id: string; locked?: boolean }): boolean {
  return AD_FREE_IDS.has(route.id) || route.locked === true;
}

/** 첫 그림 전 스크립트가 주소로 가르는 목록 — '/privacy' · '/planner' 꼴 */
export const AD_FREE_PATHS: readonly string[] = ROUTES.filter((route) => adFreeRoute(route)).map((route) => `/${route.path}`);

/**
 * ads.txt 한 줄 — AdSense 게시자 ID(ca-pub-16자리)가 있을 때만. 없거나 꼴이 틀리면 null(→ 404).
 * 마지막 값은 Google 의 인증 기관 ID 로 모든 게시자에게 같다 (AdSense 도움말 'ads.txt 가이드')
 */
export function adsTxtLine(client: string | undefined): string | null {
  const found = /^ca-pub-(\d{16})$/.exec(client ?? '');
  return found ? `google.com, pub-${found[1]}, DIRECT, f08c47fec0942fa0` : null;
}
