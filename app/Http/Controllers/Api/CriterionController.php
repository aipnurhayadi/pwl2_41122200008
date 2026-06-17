<?php

namespace App\Http\Controllers\Api;

use App\Models\Criterion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CriterionController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var \App\Models\User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $criteria = Criterion::query()
            ->where('type', Criterion::TYPE_SOFT)
            ->orderBy('code')
            ->get()
            ->map(static fn (Criterion $criterion): array => [
                'id' => $criterion->id,
                'code' => $criterion->code,
                'name' => $criterion->name,
                'description' => $criterion->description,
                'type' => $criterion->type,
                'is_lecturer_preference' => $criterion->is_lecturer_preference,
            ]);

        return response()->json($criteria);
    }
}
