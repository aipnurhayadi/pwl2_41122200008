<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Dataset;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SistemInformasiSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_courses_all_have_lecturer_allowed_relationship(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $courseIds = Course::query()
            ->where('dataset_id', $dataset->id)
            ->pluck('id')
            ->all();

        $this->assertNotEmpty($courseIds);

        $linkedCourseIds = DB::table('lecturer_allowed_courses')
            ->whereIn('course_id', $courseIds)
            ->distinct()
            ->pluck('course_id')
            ->all();

        $this->assertEqualsCanonicalizing($courseIds, $linkedCourseIds);
    }

    public function test_seeded_course_count_matches_lecturer_courses_csv(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $csvPath = base_path('datasets/sistem_informasi/lecturer_courses.csv');
        $handle = fopen($csvPath, 'rb');
        $this->assertNotFalse($handle);

        $headers = fgetcsv($handle);
        $this->assertNotFalse($headers);

        $codeIndex = array_search('course_code', $headers, true);
        $this->assertNotFalse($codeIndex);

        $uniqueCodes = [];
        while (($row = fgetcsv($handle)) !== false) {
            $code = trim((string) ($row[$codeIndex] ?? ''));
            if ($code !== '') {
                $uniqueCodes[$code] = true;
            }
        }
        fclose($handle);

        $seededCount = Course::query()->where('dataset_id', $dataset->id)->count();

        $this->assertSame(count($uniqueCodes), $seededCount);
    }
}
