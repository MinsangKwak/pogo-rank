#!/usr/bin/env bash
# dev 미리보기 배포용 deploy key 1회 설정 (2026-09-05 v2.7.3)
#   1) ed25519 키 쌍을 임시로 만들고
#   2) 공개키를 MinsangKwak/pogo-rank-dev 에 "쓰기 가능 deploy key" 로 등록하고
#   3) 개인키를 MinsangKwak/pogo-rank 의 Actions 시크릿 DEV_DEPLOY_KEY 로 저장한다.
# 키 파일은 스크립트가 끝나면 지워진다 — 개인키는 GitHub 시크릿에만 남는다.
# 필요: gh CLI 로그인 상태(gh auth status), 두 저장소 모두에 admin 권한.
# 다시 실행하면 새 키가 추가되고 시크릿이 교체된다 — 옛 deploy key 는 pogo-rank-dev Settings → Deploy keys 에서 지운다.
set -euo pipefail
DEV_REPO=MinsangKwak/pogo-rank-dev
MAIN_REPO=MinsangKwak/pogo-rank
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
ssh-keygen -t ed25519 -N '' -C "pogo-rank Actions dev deploy $(date +%F)" -f "$tmp/key" -q
gh repo deploy-key add "$tmp/key.pub" --repo "$DEV_REPO" --title "pogo-rank Actions (dev 미리보기 배포) $(date +%F)" --allow-write
gh secret set DEV_DEPLOY_KEY --repo "$MAIN_REPO" < "$tmp/key"
echo "완료 — 이제 dev 브랜치에 푸시하면 https://minsangkwak.github.io/pogo-rank-dev/ 로 배포됩니다."
echo "바로 배포해 보려면: gh workflow run deploy-dev.yml --repo $MAIN_REPO --ref dev"
