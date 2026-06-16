<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DatasetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'visibility' => $this->visibility,
            'rooms_count' => $this->rooms_count ?? 0,
            'lecturers_count' => $this->lecturers_count ?? 0,
            'courses_count' => $this->courses_count ?? 0,
            'time_slots_count' => $this->time_slots_count ?? 0,
            'classes_count' => $this->classes_count ?? 0,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
