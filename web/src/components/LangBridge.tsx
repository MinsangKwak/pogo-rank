// ─────────────────────────────────────────────────────────────────────────────
// components/LangBridge.tsx — 번역 엔진에 이름표를 건네고 첫 훑기를 켠다
//
// 엔진은 React 밖에서 돈다(lib/i18n.ts). 다만 **이름표만은 빌드 데이터에서 와야 한다** —
// 포켓몬·기술·폼·타입 이름 1,000여 개는 사전에 적지 않고 구워 둔 표를 뒤집어 쓴다.
// 그 표가 도착하는 자리가 여기다. 그리는 것은 없다.
//
// **기다리지 않고 받는다** (v5 Phase 7). 전에는 useDex(Suspense)를 썼는데, 이 조각이
// Suspense 경계 밖이라 dex.json 78KB 가 올 때까지 **화면 전체가 안 그려졌다** —
// 실측 1.6Mbps·CPU 4배에서 스크립트는 1.6초에 끝나고 화면은 3.5초에 떴다.
// 이름표는 늦게 와도 된다. 한국어 화면은 이름표 없이도 온전하고, 영어로 바꿔 둔 사람은
// 표가 닿는 순간 훑기가 돈다. 화면이 2초 늦는 것과 바꿀 것이 아니다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useDexSoft } from '../lib/data';
import { initLang, setNameSource } from '../lib/i18n';

export default function LangBridge() {
  const data = useDexSoft();
  useEffect(() => {
    if (!data) return;          // 아직 안 왔다 — 오면 이 effect 가 다시 돈다
    setNameSource(data);
    initLang();
  }, [data]);
  return null;
}
