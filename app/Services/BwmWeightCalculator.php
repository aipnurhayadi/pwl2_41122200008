<?php

namespace App\Services;

class BwmWeightCalculator
{
    /**
     * @param  list<int>  $criterionIds
     * @param  array<int, int>  $bestToOthers
     * @param  array<int, int>  $othersToWorst
     * @return array{weights: array<int, float>, ksi: float, consistency_ratio: ?float}
     */
    public function calculate(
        array $criterionIds,
        int $bestCriteriaId,
        int $worstCriteriaId,
        array $bestToOthers,
        array $othersToWorst,
    ): array {
        $weights = [];
        $sum = 0.0;

        foreach ($criterionIds as $criterionId) {
            $bto = $this->clampScale($bestToOthers[$criterionId] ?? 1);
            $otw = $this->clampScale($othersToWorst[$criterionId] ?? 1);
            $weight = 1.0 / sqrt($bto * $otw);
            $weights[$criterionId] = $weight;
            $sum += $weight;
        }

        if ($sum > 0) {
            foreach ($weights as $criterionId => $weight) {
                $weights[$criterionId] = $weight / $sum;
            }
        }

        $bestWeight = $weights[$bestCriteriaId] ?? 0.0;
        $worstWeight = $weights[$worstCriteriaId] ?? 0.0;
        $ksi = 0.0;

        foreach ($criterionIds as $criterionId) {
            $bto = $this->clampScale($bestToOthers[$criterionId] ?? 1);
            $otw = $this->clampScale($othersToWorst[$criterionId] ?? 1);
            $weight = $weights[$criterionId] ?? 0.0;
            $ksi = max($ksi, abs($bestWeight / $bto - $weight));
            $ksi = max($ksi, abs($weight / $otw - $worstWeight));
        }

        $n = count($criterionIds);
        $ci = $this->consistencyIndex($n);
        $consistencyRatio = $ci > 0 ? $ksi / $ci : null;

        return [
            'weights' => $weights,
            'ksi' => $ksi,
            'consistency_ratio' => $consistencyRatio,
        ];
    }

    private function clampScale(int $value): int
    {
        return max(1, min(9, $value));
    }

    private function consistencyIndex(int $n): float
    {
        $table = [
            1 => 0.0,
            2 => 0.0,
            3 => 0.58,
            4 => 0.90,
            5 => 1.12,
            6 => 1.24,
            7 => 1.32,
            8 => 1.41,
            9 => 1.45,
            10 => 1.49,
        ];

        return $table[$n] ?? 1.49;
    }
}
