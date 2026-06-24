<?php

namespace App\Services\Timetable;

use App\Models\Criterion;
use App\Models\TimetableAssignment;
use App\Models\TimetableAssignmentPenalty;
use App\Models\TimetableRun;
use App\Models\TimetableRunConstraintSummary;
use App\Models\TimetableRunLecturerSummary;
use App\Models\TimetableRunWeight;
use Illuminate\Support\Facades\DB;

class TimetableResultPersister
{
    public function __construct(
        private readonly TimetableFairnessAnalyzer $fairnessAnalyzer,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $solverResponse
     */
    public function persist(TimetableRun $run, array $payload, array $solverResponse): TimetableRun
    {
        return DB::transaction(function () use ($run, $payload, $solverResponse): TimetableRun {
            $timestamp = now();
            $weights = $payload['weights'] ?? [];
            $criterionIds = $payload['_criterion_ids'] ?? [];
            $criterionIdByCode = Criterion::query()
                ->where('type', Criterion::TYPE_SOFT)
                ->pluck('id', 'code')
                ->map(static fn ($id): int => (int) $id)
                ->all();

            TimetableRunWeight::query()->where('run_id', $run->id)->delete();
            foreach ($weights as $code => $weight) {
                $criterionId = $criterionIds[$code] ?? $criterionIdByCode[$code] ?? null;
                if ($criterionId === null) {
                    continue;
                }
                TimetableRunWeight::query()->create([
                    'run_id' => $run->id,
                    'criterion_id' => $criterionId,
                    'weight' => (float) $weight,
                    'created_at' => $timestamp,
                ]);
            }

            $assignments = $solverResponse['assignments'] ?? [];
            $penaltiesByLecturer = [];
            $directPenaltyByLecturer = [];
            $sessionCountByLecturer = [];
            $constraintStats = [];

            foreach ($criterionIdByCode as $code => $criterionId) {
                $constraintStats[$code] = [
                    'criterion_id' => $criterionId,
                    'satisfied_count' => 0,
                    'violated_count' => 0,
                    'total_penalty' => 0.0,
                ];
            }

            TimetableAssignment::query()->where('run_id', $run->id)->delete();

            foreach ($assignments as $assignment) {
                $lecturerId = (int) $assignment['lecturer_id'];
                $objectiveCost = (float) ($assignment['objective_cost'] ?? 0);
                $sessionCountByLecturer[$lecturerId] = ($sessionCountByLecturer[$lecturerId] ?? 0) + 1;
                $penaltiesByLecturer[$lecturerId] = ($penaltiesByLecturer[$lecturerId] ?? 0) + $objectiveCost;

                $row = TimetableAssignment::query()->create([
                    'run_id' => $run->id,
                    'request_index' => (int) $assignment['request_index'],
                    'lecturer_id' => $lecturerId,
                    'course_id' => (int) $assignment['course_id'],
                    'class_id' => (int) $assignment['class_id'],
                    'room_id' => (int) $assignment['room_id'],
                    'start_time_slot_id' => (int) $assignment['start_time_slot_id'],
                    'end_time_slot_id' => (int) $assignment['end_time_slot_id'],
                    'objective_cost' => $objectiveCost,
                    'created_at' => $timestamp,
                ]);

                $directPenalties = $assignment['direct_penalties'] ?? [];
                $directSum = 0.0;
                foreach ($directPenalties as $code => $penaltyValue) {
                    $penalty = (float) $penaltyValue;
                    TimetableAssignmentPenalty::query()->create([
                        'assignment_id' => $row->id,
                        'criterion_code' => (string) $code,
                        'penalty_value' => $penalty,
                        'created_at' => $timestamp,
                    ]);

                    if (! isset($constraintStats[$code])) {
                        continue;
                    }

                    if ($penalty > 0) {
                        $constraintStats[$code]['violated_count']++;
                        $constraintStats[$code]['total_penalty'] += $penalty;
                    } else {
                        $constraintStats[$code]['satisfied_count']++;
                    }

                    if ($code === 'SFT_001') {
                        $directSum += $penalty;
                    }
                }

                $directPenaltyByLecturer[$lecturerId] = ($directPenaltyByLecturer[$lecturerId] ?? 0) + $directSum;
            }

            TimetableRunConstraintSummary::query()->where('run_id', $run->id)->delete();
            foreach ($constraintStats as $stats) {
                TimetableRunConstraintSummary::query()->create([
                    'run_id' => $run->id,
                    'criterion_id' => $stats['criterion_id'],
                    'satisfied_count' => $stats['satisfied_count'],
                    'violated_count' => $stats['violated_count'],
                    'total_penalty' => $stats['total_penalty'],
                    'created_at' => $timestamp,
                ]);
            }

            $fairness = $this->fairnessAnalyzer->analyze($penaltiesByLecturer);

            TimetableRunLecturerSummary::query()->where('run_id', $run->id)->delete();
            foreach ($penaltiesByLecturer as $lecturerId => $totalPenalty) {
                TimetableRunLecturerSummary::query()->create([
                    'run_id' => $run->id,
                    'lecturer_id' => $lecturerId,
                    'session_count' => $sessionCountByLecturer[$lecturerId] ?? 0,
                    'total_penalty' => $totalPenalty,
                    'direct_penalty' => $directPenaltyByLecturer[$lecturerId] ?? 0.0,
                    'fairness_deviation' => $fairness['deviations'][$lecturerId] ?? 0.0,
                    'created_at' => $timestamp,
                ]);
            }

            $run->update([
                'status' => TimetableRun::STATUS_COMPLETED,
                'phase' => TimetableRun::PHASE_COMPLETED,
                'progress_percent' => 100,
                'objective_value' => (float) ($solverResponse['objective_value'] ?? 0),
                'solver_name' => (string) ($solverResponse['solver_status'] ?? 'CBC'),
                'fairness_index' => $fairness['fairness_index'],
                'finished_at' => now(),
                'error_message' => null,
            ]);

            return $run->fresh();
        });
    }
}
