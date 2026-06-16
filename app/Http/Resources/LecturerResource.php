<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LecturerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'employee_id' => $this->employee_id,
            'employee_code' => $this->employee?->employee_code,
            'name' => $this->employee?->name,
            'code' => $this->code,
            'nidn' => $this->employee?->nidn,
            'nip' => $this->employee?->nip,
            'front_title' => $this->employee?->front_title,
            'back_title' => $this->employee?->back_title,
            'email' => $this->employee?->user?->email,
            'phone' => $this->employee?->phone,
            'gender' => $this->employee?->gender,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
