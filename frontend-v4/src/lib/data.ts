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
import { useQuery, useSuspenseQuery, type UseSuspenseQueryResult } from '@tanstack/react-query';
import type {
  DexBundle, MaxBundle, PveBundle, PvpBundle, GamedayBundle,
  FavEventsBundle, UpdatesBundle, MetaBundle, UsageBundle, ScheduleBundle, ReleaseBundle, Manifest,
  HotSearchBundle,
} from '../types/data';

const BASE = `${import.meta.env.BASE_URL}data/`;

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
// 인기 검색어는 **기다리지 않는 훅**이다 — 없어도 홈은 그려져야 한다 (아직 집계 전이거나 GA 가 조용할 수 있다)
export const useHotSearchSoft = bundleSoftHook<HotSearchBundle>('hotsearch');
export const useFavEvents = bundleHook<FavEventsBundle>('fav-events');
export const useUpdates = bundleHook<UpdatesBundle>('updates');
export const useMeta = bundleHook<MetaBundle>('meta');
export const useUsage = bundleHook<UsageBundle>('usage');
export const useSchedule = bundleHook<ScheduleBundle>('schedule');
export const useRelease = bundleHook<ReleaseBundle>('release');
