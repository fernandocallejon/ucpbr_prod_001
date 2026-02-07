// ============================================================
// RetailNexus — Login Page
// ============================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side — branding */}
      <div className="hidden w-1/2 flex-col items-center bg-black px-10 py-12 lg:flex">
        <div className="flex flex-1 flex-col items-center justify-center">
          <img src="/logo.png" alt="UCPBR" className="h-56 w-56 object-contain drop-shadow-2xl" />

          <h1 className="mt-8 text-center text-2xl font-bold leading-snug text-white">
            Seus concorrentes já estão no topo<br />do Google Shopping.<br />
            <span className="text-gray-400">E você?</span>
          </h1>
          <p className="mt-3 max-w-sm text-center text-sm text-gray-500">
            O UCPBR conecta sua loja, analisa o mercado e posiciona seus produtos como <span className="text-gray-300">a escolha recomendada pelo Google</span> — sem esforço manual.
          </p>

          {/* Step cards */}
          <div className="mt-10 flex w-full max-w-md flex-col gap-3">
            {[
              { step: "1", title: "Conecte sua loja", desc: "Shopify, VTEX, Nuvemshop, WooCommerce… integração em 3 minutos.", icon: "🔗" },
              { step: "2", title: "Análise automática", desc: "Escaneamos concorrentes, preços e sinais UCP em tempo real.", icon: "📊" },
              { step: "3", title: "Precificação inteligente", desc: "Ajuste automático de preços para maximizar margem e visibilidade.", icon: "⚡" },
              { step: "4", title: "Domine o Google Shopping", desc: "Seus produtos ganham o selo de recomendação e mais cliques qualificados.", icon: "🏆" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-4 rounded-xl bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base">
                  {s.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[11px] text-gray-700">
          © 2026 UCPBR. Todos os direitos reservados.
        </p>
      </div>

      {/* Right side — form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src="/logo.png" alt="UCPBR" className="h-24 w-24 object-contain" />
          </div>

          <div>
            <h2 className="text-2xl font-bold">Entrar na sua conta</h2>
            <p className="mt-2 text-sm text-gray-500">
              Não tem conta?{" "}
              <Link
                to="/register"
                className="font-medium text-brand-600 hover:text-brand-500"
              >
                Criar conta grátis
              </Link>
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
