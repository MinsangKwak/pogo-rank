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
```

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
