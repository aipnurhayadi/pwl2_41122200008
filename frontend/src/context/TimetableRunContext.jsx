import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

const TimetableRunContext = createContext(null);

const STORAGE_KEY = "pwl2_active_timetable_run";
const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING"]);

const PHASE_LABELS = {
  AGGREGATING_BWM: "Mengagregasi bobot BWM...",
  BUILDING_PAYLOAD: "Menyusun payload solver...",
  RUNNING_SOLVER: "Menjalankan solver ILP...",
  PERSISTING: "Menyimpan hasil jadwal...",
  COMPLETED: "Selesai",
};

function resolvePhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? "Memproses penjadwalan...";
}

function readStoredRun() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.datasetId || !parsed?.runId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredRun(run) {
  if (!run?.datasetId || !run?.runId) return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      datasetId: run.datasetId,
      runId: run.runId,
      datasetName: run.datasetName ?? "",
    }),
  );
}

function clearStoredRun() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function TimetableRunProvider({ children }) {
  const { token } = useAuth();
  const [activeRun, setActiveRun] = useState(null);
  const pollRef = useRef(null);
  const pollingKeyRef = useRef(null);
  const resumeAttemptedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollRun = useCallback(
    async (datasetId, runId) => {
      if (!token) return null;

      const res = await fetch(`/api/datasets/${datasetId}/timetable-runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return null;
      }

      return res.json();
    },
    [token],
  );

  const beginPolling = useCallback(
    (datasetId, runId, datasetName = "", options = {}) => {
      const normalizedDatasetId = Number(datasetId);
      const normalizedRunId = Number(runId);

      const pollingKey = `${normalizedDatasetId}:${normalizedRunId}`;

      if (pollRef.current && pollingKeyRef.current === pollingKey) {
        return;
      }

      stopPolling();
      pollingKeyRef.current = pollingKey;

      const snapshot = {
        datasetId: normalizedDatasetId,
        runId: normalizedRunId,
        datasetName,
        status: "RUNNING",
        phase: "AGGREGATING_BWM",
        progress_percent: 5,
      };

      setActiveRun(snapshot);
      writeStoredRun(snapshot);

      const tick = async () => {
        const detail = await pollRun(normalizedDatasetId, normalizedRunId);
        if (!detail) return;

        const nextRun = {
          datasetId: normalizedDatasetId,
          runId: normalizedRunId,
          datasetName,
          status: detail.status,
          phase: detail.phase,
          progress_percent: detail.progress_percent ?? 0,
        };

        setActiveRun(nextRun);

        if (ACTIVE_STATUSES.has(detail.status)) {
          writeStoredRun(nextRun);
        }

        if (detail.status === "COMPLETED") {
          stopPolling();
          clearStoredRun();
          if (options.notifyComplete !== false) {
            toast.success("Solver selesai — hasil jadwal tersimpan");
          }
        }

        if (detail.status === "FAILED") {
          stopPolling();
          clearStoredRun();
          if (options.notifyFailed !== false) {
            toast.error(detail.error_message ?? "Solver gagal");
          }
        }
      };

      tick();
      pollRef.current = setInterval(tick, 2000);
    },
    [pollRun, stopPolling],
  );

  const startPolling = useCallback(
    (datasetId, runId, datasetName = "") => {
      beginPolling(datasetId, runId, datasetName, {
        notifyComplete: true,
        notifyFailed: true,
      });
    },
    [beginPolling],
  );

  const resumeActiveRun = useCallback(async () => {
    if (!token || resumeAttemptedRef.current || pollRef.current) {
      return;
    }

    resumeAttemptedRef.current = true;

    const resumeFromPayload = (payload) => {
      if (!payload?.dataset_id || !payload?.id) return false;
      if (!ACTIVE_STATUSES.has(payload.status)) {
        clearStoredRun();
        return false;
      }

      beginPolling(payload.dataset_id, payload.id, payload.dataset_name ?? "", {
        notifyComplete: true,
        notifyFailed: true,
      });
      return true;
    };

    try {
      const res = await fetch("/api/timetable-runs/active", {
        headers: { Authorization: `Bearer ${token}` },
      });

        if (res.ok) {
        const payload = await res.json();
        if (payload?.id && payload?.dataset_id && resumeFromPayload(payload)) {
          return;
        }
      }
    } catch {
      // fallback to sessionStorage below
    }

    const stored = readStoredRun();
    if (!stored) {
      return;
    }

    const detail = await pollRun(stored.datasetId, stored.runId);
    if (detail && ACTIVE_STATUSES.has(detail.status)) {
      beginPolling(stored.datasetId, stored.runId, stored.datasetName ?? "", {
        notifyComplete: true,
        notifyFailed: true,
      });
      return;
    }

    clearStoredRun();
  }, [beginPolling, pollRun, token]);

  useEffect(() => {
    if (!token) {
      resumeAttemptedRef.current = false;
      return;
    }

    resumeActiveRun();
  }, [token, resumeActiveRun]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const value = useMemo(
    () => ({
      activeRun,
      startPolling,
      stopPolling,
      resolvePhaseLabel,
      clearActiveRun: () => {
        stopPolling();
        pollingKeyRef.current = null;
        clearStoredRun();
        setActiveRun(null);
      },
    }),
    [activeRun, startPolling, stopPolling],
  );

  return (
    <TimetableRunContext.Provider value={value}>{children}</TimetableRunContext.Provider>
  );
}

export function useTimetableRun() {
  const context = useContext(TimetableRunContext);
  if (!context) {
    throw new Error("useTimetableRun must be used within TimetableRunProvider");
  }
  return context;
}
