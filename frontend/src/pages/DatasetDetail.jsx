import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Database,
  Loader2,
  ArrowLeft,
  Play,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";
import { getRowNumber } from "@/lib/table";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";
import TimetableAnalyticsSection from "@/components/dataset-detail/TimetableAnalyticsSection";
import LecturerDatasetTabs from "@/components/dataset-detail/LecturerDatasetTabs";
import ResultsTab from "@/components/dataset-detail/ResultsTab";
import { useTimetableRun } from "@/context/TimetableRunContext";

const PAGE_SIZE = 8;
const LECTURER_TABS = new Set(["bwm", "preferences", "result"]);
const ADMIN_TABS = [
  { id: "overview", label: "Ringkasan" },
  { id: "results", label: "Hasil Run" },
];

const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

function fmtTime(value) {
  if (!value) return "-";
  return value.slice(0, 5);
}

const MODAL_DEFS = {
  rooms: { title: "Ruangan", columns: ["No.", "Kode", "Gedung", "Tipe"] },
  lecturers: { title: "Dosen", columns: ["No.", "Kode", "Kode Pegawai", "Nama"] },
  courses: { title: "Mata Kuliah", columns: ["No.", "Kode", "Nama", "SKS"] },
  time_slots: { title: "Slot Waktu", columns: ["No.", "Kode", "Hari", "Mulai", "Selesai"] },
  classes: { title: "Kelas", columns: ["No.", "Kode", "Nama"] },
};

function getModalRows(key, tree) {
  if (!tree) return [];
  switch (key) {
    case "rooms":
      return tree.rooms.map((r) => [
        r.code,
        r.building_name,
        r.room_type ?? "-",
      ]);
    case "lecturers":
      return tree.lecturers.map((r) => [r.code, r.employee_code, r.name]);
    case "courses":
      return tree.courses.map((r) => [r.code, r.name, r.credits]);
    case "time_slots":
      return tree.time_slots.map((r) => [
        r.code,
        DAY_LABELS[r.day] ?? r.day,
        fmtTime(r.start_time),
        fmtTime(r.end_time),
      ]);
    case "classes":
      return tree.classes.map((r) => [r.code, r.name]);
    default:
      return [];
  }
}

export default function DatasetDetail() {
  const { datasetId } = useParams();
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [runningSolver, setRunningSolver] = useState(false);
  const [adminTab, setAdminTab] = useState("overview");
  const [softCriteria, setSoftCriteria] = useState([]);
  const { startPolling, activeRun } = useTimetableRun();

  const isAdmin = user?.role === "ADMIN";
  const isLecturer = user?.role === "LECTURER";

  const tabParam = searchParams.get("tab");
  const activeTab = LECTURER_TABS.has(tabParam) ? tabParam : "bwm";

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!isAdmin || !datasetId || !token) return;

    const loadCriteria = async () => {
      try {
        const res = await fetch(`/api/datasets/${datasetId}/criteria`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setSoftCriteria(await res.json());
        }
      } catch {
        setSoftCriteria([]);
      }
    };

    loadCriteria();
  }, [isAdmin, datasetId, token]);

  useEffect(() => {
    if (!datasetId) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/datasets/${datasetId}/tree`, { headers });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat detail dataset");
        }
        setTree(await res.json());
      } catch (e) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [datasetId, token]);

  const quickStats = useMemo(() => {
    if (!tree) return [];
    return [
      { label: "Ruangan", value: tree.rooms.length, modal: "rooms" },
      { label: "Dosen", value: tree.lecturers.length, modal: "lecturers" },
      { label: "Mata Kuliah", value: tree.courses.length, modal: "courses" },
      {
        label: "Slot Waktu",
        value: tree.time_slots.length,
        modal: "time_slots",
      },
      { label: "Kelas", value: tree.classes.length, modal: "classes" },
    ];
  }, [tree]);

  const modalRows = useMemo(() => {
    if (!activeModal) return [];
    return getModalRows(activeModal, tree);
  }, [activeModal, tree]);

  const modalColumns = activeModal
    ? (MODAL_DEFS[activeModal]?.columns ?? [])
    : [];

  useEffect(() => {
    setModalPage(1);
  }, [activeModal]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(modalRows.length / PAGE_SIZE));
    if (modalPage > totalPages) {
      setModalPage(totalPages);
    }
  }, [modalPage, modalRows.length]);

  const pagedModalRows = modalRows.slice(
    (modalPage - 1) * PAGE_SIZE,
    modalPage * PAGE_SIZE,
  );
  const backTo = isLecturer ? "/my-datasets" : "/datasets";
  const navBackLink = <></>;

  const handleRunSolver = async () => {
    if (!token || !datasetId) {
      toast.error("Login diperlukan untuk menjalankan solver");
      return;
    }

    if (activeRun && ["QUEUED", "RUNNING"].includes(activeRun.status)) {
      toast.error("Solver masih berjalan");
      return;
    }

    setRunningSolver(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/timetable-runs/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menjalankan solver");
      }
      const body = await res.json();
      startPolling(datasetId, body.id, body.dataset_name ?? tree?.dataset?.name ?? "");
      toast.success("Solver dimulai — pantau progress di sidebar");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunningSolver(false);
    }
  };

  const solverBusy =
    runningSolver ||
    (activeRun &&
      activeRun.datasetId === Number(datasetId) &&
      ["QUEUED", "RUNNING"].includes(activeRun.status));

  if (loading) {
    if (isAdmin) {
      return (
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </main>
      );
    }

    return (
      <EmployeeAppLayout
        title="Detail Dataset"
        icon={Database}
        navContent={navBackLink}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </EmployeeAppLayout>
    );
  }

  if (error) {
    if (isAdmin) {
      return (
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <p className="text-destructive">{error}</p>
        </main>
      );
    }

    return (
      <EmployeeAppLayout
        title="Detail Dataset"
        icon={Database}
        navContent={navBackLink}
        mainClassName="space-y-4"
      >
        <p className="text-destructive">{error}</p>
      </EmployeeAppLayout>
    );
  }

  if (!tree) return null;

  const headerSection = (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to={backTo}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Kembali"
          title="Kembali"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="grow">
          <h1 className="text-2xl font-bold">{tree.dataset.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tree.dataset.description || "Tanpa deskripsi"}
          </p>
        </div>
        {isAdmin && (
          <Button
            size="lg"
            disabled={solverBusy}
            onClick={handleRunSolver}
            className="h-12 min-w-[180px] gap-2.5 px-8 text-base font-bold shadow-lg shadow-primary/30 ring-2 ring-primary/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/35 active:scale-[0.98] disabled:hover:scale-100"
          >
            {solverBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Menjalankan...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" />
                Run Solver
              </>
            )}
          </Button>
        )}
      </div>
    </section>
  );

  const adminBody = (
    <>
      <section className="rounded-xl border bg-card p-2 flex flex-wrap gap-2">
        {ADMIN_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={adminTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setAdminTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </section>

      {adminTab === "overview" && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickStats.map((item) => (
              <Card key={item.label} className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-semibold">{item.value}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveModal(item.modal)}
                  >
                    Lihat Data
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <TimetableAnalyticsSection
            dataset={tree.dataset}
            tree={tree}
            datasetId={datasetId}
          />
        </>
      )}

      {adminTab === "results" && (
        <ResultsTab datasetId={datasetId} tree={tree} bwmCriteria={softCriteria} />
      )}

      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{activeModal ? MODAL_DEFS[activeModal]?.title : "Detail"}</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {modalColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(1, modalColumns.length)} className="text-center text-muted-foreground py-8">
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedModalRows.map((cells, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {getRowNumber(modalPage, PAGE_SIZE, index)}
                      </TableCell>
                      {cells.map((cell, j) => (
                        <TableCell key={j}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {activeModal && (
              <DataTablePagination
                page={modalPage}
                setPage={setModalPage}
                totalItems={modalRows.length}
                pageSize={PAGE_SIZE}
                itemLabel={MODAL_DEFS[activeModal]?.title ?? "data"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  const lecturerBody = (
    <LecturerDatasetTabs
      datasetId={datasetId}
      tree={tree}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );

  if (isAdmin) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        {headerSection}
        {adminBody}
      </main>
    );
  }

  return (
    <EmployeeAppLayout
      title="Detail Dataset"
      icon={Database}
      navContent={navBackLink}
      mainClassName="space-y-6"
    >
      {headerSection}
      {isLecturer ? lecturerBody : adminBody}
    </EmployeeAppLayout>
  );
}
