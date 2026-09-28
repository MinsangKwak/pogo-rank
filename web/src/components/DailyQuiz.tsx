// ─────────────────────────────────────────────────────────────────────────────
// components/DailyQuiz.tsx — 홈의 '오늘의 실루엣 퀴즈' 카드 (2026-09-28)
//
// 검은 실루엣 하나, "누구일까요?", 맞히기 단추. 단추는 검색 팔레트를 퀴즈 모드로 연다 —
// 이름을 쳐서 고르면 팔레트가 정답을 판정하고(stores/quiz.ts), 맞히면 실루엣이 걷히며 상세가 뜬다.
// 틀린 만큼 힌트가 열린다(타입 → 번호대 → 첫 글자). 연속으로 맞힌 날 수는 이 브라우저에 남는다.
//
// 문제는 도감 이름표만 있으면 정한다(useDexSoft) — 데이터를 기다리는 동안은 카드 자체를 안 그린다.
// 한 사람이 몇 번을 열어도 오늘 문제는 하나다 (lib/dailyQuiz.ts pickDaily)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo } from 'react';
import { useDexSoft } from '../lib/data';
import { BASE } from '../lib/base';
import { kstDayKey, pickDaily, quizHints, quizPool } from '../lib/dailyQuiz';
import { useQuizStore } from '../stores/quiz';
import { openSearch } from '../stores/search';
import { track } from '../lib/track';
import { count } from '../lib/cell';
import type { OpenMon } from '../lib/mon';

const HINT_LABEL = { type: '타입', band: '도감 번호', initial: '첫 글자' } as const;

export default function DailyQuiz({ onOpen }: { onOpen: OpenMon }) {
  const dex = useDexSoft();
  const record = useQuizStore((s) => s.record);
  const setTarget = useQuizStore((s) => s.setTarget);
  const load = useQuizStore((s) => s.load);
  const target = useMemo(() => (dex ? pickDaily(quizPool(dex.DEX_DATA.names, dex.DEX_DATA.forms), kstDayKey()) : null), [dex]);
  // 저장소는 붙은 뒤에 읽는다 — 서버 그림과 첫 그림이 같아야 한다(하이드레이션)
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setTarget(target); }, [target, setTarget]);
  if (!dex || !target) return null;

  const hints = quizHints(target, record.misses);
  const typeName = (key: string) => dex.TYPE_KO[key as keyof typeof dex.TYPE_KO] ?? key;
  const hintText = (hint: { kind: keyof typeof HINT_LABEL; value: string }) =>
    hint.kind === 'type' ? hint.value.split(' · ').map(typeName).join(' · ') : hint.value;

  return (
    <section className={`quiz${record.solved ? ' is-solved' : ''}`} aria-label="오늘의 실루엣 퀴즈">
      <div className="quiz__art" aria-hidden="true">
        <img className="quiz__sprite" src={`${BASE}sprites/${target.sprite}.png`} alt="" width="96" height="96" decoding="async" />
      </div>
      <div className="quiz__body">
        <span className="quiz__kicker">오늘의 실루엣 퀴즈</span>
        {record.solved ? (
          <>
            <h3 className="quiz__title">{`정답! ${target.name}`}</h3>
            <p className="quiz__copy">
              {record.misses ? `${count(record.misses + 1)}번 만에 맞혔어요` : '한 번에 맞혔어요'}
              {record.streak > 1 ? <b className="quiz__streak">{` · 🔥 ${count(record.streak)}일 연속`}</b> : null}
            </p>
            <div className="quiz__actions">
              <button type="button" className="quiz__btn" onClick={() => onOpen({ sprite: target.sprite, name: target.name, types: target.types })}>상세 보기</button>
              <span className="quiz__next">내일 새 문제가 나와요</span>
            </div>
          </>
        ) : (
          <>
            <h3 className="quiz__title">이 포켓몬은 누구일까요?</h3>
            <p className="quiz__copy">
              이름을 검색해서 맞혀 보세요
              {record.streak > 0 ? <b className="quiz__streak">{` · 🔥 ${count(record.streak)}일 연속`}</b> : null}
            </p>
            {hints.length ? (
              <ul className="quiz__hints" aria-label="힌트">
                {hints.map((hint) => <li key={hint.kind}><span className="quiz__hint-k">{HINT_LABEL[hint.kind]}</span>{hintText(hint)}</li>)}
              </ul>
            ) : null}
            <div className="quiz__actions">
              <button type="button" className="quiz__btn quiz__btn--primary"
                onClick={() => { track('quiz_open', { misses: record.misses }); openSearch('quiz'); }}>정답 맞히기</button>
              {record.misses ? <span className="quiz__next">{`틀린 횟수 ${count(record.misses)} · 힌트 ${count(hints.length)}/3`}</span> : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
