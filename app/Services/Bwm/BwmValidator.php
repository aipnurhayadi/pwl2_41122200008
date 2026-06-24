<?php

namespace App\Services\Bwm;

use App\Services\BwmWeightCalculator;

class BwmValidator
{
    public const MAX_RECOMMENDED_CONSISTENCY_RATIO = 0.10;

    public function __construct(
        private readonly BwmWeightCalculator $calculator,
    ) {}

    /**
     * @param  list<int>  $criterionIds
     * @param  array<int, int>  $bestToOthers
     * @param  array<int, int>  $othersToWorst
     */
    public function validate(
        array $criterionIds,
        int $bestCriteriaId,
        int $worstCriteriaId,
        array $bestToOthers,
        array $othersToWorst,
    ): BwmValidationResult {
        $errors = $this->validateStructure(
            $criterionIds,
            $bestCriteriaId,
            $worstCriteriaId,
            $bestToOthers,
            $othersToWorst,
        );

        if ($errors !== []) {
            return new BwmValidationResult(
                errors: $errors,
                suggestions: $this->suggestionsForStructuralErrors(),
            );
        }

        $result = $this->calculator->calculate(
            $criterionIds,
            $bestCriteriaId,
            $worstCriteriaId,
            $bestToOthers,
            $othersToWorst,
        );

        $warnings = [];
        $suggestions = [];
        $consistencyRatio = $result['consistency_ratio'];

        if ($consistencyRatio !== null && $consistencyRatio > self::MAX_RECOMMENDED_CONSISTENCY_RATIO) {
            $warnings[] = sprintf(
                'Consistency Ratio %.3f melebihi ambang rekomendasi %.2f.',
                $consistencyRatio,
                self::MAX_RECOMMENDED_CONSISTENCY_RATIO,
            );
            $suggestions = $this->suggestionsForHighCr($consistencyRatio);
        }

        return new BwmValidationResult(
            warnings: $warnings,
            suggestions: $suggestions,
            ksi: $result['ksi'],
            consistencyRatio: $consistencyRatio,
            weights: $result['weights'],
        );
    }

    /**
     * @return list<string>
     */
    public function suggestionsForHighCr(float $consistencyRatio): array
    {
        return [
            sprintf(
                'Consistency Ratio saat ini %.3f; target rekomendasi ≤ %.2f.',
                $consistencyRatio,
                self::MAX_RECOMMENDED_CONSISTENCY_RATIO,
            ),
            'Pastikan nilai best criterion di Best-to-Others = 1, dan nilai worst criterion di Others-to-Worst = 1.',
            'Buat skala monoton: criterion semakin dekat ke best memiliki nilai BTO lebih kecil; semakin jauh dari worst memiliki nilai OTW lebih besar.',
            'Hindari lonjakan ekstrem (misalnya 1 di satu baris dan 9 di baris bersebelahan tanpa gradasi).',
        ];
    }

    /**
     * @return list<string>
     */
    private function suggestionsForStructuralErrors(): array
    {
        return [
            'Pilih best dan worst criterion yang berbeda dari daftar soft constraint.',
            'Isi nilai 1–9 untuk semua criterion di kedua matriks Best-to-Others dan Others-to-Worst.',
            'Nilai untuk best criterion di Best-to-Others harus 1; nilai untuk worst criterion di Others-to-Worst harus 1.',
        ];
    }

    /**
     * @param  list<int>  $criterionIds
     * @param  array<int, int>  $bestToOthers
     * @param  array<int, int>  $othersToWorst
     * @return list<string>
     */
    private function validateStructure(
        array $criterionIds,
        int $bestCriteriaId,
        int $worstCriteriaId,
        array $bestToOthers,
        array $othersToWorst,
    ): array {
        $errors = [];

        if ($bestCriteriaId <= 0 || $worstCriteriaId <= 0) {
            $errors[] = 'best_criteria_id and worst_criteria_id are required';
        }

        if ($bestCriteriaId === $worstCriteriaId) {
            $errors[] = 'best and worst criteria must be different';
        }

        if ($criterionIds === []) {
            $errors[] = 'No soft criteria configured';
        }

        $validIds = array_flip($criterionIds);
        if ($bestCriteriaId > 0 && ! isset($validIds[$bestCriteriaId])) {
            $errors[] = 'best criterion is invalid';
        }
        if ($worstCriteriaId > 0 && ! isset($validIds[$worstCriteriaId])) {
            $errors[] = 'worst criterion is invalid';
        }

        foreach ($criterionIds as $criterionId) {
            if (! array_key_exists($criterionId, $bestToOthers) || ! array_key_exists($criterionId, $othersToWorst)) {
                $errors[] = 'best_to_others and others_to_worst must include all soft criteria';
                break;
            }

            $bto = $bestToOthers[$criterionId];
            $otw = $othersToWorst[$criterionId];
            if ($bto < 1 || $bto > 9 || $otw < 1 || $otw > 9) {
                $errors[] = 'BWM values must be between 1 and 9';
                break;
            }
        }

        if ($errors === [] && ($bestToOthers[$bestCriteriaId] ?? null) !== 1) {
            $errors[] = 'best_to_others value for best criterion must be 1';
        }

        if ($errors === [] && ($othersToWorst[$worstCriteriaId] ?? null) !== 1) {
            $errors[] = 'others_to_worst value for worst criterion must be 1';
        }

        return $errors;
    }
}
