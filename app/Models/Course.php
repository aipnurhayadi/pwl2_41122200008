<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'dataset_id',
        'created_by',
        'name',
        'code',
        'major_id',
        'credits',
        'semester',
        'curriculum_year',
        'description',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'major_code',
        'major_name',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class, 'major_id');
    }

    public function getMajorCodeAttribute(): ?string
    {
        return $this->major?->code;
    }

    public function getMajorNameAttribute(): ?string
    {
        return $this->major?->name;
    }
}
