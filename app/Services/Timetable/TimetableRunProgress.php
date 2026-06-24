<?php

namespace App\Services\Timetable;

use App\Models\Criterion;
use App\Models\TimetableRun;

class TimetableRunProgress
{
    public static function update(TimetableRun $run, string $phase, int $progressPercent): void
    {
        $run->update([
            'phase' => $phase,
            'progress_percent' => max(0, min(100, $progressPercent)),
            'status' => $progressPercent >= 100 ? TimetableRun::STATUS_COMPLETED : TimetableRun::STATUS_RUNNING,
        ]);
    }
}
