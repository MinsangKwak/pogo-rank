// ─────────────────────────────────────────────────────────────────────────────
// Typography.stories.tsx — 글꼴 두 줄기와 그 줄기가 쓸 수 있는 크기
//
// **글자 크기는 글꼴로 갈린다** (CLAUDE.md §7). 이 서비스는 두 글꼴을 쓰고 각자
// 쓸 수 있는 칸이 다르다 — Galmuri 에 12·16px 을 주면 11·14 격자의 정수배가 아니라
// 픽셀이 뭉개진다. 글로 적힌 그 규칙이 여기서는 **눈에 보인다.**
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FONT_SIZES, Label, Stack, Text } from '../ds';
import './story.css';

const meta = {
  id: 'foundations-type',
  title: '기초/글자',
  parameters: {
    docs: { description: { component: '읽는 글은 `<Text>`(Pretendard · 12·14·16), 크롬은 `<Label>`(Galmuri · 14·22·28·42). 짝이 아닌 조합은 타입이 막는다.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 읽는 글 — 여러 줄을 읽는 자리. 12px 이 최소선이다 */
export const Read: Story = {
  name: '읽는글',
  render: () => (
    <div className="sb-ladder">
      {(['sub', 'body', 'lead'] as const).map((size) => (
        <div className="sb-ladder__row" key={size}>
          <code className="sb-ladder__key">--fs-{size}</code>
          <Text size={size}>다이맥스 티어표를 한 화면에서 봅니다</Text>
        </div>
      ))}
    </div>
  ),
};

/** 크롬 — 칩 · 탭 · 버튼 · 제목. 11·14px 의 정수배만 있다 */
export const Chrome: Story = {
  name: '크롬',
  render: () => (
    <div className="sb-ladder">
      {(['body', 'sec', 'title', 'hero'] as const).map((size) => (
        <div className="sb-ladder__row" key={size}>
          <code className="sb-ladder__key">--fs-{size}</code>
          <Label size={size}>맥스 배틀</Label>
        </div>
      ))}
    </div>
  ),
};

/** 흐림 네 단 — Galmuri 쪽에서 작은 글자가 필요하면 **크기 대신 색으로 누른다** */
export const Muting: Story = {
  name: '흐림',
  render: () => (
    <Stack gap="sm">
      {(['fg', 'ink2', 'muted', 'faint'] as const).map((tone) => (
        <Label key={tone} tone={tone}>{tone} — 크기를 줄이지 않고 색으로 누른 글자</Label>
      ))}
    </Stack>
  ),
};

/** 뜻이 있는 글자 — 상향 · 하향 · 주의 · 특별. 장식으로 칠하지 않는다 */
export const MeaningText: Story = {
  name: '의미색글자',
  render: () => (
    <Stack gap="sm">
      <Text tone="good">상향 · 내성 — good</Text>
      <Text tone="warn">하향 · 약점 — warn</Text>
      <Text tone="caution">대기 · A티어 — caution</Text>
      <Text tone="point">메가 · 전설 · S티어 — point</Text>
      <Text tone="brand">지금 보고 있는 곳 — brand</Text>
    </Stack>
  ),
};

/** 크기 여섯 단을 한 장에 — 사이가 비어 보이면 굵기로 가른다 (그것이 글꼴의 성질이다) */
export const Ladder: Story = {
  name: '사다리전체',
  render: () => (
    <div className="sb-ladder">
      {FONT_SIZES.tokens.map((token) => (
        <div className="sb-ladder__row" key={token.name}>
          <code className="sb-ladder__key">{token.name}</code>
          <span style={{ fontSize: `var(${token.name})` }}>가나다 Moncamp 123</span>
          <Text size="sub" tone="muted">{token.use}</Text>
        </div>
      ))}
    </div>
  ),
};
