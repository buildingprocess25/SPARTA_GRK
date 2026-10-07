# Rencana Implementasi Rekonsiliasi Scope 2, PLTS, dan Dashboard Utama

Spec: `docs/superpowers/specs/2026-10-07-scope2-plts-carbon-reconciliation-design.md`

## Batas Global

- Tidak mengubah file sumber CSV/Excel/RKAP, schema/database, allowlist endpoint, faktor emisi, scheduler, atau golden snapshot.
- Tidak menjalankan git add/commit/push.
- Maksimal delapan panggilan vendor, seluruhnya melalui API client yang mencatat kuota.
- Tidak mencetak secret, token, user/password, atau header otorisasi.
- Setiap perubahan fitur memakai test-first.
- Scope perubahan produk: Scope 2, Pengurangan Emisi–PLTS, dashboard utama, endpoint/read-model bersama, ekspor, test, audit, dan dokumentasi.

## Task 1 — Inventaris, provenance, dan feature-lock

**Output**

- `docs/audits/scope2-feature-inventory-2026-10-07.md`
- `scripts/verify-scope2-feature-lock.mjs`
- bukti hash dan jumlah baris dua CSV sumber

**Langkah**

1. Tulis test feature-lock yang gagal untuk seluruh fitur Scope 2 yang wajib dipertahankan.
2. Inventaris alur data dengan referensi file:baris, header CSV, asal Oktober, tarif, dan faktor plant.
3. Bandingkan implementasi lama dan sekarang melalui git log/diff tanpa mengembalikan fitur yang tidak diizinkan.
4. Jalankan feature-lock sebelum perubahan dan simpan hasil apa adanya.
5. Rekam hash, ukuran, dan jumlah baris sumber sebagai baseline integritas.

**Verifikasi**

- Skrip mencetak OK/FAIL per fitur dan gagal bila fitur wajib hilang.
- Tidak ada file sumber berubah.

## Task 2 — Discovery vendor read-only dan audit sumber listrik dibeli

**Output**

- `scripts/audit-scope2-purchased-energy.mjs`
- `docs/evidence/scope2-purchased-energy-discovery-2026-10-07.json`

**Langkah**

1. Cetak kuota sebelum panggilan.
2. Gunakan kembali bukti discovery sebelumnya untuk device type 3/5/11 dan titik 82014, 82022, 83102, 83105, feed-in/export terkait.
3. Lakukan hanya panggilan yang belum dapat dibuktikan, maksimal delapan total.
4. Ambil distribusi `connect_type` 39 plant.
5. Validasi identitas aliran Cileungsi, Pontianak, dan Manado jika titik serta unit terbukti.
6. Sanitasi bukti dan cetak kuota sesudah panggilan.
7. Jika titik ambigu, tetapkan keputusan `load_upper_bound` tanpa menebak.

**Verifikasi**

- Semua panggilan melewati API client/counter.
- Bukti tidak mengandung token atau header otorisasi.
- Jumlah panggilan ≤ 8.

## Task 3 — Mesin rekonsiliasi plant-bulan

**File yang diperkirakan**

- `src/lib/scope2/energyReconciliation.js`
- `src/lib/scope2/sourceAdapters.js`
- `src/lib/scope2/__tests__/energyReconciliation.test.mjs`

**Langkah RED**

Tulis test untuk:

- `purchased + selfConsumed = load`;
- `selfConsumed = production - export`;
- purchased tidak negatif dan self-consumed tidak melebihi beban;
- connect_type 3 boleh memakai ekspor nol dengan flag asumsi;
- baris tanpa self-consumption terbukti memakai `load_upper_bound`;
- nilai kosong tetap null;
- faktor sementara tidak masuk total;
- tidak ada fallback faktor nasional diam-diam.

**Langkah GREEN**

1. Implementasikan kontrak baris kanonis dari spec.
2. Pisahkan observasi sumber dari hasil turunan.
3. Tambahkan provenance dan quality flags deterministik.
4. Hasilkan ringkasan basis purchased vs load dan cakupan faktor.

**Verifikasi**

- Seluruh test mesin rekonsiliasi lulus.
- Tidak ada write database.

## Task 4 — Statistik, periode parsial, filter, dan analitik

**File yang diperkirakan**

- `src/lib/scope2/analytics.js`
- `src/lib/scope2/query.js`
- `src/lib/scope2/__tests__/analytics.test.mjs`

**Langkah RED**

Tulis test untuk:

- Oktober parsial dikeluarkan dari median, P10/P90, YoY, anomali, dan proyeksi;
- median serta interpolasi P10/P90;
- YoY like-for-like;
- deteksi anomali sintetis;
- proyeksi dasar dan musiman;
- filter periode/grid/DC/pencarian toleran;
- query tarif dan basis tervalidasi;
- hasil tanpa `undefined`/`NaN`.

**Langkah GREEN**

Implementasikan fungsi murni statistik, filter, flag kualitas, narasi otomatis, dan proyeksi.

**Verifikasi**

- Fixture sintetis selalu berlabel non-vendor.
- Semua fungsi deterministik dan bebas network/database.

## Task 5 — Read model dan API bersama

**File yang diperkirakan**

- `src/lib/scope2/dashboardService.js`
- `src/app/api/scope2/annual-load/route.js`
- test service/API terkait

**Langkah RED**

Tulis test bahwa satu query menghasilkan angka identik untuk Scope 2, PLTS, dashboard utama, dan ekspor.

**Langkah GREEN**

1. Gabungkan CSV beban, produksi bulanan, ekspor, metadata plant, serta faktor.
2. Tandai periode lengkap/parsial berdasarkan provenance laporan.
3. Hasilkan view model kanonis: KPI, waterfall, tren, YoY, ranking, grid, detail DC, kualitas, narasi, dan simulasi prerequisites.
4. Endpoint tetap read-only dan tidak membocorkan path absolut atau secret.

**Verifikasi**

- Endpoint mengembalikan error jujur bila DB/sumber wajib tidak tersedia.
- Tidak ada angka dummy/default.

## Task 6 — Penyempurnaan UI Scope 2

**File yang diperkirakan**

- `src/components/Scope2AnnualLoadDashboard.jsx`
- komponen kecil baru di `src/components/scope2/`
- test kontrak/render terkait

**Langkah RED**

Tambahkan test struktur untuk fitur lama dan baru, state query, badge kualitas, nilai kosong, serta label asumsi.

**Langkah GREEN**

1. Pertahankan empat KPI, panel sumber, grafik lama melalui toggle, dan tabel bulanan.
2. Tambahkan filter bersama.
3. Tambahkan waterfall dan KPI baris kedua.
4. Tambahkan grafik stacked, YoY, ranking/anomali, grid breakdown, drawer DC, simulator, kualitas, dan narasi.
5. Gunakan formatter tunggal.
6. Batasi chart 360px dan tabel 560px dengan sticky header/kolom/tfoot.

**Verifikasi**

- Responsif 375/768/1440 tanpa horizontal scroll halaman.
- Nilai parsial dan batas atas terlihat jelas.

## Task 7 — Integrasi tab Pengurangan Emisi–PLTS

**File yang diperkirakan**

- `src/components/PLTSTab.jsx` atau adaptor baru yang lebih kecil
- `src/hooks/usePltsData.js` bila diperlukan untuk konsumsi read model
- test rekonsiliasi lintas-tab

**Langkah RED**

Tulis test bahwa avoided PLTS berasal dari self-consumption, ekspor tidak dianggap mengurangi listrik dibeli, dan angka plant-bulan sama dengan Scope 2.

**Langkah GREEN**

1. Tambahkan panel kontribusi Scope 2 pada tab PLTS.
2. Tampilkan produksi, self-consumption, ekspor, avoided, faktor, basis, dan kualitas.
3. Hubungkan navigasi/detail plant ke drawer bersama.
4. Target 2027 hanya tampil bila sumbernya terbukti.

**Verifikasi**

- Tidak mengubah perhitungan produksi/PR PLTS yang sudah ada.
- Golden snapshot PLTS tetap identik.

## Task 8 — Integrasi dashboard utama tanpa double counting

**File yang diperkirakan**

- `src/components/EmisiResumeTab.jsx`
- `src/context/SustainabilityContext.jsx` hanya bila adaptor context tetap dibutuhkan
- test rekonsiliasi dashboard utama

**Langkah RED**

Tulis test untuk bridge:

`loadBasisEmission - selfConsumedAvoided = purchasedEmission`

serta test bahwa purchased emission tidak dikurangi PLTS untuk kedua kalinya.

**Langkah GREEN**

1. Ganti angka hardcode/localStorage pada ringkasan terkait dengan read model kanonis.
2. Tampilkan inventaris Scope 1 + Scope 2 dan bridge kontribusi PLTS.
3. Tampilkan water recycle terpisah dari inventaris resmi.
4. Pertahankan indikator net-impact hanya dengan label non-inventory.
5. Pertahankan filter saat navigasi antarhalaman.

**Verifikasi**

- Seluruh angka Scope 2/PLTS sama pada tiga halaman.
- Tidak ada pengurangan ganda.

## Task 9 — Simulator dan ekspor

**File yang diperkirakan**

- `src/lib/scope2/simulator.js`
- `src/lib/scope2/export.js`
- endpoint ekspor Scope 2
- test simulator/ekspor

**Langkah RED**

Tulis test specific yield, missing prerequisite, no-write, formula escaping, sheet/CSV contract, dan kesamaan angka dengan dashboard.

**Langkah GREEN**

1. Simulator memakai 12 bulan lengkap atau menampilkan input yang kurang.
2. Ekspor XLSX multi-sheet sesuai spec.
3. Pertahankan CSV, dengan filter dan parameter identik.
4. Escape karakter formula pada sel teks.

**Verifikasi**

- Simulator tidak memanggil mutation API atau storage.
- Ekspor dan dashboard berasal dari fungsi query yang sama.

## Task 10 — Verifikasi akhir dan scorecard

**Langkah**

1. Jalankan test baru per task lalu seluruh suite.
2. Jalankan lint terarah dan global.
3. Jalankan production build; bedakan kegagalan fitur dari kegagalan lama yang terbukti.
4. Jalankan feature-lock sesudah perubahan.
5. Verifikasi UI pada 375/768/1440 dan ukur tinggi section.
6. Bandingkan hash/jumlah baris file sumber sebelum/sesudah.
7. Pindai `undefined`, `NaN`, dummy/default, dan kebocoran secret.
8. Lakukan review keseluruhan perubahan satu kali; perbaiki temuan Critical/Important dengan RED→GREEN.
9. Tulis laporan A/B, scorecard F1–F7, call/quota, file berubah, fitur lama hilang, keterbatasan, dan hal belum terbukti.

**Kriteria selesai**

- Feature-lock seluruh fitur wajib OK.
- Semua test fitur baru lulus.
- Tidak ada perubahan sumber/database/schema/scheduler/golden snapshot.
- Tidak ada hitung ganda antara Scope 2 purchased dan avoided PLTS.
- Laporan akhir menyebut kegagalan global apa adanya dan tidak menggunakan klaim “selesai” sebelum scorecard ditempel.

