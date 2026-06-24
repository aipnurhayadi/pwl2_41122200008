<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Models\Major;
use Database\Seeders\Support\SeedContext;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;

class MajorSeeder extends Seeder
{
    public function run(): void
    {
        $creatorId = (int) SeedContext::$adminUser?->id;

        $major = Major::query()->create([
            'created_by' => $creatorId,
            'code' => 'MJR001',
            'name' => SeederDefaults::DEFAULT_MAJOR_NAME,
            'description' => 'Master major seeded from SistemInformasi dataset seeder',
        ]);

        SeedContext::$major = $major;
    }
}
