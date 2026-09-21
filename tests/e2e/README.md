# e2e 회귀 스위트

[← README](../../README.md) · [개발 문서](../../docs/DEVELOPMENT.md) · [기여 안내](../../CONTRIBUTING.md)

**로컬 `dist/`를 Playwright로 열어 화면과 사용자 흐름을 검증합니다.** 각 스크립트는 `node <파일>`로 실행하며, 통과 수와 실패 항목을 출력합니다.

실행 순서: [환경 준비](#전제) → [빌드·서버·테스트 실행](#돌리는-법). 새 테스트를 작성할 때는 아래 공통 도우미를 사용하세요.

## 전제

- Playwright 와 Chromium 이 필요하다. 경로는 `_lib.js` 맨 위 한 곳에 있다
- 서버 주소는 `http://localhost:5503/`, 목 모드는 `?mock=1` (frontend/static/dev-mock.js)
- 외부 요청은 전부 차단한다 — 폰트·스프라이트 CDN 을 기다리느라 느려지지 않게

## 돌리는 법

```bash
# 1) 목 모드로 빌드 (실제 Firebase 없이 로그인 흐름까지 확인하려면 값이 아무거나 있어야 한다)
FIREBASE_CONFIG_JSON='{"apiKey":"local-test","projectId":"local-test"}' ADMIN_UID=mock-admin python3 backend/build.py

# 2) dist 를 띄운다
(cd dist && python3 -m http.server 5503) &

# 3) 스위트 실행
node tests/e2e/nav.js       # 탐색·디자인 (홈 타일 · 탭 줄 · 팝업 기하 · 드로어 · 토큰 색)
node tests/e2e/legal.js     # 약관·동의 배너·개인정보처리방침·계정 삭제
node tests/e2e/gameday.js   # ⚔️ 레이드 보스 · 🥚 알 부화 · 유사백 판정
node tests/e2e/shell.js     # 앱 셸 — 스크롤·헤더 배치·드로어 중복·카드 보기·버튼 반응
node tests/e2e/router.js   # 주소 체계 — 라우트 표·옛 주소 이전·측정용 식별자
node tests/e2e/hardening.js # 보안(CSP·출처 검사)·공유 카드(OG)·검색 부속 파일
```

## 공통 조각 — `_lib.js` (v3.14.0)

테스트별로 반복되던 초기화 코드를 공통 도우미로 분리했습니다. 새 테스트는 다음 형식으로 작성하세요:

```js
'use strict';
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';
suite(async () => {
  const browser = await launch();                                        // /opt/pw-browsers/chromium
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 } });  // 가입 권유 팝업 '본 적 있음' · 동의 배너 '거부' · 바깥 요청 차단
  const page = await ctx.newPage();
  await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);                                                // 스플래시가 걷힐 때까지 (최대 45초)
  // … ok('이름', 조건, 덧붙일 값)
  await finish(browser);                                                 // 합계 출력 + 종료 코드
});
```

- 동의 배너를 검사하는 스위트는 `newContext(browser, { banner: true, … })` — 배너가 그대로 뜬다.
- 화면을 연 뒤에는 **반드시 `waitSplash(page)`** — 직접 `waitForSelector('#splash', …)` 를 적지 않는다 (v3.22.0). 대기 한도가 15초일 때 워커 4개로 병렬 실행하면 부하가 높을 때 첫 화면이 그 안에 안 떴고 `.catch` 가 실패를 삼켜 **매번 다른 스위트**가 오탐으로 실패했다(단독 실행은 늘 통과).
- 화면이 그려지길 기다릴 때 `waitForTimeout(500)` 같은 **고정 대기를 쓰지 않는다** — 재려는 것이 붙을 때까지 `waitForSelector` 로 기다린다. 같은 이유로 흔들린다.
- 없는 버튼을 `click({ timeout }).catch()` 로 "혹시 있으면 누르기" 하지 않는다 — 없을 때마다 그 시간을 통째로 잃는다 (v3.14.0 에 그 줄 32개가 회귀 45초를 먹고 있었다).
- 이름이 `_` 로 시작하는 파일은 스위트가 아니다 (`scripts/test.sh` 가 건너뛴다).

## shell.js — 스크롤이 막히는 원인을 직접 잡는다

"스크롤이 안 된다"는 제보는 재현 조건이 커서 위치·화면 폭·직전 동작에 달려 있어 눈으로 쫓기 어렵다.
그래서 결과(굴러가는가)와 **원인**(휠을 가로채는 요소가 있는가)을 함께 본다.

- 화면 15개 × 두 폭에서 실제로 휠을 굴려 문서가 움직이는지
- `overflow-y` 가 `auto`/`scroll` 이면서 넘침이 24px 이하인 요소 — 가로 스크롤만 의도했는데
  세로로 1~2px 넘쳐 휠을 먹는 덫이다 (docs/DEVELOPMENT.md 2.22)
- 오버레이 여닫기 9가지 조합(검색·드로어·상세 × Esc·뒤로가기·해시이동) 뒤 잠금이 남는지
- 잠금이 남아도 화면을 옮기면 풀리는지 (자가 복구, 2.23)

## fingerprint.js — 이름만 바꾸는 리팩토링을 검증할 때

22개 화면 × 두 폭(390 · 1440)에서 계산된 스타일 지문을 뜬다.
**클래스 이름을 지문에서 뺐다** — 태그·깊이·44개 계산 속성만 남기므로,
리팩토링 전후 지문이 같으면 이름만 바뀌고 렌더는 그대로라는 뜻이다.
선택자를 새 이름으로 고친 테스트는 이름이 틀려도 통과하기 때문에 이 검증이 따로 필요하다 (docs/DEVELOPMENT.md 2.19).

```bash
node tests/e2e/fingerprint.js before   # 리팩토링 전
node tests/e2e/fingerprint.js after    # 리팩토링 후
diff -rq tests/e2e/fp-before tests/e2e/fp-after
```

## 남은 한글 찾기 (KR/EN)

`node scripts/i18n_audit.js` — 언어를 EN 으로 두고 열아홉 화면과 드로어·팝업·모의 로그인을 열어 한글이 남은 텍스트·`aria-label`·`placeholder`·`title` 을 어디서 나왔는지와 함께 찍는다. 회귀 스위트가 아니라 사전을 손볼 때 쓰는 도구다. 일정표 이벤트·시즌 이름은 일부러 한국어로 두므로 남아도 된다.
