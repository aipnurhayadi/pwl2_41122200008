<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Dataset;
use App\Models\Lecturer;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Concerns\InteractsWithEmployees;
use Illuminate\Database\Seeder;

class LecturerSeeder extends Seeder
{
    use InteractsWithDatasetCsv;
    use InteractsWithEmployees;

    public function run(Dataset $dataset, int $creatorId): void
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturers.csv');
        $inserted = 0;

        foreach ($rows as $index => $row) {
            if (strtolower(trim((string) ($row['name'] ?? ''))) === 'name') {
                continue;
            }

            $employee = $this->ensureEmployeeAndUser($row, $creatorId);
            $code = sprintf('%s-L%03d', $dataset->code, $index + 1);

            Lecturer::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'employee_id' => $employee->id,
                'code' => $code,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} lecturer assignments from CSV.\n";
    }
}
