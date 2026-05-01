import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

const DatasetContext = createContext(null);

function normalizeToken(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export function DatasetProvider({ children }) {
  const { token } = useAuth();
  const DATASETS_API = "/api/datasets/";

  const [datasets, setDatasets] = useState([]);
  const [selected, setSelected] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("selected_dataset"));
    } catch {
      return null;
    }
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
      const res = await fetch(DATASETS_API, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDatasets(data);
        // Keep selection in sync with fresh data.
        setSelected((prev) => {
          if (!prev) return null;
          const still = data.find((d) => d.id === prev.id);
          if (!still) {
            localStorage.removeItem("selected_dataset");
            return null;
          }
          localStorage.setItem("selected_dataset", JSON.stringify(still));
          return still;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders, DATASETS_API]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const selectDataset = (ds) => {
    setSelected(ds);
    if (ds) localStorage.setItem("selected_dataset", JSON.stringify(ds));
    else localStorage.removeItem("selected_dataset");
  };

  const createDataset = async (payload) => {
    if (!normalizeToken(token)) return { error: "User belum login" };
    const res = await fetch(DATASETS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { error: d.detail ?? "Gagal membuat dataset" };
    }
    const created = await res.json();
    setDatasets((prev) => [...prev, created]);
    return { data: created };
  };

  const updateDataset = async (id, payload) => {
    if (!normalizeToken(token)) return { error: "User belum login" };
    const res = await fetch(`/api/datasets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
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
      value={{
        datasets,
        selected,
        loading,
        selectDataset,
        createDataset,
        updateDataset,
        deleteDataset,
        refetch: fetchDatasets,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export const useDataset = () => useContext(DatasetContext);