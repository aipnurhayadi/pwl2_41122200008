<?php

namespace App\Http\Controllers\Api;

use App\Jobs\RunTimetableJob;
use App\Models\TimetableAssignment;
use App\Models\TimetableRun;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimetableRunController extends ApiController
{
    public function generate(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $active = TimetableRun::query()
            ->where('dataset_id', $datasetId)
            ->whereIn('status', [TimetableRun::STATUS_QUEUED, TimetableRun::STATUS_RUNNING])
            ->exists();

        if ($active) {
            return $this->conflict('A timetable run is already in progress for this dataset');
        }

        $run = TimetableRun::query()->create([
            'dataset_id' => $datasetId,
            'created_by' => $currentUser->id,
            'status' => TimetableRun::STATUS_QUEUED,
            'phase' => TimetableRun::PHASE_AGGREGATING_BWM,
            'progress_percent' => 5,
            'started_at' => now(),
        ]);

        RunTimetableJob::dispatch($run->id);

        return response()->json([
            'id' => $run->id,
            'dataset_id' => $run->dataset_id,
            'status' => $run->status,
            'phase' => $run->phase,
            'progress_percent' => $run->progress_percent,
            'dataset_name' => $dataset->name,
        ], 202);
    }

    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $runs = TimetableRun::query()
            ->where('dataset_id', $datasetId)
            ->orderByDesc('id')
            ->get()
            ->map(static fn (TimetableRun $run): array => [
                'id' => $run->id,
                'status' => $run->status,
                'phase' => $run->phase,
                'progress_percent' => $run->progress_percent,
                'objective_value' => $run->objective_value,
                'fairness_index' => $run->fairness_index,
                'created_at' => $run->created_at?->toIso8601String(),
                'finished_at' => $run->finished_at?->toIso8601String(),
            ]);

        return response()->json($runs);
    }

    public function show(int $datasetId, int $runId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $run = TimetableRun::query()
            ->with([
                'weights.criterion',
                'constraintSummaries.criterion',
                'lecturerSummaries',
                'assignments.penalties',
            ])
            ->where('dataset_id', $datasetId)
            ->where('id', $runId)
            ->first();

        if (! $run) {
            return $this->notFound('Timetable run not found');
        }

        return response()->json($this->buildRunDetail($run));
    }

    public function active(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $run = TimetableRun::query()
            ->where('dataset_id', $datasetId)
            ->whereIn('status', [TimetableRun::STATUS_QUEUED, TimetableRun::STATUS_RUNNING])
            ->orderByDesc('id')
            ->first();

        if (! $run) {
            return new JsonResponse(null);
        }

        return response()->json([
            'id' => $run->id,
            'dataset_id' => $run->dataset_id,
            'dataset_name' => $dataset->name,
            'status' => $run->status,
            'phase' => $run->phase,
            'progress_percent' => $run->progress_percent,
        ]);
    }

    public function activeGlobal(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $currentUser->loadMissing('employeeProfile');

        $accessibleDatasetIds = $this->accessibleDatasetsQuery($currentUser)->select('id');

        $run = TimetableRun::query()
            ->with('dataset')
            ->whereIn('status', [TimetableRun::STATUS_QUEUED, TimetableRun::STATUS_RUNNING])
            ->whereIn('dataset_id', $accessibleDatasetIds)
            ->orderByDesc('id')
            ->first();

        if (! $run) {
            return new JsonResponse(null);
        }

        return response()->json([
            'id' => $run->id,
            'dataset_id' => $run->dataset_id,
            'dataset_name' => $run->dataset?->name,
            'status' => $run->status,
            'phase' => $run->phase,
            'progress_percent' => $run->progress_percent,
        ]);
    }

    private function buildRunDetail(TimetableRun $run): array
    {
        $weights = $run->weights
            ->sortBy(static fn ($row) => $row->criterion?->code ?? '')
            ->map(static fn ($row): array => [
                'criterion_id' => $row->criterion_id,
                'weight' => $row->weight,
            ])
            ->values()
            ->all();

        $constraintSummaries = $run->constraintSummaries
            ->sortBy(static fn ($row) => $row->criterion?->code ?? '')
            ->map(static fn ($row): array => [
                'criterion_id' => $row->criterion_id,
                'satisfied_count' => $row->satisfied_count,
                'violated_count' => $row->violated_count,
                'total_penalty' => $row->total_penalty,
            ])
            ->values()
            ->all();

        $lecturerSummaries = $run->lecturerSummaries
            ->sortBy('lecturer_id')
            ->map(static fn ($row): array => [
                'lecturer_id' => $row->lecturer_id,
                'session_count' => $row->session_count,
                'total_penalty' => $row->total_penalty,
                'direct_penalty' => $row->direct_penalty,
                'fairness_deviation' => $row->fairness_deviation,
            ])
            ->values()
            ->all();

        $assignments = $run->assignments
            ->sortBy('request_index')
            ->map(static fn (TimetableAssignment $assignment): array => [
                'id' => $assignment->id,
                'request_index' => $assignment->request_index,
                'lecturer_id' => $assignment->lecturer_id,
                'course_id' => $assignment->course_id,
                'class_id' => $assignment->class_id,
                'room_id' => $assignment->room_id,
                'start_time_slot_id' => $assignment->start_time_slot_id,
                'end_time_slot_id' => $assignment->end_time_slot_id,
                'objective_cost' => $assignment->objective_cost,
                'penalties' => $assignment->penalties
                    ->map(static fn ($penalty): array => [
                        'criterion_code' => $penalty->criterion_code,
                        'penalty_value' => $penalty->penalty_value,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        return [
            'id' => $run->id,
            'status' => $run->status,
            'phase' => $run->phase,
            'progress_percent' => $run->progress_percent,
            'created_at' => $run->created_at?->toIso8601String(),
            'finished_at' => $run->finished_at?->toIso8601String(),
            'objective_value' => $run->objective_value,
            'solver_name' => $run->solver_name,
            'fairness_index' => $run->fairness_index,
            'error_message' => $run->error_message,
            'weights' => $weights,
            'constraint_summaries' => $constraintSummaries,
            'lecturer_summaries' => $lecturerSummaries,
            'assignments' => $assignments,
        ];
    }
}
