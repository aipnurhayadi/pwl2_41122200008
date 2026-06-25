<?php

namespace Tests\Unit\Seeders;

use Database\Seeders\Support\LecturerExpertiseCourseMatcher;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LecturerExpertiseCourseMatcherTest extends TestCase
{
    /**
     * @return list<array<string, string>>
     */
    private function courseRows(): array
    {
        $path = base_path('datasets/sistem_informasi/courses.csv');
        $handle = fopen($path, 'rb');
        $this->assertNotFalse($handle);

        $headers = fgetcsv($handle);
        $this->assertNotFalse($headers);

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = array_combine($headers, $row);
        }
        fclose($handle);

        return $rows;
    }

    /**
     * @return list<string>
     */
    private function matchedCodes(string $expertise): array
    {
        $matcher = new LecturerExpertiseCourseMatcher;

        return array_column($matcher->matchCourses($expertise, $this->courseRows()), 'code');
    }

    public function test_sap_expertise_matches_sap_and_related_courses(): void
    {
        $codes = $this->matchedCodes(
            'System Application and Product (SAP), Sistem Informasi, Enterprise Resource Planning, Enterprise Architecture, Audit Teknologi Informasi'
        );

        $this->assertContains('SIF62120', $codes);
        $this->assertContains('SIF61112', $codes);
        $this->assertContains('SIF62139', $codes);
        $this->assertContains('SIF61122', $codes);
    }

    public function test_web_mobile_expertise_matches_programming_and_ux_courses(): void
    {
        $codes = $this->matchedCodes(
            'Web & Mobile Programming, Smart City, Information System Development, UX-Design'
        );

        $this->assertContains('SIF61111', $codes);
        $this->assertContains('SIF62118', $codes);
        $this->assertContains('SIF62119', $codes);
    }

    public function test_ecommerce_expertise_does_not_match_unrelated_probability_course(): void
    {
        $codes = $this->matchedCodes('E-Commerce, E-Government, Digital Marketing');

        $this->assertContains('SIF62240', $codes);
        $this->assertContains('SIF61114', $codes);
        $this->assertNotContains('ENG61109', $codes);
    }

    public function test_data_science_expertise_matches_data_courses(): void
    {
        $codes = $this->matchedCodes(
            'Data Science, Information System Development, Software Engineering, Business Intelligence'
        );

        $this->assertContains('SIF62115', $codes);
        $this->assertContains('SIF61229', $codes);
        $this->assertContains('ENG62110', $codes);
    }

    public function test_union_course_codes_returns_sorted_unique_codes(): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $mappings = [
            '0001116801' => [
                ['code' => 'SIF62120', 'score' => 8, 'rank' => 1],
                ['code' => 'SIF61112', 'score' => 5, 'rank' => 2],
            ],
            '0420088701' => [
                ['code' => 'SIF61111', 'score' => 8, 'rank' => 1],
                ['code' => 'SIF61112', 'score' => 5, 'rank' => 2],
            ],
        ];

        $this->assertSame(
            ['SIF61111', 'SIF61112', 'SIF62120'],
            $matcher->unionCourseCodes($mappings)
        );
    }

    public function test_build_nidn_mappings_caps_allowed_courses_at_twelve(): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $courseRows = $this->courseRows();
        $mappings = $matcher->buildNidnMappings($this->readLecturerCsvRows(), $courseRows);

        foreach ($mappings as $nidn => $entries) {
            $this->assertLessThanOrEqual(
                LecturerExpertiseCourseMatcher::MAX_ALLOWED_COURSES_PER_LECTURER + count(['UTM62101', 'SIF62137', 'SIF62243', 'SIF62240']),
                count($entries),
                "Expected at most capped+supplemental courses for nidn {$nidn}"
            );
        }

        $uncapped = count($matcher->matchCourses(
            'Enterprise Architecture, Perencanaan Strategi Sistem Informasi, Rekayasa Perangkat Lunak, Information System Development, E-Goverment, E-Commerce',
            $courseRows,
        ));
        $this->assertGreaterThan(LecturerExpertiseCourseMatcher::MAX_ALLOWED_COURSES_PER_LECTURER, $uncapped);
    }

    public function test_shared_eligibility_courses_reach_multiple_lecturers(): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $mappings = $matcher->buildNidnMappings($this->readLecturerCsvRows(), $this->courseRows());

        $targets = ['UTM62101', 'SIF62137', 'SIF62243'];
        foreach ($targets as $code) {
            $nidns = [];
            foreach ($mappings as $nidn => $entries) {
                foreach ($entries as $entry) {
                    if ($entry['code'] === $code) {
                        $nidns[] = $nidn;
                        break;
                    }
                }
            }

            $this->assertGreaterThan(
                1,
                count($nidns),
                "Expected course {$code} to be allowed for more than one lecturer"
            );
        }
    }

    #[DataProvider('lecturerCsvProvider')]
    public function test_build_nidn_mappings_produces_matches_for_all_seed_lecturers(string $nidn): void
    {
        $matcher = new LecturerExpertiseCourseMatcher;
        $lecturerRows = $this->readLecturerCsvRows();
        $mappings = $matcher->buildNidnMappings($lecturerRows, $this->courseRows());

        $this->assertNotEmpty($mappings[$nidn] ?? [], "Expected matches for nidn {$nidn}");
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function lecturerCsvProvider(): array
    {
        return [
            'sap lecturer' => ['0001116801'],
            'web mobile lecturer' => ['0420088701'],
            'ecommerce lecturer' => ['0428078501'],
            'data science lecturer' => ['0422107705'],
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function readLecturerCsvRows(): array
    {
        $path = base_path('datasets/sistem_informasi/lecturers.csv');
        $handle = fopen($path, 'rb');
        $this->assertNotFalse($handle);

        $headers = fgetcsv($handle);
        $this->assertNotFalse($headers);

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            $rows[] = array_combine($headers, $row);
        }
        fclose($handle);

        return $rows;
    }
}
