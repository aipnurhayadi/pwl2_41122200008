<?php

return [
    'solver_binary' => env('SOLVER_BINARY_PATH', base_path('solver/solver')),
    'solver_timeout' => (int) env('SOLVER_TIMEOUT', 120),
    'daily_session_limit' => (int) env('TIMETABLE_DAILY_SESSION_LIMIT', 5),
    'max_candidates_per_request' => (int) env('TIMETABLE_MAX_CANDIDATES_PER_REQUEST', 200),
    'transition_neighbor_limit' => (int) env('TIMETABLE_TRANSITION_NEIGHBOR_LIMIT', 8),
    'solver_time_limit_seconds' => (int) env('TIMETABLE_SOLVER_TIME_LIMIT_SECONDS', 45),
    'solver_relative_gap' => (float) env('TIMETABLE_SOLVER_RELATIVE_GAP', 0.03),
    'solver_threads' => (int) env('TIMETABLE_SOLVER_THREADS', 2),
    'artifacts_path' => env('TIMETABLE_ARTIFACTS_PATH', storage_path('app/timetable-runs')),
    'artifact_retention_days' => (int) env('TIMETABLE_ARTIFACT_RETENTION_DAYS', 30),
];
