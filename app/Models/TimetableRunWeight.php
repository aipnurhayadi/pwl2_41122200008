<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimetableRunWeight extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'run_id',
        'criterion_id',
        'weight',
        'created_at',
    ];

    protected $casts = [
        'weight' => 'float',
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
