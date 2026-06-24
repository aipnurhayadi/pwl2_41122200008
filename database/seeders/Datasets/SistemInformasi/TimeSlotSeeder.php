<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Dataset;
use App\Models\TimeSlot;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;

class TimeSlotSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId): void
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'timeslots.csv');
        if ($rows === []) {
            return;
        }

        $config = $rows[0];
        $minutes = (int) ($config['per_sks_minutes'] ?: 40);
        $startTime = $config['start_time'] ?: '07:00';
        $endTime = $config['end_time'] ?: '23:00';
        $blocks = $this->buildSlotsFromRange($startTime, $endTime, $minutes);

        $sequence = 1;
        foreach (SeederDefaults::DAYS as $day) {
            foreach ($blocks as [$slotStart, $slotEnd]) {
                TimeSlot::query()->create([
                    'dataset_id' => $dataset->id,
                    'created_by' => $creatorId,
                    'code' => sprintf('TS%03d', $sequence),
                    'day' => $day,
                    'start_time' => $slotStart,
                    'end_time' => $slotEnd,
                ]);
                $sequence++;
            }
        }

        $inserted = count($blocks) * count(SeederDefaults::DAYS);
        echo "Inserted {$inserted} time slots from CSV config.\n";
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    private function buildSlotsFromRange(string $startTime, string $endTime, int $minutes): array
    {
        $slots = [];
        $start = \DateTimeImmutable::createFromFormat('H:i', $startTime);
        $end = \DateTimeImmutable::createFromFormat('H:i', $endTime);
        $breakStart = \DateTimeImmutable::createFromFormat('H:i', SeederDefaults::BREAK_START);
        $breakEnd = \DateTimeImmutable::createFromFormat('H:i', SeederDefaults::BREAK_END);

        if (! $start || ! $end || ! $breakStart || ! $breakEnd) {
            throw new \RuntimeException('Invalid timeslot configuration');
        }

        $cursor = $start;
        $delta = new \DateInterval('PT'.$minutes.'M');

        while ($cursor < $end) {
            $slotStart = $cursor->format('H:i');
            if ($cursor >= $breakStart && $cursor < $breakEnd) {
                $cursor = $breakEnd;
                continue;
            }

            $slotEndCursor = $cursor->add($delta);
            $slots[] = [$slotStart, $slotEndCursor->format('H:i')];
            $cursor = $slotEndCursor;
        }

        return $slots;
    }
}
