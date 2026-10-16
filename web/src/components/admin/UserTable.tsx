// ─────────────────────────────────────────────────────────────────────────────
// components/admin/UserTable.tsx — 이용자 표 · 역할 배지 · 아바타 (v6 피그마 A03 루트 · A06 위임 관리자)
//
// 데스크톱은 표, 모바일(699px 아래)은 CSS 가 같은 줄을 카드로 다시 세운다(admin.css) — 마크업은 하나다.
// 단추는 부르는 쪽이 준다: 루트는 대기 줄에 [승인 검토] 와 실험 기능 스위치, 위임 관리자는 [프로필 보기] 만.
// 눌러도 안 되는 단추는 고장과 같다 — 권한이 없으면 아예 안 그린다
// ─────────────────────────────────────────────────────────────────────────────
import type { AdminUser, Role } from '../../lib/serverApi';
import { count, word, DASH } from '../../lib/cell';
import { PixelIcon } from '../PixelIcon';
import { PxSwitch } from '../Bits';

/** 역할 배지 — 글자 · 색 · 영문 이름표(상세의 큰 배지) */
export const ROLE_BADGE: Record<Role, { label: string; tone: string; code: string }> = {
  pending: { label: '승인 대기', tone: 'px-badge--orange', code: 'PENDING' },
  approved: { label: '승인', tone: 'px-badge--mint', code: 'APPROVED' },
  admin: { label: '관리자', tone: 'px-badge--blue', code: 'ADMIN' },
  root: { label: '루트', tone: 'px-badge--purple', code: 'ROOT' },
};

/** '2026-10-02T…' → '2026-10-02'. 비면 대시 — 한 번도 로그인 안 한 줄은 lastSeenAt 이 null 이다 */
export function dayOf(stamp: string | null | undefined): string {
  return stamp && stamp.length >= 10 ? stamp.slice(0, 10) : DASH;
}

/** 이름이 비면 '(이름 없음)' — 대시보다 뜻이 읽힌다 */
export const userName = (name: string) => (word(name) === DASH ? '(이름 없음)' : name);

/** 이름 · 이메일 검색 — 대소문자를 안 가린다 */
export function matchUser(row: Pick<AdminUser, 'name' | 'email'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q);
}

/** 목록 차례 — 승인 대기가 맨 위, 그 안에서는 가입일 순(최근 먼저). 할 일이 위에 선다 */
export function sortUsers(rows: readonly AdminUser[]): AdminUser[] {
  const rank = (role: Role) => (role === 'pending' ? 0 : 1);
  return [...rows].sort((a, b) => rank(a.role) - rank(b.role) || b.createdAt.localeCompare(a.createdAt));
}

export function RoleBadge({ role, code }: { role: Role; code?: boolean }) {
  const badge = ROLE_BADGE[role];
  return code
    ? <span className={`px-badge px-skin ${badge.tone}`} data-i18n="off">{badge.code}</span>
    : <span className={`px-badge px-skin px-badge--ko ${badge.tone}`}>{badge.label}</span>;
}

export function Avatar({ row }: { row: Pick<AdminUser, 'picture' | 'name'> }) {
  return row.picture
    ? <img className="adm-avatar" src={row.picture} alt="" />
    : <span className="adm-avatar adm-avatar--empty" aria-hidden="true"><PixelIcon name="user" /></span>;
}

export default function UserTable({ rows, root, detailHref, onApprove, onBeta }: {
  rows: readonly AdminUser[];
  /** 루트인가 — 참이면 대기 줄에 [승인 검토], 실험 기능이 스위치가 된다 */
  root: boolean;
  detailHref: (row: AdminUser) => string;
  onApprove?: (row: AdminUser) => void;
  onBeta?: (row: AdminUser, on: boolean) => void;
}) {
  return (
    <table className="px-table adm-users__table">
      <thead>
        <tr>
          <th scope="col">이용자</th>
          <th scope="col">역할</th>
          <th scope="col">실험 기능</th>
          <th scope="col">마지막 방문</th>
          <th scope="col" className="adm-users__act">작업</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((one) => (
          <tr key={one.id}>
            <td data-th="이용자">
              <span className="adm-who">
                <Avatar row={one} />
                <span className="adm-who__text">
                  <b className="px-body">{userName(one.name)}</b>
                  <span className="px-caption px-mono">{one.email}</span>
                </span>
              </span>
            </td>
            <td data-th="역할"><RoleBadge role={one.role} /></td>
            <td data-th="실험 기능">
              {/* 루트 계정의 깃발은 여기서 못 바꾼다 — 글자로만 */}
              {root && onBeta && one.role !== 'root'
                ? <PxSwitch text={one.beta ? '실험 ON' : '실험 OFF'} checked={one.beta} onChange={(next) => onBeta(one, next)} title="실험 기능 권한" />
                : <span className={`px-caption px-mono${one.beta ? ' adm-on' : ''}`}>{one.beta ? '실험 ON' : '실험 OFF'}</span>}
            </td>
            <td data-th="마지막 방문"><span className="px-caption px-mono">{dayOf(one.lastSeenAt)}</span></td>
            <td className="adm-users__act">
              {one.role === 'pending' && root && onApprove
                ? <button type="button" className="px-btn px-btn--sm px-btn--primary px-skin" onClick={() => onApprove(one)}>승인 검토</button>
                : <a className="px-btn px-btn--sm px-skin" href={detailHref(one)}>{root ? '상세' : '프로필 보기'}</a>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 표 바닥 — 'N개 요청 · 가입일 순' */
export const tableFoot = (n: number) => `${count(n)}개 요청 · 가입일 순`;
