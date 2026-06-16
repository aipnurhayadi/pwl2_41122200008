<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dataset\StoreDatasetRequest;
use App\Http\Requests\Dataset\UpdateDatasetRequest;
use App\Http\Resources\DatasetResource;
use App\Models\ClassModel;
use App\Models\Course;
use App\Models\Dataset;
use App\Models\Lecturer;
use App\Models\Room;
use App\Models\TimeSlot;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class DatasetController extends Controller
{
    public function my(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        if (! $currentUser->employeeProfile) {
            return response()->json([]);
        }

        $items = Dataset::query()
            ->whereExists(function ($query) use ($currentUser): void {
                $query->select(DB::raw('1'))
                    ->from('lecturers')
                    ->whereColumn('lecturers.dataset_id', 'datasets.id')
                    ->where('lecturers.employee_id', $currentUser->employeeProfile->id);
            })
            ->orderByDesc('created_at')
            ->get();

        return response()->json(DatasetResource::collection($items)->resolve());
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $limit = $request->query('limit');
        $offset = max((int) $request->query('offset', 0), 0);
        $keyword = trim((string) $request->query('q', ''));

        $query = Dataset::query()
            ->where('user_id', $currentUser->id)
            ->orderByDesc('created_at');

        if ($keyword !== '') {
            $query->where(function (Builder $subQuery) use ($keyword): void {
                $like = '%'.$keyword.'%';
                $subQuery
                    ->where('code', 'ILIKE', $like)
                    ->orWhere('name', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhere('visibility', 'ILIKE', $like);
            });
        }

        if ($limit === null) {
            return response()->json(DatasetResource::collection($query->get())->resolve());
        }

        $parsedLimit = min(max((int) $limit, 1), 200);
        $total = (clone $query)->count();
        $items = $query->offset($offset)->limit($parsedLimit)->get();

        return response()->json([
            'items' => DatasetResource::collection($items)->resolve(),
            'total' => $total,
            'limit' => $parsedLimit,
            'offset' => $offset,
        ]);
    }

    public function public(): JsonResponse
    {
        $items = Dataset::query()
            ->where('visibility', Dataset::VISIBILITY_PUBLIC)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(DatasetResource::collection($items)->resolve());
    }

    public function store(StoreDatasetRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $payload = $request->validated();
        $dataset = Dataset::query()->create([
            'user_id' => $currentUser->id,
            'created_by' => $currentUser->id,
            'code' => $this->generateDatasetCode(),
            'name' => $payload['name'],
            'description' => $payload['description'] ?? null,
            'visibility' => $payload['visibility'] ?? Dataset::VISIBILITY_PRIVATE,
        ]);

        return response()->json((new DatasetResource($dataset))->resolve(), 201);
    }

    public function show(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->accessibleDatasetQuery($datasetId, $currentUser)->first();

        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        return response()->json((new DatasetResource($dataset))->resolve());
    }

    public function tree(int $datasetId, Request $request): JsonResponse
    {
        $dataset = Dataset::query()->find($datasetId);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        if ($dataset->visibility !== Dataset::VISIBILITY_PUBLIC) {
            $currentUser = $this->resolveOptionalUser($request);
            if (! $currentUser) {
                return response()->json(['detail' => 'Not authenticated'], 401, ['WWW-Authenticate' => 'Bearer']);
            }

            $allowed = $this->accessibleDatasetQuery($datasetId, $currentUser)->first();
            if (! $allowed) {
                return $this->notFound('Dataset not found');
            }
        }

        $rooms = Room::query()
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Room $room): array => [
                'id' => $room->id,
                'code' => $room->code,
                'building_name' => $room->building_name,
                'room_type' => $room->room_type,
            ]);

        $lecturers = Lecturer::query()
            ->with('employee')
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Lecturer $lecturer): array => [
                'id' => $lecturer->id,
                'code' => $lecturer->code,
                'employee_code' => $lecturer->employee?->employee_code,
                'name' => $lecturer->employee?->name,
            ]);

        $courses = Course::query()
            ->with('major')
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Course $course): array => [
                'id' => $course->id,
                'code' => $course->code,
                'name' => $course->name,
                'major_name' => $course->major_name,
                'credits' => $course->credits,
            ]);

        $timeSlots = TimeSlot::query()
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (TimeSlot $timeSlot): array => [
                'id' => $timeSlot->id,
                'code' => $timeSlot->code,
                'day' => $timeSlot->day,
                'start_time' => $timeSlot->start_time,
                'end_time' => $timeSlot->end_time,
            ]);

        $classes = ClassModel::query()
            ->with('major')
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ClassModel $classModel): array => [
                'id' => $classModel->id,
                'code' => $classModel->code,
                'name' => $classModel->name,
                'major_name' => $classModel->major_name,
            ]);

        return response()->json([
            'dataset' => (new DatasetResource($dataset))->resolve(),
            'rooms' => $rooms,
            'lecturers' => $lecturers,
            'courses' => $courses,
            'time_slots' => $timeSlots,
            'classes' => $classes,
        ]);
    }

    public function update(int $datasetId, UpdateDatasetRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $dataset = Dataset::query()
            ->where('id', $datasetId)
            ->where('user_id', $currentUser->id)
            ->first();

        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $dataset->fill($request->validated());
        $dataset->save();

        return response()->json((new DatasetResource($dataset))->resolve());
    }

    public function destroy(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $dataset = Dataset::query()
            ->where('id', $datasetId)
            ->where('user_id', $currentUser->id)
            ->first();

        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $dataset->delete();

        return response()->json(null, 204);
    }

    private function generateDatasetCode(): string
    {
        $count = Dataset::query()->count();

        return sprintf('DS%03d', $count + 1);
    }

    private function isAdmin(User $user): bool
    {
        return $user->role === User::ROLE_ADMIN;
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['detail' => 'Forbidden'], 403);
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json(['detail' => $message], 404);
    }

    private function accessibleDatasetQuery(int $datasetId, User $user): Builder
    {
        $query = Dataset::query()->where('id', $datasetId);

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

    private function resolveOptionalUser(Request $request): ?User
    {
        $authHeader = (string) $request->header('Authorization', '');
        if ($authHeader === '') {
            return null;
        }

        if (! str_starts_with($authHeader, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($authHeader, 7));
        if ($token === '') {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($token);
        if (! $accessToken || ! ($accessToken->tokenable instanceof User)) {
            return null;
        }

        return $accessToken->tokenable;
    }
}
