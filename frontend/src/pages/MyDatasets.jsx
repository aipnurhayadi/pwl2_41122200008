import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Database, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DataTablePagination from "@/components/DataTablePagination";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import EmployeeLayout from "@/components/EmployeeLayout";

const PAGE_SIZE = 10;

export default function MyDatasets() {
  const { token, user } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
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
        toast.error(e.message);
        setLoading(false);
      });
  }, [token]);

  const totalPages = Math.max(1, Math.ceil(datasets.length / PAGE_SIZE));
  const paginated = datasets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <EmployeeLayout title="Dataset Saya" icon={Database} maxWidth="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Selamat datang, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">
          Berikut adalah daftar dataset yang Anda ditugaskan sebagai dosen.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Memuat dataset...</p>}

      {!loading && datasets.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada dataset yang ditugaskan</p>
          <p className="text-sm mt-1">
            Hubungi admin untuk mendapatkan penugasan dataset.
          </p>
        </div>
      )}

      {!loading && datasets.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Dataset</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="w-[88px] text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((ds) => (
                <TableRow key={ds.id}>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {ds.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{ds.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[420px] truncate">
                    {ds.description || "Tanpa deskripsi"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Lihat detail dataset"
                    >
                      <Link
                        to={`/datasets/${ds.id}`}
                        aria-label={`Lihat detail ${ds.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
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
    </EmployeeLayout>
  );
}
