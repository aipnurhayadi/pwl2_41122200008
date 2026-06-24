<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Course;
use App\Models\Dataset;
use App\Models\Lecturer;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LecturerCoursePreferenceSeeder extends Seeder
{
    use InteractsWithDatasetCsv;

    /**
     * @return array{0:int,1:int}
     */
    public function run(Dataset $dataset, int $createdBy): array
    {
        $lecturers = Lecturer::query()->with('employee.user')->where('dataset_id', $dataset->id)->get();
        $courses = Course::query()->where('dataset_id', $dataset->id)->get()->all();
        $courseByCode = [];
        foreach ($courses as $course) {
            $courseByCode[$course->code] = $course;
        }

        $mappings = $this->readLecturerCoursesCsv();

        DB::table('lecturer_course_preferences')->where('dataset_id', $dataset->id)->delete();
        DB::table('lecturer_time_slot_preferences')->where('dataset_id', $dataset->id)->delete();

        $seededCoursePreferences = 0;
        $skippedCoursePreferences = 0;

        foreach ($lecturers as $lecturer) {
            $employee = $lecturer->employee;
            $nidn = $this->normalizeNidn($employee?->nidn);
            $entries = $mappings[$nidn] ?? [];

            if ($entries === []) {
                $skippedCoursePreferences++;
                continue;
            }

            foreach ($entries as $entry) {
                $course = $courseByCode[$entry['code']] ?? null;
                if ($course === null) {
                    throw new \RuntimeException(
                        "Course code {$entry['code']} not found in dataset for lecturer nidn={$nidn}"
                    );
                }

                DB::table('lecturer_course_preferences')->insert([
                    'dataset_id' => $dataset->id,
                    'lecturer_id' => $lecturer->id,
                    'course_id' => $course->id,
                    'rank_order' => $entry['rank'],
                    'created_by' => $createdBy,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $seededCoursePreferences++;
            }
        }

        echo "Seeded {$seededCoursePreferences} lecturer course preferences for dataset id={$dataset->id}.\n";
        echo "Lecturers without course preferences: {$skippedCoursePreferences}\n";
        echo "Lecturer time slot preferences were not seeded.\n";

        return [$seededCoursePreferences, $skippedCoursePreferences];
    }
}
