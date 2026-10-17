// ─────────────────────────────────────────────────────────────────────────────
// components/admin/Panels.tsx — 관리자 화면 넷이 나눠 쓰는 작은 판들 (v6 피그마 06~10 · ADMIN)
//
//   AdminPanel   제목 · 한 마디 · 오른쪽 링크가 있는 픽셀 판 (px-panel) — 날 마크업을 화면마다 되풀이하지 않는다
//   Note         안내 판 — 옛 ds Callout 의 자리. 띠 색이 뜻이다(알림 · 좋음 · 주의 · 나쁨)
//   ListState    '불러오는 중' · '불러오지 못했어요' · '아직 없어요' — 셋은 **다른 상태**다. 한 문구로 접으면 오류를 빈 목록으로 읽는다
//   SearchBox    검색 입력 한 줄
//   KvList       이름 · 값 줄 목록 (가입 · 권한 현황 · 프로필)
//   RankList     순위 번호 · 이름 · 값 (많이 담긴 포켓몬)
//   Toast        한 줄 알림 + 닫기
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { count } from '../../lib/cell';
import { PixelIcon } from '../PixelIcon';
import AdminDenied from './AdminDenied';

export function AdminPanel({ title, note, more, className, children }: { title?: ReactNode; note?: ReactNode; more?: { href: string; label: string }; className?: string; children?: ReactNode }) {
  return (
    <section className={`px-panel px-skin px-drop adm-panel${className ? ` ${className}` : ''}`}>
      {title ? (
        <h3 className="px-sec">
          <span className="px-sub">{title}</span>
          {note ? <span className="px-sec__note">{note}</span> : null}
          {more ? <a className="px-sec__more" href={more.href}>{more.label}</a> : null}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export type NoteTone = 'info' | 'good' | 'caution' | 'warn';

export function Note({ tone = 'info', title, actions, children }: { tone?: NoteTone; title?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`px-note px-skin adm-note adm-note--${tone}`} role={tone === 'warn' ? 'alert' : undefined}>
      {title ? <p className="px-note__title">{title}</p> : null}
      {children ? <div className="px-note__body adm-note__body">{children}</div> : null}
      {actions ? <div className="px-note__actions">{actions}</div> : null}
    </div>
  );
}

export interface LoadFail { kind: '403' | 'fail'; text: string }

/**
 * 목록의 세 상태. `loaded` 가 거짓이고 실패도 없으면 '불러오는 중', 실패면 그 문구(403 은 권한 판), 비었으면 `empty`.
 * 셋 다 아니면 아무것도 안 그린다 — 본문은 부르는 쪽이 그린다
 */
export function ListState({ loaded, failed, empty, isEmpty, loading = '목록을 불러오는 중이에요…', onRetry }: {
  loaded: boolean; failed: LoadFail | null; empty: string; isEmpty: boolean; loading?: string; onRetry?: () => void;
}) {
  if (failed?.kind === '403') return <AdminDenied kind="403" />;
  if (failed) {
    return (
      <Note tone="warn" title={failed.text}
        actions={onRetry ? <button type="button" className="px-btn px-btn--sm px-skin" onClick={onRetry}>다시 불러오기</button> : null} />
    );
  }
  if (!loaded) return <p className="px-body px-muted" aria-busy="true">{loading}</p>;
  if (isEmpty) return <p className="px-body px-muted">{empty}</p>;
  return null;
}

export function SearchBox({ value, placeholder, label, onChange }: { value: string; placeholder: string; label: string; onChange: (next: string) => void }) {
  return (
    <label className="px-input px-skin adm-search">
      <PixelIcon name="search" />
      <input type="search" value={value} placeholder={placeholder} aria-label={label} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function KvList({ rows, tight }: { rows: readonly { label: string; value: string }[]; tight?: boolean }) {
  const size = tight ? 'px-caption' : 'px-body';
  return (
    <dl className={`adm-kv${tight ? ' adm-kv--tight' : ''}`}>
      {rows.map((row) => (
        <div key={row.label} className="adm-kv__row">
          <dt className={size}>{row.label}</dt>
          <dd className={`${size} px-mono`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RankList({ rows }: { rows: readonly { key: string; label: string; value: string }[] }) {
  return (
    <ol className="adm-list">
      {rows.map((row, index) => (
        <li key={row.key} className="adm-list__row">
          <span className="px-mono adm-list__no" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="px-body adm-list__name">{row.label}</span>
          <span className="px-caption px-mono adm-list__value">{row.value}</span>
        </li>
      ))}
    </ol>
  );
}

export function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  if (!text) return null;
  return (
    <p className="px-toast px-skin px-toast--good" role="status">
      {text}
      <button type="button" className="px-btn px-btn--sm px-skin" onClick={onClose}>닫기</button>
    </p>
  );
}

/** 'N개' · 'N명' — 숫자는 관문(count)을 지난다 */
export const unit = (value: unknown, suffix: string) => `${count(value)}${suffix}`;
