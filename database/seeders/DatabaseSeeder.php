<?php

namespace Database\Seeders;

use Database\Seeders\Datasets\SistemInformasi\SistemInformasiDatasetSeeder;
use Database\Seeders\Support\SeedContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            SeedContext::reset();

            $this->call([
                UserSeeder::class,
                CriteriaSeeder::class,
                SistemInformasiDatasetSeeder::class,
            ]);
        });
    }
}
