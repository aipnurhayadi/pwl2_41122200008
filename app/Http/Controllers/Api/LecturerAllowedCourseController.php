<?php

namespace App\Http\Controllers\Api;

use App\Models\Course;
use App\Models\Lecturer;
use App\Models\LecturerAllowedCourse;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LecturerAllowedCourseController extends ApiController
{
    public function show(int $datasetId, int $lecturerId, Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        $lecturer = $this->findLecturerInDataset($datasetId, $lecturerId, $currentUser);
        if ($lecturer instanceof JsonResponse) {
            return $lecturer;
        }

        $courseIds = LecturerAllowedCourse::query()
            ->where('lecturer_id', $lecturer->id)
            ->pluck('course_id')
            ->all();

        $courses = Course::query()
            ->where('dataset_id', $datasetId)
            ->whereIn('id', $courseIds)
            ->orderBy('code')
            ->get()
            ->map(static fn (Course $course): array => [
                'id' => $course->id,
                'code' => $course->code,
                'name' => $course->name,
                'credits' => $course->credits,
                'semester' => $course->semester,
            ]);

        return response()->json([
            'course_ids' => $courseIds,
            'courses' => $courses,
        ]);
    }

    public function update(int $datasetId, int $lecturerId, Request $request): JsonResponse
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

        $courseIds = $request->input('course_ids', []);
        if (! is_array($courseIds)) {
            return $this->unprocessable('course_ids must be an array');
        }

        $courseIds = array_values(array_unique(array_map('intval', $courseIds)));
        if ($courseIds !== []) {
            $found = Course::query()
                ->where('dataset_id', $datasetId)
                ->whereIn('id', $courseIds)
                ->count();
            if ($found !== count($courseIds)) {
                return $this->unprocessable('course_ids contains course outside dataset');
            }
        }

        DB::transaction(function () use ($lecturer, $courseIds, $currentUser): void {
            LecturerAllowedCourse::query()
                ->where('lecturer_id', $lecturer->id)
                ->delete();

            foreach ($courseIds as $courseId) {
                LecturerAllowedCourse::query()->create([
                    'lecturer_id' => $lecturer->id,
                    'course_id' => $courseId,
                    'created_by' => $currentUser->id,
                    'created_at' => now(),
                ]);
            }
        });

        return $this->show($datasetId, $lecturerId, $request);
    }
}
