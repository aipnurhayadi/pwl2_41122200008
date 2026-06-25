<?php

return [
    // Jalur eksekusi binary
    'solver_binary' => env('SOLVER_BINARY_PATH', base_path('solver/solver')),
    
    // Timeout eksekusi PHP/Symfony Process (harus lebih besar dari timeout CBC)
    'solver_timeout' => (int) env('SOLVER_TIMEOUT', 600),
    
    // Batas sesi mengajar per hari (15 adalah batas teoritis sistem, 8-10 lebih realistis di lapangan)
    'daily_session_limit' => (int) env('TIMETABLE_DAILY_SESSION_LIMIT', 10),
    
    // Batas maksimal variabel pencarian (menjaga RAM dan ukuran file .lp)
    'max_candidates_per_request' => (int) env('TIMETABLE_MAX_CANDIDATES_PER_REQUEST', 2000),
    
    // SINKRONISASI PENTING: Dibatasi 12 agar 12 ruang x 154 timeslot = 1848 (tidak melebihi 2000)
    'max_rooms_per_request' => (int) env('TIMETABLE_MAX_ROOMS_PER_REQUEST', 12),
    
    // Konfigurasi BWM dan ILP
    'transition_neighbor_limit' => (int) env('TIMETABLE_TRANSITION_NEIGHBOR_LIMIT', 10),
    'solver_time_limit_seconds' => (int) env('TIMETABLE_SOLVER_TIME_LIMIT_SECONDS', 300),
    'solver_relative_gap' => (float) env('TIMETABLE_SOLVER_RELATIVE_GAP', 0.03),
    'solver_threads' => (int) env('TIMETABLE_SOLVER_THREADS', 2),
    
    // Penyimpanan file log/model
    'artifacts_path' => env('TIMETABLE_ARTIFACTS_PATH', storage_path('app/timetable-runs')),
    'artifact_retention_days' => (int) env('TIMETABLE_ARTIFACT_RETENTION_DAYS', 30),
];