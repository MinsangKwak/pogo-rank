import { useState } from 'react';
import { track } from '../../lib/track';
import type { MonRef } from '../../lib/mon';
// 공유 기능이 없으면 클립보드 복사를 사용합니다.
export default function ShareBtn({ mon }: { mon: MonRef }) {
  const [copied, setCopied] = useState(false);
  const click = async () => {
    const url = `${location.origin}/mon/${mon.sprite}`;
    track('share', { mon: mon.name });
    const flash = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    try {
      if (navigator.share) await navigator.share({ title: `${mon.name} — moncamp`, url });
      else { await navigator.clipboard.writeText(url); flash(); }
    } catch (error) {
      // 공유 시트를 취소한 경우는 조용히, 그 밖(권한 등)은 클립보드로 한 번 더
      if ((error as { name?: string })?.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); flash(); } catch { return; }
    }
  };
  return (
    <button className={`detail__share detail__dock-btn${copied ? ' is-copied' : ''}`}
      aria-label="링크 공유" title="이 포켓몬 링크 공유" onClick={click}>
      <span className="detail__share-icon">{copied ? '✓' : '🔗'}</span>
      <span className="detail__share-text">{copied ? '복사됨 ✓' : '링크 복사'}</span>
    </button>
  );
}

