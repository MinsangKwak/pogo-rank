#!/usr/bin/env bash
# firestore.rules 의 __ADMIN_UID__ 를 .env 의 ADMIN_UID 로 채워 firestore.rules.local 로 만든다 (2026-09-05 v2.8.0).
# 만들어진 파일 내용을 Firebase 콘솔 > Firestore > 규칙 에 붙여넣고 게시한다. firestore.rules.local 은 커밋되지 않는다.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo ".env 가 없습니다 — .env.example 을 복사해 ADMIN_UID 를 채우세요" >&2; exit 1; }
ADMIN_UID=$(sed -n 's/^ADMIN_UID=//p' .env | tr -d '"'"'"' \r')
[[ -n $ADMIN_UID ]] || { echo ".env 의 ADMIN_UID 가 비어 있습니다" >&2; exit 1; }
sed "s/__ADMIN_UID__/$ADMIN_UID/g" firestore.rules > firestore.rules.local
echo "firestore.rules.local 생성 — Firebase 콘솔에 붙여넣어 게시하세요 ($(grep -c "$ADMIN_UID" firestore.rules.local)곳 치환)"
