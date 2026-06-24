<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Course;
use App\Models\Dataset;
use App\Models\Lecturer;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LecturerAllowedCourseSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    public function run(Dataset $dataset, int $creatorId): void
    {
        $lecturers = Lecturer::query()->with('employee.user')->where('dataset_id', $dataset->id)->get();
        $courses = Course::query()->where('dataset_id', $dataset->id)->get()->all();
        $courseByCode = [];
        foreach ($courses as $course) {
            $courseByCode[$course->code] = $course;
        }

        $mappings = $this->readLecturerCoursesCsv();
        $allowedCoursesCount = 0;
        $skippedLecturers = 0;

        foreach ($lecturers as $lecturer) {
            $employee = $lecturer->employee;
            $nidn = $this->normalizeNidn($employee?->nidn);
            $entries = $mappings[$nidn] ?? [];

            if ($entries === []) {
                $skippedLecturers++;
                continue;
            }

            foreach ($entries as $entry) {
                $course = $courseByCode[$entry['code']] ?? null;
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

        echo "Inserted {$allowedCoursesCount} lecturer-course allowed relationships.\n";
        echo "Skipped {$skippedLecturers} lecturers without lecturer_courses.csv mappings.\n";
        echo "Lecturer allowed time slots were not seeded.\n";
    }
}
