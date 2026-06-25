<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Course;
use App\Models\Dataset;
use App\Models\Major;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Support\LecturerExpertiseCourseMatcher;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;

class CourseSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId, Major $major): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $lecturerRows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturers.csv');
        $courseRows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'courses.csv');
        $allowedCodes = array_fill_keys($matcher->unionCourseCodes(
            $matcher->buildNidnMappings($lecturerRows, $courseRows)
        ), true);
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'courses.csv');
        $inserted = 0;
        $skipped = 0;

        foreach ($rows as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            if (! isset($allowedCodes[$code])) {
                $skipped++;
                continue;
            }

            Course::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'name' => $name,
                'code' => $code,
                'major_id' => $major->id,
                'credits' => (int) ($row['credits'] ?: 0),
                'semester' => $this->toIntOrNull($row['semester'] ?? null),
                'curriculum_year' => $this->toIntOrNull($row['curriculum_year'] ?? null),
                'description' => trim((string) ($row['description'] ?? '')) !== '' ? trim((string) $row['description']) : null,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} courses from CSV (skipped {$skipped} without lecturer mapping).\n";
    }
}
