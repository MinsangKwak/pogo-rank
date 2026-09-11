#!/usr/bin/env bash
# 회귀 스위트를 병렬로 돌린다 (2026-09-10 v2.54.0)
#
# 왜 만들었나
#   스위트를 하나씩 차례로 돌리면 15분이 걸렸다. 그런데 스위트들은 서로를 건드리지 않는다 —
#   각자 제 브라우저를 띄우고, 같은 정적 서버를 읽기만 한다. 순서대로 기다릴 이유가 없었다.
#   느린 것부터 먼저 넣어 일꾼 넷을 채우면, 전체 시간은 "가장 느린 하나" 에 가까워진다.
#
# 쓰는 법
#   bash scripts/test.sh            빌드 → 서버 → 전체 회귀 (일꾼 4)
#   bash scripts/test.sh -j 2       일꾼 수 지정
#   bash scripts/test.sh nav shell  이름에 그 글자가 든 스위트만
#   bash scripts/test.sh --no-build 지금 dist/ 를 그대로 쓴다 (테스트만 고쳤을 때)
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=5503
JOBS=4
BUILD=1
FILTERS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -j) JOBS="$2"; shift 2 ;;
    --no-build) BUILD=0; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) FILTERS+=("$1"); shift ;;
  esac
done

# 1. 빌드 — 테스트는 배포될 산출물을 봐야 한다. 소스만 고치고 빌드를 잊으면 옛 화면을 검사하게 된다
if [[ $BUILD -eq 1 ]]; then
  echo "빌드 중…"
  python3 backend/build.py >/dev/null || { echo "빌드 실패"; exit 1; }
fi
[[ -f dist/index.html ]] || { echo "dist/ 가 없다 — --no-build 를 빼고 다시 실행하세요"; exit 1; }

# 2. 서버 — 이미 떠 있으면 같은 빌드를 주는지 확인하고 빌려 쓴다.
#    다른 빌드를 주고 있으면 조용히 옛것을 검사하게 되므로 여기서 멈춘다
OWN_SERVER=0
if curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null; then
  running=$(curl -fsS "http://localhost:$PORT/build.json" 2>/dev/null || echo '')
  mine=$(cat dist/build.json 2>/dev/null || echo '')
  if [[ -n "$running" && "$running" != "$mine" ]]; then
    echo "포트 $PORT 에 다른 빌드가 떠 있다 — 그 서버를 끄고 다시 실행하세요"
    echo "  떠 있는 것: $running"
    echo "  이번 빌드 : $mine"
    exit 1
  fi
  echo "이미 떠 있는 서버를 씁니다 (localhost:$PORT)"
else
  (cd dist && exec python3 -m http.server "$PORT" >/dev/null 2>&1) &
  SERVER_PID=$!
  OWN_SERVER=1
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null && break
    sleep 0.25
  done
fi
cleanup() { [[ $OWN_SERVER -eq 1 ]] && kill "$SERVER_PID" 2>/dev/null; }
trap cleanup EXIT

# 3. 실행 순서 — 느린 것부터. 일꾼이 넷인데 느린 것이 맨 뒤에 남으면 셋이 놀면서 그 하나를 기다린다.
#    순서는 짐작이 아니라 병렬로 한 바퀴 돌려 잰 값이다 (혼자 돌 때보다 느려지므로 따로 재야 한다):
#      shell 450s · nav 253s · router 212s · fingerprint 98s · breakpoints 85s
#      layout-toggle 74s · i18n 73s · bot-filter 64s · 나머지 30s 미만
#    새 스위트가 생기면 이 목록 뒤에 붙어 돌 뿐, 순서를 몰라도 깨지지 않는다
SLOW="shell nav router fingerprint breakpoints layout-toggle list-cols i18n bot-filter"
ORDER=()
for name in $SLOW; do [[ -f "tests/e2e/$name.js" ]] && ORDER+=("tests/e2e/$name.js"); done
for f in tests/e2e/*.js; do
  case " ${ORDER[*]} " in *" $f "*) ;; *) ORDER+=("$f") ;; esac
done

# 이름으로 걸러내기 (인자를 준 경우)
RUN=()
for f in "${ORDER[@]}"; do
  if [[ ${#FILTERS[@]} -eq 0 ]]; then RUN+=("$f"); continue; fi
  for want in "${FILTERS[@]}"; do
    [[ "$(basename "$f")" == *"$want"* ]] && { RUN+=("$f"); break; }
  done
done
[[ ${#RUN[@]} -gt 0 ]] || { echo "돌릴 스위트가 없다"; exit 1; }

OUTDIR=$(mktemp -d)
trap 'cleanup; rm -rf "$OUTDIR"' EXIT

started=$(date +%s)
echo "회귀 ${#RUN[@]}개 · 일꾼 $JOBS"
echo

# 4. 일꾼 풀 — 동시에 JOBS 개까지만 띄운다.
#    출력은 파일에 모았다가 아래에서 순서대로 낸다 (여러 프로세스가 같은 화면에 쓰면 줄이 섞인다)
running=0
for f in "${RUN[@]}"; do
  name=$(basename "$f")
  ( s=$(date +%s)
    out=$(node "$f" 2>&1)
    code=$?
    printf '%s\t%s\t%s\n' "$code" "$(( $(date +%s) - s ))" "$(echo "$out" | tail -1)" > "$OUTDIR/$name.res"
    echo "$out" > "$OUTDIR/$name.log"
  ) &
  running=$((running + 1))
  if [[ $running -ge $JOBS ]]; then wait -n 2>/dev/null || wait; running=$((running - 1)); fi
done
wait

# 5. 결과 — 알파벳 순으로 가지런히. 실패한 줄은 그 안의 FAIL 도 함께 보여 준다
fail=0
for f in $(printf '%s\n' "${RUN[@]}" | sort); do
  name=$(basename "$f")
  IFS=$'\t' read -r code secs last < "$OUTDIR/$name.res"
  mark="  "
  if [[ "$code" != "0" ]]; then mark="✗ "; fail=$((fail + 1)); fi
  printf '%s%-22s %4ds  %s\n' "$mark" "$name" "$secs" "$last"
  [[ "$code" != "0" ]] && grep '^FAIL' "$OUTDIR/$name.log" | sed 's/^/      /'
done

echo
total=$(( $(date +%s) - started ))
if [[ $fail -eq 0 ]]; then
  echo "전부 통과 · ${total}초"
else
  echo "실패 $fail개 · ${total}초"
fi
exit $(( fail > 0 ? 1 : 0 ))
