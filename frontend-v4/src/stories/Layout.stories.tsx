// ─────────────────────────────────────────────────────────────────────────────
// Layout.stories.tsx — 간격 격자
//
// v4.3.4 에 간격 1,484군데를 4px 격자로 스냅했다. 스냅만 해 두면 다음 화면이 또 격자 밖
// 값을 적으므로, `<Stack>`·`<Inline>` 의 `gap` 은 여섯 칸뿐이다 — **격자 밖 값이 안 들어간다.**
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline, SPACE, Stack, Text, space, type SpaceStep } from '../ds';
import './story.css';

const meta = {
  id: 'foundations-space',
  title: '기초/간격' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 다섯 칸 — 막대 길이가 곧 그 값이다. 거리가 같으면 **넓은 쪽**으로 붙인다 */
export const Grid: Story = {
  name: '격자',
  render: () => (
    <Stack gap="md">
      {SPACE.tokens.map((token) => (
        <Inline key={token.name} gap="md" align="center">
          <code className="sb-ladder__key">{token.name}</code>
          <span className="sb-bar" style={{ width: `var(${token.name})` }} />
          <Text size="sub" tone="muted">{token.use}</Text>
        </Inline>
      ))}
    </Stack>
  ),
};

/** 세로 쌓기 — 기본은 덩어리 사이(md) */
export const Stacking: Story = {
  name: '쌓기',
  render: () => (
    <Inline gap="lg" align="top">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as SpaceStep[]).map((gap) => (
        <Stack key={gap} gap="xs">
          <Text size="sub" tone="muted">gap={gap} ({space(gap)})</Text>
          <Stack gap={gap}>
            {[1, 2, 3].map((n) => <span key={n} className="sb-bar" style={{ width: '8rem' }} />)}
          </Stack>
        </Stack>
      ))}
    </Inline>
  ),
};

/** 가로 늘어놓기 — 넘치면 접는 것이 기본이다. 칩 줄이 잘리면 고를 수 없게 된다 */
export const Inlining: Story = {
  name: '늘어놓기',
  render: () => (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sub" tone="muted">justify=between — 제목과 도구를 양끝으로</Text>
        <Inline justify="between" style={{ border: '1px solid var(--line)', padding: 'var(--space-sm)' }}>
          <Text>왼쪽</Text><Text>오른쪽</Text>
        </Inline>
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">align=baseline — 숫자와 단위를 글줄에 맞춘다</Text>
        <Inline align="baseline">
          <span style={{ fontSize: 'var(--fs-title)' }}>248</span>
          <Text size="sub" tone="muted">맥스 피해</Text>
        </Inline>
      </Stack>
    </Stack>
  ),
};
