import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  Database,
  Building2,
  Clock,
  GraduationCap,
  Loader2,
  Users,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";

const PAGE_SIZE = 8;

const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

const BWM_SCALE_LABELS = {
  1: "sama penting dengan",
  2: "di antara sama penting dan cukup lebih penting dari",
  3: "cukup lebih penting dari",
  4: "di antara cukup dan kuat lebih penting dari",
  5: "kuat lebih penting dari",
  6: "di antara kuat dan sangat kuat lebih penting dari",
  7: "sangat kuat lebih penting dari",
  8: "di antara sangat kuat dan mutlak lebih penting dari",
  9: "mutlak lebih penting dari",
};

function fmtTime(value) {
  if (!value) return "-";
  return value.slice(0, 5);
}

const MODAL_DEFS = {
  rooms: { title: "Ruangan", columns: ["Kode", "Gedung", "Tipe"] },
  lecturers: { title: "Dosen", columns: ["Kode", "Kode Pegawai", "Nama"] },
  courses: { title: "Mata Kuliah", columns: ["Kode", "Nama", "SKS"] },
  time_slots: { title: "Slot Waktu", columns: ["Kode", "Hari", "Mulai", "Selesai"] },
  classes: { title: "Kelas", columns: ["Kode", "Nama"] },
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

function TreeSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true,
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none select-none px-4 py-3 hover:bg-accent/40 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <Icon className="h-4 w-4 text-primary" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{count} data</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

function TreeTableSection({
  icon,
  title,
  rows,
  emptyMessage,
  itemLabel,
  columns,
  renderRow,
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <TreeSection icon={icon} title={title} count={rows.length}>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {paginated.map(renderRow)}
          </TableBody>
        </Table>
        <DataTablePagination
          page={page}
          setPage={setPage}
          totalItems={rows.length}
          pageSize={PAGE_SIZE}
          itemLabel={itemLabel}
        />
      </div>
    </TreeSection>
  );
}

export default function DatasetDetail() {
  const { datasetId } = useParams();
  const { token, user } = useAuth();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bwmCriteria, setBwmCriteria] = useState([]);
  const [bwmBestId, setBwmBestId] = useState(null);
  const [bwmWorstId, setBwmWorstId] = useState(null);
  const [bwmBestToOthers, setBwmBestToOthers] = useState({});
  const [bwmOthersToWorst, setBwmOthersToWorst] = useState({});
  const [bwmWeights, setBwmWeights] = useState([]);
  const [bwmKsi, setBwmKsi] = useState(null);
  const [bwmCr, setBwmCr] = useState(null);
  const [bwmLoading, setBwmLoading] = useState(false);
  const [bwmSolving, setBwmSolving] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [modalPage, setModalPage] = useState(1);

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

  useEffect(() => {
    if (!datasetId || !token || user?.role !== "LECTURER") return;

    const initMaps = (criteria, response = null) => {
      const defaultBestToOthers = {};
      const defaultOthersToWorst = {};

      criteria.forEach((c) => {
        defaultBestToOthers[c.id] = 1;
        defaultOthersToWorst[c.id] = 1;
      });

      if (response) {
        response.best_to_others.forEach((row) => {
          defaultBestToOthers[row.criterion_id] = row.value;
        });
        response.others_to_worst.forEach((row) => {
          defaultOthersToWorst[row.criterion_id] = row.value;
        });
      }

      return { defaultBestToOthers, defaultOthersToWorst };
    };

    const run = async () => {
      setBwmLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const criteriaRes = await fetch("/api/bwm/criteria", { headers });
        if (!criteriaRes.ok) {
          const body = await criteriaRes.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat kriteria BWM");
        }
        const criteria = await criteriaRes.json();
        setBwmCriteria(criteria);

        let response = null;
        const responseRes = await fetch(
          `/api/datasets/${datasetId}/bwm/response`,
          { headers },
        );
        if (responseRes.ok) {
          response = await responseRes.json();
          setBwmWeights(response.weights ?? []);
          setBwmKsi(response.ksi ?? null);
          setBwmCr(response.consistency_ratio ?? null);
          setBwmBestId(response.best_criteria_id);
          setBwmWorstId(response.worst_criteria_id);
        } else if (responseRes.status !== 404) {
          const body = await responseRes.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat response BWM");
        }

        const { defaultBestToOthers, defaultOthersToWorst } = initMaps(
          criteria,
          response,
        );
        setBwmBestToOthers(defaultBestToOthers);
        setBwmOthersToWorst(defaultOthersToWorst);

        if (!response && criteria.length >= 2) {
          setBwmBestId(criteria[0].id);
          setBwmWorstId(criteria[criteria.length - 1].id);
        }
      } catch (e) {
        toast.error(e.message);
      } finally {
        setBwmLoading(false);
      }
    };

    run();
  }, [datasetId, token, user?.role]);

  const criteriaById = useMemo(() => {
    return new Map(bwmCriteria.map((c) => [c.id, c]));
  }, [bwmCriteria]);

  const formatCriterionLabel = (criterion) => {
    if (!criterion) return "-";
    return criterion.code ? `${criterion.name}` : criterion.name;
  };

  const selectedBestName = bwmBestId
    ? formatCriterionLabel(criteriaById.get(bwmBestId))
    : "-";
  const selectedWorstName = bwmWorstId
    ? formatCriterionLabel(criteriaById.get(bwmWorstId))
    : "-";

  const updateBestToOthers = (criterionId, value) => {
    const normalized = Math.max(1, Math.min(9, Number(value) || 1));
    setBwmBestToOthers((prev) => ({ ...prev, [criterionId]: normalized }));
  };

  const updateOthersToWorst = (criterionId, value) => {
    const normalized = Math.max(1, Math.min(9, Number(value) || 1));
    setBwmOthersToWorst((prev) => ({ ...prev, [criterionId]: normalized }));
  };

  const onChangeBest = (value) => {
    const next = Number(value);
    setBwmBestId(next);
    setBwmBestToOthers((prev) => ({ ...prev, [next]: 1 }));
  };

  const onChangeWorst = (value) => {
    const next = Number(value);
    setBwmWorstId(next);
    setBwmOthersToWorst((prev) => ({ ...prev, [next]: 1 }));
  };

  const buildPayload = () => {
    const criterionIds = bwmCriteria.map((c) => c.id);
    return {
      best_criteria_id: bwmBestId,
      worst_criteria_id: bwmWorstId,
      best_to_others: criterionIds.map((id) => ({
        criterion_id: id,
        value: Number(bwmBestToOthers[id] ?? 1),
      })),
      others_to_worst: criterionIds.map((id) => ({
        criterion_id: id,
        value: Number(bwmOthersToWorst[id] ?? 1),
      })),
    };
  };

  const solveBwm = async () => {
    if (!datasetId || !token || user?.role !== "LECTURER") return;

    setBwmSolving(true);
    try {
      const saveRes = await fetch(`/api/datasets/${datasetId}/bwm/response`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        throw new Error(
          body.detail?.message ?? body.detail ?? "Gagal menyimpan input BWM",
        );
      }

      const solveRes = await fetch(`/api/datasets/${datasetId}/bwm/solve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!solveRes.ok) {
        const body = await solveRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menjalankan BWM solver");
      }
      const data = await solveRes.json();
      setBwmWeights(data.weights ?? []);
      setBwmKsi(data.ksi ?? null);
      setBwmCr(data.consistency_ratio ?? null);
      toast.success("BWM solver berhasil dijalankan.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBwmSolving(false);
    }
  };

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
  const backTo = user?.role === "LECTURER" ? "/my-datasets" : "/datasets";
  const navBackLink = <></>;

  if (loading) {
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

  return (
    <EmployeeAppLayout
      title="Detail Dataset"
      icon={Database}
      navContent={navBackLink}
      mainClassName="space-y-6"
    >
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tree.dataset.code}</Badge>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-5 mt-4">
          {quickStats.map((item) => (
            <Card
              key={item.label}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setActiveModal(item.modal)}
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {token && user?.role === "LECTURER" && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              BWM Solver
            </p>
            <h2 className="text-lg font-semibold mt-1">
              Preferensi Soft Constraints
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pilih best-worst criterion, isi nilai 1-9 untuk dua vektor BWM,
              lalu jalankan solver.
            </p>
          </div>

          {bwmLoading && (
            <p className="text-sm text-muted-foreground">
              Memuat konfigurasi BWM...
            </p>
          )}

          {!bwmLoading && bwmCriteria.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Belum ada soft criteria untuk BWM.
            </p>
          )}

          {!bwmLoading && bwmCriteria.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">
                    Pilih best criterion
                  </span>
                  <Select
                    value={String(bwmBestId ?? "")}
                    onValueChange={onChangeBest}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih best criteria">
                        {(value) => {
                          const criterion = bwmCriteria.find(
                            (c) => String(c.id) === value,
                          );
                          return criterion
                            ? formatCriterionLabel(criterion)
                            : null;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {bwmCriteria.map((c) => (
                        <SelectItem key={`best-${c.id}`} value={String(c.id)}>
                          {formatCriterionLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">
                    Pilih worst criterion
                  </span>
                  <Select
                    value={String(bwmWorstId ?? "")}
                    onValueChange={onChangeWorst}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih worst criteria">
                        {(value) => {
                          const criterion = bwmCriteria.find(
                            (c) => String(c.id) === value,
                          );
                          return criterion
                            ? formatCriterionLabel(criterion)
                            : null;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {bwmCriteria.map((c) => (
                        <SelectItem key={`worst-${c.id}`} value={String(c.id)}>
                          {formatCriterionLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </label>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Best to Others</p>
                <p className="text-xs text-muted-foreground">
                  Seberapa jauh <strong>best criterion</strong> lebih penting
                  dibanding setiap criterion lainnya? Isi nilai{" "}
                  <strong>1</strong> (sama penting) hingga <strong>9</strong>{" "}
                  (jauh lebih penting). Nilai untuk best criterion itu sendiri
                  otomatis diisi 1.
                </p>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subjek</TableHead>
                      <TableHead className="w-[40%]">Relasi</TableHead>
                      <TableHead>Objek</TableHead>
                      <TableHead className="w-[140px]">Nilai (1-9)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwmCriteria.map((c) => (
                      <TableRow key={`bto-${c.id}`}>
                        <TableCell className="font-medium">
                          {selectedBestName}
                        </TableCell>
                        <TableCell className="w-[40%] text-xs text-muted-foreground whitespace-normal break-words">
                          {
                            BWM_SCALE_LABELS[
                              Math.max(
                                1,
                                Math.min(9, Number(bwmBestToOthers[c.id] ?? 1)),
                              )
                            ]
                          }
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCriterionLabel(c)}
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            min={1}
                            max={9}
                            value={bwmBestToOthers[c.id] ?? 1}
                            disabled={bwmBestId === c.id}
                            onChange={(e) =>
                              updateBestToOthers(c.id, e.target.value)
                            }
                            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Others to Worst</p>
                <p className="text-xs text-muted-foreground">
                  Seberapa jauh setiap criterion lebih penting dibanding{" "}
                  <strong>worst criterion</strong>? Isi nilai <strong>1</strong>{" "}
                  (sama penting) hingga <strong>9</strong> (jauh lebih penting).
                  Nilai untuk worst criterion itu sendiri otomatis diisi 1.
                </p>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subjek</TableHead>
                      <TableHead className="w-[40%]">Relasi</TableHead>
                      <TableHead>Objek</TableHead>
                      <TableHead className="w-[140px]">Nilai (1-9)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwmCriteria.map((c) => (
                      <TableRow key={`otw-${c.id}`}>
                        <TableCell className="font-medium">
                          {formatCriterionLabel(c)}
                        </TableCell>
                        <TableCell className="w-[40%] text-xs text-muted-foreground whitespace-normal break-words">
                          {
                            BWM_SCALE_LABELS[
                              Math.max(
                                1,
                                Math.min(
                                  9,
                                  Number(bwmOthersToWorst[c.id] ?? 1),
                                ),
                              )
                            ]
                          }
                        </TableCell>
                        <TableCell className="font-medium">
                          {selectedWorstName}
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            min={1}
                            max={9}
                            value={bwmOthersToWorst[c.id] ?? 1}
                            disabled={bwmWorstId === c.id}
                            onChange={(e) =>
                              updateOthersToWorst(c.id, e.target.value)
                            }
                            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={bwmSolving}
                  onClick={solveBwm}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {bwmSolving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>

              {(bwmWeights.length > 0 || bwmKsi !== null || bwmCr !== null) && (
                <div>
                  <Separator className="my-4" />
                  <div className="space-y-1 mb-3">
                    <p className="text-sm font-semibold">Hasil Solver BWM</p>
                    <p className="text-xs text-muted-foreground">
                      Bagian ini menampilkan hasil akhir perhitungan BWM untuk
                      preferensi Anda.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 mb-3">
                    <p className="text-sm">
                      <span className="font-medium">KSI:</span>{" "}
                      {bwmKsi !== null ? Number(bwmKsi).toFixed(6) : "-"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Consistency Ratio:</span>{" "}
                      {bwmCr !== null ? Number(bwmCr).toFixed(6) : "-"}
                    </p>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criterion</TableHead>
                          <TableHead className="w-[140px] text-right">
                            Weight
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bwmWeights.map((w) => (
                          <TableRow key={`w-${w.criterion_id}`}>
                            <TableCell className="font-medium">
                              {formatCriterionLabel(
                                criteriaById.get(w.criterion_id),
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {Number(w.weight).toFixed(6)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <Dialog
        open={!!activeModal}
        onOpenChange={(open) => {
          if (!open) setActiveModal(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {activeModal ? MODAL_DEFS[activeModal]?.title : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {modalColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeModal && modalRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={modalColumns.length}
                      className="text-center text-muted-foreground py-8"
                    >
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeModal &&
                  pagedModalRows.map((cells, i) => (
                    <TableRow key={i}>
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
    </EmployeeAppLayout>
  );
}
