// ─────────────────────────────────────────────────────────────────────────────
// components/detail/ShareBtn.tsx — '링크 복사' 단추 (상세 팝업 · 상세 페이지 바닥)
//
// 공유 시트(navigator.share)가 있으면 그것을, 없으면 클립보드에 복사한다. 복사가 끝나면 토스트(lib/toast.ts) 로
// '링크를 복사했어요' 를 띄운다 (v6 D13) — 단추 글자만 바꾸면 손가락 아래라 안 보인다. 글자도 잠깐 바꾼다(토스트가 안 꽂힌 자리 대비)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { track } from '../../lib/track';
import { toast } from '../../lib/toast';
import { PixelIcon } from '../PixelIcon';
import type { MonRef } from '../../lib/mon';

export default function ShareBtn({ mon, className = '' }: { mon: MonRef; className?: string }) {
  const [copied, setCopied] = useState(false);
  const click = async () => {
    const url = `${location.origin}/mon/${mon.sprite}`;
    track('share', { mon: mon.name });
    const flash = () => { setCopied(true); toast('링크를 복사했어요', 'good'); setTimeout(() => setCopied(false), 1500); };
    try {
      if (navigator.share) await navigator.share({ title: `${mon.name} — moncamp`, url });
      else { await navigator.clipboard.writeText(url); flash(); }
    } catch (error) {
      // 공유 시트를 취소한 경우는 조용히, 그 밖(권한 등)은 클립보드로 한 번 더
      if ((error as { name?: string })?.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); flash(); } catch { toast('링크를 복사하지 못했어요 — 주소창의 주소를 복사해 주세요', 'warn'); }
    }
  };
  return (
    <button type="button" className={`px-btn px-skin detail__share${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
      aria-label="링크 공유" title="이 포켓몬 링크 공유" onClick={() => void click()}>
      <PixelIcon name="globe" />
      <span >{copied ? '복사했어요' : '링크 복사'}</span>
    </button>
  );
}
