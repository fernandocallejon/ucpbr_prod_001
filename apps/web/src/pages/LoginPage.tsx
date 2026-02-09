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
      <div className="hidden w-1/2 flex-col bg-black px-10 py-12 lg:flex">
        {/* Logo — pushed up */}
        <div className="flex justify-center pt-2">
          <img src="/logo.png" alt="UCPBR" className="h-72 w-72 object-contain drop-shadow-2xl" />
        </div>

        {/* Content row: headline left | steps right */}
        <div className="flex flex-1 items-start gap-10 px-2 -mt-2">
          {/* Left — phrase aligned to top of steps */}
          <div className="flex-1 pt-1">
            <h1 className="text-2xl font-bold leading-snug text-white">
              Seus concorrentes já estão no topo do Google Shopping.
            </h1>
            <p className="mt-2 text-3xl font-extrabold text-gray-400">E você?</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              O UCPBR conecta sua loja, analisa o mercado e posiciona seus produtos como <span className="text-gray-300">a escolha recomendada pelo Google</span> — sem esforço manual.
            </p>
          </div>

          {/* Right — step cards with black bg + white icons */}
          <div className="flex w-56 shrink-0 flex-col gap-3">
            {[
              { step: "1", title: "Conecte sua loja", desc: "Integração em 3 min.", icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
              )},
              { step: "2", title: "Análise automática", desc: "Concorrentes em tempo real.", icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              )},
              { step: "3", title: "Precificação smart", desc: "Margem + visibilidade.", icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )},
              { step: "4", title: "Domine o Google", desc: "Selo de recomendação.", icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              )},
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3 rounded-xl bg-white/[0.04] px-3 py-3 backdrop-blur-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-white ring-1 ring-white/20">
                  {s.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{s.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-gray-700">
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
