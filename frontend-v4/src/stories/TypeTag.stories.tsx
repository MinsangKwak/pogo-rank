// ─────────────────────────────────────────────────────────────────────────────
// TypeTag.stories.tsx — 타입을 색으로 말하는 두 모양
//
// **게임 원작 타입색(`--t-*`)은 바꾸지 않는다** (§1-b). 밝은 타입(전기·얼음) 위 흰 글자가
// 흐린 것은 알려진 한계다 — 색을 바꾸면 게임과 어긋나므로, 필요하면 글자에 그늘을 깔아
// 윤곽을 남긴다. 그래서 이 도면은 "고쳐야 할 자리" 가 아니라 "알고 쓰는 자리" 다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline, Stack, Text, TypeDots, TypePill, TYPES } from '../ds';
import { TYPE_KO } from './typeNames';

const meta = {
  id: 'parts-typetag',
  title: '조각/타입' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 알약 — 자리가 있을 때. 색 점 + 한글 이름 */
export const Pills: Story = {
  name: '알약',
  render: () => (
    <Stack gap="md">
      {[['fire', 'flying'], ['water'], ['psychic', 'fairy'], ['steel', 'ground']].map((types) => (
        <Inline key={types.join('-')} gap="sm">
          <TypePill types={types} names={TYPE_KO} />
        </Inline>
      ))}
    </Stack>
  ),
};

/** 점 — 자리가 없을 때. 순위표 줄의 이름 옆에 선다 */
export const Dots: Story = {
  name: '점',
  render: () => (
    <Stack gap="sm">
      {[['fire', 'flying'], ['dragon'], ['ghost', 'dark']].map((types) => (
        <Inline key={types.join('-')} gap="sm" align="center">
          <Text>이름 자리</Text>
          <TypeDots types={types} names={TYPE_KO} />
        </Inline>
      ))}
    </Stack>
  ),
};

/** 18색 — 한 장에서 견준다. 밝은 쪽 넷(전기·얼음·강철·땅)이 흰 바탕에서 약한 자리다 */
export const AllEighteen: Story = {
  name: '열여덟색',
  render: () => (
    <Inline gap="sm">
      {TYPES.map((type) => <TypePill key={type} types={[type]} names={TYPE_KO} />)}
    </Inline>
  ),
};

/** 한글 이름을 안 넘기면 — 영문 키가 그대로 선다. 지어내지 않는다 (§3) */
export const NoNames: Story = {
  name: '이름이없을때',
  render: () => <Inline gap="sm"><TypePill types={['fire', 'flying']} /></Inline>,
};
