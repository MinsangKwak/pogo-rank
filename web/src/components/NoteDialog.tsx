// ─────────────────────────────────────────────────────────────────────────────
// components/NoteDialog.tsx — 기준 안내 팝업 (v6 D11 '순위와 계산 기준')
//
// 글은 lib/notes.ts 의 ROUTE_NOTE 하나다 — 시트의 접이식과 같은 문장을 두 자리에서 읽는다.
// 지금 보는 화면의 기준을 먼저, 그 아래 세 판(D-MAX · PvE · PvP)의 기준을 번호로 늘어놓는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { ROUTE_NOTE, routeNote } from '../lib/notes';
import { routeById } from '../routes';
import { PixelIcon } from './PixelIcon';

const RANK_NOTES: [string, string][] = [
  ['D-MAX', '딜러는 맥스 피해량, 탱커는 내구성과 EHP로 비교합니다. 두 점수는 직접 비교하지 않아요.'],
  ['레이드 · PvE', '공격 기술 조합, DPS와 TDO를 함께 확인합니다.'],
  ['배틀 · PvP', '리그 CP 제한, 기술과 개체값에 따라 결과가 달라집니다.'],
  ['계산기', '계산기의 수치는 실전 결과를 보장하지 않습니다.'],
];

export default function NoteDialog({ route, onClose }: { route: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);
  const name = routeById(route)?.title ?? routeById(route)?.nav ?? '지금 보는 화면';
  const own = ROUTE_NOTE[route] ? routeNote(route) : '';
  return (
    <dialog ref={ref} className="px-dialog" id="note-dialog" aria-labelledby="note-dialog-title" onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="px-dialog__panel px-skin">
        <header className="px-dialog__head">
          <div>
            <h2 className="px-heading" id="note-dialog-title">순위와 계산 기준</h2>
            <p className="px-caption">{`${name} · 지금 보는 화면의 기준 안내`}</p>
          </div>
          <button type="button" className="px-btn px-btn--icon px-skin" aria-label="닫기" onClick={onClose}><PixelIcon name="close" /></button>
        </header>
        <div className="px-dialog__body">
          {own ? <p className="px-body px-note px-skin px-skin--sunk">{own}</p> : null}
          <ol className="px-notelist">
            {RANK_NOTES.map(([head, body], index) => (
              <li key={head}>
                <span className="px-notelist__no px-mono">{String(index + 1).padStart(2, '0')}</span>
                <span><b>{head}: </b>{body}</span>
              </li>
            ))}
          </ol>
        </div>
        <footer className="px-dialog__foot">
          <button type="button" className="px-btn px-btn--primary px-btn--block px-skin" onClick={onClose}>확인했어요</button>
        </footer>
      </div>
    </dialog>
  );
}
