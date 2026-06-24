<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TimetableAssignment extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'run_id',
        'request_index',
        'lecturer_id',
        'course_id',
        'class_id',
        'room_id',
        'start_time_slot_id',
        'end_time_slot_id',
        'objective_cost',
        'created_at',
    ];

    protected $casts = [
        'request_index' => 'integer',
        'objective_cost' => 'float',
        'created_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(TimetableRun::class, 'run_id');
    }

    public function penalties(): HasMany
    {
        return $this->hasMany(TimetableAssignmentPenalty::class, 'assignment_id');
    }
}
