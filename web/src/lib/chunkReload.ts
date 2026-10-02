// ─────────────────────────────────────────────────────────────────────────────
// lib/chunkReload.ts — 스크립트 조각(chunk)을 못 받으면 스스로 한 번 새로 고친다 (2026-10-02 주인 요청)
//
// 왜 필요한가
//   Next 는 화면을 조각 파일(_next/static/chunks/…)로 나눠 받는다. 하나라도 못 받으면 다시 받지 않고
//   'Application error: a client-side exception has occurred' 한 줄만 남긴 채 멈춘다.
//   v5.9.4 운영 점검에서 회선이 잠깐 끊겨 레이아웃 조각 하나를 못 받았을 때 실제로 그렇게 섰다.
//   새 판을 올린 뒤 옛 탭이 지워진 옛 조각을 찾을 때도 같은 모양이 된다.
//
// 왜 번들이 아니라 문서 머리에 심나
//   못 받는 조각이 이 코드를 담은 바로 그 조각(레이아웃)일 수 있다 — 그러면 듣개도 같이 사라진다.
//   그래서 THEME_SCRIPT 처럼 HTML 안에 글자로 심어, 어떤 조각보다 먼저 듣게 한다 (app/layout.tsx).
//
// 무엇을 조각 실패로 보나
//   ① `_next/static/` 의 <script> 가 못 받혔다(error 이벤트는 거품이 안 올라와 잡는 단계에서 듣는다)
//   ② 던져진 오류 · 처리 안 된 약속의 이름 · 글이 조각 실패다 — webpack 의 ChunkLoadError,
//      'Loading chunk 177 failed' · 'Loading CSS chunk … failed', 브라우저의 동적 import 실패 문구
//   스타일시트(<link>)는 보지 않는다 — 미리 받기가 끊길 때도(ERR_ABORTED) 오류가 나서 괜한 새로 고침이 된다
//
// 무한히 돌지 않게
//   새로 고친 시각을 sessionStorage 에 적고, 1분 안에는 다시 고치지 않는다 — 조각이 정말 없어졌으면
//   한 번 고친 뒤 원래 오류 화면에 머문다. 저장소를 막은 브라우저는 적을 수 없으니 고치지 않는다
// ─────────────────────────────────────────────────────────────────────────────

// 새 이름 — 기존 pogo_* 값과 겹치지 않는다(lib/autoUpdate.ts 의 pogo_reload_built 와 같은 꼴)
export const CHUNK_RELOAD_KEY = 'pogo_chunk_reload';
// 같은 탭에서 다시 고치기까지 기다리는 시간
export const CHUNK_RELOAD_GAP = 60 * 1000;

// 조각 실패를 알아보는 글 — 크롬 · 사파리 · 파이어폭스의 동적 import 실패 문구까지
export const CHUNK_ERROR = /ChunkLoadError|Loading (?:CSS )?chunk \S+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

/** 문서 머리에 심는 조각 — 번들에 기대지 않으므로 옛 문법(var · function)으로 쓴다 */
export const CHUNK_SCRIPT = `(function(){var KEY=${JSON.stringify(CHUNK_RELOAD_KEY)},GAP=${CHUNK_RELOAD_GAP},BAD=${CHUNK_ERROR.toString()};
function again(){try{var last=Number(sessionStorage.getItem(KEY))||0;if(Date.now()-last<GAP)return;sessionStorage.setItem(KEY,String(Date.now()));}catch(e){return;}location.reload();}
function text(x){return x?String(x.name||'')+' '+String(x.message||x):'';}
addEventListener('error',function(e){var el=e.target;
if(el&&el.tagName==='SCRIPT'&&/\\/_next\\/static\\//.test(el.src||'')){again();return;}
if(BAD.test(String(e.message||''))||BAD.test(text(e.error)))again();},true);
addEventListener('unhandledrejection',function(e){if(BAD.test(text(e.reason)))again();});})();`;
