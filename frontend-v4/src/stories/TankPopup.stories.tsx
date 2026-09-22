// ─────────────────────────────────────────────────────────────────────────────
// TankPopup.stories.tsx — 11월 탱커 준비 팝업의 본문
//
// 팝업(dialog) 껍데기는 빼고 **본문만** 세운다 — 도면에서 볼 것은 배치와 글자다.
// 데이터는 빌드가 구운 실물(public/data)을 그대로 읽는다 — 이름을 지어내지 않는다 (§3).
// 그래서 `npm run data` 가 먼저 돌아야 이 도면이 선다 (CI 는 build 뒤에 storybook 을 만든다).
// ─────────────────────────────────────────────────────────────────────────────
import type { Meta, StoryObj } from '@storybook/react-vite';
import dexJson from '../../public/data/dex.json';
import maxJson from '../../public/data/max.json';
import type { DexBundle, MaxBundle } from '../types/data';
import { TankPopupBody } from '../components/TankPopup';
import './story.css';

const meta = {
  id: 'screens-tankpop',
  title: '화면/11월 탱커 팝업',
  component: TankPopupBody,
  args: {
    dex: dexJson as unknown as DexBundle,
    max: maxJson as unknown as MaxBundle,
    onOpen: () => {}, onClose: () => {}, onHide: () => {},
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TankPopupBody>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 팝업 안에 들어가는 본문 그대로 — 보스 둘 · 육성 순서 · 종합 순위 */
export const Body: Story = { name: '본문' };
