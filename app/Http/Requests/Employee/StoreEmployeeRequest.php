<?php

namespace App\Http\Requests\Employee;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'nidn' => ['nullable', 'string', 'max:20'],
            'nip' => ['nullable', 'string', 'max:20'],
            'front_title' => ['nullable', 'string', 'max:50'],
            'back_title' => ['nullable', 'string', 'max:100'],
            'user_email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'gender' => ['nullable', Rule::in(['M', 'F'])],
        ];
    }
}
