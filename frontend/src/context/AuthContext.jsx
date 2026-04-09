import { createContext, useContext, useState, useEffect, useCallback } from "react";

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

// =============================================================================
// DatasetContext
// =============================================================================
const DatasetContext = createContext(null);

export function DatasetProvider({ children }) {
  const { token } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState(() => {
    try { return JSON.parse(localStorage.getItem("selected_dataset")); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const authHeaders = useCallback(() => {
    const t = normalizeToken(token);
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [token]);

  const fetchDatasets = useCallback(async () => {
    if (!normalizeToken(token)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/datasets", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDatasets(data);
        // keep selection in sync with fresh data
        setSelected((prev) => {
          if (!prev) return null;
          const still = data.find((d) => d.id === prev.id);
          if (!still) { localStorage.removeItem("selected_dataset"); return null; }
          localStorage.setItem("selected_dataset", JSON.stringify(still));
          return still;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  const selectDataset = (ds) => {
    setSelected(ds);
    if (ds) localStorage.setItem("selected_dataset", JSON.stringify(ds));
    else localStorage.removeItem("selected_dataset");
  };

  const createDataset = async (name) => {
    if (!normalizeToken(token)) return { error: "User belum login" };
    const res = await fetch("/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.detail ?? "Gagal membuat dataset" };
    }
    const created = await res.json();
    setDatasets((prev) => [...prev, created]);
    return { data: created };
  };

  const updateDataset = async (id, name) => {
    if (!normalizeToken(token)) return { error: "User belum login" };
    const res = await fetch(`/api/datasets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.detail ?? "Gagal mengupdate dataset" };
    }
    const updated = await res.json();
    setDatasets((prev) => prev.map((d) => (d.id === id ? updated : d)));
    if (selected?.id === id) selectDataset(updated);
    return { data: updated };
  };

  const deleteDataset = async (id) => {
    if (!normalizeToken(token)) return { error: "User belum login" };
    const res = await fetch(`/api/datasets/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.detail ?? "Gagal menghapus dataset" };
    }
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    if (selected?.id === id) selectDataset(null);
    return {};
  };

  return (
    <DatasetContext.Provider
      value={{ datasets, selected, loading, selectDataset, createDataset, updateDataset, deleteDataset, refetch: fetchDatasets }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export const useDataset = () => useContext(DatasetContext);
