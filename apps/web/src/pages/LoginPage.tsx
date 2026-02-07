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
        <img src="/logo.png" alt="UCPBR" className="h-40 w-40 object-contain" />
        <div className="mt-10 text-center">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Domine o UCP do Google.
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Seja a recomendação #1.
          </p>
          <p className="mt-4 max-w-md text-sm text-gray-500">
            Precificação dinâmica e competitiva para e-commerce. Conecte sua
            loja, monitore concorrentes e deixe a IA do Google trabalhar
            para você.
          </p>
        </div>
        <p className="mt-auto text-sm text-gray-600">
          © 2026 UCPBR. Todos os direitos reservados.
        </p>
      </div>

      {/* Right side — form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src="/logo.png" alt="UCPBR" className="h-20 w-20 object-contain" />
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
