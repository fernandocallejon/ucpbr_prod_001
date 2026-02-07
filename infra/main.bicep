// ============================================================
// RetailNexus — Azure Infrastructure as Code (Bicep)
// Complete Azure resource provisioning
// ============================================================

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string = 'retailnexus'

// ─── Variables ───
var prefix = '${projectName}-${environment}'
var tags = {
  project: projectName
  environment: environment
  managedBy: 'bicep'
}

// ═══════════════════════════════════════════════════════════
// Cosmos DB Account + Database + Containers
// ═══════════════════════════════════════════════════════════

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: '${prefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosAccount
  name: 'retailnexus'
  properties: {
    resource: {
      id: 'retailnexus'
    }
  }
}

// Container definitions
var containers = [
  { name: 'tenants', partitionKey: '/id' }
  { name: 'stores', partitionKey: '/tenantId' }
  { name: 'products', partitionKey: '/tenantId' }
  { name: 'competitor-prices', partitionKey: '/ean' }
  { name: 'price-history', partitionKey: '/tenantId' }
  { name: 'scan-jobs', partitionKey: '/tenantId' }
  { name: 'ucp-signals', partitionKey: '/ean' }
  { name: 'google-sync-log', partitionKey: '/tenantId' }
  { name: 'seller-profiles', partitionKey: '/tenantId' }
  { name: 'system-config', partitionKey: '/id' }
  { name: 'audit-log', partitionKey: '/tenantId' }
  { name: 'global-pricing-rules', partitionKey: '/id' }
]

resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = [for container in containers: {
  parent: cosmosDatabase
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        automatic: true
        indexingMode: 'consistent'
      }
      defaultTtl: -1
    }
  }
}]

// ═══════════════════════════════════════════════════════════
// Azure Cache for Redis
// ═══════════════════════════════════════════════════════════

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${prefix}-redis'
  location: location
  tags: tags
  properties: {
    sku: {
      name: environment == 'prod' ? 'Standard' : 'Basic'
      family: 'C'
      capacity: environment == 'prod' ? 1 : 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Azure Service Bus
// ═══════════════════════════════════════════════════════════

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${prefix}-sb'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Basic'
    tier: environment == 'prod' ? 'Standard' : 'Basic'
  }
}

var queues = [
  'scan-requests'
  'price-calculations'
  'google-push'
  'store-sync'
]

resource serviceBusQueues 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = [for queue in queues: {
  parent: serviceBus
  name: queue
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: true
  }
}]

// ═══════════════════════════════════════════════════════════
// App Service Plan + Function App
// ═══════════════════════════════════════════════════════════

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: environment == 'prod' ? 'EP1' : 'Y1'
    tier: environment == 'prod' ? 'ElasticPremium' : 'Dynamic'
  }
  properties: {
    reserved: true // Linux
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: replace('${prefix}sa', '-', '')
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosAccount.properties.documentEndpoint
        }
        {
          name: 'COSMOS_KEY'
          value: cosmosAccount.listKeys().primaryMasterKey
        }
        {
          name: 'COSMOS_DATABASE'
          value: 'retailnexus'
        }
        {
          name: 'REDIS_URL'
          value: 'rediss://:${redis.listKeys().primaryKey}@${redis.properties.hostName}:${redis.properties.sslPort}'
        }
        {
          name: 'SERVICE_BUS_CONNECTION'
          value: serviceBus.listKeys().primaryConnectionString
        }
        {
          name: 'NODE_ENV'
          value: environment
        }
      ]
      cors: {
        allowedOrigins: [
          'http://localhost:3000'
          'https://${prefix}-web.azurestaticapps.net'
        ]
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Azure Key Vault (for secrets)
// ═══════════════════════════════════════════════════════════

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Grant Function App access to Key Vault
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
  }
}

// ═══════════════════════════════════════════════════════════
// Application Insights (Monitoring)
// ═══════════════════════════════════════════════════════════

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${prefix}-ai'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ═══════════════════════════════════════════════════════════
// Outputs
// ═══════════════════════════════════════════════════════════

output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output redisHostName string = redis.properties.hostName
output serviceBusNamespace string = serviceBus.name
output keyVaultName string = keyVault.name
output appInsightsKey string = appInsights.properties.InstrumentationKey
