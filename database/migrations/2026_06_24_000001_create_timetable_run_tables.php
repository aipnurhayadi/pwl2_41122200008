<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timetable_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('status', 20);
            $table->string('phase', 50)->nullable();
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->double('objective_value')->nullable();
            $table->string('solver_name', 100)->nullable();
            $table->text('error_message')->nullable();
            $table->double('fairness_index')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('finished_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('timetable_run_weights', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->constrained('timetable_runs')->cascadeOnDelete();
            $table->foreignId('criterion_id')->constrained('criteria')->cascadeOnDelete();
            $table->double('weight');
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['run_id', 'criterion_id'], 'uq_trw_run_criterion');
        });

        Schema::create('timetable_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->constrained('timetable_runs')->cascadeOnDelete();
            $table->unsignedInteger('request_index');
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->foreignId('start_time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->foreignId('end_time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->double('objective_cost')->default(0);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['run_id', 'request_index'], 'uq_ta_run_request');
        });

        Schema::create('timetable_assignment_penalties', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('assignment_id')->constrained('timetable_assignments')->cascadeOnDelete();
            $table->string('criterion_code', 20);
            $table->double('penalty_value')->default(0);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['assignment_id', 'criterion_code'], 'uq_tap_assignment_code');
        });

        Schema::create('timetable_run_constraint_summaries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->constrained('timetable_runs')->cascadeOnDelete();
            $table->foreignId('criterion_id')->constrained('criteria')->cascadeOnDelete();
            $table->unsignedInteger('satisfied_count')->default(0);
            $table->unsignedInteger('violated_count')->default(0);
            $table->double('total_penalty')->default(0);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['run_id', 'criterion_id'], 'uq_trcs_run_criterion');
        });

        Schema::create('timetable_run_lecturer_summaries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->constrained('timetable_runs')->cascadeOnDelete();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->unsignedInteger('session_count')->default(0);
            $table->double('total_penalty')->default(0);
            $table->double('direct_penalty')->default(0);
            $table->double('fairness_deviation')->default(0);
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['run_id', 'lecturer_id'], 'uq_trls_run_lecturer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timetable_run_lecturer_summaries');
        Schema::dropIfExists('timetable_run_constraint_summaries');
        Schema::dropIfExists('timetable_assignment_penalties');
        Schema::dropIfExists('timetable_assignments');
        Schema::dropIfExists('timetable_run_weights');
        Schema::dropIfExists('timetable_runs');
    }
};
