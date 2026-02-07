// ============================================================
// RetailNexus — App Router
// ============================================================

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import StoresPage from "@/pages/StoresPage";
import ProductsPage from "@/pages/ProductsPage";
import PricingPage from "@/pages/PricingPage";
import CompetitivePage from "@/pages/CompetitivePage";
import GooglePage from "@/pages/GooglePage";
import SettingsPage from "@/pages/SettingsPage";
import BillingPage from "@/pages/BillingPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="competitive" element={<CompetitivePage />} />
        <Route path="google" element={<GooglePage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
