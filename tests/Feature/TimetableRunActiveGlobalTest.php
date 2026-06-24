<?php

namespace Tests\Feature;

use App\Models\Dataset;
use App\Models\TimetableRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TimetableRunActiveGlobalTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_latest_active_run_for_accessible_dataset(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-active@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $admin->id,
            'created_by' => $admin->id,
            'code' => 'DS-ACT',
            'name' => 'Active Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        TimetableRun::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'status' => TimetableRun::STATUS_COMPLETED,
            'phase' => TimetableRun::PHASE_COMPLETED,
            'progress_percent' => 100,
            'finished_at' => now(),
        ]);

        $activeRun = TimetableRun::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'status' => TimetableRun::STATUS_RUNNING,
            'phase' => TimetableRun::PHASE_RUNNING_SOLVER,
            'progress_percent' => 50,
            'started_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/timetable-runs/active')
            ->assertOk()
            ->assertJsonPath('id', $activeRun->id)
            ->assertJsonPath('dataset_id', $dataset->id)
            ->assertJsonPath('dataset_name', 'Active Dataset')
            ->assertJsonPath('status', TimetableRun::STATUS_RUNNING)
            ->assertJsonPath('progress_percent', 50);
    }

    public function test_returns_null_when_no_active_run(): void
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'admin-no-active@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $admin->id,
            'created_by' => $admin->id,
            'code' => 'DS-DONE',
            'name' => 'Done Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        TimetableRun::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $admin->id,
            'status' => TimetableRun::STATUS_COMPLETED,
            'phase' => TimetableRun::PHASE_COMPLETED,
            'progress_percent' => 100,
            'finished_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/timetable-runs/active');

        $response->assertOk();
        $this->assertNull($response->json('id'));
    }

    public function test_does_not_return_active_run_from_inaccessible_dataset(): void
    {
        $owner = User::query()->create([
            'name' => 'Owner',
            'email' => 'owner-active@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $otherAdmin = User::query()->create([
            'name' => 'Other',
            'email' => 'other-active@test.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'created_by' => null,
        ]);

        $dataset = Dataset::query()->create([
            'user_id' => $owner->id,
            'created_by' => $owner->id,
            'code' => 'DS-OTHER',
            'name' => 'Other Dataset',
            'description' => 'Test',
            'visibility' => Dataset::VISIBILITY_PRIVATE,
            'color' => '#000000',
        ]);

        TimetableRun::query()->create([
            'dataset_id' => $dataset->id,
            'created_by' => $owner->id,
            'status' => TimetableRun::STATUS_RUNNING,
            'phase' => TimetableRun::PHASE_RUNNING_SOLVER,
            'progress_percent' => 50,
            'started_at' => now(),
        ]);

        Sanctum::actingAs($otherAdmin);

        $response = $this->getJson('/api/timetable-runs/active');

        $response->assertOk();
        $this->assertNull($response->json('id'));
    }
}
