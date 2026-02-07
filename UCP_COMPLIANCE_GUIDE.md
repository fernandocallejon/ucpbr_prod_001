# UCP Compliance Guide — RetailNexus

> **Bíblia de Integração UCP** para o time de engenharia.  
> Referência: Guia de Engenharia Reversa do UCP do Google.

---

## 1. O Que é o UCP

O **UCP (Universal Commerce Processor)** é a camada de busca transacional do Google (SGE, Gemini, Shopping Graph). Não é um buscador de links — é um **Agente de Compra Pessoal** que entrega respostas conclusivas:

> *"A melhor opção é o Tênis X, vendido pela Loja Y, por R$ 489,00. Entrega em 2 dias."*

O RetailNexus garante que **Loja Y seja nosso cliente**.

---

## 2. Os 4 Pilares de Confiança do UCP

### Pilar 1: Identidade Inequívoca
**Pergunta do UCP:** "Isso é *realmente* o produto que o usuário pediu?"

| Requisito | Campo | Obrigatório | Implementação RetailNexus |
|---|---|---|---|
| GTIN/EAN-13 | `gtin13` | **SIM** | Validação de checksum + GTIN Enforcement (sem GTIN = sem UCP) |
| Nome do produto | `name` | SIM | Sincronizado via API2Cart |
| Marca estruturada | `brand.name` | SIM | Objeto `{@type: Brand, name}` |
| SKU | `sku` | SIM | Sincronizado via API2Cart |
| Condição | `itemCondition` | SIM | `NewCondition` / `UsedCondition` / `RefurbishedCondition` |
| Imagem | `image` | SIM | URL absoluta da imagem principal |
| Descrição | `description` | SIM | Descrição rica do produto |

**Regra RetailNexus:** Produto sem `gtin13` válido recebe status `no_gtin` e NÃO é exposto ao UCP.

### Pilar 2: Disponibilidade Real
**Pergunta do UCP:** "Se eu mandar o usuário agora, ele consegue comprar?"

| Requisito | Campo | Implementação RetailNexus |
|---|---|---|
| Estoque em tempo real | `availability` | Sync via API2Cart webhooks (`product.update`) |
| Mapeamento Schema.org | `offers.availability` | `InStock` / `OutOfStock` / `PreOrder` / `BackOrder` |

**Regra RetailNexus:** Produto com `quantity = 0` é automaticamente marcado `OutOfStock` no JSON-LD e removido do cache UCP.

### Pilar 3: Competitividade (Price Freshness)
**Pergunta do UCP:** "Este é o melhor preço do momento?"

| Requisito | Campo | Implementação RetailNexus |
|---|---|---|
| Preço atualizado | `offers.price` | PriceEngine calcula e aplica via Atomic Flow |
| Validade do preço | `offers.priceValidUntil` | Dinâmico: `hoje + 1 dia` (recalculado a cada update) |
| Moeda | `offers.priceCurrency` | `BRL` (configurável por tenant) |
| Freshness headers | `Last-Modified`, `ETag` | HTTP headers em todos os endpoints UCP |

**Regra Crítica:** O UCP **BANE** lojas com Price Mismatch (preço no JSON ≠ preço no checkout). O Atomic Flow garante: `loja primeiro → expor depois`.

### Pilar 4: Experiência (Seller Metrics)
**Pergunta do UCP:** "O site é rápido e seguro?"

| Requisito | Campo | Implementação RetailNexus |
|---|---|---|
| Frete | `offers.shippingDetails` | `OfferShippingDetails` com rates, handling time, transit time |
| Devolução | `offers.hasMerchantReturnPolicy` | `MerchantReturnPolicy` com dias, método, país |
| Avaliações | `aggregateRating` | `AggregateRating` com rating, count, bestRating |
| Core Web Vitals | (sinal externo) | Checker periódico de LCP/FID/CLS |
| Seller Trust Score | (calculado) | Algoritmo interno 0-100 baseado em múltiplos fatores |

---

## 3. JSON-LD Schema.org — Template Completo

Este é o formato **exato** que o RetailNexus deve gerar para cada produto:

```json
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "{{product.name}}",
  "image": "{{product.imageUrl}}",
  "description": "{{product.description}}",
  "sku": "{{product.sku}}",
  "gtin13": "{{product.gtin13}}",
  "brand": {
    "@type": "Brand",
    "name": "{{product.brand.name}}"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "{{product.aggregateRating.ratingValue}}",
    "reviewCount": "{{product.aggregateRating.reviewCount}}",
    "bestRating": "{{product.aggregateRating.bestRating}}"
  },
  "offers": {
    "@type": "Offer",
    "url": "{{store.url}}/p/{{product.slug}}?utm_source=retailnexus-ucp",
    "priceCurrency": "{{tenant.settings.currency}}",
    "price": "{{product.currentPrice}}",
    "priceValidUntil": "{{tomorrow_iso_date}}",
    "availability": "https://schema.org/{{product.availability}}",
    "itemCondition": "https://schema.org/{{product.itemCondition}}Condition",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "{{product.shippingDetails.shippingRate}}",
        "currency": "{{product.shippingDetails.currency}}"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": "{{product.shippingDetails.handlingTime.min}}",
          "maxValue": "{{product.shippingDetails.handlingTime.max}}",
          "unitCode": "d"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": "{{product.shippingDetails.transitTime.min}}",
          "maxValue": "{{product.shippingDetails.transitTime.max}}",
          "unitCode": "d"
        }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "{{tenant.settings.country}}",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": "{{product.returnPolicy.returnDays}}",
      "returnMethod": "https://schema.org/ReturnByMail"
    }
  }
}
```

---

## 4. O Atomic Flow — Sequência Obrigatória

**NUNCA expor dado ao UCP antes de atualizar a loja.**

```
                    ┌─────────────────────────────┐
                    │   Price Mismatch = BAN       │
                    │   A ordem IMPORTA!           │
                    └─────────────────────────────┘

  STEP 1 ──► API2Cart: product.update (LOJA REAL)
             └───► Aguardar confirmação HTTP 200
             └───► Se falhar: ABORTAR todo o fluxo
  
  STEP 2 ──► Google Content API: push price/stock (MERCHANT CENTER)
             └───► POST products.insert ou products.update
             └───► Se falhar: retry com backoff (não bloqueia Step 3)
  
  STEP 3 ──► Google Indexing API: notify URL changed
             └───► POST para type: URL_UPDATED
             └───► Se quota excedida: enfileirar para próximo slot
  
  STEP 4 ──► Redis: atualizar UCPSignal cache
             └───► Somente após Step 1 confirmado
             └───► TTL baseado no plano do cliente
  
  STEP 5 ──► Cosmos DB: gravar audit trail
             └───► PriceHistory + GoogleSyncLog
```

**Regras de Segurança:**
- Se Step 1 falhar → **NADA mais acontece** (dados antigos permanecem)
- Se Step 2 falhar → Step 3 e 4 continuam (Google receberá no próximo ciclo)
- Se Step 4 falhar → Redis terá dado expirado, próximo request gera cache miss → recalcula

---

## 5. UCP Readiness Score — Cálculo

Cada produto recebe um score de 0-100 baseado na completude dos dados UCP:

| Campo | Peso | Pontuação |
|---|---|---|
| `gtin13` válido | 25 | 0 ou 25 |
| `price` + `priceValidUntil` < 24h | 20 | 0 ou 20 |
| `availability` sincronizado | 15 | 0 ou 15 |
| `shippingDetails` completo | 15 | 0 ou 15 |
| `hasMerchantReturnPolicy` configurado | 10 | 0 ou 10 |
| `brand` estruturado | 5 | 0 ou 5 |
| `description` preenchida (>50 chars) | 5 | 0 ou 5 |
| `aggregateRating` presente | 5 | 0 ou 5 |
| **Total** | **100** | |

**Classificação:**
- 🟢 **UCP Ready** (90-100): Produto será exposto ao UCP
- 🟡 **Quase Pronto** (60-89): Aviso ao lojista sobre campos faltantes
- 🔴 **Não Elegível** (<60): Produto NÃO é exposto ao UCP

---

## 6. Seller Trust Score — Cálculo

Score de confiança do vendedor (0-100), usado internamente e exposto como `seller_trust_score`:

| Fator | Peso | Como Medir |
|---|---|---|
| Price Parity Score | 25 | % de checks onde preço JSON = preço checkout |
| GTIN Coverage | 20 | % de produtos ativos com GTIN válido |
| Uptime da loja | 15 | % de tempo online (health checks periódicos) |
| Tempo ativo na plataforma | 10 | Dias desde criação (cap em 365d) |
| Google Push Success Rate | 10 | % de pushes ao Merchant Center com HTTP 200 |
| Feedback positivo | 10 | % de reviews positivos (se disponível) |
| Taxa de devolução | 5 | Inverso da % de devoluções |
| Core Web Vitals | 5 | LCP < 2.5s, FID < 100ms, CLS < 0.1 |

---

## 7. Integração Google — APIs Necessárias

### 7.1 Google Content API for Shopping
- **Propósito:** Push de preço/estoque ao Google Merchant Center em tempo real
- **Endpoint:** `https://shoppingcontent.googleapis.com/content/v2.1/`
- **Auth:** OAuth 2.0 (via conta Google do lojista)
- **Operações principais:**
  - `products.insert` — Cadastrar produto
  - `products.update` — Atualizar preço/estoque
  - `products.get` — Verificar status
- **Rate limit:** ~70-100 requests/segundo por conta
- **Custo:** Gratuito

### 7.2 Google Indexing API
- **Propósito:** Notificar Google para re-crawl de URL com preço atualizado
- **Endpoint:** `https://indexing.googleapis.com/v3/urlNotifications:publish`
- **Auth:** Service Account (JWT)
- **Operações:** `URL_UPDATED`, `URL_DELETED`
- **Quota:** ~200 notifications/dia por property
- **Custo:** Gratuito
- **Estratégia de priorização:**
  - Priorizar produtos com delta de preço > 5%
  - Priorizar produtos com alto tráfego (se disponível via Analytics)
  - Fallback: sitemap ping para produtos de menor prioridade

---

## 8. Checklist de Compliance UCP — Por Produto

Use esta checklist para cada produto antes de expor ao UCP:

- [ ] GTIN-13 válido (13 dígitos, checksum correto)
- [ ] Preço atualizado na loja real (API2Cart confirmou)
- [ ] `priceValidUntil` = amanhã (ISO date)
- [ ] `availability` reflete estoque real (quantity > 0 = InStock)
- [ ] `shippingDetails` preenchido (rate, handling time, transit time)
- [ ] `hasMerchantReturnPolicy` configurado (dias, método, país)
- [ ] Google Merchant Center conectado (OAuth token válido)
- [ ] Push ao Content API executado com sucesso
- [ ] Price Parity verificada (preço JSON = preço checkout)
- [ ] `brand` é objeto estruturado (não apenas string)
- [ ] `description` tem mais de 50 caracteres
- [ ] `image` é URL absoluta acessível publicamente

---

## 9. Anti-Patterns — O Que NÃO Fazer

| Anti-Pattern | Consequência | Prevenção RetailNexus |
|---|---|---|
| Expor preço antes de atualizar loja | **BAN do UCP** (Price Mismatch) | Atomic Flow: loja primeiro, UCP depois |
| JSON-LD com preço diferente do checkout | **BAN do UCP** | Price Parity Validator a cada 15min |
| GTIN inválido ou ausente | Produto invisível para comparação | GTIN Enforcement + validação de checksum |
| `priceValidUntil` no passado | UCP ignora o produto | Recalculado dinamicamente a cada request |
| Falta de `shippingDetails` | Ranking rebaixado | Obrigatório no cadastro de loja |
| Rating fabricado | Penalização pelo Google | Só usar dados reais da plataforma |
| Cache de JSON-LD com TTL longo | Dados stale expostos ao UCP | TTL dinâmico por plano (Basic: 24h, Enterprise: 5min) |

---

> **Este documento é a referência técnica #1 para qualquer decisão de engenharia que envolva dados expostos ao UCP/Google.**
