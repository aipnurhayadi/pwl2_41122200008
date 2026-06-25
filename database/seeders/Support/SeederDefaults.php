<?php

namespace Database\Seeders\Support;

final class SeederDefaults
{
    public const SYSTEM_USER_ID = 1;

    public const DEFAULT_EMPLOYEE_PASSWORD = 'Employee123!';

    public const DEFAULT_ADMIN_EMAIL = 'admin@example.com';

    public const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

    public const DEFAULT_ADMIN_NAME = 'Admin';

    public const DEFAULT_DATASET_NAME = 'Dataset Seed Default';

    public const DEFAULT_DATASET_DESCRIPTION = 'Auto-created for seed scripts';

    public const DEFAULT_DATASET_COLOR = '#6366F1';

    public const DEFAULT_MAJOR_NAME = 'Sistem Informasi';

    public const DEFAULT_ROOM_CAPACITY = 40;

    public const CLASSES_PER_SEMESTER = 1;

    public const DEFAULT_SLOT_MINUTES = 60;

    public const BREAK_START = '11:40';

    public const BREAK_END = '13:00';

    /** @var list<string> */
    public const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    /** @var list<array{0: string, 1: string, 2: string, 3: bool}> */
    public const SOFT_CRITERIA = [
        ['SFT_001', 'Preferensi Mata Kuliah', 'Dosen mengajar mata kuliah yang sesuai dengan prioritas/kompetensinya.', true],
        ['SFT_002', 'Penghindaran Jeda Kosong', 'Meminimalkan waktu tunggu (idle time) yang terlalu lama bagi dosen di antara dua sesi kelas pada hari yang sama.', false],
        ['SFT_003', 'Beban Mengajar Per Hari', 'Jumlah total sesi mengajar dosen per hari tidak melebihi batas ideal kelayakan fisik.', false],
        ['SFT_004', 'Pemerataan Jadwal Mengajar', 'Jadwal mengajar dosen dan penggunaan gedung tersebar merata sepanjang minggu (tidak menumpuk di hari tertentu).', false],
        ['SFT_005', 'Preferensi Jarak/Mobilitas Lantai', 'Meminimalkan perpindahan lantai gedung yang ekstrem bagi dosen di antara dua sesi mengajar yang berurutan.', false],
    ];

    /** @var list<array{0: string, 1: string, 2: string}> */
    public const HARD_CRITERIA = [
        ['HRD_001', 'Tidak Ada Tabrakan Jadwal Dosen', 'Seorang dosen tidak boleh mengajar dua kelas berbeda pada waktu yang sama.'],
        ['HRD_002', 'Tidak Ada Tabrakan Jadwal Ruangan', 'Sebuah ruangan tidak boleh digunakan untuk dua kelas berbeda pada waktu yang sama.'],
        ['HRD_003', 'Kapasitas Ruangan', 'Jumlah mahasiswa dalam kelas tidak boleh melebihi kapasitas ruangan.'],
        ['HRD_004', 'Ketersediaan Dosen', 'Dosen hanya dijadwalkan pada waktu dan hari yang tersedia.'],
    ];

    public const CSV_DATASET_SLUG = 'sistem_informasi';
}
