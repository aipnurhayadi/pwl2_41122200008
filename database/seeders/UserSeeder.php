<?php

namespace Database\Seeders;

use App\Models\Dataset;
use App\Models\User;
use Database\Seeders\Concerns\ResetsDatasetResources;
use Database\Seeders\Support\SeedContext;
use Database\Seeders\Support\SeederDefaults;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    use ResetsDatasetResources;

    public function run(): void
    {
        $systemUser = $this->ensureSystemUser();
        $this->syncPrimaryKeySequence('users');

        [$adminUser, $dataset] = $this->ensureAdminUserAndDataset(
            systemUserId: (int) $systemUser->id,
            email: SeederDefaults::DEFAULT_ADMIN_EMAIL,
            password: SeederDefaults::DEFAULT_ADMIN_PASSWORD,
            name: SeederDefaults::DEFAULT_ADMIN_NAME,
            datasetName: SeederDefaults::DEFAULT_DATASET_NAME,
            datasetDescription: SeederDefaults::DEFAULT_DATASET_DESCRIPTION,
        );

        SeedContext::$adminUser = $adminUser;
        SeedContext::$dataset = $dataset;
    }

    private function ensureSystemUser(): User
    {
        $existingByEmail = User::query()->where('email', 'system@local')->first();
        if ($existingByEmail) {
            return $existingByEmail;
        }

        $userWithIdOne = User::query()->find(SeederDefaults::SYSTEM_USER_ID);

        if (! $userWithIdOne) {
            return User::query()->create([
                'id' => SeederDefaults::SYSTEM_USER_ID,
                'name' => 'SYSTEM',
                'email' => 'system@local',
                'password' => Hash::make('SYSTEM'),
                'role' => User::ROLE_ADMIN,
                'created_by' => null,
            ]);
        }

        return User::query()->create([
            'name' => 'SYSTEM',
            'email' => 'system@local',
            'password' => Hash::make('SYSTEM'),
            'role' => User::ROLE_ADMIN,
            'created_by' => $userWithIdOne->id,
        ]);
    }

    /**
     * @return array{0: User, 1: Dataset}
     */
    private function ensureAdminUserAndDataset(
        int $systemUserId,
        string $email,
        string $password,
        string $name,
        string $datasetName,
        string $datasetDescription,
    ): array {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'role' => User::ROLE_ADMIN,
                'created_by' => $systemUserId,
            ]
        );

        if ($user->role !== User::ROLE_ADMIN) {
            $user->role = User::ROLE_ADMIN;
            $user->save();
        }

        $dataset = Dataset::query()->firstOrCreate(
            ['user_id' => $user->id, 'name' => $datasetName],
            [
                'created_by' => $user->id,
                'code' => 'TMP',
                'description' => $datasetDescription,
                'visibility' => Dataset::VISIBILITY_PRIVATE,
                'color' => SeederDefaults::DEFAULT_DATASET_COLOR,
            ]
        );

        if ($dataset->code === 'TMP' || $dataset->code === '') {
            $dataset->code = sprintf('DS%03d', $dataset->id);
            $dataset->save();
        }

        if (! $dataset->color) {
            $dataset->color = SeederDefaults::DEFAULT_DATASET_COLOR;
            $dataset->save();
        }

        return [$user, $dataset];
    }
}
