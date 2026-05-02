import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Users, Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const EMPTY_FORM = {
  name: "", academic_year: "", semester: "", study_program: "", capacity: "", description: "",
};
const PAGE_SIZE = 10;

export default function Classes() {
  const { datasetId: paramId } = useParams();
  const { selected } = useDataset();
  const { token } = useAuth();
  const dsId = paramId ?? selected?.id;

  const [rows, setRows] = useState([]);
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

  const load = useCallback(async () => {
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

      const res = await fetch(`/api/datasets/${dsId}/classes/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat kelas");
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

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setFormError(null); setDialog({ mode: "add" }); };
  const openEdit = (row) => {
    setForm({
      name: row.name ?? "",
      academic_year: row.academic_year ?? "",
      semester: row.semester ?? "",
      study_program: row.study_program ?? "",
      capacity: row.capacity ?? "",
      description: row.description ?? "",
    });
    setFormError(null);
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const intOrNull = (v) => v !== "" ? parseInt(v, 10) : null;
    const body = {
      name: form.name.trim(),
      academic_year: intOrNull(form.academic_year),
      semester: intOrNull(form.semester),
      study_program: form.study_program.trim() || null,
      capacity: intOrNull(form.capacity),
      description: form.description.trim() || null,
    };
    const isEdit = dialog?.mode === "edit";
    const url = isEdit
      ? `/api/datasets/${dsId}/classes/${dialog.row.id}`
      : `/api/datasets/${dsId}/classes/`;
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail ?? "Gagal menyimpan");
      return;
    }
    setDialog(null);
    toast.success(isEdit ? "Kelas berhasil diperbarui" : "Kelas berhasil ditambahkan");
    load();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setSaving(true);
    const res = await fetch(`/api/datasets/${dsId}/classes/${delTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail ?? "Gagal menghapus kelas");
      return;
    }
    toast.success("Kelas berhasil dihapus");
    setDelTarget(null);
    load();
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
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
            <Users className="h-6 w-6 text-primary" /> Kelas
          </h1>
          <DatasetHeaderInfo datasetId={dsId} datasetName={selected?.name} />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari kelas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                <TableHead>Nama Kelas</TableHead>
                <TableHead>Th. Akademik</TableHead>
                <TableHead>Sem.</TableHead>
                <TableHead>Program Studi</TableHead>
                <TableHead>Kapasitas</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada data kelas."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.academic_year ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{r.semester ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{r.study_program ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{r.capacity ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDelTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
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
            itemLabel="kelas"
          />
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Kelas" : "Tambah Kelas"}</DialogTitle>
          </DialogHeader>
          <form id="class-form" onSubmit={handleSave} className="grid grid-cols-2 gap-x-4 gap-y-3 py-1">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cl-name">Nama Kelas *</Label>
              <Input id="cl-name" value={form.name} onChange={setField("name")} required placeholder="REG B1 2025" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-year">Tahun Akademik</Label>
              <Input id="cl-year" type="number" min={2000} max={2100} value={form.academic_year} onChange={setField("academic_year")} placeholder="2025" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-sem">Semester</Label>
              <Input id="cl-sem" type="number" min={1} max={8} value={form.semester} onChange={setField("semester")} placeholder="1" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cl-prodi">Program Studi</Label>
              <Input id="cl-prodi" value={form.study_program} onChange={setField("study_program")} placeholder="Teknik Informatika" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-cap">Kapasitas</Label>
              <Input id="cl-cap" type="number" min={1} value={form.capacity} onChange={setField("capacity")} placeholder="40" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="cl-desc">Deskripsi</Label>
              <Textarea id="cl-desc" value={form.description} onChange={setField("description")} rows={2} />
            </div>
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="class-form" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={delTarget !== null} onOpenChange={(open) => !open && setDelTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2 className="h-5 w-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus kelas <span className="font-medium text-foreground">{delTarget?.name}</span>? Tindakan ini tidak dapat dibatalkan.
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
