<?php

namespace App\Services\Timetable;

use App\Models\ClassModel;
use App\Models\Course;
use Illuminate\Support\Collection;

class TeachingRequestBuilder
{
    /**
     * @return list<array<string, mixed>>
     */
    public function buildForDataset(int $datasetId): array
    {
        $classes = ClassModel::query()
            ->where('dataset_id', $datasetId)
            ->orderBy('id')
            ->get();

        $coursesByKey = Course::query()
            ->where('dataset_id', $datasetId)
            ->get()
            ->groupBy(static fn (Course $course): string => self::matchKey(
                $course->semester,
                $course->curriculum_year,
            ));

        $requests = [];

        foreach ($classes as $class) {
            $key = self::matchKey($class->semester, $class->academic_year);
            /** @var Collection<int, Course> $matched */
            $matched = $coursesByKey->get($key, collect());

            foreach ($matched as $course) {
                $capacity = $class->capacity ?? 0;
                $requests[] = [
                    'class_id' => $class->id,
                    'course_id' => $course->id,
                    'lecturer_id' => null,
                    'duration_slots' => 1,
                    'expected_capacity' => $capacity > 0 ? $capacity : null,
                    'class_capacity' => $capacity > 0 ? $capacity : null,
                    'required_room_type' => null,
                ];
            }
        }

        if ($requests === []) {
            throw new \RuntimeException('No teaching requests could be built from class and course semester matching');
        }

        return $requests;
    }

    private static function matchKey(?int $semester, ?int $year): string
    {
        return sprintf('%s:%s', $semester ?? 'null', $year ?? 'null');
    }
}
