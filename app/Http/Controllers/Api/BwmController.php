<?php

namespace App\Http\Controllers\Api;

use App\Models\BwmBestToOther;
use App\Models\BwmOtherToWorst;
use App\Models\BwmResponse;
use App\Models\BwmWeight;
use App\Models\Criterion;
use App\Models\Lecturer;
use App\Models\User;
use App\Services\BwmWeightCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BwmController extends ApiController
{
    public function myShow(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerForUser($datasetId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        return response()->json($this->buildBwmPayload($datasetId, $lecturer));
    }

    public function myUpdate(int $datasetId, Request $request, BwmWeightCalculator $calculator): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerForUser($datasetId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $bestId = (int) $request->input('best_criteria_id', 0);
        $worstId = (int) $request->input('worst_criteria_id', 0);
        $bestToOthers = $this->normalizeMatrix($request->input('best_to_others', []));
        $othersToWorst = $this->normalizeMatrix($request->input('others_to_worst', []));

        $validationError = $this->validateBwmPayload($datasetId, $bestId, $worstId, $bestToOthers, $othersToWorst);
        if ($validationError !== null) {
            return $this->unprocessable($validationError);
        }

        $criterionIds = Criterion::query()
            ->where('type', Criterion::TYPE_SOFT)
            ->orderBy('code')
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $result = $calculator->calculate(
            $criterionIds,
            $bestId,
            $worstId,
            $bestToOthers,
            $othersToWorst,
        );

        DB::transaction(function () use (
            $datasetId,
            $lecturer,
            $currentUser,
            $bestId,
            $worstId,
            $bestToOthers,
            $othersToWorst,
            $result,
            $criterionIds,
        ): void {
            $response = BwmResponse::query()->updateOrCreate(
                [
                    'dataset_id' => $datasetId,
                    'lecturer_id' => $lecturer->id,
                ],
                [
                    'created_by' => $currentUser->id,
                    'best_criteria_id' => $bestId,
                    'worst_criteria_id' => $worstId,
                    'scale_max' => 9,
                    'ksi' => $result['ksi'],
                    'consistency_ratio' => $result['consistency_ratio'],
                ],
            );

            BwmBestToOther::query()->where('response_id', $response->id)->delete();
            BwmOtherToWorst::query()->where('response_id', $response->id)->delete();
            BwmWeight::query()->where('response_id', $response->id)->delete();

            foreach ($criterionIds as $criterionId) {
                BwmBestToOther::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'value' => $bestToOthers[$criterionId],
                    'created_by' => $currentUser->id,
                    'created_at' => now(),
                ]);
                BwmOtherToWorst::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'value' => $othersToWorst[$criterionId],
                    'created_by' => $currentUser->id,
                    'created_at' => now(),
                ]);
                BwmWeight::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'weight' => $result['weights'][$criterionId] ?? 0.0,
                    'created_by' => $currentUser->id,
                    'created_at' => now(),
                ]);
            }
        });

        return response()->json($this->buildBwmPayload($datasetId, $lecturer));
    }

    public function showForLecturer(int $datasetId, int $lecturerId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $lecturer = $this->findLecturerInDataset($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        return response()->json($this->buildBwmPayload($datasetId, $lecturer));
    }

    private function buildBwmPayload(int $datasetId, Lecturer $lecturer): array
    {
        $response = BwmResponse::query()
            ->with([
                'bestToOthers',
                'othersToWorst',
                'weights.criterion',
                'bestCriterion',
                'worstCriterion',
            ])
            ->where('dataset_id', $datasetId)
            ->where('lecturer_id', $lecturer->id)
            ->first();

        if (! $response) {
            return [
                'best_criteria_id' => null,
                'worst_criteria_id' => null,
                'best_to_others' => [],
                'others_to_worst' => [],
                'weights' => [],
                'ksi' => null,
                'consistency_ratio' => null,
            ];
        }

        $bestToOthers = [];
        foreach ($response->bestToOthers as $row) {
            $bestToOthers[$row->criterion_id] = $row->value;
        }

        $othersToWorst = [];
        foreach ($response->othersToWorst as $row) {
            $othersToWorst[$row->criterion_id] = $row->value;
        }

        $weights = $response->weights
            ->sortBy(static fn (BwmWeight $weight) => $weight->criterion?->code ?? '')
            ->map(static fn (BwmWeight $weight): array => [
                'criterion_id' => $weight->criterion_id,
                'criterion_code' => $weight->criterion?->code,
                'criterion_name' => $weight->criterion?->name,
                'weight' => $weight->weight,
            ])
            ->values()
            ->all();

        return [
            'best_criteria_id' => $response->best_criteria_id,
            'worst_criteria_id' => $response->worst_criteria_id,
            'best_criteria_name' => $response->bestCriterion?->name,
            'worst_criteria_name' => $response->worstCriterion?->name,
            'best_to_others' => $bestToOthers,
            'others_to_worst' => $othersToWorst,
            'weights' => $weights,
            'ksi' => $response->ksi,
            'consistency_ratio' => $response->consistency_ratio,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function normalizeMatrix(mixed $input): array
    {
        if (! is_array($input)) {
            return [];
        }

        $matrix = [];
        foreach ($input as $key => $value) {
            $matrix[(int) $key] = (int) $value;
        }

        return $matrix;
    }

    /**
     * @param  array<int, int>  $bestToOthers
     * @param  array<int, int>  $othersToWorst
     */
    private function validateBwmPayload(
        int $datasetId,
        int $bestId,
        int $worstId,
        array $bestToOthers,
        array $othersToWorst,
    ): ?string {
        if ($bestId <= 0 || $worstId <= 0) {
            return 'best_criteria_id and worst_criteria_id are required';
        }

        if ($bestId === $worstId) {
            return 'best and worst criteria must be different';
        }

        $criterionIds = Criterion::query()
            ->where('type', Criterion::TYPE_SOFT)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        if ($criterionIds === []) {
            return 'No soft criteria configured';
        }

        $validIds = array_flip($criterionIds);
        if (! isset($validIds[$bestId]) || ! isset($validIds[$worstId])) {
            return 'best or worst criterion is invalid';
        }

        foreach ($criterionIds as $criterionId) {
            if (! array_key_exists($criterionId, $bestToOthers) || ! array_key_exists($criterionId, $othersToWorst)) {
                return 'best_to_others and others_to_worst must include all soft criteria';
            }

            $bto = $bestToOthers[$criterionId];
            $otw = $othersToWorst[$criterionId];
            if ($bto < 1 || $bto > 9 || $otw < 1 || $otw > 9) {
                return 'BWM values must be between 1 and 9';
            }
        }

        return null;
    }
}
