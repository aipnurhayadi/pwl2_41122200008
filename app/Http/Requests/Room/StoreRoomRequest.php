<?php

namespace App\Http\Requests\Room;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'building_code' => ['required', 'string', 'max:20'],
            'floor' => ['required', 'integer', 'min:1'],
            'room_number' => ['required', 'integer', 'min:1'],
            'capacity' => ['required', 'integer', 'min:1'],
            'room_type' => ['nullable', Rule::in(['TEORI', 'LABORATORIUM', 'AULA', 'SEMINAR'])],
        ];
    }
}
