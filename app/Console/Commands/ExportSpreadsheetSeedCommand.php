<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ExportSpreadsheetSeedCommand extends Command
{
    private const DEFAULT_MAJOR_NAME = 'Sistem Informasi';

    private const CLASS_GROUPS = ['B1', 'B2', 'B3'];

    private const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

    protected $signature = 'seed:export-spreadsheet
                            {--spreadsheet= : Path to source xlsx file}
                            {--output-dir= : Directory for generated CSV files}';

    protected $description = 'Export seed CSV files from Daftar_Preferensi_Dosen_dan_Matakuliah.xlsx';

    public function handle(): int
    {
        $spreadsheetPath = $this->option('spreadsheet')
            ?: base_path('spreadsheets/Daftar_Preferensi_Dosen_dan_Matakuliah.xlsx');
        $outputDir = $this->option('output-dir')
            ?: base_path('datasets/sistem_informasi');

        if (! is_file($spreadsheetPath)) {
            $this->error("Spreadsheet not found: {$spreadsheetPath}");

            return self::FAILURE;
        }

        if (! is_dir($outputDir) && ! mkdir($outputDir, 0755, true) && ! is_dir($outputDir)) {
            $this->error("Unable to create output directory: {$outputDir}");

            return self::FAILURE;
        }

        $existingMeta = $this->readExistingLecturerMetadata($outputDir);
        $spreadsheet = IOFactory::load($spreadsheetPath);
        $lecturers = $this->parseLecturerSheets($spreadsheet);
        $catalog = $this->buildCourseCatalog($lecturers);

        $lecturerRows = [];
        foreach ($lecturers as $index => $lecturer) {
            $lecturerRows[] = $this->mergeLecturerRow($lecturer, $existingMeta, $index + 1);
        }

        $classCount = $this->writeClassesCsv($outputDir);
        $courseCount = $this->writeCoursesCsv($outputDir, $catalog);
        $lecturerCount = $this->writeLecturersCsv($outputDir, $lecturerRows);
        $mappingCount = $this->writeLecturerCoursesCsv($outputDir, $lecturers);

        $this->info("Exported seed CSV files to {$outputDir}");
        $this->line("  classes.csv: {$classCount} rows");
        $this->line("  courses.csv: {$courseCount} rows");
        $this->line("  lecturers.csv: {$lecturerCount} rows");
        $this->line("  lecturer_courses.csv: {$mappingCount} rows");

        return self::SUCCESS;
    }

    private function normalizeNidn(mixed $value): string
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

    private function parseLecturerDisplayName(string $rawName): array
    {
        $text = trim($rawName);
        if ($text === '') {
            return ['front_title' => '', 'name' => '', 'back_title' => ''];
        }

        $parts = array_values(array_filter(array_map('trim', explode(',', $text)), static fn (string $part): bool => $part !== ''));
        if ($parts === []) {
            return ['front_title' => '', 'name' => '', 'back_title' => ''];
        }

        $first = $parts[0];
        if (preg_match('/^(DR\.|IR\.|Ir\.|Prof\.|Se\.|SE\.)\s+(.+)$/i', $first, $matches)) {
            $frontTitle = $matches[1];
            $name = trim($matches[2]);
        } else {
            $frontTitle = '';
            $name = $first;
        }

        $backTitle = count($parts) > 1 ? implode(', ', array_slice($parts, 1)) : '';

        return [
            'front_title' => $frontTitle,
            'name' => $name,
            'back_title' => $backTitle,
        ];
    }

    private function readExistingLecturerMetadata(string $csvDir): array
    {
        $path = $csvDir.DIRECTORY_SEPARATOR.'lecturers.csv';
        if (! is_file($path)) {
            return [];
        }

        $lookup = [];
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return [];
        }

        $headers = fgetcsv($handle);
        if ($headers === false) {
            fclose($handle);

            return [];
        }

        $headers = array_map(static fn (string $header): string => trim(preg_replace('/^\xEF\xBB\xBF/', '', $header) ?? $header), $headers);

        while (($columns = fgetcsv($handle)) !== false) {
            $row = [];
            foreach ($headers as $index => $header) {
                if ($header === '') {
                    continue;
                }
                $row[$header] = trim((string) ($columns[$index] ?? ''));
            }

            if (strtolower($row['name'] ?? '') === 'name') {
                continue;
            }

            $nidn = $this->normalizeNidn($row['nidn'] ?? '');
            if ($nidn !== '' && ! isset($lookup[$nidn])) {
                $lookup[$nidn] = $row;
            }
        }

        fclose($handle);

        return $lookup;
    }

    private function empSheetSortKey(string $sheetName): array
    {
        if (preg_match('/EMP(\d+)/i', $sheetName, $matches)) {
            return [(int) $matches[1], $sheetName];
        }

        return [PHP_INT_MAX, $sheetName];
    }

    /**
     * @return list<array{emp_code: string, nidn: string, name: string, front_title: string, back_title: string, courses: list<array{rank: int, code: string, name: string, credits: ?int, semester: ?int, curriculum_year: ?int}>}>
     */
    private function parseLecturerSheets(\PhpOffice\PhpSpreadsheet\Spreadsheet $spreadsheet): array
    {
        $sheetNames = [];
        foreach ($spreadsheet->getSheetNames() as $sheetName) {
            if (str_starts_with(strtoupper($sheetName), 'EMP')) {
                $sheetNames[] = $sheetName;
            }
        }

        usort($sheetNames, function (string $left, string $right): int {
            return $this->empSheetSortKey($left) <=> $this->empSheetSortKey($right);
        });

        $lecturers = [];
        foreach ($sheetNames as $sheetName) {
            $sheet = $spreadsheet->getSheetByName($sheetName);
            if ($sheet === null) {
                continue;
            }

            $empCode = '';
            $rawName = '';
            $nidn = '';
            $courses = [];

            foreach ($sheet->toArray() as $row) {
                if ($row === [] || $row[0] === null) {
                    continue;
                }

                $label = $row[0];
                if ($label === 'Kode Dosen:' && $row[1] !== null) {
                    $empCode = trim((string) $row[1]);
                } elseif ($label === 'Nama Dosen:' && $row[1] !== null) {
                    $rawName = trim((string) $row[1]);
                } elseif ($label === 'NIDN:' && $row[1] !== null) {
                    $nidn = $this->normalizeNidn($row[1]);
                } elseif (is_numeric($label) && $row[1] !== null) {
                    $courses[] = [
                        'rank' => (int) $label,
                        'code' => trim((string) $row[1]),
                        'name' => trim((string) ($row[2] ?? '')),
                        'credits' => isset($row[3]) && $row[3] !== '' ? (int) $row[3] : null,
                        'semester' => isset($row[4]) && $row[4] !== '' ? (int) $row[4] : null,
                        'curriculum_year' => isset($row[5]) && $row[5] !== '' ? (int) $row[5] : null,
                    ];
                }
            }

            $parsedName = $this->parseLecturerDisplayName($rawName);
            $lecturers[] = [
                'emp_code' => $empCode,
                'nidn' => $nidn,
                'name' => $parsedName['name'],
                'front_title' => $parsedName['front_title'],
                'back_title' => $parsedName['back_title'],
                'courses' => $courses,
            ];
        }

        return $lecturers;
    }

    /**
     * @param  list<array{emp_code: string, nidn: string, name: string, front_title: string, back_title: string, courses: list<array{rank: int, code: string, name: string, credits: ?int, semester: ?int, curriculum_year: ?int}>}>  $lecturers
     * @return array<string, array{name: string, code: string, credits: int, semester: ?int, curriculum_year: ?int, description: string}>
     */
    private function buildCourseCatalog(array $lecturers): array
    {
        $catalog = [];

        foreach ($lecturers as $lecturer) {
            foreach ($lecturer['courses'] as $course) {
                $code = $course['code'];
                if ($code === '' || isset($catalog[$code])) {
                    continue;
                }

                $name = $course['name'];
                $catalog[$code] = [
                    'name' => $name,
                    'code' => $code,
                    'credits' => $course['credits'] ?? 0,
                    'semester' => $course['semester'],
                    'curriculum_year' => $course['curriculum_year'],
                    'description' => str_contains(strtolower($name), '[e]') ? 'E-learning' : '',
                ];
            }
        }

        return $catalog;
    }

    /**
     * @param  array{emp_code: string, nidn: string, name: string, front_title: string, back_title: string, courses: list<array{rank: int, code: string, name: string, credits: ?int, semester: ?int, curriculum_year: ?int}>}  $lecturer
     * @param  array<string, array<string, string>>  $existing
     * @return array<string, string>
     */
    private function mergeLecturerRow(array $lecturer, array $existing, int $index): array
    {
        $meta = $existing[$lecturer['nidn']] ?? [];

        return [
            'nidn' => $lecturer['nidn'],
            'name' => $lecturer['name'] !== '' ? $lecturer['name'] : ($meta['name'] ?? ''),
            'front_title' => $lecturer['front_title'] !== '' ? $lecturer['front_title'] : ($meta['front_title'] ?? ''),
            'back_title' => $lecturer['back_title'] !== '' ? $lecturer['back_title'] : ($meta['back_title'] ?? ''),
            'gender' => $meta['gender'] ?? 'L',
            'email' => $meta['email'] ?? sprintf('lecturer%03d@widyatama.ac.id', $index),
            'phone' => $meta['phone'] ?? '',
            'expertise' => $meta['expertise'] ?? $meta['keterangan'] ?? '',
        ];
    }

    private function writeClassesCsv(string $outputDir): int
    {
        $path = $outputDir.DIRECTORY_SEPARATOR.'classes.csv';
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to write classes CSV: {$path}");
        }

        fputcsv($handle, ['name', 'academic_year', 'semester', 'study_program', 'capacity', 'description']);

        $count = 0;
        foreach (self::SEMESTERS as $semester) {
            foreach (self::CLASS_GROUPS as $group) {
                fputcsv($handle, [
                    "REG {$group} 2025 Sistem Informasi",
                    '2020',
                    (string) $semester,
                    self::DEFAULT_MAJOR_NAME,
                    '40',
                    '',
                ]);
                $count++;
            }
        }

        fclose($handle);

        return $count;
    }

    /**
     * @param  array<string, array{name: string, code: string, credits: int, semester: ?int, curriculum_year: ?int, description: string}>  $catalog
     */
    private function writeCoursesCsv(string $outputDir, array $catalog): int
    {
        $path = $outputDir.DIRECTORY_SEPARATOR.'courses.csv';
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to write courses CSV: {$path}");
        }

        fputcsv($handle, ['name', 'code', 'credits', 'semester', 'curriculum_year', 'description']);

        foreach ($catalog as $course) {
            fputcsv($handle, [
                $course['name'],
                $course['code'],
                (string) $course['credits'],
                $course['semester'] !== null ? (string) $course['semester'] : '',
                $course['curriculum_year'] !== null ? (string) $course['curriculum_year'] : '',
                $course['description'],
            ]);
        }

        fclose($handle);

        return count($catalog);
    }

    /**
     * @param  list<array<string, string>>  $lecturerRows
     */
    private function writeLecturersCsv(string $outputDir, array $lecturerRows): int
    {
        $path = $outputDir.DIRECTORY_SEPARATOR.'lecturers.csv';
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to write lecturers CSV: {$path}");
        }

        fputcsv($handle, ['nidn', 'name', 'front_title', 'back_title', 'gender', 'email', 'phone', 'expertise']);
        foreach ($lecturerRows as $row) {
            fputcsv($handle, [
                $row['nidn'],
                $row['name'],
                $row['front_title'],
                $row['back_title'],
                $row['gender'],
                $row['email'],
                $row['phone'],
                $row['expertise'],
            ]);
        }

        fclose($handle);

        return count($lecturerRows);
    }

    /**
     * @param  list<array{emp_code: string, nidn: string, name: string, front_title: string, back_title: string, courses: list<array{rank: int, code: string, name: string, credits: ?int, semester: ?int, curriculum_year: ?int}>}>  $lecturers
     */
    private function writeLecturerCoursesCsv(string $outputDir, array $lecturers): int
    {
        $path = $outputDir.DIRECTORY_SEPARATOR.'lecturer_courses.csv';
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new \RuntimeException("Unable to write lecturer_courses CSV: {$path}");
        }

        fputcsv($handle, ['lecturer_nidn', 'course_code', 'rank_order']);

        $count = 0;
        foreach ($lecturers as $lecturer) {
            foreach ($lecturer['courses'] as $course) {
                fputcsv($handle, [
                    $lecturer['nidn'],
                    $course['code'],
                    (string) $course['rank'],
                ]);
                $count++;
            }
        }

        fclose($handle);

        return $count;
    }
}
