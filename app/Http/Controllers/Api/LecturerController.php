<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Lecturer\StoreLecturerRequest;
use App\Http\Requests\Lecturer\UpdateLecturerRequest;
use App\Http\Resources\LecturerResource;
use App\Models\Lecturer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LecturerController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $query = Lecturer::query()
            ->with(['employee.user'])
            ->where('lecturers.dataset_id', $dataset->id)
            ->join('employees', 'employees.id', '=', 'lecturers.employee_id')
            ->leftJoin('users', 'users.id', '=', 'employees.user_id')
            ->select('lecturers.*')
            ->orderByDesc('lecturers.created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $like = '%'.$keyword.'%';
            $query->where(function (Builder $subQuery) use ($like): void {
                $subQuery
                    ->where('lecturers.code', 'ILIKE', $like)
                    ->orWhere('employees.employee_code', 'ILIKE', $like)
                    ->orWhere('employees.name', 'ILIKE', $like)
                    ->orWhere('users.email', 'ILIKE', $like);
            });
        }

        return $this->paginatedResponse($request, $query, LecturerResource::class);
    }

    public function store(int $datasetId, StoreLecturerRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $employee = Employee::query()->find($request->validated('employee_id'));
        if (! $employee) {
            return $this->notFound('Employee not found');
        }

        try {
            $lecturer = DB::transaction(function () use ($dataset, $currentUser, $employee): Lecturer {
                return Lecturer::query()->create([
                    'dataset_id' => $dataset->id,
                    'employee_id' => $employee->id,
                    'created_by' => $currentUser->id,
                    'code' => $this->generateLecturerCode($dataset, $employee),
                ]);
            });
        } catch (QueryException) {
            return $this->conflict('Employee is already assigned to this dataset');
        }

        $lecturer->load(['employee.user']);

        return response()->json((new LecturerResource($lecturer))->resolve(), 201);
    }

    public function show(int $datasetId, int $lecturerId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturer($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        return response()->json((new LecturerResource($lecturer))->resolve());
    }

    public function update(int $datasetId, int $lecturerId, UpdateLecturerRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $lecturer = $this->findLecturer($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        $employee = Employee::query()->find($request->validated('employee_id'));
        if (! $employee) {
            return $this->notFound('Employee not found');
        }

        $lecturer->employee_id = $employee->id;
        $lecturer->code = $this->generateLecturerCode($dataset, $employee);

        try {
            $lecturer->save();
        } catch (QueryException) {
            return $this->conflict('Employee is already assigned to this dataset');
        }

        $lecturer->load(['employee.user']);

        return response()->json((new LecturerResource($lecturer))->resolve());
    }

    public function destroy(int $datasetId, int $lecturerId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $lecturer = $this->findLecturer($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $lecturer->delete();

        return response()->json(null, 204);
    }

    private function findLecturer(int $datasetId, int $lecturerId, User $user): Lecturer|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $lecturer = Lecturer::query()
            ->with(['employee.user'])
            ->where('dataset_id', $dataset->id)
            ->where('id', $lecturerId)
            ->first();

        if (! $lecturer) {
            return $this->notFound('Lecturer not found');
        }

        return $lecturer;
    }

    private function generateLecturerCode($dataset, Employee $employee): string
    {
        return sprintf('%s-%s', $dataset->code, $employee->employee_code);
    }
}
