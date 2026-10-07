# Dokumentasi Status Dormant: Pipeline Suhu Inverter iSolarCloud

**Status:** DORMANT (Tidak Aktif / Dibatalkan)  
**Tanggal Keputusan:** 6 Oktober 2026  
**Referensi Desain:** `docs/superpowers/specs/2026-10-06-isolar-inverter-temperature-design.md` (Revisi 1)

---

## 1. Alasan Pembatalan / Status Dormant
Fitur **Suhu Inverter (titik ukur p4 iSolarCloud)** dibatalkan dari jalur aktif UI dan API karena pertimbangan metodologis dan operasional:
1. **Perbedaan Fisik Parameter:** Suhu internal inverter ($p4$) merefleksikan disipasi panas komponen elektronika daya di dalam casing inverter, bukan suhu modul sel fotovoltaik ($T_{\text{cell}}$) dan bukan suhu udara ambien ($T_{\text{amb}}$).
2. **Ketergantungan Dokumen Rating Daya AC:** Kriteria validitas v1 ($p24 \ge 10\%$ *rated power*) memerlukan registry rating daya AC terverifikasi per model/serial inverter. Karena dokumen resmi rating AC belum tersedia di lingkungan produksi, perangkat tanpa rating akan berstatus `MISSING_RATED_POWER`.
3. **Keputusan Metodologi:** Dashboard dikembalikan secara penuh ke **Open-Meteo** (suhu udara 2m model grid koordinat per lokasi) dan estimasi suhu panel modul fotovoltaik berbasis model termal King / Sandia.

---

## 2. Inventaris Kode & Modul yang Tetap Disimpan (Dormant)
Kode pipeline suhu inverter **tidak dihapus** melainkan diisolasi dan dibiarkan dormant (*zero runtime footprint*, tidak diimpor oleh route atau UI aktif mana pun):

| File / Modul | Deskripsi Komponen |
|---|---|
| `src/lib/solar/inverterTemperatureConfig.js` | Registry versi metode, hash konfigurasi, dan pembaca rating daya AC. |
| `src/lib/solar/inverterTemperatureCore.js` | Sanitasi kredensial (URL/bearer/body), zona waktu WIB/UTC, dan slotting 5 menit. |
| `src/lib/solar/inverterTemperatureAggregator.js` | Agregator harian idempoten & bulanan terbobot slot valid dan kWp. |
| `src/lib/solar/inverterTemperatureService.js` | Query service kanonik dengan safeguard korelasi Pearson ($n < 6$). |
| `src/lib/solar/inverterTemperatureExport.js` | Generator ekspor 3-sheet XLSX dan ZIP (3 CSV RFC 4180) dengan sanitasi formula injection. |
| `src/lib/solar/inverterTemperatureSampler.js` | Sampler batch telemetri vendor (maks 50 perangkat/chunk). |
| `src/lib/solar/inverterTemperatureRepository.js` | Abstraksi repository database untuk telemetri suhu inverter. |
| `config/inverter-rated-power.v1.json` | Skema registry rating daya AC inverter. |
| `scripts/validate-inverter-rated-power-csv.mjs` | Skrip CLI validator dry-run CSV rating daya inverter. |
| `scripts/test-inverter-temperature-foundation.mjs` | Test suite integrasi skema dan constraint database test. |

---

## 3. Status Migrasi Database
- Folder migrasi: `prisma/migrations/20261006150000_add_inverter_temperature_pipeline/`
- **STATUS PRODUKSI:** **BELUM DITERAPKAN** ke database produksi/staging.
- **Tindakan yang Diperlukan:** Folder migrasi ini tidak boleh dieksekusi di database produksi. Folder dapat dipindahkan ke direktori `docs/` atau branch terpisah jika diperlukan agar tidak terpicu saat deployment pipeline Prisma.

---

## 4. Syarat dan Prosedur Jika Ingin Mengaktifkan Kembali di Masa Depan
Jika di kemudian hari manajemen memutuskan untuk mengaktifkan kembali pipeline suhu inverter:
1. **Penyediaan CSV Rating Daya AC:** Sediakan file CSV rating daya AC (W) resmi per model inverter, jalankan validasi `node scripts/validate-inverter-rated-power-csv.mjs --csv=<path>`, lalu terapkan dengan `--apply` setelah disetujui.
2. **Backup Penuh Database Produksi:** Lakukan backup tabel master dan relasi sebelum menjalankan migrasi DDL.
3. **Penerapan Migrasi Additive ke Produksi:** Tinjau dan setujui `migration.sql` secara tertulis sebelum diterapkan.
4. **Pengaktifan Route API & UI:** Hubungkan kembali import `getInverterTemperaturePerformance` pada route `/api/plts/pr-analysis` dan perbarui Tab PR di antarmuka web.
5. **Aktivasi Scheduler Bertahap:** Jalankan scheduler pengambilan telemetri hanya pada jam operasional 06:00–19:00 WIB setelah koneksi API vendor dan kuota terverifikasi.
