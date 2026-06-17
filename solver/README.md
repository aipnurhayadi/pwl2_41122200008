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

### Build binary

```powershell
go build -o solver.exe ./cmd/solver
.\solver.exe timetable examples\timetable_minimal.json
```

## Perintah

| Perintah | Input JSON | Output |
|----------|------------|--------|
| `timetable [file]` | `TimetableSolveRequest` | `TimetableSolveResponse` |

Field `weights` di input harus sudah berisi bobot agregat (`SFT_001`–`SFT_008`) dari `bwm_weights`.

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
| SFT_001–008 | Objective ILP | Soft penalty (bobot dari `bwm_weights`) |

## Integrasi ke backend (nanti)

Laravel query `bwm_weights` → agregasi → bangun JSON → panggil:

```php
$result = shell_exec('solver.exe timetable input.json');
```
