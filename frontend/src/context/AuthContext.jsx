import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

function normalizeToken(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => normalizeToken(localStorage.getItem("access_token")));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token && !user) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("access_token");
          setToken(null);
        });
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.detail ?? "Login gagal";
    }
    const data = await res.json();
    const nextToken = normalizeToken(data?.access_token);
    if (!nextToken) {
      return "Token login tidak valid dari server";
    }
    localStorage.setItem("access_token", nextToken);
    setToken(nextToken);
    const me = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${nextToken}` },
    });
    if (me.ok) setUser(await me.json());
    return null;
  };

  const register = async (name, email, password) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.detail ?? "Registrasi gagal";
    }
    return null;
  };

  const logout = () => {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
