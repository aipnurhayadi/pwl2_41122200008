# PWL Timetable App

Panduan ini menjelaskan cara menjalankan aplikasi dari nol: clone repository, setup backend dan frontend, migrasi database dengan Alembic, lalu seed data awal.

## 1. Prasyarat

- Git
- Python 3.11+
- Node.js 18+
- MySQL Server 8+

## 2. Clone Repository

```bash
git clone <url-repository-anda>
cd pwl2_41122200008
```

## 3. Setup Database MySQL

Buat database baru, contoh:

```sql
CREATE DATABASE pwl2_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Catat username, password, host, dan port MySQL Anda.

## 4. Setup Backend (FastAPI)

Masuk ke folder backend:

```powershell
cd backend
```

Buat virtual environment dan install dependency:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Salin file environment lalu sesuaikan nilainya:

```powershell
Copy-Item .env.example .env
```

Contoh isi penting di `.env`:

```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/pwl2_db
ALLOW_ORIGINS=http://localhost:5173
SECRET_KEY=ganti_dengan_secret_random_yang_panjang
```

## 5. Migrasi Database (Alembic)

Jalankan semua migration sampai head:

```powershell
python -m alembic upgrade head
```

Cek revision aktif:

```powershell
python -m alembic current
```

## 6. Seed Data

### 6.1 Seed User dan Dataset

Script ini membuat 1 user dan 1 dataset (idempotent, aman dijalankan ulang).

```powershell
python seed_user_dataset.py
```

Output akan menampilkan `DATASET_ID` yang dipakai pada seed berikutnya.

Default credential dari script:

- Email: admin@example.com
- Password: Admin123!

Anda juga bisa override nilai default:

```powershell
python seed_user_dataset.py --email admin@example.com --password Admin123! --name Admin --dataset "Dataset Seed Default"
```

### 6.2 Seed Dosen dan Mata Kuliah

Gunakan `DATASET_ID` dari langkah sebelumnya.

```powershell
python seed_lecturers_courses.py 1
```

### 6.3 Seed Time Slots

Gunakan `DATASET_ID` yang sama.

```powershell
python seed_time_slots.py 1
```

## 7. Menjalankan Backend

Masih dari folder backend:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend tersedia di:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

## 8. Setup dan Jalankan Frontend (Vite + React)

Buka terminal baru, lalu:

```powershell
cd frontend
npm install
npm run dev
```

Frontend tersedia di:

- http://localhost:5173

Catatan: konfigurasi Vite sudah mem-proxy request `/api` ke `http://localhost:8000`.

## 9. Urutan Cepat (Ringkas)

```text
1) Clone repo
2) Setup MySQL + buat database
3) Setup backend + .env
4) alembic upgrade head
5) python seed_user_dataset.py
6) python seed_lecturers_courses.py <DATASET_ID>
7) python seed_time_slots.py <DATASET_ID>
8) Jalankan backend (uvicorn)
9) Jalankan frontend (npm run dev)
```

## 10. Troubleshooting Singkat

- Error `KeyError: DATABASE_URL`:
  Pastikan file `.env` ada di folder `backend` dan berisi `DATABASE_URL`.

- Error akses MySQL ditolak (`1045 Access denied`):
  Cek username/password MySQL di `DATABASE_URL`.

- Frontend tidak bisa akses API:
  Pastikan backend aktif di port 8000 dan frontend di port 5173.
