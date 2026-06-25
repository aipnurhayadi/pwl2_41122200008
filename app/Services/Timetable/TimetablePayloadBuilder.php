<?php

namespace App\Services\Timetable;

use App\Models\Course;
use App\Models\Lecturer;
use App\Models\LecturerCoursePreference;
use App\Models\Room;
use App\Models\TimeSlot;

class TimetablePayloadBuilder
{
    public function __construct(
        private readonly BwmWeightAggregator $weightAggregator,
        private readonly TeachingRequestBuilder $requestBuilder,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(int $datasetId): array
    {
        $aggregation = $this->weightAggregator->aggregateForDataset($datasetId);

        $payload = [
            'dataset_id' => $datasetId,
            'weights' => $aggregation['weights'],
            'config' => [
                'daily_session_limit' => config('timetable.daily_session_limit'),
                'max_candidates_per_request' => config('timetable.max_candidates_per_request'),
                'max_rooms_per_request' => config('timetable.max_rooms_per_request'),
                'transition_neighbor_limit' => config('timetable.transition_neighbor_limit'),
                'solver_time_limit_seconds' => config('timetable.solver_time_limit_seconds'),
                'solver_relative_gap' => config('timetable.solver_relative_gap'),
                'solver_threads' => config('timetable.solver_threads'),
            ],
            'rooms' => $this->buildRooms($datasetId),
            'time_slots' => $this->buildTimeSlots($datasetId),
            'lecturers' => $this->buildLecturers($datasetId),
            'teaching_requests' => $this->requestBuilder->buildForDataset($datasetId),
            '_criterion_ids' => $aggregation['criterion_ids'],
        ];

        $this->assertPayloadReady($payload);

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function assertPayloadReady(array $payload): void
    {
        foreach (['rooms', 'time_slots', 'lecturers', 'teaching_requests'] as $key) {
            if (! array_key_exists($key, $payload)) {
                throw new \RuntimeException("Solver payload is missing required key: {$key}");
            }
        }

        if ($payload['rooms'] === []) {
            throw new \RuntimeException('Dataset has no rooms; seed or configure rooms.csv');
        }

        if ($payload['time_slots'] === []) {
            throw new \RuntimeException('Dataset has no time slots; seed or configure timeslots.csv');
        }

        if ($payload['teaching_requests'] === []) {
            throw new \RuntimeException('Dataset has no teaching requests; check classes and courses matching');
        }

        if ($payload['lecturers'] === []) {
            throw new \RuntimeException('Dataset has no lecturers; seed lecturer assignments');
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildRooms(int $datasetId): array
    {
        return Room::query()
            ->where('dataset_id', $datasetId)
            ->orderBy('id')
            ->get()
            ->map(static fn (Room $room): array => [
                'id' => $room->id,
                'code' => $room->code,
                'capacity' => (int) ($room->capacity ?? 0),
                'floor' => (int) ($room->floor ?? 0),
                'room_type' => $room->room_type,
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildTimeSlots(int $datasetId): array
    {
        return TimeSlot::query()
            ->where('dataset_id', $datasetId)
            ->orderBy('id')
            ->get()
            ->map(static fn (TimeSlot $slot): array => [
                'id' => $slot->id,
                'code' => $slot->code,
                'day' => $slot->day,
                'start_time' => self::formatTime($slot->start_time),
                'end_time' => self::formatTime($slot->end_time),
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildLecturers(int $datasetId): array
    {
        $lecturers = Lecturer::query()
            ->with(['allowedCourses', 'coursePreferences'])
            ->where('dataset_id', $datasetId)
            ->orderBy('id')
            ->get();

        return $lecturers->map(static function (Lecturer $lecturer): array {
            $allowedCourseIds = $lecturer->allowedCourses
                ->pluck('course_id')
                ->map(static fn ($id): int => (int) $id)
                ->values()
                ->all();

            $coursePreferences = $lecturer->coursePreferences
                ->map(static fn (LecturerCoursePreference $pref): array => [
                    'course_id' => (int) $pref->course_id,
                    'rank_order' => (int) $pref->rank_order,
                ])
                ->values()
                ->all();

            return [
                'id' => $lecturer->id,
                'allowed_course_ids' => $allowedCourseIds,
                'course_preferences' => $coursePreferences,
            ];
        })->all();
    }

    private static function formatTime(mixed $value): string
    {
        if ($value === null) {
            return '00:00:00';
        }

        $text = (string) $value;
        if (strlen($text) === 5) {
            return $text.':00';
        }

        return $text;
    }
}
