# PWL2 Timetable Solver (Go CLI)

CLI solver penjadwalan kuliah menggunakan **ILP** (Integer Linear Programming).

Bobot soft constraint berasal dari tabel `bwm_weights` (diagregasi Laravel), **bukan** dihitung di solver ini.

Port formulasi ILP dari spesifikasi penjadwalan di solver Go (`internal/ilp`, `internal/cbc`).

## Prasyarat

- Go 1.22+
- **CBC** (COIN-OR Branch and Cut) — solver open-source untuk MILP

### Instalasi CBC

**Windows:** unduh binary dari [COIN-OR CBC releases](https://github.com/coin-or/Cbc/releases) atau install via conda:

```powershell
conda install -c conda-forge coincbc
```

**Linux/macOS:**

```bash
sudo apt install coinor-cbc   # Debian/Ubuntu
brew install cbc              # macOS
```

Set path manual jika perlu:

```powershell
$env:SOLVER_CBC_PATH = "C:\path\to\cbc.exe"
```

Solver otomatis mencari CBC bawaan PuLP jika ada di mesin lokal.

## Menjalankan

```powershell
cd solver

go run ./cmd/solver timetable examples/timetable_minimal.json

# Input dari stdin
Get-Content payload.json | go run ./cmd/solver timetable
```

### Build binary (Linux / production)

```bash
cd solver
go build -o solver ./cmd/solver
```

Set `SOLVER_BINARY_PATH` in Laravel `.env` to the built binary path (default: `solver/solver` relative to project root).

Laravel menjalankan solver via queue job (`php artisan queue:work`) dengan input JSON stdin.

## Logging & artifacts (integrasi Laravel)

Saat dipanggil dari Laravel, `GoSolverRunner` menyimpan artifact per run dan mengirim env ke proses Go:

| Env | Fungsi |
|-----|--------|
| `PWL2_RUN_ID` | ID `timetable_runs` |
| `PWL2_DATASET_ID` | ID dataset |
| `PWL2_LOG_FILE` | Path file log fase solver |

Struktur folder (default `storage/app/timetable-runs/`):

```text
storage/app/timetable-runs/
└── dataset-1/
    ├── run-42_20260624-143022-123456_request.json
    ├── run-42_20260624-143022-123456_response.json
    ├── run-42_20260624-143022-123456_error.txt   # jika gagal
    └── run-42.log                                   # log fase Go (JSON lines)
```

Log fase ditulis ke **stderr** dan file (`internal/runlog`). **Stdout tetap murni JSON response.**

Fase yang dicatat: `RUN_STARTED`, `NORMALIZE_WEIGHTS`, `BUILD_CANDIDATES`, `BUILD_MODEL`, `CBC_SOLVE`, `ILP_SOLVE`, `RUN_FINISHED`.

Pantau real-time:

```bash
tail -f storage/app/timetable-runs/dataset-1/run-42.log
```

Config Laravel: `TIMETABLE_ARTIFACTS_PATH`, `TIMETABLE_ARTIFACT_RETENTION_DAYS` di `.env`.

## Perintah

| Perintah | Input JSON | Output |
|----------|------------|--------|
| `timetable [file]` | `TimetableSolveRequest` | `TimetableSolveResponse` |

Field `weights` di input harus sudah berisi bobot agregat (`SFT_001`–`SFT_005`) dari `bwm_weights`.

- **Input:** file JSON atau stdin
- **Output:** JSON ke stdout
- **Error:** pesan ke stderr, exit code `1`

## Struktur kode

```text
solver/
├── cmd/solver/main.go       # entrypoint CLI
├── internal/
│   ├── candidate/           → filter HRD_003/004 + pruning soft
│   ├── ilp/                 → MILP penjadwalan (HRD_001/002 global)
│   ├── cbc/                 → wrapper CBC
│   ├── model/               → kontrak JSON input/output
│   ├── runlog/              → logging terstruktur per-run (stderr + file)
│   └── timetable/           → orkestrasi pipeline ILP
└── examples/                → contoh payload JSON
```

## Hard vs Soft Constraint

| Kode | Tahap | Keterangan |
|------|-------|------------|
| HRD_003 | Candidate filter | Kapasitas ruang |
| HRD_004 | Candidate filter | Slot diizinkan dosen |
| HRD_001 | ILP | Tabrakan jadwal dosen |
| HRD_002 | ILP | Tabrakan jadwal ruang |
| SFT_001 | Candidate objective | Preferensi mata kuliah (bobot dari `bwm_weights`) |
| SFT_002 | Objective ILP | Penghindaran jeda kosong |
| SFT_003 | ILP hard cap | Beban mengajar per hari (`daily_session_limit`) |
| SFT_004 | Objective ILP | Pemerataan jadwal mengajar |
| SFT_005 | Objective ILP | Mobilitas lantai |

## Integrasi ke backend

Laravel membangun payload dari database, menyimpan artifact JSON, lalu memanggil binary `solver timetable` via stdin. Lihat `app/Services/Timetable/GoSolverRunner.php`.
