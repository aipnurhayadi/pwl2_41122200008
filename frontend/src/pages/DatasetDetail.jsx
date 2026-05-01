import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  Building2,
  Clock,
  Eye,
  GraduationCap,
  Loader2,
  Users,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DataTablePagination from "@/components/DataTablePagination";

const PAGE_SIZE = 8;

const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

function fmtTime(value) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function TreeSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true,
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none select-none px-4 py-3 hover:bg-accent/40 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <Icon className="h-4 w-4 text-primary" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{count} data</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

function TreeTableSection({
  icon,
  title,
  rows,
  emptyMessage,
  itemLabel,
  columns,
  renderRow,
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <TreeSection icon={icon} title={title} count={rows.length}>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {paginated.map(renderRow)}
          </TableBody>
        </Table>
        <DataTablePagination
          page={page}
          setPage={setPage}
          totalItems={rows.length}
          pageSize={PAGE_SIZE}
          itemLabel={itemLabel}
        />
      </div>
    </TreeSection>
  );
}

export default function DatasetDetail() {
  const { datasetId } = useParams();
  const { token } = useAuth();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!datasetId) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/datasets/${datasetId}/tree`, { headers });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? "Gagal memuat detail dataset");
        }
        setTree(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [datasetId, token]);

  const quickStats = useMemo(() => {
    if (!tree) return [];
    return [
      { label: "Ruangan", value: tree.rooms.length },
      { label: "Dosen", value: tree.lecturers.length },
      { label: "Mata Kuliah", value: tree.courses.length },
      { label: "Slot Waktu", value: tree.time_slots.length },
      { label: "Kelas", value: tree.classes.length },
    ];
  }, [tree]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <p className="text-destructive">{error}</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Kembali ke Home
        </Link>
      </main>
    );
  }

  if (!tree) return null;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Dataset Detail
            </p>
            <h1 className="text-2xl font-bold mt-1">{tree.dataset.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tree.dataset.description || "Tanpa deskripsi"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tree.dataset.code}</Badge>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-5 mt-4">
          {quickStats.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <TreeTableSection
          icon={Building2}
          title="Ruangan"
          rows={tree.rooms}
          emptyMessage="Tidak ada data ruangan"
          itemLabel="ruangan"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama Ruangan" },
          ]}
          renderRow={(r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.code}</TableCell>
              <TableCell className="text-muted-foreground truncate">
                {r.building_name}
              </TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={GraduationCap}
          title="Dosen"
          rows={tree.lecturers}
          emptyMessage="Tidak ada data dosen"
          itemLabel="dosen"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama" },
          ]}
          renderRow={(l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.code}</TableCell>
              <TableCell className="text-muted-foreground truncate">
                {l.employee_code} - {l.name}
              </TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={BookOpen}
          title="Mata Kuliah"
          rows={tree.courses}
          emptyMessage="Tidak ada data mata kuliah"
          itemLabel="mata kuliah"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama Mata Kuliah" },
          ]}
          renderRow={(c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.code}</TableCell>
              <TableCell className="text-muted-foreground truncate">
                {c.name} ({c.credits} SKS)
              </TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={Clock}
          title="Slot Waktu"
          rows={tree.time_slots}
          emptyMessage="Tidak ada data slot waktu"
          itemLabel="slot waktu"
          columns={[
            { key: "day", label: "Hari" },
            { key: "time", label: "Rentang Waktu" },
          ]}
          renderRow={(s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">
                {DAY_LABELS[s.day] ?? s.day}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
              </TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={Users}
          title="Kelas"
          rows={tree.classes}
          emptyMessage="Tidak ada data kelas"
          itemLabel="kelas"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama Kelas" },
          ]}
          renderRow={(c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.code}</TableCell>
              <TableCell className="text-muted-foreground truncate">
                {c.name}
              </TableCell>
            </TableRow>
          )}
        />
      </section>
    </main>
  );
}
