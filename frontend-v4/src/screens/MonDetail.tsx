// ─────────────────────────────────────────────────────────────────────────────
// screens/MonDetail.tsx — 포켓몬 상세 팝업
//
// v3 의 이 팝업은 "다시 그리지 않는다" 를 손으로 지키고 있었다 — 탭·스크롤·계산기 입력값이
// 날아가서다(v3.60.0 의 ★ 도, 📣 배지도 제자리에서 글자만 갈아 끼웠다).
// React 에서는 그 규칙이 공짜다. 상태가 바뀌어도 바뀐 부분만 다시 그려진다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useDex, useFavEvents } from '../lib/data';
import { Sprite, TypeDot } from '../components/Bits';

const LEVELS: [string, string][] = [['l20', '레이드'], ['l25', '부스트'], ['l30', '야생'], ['l40', 'Lv.40'], ['l50', 'Lv.50']];

function cpAt(atk: number, def: number, hp: number, cpm: number): number {
  return Math.max(10, Math.floor(((atk + 15) * Math.sqrt(def + 15) * Math.sqrt(hp + 15) * cpm * cpm) / 10));
}

export default function MonDetail({ dex, onClose }: { dex: number; onClose: () => void }) {
  const { data } = useDex();
  const { data: fav } = useFavEvents();
  const [tab, setTab] = useState<'summary' | 'matchup'>('summary');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const form = data.DEX_DATA.forms[String(dex)];
  const name = data.DEX_DATA.names[String(dex)] ?? `#${dex}`;
  if (!form) return null;

  // 이 종에 잡힌 일정 — v3.60.0 의 📣 배지와 같은 데이터
  const news = fav.FAV_EVENTS.filter((event) => event.dex.includes(dex) && Date.parse(event.end || event.start) >= Date.now());

  // 방어 상성 — 이 종을 때리는 타입별 배율. chart[공격][방어] 를 두 타입에 곱한다
  const chart = data.DEX_DATA.chart;
  const against = Object.keys(chart)
    .map((atk) => ({ atk, mult: form.types.reduce((acc, def) => acc * (chart[atk]?.[def] ?? 1), 1) }))
    .filter((row) => Math.abs(row.mult - 1) > 0.01)
    .sort((a, b) => b.mult - a.mult);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__wrap" onClick={(event) => event.stopPropagation()}>
        <div className="modal__box">
          <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
          <div className="detail detail--mon" data-route="mon" data-dex={dex} data-tab={tab}>
            <div className="detail__bar">
              <p className="detail__bar-title">포켓몬 상세</p>
              <div className="detail__top-actions">
                <a className="detail__bar-btn detail__bar-dex" href="#/dex" onClick={onClose}>📖 포켓몬 도감</a>
              </div>
            </div>

            <div className="detail__side">
              <div className="sprite-box">
                <Sprite id={dex} />
                <div className="detail__types">{form.types.map((type) => <TypeDot key={type} type={type} />)}</div>
              </div>
              <div className="detail__info">
                <div className="detail__tags"><span className="tag detail__dexno">#{String(dex).padStart(4, '0')}</span></div>
                <h2>{name}</h2>
                <div className="detail__en-inline">{data.DEX_DATA.en[String(dex)] ?? ''}</div>
                {news.length ? (
                  <a className="detail__favnews" href="#/schedule" onClick={onClose}>
                    <span className="detail__favnews-dot" aria-hidden="true">📣</span>
                    <b className="detail__favnews-kind">{news[0]!.title}</b>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="detail__main">
              <div className="tabs">
                <button className={`tabs__item${tab === 'summary' ? ' is-on' : ''}`} onClick={() => setTab('summary')}>요약</button>
                <button className={`tabs__item${tab === 'matchup' ? ' is-on' : ''}`} onClick={() => setTab('matchup')}>상성</button>
              </div>

              {tab === 'summary' ? (
                <div className="detail__pane" data-pane="summary">
                  <section className="detail__card">
                    <h3>종족값</h3>
                    <div className="detail__cp-grid">
                      <div className="detail__cp-tile"><em>공격</em><b>{form.atk}</b></div>
                      <div className="detail__cp-tile"><em>방어</em><b>{form.def}</b></div>
                      <div className="detail__cp-tile"><em>체력</em><b>{form.hp}</b></div>
                    </div>
                  </section>
                  <section className="detail__card">
                    <h3>CP (개체값 15/15/15)</h3>
                    <div className="detail__cp-grid">
                      {LEVELS.map(([key, label]) => {
                        const cpm = data.DEX_DATA.cpm[key];
                        if (!cpm) return null;
                        return (
                          <div key={key} className="detail__cp-tile">
                            <em>{label}</em><b>{cpAt(form.atk, form.def, form.hp, cpm).toLocaleString()}</b>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="detail__card">
                    <h3>배울 수 있는 기술</h3>
                    <div className="detail__moves">
                      <p><b>스피드</b> {form.fast.map(([move, legacy]) => `${move}${legacy ? '*' : ''}`).join(' · ')}</p>
                      <p><b>차지</b> {form.charged.map(([move, legacy]) => `${move}${legacy ? '*' : ''}`).join(' · ')}</p>
                    </div>
                    <p className="detail__foot">* 는 레거시 기술이에요.</p>
                  </section>
                </div>
              ) : (
                <div className="detail__pane" data-pane="matchup">
                  <section className="detail__card">
                    <h3>이 포켓몬을 때릴 때</h3>
                    <div className="chips">
                      {against.map((row) => (
                        <span key={row.atk} className={`chips__item${row.mult > 1 ? ' is-on' : ''}`}>
                          {data.TYPE_KO[row.atk] ?? row.atk} ×{row.mult.toFixed(2).replace(/\.?0+$/, '')}
                        </span>
                      ))}
                    </div>
                    <p className="detail__foot">배율이 1 인 타입은 빼고 보여 드려요.</p>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
