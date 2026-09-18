#!/usr/bin/env bash
# 지금 어디까지 나가 있는가 — 한 화면으로 본다.
#
# **왜 있나.** 배포는 브랜치 셋과 워크플로 둘과 주소 둘에 걸쳐 있어서, 어디가 막혔는지
# 알려면 매번 네 군데를 따로 열어야 했다. 막혀도 조용하다는 것이 가장 나쁘다 —
# 이 스크립트 하나로 "실서비스가 몇 판인지" 와 "밀린 것이 있는지" 가 같이 보인다.
#
#   bash scripts/status.sh
#
# 인증이 필요 없다 (공개 저장소의 Actions 기록을 그대로 읽는다). 네트워크가 막히면
# 그 줄만 '확인 못 함' 으로 비우고 나머지는 그대로 보여 준다 — 한 줄 때문에 전부 못 보면 안 된다.
set -uo pipefail
cd "$(dirname "$0")/.."

REPO=MinsangKwak/pogo-rank
API=https://api.github.com/repos/$REPO
CURL=(curl -fsS --max-time 12)

say() { printf '%s\n' "$*"; }
dim() { printf '  %-16s %s\n' "$1" "$2"; }

git fetch origin main dev deploy --quiet 2>/dev/null || say "(원격을 못 받았습니다 — 아래 커밋은 마지막으로 받은 것 기준입니다)"

say ""
say "■ 브랜치"
for b in dev main deploy; do
  sha=$(git rev-parse --short "origin/$b" 2>/dev/null || echo '?')
  when=$(git log -1 --format=%cr "origin/$b" 2>/dev/null || echo '?')
  dim "$b" "$sha  ($when)"
done

# 밀린 것 — deploy 가 main 보다 뒤처져 있으면 그만큼 실서비스에 안 나간 판이 있다
behind=$(git rev-list --count origin/deploy..origin/main 2>/dev/null || echo '?')
ahead=$(git rev-list --count origin/main..origin/dev 2>/dev/null || echo '?')
say ""
say "■ 밀린 것"
if [ "$behind" = "0" ]; then dim "deploy ← main" "없음 (실서비스가 main 과 같다)"
else dim "deploy ← main" "$behind 커밋 — 실서비스에 안 나간 변경이 있습니다"; fi
if [ "$ahead" = "0" ]; then dim "main ← dev" "없음"
else dim "main ← dev" "$ahead 커밋"; fi

# 실제로 서빙되는 판 — 브랜치가 아니라 **주소가 말하는 것**이 진실이다
say ""
say "■ 서비스가 말하는 판"
for pair in "운영|https://moncamp.kr" "개발|https://dev.moncamp.kr"; do
  name=${pair%%|*}; url=${pair#*|}
  ver=$("${CURL[@]}" "$url/build.json" 2>/dev/null | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p')
  dim "$name" "${ver:-확인 못 함}  $url"
done

# 마지막 워크플로 — 빨간 것이 있으면 여기서 바로 보인다
say ""
say "■ 마지막 빌드"
for b in deploy dev; do
  line=$("${CURL[@]}" "$API/actions/runs?branch=$b&per_page=1" 2>/dev/null | python3 -c '
import json, sys
try:
    r = (json.load(sys.stdin).get("workflow_runs") or [None])[0]
except Exception:
    r = None
if not r:
    print("확인 못 함")
else:
    c = r.get("conclusion") or r.get("status") or ""
    mark = {"success": "O", "failure": "X", "cancelled": "-"}.get(c, "…")
    print(mark, "#" + str(r.get("run_number")), c, "", r.get("html_url"))
' 2>/dev/null)
  dim "$b" "${line:-확인 못 함}"
done

# 손에 남은 것 — 커밋 안 한 변경이 있으면 위 숫자가 내 작업을 아직 안 담고 있다는 뜻이다
say ""
say "■ 내 작업 폴더"
dirty=$(git status --porcelain | grep -v '^.. snapshot/' | wc -l | tr -d ' ')
dim "현재 브랜치" "$(git rev-parse --abbrev-ref HEAD)"
if [ "$dirty" = "0" ]; then dim "커밋 안 한 변경" "없음"
else dim "커밋 안 한 변경" "$dirty 개 (snapshot/ 제외)"; fi
say ""
