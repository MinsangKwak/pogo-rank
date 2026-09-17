// ─────────────────────────────────────────────────────────────────────────────
// components/LangBridge.tsx — 번역 엔진에 이름표를 건네고 첫 훑기를 켠다
//
// 엔진은 React 밖에서 돈다(lib/i18n.ts). 다만 **이름표만은 빌드 데이터에서 와야 한다** —
// 포켓몬·기술·폼·타입 이름 1,000여 개는 사전에 적지 않고 구워 둔 표를 뒤집어 쓴다.
// 그 표가 도착하는 자리가 여기다. 그리는 것은 없다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useDex } from '../lib/data';
import { initLang, setNameSource } from '../lib/i18n';

export default function LangBridge() {
  const { data } = useDex();
  useEffect(() => {
    setNameSource(data);
    initLang();
  }, [data]);
  return null;
}
