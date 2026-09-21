// ─────────────────────────────────────────────────────────────────────────────
// Chip.stories.tsx — 하나를 고르는 두 모양
//
//   ChipGroup  가짓수가 많고 가로로 흐른다 (타입 필터 18개)
//   Segmented  가짓수가 서넛이고 붙어 있다 (리그 전환)
//
// 타입 한글 이름은 **실데이터**다 (backend/build.py 의 TYPE_KO). 지어내지 않는다 (§3).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChipGroup, Segmented, Stack, Text, TYPES } from '../ds';
import { TYPE_KO } from './typeNames';

const meta = {
  id: 'parts-choice',
  title: '조각/고르기',
  parameters: {
    docs: { description: { component: '고른 것은 `aria-pressed` 가 말한다. `.is-on` 같은 클래스를 쓰면 접근성은 맞아도 v3 CSS 가 안 칠해 눌린 티가 전혀 안 난다.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TYPE_ITEMS = [
  { id: 'all', label: '전체' },
  ...TYPES.map((type) => ({ id: type, label: TYPE_KO[type], type })),
];

function Chips() {
  const [value, setValue] = useState('all');
  return <ChipGroup items={TYPE_ITEMS} value={value} onPick={setValue} label="타입 필터" />;
}

function Seg({ items }: { items: { id: string; label: string }[] }) {
  const [value, setValue] = useState(items[0]!.id);
  return <Segmented items={items} value={value} onPick={setValue} label="리그" />;
}

/** 타입 칩 — 색 점이 앞에 붙는다. '전체' 칩에는 점이 없다 */
export const TypeChips: Story = { name: '타입칩', render: () => <Chips /> };

/** 세그먼트 — 최소 높이가 `--tap`(44px) 이다. v4.3.5 까지 26px 이었다 */
export const SegmentedControl: Story = {
  name: '세그먼트',
  render: () => (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sub" tone="muted">둘 — 보기 전환</Text>
        <Seg items={[{ id: 'list', label: '리스트' }, { id: 'grid', label: '그리드' }]} />
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">셋 — 리그</Text>
        <Seg items={[{ id: 'great', label: '슈퍼리그' }, { id: 'ultra', label: '하이퍼리그' }, { id: 'master', label: '마스터리그' }]} />
      </Stack>
    </Stack>
  ),
};
