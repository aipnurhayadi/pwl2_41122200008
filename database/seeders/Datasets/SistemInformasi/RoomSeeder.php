<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Dataset;
use App\Models\Room;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId): void
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'rooms.csv');
        $inserted = 0;

        foreach ($rows as $row) {
            $buildingName = trim((string) ($row['building_name'] ?? ''));
            $buildingCode = trim((string) ($row['building_code'] ?? ''));
            $floor = $this->toIntOrNull($row['floor'] ?? null);
            $roomNumber = $this->toIntOrNull($row['room_number'] ?? null);
            $code = trim((string) ($row['code'] ?? ''));

            if ($buildingName === '' || $buildingCode === '' || $floor === null || $roomNumber === null || $code === '') {
                continue;
            }

            $roomType = strtoupper(trim((string) ($row['room_type'] ?? '')));
            if (! in_array($roomType, ['TEORI', 'LABORATORIUM', 'AULA', 'SEMINAR'], true)) {
                $roomType = null;
            }

            Room::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'building_name' => $buildingName,
                'building_code' => $buildingCode,
                'floor' => $floor,
                'room_number' => $roomNumber,
                'code' => $code,
                'capacity' => SeederDefaults::DEFAULT_ROOM_CAPACITY,
                'room_type' => $roomType,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} rooms from CSV.\n";
    }
}
