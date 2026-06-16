<?php

namespace App\Http\Requests\TimeSlot;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTimeSlotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'day' => ['required', Rule::in(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])],
            'start_time' => ['required', 'date_format:H:i:s'],
            'end_time' => ['required', 'date_format:H:i:s', 'after:start_time'],
        ];
    }
}
