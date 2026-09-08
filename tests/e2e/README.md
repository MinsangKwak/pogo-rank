# e2e 회귀 스위트

`dist/` 를 로컬 서버로 띄우고 Playwright 로 훑는다. 프레임워크 없이 스크립트 하나에 단언을 나열하는 방식이라
`node <파일>` 하나로 돌고, 통과 수와 실패 항목만 찍는다.

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
node tests/e2e/shell.js     # 앱 셸 — 스크롤·헤더 배치·드로어 중복·2열 카드·버튼 반응
node tests/e2e/hardening.js # 보안(CSP·출처 검사)·공유 카드(OG)·검색 부속 파일
```

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

## 전제

- Playwright 와 Chromium 이 필요하다. 경로는 각 파일 맨 위 `require`·`executablePath` 에 적혀 있다
- 서버 주소는 `http://localhost:5503/`, 목 모드는 `?mock=1` (frontend/static/dev-mock.js)
- 외부 요청은 전부 차단한다 — 폰트·스프라이트 CDN 을 기다리느라 느려지지 않게
