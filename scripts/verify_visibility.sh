#!/usr/bin/env bash
# 저장소를 private 으로 돌린 뒤 무엇이 끊겼는지 훑는다.
#
# 왜 — 재야 할 것이 서로 반대인 둘이다. **사이트는 계속 나가야 하고**(Pro 는 private
# 저장소에서도 Pages 를 공개로 내보낸다), **저장소로 새던 길은 막혀야 한다.**
# 눈으로 다 볼 수 없어 기계가 본다. 전환 전에 한 번, 후에 한 번 돌려 견준다.
#
# 두 저장소는 배포 방식이 다르다 — 가정을 박아 두면 엉뚱한 자리를 재게 된다
#   pogo-rank      actions/deploy-pages (산출물 직접 올림). **gh-pages 브랜치가 없다**
#                  → 새는 자리는 산출물이 아니라 원본 가지(main·dev)다
#   pogo-rank-dev  gh-pages 브랜치에 빌드 결과만 실린다
#
#   bash scripts/verify_visibility.sh          # 둘 다
#   bash scripts/verify_visibility.sh dev      # dev 만
set -u

OWNER=MinsangKwak

# ★ 이 스크립트가 못 재는 자리가 있다. 밝히고 시작한다.
#
# Claude 실행 환경의 프록시는 git 요청에 자격증명을 끼워 넣는다(gitConfigInjection).
# 그래서 codeload·git 은 private 저장소에도 200 으로 답한다 — **남이 보는 것이 아니라
# 내가 보는 것**이다. 실측으로 갈린 것이 이렇다
#
#   github.com HTML · raw.githubusercontent   인증 안 붙음 → 믿을 수 있다
#   codeload · git ls-remote                  인증 붙음   → 못 믿는다 (검사에서 뺐다)
#
# 검사가 재는 자리만 재고 못 재는 자리는 재는 척하지 않는다 — 통과하는 빈 그물이
# 아예 없는 그물보다 나쁘다.
warn_creds() {
  if GIT_TERMINAL_PROMPT=0 git ls-remote "https://github.com/$OWNER/pogo-rank-dev" >/dev/null 2>&1; then
    echo
    echo "⚠ 이 셸에 GitHub 자격증명이 붙어 있다 — 아래 저장소 쪽 결과는 '남이 보는 것' 이 아닐 수 있다."
    echo "  확실히 하려면 로그아웃한 브라우저(시크릿 창)로 직접 열어 본다:"
    echo "    https://github.com/$OWNER/pogo-rank-dev        → 404 여야 한다"
    echo "    https://codeload.github.com/$OWNER/pogo-rank-dev/tar.gz/refs/heads/gh-pages → 404 여야 한다"
  fi
}
WHICH="${1:-all}"
FAIL=0

# 인증 없이 묻는다 — 로그인한 내가 보는 것이 아니라 남이 보는 것을 재야 한다.
# raw 는 CDN 이 몇 분 캐시한다. 전환 직후에는 지운 파일이 200 으로 남을 수 있어
# 매번 다른 꼬리표를 붙여 캐시를 비켜 간다
code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
       -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "$1?cb=$RANDOM$RANDOM" 2>/dev/null || echo 000
}
check() {
  local label="$1" url="$2" want="$3" got
  got=$(code "$url")
  if [ "$got" = "$want" ]; then printf '  %-56s %s ✅\n' "$label" "$got"
  else printf '  %-56s %s ❌ (기대 %s)\n' "$label" "$got" "$want"; FAIL=$((FAIL+1)); fi
}
# private 이면 404, public 이면 200 — 기대값을 한 곳에서 뒤집는다
want_repo() { [ "$1" = private ] && echo 404 || echo 200; }

prod() {
  local vis="$1" w; w=$(want_repo "$vis")
  echo; echo "── 운영 · pogo-rank ($vis)"
  echo "  사이트는 계속 나가야 한다"
  check "https://moncamp.kr/"                 "https://moncamp.kr/" 200
  check "https://moncamp.kr/data/manifest.json" "https://moncamp.kr/data/manifest.json" 200
  echo "  원본이 남에게 읽히나 (핵심 산식이 새는 자리)"
  check "github.com/$OWNER/pogo-rank"         "https://github.com/$OWNER/pogo-rank" "$w"
  check "raw main/backend/build.py"           "https://raw.githubusercontent.com/$OWNER/pogo-rank/main/backend/build.py" "$w"
  check "raw dev/CLAUDE.md"                   "https://raw.githubusercontent.com/$OWNER/pogo-rank/dev/CLAUDE.md" "$w"
}

dev() {
  local vis="$1" w; w=$(want_repo "$vis")
  echo; echo "── dev · pogo-rank-dev ($vis)"
  echo "  사이트는 계속 나가야 한다"
  check "https://dev.moncamp.kr/"                 "https://dev.moncamp.kr/" 200
  check "https://dev.moncamp.kr/data/manifest.json" "https://dev.moncamp.kr/data/manifest.json" 200
  check "https://dev.moncamp.kr/storybook/"        "https://dev.moncamp.kr/storybook/" 200
  echo "  저장소로 새던 길 (스토리북 가림막은 브라우저에서만 돈다 — 여기가 뚫리면 무의미하다)"
  check "github.com/$OWNER/pogo-rank-dev"     "https://github.com/$OWNER/pogo-rank-dev" "$w"
  check "raw gh-pages/storybook/index.html"   "https://raw.githubusercontent.com/$OWNER/pogo-rank-dev/gh-pages/storybook/index.html" "$w"
}

case "$WHICH" in
  prod) prod "${2:-public}" ;;
  dev)  dev  "${2:-private}" ;;
  all)  prod "${PROD_VIS:-public}"; dev "${DEV_VIS:-private}" ;;
  *) echo "쓰임: $0 [all|prod|dev] [public|private]"; exit 2 ;;
esac

echo
[ "$FAIL" = 0 ] && echo "모두 기대대로 ✅" || echo "어긋난 곳 $FAIL 군데 ❌"
echo
echo "기계가 못 보는 것 — 사람이 확인한다"
echo "  · 다음 dev 푸시가 pogo-rank-dev 에 실제로 올라가는지 (배포 키는 private 에서도 동작한다)"
echo "  · Settings → Pages 의 Custom domain 이 그대로인지 (전환 때 풀리는 일이 있다)"
echo "  · 시크릿 창에서 codeload tarball 이 404 인지 (여기서는 자격증명이 붙어 못 잰다)"
warn_creds
exit $FAIL
