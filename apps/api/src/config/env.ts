// ============================================================
// RetailNexus — Environment Configuration
// ============================================================

export interface AppConfig {
  cosmos: {
    endpoint: string;
    key: string;
    database: string;
  };
  redis: {
    url: string;
  };
  serviceBus: {
    connection: string;
  };
  jwt: {
    secret: string;
    expiry: string;
  };
  api2cart: {
    apiKey: string;
    baseUrl: string;
  };
  serper: {
    apiKey: string;
    baseUrl: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    merchantId: string;
    clientEmail: string;
    privateKey: string;
    indexingQuotaPerDay: number;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
}

function env(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  _config = {
    cosmos: {
      endpoint: env("COSMOS_ENDPOINT"),
      key: env("COSMOS_KEY"),
      database: env("COSMOS_DATABASE", "retailnexus-db"),
    },
    redis: {
      url: env("REDIS_URL", "redis://localhost:6379"),
    },
    serviceBus: {
      connection: env("SERVICE_BUS_CONNECTION", ""),
    },
    jwt: {
      secret: env("JWT_SECRET"),
      expiry: env("JWT_EXPIRY", "24h"),
    },
    api2cart: {
      apiKey: env("API2CART_API_KEY", ""),
      baseUrl: env("API2CART_BASE_URL", "https://api.api2cart.com/v1.1"),
    },
    serper: {
      apiKey: env("SERPER_API_KEY", ""),
      baseUrl: env("SERPER_BASE_URL", "https://google.serper.dev"),
    },
    google: {
      clientId: env("GOOGLE_CLIENT_ID", ""),
      clientSecret: env("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: env("GOOGLE_REDIRECT_URI", ""),
      merchantId: env("GOOGLE_MERCHANT_ID", ""),
      clientEmail: env("GOOGLE_CLIENT_EMAIL", ""),
      privateKey: env("GOOGLE_PRIVATE_KEY", "").replace(/\\n/g, "\n"),
      indexingQuotaPerDay: parseInt(env("GOOGLE_INDEXING_QUOTA_PER_DAY", "200")),
    },
    stripe: {
      secretKey: env("STRIPE_SECRET_KEY", ""),
      webhookSecret: env("STRIPE_WEBHOOK_SECRET", ""),
    },
  };

  return _config;
}
