<?php

namespace Tests\Unit;

use App\Services\Bwm\BwmMatrixSampler;
use App\Services\Bwm\BwmValidator;
use App\Services\BwmWeightCalculator;
use PHPUnit\Framework\TestCase;

class BwmValidatorTest extends TestCase
{
    private BwmValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new BwmValidator(new BwmWeightCalculator);
    }

    public function test_consistent_linear_matrix_is_valid_with_low_cr(): void
    {
        $criterionIds = [101, 102, 103, 104, 105];
        $bestId = 101;
        $worstId = 105;

        $bestToOthers = [
            101 => 1,
            102 => 1,
            103 => 1,
            104 => 2,
            105 => 2,
        ];
        $othersToWorst = [
            101 => 2,
            102 => 2,
            103 => 1,
            104 => 1,
            105 => 1,
        ];

        $result = $this->validator->validate(
            $criterionIds,
            $bestId,
            $worstId,
            $bestToOthers,
            $othersToWorst,
        );

        $this->assertTrue($result->isValid());
        $this->assertSame([], $result->errors());
        $this->assertSame([], $result->warnings());
        $this->assertNotNull($result->consistencyRatio());
        $this->assertLessThanOrEqual(BwmValidator::MAX_RECOMMENDED_CONSISTENCY_RATIO, $result->consistencyRatio());
    }

    public function test_same_best_and_worst_returns_error(): void
    {
        $criterionIds = [1, 2, 3];

        $result = $this->validator->validate(
            $criterionIds,
            1,
            1,
            [1 => 1, 2 => 2, 3 => 3],
            [1 => 1, 2 => 2, 3 => 3],
        );

        $this->assertFalse($result->isValid());
        $this->assertStringContainsString('different', $result->firstError() ?? '');
    }

    public function test_out_of_range_values_return_error(): void
    {
        $criterionIds = [1, 2, 3];

        $result = $this->validator->validate(
            $criterionIds,
            1,
            3,
            [1 => 1, 2 => 10, 3 => 2],
            [1 => 3, 2 => 2, 3 => 1],
        );

        $this->assertFalse($result->isValid());
        $this->assertStringContainsString('between 1 and 9', $result->firstError() ?? '');
    }

    public function test_best_bto_not_one_returns_error(): void
    {
        $criterionIds = [1, 2, 3];

        $result = $this->validator->validate(
            $criterionIds,
            1,
            3,
            [1 => 2, 2 => 2, 3 => 3],
            [1 => 3, 2 => 2, 3 => 1],
        );

        $this->assertFalse($result->isValid());
        $this->assertStringContainsString('best_to_others', $result->firstError() ?? '');
    }

    public function test_extreme_inconsistent_matrix_returns_warning(): void
    {
        $criterionIds = [1, 2, 3, 4, 5];

        $result = $this->validator->validate(
            $criterionIds,
            1,
            5,
            [1 => 1, 2 => 9, 3 => 1, 4 => 9, 5 => 5],
            [1 => 9, 2 => 1, 3 => 9, 4 => 1, 5 => 1],
        );

        $this->assertTrue($result->isValid());
        $this->assertNotEmpty($result->warnings());
        $this->assertNotEmpty($result->suggestions());
        $this->assertGreaterThan(BwmValidator::MAX_RECOMMENDED_CONSISTENCY_RATIO, $result->consistencyRatio());
    }
}
