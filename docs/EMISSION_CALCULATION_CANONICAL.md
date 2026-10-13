# Dokumentasi Resmi: Standarisasi Perhitungan Emisi Terhindar PLTS (tCO₂e)

## 1. Rumus Tunggal Kanonik (Single Source of Truth)

Seluruh indikator emisi terhindar di dashboard (halaman PLTS, Resume Emisi GRK, dan `/api/sustainability`) memakai satu rumus dan satu faktor:

$$\text{Emisi Terhindar (tCO}_2\text{e)} = \sum_{\text{plant eligible}} \frac{\text{Energi Pakai Sendiri (kWh)} \times 0,997\text{ kgCO}_2\text{/kWh}}{1.000}$$

### Komponen Perhitungan:
1. **Energi Pakai Sendiri (Self-Consumption)**:
   $$\text{Energi Pakai Sendiri} = \max(0, \text{Produksi PLTS} - \text{Ekspor/Feed-in})$$
   - Energi yang diekspor (feed-in ke PLN) tidak dihitung dalam emisi terhindar beban gedung sendiri.
   - Basis energi ini sama dengan kartu "Penghematan Energi".
2. **Faktor Emisi PLTS: 0,997 kgCO₂/kWh**:
   - Satu faktor untuk semua grid, didefinisikan di `src/lib/solar/conversionConfig.js` (`PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH`).
   - `cmPlts` pada `src/lib/emission-factors.js` merujuk ke konstanta yang sama, jadi tidak ada lagi faktor PLTS per wilayah.
   - Hasil dibagi $1.000$ untuk konversi dari kg ke ton ($\text{tCO}_2\text{e}$).

---

## 2. Kelayakan Plant

Faktor emisi PLTS sama di semua grid, jadi status grid tidak menentukan kelayakan. Satu-satunya pengecualian adalah plant yang masih dalam konstruksi (`isPlantUnderConstruction()` di `src/lib/solar/dashboard.js`), yaitu DC Gorontalo.

DC Manado (grid Sulutgo) ikut dihitung. Status grid Sulutgo yang masih sementara hanya berpengaruh ke Scope 2, karena Scope 2 memakai faktor grid per wilayah.

Aturan ini dipakai bersama oleh halaman PLTS, Resume Emisi GRK, `/api/emissions` (kartu KPI dan ekspor laporan), dan `/api/sustainability`.

---

## 3. Rekonsiliasi Angka YTD (Januari s.d. September 2026)

Angka di bagian 3 sampai 5 diambil dari `getCanonicalEnergyRows()` di `src/lib/energy-data.js` pada 13 Oktober 2026, dari tabel `energy_flow_monthly`. Isi tabel itu sudah dicocokkan per plant per bulan dengan CSV laporan iSolarCloud dan tidak ada selisih. Fungsi yang sama dipakai oleh `tests/reconciliation-identities.test.mjs`.

| Metrik | Nilai Aktual | Keterangan |
| :--- | :---: | :--- |
| **Total Produksi 37 DC** | `4.727,35 MWh` | Seluruh DC dengan PLTS |
| **Total Ekspor (Feed-in) 37 DC** | `92,18 MWh` | Terkirim ke jaringan PLN |
| **Total Pakai Sendiri 37 DC** | `4.635,16 MWh` | Produksi dikurangi ekspor |
| **Produksi 36 DC Eligible** | `4.722,81 MWh` | Tanpa Gorontalo (konstruksi, 4,53 MWh) |
| **Pakai Sendiri 36 DC Eligible** | `4.630,63 MWh` | Basis kanonik kartu Emisi Terhindar |
| **Emisi Terhindar Kanonik (36 DC)** | **`4.616,74 tCO₂e`** | Pakai sendiri × 0,997, **angka tunggal sah dashboard** |
| *Emisi Basis Produksi (Metode Lama)* | `4.708,64 tCO₂e` | Produksi eligible × 0,997, hanya sebagai catatan (tidak ditampilkan di UI) |

> Halaman PLTS yang dibuka tanpa filter menampilkan YTD termasuk bulan berjalan yang datanya masih parsial dari telemetri live. Untuk mencocokkan dengan tabel ini, pilih periode Januari s.d. September.

---

## 4. Rincian Bulanan Januari s.d. September 2026

| Bulan | Produksi 36 DC (MWh) | Pakai Sendiri 36 DC (MWh) | Emisi Terhindar ($\text{tCO}_2\text{e}$) | Kumulatif YTD ($\text{tCO}_2\text{e}$) |
| :---: | :---: | :---: | :---: | :---: |
| **Jan 2026** | 464,66 | 458,16 | **456,78** | 456,78 |
| **Feb 2026** | 441,51 | 435,53 | **434,23** | 891,01 |
| **Mar 2026** | 561,11 | 548,25 | **546,60** | 1.437,61 |
| **Apr 2026** | 564,48 | 555,65 | **553,98** | 1.991,59 |
| **Mei 2026** | 512,60 | 503,02 | **501,51** | 2.493,11 |
| **Jun 2026** | 517,66 | 510,51 | **508,98** | 3.002,08 |
| **Jul 2026** | 530,88 | 522,07 | **520,50** | 3.522,58 |
| **Agu 2026** | 555,37 | 541,30 | **539,67** | 4.062,25 |
| **Sep 2026** | 574,54 | 556,16 | **554,49** | **4.616,74** |
| **TOTAL YTD**| **4.722,81** | **4.630,63** | **4.616,74** | **4.616,74** |

> **Pembulatan**: total YTD dan kumulatif dihitung dari nilai presisi penuh, lalu dibulatkan. Jumlah sembilan angka bulanan yang sudah dibulatkan bisa berbeda paling banyak 0,01 tCO₂e dari total tersebut.

---

## 5. Konversi Turunan (Pohon & Batubara)

Seluruh konversi turunan diberi label **"estimasi"** dengan metodologi yang transparan:

1. **Setara Penyerapan Pohon**:
   $$\text{Jumlah Pohon} = \frac{\text{Emisi Terhindar (tCO}_2\text{e)} \times 1.000}{21,77\text{ kgCO}_2\text{e/pohon/tahun}} = \frac{4.616,74 \times 1.000}{21,77} \approx \mathbf{212.069\text{ Pohon}}$$
   - Faktor: $21,77\text{ kgCO}_2\text{e/pohon/tahun}$ (rata-rata pohon dewasa tropis).
2. **Batubara Terhindar**:
   $$\text{Batubara Terhindar (Ton)} = \text{Pakai Sendiri (MWh)} \times 0,400\text{ ton/MWh} = 4.630,63 \times 0,400 \approx \mathbf{1.852,3\text{ Ton Batubara}}$$
   - Faktor: $0,400\text{ ton/MWh}$ ($0,40\text{ kg batubara/kWh}$ Specific Fuel Consumption PLTU rata-rata).
   - Faktor RKAP lama ($54\text{ pohon/MWh}$ dan $0,404\text{ t/MWh}$) dihapus penuh dari perhitungan hasil aktual.

---

## 6. Penjelasan Metrik PR (73,5% vs 78,5%)

- **Nilai Kanonik: 73,5%**: Merupakan PR agregat terbobot kapasitas dan iradiasi sesuai standar **IEC 61724**, dengan filter validasi telemetry ($50\% \le \text{PR} \le 100\%$) untuk menyaring anomali sensor (201 plant-bulan valid dari total 351).
- **Nilai 78,5%**: Terjadi jika telemetry anomali yang rusak/korup (seperti DC Manado PR $>1000\%$ dan DC Parung $>500\%$) dimasukkan tanpa validasi hygiene data.
