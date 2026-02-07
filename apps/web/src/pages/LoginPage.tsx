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
      <div className="hidden w-1/2 flex-col items-center justify-center bg-black p-12 lg:flex">
        <img src="/logo.png" alt="UCPBR" className="h-56 w-56 object-contain drop-shadow-2xl" />

        <h1 className="mt-10 text-center text-4xl font-extrabold leading-tight tracking-tight text-white">
          Venda mais.<br />Pague menos por clique.
        </h1>
        <p className="mt-3 max-w-md text-center text-lg text-gray-300">
          A plataforma que coloca seus produtos na <span className="font-semibold text-white">recomendação #1 do Google Shopping</span> — automaticamente.
        </p>

        {/* Value props */}
        <div className="mt-10 grid max-w-lg grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-white">3 min</p>
            <p className="mt-1 text-xs text-gray-500">Para conectar sua loja</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">100%</p>
            <p className="mt-1 text-xs text-gray-500">Automático, sem planilhas</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">+40%</p>
            <p className="mt-1 text-xs text-gray-500">Mais visibilidade média</p>
          </div>
        </div>

        <div className="mt-10 max-w-md space-y-3">
          {[
            "Conecte a loja → sincronização instantânea de produtos",
            "Precificação dinâmica que reage aos concorrentes em tempo real",
            "Sinais UCP otimizados: GTIN, frete, devoluções, preço",
            "Dashboard com score UCP e inteligência competitiva",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white">✓</span>
              <span className="text-sm text-gray-400">{item}</span>
            </div>
          ))}
        </div>

        <p className="mt-auto text-xs text-gray-700">
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
