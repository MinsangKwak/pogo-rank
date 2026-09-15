# moncamp — 어떤 포켓몬을 키우고, 어떤 포켓몬을 공략할지

moncamp는 포켓몬고의 랭킹, 도감, 일정, 레이드 계산기, 육성 플래너를 한 곳에서 제공하는 초보 트레이너용 정적 웹 서비스입니다. GitHub Actions가 매일 최신 데이터를 수집해 자동으로 빌드하고 배포합니다. PWA를 지원하므로 홈 화면에 설치해 앱처럼 사용할 수도 있습니다.

> **서비스명 변경:** 2026년 9월 14일에 POGO PLAN에서 monlab(v3.26.0)을 거쳐 **moncamp(몬캠프, v3.27.0)**로 변경했습니다. monlab은 `.com`과 `.app`도메인이 이미 사용 중이어서 하루 만에 이름을 다시 변경했습니다.
>
> 저장소명(`pogo-rank`), localStorage 키(`pogo_*`), GA이벤트명, 서비스 워커 캐시 이름(`pogoplan-v5`)은 기존 값을 유지합니다. 이미 배포된 값을 변경하면 사용자의 저장 데이터가 연속성을 잃을 수 있기 때문입니다.

- **실서비스:** [https://moncamp.kr/](https://moncamp.kr/) — `deploy` 브랜치, v3.27.0부터 커스텀 도메인 사용. 기존 주소인 `minsangkwak.github.io/pogo-rank/`는 새 주소로 이동합니다.
- **미리보기:** [https://dev.moncamp.kr/](https://dev.moncamp.kr/) — `dev` 브랜치, 버전명에 `-dev` 표시

## 문서

| 문서 | 주요 내용 |
| --- | --- |
| 📘 [개발 문서](docs/DEVELOPMENT.md) | 설계 원칙, 의사결정 기록, 데이터 소스와 파이프라인, 계산식, 프런트엔드 및 저장소 구조, 설정 방법, 알려진 한계 |
| 📗 [운영 문서](docs/OPERATIONS.md) | 릴리스 절차, 버전 규칙, 배포 장애 대응, 로그인과 가입 승인, 트레이너 코드, Firebase 설정, GA4 통계, 노션 운영 방안, 점검 목록 |
| 🛡 [인프라 문서](docs/INFRA.md) | 정적 사이트에서 가능한 트래픽·오남용 대응과 서비스 확장 로드맵(도메인 → Cloudflare → App Check) |
| 🗒 [변경 이력](CHANGELOG.md) | 버전별 상세 변경 사항과 의사결정 배경 |
| 🛠 [QA 트래커(노션)](https://www.notion.so/a0472984122d4f25b9b445b57465568f) | 외부 사용자가 버그를 제보하는 공간. 내부 관리용 WBS와 용도가 다르므로 주소를 변경하지 않습니다. |
| 📄 [NOTICE](NOTICE.md) · [CONTRIBUTING](CONTRIBUTING.md) · [SECURITY](SECURITY.md) | 라이선스 및 데이터 출처 조건, DCO 기반 기여 방법, 보안 취약점 제보 절차(v2.18.0) |

## 기능

### 랭킹

- **D-MAX:** `[전체 | 딜러 | 탱커]` 보기와 타입 필터를 제공합니다. 전체 화면은 pogomate 기준의 티어표를 보여 주며, 행을 선택하면 선정 근거와 카운터를 확인할 수 있습니다. 딜러 화면은 보스 타입별 맥스 어태커를, 탱커 화면은 EHP(`체력 × 방어 ÷ 받는 피해 배율`) 기준 순위를 제공합니다. 상단의 `⚔️ 이번 주 보스` 영역에서는 딜러 2마리와 탱커 1마리로 구성된 추천 파티도 확인할 수 있습니다.
- **PvE:** 구하기 쉬운 포켓몬 중심의 `일반` 목록과 hawaii 성능표 및 자체 계산을 반영한 `전체` 목록을 전환해 볼 수 있습니다. 솔로 레이드 계산기는 보스 검색, 난이도 자동 판정, 부활 운영 시뮬레이션을 거쳐 공략 가능 여부와 필요한 개체 수, 총 피해량을 계산합니다.
- **PvP:** 리틀·슈퍼·하이퍼·마스터리그별 PvPoke 점수와 추천 기술을 제공합니다. 덱 구성 기능에서는 메타 기반 추천 덱 3종과 상대 슬롯에 맞춘 커스텀 덱·카운터를 제안하고, 추천 이유도 함께 설명합니다.
- **활용처:** 별도 탭 대신 검색 결과에서 제공합니다. 검색어가 없으면 여러 순위표에서 고르게 높은 포켓몬을 보여 주고, 각 검색 후보에는 `활용 N곳` 배지를 표시합니다(v2.16.0).

### 도감

- 도감 번호순 전체 목록, 이름·번호 검색, 1~9세대 바로가기, 1열·2열 보기 전환, 미출시 포켓몬의 `[미구현]` 표시를 지원합니다.
- 상세 화면에서는 타입, 이름, 획득 방식별 CP, 보유 개체의 CP 계산, 능력치, 기술, 상성, 활용처, 진화 정보를 차례로 확인할 수 있습니다. 메가진화 폼과 메가진화 X·Y 비교표도 제공합니다.

### 육성 플래너

도감이 포켓몬의 객관적인 성능을 보여 준다면, 육성 플래너는 사용자가 보유한 개체를 어떻게 키울지 판단하도록 돕습니다. 헤더의 배지로 플래너 모드로 전환하면 메뉴가 `[홈 | 내 포켓몬]`으로 바뀌며, 주소는 `#/plan/*` 형식을 사용합니다(v2.15.0).

- **내 포켓몬:** 보유 개체를 종, 폼, 그림자 여부, 레벨, 개체값, 기술, 육성 상태, 메모 단위로 계정에 저장할 수 있습니다. 같은 종도 여러 마리 등록할 수 있으며, CP 자동 계산과 CP 기반 레벨 추정, 동일 종 개체 간 만렙 CP·리그 도달 CP 비교를 지원합니다. 상세 화면의 `➕` 버튼을 누르면 해당 포켓몬을 바로 저장할 수 있습니다.

### 공통 기능

- **계정:** 관리자 승인 방식의 Google로그인을 지원합니다. 첫 로그인 시 약관과 개인정보처리방침에 동의해야 하며 만 14세 이상만 이용할 수 있습니다. 사용자는 직접 계정을 삭제할 수 있고, GA 통계 수집 여부도 선택할 수 있습니다(v2.18.0).
- **일정 및 탐색:** LeekDuck과 한국 공식 발표를 반영한 월간 일정표, 분류 필터, 기간형 타임라인, 전역 검색, 승인 사용자용 트레이너 코드, 패치 노트를 제공합니다.
- **사용 환경:** PWA 설치, 오프라인 열람, 다크 모드, 초기 로딩 표시, 이미지 스켈레톤 UI를 지원합니다. Montserrat와 Pretendard 웹폰트를 사용하며, 프레임워크 없이 바닐라 JavaScript로 구현했습니다.

## 버전 이력

전체 133개 릴리스를 `날짜 → 버전`의 2단계 접이식 목록으로 정리했습니다. 가장 최근 날짜만 기본으로 펼쳐지며, 설명이 한 줄인 초기 버전은 별도의 접이식 영역 없이 표시됩니다. 사용자용 요약은 서비스의 [🎉 패치 노트](https://moncamp.kr/#/release)에서, 변경 배경과 세부 구현 내용은 [변경 이력](CHANGELOG.md)에서 확인할 수 있습니다.

<details open>
<summary><b>2026-09-15</b> — 릴리스 11개 · <code>v3.31.1 … v3.40.0</code></summary>

<details>
<summary><b>v3.40.0</b> · 관리자를 화면에서 지정 — 루트 + 위임</summary>

**관리자가 한 명에서 여럿이 됐다.** 전에는 `ADMIN_UID` 하나뿐이라 늘리려면 코드를 고추 다시 배포해야 했다. 이제 **☰ 메뉴 → 🔑 가입 승인** 에서 승인된 사람 옆의 `[관리자 지정]` 을 누르면 된다. 패널은 **승인 대기 / 관리자 N명 / 승인된 친구 N명** 으로 나뉘고, 이름 옆에 역할 딱지가 붙는다. **관리자는 둘로 갈린다** — 루트(`ADMIN_UID`, 규칙에 박혀 있어 누구도 못 빼앗는다)와 위임(`allowlist/{이메일}` 문서의 `admin: true`). **지정·해제는 루트만** 한다 — 위임 관리자가 또 다른 관리자를 만들 수 있으면 권한이 스스로 번지고, 루트를 끌어내릴 수도 있으면 되돌릴 사람이 없어진다. `firestore.rules` 도 같은 규칙이라 화면을 우회해 눌러도 막힌다. 함께 **`[미구현]` 을 회원 전용에서 관리자 전용으로** 좁혔다. ⚠️ **보안 규칙을 콘솔에 다시 게시해야 동작한다** — `scripts/render_rules.sh` 로 만든 `firestore.rules.local` 을 Firebase 콘솔 > Firestore > 규칙 에 붙여넣고 게시한다

</details>

<details>
<summary><b>v3.39.0</b> · 방문 통계를 옵트아웃으로 — 들어오면 바로 찍힌다</summary>

**통계를 보려고 붙인 것이 통계를 못 보게 막고 있었다.** 전에는 첫 화면 배너에서 **"통계 동의" 를 누른 사람만** GA 가 켜졌다. 대부분은 아무것도 안 누르고 떠나므로 방문의 대다수가 한 건도 안 찍혔다. **옵트인 → 옵트아웃**으로 바꿨다 — 들어오면 바로 켜지고, 끄고 싶은 사람이 끔다. **둘째 구멍도 같이 막았다** — GA 를 붙이는 일을 번들의 `initConsent()` 가 했는데, 그건 첫 렌더가 끝난 뒤에 돈다. 그 사이에 떠나는 방문은 `page_view` 가 아예 안 남았다. 이제 `build.py` 의 head 스니펫이 **번들보다 먼저** 붙인다. 광고·개인화는 그대로 꿄 둔다(`ad_storage` 등 denied) — 보는 것은 방문 수와 기능 사용량뿐이다. 봇은 스니펫에서도 거른다(`track.js IS_BOT_LIKE` 와 같은 세 조건). **방침도 같이 고쳐야 한다** — 개인정보처리방침에 "동의했을 때만 켜집니다" 라고 적혀 있었다. 기본 켜짐·끄는 방법으로 다시 썼다 — 동작과 글이 어긋나면 그것이 거짓말이 된다. EU/UK 방문자에게는 사전 동의가 원칙이라, 국내 이용자 기준으로 둔 선택임을 방침과 코드 주석에 밝혔 둑다

</details>

<details>
<summary><b>v3.38.0</b> · [미구현] 을 회원 전용으로</summary>

**아직 안 나온 것을 미리 보는 것은 회원의 몫으로 둔다.** 비로그인에게는 `[ ] 미구현` 체크를 **아예 그리지 않고**, 안내의 붙임말도 빼고, 표에도 흐린 줄이 나오지 않는다. 기기에 저장된 값(`pogo_max_unrel`)이 켜져 있어도 마찬가지다 — 화면은 저장값이 아니라 **로그인 여부**를 본다. 거르는 자리는 `maxVisible()` 한 군데라 한 줄로 끝난다. 로그인이 끝나면 D-MAX 화면을 다시 그려 그 자리가 바로 생긴다 — Firebase SDK 는 첫 렌더 뒤에 로드되므로 그냥 두면 주소로 바로 들어온 회원에게 끝내 안 보인다(잠긴 화면과 같은 이유). **짓고 넘어가지 않는 한 가지** — 이건 화면을 가리는 것이지 데이터를 막는 것이 아니다. 순위표는 빌드가 `dist/index.html` 에 통째로 심는 공개 값이라 개발자 도구를 열면 흐린 줄의 내용도 그대로 보인다

</details>

<details>
<summary><b>v3.37.0</b> · [미구현] 체크로 켜고 끄기 · 오른쪽으로 물리고 흐리게</summary>

**보일지 말지를 사람이 고른다.** v3.36.0 은 미구현을 늘 보여 줘서 티어표 맨 위 여섯 줄이 전부 "지금 못 쓰는 것" 이었다. 머리 오른쪽, **덱 짜기 버튼 왼쪽**에 `[ ] 미구현` 체크를 놓고 **기본은 꺼짐**으로 둔다 — 처음 들어온 사람에게 표는 지금 데려갈 수 있는 것이어야 한다. 선택은 이 기기에 남는다(`pogo_max_unrel`). **켜을 때는 더 확실히 갈라 놓는다** — 줄을 **오른쪽으로 4.8rem 물리고**(휴대폰 2.2rem), opacity 를 .55 → **.4** 로 낮추고, **`blur(0.7px)`** 를 걸었다. 왼쪽 끝이 어긋나면 훑는 눈이 글자를 읽기 전에 "결이 다르다" 를 알고, 초점이 안 맞는 느낌은 옆게만 하는 것보다 "지금 것이 아니" 를 잘 말한다. 둘 다 **hover·focus·펌침에서 풀린다** — 살펴보려고 다가가면 또렷해져야 읽을 수 있다. 카드 보기에서는 밀지 않는다 — 칸 폭이 정해져 있어 밀면 그 카드만 좁아져(228px vs 309px) 줄이 너덜해진다

</details>

<details>
<summary><b>v3.36.0</b> · 데이터만 있고 아직 못 쓰는 것을 흐리게 함께 보여 주기</summary>

**"데이터는 있는데 아직 못 쓴다" 를 지우지 않고 밝힌다.** 게임마스터에는 아직 출시되지 않은 콘텐츠가 미리 들어 있다. 지금까지 D-MAX 표는 그런 개체를 **통째로 걸렀고**, 그래서 화면에서는 '없는 것' 과 '아직 안 나온 것' 이 똑같아 보였다. 이제 흐리게(`opacity .55` · 왼쪽 점선) **[미구현]** 딱지를 달아 함께 보여 준다 — `DEVELOPMENT.md` 2.5 에 적어 둔 규칙("미출시인 것은 지우지 말고 미구현으로 밝혀 둔다")을 D-MAX 까지 넓힌 것이다. **근거는 둘뿐이다** — ① 게임마스터에 거다이맥스 **기술 데이터**가 있는데 출시 목록에 없는 종(18종) ② `max_released.txt` 의 '예정' 블록에 손으로 적어 둔 줄(8줄). "종족값이 있다" 는 근거가 되지 못한다(전 종이 다 걸린다). **순위는 흔들리지 않는다** — 미구현 줄에는 번호 대신 `–` 를 두고, 출시분의 순위는 1·2·3 으로 이어진다. 등급의 100% 기준도 출시분 1위라 미구현은 100% 를 넘을 수 있다(거다이맥스 검왕 자시안 143%). **덱 짜기·솔플 후보·홈 미리보기·상세 추천 칩·활용처 집계에는 넣지 않는다** — 표는 "있으면 이쯤" 을 보여 주는 자리지만 그 다섯은 지금 데려갈 수 있는 것만 다뤄야 한다. 도감에서는 미출시 메가(메가 폭타)도 점선 회색 딱지로 붙는다 — 전에는 딱지를 빼서 '메가가 없는 종' 과 구분이 안 됐다. **덤으로 잡은 것** — PC 줄 보기에서 메가 딱지가 '메 / 가' 로 세로로 눕던 것(격자에 자리를 안 줘 10px 칸에 눌렸다)

</details>

<details>
<summary><b>v3.35.1</b> · (핫픽스) 움직이는 그림이 끝없이 커지던 것</summary>

제보 — "지금 탭에 들어가니까 계속 요소가 커지거든?". PvP 덱 짜기 리틀리그에서 움직이는 그림 하나가 **0.8초마다 192px 씩 끝없이** 자랐다(324 → 516 → 712 → 904 → 1096px, 문서 높이도 함께). **원인** — `fitAnimZoom()`(`components/sprite.js`)은 `padding` 을 키워 GIF 를 확대하고, 상자가 바뀌면 다시 맞추려고 `ResizeObserver` 로 제 자신을 본다. 그 설계는 "`border-box` 라 padding 을 바꿔도 상자 크기는 그대로" 를 전제로 하는데, 그 전제는 **폭·높이가 CSS 로 못 박힌 자리에서만** 참이다. 덱 짜기 카드처럼 크기가 자동인 자리에서는 padding 이 그대로 상자를 키우고 → 관찰자가 다시 불리고 → 또 키우는 되먹임이 된다. **고침** — 상자를 잴 때 우리가 넣은 padding 을 먼저 0 으로 되돌린다. 못 박힌 자리에서는 같은 값이 나와 확대가 그대로 돌고, 자동인 자리에서는 그림 원래 크기가 나와 확대가 0 이 되어 제자리에 선다. 값이 바뀌지 않으면 아예 쓰지 않아 관찰자가 헛돌지 않는다. **대조** — 고치기 전후 도감 카드의 padding 이 `52px · 32px · 4px` 로 동일하고 상세 팝업도 같다(확대 기능은 그대로). 덱 짜기·D-MAX 덱·솔플 계산기 네 자리에서 2.5초 뒤에도 폭 변화 0. 회귀 24스위트 통과

</details>

<details>
<summary><b>v3.35.0</b> · 화면 탭을 설명 아래 100% 폭 제 줄로 · 머리는 도구·보기 전환만 오른쪽 정렬</summary>

네 화면의 "지금 무엇을 보는 중인가" 줄을 **화면 설명 바로 아래 제 줄**로 내리고 폭을 다 쓰게 했다 — `[전체|딜러|탱커]`(D-MAX, 이번 주 보스보다 위) · `[일반|전체]`(PvE) · 리그 넷(PvP) · 세대 칩(도감, 검색창보다 위). 붙박이 슬롯 `#screen-tabs` 를 `.layout` 안 `#boss-acc` **앞**에 두고 `setScreenTabs()` 가 채운다(`setPageHeadAction` 과 같은 방식). 머리에는 도구와 보기 전환만 남고 **오른쪽 정렬**이다 — 탭은 이 화면 안의 갈래고, 그 둘은 화면 밖으로 데려가거나 보는 방식을 바꾸는 것이라 성격이 다르다. **보기 전환 글자를 휴대폰에도** — v3.33.0 에 자리가 없다고 PC 에서만 켰는데, 탭이 제 줄로 내려가며 자리가 생겼다. `.icon-btn`(drawer.css)이 `width: var(--tap)` 로 정사각을 못 박고 있어 `.icon-btn.view-toggle` 로 특이도를 올려 이겼다. **(수정) 첫 화면이 D-MAX 면 탭 줄이 안 보였다** — `liftShellHeadAction()` 이 옮기기와 비우기를 겸해 "옮길 것이 없다" 가 "비워라" 로 읽혔고, app-shell.js 의 첫 로드 보정 호출이 방금 제자리로 간 탭을 도로 지웠다. 둘을 갈랐다: 비우기는 `render()` 의 `clearShellSlots()`, `liftShellHeadAction()` 은 **옮기기만** 한다. **(수정) 앞 화면 탭이 남았다** — 전체 페이지로 넘어갈 때 `liftViewToggle()` 이 `setScreenTabs()` 로 비운다. **폭** — 첫 구현에서 `.screen-tabs` 에 `max-width: 76rem` 을 또 걸어 PC 본문 1118px 인데 탭만 720px 이었다. 부모가 이미 잡은 값이라 걷어냈다. 실측 390·1440 × 네 화면: 탭 폭 = 본문 폭, 설명 아래·첫 내용 위, 머리 오른쪽 정렬, 잘림 0건

</details>

<details>
<summary><b>v3.34.0</b> · 화면 컨트롤을 제목 위 한 줄로 · (수정) 휴대폰에서 버튼 줄 잘림</summary>

PC 는 제목 오른쪽, 휴대폰은 제목 **위** 제 줄에 `[무엇을 볼지] [도구] [어떻게 볼지]` 한 벌이 선다. D-MAX·레이드 · PvE·배틀 · PvP 세 화면이 같은 문법으로 읽힌다. **도구 버튼을 머리로** — `🧬 개체값 순위`·`🃏 덱 짜기`(PvP)와 `🧮 솔플 계산기`(PvE)가 목록 위 별도 줄(`.controls__row--tools`)에 있었다. v3.32.0 에 `🧩 덱 짜기`(D-MAX)만 머리로 올리면서 셋의 모양이 갈렸다 — 나머지도 같은 자리로 올렸다. 감싸는 줄은 아예 만들지 않는다: 안의 것이 전부 머리로 옮겨 가므로 본문에 빈 줄만 남는다(회귀 `nav.js` 가 잡았다). **휴대폰은 제목 위로** — `styles/pixel.css` 가 좁은 화면에서 이 줄을 제목 **아래**에 두고 있었다. 이 줄은 "이 화면을 어떻게 볼지" 를 정하는 손잡이라 제목을 읽고 나서 찾는 것이 아니라 먼저 눈에 들어와야 한다(`order: -1`). 적용 범위도 699px → 1099px 로 넓혔다 — 태블릿도 컨트롤이 넷이면 제목 옆 칸이 좁다. **(수정) 오른쪽이 잘렸다** — 배틀 · PvP 는 컨트롤이 넷이 되어 390px 한 줄에 안 들어가는데 `flex-wrap: nowrap` 이라 잘렸다. `wrap` 으로 바꾸고, 접히더라도 각 칸이 짓눌리지 않게 `flex: none` 을 달았다(안 막으면 리그 글자가 세로로 쌓인다). 실측 390·700·1024·1440 × D-MAX·PvE·PvP·도감·레이드 보스: 컨트롤이 모두 제목 위, 잘림 0건, 가로 넘침 0건, 두 줄이 되는 곳은 배틀 · PvP 390px 하나

</details>

<details>
<summary><b>v3.33.0</b> · 검색에 걸리는 제목·설명 · 캐치프라이즈 교체 · 영문 메타 보완</summary>

해시 라우팅이라 색인되는 주소가 첫 화면 하나뿐입니다. 그래서 그 한 페이지의 제목과 설명이 곧 검색 노출의 전부인데, 제목이 `moncamp — 뭘 키우고, 뭘 잡을지` 였습니다. 사람들이 실제로 치는 말(다이맥스·티어표·포켓몬고)이 하나도 없어 걸릴 자리가 없었습니다.

**제목·설명** — `moncamp — 포켓몬고 다이맥스 티어표 · 맥스 배틀 덱 · 도감`. 설명에는 거다이맥스·맥스 배틀·레이드·PvP·도감·타입 상성까지 실제로 있는 것만 적었습니다. `og:title`·`twitter:title` 도 같은 값으로 맞췄습니다.

**영문** — 설명 뒷부분과 JSON-LD 에 영문 표기(Dynamax · Gigantamax · Max Battle · Pokédex)를 함께 넣고, `og:locale:alternate` 에 `en_US` 를 더했습니다. 화면이 KR/EN 둘 다 되는데 메타는 한국어뿐이라 영어권 검색에 걸릴 자리가 없었습니다. `keywords` 메타도 한 줄 추가했습니다 — 구글은 무시하지만 네이버는 아직 참고합니다.

**캐치프라이즈** — 헤더 로고 아래 `YOUR POKÉMON COMPANION` → `DYNAMAX · RAID · PVP RANKINGS`, 홈 첫 줄은 `다이맥스 티어표는 여기서 봐요.` 처음 들어온 사람이 첫 줄에서 여기가 뭐 하는 곳인지 알 수 있어야 합니다.

**같이 고친 것** — D-MAX 화면 머리 컨트롤 차례를 `[전체 | 딜러 | 탱커] → 🧩 덱 짜기 → 보기 전환` 으로(앞 둘은 무엇을 볼지, 마지막은 어떻게 볼지). 보기 전환 버튼에 PC 에서만 글자를 함께 답니다(`그리드로 보기` · `리스트로 보기`) — 그림만으로는 어느 쪽이 지금이고 어느 쪽이 누르면인지 안 읽혔습니다. 도감·D-MAX 화면 머리의 장식 띠가 높이 `10.8rem` 으로 못 박혀 있어 검색칸 한참 위에서 가로로 끊겼는데, `bottom: 0` 으로 머리 끝까지 잇고 아래 15% 를 mask 로 흐렸습니다.

</details>

<details>
<summary><b>v3.32.0</b> · 🧩 D-MAX 덱 짜기 (<code>#/dmax/deck</code>) · 문의 메일을 학생 계정으로</summary>

맥스 배틀 보스를 고르면 데려갈 셋(딜러 2 + 탱커 1)을 골라 주는 화면입니다. D-MAX 화면 머리의 `[🧩 덱 짜기]` 버튼 하나로만 들어갑니다 — PvP 덱 짜기와 같은 문법으로, 주소가 도구를 정합니다(`router.js tool` → `state.maxTool`).

**데이터를 새로 만들지 않습니다.** 이미 있는 `DMAX_DATA[보스타입]`(딜러 · 맥스 피해 × √내구)와 `DMAX_TANK[보스타입]`(탱커 · EHP) 두 표를 읽기만 합니다. 백엔드 변경 없음, `data.js` 크기 변화 없음.

**기본 보스는 이번 주**(`renderBossAcc` 와 같은 규칙)이고 18타입 칩으로 바꿉니다. **칸마다 `[바꾸기]`** 로 후보 12개를 펼쳐 고르며, 이미 다른 칸에 든 종은 후보에서 뺍니다. **`[다이맥스만]`** 은 거다이맥스(위력 450)를 빼 아직 못 잡은 사람의 답을 따로 줍니다. **주소에 덱을 싣습니다**(`?b=ground&p=10209,…`) — 그대로 보내면 상대도 같은 덱을 엽니다.

**지어내지 않은 것** — 맥스가드·맥스스피릿(방어·회복) 데이터가 파이프라인에 없습니다. 그래서 세 번째 칸을 '탱커' 라고만 부르고 '힐러' 라고 쓰지 않으며, 4인 협동·클리어 가능 인원도 적지 않습니다.

**잡은 버그 셋** — ① 보스를 바꿀 때마다 주소에 남은 옛 덱을 되읽어 새 보스 표에 없는 칸이 조용히 비었습니다(주소는 처음 한 번만 읽게 `state.maxDeckRead`). `[다이맥스만]` 이 안 먹던 것도 같은 원인이었습니다. ② `nameNode` 가 이미 `<b>` 를 만드는데 바깥에 한 겹 더 씌우고 있었습니다. ③ `locked: true` 가 아무 일도 안 했습니다 — 잠금은 `app.js` 가 탭 단위로 걸고(max → `dmax`) 부모 D-MAX 는 누구나 보는 화면이라, 적어 두면 아무 일도 안 하면서 표만 거짓이 됩니다. 회귀 `dmax-deck.js` 24검사를 새로 만들었습니다.

**문의 메일** — `kwakms821@kakao.com` → `kmsdevwork@knou.ac.kr`. 저장소 변수 `vars.CONTACT_EMAIL` 을 세션에서 바꿀 수 없어 워크플로 두 곳에 직접 적었습니다(v3.27.1 `GA_ID` 와 같은 처리).

</details>

<details>
<summary><b>v3.31.1</b> · (문서) 변경 이력을 2단 접이식으로 · 유실된 v2.5.0 복원</summary>

화면에 보이는 변화가 없어 사용자용 패치 노트에는 적지 않았습니다(v2.37.0 봇 트래픽 집계 제외와 같은 처리).

141개 판이 한 겹 목록으로 세로로 늘어서 있어, 특정 날 무슨 일이 있었는지 보려면 버전 번호를 외우고 있어야 했습니다. 하루에 34개가 나간 날도 있습니다. `CHANGELOG.md` 와 이 문서의 버전 이력을 **날짜 → 버전** 2단 접이식으로 바꿨습니다.

**유실된 v2.5.0 복원** — 번호 연속성을 세다 `v2.5.0` · `v2.19.0` · `v3.25.0` 이 비어 있는 것을 발견했습니다. `v2.19.0` 은 건너뛴 번호, `v3.25.0` 은 `feature-advertisement` 예약분, **`v2.5.0` 은 실재한 판**(커밋 `c3c0809`, 시즌 기술 변경 안내 · 순위 변동 ▲▼ 뱃지)인데 `## [Unreleased]` 형식에서 옮기며 통째로 빠져 있었습니다. 그 커밋에서 되살렸습니다.

**판 수를 실제와 맞춤** — 머리말이 134로 적혀 있었으나 실제는 141이었습니다. **문서 서비스명** — 이 문서 제목이 `monlab` 에, `docs/` 세 문서가 `POGO PLAN` 에 멈춰 있었습니다. **`DEVELOPMENT.md` 2.2.1 신설** — 2.2 가 "내구를 빼고 pogomate 와 같은 공식" 으로 끝나 현재 동작과 반대였습니다. **2.5 보강** — 같은 함정을 두 번 더 밟은 기록(두랄루돈 · 메가 폭타)을 표로. **`OPERATIONS.md` 1·2절** — 릴리스 때 함께 갱신할 자리가 넷에서 여섯으로.

</details>

</details>

<details>
<summary><b>2026-09-14</b> — 릴리스 11개 · <code>v3.26.0 … v3.31.0</code></summary>

<details>
<summary><b>v3.31.0</b> · 도감에 메가진화·원시회귀 표시 · 미출시 메가 구분</summary>

제보: "도감에 메가진화 및 원시회귀가 반영이 안 되어 있네". `DEX_DATA.megas`는 v2.x 부터 늘 있었지만 **상세 팝업의 진화 칸에서만** 쓰였다 — 목록(`dexEntries()`)은 도감번호당 한 줄뿐이라 줄을 하나씩 열어 봐야 메가 유무를 알 수 있었다. 줄에 `dexMegaTag()` 딱지(`메가` · `메가 X·Y` · `원시`)를 달고, 세대 칩 줄에 `[⚡ 메가·원시]`를 더했다.

**세대 칩도 토글로** — 지금까지 한 세대를 누르면 전체로 돌아갈 길이 (검색 모드가 아닌 한) 없어 새로고침해야 했다. `dexFilter` 한 값으로 세대·메가를 함께 관리하고 같은 칩을 다시 누르면 풀린다.

**미출시 메가** — 게임마스터의 `tempEvoOverrides`에는 **아직 안 나온** 메가의 종족값도 있다(두랄루돈 다이맥스 오등록과 같은 함정). PvPoke `gm.json`이 폼마다 `released`를 적어 두므로 `names.py mega_released[(dex, 라벨)]`로 뽑아 `megas[].rel`에 실었다 — 메가 폭타 1건이 미출시라 딱지·거르기에서 빠지고 진화 칸에서는 `미구현`으로 뜬다.

**원시회귀 문구** — 가이오가·그란돈 상세가 '⚡ 메가 진화 가능' 이라고 적고 있었다(게임에서 다른 것). 라벨이 전부 `원시` 면 '원시회귀 가능', 섞이면 둘 다 적는다. 실측: 메가 57종 · 원시 2종, KR/EN × 1440·390 × 줄·카드 모드에서 딱지 57개·겹침 0건

</details>

<details>
<summary><b>v3.30.1</b> · (수정) 티어표 ⓘ 자리 · 근거 상자 높이 · ⓘ 탭으로 펼침</summary>

제보 스크린샷: ⓘ 가 제목과 '9종' 사이 한가운데에, 근거 상자는 362px 카드 옆에 164px로 떠 있었다. `.row-head`가 `justify-content: space-between`이라 자식이 셋이면 가운데 것이 가운데에 배치되고, 휴대폰은 `.row-head { display: block }`이라 별도 행으로 떨어진다. 제목과 ⓘ 를 `.row-head__title`(flex) 로 하나의 그룹으로 묶었다 — `.row-head h2` 셀렉터는 후손 관계라 테스트·i18n 그대로. 근거 상자는 v3.29.0 의 `align-self: start`를 걷어 stretch(기본) 로 카드 높이에 맞추고 안쪽 두 단은 `align-content: start`로 위에 붙였다. 휴대폰은 hover 가 없어 `title` 툴팁이 표시되지 않으므로 ⓘ 를 `role=button`으로 두고 누르면(Enter·Space 포함) 같은 글을 `.info-note`로 제목 아래 펼친다 · `aria-expanded` 동기화 · 영문 번역은 childList 감시로 자동.

**순위 배지를 탭 전체 순위로** — `renderTierList`가 넘기는 index 는 티어 묶음 안 순번이라(v2.43.0 부터) 절대 등급이 된 뒤로는 땅 탭이 `1 · 1 · 2 · 1▼2 · 2 · 3▼2 …`로 찍혀 근거의 '땅 2위' 와 어긋났다. `tierItems.indexOf(pokemon) + 1`. 19탭 × (1920·1548·1440·1280·1100·1024·768·700·390) × 패널 열림/닫힘 × 다크/라이트를 스크립트로 훑어 카드 수·이름이 데이터와 전부 일치, 카드 폭 150px 미만 0건, JS 오류 0건

</details>

<details>
<summary><b>v3.30.0</b> · D-MAX 등급을 전 종 절대 기준으로 · 티어 점수에 내구 반영</summary>

제보: "docx 에도 포고메이트에도 거대코뿌리가 2등인데 이 사이트는 S 티어다, 임의로 정한 것인가". 추적하니 두 결함이 겹쳐 있었다. ① `value_build.py`의 `rel_tier`가 **보고 있는 탭 목록 안에서** 상대 등급을 매겼다 — 같은 점수 84,840 이 바위 탭(7행) 1위라 S, 땅 탭(9행) 2위라 S, 전체 탭(상위 30 만 실림) 30위라 C. 탭마다 글자가 달라지고, 잘린 목록 탓에 어느 쪽도 성능을 제대로 나타내지 못했다. ② 점수가 `공격 × 위력 × 자속` 뿐이라

**내구도를 전혀 반영하지 않았다** — 같은 화면의 딜러 표는 `dmg × √bulk` 인데 티어표만 화력이었고, 그래서 몰드류(공 213 · 내구 23)가 거대코뿌리(공 202 · 내구 34) 위에 섰다. 1진화와 2진화가 뒤집힌 셈이다. `absolute_tier()`로 바꿔 **전 종 1위 점수 대비 90/80/70%** 로 S·A·B·C 를 못 박고(탭을 옮겨도 등급 유지, 순위만 탭 안), 점수에 `(방어 × 체력 ÷ 1000) ** 0.25`를 곱했다 — 제곱근은 내구가 지나치게 크게 반영되고 0.25 는 진화 단계만 바로잡는 정도다. 결과: 땅 1위 거대코뿌리 A(83%) 204,900, 2위 몰드류 B(79%), 전체 S 8 · A 12 · B 10. 전체 28~30위 세 종(킹크랩·라이코·거대코뿌리)이 84,840 으로 같던 동점도 풀렸다. 카드 근거는 두 줄(계산식 · 등급과 순위)로 가르고 표 제목 옆 `ⓘ`(`.info-dot`, `title` 속성)에 기준 전체 설명을 넣었다 — 영문 사전은 숫자를 `#`로 뭉개므로 "전 종 1위" 를 "전 종 최고" 로 고쳐 키를 맞췄다

</details>

<details>
<summary><b>v3.29.0</b> · PC 티어표 — 선정 근거를 카드 오른쪽 빈 칸으로 · 타입 칩 줄 접어 내리기</summary>

제보: "오른쪽 영역이 많은데 오른쪽에 보여지는 게 맞지 않나". 실측 결과 상세 패널을 연 1920 에서 목록은 세 열(1010px)인데 S 티어는 1종이라 카드 327px 뒤 두 칸이 비고, 근거(`.row__why`)는 `grid-column: 1 / -1`이라 그 빈 칸을 두고 아래로 내려갔다. CSS 에 "이 줄의 남은 칸을 채워라" 가 없어(`grid-column: auto / -1`은 시작이 auto 라 span 1 로 해석)

**카드 수(`:has(> .row ~ .row)`로 셈) × 열 수(미디어 쿼리)** 를 짝지어 시작 열을 명시했다. 근거는 `order: 1`이라 카드 뒤에 놓이고 자동 배치 커서가 아직 그 칸을 지나지 않아 같은 줄에 들어간다. 한 칸만 차지하는 자리(패널 열린 2열의 1종 · 3열의 2종)는 근거 안쪽 두 단을 한 단으로. 되돌림 규칙은 **특이도를 맞춰야** 이긴다 — 처음엔 밀려 1열(패널 열린 1280)에서 없는 둘째 열이 암시적으로 생겨 카드가 42px로 찌그러졌다.

**칩 줄** — `.chips`는 휴대폰용 가로 스크롤 띠(nowrap · overflow-x auto)인데 패널을 열면 보이는 폭이 1194 → 662px로 줄어 18타입 중 절반이 스크롤 뒤로 숨고 고른 칩조차 안 보였다. 1100px이상 `.filter-box` 안에서는 접어 내린다(상자는 접었다 펴는 것이라 세로 여유가 있다). 실측: 1280·1440·1548·1920 × 패널 열림/닫힘 여섯 조합에서 근거가 카드와 같은 줄, 칩 잘림 0px, 고른 칩 보임

</details>

<details>
<summary><b>v3.28.3</b> · (수정) 미출시 다이맥스 두랄루돈이 '맥스 배틀 가능' 으로 표시</summary>

`backend/config/max_released.txt` 88줄의 `D DURALUDON`이 활성 줄에 있어 `max_pool.json`에 실렸고(162종), 도감·상세에 '맥스 배틀 다이맥스 가능' 배지가 붙었다. 같은 파일 꼬리말은 두랄루돈을 **미출시 거다이맥스**로 적고 있다 — 게임마스터에 거다이맥스 기술(`SOURDOUGH_MOVE_MAPPING_SETTINGS`)이 있는 것과 다이맥스 출시를 헷갈린 자리다. 예정 블록으로 되돌려 161종. 티어표·딜러·탱커에는 원래 없었다(점수가 상위 30 밖). 파일 머리말에 'D 와 G 는 별개 · 확신 없으면 예정 블록에' 를 명시했다. 같은 꼬리말에 이름이 있는 이브이·아머까오·브리무음·우라오스는 **다이맥스는 출시된 종**이라 그대로 둔다(거다이맥스만 미출시)

</details>

<details>
<summary><b>v3.28.2</b> · (데이터) 다이맥스 뿔카노 · 코뿌리 · 거대코뿌리</summary>

2026-09-14 맥스 먼데이 출시(LeekDuck `Dynamax Rhyhorn during Max Monday`, `gameday.json` events 로 확인). `backend/config/max_released.txt`에 예정으로 주석 처리돼 있던 세 줄을 해제 → `value_build.py`가 `max_pool.json`(111·112·464 = D, 159 → 162종) · `dynamax_tier.json`(overall·ground·rock 에 거대코뿌리, ground 에 코뿌리·뿔카노) · `dynamax.json` 딜러(거대코뿌리: 전기 1위 · 불꽃 2위 · 바위 5위 · 물 16위 · 땅 28위, 코뿌리: 전기 3위 · 불꽃 8위 · 바위 13위) · `dynamax_tank.json`(거대코뿌리: 독 3위 · 전기 2위 · 노말·비행·바위 4위) 를 다시 생성한다. 활용처 `usage`에서 다이맥스 거대코뿌리 19곳으로 메가Y 뮤츠와 같은 최다. 코드 변경 없음, 회귀 통과

</details>

<details>
<summary><b>v3.28.1</b> · 네이버 서치어드바이저 소유 확인 메타</summary>

네이버는 DNS 확인 방식이 없어 `<meta name="naver-site-verification" content="a5562549…">` 한 줄을 `index.html` `<head>`에 넣는다(robots 메타 바로 아래). 값은 HTML 에 그대로 포함되는 공개 식별자. dev 빌드에도 실리지만 dev 는 noindex·robots 전체 차단이라 무관. Google은 같은 날 Search Console 도메인 속성 + 가비아 TXT 로 확인 완료(코드 변경 없음). `OPERATIONS.md` 13절에 반영

</details>

<details>
<summary><b>v3.28.0</b> · 검색 색인 열기</summary>

v3.6.0 에 "아직 검색엔진에 올릴 단계가 아니다" 로 뺐던 것을 도메인이 생기면서 되살렸다. `index.html`에 `<meta name="robots" content="index, follow, max-image-preview:large">`와 JSON-LD(`@graph`: WebSite + WebApplication, 이름·별칭 몬캠프·설명·og 그림·무료·ko/en). JSON-LD 는 실행되지 않는 데이터 블록이라 CSP `script-src`에 안 걸린다.

**dev 는 그 줄을 바꿔 끼운다** — `build.py ROBOTS_INDEX_META` 상수를 정확히 한 번 찾아(assert) `noindex, nofollow`로 치환. 전에는 `</title>` 뒤에 noindex 를 끼워 넣었는데 이제 index 줄이 원본에 있으니 두 줄이 공존하지 않게 치환으로 바꿨다. `hardening`의 '구조화 데이터 없음'·'robots 는 dev 의 noindex 한 줄뿐' 두 검사를 뒤집어 넷으로(JSON 파싱·WebSite/WebApplication·주소 = canonical·robots 정확히 한 줄 index/noindex). `verify_deploy.sh`의 prod noindex 없음/dev noindex 있음 검사는 계속 유효. 사람이 할 등록 절차(Search Console 도메인 속성 + 가비아 TXT · 네이버 서치어드바이저)는 `OPERATIONS.md` 13절

</details>

<details>
<summary><b>v3.27.1</b> · (수정) GA4 측정 ID 를 moncamp.kr 스트림으로</summary>

도메인을 옮기며 GA4 스트림을 정리하다 발견: 저장소 변수 `GA_ID`가 같은 속성의 `blog` 스트림 측정 ID(`G-KVRX9FBNDC`)라 사이트 통계가 처음부터 거기 섞여 들어갔다. 사이트용 스트림(옛 "pogo-rank 웹", 15750161968 → 이름·URL 을 `moncamp.kr`로 고침)의 `G-8MSZM80JHZ`를 `deploy.yml`·`deploy-dev.yml`에 직접 적는다 — 이 세션에 저장소 변수를 고칠 수단이 없고, 측정 ID 는 배포 HTML 에 그대로 포함되는 공개 식별자라 코드에 둬도 된다. 저장소 변수 `GA_ID`는 더 읽지 않는다. `OPERATIONS.md` 7절 갱신. 코드 변경 없음(빌드 입력값만)

</details>

<details>
<summary><b>v3.27.0</b> · 서비스명 moncamp(몬캠프) · moncamp.kr 도메인 준비</summary>

v3.26.0 의 monlab 은 `.com`/`.app`이 선점돼 하루 만에 접었다. `POGO`는 EA 의 살아있는 등록상표(9류·41류)라 도메인을 사고 광고를 붙이는 순간 분쟁 위험이 생겨 이름에서 뺀다(근거는 작업 지시서 9절).

**이름** — monlab 이 적힌 현재 상태 파일 전부(`index.html`·`app-shell.js`·`manifest`·`robots`·`build.py` 404/robots·`terms`·`privacy`·`home`·`router`·`i18n-en.js` 3키·`og_gen.py` MON/CAMP → `og.png`) + 조사 교정(`moncamp는`·`moncamp와`·`moncamp를` — 몬캠프는 받침이 없다). 패치노트·CHANGELOG·README 표의 monlab 은 이력이라 그대로.

**도메인 준비(코드 쪽)** — `build.py SITE_URL/DEV_SITE_URL` → `https://moncamp.kr/`·`https://dev.moncamp.kr/`(canonical·og:url·og:image·twitter:image·sitemap·robots Sitemap 줄이 여기서 나온다), `index.html` 절대 주소 4곳, `robots.txt` 주석.

**숨은 함정 둘** — `app.js` 서비스워커 등록과 `build.py` GA 측정 ID 노출이 `hostname.endsWith('github.io')` 조건이라 도메인만 옮기면 PWA 캐시와 통계가 별도 오류 없이 비활성화됐다 → `moncamp.kr` 추가.

**배포 방식 판정** — 실서비스 `deploy.yml`은 `actions/deploy-pages`(Actions 배포, CNAME 파일 무시 · Settings 값만), 미리보기 `deploy-dev.yml`은 `peaceiris/actions-gh-pages` 브랜치 배포(gh-pages 루트 CNAME 필요, `force_orphan`이라 매번 실려야) → 워크플로에 `cname: dev.moncamp.kr` 한 줄. `frontend/static/CNAME`은 만들지 않는다(실서비스 dist 에 섞인다). `ship_dev.sh`·`verify_deploy.sh` 주소 갱신. 상대 경로 점검: manifest `./`, SW `sw.js`·`./`, 라우터 basePath 없음, 루트 절대 경로 0건 — 수정할 사항 없음. 사람이 할 순서(Firebase 승인 도메인 → 두 저장소 Pages Custom domain → Enforce HTTPS → deploy)는 `docs/OPERATIONS.md` 12절

</details>

<details>
<summary><b>v3.26.0</b> · 서비스명 monlab(몬랩) · KR/EN 전환 엄격 감사</summary>

(v3.25.0 은 광고 게이트로 `feature-advertisement` 브랜치에 예약, dev 는 v3.24.0 에서 바로 이어짐)

**이름** — `index.html` 제목·og/twitter·apple 제목·`<h1>`, `app-shell.js`로고·드로어 메타·`document.title`, `manifest.webmanifest` name/short_name, `robots.txt`, `og_gen.py`(글리프 B·M 추가, MON/LAB 두 줄) → `og.png` 재생성, 홈 인사·약관·개인정보·스타일가이드 문구. 저장소명·배포 URL·localStorage 키·GA이벤트명·SW 캐시 이름은 불변 규칙대로 그대로.

**감사 도구** — `scripts/i18n_audit.js`(EN 으로 열아홉 화면 + 드로어·팝업·모의 로그인을 열어 한글 텍스트·`aria-label`·`placeholder`·`title`을 모음) 172건, 정적 훑기(`t()`를 코드 리터럴 861개에 직접 적용) 372건에서 출발.

**엔진** — `i18n.js i18nWatch()`가 `characterData`와 `attributes`(`I18N_ATTRS`만)도 관찰: `setAttribute('aria-label', …)`·`node.data = …`로 기존 노드의 값만 갈아 끼우면 `childList`가 감지하지 못해 그 줄만 한국어로 남았다(테마 버튼). 옮긴 값에는 한글이 없고 못 옮기면 다시 쓰지 않아 불필요한 재실행을 일으키지 않는다.

**사전** — 앞뒤 공백이 붙은 키 아홉 개는 `t()`가 trim 한 뒤 찾으므로 한 번도 맞은 적이 없었다 → 키·값 다듬음. 신규 키 약 250개 + `I18N_PATTERNS` 80개(달력 `#월 #일, 일정 #개`, `(.+)리그 상위 #`, `(.+) 보스 상대 D-MAX 탱커`, `(.+)가 보스로 나오면? (맥스 배틀 — …)`, 솔플 계산기의 조사 붙은 문장 `(.+?)[이가] 반감으로 받아줌`, `이름(타입)` 기술 등). `confirm()` 셋은 DOM 밖이라 `t()`로 감쌈. `dev-mock.js` 기술명을 PokeAPI 표기(`머드샷`·`블라스트번`·`섀도클로`)로 맞춤. 결과: DOM 감사 172 → 46(남은 46은 전부 일정표 이벤트·시즌 이름과 사용자 검색어). 회귀 `i18n` +5(설정 힌트·테마 aria-label 갱신·상세 약점 제목·CP 각주·D-MAX 탱커 제목), `nav`·`shell`·`hardening`이 monlab 을 기대

</details>

</details>

<details>
<summary><b>2026-09-13</b> — 릴리스 7개 · <code>v3.19.1 … v3.24.0</code></summary>

<details>
<summary><b>v3.24.0</b> · 검색 줄 PvP/PvE 알약 · 육각형 레이드/PvP 축을 순위 대신 점수로</summary>

빌드가 전 종 점수표 `VALUE_DATA.meter[이름] = [PvE, PvP]`(0~100, 1,571종, 25KB)를 싣는다(`value_build.py`, 산식은 가성비와 동일: PvE = 보스 타입별 `(score/최강)^0.25` 상위 3개 평균, PvP = 리그 점수 상위 2개 평균 · 하나면 0.8배; `build.py`가 `pvp_all.json`에 `score`를 남긴다). `detail.js usageMeterOf(name)`이 한 자리에서 읽고, 도감·검색 줄(`pages.js dexUseNode`)이 이름 옆에 `[PvP 89][PvE 59]` 알약(높은 쪽 `.is-lead`), `hexNode`의 레이드·PvP 축이 순위 대신 이 점수(`N점`)로 선다. 왜: 축이 "어느 순위표 30위 안 최고 순위" 라 대짱이(원종)는 메가·섀도우만 등재돼 미등재 0.08 로 낮게 표시됐다 — 실제로는 땅·물 보스 A 티어(59점). 이전 빌드(점수표 없음)는 순위로 되돌아간다. 회귀 `dex-search` +6

</details>

<details>
<summary><b>v3.23.0</b> · 성능 감사 — 첫 화면 842 → 690KB</summary>

(1) `frontend/index.html`의 로딩 가림막 주석에 자리표 `__STYLES__`가 글자 그대로 적혀 있어 `build.py`의 `str.replace`가 **번들 CSS 155KB를 두 번** 끼워 넣고 있었다(v2.52.0 부터 사흘). 주석 문구를 바꾸고 자리표가 정확히 하나인지 `assert`. (2) Google Fonts `Inter` 링크 + 프리커넥트 둘 제거 — v3.6.0 도트 디자인 뒤로 어느 규칙도 안 부르는데 방문마다 렌더 차단 CSS 요청 하나와 woff2 네 벌을 받았다. CSP의 `fonts.googleapis`·`fonts.gstatic`도 뺐다. (3) Pretendard CSS를 `preload` + `onload` 승격(loadCSS)으로 — head 의 외부 `<link rel=stylesheet>`는 첫 그리기를 jsdelivr 왕복만큼 세운다. `noscript` 사본. 잰 값(localhost · 5회 중앙값): PC FCP 136 → 124 · DCL 288 → 256 · load 305 → 266ms, 휴대폰 CPU×4 FCP 340 → 292 · DCL 1098 → 958 · load 1119 → 983ms, 받은 바이트 2169 → 2017KB. 외부 요청은 로컬에서 안 재니 (2)(3) 의 이득은 그 위에 얹힌다.

**빌드는 느리지 않았다** — 로컬 `scripts/build.sh` 8초(fetch 3.1 · pve_build 1.5 · 나머지 <1초), CI `Build site` 6초 · 작업 전체 28초. 느린 것은 Pages CDN 반영(수 분)이었다. 회귀 `hardening` +4(번들 1회 · Google Fonts 없음 · preload 구조 · CSP 출처)

</details>

<details>
<summary><b>v3.22.1</b> · 홈 대시보드 (`2679b21`, 작성자 직접 커밋 — 버전·문서는 이 버전에서 따라 적음)</summary>

`components/home.js`가 홈을 `.home-dashboard` 한 화면으로 감싼다: `.home__welcome` = 인사(`다음 모험의 / 주인공을 찾아요.` + 한 줄 설명) 옆에 `.home__quick` 바로가기 셋(도감 · 이벤트 일정 · 레이드 보스, `ROUTES`에서) · 순위 세 그룹 · 기능 타일. 타일은 `ROUTE_GROUPS` 그룹마다 `.home__service-group` **카드** 하나에 `01~03` 번호 소제목 + 줄 셋(`.home__tile`이 `[아이콘][이름/설명][↗]` 격자 줄). 순위 덩이는 `.pick__group--{key}`로 머리 색을 가르고(`--brand` · `--point` · `--good`)

**1위 카드만 세로 큰 그림**(`.pick__card:first-child .sprite` 16rem), 2·3위는 가로 줄. PC(1440): 인사 1118×300 · 순위 y=477 · 타일 y=1169, 3열 격자 둘. 휴대폰(430): 덩이가 쌓이고 1위는 가로 줄(그림 12rem) · 2·3위는 두 열 세로 카드, 타일 y=2060(v3.22.0 971 — 1위 큰 그림 셋과 바로가기 블록만큼 길어짐). CSS는 전부 `.home-dashboard` 아래로 한정해 PC·도트 테마의 옛 배너 규칙(`.home__intro::before/::after`)을 `content: none`으로 끈다. 이 버전에서 덧붙인 것: `i18n-en` 다섯 키(새 인사·바로가기 문구) · `nav.js` 타일 단언(상자 → 카드 안의 줄) · 버전 문서. 실서비스는 이 내용이 **v3.22.0 라벨**로 이미 나가 있다

</details>

<details>
<summary><b>v3.22.0</b> · 홈 순위 세 그룹 — 순위표 세 곳 × 상위 3종</summary>

v3.21.0 의 '두루 쓰이는 포켓몬' 여섯 줄 하나를 `components/home.js HOME_PICKS`(표 이름 · 줄 세운 기준 · rows() · meta()) 세 그룹 아홉 장으로 넓혔다. `DMAX_TIER.overall`(티어·맥스무브 속성) · `PVE_DATA.overall`(DPS·TDO) · `VALUE_DATA.usage`(N곳 + 최고 순위 한 곳). 카드 = `[순위 배지+그림][이름][한 줄 근거]`, 누르면 `openDetail(…, 'home_<key>')`, 덩이 머리의 [전체 보기]는 `routeHash`.

**잠긴 화면의 덩이는 모두 제외된다**(`routeLocked`) — 홈이 잠금을 새는 문이 되면 안 된다. PC(1100px+)는 덩이를 **옆으로** 세워 3×3 격자로 만들고 카드를 가로 줄로 눕힌다(세로로 쌓으면 카드 하나가 370px로 부푼다). `views/usage.js`는 `placeLabel`만 남기고 목록 그리기를 홈에 넘겼다.

**회귀 비결정적 실패 수리** — 스위트 50곳이 각자 들고 있던 스플래시 대기(15초, `.catch`가 실패를 삼킴)를 `_lib.js waitSplash`(45초) 하나로 모았다. 부하가 높으면 첫 화면이 15초를 넘겨 아직 안 그려진 화면에 단언하다 **매번 다른 스위트**가 불안정하게 실패했다. `layout-toggle`의 고정 600ms 두 곳도 선택자 대기로

</details>

<details>
<summary><b>v3.21.0</b> · 서비스 홈 개편</summary>

읽는 차례를 `인사 → 두루 쓰이는 포켓몬 → 기능 타일`로 뒤집었다(`components/home.js renderServiceHome`). 전에는 활용처 순위가 타일 아홉 장(725px) 뒤라 모바일에서 y=1041 — 첫 화면(932px) 밖이었다. 지금은 y=255. 타일은 번호(01~09) 대신 `ROUTE_GROUPS` 세 그룹로 묶어 `<h4 class="home__group">`를 세웠다 — ☰ 메뉴와 같은 차례. 활용처 줄은 `[순위][그림][이름 / 쓰이는 곳][N곳]` 격자로 갈라 이름과 근거를 두 줄로 나눴고(`views/usage.js`), 처음 여섯 마리만 편다(`_usageShown = 6`, 더보기 12씩). PC(1100px+)는 활용처 두 열 · 타일 5 → 4열(그룹가 3·4·2라 5열에서는 한 줄도 안 찼다). 제목 `활용처 순위 → 두루 쓰이는 포켓몬` (산식은 홈에서 설명할 값이 아니다)

</details>

<details>
<summary><b>v3.20.0</b> · 움직이는 그림 확대 한도 2배</summary>

출처가 둘이라 원본이 23×19 ~ 201×166 로 제각각인데 `object-fit: contain`이 상자(줄 42 · 카드 128 · 상세 72px)에 **맞춰 늘려** 작은 종이 3.5배까지 뭉개졌다. `sprite.js fitAnimZoom`이 원본 크기를 읽어 `padding`으로 확대 한도(`SPRITE_MAX_ZOOM = 2`)를 건다 — img 크기는 그대로라(`border-box`) 줄 높이가 흔들리지 않고, 화면이 주던 여백(카드 0.8rem)은 `getComputedStyle`로 한 번 읽어 지킨다. 상자는 보기 전환·폭 변화로 바뀌므로 `ResizeObserver(box: 'border-box')`로 다시 맞춘다(padding 변경은 border-box 크기를 안 바꿔 재귀 없음). 줄일 때 `auto` · 키울 때 `pixelated`

</details>

<details>
<summary><b>v3.19.1</b> · (수정) 상세 그림이 타입 배지를 가렸다</summary>

움직이는 GIF 는 `object-position: bottom`으로 상자 위까지 차서 `.detail__types`(왼쪽 위) 가 머리를 덮었다. `.sprite-box .sprite` 8 → 7.2rem + `margin-top 0.9rem`(PC 8.4 → 7.8rem + 1rem), 배지 `top -0.6 → -1rem`. 상자 위쪽에 배지 자리를 비워 둔다

</details>

</details>

<details>
<summary><b>2026-09-12</b> — 릴리스 34개 · <code>v2.63.0 … v3.19.0</code></summary>

<details>
<summary><b>v3.19.0</b> · 움직이는 그림 949 → 1,151종</summary>

PokeAPI B/W GIF 에 없는 6세대 이후·메가·리전 폼을 **Pokémon Showdown** `sprites/ani/`에서 받는다(`backend/sprites.py` 두 번째 출처). 이름표는 PvPoke 종 이름에서 만든다 — `'Mr. Mime (Galarian)' → mrmime-galar`, `'Charizard (Mega X)' → charizard-megax`, 폼 이름표가 없으면 기본 폼으로. 표식 파일 `.none → .miss` (옛 표식은 한 출처만 물은 결과라 지우고 다시 조회한다).

**남은 21종(9세대 등)은 CSS로 흔든다** — `img.sprite:not(.sprite--anim)`에 `sprite-idle` 2.6s(짝수 줄은 애니메이션 시작 시점을 다르게 함), `body.sprite-anim-off` 면 멈춤, reduced-motion 존중. NOTICE 에 Showdown 출처 추가. 회귀 `open-all` 14 → 16

</details>

<details>
<summary><b>v3.18.0</b> · 움직이는 그림 기본</summary>

`sprite()`가 정지 png 를 띄운 뒤 `spriteAnimate()`로 GIF 를 갈아 끼운다(v2.67.0 상세 전용 → 전 화면). 설정 화면에 켬/끔(`pogo_sprite_anim`, 기본 켬) · `prefers-reduced-motion`은 늘 정지. detail.js 의 직접 호출은 뺐다.

**잠금 전부 임시 개방** — `router.js LOCK_OPEN_ALL = true`, `routeLocked()`가 먼저 본다(표 `ROUTES.locked`는 그대로). 회귀는 `pogo_lock_open = 'off'`로 기존 동작을 켠다(`_lib.newContext({ locks: true })`).

**가입 권유 팝업 내림** — `auth.js SIGNUP_INVITE_ENABLED = false`, 회귀는 `pogo_signup_invite = 'on'`. 되돌릴 때는 상수 둘만. 회귀 `open-all` 13 신설 · `signup-invite`는 테마 라디오 선택자를 그룹으로 좁힘

</details>

<details>
<summary><b>v3.17.1</b> · 잠시 써보기 24시간 → 2시간</summary>

하루는 세 번이면 사흘이라 가입할 이유가 너무 늦게 온다. `TRIAL_SECONDS = 2*60*60`, 라벨 `(2시간)`. 나머지(시·분 배지·횟수 3)는 그대로

</details>

<details>
<summary><b>v3.17.0</b> · 잠시 써보기 20초 → 24시간</summary>

써 본 사람들이 20초는 너무 짧다고 했다(화면 하나를 채 못 읽는다). `TRIAL_SECONDS = 24*60*60`. 배지는 `trialSpanLabel()`로 `23시간 59분 · 59분 30초 · 30초`를 센다(1초 간격, 짧게 줄인 회귀는 250ms). 마지막 5분부터 `.is-ending`. 버튼 라벨도 같은 함수(`(24시간)`). 영문 사전에 시·분 뼈대 키 추가. 회귀 `trial` 24 → 26

</details>

<details>
<summary><b>v3.16.1</b> · (수정) 로그인 유도 팝업의 버튼 배치</summary>

[잠시 써보기] 가 왼쪽에 다른 폭으로 붙어 있었다. 위 두 버튼과 같은 문법(`min-width: 20rem; margin: … auto`)으로 가운데 정렬, 순서는 Google로그인 → 나중에 → 잠시 써보기 ^^ (20초). 회귀 그대로

</details>

<details>
<summary><b>v3.16.0</b> · 잠시 써보기</summary>

잠금 안내까지는 보는데 로그인·가입 신청으로 가는 사람이 없었다. 잠금 카드와 로그인 유도 팝업에 [⏱ 잠시 써보기 (20초)] — 누르면 `pogo_trial_until`을 저장하고 `routeLocked()`가 `trialActive()`를 먼저 본다(잠금을 정하는 자리가 그 하나라 화면·메뉴·홈 타일이 함께 열린다). 오른쪽 위 고정 배지(`#trial-timer`, `.is-ending` 5초부터 깜빡)가 250ms 마다 세고, 끝나면 다시 그려 잠그고 `openLoginInvite`를 띄운다. 새로고침해도 시간은 이어진다(`trialResume`). `pogo_trial_used` 3회면 버튼 대신 "이젠 가입하셔야죠 🙂". 로그인·승인 대기·로그인 기능 꺼진 빌드에는 안 붙는다. GA `trial_start(n)` · `trial_end`. `components/trial.js`는 pages 앞(첫 렌더의 routeLocked). 회귀 `trial` 24 신설

</details>

<details>
<summary><b>v3.15.0</b> · 도감 — 누른 줄 표시 · 진화 단계를 누르면 목록이 따라간다</summary>

넓은 화면은 오른쪽 패널(#detail-panel)만 바뀌고 목록에서는 선택 상태를 확인할 수 없었다. `.dex__row`에 `data-sprite`를 달고 `pages.js dexHighlightRow(sprite)`가 `is-selected`를 한 줄에만 둔다 — `modal.js openDetailPanel/closeDetailPanel`이 부른다(팝업 모드는 목록이 가려져 굴리지 않는다). 모양은 hover 규칙에 `.is-selected`를 나란히 붙였다(pages.css · pc-theme.css · pixel.css). 진화 단계 → `openDetailByDex` → 같은 경로로 그 줄에 표시 + `scrollIntoView(nearest)`. [더보기] 뒤면 `$list.dexReveal`이 `shown`을 200 단위로 늘려 그린다(shown·draw 가 renderDexPage 클로저라 목록 요소에 참조로 연결했다). 검색·세대 칩으로 걸러져 없으면 표시만 지운다. 회귀 `detail-panel` 18 → 24

</details>

<details>
<summary><b>v3.14.0</b> · 개발 순환 시간 단축</summary>

클라우드 세션에서는 한 차례 작업에 30분 이상이 걸렸다.

**회귀 162 → 117초** — 스위트마다 화면을 옮길 때 `#consent .consent__deny`를 `click({timeout:1500}).catch()`로 눌렀는데 배너는 첫 화면에만 뜨므로 두 번째부터는 **없는 버튼을 1.5초씩 기다리는 줄** 이었다(`shell` 101→58s · `nav` 60→25s). `tests/e2e/_lib.js` 공통 조각(`launch·newContext·ok·finish·suite`)이 배너를 미리 거부하고 그 줄 32개를 지웠다(4,295 → 3,608줄). `test.sh`의 마지막 `wait`가 서버 프로세스까지 기다리던 버그 수정. `-j 8`은 4코어에서 세 스위트가 시간 초과 — 기본 4 유지.

**빌드 단계화** — `build.py` 502줄 한 덩어리를 `read_config → build_pvp_tables → copy_sprites → apply_rank_delta → render_data_js → render_index_html → write_site_files`로. 산출물 바이트 동일. 바뀌지 않은 스프라이트 2,344장 복사 생략(0.5 → 0.3초). `FORM_LABELS`가 해시 무작위화로 빌드마다 달라지던 것을 `(-len, label)` 정렬로 재현 가능하게.

**미사용 코드** — `isFav·toggleFav·favBtn·refreshFavUi·setRole`(auth.js) · `savePlanLast·planLastMode`(planner/shell.js) · `.fav*` CSS 삭제(정의 외 참조 0 전수 조사).

**새 스크립트** — `dev_up.sh`(빌드+서버, SessionStart 훅용) · `ship_dev.sh`(푸시·dev 머지·미리보기 대기·검증 한 번에). settings.json 권고안은 DEVELOPMENT.md. 화면 변화 없음 — 패치노트 없음

</details>

<details>
<summary><b>v3.13.0</b> · UX 흐름 점검 — 미사용 요소·오래된 문구·중복 이동 경로 제거</summary>

열아홉 화면을 흐름대로 따라가며 "지금 없는 것을 말하거나, 같은 곳으로 두 번 가거나, 아무것도 안 그리는 것" 을 찾았다.

**미사용 요소** — `.tagline-row`/`#mode-toggle`(v2.15.0 모드 배지, v2.61.0 부터 분리된 채 리스너만 살아 있었다)과 `#tabs`(늘 비고 숨김) 마크업·`renderTabs()`·`$tabs`·CSS를 지웠다. `updateModeBadge()`는 빈 함수로 남긴다(플래너 셸이 부른다).

**오래된 문구** — auth.js 넷(로그인 유도 3단계·삭제 목록·익명 계정 카드·승인 대기)이 v2.51.0 에 사라진 ★ 즐겨찾기를 말하고 있었다. 도감 상단 `loginHint`도 같은 이유로 빈 문자열. 홈 각주의 '상성' 은 `#note`가 그리지 않는 것이었다.

**중복 이동 경로** — 플래너 홈에서 `#/planner/collection`으로 가는 문 5 → 4(`plan__summary-go` 제거), 맨 아래 `.plan__roadmap` 줄 제거(검색식 만들기는 v2.58.0 에 이미 붙었다).

**점검하고 남긴 것** — `#note`(드로어 '기준 안내' 아코디언이 쓴다) · 드로어 동의 줄(legal.js 가 `#menu-consent`를 누른다) · `favBtn` 계열(죽었지만 화면에 안 보여 이번 범위 밖). 회귀 22묶음 그대로 통과

</details>

<details>
<summary><b>v3.12.0</b> · 검색 팝업 폐지 — 검색은 도감에서</summary>

`<section class="search">`와 `#search-dialog`를 모두 제거했다. 🔍 · `.app-search` · `/`가 전부 `openSearch()` → `#/dex` + `#dex-search` 포커스. 결과가 팝업 안에 있으면 거기 뜬 몇 줄이 "결과" 로 보여 도감까지 안 간다.

**타입 칩을 도감으로** — 무엇을 걸렀는지는 목록 옆에서 읽혀야 한다. `.dex__type-box`(`<details>`, 기본 접힘, 켠 칩이 있으면 펼침) · 최대 2개 · `?t=` 동기화 · [전체 도감 보기] 가 칩도 푼다.

**활용처 순위를 홈으로** — 패널 빈 상태에 살고 있었다(`views/usage.js`는 그대로, 부르는 곳만 바뀜).

**탭 영역 정리** — 전 화면 19개 × 2폭을 훑어 32px 미만 과녁을 셌다. `.boss__more`·`.plan__more`·`.sugg__more`·`.finder__copy`·`.row__more` 44px, 칩류 36×36, `.app-bar__logo` 44px, 브레드크럼 32px. 글자 크기는 불변(키우면 목록이 밀린다), 문단 속 `<a>`는 제외(줄간이 벌어진다). 회귀: `dex-search` 32 → 37 · `nav` 검색 시트 → 도감 이동 · `fingerprint`의 `#page button` 순번 집기를 `.dex__row`로

</details>

<details>
<summary><b>v3.11.0</b> · 패치노트 영문판</summary>

73묶음 313줄 전부. 문장 단위가 아니라 **날짜(묶음 키)로 통째 짝짓는다**(`i18n-release-en.js`) — 짝이 없으면 한국어가 그대로 나가고 그럴 때만 안내가 뜬다. 버전 없는 초기 묶음의 같은 날짜는 `2026-09-08 (2)` 순번으로 가른다(`releaseKey()`). 언어 전환 시 이 화면만 재렌더(사전 엔진은 **그려진 글자**만 옮긴다).

**(수정) `**굵게**`가 별표로 찍혔다** — `el('li', {}, item)`이 문자열을 그대로 붙였다. split('**') 한 줄 파서.

**영문 사전 구멍 메움** — 영어로 열다섯 화면을 훑어 한글 잔여 **291 → 69건**(남은 것은 일정표 이벤트·기술 이름, 의도적). 주원인은 v2.60.0 말투 통일(`~합니다`→`~해요`) 뒤 사전 키가 안 따라온 것 — 키 560개 대조해 67개 적발.

**화면 테마를 버튼/설정 화면으로 가름** — 상단 버튼은 밝게 ↔ 어둡게만(지금 보이는 것의 반대), '기기 설정 따름' 은 신설 `#/settings`로. 저장 값(`pogo_theme`)은 불변. 계정 저장은 v2.47.0 부터 있던 동작을 화면이 밝혀 준다.

**가입 권유 팝업** — 로그인 전/후 비교 표, 잠긴 화면 목록은 `ROUTES.locked`에서 읽는다. 비로그인 첫 방문 1회.

**문서 접기** — CHANGELOG 112판·README 88판을 `<details>`로

</details>

<details>
<summary><b>v3.10.0</b> · 도감 안 검색 칸 부활</summary>

헤더 패널은 결과를 한 줄도 안 그린다(조건만 받아 `#/dex?q=…`로 보낸다). 같은 목록을 두 곳에서 그리면 패널의 여덟 줄이 "결과" 로 보여 도감까지 안 간다. 결과가 한 곳에 모였으니 그걸 좁히는 칸도 그 곁에 둔다 — `#dex-search`는 입력마다 `history.replaceState`로 주소만 갈아 끼우고(hashchange 가 안 떠 `renderPage`가 안 돈다) `draw()`로 목록만 고쳐 그린다. 커서가 안 빠진다(200ms 디바운스 · Enter 는 즉시).

**휴대폰 티어표 그리드 2열** — `--list-cols`가 700px 미만 1 이라 한 줄에 한 장이었다. `.dex__list.is-grid`와 같은 `1fr 1fr`.

**카드 85%** — 1440px 282×420 → 268×362. 그림 18 → 14.2rem · 여백 4.2 → 3.6rem · 이름 2.1 → 1.8rem. 점수 칸은 세로로 쌓아 170px에서 "66 / 점" 으로 쪼개지지 않게.

**동작 버튼 가로 한 줄** — v3.7.1 의 세로 쌓기·2×2 를 되돌리고, 좁은 화면에서 `.page-head`를 한 칸으로 바꿔 버튼 줄이 제목 아래 제 줄을 쓰게 했다(제목을 안 미니 옆으로 놓아도 자리가 넉넉).

**리스트 아이콘 ☰ → ▤** — 오른쪽 위 ☰ 메뉴와 같은 그림이었다.

**배틀 · PvP 에도 보기 전환** — v3.9.1 에서 카드 규칙이 `.is-grid`를 요구하게 되며 클래스가 안 붙는 이 화면만 작은 카드(그림 84px)로 그려지던 것도 함께 고쳐진다. 회귀: `dex-search` 26 → 32 · `layout-toggle` 70 → 84

</details>

<details>
<summary><b>v3.9.1</b> · (수정) 레이드 · PvE · D-MAX의 보기 전환이 아무 일도 안 했다</summary>

카드 규칙 `body:is([data-route=…]) #content .row-list`(1,2,1) 이 되돌리려던 `.row-list.is-list`(0,2,0) 를 특정도로 눌렀다. `data-view`도 클래스도 바뀌는데 화면만 계속 카드였다 — v3.3.0 · v3.5.0 의 토글이 나간 적이 없는 셈. 되돌리기를 더 세게 적는 대신 **카드 쪽에 `.is-grid`를 요구**한다(list.css·pc-theme.css 세 블록에 `:not(.is-list)` / `.is-grid`), 되돌릴 속성을 세어 적던 v3.3.0 블록은 삭제. 덤으로 `@media (min-width: 1100px)`를 떼 **휴대폰에서도 카드 보기가 켜진다**(`--list-cols: 1`이라 한 줄에 한 장 — 도감 그리드와 같은 모양). 기본값은 그대로(`layoutInitial` → `wideCards()`). `is-grid`/`is-list`를 늘 함께 명시하는 `rowListLayout()`을 `ui.js`에 두고 `applyPveLayout`·`applyMaxLayout`이 공유. 회귀: `layout-toggle.js`에 **줄 높이가 실제로 달라지는지** 를 다섯 화면 × 두 폭으로 받는 검사 30종 추가(40 → 70) — 이전 빌드에서 421px → 419px로 잡힌다

</details>

<details>
<summary><b>v3.9.0</b> · 검색 결과를 도감 화면에서 본다</summary>

헤더 검색은 여덟 줄짜리 패널이 끝이라 그 아래를 볼 길이 없었다. 조건을 주소(`#/dex?q=…&t=…`)에 실어 도감으로 넘기면 전부가 목록·그리드로 그려진다. Enter · `[도감에서 보기]` · 목록 끝의 `나머지 N마리는 도감에서 보기` 셋이 같은 곳으로 간다. 결과 줄은 `dexEntries()`(종만)가 아니라 **전역 검색 색인**에서 만들어 메가·섀도우·다이맥스 폼이 남고, `openDetailByDex` → `openDetail`로 바꿔 누른 폼 그대로 열린다. 머리 줄이 조건·마리 수와 `[전체 도감 보기]`를 들고, 세대 칩은 결과 안에서 다시 거른다(수도 같이 갱신).

**(수정) 타입 칩이 목록을 거르지 않았다** — 후보를 고르는 자리가 `typeMonList()`를 부르는데 그 함수를 들고 있던 상성 검색 화면을 v2.63.0 에 접으며 함수도 사라졌다. `typeof … === 'function'`가드 탓에 오류 없이 색인 전체로 되돌아갔다(`물 타입 2,614마리`). `searchTypePool()`로 직접 거른다.

**(수정) 마리 수가 8에서 멈췄다** — `monSearch(…, 8)`로 여덟 개만 받아 그 수를 전체인 양 적었다. 전부 찾고 나서 자른다. 회귀 `tests/e2e/dex-search.js` 26종 신설

</details>

<details>
<summary><b>v3.8.3</b> · (긴급 수정) 보기 전환 버튼이 iOS 에서 동작하지 않음</summary>

도트 아이콘이 SVG 라 탭의 히트 대상이 안쪽 `<rect>` 였다(`rect → svg → button`). 크로뮴은 click 을 올려 보내지만 iOS 사파리는 SVG 자식을 따로 히트 테스트해 탭을 흘린다. `.pxi { pointer-events: none }` — 그림은 히트 테스트에서 빼면 누르는 것은 언제나 버튼 자신이다.

**(긴급 수정) 휴대폰 세로 스크롤 끊김** — 점 격자를 화면을 덮는 `position: fixed` 레이어(`#px-bg`)에 칠하고 있어 본문이 움직일 때마다 다시 칠했다(합성 스크롤 이탈). 격자는 `body`로 내리고, `#px-bg`는 몬스터볼만 남겨 `min-width: 1100px`에서만 만든다(가로로 눕힌 휴대폰 932px 포함). 회귀 3종 추가 — 격자 위치 · 좁은 화면의 화면 덮는 고정 요소 없음 · 아이콘이 탭을 가로채지 않음

</details>

<details>
<summary><b>v3.8.2</b> · (수정) 검색식 만들기: 만들어진 식이 상단 바 뒤에 숨었다</summary>

결과 칸이 `sticky; top: 0` 인데 상단 바도 sticky(`z-index: 30` > `2`)라, 스크롤하면 위쪽 73px이 가려 `[복사] [비우기]` 줄만 남았다. 붙여 둔 이유가 완전히 사라진 상태. 바 높이만큼 내린다(좁은 화면 `calc(5.9rem + max(1.4rem, env(safe-area-inset-top)))` · 넓은 화면 `8.1rem`, 사이드바와 같은 값).

**묶음 간격 재조정** — 칩 줄 6px / 제목↔칩 10 → **8px** / 묶음↔다음 제목 18 → **28px**. 셋이 거의 같아 묶음이 안 읽혔다. 안내문↔결과 칸 0 → 16px.

**머리 안내문**에서 화면 부제와 겹치던 첫 문장 삭제.

**남은 이모지를 도트로**(`🧹` `🤝` `📋`) — 라벨 앞 이모지를 가르는 일을 `pxIconLabelParts()`로 떼어 `toolButton()`과 공유. 도트 35종

</details>

<details>
<summary><b>v3.8.1</b> · (수정) 상세 화면의 타입 배지가 그림을 덮었다</summary>

두 타입이면 세로로 쌓여 그림 왼쪽을 위에서 아래까지 가렸다. 가로 한 줄로 놓으면 그림 위쪽 빈 자리만 스친다. 가장 긴 경우(`에스퍼` `페어리` 102px)가 그림 상자(96px) 오른쪽 끝에 딱 맞아 글 칸으로 넘치지 않는다

</details>

<details>
<summary><b>v3.8.0</b> · 보기 전환(리스트 ↔ 그리드)을 버튼 하나로</summary>

상태가 둘뿐인데 칸을 둘 둘 이유가 없다. 화면 테마 버튼과 같은 문법: 아이콘은 지금 보기, 누르면 반대로. 모양이 두 번 바뀐 내력은 `components/ui.js` 머리말에 — `~v2.39` 버튼 하나(라벨이 "지금" 인지 "누르면" 인지 안 갈렸다) → `v2.40.0` 두 칸(또렷하지만 자리를 두 배로, v3.1.0 에 머리로 올린 뒤엔 제목을 밀어냈다) → `v3.8.0` 다시 하나(옛 문제는 테마 버튼이 이미 푼 방식으로). 지금 보기는 색으로도(`[data-view="grid"]`), 상태는 `data-view`에. 이름은 v2.40.0 **이전** 문구를 되살렸다(사전에 키가 남아 있었다). 저장 키·값 관례 불변. 클래스 `.seg-view` → `.view-toggle`. 격자 아이콘(`⊞`) 추가로 도트 32종.

**(수정)** v3.7.1 의 제목 꼬리말 내리기를 실제로 접히던 `.row-head` 하나로 좁혔다

</details>

<details>
<summary><b>v3.7.1</b> · 도트 굵기</summary>

v3.6.1 에서 가짜 굵기를 걷어내니 너무 얇았다. 700 을 되돌리면 다시 번지므로 `text-shadow: 0.1rem 0 0 currentColor`로 **정확히 한 도트** 두껍게 한다(도트 글꼴의 원래 방식). 제목·이름·숫자·버튼 글자에만, 산문은 그대로.

**좁은 화면 머리 배치** — 레이드 PvE의 버튼 둘은 위아래로, 배틀 PvP의 리그 넷은 2×2(`:has(> button:nth-child(4))`로 넷 이상일 때만 — D-MAX의 셋은 2×2 면 한 칸이 빈다). 구역 제목과 꼬리말도 아랫줄로.

**도구 버튼 이모지**를 도트 아이콘으로(`toolButton()`에서 앞 이모지를 가른다).

**(수정)** v3.6.1 의 곡선 제거가 1440px이상에서 새어 나왔다 — `body:is([data-route=…]) #content .row > .sprite`가 id 한 칸 + 클래스 셋이라 `html:not(#_)`를 이겼다. 곡선·그림 받침·카드 테두리 셋을 `:not(#_):not(#__)`로 두 칸 올리고, 받침 규칙은 `.sprite:not(.is-loading):not(.empty)` 한 줄로 합쳤다

</details>

<details>
<summary><b>v3.7.0</b> · 키 컬러를 원작의 몬스터볼 빨강으로</summary>

스플래시 공·공유 카드가 이미 이 빨강인데 브랜드만 인디고라 셋이 따로 놀았다. `--brand`·`--accent` `#6366f1` → `#d63024`(다크 `#ff5f52`). 빨강이 브랜드를 가져가면서 자리가 겹치는 색 둘을 반 칸씩 옮겼다 — `--warn` `#dc2626` → `#9f1239`(자주빛 진홍, "선택됨" 과 안 헷갈리게), `--point` `#ec4899` → `#2f6fd0`(파랑, 옆에 놓이는 A티어 앰버와 안 싸우게).

**그림과 글자의 빨강을 반 단 가른다** — 그림은 원작 값 `#e5372e`, 글자 토큰은 `#d63024`(밝은 바탕 명암비 4.1 → 4.7).

**앱 아이콘·공유 카드를 채운 몬스터볼로**(`icon_gen.py`·`og_gen.py`) — 선으로만 그린 흰 공은 작게 뜨면 그냥 동그라미다. `og_gen.py`는 v2 시절 초록에 멈춰 있었다.

**(수정)** `theme-color` 메타 두 줄도 v2 값이었다

</details>

<details>
<summary><b>v3.6.1</b> · 도트 디자인 다듬기</summary>

실제 화면을 보고 고쳤다.

**(1) 바탕이 글자를 가렸다**: 배경을 `#px-bg` 한 겹으로 빼고 점은 흐린 원(`transparent 65%`)·농도 7% → 4.5%, 몬스터볼은 `blur(0.6rem)`.

**(2) 도트 글꼴에 가짜 굵기가 씌워져 있었다** — 갈무리에는 Bold 가 없어 700 을 주면 브라우저가 획을 덧그린다(도트가 번져 흐린 고딕이 된다). 본문 전체 400, 산문(`Pretendard`)의 `b`·`strong`만 700.

**(3) 글씨·여백** — 제목 줄간 1.05 → 1.35배, 부제·안내문 11~12.5 → 13px, 꼬리 글씨 줄간 22 → 17px, 구역 제목 위 40 → 20px, 서비스 홈의 빈 컨트롤 줄(60px) 제거.

**(4) 남아 있던 둥근 모서리** — 이름 목록 대신 뿌리에서 한 번에(`html:not(#_) body *`), 되돌리는 것은 프로필 사진·알림 점·바탕 몬스터볼뿐.

**(5) 문단 속 이모지**를 도트 아이콘으로(과녁 추가, 31종)

</details>

<details>
<summary><b>v3.6.0</b> · 도트(픽셀) 디자인</summary>

보여 주는 그림이 전부 96px 도트인데 껍데기만 매끈했다. 글꼴 갈무리(본문 Galmuri11 · 제목 Galmuri14 · 숫자 GalmuriMono11, 긴 산문만 Pretendard), 모서리 0 · 테두리 2px · 흐림 0 그림자 · `steps()` 전환. 규칙은 `styles/pixel.css` 한 파일 — `STYLES`에서 한 줄 빼면 되돌아간다.

**도트 아이콘 30종**(`components/pxicon.js`) — 메뉴 · 홈 타일 · 버튼의 이모지를 12칸 격자 SVG 로. 표의 키가 이모지라 호출부는 `pxIcon(icon) ?? icon` 한 줄.

**바탕에 몬스터볼 둘** — `steps(8)`로 느리게 떠다닌다(좁은 화면 · 동작 줄이기에서는 없음).

**불러오는 화면**은 공을 던진 뒤의 기우뚱.

**검색 색인 표시 제거** — 실서비스 `robots` 줄과 JSON-LD 를 뺐다(og · twitter · canonical 은 유지).

**(수정)** `pixel.css`가 `.app-nav`의 `position: fixed`를 덮어써 사이드바가 흘러내리던 것

</details>

<details>
<summary><b>v3.5.0</b> · 도감 안 검색 칸 제거</summary>

v2.66.0 에 문구로 성격을 갈랐지만 생김새가 같은 입력칸 둘이 한 화면에 있는 것 자체가 문제였다. 헤더 검색이 어차피 포켓몬을 찾아 상세로 데려간다. 세대 칩은 그대로. 제목 옆으로 끌어올리던 음수 마진 규칙도 삭제.

**D-MAX 보기 전환 추가** — 카드 격자를 줄로(`pogo_max_cols`, 레이드 PvE와 같은 규칙).

**[이번 주 보스] ↔ 타입 필터 32px → 8px** — `.boss__acc` 마진 12px + `.controls` 패딩 20px이 겹쳐 있었다. 아코디언이 뜨는 화면에서만 좁힌다(`.is-on`)

</details>

<details>
<summary><b>v3.4.0</b> · ★ 즐겨찾기를 모두 제거했다</summary>

담을 수는 있는데 담은 뒤에 할 수 있는 일이 없었다. "그래서 뭘 키우지" 는 육성 플래너가 하는 일이라, 반쯤 하는 기능을 남기기보다 쓸모를 정한 뒤 다시 만든다(노션 백로그). 지운 것: `#/favs` 화면(기존 주소는 `legacy`로 도감에) · `favdigest.js` + 헤더 ★ · 목록/상세의 ★ · 역할 보정 토글 · 죽어 있던 `initFavsMenu()`.

**남긴 것**: `AUTH.favs` 저장·동기화(계정 목록은 Firestore 에 그대로 — 다시 만들면 되살아난다)와 `roleWhereLabel()`(헤더 검색의 "레이드 전체 1위" 보조줄이 쓴다).

**메뉴 `내 포켓몬` 들여쓰기 제거** — 드로어는 줄마다 `›`가 붙는 목록이라 한 줄만 밀리면 어긋나 보였다

</details>

<details>
<summary><b>v3.3.0</b> · 레이드 · PvE 재배치</summary>

읽는 차례대로: ① 어느 표를 볼까(머리) ② 타입으로 좁히기 ③ 혼자 잡을 수 있나. `[일반\|전체]`를 화면 머리로(D-MAX 축 · PvP 리그와 같은 성격), 그 옆에 **보기 전환을 새로** 달았다 — 넓은 화면에서 카드 격자로만 보이던 랭킹을 `.row-list.is-list`로 줄로 되돌린다(키 `pogo_pve_cols`).

**타입 필터 기본 펼침**(`state.filtersOpen` 기본 `true`) — 접힌 채로는 이 화면의 주된 길이 한 번 더 눌러야 보였다.

**솔플 계산기는 타입 필터 아래 줄**로. 동작 슬롯이 컨트롤을 여럿 받고(`setPageHeadAction(...nodes)`), 빈 껍데기 줄은 `:empty`로 자리를 안 먹는다

</details>

<details>
<summary><b>v3.2.0</b> · D-MAX 축 · PvP 리그도 화면 머리로</summary>

v3.1.0 의 동작 슬롯을 메인 셸까지. 뷰가 `js-head-action` 표식만 달면 `render()`가 옮긴다. 셋은 서로 다른 순위표고(D-MAX), 리그가 바뀌면 화면 전체가 달라진다(PvP) — 필터가 아니라 "이 화면이 무엇인가" 다.

**(수정) 앞 화면 컨트롤이 남던 것** — v3.1.0 은 `renderPage`에서만 슬롯을 맞춰, 알 부화 → D-MAX로 가면 리스트·그리드가 따라왔다. `render()`도 매번 맞추고 옮길 것이 없으면 비운다.

**(수정) D-MAX 첫 화면** — `app-shell.js`가 `SCRIPTS` 맨 끝이라 `app.js`의 첫 `render()` 때 슬롯이 없었다. 셸 완성 후 한 번 더 맞춘다. 슬롯은 `const`가 아니라

**id 로 찾는다** — `const`는 번들에서 끌어올려지지 않아(TDZ) 앞줄 `pages.js`의 로드 직후 호출이 화면을 통째로 죽였다

</details>

<details>
<summary><b>v3.1.0</b> · 보기 전환을 화면 머리로</summary>

리스트·그리드가 목록 위 한 줄을 통째로 쓰고 있었다. 보기 방식은 목록 하나가 아니라 화면 전체에 걸리는 설정이라 제목과 같은 높이가 맞다. 머리를 두 칸 격자(`minmax(0,1fr) auto`)로 두고 오른쪽에 동작 슬롯(`.page-head__actions`, 비면 `:empty`로 폭 0). 토글은 `renderPage`가 본문에서

**옮겨 담는다** — 복제가 아니라 이동이라 `onclick`·`aria-pressed`·저장 키가 그대로 간다. 네 화면(도감·레이드 보스·알 부화·즐겨찾기)이 한 번에 같은 자리. 스타일 가이드는 견본이라 제외

</details>

<details>
<summary><b>v3.0.0</b> · 새 디자인 시스템</summary>

스타일 레퍼런스(yceffort.kr)의 색·글꼴 체계. 구조와 기능은 그대로, `tokens.css`와 글꼴만 갈아끼웠다.

**바탕과 카드를 뒤집는다** — 흰 바탕 위 회색 카드 → 꺼진 바탕(`#fafafa`) 위 흰 카드. 목록이 곧 카드 더미라 카드가 바탕보다 밝아야 "떠 있다" 로 읽힌다.

**회색이 파란 기에서 보라 기로**(`#64748b` → `#64647a`) — 타입색 열여덟 중 파랑이 넷이라 슬레이트 회색이 계속 싸웠다. `--line-2`·`--ink-2`·`--ink-4` 세 단 추가.

**브랜드 초록 → 인디고**(`#6366f1`/다크 `#818cf8`) — 초록은 `--t-grass`로만 남아 "선택 표시인가 풀 타입인가" 혼동이 사라진다. 초록이 겸하던 "좋음(상향·내성)" 은 `--good`(teal)으로 분리, `--point`는 브랜드와 붙어 핑크로.

**글꼴 세 벌** — 본문 Inter(한글 Pretendard 그대로) · 숫자 JetBrains Mono(자릿수 정렬) · 강조 한 마디 Fraunces 이탤릭. 카드 반경 1.4 → 1.2rem

</details>

<details>
<summary><b>v2.67.1</b> · 보기 전환이 왼쪽에 왼쪽으로 치우치던 문제 수정</summary>

v2.67.0 의 `display: inline-grid` 때문에 `margin-left: auto`가 죽었다(인라인 박스에는 auto 마진이 먹지 않는다). flex 안에 있던 도감·레이드·알은 멀쩡했고 줄을 혼자 쓰는 즐겨찾기만 왼쪽으로 내려앉았다. `grid` + `width: fit-content`로 되돌려 어느 자리에서나 오른쪽 끝에 붙는다.

**즐겨찾기 도구줄** — 그룹 칩(왼쪽)과 보기 전환(오른쪽)을 한 줄로, 다른 목록 화면과 같은 문법

</details>

<details>
<summary><b>v2.67.0</b> · 상세 화면 포켓몬이 움직인다</summary>

PokeAPI B/W 애니메이션 GIF, 1,172종 중 949종(81%). 목록은 그대로 둔다: GIF 는 정지 png 의 13배(54KB vs 4KB)라 100장을 그리는 도감 첫 화면이 400KB → 5.4MB가 된다. 정지본을 먼저 띄우고 받은 뒤 갈아 끼운다(빈 칸으로 열리지 않게). 없는 종은 `.none` 표시로 404 재요청 차단, `prefers-reduced-motion`이면 갈아 끼우지 않는다. sw 캐시 `pogoplan-v5` · robots.txt 에서 제외.

**컨트롤 한 줄** — 왼쪽 "무엇을 보나" · 오른쪽 "다른 걸 해 볼까". PvP는 `[도구][리그] … [다른 도구]`, 레이드/알은 안내문 옆에 보기 전환.

**리스트·그리드 전환 축소** — 목록 폭을 다 쓰던 줄을 오른쪽 끝 작은 덩이로. 좁은 화면은 `☰ ⊞` 아이콘만(이름은 `aria-label`).

**검색 메타** — prod 에 `robots: index, max-image-preview:large`(dev `noindex`와 같은 자리라 한 줄만), `twitter:*` 보강, 구조화 데이터에 `WebApplication` 추가. `SearchAction`은 해당 주소가 없어 넣지 않음

</details>

<details>
<summary><b>v2.66.0</b> · 한 화면 한 기능</summary>

화면과 기능을 대조해 겹치는 곳 여덟을 찾고 일곱을 고쳤다(노션 감사). 나머지 하나는 이미 되어 있어 백로그를 취소했다.

**도구마다 주소** — `#/pvp/deck` · `#/pvp/ivrank` · `#/pve/solo`. `ROUTES`의 `tool`을 `applyPlanRoute()`가 `state.*Tool`로 옮기므로 그리는 쪽은 그대로 `state`만 읽는다. `parent`는 브레드크럼 한 칸(`🏠 › 배틀 · PvP › 개체값 순위`).

**리그 컨트롤이 둘이던 것** — 개체값 순위 블록이 자기 탭을 따로 가져 위에서 슈퍼를 골라도 아래는 리틀일 수 있었다. `state.league` 하나로.

**구분선을 필터 아래로** — 제목·부제·필터가 한 덩이고 선 아래가 결과다. 셸은 `#controls`, 전체 페이지는 `.page__filters`; 한 화면에 선은 하나(회귀가 센다).

**입구 하나로** — 도감 `★` 칩 제거(헤더 ★ 하나), 넓은 화면 `🔍` 버튼 숨김(옆 검색바가 같은 일).

**내 포켓몬을 메뉴로** — 육성 플래너 아래 들여쓴 자식(`parent`), `ROUTE_NAV`가 자식을 부모 뒤로 정렬. 마지막 탭 줄 제거.

**일정표 ↔ 레이드 보스** — 같은 질문에 두 원본이 답하고 있었다. 달력은 "언제", 보스 화면은 "지금 무엇이".

**이름·설명 한 벌** — 홈 타일이 `ROUTES`·`routeDesc`를 읽는다

</details>

<details>
<summary><b>v2.65.0</b> · 메뉴를 "하려는 일" 로</summary>

주요 · 부가는 우리 기준이지 쓰는 사람 기준이 아니다. `지금 뭐 하지` · `뭘 데려갈까` · `내 포켓몬` 세 그룹로 다시 묶고, 홈 타일도 같은 차례로 놓았다(`ROUTES`의 `group` 하나가 원본).

**화면 머리에 구분선** — 여백만으로는 제목 · 부제와 본문이 한 덩이로 읽혔다. 위 1.2rem · 아래 4.4rem 사이에 선을 긋는다. 선은 `border`가 아니라 배경(`background-origin: content-box` + `clip: padding-box`)이라야 사이드바 · 상세 패널로 달라지는 좌우 패딩을 따로 적지 않는다. 도감만 검색창이 머리 위로 올라와 있어 도구줄 위에 긋는다.

**PvP 개체값 순위 좌우 분할** — 왼쪽 입력 고정(sticky) · 오른쪽 결과, 리그 상위 10 은 세 리그를 나란히(탭은 CSS로 좁은 화면에만).

**도감 검색창을 제목 옆으로** — 한 줄을 통째로 써 목록이 그만큼 밀려 있었다.

**육성 플래너 걸음 카드** — 다섯 중 넷이 같은 곳으로 갔다

</details>

<details>
<summary><b>v2.64.0</b> · ★ 즐겨찾기를 헤더 버튼 + 팝업으로</summary>

접어 둬도 한 뼘을 먹어 배틀 · PvP에서는 리그 세그먼트가 첫 화면 밖으로 밀렸다. 즐겨찾기는 어느 화면에서나 보고 싶은 것이라 화면 안이 아니라 헤더가 맞다(검색 🔍 과 같은 문법). 로그인 + 즐겨찾기가 있을 때만 버튼이 보이고, 팝업에서 포켓몬을 누르면 팝업을 먼저 닫는다(팝업이 쌓이면 뒤로가기가 두 번 필요해진다).

**☰ 메뉴를 두 덩이로** — 주요 기능(육성 플래너·도감·D-MAX·레이드 PvE·배틀 PvP)과 부가 기능. 열 줄이 한 덩이라 늘 쓰는 것을 찾으려면 매번 처음부터 훑어야 했다. `ROUTES`의 `group:'main'` 하나로 정하고 한 `<nav>` 안에서 `<h3>`로 가른다(랜드마크는 그대로 하나).

**배틀 · PvP를 읽는 순서대로** — ① 리그 ② 타입 ③ 도구. 전에는 도구 버튼이 리그 줄에 얹혀 리그를 고르기도 전에 눈에 띄었고 좁은 화면에서는 두 줄로 접혀 타입 필터를 밀어냈다.

**화면마다 부제** — 좁은 화면에서 CSS가 감추고 있었다. 제목만으로는 "여기서 무엇을 하는지" 를 모른다. 빠져 있던 다섯 화면에 한 줄씩 달고, 메뉴에 오르는 14곳 전부를 회귀로 붙잡았다

</details>

<details>
<summary><b>v2.63.0</b> · 🧭 타입 & 상성 화면을 접었다</summary>

같은 표가 두 곳에 있었다. 상세 팝업의 약점·내성 표가 같은 계산(`typeMultAgainst`)을 쓴다. 라우트·메뉴·홈 타일에서 빼고 `components/typesearch.js`를 지웠다.

**공유된 기존 주소는 죽지 않는다** — `#/types?t=…`를 `legacy`로 도감에 잇는다. 상세의 `🧭 상성 검색에서 딜러까지 보기` 버튼도 뗐다(바로 위 표가 그 화면이라 갈 곳이 없다). `typeChipEl`·`typeMultAgainst`는 `detail.js`에 있어 영향 없음.

**🧬 PvP 개체값 순위를 배틀 · PvP 안으로** — 메뉴에 따로 둘 화면이 아니었다. 리그 순위를 보다가 "내 개체는 몇 위지" 가 떠오르는 자리라, `[🃏 덱 짜기]` 옆 `[🧬 개체값 순위]`로 그 자리에서 펼친다(`state.pvpTool`). `#/ivrank` 주소는 남긴다 — 라우트에서 `nav`만 빼면 메뉴에는 안 뜨고 북마크·공유 링크는 산다. 홈 타일 11개 → 9개

</details>

</details>

<details>
<summary><b>2026-09-11</b> — 릴리스 9개 · <code>v2.55.0 … v2.62.0</code></summary>

<details>
<summary><b>v2.62.0</b> · PvP 개체값 순위에 리그 탭</summary>

"가장 쓸 만한" 한 리그의 상위 10 만 보여 줘서, 그 종을 다른 리그에서 쓰려면 뭘 노려야 하는지는 볼 길이 없었다. 리틀 · 슈퍼 · 하이퍼를 `seg` 탭으로 고른다(마스터는 CP 상한이 없어 줄 세울 것이 없어 뺀다). 처음 켜지는 탭은 가장 쓸 만한 리그, 그 뒤로는 사람이 고른 것을 따른다(`pogo_ivrank.league`). 함께

**고른 포켓몬 카드 수정** — `레지스틸공격 143 · 방어 285…` 처럼 이름과 종족값이 붙어 나왔다. 플래너의 `.plan__picked`를 빌려 썼는데 **그 클래스에는 스타일이 아예 없었다**. `.ivrank__picked`를 따로 만들어 그림 \| 이름·종족값(세로) \| ✕ 로 놓고, ✕ 는 `--tap`을 지킨다. 화면 위쪽 간격도 정리

</details>

<details>
<summary><b>v2.61.0</b> · 🧬 PvP 개체값 순위 (`components/ivrank.js` · `#/ivrank`, 실험 기능)</summary>

PvE와 PvP는 좋은 개체의 기준이 정반대인데 서비스는 PvE 기준만 보여 줬다. PvP는 CP 상한이 있어 공격이 **낮을수록** 같은 CP 안에서 레벨을 더 올릴 수 있어 0/15/15 같은 조합이 1위가 된다. CP 상한 안 최고 레벨에서의 **스탯 곱**(공격 × 방어 × `floor`(체력))으로 4,096조합을 줄 세운다 — 체력에만 내림을 쓰는 게 핵심이다(게임이 체력을 정수로 끊어 순위가 계단처럼 갈라진다).

**새 데이터 원본이 없다**: 종족값·레벨별 배율은 이미 쓰던 값이고 `planLeagueReach()`가 절반을 해 놓았다. 미리 계산하면 1,600만 개라 그자리에서 센다(한 종 네 리그 8ms). 레벨 찾기는 이진 탐색 — 선형과 61,440건 대조해 불일치 0, 그 대조를 회귀에 넣었다. PvP 순위(상위 40)에 오른 종의 상세에 **"PvP 라면 이 개체값"** 을 붙인다(순위 밖 종에는 안 붙인다). 마스터리그는 CP 상한이 없어 순위를 매기지 않고, 획득 경로별 개체값 하한(알·레이드·리서치 10↑ · 섀도우 6↑)을 고를 수 있다. 함께

**랭킹 탭 줄·바로가기 제거** — v2.42.0 PC 셸에서 왼쪽 메뉴가 항상 펼쳐지면서, v2.22.0에서 해당 요소를 복원했던 이유가 사라졌다. 플래너 탭은 한 화면 안에서 기능을 구분하므로 유지한다.

**타입 & 상성 기본 노말** — 빈 첫 화면이 휑했다 (`tests/e2e/ivrank.js` 18항목)

</details>

<details>
<summary><b>v2.60.1</b> · 화면을 옮겨도 상세 패널이 따라오던 것 수정</summary>

넓은 화면에서 도감 포켓몬을 연 뒤 [서비스 홈] 으로 가면 홈 오른쪽에 이전 포켓몬 카드가 그대로 붙어 본문이 눌렸다. `components/modal.js`의 `hashchange` 리스너가 `routeIdOf() === 'home'`을 예외로 두고 있었다. `mon`을 남긴 건 맞다 — `#/mon/<id>`는 상세를 가리키는 주소라 패널이 곧 그 화면이다(딥링크 진입·뒤로가기). 하지만 홈까지 넣어 두어 홈으로 가는 **모든** 이동이 패널을 살려 두었다. 남길 조건을 라우트 id 가 아니라 `/^#\/mon\//` 주소 하나로 좁혔다. 목록에서 다른 포켓몬을 누를 때는 `replaceState` 라 `hashchange`가 안 나 이 리스너를 타지 않는다(같은 화면 안 동작은 그대로). `tests/e2e/detail-panel.js` 네 줄 추가

</details>

<details>
<summary><b>v2.60.0</b> · 화면 말투를 친근체 하나로</summary>

같은 화면 안에서 `~합니다`와 `~해요`가 섞여 있었다(격식 306곳 · 친근 281곳). 안내 문구 120여 곳을 어미 대응표로 통일하고, `습니다` 글자가 없는 ㅂ불규칙(`씁니다`·`봅니다`·`열립니다`)은 2차로 따로 훑었다. 공문서 낱말(`해당`·`즉시`·`확인하세요`)을 빼고, 결론을 앞에 놓도록 몇 문장을 다시 썼다.

**약관·개인정보처리방침·저작권 고지는 격식체 그대로** — 말투를 낮추면 구속력 있는 문장으로 안 읽힌다. 패치노트도 지난 기록이라 두었다.

**영어판 손실 0** — 한국어 원문이 곧 사전 키라 원문을 바꾸면 영어판이 한글로 샌다. (옛 → 새) 쌍을 키에 그대로 적용하고 키 406개·영어 값 집합이 전후 같음을 대조했다. 함께

**잠긴 화면 문구 축약** — 막힌 사람이 할 수 있는 일은 로그인 하나뿐인데 읽을 것이 세 줄이었다. `LOCK_WHY`와 `why` 인자를 지우고 줄마다 다른 것을 말하게 나눴다(제목·조건·동의). 승인제 안내는 남긴다 — `allowlist`에 올라야 열리므로 "로그인만 하면 된다" 고 적으면 사실이 아니다. 그리고

**`레이드 · PvE은` 조사 오류 수정** — `koParticle`이 한글 받침만 읽어 라틴 문자로 끝나면 늘 `은`을 골랐다. 독음 받침표를 들이는 대신 조사가 필요 없는 문장으로 적는다

</details>

<details>
<summary><b>v2.59.0</b> · 목록 격자 사다리 (`styles/tokens.css` `--list-cols`)</summary>

1920 에서 한 줄에 다섯, 중단점마다 넷 · 셋 · 둘 · 하나로 줄어든다. 넓은 화면에서 줄 하나가 폭을 다 쓸 이유가 없다 — 담긴 정보는 그림 · 이름 · CP 뿐인데 오른쪽 절반이 비고 27종을 보려면 스크롤을 스물일곱 번 내려야 했다. 열 개수를 **한 곳에서** 정한다: 전에는 `pages.css` · `list.css` · `pc-theme.css`가 각자 `auto-fill minmax(26rem)`로 계산해 폭이 같아도 화면마다 열이 달랐다. 도감 · 레이드 보스 · 알 부화 · 즐겨찾기(`.dex__list`)와 D-MAX · 레이드 PvE · 배틀 PvP(`.row-list`)가 같은 값을 본다. 상세 패널이 열리면 두 칸 내린다(패널이 `--panel-w`를 가져가므로 같은 열을 유지하면 카드가 눌린다). [리스트] 로 본 도감 줄은 두 줄 짜임으로 바꿨다 — 줄 조각이 "한 줄이 폭을 다 쓴다" 는 전제였어서 좁은 칸에서 이름이 한 글자씩 세로로 쪼개졌다. 좁은 화면의 티어표는 v2.53.0 결정대로 한 줄에 하나. 덧붙여

**dev 빌드 탭 제목 앞에 `[dev]`** — 실서비스 탭과 나란히 띄우면 제목이 같아 구분되지 않았다

</details>

<details>
<summary><b>v2.58.0</b> · 🔎 검색식 만들기 (`components/finder.js` · `#/finder`, 백로그 QA-57)</summary>

조건을 눌러 고르면 게임 검색창에 그대로 붙여 넣을 검색식이 만들어진다. 박스가 수천 마리가 되면 "뭘 정리할지" 를 눈으로 고를 수 없다. 게임의 검색식이 그 일을 하는데 문법이 낯설어(`4*`·`!`·`&`·`,`) 대부분 쓰지 않는다 — 여기서는 **고르면 식이 되고**, 식을 보면서 문법을 배우게 된다. 한 칸이 세 상태를 돈다(＋포함 → －제외 → 해제): 버튼을 둘로 나누면 같은 조건이 화면에 두 번 나와 어느 쪽이 켜졌는지 헷갈린다. 타입은 `&`가 아니라 `,`로 잇는다 — `&` 면 "둘 다인 것" 이라 거의 안 걸린다. 결과 칸은 sticky 라 조건을 고르는 내내 눈에 있다. 고른 것은 `pogo_finder`에 남아 게임과 오가며 여러 번 쓴다.

**넣지 않은 것이 이 화면의 경계다** — 게임 버전마다 갈리는 문법(`countcandy` 등)은 틀린 식을 주면 사용자가 게임에서 빈 결과를 보고 이 서비스를 의심하게 되므로 빼고, 게임이 아예 지원하지 않는 조건(교환 상대 닉네임·리모트 전용)은 화면 아래에 "없다" 고 적는다. 다른 잠긴 화면과 같은 규칙으로 로그인해야 열린다. ☰ 메뉴와 홈 타일 양쪽에 올린다 — 한쪽에만 있으면 메뉴를 안 여는 사람은 그 화면이 있는 줄도 모른다 (`tests/e2e/finder.js` 16항목)

</details>

<details>
<summary><b>v2.57.0</b> · 배포본에서 주석·공백을 제거한다 (`backend/build.py` `strip_js_comments`·`strip_css_comments`·`JSON_TIGHT`)</summary>

화면에 보이는 변화는 없다. 이 저장소의 주석은 "왜 이렇게 했는가" 를 길게 적고 그게 값어치인데, 그건 **읽는 사람**에게 값어치가 있는 것이고 브라우저는 매번 그만큼을 더 받아 더 읽는다 — 실측 배포본 752KB 중 주석이 227KB(30%)였다.

**원본은 그대로 두고 나가는 것만** 제거한다. 안전선을 분명히 뒀다: JS는 **줄 전체가 주석인 줄만**(코드 뒤 ` // …`는 문자열 안일 수 있어 손대지 않는다 — 실측 5.6KB 라 아낄 것도 없다), 여러 줄 백틱 안은 통째로 건너뛰고, CSS는 문자열을 피해 `/* */`만, `@license`·`@preserve`는 남긴다. `optional_json`이 앞 단계가 만든 json 을 되감아 공백을 줄인다(값은 그대로, 사이 공백만).

**첫 방문 gzip 497 → 362KB(−27%), 브라우저가 읽는 원본 2,474 → 1,946KB(−21%).**

**증거** — 22개 화면 × 2폭의 계산된 스타일 **58,512줄을 전후 대조해 차이 0건**. 파일 머리말(`── 파일명 ──`)은 걷어낸 뒤에 붙여 배포본에도 남는다

</details>

<details>
<summary><b>v2.56.0</b> · (버그) 공유 링크로 연 상세 팝업이 ✕ 로 안 닫히던 문제 (`components/modal.js` `openModal`)</summary>

공유 링크로 **바로** 들어오면 히스토리 항목이 하나뿐이고 그게 `#/mon/…` 인데, 팝업이 같은 주소로 하나 더 쌓아 **위아래가 둘 다** `#/mon/…`이 됐다. 그래서 `closeModal`의 `history.back()`이 아래 항목으로 내려가고 라우터가 그 해시를 읽어 팝업을 곧바로 다시 열었다 — 눈에는 "안 닫힌다" 로 보인다. 목록에서 열 때는 이 시점에 해시가 아직 `#/mon/…`이 아니라(`detail.js`가 `openModal` **뒤**에 넣는다) 아래 항목이 깨끗해 버그가 안 났다. 쌓기 전에 지금 항목의 해시를 지워 깨끗한 바탕을 만들면 목록에서 열었을 때와 같은 모양이 된다. 회귀는 ✕ 뿐 아니라 **뒤로가기로도 되살아나지 않는지**까지 본다(`tests/e2e/router.js`).

**로그인 안내 팝업 버튼을 가운데로** (`components/consent.css`) — 내용 폭에 맞춰 줄어드는 버튼이 왼쪽에 붙어 위의 세 단계 설명과 같은 줄에 섰다. 읽는 것이 아니라 고르는 것이라 줄에서 떨어져야 한다.

**회귀 경합 하나 제거** — `theme.js`가 `commit` 직후 한 번 들여다보고 "번들 전인데 붙었다" 를 확인했는데, 그 순간 head 스크립트조차 안 돌았을 수 있어 부하에 따라 갈렸다(병렬 실행에서 드러났다). "값이 붙는가" 와 "붙이는 코드가 번들보다 앞인가(문서 순서)" 둘로 나눠 부하와 무관하게 만들었다

</details>

<details>
<summary><b>v2.55.0</b> · D-MAX [딜러] 탭에 그 타입 티어표를 위에 얹었다 (`views/max.js` `maxTierBlock`)</summary>

타입을 고르고 [딜러] 로 들어오면 "이 타입으로 뭘 키우나" 와 "이 타입 보스를 뭘로 때리나" 둘 다 궁금한데, 전에는 뒤엣것만 보여 주고 앞엣것은 [전체] 탭으로 되돌아가야 했다.

**두 표에서 고른 타입의 뜻이 다르다** — 위(티어표)는 *그 타입 맥스무브를 쓰는* 개체, 아래(딜러)는 *그 타입 보스를 상대할* 개체다. 같은 '에스퍼' 라도 위는 에스퍼 맥스무브를 쓰는 쪽, 아래는 에스퍼 보스에게 강한 쪽이라 명단이 겹치지 않는 게 정상이라, 두 머리글이 그 차이를 문구로 명확히 구분한다("에스퍼 맥스무브 D-MAX 티어표" / "에스퍼 보스 상대 D-MAX 딜러"). 머리글을 짧게 줄이면 두 표가 같은 것의 두 벌처럼 읽히므로 줄이지 않는다. 티어표 렌더링은 `maxTierBlock`으로 떼어 [전체]·[딜러] 두 탭이 함께 쓴다 — 두 곳에 같은 코드를 두면 한쪽만 고쳐 놓고 다른 쪽이 기존 형태으로 남는다. [탱커] 탭과 PvE·PvP는 손대지 않았다. 회귀는 **순서 자체**를 명시한다(`tests/e2e/nav.js`) — 뒤집히면 화면의 뜻이 바뀐다

</details>

</details>

<details>
<summary><b>2026-09-10</b> — 릴리스 14개 · <code>v2.42.0 … v2.54.0</code></summary>

<details>
<summary><b>v2.54.0</b> · 회귀를 병렬로 (`scripts/test.sh` 신설)</summary>

화면에 보이는 변화는 없다. 배포가 오래 걸린다는 지적을 **먼저 재어 보니 CI는 병목이 아니었다**: GitHub Actions 배포는 29~52초로 일정했고 늘어난 흔적이 없다. 실제로 늘어난 것은 로컬 회귀였고(약 24분), 릴리스마다 여러 번 돌리니 그게 대기 시간의 대부분이었다. 스위트끼리는 서로를 건드리지 않는다 — 각자 제 브라우저를 띄우고 같은 정적 서버를 **읽기만** 한다. 일꾼 넷으로 돌리고, 느린 것부터 넣어 일꾼이 놀지 않게 했다(순서는 짐작이 아니라 병렬로 재어 정했다 — 혼자 돌 때와 순위가 다르다). 빌드·서버·정리를 스스로 하고, 서버가 이미 떠 있으면 **같은 빌드를 주는지 확인하고** 빌려 쓴다(다르면 멈춘다 — 그러지 않으면 조용히 옛 화면을 검사한다). 가장 무거운 두 스위트(`shell` 450s · `fingerprint` 183s)는 안에서도 **두 화면 폭을 동시에** 돌게 했다 — 둘은 서로의 결과를 쓰지 않는데 차례로 돌고 있었다.

**실측 약 24분 → 298초(5분), 4.8배.** 일꾼을 늘리는 것만으로는 583초에서 멈췄다 — `shell.js` 하나가 450초면 전체는 그 밑으로 못 내려가기 때문이다. 병렬화는 가장 느린 하나를 줄여야 더 빨라진다. 패치노트(`RELEASE_VER`)는 올리지 않았다: 사용자에게 보일 변화가 없어 올려 봐야 빨간 점만 뜨고 볼 것이 없다(v2.49.1 과 같은 판단)

</details>

<details>
<summary><b>v2.53.0</b> · 알 부화를 얻는 곳까지 나눠 표시 (`components/gameday.js` `EGG_SOURCES`)</summary>

거리로만 여섯 칸을 만들던 것을 아홉 칸으로. 같은 거리라도 알을 어디서 얻었는지에 따라 나오는 종이 아예 다른데 한 칸에 섞여 있었다: 걸어서 깐 5km 는 실제 3종인데 어드벤처 싱크 전용 5종이 붙어 8종처럼 보였고, 10km 는 7종이 12종으로, 7km 는 친구 선물(7종)과 루트 선물(5종)이 한 칸이었다. 사용자가 겪은 "지금 나오는 애들과 다르다" 가 이것이다 — 목록이 틀린 게 아니라 남의 칸이 섞여 있었다. LeekDuck 원본 구획 9개와 종 단위로 전부 대조해 매핑을 확정했다(`isAdventureSync` → 싱크, 7km `isGiftExchange` → 루트 선물). 1km 가 맨 뒤에 서던 정렬도 숫자 기준으로 바로잡았다.

**좁은 화면 티어표를 목록으로 되돌림** (`components/pc-theme.css`) — 카드 규칙이 미디어 쿼리 밖에 있어 휴대폰까지 2열 카드로 덮었다. 1100px이상에서만 카드다.

**휴대폰 상세 팝업 88vh → 75vh** (`components/modal.css`) — 화면을 거의 다 덮으면 팝업이 아니라 새 화면으로 읽힌다

</details>

<details>
<summary><b>v2.52.0</b> · 길이 단위를 px 에서 rem 으로 (`styles/base.css` `html { font-size: 62.5% }` → 1rem = 10px)</summary>

브라우저에서 글자를 키우면 전에는 글자만 커지고 여백·버튼·카드는 그대로라 화면이 도리어 빽빽해졌다. 이제 함께 자란다. CSS 18개 파일 약 1,760곳.

**px 로 남긴 두 가지**: `@media` 조건(rem 이면 중단점이 사용자 글자 크기를 따라 움직여 레이아웃이 제멋대로 갈린다)과 1px 선(선은 굵기가 아니라 '있다/없다' 를 말한다). 값 보존은 22개 화면 25,322개 계산값 전후 대조로 확인했다 — 다른 값은 `<html>` 자신의 font-size 뿐.

**티어표 선정 근거를 아코디언으로** (`views/max.js`) — 카드마다 따로 토글해서 넷을 누르면 근거 넷이 쌓였고, 근거는 카드 뒤에 가로폭을 다 쓰고 붙으므로 어느 카드 것인지 짝지을 수 없었다. 동의 모달 `[동의하고 로그인]`은 가운데로 (`components/consent.css`) — 체크 두 줄 바로 밑에 왼쪽으로 붙어 있어 마지막 체크의 연장선처럼 보였다

</details>

<details>
<summary><b>v2.51.0</b> · 로그인 유도 팝업 (`components/auth.js` `openLoginInvite`)</summary>

잠긴 메뉴 줄·홈 타일·잠긴 화면의 로그인 버튼이 모두 이 팝업을 거친다. 전에는 ☰ 메뉴를 열어 계정 카드로 스크롤했는데, 메뉴에는 일정표·기준 안내·약관 같은 줄이 함께 있어 정작 할 일이 묻혔다 — 팝업은 화면 하나에 할 일 하나다.

**승인제를 누르기 전에 알린다** (로그인 → 승인 대기 → 사용, 세 단계): 그냥 로그인 버튼만 두면 로그인하고 나서 "왜 아직 안 되지" 를 다시 겪는다. 조사는 `koParticle`로 받침을 따른다

</details>

<details>
<summary><b>v2.50.0</b> · (버그) 설치형 앱이 옛 데이터를 계속 사용하고 있었다</summary>

알 부화 풀·레이드 보스는 매일 00시 빌드가 새로 받는데(`deploy.yml`), 홈 화면에 설치한 앱(PWA)은 한 번 띄우면 그대로 살아 있어 처음 받은 `data.js`를 며칠이고 계속 쓴다.

**서버는 최신인데 사용자만 옛것을 본다.** 서비스워커가 `data.js`를 네트워크 우선으로 받는 것과는 별개다 — 앱이 다시 받지 않으면 소용이 없다. 신설 `components/freshness.js`가 앱이 다시 보일 때 작은 표식 파일(`build.json`, 78B)을 캐시 없이 받아 견주고, 다르면 줄 하나로 알린다.

**자동 새로고침은 하지 않는다** — 보던 화면과 스크롤이 모두 사라진다. `data.js`(1.5MB)를 확인용으로 매번 받지 않으려고 표식 파일을 따로 낸다. `BUILD_VERSION` 전역을 빌드가 심는다(헤더의 `__VERSION__` 글자는 `app-shell.js`가 헤더를 갈아 끼우며 지운다). dev 미리보기도 매일 00:30 KST 에 다시 빌드한다

</details>

<details>
<summary><b>v2.49.1</b> · 버그 제보 링크를 명시했다</summary>

화면에 보이는 변화는 없다(주소는 이미 그 값이었다). 노션 정리 중 관리용 WBS 문서가 따로 생겼는데, 제보 링크가 그쪽으로 바뀌면 제보가 엉뚱한 곳으로 간다 — 쓰는 사람이 다르다(제보자는 외부, WBS 는 내부). `index.html`에 경고 주석, README 표에 단서, `tests/e2e/hardening.js`에 **정확히 이 주소인가** 단언을 넣었다. 사용자에게 보일 변화가 없어 패치노트(`RELEASE_VER`)는 올리지 않았다 — 올리면 새 소식 빨간 점만 뜨고 볼 것이 없다

</details>

<details>
<summary><b>v2.49.0</b> · (버그) 내 포켓몬 줄이 넓은 화면에서 세로로 늘어지던 문제</summary>

`planner.css`가 좁은 화면용으로 주는 `grid-column: 1 / -1`(CP·기술 묶음을 아래로 눕히려고)이 넓은 화면까지 따라와, 묶음마다 한 줄씩 차지해 카드가 400px 넘게 늘어졌다. 격자를 다시 쓰는 `pc-theme.css`에서 `grid-column: auto`로 되돌리고 그림 76→48px · CP 24→19px · 버튼 폭 고정으로 줄였다(카드 112px). 회귀 단언은 높이만 재지 않고 **번호 → CP → 기술 → 동작이 가로로 서는지**를 좌표로 본다.

**로그인 잠금 확대** — 배틀 PvP · 이벤트 일정 · 레이드 보스 · 알 부화 추가. 잠금 대상을 `ROUTES.locked` 표로 옮기고(`routeLocked`), 잠금 카드를 공용(`lockedCardNode`)으로 뺐다. 메뉴·사이드바·홈 타일은 `data-route`로 한 번에 갱신하고, 셸 탭에는 자물쇠를 단다. 대상은 육성 플래너 · 레이드 PvE · 배틀 PvP · 이벤트 일정 · 레이드 보스 · 알 부화 여섯이고, 도감 · 타입 & 상성 · D-MAX는 잠그지 않는다.

**(버그) 로그인이 끝난 뒤에도 잠금 화면이 남던 문제** — Firebase SDK 는 첫 렌더 뒤에 로드되므로 `#/raids` 같은 주소로 바로 들어오면 그 순간에는 비로그인이라 잠금 카드가 그려지고, 로그인이 끝나도 다시 그리지 않아 그대로 잠겨 있었다. `onAuthChange`가 현재 라우트가 `locked` 면 다시 그린다 (회귀 검사 `layout-toggle.js`가 이 버그를 먼저 잡았다)

</details>

<details>
<summary><b>v2.48.0</b> · (긴급) PWA로그인 복구</summary>

홈 화면에 설치한 앱(`display-mode: standalone`)만 `signInWithRedirect`로 갈랐는데, `authDomain`(`pogo-note.firebaseapp.com`)이 앱(`minsangkwak.github.io`)과 다른 출처라 리다이렉트가 자격을 들고 돌아오지 못한다 — 자격은 authDomain 쪽에 저장되고, 앱은 그 출처의 iframe 으로 읽어야 하는데 브라우저가 사이트 간 저장소를 갈라 두면 `getRedirectResult()`가 **오류 없이 null** 을 준다. 설치형 앱은 브라우저와 저장소를 따로 쓰는 경우도 있어 더 자주 깨진다. 이제 **팝업을 먼저 쓰고**(창 사이 postMessage 라 그 저장소를 안 탄다) 팝업이 막힐 때만 리다이렉트로 넘긴다. 리다이렉트로 나갈 때 표시를 남겨(`pogo_auth_redirect`) 빈손으로 돌아오면 이유를 말한다(`AUTH.redirectMsg` — 한 번짜리 문구는 뒤따르는 `onAuthStateChanged` 다시 그리기에 지워져 상태로 뒀다)

</details>

<details>
<summary><b>v2.47.0</b> · 내 포켓몬 · 육성 플래너 통합 + 화면 재구성 (목업 반영)</summary>

메뉴·홈 타일에서 두 항목을 하나(🌱 육성 플래너)로 합쳤다. 둘은 같은 화면의 두 탭인데 문이 둘이라 매번 어느 쪽을 눌러야 하는지가 질문이 됐다. `planner-collection` 라우트와 기존 주소(`#/plan/collection`)는 그대로 살려 둔다.

**육성 현황**(`planner/home.js`) — 히어로 · 요약(상태별 수치 세 칸 + 바로가기) · 다섯 걸음 · 최근 넷. 다섯 걸음은 **지금 되는 것만** 적는다(목업의 '자원 계산기 · 기술 세팅' 은 아직 없어 로드맵 줄에 남긴다).

**내 포켓몬**(`planMonCard`) — 순번 배지 · 발광 그림 · 이름/배지 · 타입 알약 · Lv + 개체값 막대 · 큰 CP · 주요 기술 두 줄 · 동작. 좁은 화면은 묶음을 아래로 눕힌다(감추지 않는다 — CP·기술은 이전에도 보이던 값).

**비교 창** — 표 위 카드 두 장(좌 브랜드 · 우 포인트) + 표 아래 결론 한 줄(`planCompareVerdict`). 섀도우가 한쪽만이면 승자를 정하지 않는다 — CP 에 안 잡히는 배틀 보정이 있어 그 판정은 틀린 말이 된다.

**개체 추가 창**은 헤더 검색과 같은 줄(`monSuggestRow`)을 쓴다.

**로그인 잠금** — 개체를 계정에 저장하는 화면이라 `AUTH.status !== 'ok'` 면 메뉴·홈 타일에 자물쇠가 붙고 화면 자체가 잠긴다(`planLocked` · `renderPlanLocked`). 로그인 기능이 꺼진 빌드에서는 잠그지 않는다(열 방법이 없는 잠금은 영구 차단이다).

**(버그) 비교를 눌렀는데 아무 일도 안 일어나던 문제** — 다른 종을 고르면 조용히 새로 시작하고, 안내문은 목록 **아래**(문서 3,000px 지점)에 그려 화면 밖이었다. 안내를 목록 위로 올리고, 왜 짝이 풀렸는지 말하고, 짝이 될 수 없는 줄의 [비교] 는 흐리게 둔다. 조사도 받침을 따르게 고쳤다(`koParticle`).

**화면 테마**(신설 `components/theme.js`) — 세 상태(기기 설정 · 밝게 · 어둡게)를 도는 버튼. 넓은 화면은 헤더, 좁은 화면은 ☰ 메뉴 줄(헤더에 버튼을 하나 더 넣었더니 로고가 잘렸다). `localStorage pogo_theme` + 로그인 사용자는 `users/{uid}.theme`에도 저장해 기기 간 동기화. 저장한 값은 `index.html` `<head>` 인라인 스크립트가 번들보다 **먼저** 붙인다(첫 화면 깜빡임 방지)

</details>

<details>
<summary><b>v2.46.0</b> · 도감 화면 재구성 (플래너·내 포켓몬 목업 반영, 1100px~ 전용 — 휴대폰 배치 불변)</summary>

**검색 결과 줄**(`components/search.js`)이 이름 한 줄에서 카드 한 장으로: 그림 판 + 이름 + 타입 알약 + 도감번호(`.dex__type`·`.dex__no`를 도감에서 그대로 빌린다) + 화살표.

**도감 줄/카드에 읽을 값**(`dexRowStats`) — 세대와 CP 100% 기준을 이미 가진 데이터로 계산해 넣는다(도감번호 구간 · 게임마스터 CPM). 줄 모드는 두 칸, 카드 모드는 CP 만.

**상세 팝업 머리** — 그림을 116px 발광 원판 위로, 이름 26px, 도감번호를 알약 배지로(타입 배지는 판 왼쪽 위 그대로 — `tests/e2e/detail.js`가 그 자리를 지킨다). 도감 화면 머리에도 장식 띠(브랜드 초록)

</details>

<details>
<summary><b>v2.45.0</b> · 도감 카드를 티어표 카드 문법으로 (1100px~ 전용 — 휴대폰 배치 불변)</summary>

`.dex__row`는 도감만의 것이 아니라 ★ 즐겨찾기·⚔️ 레이드 보스·🥚 알 부화가 함께 쓰는 조각이라 네 화면이 같이 바뀐다. 번호를 왼쪽 위 알약 배지로(티어표 순위 배지와 같은 자리·테두리), 그림을 빛나는 원형 판 위로, 이름을 `--fs-lead` 굵게, ★ 를 동그란 버튼으로. 줄 모드는 44px 그림이라 발광 대신 동그란 판만 잇는다.

**(버그)** v2.43.0 티어표의 발광 판은 실제로는 한 번도 안 나왔다 — `list.css`/`pages.css`의 `background: var(--bg)` **단축 속성**이 `background-image`를 지우는데 `:not(.is-loading)` 때문에 특정도까지 높았다. 같은 선택자로 받아 `background-image`·`background-color`를 따로 적는다

</details>

<details>
<summary><b>v2.44.0</b> · 로그인 복구 (CSP 회귀)</summary>

v2.27.0 에서 CSP `script-src`에 `https://apis.google.com`을 빠뜨려 Google로그인이 완전히 차단돼 있었다. `firebase-auth-compat`는 팝업·리다이렉트 어느 쪽이든 그 주소의 `api.js`를 먼저 받아 인증 iframe 을 띄우는데, CSP가 거부하면 SDK 의 `loadJS` `onerror`가 `auth/internal-error`로 올라온다(v2.39.0 재시도·v2.39.1 리다이렉트가 못 고친 이유). `img-src`의 `googleusercontent.com` 누락도 같은 종류 — 계정 카드·가입 승인의 프로필 사진이 막혀 있었다. 조용히 버리던 실패 둘을 드러낸다(리다이렉트 결과 오류, 가입 요청 저장 실패). `tests/e2e/hardening.js`는 이제 **우리가 쓰는 출처가 지나가는지도** 센다 — 조이는 쪽만 재던 검사는 이 회귀를 전부 통과시켰다

</details>

<details>
<summary><b>v2.43.0</b> · 티어표 카드 개편 (D-MAX 목업 반영 — 티어 머리글·랭킹 카드·선정 근거는 D-MAX·PvE·PvP 공용 조각이라 네 화면이 함께 바뀐다)</summary>

티어 머리글에 이름·한 줄 설명(`views/tier.js` `TIER_DESC`)과 의미 토큰 뱃지 색(S 포인트·A 주의·B 브랜드·C 비활성). 랭킹 카드는 동그란 순위 배지(티어 1위만 브랜드색)·빛나는 그림 판·26px 점수·"활용 N곳" 알약. 선정 근거를 두 칸(계산식 / 얘가 보스라면 데려갈 딜러)으로 나누고, 넓은 화면에서는 `order`로 그 티어의 카드가 다 놓인 뒤에 붙인다(그 자리에 두면 줄이 끊겨 뒤 카드가 밀렸다)

</details>

<details>
<summary><b>v2.42.0</b> · 넓은 화면 디자인 시스템 개편 (목업 반영, 1100px~ 전용 — 휴대폰 배치 불변)</summary>

`tokens.css`를 목업 팔레트로 교체(브랜드 초록 + 의미 색 다섯 + 글자/반경 토큰), 화면에 흩어져 있던 하드코딩 색 6종을 뜻에 맞는 토큰으로 통합. 모든 개편 규칙은 신설 `styles/components/pc-theme.css`의 `@media (min-width:1100px)` 안에만 둔다.

**상단 검색 칸**(입력처럼 생긴 버튼 + `/` 단축키), **화면 머리**(브레드크럼·32px 제목·한 줄 설명, 설명은 `router.js` `ROUTE_DESC` 한 곳), **홈**(히어로 배너 + 5열 타일 + 카드형 푸터), **도감**(줄→카드 줄, 타입을 이름 알약으로, 거르기+보기방식 한 줄), **상세**(약점·내성 카드 분리), **UI 목록**(번호 카드 격자 + 사이드바 노출, dev 전용)

</details>

</details>

<details>
<summary><b>2026-09-09</b> — 릴리스 12개 · <code>v2.32.0 … v2.41.0</code></summary>

<details>
<summary><b>v2.41.0</b> · UI 목록 화면</summary>

`#/styleguide`에 색 토큰·글자·버튼·고르기·태그·목록·카드·메뉴·팝업을 늘어놓는다(9구역 37칸, `components/styleguide.js`). 스토리북 대신 **실제 CSS·실제 함수를 그대로 부르는** 방식이라 보이는 모양이 곧 실제 화면의 모양이고, 의존성이 0이다. `BUILD_CHANNEL=dev` 일 때만 `STYLES`/`SCRIPTS`에 들어가고 라우트·페이지 등록도 그 파일이 스스로 해서 **실서비스 번들에는 주소조차 없다**. `tests/e2e/styleguide.js`가 채널을 갈라 양방향(dev 15항목 / 실서비스 4항목)을 검사

</details>

<details>
<summary><b>v2.40.1</b> · 수정: 폭을 오갔다 돌아오면 ☰ 메뉴에서 기준 안내·트레이너 코드가 사라지던 회귀</summary>

v2.40.0 이 정보 항목을 카드(`infoGroup`)로 묶은 뒤, 넓은 화면으로 돌아갈 때 카드를 `remove()` 하면서 안에 담긴 아코디언까지 문서에서 빠졌다(`#drawer-extra`는 먼저 사이드바로 옮겨져 살아남음). 들어내기 전에 제자리로 먼저 꺼내도록 수정. 첫 로딩으로는 안 드러나고 **좁은 화면을 한 번 거쳐야** 나오는 종류 — `tests/e2e/shell.js`에 폭 왕복 회귀 13항목 추가(70항목). 함께 돌린 감사: 15화면 × 7폭 가로 넘침·콘솔 오류 없음(112항목), 리사이즈·로그아웃·다크·저장 격리(42항목)

</details>

<details>
<summary><b>v2.40.0</b> · ☰ 메뉴 카드형 재구성</summary>

항목마다 따로 있던 테두리를 걷고 성격이 같은 것끼리 카드 한 장에 담는다(구역 제목 👤 마이페이지·서비스·정보는 좁은 화면에서만). 줄 하나 = `[아이콘] 이름 [›]`, 아이콘은 서비스 홈 타일과 같은 그림이라 표를 `router.js` ROUTES `icon` 한 곳으로 옮기고 `home.js`가 그 표를 읽는다. 이모지는 `.drawer__ico` span 으로 떼어 번역 사전 키를 이름만으로 맞췄다.

**보기 방식 세그먼트 컨트롤** — 누르면 뜻이 뒤집히던 버튼 하나를 `[☰ 리스트 \| ⊞ 그리드]` 두 칸으로(`components/ui.js` `layoutToggle`, `.seg-view`), 고른 칸만 강조색. 도감·즐겨찾기에서는 필터 칩 줄에서 떼어 자기 줄로.

**불변**: localStorage 키·값과 `.dex__layout` 클래스 그대로

</details>

<details>
<summary><b>v2.39.1</b> · 재로그인 실패 재수정</summary>

v2.39.0 은 로그아웃 뒤 재로그인이 `auth/internal-error`로 실패하는 걸 "타이밍 문제"로 보고 잠깐 쉰 뒤 같은 팝업으로 재시도했는데, dev 배포로 실제 확인해 보니 재시도도 매번 똑같이 실패했다 — 팝업 창과의 통신 자체가 막힌 경우였다. 팝업이 막힌 경우(`popup-blocked`)와 같은 처방으로 리다이렉트로 전환, 그마저 실패하면 오류를 그대로 안내한다(`components/auth.js`, `tests/e2e/auth-retry.js` 6항목을 재시도 확인 → 리다이렉트 전환 확인으로 다시 씀)

</details>

<details>
<summary><b>v2.39.0</b> · 카드 그리드 열 자동 조절</summary>

D-MAX·레이드·PvE·PvP·레이드 보스·알 부화의 카드 그리드가 고정 열 수 대신 `grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))`를 쓴다(`styles/components/pages.css`, `list.css`). 태블릿 3열·PC 4열, 상세 패널이 열려 좁아지면 1~2열로 자연히 준다.

**그리드·리스트 토글 버튼 재배치** — 안내 문구와 같은 줄, 오른쪽 끝으로(`components/gameday.js` `.gameday__intro`).

**수정**: 로그아웃 직후 곧바로 로그인하면 `auth/internal-error`로 실패하던 문제 — Firebase Auth SDK 의 로그아웃 정리가 끝나기 전에 팝업이 뜨는 경쟁 상태. 이 오류를 받으면 잠깐 쉬고 한 번 더 시도, 그래도 실패하면 새로고침을 안내(`components/auth.js`, `tests/e2e/auth-retry.js` 신규 6항목)

</details>

<details>
<summary><b>v2.38.0</b> · 태블릿(1100px~)·PC(1440px~) 2단계 레이아웃</summary>

`styles/components/app-shell.css`가 `--shell-half`·`--panel-w`·`--panel-gap` 세 CSS 변수를 두고, `@media (min-width:1440px)` 블록이 값만 다시 정의하면 `@media (min-width:1100px)` 블록의 계산식이 전부 새 값으로 재계산된다(규칙 중복 없음). 태블릿 550/420/24, PC 720/480/32. `dom.js` `wideCards()`·`app-shell.js` `wideScreen`·`modal.js` `useDetailPanel()` 임계값도 1024→1100 통일.

**수정**: 상세 패널이 목록에 거의 붙어 보이던 버그 — `padding-right` 계산이 패널 `right` 공식의 내재된 20px 안쪽 여백(사이드바와 거울 대칭이라 생기는 값)을 빼먹어 실제 간격이 4px 였다. `padding-right: panel-w + gap + 20px`로 수정, 실측 24/32px 확인(`tests/e2e/breakpoints.js` 27항목)

</details>

<details>
<summary><b>v2.37.0</b> · 봇 트래픽 집계 제외</summary>

`track.js` `IS_BOT_LIKE`(`navigator.webdriver` · 화면 정확히 800×600 · UA 의 headless/bot 등 키워드, OR 조건)가 참이면 `track()`·`setTrackingUser()`가 gtag 를 안 부른다. Firestore 쓰기(즐겨찾기·내 포켓몬 등 실 기능 데이터)는 건드리지 않았다 — "차단이 아니라 집계만 제외" 원칙과, 이 저장소의 e2e 스위트 자체가 Playwright(항상 `navigator.webdriver=true`)로 도는 점을 함께 고려한 화면단.

**그리드 토글 확장** — 도감의 그리드↔리스트 토글(`components/ui.js` `layoutInitial`/`layoutToggle`)을 즐겨찾기·레이드 보스·알 부화로 확장, 화면마다 저장 키를 따로 둔다.

**PC 메뉴 재구성** — `index.html` `#drawer-extra`를 PC에서는 사이드바로 이동(`app-shell.js` `placeDrawerExtra`), ☰ 메뉴엔 마이페이지·기준 안내·트레이너 코드만. PC는 `.app-bar__head .icon-btn`로 뒤로가기 숨김. `.detail-panel__body` 패딩 확장(4px 20px 20px → 14px 30px 30px, 폭 400→420)

</details>

<details>
<summary><b>v2.36.0</b> · PC 오른쪽 상세 패널</summary>

넓은 화면(1024px~)에서 상세를 `openModal()` 대신 `openDetailPanel()`(`components/modal.js`)로 연다. 패널(`#detail-panel`)은 `index.html` 정적 마크업(딥링크 첫 렌더가 스크립트보다 먼저 이 조각을 찾을 수 있어서), 위치는 왼쪽 사이드바(`.app-nav`)와 같은 530px 반폭 상수로 거울 대칭(`right: max(20px, calc(50vw - 530px))`). 열려 있을 때만 `body.has-detail-panel`로 본문(`#page`)에 `padding-right`를 줘 자리를 낸다 — 컨테이너 폭은 그대로라 카드 격자(`1fr` 기반)가 넘치지 않고 좁아지기만 한다. 다른 화면으로 이동하면(hashchange) 자동으로 닫힘. 좁은 화면은 지금까지처럼 팝업

</details>

<details>
<summary><b>v2.35.0</b> · 상세 팝업 타입 배지·아이콘 줄 재배치</summary>

타입 알약을 이름 줄에서 그림(`.sprite-box`) 왼쪽 위 모서리에 겹치는 배지(`.detail__types`, `position:absolute`)로. ★ 즐겨찾기를 `favBtn()` 그대로 재사용해 공유·저장과 같은 `.detail__top-actions` 줄로(스코프 선택자 `.detail__top-actions .fav`로 원 모양 덧입힘). 폼 라벨(`splitFormName().labels`)을 이름과의 결합(`nameNode()`)에서 떼어 `.detail__form-row`로 이름 위 자기 줄에, 영문명(`.detail__en-inline`)도 괄호 인라인 대신 자기 줄로

</details>

<details>
<summary><b>v2.34.0</b> · ✕ 닫기를 카드 밖으로</summary>

`.modal__close`를 카드(`.modal__box`) 안이 아니라 그 부모 `.modal__wrap`의 절대 위치로 옮겨 카드 오른쪽 위 모서리 바깥에 띄운다. 카드 안 배치와 영영 겹칠 일이 없어 v2.33.0 의 자리 예약 트릭(`.modal__bar`)이 필요 없어졌다. 배경 어둡기 `.45`→`.64`.

**CP 카드를 아코디언으로** — `.detail__cp-card`를 `<details>`로 바꿔 큰 숫자(summary)는 항상 보이고 2×2 표만 접힌다(기본 닫힘)

</details>

- **v2.33.0** · 수정: 상세 팝업 ✕ 닫기(`.modal__close`)가 sticky 바에서 `height:0` + `transform`으로 떠 있어, v2.32.0 에서 새로 생긴 공유·저장 아이콘(`.detail__top-actions`)과 우상단 자리를 다투다 겹쳐 눌리지 않던 문제 — `.modal__bar`가 padding 으로 실제 높이를 갖게 해 아래 내용을 자연스레 밀어내도록 수정, 헤더 위 여백도 함께 늘림

<details>
<summary><b>v2.32.0</b> · 상세 팝업 헤더 카드형 재배치</summary>

`#도감번호`·이름+★·타입을 `.detail__info`로, 공유·저장은 오른쪽 위 동그란 아이콘 두 개(`.detail__top-actions`)로. CP 는 문장(`.detail__cpline`) 대신 큰 숫자 + 2×2 표 카드(`.detail__cp-card`). 포획 CP·CP 계산기 아코디언은 누르면 열리는 행 모양(오른쪽 꺾쇠)으로. 그림 상자에 옅은 동심원 배경 추가

</details>


</details>

<details>
<summary><b>2026-09-08</b> — 릴리스 14개 · <code>v2.20.0 … v2.31.0</code></summary>

<details>
<summary><b>v2.31.0</b> · 수정: 레이드 보스 목록에서 이름·조건 문구가 같은 행의 공간을 차지해 짧은 이름도 중간에서 줄바꿈되던 문제 — `gamedayRow`(gameday.js)가 이름·문구를 `.gameday__main`으로 세로 방향으로 묶음. 포켓몬 그림 테두리 통일</summary>

목록 줄 모드(`.dex__row .sprite`)·진화 단계(`.evo__mon`)·추천 딜러 카드(`.boss__rec`)에 그리드 모드와 같은 상자(테두리+`--surface` 배경)를 적용, 진화 전 단계도 테두리가 생겨 현재 단계와 나란히 비교 가능

</details>

<details>
<summary><b>v2.30.0</b> · 주소 = 메뉴 구조</summary>

라우트 표를 `frontend/scripts/router.js` 한 곳으로 (네 파일이 각자 정규식으로 읽던 것을 통합). `#/rank/pve`→`#/pve` · `#/rank/max`→`#/dmax` · `#/plan`→`#/planner`, 기존 주소는 `replace`로 자동 이전.

**모바일도 화면별 헤더**(상단 바는 로고, 로고 클릭 → 홈). 화면·상세에 측정용 식별자(`data-route`·`#page-<id>`·`#detail-<sprite>`). 재사용 조각 `components/ui.js`(`uchip`·`iconBtn`·`pageBody`·`footNote`·`hintNote`)

</details>

<details>
<summary><b>v2.29.2</b> · 도감 보기 전환 버튼 라벨을 열 개수(`1열`·`2열`)에서 보기 방식(`⊞ 그리드`·`☰ 리스트`)으로</summary>

열 개수는 폭에 따라 2·3·4열로 달라져 라벨이 화면과 어긋났다. 저장 키 `pogo_dex_cols`와 값은 불변

</details>

- **v2.29.1** · 수정: PC 카드 규칙(`.row__*`)이 스코프 없이 적혀 같은 클래스를 빌려 쓰는 플래너 목록(`.plan__mon-main`)까지 깨뜨림 → `.row-list > .row`로 스코프. 영어 화면의 일정표에 한국 서버(KST) 기준 명시. 헤더 👤 제거 후 남아 있던 로그인 안내 문구 정리

<details>
<summary><b>v2.29.0</b> · 다국어(KR/EN)</summary>

원문(한국어)을 키로 쓰는 사전(`i18n-en.js`) + 그려진 DOM을 훑는 엔진(`i18n.js`). 이름은 사전이 아니라 데이터가 맡는다(`dex_build.py` en·moveKo·formKo, `build.py` TYPE_EN). 패치노트·일정표·법률 문서는 한국어 유지 + 영문 안내. 헤더 👤 제거 → ☰ 메뉴 "마이페이지", 그 자리에 KR/EN 토글

</details>

<details>
<summary><b>v2.28.0</b> · PC 카드 뷰</summary>

랭킹 목록(`.row-list`)은 CSS 미디어 쿼리 한 곳으로, 도감·즐겨찾기·레이드 보스·알 부화는 `wideCards()`(dom.js)로 1024px이상에서 카드 격자(그림 칸·글 칸 구분선 포함). 모바일 불변.

**수정**: 타입 & 상성 결과가 안 나오던 버그(`matchupBucket`이 묶음 키 대신 CSS 클래스 반환)

</details>

- **v2.27.0** · 보안 강화(CSP·referrer·외부 스크립트 출처 검사·Firestore 쓰기 한도), 공유 카드 OG(도트 이미지 직접 생성), 검색 최적화(sitemap·JSON-LD·robots 대역폭 절약), security.txt·404
- **v2.26.0** · PC 스크롤 버그 수정(`overflow-x: auto`가 세로축까지 스크롤 컨테이너로 만들어 탭 줄이 휠을 가로챔), PC 상단 바=로고 + 화면별 헤더 분리, 도감 2열 카드형, 버튼 반응 애니메이션
- **v2.25.0** · ⚔️ 레이드 보스 · 🥚 알 부화 화면 신설(LeekDuck 자동 수집), 🎒 내 포켓몬 유사백 판정, e2e 회귀 스위트를 `tests/e2e/`로 커밋

<details>
<summary><b>v2.24.0</b> · CSS 클래스 이름 BEM 통일</summary>

`block__element--modifier`, 최대 3단어. 화면·기능 변화 없는 순수 리팩토링

</details>

<details>
<summary><b>v2.23.0</b> · PC 레이아웃</summary>

1024px~ 왼쪽 고정 사이드바 + 본문 1100px, 홈 타일 4열. 좁은 화면은 기존 배치 유지

</details>

<details>
<summary><b>v2.22.0</b> · 디자인 통일</summary>

`app-shell.css`의 토큰·글꼴·크기 덮어쓰기 제거(무채색 팔레트·Montserrat 복구), 서비스 홈 타일 정의 일원화, 아이콘 언어 이모지로 통일, D-MAX·PvE·PvP 탭 줄 복구(`#/rank/…` 주소 유지), 상세 팝업 카드/바텀시트 복귀, 손가락 대상 44px(`--tap`)

</details>

<details>
<summary><b>v2.21.0</b> · PWA 앱 셸</summary>

모든 화면에 고정 상단 바, 네이티브 `<dialog>`(포커스·Esc), 건너뛰기 링크, 화면 확대 허용

</details>

- **v2.20.0** · 서비스 홈 신설(기능 카드 8개) + 랭킹 주소 `#/rank/max·pve·pvp`

</details>

<details>
<summary><b>2026-09-07</b> — 릴리스 6개 · <code>v2.13.0 … v2.18.0</code></summary>

<details>
<summary><b>v2.18.0</b> · 공개 준비 Phase 0</summary>

LICENSE(MIT)·NOTICE·CONTRIBUTING(DCO)·SECURITY 신설, 개인정보처리방침 개정(처리위탁·국외이전·보유기간·14세·보호책임자), 📜 이용약관(`#/terms`) + 첫 로그인 동의 팝업, 🍪 통계(GA) 동의 배너(동의 전 gtag 미삽입)·캐시 비우기, 계정 삭제 셀프서비스(`firestore.rules` 본인 delete 허용 — 콘솔 재게시 필요), IP 고지문 상시 노출

</details>

<details>
<summary><b>v2.17.0</b> · 서비스명 POGO PLAN(포고플랜) 확정</summary>

화면 제목·헤더·스플래시·manifest("POGO NOTE" 잔재 정리)·문서 표기 교체, sw 캐시 접두사 `pogoplan-v4`. 저장소명·URL·localStorage 키·GA이벤트명은 불변

</details>

<details>
<summary><b>v2.16.0</b> · IF·활용처 탭 해체</summary>

솔플 계산기는 PvE 탭 🧮 버튼, PvP 덱 짜기는 PvP 탭 🃏 버튼(리그 공유), 활용처는 검색 패널(빈 상태 순위 + 활용 N곳 뱃지). 탭은 D-MAX·PvE·PvP 셋

</details>

<details>
<summary><b>v2.15.0</b> · 🌱 플래너 모드 MVP (QA-53·54)</summary>

헤더 배지로 도감 ↔ 플래너 전환(`#/plan/*`, 마지막 모드 기억), 🎒 내 포켓몬 개체 단위 저장·수정·삭제(Firestore `users/{uid}.mons`)·CP로 레벨 추정·같은 종 2개체 비교(만렙·리그 도달 CP), 상세 팝업 ➕ 내 개체로 저장

</details>

<details>
<summary><b>v2.14.0</b> · QA-52 묶음</summary>

D-MAX 탭 [전체 \| 딜러 \| 탱커] + 속성 칩 하위 메뉴, ★ 즐겨찾기 카드 아코디언(펼침 기억), 웹폰트 Montserrat + Pretendard, 스프라이트 스켈레톤, 상성 검색 화면 줄바꿈·간격 정리

</details>

<details>
<summary><b>v2.13.0</b> · QA-49·50·20 + 백로그 42·43</summary>

상세 팝업 카운터를 맥스 배틀/레이드로 분기(참전 풀 구분), 미출시 리전 폼 9건 제거(`in_release_set` 엄격 매칭), 일정표 다중 월 구조 + 10월 확정분, 순위표 "활용 N곳" 뱃지, D-MAX [딜러 \| 탱커] 세그먼트 + 보스 파티 카드

</details>


</details>

<details>
<summary><b>2026-09-06</b> — 릴리스 4개 · <code>v2.9.0 … v2.12.0</code></summary>

<details>
<summary><b>v2.12.0</b> · 전역 검색 = 이름 + 타입</summary>

검색창 아래 타입 칩(최대 2), 타입 이름 텍스트 인식("물 풀"), 이름과 교집합, 상성 검색으로 연결

</details>

- **v2.11.0** · 뒤로가기가 팝업·드로어를 닫도록 히스토리 연동(`components/history.js`), 로고 = 홈 버튼, 메가/맥스/섀도우 폼 색 토큰(뱃지·상세 그림 테두리)

<details>
<summary><b>v2.10.0</b> · QA-44 묶음</summary>

🧭 상성 검색 페이지(`#/types`), 이중약점 표시, 폼 라벨 뱃지, 다이맥스/거다이맥스 이름 분리, 스프라이트 수집 범위 확장(메가 샤크니아 등 45장)

</details>

<details>
<summary><b>v2.9.0</b> · GA 데이터 기반 개선</summary>

마지막 보기 기억, 상세 딥링크·공유(`#/mon/id`), 탭 줄 도감·즐겨찾기 바로가기, 검색 순위 근거, 즐겨찾기로 덱 채우기, 계측 보강

</details>


</details>

<details>
<summary><b>2026-09-05</b> — 릴리스 6개 · <code>v2.7.0 … v2.8.0</code></summary>

<details>
<summary><b>v2.8.0</b> · 저장소 공개 전환</summary>

운영 식별자를 `.env`/Actions variables로 분리, 규칙 파일 자리표시자, 개인 이름 일반화, 히스토리 치환

</details>

- **v2.7.4** · 배포 검증 스크립트 `scripts/verify_deploy.sh` (채널·버전·스프라이트·PWA 파일 점검)

<details>
<summary><b>v2.7.3</b> · 브랜치 전략 개편</summary>

`dev`(미리보기 pogo-rank-dev) → `main`(통합) → `deploy`(실서비스). dev 빌드는 `-dev` 배지·GA 끔·noindex

</details>

- **v2.7.2** · 아머드 뮤츠 전용 그림 (포켓몬 GO 게임 에셋에서 자동 다운로드, 실패 시 원본 복사 폴백)

<details>
<summary><b>v2.7.1</b> · 로컬 테스트용 로그인 목 모드 (`localhost/?mock=1`)</summary>

Google 팝업 없이 로그인 뒤 화면 확인

</details>

- **v2.7.0** · ★ 즐겨찾기 전용 페이지(PvE/PvP/기타 그룹 + 근거 순위), 역할 수동 보정, 아머드 뮤츠 지원(폼 인식·스프라이트 분리)

</details>

<details>
<summary><b>2026-09-04</b> — 릴리스 1개 · <code>v2.4.0</code></summary>

- **v2.4.0** · 레이드 보상·야생 스폰 CP 분리 표시, 메가/원시 진화 폼 상시 노출, 메가X/Y 비교표, 문서 2체계 재편(개발/운영)

</details>

<details>
<summary><b>2026-09-03</b> — 릴리스 4개 · <code>v2.0.0 … v2.3.0</code></summary>

- **v2.3.0** · 첫 화면 로딩 표시, 트레이너 코드 비공개(Firestore 이전·비로그인 숨김), 관리자 판정 이메일 → uid
- **v2.2.0** · 🔐 Google로그인 + 관리자 승인제 + 계정 즐겨찾기 ★ (Firebase Auth/Firestore, 서버 없음)
- **v2.1.0** · IF 탭 실험실 개편(PvP 추천 덱 3종·커스텀 덱), 헤더 단순화, GA4 사용 통계

<details>
<summary><b>v2.0.0</b> · 성능 개편</summary>

산출물 분리(HTML + data.js + 개별 스프라이트), CI 캐시

</details>


</details>

## 빠른 시작

Python 3.10 이상과 curl이 필요합니다. 별도의 pip 패키지 설치나 가상 환경 설정은 필요하지 않습니다.

```bash
# 원본 데이터를 내려받고 전체 프로젝트를 빌드합니다.
bash scripts/build.sh

# 정적 결과물을 별도 서버 없이 실행합니다.
open dist/index.html
```

화면 코드만 수정했다면 `python3 backend/build.py`만 실행해도 됩니다. 변경 범위별 빌드 방법은 [개발 문서](docs/DEVELOPMENT.md#8-저장소-구조와-로컬-실행)를 참고하세요.

## 데이터 출처

다음 공개 자료를 사용합니다.

- **PvPoke:** 랭킹 및 출시 여부
- **PokeMiners:** 게임 마스터 데이터
- **PokeAPI:** 한국어 이름 및 스프라이트
- **hawaii 성능표:** PvE 성능 데이터
- **LeekDuck ScrapedDuck:** 게임 일정
- **Bulbapedia:** 다이맥스 출시 목록

출처별 세부 데이터와 병합 방식은 [개발 문서](docs/DEVELOPMENT.md#3-데이터-소스)에서 확인할 수 있습니다.

## 라이선스

소스 코드는 MIT 라이선스로 제공하지만, 데이터와 이미지에는 원출처의 이용 조건이 적용됩니다. 자세한 범위와 조건은 [NOTICE.md](NOTICE.md)를 확인하세요.

| 경로 | 적용 조건 |
| --- | --- |
| `backend/` · `frontend/` · `scripts/` · `docs/` · `.github/` | MIT ([LICENSE](LICENSE)) |
| `snapshot/` · `data/`(빌드 결과물) · 스프라이트 | 각 원출처의 조건 적용 — PvPoke(MIT), PokeMiners, PokeAPI, ScrapedDuck(MIT), 커뮤니티 시트 |

프로젝트에 기여하려면 DCO 서명이 포함된 커밋(`git commit -s`)을 제출해야 합니다. 자세한 절차는 [CONTRIBUTING.md](CONTRIBUTING.md)를 확인하세요. 보안 취약점은 [SECURITY.md](SECURITY.md)의 절차에 따라 제보해 주세요.

## 고지

moncamp는 포켓몬고 초보 트레이너를 위해 만든 비영리·비공식 팬 프로젝트입니다.

Pokémon과 관련 명칭·이미지의 권리는 The Pokémon Company, Nintendo, Creatures Inc., GAME FREAK inc.에 있습니다. Pokémon GO의 권리는 Scopely Explore, Inc.에 있으며, moncamp는 해당 권리자들과 관련이 없습니다. 데이터는 PvPoke, PokeMiners, PokeAPI, LeekDuck의 공개 자료를 사용합니다. 권리자의 삭제 요청은 접수 후 72시간 이내에 처리합니다([NOTICE.md](NOTICE.md) 5장).

문의와 제안은 사이트 푸터의 이메일 링크로 보내 주세요. 이메일 주소는 빌드 설정의 `CONTACT_EMAIL`에서 관리합니다.
