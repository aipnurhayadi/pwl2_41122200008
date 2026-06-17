<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE lecturer_course_preferences DROP CONSTRAINT IF EXISTS ck_lcp_rank_order_range');
        } else {
            DB::statement('ALTER TABLE lecturer_course_preferences DROP CHECK ck_lcp_rank_order_range');
        }

        DB::statement(
            'ALTER TABLE lecturer_course_preferences '
            .'ADD CONSTRAINT ck_lcp_rank_order_range CHECK (rank_order >= 1 AND rank_order <= 7)'
        );
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE lecturer_course_preferences DROP CONSTRAINT IF EXISTS ck_lcp_rank_order_range');
        } else {
            DB::statement('ALTER TABLE lecturer_course_preferences DROP CHECK ck_lcp_rank_order_range');
        }

        DB::statement(
            'ALTER TABLE lecturer_course_preferences '
            .'ADD CONSTRAINT ck_lcp_rank_order_range CHECK (rank_order >= 1 AND rank_order <= 3)'
        );
    }
};
