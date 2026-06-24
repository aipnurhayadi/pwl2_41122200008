<?php

namespace Database\Seeders\Concerns;

use App\Models\ClassModel;
use App\Models\Course;
use App\Models\Lecturer;
use App\Models\Major;
use App\Models\Room;
use App\Models\TimeSlot;
use Illuminate\Support\Facades\DB;

trait ResetsDatasetResources
{
    protected function syncPrimaryKeySequence(string $table, string $column = 'id'): void
    {
        $qualifiedTable = str_replace("'", "''", $table);
        $qualifiedColumn = str_replace("'", "''", $column);

        DB::statement(
            "SELECT setval(pg_get_serial_sequence('{$qualifiedTable}', '{$qualifiedColumn}'), COALESCE(MAX({$column}), 1), true) FROM {$table}"
        );
    }

    protected function resetDatasetResources(int $datasetId): void
    {
        DB::table('bwm_weights')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_best_to_others')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_others_to_worst')->whereIn('response_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('bwm_responses')->where('dataset_id', $datasetId);
        })->delete();

        DB::table('bwm_responses')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_course_preferences')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_time_slot_preferences')->where('dataset_id', $datasetId)->delete();
        DB::table('lecturer_allowed_courses')->whereIn('lecturer_id', function ($query) use ($datasetId): void {
            $query->select('id')->from('lecturers')->where('dataset_id', $datasetId);
        })->delete();

        ClassModel::query()->where('dataset_id', $datasetId)->delete();
        TimeSlot::query()->where('dataset_id', $datasetId)->delete();
        Course::query()->where('dataset_id', $datasetId)->delete();
        Lecturer::query()->where('dataset_id', $datasetId)->delete();
        Room::query()->where('dataset_id', $datasetId)->delete();
    }

    protected function resetMasterMajors(): void
    {
        Major::query()->delete();
    }
}
