<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DatasetController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

Route::prefix('datasets')->group(function (): void {
    Route::get('/public', [DatasetController::class, 'public']);
    Route::get('/{datasetId}/tree', [DatasetController::class, 'tree']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/my', [DatasetController::class, 'my']);
        Route::get('/', [DatasetController::class, 'index']);
        Route::post('/', [DatasetController::class, 'store']);
        Route::get('/{datasetId}', [DatasetController::class, 'show']);
        Route::put('/{datasetId}', [DatasetController::class, 'update']);
        Route::delete('/{datasetId}', [DatasetController::class, 'destroy']);
    });
});
