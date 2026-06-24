<?php

namespace App\Services\Bwm;

use App\Models\BwmBestToOther;
use App\Models\BwmOtherToWorst;
use App\Models\BwmResponse;
use App\Models\BwmWeight;
use App\Models\Lecturer;
use Illuminate\Support\Facades\DB;

class BwmResponsePersister
{
    /**
     * @param  list<int>  $criterionIds
     * @param  array<int, int>  $bestToOthers
     * @param  array<int, int>  $othersToWorst
     * @param  array<int, float>  $weights
     */
    public function upsert(
        int $datasetId,
        Lecturer $lecturer,
        int $createdBy,
        int $bestCriteriaId,
        int $worstCriteriaId,
        array $criterionIds,
        array $bestToOthers,
        array $othersToWorst,
        array $weights,
        float $ksi,
        ?float $consistencyRatio,
    ): BwmResponse {
        return DB::transaction(function () use (
            $datasetId,
            $lecturer,
            $createdBy,
            $bestCriteriaId,
            $worstCriteriaId,
            $criterionIds,
            $bestToOthers,
            $othersToWorst,
            $weights,
            $ksi,
            $consistencyRatio,
        ): BwmResponse {
            $response = BwmResponse::query()->updateOrCreate(
                [
                    'dataset_id' => $datasetId,
                    'lecturer_id' => $lecturer->id,
                ],
                [
                    'created_by' => $createdBy,
                    'best_criteria_id' => $bestCriteriaId,
                    'worst_criteria_id' => $worstCriteriaId,
                    'scale_max' => 9,
                    'ksi' => $ksi,
                    'consistency_ratio' => $consistencyRatio,
                ],
            );

            BwmBestToOther::query()->where('response_id', $response->id)->delete();
            BwmOtherToWorst::query()->where('response_id', $response->id)->delete();
            BwmWeight::query()->where('response_id', $response->id)->delete();

            $timestamp = now();

            foreach ($criterionIds as $criterionId) {
                BwmBestToOther::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'value' => $bestToOthers[$criterionId],
                    'created_by' => $createdBy,
                    'created_at' => $timestamp,
                ]);
                BwmOtherToWorst::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'value' => $othersToWorst[$criterionId],
                    'created_by' => $createdBy,
                    'created_at' => $timestamp,
                ]);
                BwmWeight::query()->create([
                    'response_id' => $response->id,
                    'criterion_id' => $criterionId,
                    'weight' => $weights[$criterionId] ?? 0.0,
                    'created_by' => $createdBy,
                    'created_at' => $timestamp,
                ]);
            }

            return $response;
        });
    }
}
