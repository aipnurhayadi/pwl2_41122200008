<?php

namespace App\Http\Requests\ClassModel;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClassRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
            'academic_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'semester' => ['nullable', 'integer', 'min:1', 'max:8'],
            'study_program' => ['nullable', 'string', 'max:255'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'description' => ['nullable', 'string'],
        ];
    }
}
