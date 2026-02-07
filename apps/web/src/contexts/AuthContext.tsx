// ============================================================
// RetailNexus — Auth Context
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "user" | "root";
  companyName?: string;
  plan?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  companyName: string;
  email: string;
  password: string;
  cnpj?: string;
  plan?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api
        .get<{ user: User }>("/api/auth/me")
        .then((data) => setUser(data.user))
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ token: string; tenant: User }>(
      "/api/auth/login",
      { email, password }
    );
    api.setToken(data.token);
    setUser(data.tenant);
  }, []);

  const register = useCallback(async (body: RegisterData) => {
    const data = await api.post<{ token: string; tenant: User }>(
      "/api/auth/register",
      body
    );
    api.setToken(data.token);
    setUser(data.tenant);
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
