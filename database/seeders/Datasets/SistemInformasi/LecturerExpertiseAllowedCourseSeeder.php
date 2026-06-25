<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Course;
use App\Models\Dataset;
use App\Models\Lecturer;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Support\LecturerExpertiseCourseMatcher;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LecturerExpertiseAllowedCourseSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $lecturerRows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturers.csv');
        $courseRows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'courses.csv');
        $mappings = $matcher->buildNidnMappings($lecturerRows, $courseRows);

        $lecturers = Lecturer::query()->with('employee')->where('dataset_id', $dataset->id)->get();
        $courseByCode = Course::query()
            ->where('dataset_id', $dataset->id)
            ->get()
            ->keyBy('code');

        $allowedCoursesCount = 0;
        $skippedLecturers = 0;
        $lecturersWithMatches = 0;

        foreach ($lecturers as $lecturer) {
            $nidn = $this->normalizeNidn($lecturer->employee?->nidn);
            $entries = $mappings[$nidn] ?? [];

            if ($entries === []) {
                $skippedLecturers++;
                echo "Warning: no expertise-matched courses for lecturer nidn={$nidn}.\n";
                continue;
            }

            $lecturersWithMatches++;
            foreach ($entries as $entry) {
                $course = $courseByCode->get($entry['code']);
                if ($course === null) {
                    throw new \RuntimeException(
                        "Course code {$entry['code']} not found in dataset for lecturer nidn={$nidn}"
                    );
                }

                DB::table('lecturer_allowed_courses')->insert([
                    'lecturer_id' => $lecturer->id,
                    'course_id' => $course->id,
                    'created_by' => $creatorId,
                    'created_at' => now(),
                ]);
                $allowedCoursesCount++;
            }
        }

        $avg = $lecturersWithMatches > 0
            ? round($allowedCoursesCount / $lecturersWithMatches, 1)
            : 0.0;

        echo "Inserted {$allowedCoursesCount} lecturer-course allowed relationships from expertise matching.\n";
        echo "Average allowed courses per lecturer: {$avg}.\n";
        echo "Skipped {$skippedLecturers} lecturers without expertise matches.\n";
    }
}
