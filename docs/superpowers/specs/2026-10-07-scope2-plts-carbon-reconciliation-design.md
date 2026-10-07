# Desain Rekonsiliasi Scope 2, PLTS, dan Dashboard Utama

Tanggal: 7 Oktober 2026  
Status: rancangan untuk ditinjau  
Sumber kebutuhan: tugas penyempurnaan halaman Scope 2 dan arahan integrasi tab Pengurangan Emisi–PLTS ke dashboard utama

## 1. Tujuan

Membangun satu alur perhitungan kanonis yang menghubungkan:

1. beban listrik fasilitas ber-PLTS dari laporan bulanan iSolarCloud;
2. produksi dan ekspor PLTS per plant-bulan;
3. listrik yang dibeli dari jaringan;
4. emisi Scope 2 location-based;
5. kontribusi pengurangan emisi PLTS; dan
6. ringkasan yang konsisten pada halaman Scope 2, tab Pengurangan Emisi–PLTS, dan dashboard utama.

Implementasi bersifat aditif. Data sumber, database, endpoint allowlist, scheduler, dan konfigurasi faktor yang sudah ada tidak dimutasi.

## 2. Batas Akuntansi dan Pencegahan Hitung Ganda

Untuk setiap plant-bulan:

- `L` = beban dari `Monthly load consumption(kWh)`.
- `P` = produksi PLTS bulanan yang terselesaikan.
- `E` = energi ekspor yang terbukti.
- `S = P - E` = PLTS yang dipakai sendiri.
- `G = L - S` = listrik yang dibeli dari jaringan.

Validasi wajib:

- `G >= 0`;
- `S >= 0`;
- `S <= L`;
- nilai kosong tidak berubah menjadi nol;
- baris yang gagal validasi tetap disimpan sebagai observasi sumber, tetapi tidak masuk hitungan berbasis listrik dibeli.

### Dua tampilan yang tidak boleh dicampur

1. **Inventaris Scope 2 resmi**: `G × faktor grid`. Ini adalah emisi listrik yang benar-benar dibeli. PLTS tidak dikurangkan lagi dari hasil ini.
2. **Jembatan kontribusi PLTS**: `L × faktor grid − S × faktor grid = G × faktor grid`. Jembatan ini menunjukkan berapa emisi yang dihindari PLTS dan hasil setelah kontribusi PLTS tanpa menghitungnya dua kali.

Dashboard utama menampilkan jembatan tersebut sebagai:

`Emisi basis beban` − `PLTS dipakai sendiri × faktor grid` = `Scope 2 setelah kontribusi PLTS`.

Jika `G` sudah terbukti langsung, angka akhir memakai `G × faktor grid` dan nilai avoided hanya menjadi penjelas/bridge. Jika `S` belum terbukti, Scope 2 memakai `L × faktor grid` sebagai **batas atas (beban)** dan tidak mengarang avoided PLTS.

Water recycle tetap menjadi dampak lingkungan terpisah dan tidak mengurangi inventaris Scope 1/2 resmi. Bila produk tetap membutuhkan indikator “net impact”, indikator tersebut harus berlabel non-inventory dan merinci komponennya.

## 3. Sumber Data dan Provenance

Sumber yang boleh dibaca:

- dua CSV `monthly load consump_Annual report` untuk 2025 dan 2026;
- data produksi bulanan kanonis yang sudah ada;
- `EnergyFlowMonthly` untuk ekspor bila tersedia;
- metadata plant dan grid yang sudah ada;
- registry faktor emisi yang sudah ada, tanpa perubahan;
- discovery vendor read-only maksimal delapan panggilan pada tahap audit B1.

Setiap nilai turunan membawa:

- periode;
- plant/ps_id;
- field sumber;
- basis `purchased` atau `load_upper_bound`;
- status faktor `official` atau `temporary`;
- status periode `complete` atau `partial`;
- flag kualitas;
- hash file sumber yang relevan.

Titik ukur vendor hanya dipakai jika nama, arti, dan unit terbukti. Titik ambigu dilaporkan sebagai kandidat dan tidak dipakai.

## 4. Dataset Kanonis

Modul analitik murni menghasilkan satu baris per plant-bulan dengan kontrak berikut:

```text
year_month
ps_id
dc_name
grid
connect_type
load_kwh
production_kwh
export_kwh
self_consumed_kwh
purchased_kwh
scope2_basis
grid_factor_kg_per_kwh
factor_status
scope2_emission_ton
load_basis_emission_ton
plts_avoided_ton
period_status
data_through_date
source_refs[]
quality_flags[]
```

Tidak ada default numerik untuk data yang tidak tersedia. Nilai yang tidak terbukti adalah `null` dan dirender sebagai `—` atau “Belum tersedia”.

## 5. Status Faktor Emisi

Setiap plant dipetakan ke grid dan satu faktor beserta status sumbernya.

- Faktor `official` boleh masuk total emisi.
- Faktor `temporary` tetap ditampilkan, tetapi emisi sel dan kontribusi totalnya menjadi `—`.
- Dashboard menyebut jumlah plant dan MWh yang dikecualikan.
- Rata-rata faktor adalah rata-rata tertimbang energi dari baris dengan faktor resmi.

Tidak ada fallback diam-diam ke faktor nasional.

## 6. Periode dan Data Parsial

- Tanggal laporan menentukan `data_through_date`.
- Oktober 2026 berstatus `partial` dan diberi badge `Sebagian (s.d. tanggal)`.
- Periode default menampilkan Januari–September sebagai bulan lengkap dan Oktober sebagai tambahan parsial.
- Bulan parsial tidak masuk median/P10/P90, YoY like-for-like, anomali, pola musiman, atau proyeksi.
- KPI menuliskan bagian lengkap dan parsial secara terpisah.

## 7. Filter Bersama

Query parameter menjadi sumber state tunggal:

- `period=ytd|month|range`;
- `month=YYYY-MM`;
- `from=YYYY-MM` dan `to=YYYY-MM`;
- `grid=<kode>`;
- `dc=<ps_id atau canonical id>`;
- `q=<teks pencarian>`;
- `tariff=<rupiah/kWh>`;
- `scope2Basis=purchased|load`.

Semua KPI, grafik, tabel, drawer, narasi, simulator, dan ekspor membaca fungsi query yang sama. Pencarian menormalisasi kapitalisasi, spasi, tanda baca, dan awalan `Alfamart DC`.

## 8. Halaman Scope 2

Fitur yang sudah ada tetap dipertahankan: empat KPI, grafik bulanan, tabel Bulan/Total/Rata-rata/Cakupan, dan panel sumber/metode.

Penyempurnaan:

- judul cakupan 39 plant ber-PLTS;
- filter bersama;
- input tarif asumsi di query parameter;
- waterfall beban → PLTS dipakai sendiri → listrik dibeli → faktor → emisi;
- KPI menggunakan median dan P10–P90, dengan rata-rata biasa hanya pada tooltip;
- KPI intensitas, porsi PLTS, dan proyeksi;
- grafik bertumpuk purchased + self-consumed dengan emisi pada sumbu kanan;
- toggle tampilan bar lama;
- YoY like-for-like;
- Ranking & Anomali;
- rincian per grid;
- drawer detail DC;
- simulator tambahan PLTS;
- panel kualitas data;
- ringkasan otomatis berbasis aturan;
- ekspor Excel multi-sheet dan CSV yang tetap tersedia.

Nilai biaya selalu berlabel estimasi/asumsi. Biaya memakai purchased kWh bila terbukti dan load kWh sebagai batas atas bila belum terbukti.

## 9. Tab Pengurangan Emisi–PLTS

Tab PLTS membaca dataset kanonis yang sama, bukan menghitung angka avoided sendiri dari total produksi mentah.

- Avoided yang berhubungan dengan Scope 2 menggunakan `self_consumed_kwh × faktor grid resmi`.
- Energi ekspor ditampilkan terpisah dan tidak dianggap langsung mengurangi listrik yang dibeli fasilitas.
- Produksi, self-consumption, ekspor, avoided, cakupan faktor, dan flag kualitas dapat direkonsiliasi ke baris Scope 2.
- Klik plant membuka detail yang sama dengan drawer Scope 2.
- Target 2027 ditampilkan hanya jika sumber target dapat dibuktikan; jika tidak, tampil “Belum tersedia — membutuhkan dokumen target 2027”.

## 10. Dashboard Utama

Dashboard utama memakai ringkasan kanonis server-side, bukan angka hardcode atau localStorage lama.

Kartu dan alur utama:

1. Scope 1;
2. emisi basis beban fasilitas ber-PLTS;
3. kontribusi PLTS yang dipakai sendiri;
4. Scope 2 listrik dibeli/batas atas;
5. inventaris Scope 1 + Scope 2;
6. dampak water recycle sebagai indikator terpisah;
7. indikator net-impact opsional yang tidak diberi label inventaris GHG.

Setiap angka menunjukkan cakupan dan basis. Navigasi dari kartu Scope 2 atau PLTS mempertahankan filter melalui query parameter.

## 11. Analitik

### Statistik

Median dan persentil dihitung hanya dari baris lengkap dan valid. P10/P90 memakai interpolasi linear yang didokumentasikan dan diuji.

### YoY

YoY hanya membandingkan plant yang memiliki data valid di tahun 2025 dan 2026 untuk bulan yang sama. UI menampilkan jumlah plant pasangan.

### Anomali

Baris ditandai bila perubahan lebih dari 25% terhadap median enam bulan lengkap sebelumnya atau `|z| > 3`. Fixture pengujian selalu berlabel sintetis dan tidak masuk aplikasi produksi.

### Proyeksi

Metode dasar: total bulan lengkap / jumlah bulan lengkap × 12. Bila pola 2025 lengkap dan like-for-like tersedia, pola musiman menghasilkan rentang minimum–maksimum. Bulan parsial tidak dipakai.

### Simulator

Simulator hanya berjalan jika specific yield 12 bulan lengkap tersedia untuk lokasi tersebut. Tidak ada penyimpanan database atau localStorage. Jika input dasarnya tidak tersedia, hasil adalah “Belum tersedia” disertai input yang dibutuhkan.

## 12. Endpoint dan Modul

Endpoint Scope 2 yang ada diperluas menjadi penyedia payload kanonis. Endpoint ekspor memakai fungsi query/agregasi yang sama agar angka identik dengan UI.

Modul dipisahkan menurut tanggung jawab:

- parser dan pemeriksaan sumber;
- rekonsiliasi energi plant-bulan;
- faktor dan emisi;
- filter/query;
- statistik, anomali, YoY, dan proyeksi;
- view model dashboard;
- ekspor;
- komponen halaman Scope 2;
- adaptor tab PLTS;
- adaptor dashboard utama.

Tidak ada migrasi schema pada pekerjaan ini.

## 13. Error dan Kondisi Stop

- Koneksi DB gagal: hentikan bagian yang memerlukan DB dan laporkan.
- Titik beli/impor ambigu: lanjutkan dengan basis beban berlabel, tanpa pemetaan spekulatif.
- Respons vendor tidak sesuai kontrak: hentikan discovery vendor dan simpan respons tersanitasi sebagai bukti.
- Batas delapan panggilan tercapai: jangan melakukan panggilan tambahan.
- Data 2025 tidak tersedia: lewati YoY dan tampilkan alasan.

UI memiliki skeleton, empty state, dan error state. Tidak boleh ada `undefined`, `NaN`, angka dummy, atau fallback numerik tersembunyi.

## 14. Pengujian dan Bukti

Pengujian murni tidak memanggil API live. Cakupan minimal:

- identitas `purchased + self_consumed = load`;
- batas non-negatif dan `self_consumed <= load`;
- fallback basis beban;
- faktor sementara dikecualikan;
- bulan parsial dikecualikan dari analitik/proyeksi;
- waterfall tepat;
- median dan P10–P90;
- YoY like-for-like;
- anomali sintetis;
- simulator tanpa write;
- payload UI tanpa `undefined`/`NaN`;
- kesamaan UI dan ekspor;
- rekonsiliasi Scope 2, PLTS, dan dashboard utama;
- feature-lock sebelum/sesudah;
- responsif 375, 768, dan 1440 px.

Laporan akhir memuat inventaris A, hasil koreksi B, scorecard F, panggilan dan sisa kuota vendor, hash sumber sebelum/sesudah, file yang berubah, fitur lama yang hilang, dan seluruh hal yang belum terbukti.

## 15. Ruang Lingkup Perubahan

Perubahan boleh menyentuh halaman Scope 2, tab Pengurangan Emisi–PLTS, dashboard utama, endpoint/read-model bersama, pengujian, dokumentasi, dan skrip audit. Perluasan ini menggantikan batas sebelumnya yang hanya memperbolehkan perubahan pada halaman Scope 2.

Larangan tetap berlaku: tidak mengubah CSV/Excel/RKAP, allowlist endpoint, faktor emisi, database produksi, schema, scheduler, atau golden snapshot; tidak menjalankan `git add`, `git commit`, atau `git push`.

