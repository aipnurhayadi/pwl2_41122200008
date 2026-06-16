<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoomResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'building_name' => $this->building_name,
            'building_code' => $this->building_code,
            'floor' => $this->floor,
            'room_number' => $this->room_number,
            'code' => $this->code,
            'capacity' => $this->capacity,
            'room_type' => $this->room_type,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
