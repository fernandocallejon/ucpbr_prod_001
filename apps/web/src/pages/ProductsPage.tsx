// ============================================================
// RetailNexus — Products Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Package,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import { formatCurrency, ucpScoreBadge, cn, truncate } from "@/lib/utils";

interface Product {
  id: string;
  gtin: string;
  title: string;
  price: number;
  imageUrl?: string;
  brand?: string;
  category?: string;
  ucpReadinessScore: number;
  ucpReadinessLevel: "eligible" | "almost" | "not_eligible";
  availability: string;
  lastSync: string | null;
  storeId: string;
  storeName: string;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
}

const READINESS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "eligible", label: "Elegível" },
  { value: "almost", label: "Quase pronto" },
  { value: "not_eligible", label: "Não elegível" },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [readiness, setReadiness] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    loadProducts();
  }, [page, readiness]);

  async function loadProducts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (readiness) params.set("readiness", readiness);
      const res = await api.get<ProductsResponse>(`/api/products?${params}`);
      setProducts(res.data);
      setTotal(res.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadProducts();
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <p className="text-sm text-gray-500">
          {total} produto{total !== 1 ? "s" : ""} sincronizado
          {total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-10"
            placeholder="Buscar por título ou GTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <select
          className="input w-auto"
          value={readiness}
          onChange={(e) => {
            setReadiness(e.target.value);
            setPage(1);
          }}
        >
          {READINESS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">GTIN</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Disponibilidade</th>
              <th className="px-4 py-3">UCP Score</th>
              <th className="px-4 py-3">Loja</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  <Package className="mx-auto mb-2 h-8 w-8" />
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const badge = ucpScoreBadge(p.ucpReadinessScore);
                return (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {truncate(p.title, 45)}
                          </p>
                          {p.brand && (
                            <p className="text-xs text-gray-400">{p.brand}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {p.gtin || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          p.availability === "InStock"
                            ? "text-green-600"
                            : "text-red-500"
                        )}
                      >
                        {p.availability === "InStock" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {p.availability === "InStock"
                          ? "Em estoque"
                          : "Indisponível"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          badge.color === "green" && "bg-green-100 text-green-700",
                          badge.color === "yellow" && "bg-yellow-100 text-yellow-700",
                          badge.color === "red" && "bg-red-100 text-red-700"
                        )}
                      >
                        {p.ucpReadinessScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.storeName}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-gray-400 hover:text-brand-600">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Mostrando {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
