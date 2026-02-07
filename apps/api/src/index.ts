// ============================================================
// RetailNexus — Azure Functions Entry Point
// Registers all function triggers
// ============================================================

// HTTP Functions
import "./functions/health.functions.js";
import "./functions/auth.functions.js";
import "./functions/tenant.functions.js";
import "./functions/store.functions.js";
import "./functions/product.functions.js";
import "./functions/scanning.functions.js";
import "./functions/pricing.functions.js";
import "./functions/google.functions.js";
import "./functions/ucp.functions.js";
import "./functions/billing.functions.js";
import "./functions/admin.functions.js";
import "./functions/webhook.functions.js";

// Timer Functions
import "./functions/timer.functions.js";

// Service Bus Functions
import "./functions/servicebus.functions.js";

// Log startup
console.log("🚀 RetailNexus API v1.0.0 — All functions registered");
