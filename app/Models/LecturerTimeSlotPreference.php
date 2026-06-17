<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LecturerTimeSlotPreference extends Model
{
    protected $fillable = [
        'dataset_id',
        'lecturer_id',
        'start_time_slot_id',
        'end_time_slot_id',
        'created_by',
        'choice_order',
    ];

    protected $casts = [
        'choice_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(Lecturer::class, 'lecturer_id');
    }

    public function startTimeSlot(): BelongsTo
    {
        return $this->belongsTo(TimeSlot::class, 'start_time_slot_id');
    }

    public function endTimeSlot(): BelongsTo
    {
        return $this->belongsTo(TimeSlot::class, 'end_time_slot_id');
    }
}
