<?php

namespace App\Http\Requests\Course;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCourseRequest extends FormRequest
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
            'credits' => ['sometimes', 'integer', 'min:1'],
            'semester' => ['nullable', 'integer', 'min:1', 'max:8'],
            'curriculum_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'description' => ['nullable', 'string'],
        ];
    }
}
