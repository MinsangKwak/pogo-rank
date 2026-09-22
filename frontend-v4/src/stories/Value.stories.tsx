// ─────────────────────────────────────────────────────────────────────────────
// Value.stories.tsx — **`NaN` · `undefined` 가 화면에 못 나가는 자리**
//
// CLAUDE.md 의 첫 규칙이 이것이다. v4.2.4 에 탱커 줄이 딜러 문법을 타면서
// `NaN 맥스 피해 · 내구 undefined` 가 그대로 찍혔다 — 표는 바뀌었는데 읽는 쪽이 안 바뀐 것이다.
//
// 아래 스토리는 **일부러 빈 값을 꽂는다.** 대시(—)가 아닌 것이 하나라도 보이면 그것이 사고다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline, Lines, Num, Stack, Text, Word } from '../ds';
import './story.css';

const meta = {
  id: 'parts-value',
  title: '조각/값 관문',
  parameters: {
    docs: { description: { component: '값을 글자로 바꾸는 일은 `lib/cell.ts` 에서만 한다. `<Num>`·`<Word>`·`<Lines>` 는 그 함수를 부르는 컴포넌트다 — 화면에서 부르는 것을 잊을 수 없게.' } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const BROKEN: [string, unknown][] = [
  ['undefined', undefined],
  ['null', null],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['빈 문자열', ''],
  ['공백만', '   '],
  ['숫자 아닌 글자', '약 300'],
];

/** 성한 값 — 있는 그대로 찍는다 */
export const Filled: Story = {
  name: '값이있을때',
  render: () => (
    <Stack gap="sm">
      <Inline gap="sm" align="baseline"><Num of={248180} /><Text size="sub" tone="muted">맥스 피해</Text></Inline>
      <Inline gap="sm" align="baseline"><Num of={93.42} digits={1} unit="%" /><Text size="sub" tone="muted">티어 점수</Text></Inline>
      <Inline gap="sm" align="baseline"><Word of="맥스 너클" /><Text size="sub" tone="muted">차지 기술</Text></Inline>
    </Stack>
  ),
};

/**
 * 값이 샐 때 — **전부 대시(—)여야 한다.** 다른 것이 보이면 그것이 사고다.
 *
 * `leak-demo` 태그가 붙어 있다. 왼쪽 이름 칸에 'undefined' · 'NaN' 이라는 **글자**가
 * 일부러 적혀 있어서, scripts/check-stories.mjs 의 샘 검사가 그대로 두면 여기서 선다 —
 * 그 검사만 비켜 간다. 명암비 검사는 그대로 받는다.
 */
export const Leaky: Story = {
  name: '값이샐때',
  tags: ['leak-demo'],
  render: () => (
    <Stack gap="sm">
      {BROKEN.map(([name, value]) => (
        <Inline key={name} gap="md" align="baseline">
          <code className="sb-ladder__key">{name}</code>
          <span>Num → <Num of={value} /></span>
          <span>Word → <Word of={value} /></span>
        </Inline>
      ))}
    </Stack>
  ),
};

/**
 * 보조줄 — 빈 줄은 **대시로 때우지 않고 걷어낸다.**
 * 기술 칸이 없는 탱커 줄에 `— 타입` 을 세우면 없는 정보를 있는 척하게 된다.
 */
export const SubLines: Story = {
  name: '보조줄',
  render: () => (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sub" tone="muted">딜러 줄 — 기술 두 칸이 다 있다</Text>
        <Lines of={['용의숨결 · 맥스 너클', '내구 2,140']} />
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">탱커 줄 — 기술 칸이 아예 없다. 줄이 하나만 선다</Text>
        <Lines of={[undefined, '유효 체력 3,820']} />
      </Stack>
      <Stack gap="xs">
        <Text size="sub" tone="muted">둘 다 비면 묶음 자체를 안 만든다 (아래가 비어 있는 것이 맞다)</Text>
        <Lines of={[undefined, null, '  ']} />
      </Stack>
    </Stack>
  ),
};
