#!/usr/bin/env bash
# Deploy BillFlow to AWS (S3 + CloudFront + API Gateway + Lambda + DynamoDB).
# Prerequisites: AWS CLI v2, AWS SAM CLI, Node 20+, bun (or npm).
#
# Usage:
#   cd aws
#   ./deploy.sh                 # first-time guided deploy
#   ./deploy.sh --frontend-only # rebuild + sync SPA + invalidate cache

set -euo pipefail
APP=billflow
STAGE=prod
REGION="${AWS_REGION:-ap-south-1}"
STACK="${APP}-${STAGE}"

cd "$(dirname "$0")"

# 1. Install Lambda deps
echo "==> Installing Lambda dependencies"
( cd lambda && npm install --omit=dev )

if [[ "${1:-}" != "--frontend-only" ]]; then
  echo "==> Deploying CloudFormation stack ($STACK) in $REGION"
  sam deploy \
    --stack-name "$STACK" \
    --region "$REGION" \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --parameter-overrides AppName=$APP Stage=$STAGE
fi

# 2. Read outputs
get_output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET=$(get_output SiteBucketName)
CF_DOMAIN=$(get_output CloudFrontDomain)
API_URL=$(get_output ApiEndpoint)

echo "==> Bucket:      $BUCKET"
echo "==> CloudFront:  https://$CF_DOMAIN"
echo "==> API:         $API_URL"

# 3. Build the SPA pointing at CloudFront /api
echo "==> Building frontend (SPA)"
cd ..
VITE_API_URL="/api" bun run build:spa

# Locate the static client output (TanStack Start emits to dist/client by default,
# falls back to dist/ if a custom config is used).
DIST_DIR="dist/client"
[[ -d "$DIST_DIR" ]] || DIST_DIR="dist"
echo "==> Using build output: $DIST_DIR"

# 4. Sync to S3
echo "==> Syncing $DIST_DIR/ to s3://$BUCKET"
aws s3 sync "$DIST_DIR/" "s3://$BUCKET" --delete \
  --cache-control "public,max-age=31536000,immutable" --exclude "index.html"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" --cache-control "no-cache"

# 5. Invalidate CloudFront
DIST_ID=$(aws cloudfront list-distributions --query \
  "DistributionList.Items[?DomainName=='$CF_DOMAIN'].Id" --output text)
echo "==> Invalidating CloudFront distribution $DIST_ID"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo ""
echo "✅ Done. Open: https://$CF_DOMAIN"
