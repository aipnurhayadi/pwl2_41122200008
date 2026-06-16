<?php

namespace App\Http\Requests\Lecturer;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLecturerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
        ];
    }
}
