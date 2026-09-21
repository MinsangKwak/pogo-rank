// ─────────────────────────────────────────────────────────────────────────────
// components/Consent.tsx — 통계 · 저장소 설정 (v3 components/consent.js openConsentSettings)
//
// 끄는 길은 두 자리에서 같은 팝업을 연다 — ☰ 메뉴와 화면 아래 푸터.
// 개인정보처리방침이 그 두 자리를 그대로 가리키고 있어, 한쪽만 있으면 방침이 거짓말이 된다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { clearAppCache, consentValue, setConsent } from '../lib/consent';
import { track } from '../lib/track';

export default function ConsentDialog({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);
  const now = consentValue();
  const pick = (value: 'granted' | 'denied') => () => {
    setConsent(value);
    track('consent', { value, from: 'settings' });
    onClose();
  };
  const row = (value: 'granted' | 'denied', label: string, desc: string) => (
    <button className={`drawer__item consent__opt${now === value ? ' is-on' : ''}`}
      aria-pressed={now === value} onClick={pick(value)}>
      <span><b>{label}</b><small>{desc}</small></span>
    </button>
  );
  return (
    <dialog className="modal" ref={box} aria-label="통계 · 저장소 설정"
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="consent__modal">
            <h2 className="detail__name">통계 · 저장소 설정</h2>
            <p className="plan__desc">방문 통계(Google Analytics)는 기능별 이용 현황을 파악하고 화면을 개선하는 데 사용해요. 이메일·이름은 전송하지 않아요.</p>
            <div className="account__actions">
              {row('granted', '통계 켜기', '이용 패턴을 기록해요 (기본값)')}
              {row('denied', '통계 끄기', '통계 스크립트를 불러오지 않아요')}
            </div>
            <h2 className="page__sec">브라우저 저장 항목</h2>
            <ul className="priv__list">
              <li>오프라인용 파일 캐시(화면·데이터·포켓몬 그림) — 서비스워커</li>
              <li>설정값(마지막 탭·모드, 패치노트 읽음, 동의 여부 등) — localStorage, pogo_ 접두사</li>
              <li>위치정보는 수집하지 않아요</li>
            </ul>
            <div className="account__actions">
              <button className="drawer__item" onClick={() => { track('cache_clear'); void clearAppCache(); }}>🧹 캐시 비우고 새로고침</button>
            </div>
            <p className="detail__foot">설정값까지 지우려면 브라우저의 "사이트 데이터 삭제"를 쓰세요. 계정에 저장한 즐겨찾기·내 포켓몬은 여기서 지워지지 않아요 (계정 카드 → 계정 삭제).</p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
