import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";
import LecturerPreferencesTab from "@/components/dataset-detail/LecturerPreferencesTab";
import BwmSolverTab from "@/components/dataset-detail/BwmSolverTab";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const TABS = [
  { id: "preferences", label: "Preferensi Mengajar" },
  { id: "bwm", label: "Kuesioner BWM" },
];

function buildDefaultMatrices(criteria, bestId, worstId) {
  const bestToOthers = {};
  const othersToWorst = {};
  for (const criterion of criteria) {
    bestToOthers[criterion.id] = criterion.id === bestId ? 1 : 1;
    othersToWorst[criterion.id] = criterion.id === worstId ? 1 : 1;
  }
  return { bestToOthers, othersToWorst };
}

export default function LecturerPreferences() {
  const { datasetId } = useParams();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("preferences");

  const [bwmLoading, setBwmLoading] = useState(true);
  const [bwmCriteria, setBwmCriteria] = useState([]);
  const [bwmBestId, setBwmBestId] = useState(null);
  const [bwmWorstId, setBwmWorstId] = useState(null);
  const [bwmBestToOthers, setBwmBestToOthers] = useState({});
  const [bwmOthersToWorst, setBwmOthersToWorst] = useState({});
  const [bwmWeights, setBwmWeights] = useState([]);
  const [bwmKsi, setBwmKsi] = useState(null);
  const [bwmCr, setBwmCr] = useState(null);
  const [bwmSolving, setBwmSolving] = useState(false);

  const loadBwm = useCallback(async () => {
    if (!datasetId || !token) return;

    setBwmLoading(true);
    try {
      const [criteriaRes, bwmRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}/criteria`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/bwm/my`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!criteriaRes.ok) {
        const body = await criteriaRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat criteria BWM");
      }
      if (!bwmRes.ok) {
        const body = await bwmRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat data BWM");
      }

      const criteria = await criteriaRes.json();
      const bwm = await bwmRes.json();
      setBwmCriteria(criteria);

      const bestId = bwm.best_criteria_id ?? criteria[0]?.id ?? null;
      const worstId =
        bwm.worst_criteria_id ??
        criteria.find((c) => c.id !== bestId)?.id ??
        null;

      setBwmBestId(bestId);
      setBwmWorstId(worstId);

      const defaults = buildDefaultMatrices(criteria, bestId, worstId);
      setBwmBestToOthers({
        ...defaults.bestToOthers,
        ...bwm.best_to_others,
      });
      setBwmOthersToWorst({
        ...defaults.othersToWorst,
        ...bwm.others_to_worst,
      });
      setBwmWeights(bwm.weights ?? []);
      setBwmKsi(bwm.ksi ?? null);
      setBwmCr(bwm.consistency_ratio ?? null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBwmLoading(false);
    }
  }, [datasetId, token]);

  useEffect(() => {
    loadBwm();
  }, [loadBwm]);

  const handleChangeBest = (value) => {
    const nextBest = Number(value);
    setBwmBestId(nextBest);
    const matrices = buildDefaultMatrices(bwmCriteria, nextBest, bwmWorstId);
    setBwmBestToOthers(matrices.bestToOthers);
    setBwmOthersToWorst(matrices.othersToWorst);
  };

  const handleChangeWorst = (value) => {
    const nextWorst = Number(value);
    setBwmWorstId(nextWorst);
    const matrices = buildDefaultMatrices(bwmCriteria, bwmBestId, nextWorst);
    setBwmBestToOthers(matrices.bestToOthers);
    setBwmOthersToWorst(matrices.othersToWorst);
  };

  const updateBestToOthers = (criterionId, value) => {
    setBwmBestToOthers((prev) => ({
      ...prev,
      [criterionId]: Number(value),
    }));
  };

  const updateOthersToWorst = (criterionId, value) => {
    setBwmOthersToWorst((prev) => ({
      ...prev,
      [criterionId]: Number(value),
    }));
  };

  const solveBwm = async () => {
    if (!datasetId || !token || !bwmBestId || !bwmWorstId) {
      toast.error("Pilih best dan worst criterion terlebih dahulu");
      return;
    }

    setBwmSolving(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/bwm/my`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          best_criteria_id: bwmBestId,
          worst_criteria_id: bwmWorstId,
          best_to_others: bwmBestToOthers,
          others_to_worst: bwmOthersToWorst,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menyimpan BWM");
      }

      const body = await res.json();
      setBwmWeights(body.weights ?? []);
      setBwmKsi(body.ksi ?? null);
      setBwmCr(body.consistency_ratio ?? null);
      toast.success("Kuesioner BWM berhasil disimpan");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBwmSolving(false);
    }
  };

  return (
    <EmployeeAppLayout
      title="Preferensi Mengajar"
      icon={CalendarClock}
      maxWidth="max-w-5xl"
      mainClassName="space-y-6"
    >
      <section className="rounded-xl border bg-card p-2 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </section>

      {activeTab === "preferences" && (
        <LecturerPreferencesTab datasetId={datasetId} />
      )}

      {activeTab === "bwm" && (
        <section className="rounded-xl border bg-card p-5 space-y-6">
          <BwmSolverTab
            bwmLoading={bwmLoading}
            bwmCriteria={bwmCriteria}
            bwmBestId={bwmBestId}
            bwmWorstId={bwmWorstId}
            onChangeBest={handleChangeBest}
            onChangeWorst={handleChangeWorst}
            bwmBestToOthers={bwmBestToOthers}
            bwmOthersToWorst={bwmOthersToWorst}
            updateBestToOthers={updateBestToOthers}
            updateOthersToWorst={updateOthersToWorst}
            bwmSolving={bwmSolving}
            solveBwm={solveBwm}
            bwmWeights={bwmWeights}
            bwmKsi={bwmKsi}
            bwmCr={bwmCr}
          />
        </section>
      )}
    </EmployeeAppLayout>
  );
}
