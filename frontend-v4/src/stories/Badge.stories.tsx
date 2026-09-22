// ─────────────────────────────────────────────────────────────────────────────
// Badge.stories.tsx — 작은 표식 세 갈래
//
// **폼 라벨(FormBadge)을 Badge 로 합치지 않은 이유**가 여기서 보인다.
// 폼은 게임 아이콘 색의 채움 뱃지고(메가 보라 · 맥스 자홍), Badge 는 테두리만 있는
// 중립 표식이다. 한 컴포넌트로 합치면 `tone="mega"` 같은 칸이 생겨 그 구분이 흐려진다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Delta, FormBadge, Inline, Stack, Text } from '../ds';

const meta = {
  id: 'parts-badge',
  title: '조각/표식' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 줄 위의 한 마디 — 뜻을 고르면 색은 토큰이 정한다 */
export const Badges: Story = {
  name: '뱃지',
  render: () => (
    <Inline gap="sm">
      <Badge>활용 2곳</Badge>
      <Badge tone="many">활용 5곳</Badge>
      <Badge tone="strong">G-MAX</Badge>
      <Badge tone="good">상향 예고</Badge>
      <Badge tone="warn">가정판</Badge>
      <Badge dashed>지금 12위</Badge>
    </Inline>
  ),
};

/** 폼 라벨 — 이름 앞에 붙는다. 게임 아이콘 색을 그대로 쓴다 */
export const FormLabels: Story = {
  name: '폼라벨',
  render: () => (
    <Inline gap="sm">
      <FormBadge kind="mega">메가</FormBadge>
      <FormBadge kind="max">거다이맥스</FormBadge>
      <FormBadge kind="shadow">섀도우</FormBadge>
      <FormBadge>알로라</FormBadge>
    </Inline>
  ),
};

/**
 * 순위 변동 — **0 과 빈 값은 아무것도 안 그린다.**
 * '▲0' 은 움직였다는 뜻으로, 대시는 순위가 없다는 뜻으로 읽힌다. 둘 다 거짓이다.
 */
export const Deltas: Story = {
  name: '변동',
  // 설명 글에 'NaN' 이라는 글자가 일부러 들어 있다 — 샘 검사만 비켜 간다 (check-stories.mjs)
  tags: ['leak-demo'],
  render: () => (
    <Stack gap="sm">
      <Inline gap="md">
        <Delta value={3} title="3계단 상승" />
        <Delta value={-1} title="1계단 하락" />
        <Text size="sub" tone="muted">value = 3 · -1</Text>
      </Inline>
      <Inline gap="md" style={{ minHeight: '2.4rem' }}>
        <Delta value={0} />
        <Delta />
        <Delta value={Number.NaN} />
        <Text size="sub" tone="muted">value = 0 · 없음 · NaN → 아무것도 안 그린다</Text>
      </Inline>
    </Stack>
  ),
};
