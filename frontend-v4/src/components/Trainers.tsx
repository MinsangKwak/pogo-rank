// ─────────────────────────────────────────────────────────────────────────────
// components/Trainers.tsx — 👥 트레이너 코드 (v3 components/trainers.js 의 조회 쪽)
//
// **값은 저장소가 아니라 Firestore 에만 둔다.** 트레이너 코드는 친구 요청이 그대로 들어오는
// 개인 식별값이고, 이 저장소는 공개라 파일로 두면 검색만으로 누구나 읽는다.
// 읽기 권한은 화면이 아니라 규칙(firestore.rules)이 막는다 — 여기서는 규칙이 준 것만 그린다.
//
// **승인 전에는 항목 자체를 감춘다.** "로그인하면 보입니다" 같은 안내조차 두지 않는다 —
// 코드가 있다는 사실을 승인 안 된 사람에게 알릴 이유가 없다.
//
// 등록·삭제(코드 관리)는 옮기지 않았다 — 관리자 화면은 지금 moncamp.kr 에 있다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { PxIcon } from './PxIcon';

interface Trainer { id: string; name: string; code: string; order?: number }

/** 보기용 4자리 묶음. 복사할 때는 공백을 다시 없앤다 */
function fmtCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length === 12 ? `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}` : code;
}

function CopyButton({ code }: { code: string }) {
  const [label, setLabel] = useState('복사');
  const copy = async () => {
    const digits = code.replace(/\D/g, '');   // 게임 입력창에 맞게 숫자만
    let ok = false;
    try { await navigator.clipboard.writeText(digits); ok = true; } catch { ok = false; }
    setLabel(ok ? '복사됨 ✓' : '복사 실패');
    setTimeout(() => setLabel('복사'), 1500);
  };
  return <button className="copy-btn" onClick={() => void copy()}>{label}</button>;
}

export default function Trainers() {
  const { enabled, status, admin, api } = useAuthStore();
  const [rows, setRows] = useState<Trainer[] | null>(null);
  const visible = enabled && status === 'ok';

  useEffect(() => {
    if (!visible || !api) { setRows(null); return; }
    let alive = true;
    void api.listDocs('trainers').then((docs) => {
      if (!alive) return;
      // order 가 없는 문서는 999 로 뒤로 밀고, 같은 순번끼리는 이름 가나다순 (v3 와 같은 규칙)
      const list = docs
        .filter((one): one is Trainer & Record<string, unknown> => typeof one['name'] === 'string' && typeof one['code'] === 'string')
        .map((one) => ({ id: one.id, name: one.name, code: one.code, order: typeof one['order'] === 'number' ? one['order'] : undefined }))
        .sort((left, right) => (left.order ?? 999) - (right.order ?? 999) || left.name.localeCompare(right.name, 'ko'));
      setRows(list);
    });
    return () => { alive = false; };
  }, [visible, api]);

  if (!visible) return null;
  return (
    <details className="schedule" id="trainer-acc">
      <summary>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="👥" /></span>
        <span className="drawer__label">트레이너 코드</span>
      </summary>
      <div className="schedule__body" id="trainer-list">
        {rows === null ? null : rows.length === 0
          ? <p className="detail__foot">{admin ? '아직 등록된 코드가 없어요. 코드 관리는 moncamp.kr 에서 해요.' : '아직 등록된 코드가 없어요.'}</p>
          : (
            <>
              {rows.map((one) => (
                <div className="trainer__row" key={one.id}>
                  <b>{one.name}</b><code>{fmtCode(one.code)}</code><CopyButton code={one.code} />
                </div>
              ))}
              <p className="detail__foot">공백 없는 12자리로 복사돼요 — 게임의 친구 추가 화면에 바로 붙여넣으면 돼요.</p>
            </>
          )}
      </div>
    </details>
  );
}
