import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataTablePagination from "@/components/DataTablePagination";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  nidn: "",
  nip: "",
  front_title: "",
  back_title: "",
  email: "",
  phone: "",
  gender: "",
};

function normalizePayload(form) {
  const trimmed = Object.fromEntries(
    Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
  );

  return {
    name: trimmed.name,
    nidn: trimmed.nidn || null,
    nip: trimmed.nip || null,
    front_title: trimmed.front_title || null,
    back_title: trimmed.back_title || null,
    email: trimmed.email || null,
    phone: trimmed.phone || null,
    gender: trimmed.gender || null,
  };
}

export default function Employees() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat employee");
      }
      setRows(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.employee_code, row.name, row.email, row.nidn, row.nip]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setDialog({ mode: "add" });
  };

  const openEdit = (row) => {
    setForm({
      name: row.name ?? "",
      nidn: row.nidn ?? "",
      nip: row.nip ?? "",
      front_title: row.front_title ?? "",
      back_title: row.back_title ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      gender: row.gender ?? "",
    });
    setError(null);
    setDialog({ mode: "edit", row });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const isEdit = dialog?.mode === "edit";
    const target = dialog?.row;
    const endpoint = isEdit ? `/api/employees/${target.id}` : "/api/employees/";

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(normalizePayload(form)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menyimpan employee");
      }

      setDialog(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal menghapus employee");
      }

      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> Employee
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola data employee untuk akun lecturer.</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Tambah Employee
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari employee..."
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

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

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
                <TableHead>Email</TableHead>
                <TableHead>NIDN</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada employee."}
                  </TableCell>
                </TableRow>
              )}
              {paginated.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono font-medium">{row.employee_code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.email || "-"}</TableCell>
                  <TableCell>{row.nidn || "-"}</TableCell>
                  <TableCell>{row.nip || "-"}</TableCell>
                  <TableCell>
                    {row.gender ? <Badge variant="outline">{row.gender}</Badge> : "-"}
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
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            itemLabel="employee"
          />
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit Employee" : "Tambah Employee"}</DialogTitle>
          </DialogHeader>
          <form id="employee-form" onSubmit={handleSave} className="grid grid-cols-2 gap-3 py-1">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="e-name">Nama *</Label>
              <Input
                id="e-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-front-title">Gelar Depan</Label>
              <Input
                id="e-front-title"
                value={form.front_title}
                onChange={(e) => setForm((prev) => ({ ...prev, front_title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-back-title">Gelar Belakang</Label>
              <Input
                id="e-back-title"
                value={form.back_title}
                onChange={(e) => setForm((prev) => ({ ...prev, back_title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-nidn">NIDN</Label>
              <Input
                id="e-nidn"
                value={form.nidn}
                onChange={(e) => setForm((prev) => ({ ...prev, nidn: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-nip">NIP</Label>
              <Input
                id="e-nip"
                value={form.nip}
                onChange={(e) => setForm((prev) => ({ ...prev, nip: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="e-email">Email</Label>
              <Input
                id="e-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-phone">Phone</Label>
              <Input
                id="e-phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-gender">Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm((prev) => ({ ...prev, gender: v }))}
              >
                <SelectTrigger id="e-gender">
                  <SelectValue placeholder="Pilih gender" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="P">P</SelectItem>
                </SelectPopup>
              </Select>
            </div>
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
            <Button type="submit" form="employee-form" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Employee</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            Yakin ingin menghapus employee <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
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
