#!/usr/bin/env bash
# 원본 데이터 다운로드: PvPoke(PvP 랭킹·게임마스터), PokeMiners(게임마스터), PokeAPI(한글 이름·폼 인덱스)
set -euo pipefail
cd "$(dirname "$0")/.."   # 어디서 실행해도 저장소 루트 기준
mkdir -p data
PV=https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data
PA=https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv

# 2026-09-03 CI 배포 실패 대응:
#  - -f: HTTP 4xx/5xx면 실패로 처리 (예전엔 429/500 응답 본문이 그대로 json 파일에 저장돼 다음 단계에서 죽었다)
#  - --retry: raw.githubusercontent 순간 제한(429)·일시 오류를 자동 재시도
CURL=(curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 --max-time 300)
get() {  # get <출력경로> <URL>
  if ! "${CURL[@]}" -o "$1" "$2"; then echo "FETCH FAIL: $2" >&2; rm -f "$1"; return 1; fi
}

# 2026-09-03 v2.0.0: 병렬 다운로드로 배포 시간 단축
pids=()
get data/gm.json "$PV/gamemaster.json" & pids+=($!)
for cp in 500 1500 2500 10000; do get "data/r$cp.json" "$PV/rankings/all/overall/rankings-$cp.json" & pids+=($!); done
get data/pm.json https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json & pids+=($!)
get data/species_names.csv "$PA/pokemon_species_names.csv" & pids+=($!)
get data/move_names.csv "$PA/move_names.csv" & pids+=($!)
get data/pokemon.csv "$PA/pokemon.csv" & pids+=($!)
get data/pokemon_species.csv "$PA/pokemon_species.csv" & pids+=($!)
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done   # 병렬 작업 중 하나라도 실패하면 여기서 잡는다
[[ $fail -eq 0 ]] || { echo "원본 데이터 다운로드 실패 — 위 FETCH FAIL 줄을 확인하세요" >&2; exit 1; }

# 내려받은 JSON이 실제로 파싱되는지 확인 (깨진 응답이 다음 단계로 넘어가지 않도록)
python3 - <<'PY'
import json, sys
for f in ('data/gm.json', 'data/r500.json', 'data/r1500.json', 'data/r2500.json', 'data/r10000.json', 'data/pm.json'):
    try:
        json.load(open(f, encoding='utf-8'))
    except Exception as e:
        sys.exit(f'JSON 깨짐: {f} — {e}')
print('json ok')
PY
echo "fetched"

# 기준 데이터: hawaii 속성별 레이드 성능표 (구글 시트 웹 게시 → CSV). 탭(gid)은 backend/config/sheets.conf에서 관리
# 시트는 있으면 좋은 보조 데이터라 실패해도 배포를 막지 않는다 (저장소의 snapshot/ 사본으로 대체)
SHEET=https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-a0DcSGf2dITFS2ekiQkX2SJ6AHSY6FIuLJdzJUlkS4rdC6QabZnMcKJeKY7zwLK18XjYwfIl7DX4/pub
while read -r name gid; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  if ! "${CURL[@]}" -o "data/sheet_$name.csv" "$SHEET?gid=$gid&single=true&output=csv"; then
    echo "sheet $name download failed" >&2
    rm -f "data/sheet_$name.csv"
    [[ -f "snapshot/sheet_$name.csv" ]] && cp "snapshot/sheet_$name.csv" "data/sheet_$name.csv" && echo "snapshot/sheet_$name.csv 사용"
  fi
done < backend/config/sheets.conf
echo "sheets fetched"
