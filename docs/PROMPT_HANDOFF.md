# EstimatorPro — Prompt Handoff

## Lokasi dan publikasi

- Folder kerja lokal: `D:\Starcoms\EstimatorPro`
- Repository GitHub: `https://github.com/Rizqiyahya/estimatorpro.git`
- Produksi GitHub Pages: `https://rizqiyahya.github.io/estimatorpro/`
- Branch deployment: `main`

## Arsitektur aplikasi

- Aplikasi web SPA frontend murni.
- Entry point: `index.html`
- Styling utama: `css/style.css`
- Modul JavaScript: `js/*.js`
- Database: Supabase melalui `js/db.js`.
- Fallback/penyimpanan lokal: `js/storage.js`.
- Seluruh UI, toast, dan penjelasan menggunakan Bahasa Indonesia.

## Konteks Supabase terbaru (dikonfirmasi pengguna, 2026-08-31)

Perubahan SQL yang telah dijalankan/diperbarui melalui Supabase SQL Editor:

1. Tabel `public.wbs` untuk Work Breakdown Structure:
   - Relasi wajib ke `public.tasks(id)` melalui `task_id`.
   - Struktur parent-child memakai `parent_id` yang mereferensikan `public.wbs(id)`.
   - Level dibatasi 1, 2, atau 3.
   - Kolom utama: `name`, `start_date`, `duration_days`, dan `seq`.
   - Index `idx_wbs_task_id` dan `idx_wbs_parent_id`.
   - RLS: estimator akses penuh; manager hanya SELECT.
   - Sudah ditambahkan ke publication `supabase_realtime`.

2. Tabel `public.tasks` memiliki kolom tambahan:
   - `category TEXT NOT NULL DEFAULT ''`
   - `pipeline_history JSONB NOT NULL DEFAULT '[]'`

3. Skema utama sebelumnya mencakup: `profiles`, `requests`, `tasks`, dan `estimates`; RLS membatasi estimator untuk akses penuh dan manager untuk baca saja pada data operasional.

## Aturan kerja

- Baca file terkait sebelum mengubah kode.
- Jangan menghapus atau merombak fitur yang telah ada tanpa persetujuan pengguna.
- Selaraskan kode frontend, khususnya query/payload Supabase, dengan skema di atas sebelum membuat fitur WBS, kategori task, atau riwayat pipeline.
- Jangan pernah menyimpan service-role key, password, atau secret Supabase di repository publik. Hanya gunakan anon key yang memang dirancang untuk frontend, dengan RLS yang benar.
- Bila pengguna meminta publikasi: cek perubahan, `git add`, commit dengan pesan jelas, push ke `origin/main`, lalu laporkan hash commit dan URL deployment.

## Prompt awal untuk percakapan baru

Saya mengembangkan EstimatorPro. Buka dan gunakan konteks proyek di `D:\Starcoms\EstimatorPro\docs\PROMPT_HANDOFF.md`. Kerjakan perubahan dari folder lokal `D:\Starcoms\EstimatorPro`. Sebelum mengubah kode, periksa struktur dan file terkait. Gunakan Bahasa Indonesia untuk seluruh UI dan penjelasan. Tugas saya: [TULISKAN TUGAS DI SINI].
