<?php

namespace App\Http\Requests\Room;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'building_code' => ['sometimes', 'string', 'max:20'],
            'floor' => ['sometimes', 'integer', 'min:1'],
            'room_number' => ['sometimes', 'integer', 'min:1'],
            'capacity' => ['sometimes', 'integer', 'min:1'],
            'room_type' => ['nullable', Rule::in(['TEORI', 'LABORATORIUM', 'AULA', 'SEMINAR'])],
        ];
    }
}
