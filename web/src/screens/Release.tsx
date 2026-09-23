// ─────────────────────────────────────────────────────────────────────────────
// screens/Release.tsx — 🎉 패치노트 (v3 components/pages.js renderReleasePage)
//
// moncamp 이 바뀐 일을 적는다. 게임 쪽 변경(📢 게임 업데이트)과는 따로 센다.
//
// **본문은 제 묶음으로 갈라 둔다** (data/release.json) — 160판 × 여러 줄이라 50KB 인데
// 첫 화면은 그중 한 글자도 안 쓴다. v3 도 같은 이유로 app-lazy.js 로 뺐다.
//
// 이 화면을 열면 '읽음' 으로 기록해 ☰ 의 빨간 점을 지운다 (v3 markReleaseSeen).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useRelease } from '../lib/data';
import { markReleaseSeen } from '../lib/release';
import { useLang } from '../lib/useLang';
import KoOnlyNote from '../components/KoOnlyNote';
import type { ReleaseGroup } from '../types/data';

/** `**굵게**` 를 실제 <b> 로 — 문법이 하나뿐이라 파서도 한 줄이면 된다 (v3 releaseItemNode) */
function Item({ text }: { text: string }) {
  return <li>{String(text).split('**').map((part, index) => (index % 2 ? <b key={index}>{part}</b> : part))}</li>;
}


/**
 * 영문판을 찾는 열쇠. 대개 date 그대로지만, 버전 없이 날짜만 적힌 초기 묶음은 같은 날짜가 둘이라
 * 그것만으로는 갈리지 않는다 — 같은 날짜의 두 번째부터 ' (2)' · ' (3)' 을 붙인다 (v3 releaseKey).
 */
function releaseKey(notes: ReleaseGroup[], group: ReleaseGroup): string {
  const same = notes.filter((other) => other.date === group.date);
  const index = same.indexOf(group);
  return index > 0 ? `${group.date} (${index + 1})` : group.date;
}

export default function Release() {
  const { data } = useRelease();
  const now = useLang();
  // 들어온 순간 읽음 처리한다 — 빨간 점은 '아직 안 본 판이 있다' 는 뜻이라 여기서 끝나야 한다
  useEffect(() => { markReleaseSeen(data.RELEASE_VER); }, [data.RELEASE_VER]);
  // **패치노트는 사전이 못 옮긴다** — `**굵게**` 가 섞인 문장 덩어리라 그려진 뒤에는 노드가 여럿으로
  // 쪼개져 문장을 못 맞춘다. 그래서 날짜(= 묶음 키)로 통째 짝지은 영문판을 갈아 끼운다.
  // 없는 날짜는 한국어 그대로 나간다 — 빠진 줄을 영어처럼 보이게 지어내지 않는다
  const items = (group: ReleaseGroup) =>
    (now === 'en' ? data.RELEASE_NOTES_EN?.[releaseKey(data.RELEASE_NOTES, group)] : null) ?? group.items;
  const koreanLeft = now === 'en'
    && data.RELEASE_NOTES.some((group) => !data.RELEASE_NOTES_EN?.[releaseKey(data.RELEASE_NOTES, group)]);
  // 본문은 사전을 타지 않는다(data-i18n="off") — 옮기는 일은 영문판이 통째로 한다.
  // 사전에 맡기면 문장이 노드로 쪼개져 반쯤 영어인 줄이 나온다
  return (
    <div className="page__body" id="page-release" data-route="release" data-i18n="off">
      {koreanLeft ? <KoOnlyNote /> : null}
      {data.RELEASE_NOTES.map((group, index) => (
        <section key={group.date} className="release__sec">
          {/* 맨 위(가장 최신) 묶음에만 NEW 를 단다 */}
          <h2>{group.date}{index === 0 ? <span className="tag tag--gmax">NEW</span> : ''}</h2>
          <ul>{items(group).map((text, at) => <Item key={at} text={text} />)}</ul>
        </section>
      ))}
    </div>
  );
}
