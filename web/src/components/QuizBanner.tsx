// ─────────────────────────────────────────────────────────────────────────────
// components/QuizBanner.tsx — '오늘의 실루엣 퀴즈' 배너, 모든 화면의 상단 바 아래 한 줄 (2026-09-28)
//
// 처음엔 홈 카드였다. 주인 결정으로 **배너**가 되어 어느 화면에서든 선다 — 도감을 보다가도, 덱을 짜다가도 한 줄이 묻는다.
// 왼쪽에 검은 실루엣, 가운데에 "누구일까요?", 오른쪽에 맞히기 단추와 ✕. ✕ 는 오늘 하루만 접는다 — 내일은 새 문제라 다시 선다.
//
// 맞히기 단추는 검색 팔레트를 퀴즈 모드로 연다 — 이름을 쳐서 고르면 팔레트가 판정한다(stores/quiz.ts).
// 틀린 만큼 힌트(타입 → 번호대 → 첫 글자)가 배너 안에 선다. 맞히면 실루엣이 걷히고 이름과 연속 기록이 선다.
// 문제는 도감 이름표만 있으면 정한다(useDexSoft) — 오기 전엔 배너를 안 그린다. 날이 바뀌면(한국 자정) 문제도 바뀐다
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useDexSoft } from '../lib/data';
import { BASE } from '../lib/base';
import { isHidden, kstDayKey, pickDaily, quizHints, quizPool } from '../lib/dailyQuiz';
import { useQuizStore } from '../stores/quiz';
import { openSearch } from '../stores/search';
import { track } from '../lib/track';
import { count } from '../lib/cell';
import type { OpenMon } from '../lib/mon';

const HINT_LABEL = { type: '타입', band: '도감 번호', initial: '첫 글자' } as const;

export default function QuizBanner({ onOpen }: { onOpen: OpenMon }) {
  const dex = useDexSoft();
  const record = useQuizStore((s) => s.record);
  const setTarget = useQuizStore((s) => s.setTarget);
  const load = useQuizStore((s) => s.load);
  const hide = useQuizStore((s) => s.hide);
  // 오늘은 state 다 — 탭을 한국 자정 넘게 열어 두면 문제와 기록이 어제 것으로 남는다. 1분마다 · 탭에 돌아올 때 다시 본다
  const [day, setDay] = useState(() => kstDayKey());
  useEffect(() => {
    const check = () => setDay((now) => { const next = kstDayKey(); return next === now ? now : next; });
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, []);
  const target = useMemo(() => (dex ? pickDaily(quizPool(dex.DEX_DATA.names, dex.DEX_DATA.forms), day) : null), [dex, day]);
  // 저장소는 붙은 뒤에 읽는다 — 서버 그림과 첫 그림이 같아야 한다(하이드레이션). 날이 바뀌어도 다시 굴린다
  useEffect(() => { load(); }, [load, day]);
  useEffect(() => { setTarget(target); }, [target, setTarget]);
  if (!dex || !target || isHidden(record)) return null;

  const hints = quizHints(target, record.misses);
  const typeName = (key: string) => dex.TYPE_KO[key as keyof typeof dex.TYPE_KO] ?? key;
  const hintText = (hint: { kind: keyof typeof HINT_LABEL; value: string }) =>
    hint.kind === 'type' ? hint.value.split(' · ').map(typeName).join(' · ') : hint.value;

  return (
    <section className={`quiz-banner${record.solved ? ' is-solved' : ''}`} aria-label="오늘의 실루엣 퀴즈">
      <div className="quiz-banner__inner">
        <div className="quiz-banner__art" aria-hidden="true">
          <img className="quiz-banner__sprite" src={`${BASE}sprites/${target.sprite}.png`} alt="" width="64" height="64" decoding="async" />
        </div>
        <div className="quiz-banner__body">
          <span className="quiz-banner__kicker">오늘의 실루엣 퀴즈</span>
          {record.solved ? (
            <p className="quiz-banner__line">
              <b>{`정답! ${target.name}`}</b>
              <span className="quiz-banner__sub">
                {record.misses ? `${count(record.misses + 1)}번 만에 맞혔어요` : '한 번에 맞혔어요'}
                {record.streak > 1 ? <em className="quiz-banner__streak">{` · 🔥 ${count(record.streak)}일 연속`}</em> : null}
                {' · 내일 새 문제가 나와요'}
              </span>
            </p>
          ) : (
            <p className="quiz-banner__line">
              <b>누구일까요?</b>
              <span className="quiz-banner__sub">
                {hints.length
                  ? hints.map((hint) => <span key={hint.kind} className="quiz-banner__hint"><i>{HINT_LABEL[hint.kind]}</i>{hintText(hint)}</span>)
                  : '이름을 검색해서 맞혀 보세요'}
                {record.streak > 0 ? <em className="quiz-banner__streak">{` · 🔥 ${count(record.streak)}일 연속`}</em> : null}
              </span>
            </p>
          )}
        </div>
        <div className="quiz-banner__actions">
          {record.solved ? (
            <button type="button" className="quiz-banner__btn" onClick={() => onOpen({ sprite: target.sprite, name: target.name, types: target.types })}>상세 보기</button>
          ) : (
            <button type="button" className="quiz-banner__btn quiz-banner__btn--primary"
              onClick={() => { track('quiz_open', { misses: record.misses }); openSearch('quiz'); }}>검색해서 맞히기</button>
          )}
          <button type="button" className="quiz-banner__close" aria-label="오늘의 퀴즈 접기" onClick={() => { track('quiz_hide', { solved: record.solved ? 1 : 0 }); hide(); }}>✕</button>
        </div>
      </div>
    </section>
  );
}
