#!/usr/bin/env bash
# Cloudflare 를 GitHub Pages 앞에 세운 뒤(INFRA §8) 붙었어야 할 것을 훑는다.
#
# 왜 — 대시보드에서 켠 것과 실제로 나가는 응답은 다를 수 있다(프록시 구름이 회색이면 아무것도
# 안 붙는다). 옮기기 전에 돌리면 전부 ❌ 가 정상이고, 옮긴 뒤 ✅ 로 바뀌어야 한다.
#
#   bash scripts/verify_cloudflare.sh                 # 운영 + dev
#   bash scripts/verify_cloudflare.sh https://dev.moncamp.kr/
set -u
FAIL=0
say()  { printf '  %-44s %s\n' "$1" "$2"; }
ok()   { say "$1" "✅ $2"; }
bad()  { say "$1" "❌ $2"; FAIL=$((FAIL+1)); }
hdr()  { printf '%s' "$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d: -f2- | sed 's/^ *//'; }

site() {
  local base=$1
  echo; echo "── $base"
  local H; H=$(curl -sI --max-time 20 -H 'Cache-Control: no-cache' "$base")
  [ -n "$H" ] || { bad "응답" "없음"; return; }
  # 프록시가 켜졌는가 — cf-ray 는 Cloudflare 를 지난 응답에만 붙는다
  local ray; ray=$(hdr "$H" cf-ray)
  [ -n "$ray" ] && ok "Cloudflare 프록시" "cf-ray $ray" || bad "Cloudflare 프록시" "cf-ray 없음 — 구름이 회색이거나 전파 전"
  # 보안 헤더 다섯 — 없던 것들이다
  local v
  v=$(hdr "$H" strict-transport-security);  [[ $v == *max-age=* ]]              && ok "HSTS" "$v" || bad "HSTS" "없음"
  v=$(hdr "$H" x-content-type-options);     [[ ${v,,} == *nosniff* ]]           && ok "X-Content-Type-Options" "$v" || bad "X-Content-Type-Options" "없음"
  v=$(hdr "$H" referrer-policy);            [ -n "$v" ]                          && ok "Referrer-Policy" "$v" || bad "Referrer-Policy" "없음"
  v=$(hdr "$H" permissions-policy);         [ -n "$v" ]                          && ok "Permissions-Policy" "$v" || bad "Permissions-Policy" "없음"
  v=$(hdr "$H" content-security-policy);    [[ $v == *frame-ancestors* ]]        && ok "CSP frame-ancestors (헤더)" "있음" || bad "CSP frame-ancestors (헤더)" "없음 — <meta> 로는 못 넣는 것"
  # HTTP → HTTPS
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${base/https:/http:}")
  [[ $code == 301 || $code == 308 ]] && ok "HTTP → HTTPS" "$code" || bad "HTTP → HTTPS" "$code"
  # 정적 자산이 가장자리에 남는가 — 두 번 받아 둘째가 HIT 여야 한다
  local js; js=$(curl -s --max-time 20 "$base" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
  if [ -n "$js" ]; then
    curl -s -o /dev/null --max-time 20 "${base%/}$js"
    local cs; cs=$(curl -sI --max-time 20 "${base%/}$js" | tr -d '\r' | grep -i '^cf-cache-status:' | cut -d: -f2 | sed 's/^ *//')
    [[ ${cs^^} == HIT* ]] && ok "자산 캐시 ($js)" "cf-cache-status $cs" || bad "자산 캐시 ($js)" "cf-cache-status ${cs:-없음} — 캐시 규칙 확인"
  else
    bad "자산 캐시" "index.html 에서 번들 주소를 못 찾음"
  fi
}

if [ $# -gt 0 ]; then for b in "$@"; do site "$b"; done
else site https://moncamp.kr/; site https://dev.moncamp.kr/; fi

# 스토리북 잠금(Cloudflare Access) — 걸려 있으면 302 로 로그인 화면에 보낸다. 안 걸려 있어도 실패는 아니다(선택 항목)
echo; echo "── 스토리북 잠금 (선택)"
sb=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://dev.moncamp.kr/storybook/)
case $sb in 302|401|403) ok "Cloudflare Access" "$sb — 인증 없이는 못 연다" ;; *) say "Cloudflare Access" "· $sb — 안 걸림 (브라우저 게이트만 있음)" ;; esac

echo
[ "$FAIL" = 0 ] && echo "모두 붙었다 ✅" || echo "안 붙은 곳 $FAIL 군데 ❌ — 옮기기 전이라면 정상이다"
echo "기계가 못 보는 것 — Bot Fight Mode 가 검사 브라우저(check_screens.mjs)를 막지 않는지: 배포 뒤 한 번 돌려 본다"
exit $FAIL
