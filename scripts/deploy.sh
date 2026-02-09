#!/usr/bin/env bash
# ============================================================
# RetailNexus — Azure Production Deploy Script
# Usage: ./scripts/deploy.sh [dev|prod]
# ============================================================

set -euo pipefail

ENV="${1:-prod}"
RG="retailnexus-${ENV}"
LOCATION="brazilsouth"

echo "🚀 Deploying RetailNexus to Azure ($ENV)"
echo "────────────────────────────────────────"

# ── 1. Check prerequisites ────────────────────────────────
command -v az >/dev/null 2>&1 || { echo "❌ Azure CLI not found. Install: https://aka.ms/installazurecli" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found." >&2; exit 1; }

# ── 2. Validate environment variables ─────────────────────
REQUIRED_VARS=(
  JWT_SECRET
  API2CART_API_KEY
  SERPER_API_KEY
  STRIPE_SECRET_KEY
)

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required env var: $var"
    echo "   Export it before running: export $var='...'"
    exit 1
  fi
done

echo "✅ Environment variables validated"

# ── 3. Build shared package ───────────────────────────────
echo "📦 Building shared package..."
(cd packages/shared && npm run build)

# ── 4. Build API ──────────────────────────────────────────
echo "📦 Building API..."
(cd apps/api && npx tsc)

# ── 5. Build Frontend ─────────────────────────────────────
echo "📦 Building Frontend..."
(cd apps/web && npm run build)

# ── 6. Create Resource Group ──────────────────────────────
echo "☁️  Creating resource group: $RG..."
az group create --name "$RG" --location "$LOCATION" --output none 2>/dev/null || true

# ── 7. Deploy Infrastructure (Bicep) ─────────────────────
echo "🏗️  Deploying infrastructure..."
PARAM_FILE="infra/main.${ENV}.bicepparam"
if [[ ! -f "$PARAM_FILE" ]]; then
  PARAM_FILE="infra/main.bicepparam"
fi

az deployment group create \
  --resource-group "$RG" \
  --template-file infra/main.bicep \
  --parameters "$PARAM_FILE" \
  --output none

# Get outputs
FUNC_APP=$(az deployment group show --resource-group "$RG" --name main --query "properties.outputs.functionAppName.value" -o tsv)
SWA_NAME=$(az deployment group show --resource-group "$RG" --name main --query "properties.outputs.staticWebAppName.value" -o tsv)
API_URL=$(az deployment group show --resource-group "$RG" --name main --query "properties.outputs.functionAppUrl.value" -o tsv)
SWA_URL=$(az deployment group show --resource-group "$RG" --name main --query "properties.outputs.staticWebAppUrl.value" -o tsv)

echo "  Function App: $FUNC_APP"
echo "  Static Web App: $SWA_NAME"
echo "  API URL: $API_URL"
echo "  Web URL: $SWA_URL"

# ── 8. Deploy Function App ───────────────────────────────
echo "⚡ Deploying Function App..."
(cd apps/api && func azure functionapp publish "$FUNC_APP" --node)

# ── 9. Initialize Database ────────────────────────────────
echo "🗄️  Initializing Cosmos DB..."
curl -s -X POST "${API_URL}/api/admin/database/init" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({sub:'admin',tenantId:'admin',email:'admin@ucpbr.com.br',role:'root'},process.env.JWT_SECRET,{expiresIn:'1h'}))")" \
  | head -c 200
echo ""

# ── 10. Deploy Static Web App ─────────────────────────────
echo "🌐 Deploying Static Web App..."
SWA_TOKEN=$(az staticwebapp secrets list --name "$SWA_NAME" --query "properties.apiKey" -o tsv)
(cd apps/web && npx @azure/static-web-apps-cli deploy dist \
  --api-location "" \
  --deployment-token "$SWA_TOKEN" \
  --env production)

# ── 11. Summary ───────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ Deploy concluído!"
echo ""
echo "  🌐 Frontend: $SWA_URL"
echo "  ⚡ API:      $API_URL"
echo ""
echo "  Próximos passos:"
echo "  1. Configure DNS (app.ucpbr.com.br → SWA)"
echo "  2. Configure Stripe Webhook URL:"
echo "     ${API_URL}/api/billing/webhook"
echo "  3. Configure API2Cart Webhook URL:"
echo "     ${API_URL}/api/webhooks/api2cart"
echo "════════════════════════════════════════════════════"
