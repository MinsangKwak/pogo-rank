// ─────────────────────────────────────────────────────────────────────────────
// .storybook/preview.tsx — 모든 스토리가 공유하는 자리
//
// 셋을 깐다.
//   1. 화면과 **같은 CSS** (src/styles.ts 한 줄). 스토리북만 따로 스타일을 쓰면
//      도면과 화면이 갈라진다 — 그 순간 스토리북은 믿을 수 없는 그림이 된다
//   2. 테마 전환. 라이트·다크가 한 버튼 거리에 있어야 §1-b 의 사고(흰 글자가 흰 바탕에)를
//      만드는 중에 본다. 배포 전 42장 훑기는 이미 난 사고를 잡을 뿐이다
//   3. 접근성 검사 — 명암비 잣대는 §1-b 와 같은 **3.0**. "읽기 불편함" 이 아니라
//      "아예 안 보임" 을 잡는 그물이라서다
// ─────────────────────────────────────────────────────────────────────────────
import type { Decorator, Preview } from '@storybook/react-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../src/styles';

// 스토리 하나가 판 위에 놓이게 여백을 준다 — 카드 그림자가 잘리면 박테가 한 겹으로 보인다
const frame: Decorator = (Story) => (
  <div style={{ background: 'var(--bg)', color: 'var(--fg)', padding: '2.4rem', minHeight: '100%' }}>
    <Story />
  </div>
);

const preview: Preview = {
  decorators: [
    frame,
    withThemeByDataAttribute({
      // index.html 이 <html data-theme="light"> 로 시작한다 — 같은 자리에 같은 값을 쓴다.
      // **이름을 한글로 두지 않는다.** globals 는 주소로 오가는데, 한글 값은 거기서 지워져
      // 기본 테마로 조용히 떨어진다 (실측: `?globals=theme:다크` 가 라이트로 열렸다).
      // 그러면 라이트·다크를 훑는 검문이 라이트를 두 번 보고 통과한다
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: {
      // 색 대비는 §1-b 와 같은 잣대로 본다. 통과/실패로 배포를 세우지는 않는다 —
      // 그 일은 scripts/check_contrast.mjs 가 배포 전에 42장으로 한다
      config: { rules: [{ id: 'color-contrast', enabled: true }] },
    },
    docs: { toc: true },
  },
};

export default preview;
