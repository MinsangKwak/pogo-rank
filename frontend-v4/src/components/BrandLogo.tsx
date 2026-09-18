export default function BrandLogo() {
  return (
    <button type="button" id="app-logo" className="app-bar__logo"
      aria-label="moncamp 홈" onClick={() => { location.hash = '#/'; }}>
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M14 2h4v4h2v4h2v4h2v4h2v4h2v6H4v-6h2v-4h2v-4h2v-4h2V6h2z" fill="currentColor" />
        <path d="M12 16h8v2h2v6h-2v2h-8v-2h-2v-6h2z" fill="var(--surface)" />
        <path d="M10 20h12v2H10zM14 18h4v6h-4z" fill="currentColor" />
        <path d="M15 20h2v2h-2z" fill="var(--surface)" />
      </svg>
      <span>moncamp</span>
    </button>
  );
}
