// ============================================================
// RetailNexus — Billing Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  CreditCard,
  CheckCircle2,
  ArrowRight,
  FileText,
  Download,
  Star,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface Subscription {
  id: string;
  plan: "basic" | "pro" | "enterprise";
  status: "active" | "trialing" | "past_due" | "canceled";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  status: "paid" | "open" | "void";
  date: string;
  pdfUrl?: string;
}

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: 197,
    skus: "500 SKUs",
    stores: "2 lojas",
    features: [
      "Sincronização automática",
      "UCP Score básico",
      "Varredura diária",
      "Suporte por email",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 497,
    skus: "5.000 SKUs",
    stores: "5 lojas",
    popular: true,
    features: [
      "Tudo do Basic",
      "Precificação dinâmica",
      "Inteligência competitiva",
      "Google Merchant Center",
      "Varredura a cada 4h",
      "Suporte prioritário",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 1497,
    skus: "SKUs ilimitados",
    stores: "Ilimitado",
    features: [
      "Tudo do Pro",
      "API dedicada",
      "Varredura horária",
      "Dashboard white-label",
      "Gerente de conta",
      "SLA 99.9%",
    ],
  },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    setLoading(true);
    try {
      const [s, inv] = await Promise.all([
        api.get<Subscription>("/api/billing/subscription"),
        api.get<Invoice[]>("/api/billing/invoices"),
      ]);
      setSub(s);
      setInvoices(inv);
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(planId: string) {
    setUpgrading(planId);
    try {
      const res = await api.post<{ checkoutUrl?: string }>(
        "/api/billing/checkout",
        { plan: planId }
      );
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        await loadBilling();
      }
    } catch {
      alert("Erro ao processar. Tente novamente.");
    } finally {
      setUpgrading(null);
    }
  }

  async function openPortal() {
    try {
      const { url } = await api.post<{ url: string }>(
        "/api/billing/portal"
      );
      window.location.href = url;
    } catch {
      alert("Erro ao abrir portal de pagamento.");
    }
  }

  const currentPlan = user?.plan || sub?.plan || "basic";

  const statusLabels: Record<string, { label: string; cls: string }> = {
    active: { label: "Ativo", cls: "text-green-600" },
    trialing: { label: "Teste", cls: "text-blue-600" },
    past_due: { label: "Pagamento pendente", cls: "text-red-600" },
    canceled: { label: "Cancelado", cls: "text-gray-500" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>
        <p className="text-sm text-gray-500">
          Gerencie seu plano e informações de pagamento.
        </p>
      </div>

      {/* Current subscription */}
      {sub && (
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-500">Plano atual</p>
            <p className="text-xl font-bold capitalize">{sub.plan}</p>
            <p className={cn("text-sm", statusLabels[sub.status]?.cls)}>
              {statusLabels[sub.status]?.label}
            </p>
            <p className="text-xs text-gray-400">
              Renova em {formatDate(sub.currentPeriodEnd)}
            </p>
          </div>
          <button className="btn-secondary" onClick={openPortal}>
            <CreditCard className="mr-2 h-4 w-4" />
            Gerenciar Pagamento
          </button>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Planos</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "card relative flex flex-col",
                  plan.popular && "ring-2 ring-brand-500"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-medium text-white">
                      <Star className="h-3 w-3" /> Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {plan.skus} · {plan.stores}
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-gray-900">
                    R$ {plan.price}
                  </span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span className="text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button className="btn-secondary w-full" disabled>
                    Plano atual
                  </button>
                ) : (
                  <button
                    className={cn(
                      "w-full",
                      plan.popular ? "btn-primary" : "btn-secondary"
                    )}
                    disabled={upgrading === plan.id}
                    onClick={() => changePlan(plan.id)}
                  >
                    {upgrading === plan.id ? (
                      "Processando..."
                    ) : (
                      <>
                        {PLANS.findIndex((p) => p.id === currentPlan) <
                        PLANS.findIndex((p) => p.id === plan.id)
                          ? "Fazer upgrade"
                          : "Mudar plano"}
                        <ArrowRight className="ml-2 inline h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Faturas Recentes
        </h3>
        {invoices.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            Nenhuma fatura disponível.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-2">Número</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Valor</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {inv.number}
                    </td>
                    <td className="px-4 py-2">{formatDate(inv.date)}</td>
                    <td className="px-4 py-2 font-medium">
                      {formatCurrency(inv.amount / 100)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          inv.status === "paid"
                            ? "bg-green-50 text-green-600"
                            : inv.status === "open"
                              ? "bg-yellow-50 text-yellow-600"
                              : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {inv.status === "paid"
                          ? "Pago"
                          : inv.status === "open"
                            ? "Aberto"
                            : "Cancelado"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
