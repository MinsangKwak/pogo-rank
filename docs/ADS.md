# 광고 도입 절차 (Google AdSense)

[프로젝트 소개](../README.md) · [운영 가이드](OPERATIONS.md) · [인프라](INFRA.md) · [작업 지침](../.claude/CLAUDE.md)

**결론 — 코드의 자리는 잡혀 있고, 실제 광고를 붙이기 전에 사람이 해야 하는 일이 넷입니다.** ① 약관 · 개인정보처리방침 개정과 7일 전 고지, ② AdSense 계정 · 사이트 심사, ③ 승인 뒤 스크립트 · 슬롯 ID 붙이기, ④ 운영 반영과 사후 확인. 아래는 그 순서대로입니다.

## 0. 지금 상태 (2026-10-14, dev 까지)

| 항목 | 지금 |
| --- | --- |
| 자리 | 넓은 화면(1400px 이상 · 높이 800px 이상 — 띠 바닥과 '맨 위로' 단추가 겹치지 않는 높이) 본문 **양옆 세로 띠 160×600** 둘, 휴대폰(999px 이하) **바닥 띠 320×50** 하나. 그 사이(1000 ~ 1399px)는 자리가 없다 — 띠 둘과 본문이 같이 설 폭이 안 된다 |
| 누구에게 | **첫 로그인 확인이 끝난 뒤 로그인 전(anon)인 사람에게만.** 확인 중 · 승인 대기 · 승인됨은 모두 '로그인한 사람' 으로 보고 자리 자체를 안 만든다. 로그인 직후 첫 화면처럼 자취 없이 anon 으로 시작하는 경우도 확인이 끝날 때까지 안 만든다 (`web/src/lib/ads.ts` `adsVisible`) |
| 모드 | 빌드 때 박히는 `NEXT_PUBLIC_ADS` — 운영 `web/.env.production` 은 `off`, dev 는 `dev-pipeline.yml` 이 `placeholder` 로 덮는다. 모르는 값은 `off` 로 읽는다 |
| 본문 | `html[data-ads="on"]` 일 때만 넓은 화면의 본문 폭이 띠만큼 줄고(머리줄 끝도 같이), 휴대폰은 바닥에 띠 높이만큼 여백이 생기고 '맨 위로' 단추가 올라간다. 첫 그림 전에 `app/layout.tsx` 의 인라인 스크립트가 로그인 자취(`pogo_signed_in`)를 보고 같은 값을 미리 적는다 — 본문이 나중에 움직이지 않는다 |
| 코드 | `web/src/lib/ads.ts`(규칙) · `web/src/components/AdSlots.tsx`(자리) · `web/src/styles/cinema/ads.css`(배치) · `web/src/test/ads.test.ts`(규칙 · 빌드 설정 검사) |
| 판 | 올리지 않았다 — 사용자에게 설명할 변경은 실제 광고가 붙는 판(약관 개정과 함께)에 묶는다 |
| **운영 반영 금지** | **지금 dev 에 올라간 내용(v5.10.x · 광고 자리)은 주인이 따로 풀기 전까지 main · deploy 에 절대 올리지 않는다** (주인 지시 2026-10-13 · 10-14). 일정 작업 프롬프트에도 같은 문단이 있다 |

dev 미리보기(`https://dev.moncamp.kr/`)에서 로그아웃 상태로 보면 점선 상자에 '광고 · 광고 자리예요 · 준비 중' 이 선다.

## 1. 먼저 결정할 것

| 결정 | 선택지 | 권장 |
| --- | --- | --- |
| **약관의 '광고 없음' 문구** | `web/src/screens/Legal.tsx` 1항 '서비스는 무료이며, 광고나 유료 기능을 제공하지 않습니다' 를 고쳐야 광고를 붙일 수 있다 | '서비스는 무료이며, 로그인하지 않은 화면에 광고가 표시될 수 있습니다. 유료 기능은 없습니다' |
| **통계를 끈 사람(`pogo_consent=denied`)** | ⓐ 광고 스크립트도 안 불러온다 ⓑ 개인화만 끈 광고를 보여 준다 | ⓐ — 지침 §5 '끄면 아무것도 안 보낸다' 와 결이 같고 방침 문장이 한 줄로 끝난다. 수익은 조금 준다 |
| **개인화 광고** | 기본 개인화(`ad_storage` granted) vs 비개인화 고정 | 한국 사용자가 대부분이라 개인화 허용 + 통계 설정에서 끌 수 있게. 다만 EU 지역(일정 지역 EU 를 고른 사람과 무관하게, **접속 위치가 EEA · 영국 · 스위스**인 사람)에게는 Google 이 인증된 CMP(동의 창)를 요구한다 — AdSense 의 '개인 정보 보호 및 메시지' 에서 Google 자체 CMP 를 켜면 된다 |
| **휴대폰 바닥 띠의 꼴** | 수동 유닛 320×50(지금 자리) vs AdSense 자동광고의 '앵커 광고' | 수동 유닛 — 자리 · 로그인 제외 규칙을 우리가 쥔다. 앵커 광고는 자동광고라 로그인한 사람에게도 뜰 수 있다 |

## 2. 약관 · 개인정보처리방침 개정 (코드, 7일 전 고지)

광고는 **새 수집 항목**(Google 광고 쿠키 · 광고 식별자)이라 지침 §5 의 '시행 7일 전 패치노트 고지' 가 그대로 적용됩니다.

1. `web/src/screens/Legal.tsx`
   - 약관 1항: '광고 없음' → 위 권장 문장. 로그인한 사용자에게는 광고가 없다는 것도 적는다.
   - 개인정보 2항(자동 수집): 'Google AdSense — 로그인하지 않은 화면에 광고를 보여 주기 위해 Google 이 광고 쿠키 · 기기 정보 · 대략적 위치(IP 기반)를 처리합니다. 통계를 끄면 광고 스크립트를 불러오지 않습니다' 한 줄. **'광고 목적의 수집(ad_storage 등)은 비활성화되어 있습니다' 문장은 지우거나 고친다** — 그대로 두면 거짓말이 된다.
   - 3항(이용 목적) · 4항(처리 위탁 표)에 Google(AdSense) 줄, 쿠키 항목에 광고 쿠키.
   - 영문(`content/i18n.en.mjs`)도 같이.
2. `web/src/lib/legalMeta.ts` — `PRIVACY_VER` · `TERMS_VER` 를 **시행일(고지일 + 7일 이상)** 로 올린다. 다음 로그인 때 다시 동의를 받는다.
3. `web/src/lib/gaSnippet.ts` — 통계를 끈 사람에게 광고도 끄기로 했으면 그대로(스크립트 자체를 안 심으니 `ad_storage` 값은 의미 없음). 개인화 광고를 켜기로 했으면 `consent default` 의 `ad_storage` · `ad_user_data` · `ad_personalization` 을 `granted` 로.
4. 패치노트(`content/release-notes.mjs` · `.en.mjs`)에 '○월 ○일부터 로그인하지 않은 화면에 광고가 표시됩니다. 약관 · 개인정보처리방침을 개정했습니다' 를 **시행 7일 전에** 올린다. 날짜 · 실제 동작 · 한영이 같아야 한다.

## 3. AdSense 계정과 사이트 심사 (사람이 하는 일)

1. `https://adsense.google.com` 에서 개인 계정으로 가입. 국가 한국, 결제 수취인 이름은 실명. 사이트에 `moncamp.kr` 을 더한다(서브도메인 `dev.moncamp.kr` 은 자동으로 포함).
2. **사이트 소유 확인** — 둘 중 하나. 권장은 `ads.txt`:
   - `web/public/ads.txt` 에 `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` 한 줄(게시자 ID 는 AdSense 가 준다). Vercel 이 그대로 내보낸다. 서비스워커는 같은 출처만 캐시하지만 Google 의 크롤러는 서비스워커를 거치지 않으니 무관.
   - 또는 `app/layout.tsx` 의 `<head>` 에 `<meta name="google-adsense-account" content="ca-pub-…">`.
3. 심사 신청. 보통 1 ~ 4주. **심사 중에는 자리에 '준비 중' 상자가 그대로 있어도 된다** — Google 은 스크립트가 심어진 페이지를 본다(아래 4 의 스크립트만 먼저 심고 슬롯은 비워 둬도 된다).
4. 결제 정보 — 주소 확인 PIN 우편(수익 $10 도달 뒤), 세금 정보(개인 · 한국 거주 · W-8BEN), 은행 계좌(외화 수취 가능 계좌). 지급 기준은 월 $100.
5. 승인 뒤 AdSense 콘솔에서 **광고 단위 셋**을 만든다 — 디스플레이 · 고정 크기: `왼쪽 160×600` · `오른쪽 160×600` · `바닥 320×50`. 슬롯 ID 셋을 받는다.

심사에서 자주 걸리는 것(미리 보기): 콘텐츠 부족 → 도감 · 순위 · 일정 · 게임 업데이트 게시판이 있어 괜찮다. 저작권 → 포켓몬 이름 · 스프라이트는 권리자 것이고 바닥글에 비공식 팬 프로젝트 고지(`docs/NOTICE.md`)가 있다. Google 이 '저작권 콘텐츠' 로 거절할 수 있다 — 그때는 이의 신청에 팬 사이트 · 비영리 · 출처 고지를 적는다. 거절되면 코드 쪽에는 할 일이 없고 자리는 `off` 로 둔다.

## 4. 승인 뒤 코드 붙이기

| 자리 | 넣을 것 |
| --- | --- |
| `web/.env.production` | `NEXT_PUBLIC_ADS=live` · `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` · `NEXT_PUBLIC_ADSENSE_SLOT_LEFT` · `_RIGHT` · `_BOTTOM`. 모두 공개 식별자라 저장소에 둔다(비밀 아님). dev 도 `dev-pipeline.yml` 의 `placeholder` 를 `live` 로 바꿔 먼저 본다 |
| `web/src/lib/ads.ts` | `AdsMode` 에 `'live'` — 승인 전에는 `adsMode` 가 `live` 를 `off` 로 읽으니 지금은 켜지지 않는다 |
| `web/src/components/AdSlots.tsx` | `live` 면 상자 안에 `<ins class="adsbygoogle" style="display:inline-block;width:160px;height:600px" data-ad-client data-ad-slot>` 를 두고, 마운트 때 한 번 `(window.adsbygoogle = window.adsbygoogle \|\| []).push({})`. 스크립트 `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…` 는 **AdSlots 가 보일 때 동적으로 한 번 심는다** — `layout.tsx` 에 붙박이로 두면 로그인한 사람의 기기에서도 Google 에 요청이 나간다. 통계를 끈 사람(`consentValue() === 'denied'`)이면 심지 않는다(1 의 결정 ⓐ) |
| `app/layout.tsx` | 스크립트를 동적으로 심으면 손댈 것 없음. `<meta name="google-adsense-account">` 로 소유 확인을 했으면 그 한 줄 |
| `web/public/ads.txt` | 3-2 의 한 줄 |
| `web/next.config.ts` | 보안 헤더의 CSP 는 `frame-ancestors` 뿐이라 추가할 것 없음. `Referrer-Policy: strict-origin-when-cross-origin` 그대로(광고 스크립트에 전체 주소를 안 넘긴다) |
| `web/public/sw.js` | 같은 출처만 캐시하므로 손댈 것 없음 |
| 검사 | `web/src/test/ads.test.ts` 에 `live` 판정 줄 · 통계 끈 사람 줄을 더한다. `scripts/check_screens.mjs` 가 도는 화면에는 광고 글자가 들어가도 새는 글자가 없어야 한다 |

성능 · 정책에서 지킬 것:
- 자리 크기가 고정이라 광고가 늦게 와도 본문이 안 움직인다(CLS). 광고가 안 오면(차단기 · 미채움) 상자는 비어 있다 — 그때 '준비 중' 글자를 다시 보여 줄지는 그때 정한다.
- '광고' 라벨은 그대로 둔다. 클릭을 유도하는 글(여기를 눌러 주세요 등)은 금지.
- 바닥 띠는 본문을 가리지 않는다(바닥 여백을 이미 둔다). 팝업 · 서랍은 띠보다 위(z-index 50 · 60 > 30)라 띠가 팝업을 가리지 않는다.
- **본인 클릭 금지.** dev 에서 실제 광고를 보더라도 누르지 않는다(무효 클릭으로 계정 정지).
- GA4 와 AdSense 연결은 선택(AdSense 콘솔 → 연결). 연결해도 사용자 데이터가 더 나가지는 않는다.

## 5. 운영 반영과 사후 확인

1. dev 에서 로그아웃 · 로그인 두 상태, 넓은 화면 · 휴대폰, 라이트 · 다크를 본다(`scripts/check_screens.mjs` · `check_contrast.mjs` · Playwright 스냅샷).
2. 약관 시행일이 고지일 + 7일을 지난 뒤 운영 판을 올린다 — 약관 · 방침 · 패치노트 · `legalMeta.ts` · `.env.production` 을 한 판(v5.11.0 예정)으로 묶는다. 지금은 **운영 보류 중**(10/13 지시)이라 보류가 풀린 뒤다.
3. 올린 뒤: AdSense 콘솔 '사이트' 에 `ads.txt` 상태 '승인됨', '정책 센터' 에 경고 없음, 광고 요청 수가 로그인 전 방문 수와 비슷한지(로그인한 사람에게 나가지 않는지) 확인. 운영 `/privacy` · `/terms` 가 새 시행일을 보이는지 curl 로 본다.
4. Vercel 플랜 — Hobby 는 광고를 금지한다(INFRA §8). dev 프로젝트는 Pro 다. **운영 프로젝트도 Pro 인지** 대시보드에서 한 번 확인한다.
5. 세금 — 한국 거주 개인의 AdSense 수익은 종합소득세 신고 대상(사업소득 또는 기타소득). 금액이 커지면 사업자 등록을 검토한다. 이 문서의 범위 밖이라 한 줄만 적는다.

## 6. 하지 않을 것

- 로그인한 사람에게 광고를 보이는 것 — 주인 결정. `adsVisible` 이 한 곳이라 다른 자리에서 따로 판정하지 않는다.
- 자동광고(Auto ads) 켜기 — 자리를 Google 이 정해 로그인 제외 · 배치 규칙이 깨진다.
- 약관 개정 없이 운영에 `placeholder` 나 `live` 를 켜는 것 — 약관이 '광고 없음' 이라고 말하는 동안 자리가 서면 안 된다(`ads.test.ts` 가 `.env.production` 의 `off` 를 지킨다).
