<?php

namespace App\Jobs;

use App\Models\TimetableRun;
use App\Services\Timetable\GoSolverRunner;
use App\Services\Timetable\TimetablePayloadBuilder;
use App\Services\Timetable\TimetableResultPersister;
use App\Services\Timetable\TimetableRunProgress;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RunTimetableJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 300;

    public function __construct(
        public int $runId,
    ) {}

    public function handle(
        TimetablePayloadBuilder $payloadBuilder,
        GoSolverRunner $solverRunner,
        TimetableResultPersister $persister,
    ): void {
        $run = TimetableRun::query()->find($this->runId);
        if (! $run) {
            return;
        }

        try {
            $run->update([
                'status' => TimetableRun::STATUS_RUNNING,
                'started_at' => $run->started_at ?? now(),
            ]);

            TimetableRunProgress::update($run, TimetableRun::PHASE_AGGREGATING_BWM, 15);
            $payload = $payloadBuilder->build((int) $run->dataset_id);

            TimetableRunProgress::update($run, TimetableRun::PHASE_BUILDING_PAYLOAD, 30);

            TimetableRunProgress::update($run, TimetableRun::PHASE_RUNNING_SOLVER, 50);
            $response = $solverRunner->run($payload, $this->runId);

            TimetableRunProgress::update($run, TimetableRun::PHASE_PERSISTING, 85);
            $persister->persist($run, $payload, $response);
        } catch (\Throwable $e) {
            Log::error('Timetable run failed', [
                'run_id' => $this->runId,
                'message' => $e->getMessage(),
            ]);

            $run->update([
                'status' => TimetableRun::STATUS_FAILED,
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);
        }
    }
}
