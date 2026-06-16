<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Course\StoreCourseRequest;
use App\Http\Requests\Course\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourseController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $query = Course::query()
            ->with('major')
            ->where('courses.dataset_id', $dataset->id)
            ->leftJoin('majors', 'majors.id', '=', 'courses.major_id')
            ->select('courses.*')
            ->orderByDesc('courses.created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $like = '%'.$keyword.'%';
            $query->where(function (Builder $subQuery) use ($like): void {
                $subQuery
                    ->where('courses.code', 'ILIKE', $like)
                    ->orWhere('courses.name', 'ILIKE', $like)
                    ->orWhere('majors.code', 'ILIKE', $like)
                    ->orWhere('majors.name', 'ILIKE', $like);
            });
        }

        return $this->paginatedResponse($request, $query, CourseResource::class);
    }

    public function store(int $datasetId, StoreCourseRequest $request): JsonResponse
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
        if (! empty($payload['major_id']) && ! Major::query()->where('id', $payload['major_id'])->exists()) {
            return $this->notFound('Major not found');
        }

        try {
            $course = Course::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $currentUser->id,
                'code' => $this->generateCourseCode($dataset->id),
                ...$payload,
            ]);
        } catch (QueryException) {
            return $this->conflict('A course with this code already exists in the dataset');
        }

        $course->load('major');

        return response()->json((new CourseResource($course))->resolve(), 201);
    }

    public function show(int $datasetId, int $courseId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $course = $this->findCourse($datasetId, $courseId, $currentUser);
        if ($course instanceof JsonResponse) {
            return $course;
        }

        return response()->json((new CourseResource($course))->resolve());
    }

    public function update(int $datasetId, int $courseId, UpdateCourseRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $course = $this->findCourse($datasetId, $courseId, $currentUser);
        if ($course instanceof JsonResponse) {
            return $course;
        }

        $payload = $request->validated();
        if (array_key_exists('major_id', $payload) && $payload['major_id'] !== null
            && ! Major::query()->where('id', $payload['major_id'])->exists()) {
            return $this->notFound('Major not found');
        }

        unset($payload['code']);
        $course->fill($payload);

        try {
            $course->save();
        } catch (QueryException) {
            return $this->conflict('A course with this code already exists in the dataset');
        }

        $course->load('major');

        return response()->json((new CourseResource($course))->resolve());
    }

    public function destroy(int $datasetId, int $courseId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $course = $this->findCourse($datasetId, $courseId, $currentUser);
        if ($course instanceof JsonResponse) {
            return $course;
        }

        $course->delete();

        return response()->json(null, 204);
    }

    private function findCourse(int $datasetId, int $courseId, User $user): Course|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $course = Course::query()
            ->with('major')
            ->where('dataset_id', $dataset->id)
            ->where('id', $courseId)
            ->first();

        if (! $course) {
            return $this->notFound('Course not found');
        }

        return $course;
    }

    private function generateCourseCode(int $datasetId): string
    {
        $count = Course::query()->where('dataset_id', $datasetId)->count();

        return sprintf('MK%03d', $count + 1);
    }
}
