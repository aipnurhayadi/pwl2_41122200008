<?php

namespace Database\Seeders\Concerns;

use App\Models\Employee;
use App\Models\User;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Support\Facades\Hash;

trait InteractsWithEmployees
{
    protected function nextEmployeeSequence(): int
    {
        return Employee::query()->count() + 1;
    }

    /**
     * @param  array<string, string>  $row
     */
    protected function ensureEmployeeAndUser(array $row, int $creatorId): Employee
    {
        $email = strtolower(trim((string) ($row['email'] ?? '')));
        $name = trim((string) ($row['name'] ?? ''));

        if ($name === '') {
            throw new \RuntimeException('Lecturer CSV row missing name');
        }

        $user = null;
        if ($email !== '') {
            $user = User::query()->where('email', $email)->first();
        }

        if (! $user) {
            $fallbackEmail = strtolower(preg_replace('/\s+/', '.', $name) ?? $name).'@example.com';
            $user = User::query()->create([
                'name' => $name,
                'email' => $email !== '' ? $email : $fallbackEmail,
                'password' => Hash::make(SeederDefaults::DEFAULT_EMPLOYEE_PASSWORD),
                'role' => User::ROLE_LECTURER,
                'created_by' => $creatorId,
            ]);
        } elseif ($user->role !== User::ROLE_LECTURER) {
            $user->role = User::ROLE_LECTURER;
            $user->save();
        }

        $employee = Employee::query()->where('user_id', $user->id)->first();
        if ($employee) {
            $employee->name = $name;
            $employee->front_title = $row['front_title'] ?: null;
            $employee->back_title = $row['back_title'] ?: null;
            $employee->nidn = $row['nidn'] ?: null;
            $employee->phone = $row['phone'] ?: null;
            $gender = strtoupper(trim((string) ($row['gender'] ?? '')));
            $employee->gender = in_array($gender, ['L', 'P'], true) ? $gender : null;
            $employee->save();

            return $employee;
        }

        $gender = strtoupper(trim((string) ($row['gender'] ?? '')));

        return Employee::query()->create([
            'user_id' => $user->id,
            'created_by' => $creatorId,
            'employee_code' => sprintf('EMP%03d', $this->nextEmployeeSequence()),
            'name' => $name,
            'nidn' => $row['nidn'] ?: null,
            'nip' => null,
            'front_title' => $row['front_title'] ?: null,
            'back_title' => $row['back_title'] ?: null,
            'phone' => $row['phone'] ?: null,
            'gender' => in_array($gender, ['L', 'P'], true) ? $gender : null,
        ]);
    }
}
