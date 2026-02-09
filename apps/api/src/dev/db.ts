// ============================================================
// UCPBR — In-Memory Database + Seed Data (Local Dev)
// ============================================================

import bcrypt from "bcryptjs";

/* ── Interfaces ──────────────────────────────────────────── */

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user" | "root";
  companyName: string;
  plan: string;
  createdAt: string;
}

export interface StoreItem {
  id: string;
  tenantId: string;
  platform: string;
  storeUrl: string;
  storeName: string;
  status: "active" | "inactive" | "syncing" | "error" | "pending";
  productCount: number;
  lastSync: string | null;
  createdAt: string;
  api2cartStoreKey?: string;
}

export interface Product {
  id: string;
  tenantId: string;
  storeId: string;
  storeName?: string;
  externalId?: string;
  gtin: string;
  title: string;
  description?: string;
  price: number;
  costPrice: number;
  stock?: number;
  imageUrl: string;
  url?: string;
  brand: string;
  category: string;
  ucpReadinessScore: number;
  ucpReadinessLevel?: "eligible" | "almost" | "not_eligible";
  availability?: string;
  lastSync?: string | null;
}

export interface PricingRule {
  id: string;
  tenantId: string;
  name: string;
  strategy: "manual" | "undercut" | "match" | "fixed_margin";
  margin?: number;
  minMargin?: number;
  maxDiscount?: number;
  targetPosition?: number;
  isActive: boolean;
  appliedProducts: number;
  createdAt: string;
}

export interface CompetitorPrice {
  id: string;
  tenantId: string;
  gtin: string;
  productTitle: string;
  myPrice: number;
  competitorName: string;
  competitorPrice: number;
  priceDiff: number;
  lastSeen: string;
  source: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  plan: "basic" | "pro" | "enterprise";
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  amount: number;
  status: "paid" | "open" | "void";
  date: string;
  pdfUrl?: string;
}

export interface TenantSettings {
  tenantId: string;
  scanIntervalMinutes: number;
  autoRepricing: boolean;
  timezone: string;
  notifyPriceChanges: boolean;
  notifyUcpAlerts: boolean;
  notifyWeeklyReport: boolean;
  minMarginThreshold: number;
  maxAutoPriceChangePercent: number;
}

export interface GmcStatus {
  tenantId: string;
  connected: boolean;
  merchantId?: string;
  email?: string;
  totalProducts: number;
  approvedProducts: number;
  disapprovedProducts: number;
  pendingProducts: number;
  lastFeedSync: string | null;
  indexingQuota: { used: number; total: number };
}

export interface IndexingLog {
  id: string;
  tenantId: string;
  url: string;
  type: "URL_UPDATED" | "URL_DELETED";
  status: "success" | "error";
  timestamp: string;
}

/* ── Database ────────────────────────────────────────────── */

export const db = {
  users: new Map<string, User>(),
  stores: new Map<string, StoreItem>(),
  products: new Map<string, Product>(),
  pricingRules: new Map<string, PricingRule>(),
  competitorPrices: [] as CompetitorPrice[],
  subscriptions: new Map<string, Subscription>(),
  invoices: [] as Invoice[],
  settings: new Map<string, TenantSettings>(),
  googleStatus: new Map<string, GmcStatus>(),
  indexingLogs: [] as IndexingLog[],
};

/* ── Helpers ─────────────────────────────────────────────── */

let counter = 100;
export function genId(): string {
  return `ucpbr_${Date.now()}_${++counter}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

/* ── Seed ────────────────────────────────────────────────── */

const TENANT_ID = "tenant_demo_001";
const STORE_1_ID = "store_shopify_001";
const STORE_2_ID = "store_woo_002";

const SEED_PRODUCTS: Omit<Product, "id" | "tenantId">[] = [
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560011", title: "iPhone 15 128GB Preto", price: 5499.00, costPrice: 4200, imageUrl: "https://placehold.co/200x200/111/fff?text=iPhone+15", brand: "Apple", category: "Smartphones", ucpReadinessScore: 92, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(2) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560028", title: "Samsung Galaxy S24 Ultra 256GB", price: 7299.00, costPrice: 5800, imageUrl: "https://placehold.co/200x200/111/fff?text=Galaxy+S24", brand: "Samsung", category: "Smartphones", ucpReadinessScore: 88, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(2) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560035", title: "MacBook Air M3 15\" 256GB", price: 12999.00, costPrice: 10500, imageUrl: "https://placehold.co/200x200/111/fff?text=MacBook+Air", brand: "Apple", category: "Notebooks", ucpReadinessScore: 95, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(3) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560042", title: "Notebook Dell Inspiron 15 i7 16GB", price: 4599.00, costPrice: 3500, imageUrl: "https://placehold.co/200x200/111/fff?text=Dell+Inspiron", brand: "Dell", category: "Notebooks", ucpReadinessScore: 78, ucpReadinessLevel: "almost", availability: "InStock", lastSync: hoursAgo(4) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560059", title: "Smart TV LG 55\" 4K OLED", price: 4299.00, costPrice: 3200, imageUrl: "https://placehold.co/200x200/111/fff?text=LG+TV+55", brand: "LG", category: "TVs", ucpReadinessScore: 85, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(1) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560066", title: "Smart TV Samsung 65\" Neo QLED", price: 6799.00, costPrice: 5200, imageUrl: "https://placehold.co/200x200/111/fff?text=Samsung+TV", brand: "Samsung", category: "TVs", ucpReadinessScore: 90, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(1) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560073", title: "AirPods Pro 2ª Geração USB-C", price: 1899.00, costPrice: 1400, imageUrl: "https://placehold.co/200x200/111/fff?text=AirPods+Pro", brand: "Apple", category: "Acessórios", ucpReadinessScore: 82, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(5) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560080", title: "Fone JBL Tune 520BT Bluetooth", price: 249.90, costPrice: 150, imageUrl: "https://placehold.co/200x200/111/fff?text=JBL+520BT", brand: "JBL", category: "Acessórios", ucpReadinessScore: 70, ucpReadinessLevel: "almost", availability: "InStock", lastSync: hoursAgo(6) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560097", title: "Mouse Logitech MX Master 3S", price: 599.90, costPrice: 380, imageUrl: "https://placehold.co/200x200/111/fff?text=MX+Master", brand: "Logitech", category: "Periféricos", ucpReadinessScore: 75, ucpReadinessLevel: "almost", availability: "InStock", lastSync: hoursAgo(3) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560103", title: "Teclado Mecânico Redragon Kumara", price: 199.90, costPrice: 110, imageUrl: "https://placehold.co/200x200/111/fff?text=Redragon", brand: "Redragon", category: "Periféricos", ucpReadinessScore: 65, ucpReadinessLevel: "almost", availability: "InStock", lastSync: hoursAgo(4) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560110", title: "Monitor Samsung 27\" Curvo 144Hz", price: 1499.00, costPrice: 1000, imageUrl: "https://placehold.co/200x200/111/fff?text=Monitor+27", brand: "Samsung", category: "Monitores", ucpReadinessScore: 88, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(2) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560127", title: "Câmera GoPro Hero 12 Black", price: 2799.00, costPrice: 2000, imageUrl: "https://placehold.co/200x200/111/fff?text=GoPro+12", brand: "GoPro", category: "Câmeras", ucpReadinessScore: 55, ucpReadinessLevel: "not_eligible", availability: "InStock", lastSync: hoursAgo(8) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560134", title: "Console PlayStation 5 Slim Digital", price: 3499.00, costPrice: 2800, imageUrl: "https://placehold.co/200x200/111/fff?text=PS5+Slim", brand: "Sony", category: "Games", ucpReadinessScore: 91, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(1) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560141", title: "Xbox Series X 1TB", price: 3299.00, costPrice: 2600, imageUrl: "https://placehold.co/200x200/111/fff?text=Xbox+X", brand: "Microsoft", category: "Games", ucpReadinessScore: 87, ucpReadinessLevel: "eligible", availability: "OutOfStock", lastSync: hoursAgo(5) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560158", title: "iPad Air M2 11\" 128GB", price: 5999.00, costPrice: 4800, imageUrl: "https://placehold.co/200x200/111/fff?text=iPad+Air", brand: "Apple", category: "Tablets", ucpReadinessScore: 93, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(2) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560165", title: "Apple Watch Series 9 45mm", price: 3499.00, costPrice: 2700, imageUrl: "https://placehold.co/200x200/111/fff?text=Watch+S9", brand: "Apple", category: "Wearables", ucpReadinessScore: 80, ucpReadinessLevel: "eligible", availability: "InStock", lastSync: hoursAgo(3) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560172", title: "Caixa de Som JBL Charge 5", price: 799.00, costPrice: 500, imageUrl: "https://placehold.co/200x200/111/fff?text=JBL+Charge5", brand: "JBL", category: "Áudio", ucpReadinessScore: 72, ucpReadinessLevel: "almost", availability: "InStock", lastSync: hoursAgo(7) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560189", title: "Kindle Paperwhite 16GB 2024", price: 649.00, costPrice: 450, imageUrl: "https://placehold.co/200x200/111/fff?text=Kindle", brand: "Amazon", category: "E-Readers", ucpReadinessScore: 45, ucpReadinessLevel: "not_eligible", availability: "InStock", lastSync: hoursAgo(12) },
  { storeId: STORE_1_ID, storeName: "TechBR Store", gtin: "7891234560196", title: "Geladeira Brastemp Frost Free 375L", price: 3299.00, costPrice: 2500, imageUrl: "https://placehold.co/200x200/111/fff?text=Brastemp", brand: "Brastemp", category: "Eletrodomésticos", ucpReadinessScore: 40, ucpReadinessLevel: "not_eligible", availability: "InStock", lastSync: hoursAgo(24) },
  { storeId: STORE_2_ID, storeName: "EletroMax", gtin: "7891234560202", title: "Aspirador Robô iRobot Roomba i5+", price: 2999.00, costPrice: 2200, imageUrl: "https://placehold.co/200x200/111/fff?text=Roomba", brand: "iRobot", category: "Eletrodomésticos", ucpReadinessScore: 50, ucpReadinessLevel: "not_eligible", availability: "OutOfStock", lastSync: hoursAgo(48) },
];

export async function seed(): Promise<void> {
  // ── User ──
  const hash = await bcrypt.hash("123456", 10);
  db.users.set("demo@ucpbr.com.br", {
    id: "user_demo_001",
    tenantId: TENANT_ID,
    email: "demo@ucpbr.com.br",
    passwordHash: hash,
    role: "admin",
    companyName: "UCPBR Demo Store",
    plan: "pro",
    createdAt: daysAgo(90),
  });

  // ── Stores ──
  db.stores.set(STORE_1_ID, {
    id: STORE_1_ID,
    tenantId: TENANT_ID,
    platform: "shopify",
    storeUrl: "https://techbr-store.myshopify.com",
    storeName: "TechBR Store",
    status: "active",
    productCount: 12,
    lastSync: hoursAgo(1),
    createdAt: daysAgo(60),
  });

  db.stores.set(STORE_2_ID, {
    id: STORE_2_ID,
    tenantId: TENANT_ID,
    platform: "woocommerce",
    storeUrl: "https://eletromax.com.br",
    storeName: "EletroMax",
    status: "active",
    productCount: 8,
    lastSync: hoursAgo(3),
    createdAt: daysAgo(30),
  });

  // ── Products ──
  for (const p of SEED_PRODUCTS) {
    const id = genId();
    db.products.set(id, { id, tenantId: TENANT_ID, ...p });
  }

  // ── Pricing Rules ──
  const rules: Omit<PricingRule, "id" | "tenantId">[] = [
    { name: "Undercut Eletrônicos", strategy: "undercut", margin: 3, minMargin: 2, maxDiscount: 8, isActive: true, appliedProducts: 8, createdAt: daysAgo(45) },
    { name: "Margem Fixa Acessórios", strategy: "fixed_margin", margin: 15, minMargin: 10, maxDiscount: 5, isActive: true, appliedProducts: 4, createdAt: daysAgo(30) },
    { name: "Match Smartphones", strategy: "match", margin: 1, minMargin: 1, maxDiscount: 3, isActive: false, appliedProducts: 3, createdAt: daysAgo(15) },
  ];
  for (const r of rules) {
    const id = genId();
    db.pricingRules.set(id, { id, tenantId: TENANT_ID, ...r });
  }

  // ── Competitor Prices (initial seed) ──
  const competitors = ["Kabum", "Pichau", "Amazon BR", "Magazine Luiza", "Casas Bahia", "Americanas", "Mercado Livre"];
  for (const [, product] of db.products) {
    if (product.tenantId !== TENANT_ID) continue;
    const numCompetitors = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numCompetitors; i++) {
      const competitor = competitors[Math.floor(Math.random() * competitors.length)];
      const variance = -12 + Math.random() * 24; // -12% to +12%
      const competitorPrice = +(product.price * (1 + variance / 100)).toFixed(2);
      const priceDiff = +((competitorPrice / product.price - 1) * 100).toFixed(1);
      db.competitorPrices.push({
        id: genId(),
        tenantId: TENANT_ID,
        gtin: product.gtin,
        productTitle: product.title,
        myPrice: product.price,
        competitorName: competitor,
        competitorPrice,
        priceDiff,
        lastSeen: hoursAgo(Math.floor(Math.random() * 12)),
        source: "serper_google_shopping",
      });
    }
  }

  // ── Subscription ──
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 22);
  db.subscriptions.set(TENANT_ID, {
    id: "sub_demo_001",
    tenantId: TENANT_ID,
    plan: "pro",
    status: "active",
    currentPeriodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
  });

  // ── Invoices ──
  for (let i = 3; i >= 1; i--) {
    db.invoices.push({
      id: `inv_demo_${i}`,
      tenantId: TENANT_ID,
      number: `UCPBR-2026-${String(4 - i).padStart(4, "0")}`,
      amount: 49700, // R$ 497,00 in cents
      status: "paid",
      date: daysAgo(i * 30),
    });
  }

  // ── Settings ──
  db.settings.set(TENANT_ID, {
    tenantId: TENANT_ID,
    scanIntervalMinutes: 240,
    autoRepricing: true,
    timezone: "America/Sao_Paulo",
    notifyPriceChanges: true,
    notifyUcpAlerts: true,
    notifyWeeklyReport: true,
    minMarginThreshold: 5,
    maxAutoPriceChangePercent: 10,
  });

  // ── Google Merchant Center ──
  const allProducts = [...db.products.values()].filter((p) => p.tenantId === TENANT_ID);
  db.googleStatus.set(TENANT_ID, {
    tenantId: TENANT_ID,
    connected: true,
    merchantId: "MC-123456789",
    email: "demo@ucpbr.com.br",
    totalProducts: allProducts.length,
    approvedProducts: allProducts.filter((p) => p.ucpReadinessScore >= 80).length,
    disapprovedProducts: allProducts.filter((p) => p.ucpReadinessScore < 50).length,
    pendingProducts: allProducts.filter((p) => p.ucpReadinessScore >= 50 && p.ucpReadinessScore < 80).length,
    lastFeedSync: hoursAgo(2),
    indexingQuota: { used: 47, total: 200 },
  });

  // ── Indexing Logs ──
  for (let i = 0; i < 15; i++) {
    const product = allProducts[i % allProducts.length];
    db.indexingLogs.push({
      id: genId(),
      tenantId: TENANT_ID,
      url: `https://techbr-store.myshopify.com/products/${product.gtin}`,
      type: Math.random() > 0.1 ? "URL_UPDATED" : "URL_DELETED",
      status: Math.random() > 0.05 ? "success" : "error",
      timestamp: hoursAgo(Math.floor(Math.random() * 48)),
    });
  }

  console.log(`  ✓ 1 tenant (demo@ucpbr.com.br / 123456)`);
  console.log(`  ✓ ${db.stores.size} stores`);
  console.log(`  ✓ ${db.products.size} products`);
  console.log(`  ✓ ${db.pricingRules.size} pricing rules`);
  console.log(`  ✓ ${db.competitorPrices.length} competitor prices`);
  console.log(`  ✓ ${db.invoices.length} invoices`);
}
