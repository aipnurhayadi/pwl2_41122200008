<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BwmController;
use App\Http\Controllers\Api\ClassController;
use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\CriterionController;
use App\Http\Controllers\Api\DatasetController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\LecturerAllowedCourseController;
use App\Http\Controllers\Api\LecturerController;
use App\Http\Controllers\Api\LecturerPreferenceController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\TimeSlotController;
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

Route::prefix('employees')->middleware('auth:sanctum')->group(function (): void {
    Route::get('/', [EmployeeController::class, 'index']);
    Route::post('/', [EmployeeController::class, 'store']);
    Route::get('/{employeeId}', [EmployeeController::class, 'show'])->whereNumber('employeeId');
    Route::put('/{employeeId}', [EmployeeController::class, 'update'])->whereNumber('employeeId');
    Route::delete('/{employeeId}', [EmployeeController::class, 'destroy'])->whereNumber('employeeId');
});

Route::prefix('datasets')->group(function (): void {
    Route::get('/public', [DatasetController::class, 'public']);
    Route::get('/{datasetId}/tree', [DatasetController::class, 'tree'])->whereNumber('datasetId');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/my', [DatasetController::class, 'my']);
        Route::get('/', [DatasetController::class, 'index']);
        Route::post('/', [DatasetController::class, 'store']);

        Route::get('/{datasetId}/rooms', [RoomController::class, 'index'])->whereNumber('datasetId');
        Route::post('/{datasetId}/rooms', [RoomController::class, 'store'])->whereNumber('datasetId');
        Route::get('/{datasetId}/rooms/{roomId}', [RoomController::class, 'show'])->whereNumber(['datasetId', 'roomId']);
        Route::put('/{datasetId}/rooms/{roomId}', [RoomController::class, 'update'])->whereNumber(['datasetId', 'roomId']);
        Route::delete('/{datasetId}/rooms/{roomId}', [RoomController::class, 'destroy'])->whereNumber(['datasetId', 'roomId']);

        Route::get('/{datasetId}/lecturers', [LecturerController::class, 'index'])->whereNumber('datasetId');
        Route::post('/{datasetId}/lecturers', [LecturerController::class, 'store'])->whereNumber('datasetId');
        Route::get('/{datasetId}/lecturers/{lecturerId}', [LecturerController::class, 'show'])->whereNumber(['datasetId', 'lecturerId']);
        Route::put('/{datasetId}/lecturers/{lecturerId}', [LecturerController::class, 'update'])->whereNumber(['datasetId', 'lecturerId']);
        Route::delete('/{datasetId}/lecturers/{lecturerId}', [LecturerController::class, 'destroy'])->whereNumber(['datasetId', 'lecturerId']);

        Route::get('/{datasetId}/courses', [CourseController::class, 'index'])->whereNumber('datasetId');
        Route::post('/{datasetId}/courses', [CourseController::class, 'store'])->whereNumber('datasetId');
        Route::get('/{datasetId}/courses/{courseId}', [CourseController::class, 'show'])->whereNumber(['datasetId', 'courseId']);
        Route::put('/{datasetId}/courses/{courseId}', [CourseController::class, 'update'])->whereNumber(['datasetId', 'courseId']);
        Route::delete('/{datasetId}/courses/{courseId}', [CourseController::class, 'destroy'])->whereNumber(['datasetId', 'courseId']);

        Route::get('/{datasetId}/time-slots', [TimeSlotController::class, 'index'])->whereNumber('datasetId');
        Route::post('/{datasetId}/time-slots', [TimeSlotController::class, 'store'])->whereNumber('datasetId');
        Route::get('/{datasetId}/time-slots/{slotId}', [TimeSlotController::class, 'show'])->whereNumber(['datasetId', 'slotId']);
        Route::put('/{datasetId}/time-slots/{slotId}', [TimeSlotController::class, 'update'])->whereNumber(['datasetId', 'slotId']);
        Route::delete('/{datasetId}/time-slots/{slotId}', [TimeSlotController::class, 'destroy'])->whereNumber(['datasetId', 'slotId']);

        Route::get('/{datasetId}/classes', [ClassController::class, 'index'])->whereNumber('datasetId');
        Route::post('/{datasetId}/classes', [ClassController::class, 'store'])->whereNumber('datasetId');
        Route::get('/{datasetId}/classes/{classId}', [ClassController::class, 'show'])->whereNumber(['datasetId', 'classId']);
        Route::put('/{datasetId}/classes/{classId}', [ClassController::class, 'update'])->whereNumber(['datasetId', 'classId']);
        Route::delete('/{datasetId}/classes/{classId}', [ClassController::class, 'destroy'])->whereNumber(['datasetId', 'classId']);

        Route::get('/{datasetId}/criteria', [CriterionController::class, 'index'])->whereNumber('datasetId');

        Route::get('/{datasetId}/lecturers/{lecturerId}/allowed-courses', [LecturerAllowedCourseController::class, 'show'])->whereNumber(['datasetId', 'lecturerId']);
        Route::put('/{datasetId}/lecturers/{lecturerId}/allowed-courses', [LecturerAllowedCourseController::class, 'update'])->whereNumber(['datasetId', 'lecturerId']);

        Route::get('/{datasetId}/lecturer-preferences/my', [LecturerPreferenceController::class, 'myShow'])->whereNumber('datasetId');
        Route::put('/{datasetId}/lecturer-preferences/my', [LecturerPreferenceController::class, 'myUpdate'])->whereNumber('datasetId');
        Route::get('/{datasetId}/lecturer-preferences/my/constraints', [LecturerPreferenceController::class, 'myConstraints'])->whereNumber('datasetId');
        Route::get('/{datasetId}/lecturers/{lecturerId}/preferences', [LecturerPreferenceController::class, 'showForLecturer'])->whereNumber(['datasetId', 'lecturerId']);

        Route::get('/{datasetId}/bwm/my', [BwmController::class, 'myShow'])->whereNumber('datasetId');
        Route::put('/{datasetId}/bwm/my', [BwmController::class, 'myUpdate'])->whereNumber('datasetId');
        Route::get('/{datasetId}/lecturers/{lecturerId}/bwm', [BwmController::class, 'showForLecturer'])->whereNumber(['datasetId', 'lecturerId']);

        Route::get('/{datasetId}', [DatasetController::class, 'show'])->whereNumber('datasetId');
        Route::put('/{datasetId}', [DatasetController::class, 'update'])->whereNumber('datasetId');
        Route::delete('/{datasetId}', [DatasetController::class, 'destroy'])->whereNumber('datasetId');
    });
});
