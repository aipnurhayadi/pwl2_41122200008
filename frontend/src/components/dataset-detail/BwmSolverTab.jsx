import { useMemo } from "react";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const BWM_SCALE_LABELS = {
  1: "sama penting dengan",
  2: "di antara sama penting dan cukup lebih penting dari",
  3: "cukup lebih penting dari",
  4: "di antara cukup dan kuat lebih penting dari",
  5: "kuat lebih penting dari",
  6: "di antara kuat dan sangat kuat lebih penting dari",
  7: "sangat kuat lebih penting dari",
  8: "di antara sangat kuat dan mutlak lebih penting dari",
  9: "mutlak lebih penting dari",
};

function formatCriterionLabel(criterion) {
  if (!criterion) return "-";
  return criterion.name;
}

export default function BwmSolverTab({
  bwmLoading,
  bwmCriteria,
  bwmBestId,
  bwmWorstId,
  onChangeBest,
  onChangeWorst,
  bwmBestToOthers,
  bwmOthersToWorst,
  updateBestToOthers,
  updateOthersToWorst,
  bwmSolving,
  solveBwm,
  bwmWeights,
  bwmKsi,
  bwmCr,
}) {
  const criteriaById = useMemo(() => {
    return new Map(bwmCriteria.map((c) => [c.id, c]));
  }, [bwmCriteria]);

  const selectedBestName = bwmBestId
    ? formatCriterionLabel(criteriaById.get(bwmBestId))
    : "-";
  const selectedWorstName = bwmWorstId
    ? formatCriterionLabel(criteriaById.get(bwmWorstId))
    : "-";

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          BWM Solver
        </p>
        <h2 className="text-lg font-semibold mt-1">Preferensi Soft Constraints</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pilih best-worst criterion, isi nilai 1-9 untuk dua vektor BWM, lalu
          jalankan solver.
        </p>
      </div>

      {bwmLoading && (
        <p className="text-sm text-muted-foreground">Memuat konfigurasi BWM...</p>
      )}

      {!bwmLoading && bwmCriteria.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Belum ada soft criteria untuk BWM.
        </p>
      )}

      {!bwmLoading && bwmCriteria.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Pilih best criterion</span>
              <Select value={String(bwmBestId ?? "")} onValueChange={onChangeBest}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih best criteria">
                    {(value) => {
                      const criterion = bwmCriteria.find(
                        (c) => String(c.id) === value,
                      );
                      return criterion ? formatCriterionLabel(criterion) : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {bwmCriteria.map((c) => (
                    <SelectItem key={`best-${c.id}`} value={String(c.id)}>
                      {formatCriterionLabel(c)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Pilih worst criterion</span>
              <Select value={String(bwmWorstId ?? "")} onValueChange={onChangeWorst}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih worst criteria">
                    {(value) => {
                      const criterion = bwmCriteria.find(
                        (c) => String(c.id) === value,
                      );
                      return criterion ? formatCriterionLabel(criterion) : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {bwmCriteria.map((c) => (
                    <SelectItem key={`worst-${c.id}`} value={String(c.id)}>
                      {formatCriterionLabel(c)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </label>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Best to Others</p>
            <p className="text-xs text-muted-foreground">
              Seberapa jauh <strong>best criterion</strong> lebih penting dibanding
              setiap criterion lainnya? Isi nilai <strong>1</strong> (sama penting)
              hingga <strong>9</strong> (jauh lebih penting). Nilai untuk best
              criterion itu sendiri otomatis diisi 1.
            </p>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Subjek</TableHead>
                  <TableHead className="w-[40%]">Relasi</TableHead>
                  <TableHead>Objek</TableHead>
                  <TableHead className="w-[140px]">Nilai (1-9)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bwmCriteria.map((c) => (
                  <TableRow key={`bto-${c.id}`}>
                    <TableCell className="font-medium">{selectedBestName}</TableCell>
                    <TableCell className="w-[40%] text-xs text-muted-foreground whitespace-normal break-words">
                      {
                        BWM_SCALE_LABELS[
                          Math.max(
                            1,
                            Math.min(9, Number(bwmBestToOthers[c.id] ?? 1)),
                          )
                        ]
                      }
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCriterionLabel(c)}
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={bwmBestToOthers[c.id] ?? 1}
                        disabled={bwmBestId === c.id}
                        onChange={(e) => updateBestToOthers(c.id, e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Others to Worst</p>
            <p className="text-xs text-muted-foreground">
              Seberapa jauh setiap criterion lebih penting dibanding
              <strong> worst criterion</strong>? Isi nilai <strong>1</strong>
              (sama penting) hingga <strong>9</strong> (jauh lebih penting).
              Nilai untuk worst criterion itu sendiri otomatis diisi 1.
            </p>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Subjek</TableHead>
                  <TableHead className="w-[40%]">Relasi</TableHead>
                  <TableHead>Objek</TableHead>
                  <TableHead className="w-[140px]">Nilai (1-9)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bwmCriteria.map((c) => (
                  <TableRow key={`otw-${c.id}`}>
                    <TableCell className="font-medium">
                      {formatCriterionLabel(c)}
                    </TableCell>
                    <TableCell className="w-[40%] text-xs text-muted-foreground whitespace-normal break-words">
                      {
                        BWM_SCALE_LABELS[
                          Math.max(
                            1,
                            Math.min(9, Number(bwmOthersToWorst[c.id] ?? 1)),
                          )
                        ]
                      }
                    </TableCell>
                    <TableCell className="font-medium">{selectedWorstName}</TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={bwmOthersToWorst[c.id] ?? 1}
                        disabled={bwmWorstId === c.id}
                        onChange={(e) => updateOthersToWorst(c.id, e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={bwmSolving}
              onClick={solveBwm}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {bwmSolving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>

          {(bwmWeights.length > 0 || bwmKsi !== null || bwmCr !== null) && (
            <div>
              <Separator className="my-4" />
              <div className="space-y-1 mb-3">
                <p className="text-sm font-semibold">Hasil Solver BWM</p>
                <p className="text-xs text-muted-foreground">
                  Bagian ini menampilkan hasil akhir perhitungan BWM untuk
                  preferensi Anda.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 mb-3">
                <p className="text-sm">
                  <span className="font-medium">KSI:</span>{" "}
                  {bwmKsi !== null ? Number(bwmKsi).toFixed(6) : "-"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Consistency Ratio:</span>{" "}
                  {bwmCr !== null ? Number(bwmCr).toFixed(6) : "-"}
                </p>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead className="w-[140px] text-right">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bwmWeights.map((w) => (
                      <TableRow key={`w-${w.criterion_id}`}>
                        <TableCell className="font-medium">
                          {formatCriterionLabel(criteriaById.get(w.criterion_id))}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Number(w.weight).toFixed(6)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
