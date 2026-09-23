// ─────────────────────────────────────────────────────────────────────────────
// components/MonFacts.tsx — 서버가 그리는 상세의 사실 (v5 Phase 6)
//
// **크롤러가 읽는 것이 이 덩어리다.** 클라이언트 화면이 데이터를 받아 오는 동안 이 자리에
// 서 있다가, 다 받으면 진짜 화면이 대신 들어선다 (App.tsx 의 `seo` 자리).
//
// 그래서 여기 있는 글자는 **사람에게도 쓸모가 있어야 한다** — 크롤러만 보라고 숨겨 둔 글은
// 검색엔진이 싫어하고, 무엇보다 느린 회선에서 먼저 보이는 것이 이 화면이다.
//
// JSON-LD 를 같이 박는다. 이름·설명·그림을 구조화해 두면 검색 결과의 생김새가 달라진다.
// ─────────────────────────────────────────────────────────────────────────────
import type { MonFacts as Facts } from '../lib/facts.server';

export function monTitle(facts: Facts): string {
  return `${facts.name} — 종족값·타입 상성·기술 | 포켓몬고 도감`;
}

export function monDescription(facts: Facts): string {
  const types = facts.typesKo.join('·');
  return `포켓몬고 ${facts.name}(No.${facts.dexNo}) 정보. ${types} 타입, 공격 ${facts.atk} · 방어 ${facts.def} · 체력 ${facts.hp}. 배울 수 있는 기술과 타입 상성, 최대 CP 를 확인해 보세요.`;
}

export default function MonFacts({ facts }: { facts: Facts }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: monTitle(facts),
    description: monDescription(facts),
    image: `https://moncamp.kr/sprites/${facts.sprite}.png`,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', name: 'moncamp', url: 'https://moncamp.kr/' },
  };

  return (
    <div className="detail detail--facts" data-route="mon" data-sprite={facts.sprite}>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="detail__name">
        {facts.name}
        {facts.nameEn ? <span className="detail__en">{facts.nameEn}</span> : null}
      </h1>
      <p className="detail__sub">{`도감번호 ${facts.dexNo} · ${facts.typesKo.join(' · ')}`}</p>

      <section className="detail__sec">
        <h2>종족값</h2>
        <dl className="detail__stats">
          <div><dt>공격</dt><dd>{facts.atk}</dd></div>
          <div><dt>방어</dt><dd>{facts.def}</dd></div>
          <div><dt>체력</dt><dd>{facts.hp}</dd></div>
        </dl>
      </section>

      {facts.fast.length ? (
        <section className="detail__sec">
          <h2>빠른 공격</h2>
          <p>{facts.fast.join(' · ')}</p>
        </section>
      ) : null}

      {facts.charged.length ? (
        <section className="detail__sec">
          <h2>주요 기술</h2>
          <p>{facts.charged.join(' · ')}</p>
        </section>
      ) : null}

      <p className="detail__foot">상세 정보를 불러오는 중…</p>
    </div>
  );
}
