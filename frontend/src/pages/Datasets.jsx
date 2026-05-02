import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTablePagination from "@/components/DataTablePagination";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/context/AuthContext";
import { normalizePaginatedResponse } from "@/lib/paginated";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "sonner";

const PAGE_SIZE = 10;
const EMPTY_FORM = { name: "", description: "", visibility: "PRIVATE" };

export default function Datasets() {
  const {
    selected,
    selectDataset,
    createDataset,
    updateDataset,
    deleteDataset,
    refetch,
  } = useDataset();
  const { token } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());

      const res = await fetch(`/api/datasets/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat dataset");
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
  }, [token, page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [page, totalItems]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setDialog({ mode: "add" });
  };

  const openEdit = (row) => {
    setForm({
      name: row.name ?? "",
      description: row.description ?? "",
      visibility: row.visibility ?? "PRIVATE",
    });
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      visibility: form.visibility,
    };

    setSaving(true);

    let res;
    if (dialog?.mode === "edit") {
      res = await updateDataset(dialog.row.id, payload);
      if (!res.error && selected?.id === dialog.row.id) {
        selectDataset(res.data);
      }
    } else {
      res = await createDataset(payload);
    }

    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    setDialog(null);
    toast.success(dialog?.mode === "edit" ? "Dataset berhasil diperbarui" : "Dataset berhasil ditambahkan");
    await refetch();
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    const res = await deleteDataset(deleteTarget.id);
    setSaving(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Dataset berhasil dihapus");
    setDeleteTarget(null);
    await refetch();
    await load();
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> Datasets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola dataset aktif untuk penjadwalan.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Dataset
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari dataset..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada dataset."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline">{row.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="max-w-[340px] truncate text-muted-foreground">
                    {row.description || "Tanpa deskripsi"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.visibility === "PUBLIC" ? "default" : "secondary"}>
                      {row.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
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
            itemLabel="dataset"
          />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Dataset" : "Tambah Dataset"}</DialogTitle>
          </DialogHeader>
          <form id="dataset-form" onSubmit={handleSave} className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="ds-name">Nama Dataset *</Label>
              <Input
                id="ds-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ds-description">Description</Label>
              <Input
                id="ds-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ds-visibility">Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => setForm((prev) => ({ ...prev, visibility: v }))}
              >
                <SelectTrigger id="ds-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                  <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                </SelectPopup>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="dataset-form" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2 className="h-5 w-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Hapus Dataset</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus dataset <span className="font-medium text-foreground">{deleteTarget?.name}</span>? Tindakan ini tidak dapat dibatalkan.
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
