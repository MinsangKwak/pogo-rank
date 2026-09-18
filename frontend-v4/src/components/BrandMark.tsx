export default function BrandMark() {
  return <span className="v4-mark" id="v4-mark" role="img" aria-label="React v4" title="React v4">
    <svg viewBox="0 0 52 28" aria-hidden="true" focusable="false">
      <g fill="none" stroke="var(--mark-react)" strokeWidth="1.8">
        <ellipse cx="14" cy="14" rx="12" ry="4" />
        <ellipse cx="14" cy="14" rx="12" ry="4" transform="rotate(60 14 14)" />
        <ellipse cx="14" cy="14" rx="12" ry="4" transform="rotate(120 14 14)" />
      </g>
      <rect x="12" y="12" width="4" height="4" fill="var(--mark-react)" />
      <g shapeRendering="crispEdges">
        <path d="M36 4h8v2h4v4h2v8h-2v4h-4v2h-8v-2h-4v-4h-2v-8h2V6h4z" fill="var(--mark-light)" />
        <path d="M36 4h8v2h4v4h2v4H30v-4h2V6h4z" fill="var(--mark-ball)" />
        <path d="M30 12h20v4H30z" fill="var(--mark-dark)" />
        <path d="M36 10h8v8h-8z" fill="var(--mark-dark)" />
        <path d="M38 12h4v4h-4z" fill="var(--mark-light)" />
      </g>
    </svg>
  </span>;
}
