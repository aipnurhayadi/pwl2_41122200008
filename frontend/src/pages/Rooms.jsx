import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import DatasetHeaderInfo from "@/components/DatasetHeaderInfo";
import DataTablePagination from "@/components/DataTablePagination";
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
import { normalizePaginatedResponse } from "@/lib/paginated";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "sonner";

const ROOM_TYPES = ["TEORI", "LABORATORIUM", "AULA", "SEMINAR"];
const ROOM_TYPE_LABELS = {
  TEORI: "Teori",
  LABORATORIUM: "Laboratorium",
  AULA: "Aula",
  SEMINAR: "Seminar",
};
const EMPTY_FORM = { building_code: "", floor: "", room_number: "", capacity: "", room_type: "" };
const PAGE_SIZE = 10;

function roomTypeVariant(t) {
  if (t === "LABORATORIUM") return "destructive";
  if (t === "AULA") return "secondary";
  if (t === "SEMINAR") return "outline";
  return "default";
}

export default function Rooms() {
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

      const res = await fetch(`/api/datasets/${dsId}/rooms/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat ruangan");
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
      building_code: row.building_code ?? "",
      floor: row.floor ?? "",
      room_number: row.room_number ?? "",
      capacity: row.capacity ?? "",
      room_type: row.room_type ?? "",
    });
    setFormError(null);
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = {
      building_code: form.building_code.trim(),
      floor: parseInt(form.floor, 10),
      room_number: parseInt(form.room_number, 10),
      capacity: parseInt(form.capacity, 10),
      room_type: form.room_type || null,
    };
    const isEdit = dialog?.mode === "edit";
    const url = isEdit
      ? `/api/datasets/${dsId}/rooms/${dialog.row.id}`
      : `/api/datasets/${dsId}/rooms/`;
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
    toast.success(isEdit ? "Ruangan berhasil diperbarui" : "Ruangan berhasil ditambahkan");
    load();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setSaving(true);
    const res = await fetch(`/api/datasets/${dsId}/rooms/${delTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail ?? "Gagal menghapus ruangan");
      return;
    }
    toast.success("Ruangan berhasil dihapus");
    setDelTarget(null);
    load();
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const buildingNamePreview = `${form.building_code}${form.floor}${form.room_number}`;
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
            <Building2 className="h-6 w-6 text-primary" /> Ruangan
          </h1>
          <DatasetHeaderInfo datasetId={dsId} datasetName={selected?.name} />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari ruangan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                <TableHead>Nama Ruangan</TableHead>
                <TableHead>Lantai</TableHead>
                <TableHead>Kapasitas</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada data ruangan."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code}</TableCell>
                  <TableCell>{r.building_name}</TableCell>
                  <TableCell>{r.floor}</TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>
                    {r.room_type
                      ? <Badge variant={roomTypeVariant(r.room_type)}>{r.room_type}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDelTarget(r)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
            itemLabel="ruangan"
          />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Ruangan" : "Tambah Ruangan"}</DialogTitle>
          </DialogHeader>
          <form id="room-form" onSubmit={handleSave} className="grid grid-cols-2 gap-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="r-bcode">Kode Gedung *</Label>
              <Input id="r-bcode" value={form.building_code} onChange={setField("building_code")} required placeholder="A" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-floor">Lantai *</Label>
              <Input id="r-floor" type="number" min={1} value={form.floor} onChange={setField("floor")} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-roomnum">Nomor Ruangan *</Label>
              <Input id="r-roomnum" type="number" min={1} value={form.room_number} onChange={setField("room_number")} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-cap">Kapasitas *</Label>
              <Input id="r-cap" type="number" min={1} value={form.capacity} onChange={setField("capacity")} required />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="r-bname">Nama Ruangan</Label>
              <Input id="r-bname" value={buildingNamePreview} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" placeholder="Otomatis terisi" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="r-type">Tipe Ruangan</Label>
              <Select
                value={form.room_type}
                onValueChange={(v) => setForm((f) => ({ ...f, room_type: v }))}
              >
                <SelectTrigger id="r-type">
                  <SelectValue placeholder="— Pilih Tipe —">
                    {form.room_type ? ROOM_TYPE_LABELS[form.room_type] ?? form.room_type : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {ROOM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t] ?? t}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="room-form" disabled={saving}>
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
            <AlertDialogTitle>Hapus Ruangan</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus ruangan <span className="font-medium text-foreground">{delTarget?.building_name}</span>? Tindakan ini tidak dapat dibatalkan.
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
