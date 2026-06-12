# PWL Timetable App

Repository ini sekarang memakai Laravel sebagai backend di root repo, dengan React/Vite tetap berada di folder `frontend/` untuk kebutuhan development. Fitur solver dan tabel `timetable_*` tetap dikecualikan dari port Laravel.

## Prasyarat

- PHP 8.3+
- Composer
- Node.js 18+
- PostgreSQL

## Setup Backend

```powershell
Copy-Item .env.example .env
composer install
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
```

Atur koneksi database di `.env` sesuai PostgreSQL lokal Anda.

## Menjalankan Backend

```powershell
php artisan serve
```

API Laravel tersedia di `http://localhost:8000` secara default.

## Setup Frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite mem-proxy request `/api` ke backend Laravel saat development.

## Urutan Cepat

```text
1) Copy .env dan sesuaikan koneksi database
2) composer install
3) php artisan migrate --force
4) php artisan db:seed --force
5) Jalankan backend dengan php artisan serve
6) Jalankan frontend dari frontend/ dengan npm run dev
```
