import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DataTablePagination from "@/components/DataTablePagination";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export default function Home() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/datasets/public");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat dataset public");
        }
        setDatasets(await res.json());
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const totalPages = Math.max(1, Math.ceil(datasets.length / PAGE_SIZE));
  const paginated = datasets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-12 space-y-12">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Eksplor Dataset Publik</h1>
        <p className="text-muted-foreground max-w-2xl">
          Lihat dataset yang sudah dipublikasikan.
        </p>
      </section>

      {loading ? (
        <section className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </section>
      ) : (
        <section className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Dataset</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Belum ada dataset public.
                  </TableCell>
                </TableRow>
              )}
              {paginated.map((ds) => (
                <TableRow key={ds.id}>
                  <TableCell><Badge variant="outline">{ds.code}</Badge></TableCell>
                  <TableCell className="font-medium">{ds.name}</TableCell>
                  <TableCell className="max-w-[420px] truncate text-muted-foreground">{ds.description || "Tanpa deskripsi"}</TableCell>
                  <TableCell><Badge>{ds.visibility}</Badge></TableCell>
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
        </section>
      )}

      <section className="pt-4">
        <a href="/docs" target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          Buka API Docs (Swagger)
        </a>
      </section>
    </main>
  );
}
