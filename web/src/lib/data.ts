// ─────────────────────────────────────────────────────────────────────────────
// lib/data.ts — 빌드 데이터를 받아 오는 자리 (TanStack Query)
//
// **여기가 react-query 가 실제로 일하는 첫 자리다.**
// v3 에서는 data.js 985KB 가 <script> 로 통째로 실려, 홈만 열어도 도감·PvE·PvP·D-MAX 를
// 전부 내려받고 파싱했다(실측 파싱 347ms). 지금은 화면이 필요할 때 그 묶음만 받는다.
//
// 캐시 키에 **해시가 들어간다.** 그래서 staleTime 을 Infinity 로 둬도 안전하다 —
// 내용이 바뀌면 manifest 의 해시가 바뀌고, 해시가 바뀌면 키가 바뀌어 저절로 새로 받는다.
// manifest 만 5분마다 다시 보면 된다 (v3 의 freshness.js 가 하던 일).
// ─────────────────────────────────────────────────────────────────────────────
import { BASE as ASSETS } from './base';

import { useQuery, useSuspenseQuery, type UseSuspenseQueryResult } from '@tanstack/react-query';
import type {
  DexBundle, MaxBundle, PveBundle, PvpBundle, GamedayBundle,
  FavEventsBundle, UpdatesBundle, MetaBundle, UsageBundle, ScheduleBundle, ReleaseBundle, Manifest,
} from '../types/data';

const BASE = `${ASSETS}data/`;

export const qk = {
  manifest: ['manifest'] as const,
  bundle: (name: string, hash: string) => ['data', name, hash] as const,
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} 를 받지 못했습니다 (${res.status})`);
  return (await res.json()) as T;
}

/** 해시 목록. 이것만 주기적으로 다시 본다 */
export function useManifest() {
  return useSuspenseQuery({
    queryKey: qk.manifest,
    queryFn: () => getJson<Manifest>('manifest.json'),
    staleTime: 5 * 60 * 1000,
  });
}

/** 새 빌드가 올라왔는지 조용히 지켜본다 (v3 freshness.js 의 자리) */
export function useFreshness() {
  const { data: first } = useManifest();
  return useQuery({
    queryKey: ['freshness'],
    queryFn: () => getJson<Manifest>(`manifest.json?t=${Date.now()}`),
    refetchInterval: 5 * 60 * 1000,
    select: (latest) => latest.built !== first.built,
  });
}

// 묶음 하나를 받는 훅을 찍어 내는 틀.
// Suspense 를 쓰는 이유 — 화면마다 `if (isLoading) return …` 을 쓰면 그 분기가 곧 버그 자리가 된다.
// 경계 한 곳에서 한 번만 처리한다 (App.tsx 의 <Suspense>).
// 같은 묶음을 **기다리지 않고** 받는 틀 — 곁줄(메뉴의 기술 변경)처럼 없어도 화면이 서야 하는 자리.
// 키·해시가 bundleHook 과 같아 캐시를 나눠 쓴다: 어느 쪽이 먼저 받든 한 번만 받는다
function bundleSoftHook<T>(name: string) {
  return (): T | undefined => {
    const { data: manifest } = useManifest();
    const hash = manifest.files[name]?.hash ?? 'dev';
    return useQuery({
      queryKey: qk.bundle(name, hash),
      queryFn: () => getJson<T>(`${name}.json?v=${hash}`),
      staleTime: Infinity,
      gcTime: Infinity,
    }).data;
  };
}

function bundleHook<T>(name: string) {
  return (): UseSuspenseQueryResult<T> => {
    const { data: manifest } = useManifest();
    const hash = manifest.files[name]?.hash ?? 'dev';
    return useSuspenseQuery({
      queryKey: qk.bundle(name, hash),
      queryFn: () => getJson<T>(`${name}.json?v=${hash}`),
      staleTime: Infinity,      // 키에 해시가 있으므로 이 값은 영원히 신선하다
      gcTime: Infinity,
    });
  };
}

export const useDex = bundleHook<DexBundle>('dex');
export const useMax = bundleHook<MaxBundle>('max');
export const usePve = bundleHook<PveBundle>('pve');
export const usePvp = bundleHook<PvpBundle>('pvp');
export const useGameday = bundleHook<GamedayBundle>('gameday');
export const useGamedaySoft = bundleSoftHook<GamedayBundle>('gameday');
export const useDexSoft = bundleSoftHook<DexBundle>('dex');
// 홈 배너의 거다이맥스 폼 그림만 여기서 찾는다 — 없어도 도감 번호로 그리므로 배너를 세우지 않는다
export const useMaxSoft = bundleSoftHook<MaxBundle>('max');
export const useFavEvents = bundleHook<FavEventsBundle>('fav-events');
export const useUpdates = bundleHook<UpdatesBundle>('updates');
export const useMeta = bundleHook<MetaBundle>('meta');
// **셸은 meta.json 을 기다리면 안 된다** (v5 Phase 7). 머리줄의 패치노트 빨간 점이 useMeta 를
// 통해 이 묶음을 빨고 있었는데, useMeta 는 Suspense 라 묶음이 올 때까지 셸 전체가 안 그려졌다 —
// 실측 1.6Mbps·CPU 4배에서, 스크립트는 1.6초에 다 받고도 화면은 3.5초에 떴다.
// 점 하나는 한 박자 늦게 켜져도 된다. 화면이 2초 늦는 것과 바꿀 것이 아니다
export const useMetaSoft = bundleSoftHook<MetaBundle>('meta');
export const useUsage = bundleHook<UsageBundle>('usage');
export const useSchedule = bundleHook<ScheduleBundle>('schedule');
// 홈 배너가 gameday 가 버린 이번 주 맥스 먼데이를 채울 때만 읽는다 — 배너를 세우지 않는다 (lib/maxSlides.ts weeksFromSchedule)
export const useScheduleSoft = bundleSoftHook<ScheduleBundle>('schedule');
export const useRelease = bundleHook<ReleaseBundle>('release');
