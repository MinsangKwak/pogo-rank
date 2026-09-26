#!/usr/bin/env bash
# firestore.rules 의 __ADMIN_UID__ 를 .env 의 ADMIN_UID 로 채워 firestore.rules.local 로 만든다 (2026-09-05 v2.8.0).
# 만들어진 파일 내용을 Firebase 콘솔 > Firestore > 규칙 에 붙여넣고 게시한다. firestore.rules.local 은 커밋되지 않는다.
#
# 2026-09-15 v3.41.0 값을 검사한다.
#   전에는 .env 에 무엇이 적혀 있든 그대로 넣고 "1곳 치환" 이라며 성공한 척했다.
#   로컬 시험용 .env(ADMIN_UID=mock-admin)로 돌린 결과를 그대로 게시하면 **루트 관리자가 사라진다** —
#   isRootAdmin() 이 아무에게도 참이 아니게 되어 가입 승인·관리자 지정·트레이너 코드 쓰기가 전부 막힌다.
#   되돌리려면 콘솔에서 규칙을 다시 고치는 수밖에 없다. 그래서 붙여넣기 **전에** 여기서 막는다.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo ".env 가 없습니다 — .env.example 을 복사해 ADMIN_UID 를 채우세요" >&2; exit 1; }
ADMIN_UID=$(sed -n 's/^ADMIN_UID=//p' .env | tr -d '"'"'"' \r')
[[ -n $ADMIN_UID ]] || { echo ".env 의 ADMIN_UID 가 비어 있습니다" >&2; exit 1; }

# ── 1. 모양 검사 — Firebase uid 는 영숫자 28자다 ─────────────────────────────
if [[ ! $ADMIN_UID =~ ^[A-Za-z0-9]{20,40}$ ]]; then
  cat >&2 <<MSG
✗ ADMIN_UID 가 Firebase uid 모양이 아닙니다: '$ADMIN_UID'
  Firebase uid 는 영숫자 28자 안팎입니다 (예: d2syi8Et... 꼴).
  배포된 사이트에서 ☰ → 🔑 가입 승인 → "내 uid 복사" 로 얻은 값을 .env 에 넣으세요.
  이대로 게시하면 루트 관리자가 사라져 콘솔에서 손으로 되돌려야 합니다.
MSG
  exit 1
fi

# ── 2. 실서비스와 대조 — 빌드에 박힌 ADMIN_UID 가 정답이다 ──────────────────
# 네트워크가 없거나 사이트가 아직 없을 수 있으므로 **실패해도 멈추지 않는다**. 다만 다르면 크게 경고한다.
SITE_URL=${SITE_URL:-https://moncamp.kr/}
LIVE_UID=$(curl -fsS --max-time 8 "$SITE_URL" 2>/dev/null | grep -o 'const ADMIN_UID = "[^"]*"' | head -1 | sed 's/.*"\(.*\)"/\1/' || true)
if [[ -z $LIVE_UID ]]; then
  echo "· 실서비스($SITE_URL)와 대조하지 못했습니다 — 네트워크가 없거나 아직 배포 전입니다. 값은 직접 확인하세요." >&2
elif [[ $LIVE_UID != "$ADMIN_UID" ]]; then
  cat >&2 <<MSG
✗ .env 의 ADMIN_UID 가 실서비스와 다릅니다.
    .env      : $ADMIN_UID
    실서비스  : $LIVE_UID   ($SITE_URL 의 const ADMIN_UID)
  실서비스 값이 정답입니다. .env 를 고치거나, 정말 바꾸려는 것이면 ADMIN_UID=$LIVE_UID 로 다시 돌리세요.
MSG
  exit 1
fi

# 따옴표째로 바꾼다 — 설명 주석 안의 __ADMIN_UID__ 는 자리표시자라고 알려 주는 글이라 그대로 둔다
sed "s/'__ADMIN_UID__'/'$ADMIN_UID'/g" infra/firebase/firestore.rules > infra/firebase/firestore.rules.local

# ── 3. 결과 확인 — 자리표시자가 남아 있으면 그대로 게시하면 안 된다 ──────────
LEFT=$(grep -c "'__ADMIN_UID__'" infra/firebase/firestore.rules.local || true)
[[ $LEFT -eq 0 ]] || { echo "✗ firestore.rules.local 에 자리표시자가 ${LEFT}곳 남았습니다 — 치환 규칙을 확인하세요" >&2; exit 1; }

echo "✓ firestore.rules.local 생성 (uid $ADMIN_UID · $(grep -c "$ADMIN_UID" infra/firebase/firestore.rules.local)곳 치환)"
echo "  Firebase 콘솔 > Firestore Database > 규칙 에 **전체 교체**로 붙여넣고 [게시] 하세요."
