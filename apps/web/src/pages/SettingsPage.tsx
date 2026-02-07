// ============================================================
// RetailNexus — Settings Page
// ============================================================

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Settings,
  Save,
  User,
  Bell,
  Clock,
  Shield,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TenantSettings {
  scanIntervalMinutes: number;
  autoRepricing: boolean;
  timezone: string;
  notifyPriceChanges: boolean;
  notifyUcpAlerts: boolean;
  notifyWeeklyReport: boolean;
  minMarginThreshold: number;
  maxAutoPriceChangePercent: number;
}

const defaultSettings: TenantSettings = {
  scanIntervalMinutes: 240,
  autoRepricing: false,
  timezone: "America/Sao_Paulo",
  notifyPriceChanges: true,
  notifyUcpAlerts: true,
  notifyWeeklyReport: true,
  minMarginThreshold: 5,
  maxAutoPriceChangePercent: 10,
};

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Recife",
  "America/Bahia",
  "America/Fortaleza",
  "America/Belem",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
];

const SCAN_OPTIONS = [
  { value: 60, label: "A cada hora" },
  { value: 120, label: "A cada 2 horas" },
  { value: 240, label: "A cada 4 horas" },
  { value: 360, label: "A cada 6 horas" },
  { value: 720, label: "A cada 12 horas" },
  { value: 1440, label: "Uma vez por dia" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TenantSettings>(defaultSettings);
  const [profile, setProfile] = useState({
    companyName: user?.companyName || "",
    email: user?.email || "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "notifications" | "profile">("general");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await api.get<TenantSettings>("/api/settings");
      setSettings(data);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.put("/api/settings", settings);
      showSaved("Configurações salvas!");
    } catch {
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await api.put("/api/auth/profile", profile);
      showSaved("Perfil atualizado!");
    } catch {
      alert("Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  function showSaved(msg: string) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  function updateSettings<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const tabs = [
    { id: "general" as const, label: "Geral", icon: Settings },
    { id: "notifications" as const, label: "Notificações", icon: Bell },
    { id: "profile" as const, label: "Perfil", icon: User },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500">
          Personalize o comportamento da plataforma para seu negócio.
        </p>
      </div>

      {/* Success message */}
      {savedMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {savedMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === "general" && (
        <div className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Intervalo de Varredura
            </label>
            <p className="mb-2 text-xs text-gray-400">
              Frequência de sincronização de preços com concorrentes.
            </p>
            <select
              className="input w-auto"
              value={settings.scanIntervalMinutes}
              onChange={(e) =>
                updateSettings("scanIntervalMinutes", +e.target.value)
              }
            >
              {SCAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fuso Horário
            </label>
            <select
              className="input mt-1 w-auto"
              value={settings.timezone}
              onChange={(e) => updateSettings("timezone", e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t pt-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              <Shield className="mr-1 inline h-4 w-4" />
              Precificação Automática
            </h3>

            <div className="space-y-4">
              <Toggle
                label="Auto-repricing"
                description="Ajustar preços automaticamente com base nas regras ativas."
                checked={settings.autoRepricing}
                onChange={(v) => updateSettings("autoRepricing", v)}
              />

              {settings.autoRepricing && (
                <div className="ml-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Margem Mínima (%)
                    </label>
                    <input
                      type="number"
                      className="input mt-1"
                      step="0.1"
                      value={settings.minMarginThreshold}
                      onChange={(e) =>
                        updateSettings("minMarginThreshold", +e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Variação Máxima (%)
                    </label>
                    <input
                      type="number"
                      className="input mt-1"
                      step="0.5"
                      value={settings.maxAutoPriceChangePercent}
                      onChange={(e) =>
                        updateSettings(
                          "maxAutoPriceChangePercent",
                          +e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <button
              className="btn-primary"
              disabled={saving}
              onClick={saveSettings}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}

      {/* Notifications tab */}
      {activeTab === "notifications" && (
        <div className="card space-y-6">
          <Toggle
            label="Alterações de preço"
            description="Receba notificação quando um preço for alterado automaticamente."
            checked={settings.notifyPriceChanges}
            onChange={(v) => updateSettings("notifyPriceChanges", v)}
          />
          <Toggle
            label="Alertas UCP"
            description="Seja notificado quando o UCP Score de um produto cair abaixo do limiar."
            checked={settings.notifyUcpAlerts}
            onChange={(v) => updateSettings("notifyUcpAlerts", v)}
          />
          <Toggle
            label="Relatório Semanal"
            description="Receba um resumo semanal com métricas e recomendações."
            checked={settings.notifyWeeklyReport}
            onChange={(v) => updateSettings("notifyWeeklyReport", v)}
          />
          <div className="flex justify-end border-t pt-4">
            <button
              className="btn-primary"
              disabled={saving}
              onClick={saveSettings}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="card space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nome da Empresa
            </label>
            <input
              className="input mt-1"
              value={profile.companyName}
              onChange={(e) =>
                setProfile((p) => ({ ...p, companyName: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              className="input mt-1"
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Plano Atual
            </label>
            <p className="mt-1 text-sm capitalize text-gray-600">
              {user?.plan || "basic"}
            </p>
          </div>

          <div className="flex justify-end border-t pt-4">
            <button
              className="btn-primary"
              disabled={savingProfile}
              onClick={saveProfile}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingProfile ? "Salvando..." : "Atualizar Perfil"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Toggle Helper ─────────────────────────── */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative flex-shrink-0 h-6 w-11 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}
