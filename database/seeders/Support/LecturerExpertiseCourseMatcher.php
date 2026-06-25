<?php

namespace Database\Seeders\Support;

final class LecturerExpertiseCourseMatcher
{
    public const DEFAULT_MIN_SCORE = 2;

    public const MAX_ALLOWED_COURSES_PER_LECTURER = 12;

    /** @var list<string> */
    private const SHARED_ELIGIBILITY_COURSE_CODES = [
        'UTM62101',
        'SIF62137',
        'SIF62243',
        'SIF62240',
    ];

    /**
     * @param  list<array<string, string>>  $courseRows
     * @return list<array{code: string, score: int, rank: int}>
     */
    public function matchCourses(string $expertise, array $courseRows, int $minScore = self::DEFAULT_MIN_SCORE): array
    {
        $expertise = trim($expertise);
        if ($expertise === '') {
            return [];
        }

        $scored = [];
        foreach ($courseRows as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            $score = $this->scoreCourse(
                $expertise,
                $name,
                $code,
                trim((string) ($row['description'] ?? '')),
            );
            if ($score >= $minScore) {
                $scored[] = ['code' => $code, 'score' => $score];
            }
        }

        if ($scored === []) {
            $scored = $this->fallbackMatches($courseRows);
        }

        usort($scored, static function (array $left, array $right): int {
            return [$right['score'], $left['code']] <=> [$left['score'], $right['code']];
        });

        $ranked = [];
        foreach ($scored as $index => $item) {
            $ranked[] = [
                'code' => $item['code'],
                'score' => $item['score'],
                'rank' => $index + 1,
            ];
        }

        return $ranked;
    }

    /**
     * @param  list<array<string, string>>  $lecturerRows
     * @param  list<array<string, string>>  $courseRows
     * @return array<string, list<array{code: string, score: int, rank: int}>>
     */
    public function buildNidnMappings(array $lecturerRows, array $courseRows, int $minScore = self::DEFAULT_MIN_SCORE): array
    {
        $byNidn = [];

        foreach ($lecturerRows as $row) {
            if (strtolower(trim((string) ($row['name'] ?? ''))) === 'name') {
                continue;
            }

            $nidn = $this->normalizeNidn($row['nidn'] ?? null);
            if ($nidn === '') {
                continue;
            }

            $expertise = trim((string) ($row['expertise'] ?? ''));
            $byNidn[$nidn] = $this->limitEntries(
                $this->matchCourses($expertise, $courseRows, $minScore),
                self::MAX_ALLOWED_COURSES_PER_LECTURER,
            );
        }

        return $this->supplementSharedEligibility($byNidn, $lecturerRows, $courseRows, $minScore);
    }

    /**
     * @param  array<string, list<array{code: string, score: int, rank: int}>>  $byNidn
     * @param  list<array<string, string>>  $lecturerRows
     * @param  list<array<string, string>>  $courseRows
     * @return array<string, list<array{code: string, score: int, rank: int}>>
     */
    private function supplementSharedEligibility(
        array $byNidn,
        array $lecturerRows,
        array $courseRows,
        int $minScore,
    ): array {
        foreach ($lecturerRows as $row) {
            if (strtolower(trim((string) ($row['name'] ?? ''))) === 'name') {
                continue;
            }

            $nidn = $this->normalizeNidn($row['nidn'] ?? null);
            if ($nidn === '') {
                continue;
            }

            $expertise = trim((string) ($row['expertise'] ?? ''));
            $fullMatches = $this->matchCourses($expertise, $courseRows, $minScore);
            $entries = $byNidn[$nidn] ?? [];
            $existing = array_fill_keys(array_column($entries, 'code'), true);

            foreach (self::SHARED_ELIGIBILITY_COURSE_CODES as $sharedCode) {
                foreach ($fullMatches as $item) {
                    if ($item['code'] !== $sharedCode || isset($existing[$item['code']])) {
                        continue;
                    }

                    $entries[] = [
                        'code' => $item['code'],
                        'score' => $item['score'],
                        'rank' => count($entries) + 1,
                    ];
                    $existing[$item['code']] = true;
                }

                if ($sharedCode === 'UTM62101' && ! isset($existing['UTM62101']) && $this->expertiseMatchesLiterasiDigital($expertise)) {
                    $entries[] = [
                        'code' => 'UTM62101',
                        'score' => self::DEFAULT_MIN_SCORE,
                        'rank' => count($entries) + 1,
                    ];
                    $existing['UTM62101'] = true;
                }
            }

            $byNidn[$nidn] = $entries;
        }

        return $byNidn;
    }

    private function expertiseMatchesLiterasiDigital(string $expertise): bool
    {
        $text = self::normalizeText($expertise);
        foreach (['digital', 'marketing', 'literasi', 'e commerce', 'ecommerce'] as $keyword) {
            if (str_contains($text, self::normalizeText($keyword))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<array{code: string, score: int, rank: int}>  $entries
     * @return list<array{code: string, score: int, rank: int}>
     */
    private function limitEntries(array $entries, int $max): array
    {
        if (count($entries) <= $max) {
            return $entries;
        }

        $limited = array_slice($entries, 0, $max);
        foreach ($limited as $index => $entry) {
            $limited[$index]['rank'] = $index + 1;
        }

        return $limited;
    }

    /**
     * @param  array<string, list<array{code: string, score: int, rank: int}>>  $mappings
     * @return list<string>
     */
    public function unionCourseCodes(array $mappings): array
    {
        $codes = [];
        foreach ($mappings as $entries) {
            foreach ($entries as $entry) {
                $codes[$entry['code']] = true;
            }
        }

        $list = array_keys($codes);
        sort($list);

        return $list;
    }

    /**
     * @param  list<array<string, string>>  $courseRows
     * @return list<array{code: string, score: int}>
     */
    private function fallbackMatches(array $courseRows): array
    {
        $fallback = [];
        foreach ($courseRows as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            $name = trim((string) ($row['name'] ?? ''));
            if ($code === '' || $name === '') {
                continue;
            }

            $text = self::normalizeText($name.' '.$code);
            if (str_contains($text, 'sistem informasi') || str_contains($text, 'manajemen sistem informasi')) {
                $fallback[] = ['code' => $code, 'score' => 1];
            }
        }

        usort($fallback, static fn (array $a, array $b): int => [$b['score'], $a['code']] <=> [$a['score'], $b['code']]);

        return array_slice($fallback, 0, 3);
    }

    private function scoreCourse(string $expertise, string $name, string $code, string $description): int
    {
        $courseText = self::normalizeText($name.' '.$code.' '.$description);
        $courseDomains = self::courseDomainFlags($courseText);
        $courseTokens = self::tokenizeText($name.' '.$code.' '.$description);

        $segments = array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $expertise) ?: [])));
        if ($segments === []) {
            $segments = [$expertise];
        }

        $expertiseDomains = self::expertiseDomainFlags($expertise);
        $score = 0;

        foreach ($segments as $segment) {
            $normalizedSegment = self::normalizeText($segment);
            if ($normalizedSegment === '') {
                continue;
            }

            if (str_contains($courseText, $normalizedSegment)) {
                $score += 5;
            }

            if (str_contains($normalizedSegment, $courseText) && strlen($courseText) >= 10) {
                $score += 3;
            }

            $segmentTokens = self::tokenizeText($segment);
            $score += count(array_intersect($segmentTokens, $courseTokens)) * 2;

            $segmentDomains = self::expertiseDomainFlags($segment);
            $activeDomains = $segmentDomains !== [] ? $segmentDomains : $expertiseDomains;
            $score += count(array_intersect($activeDomains, $courseDomains)) * 3;
        }

        return $score;
    }

    /**
     * @return array<string, list<string>>
     */
    private static function domainKeywords(): array
    {
        return [
            'audit' => ['audit'],
            'akuntansi' => ['akuntansi', 'accounting', 'financial'],
            'agama' => ['agama'],
            'bisnis' => ['bisnis', 'business', 'entrepreneurship', 'pelanggan', 'crm', 'hubungan pelanggan'],
            'data' => ['data', 'mining', 'sains', 'science', 'visualisasi', 'statistika', 'probabilitas', 'intelligence'],
            'database' => ['basis', 'database', 'data'],
            'digital' => ['digital', 'literasi', 'literacy', 'forensik'],
            'ecommerce' => ['commerce', 'e commerce', 'ecommerce', 'pelanggan', 'marketing'],
            'governance' => ['govern', 'governance', 'tata kelola', 'strategi', 'manajemen', 'erp', 'mrp', 'procurement', 'investasi', 'investment'],
            'mobile' => ['mobile', 'web', 'pemrograman', 'programming', 'software', 'rekayasa perangkat lunak'],
            'risiko' => ['risiko', 'risk'],
            'sap' => ['sap', 'erp', 'enterprise'],
            'software' => ['rekayasa', 'software', 'pemrograman', 'testing', 'implementasi', 'algoritma', 'capstone', 'apsi'],
            'sistem' => ['sistem', 'informasi', 'arsitektur', 'enterprise', 'smart city'],
            'ux' => ['ux', 'pengguna', 'interaksi', 'human', 'komputer', 'desain', 'pengalaman'],
            'security' => ['keamanan', 'security', 'forensik'],
            'egovernment' => ['e government', 'egovernment', 'e government', 'government'],
        ];
    }

    /**
     * @return list<string>
     */
    private static function courseDomainFlags(string $courseText): array
    {
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

    /**
     * @return list<string>
     */
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

    private static function normalizeText(?string $value): string
    {
        $text = strtolower(trim((string) $value));
        $text = preg_replace('/[^a-z0-9]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }

    /**
     * @return list<string>
     */
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
}
