<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Criterion;
use App\Models\Dataset;
use App\Models\Lecturer;
use App\Services\Bwm\BwmMatrixSampler;
use App\Services\Bwm\BwmResponsePersister;
use App\Services\Bwm\BwmValidator;
use Illuminate\Database\Seeder;

class BwmResponseSeeder extends Seeder
{
    public function run(
        Dataset $dataset,
        int $createdBy,
        BwmMatrixSampler $sampler,
        BwmValidator $validator,
        BwmResponsePersister $persister,
    ): int {
        $criterionIds = Criterion::query()
            ->where('type', Criterion::TYPE_SOFT)
            ->orderBy('code')
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        if (count($criterionIds) < 2) {
            return 0;
        }

        $lecturers = Lecturer::query()
            ->where('dataset_id', $dataset->id)
            ->orderBy('id')
            ->get();

        $seeded = 0;

        foreach ($lecturers as $index => $lecturer) {
            $sample = $sampler->sampleForLecturerIndex($criterionIds, $index);
            $bestId = $sample['best_criteria_id'];
            $worstId = $sample['worst_criteria_id'];
            $bestToOthers = $sample['best_to_others'];
            $othersToWorst = $sample['others_to_worst'];

            $validation = $validator->validate(
                $criterionIds,
                $bestId,
                $worstId,
                $bestToOthers,
                $othersToWorst,
            );

            if (! $validation->isValid()) {
                throw new \RuntimeException(sprintf(
                    'Invalid seeded BWM for lecturer id=%d: %s',
                    $lecturer->id,
                    $validation->firstError() ?? 'unknown error',
                ));
            }

            $persister->upsert(
                datasetId: (int) $dataset->id,
                lecturer: $lecturer,
                createdBy: $createdBy,
                bestCriteriaId: $bestId,
                worstCriteriaId: $worstId,
                criterionIds: $criterionIds,
                bestToOthers: $bestToOthers,
                othersToWorst: $othersToWorst,
                weights: $validation->weights() ?? [],
                ksi: $validation->ksi() ?? 0.0,
                consistencyRatio: $validation->consistencyRatio(),
            );

            $seeded++;
        }

        echo "Seeded {$seeded} BWM responses for dataset id={$dataset->id}.\n";

        return $seeded;
    }
}
