import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  Database,
  Building2,
  Clock,
  GraduationCap,
  Loader2,
  Users,
  ChevronRight,
  ArrowLeft,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmployeeAppLayout from "@/components/layouts/EmployeeAppLayout";

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

const MODAL_DEFS = {
  rooms: { title: "Ruangan", columns: ["Kode", "Gedung", "Tipe"] },
  lecturers: { title: "Dosen", columns: ["Kode", "Kode Pegawai", "Nama"] },
  courses: { title: "Mata Kuliah", columns: ["Kode", "Nama", "SKS"] },
  time_slots: { title: "Slot Waktu", columns: ["Kode", "Hari", "Mulai", "Selesai"] },
  classes: { title: "Kelas", columns: ["Kode", "Nama"] },
};

function getModalRows(key, tree) {
  if (!tree) return [];
  switch (key) {
    case "rooms":
      return tree.rooms.map((r) => [
        r.code,
        r.building_name,
        r.room_type ?? "-",
      ]);
    case "lecturers":
      return tree.lecturers.map((r) => [r.code, r.employee_code, r.name]);
    case "courses":
      return tree.courses.map((r) => [r.code, r.name, r.credits]);
    case "time_slots":
      return tree.time_slots.map((r) => [
        r.code,
        DAY_LABELS[r.day] ?? r.day,
        fmtTime(r.start_time),
        fmtTime(r.end_time),
      ]);
    case "classes":
      return tree.classes.map((r) => [r.code, r.name]);
    default:
      return [];
  }
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
  const { token, user } = useAuth();

  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [modalPage, setModalPage] = useState(1);

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
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [datasetId, token]);


  const quickStats = useMemo(() => {
    if (!tree) return [];
    return [
      { label: "Ruangan", value: tree.rooms.length, modal: "rooms" },
      { label: "Dosen", value: tree.lecturers.length, modal: "lecturers" },
      { label: "Mata Kuliah", value: tree.courses.length, modal: "courses" },
      {
        label: "Slot Waktu",
        value: tree.time_slots.length,
        modal: "time_slots",
      },
      { label: "Kelas", value: tree.classes.length, modal: "classes" },
    ];
  }, [tree]);

  const modalRows = useMemo(() => {
    if (!activeModal) return [];
    return getModalRows(activeModal, tree);
  }, [activeModal, tree]);

  const modalColumns = activeModal
    ? (MODAL_DEFS[activeModal]?.columns ?? [])
    : [];

  useEffect(() => {
    setModalPage(1);
  }, [activeModal]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(modalRows.length / PAGE_SIZE));
    if (modalPage > totalPages) {
      setModalPage(totalPages);
    }
  }, [modalPage, modalRows.length]);

  const pagedModalRows = modalRows.slice(
    (modalPage - 1) * PAGE_SIZE,
    modalPage * PAGE_SIZE,
  );
  const isAdmin = user?.role === "ADMIN";
  const backTo = user?.role === "LECTURER" ? "/my-datasets" : "/datasets";
  const navBackLink = <></>;

  if (loading) {
    if (isAdmin) {
      return (
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </main>
      );
    }

    return (
      <EmployeeAppLayout
        title="Detail Dataset"
        icon={Database}
        navContent={navBackLink}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </EmployeeAppLayout>
    );
  }

  if (error) {
    if (isAdmin) {
      return (
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <p className="text-destructive">{error}</p>
        </main>
      );
    }

    return (
      <EmployeeAppLayout
        title="Detail Dataset"
        icon={Database}
        navContent={navBackLink}
        mainClassName="space-y-4"
      >
        <p className="text-destructive">{error}</p>
      </EmployeeAppLayout>
    );
  }

  if (!tree) return null;

  const content = (
    <>
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Link
            to={backTo}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Kembali"
            title="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="grow">
            <h1 className="text-2xl font-bold">{tree.dataset.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tree.dataset.description || "Tanpa deskripsi"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tree.dataset.code}</Badge>
          </div>
        </div>
      </section>

      {token && user?.role === "LECTURER" && (
        <section className="rounded-xl border bg-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Fitur Lanjutan
          </div>
          <p className="text-sm text-muted-foreground">
            Modul solver dan preferensi dosen belum diaktifkan pada backend Laravel saat ini.
          </p>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {quickStats.map((item) => (
          <Card key={item.label} className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-semibold">{item.value}</div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setActiveModal(item.modal)}
              >
                Lihat Data
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <TreeTableSection
          icon={Building2}
          title="Ruangan"
          rows={tree.rooms}
          emptyMessage="Belum ada data ruangan."
          itemLabel="ruangan"
          columns={[
            { key: "code", label: "Kode" },
            { key: "building", label: "Gedung" },
            { key: "type", label: "Tipe" },
          ]}
          renderRow={(room) => (
            <TableRow key={room.id}>
              <TableCell>{room.code}</TableCell>
              <TableCell>{room.building_name}</TableCell>
              <TableCell>{room.room_type ?? "-"}</TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={GraduationCap}
          title="Dosen"
          rows={tree.lecturers}
          emptyMessage="Belum ada data dosen."
          itemLabel="dosen"
          columns={[
            { key: "code", label: "Kode" },
            { key: "employee", label: "Kode Pegawai" },
            { key: "name", label: "Nama" },
          ]}
          renderRow={(lecturer) => (
            <TableRow key={lecturer.id}>
              <TableCell>{lecturer.code}</TableCell>
              <TableCell>{lecturer.employee_code ?? "-"}</TableCell>
              <TableCell>{lecturer.name ?? "-"}</TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={BookOpen}
          title="Mata Kuliah"
          rows={tree.courses}
          emptyMessage="Belum ada data mata kuliah."
          itemLabel="mata kuliah"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama" },
            { key: "credits", label: "SKS" },
          ]}
          renderRow={(course) => (
            <TableRow key={course.id}>
              <TableCell>{course.code}</TableCell>
              <TableCell>{course.name}</TableCell>
              <TableCell>{course.credits}</TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={Clock}
          title="Slot Waktu"
          rows={tree.time_slots}
          emptyMessage="Belum ada data slot waktu."
          itemLabel="slot waktu"
          columns={[
            { key: "code", label: "Kode" },
            { key: "day", label: "Hari" },
            { key: "start", label: "Mulai" },
            { key: "end", label: "Selesai" },
          ]}
          renderRow={(slot) => (
            <TableRow key={slot.id}>
              <TableCell>{slot.code}</TableCell>
              <TableCell>{DAY_LABELS[slot.day] ?? slot.day}</TableCell>
              <TableCell>{fmtTime(slot.start_time)}</TableCell>
              <TableCell>{fmtTime(slot.end_time)}</TableCell>
            </TableRow>
          )}
        />

        <TreeTableSection
          icon={Users}
          title="Kelas"
          rows={tree.classes}
          emptyMessage="Belum ada data kelas."
          itemLabel="kelas"
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama" },
          ]}
          renderRow={(classItem) => (
            <TableRow key={classItem.id}>
              <TableCell>{classItem.code}</TableCell>
              <TableCell>{classItem.name}</TableCell>
            </TableRow>
          )}
        />
      </section>

      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{activeModal ? MODAL_DEFS[activeModal]?.title : "Detail"}</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {modalColumns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(1, modalColumns.length)} className="text-center text-muted-foreground py-8">
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedModalRows.map((cells, i) => (
                    <TableRow key={i}>
                      {cells.map((cell, j) => (
                        <TableCell key={j}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {activeModal && (
              <DataTablePagination
                page={modalPage}
                setPage={setModalPage}
                totalItems={modalRows.length}
                pageSize={PAGE_SIZE}
                itemLabel={MODAL_DEFS[activeModal]?.title ?? "data"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (isAdmin) {
    return <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">{content}</main>;
  }

  return (
    <EmployeeAppLayout
      title="Detail Dataset"
      icon={Database}
      navContent={navBackLink}
      mainClassName="space-y-6"
    >
      {content}
    </EmployeeAppLayout>
  );
}
