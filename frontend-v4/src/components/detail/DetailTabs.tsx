export default function DetailTabs<T extends string>({ tabs, value, onChange }: {
  tabs: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void;
}) {
  return <div className="detail__tabs" role="tablist" aria-label="포켓몬 정보">
    {tabs.map(([id, label], index) => <button key={id} className="detail__tab" role="tab"
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
      }}>{label}</button>)}
  </div>;
}
