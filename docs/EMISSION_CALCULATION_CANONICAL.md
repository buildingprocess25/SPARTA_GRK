# Dokumentasi Resmi: Standarisasi Perhitungan Emisi Terhindar PLTS (tCO₂e)

## 1. Rumus Tunggal Kanonik (Single Source of Truth)

Sesuai keputusan manajemen dan prinsip integritas data emisi, seluruh indikator emisi di PLTS Dashboard dihitung menggunakan **satu rumus kanonik tunggal**:

$$\text{Emisi Terhindar (tCO}_2\text{e)} = \sum_{\text{plant eligible}} \frac{\text{Energi Pakai Sendiri (kWh)} \times \text{Faktor Grid ESDM (kgCO}_2\text{e/kWh)}}{1.000}$$

### Komponen Perhitungan:
1. **Energi Pakai Sendiri (Self-Consumption)**:
   $$\text{Energi Pakai Sendiri} = \max(0, \text{Produksi PLTS} - \text{Ekspor/Feed-in})$$
   - Energi yang diekspor (feed-in ke PLN) tidak dihitung dalam emisi terhindar beban gedung sendiri.
   - Basis energi ini identik 100% dengan kartu "Penghematan Energi".
2. **Faktor Grid Regional ESDM**:
   - Menggunakan faktor emisi grid resmi ESDM per wilayah kelistrikan plant beroperasi.
   - Dibagi $1.000$ untuk konversi langsung dari kg ke Ton ($\text{tCO}_2\text{e}$).

---

## 2. Tabel Faktor Emisi Grid Regional ESDM

| Sistem Grid | Faktor ESDM ($\text{kgCO}_2\text{e/kWh}$) | Status Validasi | Jumlah Plant | Plant Terkait |
| :--- | :---: | :---: | :---: | :--- |
| **JAMALI** | `0,83` | RESMI | 24 | DC Balaraja, Cikokol, Parung, Bogor, Bekasi, Karawang, Plumbon, Bandung, Cilacap 1/2/3, Semarang, Klaten, Madiun, Malang, Sidoarjo, Jember, Bali, dll. |
| **SUMATERA** | `0,75` | RESMI | 6 | DC Medan, Pekanbaru, Jambi, Palembang, Lampung, Kotabumi |
| **KALBAR** | `0,84` | RESMI | 1 | DC Pontianak |
| **KALSELTENG** | `0,84` | RESMI | 1 | DC Banjarmasin |
| **SULSELRABAR** | `0,44` | RESMI | 3 | DC Makassar, Maros, Luwu |
| **BATAM** | `0,75` | RESMI | 1 | DC Batam |
| **NTB (Lombok)** | `0,74` | RESMI | 2 | DC Lombok A, DC Lombok B |
| **SULUTGO** | `0,60` (sementara) | **DIKECUALIKAN** | 2 | DC Gorontalo, DC Manado |

> [!IMPORTANT]
> **Pengecualian Sulutgo (37 dari 39 Plant)**:
> Sebanyak 2 plant di jaringan Sulutgo (Gorontalo & Manado) menggunakan faktor sementara 0,60 kg/kWh (belum ada surat keputusan resmi ESDM spesifik). Oleh karena itu, kedua plant ini **dikecualikan dari total emisi resmi** dashboard dan diberi label *"37 dari 39 plant dihitung (faktor grid resmi ESDM)"*.

---

## 3. Rekonsiliasi Angka YTD (Januari – September 2026)

| Metrik | Nilai Aktual | Keterangan |
| :--- | :---: | :--- |
| **Total Produksi 39 Plant** | `4.804,34 MWh` | Seluruh plant fisik operasional |
| **Total Ekspor (Feed-in) 39 Plant** | `92,19 MWh` | Terkirim ke jaringan PLN |
| **Total Pakai Sendiri 39 Plant** | `4.712,15 MWh` | $4.804,34 - 92,19\text{ MWh}$ |
| **Produksi 37 Plant Eligible** | `4.616,00 MWh` | Exclude Gorontalo (115,86 MWh) & Manado (72,49 MWh) |
| **Pakai Sendiri 37 Plant Eligible** | `4.524,60 MWh` | Basis kanonik kartu Emisi Terhindar |
| **Emisi Terhindar Kanonik (37 Plant)** | **`3.655,85 tCO₂e`** | **Angka Tunggal Sah Dashboard** |
| *Emisi Basis Produksi (Metode Lama)* | `3.730,30 tCO₂e` | Catatan perubahan metode (tidak ditampilkan di UI) |
| *Target RKAP (Referensi Korporat)* | `4.791,34 tCO₂e` | Dihitung dari faktor target RKAP $0,997294\text{ t/MWh}$ |

---

## 4. Rincian Bulanan Jan – Sep 2026 (Buktian 100% Cocok)

| Bulan | Produksi 37 Plant (MWh) | Pakai Sendiri 37 Plant (MWh) | Emisi Terhindar ($\text{tCO}_2\text{e}$) | Kumulatif YTD ($\text{tCO}_2\text{e}$) | PR Terbobot IEC |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Jan 2026** | 461,26 | 454,76 | **359,20** | 359,20 | 76,9% |
| **Feb 2026** | 439,78 | 433,65 | **343,97** | 703,17 | 75,5% |
| **Mar 2026** | 556,15 | 542,91 | **435,91** | 1.139,08 | 73,9% |
| **Apr 2026** | 559,25 | 550,29 | **441,26** | 1.580,34 | 72,8% |
| **Mei 2026** | 506,00 | 496,30 | **397,29** | 1.977,63 | 75,6% |
| **Jun 2026** | 510,72 | 503,56 | **403,37** | 2.381,00 | 73,3% |
| **Jul 2026** | 522,76 | 513,92 | **412,94** | 2.793,94 | 70,9% |
| **Agu 2026** | 537,13 | 523,24 | **425,07** | 3.219,01 | 73,6% |
| **Sep 2026** | 522,95 | 505,97 | **436,84** | **3.655,85** | 70,8% |
| **TOTAL YTD**| **4.616,00** | **4.524,60** | **3.655,85** | **3.655,85** | **73,5%** |

> **Selisih Penjumlahan Bulanan vs Summary**: $0,0000\text{ tCO}_2\text{e}$ (Tepat & Akurat 100%).

---

## 5. Konversi Turunan (Pohon & Batubara)

Seluruh konversi turunan diberi label **"estimasi"** dengan metodologi yang transparan:

1. **Setara Penyerapan Pohon**:
   $$\text{Jumlah Pohon} = \frac{\text{Emisi Terhindar (tCO}_2\text{e)} \times 1.000}{21,77\text{ kgCO}_2\text{e/pohon/tahun}} = \frac{3.655,85 \times 1.000}{21,77} \approx \mathbf{167.931\text{ Pohon}}$$
   - Faktor: $21,77\text{ kgCO}_2\text{e/pohon/tahun}$ (rata-rata pohon dewasa tropis).
2. **Batubara Terhindar**:
   $$\text{Batubara Terhindar (Ton)} = \text{Pakai Sendiri (MWh)} \times 0,400\text{ ton/MWh} = 4.524,60 \times 0,400 \approx \mathbf{1.809,8\text{ Ton Batubara}}$$
   - Faktor: $0,400\text{ ton/MWh}$ ($0,40\text{ kg batubara/kWh}$ Specific Fuel Consumption PLTU rata-rata).
   - Faktor RKAP lama ($54\text{ pohon/MWh}$ dan $0,404\text{ t/MWh}$) dihapus penuh dari perhitungan hasil aktual.

---

## 6. Penjelasan Metrik PR (73,5% vs 78,5%)

- **Nilai Kanonik: 73,5%**: Merupakan PR agregat terbobot kapasitas dan iradiasi sesuai standar **IEC 61724**, dengan filter validasi telemetry ($50\% \le \text{PR} \le 100\%$) untuk menyaring anomali sensor (201 plant-bulan valid dari total 351).
- **Nilai 78,5%**: Terjadi jika telemetry anomali yang rusak/korup (seperti DC Manado PR $>1000\%$ dan DC Parung $>500\%$) dimasukkan tanpa validasi hygiene data.
