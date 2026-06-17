<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BwmBestToOther extends Model
{
    public $timestamps = false;

    protected $table = 'bwm_best_to_others';

    protected $fillable = [
        'response_id',
        'criterion_id',
        'value',
        'created_by',
    ];

    protected $casts = [
        'value' => 'integer',
        'created_at' => 'datetime',
    ];

    public function response(): BelongsTo
    {
        return $this->belongsTo(BwmResponse::class, 'response_id');
    }

    public function criterion(): BelongsTo
    {
        return $this->belongsTo(Criterion::class, 'criterion_id');
    }
}
