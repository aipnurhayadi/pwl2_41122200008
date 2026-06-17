<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lecturer extends Model
{
    use HasFactory;

    protected $fillable = [
        'dataset_id',
        'employee_id',
        'created_by',
        'code',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function allowedCourses(): HasMany
    {
        return $this->hasMany(LecturerAllowedCourse::class, 'lecturer_id');
    }

    public function coursePreferences(): HasMany
    {
        return $this->hasMany(LecturerCoursePreference::class, 'lecturer_id');
    }

    public function timeSlotPreferences(): HasMany
    {
        return $this->hasMany(LecturerTimeSlotPreference::class, 'lecturer_id');
    }

    public function bwmResponse(): HasMany
    {
        return $this->hasMany(BwmResponse::class, 'lecturer_id');
    }
}
