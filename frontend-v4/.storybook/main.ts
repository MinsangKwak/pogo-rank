// ─────────────────────────────────────────────────────────────────────────────
// .storybook/main.ts — 스토리북 설정
//
// **왜 스토리북인가.** 이 서비스의 디자인 그물은 셋이었다 (CLAUDE.md §1) —
// 관문(lib/cell.ts) · 단위 검사 · 배포 전 46장 훑기. 셋 다 "이미 만들어진 화면" 을 본다.
// 조각 하나를 **만드는 동안** 라이트·다크·빈 값·긴 이름을 다 보려면 화면을 띄우고
// 그 자리까지 눌러 들어가야 했다. 스토리북은 그 조각 하나만 세워 둔다.
//
// 빌드는 `storybook-static/` 에 떨어진다 — 배포물이 아니라 팀이 보는 도면이다.
// ─────────────────────────────────────────────────────────────────────────────
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',    // 토큰 표 · 사용법을 같은 화면에서 읽는다
    '@storybook/addon-a11y',    // 명암비·라벨을 조각 단위로 잡는다 (§1-b 와 같은 잣대)
    '@storybook/addon-themes',  // data-theme 을 갈아 끼운다 — 라이트·다크가 한 버튼 거리
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  // 수집을 끈다 — 이 저장소는 사람을 가리키는 값을 어느 표에도 두지 않는다 (CLAUDE.md §3)
  core: { disableTelemetry: true },
  // 스토리북의 정적 파일 뿌리는 앱과 같다 — 스프라이트·데이터가 같은 주소로 읽힌다
  staticDirs: ['../public'],
  viteFinal: (vite) => {
    // src/styles.ts 가 `../../frontend/styles/*` 를 싣는다 — 뿌리 바깥이라 기본값으로는 막힌다.
    // v3 CSS 를 안 실으면 스토리북의 조각만 v3 스킨 없이 그려져, 도면과 화면이 달라진다
    vite.server = { ...vite.server, fs: { ...vite.server?.fs, allow: ['..', '../..'] } };
    return vite;
  },
};

export default config;
