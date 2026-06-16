<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LecturerAllowedCourse extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'lecturer_id',
        'course_id',
        'created_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function lecturer(): BelongsTo
    {
        return $this->belongsTo(Lecturer::class, 'lecturer_id');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class, 'course_id');
    }
}
