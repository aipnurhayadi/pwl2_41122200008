<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\ClassModel;
use App\Models\Dataset;
use App\Models\Major;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;

class ClassSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId, Major $major): void
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'classes.csv');
        $inserted = 0;

        foreach ($rows as $index => $row) {
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            ClassModel::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'name' => $name,
                'code' => sprintf('KLS%03d', $index + 1),
                'major_id' => $major->id,
                'academic_year' => $this->toIntOrNull($row['academic_year'] ?? null),
                'semester' => $this->toIntOrNull($row['semester'] ?? null),
                'study_program' => trim((string) ($row['study_program'] ?? '')) !== '' ? trim((string) $row['study_program']) : SeederDefaults::DEFAULT_MAJOR_NAME,
                'capacity' => $this->toIntOrNull($row['capacity'] ?? null),
                'description' => trim((string) ($row['description'] ?? '')) !== '' ? trim((string) $row['description']) : null,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} classes from CSV.\n";
    }
}
