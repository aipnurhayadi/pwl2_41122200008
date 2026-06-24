<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimetableAssignmentPenalty extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'assignment_id',
        'criterion_code',
        'penalty_value',
        'created_at',
    ];

    protected $casts = [
        'penalty_value' => 'float',
        'created_at' => 'datetime',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(TimetableAssignment::class, 'assignment_id');
    }
}
