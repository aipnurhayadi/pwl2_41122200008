<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Dataset;
use App\Services\Timetable\TeachingRequestBuilder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\Support\LecturerExpertiseCourseMatcher;
use Database\Seeders\Support\SeederDefaults;
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

    public function test_seeded_allowed_courses_per_lecturer_exceeds_legacy_csv_cap(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $counts = DB::table('lecturer_allowed_courses')
            ->join('lecturers', 'lecturers.id', '=', 'lecturer_allowed_courses.lecturer_id')
            ->where('lecturers.dataset_id', $dataset->id)
            ->groupBy('lecturer_allowed_courses.lecturer_id')
            ->selectRaw('lecturer_allowed_courses.lecturer_id, COUNT(*) as course_count')
            ->pluck('course_count')
            ->all();

        $this->assertNotEmpty($counts);

        $average = array_sum($counts) / count($counts);
        $this->assertGreaterThan(7, $average);
        $this->assertGreaterThan(7, min($counts));
        $this->assertLessThanOrEqual(
            LecturerExpertiseCourseMatcher::MAX_ALLOWED_COURSES_PER_LECTURER + 4,
            max($counts),
        );
    }

    public function test_seeded_course_preferences_match_allowed_courses_per_lecturer(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $lecturerIds = DB::table('lecturers')
            ->where('dataset_id', $dataset->id)
            ->pluck('id')
            ->all();

        $this->assertNotEmpty($lecturerIds);

        foreach ($lecturerIds as $lecturerId) {
            $allowedCount = DB::table('lecturer_allowed_courses')
                ->where('lecturer_id', $lecturerId)
                ->count();

            if ($allowedCount === 0) {
                continue;
            }

            $preferences = DB::table('lecturer_course_preferences')
                ->where('dataset_id', $dataset->id)
                ->where('lecturer_id', $lecturerId)
                ->orderBy('rank_order')
                ->pluck('rank_order')
                ->all();

            $this->assertCount(
                $allowedCount,
                $preferences,
                "Expected lecturer {$lecturerId} to have {$allowedCount} course preferences"
            );
            $this->assertSame(range(1, $allowedCount), $preferences);
        }
    }

    public function test_seeded_classes_respect_per_semester_cap(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $counts = DB::table('classes')
            ->where('dataset_id', $dataset->id)
            ->selectRaw('academic_year, semester, COUNT(*) as class_count')
            ->groupBy('academic_year', 'semester')
            ->pluck('class_count')
            ->all();

        $this->assertCount(8, $counts);
        foreach ($counts as $count) {
            $this->assertLessThanOrEqual(SeederDefaults::CLASSES_PER_SEMESTER, $count);
        }
    }

    public function test_seeded_teaching_requests_scale_with_single_class_per_semester(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $courseCount = Course::query()
            ->where('dataset_id', $dataset->id)
            ->count();

        $requests = app(TeachingRequestBuilder::class)->buildForDataset($dataset->id);

        $this->assertSame($courseCount, count($requests));
        $this->assertLessThan(40, count($requests));
    }

    public function test_seeded_time_slots_use_sixty_minute_blocks(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $slots = DB::table('time_slots')
            ->where('dataset_id', $dataset->id)
            ->orderBy('id')
            ->get(['start_time', 'end_time']);

        $this->assertCount(105, $slots);

        foreach ($slots->take(5) as $slot) {
            $start = \DateTimeImmutable::createFromFormat('H:i:s', $slot->start_time)
                ?: \DateTimeImmutable::createFromFormat('H:i', $slot->start_time);
            $end = \DateTimeImmutable::createFromFormat('H:i:s', $slot->end_time)
                ?: \DateTimeImmutable::createFromFormat('H:i', $slot->end_time);

            $this->assertNotFalse($start);
            $this->assertNotFalse($end);
            $this->assertSame(
                SeederDefaults::DEFAULT_SLOT_MINUTES,
                (int) $start->diff($end)->format('%i') + ((int) $start->diff($end)->format('%h') * 60),
            );
        }
    }
}
