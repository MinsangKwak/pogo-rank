// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// adminscreens.test.ts — 관리자 캠프 화면 넷이 실제 API 모양의 값으로 서고, 새는 글자가 없고, 권한에 따라 단추가 가려지는지 (2026-10-16 v6)
//
//   루트    대시보드 · 상세 통계 · 가입 승인(대기 줄에 [승인 검토]) · 트레이너 코드
//   위임    유저 관리(단추는 [프로필 보기] 뿐) · 상세는 읽기 전용
//   실패    '불러오지 못했어요' 는 '아직 없어요' 와 다른 문구다. 403 은 권한 판
// 서버는 lib/serverApi 를 통째로 흉내 낸다 — 화면은 그 모양만 안다
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { LEAK } from '../lib/cell';

const USERS = [
  { id: 'u-root', email: 'root@example.com', name: '루트', picture: '', role: 'root', beta: true, createdAt: '2026-09-14T00:00:00Z', lastSeenAt: '2026-10-16T01:00:00Z' },
  { id: 'u-pend', email: 'new@example.com', name: '', picture: '', role: 'pending', beta: false, createdAt: '2026-10-15T00:00:00Z', lastSeenAt: null },
  { id: 'u-ok', email: 'ok@example.com', name: '승인된 사람', picture: '', role: 'approved', beta: true, createdAt: '2026-10-01T00:00:00Z', lastSeenAt: '2026-10-10T00:00:00Z' },
  { id: 'u-adm', email: 'adm@example.com', name: '위임', picture: '', role: 'admin', beta: false, createdAt: '2026-09-20T00:00:00Z', lastSeenAt: null },
];
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;
const STATS = {
  generatedAt: '2026-10-16T03:00:00Z', days: 7, from: day(10), to: day(16),
  users: { total: 4, pending: 1, approved: 1, admin: 1, root: 1, beta: 2, active1d: 1, active7d: 2, active30d: 3, newPerDay: [10, 11, 12, 13, 14, 15, 16].map((d) => ({ day: day(d), count: 1 })) },
  sessions: { active: 3 },
  favorites: { total: 12, people: 2, top: [{ dex: 6, users: 2 }, { dex: 25, users: 1 }] },
  search: { hits: 20, visitors: 3, perDay: [10, 11, 12, 13, 14, 15, 16].map((d) => ({ day: day(d), hits: 3, visitors: 1 })), top: [{ key: '리자몽', hits: 5, visitors: 2 }], surfaces: [], countries: [], hot: [], hotToday: [] },
  views: { hits: 100, visitors: 9, perDay: [10, 11, 12, 13, 14, 15, 16].map((d) => ({ day: day(d), hits: 14, visitors: 2 })), top: [{ key: 'dex', hits: 40, visitors: 5 }], surfaces: [], countries: [], mons: [] },
  ga4: { status: 'off', reason: '꺼짐' },
};
const TRAINERS = [{ name: '지우', code: '123456789012', sortOrder: 0 }];

const api = vi.hoisted(() => ({
  adminStats: vi.fn(), adminStatsHours: vi.fn(), listUsers: vi.fn(), setRole: vi.fn(), trainers: vi.fn(), putTrainer: vi.fn(), removeTrainer: vi.fn(),
}));
vi.mock('../lib/serverApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/serverApi')>();
  return { ...real, serverApi: { ...real.serverApi, ...api } };
});
// 도감 묶음(react-query)은 여기 없다 — 이름은 '#번호' 로 선다. jsdom 에는 <dialog>.showModal 이 없어 채운다
vi.mock('../lib/data', () => ({ useDexSoft: () => undefined }));
// 그래프의 폭 재기(ResizeObserver)도 jsdom 에 없다 — 안 재면 그래프는 비어 있지만 화면은 선다
if (typeof ResizeObserver === 'undefined') {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() { /* jsdom */ } unobserve() { /* jsdom */ } disconnect() { /* jsdom */ } };
}
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
}
vi.mock('../stores/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../stores/auth')>();
  return { ...real, recheckAccess: vi.fn(async () => undefined) };
});

async function asRole(role: 'root' | 'admin') {
  const { useAuthStore } = await import('../stores/auth');
  useAuthStore.setState({
    enabled: true, ready: true, status: 'ok', role, admin: true, adminRoot: role === 'root', beta: true,
    user: { uid: role === 'root' ? 'u-root' : 'u-adm', email: role === 'root' ? 'root@example.com' : 'adm@example.com', displayName: role, photoURL: '' },
  });
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('관리자 캠프 화면 — 실제 API 모양으로 선다', () => {
  it('운영 대시보드 — 네 지표 · 승인 대기 · 많이 담긴 포켓몬 · 권한 현황, 새는 글자 없음', async () => {
    await asRole('root');
    api.adminStats.mockResolvedValue(STATS);
    const { default: AdminHome } = await import('../screens/AdminHome');
    const box = render(createElement(AdminHome)).container;
    await waitFor(() => expect(box.textContent).toContain('1명의 가입 요청'));
    expect(box.textContent).toContain('오늘의 캠프 운영');
    expect(box.textContent).toContain('2026.10.10 – 10.16');
    expect(box.textContent).toContain('합계 100회 · 순방문 9명');
    expect(box.textContent).toContain('실험 기능');
    expect(box.textContent).not.toMatch(LEAK);
    expect(box.querySelectorAll('.px-metric').length).toBe(4);
  });

  it('받기 전 · 실패는 0 이 아니라 대시 — 실패 문구와 다시 받기', async () => {
    await asRole('root');
    const { ApiError } = await import('../lib/serverApi');
    api.adminStats.mockRejectedValue(new ApiError(500, 'boom', '서버 오류'));
    const { default: AdminHome } = await import('../screens/AdminHome');
    const box = render(createElement(AdminHome)).container;
    await waitFor(() => expect(box.textContent).toContain('통계를 받지 못했어요'));
    expect(box.querySelector('.px-metric__value')?.textContent).toBe('—');
    expect(box.textContent).not.toMatch(LEAK);
  });

  it('403 이면 권한 판 — 위임 관리자는 루트 전용 안내', async () => {
    await asRole('admin');
    const { ApiError } = await import('../lib/serverApi');
    api.adminStats.mockRejectedValue(new ApiError(403, 'forbidden', '루트만'));
    const { default: AdminStats } = await import('../screens/AdminStats');
    const box = render(createElement(AdminStats)).container;
    await waitFor(() => expect(box.textContent).toContain('루트 관리자 전용 화면'));
    expect(box.querySelectorAll('a[href="/admin/users"], a[href="/admin/trainers"]').length).toBe(2);
  });

  it('상세 통계 — 다섯 구역과 기간 칩이 서고 새는 글자 없음', async () => {
    await asRole('root');
    api.adminStats.mockResolvedValue(STATS);
    api.adminStatsHours.mockResolvedValue({ generatedAt: STATS.generatedAt, day: day(16), hours: [] });
    const { default: AdminStats } = await import('../screens/AdminStats');
    const box = render(createElement(AdminStats)).container;
    await waitFor(() => expect(box.querySelector('#stat-users')).not.toBeNull());
    for (const id of ['stat-glance', 'stat-visits', 'stat-views', 'stat-search']) expect(box.querySelector(`#${id}`)).not.toBeNull();
    expect(box.textContent).toContain('숫자 뒤의 이용 흐름');
    expect(box.textContent).toContain('GA4 꺼짐 · 확인 불가');
    expect(box.querySelectorAll('.adm-period button.px-chip').length).toBe(7);
    expect(box.textContent).not.toMatch(LEAK);
  });

  it('가입 승인(루트) — 대기 줄에 [승인 검토], 확인 팝업에 이메일과 효과, 확인하면 setRole 뒤 다시 읽는다', async () => {
    await asRole('root');
    api.listUsers.mockResolvedValue(USERS);
    api.setRole.mockResolvedValue(undefined);
    const { default: AdminUsers } = await import('../screens/AdminUsers');
    const box = render(createElement(AdminUsers, { rest: '' })).container;
    await waitFor(() => expect(box.textContent).toContain('new@example.com'));
    // 본인은 목록에 없다 — 위 '내 계정' 판에만
    expect(box.querySelectorAll('tbody tr').length).toBe(3);
    expect(box.textContent).toContain('내 계정 · 루트 관리자');
    expect(box.textContent).toContain('3개 요청 · 가입일 순');
    expect(box.textContent).toContain('(이름 없음)');
    const approve = [...box.querySelectorAll('button')].find((one) => one.textContent === '승인 검토')!;
    fireEvent.click(approve);
    const dialog = document.querySelector('.adm-confirm')!;
    expect(dialog.textContent).toContain('new@example.com');
    expect(dialog.textContent).toContain('이 계정을 승인된 이용자로 변경합니다.');
    fireEvent.click([...dialog.querySelectorAll('button')].find((one) => one.textContent === '가입 승인')!);
    await waitFor(() => expect(api.setRole).toHaveBeenCalledWith('u-pend', { role: 'approved' }));
    await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(2));
    expect(box.textContent).not.toMatch(LEAK);
  });

  it('유저 관리(위임) — 단추는 [프로필 보기] 뿐, 상세는 읽기 전용', async () => {
    await asRole('admin');
    api.listUsers.mockResolvedValue(USERS.filter((one) => one.role !== 'pending'));
    const { default: AdminUsers } = await import('../screens/AdminUsers');
    const box = render(createElement(AdminUsers, { rest: '' })).container;
    await waitFor(() => expect(box.textContent).toContain('ok@example.com'));
    expect(box.textContent).toContain('위임 관리자 계정');
    expect(box.textContent).toContain('트레이너 코드 열기');
    expect([...box.querySelectorAll('tbody .px-btn')].every((one) => one.textContent === '프로필 보기')).toBe(true);
    expect(box.querySelector('tbody .px-toggle')).toBeNull();
    cleanup();
    const detail = render(createElement(AdminUsers, { rest: 'u-ok' })).container;
    await waitFor(() => expect(detail.textContent).toContain('APPROVED'));
    expect(detail.textContent).toContain('승인된 사람');
    expect(detail.querySelectorAll('.px-note__actions button').length).toBe(0);
    expect(detail.textContent).toContain('권한 변경은 루트 관리자만');
  });

  it('이용자 상세(루트) — 단추 셋, 루트 계정 · 본인은 단추 없음', async () => {
    await asRole('root');
    api.listUsers.mockResolvedValue(USERS);
    const { default: AdminUsers } = await import('../screens/AdminUsers');
    const box = render(createElement(AdminUsers, { rest: 'u-ok' })).container;
    await waitFor(() => expect(box.textContent).toContain('APPROVED'));
    const labels = [...box.querySelectorAll('.px-note__actions button')].map((one) => one.textContent);
    expect(labels).toEqual(['관리자 지정 검토', '실험 기능 해제 검토', '승인 해제 검토']);
    cleanup();
    const me = render(createElement(AdminUsers, { rest: 'u-root' })).container;
    await waitFor(() => expect(me.textContent).toContain('ROOT'));
    expect(me.querySelectorAll('.px-note__actions button').length).toBe(0);
  });

  it('목록을 못 받으면 빈 목록과 다른 문구', async () => {
    await asRole('root');
    const { ApiError } = await import('../lib/serverApi');
    api.listUsers.mockRejectedValue(new ApiError(500, 'boom', '오류'));
    const { default: AdminUsers } = await import('../screens/AdminUsers');
    const box = render(createElement(AdminUsers, { rest: '' })).container;
    await waitFor(() => expect(box.textContent).toContain('목록을 불러오지 못했어요'));
    expect(box.textContent).not.toContain('아직 등록된 항목이 없어요');
  });

  it('트레이너 코드 — 목록 · 저장 전 검토 · 유효한 줄만 저장, 형식 오류 줄은 남긴다', async () => {
    await asRole('admin');
    api.trainers.mockResolvedValue(TRAINERS);
    api.putTrainer.mockResolvedValue(undefined);
    const { default: AdminTrainers } = await import('../screens/AdminTrainers');
    const box = render(createElement(AdminTrainers)).container;
    await waitFor(() => expect(box.textContent).toContain('등록된 코드 1개'));
    expect(box.textContent).toContain('1234 5678 9012');
    const area = box.querySelector('textarea')!;
    fireEvent.change(area, { target: { value: '지우 1111 2222 3333\n이슬 4444 5555 6666\n웅이 12\n' } });
    expect(box.textContent).toContain('새 항목 1개 · 기존 코드 변경 1개 · 형식 오류 1개');
    expect(box.textContent).toContain('3번째 줄은 12자리 숫자가 필요해요.');
    const save = [...box.querySelectorAll('button')].find((one) => one.textContent === '유효한 2개 저장')!;
    fireEvent.click(save);
    await waitFor(() => expect(api.putTrainer).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(box.textContent).toContain('2개 저장 · 형식 오류 1개는 남겨 뒀어요'));
    expect((box.querySelector('textarea') as HTMLTextAreaElement).value).toBe('웅이 12');
    expect(box.textContent).not.toMatch(LEAK);
  });

  it('트레이너 코드 삭제 — 확인 팝업을 지나야 지운다', async () => {
    await asRole('admin');
    api.trainers.mockResolvedValue(TRAINERS);
    api.removeTrainer.mockResolvedValue(undefined);
    const { default: AdminTrainers } = await import('../screens/AdminTrainers');
    const box = render(createElement(AdminTrainers)).container;
    await waitFor(() => expect(box.textContent).toContain('지우'));
    fireEvent.click([...box.querySelectorAll('button')].find((one) => one.textContent === '삭제')!);
    expect(api.removeTrainer).not.toHaveBeenCalled();
    const dialog = document.querySelector('.adm-confirm')!;
    expect(dialog.textContent).toContain('지우 · 1234 5678 9012');
    fireEvent.click([...dialog.querySelectorAll('button')].find((one) => one.textContent === '삭제')!);
    await waitFor(() => expect(api.removeTrainer).toHaveBeenCalledWith('지우'));
  });
});
