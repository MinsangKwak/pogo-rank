// ─────────────────────────────────────────────────────────────────────────────
// Callout.stories.tsx — 안내 한 줄 · 빈 자리
//
// 셋이 뜻이 다르다. 섞으면 화면이 거짓말한다 —
//   Callout  이 화면에 대해 알아 둘 것이 있다
//   Empty    세울 줄이 하나도 없다
//   대시(—)  **한 칸**의 값이 없다
// 빈 표를 대시 수백 개로 그리면 둘이 뒤섞여 "데이터가 없는 건지 고장인지" 를 알 수 없다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Callout, Empty, Stack } from '../ds';

const meta = {
  id: 'parts-callout',
  title: '조각/안내' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 띠 색이 곧 뜻이다 */
export const Tones: Story = {
  name: '갈래',
  render: () => (
    <Stack gap="md">
      <Callout tone="info" title="비공식 팬 도구입니다">게임 데이터는 공개된 값을 모아 계산합니다.</Callout>
      <Callout tone="good" title="상향 예고">다음 시즌에 위력이 오릅니다.</Callout>
      <Callout tone="caution" title="아직 안 나온 종">가정판 순위라 실제 표와 다릅니다.</Callout>
      <Callout tone="warn" title="되돌릴 수 없습니다">지우면 저장된 덱이 사라집니다.</Callout>
      <Callout tone="brand" title="새 빌드가 올라왔습니다">새로고침하면 오늘 표로 바뀝니다.</Callout>
    </Stack>
  ),
};

/** 제목 없이 한 줄만 */
export const OneLine: Story = {
  name: '한줄',
  render: () => <Callout tone="info">기술 변경 예고는 적용일 전까지만 붙습니다.</Callout>,
};

/** 빈 자리 — **왜 비었는지**를 적는다. '없음' 한 마디는 고장과 구분이 안 된다 */
export const EmptyState: Story = {
  name: '빈자리',
  render: () => (
    <Stack gap="md">
      <Empty>고른 타입에 드는 포켓몬이 없습니다. 타입 필터를 '전체' 로 두면 다 보입니다.</Empty>
      <Empty>아직 즐겨찾기한 포켓몬이 없습니다. 상세 화면의 ☆ 를 누르면 여기에 쌓입니다.</Empty>
    </Stack>
  ),
};
