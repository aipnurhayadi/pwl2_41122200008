import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { GraduationCap, Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react";
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
  const debouncedSearch = useDebouncedValue(search, 300);
  const selectedEmployee = employees.find((emp) => String(emp.id) === form.employee_id);

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
                <TableHead className="w-20" />
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
