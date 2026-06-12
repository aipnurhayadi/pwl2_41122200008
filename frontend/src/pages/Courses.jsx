import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import { useDataset } from "@/context/DatasetContext";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import DatasetHeaderInfo from "@/components/DatasetHeaderInfo";
import DataTablePagination from "@/components/DataTablePagination";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function Courses() {
  const { datasetId: paramId } = useParams();
  const { selected } = useDataset();
  const { token } = useAuth();
  const dsId = paramId ?? selected?.id;

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!dsId || !token) return;
    setLoading(true);

    const run = async () => {
      try {
        const res = await fetch(`/api/datasets/${dsId}/tree`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? "Gagal memuat mata kuliah");
        }
        const body = await res.json();
        setAllRows(Array.isArray(body.courses) ? body.courses : []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [dsId, token]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allRows;

    return allRows.filter((row) => {
      const haystack = `${row.code ?? ""} ${row.name ?? ""} ${row.major_name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allRows, debouncedSearch]);

  const totalItems = filteredRows.length;
  const rows = useMemo(() => {
    const offset = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(offset, offset + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
            <BookOpen className="h-6 w-6 text-primary" /> Mata Kuliah
          </h1>
          <DatasetHeaderInfo datasetId={dsId} datasetName={selected?.name} />
          <p className="text-xs text-muted-foreground mt-1">Mode baca saja sementara sampai endpoint CRUD mata kuliah Laravel dipindahkan.</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari mata kuliah..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                <TableHead>Nama Mata Kuliah</TableHead>
                <TableHead>Program Studi</TableHead>
                <TableHead>SKS</TableHead>
                <TableHead>Sem.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalItems === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {search ? "Tidak ada hasil pencarian." : "Belum ada data mata kuliah."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.major_name ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>{r.credits}</TableCell>
                  <TableCell>{r.semester ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination
            page={page}
            setPage={setPage}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            itemLabel="mata kuliah"
          />
        </div>
      )}
    </main>
  );
}
