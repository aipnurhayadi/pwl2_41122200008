<?php

namespace Database\Seeders;

use App\Models\ClassModel;
use App\Models\Course;
use App\Models\Dataset;
use App\Models\Employee;
use App\Models\Lecturer;
use App\Models\Major;
use App\Models\Room;
use App\Models\TimeSlot;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    private const SYSTEM_USER_ID = 1;
    private const DEFAULT_EMPLOYEE_PASSWORD = 'Employee123!';
    private const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
    private const DEFAULT_ADMIN_PASSWORD = 'Admin123!';
    private const DEFAULT_ADMIN_NAME = 'Admin';
    private const DEFAULT_DATASET_NAME = 'Dataset Seed Default';
    private const DEFAULT_DATASET_DESCRIPTION = 'Auto-created for seed scripts';
    private const DEFAULT_DATASET_COLOR = '#6366F1';
    private const DEFAULT_MAJOR_NAME = 'Sistem Informasi';
    private const DEFAULT_ROOM_CAPACITY = 40;
    private const BREAK_START = '11:40';
    private const BREAK_END = '13:00';

    private const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    private const SOFT_CRITERIA = [
        ['SFT_001', 'Preferensi Hari/Waktu Mengajar', 'Dosen mengajar pada hari dan rentang waktu yang sesuai dengan ketersediaannya (Time-Window).', true],
        ['SFT_002', 'Preferensi Mata Kuliah', 'Dosen mengajar mata kuliah yang sesuai dengan prioritas/kompetensinya.', true],
        ['SFT_003', 'Penghindaran Jeda Kosong', 'Meminimalkan waktu tunggu (idle time) yang terlalu lama bagi dosen di antara dua sesi kelas pada hari yang sama.', true],
        ['SFT_004', 'Beban Mengajar Per Hari', 'Jumlah total sesi mengajar dosen per hari tidak melebihi batas ideal kelayakan fisik.', false],
        ['SFT_005', 'Pemerataan Jadwal Mengajar', 'Jadwal mengajar dosen dan penggunaan gedung tersebar merata sepanjang minggu (tidak menumpuk di hari tertentu).', false],
        ['SFT_006', 'Kesesuaian Fasilitas Ruangan', 'Mengupayakan mata kuliah praktikum bertempat di laboratorium dan kelas teori di ruang reguler.', false],
        ['SFT_007', 'Konsistensi Ruangan', 'Mata kuliah yang sama diupayakan diajarkan di ruangan yang sama setiap minggunya untuk konsistensi.', false],
        ['SFT_008', 'Preferensi Jarak/Mobilitas Lantai', 'Meminimalkan perpindahan lantai gedung yang ekstrem bagi dosen di antara dua sesi mengajar yang berurutan.', false],
    ];

    private const HARD_CRITERIA = [
        ['HRD_001', 'Tidak Ada Tabrakan Jadwal Dosen', 'Seorang dosen tidak boleh mengajar dua kelas berbeda pada waktu yang sama.'],
        ['HRD_002', 'Tidak Ada Tabrakan Jadwal Ruangan', 'Sebuah ruangan tidak boleh digunakan untuk dua kelas berbeda pada waktu yang sama.'],
        ['HRD_003', 'Kapasitas Ruangan', 'Jumlah mahasiswa dalam kelas tidak boleh melebihi kapasitas ruangan.'],
        ['HRD_004', 'Ketersediaan Dosen', 'Dosen hanya dijadwalkan pada waktu dan hari yang tersedia.'],
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $this->validateCsvFiles();

            $systemUser = $this->ensureSystemUser();
            $this->syncPrimaryKeySequence('users');

            [$adminUser, $dataset] = $this->ensureAdminUserAndDataset(
                systemUserId: (int) $systemUser->id,
                email: self::DEFAULT_ADMIN_EMAIL,
                password: self::DEFAULT_ADMIN_PASSWORD,
                name: self::DEFAULT_ADMIN_NAME,
                datasetName: self::DEFAULT_DATASET_NAME,
                datasetDescription: self::DEFAULT_DATASET_DESCRIPTION,
            );

            $this->resetDatasetResources((int) $dataset->id);
            $this->resetMasterMajors();

            $this->seedCriteria((int) $adminUser->id);

            $major = $this->createMajor((int) $adminUser->id);

            $this->seedRoomsFromCsv($dataset, (int) $adminUser->id);
            $this->seedCoursesFromCsv($dataset, (int) $adminUser->id, $major);
            $this->seedClassesFromCsv($dataset, (int) $adminUser->id, $major);
            $this->seedTimeSlotsFromCsv($dataset, (int) $adminUser->id);
            $this->seedLecturersFromCsv($dataset, (int) $adminUser->id);
            $this->seedLecturerAllowedResources($dataset, (int) $adminUser->id);

            [$seededCoursePreferences, $skippedCoursePreferences] = $this->seedLecturerPreferencesForDataset($dataset, (int) $adminUser->id);

            echo "Seeded {$seededCoursePreferences} lecturer course preferences for dataset id={$dataset->id}.\n";
            echo "Lecturers without course preferences: {$skippedCoursePreferences}\n";
            echo "Lecturer time slot preferences were not seeded.\n";
        });
    }

    private function validateCsvFiles(): void
    {
        foreach ($this->csvPaths() as $path) {
            if (! file_exists($path)) {
                throw new \RuntimeException("Missing CSV file: {$path}");
            }
        }
    }

    private function csvPaths(): array
    {
        $csvDir = base_path('datasets/sistem_informasi');

        return [
            $csvDir.DIRECTORY_SEPARATOR.'courses.csv',
            $csvDir.DIRECTORY_SEPARATOR.'lecturers.csv',
            $csvDir.DIRECTORY_SEPARATOR.'rooms.csv',
            $csvDir.DIRECTORY_SEPARATOR.'timeslots.csv',
            $csvDir.DIRECTORY_SEPARATOR.'classes.csv',
            $csvDir.DIRECTORY_SEPARATOR.'lecturer_courses.csv',
        ];
    }

    private function csvDir(): string
    {
        return base_path('datasets/sistem_informasi');
    }

    private function readCsvRows(string $path): array
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

    private static function normalizeHeader(string $value): string
    {
        $value = preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;

        return trim($value);
    }

    private static function normalizeText(?string $value): string
    {
        $text = strtolower(trim((string) $value));
        $text = preg_replace('/[^a-z0-9]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private static function tokenizeText(?string $value): array
    {
        $normalized = self::normalizeText($value);
        if ($normalized === '') {
            return [];
        }

        $stopwords = ['and', 'dan', 'the', 'for', 'to', 'of', 'in', 'a', 'an', 'di', 'ke', 'dengan', 'yang', '&'];
        $tokens = [];

        foreach (explode(' ', $normalized) as $token) {
            if (strlen($token) < 3 || in_array($token, $stopwords, true)) {
                continue;
            }

            $tokens[$token] = true;

            $alphaToken = preg_replace('/[^a-z]+/', '', $token) ?? '';
            if (strlen($alphaToken) >= 3 && ! in_array($alphaToken, $stopwords, true)) {
                $tokens[$alphaToken] = true;
            }
        }

        return array_keys($tokens);
    }

    private static function domainKeywords(): array
    {
        return [
            'audit' => ['audit'],
            'akuntansi' => ['akuntansi', 'accounting', 'financial'],
            'agama' => ['agama'],
            'bisnis' => ['bisnis', 'business', 'entrepreneurship', 'pelanggan'],
            'data' => ['data', 'mining', 'sains', 'science', 'visualisasi', 'statistika', 'probabilitas'],
            'database' => ['basis', 'database', 'data'],
            'digital' => ['digital', 'literasi'],
            'ecommerce' => ['commerce', 'e commerce', 'pelanggan'],
            'governance' => ['govern', 'governance', 'tata kelola', 'strategi', 'manajemen'],
            'mobile' => ['mobile', 'web', 'pemrograman'],
            'risiko' => ['risiko', 'risk'],
            'sap' => ['sap', 'erp', 'enterprise'],
            'software' => ['rekayasa', 'software', 'pemrograman', 'testing', 'implementasi', 'algoritma'],
            'sistem' => ['sistem', 'informasi', 'arsitektur', 'enterprise'],
            'ux' => ['ux', 'pengguna', 'interaksi', 'human', 'komputer', 'desain'],
        ];
    }

    private static function courseDomainFlags(Course $course): array
    {
        $courseText = self::normalizeText($course->name.' '.$course->code);
        $flags = [];

        foreach (self::domainKeywords() as $domain => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($courseText, self::normalizeText($keyword))) {
                    $flags[$domain] = true;
                    break;
                }
            }
        }

        return array_keys($flags);
    }

    private static function expertiseDomainFlags(string $expertiseText): array
    {
        $text = self::normalizeText($expertiseText);
        $flags = [];

        foreach (self::domainKeywords() as $domain => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($text, self::normalizeText($keyword))) {
                    $flags[$domain] = true;
                    break;
                }
            }
        }

        return array_keys($flags);
    }

    private function rankCoursesFromExpertise(string $expertiseText, array $courses): array
    {
        $expertiseText = trim($expertiseText);
        if ($expertiseText === '') {
            return [];
        }

        $courseIndex = [];
        foreach ($courses as $course) {
            $courseText = self::normalizeText($course->name.' '.$course->code);
            $courseIndex[] = [
                'course' => $course,
                'text' => $courseText,
                'tokens' => self::tokenizeText($course->name.' '.$course->code),
                'domains' => self::courseDomainFlags($course),
            ];
        }

        $segments = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $expertiseText) ?: [])));
        if ($segments === []) {
            $segments = [$expertiseText];
        }

        $expertiseDomains = self::expertiseDomainFlags($expertiseText);
        $scores = [];
        foreach ($courses as $course) {
            $scores[$course->id] = 0;
        }

        foreach ($segments as $segment) {
            $normalizedSegment = self::normalizeText($segment);
            if ($normalizedSegment === '') {
                continue;
            }

            $segmentTokens = self::tokenizeText($segment);
            $segmentDomains = self::expertiseDomainFlags($segment);

            foreach ($courseIndex as $item) {
                $course = $item['course'];
                $score = 0;

                if (str_contains($item['text'], $normalizedSegment)) {
                    $score += 5;
                }

                if (str_contains($normalizedSegment, $item['text']) && strlen($item['text']) >= 10) {
                    $score += 3;
                }

                $overlap = array_intersect($segmentTokens, $item['tokens']);
                $score += count($overlap) * 2;

                $activeDomains = $segmentDomains !== [] ? $segmentDomains : $expertiseDomains;
                $domainOverlap = array_intersect($activeDomains, $item['domains']);
                $score += count($domainOverlap) * 3;

                if ($score > 0) {
                    $scores[$course->id] += $score;
                }
            }
        }

        usort($courses, static function (Course $left, Course $right) use ($scores): int {
            $leftScore = $scores[$left->id] ?? 0;
            $rightScore = $scores[$right->id] ?? 0;

            return [$rightScore, $right->semester ?? 0, $right->credits ?? 0, $right->name] <=> [$leftScore, $left->semester ?? 0, $left->credits ?? 0, $left->name];
        });

        return $courses;
    }

    private function selectAllowedCourses(string $expertiseText, array $courses, int $minSize = 4, int $maxSize = 7): array
    {
        if ($courses === []) {
            return [];
        }

        $ranked = $this->rankCoursesFromExpertise($expertiseText, $courses);
        if ($ranked === []) {
            usort($courses, static fn (Course $left, Course $right): int => [$left->semester ?? 0, $left->name] <=> [$right->semester ?? 0, $right->name]);
            $ranked = $courses;
        }

        $selected = array_slice($ranked, 0, $maxSize);

        if (count($selected) < $minSize) {
            $selectedIds = array_map(static fn (Course $course): int => (int) $course->id, $selected);
            $remaining = array_values(array_filter(
                $courses,
                static fn (Course $course): bool => ! in_array((int) $course->id, $selectedIds, true)
            ));
            usort($remaining, static fn (Course $left, Course $right): int => [$left->semester ?? 0, $left->name] <=> [$right->semester ?? 0, $right->name]);
            $selected = array_merge($selected, array_slice($remaining, 0, $minSize - count($selected)));
        }

        usort($selected, static fn (Course $left, Course $right): int => [$left->semester ?? 0, $left->code, $left->name] <=> [$right->semester ?? 0, $right->code, $right->name]);

        return array_slice($selected, 0, $maxSize);
    }

    private function ensureSystemUser(): User
    {
        $existingByEmail = User::query()->where('email', 'system@local')->first();
        if ($existingByEmail) {
            return $existingByEmail;
        }

        $userWithIdOne = User::query()->find(self::SYSTEM_USER_ID);

        if (! $userWithIdOne) {
            return User::query()->create([
                'id' => self::SYSTEM_USER_ID,
                'name' => 'SYSTEM',
                'email' => 'system@local',
                'password' => Hash::make('SYSTEM'),
                'role' => User::ROLE_ADMIN,
                'created_by' => null,
            ]);
        }

        return User::query()->create([
            'name' => 'SYSTEM',
            'email' => 'system@local',
            'password' => Hash::make('SYSTEM'),
            'role' => User::ROLE_ADMIN,
            'created_by' => $userWithIdOne->id,
        ]);
    }

    /**
     * @return array{0: User, 1: Dataset}
     */
    private function ensureAdminUserAndDataset(int $systemUserId, string $email, string $password, string $name, string $datasetName, string $datasetDescription): array
    {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'role' => User::ROLE_ADMIN,
                'created_by' => $systemUserId,
            ]
        );

        if ($user->role !== User::ROLE_ADMIN) {
            $user->role = User::ROLE_ADMIN;
            $user->save();
        }

        $dataset = Dataset::query()->firstOrCreate(
            ['user_id' => $user->id, 'name' => $datasetName],
            [
                'created_by' => $user->id,
                'code' => 'TMP',
                'description' => $datasetDescription,
                'visibility' => Dataset::VISIBILITY_PRIVATE,
                'color' => self::DEFAULT_DATASET_COLOR,
            ]
        );

        if ($dataset->code === 'TMP' || $dataset->code === '') {
            $dataset->code = sprintf('DS%03d', $dataset->id);
            $dataset->save();
        }

        if (! $dataset->color) {
            $dataset->color = self::DEFAULT_DATASET_COLOR;
            $dataset->save();
        }

        return [$user, $dataset];
    }

    private function syncPrimaryKeySequence(string $table, string $column = 'id'): void
    {
        $qualifiedTable = str_replace("'", "''", $table);
        $qualifiedColumn = str_replace("'", "''", $column);

        DB::statement(
            "SELECT setval(pg_get_serial_sequence('{$qualifiedTable}', '{$qualifiedColumn}'), COALESCE(MAX({$column}), 1), true) FROM {$table}"
        );
    }

    private function resetDatasetResources(int $datasetId): void
    {
        DB::table('bwm_weights')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_best_to_others')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_others_to_worst')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_responses')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_course_preferences')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_time_slot_preferences')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_allowed_courses')->whereIn('lecturer_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('lecturers')->where('dataset_id', $datasetId);
        })->delete();

        ClassModel::query()->where('dataset_id', $datasetId)->delete();
        TimeSlot::query()->where('dataset_id', $datasetId)->delete();
        Course::query()->where('dataset_id', $datasetId)->delete();
        Lecturer::query()->where('dataset_id', $datasetId)->delete();
        Room::query()->where('dataset_id', $datasetId)->delete();
    }

    private function resetMasterMajors(): void
    {
        Major::query()->delete();
    }

    private function nextEmployeeSequence(): int
    {
        return Employee::query()->count() + 1;
    }

    private function ensureEmployeeAndUser(array $row, int $creatorId): Employee
    {
        $email = strtolower(trim((string) ($row['email'] ?? '')));
        $name = trim((string) ($row['name'] ?? ''));

        if ($name === '') {
            throw new \RuntimeException('Lecturer CSV row missing name');
        }

        $user = null;
        if ($email !== '') {
            $user = User::query()->where('email', $email)->first();
        }

        if (! $user) {
            $fallbackEmail = strtolower(preg_replace('/\s+/', '.', $name) ?? $name).'@example.com';
            $user = User::query()->create([
                'name' => $name,
                'email' => $email !== '' ? $email : $fallbackEmail,
                'password' => Hash::make(self::DEFAULT_EMPLOYEE_PASSWORD),
                'role' => User::ROLE_LECTURER,
                'created_by' => $creatorId,
            ]);
        } elseif ($user->role !== User::ROLE_LECTURER) {
            $user->role = User::ROLE_LECTURER;
            $user->save();
        }

        $employee = Employee::query()->where('user_id', $user->id)->first();
        if ($employee) {
            $employee->name = $name;
            $employee->front_title = $row['front_title'] ?: null;
            $employee->back_title = $row['back_title'] ?: null;
            $employee->nidn = $row['nidn'] ?: null;
            $employee->phone = $row['phone'] ?: null;
            $gender = strtoupper(trim((string) ($row['gender'] ?? '')));
            $employee->gender = in_array($gender, ['L', 'P'], true) ? $gender : null;
            $employee->save();

            return $employee;
        }

        $gender = strtoupper(trim((string) ($row['gender'] ?? '')));
        $employee = Employee::query()->create([
            'user_id' => $user->id,
            'created_by' => $creatorId,
            'employee_code' => sprintf('EMP%03d', $this->nextEmployeeSequence()),
            'name' => $name,
            'nidn' => $row['nidn'] ?: null,
            'nip' => null,
            'front_title' => $row['front_title'] ?: null,
            'back_title' => $row['back_title'] ?: null,
            'phone' => $row['phone'] ?: null,
            'gender' => in_array($gender, ['L', 'P'], true) ? $gender : null,
        ]);

        return $employee;
    }

    private function createMajor(int $creatorId): Major
    {
        return Major::query()->create([
            'created_by' => $creatorId,
            'code' => 'MJR001',
            'name' => self::DEFAULT_MAJOR_NAME,
            'description' => 'Master major seeded from DatabaseSeeder',
        ]);
    }

    private function seedCoursesFromCsv(Dataset $dataset, int $creatorId, Major $major): int
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'courses.csv');
        $inserted = 0;

        foreach ($rows as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            Course::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'name' => $name,
                'code' => $code,
                'major_id' => $major->id,
                'credits' => (int) ($row['credits'] ?: 0),
                'semester' => $this->toIntOrNull($row['semester'] ?? null),
                'curriculum_year' => $this->toIntOrNull($row['curriculum_year'] ?? null),
                'description' => trim((string) ($row['description'] ?? '')) !== '' ? trim((string) $row['description']) : null,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} courses from CSV.\n";

        return $inserted;
    }

    private function seedRoomsFromCsv(Dataset $dataset, int $creatorId): int
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'rooms.csv');
        $inserted = 0;

        foreach ($rows as $row) {
            $buildingName = trim((string) ($row['building_name'] ?? ''));
            $buildingCode = trim((string) ($row['building_code'] ?? ''));
            $floor = $this->toIntOrNull($row['floor'] ?? null);
            $roomNumber = $this->toIntOrNull($row['room_number'] ?? null);
            $code = trim((string) ($row['code'] ?? ''));

            if ($buildingName === '' || $buildingCode === '' || $floor === null || $roomNumber === null || $code === '') {
                continue;
            }

            $roomType = strtoupper(trim((string) ($row['room_type'] ?? '')));
            if (! in_array($roomType, ['TEORI', 'LABORATORIUM', 'AULA', 'SEMINAR'], true)) {
                $roomType = null;
            }

            Room::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'building_name' => $buildingName,
                'building_code' => $buildingCode,
                'floor' => $floor,
                'room_number' => $roomNumber,
                'code' => $code,
                'capacity' => self::DEFAULT_ROOM_CAPACITY,
                'room_type' => $roomType,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} rooms from CSV.\n";

        return $inserted;
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    private function buildSlotsFromRange(string $startTime, string $endTime, int $minutes): array
    {
        $slots = [];
        $start = \DateTimeImmutable::createFromFormat('H:i', $startTime);
        $end = \DateTimeImmutable::createFromFormat('H:i', $endTime);
        $breakStart = \DateTimeImmutable::createFromFormat('H:i', self::BREAK_START);
        $breakEnd = \DateTimeImmutable::createFromFormat('H:i', self::BREAK_END);

        if (! $start || ! $end || ! $breakStart || ! $breakEnd) {
            throw new \RuntimeException('Invalid timeslot configuration');
        }

        $cursor = $start;
        $delta = new \DateInterval('PT'.$minutes.'M');

        while ($cursor < $end) {
            $slotStart = $cursor->format('H:i');
            if ($cursor >= $breakStart && $cursor < $breakEnd) {
                $cursor = $breakEnd;
                continue;
            }

            $slotEndCursor = $cursor->add($delta);
            $slots[] = [$slotStart, $slotEndCursor->format('H:i')];
            $cursor = $slotEndCursor;
        }

        return $slots;
    }

    private function seedTimeSlotsFromCsv(Dataset $dataset, int $creatorId): int
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'timeslots.csv');
        if ($rows === []) {
            return 0;
        }

        $config = $rows[0];
        $minutes = (int) ($config['per_sks_minutes'] ?: 40);
        $startTime = $config['start_time'] ?: '07:00';
        $endTime = $config['end_time'] ?: '23:00';
        $blocks = $this->buildSlotsFromRange($startTime, $endTime, $minutes);

        $sequence = 1;
        foreach (self::DAYS as $day) {
            foreach ($blocks as [$slotStart, $slotEnd]) {
                TimeSlot::query()->create([
                    'dataset_id' => $dataset->id,
                    'created_by' => $creatorId,
                    'code' => sprintf('TS%03d', $sequence),
                    'day' => $day,
                    'start_time' => $slotStart,
                    'end_time' => $slotEnd,
                ]);
                $sequence++;
            }
        }

        $inserted = count($blocks) * count(self::DAYS);
        echo "Inserted {$inserted} time slots from CSV config.\n";

        return $inserted;
    }

    private function seedClassesFromCsv(Dataset $dataset, int $creatorId, Major $major): int
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'classes.csv');
        $inserted = 0;

        foreach ($rows as $index => $row) {
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            ClassModel::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'name' => $name,
                'code' => sprintf('KLS%03d', $index + 1),
                'major_id' => $major->id,
                'academic_year' => $this->toIntOrNull($row['academic_year'] ?? null),
                'semester' => $this->toIntOrNull($row['semester'] ?? null),
                'study_program' => trim((string) ($row['study_program'] ?? '')) !== '' ? trim((string) $row['study_program']) : self::DEFAULT_MAJOR_NAME,
                'capacity' => $this->toIntOrNull($row['capacity'] ?? null),
                'description' => trim((string) ($row['description'] ?? '')) !== '' ? trim((string) $row['description']) : null,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} classes from CSV.\n";

        return $inserted;
    }

    private function seedLecturersFromCsv(Dataset $dataset, int $creatorId): int
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturers.csv');
        $inserted = 0;

        foreach ($rows as $index => $row) {
            if (strtolower(trim((string) ($row['name'] ?? ''))) === 'name') {
                continue;
            }

            $employee = $this->ensureEmployeeAndUser($row, $creatorId);
            $code = sprintf('%s-L%03d', $dataset->code, $index + 1);

            Lecturer::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $creatorId,
                'employee_id' => $employee->id,
                'code' => $code,
            ]);
            $inserted++;
        }

        echo "Inserted {$inserted} lecturer assignments from CSV.\n";

        return $inserted;
    }

    private function buildLecturerCsvLookup(): array
    {
        $rows = $this->readCsvRows($this->csvDir().DIRECTORY_SEPARATOR.'lecturers.csv');
        $byNidn = [];
        $byEmail = [];
        $byName = [];

        foreach ($rows as $row) {
            if (strtolower(trim((string) ($row['name'] ?? ''))) === 'name') {
                continue;
            }

            $nidn = trim((string) ($row['nidn'] ?? ''));
            $email = strtolower(trim((string) ($row['email'] ?? '')));
            $name = strtolower(trim((string) ($row['name'] ?? '')));

            if ($nidn !== '' && ! isset($byNidn[$nidn])) {
                $byNidn[$nidn] = $row;
            }

            if ($email !== '' && ! isset($byEmail[$email])) {
                $byEmail[$email] = $row;
            }

            if ($name !== '' && ! isset($byName[$name])) {
                $byName[$name] = $row;
            }
        }

        return [$byNidn, $byEmail, $byName];
    }

    private function normalizeNidn(?string $value): string
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
     * @return array<string, list<array{code: string, rank: int}> >
     */
    private function readLecturerCoursesCsv(): array
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

    private function seedLecturerAllowedResources(Dataset $dataset, int $creatorId): void
    {
        $lecturers = Lecturer::query()->with('employee.user')->where('dataset_id', $dataset->id)->get();
        $courses = Course::query()->where('dataset_id', $dataset->id)->get()->all();
        $courseByCode = [];
        foreach ($courses as $course) {
            $courseByCode[$course->code] = $course;
        }

        $mappings = $this->readLecturerCoursesCsv();
        $allowedCoursesCount = 0;
        $skippedLecturers = 0;

        foreach ($lecturers as $lecturer) {
            $employee = $lecturer->employee;
            $nidn = $this->normalizeNidn($employee?->nidn);
            $entries = $mappings[$nidn] ?? [];

            if ($entries === []) {
                $skippedLecturers++;
                continue;
            }

            foreach ($entries as $entry) {
                $course = $courseByCode[$entry['code']] ?? null;
                if ($course === null) {
                    throw new \RuntimeException(
                        "Course code {$entry['code']} not found in dataset for lecturer nidn={$nidn}"
                    );
                }

                DB::table('lecturer_allowed_courses')->insert([
                    'lecturer_id' => $lecturer->id,
                    'course_id' => $course->id,
                    'created_by' => $creatorId,
                    'created_at' => now(),
                ]);
                $allowedCoursesCount++;
            }
        }

        echo "Inserted {$allowedCoursesCount} lecturer-course allowed relationships.\n";
        echo "Skipped {$skippedLecturers} lecturers without lecturer_courses.csv mappings.\n";
        echo "Lecturer allowed time slots were not seeded.\n";
    }

    private function seedCriteria(int $creatorId): void
    {
        $inserted = 0;

        foreach (self::SOFT_CRITERIA as [$code, $name, $description, $isLecturerPreference]) {
            if (! DB::table('criteria')->where('code', $code)->exists()) {
                DB::table('criteria')->insert([
                    'created_by' => $creatorId,
                    'type' => 'SOFT',
                    'code' => $code,
                    'name' => $name,
                    'description' => $description,
                    'is_lecturer_preference' => $isLecturerPreference,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $inserted++;
            }
        }

        foreach (self::HARD_CRITERIA as [$code, $name, $description]) {
            if (! DB::table('criteria')->where('code', $code)->exists()) {
                DB::table('criteria')->insert([
                    'created_by' => $creatorId,
                    'type' => 'HARD',
                    'code' => $code,
                    'name' => $name,
                    'description' => $description,
                    'is_lecturer_preference' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $inserted++;
            }
        }

        echo "Seeded {$inserted} criteria (skipped duplicates).\n";
    }

    /**
     * @return array{0:int,1:int}
     */
    private function seedLecturerPreferencesForDataset(Dataset $dataset, int $createdBy): array
    {
        $lecturers = Lecturer::query()->with('employee.user')->where('dataset_id', $dataset->id)->get();
        $courses = Course::query()->where('dataset_id', $dataset->id)->get()->all();
        $courseByCode = [];
        foreach ($courses as $course) {
            $courseByCode[$course->code] = $course;
        }

        $mappings = $this->readLecturerCoursesCsv();

        DB::table('lecturer_course_preferences')->where('dataset_id', $dataset->id)->delete();
        DB::table('lecturer_time_slot_preferences')->where('dataset_id', $dataset->id)->delete();

        $seededCoursePreferences = 0;
        $skippedCoursePreferences = 0;

        foreach ($lecturers as $lecturer) {
            $employee = $lecturer->employee;
            $nidn = $this->normalizeNidn($employee?->nidn);
            $entries = $mappings[$nidn] ?? [];

            if ($entries === []) {
                $skippedCoursePreferences++;
                continue;
            }

            foreach ($entries as $entry) {
                $course = $courseByCode[$entry['code']] ?? null;
                if ($course === null) {
                    throw new \RuntimeException(
                        "Course code {$entry['code']} not found in dataset for lecturer nidn={$nidn}"
                    );
                }

                DB::table('lecturer_course_preferences')->insert([
                    'dataset_id' => $dataset->id,
                    'lecturer_id' => $lecturer->id,
                    'course_id' => $course->id,
                    'rank_order' => $entry['rank'],
                    'created_by' => $createdBy,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $seededCoursePreferences++;
            }
        }

        return [$seededCoursePreferences, $skippedCoursePreferences];
    }

    private function toIntOrNull(?string $value): ?int
    {
        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        return (int) $text;
    }
}
