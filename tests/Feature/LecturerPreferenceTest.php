<?php

namespace Tests\Feature;

use App\Models\Dataset;
use App\Models\Employee;
use App\Models\Lecturer;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LecturerPreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_lecturer_can_save_all_allowed_course_rankings(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $lecturer = $this->findLecturerWithMoreThanSevenAllowedCourses($dataset->id);
        $this->assertNotNull($lecturer);

        $allowedCourseIds = DB::table('lecturer_allowed_courses')
            ->where('lecturer_id', $lecturer->id)
            ->orderBy('course_id')
            ->pluck('course_id')
            ->all();

        $this->assertGreaterThan(7, count($allowedCourseIds));

        $employee = Employee::query()->findOrFail($lecturer->employee_id);
        $user = $employee->user;
        $this->assertNotNull($user);

        Sanctum::actingAs($user);

        $payload = [
            'course_rankings' => array_map(
                static fn (int $courseId, int $index): array => [
                    'course_id' => $courseId,
                    'rank_order' => $index + 1,
                ],
                $allowedCourseIds,
                array_keys($allowedCourseIds),
            ),
            'time_preferences' => [],
        ];

        $this->putJson("/api/datasets/{$dataset->id}/lecturer-preferences/my", $payload)
            ->assertOk()
            ->assertJsonCount(count($allowedCourseIds), 'course_rankings');
    }

    public function test_lecturer_cannot_save_partial_allowed_course_rankings(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $lecturer = $this->findLecturerWithMoreThanSevenAllowedCourses($dataset->id);
        $this->assertNotNull($lecturer);

        $allowedCourseIds = DB::table('lecturer_allowed_courses')
            ->where('lecturer_id', $lecturer->id)
            ->orderBy('course_id')
            ->pluck('course_id')
            ->all();

        $employee = Employee::query()->findOrFail($lecturer->employee_id);
        $user = $employee->user;
        $this->assertNotNull($user);

        Sanctum::actingAs($user);

        $partialCourseIds = array_slice($allowedCourseIds, 0, 7);
        $payload = [
            'course_rankings' => array_map(
                static fn (int $courseId, int $index): array => [
                    'course_id' => $courseId,
                    'rank_order' => $index + 1,
                ],
                $partialCourseIds,
                array_keys($partialCourseIds),
            ),
            'time_preferences' => [],
        ];

        $this->putJson("/api/datasets/{$dataset->id}/lecturer-preferences/my", $payload)
            ->assertStatus(422)
            ->assertJsonPath('detail', 'course_rankings must rank all allowed courses for this lecturer');
    }

    private function findLecturerWithMoreThanSevenAllowedCourses(int $datasetId): ?Lecturer
    {
        $lecturerId = DB::table('lecturer_allowed_courses')
            ->join('lecturers', 'lecturers.id', '=', 'lecturer_allowed_courses.lecturer_id')
            ->where('lecturers.dataset_id', $datasetId)
            ->groupBy('lecturer_allowed_courses.lecturer_id')
            ->havingRaw('COUNT(*) > 7')
            ->value('lecturer_allowed_courses.lecturer_id');

        if ($lecturerId === null) {
            return null;
        }

        return Lecturer::query()->find($lecturerId);
    }
}
