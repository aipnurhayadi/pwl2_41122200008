<?php

namespace App\Services\Timetable;

use Symfony\Component\Process\Process;

class GoSolverRunner
{
    public function __construct(
        private readonly TimetableRunArtifactStore $artifactStore,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function run(array $payload, int $runId): array
    {
        $binary = (string) config('timetable.solver_binary');
        if (! is_file($binary) || ! is_executable($binary)) {
            throw new \RuntimeException("Go solver binary not found or not executable: {$binary}");
        }

        $datasetId = (int) ($payload['dataset_id'] ?? 0);
        if ($datasetId <= 0) {
            throw new \RuntimeException('Solver payload is missing dataset_id');
        }

        $solverPayload = $payload;
        unset($solverPayload['_criterion_ids']);

        $artifactPaths = $this->artifactStore->beginRun($datasetId, $runId);
        $this->artifactStore->saveRequest($artifactPaths, $solverPayload);

        $env = getenv();
        if (! is_array($env)) {
            $env = [];
        }
        $env['PWL2_RUN_ID'] = (string) $runId;
        $env['PWL2_DATASET_ID'] = (string) $datasetId;
        $env['PWL2_LOG_FILE'] = $artifactPaths['log_path'];

        $process = new Process(
            [$binary, 'timetable'],
            env: $env,
            timeout: (int) config('timetable.solver_timeout'),
        );
        $process->setInput(json_encode($solverPayload, JSON_THROW_ON_ERROR));
        $process->run();

        $stdout = trim($process->getOutput());
        $stderr = trim($process->getErrorOutput());

        if (! $process->isSuccessful()) {
            $this->artifactStore->saveError($artifactPaths, $stderr);
            if ($stdout !== '') {
                $this->artifactStore->saveResponse($artifactPaths, $stdout);
            }

            throw new \RuntimeException($stderr !== '' ? $stderr : 'Go solver process failed');
        }

        if ($stdout === '') {
            $this->artifactStore->saveError($artifactPaths, $stderr);
            throw new \RuntimeException('Go solver returned empty output');
        }

        try {
            /** @var array<string, mixed> $decoded */
            $decoded = json_decode($stdout, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            $this->artifactStore->saveResponse($artifactPaths, $stdout);
            $this->artifactStore->saveError($artifactPaths, $stderr !== '' ? $stderr : $e->getMessage());
            throw new \RuntimeException('Go solver returned invalid JSON: '.$e->getMessage(), 0, $e);
        }

        $this->artifactStore->saveResponse($artifactPaths, $decoded);

        if (($decoded['status'] ?? '') === 'FAILED') {
            $this->artifactStore->saveError($artifactPaths, $stderr);
            throw new \RuntimeException((string) ($decoded['error'] ?? 'Solver returned FAILED status'));
        }

        return $decoded;
    }
}
