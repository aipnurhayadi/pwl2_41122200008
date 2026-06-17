<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Criterion extends Model
{
    public const TYPE_SOFT = 'SOFT';

    public const TYPE_HARD = 'HARD';

    protected $fillable = [
        'created_by',
        'type',
        'code',
        'name',
        'description',
        'is_lecturer_preference',
    ];

    protected $casts = [
        'is_lecturer_preference' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
