import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export default function LecturerPreferenceBwmViewDialog({
  open,
  onOpenChange,
  datasetId,
  lecturer,
}) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [bwm, setBwm] = useState(null);

  const loadData = useCallback(async () => {
    if (!open || !datasetId || !lecturer?.id || !token) return;

    setLoading(true);
    try {
      const [prefRes, bwmRes] = await Promise.all([
        fetch(`/api/datasets/${datasetId}/lecturers/${lecturer.id}/preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/datasets/${datasetId}/lecturers/${lecturer.id}/bwm`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!prefRes.ok) {
        const body = await prefRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat preferensi dosen");
      }
      if (!bwmRes.ok) {
        const body = await bwmRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "Gagal memuat data BWM");
      }

      setPreferences(await prefRes.json());
      setBwm(await bwmRes.json());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [open, datasetId, lecturer?.id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const courseRankings = preferences?.course_rankings ?? [];
  const bwmWeights = bwm?.weights ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preferensi & BWM — {lecturer?.name ?? lecturer?.code}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Ranking Mata Kuliah</h3>
              {courseRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada preferensi mata kuliah.</p>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseRankings.map((row) => (
                        <TableRow key={`rank-${row.rank_order}`}>
                          <TableCell>{row.rank_order}</TableCell>
                          <TableCell className="font-mono">{row.course_code ?? "-"}</TableCell>
                          <TableCell>{row.course_name ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Kuesioner BWM</h3>
              {!bwm?.best_criteria_id ? (
                <p className="text-sm text-muted-foreground">Belum mengisi kuesioner BWM.</p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <p>
                      <span className="font-medium">Best:</span>{" "}
                      {bwm.best_criteria_name ?? bwm.best_criteria_id}
                    </p>
                    <p>
                      <span className="font-medium">Worst:</span>{" "}
                      {bwm.worst_criteria_name ?? bwm.worst_criteria_id}
                    </p>
                    <p>
                      <span className="font-medium">KSI:</span>{" "}
                      {bwm.ksi !== null ? Number(bwm.ksi).toFixed(6) : "-"}
                    </p>
                    <p>
                      <span className="font-medium">Consistency Ratio:</span>{" "}
                      {bwm.consistency_ratio !== null
                        ? Number(bwm.consistency_ratio).toFixed(6)
                        : "-"}
                    </p>
                  </div>
                  {bwmWeights.length > 0 && (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Criterion</TableHead>
                            <TableHead className="text-right w-[140px]">Weight</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bwmWeights.map((row) => (
                            <TableRow key={`w-${row.criterion_id}`}>
                              <TableCell>{row.criterion_name ?? row.criterion_id}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {Number(row.weight).toFixed(6)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tutup</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
