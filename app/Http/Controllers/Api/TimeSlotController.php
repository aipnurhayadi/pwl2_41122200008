<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\TimeSlot\StoreTimeSlotRequest;
use App\Http\Requests\TimeSlot\UpdateTimeSlotRequest;
use App\Http\Resources\TimeSlotResource;
use App\Models\TimeSlot;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeSlotController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $query = TimeSlot::query()
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $this->applyKeywordFilter($query, ['code', 'day'], $keyword);
        }

        return $this->paginatedResponse($request, $query, TimeSlotResource::class);
    }

    public function store(int $datasetId, StoreTimeSlotRequest $request): JsonResponse
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

        try {
            $timeSlot = TimeSlot::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $currentUser->id,
                'code' => $this->generateTimeSlotCode($dataset->id),
                ...$request->validated(),
            ]);
        } catch (QueryException) {
            return $this->conflict('A time slot with this code already exists in the dataset');
        }

        return response()->json((new TimeSlotResource($timeSlot))->resolve(), 201);
    }

    public function show(int $datasetId, int $slotId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $timeSlot = $this->findTimeSlot($datasetId, $slotId, $currentUser);
        if ($timeSlot instanceof JsonResponse) {
            return $timeSlot;
        }

        return response()->json((new TimeSlotResource($timeSlot))->resolve());
    }

    public function update(int $datasetId, int $slotId, UpdateTimeSlotRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $timeSlot = $this->findTimeSlot($datasetId, $slotId, $currentUser);
        if ($timeSlot instanceof JsonResponse) {
            return $timeSlot;
        }

        $payload = $request->validated();
        unset($payload['code']);
        $timeSlot->fill($payload);
        $timeSlot->save();

        return response()->json((new TimeSlotResource($timeSlot))->resolve());
    }

    public function destroy(int $datasetId, int $slotId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $timeSlot = $this->findTimeSlot($datasetId, $slotId, $currentUser);
        if ($timeSlot instanceof JsonResponse) {
            return $timeSlot;
        }

        $timeSlot->delete();

        return response()->json(null, 204);
    }

    private function findTimeSlot(int $datasetId, int $slotId, User $user): TimeSlot|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $timeSlot = TimeSlot::query()
            ->where('dataset_id', $dataset->id)
            ->where('id', $slotId)
            ->first();

        if (! $timeSlot) {
            return $this->notFound('Time slot not found');
        }

        return $timeSlot;
    }

    private function generateTimeSlotCode(int $datasetId): string
    {
        $count = TimeSlot::query()->where('dataset_id', $datasetId)->count();

        return sprintf('TS%03d', $count + 1);
    }
}
