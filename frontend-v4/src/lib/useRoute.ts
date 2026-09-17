// ─────────────────────────────────────────────────────────────────────────────
// lib/useRoute.ts — 지금 어느 화면인가
//
// **주소가 유일한 원본이다.** v3 는 같은 사실을 `state.tab` · `state.appMode` ·
// `state.pveTool` · `state.pvpTool` · `state.maxTool` 다섯 곳에 복사해 두고
// applyPlanRoute() 가 해시를 읽어 그 다섯을 맞추고 있었다.
// 여기서는 복사본을 두지 않는다 — 필요할 때 주소에서 뽑는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ROUTES, routeCanonical, routeOfPath, type RouteDef } from '../routes';

export interface CurrentRoute {
  route: RouteDef;
  rest: string;
  params: URLSearchParams;
}

function parse(): CurrentRoute {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart = '', queryPart = ''] = raw.split('?');
  const found = routeOfPath(pathPart);
  return {
    route: found?.route ?? ROUTES[0],
    rest: found?.rest ?? '',
    params: new URLSearchParams(queryPart),
  };
}

/** 옛 주소면 새 주소로 조용히 옮긴다 (뒤로가기 기록에 옛 주소가 쌓이지 않게 replace) */
function canonicalize(): boolean {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart = '', queryPart] = raw.split('?');
  const next = routeCanonical(pathPart);
  if (next === null) return false;
  location.replace(`#/${next}${queryPart ? `?${queryPart}` : ''}`);
  return true;
}

export function useRoute(): CurrentRoute {
  const [current, setCurrent] = useState<CurrentRoute>(() => {
    canonicalize();
    return parse();
  });
  useEffect(() => {
    const onChange = () => {
      if (canonicalize()) return;   // replace 가 hashchange 를 한 번 더 부른다
      setCurrent(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return current;
}
