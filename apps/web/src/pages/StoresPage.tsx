// ============================================================
// RetailNexus — Stores Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Store,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
  X,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";

interface StoreItem {
  id: string;
  platform: string;
  storeUrl: string;
  storeName: string;
  status: "active" | "inactive" | "syncing" | "error";
  productCount: number;
  lastSync: string | null;
  createdAt: string;
}

const PLATFORMS = [
  { id: "shopify", name: "Shopify", icon: "🟢" },
  { id: "woocommerce", name: "WooCommerce", icon: "🟣" },
  { id: "vtex", name: "VTEX", icon: "🔴" },
  { id: "magento", name: "Magento", icon: "🟠" },
  { id: "nuvemshop", name: "Nuvemshop", icon: "🔵" },
  { id: "tray", name: "Tray Commerce", icon: "🟡" },
  { id: "lojaintegrada", name: "Loja Integrada", icon: "🟤" },
  { id: "opencart", name: "OpenCart", icon: "⚪" },
];

const statusMeta: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  active: {
    label: "Ativo",
    icon: CheckCircle2,
    className: "text-green-600",
  },
  syncing: { label: "Sincronizando", icon: RefreshCw, className: "text-blue-600 animate-spin" },
  inactive: { label: "Inativo", icon: XCircle, className: "text-gray-400" },
  error: { label: "Erro", icon: XCircle, className: "text-red-600" },
};

export default function StoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    setLoading(true);
    try {
      const data = await api.get<StoreItem[]>("/api/stores");
      setStores(data);
    } catch {
      // fallback empty
    } finally {
      setLoading(false);
    }
  }

  async function triggerSync(storeId: string) {
    setSyncing(storeId);
    try {
      await api.post(`/api/stores/${storeId}/sync`);
      await loadStores();
    } catch {
      // ignore
    } finally {
      setSyncing(null);
    }
  }

  async function deleteStore(storeId: string) {
    if (!confirm("Tem certeza que quer remover esta loja?")) return;
    try {
      await api.delete(`/api/stores/${storeId}`);
      setStores((prev) => prev.filter((s) => s.id !== storeId));
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lojas</h1>
          <p className="text-sm text-gray-500">
            Conecte suas lojas via API2Cart para sincronizar produtos automaticamente.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Loja
        </button>
      </div>

      {/* Store Cards */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">Carregando...</div>
      ) : stores.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => {
            const meta = statusMeta[store.status] ?? statusMeta.inactive;
            const StatusIcon = meta!.icon;
            return (
              <div key={store.id} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {PLATFORMS.find((p) => p.id === store.platform)?.icon || "🛒"}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {store.storeName}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {store.platform}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <StatusIcon className={`h-4 w-4 ${meta!.className}`} />
                    <span className={meta!.className}>{meta!.label}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Produtos</p>
                    <p className="font-medium">{store.productCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Último Sync</p>
                    <p className="font-medium">
                      {store.lastSync ? formatRelative(store.lastSync) : "Nunca"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t pt-3">
                  <button
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => triggerSync(store.id)}
                    disabled={syncing === store.id}
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${syncing === store.id ? "animate-spin" : ""}`}
                    />
                    Sincronizar
                  </button>
                  <a
                    href={store.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    className="btn-danger text-xs"
                    onClick={() => deleteStore(store.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Store Modal */}
      {showAdd && <AddStoreModal onClose={() => setShowAdd(false)} onAdded={loadStores} />}
    </div>
  );
}

/* ── Empty State ────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <Store className="h-12 w-12 text-gray-300" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        Nenhuma loja conectada
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Conecte sua primeira loja para começar a importar produtos e monitorar
        preços automaticamente.
      </p>
      <button className="btn-primary mt-6" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Conectar Loja
      </button>
    </div>
  );
}

/* ── Add Store Modal ────────────────────────── */
function AddStoreModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [step, setStep] = useState<"platform" | "details">("platform");
  const [platform, setPlatform] = useState("");
  const [form, setForm] = useState({ storeName: "", storeUrl: "", apiKey: "", apiPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function selectPlatform(id: string) {
    setPlatform(id);
    setStep("details");
  }

  const platformHints: Record<string, { urlPlaceholder: string; keyLabel: string; keyPlaceholder: string; secretLabel: string; secretPlaceholder: string; help: string }> = {
    shopify: {
      urlPlaceholder: "https://minhaloja.myshopify.com",
      keyLabel: "Admin API Access Token",
      keyPlaceholder: "shpat_xxxxxxxxxxxxxxxxxxxxxxxx",
      secretLabel: "API Secret Key (opcional)",
      secretPlaceholder: "shpss_xxxxxxxxxxxxxxxxxxxxxxxx",
      help: "Vá em Shopify Admin → Configurações → Apps → Desenvolver apps → Criar app → Configurar Admin API → Instalar → Copiar o Access Token.",
    },
    woocommerce: {
      urlPlaceholder: "https://minhaloja.com.br",
      keyLabel: "Consumer Key",
      keyPlaceholder: "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      secretLabel: "Consumer Secret",
      secretPlaceholder: "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      help: "Vá em WP Admin → WooCommerce → Configurações → Avançado → REST API → Adicionar chave.",
    },
    vtex: {
      urlPlaceholder: "https://minhaloja.vtexcommercestable.com.br",
      keyLabel: "App Key",
      keyPlaceholder: "vtexappkey-minhaloja-XXXXXX",
      secretLabel: "App Token",
      secretPlaceholder: "Token da API VTEX",
      help: "Vá em VTEX Admin → Configurações da conta → Chaves de aplicação.",
    },
    magento: {
      urlPlaceholder: "https://minhaloja.com.br",
      keyLabel: "Access Token",
      keyPlaceholder: "Token de integração do Magento",
      secretLabel: "Consumer Secret (opcional)",
      secretPlaceholder: "Secret do consumer",
      help: "Vá em Magento Admin → Integrações → Adicionar Integração → Ativar → Copiar Access Token.",
    },
    nuvemshop: {
      urlPlaceholder: "https://minhaloja.lojavirtualnuvem.com.br",
      keyLabel: "Access Token",
      keyPlaceholder: "Token de acesso Nuvemshop",
      secretLabel: "",
      secretPlaceholder: "",
      help: "Use o app parceiro ou gere um token em Nuvemshop Admin → Apps.",
    },
    tray: {
      urlPlaceholder: "https://minhaloja.commercesuite.com.br",
      keyLabel: "API Key",
      keyPlaceholder: "Chave de API da Tray",
      secretLabel: "API Password",
      secretPlaceholder: "Senha da API",
      help: "Vá no painel Tray → Configurações → Integrações → API.",
    },
    lojaintegrada: {
      urlPlaceholder: "https://minhaloja.lojaintegrada.com.br",
      keyLabel: "API Key",
      keyPlaceholder: "Chave de API Loja Integrada",
      secretLabel: "",
      secretPlaceholder: "",
      help: "Vá no painel Loja Integrada → Configurações → Integrações → API.",
    },
    opencart: {
      urlPlaceholder: "https://minhaloja.com.br",
      keyLabel: "API Key",
      keyPlaceholder: "Chave de API do OpenCart",
      secretLabel: "API Secret",
      secretPlaceholder: "Secret da API",
      help: "Vá em OpenCart Admin → System → Users → API → Adicionar API.",
    },
  };

  const hints = platformHints[platform] || {
    urlPlaceholder: "https://minhaloja.com.br",
    keyLabel: "API Key",
    keyPlaceholder: "Chave de API da plataforma",
    secretLabel: "API Password / Secret",
    secretPlaceholder: "Senha ou secret da API",
    help: "",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/stores", {
        platform,
        storeName: form.storeName,
        storeUrl: form.storeUrl,
        credentials: { apiKey: form.apiKey, apiPassword: form.apiPassword },
      });
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao conectar loja");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {step === "platform" ? "Escolha a Plataforma" : `Conectar ${PLATFORMS.find(p => p.id === platform)?.name || "Loja"}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "platform" ? (
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPlatform(p.id)}
                  className="flex items-center gap-3 rounded-lg border-2 border-gray-200 px-4 py-3 text-left transition hover:border-brand-500 hover:bg-brand-50"
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-sm font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              {hints.help && (
                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                  <strong>Como obter as credenciais:</strong> {hints.help}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nome da Loja
                </label>
                <input
                  className="input mt-1"
                  value={form.storeName}
                  onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                  placeholder="Minha Loja Online"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  URL da Loja
                </label>
                <input
                  className="input mt-1"
                  type="url"
                  value={form.storeUrl}
                  onChange={(e) => setForm((f) => ({ ...f, storeUrl: e.target.value }))}
                  placeholder={hints.urlPlaceholder}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {hints.keyLabel}
                </label>
                <input
                  className="input mt-1"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder={hints.keyPlaceholder}
                  required
                />
              </div>

              {hints.secretLabel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {hints.secretLabel}
                  </label>
                  <input
                    className="input mt-1"
                    type="password"
                    value={form.apiPassword}
                    onChange={(e) => setForm((f) => ({ ...f, apiPassword: e.target.value }))}
                    placeholder={hints.secretPlaceholder}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep("platform")}
                >
                  Voltar
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Conectando..." : "Conectar Loja"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
