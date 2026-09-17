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

/** `**굵게**` 를 실제 <b> 로 — 문법이 하나뿐이라 파서도 한 줄이면 된다 (v3 releaseItemNode) */
function Item({ text }: { text: string }) {
  return <li>{String(text).split('**').map((part, index) => (index % 2 ? <b key={index}>{part}</b> : part))}</li>;
}

export default function Release() {
  const { data } = useRelease();
  // 들어온 순간 읽음 처리한다 — 빨간 점은 '아직 안 본 판이 있다' 는 뜻이라 여기서 끝나야 한다
  useEffect(() => { markReleaseSeen(data.RELEASE_VER); }, [data.RELEASE_VER]);
  return (
    <div className="page__body" id="page-release" data-route="release">
      {data.RELEASE_NOTES.map((group, index) => (
        <section key={group.date} className="release__sec">
          {/* 맨 위(가장 최신) 묶음에만 NEW 를 단다 */}
          <h2>{group.date}{index === 0 ? <span className="tag tag--gmax">NEW</span> : ''}</h2>
          <ul>{group.items.map((text, at) => <Item key={at} text={text} />)}</ul>
        </section>
      ))}
    </div>
  );
}
