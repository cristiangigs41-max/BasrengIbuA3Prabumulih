# Menyambungkan database online (Supabase, gratis)

1. Daftar di https://supabase.com lalu **New project** (nama bebas, catat password database, region Singapore).
2. Menu **Authentication → Sign In / Providers → Email**: matikan **Confirm email**, simpan.
3. Menu **SQL Editor → New query**: tempel seluruh isi `supabase/schema.sql`, klik **Run**.
   (Email admin default `admin@basrengibua3.com`; ganti di baris awal file bila perlu.)
4. Menu **Project Settings → API**: salin **Project URL** dan **anon / publishable key**, kirim ke Claude.
5. Setelah situs terbaru aktif, daftar di situs dengan email admin (password kuat). Akun itu otomatis menjadi admin.

Kunci anon bersifat publik. Tabel dikunci (RLS) dan semua aksi lewat fungsi `a3_*`, jadi data aman.
Jangan pernah membagikan kunci **service_role**.
