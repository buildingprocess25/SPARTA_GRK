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

## 2. Kelayakan Plant per Grid

Faktor emisinya sama di semua grid. Status grid hanya menentukan apakah plant ikut dihitung.

| Sistem Grid | Status Grid | Jumlah Plant | Plant Terkait |
| :--- | :---: | :---: | :--- |
| **JAMALI** | RESMI | 24 | DC Balaraja, Cikokol, Parung, Bogor, Bekasi, Karawang, Plumbon, Bandung, Cilacap 1/2/3, Semarang, Klaten, Madiun, Malang, Sidoarjo, Jember, Bali, dll. |
| **SUMATERA** | RESMI | 6 | DC Medan, Pekanbaru, Jambi, Palembang, Lampung, Kotabumi |
| **KALBAR** | RESMI | 1 | DC Pontianak |
| **KALSELTENG** | RESMI | 1 | DC Banjarmasin |
| **SULSELRABAR** | RESMI | 3 | DC Makassar, Maros, Luwu |
| **BATAM** | RESMI | 1 | DC Batam |
| **NTB (Lombok)** | RESMI | 2 | DC Lombok A, DC Lombok B |
| **SULUTGO** | SEMENTARA, **DIKECUALIKAN** | 2 | DC Gorontalo, DC Manado |

> [!IMPORTANT]
> **Pengecualian Sulutgo**:
> Grid Sulutgo (Gorontalo & Manado) masih berstatus sementara karena belum ada surat keputusan ESDM yang spesifik. Kedua DC ini **dikecualikan dari total emisi resmi**. Pada data Januari s.d. September 2026, yang dihitung adalah 35 dari 37 DC.

---

## 3. Rekonsiliasi Angka YTD (Januari s.d. September 2026)

Angka di bagian 3 dan 4 diambil dari `getCanonicalEnergyRows()` di `src/lib/energy-data.js` pada 13 Oktober 2026. Fungsi yang sama dipakai oleh `tests/reconciliation-identities.test.mjs`.

| Metrik | Nilai Aktual | Keterangan |
| :--- | :---: | :--- |
| **Total Produksi 37 DC** | `4.727,35 MWh` | Seluruh DC dengan PLTS operasional |
| **Total Ekspor (Feed-in) 37 DC** | `92,18 MWh` | Terkirim ke jaringan PLN |
| **Total Pakai Sendiri 37 DC** | `4.635,16 MWh` | Produksi dikurangi ekspor |
| **Produksi 35 DC Eligible** | `4.538,99 MWh` | Tanpa Gorontalo & Manado (grid Sulutgo sementara) |
| **Pakai Sendiri 35 DC Eligible** | `4.447,61 MWh` | Basis kanonik kartu Emisi Terhindar |
| **Emisi Terhindar Kanonik (35 DC)** | **`4.434,27 tCO₂e`** | Pakai sendiri × 0,997, **angka tunggal sah dashboard** |
| *Emisi Basis Produksi (Metode Lama)* | `4.525,38 tCO₂e` | Produksi eligible × 0,997, hanya sebagai catatan (tidak ditampilkan di UI) |
| *Target RKAP (Referensi Korporat)* | `4.791,34 tCO₂e` | Dihitung dari faktor target RKAP $0,997294\text{ t/MWh}$ |

---

## 4. Rincian Bulanan Januari s.d. September 2026

| Bulan | Produksi 35 DC (MWh) | Pakai Sendiri 35 DC (MWh) | Emisi Terhindar ($\text{tCO}_2\text{e}$) | Kumulatif YTD ($\text{tCO}_2\text{e}$) |
| :---: | :---: | :---: | :---: | :---: |
| **Jan 2026** | 444,47 | 438,09 | **436,78** | 436,78 |
| **Feb 2026** | 425,06 | 419,16 | **417,90** | 854,68 |
| **Mar 2026** | 542,39 | 529,61 | **528,02** | 1.382,70 |
| **Apr 2026** | 544,70 | 535,95 | **534,34** | 1.917,04 |
| **Mei 2026** | 494,18 | 484,68 | **483,23** | 2.400,27 |
| **Jun 2026** | 497,16 | 490,09 | **488,62** | 2.888,89 |
| **Jul 2026** | 509,31 | 500,58 | **499,07** | 3.387,97 |
| **Agu 2026** | 531,20 | 517,21 | **515,66** | 3.903,63 |
| **Sep 2026** | 550,54 | 532,24 | **530,64** | **4.434,27** |
| **TOTAL YTD**| **4.538,99** | **4.447,61** | **4.434,27** | **4.434,27** |

> **Pembulatan**: total YTD dan kumulatif dihitung dari nilai presisi penuh, lalu dibulatkan. Jumlah sembilan angka bulanan yang sudah dibulatkan bisa berbeda paling banyak 0,01 tCO₂e dari total tersebut.

---

## 5. Konversi Turunan (Pohon & Batubara)

Seluruh konversi turunan diberi label **"estimasi"** dengan metodologi yang transparan:

1. **Setara Penyerapan Pohon**:
   $$\text{Jumlah Pohon} = \frac{\text{Emisi Terhindar (tCO}_2\text{e)} \times 1.000}{21,77\text{ kgCO}_2\text{e/pohon/tahun}} = \frac{4.434,27 \times 1.000}{21,77} \approx \mathbf{203.687\text{ Pohon}}$$
   - Faktor: $21,77\text{ kgCO}_2\text{e/pohon/tahun}$ (rata-rata pohon dewasa tropis).
2. **Batubara Terhindar**:
   $$\text{Batubara Terhindar (Ton)} = \text{Pakai Sendiri (MWh)} \times 0,400\text{ ton/MWh} = 4.447,61 \times 0,400 \approx \mathbf{1.779,0\text{ Ton Batubara}}$$
   - Faktor: $0,400\text{ ton/MWh}$ ($0,40\text{ kg batubara/kWh}$ Specific Fuel Consumption PLTU rata-rata).
   - Faktor RKAP lama ($54\text{ pohon/MWh}$ dan $0,404\text{ t/MWh}$) dihapus penuh dari perhitungan hasil aktual.

---

## 6. Penjelasan Metrik PR (73,5% vs 78,5%)

- **Nilai Kanonik: 73,5%**: Merupakan PR agregat terbobot kapasitas dan iradiasi sesuai standar **IEC 61724**, dengan filter validasi telemetry ($50\% \le \text{PR} \le 100\%$) untuk menyaring anomali sensor (201 plant-bulan valid dari total 351).
- **Nilai 78,5%**: Terjadi jika telemetry anomali yang rusak/korup (seperti DC Manado PR $>1000\%$ dan DC Parung $>500\%$) dimasukkan tanpa validasi hygiene data.
