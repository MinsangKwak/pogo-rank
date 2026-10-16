// ─────────────────────────────────────────────────────────────────────────────
// components/AdminDenied.tsx — 관리자 화면이 서버에서 막혔을 때 세우는 판 (v6 피그마 A07 '로그인과 접근')
//
// 라우트 잠금(비관리자 → '없는 화면')은 LockCard 가 맡는다. 여기는 **화면이 열린 뒤** 서버가 403 을 돌려준 때다 —
// 로그인 때 읽은 권한과 서버의 지금 판정이 어긋난 경우(권한이 방금 빠졌거나, 위임 관리자가 루트 화면에 선 경우).
// 빈 화면이나 '통계를 못 받았어요' 로 두면 회선 문제로 읽는다 — 권한 문제는 권한 문제라고 적는다.
// ─────────────────────────────────────────────────────────────────────────────
import { routeHref } from '../../routes';
import { PixelIcon } from '../PixelIcon';

export default function AdminDenied({ kind }: { kind: '403' | 'root' }) {
  if (kind === 'root') {
    return (
      <section className="px-note px-skin px-drop adm-denied" role="alert">
        <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">ROOT ONLY</p>
        <h3 className="px-heading">루트 관리자 전용 화면</h3>
        <p className="px-note__body">위임 관리자는 운영 통계와 가입 승인에 접근할 수 없어요. 이용자 목록과 트레이너 코드로 이동해 주세요.</p>
        <div className="px-note__actions">
          <a className="px-btn px-btn--primary px-skin" href={routeHref('admin-users')}><PixelIcon name="team" /> 이용자 목록</a>
          <a className="px-btn px-skin" href={routeHref('admin-trainers')}><PixelIcon name="box" /> 트레이너 코드</a>
        </div>
      </section>
    );
  }
  return (
    <section className="px-note px-skin px-drop adm-denied" role="alert">
      <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">ACCESS DENIED · 403</p>
      <h3 className="px-heading">관리자 권한이 없어요</h3>
      <p className="px-note__body">현재 계정은 관리자 페이지를 볼 수 없어요. 다른 계정으로 로그인하거나 서비스로 돌아가세요.</p>
      <div className="px-note__actions">
        <a className="px-btn px-btn--primary px-skin" href="/"><PixelIcon name="home" /> 서비스 홈으로</a>
      </div>
    </section>
  );
}
