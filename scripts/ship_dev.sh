#!/usr/bin/env bash
# 지금 브랜치를 dev 에 머지해 미리보기까지 확인한다 (2026-09-12 v3.14.0)
#
# 왜 만들었나
#   한 판을 미리보기에 올리는 데 명령이 여덟 개였다 — 푸시, dev 받기, 체크아웃, 되돌리기, 머지, 푸시,
#   원래 브랜치로, 배포 확인. 매번 손으로 치면 그 사이사이가 기다리는 시간이 된다. 한 번에 한다.
#
# 쓰는 법
#   bash scripts/ship_dev.sh              현재 브랜치 → dev 머지·푸시 → pogo-rank-dev 에 그 버전이 뜰 때까지 확인
#   bash scripts/ship_dev.sh --no-wait    배포 확인은 건너뛴다
#
# 하는 일
#   1. 작업 트리가 깨끗한지 · 지금 브랜치가 dev/main/deploy 가 아닌지 확인
#   2. 현재 브랜치를 origin 에 푸시
#   3. dev 를 origin/dev 로 맞추고 --no-ff 머지 → 푸시 (main 은 PR 로 가므로 여기서 다루지 않는다)
#   4. 원래 브랜치로 돌아온다
#   5. pogo-rank-dev 에 backend/build.py 의 버전(-dev)이 뜰 때까지 최대 12분 기다렸다 verify_deploy.sh 로 검증
#      (dev 워크플로는 원본 데이터를 새로 받아 전체 빌드하므로 실측 7~8분이 걸린다)
set -euo pipefail
cd "$(dirname "$0")/.."
WAIT=1; [[ ${1:-} == --no-wait ]] && WAIT=0
DEV_URL='https://minsangkwak.github.io/pogo-rank-dev/'

branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in dev|main|deploy) echo "ship_dev: $branch 에서는 쓰지 않는다 — 작업 브랜치에서 실행하세요"; exit 1 ;; esac
[[ -z $(git status --porcelain) ]] || { echo "ship_dev: 커밋되지 않은 변경이 있다"; git status --short; exit 1; }
version=$(sed -n "s/^APP_VERSION = '\(v[0-9.]*\)'.*/\1/p" backend/build.py)

echo "▶ $branch → dev  ($version)"
git push -u origin "$branch"
git fetch origin dev
git checkout -q dev
git reset -q --hard origin/dev
git merge --no-ff -q "$branch" -m "Merge $version ($branch) into dev"
git push origin dev
git checkout -q "$branch"
echo "  ✓ dev 푸시 $(git rev-parse --short origin/dev)"

[[ $WAIT -eq 1 ]] || exit 0
# 워크플로(데이터 수집 + 전체 빌드) 7~8분 + Pages 반영 1~2분. 버전 문자열이 보일 때까지 20초마다 본다
echo "▶ 미리보기 배포 대기 ($DEV_URL · ${version}-dev)"
for _ in $(seq 1 36); do
  if curl -fsSL "$DEV_URL?v=$(date +%s)" 2>/dev/null | grep -q "${version}-dev"; then
    bash scripts/verify_deploy.sh "$DEV_URL" dev
    exit $?
  fi
  sleep 20
done
echo "  ✗ 12분 안에 ${version}-dev 가 뜨지 않았다 — Actions 를 확인하세요"
exit 1
