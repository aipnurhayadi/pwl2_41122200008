<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BwmResponse extends Model
{
    protected $fillable = [
        'dataset_id',
        'lecturer_id',
        'created_by',
        'best_criteria_id',
        'worst_criteria_id',
        'scale_max',
        'ksi',
        'consistency_ratio',
    ];

    protected $casts = [
        'scale_max' => 'integer',
        'ksi' => 'float',
        'consistency_ratio' => 'float',
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

    public function bestCriterion(): BelongsTo
    {
        return $this->belongsTo(Criterion::class, 'best_criteria_id');
    }

    public function worstCriterion(): BelongsTo
    {
        return $this->belongsTo(Criterion::class, 'worst_criteria_id');
    }

    public function bestToOthers(): HasMany
    {
        return $this->hasMany(BwmBestToOther::class, 'response_id');
    }

    public function othersToWorst(): HasMany
    {
        return $this->hasMany(BwmOtherToWorst::class, 'response_id');
    }

    public function weights(): HasMany
    {
        return $this->hasMany(BwmWeight::class, 'response_id');
    }
}
