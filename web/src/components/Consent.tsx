// ─────────────────────────────────────────────────────────────────────────────
// components/Consent.tsx — 통계 · 저장소 설정 (v3 components/consent.js openConsentSettings · v6 D09)
//
// 끄는 길은 두 자리에서 같은 팝업을 연다 — 설정 화면과 화면 아래 푸터.
// 개인정보처리방침이 그 두 자리를 그대로 가리키고 있어, 한쪽만 있으면 방침이 거짓말이 된다.
// 토글은 판 안에서만 바뀌고 **'설정 저장' 을 눌러야** pogo_consent 에 적힌다 (lib/consent.ts setConsent — 키 · 값은 전과 같다).
// 캐시 지우기는 바로 돈다 — 새로고침까지 한 동작이라 저장 단추를 기다릴 것이 없다
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { clearAppCache, consentValue, setConsent } from '../lib/consent';
import { track } from '../lib/track';
import { PxSwitch } from './Bits';
import { PixelIcon } from './PixelIcon';
import { PxDialog, PxDialogBody, PxDialogFoot, PxDialogHead } from './PxDialog';
import { NoteBox } from './detail/Pieces';

// 이 브라우저에 남는 것 — 방침이 말하는 항목 그대로 (서비스워커 캐시 · pogo_ 설정값 · 로그인 상태). 위치정보는 없다
const STORED: [string, string][] = [
  ['화면 테마 · 애니메이션 설정', 'localStorage, pogo_ 접두사 — 마지막 탭·모드, 패치노트 읽음, 동의 여부도 여기 남아요'],
  ['검색 기록 · 브라우저 캐시', '최근 검색 8건과 오프라인용 파일 캐시(화면·데이터·포켓몬 그림) — 서비스워커'],
  ['로그인 상태와 즐겨찾기 동기화', '로그인하면 즐겨찾기는 계정에 저장돼요. 위치정보는 수집하지 않아요'],
];

export default function ConsentDialog({ onClose }: { onClose: () => void }) {
  // 값이 없으면 켜짐(기본) — lib/consent.ts analyticsWanted 와 같은 판정
  const [on, setOn] = useState(consentValue() !== 'denied');
  const save = () => {
    const value = on ? 'granted' : 'denied';
    setConsent(value);
    track('consent', { value, from: 'settings' });
    onClose();
  };
  return (
    <PxDialog onClose={onClose} labelledBy="consent-title" className="pxd-dialog pxd-dialog--narrow" panelClassName="pxd-consent">
      <PxDialogHead titleId="consent-title" title="통계 · 저장소 설정" caption="이 브라우저에 저장된 데이터" onClose={onClose} />
      <PxDialogBody>
        <div className="pxd-setting">
          <div className="pxd-setting__row">
            <p className="px-sub">이용 통계 수집</p>
            <PxSwitch text={on ? '켜짐' : '꺼짐'} checked={on} onChange={setOn} title="방문 통계(Google Analytics)" />
          </div>
          <p className="px-caption">방문 통계(Google Analytics)는 기능별 이용 현황을 파악하고 화면을 개선하는 데 사용해요. 이메일·이름은 전송하지 않아요.</p>
        </div>
        <NoteBox>통계를 끄면 통계 스크립트를 불러오지 않고 자체 수집도 보내지 않아요. 도감·순위표·계산기 이용에는 영향이 없어요.</NoteBox>
        <section className="pxd-setting" aria-label="저장된 항목">
          <p className="px-sub">저장된 항목</p>
          <ul className="px-notelist">
            {STORED.map(([head, body], index) => (
              <li key={head}>
                <span className="px-notelist__no px-mono">{String(index + 1).padStart(2, '0')}</span>
                <span><b>{head}</b>{' '}<span className="px-muted">{body}</span></span>
              </li>
            ))}
          </ul>
        </section>
        <div className="pxd-setting">
          <div className="px-note__actions">
            <button type="button" className="px-btn px-skin" onClick={() => { track('cache_clear'); void clearAppCache(); }}><PixelIcon name="box" />브라우저 캐시 지우기</button>
          </div>
          <p className="px-caption">오프라인용 캐시를 비우고 새로고침해요. 설정값까지 지우려면 브라우저의 "사이트 데이터 삭제"를 쓰세요. 계정에 저장한 즐겨찾기·내 포켓몬은 여기서 지워지지 않아요 (계정 관리 → 계정 삭제).</p>
        </div>
      </PxDialogBody>
      <PxDialogFoot>
        <button type="button" className="px-btn px-skin" onClick={onClose}>취소</button>
        <button type="button" className="px-btn px-btn--primary px-skin" onClick={save}>설정 저장</button>
      </PxDialogFoot>
    </PxDialog>
  );
}
