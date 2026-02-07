// ============================================================
// RetailNexus — Competitive Intelligence Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Eye,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency, cn } from "@/lib/utils";

interface CompetitorPrice {
  id: string;
  gtin: string;
  productTitle: string;
  myPrice: number;
  competitorName: string;
  competitorPrice: number;
  priceDiff: number; // negative = cheaper, positive = more expensive
  lastSeen: string;
  source: string;
}

interface CompetitiveStats {
  totalTracked: number;
  cheaperCount: number;
  matchCount: number;
  moreExpensiveCount: number;
  avgPriceParity: number;
}

const defaultStats: CompetitiveStats = {
  totalTracked: 0,
  cheaperCount: 0,
  matchCount: 0,
  moreExpensiveCount: 0,
  avgPriceParity: 0,
};

export default function CompetitivePage() {
  const [stats, setStats] = useState<CompetitiveStats>(defaultStats);
  const [prices, setPrices] = useState<CompetitorPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "cheaper" | "match" | "expensive">("all");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.get<CompetitiveStats>("/api/competitive/stats"),
        api.get<CompetitorPrice[]>("/api/competitive/prices"),
      ]);
      setStats(s);
      setPrices(p);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }

  async function triggerScan() {
    setScanning(true);
    try {
      await api.post("/api/competitive/scan");
      await loadData();
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }

  const filtered = prices.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.productTitle.toLowerCase().includes(q) &&
        !p.gtin.includes(q) &&
        !p.competitorName.toLowerCase().includes(q)
      )
        return false;
    }
    if (filter === "cheaper") return p.priceDiff < -1;
    if (filter === "match") return Math.abs(p.priceDiff) <= 1;
    if (filter === "expensive") return p.priceDiff > 1;
    return true;
  });

  const chartData = [
    { name: "Mais barato", value: stats.cheaperCount, fill: "#22c55e" },
    { name: "Match", value: stats.matchCount, fill: "#6366f1" },
    { name: "Mais caro", value: stats.moreExpensiveCount, fill: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Inteligência Competitiva
          </h1>
          <p className="text-sm text-gray-500">
            Acompanhe preços dos concorrentes no Google Shopping e marketplaces.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={triggerScan}
          disabled={scanning}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", scanning && "animate-spin")} />
          {scanning ? "Escaneando..." : "Nova Varredura"}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs text-gray-500">Produtos Monitorados</p>
          <p className="text-2xl font-bold">{stats.totalTracked}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Você é mais barato</p>
          <p className="text-2xl font-bold text-green-600">
            {stats.cheaperCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Preço equivalente</p>
          <p className="text-2xl font-bold text-brand-600">
            {stats.matchCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Mais caro que concorrente</p>
          <p className="text-2xl font-bold text-red-600">
            {stats.moreExpensiveCount}
          </p>
        </div>
      </div>

      {/* Chart + Filter */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Posição de Preço
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Produtos">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Paridade de Preço
          </h3>
          <div className="flex h-48 flex-col items-center justify-center">
            <p className="text-5xl font-bold text-gray-900">
              {stats.avgPriceParity.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Índice médio de paridade com concorrentes
            </p>
            <p className="mt-1 text-xs text-gray-400">
              100% = preço idêntico · {">"} 100% = mais caro
            </p>
          </div>
        </div>
      </div>

      {/* Competitor prices table */}
      <div className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Buscar produto ou concorrente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(
              [
                { v: "all", l: "Todos" },
                { v: "cheaper", l: "Mais barato" },
                { v: "match", l: "Match" },
                { v: "expensive", l: "Mais caro" },
              ] as const
            ).map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  filter === f.v
                    ? "bg-brand-100 text-brand-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <BarChart3 className="mx-auto mb-2 h-8 w-8" />
            Nenhum dado de preço concorrente
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Seu Preço</th>
                  <th className="px-4 py-3">Concorrente</th>
                  <th className="px-4 py-3">Preço Deles</th>
                  <th className="px-4 py-3">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {p.productTitle}
                      </p>
                      <p className="text-xs text-gray-400">{p.gtin}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(p.myPrice)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.competitorName}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(p.competitorPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-sm font-semibold",
                          p.priceDiff < -1
                            ? "text-green-600"
                            : p.priceDiff > 1
                              ? "text-red-600"
                              : "text-gray-500"
                        )}
                      >
                        {p.priceDiff < -1 ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : p.priceDiff > 1 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        {p.priceDiff > 0 ? "+" : ""}
                        {p.priceDiff.toFixed(1)}%
                      </span>
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
