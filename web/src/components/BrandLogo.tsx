// ─────────────────────────────────────────────────────────────────────────────
// components/BrandLogo.tsx — 텐트와 볼을 합친 도트 심벌 + 이름
//
// 클래스에 `--brand` 를 붙이는 이유 — 노트 테마(shell-notebook.css)가 `.app-bar__logo` 를
// **빨간 명패**로 만든다(바탕·그림자·::before 점). 그건 글자 로고를 위한 것이라 심벌에는
// 맞지 않는다. 씌워진 것을 하나씩 지우는 대신 **애초에 안 걸리게** 그 규칙을 좁혀 뒀다.
// id 는 그대로다 — 회귀와 지표가 `#app-logo` 를 본다.
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

export default function BrandLogo() {
  return (
    <button type="button" id="app-logo" className="app-bar__logo app-bar__logo--brand"
      aria-label="moncamp 홈" onClick={() => { go('/'); }}>
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M14 2h4v4h2v4h2v4h2v4h2v4h2v6H4v-6h2v-4h2v-4h2v-4h2V6h2z" fill="currentColor" />
        <path d="M12 16h8v2h2v6h-2v2h-8v-2h-2v-6h2z" fill="var(--surface)" />
        <path d="M10 20h12v2H10zM14 18h4v6h-4z" fill="currentColor" />
        <path d="M15 20h2v2h-2z" fill="var(--surface)" />
      </svg>
      <span>moncamp</span>
    </button>
  );
}
