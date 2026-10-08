# Perbandingan CSV Mentor vs Dashboard PLTS dan Scope 2

Tanggal audit: 8 Oktober 2026 (Asia/Jakarta)  
Versi kode: `4c2f7f92c5354454f09466115e4334467761ca48` (`4c2f7f9 feat: enhance emission calculator and energy reconciliation`)  
Periode utama: Januari–September 2026; Oktober dipisahkan sebagai parsial.

## 1. Ringkasan eksekutif

1. Dari 1.665 pasangan angka DC-bulan-metrik, 1.573 (94,5%) sama persis, 78 (4,7%) beda kecil ≤0,5%, dan 14 (0,8%) beda signifikan; 99,2% lolos toleransi 0,5%.
2. Total dashboard 37 DC adalah 4.727,345 MWh produksi, 4.635,164 MWh pakai sendiri, 92,181 MWh ekspor, 12.532,258 MWh beli PLN, dan 17.167,422 MWh beban.
3. Lima selisih DC-bulan absolut terbesar semuanya pada PLN dibeli: Jambi Sep +0,952 MWh, Parung Sep +0,745 MWh, Jambi Jul +0,562 MWh, Jambi Jun +0,456 MWh, dan Jambi Mei +0,450 MWh (dashboard minus CSV).
4. Untuk produksi, ekspor, pakai sendiri, dan beban, dashboard lebih dekat ke ekspor vendor mentah; dua beda produksi berasal dari Parung Feb (+0,128 MWh) dan Jul (+0,202 MWh) yang tertinggal di CSV mentor.
5. Kolom CSV `Total Produksi` dan Resume tidak valid sebagai produksi: `Monthly yield` sudah produksi bruto, tetapi feed-in ditambahkan lagi. Akibatnya Resume melebihkan produksi 39 plant tepat sebesar ekspor, 92,188 MWh.
6. Kapasitas dashboard 5.778,80 kWp/37 plant cocok dengan laporan vendor; CSV mentor 5.828,03 kWp karena Parung ditulis 244,23 kWp, bukan 195,00 kWp.
7. PLN dibeli tidak dapat diputuskan sepenuhnya dari sumber primer: CSV menyimpan field portal, dashboard menurunkannya sebagai `beban − pakai sendiri`; keduanya berbeda pada beberapa baris, tetapi dashboard konsisten secara matematis.
8. Emisi Scope 2 dashboard Jan–Sep 9.622,237 tCO2e belum lengkap: faktor `KALSELTENG` tidak terbaca, sehingga 522,432 MWh pembelian Banjarmasin tidak dihitung; dengan faktor 1,20 hasil indikatif menjadi 10.249,155 tCO2e.
9. PR hasil rekonstruksi algoritme dashboard adalah 73,50%, tetapi hanya memakai 183 dari 333 plant-month; 36 tanpa radiasi dan 114 dibuang karena PR mentah di luar 50–100%. Nilai live tidak dapat dikonfirmasi karena database tidak terjangkau.
10. Kesimpulan umum: dashboard lebih valid untuk neraca energi dan cakupan 37 DC; CSV mentor berguna sebagai jejak field portal, tetapi kolom turunannya perlu diperbaiki. Emisi Scope 2 dashboard belum valid sebagai total nasional sampai faktor Banjarmasin diperbaiki.

## 2. Sumber, struktur, kamus kolom, dan pemetaan DC

### 2.1 Sumber yang benar-benar dipakai

- CSV mentor: 14 file `Monitor PLTS 2026 (3)-*.csv`, seluruhnya valid dibaca sebagai UTF-8 tanpa BOM, delimiter koma, desimal titik. Waktu modifikasi seluruh file: 8 Oktober 2026 13:24:56 WIB.
- Sumber mentah dashboard PLTS: `Monthly Report_Annual report_20261001111530.csv`, ekspor portal iSolar tanggal 1 Oktober 2026 11:15:32.
- Sumber mentah beban dashboard: `monthly load consump_Annual report_20261002100201.csv`, ekspor portal iSolar tanggal 2 Oktober 2026 10:02:07.
- Scope 2 direkonstruksi dengan lapisan yang benar-benar dipakai halaman, yaitu [`dashboardService.js`](../src/lib/scope2/dashboardService.js) dan [`energyReconciliation.js`](../src/lib/scope2/energyReconciliation.js).
- Halaman PLTS memakai layanan berbasis database. Koneksi read-only gagal dengan `Can't reach database server at db.prisma.io:5432`; karena itu angka live PLTS tidak diklaim berhasil dibaca. Nilai energi PLTS di laporan ini direkonstruksi dari dua ekspor vendor dan rumus sumber kode yang sama. Keyakinan tinggi untuk energi, sedang untuk PR/KPI yang membutuhkan isi database.

### 2.2 Struktur 14 CSV mentor

| File | Baris/nonkosong | Kolom maks. | Header/struktur | Satuan dan catatan |
|---|---:|---:|---|---|
| JAN | 42/42 | 5 | Baris 1; 39 plant + 2 agregat | MWh; belum ada `Total Produksi` |
| FEB, MAR, APR, AGU, SEP | masing-masing 42/42 | 6 | Baris 1; 39 plant + agregat Lombok/Cilacap | MWh; kolom turunan `Total Produksi` |
| MEI, JUN, JUL | masing-masing 42/42 | 9 | Baris 1; tiga kolom kosong sebelum `Kapasitas` | MWh dan kWp |
| COMPARASI FEB | 47/46 | 9 | Header bertingkat baris 1–2; tabel 2025 dan 2026 berdampingan | Wh/m² dan MWh; satu kolom spacer |
| 2025 vs 2026 | 145/145 | 6 | Header baris 1; blok empat baris per cabang | MWh; load, yield, feed-in, purchase |
| Radiasi | 15/15 | 3 | Header bertingkat baris 1–2 | Wh/m²; 2026 hanya Jan–Mar |
| Rekap Corporate Reputation | 218/197 | 28 | Header baris 3; blok empat baris per cabang | MWh; banyak kolom kosong/catatan |
| Resume | 31/23 | 40 | Beberapa blok header: produksi, CO2, coal, tree | MWh, tCO2e, ton, pohon, persen |

Tidak ditemukan `#REF!`, `#DIV/0!`, `#VALUE!`, `N/A`, atau sel yang diawali `=`. Karena formatnya CSV, rumus spreadsheet sudah menjadi nilai. Terdapat sel kosong, tanda `-`, header bertingkat, dan label tanggal yang berpotensi dikonversi otomatis oleh aplikasi spreadsheet. Rincian hash, ukuran, jumlah baris/kolom, dan header asli tersimpan di [`evidence.json`](compare-tmp/evidence.json).

### 2.3 Kamus kolom

| Kolom CSV | Arti setelah diuji | Padanan dashboard | Putusan semantik |
|---|---|---|---|
| `Monthly yield(MWh)` | Produksi bruto inverter | `productionKwh / 1000` | Valid sebagai produksi, bukan self-consumption |
| `Monthly feed-in(MWh)` | Energi ekspor | `exportKwh / 1000` | Valid |
| Turunan `yield − feed-in` | Pakai sendiri | `selfConsumedKwh / 1000` | Definisi kanonik |
| `Monthly load consumption(MWh)` | Beban fasilitas | `loadKwh / 1000` | Valid; dashboard mengambil ekspor beban tahunan |
| `Energy purchased this month(MWh)` | Field PLN dibeli dari laporan portal | Dashboard: `load − selfConsumed` | Beririsan tetapi bukan sumber/rumus yang sama |
| `Total Produksi` | `yield + feed-in` | Tidak ada padanan yang sah | Tidak valid; feed-in dihitung dua kali |
| `Kapasitas` | Daya terpasang | `installedKwp` | Valid kecuali Parung |
| `Plant monthly irradiation` | Iradiasi bulanan | `radiationKwhM2 = Wh/m² / 1000` | Valid setelah konversi satuan |
| `PR(%)` pada ekspor vendor | PR resmi portal | `calculateWeightedPr()` | Definisi/agregasi berbeda |
| Resume `Target` | RKAP bulanan/tahunan | `productionTarget`, fallback 5.858 MWh | Sama |
| Resume CO2/coal/tree | KPI berbasis produksi mentor | KPI dashboard berbasis pakai sendiri/faktor regional | Tidak apple-to-apple |

### 2.4 Pemetaan plant/DC

Nama 39 plant fisik pada CSV bulanan cocok satu-ke-satu dengan registry setelah awalan `Alfamart DC`/salah eja `Dhrive` dinormalisasi. Tabel ringkas berikut menunjukkan kasus yang memerlukan aturan khusus; 34 nama lainnya identik setelah normalisasi.

| Nama CSV/vendor | Nama dashboard | Status |
|---|---|---|
| Gorontalo, Luwu, Cileungsi, Tegal, Sidoarjo | Sama | 1:1 |
| Plumbon, Jember, Madiun, Serang, Bandung 2 | Sama | 1:1 |
| Cilacap 1, Cilacap 2, Cilacap 3 | Sama | Tiga plant fisik, masing-masing satu DC entity |
| Cianjur, Semarang, Klaten, Kotabumi, Makassar, Manado | Sama | 1:1 |
| Pekanbaru, Batam, Jambi, Pontianak | Sama | 1:1 |
| Lombok A, Lombok B | Sama | Dua plant fisik |
| Lampung, Bogor, Parung, Malang, Bandung 1, Bali | Sama | 1:1 |
| Rembang, Balaraja, Medan, Palembang, Banjarmasin, Karawang | Sama | 1:1 |
| `Tk. Drive Thru De Mansion` | Ada di registry, bukan lokasi DC | Sengaja tidak tampil pada cakupan 37 DC |
| `Tk. Drive Thru GS` | Ada di registry, bukan lokasi DC | Sengaja tidak tampil pada cakupan 37 DC |
| `Lombok` (baris 41) | Tidak ada sebagai plant terpisah | Baris agregat A+B; jangan dijumlah ulang |
| `Cilacap` (baris 42) | Tidak ada sebagai plant terpisah | Baris agregat 1+2+3; jangan dijumlah ulang |

Setiap bulan CSV memiliki 39 plant fisik; dashboard memiliki 37 DC setelah dua Drive Thru dikeluarkan. Tidak ada DC dashboard yang hilang dari 39 baris fisik CSV dan tidak ada duplikat kunci plant-bulan pada 39 baris tersebut.

## 3. Perbandingan angka

Status: **SAMA** = sama pada presisi sumber; **KECIL** = beda absolut relatif ≤0,5%; **SIGNIFIKAN** = >0,5% atau CSV nol sedangkan dashboard bukan nol.

### 3.1 Total YTD Jan–Sep, cakupan setara 37 DC

| Metrik | CSV mentor (MWh) | Dashboard (MWh) | Selisih D−C (MWh) | Selisih % | Status |
|---|---:|---:|---:|---:|---|
| Produksi | 4.727,01580 | 4.727,34530 | +0,32950 | +0,0070% | KECIL |
| Pakai sendiri | 4.634,83479 | 4.635,16429 | +0,32950 | +0,0071% | KECIL |
| Ekspor | 92,18101 | 92,18101 | 0,00000 | 0,0000% | SAMA |
| PLN dibeli | 12.531,52997 | 12.532,25798 | +0,72801 | +0,0058% | KECIL |
| Beban | 17.167,09277 | 17.167,42227 | +0,32950 | +0,0019% | KECIL |

Perbedaan produksi 0,32950 MWh seluruhnya berasal dari data Parung yang tidak masuk CSV mentor: Februari 0,12780 MWh dan Juli 0,20170 MWh. Nilai tersebut ada pada ekspor vendor mentah dan dashboard.

### 3.2 Per bulan — produksi, pakai sendiri, ekspor

| Bulan | Metrik | CSV | Dashboard | Selisih MWh | Selisih % | Status |
|---|---|---:|---:|---:|---:|---|
| Jan | Produksi | 464,65860 | 464,65860 | 0 | 0% | SAMA |
| Jan | Pakai sendiri | 458,15767 | 458,15767 | 0 | 0% | SAMA |
| Jan | Ekspor | 6,50093 | 6,50093 | 0 | 0% | SAMA |
| Feb | Produksi | 441,38370 | 441,51150 | +0,12780 | +0,0290% | KECIL |
| Feb | Pakai sendiri | 435,40519 | 435,53299 | +0,12780 | +0,0294% | KECIL |
| Feb | Ekspor | 5,97851 | 5,97851 | 0 | 0% | SAMA |
| Mar | Produksi / pakai sendiri / ekspor | 561,11090 / 548,24627 / 12,86463 | Sama | 0 | 0% | SAMA |
| Apr | Produksi / pakai sendiri / ekspor | 564,48330 / 555,64824 / 8,83506 | Sama | 0 | 0% | SAMA |
| Mei | Produksi / pakai sendiri / ekspor | 512,60300 / 503,02358 / 9,57942 | Sama | 0 | 0% | SAMA |
| Jun | Produksi / pakai sendiri / ekspor | 517,65900 / 510,50714 / 7,15186 | Sama | 0 | 0% | SAMA |
| Jul | Produksi | 530,67450 | 530,87620 | +0,20170 | +0,0380% | KECIL |
| Jul | Pakai sendiri | 521,86502 | 522,06672 | +0,20170 | +0,0387% | KECIL |
| Jul | Ekspor | 8,80948 | 8,80948 | 0 | 0% | SAMA |
| Agu | Produksi / pakai sendiri / ekspor | 559,90190 / 545,82582 / 14,07608 | Sama | 0 | 0% | SAMA |
| Sep | Produksi / pakai sendiri / ekspor | 574,54090 / 556,15586 / 18,38504 | Sama | 0 | 0% | SAMA |

### 3.3 Per bulan — beban dan PLN dibeli

| Bulan | Beban CSV | Beban dash | Δ | Status | Beli PLN CSV | Beli PLN dash | Δ | Status |
|---|---:|---:|---:|---|---:|---:|---:|---|
| Jan | 1.969,05820 | 1.969,05820 | 0 | SAMA | 1.510,90052 | 1.510,90053 | +0,00001 | KECIL |
| Feb | 1.848,04958 | 1.848,17738 | +0,12780 | KECIL | 1.412,64443 | 1.412,64439 | −0,00004 | KECIL |
| Mar | 1.953,69885 | 1.953,69885 | 0 | SAMA | 1.405,45262 | 1.405,45258 | −0,00004 | KECIL |
| Apr | 1.941,08803 | 1.941,08803 | 0 | SAMA | 1.388,29157 | 1.385,43979 | −2,85178 (−0,2054%) | KECIL |
| Mei | 1.856,50335 | 1.856,50335 | 0 | SAMA | 1.353,02944 | 1.353,47977 | +0,45033 | KECIL |
| Jun | 1.865,11554 | 1.865,11554 | 0 | SAMA | 1.354,15288 | 1.354,60840 | +0,45552 | KECIL |
| Jul | 1.947,34015 | 1.947,54185 | +0,20170 | KECIL | 1.424,91305 | 1.425,47513 | +0,56208 | KECIL |
| Agu | 1.910,94083 | 1.910,94083 | 0 | SAMA | 1.364,69956 | 1.365,11501 | +0,41545 | KECIL |
| Sep | 1.875,29824 | 1.875,29824 | 0 | SAMA | 1.317,44590 | 1.319,14238 | +1,69648 (+0,1288%) | KECIL |

### 3.4 Dua puluh selisih DC-bulan terbesar

| # | Bulan | DC | Metrik | CSV | Dashboard | Δ MWh | Δ % | Status |
|---:|---|---|---|---:|---:|---:|---:|---|
| 1 | Sep | Jambi | PLN dibeli | 0,10225 | 1,05406 | +0,95181 | +930,87% | SIGNIFIKAN |
| 2 | Sep | Parung | PLN dibeli | 14,05012 | 14,79482 | +0,74470 | +5,30% | SIGNIFIKAN |
| 3 | Jul | Jambi | PLN dibeli | 0,23225 | 0,79435 | +0,56210 | +242,02% | SIGNIFIKAN |
| 4 | Jun | Jambi | PLN dibeli | 0,38244 | 0,83799 | +0,45555 | +119,12% | SIGNIFIKAN |
| 5 | Mei | Jambi | PLN dibeli | 0,32313 | 0,77352 | +0,45039 | +139,38% | SIGNIFIKAN |
| 6 | Agu | Jambi | PLN dibeli | 0,37150 | 0,78697 | +0,41547 | +111,84% | SIGNIFIKAN |
| 7 | Apr | Balaraja | PLN dibeli | 107,67000 | 107,31270 | −0,35730 | −0,332% | KECIL |
| 8 | Apr | Cileungsi | PLN dibeli | 141,34775 | 141,01285 | −0,33490 | −0,237% | KECIL |
| 9 | Apr | Jambi | PLN dibeli | 3,02713 | 3,30167 | +0,27454 | +9,07% | SIGNIFIKAN |
| 10 | Apr | Pekanbaru | PLN dibeli | 56,32688 | 56,08858 | −0,23830 | −0,423% | KECIL |
| 11 | Apr | Palembang | PLN dibeli | 86,26800 | 86,04960 | −0,21840 | −0,253% | KECIL |
| 12 | Apr | Medan | PLN dibeli | 57,35700 | 57,14060 | −0,21640 | −0,377% | KECIL |
| 13 | Jul | Parung | Produksi | 0 | 0,20170 | +0,20170 | n/a | SIGNIFIKAN |
| 14 | Jul | Parung | Pakai sendiri | 0 | 0,20170 | +0,20170 | n/a | SIGNIFIKAN |
| 15 | Jul | Parung | Beban | 0 | 0,20170 | +0,20170 | n/a | SIGNIFIKAN |
| 16 | Apr | Serang | PLN dibeli | 34,48775 | 34,32945 | −0,15830 | −0,459% | KECIL |
| 17 | Apr | Karawang | PLN dibeli | 48,87050 | 48,72170 | −0,14880 | −0,304% | KECIL |
| 18 | Apr | Lampung | PLN dibeli | 11,34500 | 11,19950 | −0,14550 | −1,283% | SIGNIFIKAN |
| 19 | Feb | Parung | Produksi | 2,86360 | 2,99140 | +0,12780 | +4,463% | SIGNIFIKAN |
| 20 | Feb | Parung | Pakai sendiri | 2,86336 | 2,99116 | +0,12780 | +4,463% | SIGNIFIKAN |

Lampiran lengkap berisi 1.665 baris: [`per-dc-month-comparison.csv`](compare-tmp/per-dc-month-comparison.csv).

### 3.5 Kapasitas, target, PR, dan Oktober parsial

**Kapasitas.** Dashboard dan ekspor vendor: 5.778,80 kWp untuk 37 DC. CSV Mei–Juli: 5.828,03 kWp. Selisih +49,23 kWp seluruhnya berasal dari Parung (CSV 244,23; registry dan vendor 195,00). Putusan: dashboard valid, keyakinan tinggi.

**Target.** Target dashboard dan Resume sama: Jan–Sep 515, 535, 535, lalu 475 MWh per bulan; YTD 4.435 MWh dan EOY 5.858 MWh. Dashboard mencapai 106,59% target YTD dan 80,70% target EOY. Resume menampilkan 110,40% dan 83,58% karena memakai 39 plant serta `yield + feed-in`. Target PR dashboard adalah 80%; CSV mentor tidak memberikan target PR eksplisit.

**PR.** Rumus sumber dashboard adalah `Σproduksi valid / Σ(kWp × iradiasi kWh/m²) × 100`, dengan plant-month sebelum COD, tanpa energi/radiasi, serta PR individu <50% atau >100% dikeluarkan. Rekonstruksi dari ekspor vendor:

| Bulan | PR algoritme dashboard | Plant-month dipakai | Anomali <50/>100 | Rata-rata PR resmi vendor* |
|---|---:|---:|---:|---:|
| Jan | 76,88% | 20 | 13 | 73,73% |
| Feb | 75,41% | 20 | 13 | 76,78% |
| Mar | 73,90% | 19 | 14 | 74,23% |
| Apr | 72,70% | 23 | 10 | 73,52% |
| Mei | 75,64% | 20 | 13 | 74,18% |
| Jun | 73,28% | 22 | 11 | 75,98% |
| Jul | 70,80% | 19 | 14 | 69,65% |
| Agu | 73,76% | 20 | 13 | 70,10% |
| Sep | 71,08% | 20 | 13 | 73,64% |
| YTD tertimbang | 73,50% | 183 dari 333 | 114; tambahan 36 tanpa radiasi | — |

\*Rata-rata aritmetika field `PR(%)` vendor, bukan agregasi tertimbang. CSV Radiasi hanya menyediakan rata-rata bulanan, sehingga tidak cukup untuk menghitung PR portofolio yang benar per plant. Perbedaan PR belum dapat diputuskan sampai definisi PR portal dan radiasi per plant dikonfirmasi.

**Oktober parsial.** Scope 2 memuat 65,780 MWh beban sampai tanggal pada nama file (2 Oktober), belum ada produksi/pakai-sendiri yang terbukti, dan memperlakukannya sebagai `load_upper_bound`. Dampak emisi yang tampil adalah 50,916 tCO2e. Nilai ini tidak dicampur ke tabel Jan–Sep di atas.

## 4. Uji konsistensi internal

| Uji | CSV mentor | Dashboard | Hasil |
|---|---|---|---|
| Produksi = pakai sendiri + ekspor | Benar jika produksi=`Monthly yield` dan pakai sendiri=`yield−feed-in` | Benar pada 333/333 baris | Lulus setelah pemetaan semantik |
| `Total Produksi` = produksi | Gagal: Feb–Sep menambahkan feed-in lagi; 282 baris nonnol terpengaruh | Tidak memakai kolom ini | CSV turunan tidak valid |
| Beban = PLN dibeli + pakai sendiri | Gagal pada 34 baris Apr, 1 Mei, 1 Jun, 1 Jul, 1 Agu, 2 Sep | Benar 333/333 karena PLN dibeli diturunkan dari identitas | Sumber portal saling tidak konsisten |
| Jan–Sep = Resume | Resume 4.896,20 MWh cocok dengan `yield+feed-in` seluruh 39 plant | Dashboard 4.727,35 MWh untuk 37 DC | Resume konsisten secara penjumlahan, salah definisi/cakupan |
| Produksi 39 plant yang benar | 4.804,009 MWh (`yield`) | n/a untuk scope 39 | Resume lebih 92,188 MWh, tepat sebesar ekspor |
| File Feb = COMPARASI FEB | Kolom produksi COMPARASI umumnya memakai `yield+feed-in` | Dashboard memakai yield | Kesalahan semantik berulang |
| Bulanan = Rekap Corporate | Nilai dua desimal konsisten secara tampilan; label `Self Consumption` sebenarnya yield bruto | Dashboard memisah bruto, ekspor, self-use | Label Rekap menyesatkan |
| Baris agregat | `Lombok` dan `Cilacap` ada setelah 39 plant | Tidak ada sebagai plant tambahan | Harus dikeluarkan; skrip audit sudah mengecualikan |
| Bulan parsial | CSV mentor berhenti Sep | Scope 2 memiliki Okt parsial | Sudah dipisahkan |
| Faktor emisi sama antarmodul | Tidak berlaku | Gagal: Scope 2 Sulselrabar 0,73 vs registry PLTS ex-post 0,75; `KALSELTENG` tidak menemukan faktor | Perlu satu registry |

Baris pelanggar lengkap neraca dan bukti terstruktur tersedia di [`evidence.json`](compare-tmp/evidence.json). Contoh konkret:

- Jambi Sep, CSV baris 25: yield 5,31790; feed-in 3,46864; load 2,90332; purchase 0,10225 MWh. Identitas memberi self-use 1,84926 dan purchase 1,05406 MWh, yaitu angka dashboard.
- Parung Jul, CSV baris 31 seluruh energi nol, sedangkan ekspor vendor mentah memuat produksi/load 0,20170 MWh. Dashboard mengikuti vendor mentah.
- Parung Mei–Jul, kolom kapasitas 244,23 kWp; laporan vendor dan registry memuat 195,00 kWp.

## 5. Putusan atas ketidakcocokan

| Kasus | CSV vs dashboard | Penyebab dan bukti | Putusan | Keyakinan |
|---|---|---|---|---|
| Parung Feb produksi | 2,86360 vs 2,99140 MWh | Ekspor vendor mentah memuat 2,99140; CSV/COMPARASI menyalin angka berbeda | Dashboard valid | Tinggi |
| Parung Jul produksi/load | 0 vs 0,20170 MWh | Nilai ada pada dua ekspor vendor yang dipakai dashboard | Dashboard valid | Tinggi |
| Jambi Apr–Sep, PLN dibeli | Selisih +0,275 hingga +0,952 MWh | Field purchase portal tidak memenuhi identitas; dashboard menghitung `load−(yield−feed)` | Keduanya sebagian; dashboard valid untuk neraca, meter PLN diperlukan untuk kebenaran fisik | Sedang |
| Parung Sep, PLN dibeli | 14,05012 vs 14,79482 MWh | Situasi yang sama; selisih 0,74470 MWh | Keduanya sebagian | Sedang |
| Lampung Apr, PLN dibeli | 11,34500 vs 11,19950 MWh | Dua field portal berbeda 0,14550 MWh setelah rekonsiliasi | Tidak bisa dipastikan tanpa meter tagihan/AMI | Sedang-rendah |
| Kapasitas Parung | 244,23 vs 195,00 kWp | Vendor mentah dan registry sama-sama 195,00 | Dashboard valid | Tinggi |
| Resume produksi YTD | 4.896,20 MWh (39 plant) vs 4.727,35 MWh (37 DC) | Cakupan +76,664 MWh; feed-in dihitung ulang +92,188 MWh | Dashboard valid untuk KPI 37 DC; Resume tidak valid sebagai pembanding langsung | Tinggi |
| Emisi PLTS | 4.881,51 vs 3.591,95 tCO2e | Mentor: produksi 39 plant × faktor RKAP ≈0,997; dashboard: self-use 37 DC × faktor regional resmi, Sulutgo dikecualikan | Keduanya aritmetis sesuai definisi; dashboard lebih defensif untuk avoided emissions | Tinggi |
| Scope 2 Banjarmasin | CSV tidak punya emisi; dashboard 0 untuk plant ini | Key `KALSELTENG` tidak ada di objek faktor yang dipanggil; 522,432 MWh purchase terlewat | Dashboard total Scope 2 tidak valid/lengkap | Tinggi |
| PR | CSV mentor tidak menyediakan PR per plant; vendor dan rumus memberi agregasi berbeda | 150/333 plant-month dikeluarkan dari agregasi dashboard | Tidak bisa dipastikan | Sedang-rendah |

## 6. Faktor emisi dan ekuivalensi

| Indikator | Dashboard saat ini | CSV mentor (rasio teramati) | Dampak Jan–Sep |
|---|---|---|---|
| PLTS avoided CO2 | Self-use × `cmPlts` regional 0,72–0,84; Sulutgo sementara dikeluarkan | Produksi `yield+feed` × faktor RKAP bulanan sekitar 0,997 t/MWh | 3.591,952 vs 4.881,51 tCO2e |
| Faktor flat nasional | 0,77644 tCO2e/MWh, berstatus sementara/fallback | Tidak tampak dipakai pada Resume | Bukan basis KPI regional utama |
| Scope 2 | Purchase × ex-post: Jamali 0,87; Sumatera 0,761; Kalbar 0,95; Batam 0,76; Lombok 0,87; Sulselrabar 0,73 | Tidak ada angka emisi Scope 2 pembanding | Dashboard 9.622,237 tCO2e sebelum koreksi Banjarmasin |
| Kalselteng | Registry master 1,20, tetapi runtime Scope 2 menghasilkan `null` | Tidak ada | Koreksi indikatif +626,918 = 10.249,155 tCO2e |
| Sulutgo | 0,60 sementara; dikeluarkan dari total resmi | Tidak dibedakan | Dashboard mengecualikan Gorontalo/Manado |
| Batubara | 0,400 ton/MWh self-use | 0,404 ton/MWh atas produksi mentor | 1.854,1 vs 1.978,06 ton |
| Pohon | avoided CO2 × 1.000/21,77 | 54 pohon/MWh produksi mentor | 164.995 vs 264.395 pohon |

Perbedaan CO2, batubara, dan pohon terutama merupakan beda basis, cakupan, dan faktor—bukan sekadar pembulatan. Ekspor tidak dihitung sebagai emisi terhindar pada dashboard; Resume mentor secara efektif ikut menghitung ekspor dua kali di basis produksinya.

## 7. Asumsi dan keterbatasan

1. “CSV produksi” ditafsirkan sebagai `Monthly yield`, sesuai nama field ekspor vendor dan identitas energi. `Total Produksi` diperlakukan sebagai turunan yang salah.
2. Status beda dihitung per nilai: persis pada presisi enam desimal; kecil bila `|dashboard−CSV|/|CSV| ≤ 0,5%`; bila CSV nol dan dashboard tidak nol, status signifikan.
3. Tidak ada akses ke meter fisik, tagihan PLN/AMI, atau histori koreksi portal. Karena itu sengketa field PLN dibeli tidak dapat diputuskan sampai sumber primer tersedia.
4. Database dashboard tidak terjangkau saat audit. Tidak ada SELECT yang berhasil, sehingga waktu pembaruan database dan kesamaan KPI/table/chart pada render live tidak dapat diverifikasi.
5. Angka Scope 2 dapat direproduksi penuh dari lapisan file lokal yang memang dipanggil halaman. Angka PLTS/PR adalah rekonstruksi source-equivalent, bukan tangkapan respons API live.
6. Waktu modifikasi CSV mentor lebih baru daripada ekspor vendor, tetapi tidak ada changelog. Ini mendukung kemungkinan spreadsheet disusun ulang setelah ekspor, bukan bukti adanya koreksi resmi.
7. Tidak ada rumus aktif dalam CSV; semua formula spreadsheet telah tersalin sebagai nilai sehingga asal formula hanya dapat diinferensikan dari identitas/rasio.

## 8. Usulan perbaikan dan pertanyaan untuk mentor

### Prioritas perbaikan—tidak dieksekusi

1. Samakan key faktor `KALSELTENG` pada Scope 2. Estimasi total Jan–Sep berubah 9.622,237 → 10.249,155 tCO2e (+626,918).
2. Tetapkan satu registry faktor lintas PLTS dan Scope 2; selesaikan perbedaan Sulselrabar 0,73 vs 0,75 dan tandai faktor sementara secara konsisten.
3. Ubah sumber Resume: produksi = `Monthly yield`, self-use = `yield−feed-in`; jangan tambahkan feed-in ke yield. Untuk 39 plant, produksi YTD berubah 4.896,198 → 4.804,009 MWh.
4. Pisahkan cakupan “39 plant termasuk dua toko” dan “37 DC” pada semua target/KPI agar Resume dan dashboard dapat dibandingkan langsung.
5. Koreksi kapasitas Parung pada CSV 244,23 → 195,00 kWp; total 37 DC menjadi 5.778,80 kWp.
6. Untuk PLN dibeli, simpan kedua nilai: field portal dan hasil rekonsiliasi; tambahkan flag ketika selisih melebihi toleransi, jangan menimpa diam-diam.
7. Tampilkan coverage PR (`183/333 plant-month`) dan alasan eksklusi di UI; jangan tampilkan satu angka PR tanpa denominator.
8. Tambahkan checksum/timestamp sumber dan versi rumus ke ekspor dashboard agar koreksi susulan dapat dilacak.

### Pertanyaan yang perlu dikonfirmasi kepada mentor

- Apakah `Monthly yield` dimaksudkan sebagai produksi bruto atau self-consumption? Ekspor vendor dan identitas menunjukkan produksi bruto.
- Mengapa `Total Produksi = Monthly yield + feed-in`, padahal feed-in sudah bagian dari yield?
- Apakah target 5.858 MWh berlaku untuk 37 DC atau semua 39 plant termasuk Drive Thru?
- Untuk PLN dibeli, mana yang dianggap resmi: field portal atau meter/tagihan PLN? Apa aturan ketika tidak memenuhi `load = purchase + self-use`?
- Apakah kapasitas Parung berubah resmi menjadi 244,23 kWp; jika ya, mana dokumen commissioning-nya?
- Apakah PR portfolio harus mengikuti PR resmi portal, rata-rata aritmetika, atau rasio energi tertimbang? Bagaimana menangani PR <50% dan >100%?
- Apakah ekspor boleh memperoleh kredit avoided emissions? Dashboard saat ini tidak; Resume secara implisit memasukkannya.
- Faktor CO2/coal/tree di Resume berasal dari RKAP target atau standar pelaporan aktual?

### Rekomendasi sumber tunggal

Jadikan ekspor mentah portal/meter yang diarsipkan dan diberi checksum sebagai sumber fakta energi. Dashboard menjadi lapisan rekonsiliasi dan pelaporan; CSV mentor menjadi keluaran kontrol, bukan sumber impor balik. Target dan faktor emisi harus berada pada registry berversi dengan dokumen, tahun, status resmi/sementara, dan aturan cakupan yang eksplisit.

## Lampiran yang dibuat

- `docs/comparison-csv-vs-dashboard.md` — laporan ini.
- `docs/compare-tmp/per-dc-month-comparison.csv` — seluruh 1.665 perbandingan DC-bulan-metrik.
- `docs/compare-tmp/evidence.json` — profil file, agregat, PR, top mismatch, dan bukti terstruktur.
- `docs/compare-tmp/compare.mjs` — skrip audit lokal yang hanya membaca sumber dan menulis dua lampiran di folder yang diizinkan.

Tidak ada file kode aplikasi, konfigurasi, data sumber/CSV, atau database yang diubah. Tidak ada commit, migrasi, maupun operasi insert/update/delete yang dilakukan.
