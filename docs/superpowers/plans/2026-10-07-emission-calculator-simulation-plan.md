# Rencana Implementasi Kalkulator Emisi GRK

Spesifikasi: `docs/superpowers/specs/2026-10-07-emission-calculator-simulation-design.md`

## Batas Tetap

- Kalkulator hanya memakai state React dalam memori.
- Tidak ada Prisma, migrasi, API mutasi, localStorage, atau integrasi Riwayat Audit.
- Tidak ada perubahan terhadap halaman selain penambahan item sidebar dan cabang render tab baru.
- Registry faktor kalkulator terisolasi dan read-only.

## Tahap 1 — Kontrak dan Engine

1. Tambahkan unit test untuk validasi input, tanggal inklusif, tahun kabisat, rumus dasar, Scope 1A/1B, Scope 2, perjalanan, PCAF, offset, EV, EBT, KKB, surat hijau, dan rekapitulasi.
2. Tambahkan registry faktor v1 dengan metadata sumber/tahun/versi/status.
3. Implementasikan engine pure function tanpa pembulatan internal.
4. Tambahkan formatter angka Indonesia yang membulatkan hanya pada presentasi.
5. Jalankan seluruh unit test engine.

## Tahap 2 — Fondasi UI

1. Tambahkan test kontrak sidebar dan render tab kalkulator.
2. Tambahkan item `calculator` pada grup INPUT & AUDIT.
3. Tambahkan cabang render pada `src/app/page.js`.
4. Buat `EmissionCalculatorPage` sebagai pemilik state sesi.
5. Buat navigasi internal Beranda, Rekapitulasi, dan Faktor Emisi.

## Tahap 3 — Beranda dan Form Entri

1. Buat kartu kategori penambah dan pengurangan dengan status jumlah entri.
2. Buat profil/periode dan perhitungan hari inklusif.
3. Buat dropdown searchable yang reusable.
4. Implementasikan form kategori secara bertahap:
   - Scope 1A;
   - Scope 1B pemakaian/jarak;
   - Scope 2;
   - Perjalanan pesawat/hotel/kereta;
   - PCAF;
   - Offset;
   - Kendaraan listrik;
   - EBT;
   - KKB listrik;
   - Surat berharga hijau.
5. Tambahkan daftar entri, edit, hapus dengan konfirmasi, dan subtotal.
6. Pastikan semua perhitungan dipanggil melalui engine, bukan dihitung di komponen.

## Tahap 4 — Ringkasan dan Rekapitulasi

1. Buat panel live sticky untuk penambah, pengurangan, dan emisi bersih.
2. Buat halaman rekap dengan KPI, persentase, intensitas per hari, rincian kategori expandable, dan progress bar.
3. Tambahkan komposisi kategori menggunakan visual sederhana yang konsisten dengan dashboard.
4. Buat halaman faktor emisi read-only dengan pencarian dan badge verifikasi.

## Tahap 5 — State dan Aksesibilitas

1. Tambahkan empty state dan validasi inline.
2. Tambahkan dialog konfirmasi hapus/reset.
3. Pastikan fokus keyboard, label form, tombol, status, dan pembeda selain warna tersedia.
4. Pastikan refresh membersihkan sesi dan tidak ada request mutasi jaringan.
5. Uji layout desktop, tablet, dan mobile.

## Tahap 6 — Verifikasi

1. Jalankan test engine dan test kontrak UI.
2. Jalankan ESLint pada seluruh file yang disentuh.
3. Jalankan suite unit proyek dan laporkan kegagalan eksternal apa adanya.
4. Jalankan build; bila `.next` dikunci server aktif, validasi melalui proses dev yang tersedia tanpa mematikan proses pengguna.
5. Audit diff untuk memastikan tidak ada Prisma/API/halaman lain yang berubah.

## File Diubah

- `src/components/Sidebar.jsx`
- `src/app/page.js`

## File Baru

- `src/components/calculator/EmissionCalculatorPage.jsx`
- `src/components/calculator/CalculatorHome.jsx`
- `src/components/calculator/CalculatorCategoryCard.jsx`
- `src/components/calculator/CalculatorEntryForm.jsx`
- `src/components/calculator/CalculatorEntryList.jsx`
- `src/components/calculator/CalculatorLiveSummary.jsx`
- `src/components/calculator/CalculatorRecap.jsx`
- `src/components/calculator/EmissionFactorsReference.jsx`
- `src/components/calculator/SearchableSelect.jsx`
- `src/lib/calculator/engine.js`
- `src/lib/calculator/format.js`
- `src/lib/calculator/factors.v1.js`
- unit test engine dan kontrak navigasi/UI.

## Syarat Penerimaan

- Semua contoh numerik wajib berada dalam toleransi 0,005.
- Tidak ada NaN, Infinity, angka mentah panjang, atau faktor hilang yang diam-diam dianggap nol.
- Tidak ada write ke database, API mutasi, localStorage, atau perubahan angka dashboard.
- Hanya sidebar dan `page.js` dari fitur lama yang berubah.
