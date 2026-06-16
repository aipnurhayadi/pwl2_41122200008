import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

function getApiErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  if (payload.errors && typeof payload.errors === "object") {
    const firstField = Object.values(payload.errors)[0];
    if (Array.isArray(firstField) && firstField[0]) return String(firstField[0]);
  }
  return fallback;
}

function normalizeToken(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

function normalizeUser(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return payload;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => normalizeToken(localStorage.getItem("access_token")));
  const [refreshToken, setRefreshToken] = useState(() => normalizeToken(localStorage.getItem("refresh_token")));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (user?.data && typeof user.data === "object") {
      setUser(normalizeUser(user));
    }
  }, [user]);

  useEffect(() => {
    if (token && !user) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((payload) => setUser(normalizeUser(payload)))
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
      return getApiErrorMessage(data, "Login gagal");
    }
    const data = await res.json();
    const nextToken = normalizeToken(data?.access_token);
    const nextRefreshToken = normalizeToken(data?.refresh_token);
    if (!nextToken) {
      return "Token login tidak valid dari server";
    }
    localStorage.setItem("access_token", nextToken);
    setToken(nextToken);
    if (nextRefreshToken) {
      localStorage.setItem("refresh_token", nextRefreshToken);
      setRefreshToken(nextRefreshToken);
    } else {
      localStorage.removeItem("refresh_token");
      setRefreshToken(null);
    }
    const me = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${nextToken}` },
    });
    if (me.ok) setUser(normalizeUser(await me.json()));
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
      return getApiErrorMessage(data, "Registrasi gagal");
    }
    return null;
  };

  const logout = () => {
    if (token && refreshToken) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
