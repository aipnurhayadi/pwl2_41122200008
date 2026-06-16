<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ClassModel\StoreClassRequest;
use App\Http\Requests\ClassModel\UpdateClassRequest;
use App\Http\Resources\ClassResource;
use App\Models\ClassModel;
use App\Models\Major;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClassController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $query = ClassModel::query()
            ->with('major')
            ->where('classes.dataset_id', $dataset->id)
            ->leftJoin('majors', 'majors.id', '=', 'classes.major_id')
            ->select('classes.*')
            ->orderByDesc('classes.created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $like = '%'.$keyword.'%';
            $query->where(function (Builder $subQuery) use ($like): void {
                $subQuery
                    ->where('classes.code', 'ILIKE', $like)
                    ->orWhere('classes.name', 'ILIKE', $like)
                    ->orWhere('classes.study_program', 'ILIKE', $like)
                    ->orWhere('majors.code', 'ILIKE', $like)
                    ->orWhere('majors.name', 'ILIKE', $like);
            });
        }

        return $this->paginatedResponse($request, $query, ClassResource::class);
    }

    public function store(int $datasetId, StoreClassRequest $request): JsonResponse
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

        $payload = $request->validated();
        if (! empty($payload['major_id'])) {
            $major = Major::query()->find($payload['major_id']);
            if (! $major) {
                return $this->notFound('Major not found');
            }
            if (empty($payload['study_program'])) {
                $payload['study_program'] = $major->name;
            }
        }

        try {
            $class = ClassModel::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $currentUser->id,
                'code' => $this->generateClassCode($dataset->id),
                ...$payload,
            ]);
        } catch (QueryException) {
            return $this->conflict('A class with this code already exists in the dataset');
        }

        $class->load('major');

        return response()->json((new ClassResource($class))->resolve(), 201);
    }

    public function show(int $datasetId, int $classId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $class = $this->findClass($datasetId, $classId, $currentUser);
        if ($class instanceof JsonResponse) {
            return $class;
        }

        return response()->json((new ClassResource($class))->resolve());
    }

    public function update(int $datasetId, int $classId, UpdateClassRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $class = $this->findClass($datasetId, $classId, $currentUser);
        if ($class instanceof JsonResponse) {
            return $class;
        }

        $payload = $request->validated();
        if (array_key_exists('major_id', $payload) && $payload['major_id'] !== null) {
            $major = Major::query()->find($payload['major_id']);
            if (! $major) {
                return $this->notFound('Major not found');
            }
            if (! array_key_exists('study_program', $payload) || ! $payload['study_program']) {
                $payload['study_program'] = $major->name;
            }
        }

        unset($payload['code']);
        $class->fill($payload);

        try {
            $class->save();
        } catch (QueryException) {
            return $this->conflict('A class with this code already exists in the dataset');
        }

        $class->load('major');

        return response()->json((new ClassResource($class))->resolve());
    }

    public function destroy(int $datasetId, int $classId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $class = $this->findClass($datasetId, $classId, $currentUser);
        if ($class instanceof JsonResponse) {
            return $class;
        }

        $class->delete();

        return response()->json(null, 204);
    }

    private function findClass(int $datasetId, int $classId, User $user): ClassModel|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $class = ClassModel::query()
            ->with('major')
            ->where('dataset_id', $dataset->id)
            ->where('id', $classId)
            ->first();

        if (! $class) {
            return $this->notFound('Class not found');
        }

        return $class;
    }

    private function generateClassCode(int $datasetId): string
    {
        $count = ClassModel::query()->where('dataset_id', $datasetId)->count();

        return sprintf('KLS%03d', $count + 1);
    }
}
