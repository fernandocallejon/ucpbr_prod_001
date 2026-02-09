using './main.bicep'

param environment = 'prod'
param location = 'brazilsouth'
param projectName = 'retailnexus'

// Secrets — MUST be provided via env vars or Key Vault reference at deploy time
param jwtSecret = readEnvironmentVariable('JWT_SECRET', '')
param api2cartApiKey = readEnvironmentVariable('API2CART_API_KEY', '')
param serperApiKey = readEnvironmentVariable('SERPER_API_KEY', '')
param stripeSecretKey = readEnvironmentVariable('STRIPE_SECRET_KEY', '')
param stripeWebhookSecret = readEnvironmentVariable('STRIPE_WEBHOOK_SECRET', '')
param stripePriceBasic = 'price_1SyNnpRUlyH1pGaGTEyesqvS'
param stripePricePro = 'price_1SyNoARUlyH1pGaGIGHS5IGg'
param stripePriceEnterprise = 'price_1SyNoPRUlyH1pGaG9SZZv3Iz'
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('GOOGLE_CLIENT_SECRET', '')
param googleRedirectUri = 'https://retailnexus-prod-api.azurewebsites.net/api/google/callback'
param googleMerchantId = readEnvironmentVariable('GOOGLE_MERCHANT_ID', '')
param googleClientEmail = readEnvironmentVariable('GOOGLE_CLIENT_EMAIL', '')
param googlePrivateKey = readEnvironmentVariable('GOOGLE_PRIVATE_KEY', '')
param googleIndexingQuotaPerDay = '200'
