# UCPBR / RetailNexus — Plano Completo de Desenvolvimento

> **Versão:** 2.0 · **Data:** 07/02/2026  
> **Classificação:** Interno — Documento Vivo  
> **Atualização v2:** Adequação completa ao modelo UCP (Universal Commerce Processor) do Google

---

## PARTE 1 — ENTENDIMENTO COMPLETO DO SAAS

### 1.1 Visão Geral

**RetailNexus (UCPBR)** é uma plataforma SaaS B2B de **precificação dinâmica e competitiva** para lojistas de e-commerce, projetada para dominar o **UCP (Universal Commerce Processor)** — a nova camada de busca transacional do Google (SGE, Gemini, Shopping Graph).

> **Conceito Central:** O UCP não é um buscador de links. É um **Agente de Compra Pessoal** que busca entregar respostas conclusivas: "A melhor opção é o Produto X, vendido pela Loja Y, por R$ Z." O RetailNexus garante que **Loja Y seja o nosso cliente**.

O sistema opera em 7 etapas:

1. **Conecta** lojas de qualquer plataforma (Shopify, WooCommerce, VTEX, Magento) via API2Cart.
2. **Sincroniza** catálogo completo com dados enriquecidos (frete, devolução, avaliações, GTIN obrigatório).
3. **Monitora** preços de concorrentes em tempo real usando a Serper API (Google Shopping).
4. **Decide** automaticamente o melhor preço com base em regras de margem do lojista.
5. **Atualiza** o preço diretamente na loja do cliente de forma **atômica** (loja primeiro, depois expõe).
6. **Notifica o Google** via Content API for Shopping e Indexing API ("Pulo do Gato" — push de preço em tempo real).
7. **Expõe** dados estruturados perfeitos (JSON-LD Schema.org completo + endpoint MCP) para que o UCP/Gemini recomende o cliente como #1.

### 1.1.1 Os 4 Pilares de Confiança do UCP

O UCP decide quem recomendar com base em 4 pilares. O RetailNexus alimenta **todos**:

| Pilar UCP | O que o Google busca | Como o RetailNexus entrega |
|---|---|---|
| **1. Identidade Inequívoca** | "Isso é realmente o produto pedido?" | GTIN/EAN-13 obrigatório, validado e indexado |
| **2. Disponibilidade Real** | "Se eu mandar o usuário, ele consegue comprar?" | Sync de estoque em tempo real via API2Cart webhooks |
| **3. Competitividade** | "Este é o melhor preço do momento?" | Price Engine + push instantâneo ao Google Merchant Center |
| **4. Experiência** | "O site é rápido e seguro?" | Seller Trust Score calculado + dados de frete/devolução enriquecidos |

### 1.2 Proposta de Valor

| Dor do Lojista | Como o RetailNexus Resolve |
|---|---|
| Monitorar concorrentes manualmente | Automação via Serper API + Google Shopping |
| Perder o "Buy Box" por centavos | Algoritmo de undercutting automático |
| Integrar múltiplas plataformas | API2Cart abstrai Shopify/VTEX/Magento/Woo |
| Não aparecer em buscas IA | JSON-LD Schema.org completo + endpoint MCP + push ao Google |
| Precificar abaixo do custo por erro | Margem mínima de segurança configurável |
| Google recomenda o concorrente e não eu | Push de preço atualizado via Content API for Shopping |
| Dados desatualizados causam ban do Google | Consistência Atômica: atualiza loja ANTES de expor dado ao UCP |
| Não ter dados de frete/devolução estruturados | Enriquecimento automático de shippingDetails + returnPolicy |

### 1.3 Perfis de Usuário

| Perfil | Descrição | Funcionalidades Principais |
|---|---|---|
| **Lojista (Tenant)** | Cliente pagante, dono de e-commerce | Conectar loja, definir margens, ver dashboard de preços |
| **Root (Admin)** | Administrador da plataforma RetailNexus | Gerenciar API quotas, margem global, planos, saúde do sistema |

### 1.4 Modelo de Negócio (Planos)

| Plano | Frequência de Scan | SKUs | Funcionalidades |
|---|---|---|---|
| **Basic** | 1x por dia (24h) | Até 500 | Dashboard básico, alertas por email |
| **Pro** | 4x por dia (6h) | Até 5.000 | Dashboard avançado, regras customizadas |
| **Enterprise** | Tempo real (event-driven) | Ilimitado | API dedicada, SLA, suporte prioritário |

### 1.5 Fluxos Críticos do Sistema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. CONNECT  │────>│  2. SYNC     │────>│  3. SCAN     │────>│  4. PRICE    │
│  (API2Cart)  │     │  (Products)  │     │  (Serper)    │     │  (Engine)    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                      │
                                                              ┌───────┴───────┐
                                                              │               │
                                                         ┌────▼────┐   ┌──────▼──────┐
                                                         │ UPDATE  │   │ EXPOSE MCP  │
                                                         │ (Loja)  │   │ (JSON-LD)   │
                                                         └─────────┘   └─────────────┘
```

### 1.6 Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | React + TypeScript + Tailwind CSS | Performance, ecossistema, Azure Static Web Apps |
| **API Gateway** | Azure API Management | Rate limiting, auth, analytics |
| **Backend** | Azure Functions (Node.js/TypeScript) | Serverless, custo por execução, escalabilidade |
| **Price Engine** | Azure Container Apps (Node.js) | Isolamento, processamento pesado, auto-scale |
| **Banco de Dados** | Azure Cosmos DB (NoSQL) | Multi-region, latência <10ms, modelagem flexível |
| **Cache** | Azure Redis Cache | Hot cache para MCP endpoint, TTL dinâmico |
| **Filas** | Azure Service Bus | Desacoplamento, retry policies, dead letter |
| **Monitoramento** | Azure Application Insights | Logs, métricas, alertas |
| **Auth** | Azure AD B2C ou Auth0 | Multi-tenant, OAuth 2.0, MFA |
| **CI/CD** | GitHub Actions + Azure DevOps | Deploy automatizado |

### 1.7 Integrações Externas

| Serviço | Propósito | Modelo de Cobrança |
|---|---|---|
| **API2Cart** | Ponte universal para e-commerce platforms | Por loja conectada/mês |
| **Serper API** | Dados de Google Shopping (preços concorrentes) | Por consulta (credits) |
| **Google Content API for Shopping** | Push de preços/estoque ao Merchant Center em tempo real | Gratuito (requer Merchant Center account) |
| **Google Indexing API** | Notificar Google sobre mudanças de preço instantaneamente | Gratuito (quota diária) |
| **Stripe** | Pagamentos e billing dos planos | % por transação |
| **SendGrid/Resend** | Emails transacionais e alertas | Por email enviado |

---

## PARTE 2 — MODELAGEM DE DADOS (Cosmos DB)

### 2.1 Containers e Partition Keys

```
┌─────────────────────────────────────────────────────┐
│ Database: retailnexus-db                            │
├─────────────────────┬───────────────────────────────┤
│ Container           │ Partition Key                 │
├─────────────────────┼───────────────────────────────┤
│ tenants             │ /tenantId                     │
│ stores              │ /tenantId                     │
│ products            │ /tenantId                     │
│ price-history       │ /productId                    │
│ competitor-prices   │ /ean                          │
│ scan-jobs           │ /tenantId                     │
│ pricing-rules       │ /tenantId                     │
│ audit-log           │ /tenantId                     │
│ system-config       │ /configType                   │
│ seller-profiles     │ /tenantId          (NOVO UCP) │
│ ucp-signals         │ /ean               (NOVO UCP) │
│ google-sync-log     │ /tenantId          (NOVO UCP) │
└─────────────────────┴───────────────────────────────┘
```

### 2.2 Schemas Principais

```typescript
// Tenant (Cliente)
interface Tenant {
  id: string;                   // UUID
  tenantId: string;             // = id (partition key)
  type: "tenant";
  name: string;
  email: string;
  plan: "basic" | "pro" | "enterprise";
  status: "active" | "suspended" | "trial";
  settings: {
    defaultMinMargin: number;   // Ex: 10 (%) 
    currency: string;           // "BRL"
    locale: string;             // "pt-BR"
    country: string;            // "BR" — UCP: applicableCountry
    notificationPrefs: {
      email: boolean;
      webhook: boolean;
    };
  };
  // 🆕 UCP: Integração Google Merchant Center
  googleMerchantCenter: {
    accountId: string | null;       // Google Merchant Center Account ID
    connected: boolean;
    lastSyncAt: string | null;
    accessToken: string | null;     // Encrypted
    refreshToken: string | null;    // Encrypted
  };
  billing: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: string;   // ISO date
  };
  createdAt: string;
  updatedAt: string;
}

// Store (Loja conectada)
interface Store {
  id: string;
  tenantId: string;
  type: "store";
  platform: "shopify" | "woocommerce" | "vtex" | "magento" | "custom";
  name: string;
  url: string;
  api2cartStoreKey: string;     // Chave da loja no API2Cart
  credentials: {
    encrypted: string;          // Credenciais criptografadas (AES-256)
  };
  syncStatus: "pending" | "syncing" | "synced" | "error";
  lastSyncAt: string | null;
  productCount: number;
  webhookId: string | null;
  // 🆕 UCP: Dados de frete e devolução padrão da loja
  shippingDefaults: {
    freeShippingAbove: number | null;  // Frete grátis acima de X
    defaultShippingRate: number;       // Custo padrão de frete (BRL)
    handlingTimeDays: { min: number; max: number }; // 0-1 dia
    transitTimeDays: { min: number; max: number };  // 1-5 dias
  };
  returnPolicy: {
    returnDays: number;              // Ex: 30 dias
    returnMethod: "by_mail" | "in_store" | "both";
    freeReturn: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// Product (Produto normalizado) — 🆕 UCP COMPLIANT
interface Product {
  id: string;
  tenantId: string;
  storeId: string;
  type: "product";
  externalId: string;           // ID na plataforma original
  
  // ╔════════════════════════════════════════════╗
  // ║ PILAR 1 UCP: IDENTIDADE INEQUÍVOCA         ║
  // ╚════════════════════════════════════════════╝
  name: string;
  description: string;          // 🆕 UCP: Descrição rica do produto
  sku: string;
  gtin13: string;               // 🆕 CRÍTICO UCP: GTIN/EAN-13 OBRIGATÓRIO (não mais nullable)
  brand: {                      // 🆕 UCP: Marca estruturada
    name: string;
  };
  imageUrl: string;
  category: string | null;
  itemCondition: "new" | "used" | "refurbished";  // 🆕 UCP: Condição do item

  // ╔════════════════════════════════════════════╗
  // ║ PILAR 2 UCP: DISPONIBILIDADE REAL          ║
  // ╚════════════════════════════════════════════╝
  currentPrice: number;
  costPrice: number | null;
  quantity: number;
  availability: "InStock" | "OutOfStock" | "PreOrder" | "BackOrder"; // 🆕 UCP: Schema.org availability

  // ╔════════════════════════════════════════════╗
  // ║ PILAR 3 UCP: COMPETITIVIDADE (FRESHNESS)   ║
  // ╚════════════════════════════════════════════╝
  priceValidUntil: string;      // 🆕 UCP: ISO date, dinamic (hoje + 1 dia)
  priceLastUpdatedAt: string;   // 🆕 UCP: Timestamp da última atualização de preço
  pricingRule: {
    minMarginPercent: number;
    maxPrice: number | null;
    minPrice: number | null;
    strategy: "undercut" | "match" | "manual";
    enabled: boolean;
  };
  competitiveData: {
    winningPrice: number | null;
    winningSource: string | null;
    myPosition: number | null;
    lastScanAt: string | null;
    competitorCount: number;
  };

  // ╔════════════════════════════════════════════╗
  // ║ PILAR 4 UCP: EXPERIÊNCIA (SELLER METRICS)  ║
  // ╚════════════════════════════════════════════╝
  shippingDetails: {            // 🆕 UCP: Obrigatório para ranking
    shippingRate: number;       // 0.00 = frete grátis
    currency: string;
    handlingTime: { min: number; max: number; unit: "d" };
    transitTime: { min: number; max: number; unit: "d" };
  };
  returnPolicy: {               // 🆕 UCP: Política de devolução
    returnDays: number;         // Ex: 30
    returnMethod: "by_mail" | "in_store" | "both";
    applicableCountry: string;  // "BR"
  };
  aggregateRating: {            // 🆕 UCP: Avaliações (aumenta chance de conversão)
    ratingValue: number | null; // 4.5
    reviewCount: number;        // 127
    bestRating: number;         // 5
  } | null;
  
  // 🆕 UCP: Google Merchant Center sync status
  googleMerchantSync: {
    lastPushAt: string | null;
    pushStatus: "synced" | "pending" | "error" | "never";
    merchantProductId: string | null;
  };

  status: "active" | "paused" | "out_of_stock" | "no_gtin" | "pending_enrichment";
  createdAt: string;
  updatedAt: string;
}

// CompetitorPrice (Snapshot de preço concorrente)
interface CompetitorPrice {
  id: string;
  ean: string;
  productId: string;
  tenantId: string;
  type: "competitor-price";
  source: string;               // "Amazon", "Mercado Livre", etc.
  sourceUrl: string;
  price: number;
  currency: string;
  position: number;             // Posição no Google Shopping
  scannedAt: string;
  serperQueryId: string;
}

// PriceHistory (Log de mudança de preço)
interface PriceHistory {
  id: string;
  productId: string;
  tenantId: string;
  type: "price-history";
  previousPrice: number;
  newPrice: number;
  reason: "competitive_adjustment" | "manual" | "rule_change" | "margin_floor";
  winningPriceAtTime: number | null;
  appliedToStore: boolean;
  googlePushSent: boolean;      // 🆕 UCP: Push enviado ao Google?
  googlePushStatus: "sent" | "failed" | "skipped" | null; // 🆕 UCP
  createdAt: string;
}

// 🆕 SellerProfile (Perfil de confiança do vendedor — Pilar 4 UCP)
interface SellerProfile {
  id: string;
  tenantId: string;
  storeId: string;
  type: "seller-profile";
  trustScore: number;           // 0-100, calculado pela RetailNexus
  metrics: {
    uptimePercent: number;      // % de tempo que a loja esteve online
    avgResponseTimeMs: number;  // Velocidade média da página
    returnRate: number;         // % de devoluções
    positiveFeedbackRate: number; // % de reviews positivos
    timeActiveDays: number;     // Dias ativo na plataforma
    priceParityScore: number;   // % de consistência preço JSON = preço checkout
    gtinCoverage: number;       // % de produtos com GTIN válido
  };
  coreWebVitals: {
    lcp: number | null;         // Largest Contentful Paint (ms)
    fid: number | null;         // First Input Delay (ms)
    cls: number | null;         // Cumulative Layout Shift
    lastCheckedAt: string | null;
  } | null;
  calculatedAt: string;
}

// 🆕 UCPSignal (Cache de dados prontos para servir ao UCP)
interface UCPSignal {
  id: string;
  ean: string;                  // Partition key
  tenantId: string;
  productId: string;
  type: "ucp-signal";
  // Payload pré-calculado (JSON-LD ready)
  payload: {
    productName: string;
    brand: string;
    description: string;
    imageUrl: string;
    gtin13: string;
    price: number;
    currency: string;
    priceValidUntil: string;    // ISO date (dinâmico: agora + TTL do plano)
    availability: string;       // "https://schema.org/InStock"
    itemCondition: string;      // "https://schema.org/NewCondition"
    url: string;                // URL com UTM
    shippingRate: number;
    shippingCurrency: string;
    handlingTimeMin: number;
    handlingTimeMax: number;
    transitTimeMin: number;
    transitTimeMax: number;
    returnDays: number;
    returnMethod: string;
    returnCountry: string;
    ratingValue: number | null;
    reviewCount: number;
    sellerTrustScore: number;
  };
  // Metadata
  lastPriceUpdateAt: string;    // Quando o preço mudou pela última vez
  lastGooglePushAt: string | null;  // Quando foi pushado ao Merchant Center
  parityVerified: boolean;      // Preço JSON === Preço Checkout?
  parityCheckedAt: string | null;
  ttlSeconds: number;           // TTL do cache baseado no plano
  expiresAt: number;            // TTL para Cosmos (auto-delete)
  createdAt: string;
  updatedAt: string;
}

// 🆕 GoogleSyncLog (Registro de push ao Merchant Center)
interface GoogleSyncLog {
  id: string;
  tenantId: string;
  productId: string;
  type: "google-sync-log";
  action: "price_update" | "availability_update" | "full_sync" | "indexing_request";
  api: "content_api" | "indexing_api";
  request: {
    merchantProductId: string;
    payload: Record<string, unknown>;
  };
  response: {
    status: number;
    body: string;
    latencyMs: number;
  };
  success: boolean;
  createdAt: string;
}
```

---

## PARTE 3 — PLANO DE DESENVOLVIMENTO (FASES)

### FASE 0 — Fundação (Semanas 1-3)

**Objetivo:** Setup do repositório, infraestrutura base e pipeline CI/CD.

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 0.1 | Setup monorepo (Turborepo/Nx) com packages: `web`, `api`, `shared`, `price-engine` | P0 | 2 |
| 0.2 | Provisionar infraestrutura Azure via Terraform/Bicep (Cosmos DB, Functions, Redis, APIM) | P0 | 3 |
| 0.3 | Configurar GitHub Actions: lint, test, build, deploy (staging + prod) | P0 | 2 |
| 0.4 | Setup de autenticação (Azure AD B2C ou Auth0) com multi-tenant | P0 | 3 |
| 0.5 | Modelar Cosmos DB: criar containers, indexes, TTL policies | P0 | 2 |
| 0.6 | Criar shared types/interfaces (TypeScript) para todo o sistema | P0 | 1 |
| 0.7 | Setup Azure Key Vault para secrets (API keys, connection strings) | P0 | 1 |
| 0.8 | Configurar Application Insights + alertas básicos | P1 | 1 |

**Entregável:** Infra rodando, deploy automatizado, auth funcionando, banco criado.

---

### FASE 1 — Integração E-commerce via API2Cart (Semanas 4-7)

**Objetivo:** Lojista consegue conectar sua loja e ver produtos sincronizados.

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 1.1 | Implementar API2Cart SDK wrapper (TypeScript) | P0 | 3 |
| 1.2 | Azure Function `ConnectStore`: fluxo OAuth + armazenamento de credenciais | P0 | 4 |
| 1.3 | Azure Function `SyncProducts`: chamada `product.list`, normalização, gravação no Cosmos | P0 | 5 |
| 1.4 | Webhook receiver: `product.update` + `product.delete` → atualizar Cosmos em tempo real | P0 | 3 |
| 1.5 | Upload CSV de preço de custo (para quando API não retorna `cost_price`) | P1 | 3 |
| 1.6 | **🆕 UCP: Sistema de GTIN Enforcement** — Validar EAN-13, alertar produtos sem GTIN, bloquear precificação sem GTIN | P0 | 3 |
| 1.7 | **🆕 UCP: Coleta de dados de frete** — Extrair shippingDetails da plataforma via API2Cart ou input manual | P0 | 3 |
| 1.8 | **🆕 UCP: Coleta de política de devolução** — Config padrão por Store (returnDays, returnMethod) | P0 | 2 |
| 1.9 | **🆕 UCP: Coleta de avaliações** — Extrair aggregateRating da plataforma ou input manual | P1 | 2 |
| 1.10 | Frontend: Tela "Add Store" com logos das plataformas + fluxo de conexão + config de frete/devolução | P0 | 5 |
| 1.11 | Frontend: Lista de produtos com **UCP Readiness Score** (% de dados completos para UCP) | P0 | 4 |
| 1.12 | Testes de integração com API2Cart sandbox | P0 | 2 |
| 1.13 | Retry logic + dead letter queue para falhas de sync | P1 | 2 |

**Entregável:** Lojista conecta loja → vê produtos com UCP Readiness Score → sabe exatamente o que falta para ser recomendado pela IA.

---

### FASE 2 — Motor de Inteligência Competitiva (Semanas 8-11)

**Objetivo:** Sistema escaneia Google Shopping e identifica preços concorrentes.

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 2.1 | Implementar Serper API client (TypeScript) com rate limiting | P0 | 2 |
| 2.2 | Azure Function `MarketScanner`: construção de queries otimizadas por EAN/nome | P0 | 4 |
| 2.3 | Parser de resultados Serper → normalização para `CompetitorPrice` | P0 | 3 |
| 2.4 | Sistema de filas (Azure Service Bus) para processamento em batch por plano | P0 | 3 |
| 2.5 | Cron scheduler: Basic (24h), Pro (6h), Enterprise (event-driven) | P0 | 3 |
| 2.6 | Identificação do "Winning Price" e posição do cliente no ranking | P0 | 2 |
| 2.7 | Frontend: Dashboard competitivo (posição no Google Shopping, preço x concorrentes) | P0 | 5 |
| 2.8 | Controle de quota Serper por tenant (metering) | P1 | 2 |
| 2.9 | Fallback: tratar produtos sem EAN (busca por nome + marca) | P1 | 2 |

**Entregável:** Para cada produto, o sistema mostra: posição no Google Shopping, preço vencedor, concorrentes.

---

### FASE 3 — Motor de Precificação Dinâmica + Push Google (Semanas 12-16)

**Objetivo:** Sistema decide, aplica preços E notifica o Google instantaneamente ("O Pulo do Gato").

> **🆕 UCP INSIGHT:** O fluxo DEVE ser atômico: (1) Calcular preço → (2) Atualizar loja real → (3) Push ao Google Merchant Center → (4) Atualizar cache MCP. Nunca expor dado ao UCP antes de atualizar a loja (Price Mismatch = BAN).

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 3.1 | Azure Container App: `PriceEngine` — serviço isolado de cálculo | P0 | 3 |
| 3.2 | Algoritmo de undercutting: Winning Price - configurável (ex: -R$0.01 ou -1%) | P0 | 3 |
| 3.3 | Validação de margem mínima: nunca precificar abaixo de custo + margem | P0 | 2 |
| 3.4 | **Ação 1 (LOJA PRIMEIRO):** `product.update` via API2Cart → atualizar preço na loja real | P0 | 3 |
| 3.5 | **🆕 Ação 2 (PUSH GOOGLE):** Integração com Google Content API for Shopping — push de preço/estoque ao Merchant Center | P0 | 5 |
| 3.6 | **🆕 Ação 2b (INDEXING API):** Chamar Google Indexing API para notificar mudança de preço na URL do produto | P0 | 3 |
| 3.7 | **Ação 3 (CACHE MCP):** Gravar UCPSignal no Redis hot cache (só APÓS confirmação da loja) | P0 | 2 |
| 3.8 | **🆕 Price Parity Validator:** Verificar que preço no JSON === preço no checkout antes de expor | P0 | 3 |
| 3.9 | Gravar PriceHistory + GoogleSyncLog no Cosmos (audit trail completo) | P0 | 2 |
| 3.10 | **🆕 Google Merchant Center OAuth:** Fluxo de conexão da conta Merchant Center do lojista | P0 | 4 |
| 3.11 | Frontend: Regras de precificação por produto (margem, estratégia, on/off) | P0 | 4 |
| 3.12 | Frontend: Histórico de preços com gráfico temporal + status do push Google | P1 | 3 |
| 3.13 | Dry-run mode: simular precificação sem aplicar (para novos clientes) | P1 | 2 |
| 3.14 | Circuit breaker: pausar precificação se detectar anomalia (preço 90% abaixo da média) | P1 | 2 |

**O Fluxo Atômico Completo ("The Perfect Flow"):**
```
[Serper detecta concorrente mais barato]
        │
        ▼
[PriceEngine calcula novo preço]
        │
        ▼
[Ação 1] API2Cart: product.update na loja real ────┐
        │                                              │ Confirmação
        ▼                                              │
[Ação 2] Google Content API: push preço/estoque ◄───┘
        │
        ▼
[Ação 2b] Google Indexing API: notify URL changed
        │
        ▼
[Ação 3] Redis: atualizar UCPSignal cache
        │
        ▼
[Resultado] UCP lê preço atualizado em <60s
           Concorrente ainda está indexado com preço antigo
           → NOSSO CLIENTE VENCE
```

**Entregável:** Precificação automática com push instantâneo ao Google. O cliente vence a corrida de indexação.

---

### FASE 4 — Camada UCP: Dados Estruturados + MCP Endpoint (Semanas 17-21)

**Objetivo:** Construir a "Fábrica de Pacotes de Dados Perfeitos" que alimenta o UCP/Gemini com exatamente o que ele precisa para recomendar o cliente.

> **🆕 UCP INSIGHT:** O UCP não quer HTML. Ele quer Dados Estruturados Semânticos de alta fidelidade. O RetailNexus deve gerar JSON-LD Schema.org COMPLETO (não simplificado) com todos os campos que o Google Shopping Graph consome.

#### 4A. JSON-LD Schema.org Completo (O Payload Crítico)

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 4.1 | **Gerador JSON-LD Full Compliance** — `@type: Product` + `Offer` conforme spec UCP (todos os campos abaixo) | P0 | 5 |
| 4.2 | Campo `gtin13`: GTIN/EAN-13 validado (checksum digit) | P0 | 1 |
| 4.3 | Campo `brand`: Objeto `{@type: Brand, name}` estruturado | P0 | 1 |
| 4.4 | Campo `offers.price` + `priceCurrency` + `priceValidUntil` (dinâmico: hoje + 1 dia) | P0 | 2 |
| 4.5 | Campo `offers.availability`: mapeamento `InStock`/`OutOfStock`/`PreOrder` baseado em quantity real | P0 | 1 |
| 4.6 | Campo `offers.itemCondition`: `NewCondition`/`UsedCondition`/`RefurbishedCondition` | P0 | 1 |
| 4.7 | **🆕 `offers.shippingDetails`**: Objeto completo `OfferShippingDetails` com `shippingRate`, `handlingTime`, `transitTime` | P0 | 3 |
| 4.8 | **🆕 `offers.hasMerchantReturnPolicy`**: Objeto `MerchantReturnPolicy` com `returnDays`, `returnMethod`, `applicableCountry` | P0 | 2 |
| 4.9 | **🆕 `aggregateRating`**: Objeto `AggregateRating` com `ratingValue`, `reviewCount`, `bestRating` | P1 | 2 |
| 4.10 | **Validação de Paridade:** Pre-flight check — preço no JSON DEVE ser idêntico ao preço no checkout | P0 | 2 |

**Exemplo de Output JSON-LD Completo (O que o UCP quer ver):**
```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Nike Air Zoom Pegasus 40",
  "image": "https://loja-cliente.com/img/pegasus40.jpg",
  "description": "Tênis ideal para maratonas...",
  "sku": "NK-PEG-40-BLK",
  "gtin13": "0196607548902",
  "brand": { "@type": "Brand", "name": "Nike" },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "reviewCount": "127",
    "bestRating": "5"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://loja-cliente.com/p/nike-pegasus-40?utm_source=retailnexus-ucp",
    "priceCurrency": "BRL",
    "price": "489.90",
    "priceValidUntil": "2026-02-08",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "0.00",
        "currency": "BRL"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 0, "maxValue": 1, "unitCode": "d"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": 1, "maxValue": 3, "unitCode": "d"
        }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "BR",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30,
      "returnMethod": "https://schema.org/ReturnByMail"
    }
  }
}
```

#### 4B. Endpoints MCP e Distribuição

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 4.11 | Endpoint REST `GET /api/mcp/offers/{ean}` — retorna UCPSignal do Redis com headers `Last-Modified` | P0 | 2 |
| 4.12 | Endpoint `GET /api/mcp/jsonld/{ean}` — retorna JSON-LD puro (para embed no site do cliente) | P0 | 2 |
| 4.13 | **Endpoint MCP Protocol** (especificação Anthropic) para consulta por agentes de IA | P0 | 4 |
| 4.14 | **🆕 Embeddable Script Generator** — gera `<script type="application/ld+json">` dinâmico para o site do cliente | P0 | 3 |
| 4.15 | **🆕 HTTP Headers UCP-Optimized:** `Last-Modified`, `Cache-Control`, `ETag` em todas as respostas MCP | P0 | 2 |
| 4.16 | Cache layer (Redis): TTL dinâmico baseado no plano (Basic: 24h, Pro: 6h, Enterprise: 5min) | P0 | 2 |
| 4.17 | Métricas: quantas vezes o endpoint MCP foi consultado (por tenant/produto/origem) | P1 | 2 |

#### 4C. Seller Trust Score (Pilar 4 UCP)

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 4.18 | **🆕 Algoritmo Seller Trust Score (0-100)** baseado em: | P0 | 4 |
|     | • Uptime da loja (%) | | |
|     | • Price Parity Score (% de consistência preço JSON vs checkout) | | |
|     | • GTIN Coverage (% de produtos com GTIN válido) | | |
|     | • Tempo ativo na plataforma | | |
|     | • Taxa de devolução | | |
|     | • Feedback rate positivo | | |
| 4.19 | **🆕 Core Web Vitals Checker** — Verificar periodicamente LCP/FID/CLS do site do cliente | P2 | 3 |
| 4.20 | Frontend: Dashboard "UCP Health" — mostra score do seller, GTIN coverage, parity status | P0 | 4 |

**Entregável:** O UCP recebe dados estruturados perfeitos, frescos e consistentes. O cliente aparece como recomendação #1.

---

### FASE 5 — Painel Root / Admin + UCP Oversight (Semanas 23-25)

**Objetivo:** Administrador controla a plataforma inteira E monitora compliance UCP de todos os tenants.

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 5.1 | Dashboard de integridade: status API2Cart, Serper, Google APIs, Cosmos, Redis | P0 | 3 |
| 5.2 | Gestão de tenants: listar, suspender, alterar plano | P0 | 3 |
| 5.3 | Gestor de margem global (override de emergência) | P0 | 2 |
| 5.4 | Controle de frequência por plano (Business Model Enforcer) | P0 | 2 |
| 5.5 | Monitor de API quotas (API2Cart, Serper, Google Content API, Indexing API) | P0 | 2 |
| 5.6 | Log de erros centralizado com filtros (por tenant, por function, por severidade) | P1 | 3 |
| 5.7 | Gestão de webhooks: listar, re-registrar, diagnosticar falhas | P1 | 2 |
| 5.8 | **🆕 UCP Compliance Overview:** Visão cross-tenant de GTIN Coverage, Price Parity Score, Seller Trust Score | P0 | 3 |
| 5.9 | **🆕 Google Sync Monitor:** Status de push ao Merchant Center de todos os tenants (success/fail rates) | P0 | 2 |
| 5.10 | **🆕 UCP Ban Risk Alert:** Alerta automático quando Price Parity Score cai abaixo de 99% para qualquer tenant | P0 | 2 |

**Entregável:** Admin tem visibilidade e controle total do sistema + pode identificar e agir sobre riscos UCP antes que causem ban.

---

### FASE 6 — Billing, Onboarding e Polish (Semanas 22-25)

**Objetivo:** Produto pronto para monetizar.

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 6.1 | Integração Stripe: checkout, subscription management, portal do cliente | P0 | 5 |
| 6.2 | Metering de uso: SKUs ativos, scans realizados, atualizações de preço | P0 | 3 |
| 6.3 | Flow de onboarding guiado (wizard) para novos clientes | P0 | 4 |
| 6.4 | Emails transacionais: bem-vindo, alerta de preço, subscription, erros | P0 | 3 |
| 6.5 | Landing page pública (marketing site) | P1 | 5 |
| 6.6 | Documentação da API pública (para Enterprise) | P1 | 3 |
| 6.7 | Testes E2E completos (Playwright) | P0 | 4 |
| 6.8 | Pentest básico + hardening de segurança | P0 | 3 |

**Entregável:** Produto monetizável, onboarding suave, seguro.

---

### FASE 7 — Launch & Escala (Semanas 26-28)

| # | Task | Prioridade | Dias |
|---|---|---|---|
| 7.1 | Beta fechado com 10-20 lojistas reais | P0 | 7 |
| 7.2 | Coleta de feedback + ajustes | P0 | 5 |
| 7.3 | Load testing (k6/Artillery) — simular 1000 tenants | P0 | 3 |
| 7.4 | Configurar auto-scaling (Container Apps + Functions) | P0 | 2 |
| 7.5 | Go-live público | P0 | 1 |
| 7.6 | Runbook de operações (incidentes, rollback, escalation) | P1 | 2 |

---

## PARTE 4 — ARQUITETURA DE AZURE FUNCTIONS

### 4.1 Mapa de Functions

```
functions/
├── auth/
│   ├── register/              POST /api/auth/register
│   ├── login/                 POST /api/auth/login
│   └── callback/              GET  /api/auth/callback/{provider}
│
├── stores/
│   ├── connect/               POST /api/stores/connect
│   ├── disconnect/            DELETE /api/stores/{storeId}
│   ├── sync/                  POST /api/stores/{storeId}/sync
│   ├── webhook-receiver/      POST /api/webhooks/api2cart
│   ├── list/                  GET  /api/stores
│   ├── update-shipping/       PATCH /api/stores/{storeId}/shipping      🆕 UCP
│   └── update-return-policy/  PATCH /api/stores/{storeId}/return-policy 🆕 UCP
│
├── products/
│   ├── list/                  GET  /api/products
│   ├── get/                   GET  /api/products/{productId}
│   ├── update-cost/           PATCH /api/products/{productId}/cost
│   ├── upload-costs-csv/      POST /api/products/costs/csv
│   ├── update-pricing-rule/   PATCH /api/products/{productId}/pricing-rule
│   ├── gtin-validate/         POST /api/products/{productId}/gtin       🆕 UCP
│   ├── gtin-bulk-upload/      POST /api/products/gtin/csv               🆕 UCP
│   └── ucp-readiness/         GET  /api/products/{productId}/ucp-score  🆕 UCP
│
├── scanning/
│   ├── trigger-scan/          POST /api/scan/trigger
│   ├── scan-worker/           (Service Bus triggered)
│   └── scan-scheduler/        (Timer triggered — cron)
│
├── pricing/
│   ├── calculate/             (Service Bus triggered)
│   ├── apply/                 (Service Bus triggered — "The Atomic Flow")
│   ├── history/               GET  /api/products/{productId}/price-history
│   └── parity-check/          (Timer triggered — valida preço JSON vs checkout)  🆕 UCP
│
├── google/                                                              🆕 UCP
│   ├── merchant-connect/      POST /api/google/merchant/connect
│   ├── merchant-callback/     GET  /api/google/merchant/callback
│   ├── content-api-push/      (Service Bus triggered — push preço ao Merchant Center)
│   ├── indexing-api-notify/   (Service Bus triggered — notify URL changed)
│   ├── sync-status/           GET  /api/google/sync-status
│   └── sync-log/              GET  /api/google/sync-log
│
├── ucp/                                                                 🆕 UCP
│   ├── offers/                GET  /api/ucp/offers/{ean}  (Redis hot cache)
│   ├── jsonld/                GET  /api/ucp/jsonld/{ean}  (JSON-LD completo)
│   ├── jsonld-embed/          GET  /api/ucp/embed/{storeId}/{ean}  (script tag)
│   ├── mcp-protocol/          POST /api/ucp/mcp  (Anthropic MCP spec)
│   ├── seller-score/          GET  /api/ucp/seller/{tenantId}/score
│   └── health/                GET  /api/ucp/health/{tenantId}  (UCP readiness)
│
├── admin/
│   ├── tenants/               GET/PATCH /api/admin/tenants
│   ├── system-health/         GET  /api/admin/health
│   ├── global-rules/          GET/PUT /api/admin/global-rules
│   ├── api-quotas/            GET  /api/admin/quotas
│   ├── google-sync-overview/  GET  /api/admin/google/overview            🆕 UCP
│   └── ucp-compliance/        GET  /api/admin/ucp/compliance             🆕 UCP
│
└── billing/
    ├── stripe-webhook/        POST /api/billing/webhook
    ├── create-checkout/       POST /api/billing/checkout
    └── portal/                GET  /api/billing/portal
```

### 4.2 Fluxo de Dados (Event-Driven) — UCP Atomic Flow

```
[Cron/Manual Trigger]
        │
        ▼
  ┌─────────────────┐     ┌──────────────────────┐
  │ scan-scheduler   │────>│ Service Bus Queue     │
  │ (Timer Function) │     │ "scan-requests"       │
  └─────────────────┘     └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ scan-worker           │
                          │ (Serper API call)     │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │ Service Bus Queue     │
                          │ "price-calculations"  │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ PriceEngine           │
                          │ (Container App)       │
                          └──────────┬───────────┘
                                     │
                          ╔══════════╧══════════════════════════════╗
                          ║     "THE ATOMIC FLOW" (UCP Critical)   ║
                          ╠════════════════════════════════════════╣
                          ║                                        ║
                          ║  STEP 1: API2Cart product.update       ║
                          ║  (Atualiza preço na loja REAL)         ║
                          ║         │                              ║
                          ║         ▼ ✅ Confirmado                ║
                          ║  STEP 2: Google Content API push       ║
                          ║  (Push preço/estoque ao Merchant Ctr)  ║
                          ║         │                              ║
                          ║         ▼                              ║
                          ║  STEP 3: Google Indexing API notify    ║
                          ║  (Pedir re-crawl da URL do produto)    ║
                          ║         │                              ║
                          ║         ▼                              ║
                          ║  STEP 4: Redis UCPSignal cache update  ║
                          ║  (JSON-LD pronto para servir ao UCP)   ║
                          ║         │                              ║
                          ║         ▼                              ║
                          ║  STEP 5: Cosmos DB audit trail         ║
                          ║  (PriceHistory + GoogleSyncLog)        ║
                          ║                                        ║
                          ╚════════════════════════════════════════╝
                                     │
                                     ▼
                          [UCP/Gemini consulta endpoint]
                          [Preço já atualizado em <60s]
                          [Concorrente ainda com preço antigo]
                          [→ NOSSO CLIENTE É RECOMENDADO #1]
```

### 4.3 Fluxo de Parity Check (verificação contínua)

```
[Timer: a cada 15min]
        │
        ▼
  ┌──────────────────────┐
  │ parity-check         │
  │ (Timer Function)     │
  └──────────┬───────────┘
             │ Para cada produto ativo:
             ▼
  ┌──────────────────────┐     ┌──────────────────────┐
  │ Lê UCPSignal (Redis) │────>│ Verifica preço real   │
  │ preço exposto ao UCP │     │ via API2Cart get      │
  └──────────────────────┘     └──────────┬───────────┘
                                          │
                               ┌──────────▼───────────┐
                               │ preço JSON ≠ preço    │
                               │ checkout?             │
                               └──────────┬───────────┘
                                    │           │
                                   SIM         NÃO
                                    │           │
                          ┌─────────▼──┐  ┌────▼─────────┐
                          │ ALERTA!     │  │ ✅ Paridade  │
                          │ Pausar MCP  │  │ confirmada   │
                          │ + resyncar  │  │ Score ++     │
                          └────────────┘  └──────────────┘
```

---

## PARTE 5 — FRONTEND (PÁGINAS E COMPONENTES)

### 5.1 Mapa de Rotas

```
/                                → Landing page (público)
/login                           → Login
/register                        → Registro
/onboarding                      → Wizard de setup (inclui Google Merchant Center)
│
/dashboard                       → Home do tenant (resumo geral + UCP Score)
/dashboard/stores                → Lista de lojas conectadas
/dashboard/stores/add            → Conectar nova loja (incl. frete + devolução)
/dashboard/stores/:id/shipping   → Config de frete da loja               🆕 UCP
/dashboard/stores/:id/returns    → Config de política de devolução       🆕 UCP
/dashboard/products              → Lista de produtos com UCP Readiness Score
/dashboard/products/:id          → Detalhe do produto (preço, concorrentes, histórico)
/dashboard/products/gtin         → Gestão de GTIN: faltantes, upload CSV 🆕 UCP
/dashboard/rules                 → Regras de precificação globais
/dashboard/ucp-health            → Dashboard UCP Health (score, parity, GTIN coverage) 🆕 UCP
/dashboard/google                → Status de conexão Google Merchant Center 🆕 UCP
/dashboard/google/sync-log       → Log de push ao Google (Content API + Indexing) 🆕 UCP
/dashboard/analytics             → Relatórios e gráficos
/dashboard/settings              → Configurações da conta
/dashboard/billing               → Plano e pagamento
│
/admin                           → Dashboard root
/admin/tenants                   → Gestão de tenants
/admin/tenants/:id/ucp           → UCP compliance do tenant específico    🆕 UCP
/admin/health                    → Saúde do sistema (incl. Google APIs)
/admin/quotas                    → Quotas de API (incl. Indexing API)
/admin/global-rules              → Regras globais de emergência
/admin/ucp-overview              → Visão geral UCP de todos os tenants    🆕 UCP
```

### 5.2 Componentes Principais

| Componente | Descrição |
|---|---|
| `<StoreConnector />` | Card com logos de plataformas + fluxo OAuth |
| `<ShippingConfigForm />` | Form de config de frete (rates, handling/transit time) | 🆕 UCP |
| `<ReturnPolicyForm />` | Form de política de devolução (dias, método) | 🆕 UCP |
| `<ProductTable />` | Tabela paginada com filtros, status de preço, UCP score |
| `<UCPReadinessBadge />` | Badge com % de completude UCP: 🟢 >90% \| 🟡 60-90% \| 🔴 <60% | 🆕 UCP |
| `<GTINManager />` | Painel de gestão GTIN: validação, upload CSV, cobertura | 🆕 UCP |
| `<CompetitorChart />` | Gráfico bar chart: seu preço vs concorrentes |
| `<PriceHistoryGraph />` | Line chart temporal + marcadores de push ao Google |
| `<PricingRuleEditor />` | Form para editar margem, estratégia, on/off |
| `<PositionBadge />` | Badge colorido: 🟢 1º \| 🟡 2º-3º \| 🔴 4º+ |
| `<ScanStatusIndicator />` | Mostra última atualização + countdown para próximo scan |
| `<GoogleMerchantConnector />` | Fluxo de OAuth p/ Google Merchant Center | 🆕 UCP |
| `<GoogleSyncStatus />` | Status do último push ao Google (Content API + Indexing) | 🆕 UCP |
| `<PriceParityIndicator />` | Indicador de paridade: preço JSON vs checkout | 🆕 UCP |
| `<SellerTrustScoreCard />` | Card com Trust Score (0-100) + breakdown dos fatores | 🆕 UCP |
| `<UCPHealthDashboard />` | Dashboard completo: score, parity, GTIN%, Google sync | 🆕 UCP |
| `<JSONLDPreview />` | Pré-visualização do JSON-LD que será exposto ao Google | 🆕 UCP |
| `<EmbedCodeGenerator />` | Gera snippet `<script>` p/ colar no site do cliente | 🆕 UCP |
| `<SystemHealthPanel />` | Painel admin com status de APIs externas (incl. Google) |
| `<QuotaUsageBar />` | Barra de progresso de uso de API quota |

---

## PARTE 6 — SEGURANÇA E COMPLIANCE

### 6.1 Requisitos

| Área | Implementação |
|---|---|
| **Autenticação** | OAuth 2.0 + JWT, MFA opcional |
| **Multi-tenancy** | Row-level isolation via `tenantId` em todas as queries |
| **Criptografia** | Credenciais de loja criptografadas com AES-256 (Azure Key Vault) |
| **Rate Limiting** | APIM policies por plano (Basic: 100 req/min, Enterprise: 1000 req/min) |
| **LGPD** | Consentimento explícito, data export, right to delete |
| **Audit Trail** | Toda ação de precificação logada com timestamp, motivo, valores |
| **Secrets** | Zero secrets no código; tudo via Azure Key Vault / Environment Variables |
| **🆕 Google OAuth Tokens** | Refresh tokens do Merchant Center criptografados em Key Vault, rotação automática |
| **🆕 UCP Data Integrity** | Price Parity Validator previne exposição de dados inconsistentes ao Google |
| **🆕 GTIN Validation** | Checksum digit verificado antes de expor ao UCP; GTIN inválido = produto bloqueado |

---

## PARTE 7 — KPIs E MÉTRICAS DO PRODUTO

### 7.1 Métricas de Negócio

| Métrica | Descrição | Meta Inicial |
|---|---|---|
| **MRR** | Monthly Recurring Revenue | R$ 50k em 6 meses |
| **Churn** | Taxa de cancelamento mensal | < 5% |
| **NPS** | Net Promoter Score | > 50 |
| **Attach Rate** | % de SKUs com precificação ativa | > 70% |
| **Win Rate** | % de vezes que o cliente é posição #1 no Google Shopping | > 40% |
| **UCP Recommend Rate** | % de buscas IA onde o cliente aparece como #1 | > 25% | 🆕 UCP |

### 7.2 Métricas Técnicas

| Métrica | SLA |
|---|---|
| Uptime | 99.9% |
| Latência API (p99) | < 500ms |
| Latência UCP endpoint (p99) | < 50ms | 🆕 (mais agressivo para IA) |
| Sync delay (webhook → DB) | < 30s |
| Price update (decisão → loja) | < 60s |
| Google push (loja → Merchant Center) | < 30s | 🆕 UCP |
| Atomic flow total (scan → UCP ready) | < 120s | 🆕 UCP |

### 7.3 Métricas UCP Compliance (Novos KPIs) 🆕

| Métrica | Descrição | Meta |
|---|---|---|
| **GTIN Coverage** | % de produtos ativos com GTIN-13 válido | > 95% |
| **Price Parity Score** | % de verificações onde preço JSON = preço checkout | > 99.5% |
| **UCP Readiness Score** | Score médio de completude de dados UCP por tenant | > 85/100 |
| **Google Push Success Rate** | % de pushes ao Merchant Center com status 200 | > 99% |
| **Seller Trust Score (avg)** | Score médio de confiança dos sellers ativos | > 75/100 |
| **Freshness Index** | % de produtos com `priceValidUntil` < 24h | > 98% |
| **Shipping Data Coverage** | % de produtos com `shippingDetails` completo | > 90% |
| **Return Policy Coverage** | % de lojas com `MerchantReturnPolicy` configurado | 100% |

---

## PARTE 8 — ESTIMATIVAS E TIMELINE

### 8.1 Resumo de Timeline (Atualizado para UCP Compliance)

| Fase | Duração | Acumulado | Mudança vs v1 |
|---|---|---|---|
| **Fase 0** — Fundação | 3 semanas | Semana 3 | = |
| **Fase 1** — API2Cart + UCP Data Collection | 5 semanas | Semana 8 | +1 (GTIN, frete, devolução) |
| **Fase 2** — Serper Intelligence | 4 semanas | Semana 12 | = |
| **Fase 3** — Price Engine + Google Push | 5 semanas | Semana 17 | +1 (Content API, Indexing API, Parity) |
| **Fase 4** — UCP Layer: JSON-LD + MCP + Trust Score | 5 semanas | Semana 22 | +2 (JSON-LD completo, embeds, parity, trust score) |
| **Fase 5** — Admin Panel + UCP Oversight | 3 semanas | Semana 25 | = |
| **Fase 6** — Billing & Polish | 4 semanas | Semana 29 | = |
| **Fase 7** — Launch | 3 semanas | **Semana 32** | = |

**Total estimado: ~8 meses** (com equipe de 2-3 devs full-stack + 1 DevOps part-time).

> **Nota:** O aumento de 7→8 meses é justificado pela complexidade das integrações Google (Content API + Indexing API + OAuth Merchant Center) e pela necessidade de garantir Price Parity (o UCP bane lojas com dados inconsistentes).

### 8.2 Custos Azure Estimados (Mês, Produção Inicial)

| Recurso | Estimativa/mês |
|---|---|
| Cosmos DB (400 RU/s) | ~$25 |
| Azure Functions (Consumption) | ~$5-20 |
| Container Apps (1 replica) | ~$30 |
| Redis Cache (Basic C0) | ~$15 |
| API Management (Developer) | ~$50 |
| Static Web Apps (Free) | $0 |
| Key Vault | ~$1 |
| Application Insights | ~$5 |
| **Total Azure** | **~$130-150/mês** |

| Serviço Externo | Estimativa/mês |
|---|---|
| API2Cart (100 lojas) | ~$500 |
| Serper API (50k queries) | ~$50 |
| Stripe (fees) | ~2.9% + $0.30/tx |
| **Total Externo** | **~$600/mês** |

---

## PARTE 9 — RISCOS E MITIGAÇÕES

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| API2Cart muda pricing/limites | Alto | Médio | Camada de abstração; ready para migrar para APIs nativas |
| Serper API indisponível | Alto | Baixo | Cache de último scan; alerta imediato; fallback manual |
| Lojista precifica abaixo do custo | Crítico | Médio | Margem mínima obrigatória + circuit breaker + alertas |
| Google muda formato Shopping | Médio | Médio | Parser resiliente; testes de regressão semanais |
| Vazamento de credenciais de loja | Crítico | Baixo | AES-256 + Key Vault + audit log + rotação de chaves |
| Cosmos DB throttling | Médio | Médio | Auto-scale RUs; partition strategy otimizada |
| **🆕 Price Mismatch → BAN do UCP** | **Crítico** | **Médio** | Price Parity Validator a cada 15min; pausar MCP endpoint se detectar divergência; alerta imediato ao lojista |
| **🆕 Google Content API rate limit** | Alto | Médio | Queue com backoff exponencial; priorizar produtos com mais tráfego; batch updates |
| **🆕 Google Indexing API quota** | Médio | Médio | Quota diária de ~200 URLs; priorizar por delta de preço significativo (>5%); fallback para sitemap ping |
| **🆕 GTIN ausente em catálogo** | Alto | Alto | GTIN Enforcement: produtos sem GTIN não entram no UCP; wizard guiado para preenchimento; upload CSV em massa |
| **🆕 Mudança no Schema.org spec** | Médio | Baixo | Gerador de JSON-LD versionado; testes de validação com Schema.org Validator; alertas de depreciação |
| **🆕 Google Merchant Center desconectado** | Alto | Médio | Health check automático do OAuth token; alerta ao lojista 7 dias antes de expirar; re-auth flow simplificado |

---

## PARTE 10 — PRÓXIMOS PASSOS IMEDIATOS

### Sprint 0 — Kickoff (Primeira Semana)

**Infraestrutura:**
- [ ] Criar repositório monorepo no GitHub
- [ ] Definir estrutura de pastas do projeto
- [ ] Provisionar resource group no Azure
- [ ] Setup Terraform/Bicep para IaC
- [ ] Configurar GitHub Actions (CI básico)
- [ ] Implementar primeiro `Hello World` em Azure Functions
- [ ] Criar Cosmos DB com containers base (incluindo `seller-profiles`, `ucp-signals`, `google-sync-log`)
- [ ] Scaffold do frontend React + routing

**Contas e APIs:**
- [ ] Criar account API2Cart (sandbox)
- [ ] Criar account Serper (dev key)
- [ ] Criar account Stripe (test mode)
- [ ] 🆕 Criar projeto no Google Cloud Console (para Content API for Shopping)
- [ ] 🆕 Configurar OAuth consent screen para Google Merchant Center
- [ ] 🆕 Habilitar Google Content API for Shopping + Indexing API no projeto GCP
- [ ] 🆕 Gerar credenciais OAuth 2.0 (Client ID + Secret) para Merchant Center

**UCP Foundation:**
- [ ] 🆕 Documentar spec completa do JSON-LD Schema.org target (Product + Offer + shippingDetails + returnPolicy)
- [ ] 🆕 Criar validador de GTIN-13 (checksum) como módulo shared
- [ ] 🆕 Prototipar gerador de JSON-LD com dados fake para validar no Google Rich Results Test
- [ ] 🆕 Definir thresholds do Seller Trust Score (faixas de 0-100)

---

> **Este documento será atualizado a cada fase concluída. Versão atual: 2.0 (UCP Compliant)**
