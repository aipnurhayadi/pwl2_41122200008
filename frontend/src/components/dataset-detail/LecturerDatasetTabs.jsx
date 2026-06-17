import { useEffect, useMemo, useState } from "react";

import BwmSolverTab from "@/components/dataset-detail/BwmSolverTab";
import LecturerPreferencesTab from "@/components/dataset-detail/LecturerPreferencesTab";
import TimetableAnalyticsSection from "@/components/dataset-detail/TimetableAnalyticsSection";
import DataTablePagination from "@/components/DataTablePagination";
import useLecturerBwm from "@/hooks/useLecturerBwm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRowNumber } from "@/lib/table";

const PAGE_SIZE = 8;

const TABS = [
  { id: "bwm", label: "BWM" },
  { id: "preferences", label: "Preferensi Mengajar" },
  { id: "result", label: "Result" },
];

const DAY_LABELS = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

const MODAL_DEFS = {
  rooms: { title: "Ruangan", columns: ["No.", "Kode", "Gedung", "Tipe"] },
  lecturers: { title: "Dosen", columns: ["No.", "Kode", "Kode Pegawai", "Nama"] },
  courses: { title: "Mata Kuliah", columns: ["No.", "Kode", "Nama", "SKS"] },
  time_slots: { title: "Slot Waktu", columns: ["No.", "Kode", "Hari", "Mulai", "Selesai"] },
  classes: { title: "Kelas", columns: ["No.", "Kode", "Nama"] },
};

function fmtTime(value) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function getModalRows(key, tree) {
  if (!tree) return [];
  switch (key) {
    case "rooms":
      return tree.rooms.map((r) => [r.code, r.building_name, r.room_type ?? "-"]);
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

export default function LecturerDatasetTabs({ datasetId, tree, activeTab, onTabChange }) {
  const bwm = useLecturerBwm(datasetId);

  const [activeModal, setActiveModal] = useState(null);
  const [modalPage, setModalPage] = useState(1);

  const quickStats = useMemo(() => {
    if (!tree) return [];
    return [
      { label: "Ruangan", value: tree.rooms.length, modal: "rooms" },
      { label: "Dosen", value: tree.lecturers.length, modal: "lecturers" },
      { label: "Mata Kuliah", value: tree.courses.length, modal: "courses" },
      { label: "Slot Waktu", value: tree.time_slots.length, modal: "time_slots" },
      { label: "Kelas", value: tree.classes.length, modal: "classes" },
    ];
  }, [tree]);

  const modalRows = useMemo(() => {
    if (!activeModal) return [];
    return getModalRows(activeModal, tree);
  }, [activeModal, tree]);

  const modalColumns = activeModal ? (MODAL_DEFS[activeModal]?.columns ?? []) : [];

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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-2 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </section>

      {activeTab === "bwm" && (
        <section className="rounded-xl border bg-card p-5 space-y-6">
          <BwmSolverTab
            bwmLoading={bwm.bwmLoading}
            bwmCriteria={bwm.bwmCriteria}
            bwmBestId={bwm.bwmBestId}
            bwmWorstId={bwm.bwmWorstId}
            onChangeBest={bwm.onChangeBest}
            onChangeWorst={bwm.onChangeWorst}
            bwmBestToOthers={bwm.bwmBestToOthers}
            bwmOthersToWorst={bwm.bwmOthersToWorst}
            updateBestToOthers={bwm.updateBestToOthers}
            updateOthersToWorst={bwm.updateOthersToWorst}
            bwmSolving={bwm.bwmSolving}
            solveBwm={bwm.solveBwm}
            bwmWeights={bwm.bwmWeights}
            bwmKsi={bwm.bwmKsi}
            bwmCr={bwm.bwmCr}
          />
        </section>
      )}

      {activeTab === "preferences" && (
        <LecturerPreferencesTab datasetId={datasetId} embedded />
      )}

      {activeTab === "result" && (
        <>
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

          <TimetableAnalyticsSection dataset={tree.dataset} tree={tree} />

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
                        <TableCell
                          colSpan={Math.max(1, modalColumns.length)}
                          className="text-center text-muted-foreground py-8"
                        >
                          Tidak ada data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedModalRows.map((cells, index) => (
                        <TableRow key={index}>
                          <TableCell>{getRowNumber(modalPage, PAGE_SIZE, index)}</TableCell>
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
      )}
    </div>
  );
}
