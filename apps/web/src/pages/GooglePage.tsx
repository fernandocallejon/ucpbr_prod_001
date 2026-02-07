// ============================================================
// RetailNexus — Google Merchant Center Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Link2,
  Link2Off,
  BarChart3,
  FileText,
  Send,
  ChevronRight,
} from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";

interface GmcStatus {
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

interface IndexingLog {
  id: string;
  url: string;
  type: "URL_UPDATED" | "URL_DELETED";
  status: "success" | "error";
  timestamp: string;
}

const defaultStatus: GmcStatus = {
  connected: false,
  totalProducts: 0,
  approvedProducts: 0,
  disapprovedProducts: 0,
  pendingProducts: 0,
  lastFeedSync: null,
  indexingQuota: { used: 0, total: 200 },
};

export default function GooglePage() {
  const [status, setStatus] = useState<GmcStatus>(defaultStatus);
  const [logs, setLogs] = useState<IndexingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        api.get<GmcStatus>("/api/google/status"),
        api.get<IndexingLog[]>("/api/google/indexing/logs"),
      ]);
      setStatus(s);
      setLogs(l);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }

  async function syncFeed() {
    setSyncing(true);
    try {
      await api.post("/api/google/feed/sync");
      await loadData();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  }

  async function connectGoogle() {
    try {
      const { url } = await api.get<{ url: string }>("/api/google/auth/url");
      window.location.href = url;
    } catch {
      alert("Erro ao iniciar conexão com Google.");
    }
  }

  const approvalPct = status.totalProducts
    ? Math.round((status.approvedProducts / status.totalProducts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Google Merchant Center
          </h1>
          <p className="text-sm text-gray-500">
            Gerencie feed de produtos, indexação e sinais UCP no Google Shopping.
          </p>
        </div>
        {status.connected && (
          <button
            className="btn-primary"
            onClick={syncFeed}
            disabled={syncing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar Feed"}
          </button>
        )}
      </div>

      {/* Connection status */}
      {!status.connected ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Link2Off className="h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Google não conectado
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Conecte sua conta Google Merchant Center para sincronizar produtos e
            ativar sinais UCP automaticamente.
          </p>
          <button className="btn-primary mt-6" onClick={connectGoogle}>
            <Link2 className="mr-2 h-4 w-4" />
            Conectar Google
          </button>
        </div>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Conectado</span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {status.email}
              </p>
              <p className="text-xs text-gray-400">
                Merchant ID: {status.merchantId}
              </p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-500">Produtos Aprovados</p>
              <p className="text-2xl font-bold text-green-600">
                {status.approvedProducts}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${approvalPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {approvalPct}% de {status.totalProducts}
              </p>
            </div>

            <div className="card">
              <p className="text-xs text-gray-500">Reprovados / Pendentes</p>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold text-red-600">
                  {status.disapprovedProducts}
                </span>
                <span className="text-lg font-semibold text-yellow-600">
                  {status.pendingProducts}
                </span>
              </div>
              {status.disapprovedProducts > 0 && (
                <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  Revisar produtos reprovados
                </p>
              )}
            </div>

            <div className="card">
              <p className="text-xs text-gray-500">Cota de Indexação (hoje)</p>
              <p className="text-2xl font-bold text-brand-600">
                {status.indexingQuota.used}/{status.indexingQuota.total}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    status.indexingQuota.used / status.indexingQuota.total > 0.8
                      ? "bg-red-500"
                      : "bg-brand-500"
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      (status.indexingQuota.used / status.indexingQuota.total) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {status.lastFeedSync
                  ? `Último sync: ${formatRelative(status.lastFeedSync)}`
                  : "Ainda não sincronizado"}
              </p>
            </div>
          </div>

          {/* UCP Signals */}
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Sinais UCP Ativos
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Preço competitivo",
                  desc: "[price] atualizado no feed",
                  active: true,
                },
                {
                  label: "Frete grátis / rápido",
                  desc: "[shipping] com SLA correto",
                  active: true,
                },
                {
                  label: "Política de devolução",
                  desc: "[return_policy_label] configurado",
                  active: true,
                },
                {
                  label: "GTIN válido",
                  desc: "[gtin] compatível com GS1",
                  active: true,
                },
              ].map((signal) => (
                <div
                  key={signal.label}
                  className={cn(
                    "rounded-lg border-2 p-3",
                    signal.active
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {signal.active ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">{signal.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{signal.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Indexing Logs */}
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              Logs de Indexação Recentes
            </h3>
            {logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                Nenhum log de indexação ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                  >
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                    )}
                    <span className="flex-1 truncate text-gray-700">
                      {log.url}
                    </span>
                    <span className="text-xs text-gray-400">
                      {log.type === "URL_UPDATED" ? "Atualizado" : "Removido"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatRelative(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
