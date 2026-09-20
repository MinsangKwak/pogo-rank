import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HotSearchPage from '../screens/HotSearchPage';
vi.mock('../lib/data', () => ({ useHotSearchSoft: () => ({ countries: [{ code: 'KR', total: 8, rows: [{ name: '피카츄', sprite: 25, count: 8 }] }] }) }));
vi.mock('../components/HotSearch', () => ({
  useHotRows: () => ({ rows: [{ name: '이상해씨', sprite: 1, count: 12 }], source: 'ga', label: '' }),
  HotHead: () => <h3>전체 순위</h3>,
  HotList: ({ rows }: { rows: { name: string }[] }) => <div>{rows.map(row => <span key={row.name}>{row.name}</span>)}</div>,
}));
afterEach(cleanup);
describe('인기 검색 국가와 보기 전환', () => {
  it('국가별 순위와 빈 상태를 구분하며 전체로 돌아간다', () => {
    render(<HotSearchPage onOpen={vi.fn()} />);
    expect(screen.getByText('이상해씨')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('어느 나라가 궁금하세요?'), { target: { value: 'KR' } });
    expect(screen.getByText('피카츄')).toBeTruthy();
    expect(screen.queryByText('이상해씨')).toBeNull();
    fireEvent.change(screen.getByLabelText('어느 나라가 궁금하세요?'), { target: { value: 'US' } });
    expect(screen.getByText(/미국의 검색 데이터가 아직 없어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '전 세계 순위 보기 ↗' }));
    expect(screen.getByText('이상해씨')).toBeTruthy();
  });
  it('지도 클릭과 보기 전환 후 선택된 국가가 유지된다', () => {
    const { container } = render(<HotSearchPage onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '대한민국 · 검색 8회' }));
    fireEvent.click(screen.getByRole('button', { name: '보기 방식: 그리드 · 누르면 리스트' }));
    expect(container.querySelector('.hot-results--list')).toBeTruthy();
    expect(screen.getByText('피카츄')).toBeTruthy();
  });
});
