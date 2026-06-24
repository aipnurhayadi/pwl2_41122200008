<?php

namespace App\Services\Timetable;

class TimetableFairnessAnalyzer
{
    /**
     * @param  array<int, float>  $penaltiesByLecturer
     * @return array{fairness_index: float, deviations: array<int, float>}
     */
    public function analyze(array $penaltiesByLecturer): array
    {
        if ($penaltiesByLecturer === []) {
            return ['fairness_index' => 1.0, 'deviations' => []];
        }

        $values = array_values($penaltiesByLecturer);
        $mean = array_sum($values) / count($values);

        if ($mean <= 0) {
            $deviations = [];
            foreach ($penaltiesByLecturer as $lecturerId => $_) {
                $deviations[$lecturerId] = 0.0;
            }

            return ['fairness_index' => 1.0, 'deviations' => $deviations];
        }

        $variance = 0.0;
        foreach ($values as $value) {
            $variance += ($value - $mean) ** 2;
        }
        $stddev = sqrt($variance / count($values));
        $fairnessIndex = max(0.0, 1.0 - ($stddev / $mean));

        $deviations = [];
        foreach ($penaltiesByLecturer as $lecturerId => $penalty) {
            $deviations[$lecturerId] = abs($penalty - $mean);
        }

        return [
            'fairness_index' => $fairnessIndex,
            'deviations' => $deviations,
        ];
    }
}
