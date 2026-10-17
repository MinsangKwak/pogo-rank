// 상세의 탭 줄 (진화 · 요약 / 배틀 정보) — 모양은 parts.css 의 px-tabs 하나다. id · role 은 v3 때 그대로(검사 · GA 가 읽는다)
import { PixelIcon } from '../PixelIcon';

export default function DetailTabs<T extends string>({ tabs, value, onChange }: {
  tabs: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void;
}) {
  return <div className="px-tabs" role="tablist" aria-label="포켓몬 정보">
    {tabs.map(([id, label], index) => <button key={id} type="button" className="px-tab px-skin" role="tab"
      id={`detail-tab-${id}`} aria-controls={`detail-pane-${id}`} data-tab={id}
      tabIndex={id === value ? 0 : -1} aria-selected={id === value} onClick={() => onChange(id)}
      onKeyDown={(event) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % tabs.length
          : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
        if (next < 0) return;
        event.preventDefault();
        onChange(tabs[next]![0]);
        document.getElementById(`detail-tab-${tabs[next]![0]}`)?.focus();
      }}>{id === 'battle' ? <PixelIcon name="sword" /> : <PixelIcon name="dex" />}{label}</button>)}
  </div>;
}
