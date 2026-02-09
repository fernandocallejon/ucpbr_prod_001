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
  const [successMsg, setSuccessMsg] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

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

      {/* OAuth Success Banner */}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-green-500 hover:text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
  const [step, setStep] = useState<"platform" | "connect">("platform");
  const [platform, setPlatform] = useState("");
  const [form, setForm] = useState({ storeName: "", storeUrl: "", accessToken: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTokenGuide, setShowTokenGuide] = useState(false);

  const isTokenPlatform = platform === "shopify";
  const isBridgePlatform = ["woocommerce", "magento", "opencart"].includes(platform);

  const urlPlaceholders: Record<string, string> = {
    shopify: "https://minhaloja.myshopify.com",
    woocommerce: "https://minhaloja.com.br",
    vtex: "https://minhaloja.vtexcommercestable.com.br",
    magento: "https://minhaloja.com.br",
    nuvemshop: "https://minhaloja.lojavirtualnuvem.com.br",
    tray: "https://minhaloja.commercesuite.com.br",
    lojaintegrada: "https://minhaloja.lojaintegrada.com.br",
    opencart: "https://minhaloja.com.br",
  };

  function selectPlatform(id: string) {
    setPlatform(id);
    setStep("connect");
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isTokenPlatform && !form.accessToken.trim()) {
      setError("O Access Token do Shopify é obrigatório. Siga o guia abaixo para obtê-lo.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        platform,
        storeName: form.storeName,
        storeUrl: form.storeUrl,
      };
      if (isTokenPlatform) {
        payload.accessToken = form.accessToken.trim();
      }

      const res = await api.post<{
        store: any;
        bridgeDownloadUrl: string | null;
        needsBridgeFile: boolean;
        message: string;
      }>("/api/stores/bridge", payload);

      // Self-hosted platforms may need bridge file installed on server
      if (res.needsBridgeFile && res.bridgeDownloadUrl) {
        alert(
          `Loja conectada!\n\nPara completar a integração com ${platformName}, baixe e instale o conector bridge no servidor da sua loja:\n\n${res.bridgeDownloadUrl}`
        );
      }
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao conectar loja");
      setLoading(false);
    }
  }

  const platformName = PLATFORMS.find(p => p.id === platform)?.name || "Loja";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">
            {step === "platform" ? "Escolha a Plataforma" : `Conectar ${platformName}`}
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
            <form onSubmit={handleConnect} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}

              {/* Info box based on platform type */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                {isTokenPlatform ? (
                  <>
                    <strong>Conexão via API2Cart:</strong> Para conectar sua loja Shopify, você precisa
                    criar um Custom App no painel admin do Shopify e fornecer o Access Token.
                    {" "}
                    <button
                      type="button"
                      className="underline font-semibold"
                      onClick={() => setShowTokenGuide(!showTokenGuide)}
                    >
                      {showTokenGuide ? "Ocultar guia" : "Ver passo a passo"}
                    </button>
                  </>
                ) : isBridgePlatform ? (
                  <>
                    <strong>Conexão via Bridge:</strong> Após conectar, você receberá um arquivo bridge
                    para instalar no servidor da sua loja. A API2Cart usará este arquivo para acessar os dados.
                  </>
                ) : (
                  <>
                    <strong>Conexão automática via API2Cart:</strong> Informe o nome e a URL da sua loja.
                    A integração será configurada automaticamente.
                  </>
                )}
              </div>

              {/* Shopify Token Guide */}
              {isTokenPlatform && showTokenGuide && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-700 space-y-2">
                  <p className="font-semibold text-sm text-gray-900">Como obter o Access Token do Shopify:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>No admin do Shopify, vá em <strong>Configurações</strong> → <strong>Apps e canais de vendas</strong></li>
                    <li>Clique em <strong>Desenvolver apps</strong> (canto superior)</li>
                    <li>Clique <strong>Criar um app</strong> → dê o nome "RetailNexus"</li>
                    <li>Em <strong>Configurar escopos da Admin API</strong>, selecione:
                      <ul className="ml-4 mt-1 list-disc text-gray-500">
                        <li><code className="bg-gray-200 px-1 rounded">read_products</code></li>
                        <li><code className="bg-gray-200 px-1 rounded">read_inventory</code></li>
                        <li><code className="bg-gray-200 px-1 rounded">read_product_listings</code></li>
                      </ul>
                    </li>
                    <li>Clique <strong>Instalar app</strong> e confirme</li>
                    <li>Copie o <strong>Admin API access token</strong> e cole abaixo</li>
                  </ol>
                  <p className="text-gray-500 mt-2 italic">
                    O token só aparece uma vez — guarde-o em local seguro!
                  </p>
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
                  placeholder={urlPlaceholders[platform] || "https://minhaloja.com.br"}
                  required
                />
              </div>

              {/* Access Token field for Shopify */}
              {isTokenPlatform && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Access Token (Admin API)
                  </label>
                  <input
                    className="input mt-1 font-mono text-sm"
                    type="password"
                    value={form.accessToken}
                    onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Token do Custom App criado no painel admin do Shopify
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setPlatform(""); setStep("platform"); setShowTokenGuide(false); }}
                >
                  Voltar
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    "Conectar Loja"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
