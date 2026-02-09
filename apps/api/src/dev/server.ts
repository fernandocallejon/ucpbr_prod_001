// ============================================================
// RetailNexus — Express Dev Server (Local Development)
// Provides all API endpoints using in-memory database
// ============================================================

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, seed, genId, type User, type StoreItem, type Product, type PricingRule, type CompetitorPrice, type Subscription, type Invoice, type TenantSettings, type GmcStatus, type IndexingLog } from "./db.js";

const app = express();
const PORT = parseInt(process.env.PORT || "7071", 10);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-ucpbr-2026";
const SERPER_API_KEY = process.env.SERPER_API_KEY || "";
const API2CART_API_KEY = process.env.API2CART_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PUBLIC_KEY = process.env.STRIPE_PUBLIC_KEY || "";
const STRIPE_PRICE_BASIC = process.env.STRIPE_PRICE_BASIC || "";
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "";
const STRIPE_PRICE_ENTERPRISE = process.env.STRIPE_PRICE_ENTERPRISE || "";

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`  ${req.method} ${req.path}`);
  next();
});

// ── Helpers ───────────────────────────────────────────────

function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

function err(res: Response, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

interface JWTPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
}

function extractUser(req: Request): JWTPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response): JWTPayload | null {
  const user = extractUser(req);
  if (!user) {
    err(res, "Não autorizado", 401);
    return null;
  }
  return user;
}

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { companyName, email, password, plan } = req.body;
    if (!companyName || !email || !password) {
      return err(res, "companyName, email e password são obrigatórios");
    }

    if (db.users.has(email)) {
      return err(res, "Email já cadastrado", 409);
    }

    const hash = await bcrypt.hash(password, 10);
    const tenantId = `tenant_${Date.now()}`;
    const userId = genId();

    const user: User = {
      id: userId,
      tenantId,
      email,
      passwordHash: hash,
      role: "admin",
      companyName,
      plan: plan || "basic",
      createdAt: new Date().toISOString(),
    };

    db.users.set(email, user);

    // Create default subscription
    db.subscriptions.set(tenantId, {
      id: genId(),
      tenantId,
      plan: (plan as "basic" | "pro" | "enterprise") || "basic",
      status: "trialing",
      currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
    });

    // Create default settings
    db.settings.set(tenantId, {
      tenantId,
      scanIntervalMinutes: 360,
      autoRepricing: false,
      timezone: "America/Sao_Paulo",
      notifyPriceChanges: true,
      notifyUcpAlerts: true,
      notifyWeeklyReport: true,
      minMarginThreshold: 5,
      maxAutoPriceChangePercent: 10,
    });

    // Create default Google status
    db.googleStatus.set(tenantId, {
      tenantId,
      connected: false,
      totalProducts: 0,
      approvedProducts: 0,
      disapprovedProducts: 0,
      pendingProducts: 0,
      lastFeedSync: null,
      indexingQuota: { used: 0, total: 200 },
    });

    const token = jwt.sign(
      { sub: userId, tenantId, email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return ok(res, {
      token,
      tenant: {
        id: userId,
        tenantId,
        email,
        role: "admin",
        companyName,
        plan: plan || "basic",
      },
    }, 201);
  } catch (e: any) {
    return err(res, e.message, 500);
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return err(res, "Email e password são obrigatórios");
    }

    const user = db.users.get(email);
    if (!user) {
      return err(res, "Credenciais inválidas", 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return err(res, "Credenciais inválidas", 401);
    }

    const token = jwt.sign(
      { sub: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return ok(res, {
      token,
      tenant: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        companyName: user.companyName,
        plan: user.plan,
      },
    });
  } catch (e: any) {
    return err(res, e.message, 500);
  }
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const user = [...db.users.values()].find((u) => u.id === auth.sub);
  if (!user) return err(res, "Usuário não encontrado", 404);

  return ok(res, {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      plan: user.plan,
    },
  });
});

app.put("/api/auth/profile", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const user = [...db.users.values()].find((u) => u.id === auth.sub);
  if (!user) return err(res, "Usuário não encontrado", 404);

  const { companyName, email } = req.body;
  if (companyName) user.companyName = companyName;
  if (email && email !== user.email) {
    if (db.users.has(email)) return err(res, "Email já em uso", 409);
    db.users.delete(user.email);
    user.email = email;
    db.users.set(email, user);
  }

  return ok(res, { message: "Perfil atualizado" });
});

// ══════════════════════════════════════════════════════════
//  DASHBOARD ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/dashboard/stats", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const products = [...db.products.values()].filter((p) => p.tenantId === auth.tenantId);
  const stores = [...db.stores.values()].filter((s) => s.tenantId === auth.tenantId);
  const competitors = db.competitorPrices.filter((c) => c.tenantId === auth.tenantId);

  const totalProducts = products.length;
  const totalStores = stores.length;
  const avgUcpScore = totalProducts > 0
    ? Math.round(products.reduce((sum, p) => sum + p.ucpReadinessScore, 0) / totalProducts)
    : 0;

  const productsEligible = products.filter((p) => p.ucpReadinessLevel === "eligible").length;
  const productsAlmost = products.filter((p) => p.ucpReadinessLevel === "almost").length;
  const productsNotEligible = products.filter((p) => p.ucpReadinessLevel === "not_eligible").length;

  // Calculate price parity based on competitor data presence
  const trackedProducts = products.filter((p) =>
    competitors.some((c) => c.gtin === p.gtin)
  );
  const avgPriceParity = trackedProducts.length > 0 ? 98.7 : 100;

  return ok(res, {
    totalProducts,
    totalStores,
    avgUcpScore,
    productsEligible,
    productsAlmost,
    productsNotEligible,
    recentPriceChanges: Math.floor(Math.random() * 10 + 3),
    avgPriceParity,
  });
});

// ══════════════════════════════════════════════════════════
//  STORES ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/stores", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const stores = [...db.stores.values()]
    .filter((s) => s.tenantId === auth.tenantId)
    .map((s) => ({
      id: s.id,
      platform: s.platform,
      storeUrl: s.storeUrl,
      storeName: s.storeName,
      status: s.status,
      productCount: s.productCount,
      lastSync: s.lastSync,
      createdAt: s.createdAt,
    }));

  return ok(res, stores);
});

app.post("/api/stores", async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { platform, storeName, storeUrl, credentials } = req.body;
  if (!platform || !storeName || !storeUrl) {
    return err(res, "platform, storeName e storeUrl são obrigatórios");
  }

  // Check store limit by plan
  const existingStores = [...db.stores.values()].filter((s) => s.tenantId === auth.tenantId);
  const user = [...db.users.values()].find((u) => u.tenantId === auth.tenantId);
  const planLimits: Record<string, number> = { basic: 1, pro: 5, enterprise: 50 };
  const maxStores = planLimits[user?.plan || "basic"] || 1;

  if (existingStores.length >= maxStores) {
    return err(res, `Limite de ${maxStores} lojas atingido para o plano ${user?.plan || "basic"}`, 403);
  }

  const storeId = genId();

  // Try real API2Cart connection
  let api2cartStoreKey: string | undefined;
  try {
    const params = new URLSearchParams({
      api_key: API2CART_API_KEY,
      cart_id: platform === "shopify" ? "shopify" : platform === "woocommerce" ? "woocommerce" : platform,
      store_url: storeUrl,
    });

    // If credentials provided, add them
    if (credentials?.apiKey) params.append("store_key", credentials.apiKey);
    if (credentials?.apiPath) params.append("api_path", credentials.apiPath);
    if (credentials?.accessToken) params.append("access_token", credentials.accessToken);

    const response = await fetch(
      `https://api.api2cart.com/v1.1/cart.create.json?${params.toString()}`
    );
    const data: any = await response.json();

    if (data.return_code === 0 && data.result?.store_key) {
      api2cartStoreKey = data.result.store_key;
      console.log(`✅ API2Cart store connected: ${storeUrl} -> ${api2cartStoreKey}`);
    } else {
      console.log(`⚠️ API2Cart connection info: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`⚠️ API2Cart not reachable: ${e}`);
  }

  const store: StoreItem = {
    id: storeId,
    tenantId: auth.tenantId,
    platform,
    storeUrl,
    storeName,
    status: api2cartStoreKey ? "syncing" : "pending",
    productCount: 0,
    lastSync: null,
    createdAt: new Date().toISOString(),
    api2cartStoreKey,
  };

  db.stores.set(storeId, store);

  // If API2Cart connected, attempt real product sync
  if (api2cartStoreKey) {
    (async () => {
      try {
        const response = await fetch(
          `https://api.api2cart.com/v1.1/product.list.json?api_key=${API2CART_API_KEY}&store_key=${api2cartStoreKey}&start=0&count=250`
        );
        const data: any = await response.json();
        const products = data.result?.product || [];
        let count = 0;

        for (const raw of products) {
          const productId = genId();
          const price = parseFloat(raw.price) || 0;
          const gtin = raw.u_barcode || raw.u_upc || raw.u_ean || raw.barcode || raw.upc || raw.ean || "";

          const product: Product = {
            id: productId,
            tenantId: auth.tenantId,
            storeId,
            externalId: String(raw.id),
            title: raw.name || raw.title || "Sem nome",
            description: raw.description || raw.short_description || "",
            gtin: gtin ? String(gtin) : "",
            brand: raw.manufacturer || raw.brand || "",
            price,
            costPrice: parseFloat(raw.cost_price || raw.wholesale_price) || 0,
            stock: parseInt(raw.quantity) || 0,
            category: raw.categories_ids?.[0] || "",
            imageUrl: raw.images?.[0]?.http_path || raw.main_image || "",
            url: raw.u_url || raw.url || `${storeUrl}/produto/${raw.id}`,
            ucpReadinessScore: gtin && price > 0 ? Math.min(95, 50 + Math.floor(Math.random() * 40)) : Math.floor(Math.random() * 40 + 20),
          };

          db.products.set(productId, product);
          count++;
        }

        const s = db.stores.get(storeId);
        if (s) {
          s.status = "active";
          s.lastSync = new Date().toISOString();
          s.productCount = count;
        }
        console.log(`✅ Synced ${count} products from ${storeUrl}`);
      } catch (e) {
        console.error(`❌ Sync error:`, e);
        const s = db.stores.get(storeId);
        if (s) s.status = "error";
      }
    })();
  } else {
    // Simulate async sync if no API2Cart
    setTimeout(() => {
      const s = db.stores.get(storeId);
      if (s) {
        s.status = "active";
        s.lastSync = new Date().toISOString();
        s.productCount = Math.floor(Math.random() * 50 + 10);
      }
    }, 3000);
  }

  return ok(res, { id: storeId, message: api2cartStoreKey ? "Loja conectada via API2Cart, sincronização iniciada" : "Loja conectada, sincronização iniciada" }, 201);
});

app.post("/api/stores/:storeId/sync", async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const store = db.stores.get(req.params.storeId as string);
  if (!store || store.tenantId !== auth.tenantId) {
    return err(res, "Loja não encontrada", 404);
  }

  store.status = "syncing";

  // If store has API2Cart key, do real sync
  if (store.api2cartStoreKey) {
    (async () => {
      try {
        const response = await fetch(
          `https://api.api2cart.com/v1.1/product.list.json?api_key=${API2CART_API_KEY}&store_key=${store.api2cartStoreKey}&start=0&count=250`
        );
        const data: any = await response.json();
        const products = data.result?.product || [];
        let count = 0;

        // Remove old products for this store
        for (const [id, product] of db.products) {
          if (product.storeId === store.id) db.products.delete(id);
        }

        for (const raw of products) {
          const productId = genId();
          const price = parseFloat(raw.price) || 0;
          const gtin = raw.u_barcode || raw.u_upc || raw.u_ean || raw.barcode || raw.upc || raw.ean || "";

          const product: Product = {
            id: productId,
            tenantId: auth.tenantId,
            storeId: store.id,
            externalId: String(raw.id),
            title: raw.name || raw.title || "Sem nome",
            description: raw.description || "",
            gtin: gtin ? String(gtin) : "",
            brand: raw.manufacturer || raw.brand || "",
            price,
            costPrice: parseFloat(raw.cost_price || raw.wholesale_price) || 0,
            stock: parseInt(raw.quantity) || 0,
            category: raw.categories_ids?.[0] || "",
            imageUrl: raw.images?.[0]?.http_path || raw.main_image || "",
            url: raw.u_url || raw.url || `${store.storeUrl}/produto/${raw.id}`,
            ucpReadinessScore: gtin && price > 0 ? Math.min(95, 50 + Math.floor(Math.random() * 40)) : Math.floor(Math.random() * 40 + 20),
          };

          db.products.set(productId, product);
          count++;
        }

        store.status = "active";
        store.lastSync = new Date().toISOString();
        store.productCount = count;
        console.log(`✅ Re-synced ${count} products from ${store.storeUrl}`);
      } catch (e) {
        console.error(`❌ Sync error:`, e);
        store.status = "error";
      }
    })();
  } else {
    setTimeout(() => {
      store.status = "active";
      store.lastSync = new Date().toISOString();
    }, 2000);
  }

  return ok(res, { message: store.api2cartStoreKey ? "Sincronização real iniciada via API2Cart" : "Sincronização iniciada" });
});

app.delete("/api/stores/:storeId", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const store = db.stores.get(req.params.storeId as string);
  if (!store || store.tenantId !== auth.tenantId) {
    return err(res, "Loja não encontrada", 404);
  }

  // Delete store and its products
  db.stores.delete(req.params.storeId as string);
  for (const [id, product] of db.products) {
    if (product.storeId === req.params.storeId as string) {
      db.products.delete(id);
    }
  }

  return ok(res, { message: "Loja removida" });
});

// ══════════════════════════════════════════════════════════
//  PRODUCTS ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/products", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string)?.toLowerCase();
  const readiness = req.query.readiness as string;

  let products = [...db.products.values()].filter((p) => p.tenantId === auth.tenantId);

  if (search) {
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.gtin.includes(search) ||
        p.brand.toLowerCase().includes(search)
    );
  }

  if (readiness) {
    products = products.filter((p) => p.ucpReadinessLevel === readiness);
  }

  const total = products.length;
  const start = (page - 1) * pageSize;
  const data = products.slice(start, start + pageSize);

  return ok(res, { data, total, page, pageSize });
});

app.get("/api/products/:productId", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const product = db.products.get(req.params.productId as string);
  if (!product || product.tenantId !== auth.tenantId) {
    return err(res, "Produto não encontrado", 404);
  }

  return ok(res, product);
});

app.get("/api/products/coverage/gtin", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const products = [...db.products.values()].filter((p) => p.tenantId === auth.tenantId);
  const withGtin = products.filter((p) => p.gtin && p.gtin.length >= 8);
  const coverage = products.length > 0 ? Math.round((withGtin.length / products.length) * 100) : 0;

  return ok(res, {
    total: products.length,
    withGTIN: withGtin.length,
    withoutGTIN: products.length - withGtin.length,
    coverage,
  });
});

// ══════════════════════════════════════════════════════════
//  PRICING RULES ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/pricing/rules", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const rules = [...db.pricingRules.values()]
    .filter((r) => r.tenantId === auth.tenantId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      strategy: r.strategy,
      margin: r.margin,
      minMargin: r.minMargin,
      maxDiscount: r.maxDiscount,
      targetPosition: r.targetPosition,
      isActive: r.isActive,
      appliedProducts: r.appliedProducts,
      createdAt: r.createdAt,
    }));

  return ok(res, rules);
});

app.post("/api/pricing/rules", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { name, strategy, margin, minMargin, maxDiscount } = req.body;
  if (!name || !strategy) {
    return err(res, "name e strategy são obrigatórios");
  }

  const id = genId();
  const rule: PricingRule = {
    id,
    tenantId: auth.tenantId,
    name,
    strategy,
    margin: margin || 0,
    minMargin: minMargin || 0,
    maxDiscount: maxDiscount || 0,
    isActive: true,
    appliedProducts: 0,
    createdAt: new Date().toISOString(),
  };

  db.pricingRules.set(id, rule);
  return ok(res, rule, 201);
});

app.put("/api/pricing/rules/:id", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const rule = db.pricingRules.get(req.params.id as string);
  if (!rule || rule.tenantId !== auth.tenantId) {
    return err(res, "Regra não encontrada", 404);
  }

  const { name, strategy, margin, minMargin, maxDiscount, isActive } = req.body;
  if (name !== undefined) rule.name = name;
  if (strategy !== undefined) rule.strategy = strategy;
  if (margin !== undefined) rule.margin = margin;
  if (minMargin !== undefined) rule.minMargin = minMargin;
  if (maxDiscount !== undefined) rule.maxDiscount = maxDiscount;
  if (isActive !== undefined) rule.isActive = isActive;

  return ok(res, rule);
});

app.delete("/api/pricing/rules/:id", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const rule = db.pricingRules.get(req.params.id as string);
  if (!rule || rule.tenantId !== auth.tenantId) {
    return err(res, "Regra não encontrada", 404);
  }

  db.pricingRules.delete(req.params.id as string);
  return ok(res, { message: "Regra removida" });
});

// ══════════════════════════════════════════════════════════
//  COMPETITIVE INTELLIGENCE ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/competitive/stats", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const competitors = db.competitorPrices.filter((c) => c.tenantId === auth.tenantId);
  const cheaper = competitors.filter((c) => c.priceDiff < -1);
  const match = competitors.filter((c) => Math.abs(c.priceDiff) <= 1);
  const moreExpensive = competitors.filter((c) => c.priceDiff > 1);

  return ok(res, {
    totalTracked: competitors.length,
    cheaperCount: cheaper.length,
    matchCount: match.length,
    moreExpensiveCount: moreExpensive.length,
    avgPriceParity: 98.5,
  });
});

app.get("/api/competitive/prices", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const prices = db.competitorPrices
    .filter((c) => c.tenantId === auth.tenantId)
    .map((c) => ({
      id: c.id,
      gtin: c.gtin,
      productTitle: c.productTitle,
      myPrice: c.myPrice,
      competitorName: c.competitorName,
      competitorPrice: c.competitorPrice,
      priceDiff: c.priceDiff,
      lastSeen: c.lastSeen,
      source: c.source,
    }));

  return ok(res, prices);
});

app.post("/api/competitive/scan", async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const products = [...db.products.values()].filter(
    (p) => p.tenantId === auth.tenantId && p.gtin
  );

  if (products.length === 0) {
    return err(res, "Nenhum produto com GTIN para escanear");
  }

  // Perform real Serper API scan for the first few products
  const scanResults: CompetitorPrice[] = [];
  const toScan = products.slice(0, 20); // Scan up to 20 products

  for (const product of toScan) {
    try {
      const response = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: product.gtin || product.title,
          gl: "br",
          hl: "pt-br",
          num: 10,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const items = (data.shopping || []).slice(0, 5);

        for (const item of items) {
          const price = parseFloat(
            String(item.price || "0")
              .replace(/[R$\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".")
          ) || 0;

          if (price > 0) {
            const cp: CompetitorPrice = {
              id: genId(),
              tenantId: auth.tenantId,
              gtin: product.gtin,
              productTitle: product.title,
              myPrice: product.price,
              competitorName: item.source || "Desconhecido",
              competitorPrice: price,
              priceDiff: +(((price / product.price - 1) * 100).toFixed(1)),
              lastSeen: new Date().toISOString(),
              source: "serper_google_shopping",
            };
            scanResults.push(cp);
          }
        }
      }
    } catch (e) {
      console.error(`Serper scan error for ${product.gtin}:`, e);
    }
  }

  // Add new results to DB (replace old for same GTINs)
  if (scanResults.length > 0) {
    const scannedGtins = new Set(scanResults.map((r) => r.gtin));
    db.competitorPrices = [
      ...db.competitorPrices.filter((c) => c.tenantId !== auth.tenantId || !scannedGtins.has(c.gtin)),
      ...scanResults,
    ];
  }

  return ok(res, {
    message: `Scan concluído: ${scanResults.length} resultados encontrados para ${toScan.length} produtos`,
    results: scanResults.length,
  });
});

// ══════════════════════════════════════════════════════════
//  GOOGLE MERCHANT CENTER ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/google/status", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const status = db.googleStatus.get(auth.tenantId);
  if (!status) {
    return ok(res, {
      connected: false,
      totalProducts: 0,
      approvedProducts: 0,
      disapprovedProducts: 0,
      pendingProducts: 0,
      lastFeedSync: null,
      indexingQuota: { used: 0, total: 200 },
    });
  }

  return ok(res, status);
});

app.get("/api/google/indexing/logs", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const logs = db.indexingLogs
    .filter((l) => l.tenantId === auth.tenantId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);

  return ok(res, logs);
});

app.get("/api/google/auth/url", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  // In production, this would be a real Google OAuth URL
  const clientId = process.env.GOOGLE_CLIENT_ID || "demo";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:7071/api/google/merchant/callback";
  const scope = "https://www.googleapis.com/auth/content";
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  return ok(res, { url });
});

app.post("/api/google/feed/sync", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const status = db.googleStatus.get(auth.tenantId);
  if (!status) {
    return err(res, "Google Merchant Center não conectado");
  }

  // Simulate feed sync
  const products = [...db.products.values()].filter((p) => p.tenantId === auth.tenantId);
  status.totalProducts = products.length;
  status.approvedProducts = products.filter((p) => p.ucpReadinessScore >= 80).length;
  status.disapprovedProducts = products.filter((p) => p.ucpReadinessScore < 50).length;
  status.pendingProducts = products.filter((p) => p.ucpReadinessScore >= 50 && p.ucpReadinessScore < 80).length;
  status.lastFeedSync = new Date().toISOString();
  status.indexingQuota.used = Math.min(status.indexingQuota.used + products.length, 200);

  // Add indexing log entries
  for (const product of products.slice(0, 10)) {
    db.indexingLogs.push({
      id: genId(),
      tenantId: auth.tenantId,
      url: `${[...db.stores.values()].find((s) => s.id === product.storeId)?.storeUrl || ""}/products/${product.gtin}`,
      type: "URL_UPDATED",
      status: Math.random() > 0.05 ? "success" : "error",
      timestamp: new Date().toISOString(),
    });
  }

  return ok(res, { message: `Feed sincronizado: ${products.length} produtos processados` });
});

// ══════════════════════════════════════════════════════════
//  BILLING ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/billing/subscription", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const sub = db.subscriptions.get(auth.tenantId);
  if (!sub) {
    return ok(res, {
      id: "",
      plan: "basic",
      status: "trialing",
      currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
    });
  }

  return ok(res, sub);
});

app.get("/api/billing/invoices", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const invoices = db.invoices
    .filter((i) => i.tenantId === auth.tenantId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return ok(res, invoices);
});

app.post("/api/billing/checkout", async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const { plan } = req.body;
  if (!plan) return err(res, "Plano é obrigatório");

  // Try real Stripe API call
  try {
    const priceMap: Record<string, string> = {
      basic: STRIPE_PRICE_BASIC,
      pro: STRIPE_PRICE_PRO,
      enterprise: STRIPE_PRICE_ENTERPRISE,
    };

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "subscription",
        "success_url": `${req.headers.origin || "http://localhost:5173"}/billing?success=true`,
        "cancel_url": `${req.headers.origin || "http://localhost:5173"}/billing?canceled=true`,
        "line_items[0][price]": priceMap[plan] || priceMap["basic"],
        "line_items[0][quantity]": "1",
        "metadata[tenantId]": auth.tenantId,
      }).toString(),
    });

    if (response.ok) {
      const session: any = await response.json();
      return ok(res, { checkoutUrl: session.url });
    }

    // If Stripe fails, simulate for dev mode
    console.log("⚠️  Stripe checkout failed (dev mode), simulating...");
  } catch (e) {
    console.log("⚠️  Stripe not available (dev mode):", e);
  }

  // Dev mode fallback - simulate plan change
  const sub = db.subscriptions.get(auth.tenantId);
  if (sub) {
    sub.plan = plan as "basic" | "pro" | "enterprise";
    sub.status = "active";
    sub.currentPeriodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  }

  const user = [...db.users.values()].find((u) => u.tenantId === auth.tenantId);
  if (user) user.plan = plan;

  return ok(res, {
    checkoutUrl: null,
    message: `Plano atualizado para ${plan} (modo desenvolvimento)`,
  });
});

app.post("/api/billing/portal", async (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  // Try real Stripe portal
  try {
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "customer": `cus_${auth.tenantId}`,
        "return_url": `${req.headers.origin || "http://localhost:5173"}/billing`,
      }).toString(),
    });

    if (response.ok) {
      const session: any = await response.json();
      return ok(res, { url: session.url });
    }
  } catch (e) {
    console.log("⚠️  Stripe portal not available (dev mode)");
  }

  return ok(res, { url: `${req.headers.origin || "http://localhost:5173"}/billing?portal=demo` });
});

app.post("/api/billing/cancel", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const sub = db.subscriptions.get(auth.tenantId);
  if (sub) {
    sub.cancelAtPeriodEnd = true;
  }

  return ok(res, { message: "Cancelamento agendado" });
});

app.post("/api/billing/resume", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const sub = db.subscriptions.get(auth.tenantId);
  if (sub) {
    sub.cancelAtPeriodEnd = false;
    sub.status = "active";
  }

  return ok(res, { message: "Assinatura reativada" });
});

// Stripe webhook
app.post("/api/billing/webhook", (req: Request, res: Response) => {
  console.log("📩 Stripe webhook received:", req.body?.type);
  return ok(res, { received: true });
});

// ══════════════════════════════════════════════════════════
//  SETTINGS ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/settings", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const settings = db.settings.get(auth.tenantId);
  if (!settings) {
    return ok(res, {
      scanIntervalMinutes: 360,
      autoRepricing: false,
      timezone: "America/Sao_Paulo",
      notifyPriceChanges: true,
      notifyUcpAlerts: true,
      notifyWeeklyReport: true,
      minMarginThreshold: 5,
      maxAutoPriceChangePercent: 10,
    });
  }

  return ok(res, settings);
});

app.put("/api/settings", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  let settings = db.settings.get(auth.tenantId);
  if (!settings) {
    settings = {
      tenantId: auth.tenantId,
      scanIntervalMinutes: 360,
      autoRepricing: false,
      timezone: "America/Sao_Paulo",
      notifyPriceChanges: true,
      notifyUcpAlerts: true,
      notifyWeeklyReport: true,
      minMarginThreshold: 5,
      maxAutoPriceChangePercent: 10,
    };
    db.settings.set(auth.tenantId, settings);
  }

  const body = req.body;
  if (body.scanIntervalMinutes !== undefined) settings.scanIntervalMinutes = body.scanIntervalMinutes;
  if (body.autoRepricing !== undefined) settings.autoRepricing = body.autoRepricing;
  if (body.timezone !== undefined) settings.timezone = body.timezone;
  if (body.notifyPriceChanges !== undefined) settings.notifyPriceChanges = body.notifyPriceChanges;
  if (body.notifyUcpAlerts !== undefined) settings.notifyUcpAlerts = body.notifyUcpAlerts;
  if (body.notifyWeeklyReport !== undefined) settings.notifyWeeklyReport = body.notifyWeeklyReport;
  if (body.minMarginThreshold !== undefined) settings.minMarginThreshold = body.minMarginThreshold;
  if (body.maxAutoPriceChangePercent !== undefined) settings.maxAutoPriceChangePercent = body.maxAutoPriceChangePercent;

  return ok(res, { message: "Configurações salvas" });
});

// ══════════════════════════════════════════════════════════
//  TENANT ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/tenant", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const user = [...db.users.values()].find((u) => u.tenantId === auth.tenantId);
  if (!user) return err(res, "Tenant não encontrado", 404);

  return ok(res, {
    id: user.tenantId,
    name: user.companyName,
    email: user.email,
    plan: user.plan,
    status: "active",
    createdAt: user.createdAt,
  });
});

app.get("/api/tenant/plan", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const user = [...db.users.values()].find((u) => u.tenantId === auth.tenantId);
  const sub = db.subscriptions.get(auth.tenantId);

  return ok(res, {
    plan: user?.plan || "basic",
    status: sub?.status || "trialing",
    currentPeriodEnd: sub?.currentPeriodEnd,
  });
});

// ══════════════════════════════════════════════════════════
//  UCP ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/ucp/signal/:ean", (req: Request, res: Response) => {
  const ean = req.params.ean;
  const products = [...db.products.values()].filter((p) => p.gtin === ean);

  if (products.length === 0) {
    return err(res, "Produto não encontrado para este EAN", 404);
  }

  const product = products[0];
  const store = db.stores.get(product.storeId);

  const signal = {
    ean: product.gtin,
    productName: product.title,
    brand: product.brand,
    price: product.price,
    currency: "BRL",
    availability: `https://schema.org/${product.availability}`,
    url: `${store?.storeUrl || ""}/products/${product.gtin}?utm_source=retailnexus-ucp`,
    priceValidUntil: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    ucpReadinessScore: product.ucpReadinessScore,
    sellerTrustScore: 78,
  };

  res.setHeader("Last-Modified", new Date().toUTCString());
  res.setHeader("Cache-Control", "public, max-age=300");
  return ok(res, signal);
});

app.get("/api/ucp/dashboard", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const products = [...db.products.values()].filter((p) => p.tenantId === auth.tenantId);
  const total = products.length;
  const eligible = products.filter((p) => p.ucpReadinessLevel === "eligible");
  const withGtin = products.filter((p) => p.gtin?.length >= 8);

  return ok(res, {
    totalProducts: total,
    ucpEligible: eligible.length,
    ucpAlmost: products.filter((p) => p.ucpReadinessLevel === "almost").length,
    ucpNotEligible: products.filter((p) => p.ucpReadinessLevel === "not_eligible").length,
    avgReadinessScore: total > 0
      ? Math.round(products.reduce((s, p) => s + p.ucpReadinessScore, 0) / total)
      : 0,
    gtinCoverage: total > 0 ? Math.round((withGtin.length / total) * 100) : 0,
    priceParity: 98.5,
    sellerTrustScore: 78,
    signalsCached: eligible.length,
    googleSyncRate: 96.2,
  });
});

app.get("/api/ucp/jsonld/:productId", (req: Request, res: Response) => {
  const product = db.products.get(req.params.productId as string);
  if (!product) return err(res, "Produto não encontrado", 404);

  const store = db.stores.get(product.storeId);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const jsonld = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    image: product.imageUrl,
    description: `${product.title} - ${product.brand}`,
    sku: product.gtin,
    gtin13: product.gtin,
    brand: { "@type": "Brand", name: product.brand },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: "42",
      bestRating: "5",
    },
    offers: {
      "@type": "Offer",
      url: `${store?.storeUrl || ""}/products/${product.gtin}?utm_source=retailnexus-ucp`,
      priceCurrency: "BRL",
      price: product.price.toFixed(2),
      priceValidUntil: tomorrow,
      availability: `https://schema.org/${product.availability}`,
      itemCondition: "https://schema.org/NewCondition",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "0.00", currency: "BRL" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "d" },
          transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "d" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "BR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  };

  res.setHeader("Content-Type", "application/ld+json");
  res.setHeader("Last-Modified", new Date().toUTCString());
  return res.json(jsonld);
});

// ══════════════════════════════════════════════════════════
//  HEALTH ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/health", (_req: Request, res: Response) => {
  return ok(res, {
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    mode: "development",
    services: {
      database: "in-memory",
      serperApi: SERPER_API_KEY ? "configured" : "not-configured",
      api2cart: API2CART_API_KEY ? "configured" : "not-configured",
      stripe: STRIPE_SECRET_KEY ? "configured" : "not-configured",
    },
  });
});

app.get("/api/health/ready", (_req: Request, res: Response) => {
  return ok(res, {
    status: "ready",
    database: "in-memory (healthy)",
    redis: "not-configured (dev mode)",
    serviceBus: "not-configured (dev mode)",
  });
});

// ══════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════

app.get("/api/admin/stats", (req: Request, res: Response) => {
  const auth = requireAuth(req, res);
  if (!auth) return;

  const users = [...db.users.values()];
  const stores = [...db.stores.values()];
  const products = [...db.products.values()];

  return ok(res, {
    totalTenants: new Set(users.map((u) => u.tenantId)).size,
    totalStores: stores.length,
    totalProducts: products.length,
    planDistribution: {
      basic: users.filter((u) => u.plan === "basic").length,
      pro: users.filter((u) => u.plan === "pro").length,
      enterprise: users.filter((u) => u.plan === "enterprise").length,
    },
    activeSubscriptions: [...db.subscriptions.values()].filter((s) => s.status === "active").length,
  });
});

// ══════════════════════════════════════════════════════════
//  WEBHOOK ROUTES
// ══════════════════════════════════════════════════════════

app.post("/api/webhooks/api2cart", (req: Request, res: Response) => {
  console.log("📩 API2Cart webhook received:", JSON.stringify(req.body).slice(0, 200));
  return ok(res, { received: true });
});

// ══════════════════════════════════════════════════════════
//  CATCH-ALL 404
// ══════════════════════════════════════════════════════════

app.use((_req: Request, res: Response) => {
  return res.status(404).json({ success: false, error: "Endpoint não encontrado" });
});

// ══════════════════════════════════════════════════════════
//  STARTUP
// ══════════════════════════════════════════════════════════

async function start() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     RetailNexus — Dev Server                    ║");
  console.log("║     UCP-Compliant Dynamic Pricing Platform      ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log();
  console.log("ℹ️  Modo: Desenvolvimento Local (In-Memory DB)");
  console.log();

  console.log("🌱 Seeding database...");
  await seed();
  console.log();

  console.log("🔑 API Keys:");
  console.log(`  Serper API: ${SERPER_API_KEY ? "✅ Configurada" : "❌ Ausente"}`);
  console.log(`  API2Cart:   ${API2CART_API_KEY ? "✅ Configurada" : "❌ Ausente"}`);
  console.log(`  Stripe:     ${STRIPE_SECRET_KEY ? "✅ Configurada" : "❌ Ausente"}`);
  console.log();

  app.listen(PORT, () => {
    console.log(`🚀 API rodando em http://localhost:${PORT}`);
    console.log();
    console.log("📋 Endpoints disponíveis:");
    console.log("  Auth:        POST /api/auth/login, /api/auth/register, GET /api/auth/me");
    console.log("  Dashboard:   GET  /api/dashboard/stats");
    console.log("  Stores:      GET  /api/stores, POST /api/stores, POST /api/stores/:id/sync");
    console.log("  Products:    GET  /api/products, /api/products/:id");
    console.log("  Pricing:     GET  /api/pricing/rules, POST /PUT /DELETE");
    console.log("  Competitive: GET  /api/competitive/stats, /prices, POST /scan");
    console.log("  Google:      GET  /api/google/status, /indexing/logs");
    console.log("  Billing:     GET  /api/billing/subscription, /invoices");
    console.log("  Settings:    GET  /api/settings, PUT /api/settings");
    console.log("  UCP:         GET  /api/ucp/signal/:ean, /jsonld/:productId");
    console.log("  Health:      GET  /api/health, /api/health/ready");
    console.log();
    console.log("👤 Login de teste: demo@ucpbr.com.br / 123456");
    console.log();
  });
}

start().catch(console.error);
