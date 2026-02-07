// ============================================================
// RetailNexus — Dashboard Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package,
  Store,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { formatCurrency, ucpScoreBadge } from "@/lib/utils";

interface DashboardStats {
  totalProducts: number;
  totalStores: number;
  avgUcpScore: number;
  productsEligible: number;
  productsAlmost: number;
  productsNotEligible: number;
  recentPriceChanges: number;
  avgPriceParity: number;
}

interface ChartDataPoint {
  date: string;
  score: number;
  products: number;
}

const defaultStats: DashboardStats = {
  totalProducts: 0,
  totalStores: 0,
  avgUcpScore: 0,
  productsEligible: 0,
  productsAlmost: 0,
  productsNotEligible: 0,
  recentPriceChanges: 0,
  avgPriceParity: 0,
};

// Seed demo chart data (7 days)
function demoChartData(): ChartDataPoint[] {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      score: Math.round(50 + Math.random() * 40),
      products: Math.round(80 + Math.random() * 120),
    });
  }
  return days;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [chart] = useState<ChartDataPoint[]>(demoChartData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<DashboardStats>("/api/dashboard/stats");
        setStats(data);
      } catch {
        // keep default stats — API may not be deployed yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ucpBadge = ucpScoreBadge(stats.avgUcpScore);
  const ucpColorMap: Record<string, string> = {
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
  };

  const kpis = [
    {
      label: "Produtos",
      value: stats.totalProducts,
      icon: Package,
      color: "bg-blue-50 text-blue-600",
      change: null,
    },
    {
      label: "Lojas Conectadas",
      value: stats.totalStores,
      icon: Store,
      color: "bg-green-50 text-green-600",
      change: null,
    },
    {
      label: "UCP Score Médio",
      value: `${stats.avgUcpScore}%`,
      icon: ShieldCheck,
      color: ucpColorMap[ucpBadge.color] || "bg-gray-50 text-gray-600",
      change: null,
    },
    {
      label: "Alterações de Preço (7d)",
      value: stats.recentPriceChanges,
      icon: TrendingUp,
      color: "bg-purple-50 text-purple-600",
      change: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Bem-vindo, {user?.companyName || "Lojista"}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card flex items-start gap-4">
            <div className={`rounded-lg p-3 ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{kpi.label}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "—" : kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Readiness */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* UCP Score trend */}
        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Evolução UCP Score (7 dias)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="ucpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-brand-500, #6366f1)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-brand-500, #6366f1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                fill="url(#ucpGrad)"
                strokeWidth={2}
                name="UCP Score"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* UCP Readiness breakdown */}
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Prontidão UCP
          </h3>

          <div className="space-y-4">
            <ReadinessBar
              label="Elegível"
              count={stats.productsEligible}
              total={stats.totalProducts || 1}
              color="bg-green-500"
            />
            <ReadinessBar
              label="Quase pronto"
              count={stats.productsAlmost}
              total={stats.totalProducts || 1}
              color="bg-yellow-500"
            />
            <ReadinessBar
              label="Não elegível"
              count={stats.productsNotEligible}
              total={stats.totalProducts || 1}
              color="bg-red-500"
            />
          </div>

          {stats.productsNotEligible > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                {stats.productsNotEligible} produtos precisam de atenção para se
                tornarem elegíveis ao UCP.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Products synced chart */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Produtos Sincronizados (7 dias)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar
              dataKey="products"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              name="Produtos"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* Small helper component */
function ReadinessBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = Math.round((count / total) * 100) || 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">
          {count} ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
