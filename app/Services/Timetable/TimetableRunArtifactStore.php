<?php

namespace App\Services\Timetable;

use Illuminate\Support\Facades\File;

class TimetableRunArtifactStore
{
    private const JSON_FLAGS = JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

    /**
     * @return array{
     *     basename: string,
     *     directory: string,
     *     request_path: string,
     *     response_path: string,
     *     error_path: string,
     *     log_path: string,
     * }
     */
    public function beginRun(int $datasetId, int $runId): array
    {
        $directory = $this->datasetDirectory($datasetId);
        File::ensureDirectoryExists($directory);

        $basename = sprintf(
            'run-%d_%s',
            $runId,
            now()->format('Ymd-His-u'),
        );

        return [
            'basename' => $basename,
            'directory' => $directory,
            'request_path' => $directory.DIRECTORY_SEPARATOR.$basename.'_request.json',
            'response_path' => $directory.DIRECTORY_SEPARATOR.$basename.'_response.json',
            'error_path' => $directory.DIRECTORY_SEPARATOR.$basename.'_error.txt',
            'log_path' => $directory.DIRECTORY_SEPARATOR.sprintf('run-%d.log', $runId),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function saveRequest(array $paths, array $payload): void
    {
        $this->writeJson($paths['request_path'], $payload);
    }

    /**
     * @param  array<string, mixed>|string  $response
     */
    public function saveResponse(array $paths, array|string $response): void
    {
        if (is_array($response)) {
            $this->writeJson($paths['response_path'], $response);

            return;
        }

        File::put($paths['response_path'], $response);
    }

    public function saveError(array $paths, string $stderr): void
    {
        if ($stderr === '') {
            return;
        }

        File::put($paths['error_path'], $stderr);
    }

    public function datasetDirectory(int $datasetId): string
    {
        $root = rtrim((string) config('timetable.artifacts_path'), DIRECTORY_SEPARATOR);

        return $root.DIRECTORY_SEPARATOR.'dataset-'.$datasetId;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function writeJson(string $path, array $payload): void
    {
        File::put($path, json_encode($payload, self::JSON_FLAGS));
    }
}
