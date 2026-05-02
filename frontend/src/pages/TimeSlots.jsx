import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Clock, Plus, Pencil, Trash2, Loader2, Search, X } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import DatasetHeaderInfo from "@/components/DatasetHeaderInfo";
import DataTablePagination from "@/components/DataTablePagination";
import { normalizePaginatedResponse } from "@/lib/paginated";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const DAY_LABELS = {
  MON: "Senin", TUE: "Selasa", WED: "Rabu", THU: "Kamis",
  FRI: "Jumat", SAT: "Sabtu", SUN: "Minggu",
};
const DAYS = Object.entries(DAY_LABELS);
const EMPTY_FORM = { day: "MON", start_time: "07:00", end_time: "08:00" };
const PAGE_SIZE = 10;

function fmtTime(t) { return t ? t.slice(0, 5) : "—"; }
const timeInputClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring dark:bg-input/30";

export default function TimeSlots() {
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

      const res = await fetch(`/api/datasets/${dsId}/time-slots/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Gagal memuat slot waktu");
      }
      const body = await res.json();
      const normalized = normalizePaginatedResponse(body, PAGE_SIZE, offset);
      setRows(normalized.items);
      setTotalItems(normalized.total);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dsId, token, page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY_FORM); setFormError(null); setDialog({ mode: "add" }); };
  const openEdit = (row) => {
    setForm({
      day: row.day ?? "MON",
      start_time: fmtTime(row.start_time),
      end_time: fmtTime(row.end_time),
    });
    setFormError(null);
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const body = {
      day: form.day,
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
    };
    const isEdit = dialog?.mode === "edit";
    const url = isEdit
      ? `/api/datasets/${dsId}/time-slots/${dialog.row.id}`
      : `/api/datasets/${dsId}/time-slots/`;
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setFormError(err.detail ?? "Gagal menyimpan");
      return;
    }
    setDialog(null);
    load();
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setSaving(true);
    await fetch(`/api/datasets/${dsId}/time-slots/${delTarget.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaving(false);
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
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <p className="text-muted-foreground">Pilih dataset terlebih dahulu.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" /> Slot Waktu
          </h1>
          <DatasetHeaderInfo datasetId={dsId} datasetName={selected?.name} />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari hari..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                <TableHead>Hari</TableHead>
                <TableHead>Jam Mulai</TableHead>
                <TableHead>Jam Selesai</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada data slot waktu."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{DAY_LABELS[r.day] ?? r.day}</TableCell>
                  <TableCell className="font-mono">{fmtTime(r.start_time)}</TableCell>
                  <TableCell className="font-mono">{fmtTime(r.end_time)}</TableCell>
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
            itemLabel="slot waktu"
          />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Slot Waktu" : "Tambah Slot Waktu"}</DialogTitle>
          </DialogHeader>
          <form id="slot-form" onSubmit={handleSave} className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="s-day">Hari *</Label>
              <Select
                value={form.day}
                onValueChange={(v) => setForm((f) => ({ ...f, day: v }))}
              >
                <SelectTrigger id="s-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {DAYS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="s-start">Jam Mulai *</Label>
                <input id="s-start" type="time" value={form.start_time} onChange={setField("start_time")} required className={timeInputClass} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-end">Jam Selesai *</Label>
                <input id="s-end" type="time" value={form.end_time} onChange={setField("end_time")} required className={timeInputClass} />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="slot-form" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delTarget !== null} onOpenChange={(open) => !open && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Slot Waktu</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Yakin ingin menghapus slot{" "}
            <span className="font-medium text-foreground">
              {delTarget ? `${DAY_LABELS[delTarget.day] ?? delTarget.day} ${fmtTime(delTarget.start_time)}–${fmtTime(delTarget.end_time)}` : ""}
            </span>?
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
