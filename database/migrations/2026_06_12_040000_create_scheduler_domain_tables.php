<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('employee_code', 50)->unique();
            $table->string('name', 255);
            $table->string('nidn', 20)->nullable();
            $table->string('nip', 20)->nullable();
            $table->string('front_title', 50)->nullable();
            $table->string('back_title', 100)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('gender', 1)->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('refresh_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->boolean('revoked')->default(false);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('datasets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('code', 50)->unique();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('visibility', 20)->default('PRIVATE')->index();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('majors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('code', 50)->unique();
            $table->string('name', 255)->unique();
            $table->text('description')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('rooms', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('building_name', 100);
            $table->string('building_code', 20);
            $table->integer('floor');
            $table->integer('room_number');
            $table->string('code', 50);
            $table->integer('capacity');
            $table->string('room_type', 20)->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'building_code', 'floor', 'room_number'], 'uq_room_dataset_building_floor_number');
        });

        Schema::create('lecturers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('code', 50);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'code'], 'uq_lecturer_dataset_code');
            $table->unique(['dataset_id', 'employee_id'], 'uq_lecturer_dataset_employee');
        });

        Schema::create('courses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('code', 50);
            $table->foreignId('major_id')->nullable()->constrained('majors')->nullOnDelete();
            $table->integer('credits');
            $table->integer('semester')->nullable();
            $table->integer('curriculum_year')->nullable();
            $table->text('description')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'code'], 'uq_course_dataset_code');
        });

        Schema::create('time_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('day', 3);
            $table->time('start_time');
            $table->time('end_time');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'code'], 'uq_time_slot_dataset_code');
        });

        Schema::create('classes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('code', 50);
            $table->foreignId('major_id')->nullable()->constrained('majors')->nullOnDelete();
            $table->integer('academic_year')->nullable();
            $table->integer('semester')->nullable();
            $table->string('study_program', 255)->nullable();
            $table->integer('capacity')->nullable();
            $table->text('description')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'code'], 'uq_class_dataset_code');
        });

        Schema::create('lecturer_allowed_courses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['lecturer_id', 'course_id'], 'uq_lac_lecturer_course');
        });

        Schema::create('lecturer_allowed_time_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['lecturer_id', 'time_slot_id'], 'uq_lats_hard_lecturer_time_slot');
        });

        Schema::create('lecturer_course_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->integer('rank_order');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'lecturer_id', 'rank_order'], 'uq_lcp_dataset_lecturer_rank');
            $table->unique(['dataset_id', 'lecturer_id', 'course_id'], 'uq_lcp_dataset_lecturer_course');
        });

        Schema::create('lecturer_time_slot_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('start_time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->foreignId('end_time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->integer('choice_order');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'lecturer_id', 'choice_order'], 'uq_ltsp_dataset_lecturer_choice');
            $table->unique(['dataset_id', 'lecturer_id', 'start_time_slot_id', 'end_time_slot_id'], 'uq_ltsp_dataset_lecturer_range');
        });

        Schema::create('criteria', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->string('type', 10)->index();
            $table->string('code', 20)->unique();
            $table->string('name', 100)->unique();
            $table->text('description')->nullable();
            $table->boolean('is_lecturer_preference')->default(false);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });

        Schema::create('bwm_responses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->foreignId('best_criteria_id')->constrained('criteria')->cascadeOnDelete();
            $table->foreignId('worst_criteria_id')->constrained('criteria')->cascadeOnDelete();
            $table->integer('scale_max')->default(9);
            $table->double('ksi')->nullable();
            $table->double('consistency_ratio')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->unique(['dataset_id', 'lecturer_id'], 'uq_bwm_response_dataset_lecturer');
        });

        Schema::create('bwm_best_to_others', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('response_id')->constrained('bwm_responses')->cascadeOnDelete();
            $table->foreignId('criterion_id')->constrained('criteria')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->integer('value');

            $table->unique(['response_id', 'criterion_id'], 'uq_bwm_best_to_other_response_criterion');
        });

        Schema::create('bwm_others_to_worst', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('response_id')->constrained('bwm_responses')->cascadeOnDelete();
            $table->foreignId('criterion_id')->constrained('criteria')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->integer('value');

            $table->unique(['response_id', 'criterion_id'], 'uq_bwm_other_to_worst_response_criterion');
        });

        Schema::create('bwm_weights', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('response_id')->constrained('bwm_responses')->cascadeOnDelete();
            $table->foreignId('criterion_id')->constrained('criteria')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->double('weight');

            $table->unique(['response_id', 'criterion_id'], 'uq_bwm_weight_response_criterion');
        });

        DB::statement("ALTER TABLE users ADD CONSTRAINT ck_users_role_enum CHECK (role IN ('ADMIN','LECTURER'))");
        DB::statement("ALTER TABLE employees ADD CONSTRAINT ck_employees_gender_enum CHECK (gender IS NULL OR gender IN ('L','P'))");
        DB::statement("ALTER TABLE datasets ADD CONSTRAINT ck_datasets_visibility_enum CHECK (visibility IN ('PUBLIC','PRIVATE'))");
        DB::statement("ALTER TABLE rooms ADD CONSTRAINT ck_rooms_room_type_enum CHECK (room_type IS NULL OR room_type IN ('TEORI','LABORATORIUM','AULA','SEMINAR'))");
        DB::statement("ALTER TABLE time_slots ADD CONSTRAINT ck_time_slots_day_enum CHECK (day IN ('MON','TUE','WED','THU','FRI','SAT','SUN'))");
        DB::statement('ALTER TABLE lecturer_course_preferences ADD CONSTRAINT ck_lcp_rank_order_range CHECK (rank_order >= 1 AND rank_order <= 3)');
        DB::statement('ALTER TABLE lecturer_time_slot_preferences ADD CONSTRAINT ck_ltsp_choice_order_range CHECK (choice_order >= 1 AND choice_order <= 3)');
        DB::statement("ALTER TABLE criteria ADD CONSTRAINT ck_criteria_type_enum CHECK (type IN ('HARD','SOFT'))");
        DB::statement('ALTER TABLE bwm_responses ADD CONSTRAINT ck_bwm_best_worst_not_equal CHECK (best_criteria_id <> worst_criteria_id)');
        DB::statement('ALTER TABLE bwm_responses ADD CONSTRAINT ck_bwm_scale_max_range CHECK (scale_max >= 3 AND scale_max <= 9)');
        DB::statement('ALTER TABLE bwm_best_to_others ADD CONSTRAINT ck_bwm_best_to_other_value_range CHECK (value >= 1 AND value <= 9)');
        DB::statement('ALTER TABLE bwm_others_to_worst ADD CONSTRAINT ck_bwm_other_to_worst_value_range CHECK (value >= 1 AND value <= 9)');
        DB::statement('ALTER TABLE bwm_weights ADD CONSTRAINT ck_bwm_weight_non_negative CHECK (weight >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('bwm_weights');
        Schema::dropIfExists('bwm_others_to_worst');
        Schema::dropIfExists('bwm_best_to_others');
        Schema::dropIfExists('bwm_responses');
        Schema::dropIfExists('criteria');
        Schema::dropIfExists('lecturer_time_slot_preferences');
        Schema::dropIfExists('lecturer_course_preferences');
        Schema::dropIfExists('lecturer_allowed_time_slots');
        Schema::dropIfExists('lecturer_allowed_courses');
        Schema::dropIfExists('classes');
        Schema::dropIfExists('time_slots');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('lecturers');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('majors');
        Schema::dropIfExists('datasets');
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('employees');
    }
};
