<?php

namespace App\Http\Controllers\Api;

use App\Models\BwmResponse;
use App\Models\BwmWeight;
use App\Models\Criterion;
use App\Models\Lecturer;
use App\Models\User;
use App\Services\Bwm\BwmResponsePersister;
use App\Services\Bwm\BwmValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function myUpdate(
        int $datasetId,
        Request $request,
        BwmValidator $validator,
        BwmResponsePersister $persister,
    ): JsonResponse {
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

        $criterionIds = $this->softCriterionIds();
        $validation = $validator->validate($criterionIds, $bestId, $worstId, $bestToOthers, $othersToWorst);

        if (! $validation->isValid()) {
            return $this->unprocessableWithMeta(
                $validation->firstError() ?? 'Invalid BWM payload',
                ['suggestions' => $validation->suggestions()],
            );
        }

        $persister->upsert(
            datasetId: $datasetId,
            lecturer: $lecturer,
            createdBy: $currentUser->id,
            bestCriteriaId: $bestId,
            worstCriteriaId: $worstId,
            criterionIds: $criterionIds,
            bestToOthers: $bestToOthers,
            othersToWorst: $othersToWorst,
            weights: $validation->weights() ?? [],
            ksi: $validation->ksi() ?? 0.0,
            consistencyRatio: $validation->consistencyRatio(),
        );

        $payload = $this->buildBwmPayload($datasetId, $lecturer);
        $payload['warnings'] = $validation->warnings();
        $payload['suggestions'] = $validation->suggestions();

        return response()->json($payload);
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
     * @return list<int>
     */
    private function softCriterionIds(): array
    {
        return Criterion::query()
            ->where('type', Criterion::TYPE_SOFT)
            ->orderBy('code')
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
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
}
