import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import DataTablePagination from "@/components/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 6;

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

function fmtDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fmtNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function getStatusBadgeVariant(status) {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "FAILED":
      return "destructive";
    case "RUNNING":
      return "secondary";
    default:
      return "outline";
  }
}

function buildEntityMap(rows) {
  return new Map((rows ?? []).map((row) => [row.id, row]));
}

export default function ResultsTab({ datasetId, tree, bwmCriteria }) {
  const { token } = useAuth();

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [runDetail, setRunDetail] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [lecturerPage, setLecturerPage] = useState(1);

  const lecturerMap = useMemo(() => buildEntityMap(tree?.lecturers ?? []), [tree]);
  const courseMap = useMemo(() => buildEntityMap(tree?.courses ?? []), [tree]);
  const classMap = useMemo(() => buildEntityMap(tree?.classes ?? []), [tree]);
  const roomMap = useMemo(() => buildEntityMap(tree?.rooms ?? []), [tree]);
  const timeSlotMap = useMemo(() => buildEntityMap(tree?.time_slots ?? []), [tree]);
  const softCriteriaMap = useMemo(() => buildEntityMap(bwmCriteria ?? []), [bwmCriteria]);

  useEffect(() => {
    setAssignmentsPage(1);
  }, [runDetail?.id]);

  useEffect(() => {
    setLecturerPage(1);
  }, [runDetail?.id]);

  useEffect(() => {
    if (!datasetId || !token) return;

    const loadRuns = async () => {
      setLoadingRuns(true);
      try {
        const res = await fetch(`/api/datasets/${datasetId}/timetable-runs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat daftar hasil run");
        }

        const data = await res.json();
        setRuns(data);
        setSelectedRunId((current) => {
          if (current && data.some((run) => String(run.id) === String(current))) {
            return current;
          }
          return data.length > 0 ? String(data[0].id) : "";
        });
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoadingRuns(false);
      }
    };

    loadRuns();
  }, [datasetId, token]);

  useEffect(() => {
    if (!datasetId || !token || !selectedRunId) {
      setRunDetail(null);
      return;
    }

    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `/api/datasets/${datasetId}/timetable-runs/${selectedRunId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat detail hasil run");
        }
        setRunDetail(await res.json());
      } catch (e) {
        setRunDetail(null);
        toast.error(e.message);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadDetail();
  }, [datasetId, selectedRunId, token]);

  const softWeightRows = useMemo(() => {
    const weights = runDetail?.weights ?? [];
    return weights
      .map((row) => ({
        ...row,
        criterion: softCriteriaMap.get(row.criterion_id),
      }))
      .sort((left, right) => Number(right.weight) - Number(left.weight));
  }, [runDetail, softCriteriaMap]);

  const softSummaryRows = useMemo(() => {
    const summaries = runDetail?.constraint_summaries ?? [];
    return summaries
      .map((row) => ({
        ...row,
        criterion: softCriteriaMap.get(row.criterion_id),
      }))
      .filter((row) => row.criterion)
      .sort((left, right) => Number(right.total_penalty) - Number(left.total_penalty));
  }, [runDetail, softCriteriaMap]);

  const assignmentRows = useMemo(() => {
    return (runDetail?.assignments ?? []).map((assignment) => {
      const lecturer = lecturerMap.get(assignment.lecturer_id);
      const course = courseMap.get(assignment.course_id);
      const classGroup = classMap.get(assignment.class_id);
      const room = roomMap.get(assignment.room_id);
      const startSlot = timeSlotMap.get(assignment.start_time_slot_id);
      const endSlot = timeSlotMap.get(assignment.end_time_slot_id);

      return {
        ...assignment,
        lecturerLabel: lecturer ? `${lecturer.code} - ${lecturer.name}` : `Dosen #${assignment.lecturer_id}`,
        courseLabel: course ? `${course.code} - ${course.name}` : `Mata kuliah #${assignment.course_id}`,
        classLabel: classGroup ? `${classGroup.code} - ${classGroup.name}` : `Kelas #${assignment.class_id}`,
        roomLabel: room ? `${room.code}${room.room_type ? ` (${room.room_type})` : ""}` : `Ruangan #${assignment.room_id}`,
        slotLabel: startSlot
          ? `${DAY_LABELS[startSlot.day] ?? startSlot.day}, ${fmtTime(startSlot.start_time)}-${fmtTime(endSlot?.end_time ?? startSlot.end_time)}`
          : `Slot #${assignment.start_time_slot_id}`,
        penaltyCount: assignment.penalties?.filter((penalty) => Number(penalty.penalty_value) > 0).length ?? 0,
      };
    });
  }, [runDetail, lecturerMap, courseMap, classMap, roomMap, timeSlotMap]);

  const lecturerSummaryRows = useMemo(() => {
    return (runDetail?.lecturer_summaries ?? []).map((row) => {
      const lecturer = lecturerMap.get(row.lecturer_id);
      return {
        ...row,
        lecturerLabel: lecturer ? `${lecturer.code} - ${lecturer.name}` : `Dosen #${row.lecturer_id}`,
      };
    });
  }, [runDetail, lecturerMap]);

  const pagedAssignments = assignmentRows.slice(
    (assignmentsPage - 1) * PAGE_SIZE,
    assignmentsPage * PAGE_SIZE,
  );

  const pagedLecturerSummaries = lecturerSummaryRows.slice(
    (lecturerPage - 1) * PAGE_SIZE,
    lecturerPage * PAGE_SIZE,
  );

  const totalSoftPenalty = useMemo(() => {
    return softSummaryRows.reduce((sum, row) => sum + Number(row.total_penalty ?? 0), 0);
  }, [softSummaryRows]);

  const totalSoftViolations = useMemo(() => {
    return softSummaryRows.reduce((sum, row) => sum + Number(row.violated_count ?? 0), 0);
  }, [softSummaryRows]);

  const runOptions = runs.map((run) => ({
    id: String(run.id),
    label: `Run #${run.id}`,
    status: run.status,
    createdAt: fmtDateTime(run.created_at),
  }));

  const refreshRuns = async () => {
    if (!datasetId || !token) return;
    setLoadingRuns(true);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/timetable-runs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat daftar hasil run");
      }
      const data = await res.json();
      setRuns(data);
      if (selectedRunId && data.some((run) => String(run.id) === String(selectedRunId))) {
        return;
      }
      setSelectedRunId(data.length > 0 ? String(data[0].id) : "");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingRuns(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Hasil Timetable
          </p>
          <h2 className="text-lg font-semibold">Riwayat dan detail run ILP</h2>
          <p className="text-sm text-muted-foreground">
            Tab ini membaca hasil generate run terbaru yang sudah tersimpan ke tabel timetable.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 lg:max-w-md">
          <label className="space-y-1">
            <span className="text-sm font-medium">Pilih run</span>
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger>
                <SelectValue placeholder="Belum ada run tersimpan">
                  {(value) => {
                    const option = runOptions.find((row) => row.id === value);
                    return option ? `${option.label} - ${option.status}` : null;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {runOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label} - {option.status} - {option.createdAt}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={refreshRuns}
              disabled={loadingRuns}
            >
              {loadingRuns ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {!loadingRuns && runs.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Belum ada hasil run timetable. Jalankan endpoint generate run terlebih dahulu.
        </div>
      )}

      {(loadingRuns || loadingDetail) && (
        <div className="flex items-center justify-center rounded-lg border p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loadingDetail && runDetail && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Status Run</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(runDetail.status)}>
                    {runDetail.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Dibuat {fmtDateTime(runDetail.created_at)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Objective Value</CardDescription>
                <CardTitle>{fmtNumber(runDetail.objective_value, 4)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Solver {runDetail.solver_name}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Total Assignment</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  {assignmentRows.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {lecturerSummaryRows.length} dosen terlibat
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Total Soft Penalty</CardDescription>
                <CardTitle className="flex items-center gap-2">
                  {totalSoftViolations > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  {fmtNumber(totalSoftPenalty, 3)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {totalSoftViolations} pelanggaran soft constraint
              </CardContent>
            </Card>
          </div>

          {runDetail.error_message && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {runDetail.error_message}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Penjadwalan Per Assignment</CardTitle>
                <CardDescription>
                  Kombinasi kelas, mata kuliah, dosen, ruangan, dan slot yang dipilih solver.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4">Kelas</TableHead>
                        <TableHead>Mata Kuliah</TableHead>
                        <TableHead>Dosen</TableHead>
                        <TableHead>Ruangan</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead className="text-right">Penalty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Tidak ada assignment pada run ini.
                          </TableCell>
                        </TableRow>
                      )}
                      {pagedAssignments.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="px-4 font-medium">{row.classLabel}</TableCell>
                          <TableCell>{row.courseLabel}</TableCell>
                          <TableCell>{row.lecturerLabel}</TableCell>
                          <TableCell>{row.roomLabel}</TableCell>
                          <TableCell>{row.slotLabel}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.penaltyCount > 0 ? "destructive" : "secondary"}>
                              {row.penaltyCount}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <DataTablePagination
                  page={assignmentsPage}
                  setPage={setAssignmentsPage}
                  totalItems={assignmentRows.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="assignment"
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bobot Soft Constraint</CardTitle>
                  <CardDescription>
                    Snapshot bobot yang dipakai saat run ini dijalankan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {softWeightRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Bobot run belum tersedia.
                    </p>
                  )}
                  {softWeightRows.map((row) => (
                    <div key={row.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {row.criterion?.code ?? `Criterion #${row.criterion_id}`} - {row.criterion?.name ?? "Tanpa label"}
                        </span>
                        <span className="text-muted-foreground">{fmtNumber(row.weight, 4)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(4, Number(row.weight) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ringkasan Soft Constraint</CardTitle>
                  <CardDescription>
                    Total penalty dan jumlah assignment yang terkena penalti.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {softSummaryRows.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Ringkasan soft constraint belum tersedia.
                    </p>
                  )}
                  {softSummaryRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border/70 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {row.criterion?.code} - {row.criterion?.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Violasi {row.violated_count} dari {row.satisfied_count + row.violated_count} assignment
                          </p>
                        </div>
                        <Badge variant={row.violated_count > 0 ? "destructive" : "secondary"}>
                          {fmtNumber(row.total_penalty, 3)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Per Dosen</CardTitle>
              <CardDescription>
                Distribusi beban, skor preferensi, dan penalty utama untuk setiap dosen pada run ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Dosen</TableHead>
                      <TableHead>Sesi</TableHead>
                      <TableHead>Hari</TableHead>
                      <TableHead>Time Score</TableHead>
                      <TableHead>Course Score</TableHead>
                      <TableHead>Idle Gap</TableHead>
                      <TableHead>Mobility</TableHead>
                      <TableHead className="text-right">Total Penalty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lecturerSummaryRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          Ringkasan dosen belum tersedia.
                        </TableCell>
                      </TableRow>
                    )}
                    {pagedLecturerSummaries.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="px-4 font-medium">{row.lecturerLabel}</TableCell>
                        <TableCell>{row.assigned_session_count}</TableCell>
                        <TableCell>{row.assigned_day_count}</TableCell>
                        <TableCell>{fmtNumber(row.matched_time_preference_score, 2)}</TableCell>
                        <TableCell>{fmtNumber(row.matched_course_preference_score, 2)}</TableCell>
                        <TableCell>{fmtNumber(row.idle_gap_penalty, 2)}</TableCell>
                        <TableCell>{fmtNumber(row.mobility_penalty, 2)}</TableCell>
                        <TableCell className="text-right">{fmtNumber(row.total_penalty, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DataTablePagination
                page={lecturerPage}
                setPage={setLecturerPage}
                totalItems={lecturerSummaryRows.length}
                pageSize={PAGE_SIZE}
                itemLabel="ringkasan dosen"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
