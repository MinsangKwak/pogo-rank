/** Shell navigation icons use a consistent, unfilled 24px stroke grid. */
const paths: Record<string,string> = {
 '🏠':'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
 '📢':'M4 10h5l11-5v14L9 14H4zM7 14l2 7h4l-3-7M20 10h2v4h-2',
 '📅':'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2',
 '⚔️':'M4 3l10 10-3 3L3 6V3zM14 16l6 6M13 19l6-6M20 3 14 9M20 3v3M4 20l5-5M3 17l4 4',
 '🥚':'M19 15c0 4-3 7-7 7s-7-3-7-7S8 2 12 2s7 9 7 13z',
 '📕':'M5 3h14v18H5zM8 3v18M11 7h5M11 11h5',
 '✨':'m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z',
 '🃏':'M6 3h13v18H6zM3 6v15M12 7l3 5-3 5-3-5z',
 '🎒':'M6 7h12l2 14H4zM9 7V3h6v4M8 14h8v5H8z',
 '🔎':'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0M15 15l6 6',
 '🔍':'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0M15 15l6 6',
 '🎉':'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
 '🔒':'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
 '📜':'M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7',
 '🛠':'M14 4a6 6 0 0 0-7 8l-5 6 4 4 6-6a6 6 0 0 0 8-7l-5 4-4-4z',
 '🍪':'M20 12a8 8 0 1 1-8-8v4l4 1v3zM8 11h.01M8 16h.01M13 16h.01',
 'ℹ️':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7h.01',
 '☰':'M4 6h16M4 12h16M4 18h16', '✕':'m5 5 14 14M19 5 5 19',
 '←':'M20 12H4m7-7-7 7 7 7', '↑':'M12 20V4m-7 7 7-7 7 7',
 '🌙':'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',
 '☀️':'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
};
export function OutlineIcon({emoji}: {emoji:string}) {
 return <svg className="outline-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[emoji] ?? 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 3v18M3 12h18'} /></svg>;
}
