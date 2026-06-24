<?php

namespace Tests\Unit;

use App\Services\Timetable\TimetableFairnessAnalyzer;
use PHPUnit\Framework\TestCase;

class TimetableFairnessAnalyzerTest extends TestCase
{
    private TimetableFairnessAnalyzer $analyzer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->analyzer = new TimetableFairnessAnalyzer;
    }

    public function test_empty_penalties_returns_perfect_fairness(): void
    {
        $result = $this->analyzer->analyze([]);

        $this->assertSame(1.0, $result['fairness_index']);
        $this->assertSame([], $result['deviations']);
    }

    public function test_equal_penalties_yield_fairness_index_one(): void
    {
        $result = $this->analyzer->analyze([
            1 => 10.0,
            2 => 10.0,
            3 => 10.0,
        ]);

        $this->assertSame(1.0, $result['fairness_index']);
        $this->assertEqualsWithDelta(0.0, $result['deviations'][1], 0.0001);
        $this->assertEqualsWithDelta(0.0, $result['deviations'][2], 0.0001);
        $this->assertEqualsWithDelta(0.0, $result['deviations'][3], 0.0001);
    }

    public function test_unequal_penalties_compute_fairness_index_and_deviations(): void
    {
        $penalties = [
            1 => 4.0,
            2 => 8.0,
            3 => 12.0,
        ];

        $result = $this->analyzer->analyze($penalties);
        $mean = 8.0;
        $variance = ((4 - 8) ** 2 + (8 - 8) ** 2 + (12 - 8) ** 2) / 3;
        $stddev = sqrt($variance);
        $expectedFairness = max(0.0, 1.0 - ($stddev / $mean));

        $this->assertEqualsWithDelta($expectedFairness, $result['fairness_index'], 0.0001);
        $this->assertEqualsWithDelta(4.0, $result['deviations'][1], 0.0001);
        $this->assertEqualsWithDelta(0.0, $result['deviations'][2], 0.0001);
        $this->assertEqualsWithDelta(4.0, $result['deviations'][3], 0.0001);
    }
}
