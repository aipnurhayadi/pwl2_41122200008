<?php

namespace App\Services\Bwm;

class BwmValidationResult
{
    /**
     * @param  list<string>  $errors
     * @param  list<string>  $warnings
     * @param  list<string>  $suggestions
     * @param  array<int, float>|null  $weights
     */
    public function __construct(
        private readonly array $errors = [],
        private readonly array $warnings = [],
        private readonly array $suggestions = [],
        private readonly ?float $ksi = null,
        private readonly ?float $consistencyRatio = null,
        private readonly ?array $weights = null,
    ) {}

    public function isValid(): bool
    {
        return $this->errors === [];
    }

    /**
     * @return list<string>
     */
    public function errors(): array
    {
        return $this->errors;
    }

    public function firstError(): ?string
    {
        return $this->errors[0] ?? null;
    }

    /**
     * @return list<string>
     */
    public function warnings(): array
    {
        return $this->warnings;
    }

    /**
     * @return list<string>
     */
    public function suggestions(): array
    {
        return $this->suggestions;
    }

    public function ksi(): ?float
    {
        return $this->ksi;
    }

    public function consistencyRatio(): ?float
    {
        return $this->consistencyRatio;
    }

    /**
     * @return array<int, float>|null
     */
    public function weights(): ?array
    {
        return $this->weights;
    }
}
