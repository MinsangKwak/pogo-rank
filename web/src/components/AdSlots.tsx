// ─────────────────────────────────────────────────────────────────────────────
// components/AdSlots.tsx — 광고 자리 셋: 넓은 화면 양옆 세로 띠 · 휴대폰 바닥 띠 (2026-10-14)
//
// 셸의 DOM 순서(.app-bar → #app-nav → #page-head → .layout) 뒤에 붙는다 — 세 자리 모두 position: fixed 라
// 본문 흐름에 끼지 않는다. 본문이 비켜서는 일은 CSS 가 `html[data-ads="on"]` 을 보고 한다 (styles/cinema/ads.css):
// 넓은 화면은 본문 폭을 띠만큼 줄이고, 휴대폰은 바닥에 띠 높이만큼 여백을 둔다.
//
// 보이는 조건은 lib/ads.ts 한 곳이다 — 로그인한 사람에게는 자리 자체를 안 만든다.
// placeholder 는 '광고 영역' 을 적은 빈 자리, live 는 그 상자 안에 AdSense 단위(<ins class="adsbygoogle">)를 둔다 (docs/ADS.md §4)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useLayoutEffect, useSyncExternalStore, useState, useEffect, useRef } from 'react';
import { onSignInTrace, signInTrace, useAuthStore } from '../stores/auth';
import { consentDenied, onConsentChange } from '../lib/consent';
import { useRoute } from '../lib/useRoute';
import { useLockChecking, useLockReason } from '../lib/useLocked';
import { AD_SLOT_SIZE, adFreeRoute, adsClient, adsModeNow, adsScriptSrc, adsSlotUnit, adsVisible, type AdSlotId, type AdsMode } from '../lib/ads';

const SLOTS: readonly AdSlotId[] = ['left', 'right', 'bottom'];

type AdsQueue = unknown[] & { requestNonPersonalizedAds?: number };
declare global { interface Window { adsbygoogle?: AdsQueue } }

/**
 * AdSense 스크립트를 한 번만 심는다 — 자리가 실제로 설 때만 불리므로 로그인한 사람 · 통계를 끈 사람 · 광고 없는 화면에서는
 * Google 로 요청이 나가지 않는다(CLAUDE.md §5). 심기 전에 비개인(맥락) 광고만 요청한다고 적는다 — 방침의 '맞춤형 광고는 쓰지 않는다'
 */
function loadAdsScript(client: string): AdsQueue {
  const queue: AdsQueue = window.adsbygoogle ?? [];
  queue.requestNonPersonalizedAds = 1;
  window.adsbygoogle = queue;
  if (!document.querySelector('script[data-moncamp-ads]')) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.crossOrigin = 'anonymous';
    tag.src = adsScriptSrc(client);
    tag.dataset['moncampAds'] = '1';
    document.head.appendChild(tag);
  }
  return queue;
}

/** live 자리 안의 AdSense 단위 — 크기는 자리 크기로 고정해 광고가 늦게 와도 본문이 안 움직인다(CLS 0). 마운트 때 한 번 채워 달라고 한다 */
function LiveUnit({ id, client, unit }: { id: AdSlotId; client: string; unit: string }) {
  const size = AD_SLOT_SIZE[id];
  const pushed = useRef(false);
  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    // 차단기가 스크립트를 막아도 화면은 그대로다 — 빈 상자만 남는다
    try { loadAdsScript(client).push({}); } catch { /* 광고가 안 와도 본문은 산다 */ }
  }, [client]);
  return <ins className="adsbygoogle ad-slot__unit" style={{ display: 'inline-block', width: size.w, height: size.h }} data-ad-client={client} data-ad-slot={unit} />;
}

function Slot({ id, mode }: { id: AdSlotId; mode: AdsMode }) {
  const size = AD_SLOT_SIZE[id];
  const client = adsClient();
  const unit = adsSlotUnit(id);
  // live 인데 이 자리의 단위가 없으면 자리를 세우지 않는다 — 빈 점선 상자가 운영에 서면 안 된다
  if (mode === 'live' && (!client || !unit)) return null;
  return (
    <aside className={`ad-slot ad-slot--${id}`} data-ad-slot={id} aria-label="광고">
      {id === 'bottom' ? <p className="ad-slot__notice" role="status">로그인하면 광고 없이 이용할 수 있어요.</p> : null}
      <div className={`ad-slot__box${mode === 'live' ? ' ad-slot__box--live' : ''}`} style={id === 'bottom' ? undefined : { width: size.w, height: size.h }}>
        <span className="ad-slot__label">광고</span>
        {mode === 'live' && client && unit ? <LiveUnit id={id} client={client} unit={unit} /> : <span className="ad-slot__text">광고 영역</span>}
      </div>
    </aside>
  );
}

export default function AdSlots() {
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    // dev 주소에서도 ?adPreview=1 로 배치를 본다 — 시작일 전에는 자리를 가려 두므로 이 길이 아니면 dev 에서 볼 수 없다. 운영 빌드에서는 안 먹는다
    const devBuild = process.env.NODE_ENV === 'development' || process.env['NEXT_PUBLIC_CHANNEL'] === 'dev';
    setPreview(devBuild && new URLSearchParams(window.location.search).get('adPreview') === '1');
  }, []);
  const status = useAuthStore((s) => s.status);
  const ready = useAuthStore((s) => s.ready);
  const recheckError = useAuthStore((s) => s.recheckError);
  // 다른 탭에서 로그인하면 이 탭은 anon 그대로다 — 자취(storage 이벤트)로 알아채 내린다. 서버에서는 자취가 없다
  const trace = useSyncExternalStore(onSignInTrace, signInTrace, () => false);
  // 통계를 끄면 광고도 없다 — 설정 창에서 바꾸면 이 탭에서 바로, 다른 탭에서 바꿔도 따라온다
  const denied = useSyncExternalStore(onConsentChange, consentDenied, () => false);
  // 약관 · 방침 · 설정과 잠금 카드가 선 화면에는 세우지 않는다 (AdSense '게시자 콘텐츠가 없는 화면')
  const { route } = useRoute();
  // 훅은 둘 다 늘 부른다 — 단락 평가(||) 안에 두면 렌더마다 부르는 훅 수가 달라진다. 잠금 사유는 없으면 '' 다
  const lockReason = useLockReason(route.id);
  const lockChecking = useLockChecking(route.id);
  const locked = lockReason !== '' || lockChecking;
  const adFree = adFreeRoute(route) || locked;
  // 시작일(약관의 ADS_FROM) 전에는 모드가 켜져 있어도 off — 날짜는 보는 사람의 시계로 가른다 (lib/ads.ts adsModeNow)
  const mode: AdsMode = preview ? 'placeholder' : adsModeNow();
  const visible = adsVisible(mode, { status, ready, recheckError, trace, consentDenied: denied, adFree });
  // 본문이 비켜설지는 문서 속성 하나로 알린다 — 첫 그림 전에는 layout.tsx 의 인라인 스크립트가 로그인 자취로 같은 값을 미리 적는다(CLS 방지).
  // 자취 없이 쿠키만 남은 드문 경우(로그인 직후 첫 화면 · 저장소 지움)는 확인이 끝난 뒤 여기서 off 로 되돌린다.
  // useLayoutEffect 인 이유 — 자취는 남았는데 세션이 끝난 경우는 off 로 시작했다가 확인 뒤 on 이 된다. 그 커밋에서 자리가 먼저 서고
  // 속성이 한 박자 뒤에 붙으면 한 프레임 동안 띠가 본문을 덮는다. 그리기 전에 같이 바꾼다 (Codex, PR #364)
  useLayoutEffect(() => {
    document.documentElement.dataset['ads'] = visible ? 'on' : 'off';
  }, [visible]);
  if (!visible) return null;
  return <>{SLOTS.map((id) => <Slot key={id} id={id} mode={mode} />)}</>;
}
