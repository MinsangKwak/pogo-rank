// ─────────────────────────────────────────────────────────────────────────────
// CollectBridge — 수집기 주소를 lib/collect.ts 에 꽂는다 (v4.7.0).
//
// AuthBridge 와 같은 자리다. 설정값(META)은 빌드가 넣어 주는데 lib/* 는 훅을 못 쓰므로,
// 값을 아는 컴포넌트가 한 번 꽂아 준다.
//
// **주소가 비면 이 기능은 통째로 꺼진다** — FIREBASE_CONFIG.apiKey 가 없으면 로그인이 꺼지는 것과 같다.
// 서버가 아직 없는 상태에서도 화면은 지금과 똑같이 돈다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect } from 'react';
import { useMetaSoft } from '../lib/data';
import { configureCollect, watchPageHide } from '../lib/collect';

export default function CollectBridge() {
  // 기다리지 않는다 — 이 조각도 Suspense 밖이라, 기다리면 화면 전체가 같이 선다
  const meta = useMetaSoft();
  useEffect(() => {
    const url = meta?.COLLECT_URL ?? '';
    if (!url) return;
    configureCollect(url, meta?.APP_VERSION ?? '');
    // 탭을 떠날 때 남은 것을 보낸다 — 마지막 검색이 큐에 남은 채 사라지지 않게
    return watchPageHide();
  }, [meta?.COLLECT_URL, meta?.APP_VERSION]);
  return null;
}
