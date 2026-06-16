<?php

namespace App\Http\Requests\TimeSlot;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTimeSlotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'day' => ['sometimes', Rule::in(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])],
            'start_time' => ['sometimes', 'date_format:H:i:s'],
            'end_time' => ['sometimes', 'date_format:H:i:s'],
        ];
    }
}
