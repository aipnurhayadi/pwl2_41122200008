<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseResource extends JsonResource
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
            'credits' => $this->credits,
            'semester' => $this->semester,
            'curriculum_year' => $this->curriculum_year,
            'description' => $this->description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
