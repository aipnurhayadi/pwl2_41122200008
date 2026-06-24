<?php

namespace App\Services\Timetable;

use App\Models\BwmResponse;
use App\Models\Criterion;
use App\Models\Lecturer;
use Illuminate\Support\Facades\DB;

class BwmWeightAggregator
{
    /** @var list<string> */
    private const SOFT_CODES = ['SFT_001', 'SFT_002', 'SFT_003', 'SFT_004', 'SFT_005'];

    /**
     * @return array{weights: array<string, float>, criterion_ids: array<string, int>}
     */
    public function aggregateForDataset(int $datasetId): array
    {
        $this->assertAllLecturersHaveBwm($datasetId);

        $rows = DB::table('bwm_weights as bw')
            ->join('bwm_responses as br', 'br.id', '=', 'bw.response_id')
            ->join('criteria as c', 'c.id', '=', 'bw.criterion_id')
            ->where('br.dataset_id', $datasetId)
            ->where('c.type', Criterion::TYPE_SOFT)
            ->groupBy('c.id', 'c.code')
            ->orderBy('c.code')
            ->selectRaw('c.id as criterion_id, c.code as criterion_code, AVG(bw.weight) as avg_weight')
            ->get();

        $raw = [];
        $criterionIds = [];
        foreach ($rows as $row) {
            $raw[(string) $row->criterion_code] = (float) $row->avg_weight;
            $criterionIds[(string) $row->criterion_code] = (int) $row->criterion_id;
        }

        foreach (self::SOFT_CODES as $code) {
            if (! array_key_exists($code, $raw)) {
                $raw[$code] = 0.0;
            }
        }

        return [
            'weights' => $this->normalize($raw),
            'criterion_ids' => $criterionIds,
        ];
    }

    private function assertAllLecturersHaveBwm(int $datasetId): void
    {
        $lecturerIds = Lecturer::query()
            ->where('dataset_id', $datasetId)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        if ($lecturerIds === []) {
            throw new \RuntimeException('Dataset has no lecturers');
        }

        $responseCount = BwmResponse::query()
            ->where('dataset_id', $datasetId)
            ->whereIn('lecturer_id', $lecturerIds)
            ->count();

        if ($responseCount < count($lecturerIds)) {
            $missing = count($lecturerIds) - $responseCount;
            throw new \RuntimeException("{$missing} lecturer(s) have not completed BWM questionnaire");
        }
    }

    /**
     * @param  array<string, float>  $raw
     * @return array<string, float>
     */
    private function normalize(array $raw): array
    {
        $out = [];
        $total = 0.0;

        foreach (self::SOFT_CODES as $code) {
            $value = max(0.0, $raw[$code] ?? 0.0);
            $out[$code] = $value;
            $total += $value;
        }

        if ($total <= 0) {
            $equal = 1.0 / count(self::SOFT_CODES);
            foreach (self::SOFT_CODES as $code) {
                $out[$code] = $equal;
            }

            return $out;
        }

        foreach (self::SOFT_CODES as $code) {
            $out[$code] /= $total;
        }

        return $out;
    }
}
