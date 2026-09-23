#!/usr/bin/env bash
# 배포 검증 (2026-09-05 v2.7.4) — 배포된 주소가 "그 채널의, 그 버전" 빌드인지 확인한다.
#   bash scripts/verify_deploy.sh <주소> <prod|dev> [기대 버전]
#   예) bash scripts/verify_deploy.sh https://dev.moncamp.kr/ dev
#       bash scripts/verify_deploy.sh https://moncamp.kr/ prod v3.27.0
#   (2026-09-14 v3.27.0 커스텀 도메인 전에는 minsangkwak.github.io/pogo-rank(-dev)/ 였다)
# 기대 버전을 생략하면 backend/build.py 의 APP_VERSION 을 쓴다 (dev 채널은 -dev 를 붙여 비교).
# 확인 항목: 판 번호 · 채널 표식(-dev/noindex/GA/robots) · 화면 데이터 · 아머드 뮤츠 전용 스프라이트 · PWA 파일
# 2026-09-18 v4.0.0 실서비스가 v4(React)로 바뀌었다. 판이 달라 **찾을 자리도 다르다** —
#   v3 는 HTML 안에 판 번호와 data.js 가 있었고, v4 는 data/meta.json 과 data/manifest.json 에 있다.
#   어느 판인지는 HTML 에 <div id="root"> 가 있는지로 가른다 (v4 는 있고 v3 는 없다)
# GitHub Pages CDN 캐시(max-age 600)를 피하려고 매 요청에 쿼리를 붙인다.
set -uo pipefail
URL=${1:?사용법: verify_deploy.sh <주소> <prod|dev> [기대 버전]}
CHANNEL=${2:?채널(prod|dev)을 주세요}
# 2026-09-23 판 번호의 원본이 release/version.json 으로 옮겨졌다(CLAUDE.md §5) — build.py 에는 더 없다
EXPECT=${3:-$(sed -n 's/.*"app": *"\(v[0-9.]*\)".*/\1/p' "$(dirname "$0")/../release/version.json")}
[[ $CHANNEL == dev ]] && EXPECT="${EXPECT}-dev"
URL=${URL%/}/
bust="?v=$(date +%s)"
fail=0
ok()  { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; fail=1; }
get() { curl -fsSL -H 'Cache-Control: no-cache' "$1$bust"; }

echo "▶ $URL  채널=$CHANNEL  기대 버전=$EXPECT"
html=$(get "$URL") || { echo "  ✗ index.html 응답 없음"; exit 1; }
ok "index.html 200 ($(echo -n "$html" | wc -c | tr -d ' ') bytes)"

# 0) 어느 판인가 — v4 는 #root 하나에 그린다. v5(Next.js)도 #root 가 있고, 문서에 self.__next_f 를 심는다
if grep -q '__next_f' <<<"$html"; then V=next; elif grep -q '<div id="root">' <<<"$html"; then V=v4; else V=v3; fi
ok "판: $V"

# 1) 판 번호 — v3 는 HTML 에 글자로 박혀 있고, v4 는 data/meta.json 의 APP_VERSION 이다
if [[ $V != v3 ]]; then
  meta=$(get "${URL}data/meta.json") || meta=""
  got=$(sed -n 's/.*"APP_VERSION":"\([^"]*\)".*/\1/p' <<<"$meta")
  [[ $got == "$EXPECT" ]] && ok "판 번호 $EXPECT" || bad "판 번호가 $EXPECT 가 아님 (실제: ${got:-없음})"
else
  if grep -q -- "$EXPECT" <<<"$html"; then ok "판 번호 $EXPECT"; else bad "판 번호 $EXPECT 없음"; fi
fi
if [[ $CHANNEL == prod && ${got:-} == *-dev ]]; then bad "prod 인데 -dev 판이 올라가 있음"; fi

# 1b) 문의 이메일 주입 (CONTACT_EMAIL) — 두 채널 모두 mailto 링크가 있어야 한다 (비워 둔 빌드라면 이 항목은 경고만)
if [[ $V != v3 ]]; then
  grep -q '"CONTACT_EMAIL":"[^"]' <<<"${meta:-}" && ok "문의 이메일 주입됨" || echo "  ! CONTACT_EMAIL 이 비어 있음"
else
  grep -q 'href="mailto:' <<<"$html" && ok "문의 이메일(mailto) 링크 있음" || echo "  ! mailto 링크 없음 — CONTACT_EMAIL 이 비어 있는 빌드인지 확인"
fi

# 2) 채널 표식
has_noindex=$(grep -c 'name="robots" content="noindex' <<<"$html" || true)
# 2026-09-07 v2.18.0 GA 는 동의 뒤에만 붙는다 — 번들(consent.js)에 gtag 주소 문자열이 항상 있으므로, 채널 표식은 build.py 가 넣는 측정 ID 자리(window.GA_PENDING_ID = 'G-…')로 본다
# 2026-09-18 v4.0.0 스니펫은 `var id = 'G-…'; window.GA_PENDING_ID = id;` 라 리터럴이 붙는 자리는 `var id` 쪽이다.
# 전에는 `GA_PENDING_ID = 'G-` 를 찾았는데 그 문자열은 v3 때부터 한 번도 있었던 적이 없다 — 늘 실패하던 검사였다
# v5 는 조각을 lib/gaSnippet.ts 가 만든다 — 측정 ID 가 JSON 문자열로 실리고 로더 주소가 함께 있다
if [[ $V == next ]]; then has_ga=$(grep -c 'googletagmanager.com/gtag/js' <<<"$html" || true)
else has_ga=$(grep -c "var id = 'G-" <<<"$html" || true); fi
if [[ $CHANNEL == dev ]]; then
  [[ $has_noindex -ge 1 ]] && ok "noindex 메타 있음" || bad "dev 인데 noindex 메타 없음"
  [[ $has_ga -eq 0 ]] && ok "GA 스니펫 없음" || bad "dev 인데 GA 스니펫이 들어 있음"
else
  [[ $has_noindex -eq 0 ]] && ok "noindex 없음" || bad "prod 인데 noindex 메타가 있음"
  [[ $has_ga -ge 1 ]] && ok "GA 스니펫 있음" || bad "prod 인데 GA 스니펫 없음"
fi
robots=$(get "${URL}robots.txt") || robots=""
if [[ $CHANNEL == dev ]]; then
  grep -q '^Disallow: /$' <<<"$robots" && ! grep -q '^Allow: /$' <<<"$robots" && ok "robots.txt 전체 차단" || bad "dev robots.txt 가 전체 차단이 아님"
else
  grep -q '^Allow: /$' <<<"$robots" && ok "robots.txt 검색 허용" || bad "prod robots.txt 에 Allow: / 없음"
fi

# 3) 화면 데이터 — v3 는 data.js 한 덩이, v4·v5 는 data/ 밑의 묶음들이다
if [[ $V != v3 ]]; then
  man=$(get "${URL}data/manifest.json") || man=""
  [[ -n $man ]] && ok "data/manifest.json 200" || bad "data/manifest.json 응답 없음"
  for one in dex max pve pvp; do
    grep -q "\"$one\"" <<<"$man" && ok "묶음 $one 있음" || bad "manifest 에 $one 없음"
  done
  dexj=$(get "${URL}data/dex.json") || dexj=""
  grep -q '90150' <<<"$dexj" && ok "SPRITE_IDS 에 아머드 뮤츠(90150) 포함" || bad "dex.json 에 90150 없음"
else
  datajs=$(get "${URL}data.js") || datajs=""
  [[ -n $datajs ]] && ok "data.js 200 ($(echo -n "$datajs" | wc -c | tr -d ' ') bytes)" || bad "data.js 응답 없음"
  grep -q 'const ROLES' <<<"$datajs" && ok "ROLES(즐겨찾기 분류 근거) 포함" || bad "data.js 에 ROLES 없음"
  grep -q '90150' <<<"$datajs" && ok "SPRITE_IDS 에 아머드 뮤츠(90150) 포함" || bad "data.js 에 90150 없음"
fi

# 4) 아머드 뮤츠 전용 스프라이트 — PNG 이고, 일반 뮤츠(150)와 바이트 수가 달라야 전용 그림이다
s150=$(curl -fsSL "${URL}sprites/150.png$bust" | wc -c | tr -d ' ')
s90150_bytes=$(curl -fsSL "${URL}sprites/90150.png$bust" || true)
s90150=$(echo -n "$s90150_bytes" | wc -c | tr -d ' ')
if [[ ${s90150:-0} -gt 0 && $(echo -n "$s90150_bytes" | head -c 4 | od -An -c | tr -d ' ') == '211PNG' ]]; then
  [[ $s90150 != "$s150" ]] && ok "sprites/90150.png 전용 그림 (${s90150}B ≠ 150.png ${s150}B)" || bad "90150.png 이 150.png 복사본(같은 크기)"
else
  bad "sprites/90150.png 없음 또는 PNG 아님"
fi

# 4b) 2026-09-06 v2.10.0 (QA-44) 순위표 밖에서만 쓰이는 스프라이트 — 메가 샤크니아(10070)가 대표. 이게 없으면 sprites.py 수집 범위가 다시 좁아진 것
code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}sprites/10070.png$bust")
[[ $code == 200 ]] && ok "sprites/10070.png (메가 샤크니아) 200" || bad "sprites/10070.png $code — sprites.py 수집 범위 확인"
# 2026-09-12 v3.14.0 상성 검색 페이지(renderTypeSearchPage)는 v3.9.0 에 도감 검색으로 합쳐져 사라졌다 — 그 뒤로 이 항목이 늘 실패했다.
# 지금 검색 입구는 openSearch (components/search.js, v3.12.0) 하나다
if [[ $V == next ]]; then
  # Next.js 는 번들을 /_next/static 밑에 둔다. 글꼴 선언은 HTML 이 아니라 CSS 에 있다
  grep -q '_next/static/chunks/.*\.js' <<<"$html" && ok "v5 번들 연결됨" || bad "HTML 에 v5 번들 <script> 가 없음"
  css=$(grep -o '/_next/static/css/[^"]*\.css' <<<"$html" | head -1)
  [[ -n $css ]] && ok "v5 스타일 연결됨" || bad "HTML 에 v5 스타일이 없음"
  [[ -n $css ]] && curl -fsSL "${URL%/}$css" | grep -q 'Galmuri' && ok "도트 글꼴(Galmuri) 선언 있음" || bad "글꼴 선언이 없음 — 화면이 시스템 글꼴로 그려집니다"
  # 보안 헤더 — Cloudflare 에서 앱으로 옮겨 왔다 (web/next.config.ts)
  heads=$(curl -sSI "$URL" | tr -d '\r' | tr 'A-Z' 'a-z')
  for name in strict-transport-security x-content-type-options referrer-policy content-security-policy permissions-policy; do
    grep -q "^$name:" <<<"$heads" && ok "헤더 $name" || bad "헤더 $name 없음"
  done
elif [[ $V == v4 ]]; then
  # 번들이 따로라 HTML 에는 함수 이름이 없다 — 대신 번들·스타일이 붙어 있는지로 본다
  grep -q 'assets/index-.*\.js' <<<"$html" && ok "v4 번들 연결됨" || bad "index.html 에 v4 번들 <script> 가 없음"
  grep -q 'assets/index-.*\.css' <<<"$html" && ok "v4 스타일 연결됨" || bad "index.html 에 v4 스타일이 없음"
  grep -q 'Galmuri11' <<<"$html" && ok "도트 글꼴(Galmuri) 선언 있음" || bad "글꼴 선언이 없음 — 화면이 시스템 글꼴로 그려집니다"
else
  grep -q 'function openSearch' <<<"$html" && ok "🔍 검색 입구(openSearch) 번들 포함" || bad "index.html 에 검색 입구 없음"
fi

# 5) PWA 정적 파일
for f in manifest.webmanifest sw.js icon-192.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}$f$bust")
  [[ $code == 200 ]] && ok "$f 200" || bad "$f $code"
done

# 6) 2026-09-19 v4.2.5 화면 글자 훑기 — `NaN` · `undefined` 가 한 글자도 안 나가야 한다.
#    파일이 200 인 것과 화면이 멀쩡한 것은 다르다. 46장을 실제로 열어 보고 판정한다.
#    Playwright 가 없는 자리(CI 러너 등)에서는 건너뛴다 — 없다고 배포를 세우지는 않는다.
if node -e "import('/opt/node22/lib/node_modules/playwright/index.js')" 2>/dev/null; then
  if node "$(dirname "$0")/check_screens.mjs" "$URL" >/tmp/check_screens.log 2>&1; then
    ok "화면 46장에 NaN · undefined 없음"
  else
    bad "화면에 NaN · undefined 가 보입니다 — $(grep -c '→' /tmp/check_screens.log 2>/dev/null || echo '?')군데. 자세히는 /tmp/check_screens.log"
  fi
  # 7) 2026-09-19 v4.3.0 명암비 훑기 — 글자가 바탕에 묻히면 그것도 안 보이는 것이다.
  #    같은 브라우저가 이미 떠 있는 김에 이어서 돌린다 (CLAUDE.md §1-b)
  if node "$(dirname "$0")/check_contrast.mjs" "$URL" >/tmp/check_contrast.log 2>&1; then
    ok "글자가 바탕에 묻히는 자리 없음"
  else
    bad "안 보이는 글자가 있습니다 — $(grep -c '→' /tmp/check_contrast.log 2>/dev/null || echo '?')군데. 자세히는 /tmp/check_contrast.log"
  fi
else
  echo "   (건너뜀) Playwright 가 없어 화면·명암비 훑기를 못 했습니다 — node scripts/check_screens.mjs $URL 로 따로 돌려 주세요"
fi

if [[ $fail -eq 0 ]]; then echo "✅ 통과: $URL ($EXPECT)"; else echo "❌ 실패 항목 있음: $URL"; fi
exit $fail
