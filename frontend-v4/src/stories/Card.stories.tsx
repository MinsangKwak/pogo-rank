// ─────────────────────────────────────────────────────────────────────────────
// Card.stories.tsx — TCG 카드 한 장
//
// 레시피(박테 · 바깥 링 · 계단 그림자 · 아이보리 판)는 surfaces.css 가 도감·랭킹·홈의
// 선택자마다 따로 박아 두고 있었다. 새 화면이 카드를 만들 때 베낄 자리가 없어 매번
// 조금씩 다른 카드가 생겼다 — `<Card>` 는 그 네 줄을 한 자리에 모은 것이다.
//
// **머리 띠 위 글자는 `--bg` 다.** `#fff` 를 쓰면 다크에서 흰 글자가 흰 바탕에 놓인다 (§1-b).
// 테마 버튼으로 다크를 켜서 확인하는 자리다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, Card, Inline, Label, Num, Stack, Text, TypePill } from '../ds';
import { TYPE_KO } from './typeNames';
import './story.css';

const meta = {
  id: 'parts-card',
  title: '조각/카드',
  component: Card,
  args: { title: '오늘의 맥스 배틀', children: '카드 안에 들어가는 내용입니다.' },
  argTypes: { pad: { control: 'inline-radio', options: ['none', 'xs', 'sm', 'md', 'lg', 'xl'] } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { name: '기본' };

/** 머리 띠 없이 — 안쪽에 무엇이든 담는 판 */
export const Plain: Story = { name: '민판', args: { title: undefined } };

/** 머리 띠 오른쪽에 한 칸 — 버튼이나 뱃지가 들어간다 */
export const WithAction: Story = {
  name: '머리에도구',
  args: { action: <Badge tone="strong">G-MAX</Badge> },
};

/** 누를 수 있는 카드 — `<button>` 으로 나간다. 스치면 들리고 무지개가 돈다 */
export const Clickable: Story = {
  name: '누를수있는카드',
  args: { title: undefined, onClick: () => {}, children: '눌러서 상세로 갑니다' },
};

/** 상위 세 장 — 늘 옅은 홀로를 깐다. 실물 카드의 레어가 그렇다 */
export const Rare: Story = { name: '레어', args: { rare: true, title: undefined, children: '상위 세 장' } };

/** 카드를 조각으로 채운 한 장 — 조각들이 한 벌로 읽히는지 보는 자리 */
export const Composed: Story = {
  name: '조각을담은카드',
  render: () => (
    <div style={{ maxWidth: '36rem' }}>
      <Card title={<Label>맥스 배틀 추천</Label>} action={<Badge tone="strong">G-MAX</Badge>}>
        <Stack gap="md">
          <Inline gap="sm">
            <TypePill types={['fire', 'flying']} names={TYPE_KO} />
          </Inline>
          <Inline gap="sm" align="baseline">
            <Label size="hero"><Num of={248180} /></Label>
            <Text size="sub" tone="muted">맥스 피해</Text>
          </Inline>
          <Text size="sub" tone="muted" leading="prose">
            티어 점수와 맥스 피해는 빌드가 채운다. 값이 비면 이 자리에 대시가 선다.
          </Text>
          <Inline gap="sm">
            <Button variant="primary">덱에 넣기</Button>
            <Button variant="secondary">상세 보기</Button>
          </Inline>
        </Stack>
      </Card>
    </div>
  ),
};
