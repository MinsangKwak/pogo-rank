// ─────────────────────────────────────────────────────────────────────────────
// components/AdSlots.tsx — 광고 자리 셋: 넓은 화면 양옆 세로 띠 · 휴대폰 바닥 띠 (2026-10-14)
//
// 셸의 DOM 순서(.app-bar → #app-nav → #page-head → .layout) 뒤에 붙는다 — 세 자리 모두 position: fixed 라
// 본문 흐름에 끼지 않는다. 본문이 비켜서는 일은 CSS 가 `html[data-ads="on"]` 을 보고 한다 (styles/cinema/ads.css):
// 넓은 화면은 본문 폭을 띠만큼 줄이고, 휴대폰은 바닥에 띠 높이만큼 여백을 둔다.
//
// 보이는 조건은 lib/ads.ts 한 곳이다 — 로그인한 사람에게는 자리 자체를 안 만든다.
// 지금은 '준비 중' 을 적은 빈 자리다. 실제 광고를 붙이는 절차는 docs/ADS.md
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { AD_SLOT_SIZE, adsMode, adsVisible, type AdSlotId } from '../lib/ads';

const SLOTS: readonly AdSlotId[] = ['left', 'right', 'bottom'];

function Slot({ id }: { id: AdSlotId }) {
  const size = AD_SLOT_SIZE[id];
  return (
    <aside className={`ad-slot ad-slot--${id}`} data-ad-slot={id} aria-label="광고">
      <div className="ad-slot__box" style={{ width: size.w, height: size.h }}>
        <span className="ad-slot__label">광고</span>
        <span className="ad-slot__text">광고 자리예요 · 준비 중</span>
      </div>
    </aside>
  );
}

export default function AdSlots() {
  const status = useAuthStore((s) => s.status);
  const ready = useAuthStore((s) => s.ready);
  const visible = adsVisible(adsMode(), status, ready);
  // 본문이 비켜설지는 문서 속성 하나로 알린다 — 첫 그림 전에는 layout.tsx 의 인라인 스크립트가 로그인 자취로 같은 값을 미리 적는다(CLS 방지).
  // 자취 없이 쿠키만 남은 드문 경우(로그인 직후 첫 화면 · 저장소 지움)는 확인이 끝난 뒤 여기서 off 로 되돌린다
  useEffect(() => {
    document.documentElement.dataset['ads'] = visible ? 'on' : 'off';
  }, [visible]);
  if (!visible) return null;
  return <>{SLOTS.map((id) => <Slot key={id} id={id} />)}</>;
}
