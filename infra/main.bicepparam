using './main.bicep'

param environment = 'dev'
param location = 'brazilsouth'
param projectName = 'retailnexus'

// Secrets — provide via env vars or --parameters at deploy time
// az deployment group create ... --parameters jwtSecret='xxx' api2cartApiKey='xxx' ...
param jwtSecret = readEnvironmentVariable('JWT_SECRET', 'dev-jwt-secret-change-in-production-min32chars!')
param api2cartApiKey = readEnvironmentVariable('API2CART_API_KEY', '2ec12463054c6db4da33c2daff717d0a')
param serperApiKey = readEnvironmentVariable('SERPER_API_KEY', '')
param stripeSecretKey = readEnvironmentVariable('STRIPE_SECRET_KEY', '')
param stripeWebhookSecret = readEnvironmentVariable('STRIPE_WEBHOOK_SECRET', '')
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('GOOGLE_CLIENT_SECRET', '')
param googleRedirectUri = 'https://retailnexus-dev-api.azurewebsites.net/api/google/callback'
param googleMerchantId = ''
param googleClientEmail = ''
param googlePrivateKey = ''
param googleIndexingQuotaPerDay = '200'
