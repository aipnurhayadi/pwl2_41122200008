<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimetableRunLecturerSummary extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'run_id',
        'lecturer_id',
        'session_count',
        'total_penalty',
        'direct_penalty',
        'fairness_deviation',
        'created_at',
    ];

    protected $casts = [
        'session_count' => 'integer',
        'total_penalty' => 'float',
        'direct_penalty' => 'float',
        'fairness_deviation' => 'float',
        'created_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(TimetableRun::class, 'run_id');
    }

    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(Lecturer::class, 'lecturer_id');
    }
}
