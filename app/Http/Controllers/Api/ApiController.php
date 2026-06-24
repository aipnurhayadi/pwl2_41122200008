<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dataset;
use App\Models\Lecturer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

abstract class ApiController extends Controller
{
    protected function isAdmin(User $user): bool
    {
        return $user->role === User::ROLE_ADMIN;
    }

    protected function forbidden(): JsonResponse
    {
        return response()->json(['detail' => 'Forbidden'], 403);
    }

    protected function notFound(string $message): JsonResponse
    {
        return response()->json(['detail' => $message], 404);
    }

    protected function conflict(string $message): JsonResponse
    {
        return response()->json(['detail' => $message], 409);
    }

    protected function unprocessable(string $message): JsonResponse
    {
        return response()->json(['detail' => $message], 422);
    }

    protected function unprocessableWithMeta(string $message, array $extra = []): JsonResponse
    {
        return response()->json(array_merge(['detail' => $message], $extra), 422);
    }

    protected function accessibleDatasetQuery(int $datasetId, User $user): Builder
    {
        return $this->accessibleDatasetsQuery($user)->where('id', $datasetId);
    }

    protected function accessibleDatasetsQuery(User $user): Builder
    {
        $query = Dataset::query();

        if ($this->isAdmin($user)) {
            if ($user->employeeProfile) {
                $employeeId = $user->employeeProfile->id;
                $query->where(function (Builder $subQuery) use ($user, $employeeId): void {
                    $subQuery
                        ->where('user_id', $user->id)
                        ->orWhereExists(function ($existsQuery) use ($employeeId): void {
                            $existsQuery->select(DB::raw('1'))
                                ->from('lecturers')
                                ->whereColumn('lecturers.dataset_id', 'datasets.id')
                                ->where('lecturers.employee_id', $employeeId);
                        });
                });
            } else {
                $query->where('user_id', $user->id);
            }

            return $query;
        }

        if ($user->role === User::ROLE_LECTURER) {
            if (! $user->employeeProfile) {
                return Dataset::query()->whereRaw('1 = 0');
            }

            $employeeId = $user->employeeProfile->id;
            $query->whereExists(function ($existsQuery) use ($employeeId): void {
                $existsQuery->select(DB::raw('1'))
                    ->from('lecturers')
                    ->whereColumn('lecturers.dataset_id', 'datasets.id')
                    ->where('lecturers.employee_id', $employeeId);
            });

            return $query;
        }

        return Dataset::query()->whereRaw('1 = 0');
    }

    protected function findAccessibleDataset(int $datasetId, User $user): ?Dataset
    {
        return $this->accessibleDatasetQuery($datasetId, $user)->first();
    }

    /**
     * @param  class-string<JsonResource>  $resourceClass
     */
    protected function paginatedResponse(Request $request, Builder $query, string $resourceClass): JsonResponse
    {
        $limit = $request->query('limit');
        $offset = max((int) $request->query('offset', 0), 0);
        if ($limit === null) {
            $items = $query->get();

            return response()->json($resourceClass::collection($items)->resolve());
        }

        $parsedLimit = min(max((int) $limit, 1), 200);
        $total = (clone $query)->count();
        $items = $query->offset($offset)->limit($parsedLimit)->get();

        return response()->json([
            'items' => $resourceClass::collection($items)->resolve(),
            'total' => $total,
            'limit' => $parsedLimit,
            'offset' => $offset,
        ]);
    }

    protected function applyKeywordFilter(Builder $query, array $columns, string $keyword): void
    {
        $like = '%'.$keyword.'%';
        $query->where(function (Builder $subQuery) use ($columns, $like): void {
            foreach ($columns as $index => $column) {
                if ($index === 0) {
                    $subQuery->where($column, 'ILIKE', $like);
                } else {
                    $subQuery->orWhere($column, 'ILIKE', $like);
                }
            }
        });
    }

    protected function findLecturerInDataset(int $datasetId, int $lecturerId, User $user): Lecturer|JsonResponse
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

    protected function findLecturerForUser(int $datasetId, User $user): Lecturer|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $user->loadMissing('employeeProfile');

        if ($user->role !== User::ROLE_LECTURER || ! $user->employeeProfile) {
            return $this->forbidden();
        }

        $lecturer = Lecturer::query()
            ->with(['employee.user'])
            ->where('dataset_id', $dataset->id)
            ->where('employee_id', $user->employeeProfile->id)
            ->first();

        if (! $lecturer) {
            return $this->notFound('Lecturer assignment not found for this dataset');
        }

        return $lecturer;
    }
}
