// ─────────────────────────────────────────────────────────────────────────────
// Tokens.stories.tsx — 토큰 168개를 **눈으로** 본다
//
// 이 도면이 필요한 이유는 §1-b 의 사고다. v4.3.0 카드 컨셉 작업에서 흰 글자를 흰 바탕에
// 두 번 놓았다 — 색 한 벌을 갈아끼우면 글자와 바탕이 따로 움직이는데, 그 짝을 한 자리에서
// 볼 방법이 없었다. 여기서는 테마 버튼 하나로 두 벌이 갈린다.
//
// 목록은 ds/tokens.ts 가 가진다. 이 파일은 **그리기만 한다** — 그래야 목록이 한 곳이다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { Label, Stack, Text, TOKEN_GROUPS, type TokenGroup } from '../ds';
import './story.css';

/** 색 토큰인가 — 색판을 그릴지 글자로 보일지를 가른다 */
function isColor(name: string) {
  return !/^--(fs|space|r|px|tap|shadow|card|foil|holo)/.test(name) || /^--(card-tint|foil-(hi|lo))/.test(name);
}

function Group({ group }: { group: TokenGroup }) {
  return (
    <Stack gap="md">
      <div className="sb-head">
        <Label size="sec" as="h3">{group.title}</Label>
        <Text size="sub" tone="muted" leading="prose" style={{ marginTop: 'var(--space-xs)' }}>{group.note}</Text>
      </div>
      <div className="sb-grid">
        {group.tokens.map((token) => (
          <div className="sb-token" key={token.name}>
            {isColor(token.name)
              ? <span className="sb-token__chip" style={{ ['--sb-fill']: `var(${token.name})` } as CSSProperties} />
              : null}
            <span style={{ minWidth: 0 }}>
              <code className="sb-token__name">{token.name}</code>
              <span className="sb-token__use">{token.use}</span>
            </span>
          </div>
        ))}
      </div>
    </Stack>
  );
}

const meta = {
  id: 'foundations-tokens',
  title: '기초/토큰',
  parameters: {
    docs: { description: { component: '값은 `src/styles/v3/tokens.css` 한 곳이 가진다. 목록과 쓰임새는 `src/ds/tokens.ts` 다. 둘이 어긋나면 `src/test/dstokens.test.ts` 가 선다.' } },
  },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

/** 전부 — 판 · 글자 · 의미 · 어두운 판 · 타입 · 폼 · 크기 · 간격 · 모양 · 카드 */
export const All: Story = {
  name: '전체',
  render: () => (
    <Stack gap="xl">
      {TOKEN_GROUPS.map((group) => <Group key={group.id} group={group} />)}
    </Stack>
  ),
};

/** 의미 색만 — "색은 뜻에만 쓴다" 는 규칙이 지켜지는지 보는 자리 */
export const Meaning: Story = {
  name: '의미색',
  render: () => <Group group={TOKEN_GROUPS.find((one) => one.id === 'meaning')!} />,
};

/** 타입 18색 — **게임 원작 값이라 바꾸지 않는다** */
export const Types: Story = {
  name: '타입색',
  render: () => <Group group={TOKEN_GROUPS.find((one) => one.id === 'type')!} />,
};

/** 어두운 판 — 테마를 안 탄다. 다크로 바꿔도 이 묶음만은 그대로여야 맞다 */
export const Plate: Story = {
  name: '어두운판',
  render: () => <Group group={TOKEN_GROUPS.find((one) => one.id === 'plate')!} />,
};
