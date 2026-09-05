#!/usr/bin/env bash
# 배포 검증 (2026-09-05 v2.7.4) — 배포된 주소가 "그 채널의, 그 버전" 빌드인지 확인한다.
#   bash scripts/verify_deploy.sh <주소> <prod|dev> [기대 버전]
#   예) bash scripts/verify_deploy.sh https://minsangkwak.github.io/pogo-rank-dev/ dev
#       bash scripts/verify_deploy.sh https://minsangkwak.github.io/pogo-rank/ prod v2.7.4
# 기대 버전을 생략하면 backend/build.py 의 APP_VERSION 을 쓴다 (dev 채널은 -dev 를 붙여 비교).
# 확인 항목: 버전 배지 · 채널 표식(-dev/noindex/GA/robots) · data.js · 아머드 뮤츠 전용 스프라이트 · PWA 파일
# GitHub Pages CDN 캐시(max-age 600)를 피하려고 매 요청에 쿼리를 붙인다.
set -uo pipefail
URL=${1:?사용법: verify_deploy.sh <주소> <prod|dev> [기대 버전]}
CHANNEL=${2:?채널(prod|dev)을 주세요}
EXPECT=${3:-$(sed -n "s/^APP_VERSION = '\(v[0-9.]*\)'.*/\1/p" "$(dirname "$0")/../backend/build.py")}
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

# 1) 버전 배지 — 기대 버전이 있고, prod 라면 -dev 가 붙어 있지 않아야 한다
if grep -q -- "$EXPECT" <<<"$html"; then ok "버전 $EXPECT"; else bad "버전 $EXPECT 없음 (실제: $(grep -o 'v2\.[0-9]*\.[0-9]*\(-dev\)\?' <<<"$html" | sort -u | tr '\n' ' '))"; fi
if [[ $CHANNEL == prod ]] && grep -q -- "${EXPECT}-dev" <<<"$html"; then bad "prod 인데 -dev 배지가 있음"; fi

# 2) 채널 표식
has_noindex=$(grep -c 'name="robots" content="noindex' <<<"$html" || true)
has_ga=$(grep -c 'googletagmanager.com/gtag' <<<"$html" || true)
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

# 3) 데이터 번들
datajs=$(get "${URL}data.js") || datajs=""
[[ -n $datajs ]] && ok "data.js 200 ($(echo -n "$datajs" | wc -c | tr -d ' ') bytes)" || bad "data.js 응답 없음"
grep -q 'const ROLES' <<<"$datajs" && ok "ROLES(즐겨찾기 분류 근거) 포함" || bad "data.js 에 ROLES 없음"
grep -q '90150' <<<"$datajs" && ok "SPRITE_IDS 에 아머드 뮤츠(90150) 포함" || bad "data.js 에 90150 없음"

# 4) 아머드 뮤츠 전용 스프라이트 — PNG 이고, 일반 뮤츠(150)와 바이트 수가 달라야 전용 그림이다
s150=$(curl -fsSL "${URL}sprites/150.png$bust" | wc -c | tr -d ' ')
s90150_bytes=$(curl -fsSL "${URL}sprites/90150.png$bust" || true)
s90150=$(echo -n "$s90150_bytes" | wc -c | tr -d ' ')
if [[ ${s90150:-0} -gt 0 && $(echo -n "$s90150_bytes" | head -c 4 | od -An -c | tr -d ' ') == '211PNG' ]]; then
  [[ $s90150 != "$s150" ]] && ok "sprites/90150.png 전용 그림 (${s90150}B ≠ 150.png ${s150}B)" || bad "90150.png 이 150.png 복사본(같은 크기)"
else
  bad "sprites/90150.png 없음 또는 PNG 아님"
fi

# 5) PWA 정적 파일
for f in manifest.webmanifest sw.js icon-192.png; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${URL}$f$bust")
  [[ $code == 200 ]] && ok "$f 200" || bad "$f $code"
done

if [[ $fail -eq 0 ]]; then echo "✅ 통과: $URL ($EXPECT)"; else echo "❌ 실패 항목 있음: $URL"; fi
exit $fail
