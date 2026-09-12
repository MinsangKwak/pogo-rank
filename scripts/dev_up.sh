#!/usr/bin/env bash
# 개발 서버 올리기 (2026-09-12 v3.14.0) — 빌드하고 dist/ 를 localhost:5503 에 띄운다
#
# 왜 만들었나
#   클라우드 세션은 컨테이너가 자주 새로 뜬다. 그때마다 "빌드 → 서버 → 회귀" 를 손으로 다시 시작했고,
#   서버가 죽어 있는 줄 모르고 회귀를 돌려 연결 오류부터 만나기도 했다.
#   .claude/settings.json 의 SessionStart 훅이 이 스크립트를 불러 세션이 열릴 때 이미 서버가 떠 있게 한다.
#
# 쓰는 법
#   bash scripts/dev_up.sh            빌드 + 서버 (이미 떠 있으면 서버는 그대로)
#   bash scripts/dev_up.sh --quiet    훅용 — 결과 한 줄만
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=5503
QUIET=0; [[ ${1:-} == --quiet ]] && QUIET=1
say() { [[ $QUIET -eq 1 ]] || echo "$1"; }

# 목 모드 값 — 회귀는 로그인 흐름까지 보므로 값이 아무거나 있어야 한다 (tests/e2e/README.md)
export FIREBASE_CONFIG_JSON=${FIREBASE_CONFIG_JSON:-'{"apiKey":"local-test","projectId":"local-test"}'}
export ADMIN_UID=${ADMIN_UID:-mock-admin}
python3 backend/build.py >/dev/null || { echo "dev_up: 빌드 실패"; exit 1; }
say "빌드 완료 → dist/ ($(python3 -c "import json;print(json.load(open('dist/build.json'))['version'])"))"

if curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null; then
  say "서버가 이미 떠 있다 (localhost:$PORT)"
else
  # setsid + nohup: 이 셸(훅)이 끝나도 서버는 남는다
  (cd dist && setsid nohup python3 -m http.server "$PORT" >/dev/null 2>&1 &)
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null && break
    sleep 0.25
  done
  say "서버 시작 (localhost:$PORT)"
fi
[[ $QUIET -eq 1 ]] && echo "dev_up: dist 빌드 · localhost:$PORT 준비됨"
exit 0
