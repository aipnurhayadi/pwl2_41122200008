import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { GraduationCap, Plus, Pencil, Trash2, Loader2, Search, X, SlidersHorizontal } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DatasetHeaderInfo from "@/components/DatasetHeaderInfo";
import DataTablePagination from "@/components/DataTablePagination";
import { normalizePaginatedResponse } from "@/lib/paginated";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "sonner";

const EMPTY_FORM = { employee_id: "" };
const PAGE_SIZE = 10;

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
  return String(value).slice(0, 5);
}

export default function Lecturers() {
  const { datasetId: paramId } = useParams();
  const { selected } = useDataset();
  const { token, user } = useAuth();
  const dsId = paramId ?? selected?.id;
  const isLecturerRole = user?.role === "LECTURER";

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [page, setPage] = useState(1);
  const [constraintsDialog, setConstraintsDialog] = useState(null);
  const [constraintsLoading, setConstraintsLoading] = useState(false);
  const [constraintsSaving, setConstraintsSaving] = useState(false);
  const [constraintCourseQuery, setConstraintCourseQuery] = useState("");
  const [constraintSlotQuery, setConstraintSlotQuery] = useState("");
  const [constraintCourses, setConstraintCourses] = useState([]);
  const [constraintTimeSlots, setConstraintTimeSlots] = useState([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [selectedTimeSlotIds, setSelectedTimeSlotIds] = useState([]);
  const [initialConstraintCourseIds, setInitialConstraintCourseIds] = useState([]);
  const [initialConstraintTimeSlotIds, setInitialConstraintTimeSlotIds] = useState([]);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const selectedEmployee = employees.find((emp) => String(emp.id) === form.employee_id);

  const filteredConstraintCourses = constraintCourses.filter((course) => {
    const q = constraintCourseQuery.trim().toLowerCase();
    if (!q) return true;
    return `${course.code} ${course.name}`.toLowerCase().includes(q);
  });

  const filteredConstraintSlots = constraintTimeSlots.filter((slot) => {
    const q = constraintSlotQuery.trim().toLowerCase();
    if (!q) return true;
    const text = `${slot.code} ${DAY_LABELS[slot.day] ?? slot.day} ${fmtTime(slot.start_time)} ${fmtTime(slot.end_time)}`;
    return text.toLowerCase().includes(q);
  });

  const groupedFilteredSlots = filteredConstraintSlots.reduce((acc, slot) => {
    const key = slot.day;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const sameIdSet = (left, right) => {
    if (left.length !== right.length) return false;
    const normalizedLeft = [...left].map(String).sort();
    const normalizedRight = [...right].map(String).sort();
    return normalizedLeft.every((value, index) => value === normalizedRight[index]);
  };

  const loadAssignments = useCallback(async () => {
    if (!dsId || !token) return;
    setLoading(true);
    setFormError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

      const res = await fetch(`/api/datasets/${dsId}/lecturers/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat assignment");
      }
      const body = await res.json();
      const normalized = normalizePaginatedResponse(body, PAGE_SIZE, offset);
      setRows(normalized.items);
      setTotalItems(normalized.total);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [dsId, token, page, debouncedSearch]);

  const loadEmployees = useCallback(async () => {
    if (!token || isLecturerRole) return;
    const res = await fetch("/api/employees/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = await res.json();
      const normalized = normalizePaginatedResponse(body, 1000, 0);
      setEmployees(normalized.items);
    }
  }, [token, isLecturerRole]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialog({ mode: "add" });
  };

  const openEdit = (row) => {
    setForm({ employee_id: String(row.employee_id) });
    setFormError(null);
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Karyawan wajib dipilih");
      return;
    }
    setSaving(true);
    setFormError(null);

    const body = { employee_id: Number(form.employee_id) };
    const isEdit = dialog?.mode === "edit";
    const url = isEdit
      ? `/api/datasets/${dsId}/lecturers/${dialog.row.id}`
      : `/api/datasets/${dsId}/lecturers/`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail ?? "Gagal menyimpan assignment");
      return;
    }
    setDialog(null);
    toast.success(isEdit ? "Assignment berhasil diperbarui" : "Assignment berhasil ditambahkan");
    loadAssignments();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setSaving(true);
    const res = await fetch(`/api/datasets/${dsId}/lecturers/${delTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail ?? "Gagal menghapus assignment");
      return;
    }
    toast.success("Assignment berhasil dihapus");
    setDelTarget(null);
    loadAssignments();
  };

  const openConstraints = async (row) => {
    setConstraintsDialog({ lecturer: row });
    setConstraintsLoading(true);
    setConfirmResetOpen(false);
    setConstraintCourseQuery("");
    setConstraintSlotQuery("");
    try {
      const [coursesRes, slotsRes, constraintsRes] = await Promise.all([
        fetch(`/api/datasets/${dsId}/courses/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${dsId}/time-slots/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${dsId}/lecturers/${row.id}/constraints`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!coursesRes.ok) {
        const err = await coursesRes.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat daftar mata kuliah");
      }
      if (!slotsRes.ok) {
        const err = await slotsRes.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat daftar timeslot");
      }
      if (!constraintsRes.ok) {
        const err = await constraintsRes.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat batasan dosen");
      }

      const coursesBody = await coursesRes.json();
      const slotsBody = await slotsRes.json();
      const constraintsBody = await constraintsRes.json();

      const normalizedCourses = normalizePaginatedResponse(coursesBody, 1000, 0).items;
      const normalizedSlots = normalizePaginatedResponse(slotsBody, 1000, 0).items;

      normalizedSlots.sort((a, b) => `${a.day}-${a.start_time}`.localeCompare(`${b.day}-${b.start_time}`));
      normalizedCourses.sort((a, b) => `${a.code}`.localeCompare(`${b.code}`));

      setConstraintCourses(normalizedCourses);
      setConstraintTimeSlots(normalizedSlots);
      const nextCourseIds = (constraintsBody.allowed_course_ids ?? []).map((id) => String(id));
      const nextTimeSlotIds = (constraintsBody.allowed_time_slot_ids ?? []).map((id) => String(id));
      setSelectedCourseIds(nextCourseIds);
      setSelectedTimeSlotIds(nextTimeSlotIds);
      setInitialConstraintCourseIds(nextCourseIds);
      setInitialConstraintTimeSlotIds(nextTimeSlotIds);
    } catch (e) {
      toast.error(e.message);
      setConstraintsDialog(null);
    } finally {
      setConstraintsLoading(false);
    }
  };

  const saveConstraints = async () => {
    if (!constraintsDialog?.lecturer?.id) return;

    const changed = !sameIdSet(selectedCourseIds, initialConstraintCourseIds) || !sameIdSet(selectedTimeSlotIds, initialConstraintTimeSlotIds);
    if (changed && !confirmResetOpen) {
      setConfirmResetOpen(true);
      return;
    }

    setConstraintsSaving(true);
    try {
      const res = await fetch(`/api/datasets/${dsId}/lecturers/${constraintsDialog.lecturer.id}/constraints`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          allowed_course_ids: selectedCourseIds.map(Number),
          allowed_time_slot_ids: selectedTimeSlotIds.map(Number),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal menyimpan batasan dosen");
      }

      const body = await res.json();
      if (body.preferences_reset) {
        toast.warning(body.preferences_reset_message ?? "Preferensi dosen telah direset karena batasan berubah.");
      } else {
        toast.success("Batasan dosen berhasil disimpan");
      }
      setInitialConstraintCourseIds(selectedCourseIds);
      setInitialConstraintTimeSlotIds(selectedTimeSlotIds);
      setConstraintsDialog(null);
      setConfirmResetOpen(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConstraintsSaving(false);
    }
  };

  const toggleCourse = (id) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const toggleSlot = (id) => {
    setSelectedTimeSlotIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const selectAllFilteredCourses = () => {
    const ids = filteredConstraintCourses.map((course) => String(course.id));
    setSelectedCourseIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearAllFilteredCourses = () => {
    const ids = new Set(filteredConstraintCourses.map((course) => String(course.id)));
    setSelectedCourseIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  const selectAllFilteredSlots = () => {
    const ids = filteredConstraintSlots.map((slot) => String(slot.id));
    setSelectedTimeSlotIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearAllFilteredSlots = () => {
    const ids = new Set(filteredConstraintSlots.map((slot) => String(slot.id)));
    setSelectedTimeSlotIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dsId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [page, totalItems]);

  if (!dsId) {
    return (
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground">Pilih dataset terlebih dahulu.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Assignment Karyawan (Lecturers)
          </h1>
          <DatasetHeaderInfo datasetId={dsId} datasetName={selected?.name} />
        </div>
        {!isLecturerRole && (
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Assign Karyawan</Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari assignment..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Kode Karyawan</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada assignment karyawan."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code}</TableCell>
                  <TableCell className="font-mono">{r.employee_code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.email ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>
                    {!isLecturerRole && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon-sm" title="Atur batasan" onClick={() => openConstraints(r)}><SlidersHorizontal className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDelTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            setPage={setPage}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            itemLabel="assignment"
          />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Ubah Assignment" : "Assign Karyawan"}</DialogTitle>
          </DialogHeader>
          <form id="lecturer-form" onSubmit={handleSave} className="space-y-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="employee_id">Karyawan *</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => setForm({ employee_id: v })}
              >
                <SelectTrigger id="employee_id">
                  <SelectValue placeholder="— Pilih Karyawan —">
                    {selectedEmployee ? `${selectedEmployee.employee_code} - ${selectedEmployee.name}` : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.employee_code} - {emp.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="lecturer-form" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={constraintsDialog !== null} onOpenChange={(open) => !open && setConstraintsDialog(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Atur Batasan Dosen
              {constraintsDialog?.lecturer ? ` - ${constraintsDialog.lecturer.name}` : ""}
            </DialogTitle>
          </DialogHeader>

          {constraintsLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Mata Kuliah Diizinkan</h3>
                    <p className="text-xs text-muted-foreground">{selectedCourseIds.length} dipilih</p>
                  </div>
                </div>

                <Input
                  placeholder="Cari mata kuliah..."
                  value={constraintCourseQuery}
                  onChange={(e) => setConstraintCourseQuery(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFilteredCourses}>Pilih Semua Hasil</Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAllFilteredCourses}>Hapus Semua Hasil</Button>
                </div>

                <div className="max-h-72 overflow-auto rounded border">
                  {filteredConstraintCourses.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">Tidak ada mata kuliah.</p>
                  ) : (
                    <div className="divide-y">
                      {filteredConstraintCourses.map((course) => {
                        const id = String(course.id);
                        return (
                          <label key={id} className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={selectedCourseIds.includes(id)}
                              onChange={() => toggleCourse(id)}
                            />
                            <span className="font-mono text-xs">{course.code}</span>
                            <span>{course.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Timeslot Diizinkan</h3>
                    <p className="text-xs text-muted-foreground">{selectedTimeSlotIds.length} dipilih</p>
                  </div>
                </div>

                <Input
                  placeholder="Cari timeslot..."
                  value={constraintSlotQuery}
                  onChange={(e) => setConstraintSlotQuery(e.target.value)}
                />

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFilteredSlots}>Pilih Semua Hasil</Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAllFilteredSlots}>Hapus Semua Hasil</Button>
                </div>

                <div className="max-h-72 overflow-auto rounded border">
                  {filteredConstraintSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">Tidak ada timeslot.</p>
                  ) : (
                    <div className="space-y-3 p-2">
                      {Object.entries(groupedFilteredSlots).map(([day, slots]) => (
                        <div key={day}>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">{DAY_LABELS[day] ?? day}</p>
                          <div className="space-y-1">
                            {slots.map((slot) => {
                              const id = String(slot.id);
                              return (
                                <label key={id} className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/40 rounded">
                                  <input
                                    type="checkbox"
                                    checked={selectedTimeSlotIds.includes(id)}
                                    onChange={() => toggleSlot(id)}
                                  />
                                  <span className="font-mono text-xs">{slot.code}</span>
                                  <span>{fmtTime(slot.start_time)}-{fmtTime(slot.end_time)}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="button" onClick={saveConstraints} disabled={constraintsSaving || constraintsLoading}>
              {constraintsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Batasan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmResetOpen} onOpenChange={(open) => !open && setConfirmResetOpen(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <SlidersHorizontal className="h-5 w-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Perubahan batasan akan mereset preferensi dosen</AlertDialogTitle>
            <AlertDialogDescription>
              Jika dosen sudah menyimpan preferensi, perubahan batasan ini akan menghapus preferensi tersebut agar data tetap konsisten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => saveConstraints()} disabled={constraintsSaving}>
              {constraintsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lanjut Simpan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delTarget !== null} onOpenChange={(open) => !open && setDelTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2 className="h-5 w-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Hapus Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus assignment <span className="font-medium text-foreground">{delTarget?.code ?? ""}</span>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
