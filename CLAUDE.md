# moncamp — 작업 지침

이 파일은 세션마다 먼저 읽힌다. **어길 수 없는 규칙만** 둔다.
자세한 설명은 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) · [`docs/OPERATIONS.md`](docs/OPERATIONS.md) · [`docs/INFRA.md`](docs/INFRA.md) 에 있다.

---

## 1. `NaN` · `undefined` 는 어떤 상태에서도 화면에 못 나간다

**절대 규칙이다.** 로그인 전후 · 권한 있고 없고 · 데이터 있고 없고 · 어느 탭 어느 칩이든,
사용자가 보는 글자에 `NaN` · `undefined` · `null` · `Infinity` · `[object Object]` 가 섞이면 안 된다.

### 왜 샜나

표마다 줄 모양이 다르기 때문이다. D-MAX 만 해도 셋이다.

| 축 | 표 | 줄이 가진 칸 |
| --- | --- | --- |
| 티어표 | `dynamax_tier.json` | `pct` `atk` `power` `stab` `bulk` |
| 딜러 | `dynamax.json` | `dmg` `bulk` `fast` `charged` |
| 탱커 | `dynamax_tank.json` | `ehp` `hp` `def` `mult` — 기술 칸이 없다 |

탱커 줄이 딜러 문법을 타면서 `NaN 맥스 피해 · 내구 undefined` 가 그대로 찍혔다 (v4.2.4 제보).
표는 바뀌었는데 읽는 쪽이 안 바뀐 것이다. 읽는 자리가 화면 곳곳에 흩어져 있으면 사람이 다 볼 수 없다.

### 그래서 지켜야 할 셋

1. **값을 글자로 바꾸는 일은 [`lib/cell.ts`](frontend-v4/src/lib/cell.ts) 에서만 한다.**
   화면(JSX)에서 `.toFixed()` 나 `` `${row.x}` `` 를 직접 쓰지 않는다.

   ```tsx
   // ✅ 관문을 통한다
   sub={`DPS ${num(row.dps)} · TDO ${num(row.tdo)}`}
   score={num(row.score, 1)}
   lines={keep(row.fast, row.charged)}   // 빈 값은 줄 자체를 세우지 않는다

   // ❌ 값이 비면 그대로 샌다
   sub={`DPS ${row.dps} · TDO ${row.tdo}`}
   score={row.score.toFixed(1)}
   ```

2. **줄 모양이 갈리면 칸을 정하는 일을 한 함수로 뽑는다.**
   `dmaxCells` · `pveCells` · `pvpCells` 가 그 본이다 (`screens/Ranks.tsx`).
   화면에서 `if (axis === …)` 로 칸을 나누지 말고, 함수 안에서 나누고 함수를 검사한다.

3. **값이 비면 대시(`—`)를 찍는다.** 틀린 숫자를 지어내느니 빈 칸이 정직하다.
   단, 이 표들은 빌드가 모든 칸을 채우므로 **대시가 보이면 그것도 사고다** — 데이터가 빈 게 아니라
   읽는 쪽이 딴 키를 보고 있다는 뜻이다. 검사가 그래서 대시까지 잡는다.

### 기계가 막는 그물 셋

지침만 적어 두면 또 샌다. 층을 셋 둔다 — **위가 뚫려도 아래가 잡는다.**

| 층 | 무엇 | 언제 돈다 |
| --- | --- | --- |
| 관문 | `lib/cell.ts` — `num` · `word` · `lines` | 늘 (화면이 값을 찍을 때마다) |
| 단위 | `src/test/cellgate.test.ts` **관문 자체**(깨진 값 열한 가지 × 세 함수)<br>`src/test/rankcells.test.ts` 손으로 적은 줄 모양<br>`src/test/datasweep.test.ts` **실데이터 전량**(모든 표 · 모든 키 · 모든 줄) | `npm test` · CI 의 `v4 검사` |
| 조각 | `scripts/check-stories.mjs` — 스토리 전량을 라이트·다크로 훑는다 (§1-c) | 조각을 고칠 때 |
| 화면 | `scripts/check_screens.mjs` — 46장을 돌며 그려진 글자를 훑는다 | 배포 전 (아래 참고) |
| 색 | `scripts/check_contrast.mjs` — 42장의 글자가 바탕에 묻히지 않는지 본다 (§1-b) | 배포 전 |

**관문 자체를 검사하는 층이 2026-09-21 에 생겼다.** 그전까지 `rankcells` 는 관문을 *쓰는 쪽*만 봤고
관문 자체는 아무도 안 보고 있었다 — 그래서 `word(NaN)` 이 `'NaN'` 을, `num('   ')` 이 `'0'` 을
그대로 내보내고 있었다. 스토리북에 빈 값을 늘어놓는 판(`parts-value--leaky`)을 세우자 드러났다.

```bash
cd frontend-v4 && npm test                       # 관문 + 단위
node scripts/check_screens.mjs                   # 로컬 미리보기(:4173) 훑기
node scripts/check_screens.mjs https://dev.moncamp.kr/   # 배포된 화면 훑기
```

**새 표나 새 화면을 붙이면 셋 다 늘린다.** `datasweep` 에 표를 한 줄 더하고,
`check_screens.mjs` 의 `PATHS` 에 주소를 더한다. 안 늘리면 그 자리만 그물 밖이다.

---

## 1-b. 안 보이는 글자를 만들지 않는다

**색을 한 벌 갈아끼우면 글자와 바탕이 따로 움직인다.** v4.3.0 카드 컨셉 작업에서 같은 사고를 두 번 냈다 —
홈 타일과 상세 머리줄에서 **흰 글자가 흰 바탕에** 놓였다. 46장을 사람이 다 눈으로 볼 수는 없다.

### 색을 고를 때 지켜야 할 셋

1. **채움 위 글자는 `var(--bg)`, 판 위 글자는 `var(--fg)`.**
   `#fff` 나 `var(--surface)` 를 글자색으로 쓰지 않는다 — 둘 다 다크에서 어두워져 뒤집힌다.
   `--bg` 는 `--brand` 계열 채움과 언제나 반대 끝에 있어 테마가 뒤집혀도 같이 뒤집힌다.

2. **글자색을 바꿀 때는 바탕도 같이 본다.** 배경만 밝히면 그 위 글자가 사라진다.
   단축 `background` 는 뒤에 오면 앞의 `background-image` 를 지운다 —
   그림(그라데이션) 위에 글자를 올릴 때는 **바탕색을 먼저 박아** 그림이 빠져도 읽히게 한다.

3. **하드코딩 색은 토큰으로.** 색이 파일마다 박혀 있으면 팔레트를 갈아도 그 자리만 남는다.
   v4.3.0 에서 `shell-notebook.css` · `home.css` 의 182군데를 토큰으로 돌렸다.

4. **테마를 안 타고 늘 어두운 판(검색식 콘솔 · 홈 히어로)은 `--plate` 한 벌로.** `--bg`·`--fg` 는 다크에서
   판이 밝아져 뒤집히고, hex 는 채움과 글자의 짝이 끊긴다 (v4.4.0).

```bash
node scripts/check_contrast.mjs                          # 로컬 미리보기(:4173)
node scripts/check_contrast.mjs https://dev.moncamp.kr/   # 배포된 화면
```

42장(라이트·다크)을 열어 글자와 뒤바탕의 명암비를 재고 **3.0 아래**를 잡는다.
WCAG 의 4.5 가 아니라 3.0 인 이유는, 여기서 찾는 것이 "읽기 불편함" 이 아니라 **"아예 안 보임"** 이라서다.
접근성 감사는 따로 할 일이고, 이 그물은 배포를 세워야 할 사고만 건진다.

**게임 원작 타입색(`--t-*`)은 바꾸지 않는다.** 밝은 타입 위 흰 글자가 흐린 것은 알려진 한계다 —
색을 바꾸면 게임과 어긋나므로, 필요하면 글자에 그늘을 깔아 윤곽을 남긴다.

---

## 1-c. 조각은 `src/ds/` 에서 만들고 스토리북으로 본다

**격자 밖 값은 타입이 막는다.** 지침으로 적어 두면 또 샌다 — v4.3.4 에 크기 474군데 ·
간격 1,484군데가 격자 밖이었다. 스냅만 해 두면 다음 화면이 또 적는다.

- `<Stack gap>` · `<Inline gap>` 은 `none·xs·sm·md·lg·xl` 여섯 칸뿐이다 (4px 격자)
- `<Text size>` 는 `sub·body·lead` (Pretendard 12·14·16)
- `<Label size>` 는 `body·sec·title·hero` (Galmuri 14·22·28·42)
- `<Label size="sub">` 는 **못 써진다** — Galmuri 12px 은 11·14 격자의 정수배가 아니다

**새 클래스를 함부로 만들지 않는다.** 버튼 · 칩 · 세그먼트 · 뱃지는 v3 CSS 가 이미 계약
(클래스명 · 태그 · 중첩)을 들고 있다. `ds/` 의 조각은 그 클래스를 **그대로 내보낸다** —
같은 모양을 새 이름으로 다시 그리면 디자인이 두 벌이 되고 한쪽만 고쳐진다.
없던 것(배치 · 글자 · 안내 · 카드 · 타입 알약)만 `src/styles/ds.css` 에서 만든다.

**토큰 목록(`src/ds/tokens.ts`)에 없는 이름을 적으면 검사가 선다.** 없는 토큰을 쓰면
화면에 `var(--없는것)` 이 나가 색이 통째로 빠지는데 **오류도 경고도 안 난다.**

```bash
cd frontend-v4
npm run storybook                                  # :6006
npm run build-storybook                            # storybook-static/
node scripts/check-stories.mjs http://localhost:4189/   # 전량 × 라이트·다크
```

**배포된 도면은 https://dev.moncamp.kr/storybook/ 이다** — dev 가 올라갈 때 같이 올라간다.
하위 주소에 얹으므로 `STORYBOOK_BASE=/storybook/` 로 빌드해야 한다. 안 주면 자산 주소가
루트 기준(`/assets/…`)이라 열자마자 빈 화면이다. 배포 워크플로가 그 주소와 noindex 메타를 검사한다.
도면은 **서다 말아도 배포를 안 세운다** — 화면이 멀쩡한데 도면 때문에 dev 가 깜깜해지면 손해가 더 크다.

**같은 도메인에 앱 밖의 판을 얹으면 서비스워커가 비켜 가게 한다** (`public/sw.js` 의 `OUTSIDE`).
범위가 루트라 그냥 두면 들어온다 — 실측: `/storybook/` 을 열자 그 HTML 이 앱의 오프라인 자리에
덮였고(도면 청크 9개까지 같이 들어왔다), 오프라인에서 `/storybook/` 이 앱 화면으로 답했다.
`src/test/swscope.test.ts` 가 배포가 얹는 자리와 서비스워커가 비켜 가는 자리를 견준다.

`check-stories.mjs` 는 배포 전 검문과 **같은 재는 자**를 쓴다
(`scripts/lib/contrast_audit.mjs`). 잣대가 두 벌이면 한쪽만 따라온다.

**쿼리스트링을 지우는 정적 서버를 쓰지 않는다** — `serve` 는 `cleanUrls` 로 `?id=` 를 버려서
모든 스토리가 "No Preview" 로 열리고, 검문이 빈 화면을 훑고 통과한다.
같은 이유로 **스토리 id 와 테마 전역값은 ASCII 로만 둔다** (보이는 이름은 한글 그대로다) —
`?globals=theme:다크` 는 주소에서 지워져 라이트로 열렸다.

**새 조각을 붙이면 스토리도 붙인다.** 안 붙이면 그 조각만 그물 밖이다.

---

## 2. 리팩토링해도 바꾸면 안 되는 이름

바깥(브라우저 저장소 · 통계 · 문서)이 이미 이 이름으로 물려 있다. **바꾸면 남의 데이터가 끊긴다.**

- 전역 이름 · `state` 키 · DOM id
- localStorage 키 **그리고 값** (`pogo_*`)
- GA 이벤트명
- Firestore 필드명
- 저장소명 (`pogo-rank`, `pogo-rank-dev`) · 서비스워커 캐시 이름

새로 만드는 것은 접두사를 달아 구분한다.

## 3. 데이터

- **한글 이름은 실데이터만 쓴다. 지어내지 않는다.**
- 트레이너 코드 · 친구 이름은 **Firestore 에만** 둔다. 코드에 박지 않는다.
- **수집 서버는 IP 를 저장하지 않는다** (v4.7.0). 나라는 앞단이 판정해 둔 코드를 읽는다
  ([`server/src/lib/country.ts`](server/src/lib/country.ts)) — 사람을 가리키는 값은 어느 표에도 두지 않는다.
  **'안 본다' 와 '안 남긴다' 를 섞어 적지 않는다** — 분당 한도는 IP 를 보고 버린다. 방침에는 남기지 않는다고만 적는다.
  통계를 끈 사람(`pogo_consent=denied`)에게서는 GA4 와 마찬가지로 **한 건도 안 나간다.**
- **`firestore.rules` 를 고치면 `cd frontend-v4 && npm run test:rules`** (v4.9.7). 에뮬레이터가 규칙을 실제로 돌려 본다.
  삭제 요청에는 `request.resource` 가 없다 — `write` 하나로 묶어 본문을 읽으면 삭제가 **조용히** 막힌다.
  계정 삭제가 그렇게 죽어 있었다. 규칙은 **콘솔에 게시해야** 적용된다 — 코드 배포와 별개다.
- **서버 응답 스키마에 `object` 를 적을 때는 칸도 같이 적는다** (v4.8.1). `fast-json-stringify` 는
  적힌 칸만 내보낸다 — 칸 없는 `{ type: 'object' }` 는 값이 들어 있어도 `{}` 로 나가고
  **오류도 경고도 없다.** 설명서를 붙이는 일이 계약을 깨뜨린 자리다.
  `src/test/openapi.test.ts` 가 스펙 전체를 훑어 잡는다 — 새 주소를 붙여도 자동으로 걸린다.
- **약관·개인정보처리방침의 원본은 `frontend-v4/src/screens/Legal.tsx` 와 `components/TermsConsent.tsx` 둘이다.**
  2026-09-22 v5 Phase 1-C 에 v3 화면을 지우면서 판이 하나가 됐다 — 전에는 v3 의 `privacy.js`·`terms.js` 와
  넷이라 `legalsync.test.ts` 가 문장 단위로 견줬고, 지울 때 그 검사가 통과 상태였으므로 v4 본문이 온전하다.
  **동의 범위를 고칠 때는 시행일과 패치노트 고지를 함께 본다** (아래 수집 항목 줄).
- **수집 항목이 늘면 시행 7일 전에 패치노트로 알린다.** 방침 10번에 적어 둔 약속이다.
  이번 건의 고지는 2026-09-21 에 나갔고 적은 시행일은 **2026-09-28** 이다.
  **2026-09-22 에 주인이 수집을 바로 켜기로 했다** (v5 Phase 8). 새 화면이 그날 이후에 뜨면
  적은 대로이고, 그 전에 뜨면 **패치노트의 날짜를 실제 날짜로 고친다** —
  고지와 실제가 어긋난 채로 두는 것이 제일 나쁘다.

## 4. 비밀

- `.env` 와 `firestore.rules.local` 은 gitignore 대상이다. **커밋하지 않는다.**
- 서비스 계정 JSON 키는 대화 · 노션 · 저장소 어디에도 붙여 넣지 않는다.
- `BACKUP_PASSPHRASE` 는 비밀번호 관리자에 둔다.
- 규칙을 mock uid 로 렌더하지 않는다 — `scripts/render_rules.sh` 가 막는다.

## 5. 판 번호의 원본은 `release/version.json` 하나다

**고칠 곳이 여섯이던 시절이 있었다** — build.py 의 상수, v3 의 `RELEASE_VER`, 패치노트 한글·영문,
CHANGELOG, README. 한 군데만 빠져도 화면과 문서가 어긋났고, 사람이 여섯 번 안 틀리기를 바라는 것은
규칙이 아니라 기대다. 2026-09-22 v5 Phase 1 에 원본을 하나로 모으고 나머지는 기계가 견준다.

| 자리 | 무엇 | 누가 지키나 |
| --- | --- | --- |
| **`release/version.json`** | `app`(화면 머리) · `release`(패치노트 빨간 점) | **여기만 손으로 고친다** |
| `content/release-notes.mjs` | 한글 패치노트 본문 | `src/test/version.test.ts` |
| `content/release-notes.en.mjs` | 영문 패치노트 — 키가 한글판 `date` 와 글자까지 같아야 한다 | 〃 |
| `CHANGELOG.md` · `README.md` | 건수 + 날짜 묶음 | 〃 |

`backend/build.py` 와 `frontend-v4/scripts/extract-data.mjs` 는 `version.json` 을 읽는다. 손으로 안 적는다.
dev 채널의 `-dev` 접미사도 둘이 같은 규칙으로 붙인다.

**릴리스는 묶어서 낸다.** 커밋마다 판을 올리지 않는다 — 22일에 250판(하루 최다 34판)을 낸 적이 있는데,
그건 릴리스가 아니라 커밋에 번호를 붙인 것이다. 사용자가 읽을 만한 덩어리가 모이면 그때 올린다.

## 6. 빌드와 배포

- **`scripts/build.sh` 는 v4 를 다시 빌드하지 않는다.** 화면을 확인하기 전에 `cd frontend-v4 && npm run build` 를 따로 돌린다.
- 커밋 전에 `git checkout -- snapshot/` — 빌드가 스냅샷을 건드린다.
- 빠른 길: `build.sh --meta-only`(2초) · `--no-fetch`(3초) · `--no-sprites`
- **`build.sh` 는 화면을 안 만든다** (v5 Phase 1-C). `dist/` 에 나오는 것은 `data.js` · 스프라이트 · 부속 파일(robots · sitemap · 404 · build.json)뿐이고, 화면은 `frontend-v4` 가 만든다
- 배포: dev → main PR 병합 → `deploy` 브랜치에 main 을 머지 → `bash scripts/verify_deploy.sh https://moncamp.kr/ prod`

## 7. 글과 코드의 결

- **두괄식으로 쓴다.** 결론 먼저, 근거는 뒤에. 겹치는 표현은 지운다.
- 주석은 `//` 한 줄씩 단다. 여러 줄이면 `//` 를 줄마다 붙인다.
- 주석은 **왜** 를 적는다. 무엇을 하는지는 코드가 말한다.
- CSS: 1) 최대한 변수화 2) override 최소화 3) 컴포넌트화 4) 나머지는 성능에 문제 없으면 둔다.
- v4 화면 규칙이 v3 스킨을 이겨야 하면 접두사는 **`html body #root` 하나만** 쓴다. 장치가 둘이면 셋이 된다
  ([`docs/DEVELOPMENT.md` §2.26](docs/DEVELOPMENT.md)). `#page-head` 의 `margin`·`padding` 은 단축으로 적지 않는다 — 왼쪽 값(사이드바 자리)이 지워진다.

### 글자와 간격은 격자 위에만 둔다 (v4.3.4)

**글자 크기는 글꼴로 갈린다.** 이 서비스는 두 글꼴을 쓰고, 각자 쓸 수 있는 크기가 다르다.

| 줄기 | 글꼴 | 크기 | 쓰임 |
| --- | --- | --- | --- |
| 읽는 글 | Pretendard | `1.2` · `1.4` · `1.6` rem | 보조 · 본문 · 강조 |
| 크롬 | Galmuri | `1.4` · `2.2` · `2.8` · `4.2` rem | 칩·탭·버튼 · 구역 제목 · 화면 제목 · 큰 숫자 |

- **`1.2`(12px)가 읽는 글의 최소선이다.** Material(Body S 12)도 네이버 가이드도 같고,
  한글은 라틴보다 자소가 복잡해 11px 이하에서 판독이 급격히 나빠진다.
- **Galmuri 에는 `1.2`·`1.6` 을 주지 않는다.** 11·14px 의 정수배가 아니라 픽셀이 뭉개진다.
  Galmuri 쪽에서 본문보다 작은 글자가 필요하면 크기를 줄이지 말고 **색(`--muted`)으로 누른다.**
- **본문(14)과 구역 제목(22) 사이에 칸이 없는 것은 글꼴의 성질이다.** 그 사이가 필요하면
  크기가 아니라 **굵기**로 가른다.

| 무엇 | 격자 | 왜 |
| --- | --- | --- |
| 간격 | `0.4rem` 배수 (0.2 는 머리카락 선 하나만 예외) | 4px 격자. 거리가 같으면 **넓은 쪽**으로 붙인다 |
| 줄 높이 | `1` · `1.2` · `1.5` · `1.7` | 한 줄 · 제목 · 본문 · 긴 글 |
| 누르는 것 | 최소 높이 `var(--tap)` = 44px | Material 48dp · Apple 44pt |

v4.3.4 에 크기 474군데·간격 1484군데를 격자로 스냅했고, v4.3.5 에 11px 을 없앴다.

## 8. 이 환경의 함정

- `sleep N && …` 는 막힌다. `until <조건>; do sleep 20; done` 을 쓴다.
- `pkill` 을 다른 명령과 `&&` 로 엮으면 셸이 같이 죽는다(exit 144). 혼자 돌린다.
- Playwright 는 `/opt/node22/lib/node_modules/playwright/index.js` 를 직접 불러야 한다.
  실서비스 주소를 열 때는 `args: ['--ignore-certificate-errors']` 가 필요하다.
