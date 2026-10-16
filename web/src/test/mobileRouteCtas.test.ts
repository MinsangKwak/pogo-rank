// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const styles = ['ranks', 'news', 'modal'].map((name) => read(`styles/pixel/${name}.css`)).join('\n');

// jsdom does not evaluate viewport media queries. Select their actual CSSOM rules
// for each width, then let its style engine verify the cascade and selectors.
function atWidth(width: number) {
  const source = document.createElement('style');
  source.textContent = styles;
  document.head.append(source);
  const active = (rules: CSSRuleList): string => [...rules].map((rule) => {
    if (rule.type === CSSRule.STYLE_RULE) return rule.cssText;
    if (rule.type !== CSSRule.MEDIA_RULE) return '';
    const media = rule as CSSMediaRule;
    const max = /max-width:\s*(\d+)px/.exec(media.conditionText);
    const min = /min-width:\s*(\d+)px/.exec(media.conditionText);
    if ((!max && !min) || (max && width > Number(max[1])) || (min && width < Number(min[1]))) return '';
    return active(media.cssRules);
  }).join('\n');
  const resolved = active(source.sheet!.cssRules);
  source.textContent = resolved;
}

function visible(id: string) {
  for (let node = document.getElementById(id); node; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('모바일 보조 페이지 이동 단추', () => {
  it.each([320, 390, 699, 700, 1200])('%ipx에서 페이지 이동만 접고 팝업·계산·서랍 동작은 유지한다', (width) => {
    document.body.innerHTML = `<div id="root">
      <div class="rk-bar__tools"><button id="dmax" class="rk-route-cta">D-MAX 덱 짜기</button><button id="info">계산 기준</button></div>
      <div id="pve-tools" class="rk-bar__tools rk-route-cta"><button id="pve">솔플 계산기</button></div>
      <div class="px-note__actions rk-route-cta"><button id="pvp-deck">PvP 덱 짜기</button></div>
      <div class="px-note__actions rk-route-cta"><button id="pvp-iv">PvP 개체값 순위</button></div>
      <div class="nw-boss__actions"><button id="boss">보스 상세 보기</button><a id="solo" class="nw-boss__route-cta" href="/pve/solo">솔플 계산기</a></div>
      <dialog class="px-dialog pxd-dialog--brief" open><footer id="brief-foot" class="px-dialog__foot pxd__foot pxd-route-cta"><p>자세한 건 도감을 참고하세요!</p><button id="deep">도감에서 자세히</button><button>D-MAX 순위</button><button>PvP 순위</button></footer></dialog>
      <dialog class="px-dialog" open><footer class="px-dialog__foot pxd__foot"><button id="dex" class="pxd-route-cta">포켓몬 도감</button><button id="share">링크 복사</button><button id="calc">CP 계산기</button></footer></dialog>
      <dialog class="px-dialog pxd-dialog--brief" open><footer id="calc-foot" class="px-dialog__foot pxd__foot"><button id="reset">초기화</button><button id="return">상세로 돌아가기</button></footer></dialog>
      <button id="card">포켓몬 상세 보기</button><button id="select">선택</button><button id="remove">삭제</button><nav><a id="drawer" href="/pve/solo">솔플 계산기</a></nav>
    </div>`;
    atWidth(width);
    for (const id of ['dmax', 'pve-tools', 'pve', 'pvp-deck', 'pvp-iv', 'solo', 'brief-foot', 'deep', 'dex']) {
      expect(visible(id), id).toBe(width > 699);
    }
    for (const id of ['info', 'boss', 'share', 'calc', 'calc-foot', 'reset', 'return', 'card', 'select', 'remove', 'drawer']) {
      expect(visible(id), id).toBe(true);
    }
    if (width <= 699) expect(getComputedStyle(document.querySelector('.nw-boss__actions')!).gridTemplateColumns).toBe('minmax(0, 1fr)');
  });

  it('실제 화면은 이동 단추만 표시하고 기존 이동·팝업 콜백을 보존한다', () => {
    const ranks = read('screens/Ranks.tsx');
    expect(ranks).toContain("routeToolsOnly ? ' rk-route-cta' : ''");
    expect(ranks).toMatch(/className="[^"]*rk-route-cta" onClick=\{\(\) => \{ go\('\/dmax\/deck'\)/);
    expect(ranks).toMatch(/routeToolsOnly\s+tools=\{<button[^\n]+go\('\/pve\/solo'\)/);
    for (const route of ['/pvp/deck', '/pvp/ivrank']) {
      const button = ranks.indexOf(`go('${route}')`);
      expect(ranks.slice(ranks.lastIndexOf('<div', button), button)).toContain('className="px-note__actions rk-route-cta"');
    }
    expect(ranks).toMatch(/className="px-btn px-skin" aria-expanded=\{info\}[\s\S]*?setInfo\(!info\)/);
    const gameday = read('screens/Gameday.tsx');
    expect(gameday).toContain('className="px-btn px-skin nw-boss__route-cta" href="/pve/solo"');
    expect(gameday).toMatch(/className="px-btn px-skin px-btn--primary" onClick=\{\(\) => onOpen\([\s\S]*?보스 상세 보기/);
    expect(gameday.match(/dexNoOf\(mon.sprite, data.DEX_DATA.dex\)/g)).toHaveLength(3);
    const detail = read('screens/MonDetail.tsx');
    expect(detail).toMatch(/className="px-btn px-skin pxd-route-cta" onClick=\{\(\) => \{ go\('\/dex'\)/);
    expect(detail).toContain("brief && screen !== 'calc' ? ' pxd-route-cta' : ''");
    for (const action of ['reset', 'return', 'calc']) {
      expect(detail).toMatch(new RegExp(`className="(?![^"]*pxd-route-cta)[^"]+" data-act="${action}"`));
    }
  });
});
