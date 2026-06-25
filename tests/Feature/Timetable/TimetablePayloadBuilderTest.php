<?php

namespace Tests\Feature\Timetable;

use App\Models\Dataset;
use App\Services\Timetable\GoSolverRunner;
use App\Services\Timetable\TimetablePayloadBuilder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class TimetablePayloadBuilderTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_includes_non_empty_time_slots_matching_database(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $payload = app(TimetablePayloadBuilder::class)->build($dataset->id);

        $this->assertArrayHasKey('time_slots', $payload);
        $this->assertNotEmpty($payload['time_slots']);

        $dbSlotCount = DB::table('time_slots')
            ->where('dataset_id', $dataset->id)
            ->count();

        $this->assertSame($dbSlotCount, count($payload['time_slots']));
        $this->assertSame(105, $dbSlotCount);

        foreach ($payload['time_slots'] as $slot) {
            $this->assertArrayHasKey('id', $slot);
            $this->assertArrayHasKey('code', $slot);
            $this->assertArrayHasKey('day', $slot);
            $this->assertArrayHasKey('start_time', $slot);
            $this->assertArrayHasKey('end_time', $slot);
        }
    }

    public function test_solver_runner_artifact_preserves_time_slots(): void
    {
        $this->seed(DatabaseSeeder::class);

        $dataset = Dataset::query()->where('name', 'Dataset Seed Default')->first();
        $this->assertNotNull($dataset);

        $artifactsRoot = storage_path('framework/testing/timetable-payload-artifacts');
        File::ensureDirectoryExists($artifactsRoot);
        Config::set('timetable.artifacts_path', $artifactsRoot);

        $fakeBinary = $artifactsRoot.DIRECTORY_SEPARATOR.'fake-solver.sh';
        File::put($fakeBinary, <<<'SH'
#!/usr/bin/env bash
printf '%s' '{"status":"COMPLETED","solver_status":"Optimal","objective_value":0,"assignments":[]}'
SH
        );
        chmod($fakeBinary, 0o755);
        Config::set('timetable.solver_binary', $fakeBinary);

        try {
            $payload = app(TimetablePayloadBuilder::class)->build($dataset->id);
            app(GoSolverRunner::class)->run($payload, runId: 501);

            $requestFiles = glob($artifactsRoot.DIRECTORY_SEPARATOR.'dataset-'.$dataset->id.DIRECTORY_SEPARATOR.'run-501_*_request.json');
            $this->assertCount(1, $requestFiles);

            /** @var array<string, mixed> $saved */
            $saved = json_decode((string) file_get_contents($requestFiles[0]), true, 512, JSON_THROW_ON_ERROR);

            $this->assertArrayHasKey('time_slots', $saved);
            $this->assertCount(count($payload['time_slots']), $saved['time_slots']);
        } finally {
            if (File::isDirectory($artifactsRoot)) {
                File::deleteDirectory($artifactsRoot);
            }
        }
    }
}
