# Azure Infrastructure Deployment

## Pré-requisitos

- Azure CLI instalado (`az --version`)
- Conta Azure com subscription ativa
- Permissão para criar Resource Groups

## Deploy Dev

```bash
# Login
az login

# Criar Resource Group
az group create --name rg-retailnexus-dev --location brazilsouth

# Deploy
az deployment group create \
  --resource-group rg-retailnexus-dev \
  --template-file main.bicep \
  --parameters main.bicepparam
```

## Deploy Prod

```bash
az group create --name rg-retailnexus-prod --location brazilsouth

az deployment group create \
  --resource-group rg-retailnexus-prod \
  --template-file main.bicep \
  --parameters main.prod.bicepparam
```

## Recursos Provisionados

| Recurso | SKU Dev | SKU Prod |
|---------|---------|----------|
| Cosmos DB | Serverless | Serverless |
| Redis | Basic C0 | Standard C1 |
| Service Bus | Basic | Standard |
| Functions | Consumption (Y1) | Elastic Premium (EP1) |
| Key Vault | Standard | Standard |
| App Insights | Log Analytics | Log Analytics |

## Pós-Deploy

1. Configurar secrets no Key Vault:
   - `JWT_SECRET`
   - `API2CART_API_KEY`
   - `SERPER_API_KEY`
   - `GOOGLE_PRIVATE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

2. Configurar CORS no Function App (se necessário)

3. Deploy do código:
   ```bash
   cd apps/api
   npm run build
   func azure functionapp publish retailnexus-dev-api
   ```
