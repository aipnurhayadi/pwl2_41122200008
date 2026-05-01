import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Database, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import DataTablePagination from "@/components/DataTablePagination";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const PAGE_SIZE = 10;

export default function MyDatasets() {
  const { token, user, logout } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/datasets/my", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat dataset");
        return r.json();
      })
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [token]);

  const totalPages = Math.max(1, Math.ceil(datasets.length / PAGE_SIZE));
  const paginated = datasets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Database className="h-5 w-5 text-primary" />
          <span>Dataset Saya</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.name}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4 mr-1" />
            Keluar
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Selamat datang, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            Berikut adalah daftar dataset yang Anda ditugaskan sebagai dosen.
          </p>
        </div>

        {loading && (
          <p className="text-muted-foreground">Memuat dataset...</p>
        )}

        {error && (
          <p className="text-destructive">{error}</p>
        )}

        {!loading && !error && datasets.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Belum ada dataset yang ditugaskan</p>
            <p className="text-sm mt-1">Hubungi admin untuk mendapatkan penugasan dataset.</p>
          </div>
        )}

        {!loading && !error && datasets.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Dataset</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((ds) => (
                  <TableRow key={ds.id}>
                    <TableCell><Badge variant="secondary" className="text-xs">{ds.code}</Badge></TableCell>
                    <TableCell className="font-medium">{ds.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[420px] truncate">{ds.description || "Tanpa deskripsi"}</TableCell>
                    <TableCell className="font-mono">{ds.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataTablePagination
              page={page}
              setPage={setPage}
              totalItems={datasets.length}
              pageSize={PAGE_SIZE}
              itemLabel="dataset"
            />
          </div>
        )}
      </main>
    </div>
  );
}
