<?php

namespace Tests\Unit;

use App\Services\Bwm\BwmMatrixSampler;
use App\Services\Bwm\BwmValidator;
use App\Services\BwmWeightCalculator;
use PHPUnit\Framework\TestCase;

class BwmMatrixSamplerTest extends TestCase
{
    public function test_samples_for_each_lecturer_index_are_valid(): void
    {
        $sampler = new BwmMatrixSampler;
        $validator = new BwmValidator(new BwmWeightCalculator);
        $criterionIds = [11, 12, 13, 14, 15];

        for ($index = 0; $index < 12; $index++) {
            $sample = $sampler->sampleForLecturerIndex($criterionIds, $index);

            $this->assertNotSame(
                $sample['best_criteria_id'],
                $sample['worst_criteria_id'],
            );

            $result = $validator->validate(
                $criterionIds,
                $sample['best_criteria_id'],
                $sample['worst_criteria_id'],
                $sample['best_to_others'],
                $sample['others_to_worst'],
            );

            $this->assertTrue($result->isValid(), "Sample index {$index} should be valid");
            $this->assertSame([], $result->warnings(), "Sample index {$index} should have low CR");
            $this->assertSame(1, $sample['best_to_others'][$sample['best_criteria_id']]);
            $this->assertSame(1, $sample['others_to_worst'][$sample['worst_criteria_id']]);
        }
    }

    public function test_sample_builds_monotonic_matrices(): void
    {
        $sampler = new BwmMatrixSampler;
        $criterionIds = [1, 2, 3, 4, 5];

        $sample = $sampler->sample($criterionIds, 1, 5);

        $this->assertSame([1, 1, 1, 2, 2], array_values($sample['best_to_others']));
        $this->assertSame([2, 2, 1, 1, 1], array_values($sample['others_to_worst']));
    }
}
