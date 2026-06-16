<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends ApiController
{
    private const DEFAULT_EMPLOYEE_PASSWORD = 'Employee123!';

    public function index(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $query = Employee::query()
            ->with('user')
            ->leftJoin('users', 'users.id', '=', 'employees.user_id')
            ->select('employees.*')
            ->orderByDesc('employees.created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $like = '%'.$keyword.'%';
            $query->where(function (Builder $subQuery) use ($like): void {
                $subQuery
                    ->where('employees.employee_code', 'ILIKE', $like)
                    ->orWhere('employees.name', 'ILIKE', $like)
                    ->orWhere('users.email', 'ILIKE', $like)
                    ->orWhere('employees.nidn', 'ILIKE', $like)
                    ->orWhere('employees.nip', 'ILIKE', $like);
            });
        }

        return $this->paginatedResponse($request, $query, EmployeeResource::class);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $payload = $request->validated();
        $userEmail = $payload['user_email'] ?? null;
        unset($payload['user_email']);

        try {
            $employee = DB::transaction(function () use ($currentUser, $payload, $userEmail): Employee {
                $employeeCode = $this->generateEmployeeCode();
                $user = User::query()->create([
                    'name' => $payload['name'],
                    'email' => $this->uniqueUserEmail($userEmail, $employeeCode),
                    'password' => self::DEFAULT_EMPLOYEE_PASSWORD,
                    'role' => User::ROLE_LECTURER,
                    'created_by' => $currentUser->id,
                ]);

                return Employee::query()->create([
                    'user_id' => $user->id,
                    'created_by' => $currentUser->id,
                    'employee_code' => $employeeCode,
                    ...$payload,
                ]);
            });
        } catch (QueryException) {
            return $this->conflict('Employee code conflict');
        }

        $employee->load('user');

        return response()->json((new EmployeeResource($employee))->resolve(), 201);
    }

    public function show(int $employeeId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $employee = Employee::query()->with('user')->find($employeeId);
        if (! $employee) {
            return $this->notFound('Employee not found');
        }

        return response()->json((new EmployeeResource($employee))->resolve());
    }

    public function update(int $employeeId, UpdateEmployeeRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $employee = Employee::query()->with('user')->find($employeeId);
        if (! $employee) {
            return $this->notFound('Employee not found');
        }

        $payload = $request->validated();
        $userEmail = $payload['user_email'] ?? null;
        unset($payload['user_email']);

        $employee->fill($payload);

        if ($employee->user) {
            if (array_key_exists('name', $payload)) {
                $employee->user->name = $employee->name;
            }

            if ($userEmail !== null) {
                $newEmail = strtolower(trim($userEmail));
                if ($newEmail !== '') {
                    $conflict = User::query()
                        ->where('email', $newEmail)
                        ->where('id', '!=', $employee->user->id)
                        ->exists();
                    if ($conflict) {
                        return $this->conflict('User email already exists');
                    }
                    $employee->user->email = $newEmail;
                }
            }

            $employee->user->save();
        }

        $employee->save();
        $employee->load('user');

        return response()->json((new EmployeeResource($employee))->resolve());
    }

    public function destroy(int $employeeId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $employee = Employee::query()->find($employeeId);
        if (! $employee) {
            return $this->notFound('Employee not found');
        }

        $employee->delete();

        return response()->json(null, 204);
    }

    private function generateEmployeeCode(): string
    {
        $count = Employee::query()->count();

        return sprintf('EMP%03d', $count + 1);
    }

    private function uniqueUserEmail(?string $preferred, string $employeeCode): string
    {
        $base = strtolower(trim((string) $preferred));
        if ($base === '') {
            $base = strtolower($employeeCode).'@example.com';
        }

        if (! str_contains($base, '@')) {
            $base = $base.'@example.com';
        }

        [$local, $domain] = array_pad(explode('@', $base, 2), 2, '');
        if ($local === '') {
            $local = strtolower($employeeCode);
        }
        if ($domain === '') {
            $domain = 'example.com';
        }

        $candidate = $local.'@'.$domain;
        $suffix = 1;
        while (User::query()->where('email', $candidate)->exists()) {
            $candidate = $local.$suffix.'@'.$domain;
            $suffix++;
        }

        return $candidate;
    }
}
