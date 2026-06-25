<?php

namespace Database\Seeders\Datasets\SistemInformasi;

use App\Services\Bwm\BwmMatrixSampler;
use App\Services\Bwm\BwmResponsePersister;
use App\Services\Bwm\BwmValidator;
use Database\Seeders\Concerns\InteractsWithDatasetCsv;
use Database\Seeders\Concerns\ResetsDatasetResources;
use Database\Seeders\Support\SeedContext;
use Illuminate\Database\Seeder;

class SistemInformasiDatasetSeeder extends Seeder
{
    use InteractsWithDatasetCsv;
    use ResetsDatasetResources;

    public function run(): void
    {
        $adminUser = SeedContext::$adminUser;
        $dataset = SeedContext::$dataset;

        if ($adminUser === null || $dataset === null) {
            throw new \RuntimeException('UserSeeder must run before SistemInformasiDatasetSeeder');
        }

        $this->validateCsvFiles();

        $creatorId = (int) $adminUser->id;
        $datasetId = (int) $dataset->id;

        $this->resetDatasetResources($datasetId);
        $this->resetMasterMajors();

        $this->call(MajorSeeder::class);

        $major = SeedContext::$major;
        if ($major === null) {
            throw new \RuntimeException('MajorSeeder did not set SeedContext::$major');
        }

        $this->callWith(RoomSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId]);
        $this->callWith(CourseSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId, 'major' => $major]);
        $this->callWith(ClassSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId, 'major' => $major]);
        $this->callWith(TimeSlotSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId]);
        $this->callWith(LecturerSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId]);
        $this->callWith(LecturerExpertiseAllowedCourseSeeder::class, ['dataset' => $dataset, 'creatorId' => $creatorId]);

        $this->callWith(
            LecturerCoursePreferenceSeeder::class,
            ['dataset' => $dataset, 'createdBy' => $creatorId],
        );

        $this->callWith(
            BwmResponseSeeder::class,
            [
                'dataset' => $dataset,
                'createdBy' => $creatorId,
                'sampler' => app(BwmMatrixSampler::class),
                'validator' => app(BwmValidator::class),
                'persister' => app(BwmResponsePersister::class),
            ],
        );
    }
}
