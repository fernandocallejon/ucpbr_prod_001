// ============================================================
// RetailNexus — Pricing Rules Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  DollarSign,
  Plus,
  Edit3,
  Trash2,
  X,
  TrendingDown,
  TrendingUp,
  Target,
  Percent,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface PricingRule {
  id: string;
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

const STRATEGIES: {
  id: PricingRule["strategy"];
  label: string;
  desc: string;
  icon: typeof DollarSign;
  color: string;
}[] = [
  {
    id: "manual",
    label: "Manual",
    desc: "Defina preços manualmente para cada produto",
    icon: Edit3,
    color: "bg-gray-100 text-gray-600",
  },
  {
    id: "undercut",
    label: "Undercut",
    desc: "Preço abaixo do menor concorrente",
    icon: TrendingDown,
    color: "bg-red-50 text-red-600",
  },
  {
    id: "match",
    label: "Match",
    desc: "Igualar o preço do menor concorrente",
    icon: Target,
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "fixed_margin",
    label: "Margem Fixa",
    desc: "Manter margem mínima sobre custo",
    icon: Percent,
    color: "bg-green-50 text-green-600",
  },
];

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await api.get<PricingRule[]>("/api/pricing/rules");
      setRules(data);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(id: string, isActive: boolean) {
    try {
      await api.put(`/api/pricing/rules/${id}`, { isActive: !isActive });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r))
      );
    } catch {
      // ignore
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Remover esta regra de preço?")) return;
    try {
      await api.delete(`/api/pricing/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  }

  function openEdit(rule: PricingRule) {
    setEditing(rule);
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Regras de Preço
          </h1>
          <p className="text-sm text-gray-500">
            Configure estratégias de precificação dinâmica para seus produtos.
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </button>
      </div>

      {/* Strategy overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STRATEGIES.map((s) => {
          const count = rules.filter((r) => r.strategy === s.id && r.isActive).length;
          return (
            <div key={s.id} className="card flex items-start gap-3">
              <div className={`rounded-lg p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{s.label}</p>
                <p className="text-xs text-gray-400">{count} regra{count !== 1 ? "s" : ""} ativa{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">Carregando...</div>
      ) : rules.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <DollarSign className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium">
            Nenhuma regra de preço
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Crie sua primeira regra para automatizar a precificação.
          </p>
          <button className="btn-primary mt-6" onClick={openNew}>
            Criar Regra
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const strat = STRATEGIES.find((s) => s.id === rule.strategy)!;
            return (
              <div
                key={rule.id}
                className={cn(
                  "card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
                  !rule.isActive && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-2.5 ${strat.color}`}>
                    <strat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                    <p className="text-xs text-gray-500">
                      {strat.label}
                      {rule.margin != null && ` · Margem: ${rule.margin}%`}
                      {rule.minMargin != null && ` · Mín: ${rule.minMargin}%`}
                      {rule.maxDiscount != null &&
                        ` · Desc máx: ${rule.maxDiscount}%`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {rule.appliedProducts} produto
                      {rule.appliedProducts !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule.id, rule.isActive)}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      rule.isActive ? "bg-brand-600" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        rule.isActive && "translate-x-5"
                      )}
                    />
                  </button>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => openEdit(rule)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="btn-danger text-xs"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <RuleFormModal
          rule={editing}
          onClose={() => setShowForm(false)}
          onSaved={loadRules}
        />
      )}
    </div>
  );
}

/* ── Rule Form Modal ───────────────────────── */
function RuleFormModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: PricingRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    strategy: rule?.strategy || ("undercut" as PricingRule["strategy"]),
    margin: rule?.margin ?? 5,
    minMargin: rule?.minMargin ?? 2,
    maxDiscount: rule?.maxDiscount ?? 10,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (rule) {
        await api.put(`/api/pricing/rules/${rule.id}`, form);
      } else {
        await api.post("/api/pricing/rules", form);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar regra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {rule ? "Editar Regra" : "Nova Regra de Preço"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nome da Regra
            </label>
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Undercut Eletrônicos"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Estratégia
            </label>
            <select
              className="input mt-1"
              value={form.strategy}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  strategy: e.target.value as PricingRule["strategy"],
                }))
              }
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.desc}
                </option>
              ))}
            </select>
          </div>

          {form.strategy !== "manual" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Margem (%)
                </label>
                <input
                  className="input mt-1"
                  type="number"
                  step="0.1"
                  value={form.margin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, margin: +e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Margem Mín. (%)
                  </label>
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.1"
                    value={form.minMargin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minMargin: +e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Desconto Máx. (%)
                  </label>
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.1"
                    value={form.maxDiscount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxDiscount: +e.target.value }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
