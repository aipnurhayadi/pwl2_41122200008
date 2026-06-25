<?php

namespace App\Http\Controllers\Api;

use App\Models\Course;
use App\Models\Lecturer;
use App\Models\LecturerAllowedCourse;
use App\Models\LecturerCoursePreference;
use App\Models\LecturerTimeSlotPreference;
use App\Models\TimeSlot;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LecturerPreferenceController extends ApiController
{
    public function myConstraints(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerForUser($datasetId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $allowedCourseIds = LecturerAllowedCourse::query()
            ->where('lecturer_id', $lecturer->id)
            ->pluck('course_id')
            ->all();

        return response()->json([
            'allowed_course_ids' => $allowedCourseIds,
        ]);
    }

    public function myShow(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerForUser($datasetId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        return response()->json($this->buildPreferencePayload($datasetId, $lecturer));
    }

    public function myUpdate(int $datasetId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerForUser($datasetId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $courseRankings = $request->input('course_rankings', []);
        $timePreferences = $request->input('time_preferences', []);

        if (! is_array($courseRankings) || ! is_array($timePreferences)) {
            return $this->unprocessable('Invalid preference payload');
        }

        $validationError = $this->validateCourseRankings($datasetId, $lecturer, $courseRankings);
        if ($validationError !== null) {
            return $this->unprocessable($validationError);
        }

        $validationError = $this->validateTimePreferences($datasetId, $timePreferences);
        if ($validationError !== null) {
            return $this->unprocessable($validationError);
        }

        DB::transaction(function () use ($datasetId, $lecturer, $currentUser, $courseRankings, $timePreferences): void {
            LecturerCoursePreference::query()
                ->where('dataset_id', $datasetId)
                ->where('lecturer_id', $lecturer->id)
                ->delete();

            LecturerTimeSlotPreference::query()
                ->where('dataset_id', $datasetId)
                ->where('lecturer_id', $lecturer->id)
                ->delete();

            foreach ($courseRankings as $row) {
                LecturerCoursePreference::query()->create([
                    'dataset_id' => $datasetId,
                    'lecturer_id' => $lecturer->id,
                    'course_id' => (int) $row['course_id'],
                    'rank_order' => (int) $row['rank_order'],
                    'created_by' => $currentUser->id,
                ]);
            }

            foreach ($timePreferences as $row) {
                LecturerTimeSlotPreference::query()->create([
                    'dataset_id' => $datasetId,
                    'lecturer_id' => $lecturer->id,
                    'start_time_slot_id' => (int) $row['start_time_slot_id'],
                    'end_time_slot_id' => (int) $row['end_time_slot_id'],
                    'choice_order' => (int) $row['choice_order'],
                    'created_by' => $currentUser->id,
                ]);
            }
        });

        return response()->json($this->buildPreferencePayload($datasetId, $lecturer));
    }

    public function showForLecturer(int $datasetId, int $lecturerId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $this->isAdmin($currentUser)) {
            return $this->forbidden();
        }

        $lecturer = $this->findLecturerInDataset($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        return response()->json($this->buildPreferencePayload($datasetId, $lecturer));
    }

    private function buildPreferencePayload(int $datasetId, Lecturer $lecturer): array
    {
        $courseRankings = LecturerCoursePreference::query()
            ->with('course')
            ->where('dataset_id', $datasetId)
            ->where('lecturer_id', $lecturer->id)
            ->orderBy('rank_order')
            ->get()
            ->map(static function (LecturerCoursePreference $row): array {
                return [
                    'course_id' => $row->course_id,
                    'course_code' => $row->course?->code,
                    'course_name' => $row->course?->name,
                    'rank_order' => $row->rank_order,
                ];
            })
            ->values()
            ->all();

        $timePreferences = LecturerTimeSlotPreference::query()
            ->with(['startTimeSlot', 'endTimeSlot'])
            ->where('dataset_id', $datasetId)
            ->where('lecturer_id', $lecturer->id)
            ->orderBy('choice_order')
            ->get()
            ->map(static function (LecturerTimeSlotPreference $row): array {
                return [
                    'choice_order' => $row->choice_order,
                    'start_time_slot_id' => $row->start_time_slot_id,
                    'end_time_slot_id' => $row->end_time_slot_id,
                    'day' => $row->startTimeSlot?->day,
                    'start_time' => $row->startTimeSlot?->start_time,
                    'end_time' => $row->endTimeSlot?->end_time,
                ];
            })
            ->values()
            ->all();

        $slots = TimeSlot::query()
            ->where('dataset_id', $datasetId)
            ->orderBy('day')
            ->orderBy('start_time')
            ->orderBy('code')
            ->get()
            ->map(static fn (TimeSlot $slot): array => [
                'id' => $slot->id,
                'code' => $slot->code,
                'day' => $slot->day,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
            ])
            ->all();

        return [
            'course_rankings' => $courseRankings,
            'time_preferences' => $timePreferences,
            'available_time_slots' => $slots,
        ];
    }

    private function validateCourseRankings(int $datasetId, Lecturer $lecturer, array $courseRankings): ?string
    {
        if ($courseRankings === []) {
            return 'course_rankings must contain at least 1 item';
        }

        $allowedIds = LecturerAllowedCourse::query()
            ->where('lecturer_id', $lecturer->id)
            ->pluck('course_id')
            ->all();

        if ($allowedIds === []) {
            return 'No allowed courses configured for this lecturer';
        }

        if (count($courseRankings) !== count($allowedIds)) {
            return 'course_rankings must rank all allowed courses for this lecturer';
        }

        $courseIds = [];
        $ranks = [];
        foreach ($courseRankings as $row) {
            if (! is_array($row)) {
                return 'Invalid course_rankings entry';
            }
            $courseId = (int) ($row['course_id'] ?? 0);
            $rank = (int) ($row['rank_order'] ?? 0);
            if ($courseId <= 0 || $rank <= 0) {
                return 'Invalid course_rankings entry';
            }
            $courseIds[] = $courseId;
            $ranks[] = $rank;
        }

        if (count($courseIds) !== count(array_unique($courseIds))) {
            return 'course_rankings contains duplicate course_id';
        }

        foreach ($courseIds as $courseId) {
            if (! in_array($courseId, $allowedIds, true)) {
                return 'course_rankings contains course not allowed for lecturer';
            }
        }

        $found = Course::query()
            ->where('dataset_id', $datasetId)
            ->whereIn('id', $courseIds)
            ->count();
        if ($found !== count($courseIds)) {
            return 'course_rankings contains course outside dataset';
        }

        sort($ranks);
        $expected = range(1, count($ranks));
        if ($ranks !== $expected) {
            return 'rank_order must start at 1 and be consecutive';
        }

        return null;
    }

    private function validateTimePreferences(int $datasetId, array $timePreferences): ?string
    {
        if ($timePreferences === []) {
            return null;
        }

        if (count($timePreferences) > 3) {
            return 'time_preferences must contain 1 to 3 items';
        }

        $slots = TimeSlot::query()
            ->where('dataset_id', $datasetId)
            ->get()
            ->keyBy('id');

        $choiceOrders = [];
        $ranges = [];
        foreach ($timePreferences as $row) {
            if (! is_array($row)) {
                return 'Invalid time_preferences entry';
            }
            $startId = (int) ($row['start_time_slot_id'] ?? 0);
            $endId = (int) ($row['end_time_slot_id'] ?? 0);
            $choice = (int) ($row['choice_order'] ?? 0);
            if ($startId <= 0 || $endId <= 0 || $choice <= 0) {
                return 'Invalid time_preferences entry';
            }

            $startSlot = $slots->get($startId);
            $endSlot = $slots->get($endId);
            if (! $startSlot || ! $endSlot) {
                return 'time_preferences contains time slot outside dataset';
            }
            if ($startSlot->day !== $endSlot->day) {
                return 'time_preferences start and end must be on the same day';
            }
            if ($startSlot->start_time > $endSlot->start_time) {
                return 'time_preferences start must be before end';
            }

            $choiceOrders[] = $choice;
            $ranges[] = "{$startId}-{$endId}";
        }

        if (count($ranges) !== count(array_unique($ranges))) {
            return 'time_preferences contains duplicate ranges';
        }

        sort($choiceOrders);
        $expected = range(1, count($choiceOrders));
        if ($choiceOrders !== $expected) {
            return 'choice_order must start at 1 and be consecutive';
        }

        return null;
    }
}
