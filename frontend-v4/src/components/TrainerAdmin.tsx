// ─────────────────────────────────────────────────────────────────────────────
// components/TrainerAdmin.tsx — 🛠 트레이너 코드 관리 (v3 trainers.js openTrainerAdmin)
//
// **한 명씩 받는 폼 대신 붙여넣기다.** 코드는 보통 단톡방에서 여러 줄로 한꺼번에 온다 —
// 오는 모양 그대로 받는 것이 옮겨 적는 것보다 빠르고 덜 틀린다.
//
// 관리자 둘 다 쓸 수 있다 (firestore.rules 의 trainers 는 isAdmin).
// 문서 id 가 이름이라 같은 이름을 다시 저장하면 덮어쓴다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/auth';

interface Trainer { id: string; name: string; code: string }

/** 보기용 4자리 묶음 (components/Trainers.tsx 와 같은 규칙) */
function fmtCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length === 12 ? `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}` : code;
}

/**
 * 한 줄을 이름과 코드로 가른다 (v3 와 같은 규칙).
 *   코드 숫자·공백·하이픈이 12자 이상 이어지는 첫 덩어리에서 숫자만 남긴다
 *        ("0000 0000 0000" · "0000-0000-0000" · "000000000000" 다 받는다)
 *   이름 그 덩어리 앞부분. 문서 id 로 쓰므로 경로 구분자 '/' 는 공백으로 바꾼다
 */
function parseLine(line: string): { name: string; code: string } | null {
  const digits = (/[\d\s-]{12,}/.exec(line)?.[0] ?? '').replace(/\D/g, '');
  const name = line.replace(/[\d\s-]{12,}.*$/, '').trim().replace(/\//g, ' ');
  return digits.length === 12 && name ? { name, code: digits } : null;
}

// Firestore 쓰기는 연결이 없으면 끝없이 기다린다 — 그냥 await 하면 '저장 중…' 에서 멈춘 것처럼 보인다
const WRITE_LIMIT = 10000;
function withLimit<T>(work: Promise<T>): Promise<T> {
  return Promise.race([work, new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('응답 없음(네트워크 확인)')), WRITE_LIMIT);
  })]);
}

export default function TrainerAdmin({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { admin, api } = useAuthStore();
  const box = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Trainer[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('이름과 12자리 트레이너 코드를 한 줄에 하나씩 입력해 주세요. 같은 이름이 있으면 기존 코드를 변경해요.');

  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);

  const load = useCallback(async () => {
    if (!api) return;
    const docs = await api.listDocs('trainers');
    setRows(docs
      .filter((one) => typeof one['name'] === 'string' && typeof one['code'] === 'string')
      .map((one) => ({ id: one.id, name: one['name'] as string, code: one['code'] as string }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ko')));
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (!admin || !api) return null;

  const remove = async (one: Trainer) => {
    if (!window.confirm(`${one.name} 코드를 삭제할까요?`)) return;
    await api.deleteDoc(`trainers/${one.id}`).catch(() => { /* 실패하면 목록이 그대로 남는다 */ });
    await load();
    onChanged();
  };

  const save = async () => {
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) { setMessage('입력된 줄이 없어요.'); return; }
    setBusy(true);   // 저장 중에는 잠근다 — 같은 줄이 두 번 들어가지 않게
    setMessage('저장 중…');
    let saved = 0;
    const bad: string[] = [];
    const errors: string[] = [];
    for (const [index, line] of lines.entries()) {
      const one = parseLine(line);
      if (!one) { bad.push(line); continue; }
      try {
        await withLimit(api.setDoc(`trainers/${one.name}`, { name: one.name, code: one.code, order: index }));
        saved += 1;
      } catch (error) {
        errors.push(`${one.name}: ${(error as { code?: string })?.code ?? (error as Error).message}`);
      }
    }
    setBusy(false);
    const parts = [`${saved}개 저장`];
    if (bad.length) parts.push(`형식이 안 맞는 줄 ${bad.length}개`);
    if (errors.length) parts.push(`실패 ${errors.length}개 — ${errors[0]}`);
    let out = parts.join(' · ');
    // permission-denied 는 규칙에 trainers 블록이 아직 없다는 뜻이다 —
    // 관리자 본인도 막히는 유일하게 흔한 원인이라, 추측 대신 조치를 바로 적는다
    if (errors.some((one) => /permission-denied/.test(one))) {
      out += ' → Firebase 콘솔 > Firestore > 규칙에 trainers 블록을 게시했는지 확인하세요.';
    }
    setMessage(out);
    if (saved) { setText(''); await load(); onChanged(); }
  };

  return (
    <dialog className="modal" ref={box} aria-label="트레이너 코드 관리"
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="detail admin">
            <h2>🛠 트레이너 코드 관리</h2>
            <section className="detail__sec">
              <h3>{`등록된 코드 ${rows?.length ?? 0}개`}</h3>
              {rows && rows.length ? (
                <div className="admin__rows">
                  {rows.map((one) => (
                    <div className="admin__row" key={one.id}>
                      <div className="admin__who">
                        <b>{one.name}</b><span className="account__email">{fmtCode(one.code)}</span>
                      </div>
                      <div className="admin__acts">
                        <button className="uchip admin__act is-danger" onClick={() => void remove(one)}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">아직 등록된 항목이 없어요.</p>}
            </section>
            <section className="detail__sec">
              <h3>코드 붙여넣기</h3>
              <textarea className="trainer__bulk" rows={6} value={text} onChange={(event) => setText(event.target.value)}
                placeholder={'한 줄에 하나씩\n이름 0000 0000 0000\n이름2 1111 2222 3333'} />
              <p className="trainer__msg">{message}</p>
              <button className="schedule__more" disabled={busy} onClick={() => void save()}>일괄 저장</button>
            </section>
          </div>
        </div>
      </div>
    </dialog>
  );
}
