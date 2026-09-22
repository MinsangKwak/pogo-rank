#!/usr/bin/env bash
# 전체 빌드: 데이터 → PvE 계산 → PvP 가공 → 맥스·가성비·활용처 → 도감 → 시즌 기술 변경 → 레이드·알 → 스프라이트 → dist/data.js · 부속 파일
#
# **단계마다 값이 다르다.** 화면 코드만 고쳤는데 스프라이트 1184장을 다시 만들 이유가 없다.
# 무엇을 고쳤는지에 맞춰 골라 쓴다 — 건너뛴 단계의 산출물은 저장소에 있는 것을 그대로 쓴다.
#
#   bash scripts/build.sh              전부. 원본을 새로 받는다 (매일 정기 빌드·CI 가 쓰는 길)
#   bash scripts/build.sh --no-fetch   받아 둔 원본으로 다시 계산한다 (계산 코드를 고쳤을 때)
#   bash scripts/build.sh --meta-only  계산·스프라이트를 건드리지 않고 data.js · 부속 파일만 다시 쓴다
#                                      (APP_VERSION·문구 등 build.py 안의 값만 바뀌었을 때)
#
# 화면(frontend-v4) 만 고쳤다면 **이 스크립트가 아예 필요 없다** — `cd frontend-v4 && npm run build` 로 끝난다.
#
# 건너뛰기는 **필요한 것이 있을 때만** 허용한다. 없는 채로 넘어가면 멈춘다 —
# 반쯤 빈 dist 가 조용히 만들어져 배포까지 가는 것이 가장 나쁘다.
set -euo pipefail
cd "$(dirname "$0")/.."   # 어디서 실행해도 저장소 루트 기준

FETCH=1
COMPUTE=1
SPRITES=1
for arg in "$@"; do
  case "$arg" in
    --no-fetch)   FETCH=0 ;;
    --no-sprites) SPRITES=0 ;;
    --meta-only)  FETCH=0; COMPUTE=0; SPRITES=0 ;;
    -h|--help)    sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "모르는 옵션: $arg (--no-fetch · --no-sprites · --meta-only)" >&2; exit 2 ;;
  esac
done

# 건너뛸 단계가 기대는 산출물이 실제로 있는지 먼저 본다
need() {  # need <경로> <없을 때 할 말>
  if [ ! -e "$1" ]; then
    echo "::error::$1 이 없습니다 — $2" >&2
    exit 1
  fi
}
[ "$FETCH" = 1 ]   || need data/gm.json "원본을 건너뛰려면 먼저 한 번은 받아야 합니다 (옵션 없이 실행)"
[ "$SPRITES" = 1 ] || need dist/sprites "스프라이트를 건너뛰려면 먼저 한 번은 만들어야 합니다"
[ "$COMPUTE" = 1 ] || need data/dex.json "계산을 건너뛰려면 먼저 한 번은 계산해야 합니다"

[ "$FETCH" = 1 ] && bash scripts/fetch_data.sh

if [ "$COMPUTE" = 1 ]; then
  python3 backend/pve_build.py
  python3 backend/build.py
  python3 backend/value_build.py
  python3 backend/sheet_build.py
  python3 backend/dex_build.py
  python3 backend/change_build.py
  python3 backend/gameday_build.py   # 2026-09-08 v2.25.0 레이드 보스·알 부화·이벤트 (dex 이름표가 필요해 dex_build 뒤, 스프라이트 수집 전)
  python3 backend/schedule_build.py  # 2026-09-21 v4.7.0 월 일정표 자동 수집 (같은 원본 sd_events.json · snapshot/schedule_auto.json 에 지난 달을 누적)
  python3 backend/roles_build.py
fi

[ "$SPRITES" = 1 ] && python3 backend/sprites.py

# 2026-09-16 v3.47.0 마지막 조립에서만 검문한다 — 비거나 줄어든 표는 직전 정상본(snapshot/tables/)으로 대체 (backend/guard.py)
BUILD_GATE=1 python3 backend/build.py
echo "built dist/data.js · 부속 파일"
