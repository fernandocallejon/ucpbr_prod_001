// ============================================================
// RetailNexus — Register Page
// ============================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";


export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    cnpj: "",
    plan: "basic",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        companyName: form.companyName,
        email: form.email,
        password: form.password,
        cnpj: form.cnpj || undefined,
        plan: form.plan,
      });
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="UCP" className="h-12 w-12 rounded-xl object-contain" />
          <h2 className="mt-4 text-2xl font-bold">Criar conta RetailNexus</h2>
          <p className="mt-2 text-sm text-gray-500">
            Já tem conta?{" "}
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-500"
            >
              Fazer login
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              className="input mt-1"
              placeholder="Minha Loja Online"
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="input mt-1"
              placeholder="contato@minhaloja.com.br"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="input mt-1"
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              CNPJ <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.cnpj}
              onChange={(e) => update("cnpj", e.target.value)}
              className="input mt-1"
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Plano
            </label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(["basic", "pro", "enterprise"] as const).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => update("plan", plan)}
                  className={`rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-all ${
                    form.plan === plan
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold capitalize">{plan}</div>
                  <div className="text-xs text-gray-500">
                    {plan === "basic" && "500 SKUs"}
                    {plan === "pro" && "5.000 SKUs"}
                    {plan === "enterprise" && "Ilimitado"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
