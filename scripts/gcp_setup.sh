#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/gcp_setup.sh — 인증 서버를 올릴 GCP 자리를 한 번에 만든다 (v5 Phase 7)
#
# **gcloud 가 있는 곳 어디서든 한 번 돌린다** (Cloud Shell · 로컬 · 작업 세션). 콘솔을 이리저리
# 누르면 메뉴 이름이 바뀌어 길을 잃는다. 명령은 안 바뀐다. 로그인은 `gcloud auth login` 한 번이다.
#
# 하는 일 (여러 번 돌려도 같은 결과다 — 이미 있는 것은 건너뛴다)
#   ① 프로젝트 moncamp-api-* 를 만든다 — Firebase 프로젝트와 **따로** 둔다.
#      Firebase 는 전환 2주 뒤에 지운다. 같은 프로젝트에 두면 서버까지 같이 지워진다
#   ② 결제 계정을 잇는다 — Cloud Run 무료 구간도 결제 연결은 요구한다
#   ③ **$1 예산 알림을 먼저 건다** — 이 단계를 건너뛰고 배포하지 않는다 (deploy-server.yml 머리)
#   ④ API 를 켜고 Artifact Registry 저장소 moncamp(서울)를 만든다.
#      옛 이미지는 셋만 남긴다 — 쌓이면 0.5GB 무료 구간을 넘어 $1 예산을 먼저 먹는다
#   ⑤ 배포용 서비스 계정에 역할 셋만 준다 (run.admin · iam.serviceAccountUser · artifactregistry.writer)
#   ⑥ **열쇠 파일을 만들지 않는다** — Workload Identity 로 GitHub Actions 가 열쇠 없이 들어온다.
#      이 저장소(MinsangKwak/pogo-rank)의 워크플로가 GitHub 에서 받은 짧은 신분증만 받아 준다.
#      열쇠가 없으니 새어 나갈 것도, 시크릿 칸에 붙일 것도 없다 (CLAUDE.md §4 의 걱정 자체가 사라진다)
#
# 2026-09-23 — 처음에는 열쇠 파일을 만들어 시크릿에 붙이게 했다. 주인의 망에서 Cloud Shell 이
# 막혀 있어 Claude 가 대신 돌리게 됐고, 그러면 열쇠를 사람에게 건넬 길이 대화뿐이라 방식을 바꿨다
#
# 지역은 **서울(asia-northeast3)** 이다. 개인정보처리방침 4번 표에 그렇게 적혀 있다 —
# 바꾸면 방침을 고치고 고지해야 한다 (web/src/screens/Legal.tsx).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REGION=asia-northeast3
SA_NAME=github-deployer
REPO=MinsangKwak/pogo-rank
POOL=github

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ① 프로젝트 — 라벨로 찾는다. 이름은 전 세계에서 하나여야 해서 뒤에 숫자를 붙인다
say "① 프로젝트"
PROJECT="$(gcloud projects list --filter='labels.app=moncamp' --format='value(projectId)' | head -1)"
if [ -z "$PROJECT" ]; then
  PROJECT="moncamp-api-$(date +%s | tail -c 6)"
  gcloud projects create "$PROJECT" --name='moncamp api' --labels=app=moncamp
fi
gcloud config set project "$PROJECT" >/dev/null
echo "   $PROJECT"

# ② 결제 — 열린 계정이 하나면 그것을, 여럿이면 첫 번째를 쓴다
say "② 결제 계정"
BILLING="$(gcloud billing accounts list --filter='open=true' --format='value(name)' | head -1)"
if [ -z "$BILLING" ]; then
  echo "   열린 결제 계정이 없습니다. https://console.cloud.google.com/billing 에서 하나 만든 뒤 다시 돌려 주세요"
  exit 1
fi
gcloud billing projects link "$PROJECT" --billing-account="$BILLING" >/dev/null
echo "   ${BILLING##*/}"

# ③ 예산 — 결제 계정의 통화로 건다. 원화 계정에 1USD 를 넣으면 거절된다
say "③ 예산 알림 (\$1 상당)"
gcloud services enable billingbudgets.googleapis.com >/dev/null
CURRENCY="$(gcloud billing accounts describe "$BILLING" --format='value(currencyCode)' 2>/dev/null || true)"
case "${CURRENCY:-USD}" in
  KRW) AMOUNT=1500KRW ;;
  JPY) AMOUNT=150JPY ;;
  *)   AMOUNT="1${CURRENCY:-USD}" ;;
esac
if gcloud billing budgets list --billing-account="$BILLING" --format='value(displayName)' | grep -qx 'moncamp-api'; then
  echo "   이미 있음"
else
  gcloud billing budgets create --billing-account="$BILLING" --display-name='moncamp-api' \
    --budget-amount="$AMOUNT" --filter-projects="projects/$PROJECT" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 >/dev/null
  echo "   $AMOUNT · 50% · 90% · 100% 에서 메일"
fi

# ④ API · 이미지 저장소
say "④ API · 이미지 저장소"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com >/dev/null
if ! gcloud artifacts repositories describe moncamp --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create moncamp --repository-format=docker --location="$REGION" \
    --description='moncamp 서버 이미지' >/dev/null
fi
cat > /tmp/moncamp-cleanup.json <<'JSON'
[{"name": "keep-3", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}},
 {"name": "drop-old", "action": {"type": "Delete"}, "condition": {"tagState": "any", "olderThan": "86400s"}}]
JSON
gcloud artifacts repositories set-cleanup-policies moncamp --location="$REGION" \
  --policy=/tmp/moncamp-cleanup.json --no-dry-run >/dev/null
echo "   $REGION/moncamp · 최근 3개만 남김"

# ⑤ 서비스 계정 — 역할은 셋뿐이다. Owner 를 주면 열쇠 하나가 새면 프로젝트 전체가 넘어간다
say "⑤ 배포용 서비스 계정"
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA_NAME" --display-name='GitHub Actions 배포' >/dev/null
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" \
    --condition=None >/dev/null
done
echo "   $SA"

# ⑥ Workload Identity — 이 저장소의 워크플로만 받아 준다
say "⑥ 열쇠 없는 로그인 (Workload Identity)"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com >/dev/null
NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location=global --display-name='GitHub Actions' >/dev/null
# **저장소 조건을 건다.** 빼면 GitHub 의 아무 저장소나 이 풀로 들어올 수 있다
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool="$POOL" \
       --display-name='GitHub OIDC' --issuer-uri='https://token.actions.githubusercontent.com' \
       --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' \
       --attribute-condition="assertion.repository == '$REPO'" >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" \
  --condition=None >/dev/null
PROVIDER="projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/providers/github"
echo "   $REPO 만 받아 준다"

say "끝 — 워크플로에 적을 값 (비밀이 아니다: 이름표일 뿐, 이 저장소 밖에서는 못 쓴다)"
echo "   GCP_PROJECT   $PROJECT"
echo "   GCP_PROVIDER  $PROVIDER"
echo "   GCP_SA        $SA"
