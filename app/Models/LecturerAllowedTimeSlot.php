<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LecturerAllowedTimeSlot extends Model
{
    public $timestamps = false;

    protected $table = 'lecturer_allowed_time_slots';

    protected $fillable = [
        'lecturer_id',
        'time_slot_id',
        'created_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(Lecturer::class, 'lecturer_id');
    }

    public function timeSlot(): BelongsTo
    {
        return $this->belongsTo(TimeSlot::class, 'time_slot_id');
    }
}
