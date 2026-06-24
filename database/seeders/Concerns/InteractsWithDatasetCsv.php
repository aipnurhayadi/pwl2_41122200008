<?php

namespace Database\Seeders\Concerns;

use Database\Seeders\Support\SeederDefaults;

trait InteractsWithDatasetCsv
{
    protected function validateCsvFiles(): void
    {
        foreach ($this->csvPaths() as $path) {
            if (! file_exists($path)) {
                throw new \RuntimeException("Missing CSV file: {$path}");
            }
        }
    }

    /**
     * @return list<string>
     */
    protected function csvPaths(): array
    {
        $csvDir = $this->csvDir();

        return [
            $csvDir.DIRECTORY_SEPARATOR.'courses.csv',
            $csvDir.DIRECTORY_SEPARATOR.'lecturers.csv',
            $csvDir.DIRECTORY_SEPARATOR.'rooms.csv',
            $csvDir.DIRECTORY_SEPARATOR.'timeslots.csv',
            $csvDir.DIRECTORY_SEPARATOR.'classes.csv',
            $csvDir.DIRECTORY_SEPARATOR.'lecturer_courses.csv',
        ];
    }

    protected function csvDir(): string
    {
        return base_path('datasets/'.SeederDefaults::CSV_DATASET_SLUG);
    }

    /**
     * @return list<array<string, string>>
     */
    protected function readCsvRows(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to open CSV file: {$path}");
        }

        $headers = fgetcsv($handle);
        if ($headers === false) {
            fclose($handle);

            return [];
        }

        $headers = array_map(static function ($header): string {
            return self::normalizeHeader((string) $header);
        }, $headers);

        $rows = [];
        while (($columns = fgetcsv($handle)) !== false) {
            $row = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }

                $row[$header] = trim((string) ($columns[$index] ?? ''));
            }

            if (! array_filter($row, static fn (string $value): bool => $value !== '')) {
                continue;
            }

            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }

    protected static function normalizeHeader(string $value): string
    {
        $value = preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;

        return trim($value);
    }

    protected function normalizeNidn(?string $value): string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '';
        }

        $digits = preg_replace('/\D/', '', $text) ?? '';
        if ($digits === '') {
            return $text;
        }

        return str_pad($digits, 10, '0', STR_PAD_LEFT);
    }

    /**
     * @return array<string, list<array{code: string, rank: int}>>
     */
    protected function readLecturerCoursesCsv(): array
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturer_courses.csv');
        $byNidn = [];

        foreach ($rows as $row) {
            $nidn = $this->normalizeNidn($row['lecturer_nidn'] ?? null);
            $code = trim((string) ($row['course_code'] ?? ''));
            $rank = (int) ($row['rank_order'] ?? 0);

            if ($nidn === '' || $code === '' || $rank === 0) {
                continue;
            }

            $byNidn[$nidn][] = ['code' => $code, 'rank' => $rank];
        }

        foreach ($byNidn as $nidn => $entries) {
            usort(
                $byNidn[$nidn],
                static fn (array $left, array $right): int => $left['rank'] <=> $right['rank']
            );
        }

        return $byNidn;
    }

    /**
     * @return list<string>
     */
    protected function lecturerLinkedCourseCodes(): array
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturer_courses.csv');
        $codes = [];

        foreach ($rows as $row) {
            $code = trim((string) ($row['course_code'] ?? ''));
            if ($code !== '') {
                $codes[$code] = true;
            }
        }

        return array_keys($codes);
    }

    protected function validateLecturerCourseCodesExistInCoursesCsv(): void
    {
        $courseRows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'courses.csv');
        $courseCodes = [];

        foreach ($courseRows as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            if ($code !== '') {
                $courseCodes[$code] = true;
            }
        }

        foreach ($this->lecturerLinkedCourseCodes() as $code) {
            if (! isset($courseCodes[$code])) {
                throw new \RuntimeException(
                    "Course code {$code} in lecturer_courses.csv not found in courses.csv"
                );
            }
        }
    }

    protected function toIntOrNull(?string $value): ?int
    {
        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        return (int) $text;
    }
}
