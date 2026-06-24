<?php

namespace Database\Seeders\Support;

use App\Models\Dataset;
use App\Models\Major;
use App\Models\User;

final class SeedContext
{
    public static ?User $adminUser = null;

    public static ?Dataset $dataset = null;

    public static ?Major $major = null;

    public static function reset(): void
    {
        self::$adminUser = null;
        self::$dataset = null;
        self::$major = null;
    }
}
