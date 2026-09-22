// ─────────────────────────────────────────────────────────────────────────────
// components/Trainers.tsx — 👥 트레이너 코드 (v3 components/trainers.js 의 조회 쪽)
//
// **값은 저장소가 아니라 DB 에만 둔다** (CLAUDE.md §3). 트레이너 코드는 친구 요청이 그대로
// 들어오는 개인 식별값이고, 이 저장소는 공개라 파일로 두면 검색만으로 누구나 읽는다.
// 읽기 권한은 화면이 아니라 **서버**가 막는다 — 여기서는 서버가 준 것만 그린다
// (`GET /v1/trainers` 는 승인된 사람에게만 200 이다).
//
// **승인 전에는 항목 자체를 감춘다.** "로그인하면 보입니다" 같은 안내조차 두지 않는다 —
// 코드가 있다는 사실을 승인 안 된 사람에게 알릴 이유가 없다.
//
// 등록·삭제는 관리자에게만 보이는 [코드 관리] 버튼이 맡는다 (components/TrainerAdmin.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { serverApi, type Trainer } from '../lib/serverApi';
import { PxIcon } from './PxIcon';
import TrainerAdmin from './TrainerAdmin';

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
  const { enabled, status, admin } = useAuthStore();
  const [rows, setRows] = useState<Trainer[] | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const visible = enabled && status === 'ok';

  useEffect(() => {
    if (!visible) { setRows(null); return; }
    let alive = true;
    // 차례는 서버가 정해 준다 (sort_order, name) — 같은 규칙을 화면에서 또 적으면 두 벌이 된다
    void serverApi.trainers()
      .then((list) => { if (alive) setRows(list); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [visible, reload]);

  if (!visible) return null;
  return (
    <details className="schedule" id="trainer-acc">
      <summary>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="👥" /></span>
        <span className="drawer__label">트레이너 코드</span>
      </summary>
      <div className="schedule__body" id="trainer-list">
        {rows === null ? null : rows.length === 0
          ? <p className="detail__foot">{admin ? '아직 등록된 코드가 없어요. 아래 “코드 관리”에서 추가하세요.' : '아직 등록된 코드가 없어요.'}</p>
          : (
            <>
              {rows.map((one) => (
                <div className="trainer__row" key={one.name}>
                  <b>{one.name}</b><code>{fmtCode(one.code)}</code><CopyButton code={one.code} />
                </div>
              ))}
              <p className="detail__foot">공백 없는 12자리 코드로 복사돼요. 게임의 친구 추가 화면에 붙여 넣어 주세요.</p>
            </>
          )}
        {admin ? (
          <button className="schedule__more" onClick={() => setManageOpen(true)}>🛠 코드 관리 (추가·삭제) →</button>
        ) : null}
        {manageOpen ? (
          <TrainerAdmin onClose={() => setManageOpen(false)} onChanged={() => setReload((now) => now + 1)} />
        ) : null}
      </div>
    </details>
  );
}
