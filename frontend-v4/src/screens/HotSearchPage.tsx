// ─────────────────────────────────────────────────────────────────────────────
// HotSearchPage.tsx — 어제 많이 검색된 포켓몬 · 전체 보기 (#/hot, v4.5.11)
//
// 홈의 구역은 좁은 화면에서 한 줄만 흐른다. 다 보고 싶은 사람이 갈 곳이 여기다.
// **표를 다시 만들지 않는다** — 홈과 같은 훅·같은 조각을 쓴다 (components/HotSearch.tsx).
// 두 곳이 따로 읽으면 한쪽만 고쳐져 순위가 어긋난다.
// ─────────────────────────────────────────────────────────────────────────────
import { HotHead, HotList, useHotRows } from '../components/HotSearch';
import type { OpenMon } from '../lib/mon';

export default function HotSearchPage({ onOpen }: { onOpen: OpenMon }) {
  const { rows, source, label } = useHotRows();

  return (
    <div className="page hot-page">
      <HotHead source={source} label={label} />
      {rows.length
        ? <HotList rows={rows} onOpen={onOpen} />
        // 집계 전이거나 GA 가 조용할 수 있다. 홈은 구역을 아예 안 그리지만
        // 여기는 눌러서 들어온 화면이라 빈 채로 두면 고장으로 보인다
        : <p className="empty">아직 셀 만큼 쌓이지 않았어요. 낮 12시와 자정에 새로 세요.</p>}
      <p className="detail__foot">
        검색창에서 골라 연 포켓몬을 셉니다. 치던 글자는 세지 않고, 통계를 꺼 두신 분의 검색도 세지 않아요.
      </p>
    </div>
  );
}
