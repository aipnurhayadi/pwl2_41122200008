<?php

namespace App\Services\Bwm;

class BwmMatrixSampler
{
    /**
     * @param  list<int>  $criterionIds  ordered by code
     * @return array{
     *     best_criteria_id: int,
     *     worst_criteria_id: int,
     *     best_to_others: array<int, int>,
     *     others_to_worst: array<int, int>
     * }
     */
    public function sampleForLecturerIndex(array $criterionIds, int $lecturerIndex): array
    {
        $count = count($criterionIds);
        if ($count < 2) {
            throw new \InvalidArgumentException('At least two soft criteria are required for BWM sampling');
        }

        $bestIndex = $lecturerIndex % ($count - 1);
        $worstIndex = $count - 1 - ($lecturerIndex % 2);
        if ($worstIndex === $bestIndex) {
            $worstIndex = $count - 1;
            if ($worstIndex === $bestIndex) {
                $worstIndex = $count - 2;
            }
        }

        $bestId = $criterionIds[$bestIndex];
        $worstId = $criterionIds[$worstIndex];

        return array_merge(
            [
                'best_criteria_id' => $bestId,
                'worst_criteria_id' => $worstId,
            ],
            $this->sample($criterionIds, $bestId, $worstId),
        );
    }

    /**
     * @param  list<int>  $criterionIds
     * @return array{best_to_others: array<int, int>, others_to_worst: array<int, int>}
     */
    public function sample(array $criterionIds, int $bestCriteriaId, int $worstCriteriaId): array
    {
        if ($bestCriteriaId === $worstCriteriaId) {
            throw new \InvalidArgumentException('best and worst criteria must be different');
        }

        $orderedIds = $this->orderFromBestToWorst($criterionIds, $bestCriteriaId, $worstCriteriaId);
        $count = count($orderedIds);

        $bestToOthers = [];
        $othersToWorst = [];

        foreach ($orderedIds as $position => $criterionId) {
            $bestToOthers[$criterionId] = $this->scaleValue($position, $count);
            $othersToWorst[$criterionId] = $this->scaleValue($count - 1 - $position, $count);
        }

        return [
            'best_to_others' => $bestToOthers,
            'others_to_worst' => $othersToWorst,
        ];
    }

    /**
     * @param  list<int>  $criterionIds
     * @return list<int>
     */
    private function orderFromBestToWorst(array $criterionIds, int $bestCriteriaId, int $worstCriteriaId): array
    {
        $middle = array_values(array_filter(
            $criterionIds,
            static fn (int $id): bool => $id !== $bestCriteriaId && $id !== $worstCriteriaId,
        ));

        return array_merge([$bestCriteriaId], $middle, [$worstCriteriaId]);
    }

    private function scaleValue(int $position, int $count): int
    {
        if ($count <= 3) {
            return 1;
        }

        $groupSize = max(1, $count - 2);

        return min(9, 1 + intdiv($position, $groupSize));
    }
}
