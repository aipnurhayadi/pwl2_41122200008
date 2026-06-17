<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BwmWeight extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'response_id',
        'criterion_id',
        'weight',
        'created_by',
    ];

    protected $casts = [
        'weight' => 'float',
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
