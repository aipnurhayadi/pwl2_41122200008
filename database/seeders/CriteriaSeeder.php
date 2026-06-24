<?php

namespace Database\Seeders;

use Database\Seeders\Support\SeedContext;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CriteriaSeeder extends Seeder
{
    public function run(): void
    {
        $creatorId = (int) SeedContext::$adminUser?->id;
        $inserted = 0;

        foreach (SeederDefaults::SOFT_CRITERIA as [$code, $name, $description, $isLecturerPreference]) {
            if (! DB::table('criteria')->where('code', $code)->exists()) {
                DB::table('criteria')->insert([
                    'created_by' => $creatorId,
                    'type' => 'SOFT',
                    'code' => $code,
                    'name' => $name,
                    'description' => $description,
                    'is_lecturer_preference' => $isLecturerPreference,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $inserted++;
            }
        }

        foreach (SeederDefaults::HARD_CRITERIA as [$code, $name, $description]) {
            if (! DB::table('criteria')->where('code', $code)->exists()) {
                DB::table('criteria')->insert([
                    'created_by' => $creatorId,
                    'type' => 'HARD',
                    'code' => $code,
                    'name' => $name,
                    'description' => $description,
                    'is_lecturer_preference' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $inserted++;
            }
        }

        echo "Seeded {$inserted} criteria (skipped duplicates).\n";
    }
}
