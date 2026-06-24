<?php

namespace Tests\Unit\Timetable;

use App\Services\Timetable\GoSolverRunner;
use App\Services\Timetable\TimetableRunArtifactStore;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class GoSolverRunnerTest extends TestCase
{
    private string $artifactsRoot;

    private string $fakeBinary;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artifactsRoot = storage_path('framework/testing/go-solver-runner');
        File::ensureDirectoryExists($this->artifactsRoot);
        Config::set('timetable.artifacts_path', $this->artifactsRoot);

        $this->fakeBinary = $this->artifactsRoot.DIRECTORY_SEPARATOR.'fake-solver.sh';
        File::put($this->fakeBinary, <<<'SH'
#!/usr/bin/env bash
set -euo pipefail
input="$(cat)"
if [[ -n "${PWL2_RUN_ID:-}" ]]; then
  echo "{\"run_id\":\"${PWL2_RUN_ID}\",\"dataset_id\":\"${PWL2_DATASET_ID:-}\"}" >> "${PWL2_LOG_FILE:-/dev/null}"
fi
printf '%s' '{"status":"COMPLETED","solver_status":"Optimal","objective_value":12.5,"assignments":[]}'
SH
        );
        chmod($this->fakeBinary, 0o755);
        Config::set('timetable.solver_binary', $this->fakeBinary);
    }

    protected function tearDown(): void
    {
        if (File::isDirectory($this->artifactsRoot)) {
            File::deleteDirectory($this->artifactsRoot);
        }

        parent::tearDown();
    }

    public function test_run_persists_request_response_and_solver_log_env(): void
    {
        $runner = new GoSolverRunner(new TimetableRunArtifactStore);

        $response = $runner->run([
            'dataset_id' => 3,
            'weights' => ['SFT_001' => 1.0],
            'teaching_requests' => [],
        ], runId: 99);

        $this->assertSame('COMPLETED', $response['status']);

        $datasetDir = $this->artifactsRoot.DIRECTORY_SEPARATOR.'dataset-3';
        $this->assertDirectoryExists($datasetDir);

        $requestFiles = glob($datasetDir.DIRECTORY_SEPARATOR.'run-99_*_request.json');
        $responseFiles = glob($datasetDir.DIRECTORY_SEPARATOR.'run-99_*_response.json');
        $this->assertCount(1, $requestFiles);
        $this->assertCount(1, $responseFiles);

        $logPath = $datasetDir.DIRECTORY_SEPARATOR.'run-99.log';
        $this->assertFileExists($logPath);
        $this->assertStringContainsString('"run_id":"99"', (string) file_get_contents($logPath));
    }
}
