// ─────────────────────────────────────────────────────────────────────────────
// TankPopup.stories.tsx — 11월 탱커 준비 팝업의 본문
//
// 팝업(dialog) 껍데기는 빼고 **본문만** 세운다 — 도면에서 볼 것은 배치와 글자다.
// 데이터는 빌드가 구운 실물(public/data)을 그대로 읽는다 — 이름을 지어내지 않는다 (§3).
// 그래서 `npm run data` 가 먼저 돌아야 이 도면이 선다 (CI 는 build 뒤에 storybook 을 만든다).
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DexBundle, MaxBundle } from '../types/data';
import { TankPopupBody } from '../components/TankPopup';
import { Empty } from '../ds';
import './story.css';

// 정적 `import x from '../../public/data/dex.json'` 은 파일이 없으면 **tsc 부터** 죽는다 — public/data 는
// 빌드가 만드는 자리라 저장소에 없다. glob 은 없어도 타입이 서고, 있으면 그대로 싣는다
const files = import.meta.glob('../../public/data/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const dex = files['../../public/data/dex.json'] as DexBundle | undefined;
const max = files['../../public/data/max.json'] as MaxBundle | undefined;

const meta = {
  id: 'screens-tankpop',
  title: '화면/11월 탱커 팝업',
  parameters: { layout: 'padded' },
  render: () => (dex && max
    ? <TankPopupBody dex={dex} max={max} onOpen={() => {}} onClose={() => {}} onHide={() => {}} />
    : <Empty>꾸러미가 없어 본문을 못 세운다 — `cd frontend-v4 && npm run data` 를 먼저 돌린다</Empty>),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** 팝업 안에 들어가는 본문 그대로 — 보스 둘 · 육성 순서 · 종합 순위 */
export const Body: Story = { name: '본문' };
