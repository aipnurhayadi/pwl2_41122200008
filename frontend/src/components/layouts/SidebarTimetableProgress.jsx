import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimetableRun } from "@/context/TimetableRunContext";

export default function SidebarTimetableProgress() {
  const { activeRun, resolvePhaseLabel } = useTimetableRun();

  if (!activeRun || !["QUEUED", "RUNNING"].includes(activeRun.status)) {
    return null;
  }

  const progress = activeRun.progress_percent ?? 0;

  return (
    <div
      className={cn(
        "border-t border-sidebar-border p-2",
        "group-data-[collapsible=icon]:hidden",
      )}
    >
      <div className="space-y-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2.5">
        <div className="flex items-start gap-2">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">Generate Timetable</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {activeRun.datasetName || `Dataset #${activeRun.datasetId}`}
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

        <p className="text-[11px] text-muted-foreground">
          {resolvePhaseLabel(activeRun.phase)}
        </p>
      </div>
    </div>
  );
}
