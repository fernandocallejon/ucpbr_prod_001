// ============================================================
// RetailNexus — Billing Functions (HTTP Triggers)
// POST   /api/billing/checkout
// GET    /api/billing/subscription
// POST   /api/billing/cancel
// POST   /api/billing/resume
// POST   /api/billing/portal
// POST   /api/billing/webhook (Stripe)
// ============================================================

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { tenantRepository } from "../repositories/index.js";
import {
  requireAuth,
  successResponse,
  errorResponse,
  isErr,
} from "../middleware/auth.js";
import { validateBody } from "../middleware/validation.js";
import { getStripeService } from "../services/stripe.service.js";
import { now } from "@retailnexus/shared";
import { z } from "zod";
import { rateLimit } from "../middleware/rate-limit.js";

// ─── Schemas ───

const checkoutSchema = z.object({
  plan: z.enum(["basic", "pro", "enterprise"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

// ─── Create Checkout Session ───

async function createCheckout(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const validation = await validateBody(req, checkoutSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    const stripe = getStripeService();
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://icy-beach-03da2f70f.4.azurestaticapps.net";
    const baseUrl = origin.replace(/\/$/, "");
    const session = await stripe.createCheckoutSession({
      tenantId: tenant.id,
      email: tenant.email,
      plan: body.plan,
      successUrl: body.successUrl || `${baseUrl}/billing?success=true`,
      cancelUrl: body.cancelUrl || `${baseUrl}/billing?canceled=true`,
    });

    return successResponse(session);
  } catch (err: any) {
    context.error("createCheckout error:", err);
    return errorResponse("Erro ao criar checkout", 500);
  }
}

// ─── Get Subscription ───

async function getSubscription(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    if (!tenant.billing?.stripeSubscriptionId) {
      return successResponse({
        plan: tenant.plan,
        status: "no_subscription",
        message: "Nenhuma assinatura ativa",
      });
    }

    const stripe = getStripeService();
    const subscription = await stripe.getSubscription(
      tenant.billing.stripeSubscriptionId
    );

    return successResponse({
      plan: tenant.plan,
      subscription,
    });
  } catch (err: any) {
    context.error("getSubscription error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Cancel Subscription ───

async function cancelSubscription(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    if (!tenant.billing?.stripeSubscriptionId) {
      return errorResponse("Nenhuma assinatura para cancelar", 400);
    }

    const stripe = getStripeService();
    await stripe.cancelSubscription(tenant.billing.stripeSubscriptionId);

    return successResponse({
      message: "Assinatura será cancelada ao final do período",
    });
  } catch (err: any) {
    context.error("cancelSubscription error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Resume Subscription ───

async function resumeSubscription(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    if (!tenant.billing?.stripeSubscriptionId) {
      return errorResponse("Nenhuma assinatura para reativar", 400);
    }

    const stripe = getStripeService();
    await stripe.resumeSubscription(tenant.billing.stripeSubscriptionId);

    return successResponse({
      message: "Assinatura reativada",
    });
  } catch (err: any) {
    context.error("resumeSubscription error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Billing Portal ───

async function createPortal(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const validation = await validateBody(req, portalSchema);
    if (isErr(validation)) return validation;
    const body = validation;

    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    if (!tenant.billing?.stripeCustomerId) {
      return errorResponse("Nenhum cliente Stripe vinculado", 400);
    }

    const stripe = getStripeService();
    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://icy-beach-03da2f70f.4.azurestaticapps.net";
    const returnUrl = body.returnUrl || `${origin.replace(/\/$/, "")}/billing`;
    const portal = await stripe.createPortalSession(
      tenant.billing.stripeCustomerId,
      returnUrl
    );

    return successResponse(portal);
  } catch (err: any) {
    context.error("createPortal error:", err);
    return errorResponse("Erro interno", 500);
  }
}

// ─── Stripe Webhook ───

async function stripeWebhook(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const limited = await rateLimit(req, "anonymous");
  if (limited) return limited;

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse("Missing stripe-signature header", 400);
    }

    const stripe = getStripeService();
    const { valid, event } = stripe.verifyWebhookSignature(body, signature);

    if (!valid || !event) {
      return errorResponse("Invalid webhook signature", 400);
    }

    context.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = session.metadata?.tenantId;
        const plan = session.metadata?.plan;

        if (tenantId && plan) {
          await tenantRepository.update(tenantId, tenantId, {
            plan,
            billing: {
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              currentPeriodEnd: null,
              status: "active",
            },
            updatedAt: now(),
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenantId;

        if (tenantId) {
          await tenantRepository.update(tenantId, tenantId, {
            billing: {
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
              status: subscription.status,
            },
            updatedAt: now(),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenantId;

        if (tenantId) {
          await tenantRepository.update(tenantId, tenantId, {
            plan: "basic",
            billing: {
              stripeCustomerId: subscription.customer,
              stripeSubscriptionId: null,
              currentPeriodEnd: null,
              status: "canceled",
            },
            updatedAt: now(),
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        // Could trigger notification to tenant
        context.warn(
          `Payment failed for subscription ${subscriptionId}`
        );
        break;
      }
    }

    return { status: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    context.error("stripeWebhook error:", err);
    return errorResponse("Webhook processing failed", 500);
  }
}

// ─── Route Registration ───

app.http("billing-checkout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "billing/checkout",
  handler: createCheckout,
});

app.http("billing-subscription", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "billing/subscription",
  handler: getSubscription,
});

app.http("billing-cancel", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "billing/cancel",
  handler: cancelSubscription,
});

app.http("billing-resume", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "billing/resume",
  handler: resumeSubscription,
});

app.http("billing-portal", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "billing/portal",
  handler: createPortal,
});

app.http("billing-webhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "billing/webhook",
  handler: stripeWebhook,
});

// ─── Get Invoices ───

async function getInvoices(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const authResult = requireAuth(req);
  if (isErr(authResult)) return authResult;
  const user = authResult;

  const limited = await rateLimit(req, "authenticated");
  if (limited) return limited;

  try {
    const tenant = await tenantRepository.getById(user.tenantId, user.tenantId);
    if (!tenant) return errorResponse("Tenant não encontrado", 404);

    if (!tenant.billing?.stripeCustomerId) {
      return successResponse([]);
    }

    const stripe = getStripeService();
    const invoices = await stripe.listInvoices(tenant.billing.stripeCustomerId);
    return successResponse(invoices);
  } catch (err: any) {
    context.error("getInvoices error:", err);
    // Return empty array on error to not break frontend
    return successResponse([]);
  }
}

app.http("billing-invoices", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "billing/invoices",
  handler: getInvoices,
});
