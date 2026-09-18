// ─────────────────────────────────────────────────────────────────────────────
// components/KoOnlyNote.tsx — "이 화면은 한국어로 둡니다" 한 줄 (v3 i18nKoOnlyNote)
//
// 어디에 붙나 — 패치노트 · 일정표 · 개인정보처리방침 · 이용약관 · 게임 업데이트.
// 앞의 둘은 한국 서버 일정과 한국어 공지를 그대로 옮긴 콘텐츠이고,
// 뒤의 둘은 **한국어 원문이 효력을 갖는 문서**다. 옮긴 글이 원문과 어긋나면 그게 더 위험하다.
//
// **영어일 때만 보인다 — 그 판단은 CSS 가 한다** (`:root[lang="en"] .i18n-note`).
// 그래서 줄은 늘 서고, 안의 글자는 사전을 타지 않는다(data-i18n="off").
// kind='kst' 는 일정표용 — 한국 서버 기준임을 함께 밝힌다 (지역마다 이벤트 날짜가 다르다).
// ─────────────────────────────────────────────────────────────────────────────
import { KO_ONLY_NOTE, KST_NOTE } from '../lib/i18n';

export default function KoOnlyNote({ kind }: { kind?: 'kst' | 'ko' }) {
  return <p className="note i18n-note" data-i18n="off">{kind === 'kst' ? KST_NOTE : KO_ONLY_NOTE}</p>;
}
