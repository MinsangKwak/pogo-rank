// scripts/openapi.ts — 지금 코드의 OpenAPI 문서를 openapi.json 으로 굽는다.
//
// 저장소에 넣어 두는 이유 — 서버를 안 띄우고도 리뷰에서 **주소가 어떻게 바뀌었는지** 보인다.
// 어긋나면 src/test/openapi.test.ts 가 잡는다.
'use strict';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openapiSpec, specText } from '../src/lib/spec.ts';

const here = dirname(fileURLToPath(import.meta.url));
const spec = await openapiSpec();

const json = resolve(here, '../openapi.json');
writeFileSync(json, specText(spec));
console.log(`구웠다: ${json}`);

// **서버를 안 띄우고도 볼 수 있게 한 장으로 굽는다.** 운영에서는 /docs 가 같은 것을 서빙하지만,
// 리뷰하거나 남에게 보여 줄 때 컨테이너를 띄우게 만들면 아무도 안 본다.
// 스펙을 박아 넣으므로 이 파일은 `npm run openapi` 가 다시 구울 때만 바뀐다
const page = resolve(here, '../../docs/server-api.html');
writeFileSync(page, `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>moncamp 수집 서버 API</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
<style>body{margin:0}.topbar{display:none}</style>
</head><body>
<div id="ui"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
<script>
  // 스펙을 박아 두어 이 파일 하나만 열면 된다 (server/scripts/openapi.ts 가 굽는다)
  window.ui = SwaggerUIBundle({
    spec: ${JSON.stringify(spec)},
    dom_id: '#ui',
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    tryItOutEnabled: false,
  });
</script>
</body></html>
`);
console.log(`구웠다: ${page}`);
