<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('lecturer_allowed_time_slots');
    }

    public function down(): void
    {
        Schema::create('lecturer_allowed_time_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lecturer_id')->constrained('lecturers')->cascadeOnDelete();
            $table->foreignId('time_slot_id')->constrained('time_slots')->cascadeOnDelete();
            $table->foreignId('created_by')->default(1)->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->unique(['lecturer_id', 'time_slot_id'], 'uq_lats_hard_lecturer_time_slot');
        });
    }
};
