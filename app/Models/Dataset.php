<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Dataset extends Model
{
    use HasFactory;

    public const VISIBILITY_PUBLIC = 'PUBLIC';
    public const VISIBILITY_PRIVATE = 'PRIVATE';

    protected $fillable = [
        'user_id',
        'created_by',
        'code',
        'name',
        'description',
        'visibility',
        'color',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class, 'dataset_id');
    }

    public function lecturers(): HasMany
    {
        return $this->hasMany(Lecturer::class, 'dataset_id');
    }

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'dataset_id');
    }

    public function timeSlots(): HasMany
    {
        return $this->hasMany(TimeSlot::class, 'dataset_id');
    }

    public function classes(): HasMany
    {
        return $this->hasMany(ClassModel::class, 'dataset_id');
    }
}
