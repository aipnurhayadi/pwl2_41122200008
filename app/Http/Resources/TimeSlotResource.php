<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TimeSlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'code' => $this->code,
            'day' => $this->day,
            'start_time' => $this->formatTime($this->start_time),
            'end_time' => $this->formatTime($this->end_time),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    private function formatTime(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return substr((string) $value, 0, 8);
    }
}
