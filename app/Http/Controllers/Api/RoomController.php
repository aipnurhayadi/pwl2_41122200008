<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Room\StoreRoomRequest;
use App\Http\Requests\Room\UpdateRoomRequest;
use App\Http\Resources\RoomResource;
use App\Models\Dataset;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomController extends ApiController
{
    public function index(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $dataset = $this->findAccessibleDataset($datasetId, $currentUser);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $query = Room::query()
            ->where('dataset_id', $dataset->id)
            ->orderByDesc('created_at');

        $keyword = trim((string) $request->query('q', ''));
        if ($keyword !== '') {
            $this->applyKeywordFilter($query, ['code', 'building_name'], $keyword);
        }

        return $this->paginatedResponse($request, $query, RoomResource::class);
    }

    public function store(int $datasetId, StoreRoomRequest $request): JsonResponse
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
        $code = $this->computeRoomCode($payload['building_code'], $payload['floor'], $payload['room_number']);

        try {
            $room = Room::query()->create([
                'dataset_id' => $dataset->id,
                'created_by' => $currentUser->id,
                'building_code' => $payload['building_code'],
                'floor' => $payload['floor'],
                'room_number' => $payload['room_number'],
                'building_name' => $code,
                'code' => $code,
                'capacity' => $payload['capacity'],
                'room_type' => $payload['room_type'] ?? null,
            ]);
        } catch (QueryException) {
            return $this->conflict('A room with this name already exists in this building and floor');
        }

        return response()->json((new RoomResource($room))->resolve(), 201);
    }

    public function show(int $datasetId, int $roomId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $room = $this->findRoom($datasetId, $roomId, $currentUser);
        if ($room instanceof JsonResponse) {
            return $room;
        }

        return response()->json((new RoomResource($room))->resolve());
    }

    public function update(int $datasetId, int $roomId, UpdateRoomRequest $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $room = $this->findRoom($datasetId, $roomId, $currentUser);
        if ($room instanceof JsonResponse) {
            return $room;
        }

        $room->fill($request->validated());
        $room->building_name = $this->computeRoomCode($room->building_code, $room->floor, $room->room_number);
        $room->code = $room->building_name;

        try {
            $room->save();
        } catch (QueryException) {
            return $this->conflict('A room with this name already exists in this building and floor');
        }

        return response()->json((new RoomResource($room))->resolve());
    }

    public function destroy(int $datasetId, int $roomId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $room = $this->findRoom($datasetId, $roomId, $currentUser);
        if ($room instanceof JsonResponse) {
            return $room;
        }

        $room->delete();

        return response()->json(null, 204);
    }

    private function findRoom(int $datasetId, int $roomId, User $user): Room|JsonResponse
    {
        $dataset = $this->findAccessibleDataset($datasetId, $user);
        if (! $dataset) {
            return $this->notFound('Dataset not found');
        }

        $room = Room::query()
            ->where('dataset_id', $dataset->id)
            ->where('id', $roomId)
            ->first();

        if (! $room) {
            return $this->notFound('Room not found');
        }

        return $room;
    }

    private function computeRoomCode(string $buildingCode, int $floor, int $roomNumber): string
    {
        return sprintf('%s%d%d', $buildingCode, $floor, $roomNumber);
    }
}
