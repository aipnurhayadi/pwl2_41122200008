<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimetableRunConstraintSummary extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'run_id',
        'criterion_id',
        'satisfied_count',
        'violated_count',
        'total_penalty',
        'created_at',
    ];

    protected $casts = [
        'satisfied_count' => 'integer',
        'violated_count' => 'integer',
        'total_penalty' => 'float',
        'created_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(TimetableRun::class, 'run_id');
    }

    public function criterion(): BelongsTo
    {
        return $this->belongsTo(Criterion::class, 'criterion_id');
    }
}
