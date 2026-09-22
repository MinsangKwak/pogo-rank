// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx — 홈 (v5 Phase 6)
// ─────────────────────────────────────────────────────────────────────────────
import AppClient from '../src/AppClient';
import RouteIntro from '../src/components/RouteIntro';
import { ROUTES } from '../src/routes';

export default function HomePage() {
  return <AppClient seo={<RouteIntro route={ROUTES[0]} />} />;
}
