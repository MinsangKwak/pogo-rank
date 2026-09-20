import { useState } from 'react';
import { asOfLabel, HotHead, HotList, useHotRows } from '../components/HotSearch';
import { ViewToggle } from '../components/Bits';
import { useHotSearchSoft } from '../lib/data';
import { num } from '../lib/cell';
import world from '../lib/world-map.json';
import type { OpenMon } from '../lib/mon';
import '../styles/hot-page.css';

const regions = new Intl.DisplayNames(['ko'], { type: 'region' });
export function countryName(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? regions.of(code) ?? code : '지역 미확인';
}

export default function HotSearchPage({ onOpen }: { onOpen: OpenMon }) {
  const global = useHotRows();
  const hot = useHotSearchSoft();
  const [country, setCountry] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const countries = hot?.countries ?? [];
  const selected = countries.find(item => item.code === country);
  const rows = country ? selected?.rows ?? [] : global.rows;
  const options = [...new Set([...world.map(item => item.code), ...countries.map(item => item.code)])].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ko'));
  const max = Math.max(1, ...countries.map(item => item.total));

  return (
    <div className="page hot-page">
      <section className="hot-atlas" aria-labelledby="atlas-title">
        <div className="hot-atlas__heading"><div><span className="hot-atlas__eyebrow">SEARCH ATLAS</span><h2 id="atlas-title">지금, 세계의 관심은?</h2><p>국가를 선택하고 많이 찾아본 포켓몬을 만나보세요.</p></div><span className="hot-atlas__badge">하루 두 번 업데이트</span></div>
        <div className="hot-atlas__body">
          <div className="hot-atlas__map">
            <svg viewBox="0 0 720 300" role="group" aria-label="국가별 인기 검색 지도">
              {world.map(item => {
                const data = countries.find(entry => entry.code === item.code);
                // 지도는 마우스용이다 — 177개 나라를 탭으로 도는 대신 아래 <select> 가 키보드 길이라 tabIndex 를 뺀다
                return <path key={item.code} d={item.path} role="button" tabIndex={-1}
                  aria-label={`${countryName(item.code)}${data ? ` · 검색 ${num(data.total)}회` : ' · 집계 없음'}`}
                  aria-pressed={country === item.code}
                  className={`${data ? 'has-data' : ''} ${country === item.code ? 'is-selected' : ''}`}
                  style={data ? { fillOpacity: .3 + .7 * data.total / max } : undefined}
                  onClick={() => setCountry(item.code)}><title>{countryName(item.code)} · {data ? `${num(data.total)}회` : '집계 없음'}</title></path>;
              })}
            </svg>
            <div className="hot-atlas__legend"><span>옅을수록 적은 검색</span><i aria-hidden="true" /><span>많은 검색</span></div>
            <a className="hot-atlas__credit" href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">지도: Natural Earth · 경계는 참고용</a>
          </div>
          <div className="hot-atlas__selector">
            <label htmlFor="hot-country">어느 나라가 궁금하세요?</label>
            <select id="hot-country" value={country} onChange={event => setCountry(event.target.value)}><option value="">전 세계</option>{options.map(code => <option key={code} value={code}>{countryName(code)}</option>)}</select>
            <button className="hot-atlas__all" onClick={() => setCountry('')} aria-pressed={!country}>전 세계 순위 보기 ↗</button>
            <div className="hot-atlas__countries">{countries.slice().sort((a,b) => b.total-a.total).slice(0,5).map(item => <button key={item.code} onClick={() => setCountry(item.code)} aria-pressed={country === item.code}><span>{countryName(item.code)}</span><b>{num(item.total)}회</b></button>)}</div>
            {!countries.length && <p className="hot-atlas__notice">국가별 검색은 아직 집계되지 않았어요. 집계 후 지도에 표시됩니다.</p>}
          </div>
        </div>
      </section>
      <section className={`hot-results hot-results--${view}`} aria-label="검색 순위">
        <div className="hot-results__heading"><div>{country ? <><h3>{countryName(country)} 인기 검색</h3><p>선택한 국가에서 검색해 연 포켓몬{hot?.asOf ? ` · ${asOfLabel(hot.asOf)} 기준` : ''}</p></> : <HotHead source={global.source} label={global.label} />}</div><ViewToggle view={view} onToggle={() => setView(view === 'grid' ? 'list' : 'grid')} extraClass="" /></div>
        <div aria-live="polite">{rows.length ? <HotList rows={rows} onOpen={onOpen} /> : <p className="empty">{country ? `${countryName(country)}의 검색 데이터가 아직 없어요. 다른 국가나 전 세계 순위를 선택해 주세요.` : '아직 검색 데이터가 충분하지 않아요.'}</p>}</div>
      </section>
      <p className="detail__foot">실시간 순위가 아닌 정기 집계입니다. 검색창에서 골라 연 포켓몬만 세며, 통계를 꺼 두신 분의 검색은 포함하지 않아요. 국가별 집계는 분석 서비스에서 확인된 접속 국가를 기준으로 합니다.</p>
    </div>
  );
}
