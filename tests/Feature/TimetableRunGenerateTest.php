<?php

namespace Tests\Feature;

use App\Jobs\RunTimetableJob;
use App\Models\Dataset;
use App\Models\TimetableRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TimetableRunGenerateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_dispatch_timetable_run_job(): void
    {
        Queue::fake();

        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-generate@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $admin->id,
            'created_by' => $admin->id,
            'code' => 'DS-GEN',
            'name' => 'Generate Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/datasets/{$dataset->id}/timetable-runs/generate");

        $response->assertStatus(202)
            ->assertJsonPath('status', TimetableRun::STATUS_QUEUED)
            ->assertJsonPath('dataset_id', $dataset->id);

        $runId = $response->json('id');
        $this->assertNotNull($runId);

        $this->assertDatabaseHas('timetable_runs', [
            'id' => $runId,
            'dataset_id' => $dataset->id,
            'status' => TimetableRun::STATUS_QUEUED,
        ]);

        Queue::assertPushed(RunTimetableJob::class, static fn (RunTimetableJob $job): bool => $job->runId === $runId);
    }

    public function test_non_admin_cannot_generate_timetable_run(): void
    {
        Queue::fake();

        $lecturerUser = User::query()->create([
            'name' => 'Lecturer',
            'email' => 'lecturer-generate@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_LECTURER,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $lecturerUser->id,
            'created_by' => $lecturerUser->id,
            'code' => 'DS-LEC',
            'name' => 'Lecturer Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        Sanctum::actingAs($lecturerUser);

        $this->postJson("/api/datasets/{$dataset->id}/timetable-runs/generate")
            ->assertStatus(403);

        Queue::assertNothingPushed();
    }
}
