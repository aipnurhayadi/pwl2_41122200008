<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClassResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'name' => $this->name,
            'code' => $this->code,
            'major_id' => $this->major_id,
            'major_code' => $this->major_code,
            'major_name' => $this->major_name,
            'academic_year' => $this->academic_year,
            'semester' => $this->semester,
            'study_program' => $this->study_program,
            'capacity' => $this->capacity,
            'description' => $this->description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
