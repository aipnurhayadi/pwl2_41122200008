<?php

namespace Tests\Feature\Timetable;

use App\Models\BwmResponse;
use App\Models\BwmWeight;
use App\Models\ClassModel;
use App\Models\Course;
use App\Models\Criterion;
use App\Models\Dataset;
use App\Models\Employee;
use App\Models\Lecturer;
use App\Models\User;
use App\Services\Timetable\BwmWeightAggregator;
use App\Services\Timetable\TeachingRequestBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TimetableServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_bwm_weight_aggregator_averages_and_normalizes_weights(): void
    {
        [$dataset, $criteria, $lecturers] = $this->seedDatasetWithBwm();

        $aggregator = new BwmWeightAggregator;
        $result = $aggregator->aggregateForDataset($dataset->id);

        $this->assertCount(5, $result['weights']);
        $this->assertArrayHasKey('SFT_001', $result['weights']);
        $this->assertEqualsWithDelta(0.5, $result['weights']['SFT_001'], 0.0001);
        $this->assertEqualsWithDelta(0.5, $result['weights']['SFT_002'], 0.0001);

        $sum = array_sum($result['weights']);
        $this->assertEqualsWithDelta(1.0, $sum, 0.0001);
        $this->assertArrayHasKey('SFT_001', $result['criterion_ids']);
        $this->assertSame($criteria['SFT_001']->id, $result['criterion_ids']['SFT_001']);
    }

    public function test_bwm_weight_aggregator_blocks_when_lecturer_missing_bwm(): void
    {
        [$dataset] = $this->seedDatasetWithBwm(includeSecondLecturerBwm: false);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('lecturer(s) have not completed BWM');

        (new BwmWeightAggregator)->aggregateForDataset($dataset->id);
    }

    public function test_teaching_request_builder_matches_semester_and_year(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-timetable@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $admin->id,
            'created_by' => $admin->id,
            'code' => 'DS-TST',
            'name' => 'Test Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        $class = ClassModel::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'code' => 'KLS-3A',
            'name' => 'Kelas 3A',
            'semester' => 3,
            'academic_year' => 2024,
            'capacity' => 35,
        ]);

        $matchingCourse = Course::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'code' => 'MK-301',
            'name' => 'MK Semester 3',
            'semester' => 3,
            'curriculum_year' => 2024,
            'credits' => 3,
        ]);

        Course::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'code' => 'MK-501',
            'name' => 'MK Semester 5',
            'semester' => 5,
            'curriculum_year' => 2024,
            'credits' => 3,
        ]);

        $requests = (new TeachingRequestBuilder)->buildForDataset($dataset->id);

        $this->assertCount(1, $requests);
        $this->assertSame($class->id, $requests[0]['class_id']);
        $this->assertSame($matchingCourse->id, $requests[0]['course_id']);
        $this->assertNull($requests[0]['lecturer_id']);
        $this->assertSame(1, $requests[0]['duration_slots']);
        $this->assertSame(35, $requests[0]['class_capacity']);
    }

    /**
     * @return array{0: Dataset, 1: array<string, Criterion>, 2: list<Lecturer>}
     */
    private function seedDatasetWithBwm(bool $includeSecondLecturerBwm = true): array
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-bwm-'.uniqid().'@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $admin->id,
            'created_by' => $admin->id,
            'code' => 'DS-BWM',
            'name' => 'BWM Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        $criteria = [];
        foreach (['SFT_001', 'SFT_002', 'SFT_003', 'SFT_004', 'SFT_005'] as $code) {
            $criteria[$code] = Criterion::query()->create([
                'created_by' => $admin->id,
                'code' => $code,
                'name' => 'Criterion '.$code.' '.uniqid(),
                'description' => 'Test criterion',
                'type' => Criterion::TYPE_SOFT,
                'is_lecturer_preference' => $code === 'SFT_001',
            ]);
        }

        $lecturers = [];
        foreach (['LEC-1', 'LEC-2'] as $index => $code) {
            $lecturerUser = User::query()->create([
                'name' => 'Lecturer '.$code,
                'email' => strtolower($code).'-'.uniqid().'@test.local',
                'password' => Hash::make('password'),
                'role' => User::ROLE_LECTURER,
                'created_by' => $admin->id,
            ]);

            $employee = Employee::query()->create([
                'user_id' => $lecturerUser->id,
                'created_by' => $admin->id,
                'employee_code' => 'EMP-'.$code.'-'.uniqid(),
                'name' => 'Employee '.$code,
            ]);

            $lecturers[] = Lecturer::query()->create([
                'dataset_id' => $dataset->id,
                'employee_id' => $employee->id,
                'created_by' => $admin->id,
                'code' => $code,
            ]);
        }

        $this->createBwmResponse($dataset->id, $lecturers[0]->id, $admin->id, $criteria, [
            'SFT_001' => 0.6,
            'SFT_002' => 0.4,
        ]);

        if ($includeSecondLecturerBwm) {
            $this->createBwmResponse($dataset->id, $lecturers[1]->id, $admin->id, $criteria, [
                'SFT_001' => 0.4,
                'SFT_002' => 0.6,
            ]);
        }

        return [$dataset, $criteria, $lecturers];
    }

    /**
     * @param  array<string, Criterion>  $criteria
     * @param  array<string, float>  $weights
     */
    private function createBwmResponse(
        int $datasetId,
        int $lecturerId,
        int $createdBy,
        array $criteria,
        array $weights,
    ): void {
        $response = BwmResponse::query()->create([
            'dataset_id' => $datasetId,
            'lecturer_id' => $lecturerId,
            'created_by' => $createdBy,
            'best_criteria_id' => $criteria['SFT_001']->id,
            'worst_criteria_id' => $criteria['SFT_005']->id,
            'scale_max' => 9,
            'ksi' => 0.05,
            'consistency_ratio' => 0.05,
        ]);

        foreach ($criteria as $code => $criterion) {
            BwmWeight::query()->create([
                'response_id' => $response->id,
                'criterion_id' => $criterion->id,
                'created_by' => $createdBy,
                'weight' => $weights[$code] ?? 0.0,
            ]);
        }
    }
}
