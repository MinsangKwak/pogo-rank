// ─────────────────────────────────────────────────────────────────────────────
// test/boundary.test.tsx — 자료를 못 받았을 때 **빈 화면이 안 나온다**
//
// 2026-09-22 실측에서 드러난 자리다. `data/*.json` 을 끊고 화면을 열었더니
// 본문이 영원히 빈 채로 남았고, 더 끊으면 셸까지 통째로 사라졌다 (#content 가 없어졌다).
// `useSuspenseQuery` 는 실패하면 던지는데 받는 경계가 저장소 어디에도 없었기 때문이다.
//
// 광고로 사람이 들어오는 판에서 이게 제일 나쁘다 — 회선이 흔들리는 휴대폰에서 한 번 비면
// 그 사람은 고장 난 사이트를 보고 떠난다. 다시 누를 자리도 없이.
//
// 여기서 셋을 못 박는다: 던진 것을 받는가 · 다시 받을 단추가 있는가 · 그 단추가 실제로 살리는가.
// ─────────────────────────────────────────────────────────────────────────────
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataBoundary } from '../components/DataBoundary';

// 경계가 콘솔에 남기는 줄과 React 의 경고를 검사 출력에서 걷어낸다 (일부러 던지는 검사다)
let quiet: ReturnType<typeof vi.spyOn>;
beforeEach(() => { quiet = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { quiet.mockRestore(); });

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** 한 번은 실패하고 그다음부터 성공하는 자료 — '회선이 돌아왔다' 를 흉내 낸다 */
function makeSource() {
  let alive = false;
  return {
    revive: () => { alive = true; },
    fetch: async () => {
      if (!alive) throw new Error('끊김');
      return '자료 도착';
    },
  };
}

function Screen({ source }: { source: { fetch: () => Promise<string> } }) {
  const { data } = useSuspenseQuery({ queryKey: ['t'], queryFn: source.fetch });
  return <p>{data}</p>;
}

describe('DataBoundary', () => {
  it('자료를 못 받으면 빈 화면 대신 말과 단추를 남긴다', async () => {
    const source = makeSource();
    render(
      <QueryClientProvider client={client()}>
        <DataBoundary>
          <Suspense fallback={<p>기다리는 중</p>}>
            <Screen source={source} />
          </Suspense>
        </DataBoundary>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('자료를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  it("'다시 불러오기' 가 실제로 자료를 되살린다", async () => {
    // 단추가 react-query 의 실패 기록까지 지워야 한다 — 안 지우면 다시 그려도 캐시의 실패를 또 던진다
    const source = makeSource();
    render(
      <QueryClientProvider client={client()}>
        <DataBoundary>
          <Suspense fallback={<p>기다리는 중</p>}>
            <Screen source={source} />
          </Suspense>
        </DataBoundary>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    source.revive();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await waitFor(() => expect(screen.getByText('자료 도착')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('성한 자료는 그대로 그린다 — 경계가 길을 막지 않는다', async () => {
    const source = makeSource();
    source.revive();
    render(
      <QueryClientProvider client={client()}>
        <DataBoundary>
          <Suspense fallback={<p>기다리는 중</p>}>
            <Screen source={source} />
          </Suspense>
        </DataBoundary>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('자료 도착')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('경계 **밖**에서 던지면 못 잡는다 — 그래서 main.tsx 가 바깥에 한 겹 더 둔다', async () => {
    // 이 검사가 두 겹인 이유를 지킨다. Shell.tsx 가 머리줄에서 useMeta() 를 쓰므로
    // 안쪽 경계만 있으면 셸이 먼저 터져 경계가 그려지지도 않는다 (실측)
    function Outer() {
      const [boom] = useState(true);
      if (boom) throw new Error('셸에서 터짐');
      return null;
    }
    expect(() => render(
      <QueryClientProvider client={client()}>
        <Outer />
        <DataBoundary><p>안쪽</p></DataBoundary>
      </QueryClientProvider>,
    )).toThrow();
  });
});
