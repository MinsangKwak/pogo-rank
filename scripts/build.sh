#!/usr/bin/env bash
# 전체 빌드: 데이터 → PvE 계산 → PvP 가공 → 맥스·가성비·활용처 → 도감 → 시즌 기술 변경 → 레이드·알 → 스프라이트 → dist/index.html
set -euo pipefail
cd "$(dirname "$0")/.."   # 어디서 실행해도 저장소 루트 기준
bash scripts/fetch_data.sh
python3 backend/pve_build.py
python3 backend/build.py
python3 backend/value_build.py
python3 backend/sheet_build.py
python3 backend/dex_build.py
python3 backend/change_build.py
python3 backend/gameday_build.py   # 2026-09-08 v2.25.0 레이드 보스·알 부화·이벤트 (dex 이름표가 필요해 dex_build 뒤, 스프라이트 수집 전)
python3 backend/roles_build.py
python3 backend/sprites.py
python3 backend/build.py
echo "built dist/index.html"
