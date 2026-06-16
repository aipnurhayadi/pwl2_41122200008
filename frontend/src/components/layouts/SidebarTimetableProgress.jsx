import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_JOB = {
  datasetName: "Sistem Informasi Genap 2025",
  title: "Generate Timetable",
};

const PHASES = [
  "Memvalidasi data master...",
  "Menyelesaikan preferensi dosen...",
  "Menyusun kombinasi jadwal...",
  "Finalisasi hasil...",
];

function resolvePhase(progress) {
  if (progress < 28) return PHASES[0];
  if (progress < 58) return PHASES[1];
  if (progress < 88) return PHASES[2];
  return PHASES[3];
}

export default function SidebarTimetableProgress() {
  const [progress, setProgress] = useState(34);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((current) => {
        if (current >= 100) return 12;
        const step = Math.random() * 6 + 2;
        return Math.min(100, Math.round(current + step));
      });
    }, 1400);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={cn(
        "border-t border-sidebar-border p-2",
        "group-data-[collapsible=icon]:hidden"
      )}
    >
      <div className="space-y-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5">
        <div className="flex items-start gap-2">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{MOCK_JOB.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {MOCK_JOB.datasetName}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums">
            {progress}%
          </span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Progress generate timetable"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">{resolvePhase(progress)}</p>
      </div>
    </div>
  );
}
