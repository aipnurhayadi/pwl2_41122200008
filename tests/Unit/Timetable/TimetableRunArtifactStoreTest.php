<?php

namespace Tests\Unit\Timetable;

use App\Services\Timetable\TimetableRunArtifactStore;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class TimetableRunArtifactStoreTest extends TestCase
{
    protected function tearDown(): void
    {
        $root = storage_path('framework/testing/timetable-artifacts');
        if (File::isDirectory($root)) {
            File::deleteDirectory($root);
        }

        parent::tearDown();
    }

    public function test_begin_run_builds_dataset_scoped_paths(): void
    {
        $root = storage_path('framework/testing/timetable-artifacts');
        Config::set('timetable.artifacts_path', $root);

        $store = new TimetableRunArtifactStore;
        $paths = $store->beginRun(datasetId: 5, runId: 42);

        $this->assertSame($root.DIRECTORY_SEPARATOR.'dataset-5', $paths['directory']);
        $this->assertStringStartsWith('run-42_', $paths['basename']);
        $this->assertStringEndsWith('_request.json', $paths['request_path']);
        $this->assertStringEndsWith('_response.json', $paths['response_path']);
        $this->assertStringEndsWith('_error.txt', $paths['error_path']);
        $this->assertSame($paths['directory'].DIRECTORY_SEPARATOR.'run-42.log', $paths['log_path']);
    }

    public function test_save_request_and_response_write_json_files(): void
    {
        $root = storage_path('framework/testing/timetable-artifacts');
        Config::set('timetable.artifacts_path', $root);

        $store = new TimetableRunArtifactStore;
        $paths = $store->beginRun(datasetId: 1, runId: 7);

        $payload = ['dataset_id' => 1, 'weights' => ['SFT_001' => 0.5]];
        $store->saveRequest($paths, $payload);
        $store->saveResponse($paths, ['status' => 'COMPLETED', 'assignments' => []]);
        $store->saveError($paths, 'cbc timeout');

        $this->assertFileExists($paths['request_path']);
        $this->assertFileExists($paths['response_path']);
        $this->assertFileExists($paths['error_path']);

        $savedRequest = json_decode((string) file_get_contents($paths['request_path']), true);
        $this->assertSame($payload, $savedRequest);
    }
}
