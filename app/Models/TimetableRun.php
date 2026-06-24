<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TimetableRun extends Model
{
    public const STATUS_QUEUED = 'QUEUED';

    public const STATUS_RUNNING = 'RUNNING';

    public const STATUS_COMPLETED = 'COMPLETED';

    public const STATUS_FAILED = 'FAILED';

    public const PHASE_AGGREGATING_BWM = 'AGGREGATING_BWM';

    public const PHASE_BUILDING_PAYLOAD = 'BUILDING_PAYLOAD';

    public const PHASE_RUNNING_SOLVER = 'RUNNING_SOLVER';

    public const PHASE_PERSISTING = 'PERSISTING';

    public const PHASE_COMPLETED = 'COMPLETED';

    protected $fillable = [
        'dataset_id',
        'created_by',
        'status',
        'phase',
        'progress_percent',
        'objective_value',
        'solver_name',
        'error_message',
        'fairness_index',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'progress_percent' => 'integer',
        'objective_value' => 'float',
        'fairness_index' => 'float',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    public function weights(): HasMany
    {
        return $this->hasMany(TimetableRunWeight::class, 'run_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(TimetableAssignment::class, 'run_id');
    }

    public function constraintSummaries(): HasMany
    {
        return $this->hasMany(TimetableRunConstraintSummary::class, 'run_id');
    }

    public function lecturerSummaries(): HasMany
    {
        return $this->hasMany(TimetableRunLecturerSummary::class, 'run_id');
    }
}
