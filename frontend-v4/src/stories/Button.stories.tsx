// ─────────────────────────────────────────────────────────────────────────────
// Button.stories.tsx — 누르는 것 네 갈래
//
// 새 클래스를 만들지 않았다 — v3 CSS 의 `.home__btn` · `.tool-btn` · `.icon-btn` 을 그대로 쓴다.
// 그래서 이 도면은 **화면과 같은 버튼**이다. 여기서 눌린 티가 나면 화면에서도 난다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Inline, Stack, Text } from '../ds';

const meta = {
  id: 'parts-button',
  title: '조각/버튼',
  component: Button,
  args: { children: '맥스 배틀 덱 짜기', variant: 'secondary' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'tool', 'icon'] },
    pressed: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  parameters: {
    docs: { description: { component: '켜짐은 클래스가 아니라 `aria-pressed` 로 말한다 — v3 CSS 가 그 속성을 보고 칠한다. 접근성 속성이 곧 스타일 훅이라 한 번만 적으면 둘 다 맞는다.' } },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 컨트롤로 갈래를 바꿔 본다 */
export const Playground: Story = { name: '기본' };

/** 넷을 나란히 — 어느 자리에 무엇을 쓰는지 */
export const Variants: Story = {
  name: '갈래',
  render: () => (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sub" tone="muted">primary — 화면에 하나. 브랜드 채움 위 --bg 글자</Text>
        <Inline><Button variant="primary">덱 짜기 시작</Button></Inline>
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">secondary — 보조 행동. 외곽선</Text>
        <Inline><Button variant="secondary">티어표 보기</Button></Inline>
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">tool — 화면 머리의 도구. 켜면 그 줄의 제목 노릇을 한다</Text>
        <Inline>
          <Button variant="tool" pressed={false}>솔플 계산기</Button>
          <Button variant="tool" pressed>개체값 순위</Button>
        </Inline>
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">icon — 정사각. 그림만 있으므로 이름을 label 로 준다</Text>
        <Inline>
          <Button variant="icon" label="테마 바꾸기">🌗</Button>
          <Button variant="icon" label="메뉴 열기">☰</Button>
        </Inline>
      </Stack>
    </Stack>
  ),
};

/** 못 누르는 상태 — 링크로 쓰면 href 를 떼서 탭 차례에서도 뺀다 */
export const Disabled: Story = {
  name: '비활성',
  render: () => (
    <Inline>
      <Button variant="primary" disabled>준비 중</Button>
      <Button variant="secondary" href="#/dex" disabled>도감 (준비 중)</Button>
      <Button variant="secondary" href="#/dex">도감으로</Button>
    </Inline>
  ),
};

/** 긴 이름 — 한국어는 어절로 끊긴다(`word-break: keep-all`). 좁은 자리에서 확인하는 칸 */
export const LongLabel: Story = {
  name: '긴이름',
  render: () => (
    <div style={{ maxWidth: '24rem' }}>
      <Button variant="primary">거다이맥스 맥스 배틀 추천 덱 한 번에 짜기</Button>
    </div>
  ),
};
