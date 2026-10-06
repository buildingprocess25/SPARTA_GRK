# Desain Arsitektur Suhu Inverter iSolarCloud

Tanggal: 2026-10-06
Status: Menunggu tinjauan
Metode awal: `isolar-inverter-temp-v1`

## 1. Tujuan dan batasan

Fitur ini mengganti sumber suhu utama pada tab Performa Sistem (PR) dari estimasi suhu panel menjadi suhu internal inverter iSolarCloud. Data bersifat forward-only: sistem mulai menyimpan sampel real-time `p4` setelah fitur aktif dan tidak menjanjikan backfill sebelum endpoint histori `p4` terbukti.

Suhu inverter bukan suhu sel panel. Karena itu suhu inverter tidak digunakan dengan koefisien suhu sel untuk menghitung PR terkoreksi STC. Open-Meteo tetap tersedia sebagai seri terpisah bernama **Suhu Udara (Open-Meteo)** dan tidak pernah digunakan untuk mengisi kekosongan suhu inverter.

Perubahan bersifat additive. Tabel legacy, data historis, dan golden snapshot tidak dimutasi. Migrasi hanya membuat tabel, indeks, constraint, dan foreign key baru.

## 2. Sumber data dan semantik field

Endpoint sumber adalah `/openapi/getPVInverterRealTimeData` pada level perangkat. Field yang digunakan:

- `device_sn`: identitas inverter;
- relasi perangkat ke `ps_id`: identitas plant fisik;
- `device_time`: waktu pengukuran perangkat dalam WIB;
- `p4`: suhu udara internal inverter dalam ℃;
- `p24`: daya aktif dalam W;
- `fetched_at`: waktu UTC ketika respons diterima aplikasi.

Metadata vendor untuk inverter `device_type=1`, `point_id=4`, menyebut `Internal air temperature` dengan `storage_unit=℃` dan `show_unit=℃`.

Sampel valid untuk analitik bila seluruh syarat berikut terpenuhi:

1. `p4` numerik dan lebih besar dari nol;
2. `p24` numerik dan lebih besar dari nol;
3. `device_time` dapat diurai sebagai waktu WIB;
4. selisih absolut `device_time` terhadap `fetched_at` tidak lebih dari 15 menit.

`device_time` diurai sebagai UTC+7 tanpa mengikuti zona waktu mesin, lalu dikonversi dan disimpan sebagai UTC. Nilai nol tidak disimpan sebagai suhu 0 ℃ untuk agregasi. Sampel dengan waktu terpaut lebih dari 15 menit diberi alasan `STALE_DEVICE_TIME` dan tidak masuk agregat.

## 3. Konfigurasi dan versi metode

Konfigurasi aktif memuat sekurangnya:

- `method_version`;
- zona waktu `Asia/Jakarta`;
- awal dan akhir jam produksi;
- interval siklus dalam menit;
- batas stale waktu perangkat 15 menit;
- ambang coverage harian 50%;
- ambang anomali spread antar-inverter 10 ℃;
- batas run tanpa selesai;
- versi rumus agregasi bulanan.

Dashboard dan ekspor hanya membaca satu `method_version` aktif dari konfigurasi. Versi lain tidak digabung dan hanya dapat diminta melalui parameter eksplisit yang tervalidasi. Setiap run, sampel, agregat, respons API, dan ekspor membawa versi metode agar hasil dapat direproduksi.

Jadwal yang tersimpan dalam versi metode adalah sumber kebenaran penyebut coverage. Keberadaan baris run bukan penyebut. Slot terjadwal tanpa run dihitung sebagai kegagalan sampling.

## 4. Model data baru

### 4.1 `inverter_temp_sampling_run`

Tabel operasional satu baris per siklus sampling:

| Kolom | Semantik |
|---|---|
| `id` | Identitas run |
| `started_at` | Awal run UTC |
| `finished_at` | Akhir run UTC; null saat running |
| `status` | `running`, `success`, `partial`, atau `failed` |
| `devices_expected` | Jumlah inverter yang hendak diminta |
| `devices_ok` | Jumlah perangkat dengan respons yang dapat diproses |
| `devices_failed` | Jumlah perangkat dalam chunk gagal/tidak kembali |
| `devices_filtered` | Respons yang ditolak oleh filter p4, p24, atau waktu |
| `devices_duplicate` | Sampel valid yang sudah pernah disimpan |
| `chunks_total` | Jumlah chunk yang direncanakan |
| `chunks_failed` | Jumlah chunk gagal |
| `error_summary` | Ringkasan error yang telah disanitasi |
| `chunk_details` | JSON terstruktur per chunk |
| `api_quota_used` | Delta kuota bila tersedia |
| `trigger` | `scheduler` atau `manual` |
| `method_version` | Versi metode sampling |

Indeks dibuat pada `started_at` dan `status`. Retensi minimum dua tahun. Tidak ada penghapusan otomatis dalam fitur ini.

`chunk_details` dipilih daripada tabel anak karena data hanya dipakai untuk audit satu run, volumenya kecil, dan tidak menjadi dimensi query analitik. Struktur setiap elemen dibatasi pada nomor chunk, jumlah device, sukses/gagal/filtered/duplicate, durasi, serta kode dan pesan error aman. Payload autentikasi dan header tidak disimpan.

### 4.2 `inverter_temp_sample`

Tabel append-only berisi:

- `id`, `run_id`, `device_sn`, `ps_id`;
- `device_time` UTC;
- `p4`, `p24`;
- `quality_flags` terstruktur;
- `fetched_at` UTC;
- `method_version`.

`run_id` adalah foreign key ke `inverter_temp_sampling_run`. Unique constraint `(device_sn, device_time, method_version)` menjamin idempotensi. Penyimpanan batch menggunakan `createMany({ skipDuplicates: true })`; record lama tidak diperbarui.

Indeks dibuat pada `run_id`, `(ps_id, device_time)`, dan `(device_sn, device_time)`.

Sampel invalid tidak dimasukkan sebagai suhu valid. Jumlah dan alasannya tetap direkam pada run dan `chunk_details`. Tidak ada nilai pengganti.

### 4.3 `inverter_temp_daily`

Agregat per plant fisik dan tanggal WIB berisi:

- `ps_id`, `date_wib`, `method_version`;
- `avg_temp_c`, `max_temp_c`;
- `sample_count`;
- `inverters_covered`, `inverters_registered`;
- `coverage_pct`;
- `sampling_coverage_pct`;
- `production_coverage_pct`;
- `max_inverter_spread_c`, `has_spread_anomaly`;
- `quality_status`, `quality_reasons`;
- `included_run_count`, `expected_run_count`;
- `fetched_at`.

Unique constraint `(ps_id, date_wib, method_version)` memungkinkan penghitungan ulang idempoten. Sampel mentah dan agregat tidak dihapus otomatis.

## 5. Lifecycle run dan pencegahan overlap

Sebelum memulai run, sampler memperoleh lock database yang terikat pada metode aktif. Jika masih ada run `running` yang belum melewati timeout, run baru ditolak sebagai overlap dan tidak memanggil vendor.

Jika run `running` telah melewati timeout, pemanggil berikutnya menutupnya sebagai `failed`, mengisi `finished_at`, dan memberi alasan `RUN_TIMEOUT`, kemudian membuat run baru. Transisi status yang sah:

- `running → success` bila semua chunk selesai;
- `running → partial` bila sedikitnya satu chunk berhasil dan sedikitnya satu chunk gagal;
- `running → failed` bila tidak ada perangkat berhasil atau terjadi kegagalan fatal;
- `running → failed` oleh run berikutnya jika timeout.

Perangkat dalam chunk gagal dicatat sebagai gagal dan tidak diberi sampel pengganti. Filter kualitas tidak dengan sendirinya mengubah run menjadi partial; partial khusus kegagalan pengambilan chunk/perangkat.

Penutupan run dan penyimpanan sampel dilakukan secara konsisten sehingga status tidak menyatakan sukses sebelum batch sampel selesai disimpan.

## 6. Sanitasi error

Semua error melewati satu fungsi sanitasi sebelum disimpan atau dikirim ke UI. Sanitasi:

- menghapus nilai untuk key yang cocok dengan `token`, `secret`, `password`, `authorization`, `x-access-key`, dan `appkey` tanpa membedakan kapitalisasi;
- menyaring pola bearer token dan kredensial yang mungkin muncul dalam string;
- membatasi panjang dan kedalaman JSON;
- tidak menyimpan request header atau body autentikasi;
- menghasilkan kode error stabil dan pesan aman.

Test wajib membuktikan bahwa token, secret, header otorisasi, dan kredensial bersarang tidak muncul pada `error_summary`, `chunk_details`, respons endpoint, maupun log aplikasi yang diuji.

## 7. Agregasi harian dan coverage

Agregasi hanya dijalankan untuk tanggal WIB yang sudah berakhir. Job boleh dijalankan ulang untuk tanggal dan versi metode yang sama dengan hasil deterministik.

### 7.1 Definisi coverage

Istilah berikut harus tampil identik di API, UI, dan sheet Metadata:

- **`sampling_coverage_pct`**: persentase slot jadwal produksi yang berhasil mencakup plant. Penyebut berasal dari seluruh slot tetap pada jam produksi menurut `method_version`; slot tanpa run, run failed, atau chunk plant gagal tetap berada dalam penyebut.
- **`production_coverage_pct`**: persentase observasi perangkat yang lolos filter produksi dan kualitas dibanding observasi perangkat yang berhasil diterima pada slot tercakup. Nilai rendah dapat berarti inverter tidak berproduksi, data nol, atau waktu perangkat stale, bukan selalu kegagalan API.
- **`coverage_pct`**: coverage resmi untuk kelayakan agregat, sama dengan `sampling_coverage_pct`. Pemisahan metrik produksi mencegah downtime sampling disamarkan sebagai inverter tidak berproduksi.

Sebuah plant dianggap tercakup pada satu slot bila chunk yang memuat perangkat plant berhasil dan respons perangkat dapat diidentifikasi, meskipun sebagian sampel kemudian ditolak karena inverter tidak berproduksi. `quality_reasons` membedakan:

- `SAMPLING_FAILURE` untuk slot tanpa run, run failed, atau chunk gagal;
- `INVERTER_NOT_PRODUCING` untuk `p24 <= 0`;
- `INVALID_TEMPERATURE` untuk `p4 <= 0` atau bukan angka;
- `STALE_DEVICE_TIME` untuk selisih waktu di atas 15 menit;
- `LOW_DEVICE_COVERAGE` untuk inverter tercakup yang tidak memenuhi ambang;
- `INVERTER_SPREAD_GT_10C` untuk spread suhu valid lebih dari 10 ℃.

`quality_status` menjadi `tidak lengkap` jika `coverage_pct < 50`, terdapat sampling failure, atau tidak ada sampel suhu valid. Nilai agregat yang tersedia tetap apa adanya; tidak diganti Open-Meteo atau nol.

### 7.2 Suhu dan anomali

Untuk setiap slot, suhu plant adalah rata-rata sederhana antar-inverter dengan sampel valid. Rata-rata harian dihitung dari suhu plant per slot sehingga plant dengan banyak inverter tidak mendapat bobot berlebih. `max_temp_c` adalah maksimum sampel valid hari tersebut.

Spread dihitung antar-inverter valid pada slot yang sama. Hari diberi `has_spread_anomaly=true` jika ada spread lebih dari 10 ℃; nilai spread maksimum disimpan.

Test pergantian hari mencakup sampel sebelum dan sesudah 00:00 WIB serta pembuktian bahwa penyimpanan UTC tetap masuk ke `date_wib` yang benar.

## 8. Agregasi bulanan dan nasional

Hari dengan `coverage_pct >= 50` dan sedikitnya satu sampel valid dapat masuk agregat bulanan. Hari lain tidak dihapus: tanggal dan alasan eksklusinya ditampilkan pada metadata respons dan catatan kualitas ekspor.

Suhu bulanan plant/DC dihitung sebagai rata-rata berbobot `sample_count` atas hari yang disertakan:

`monthly_avg = Σ(daily_avg_temp × daily_sample_count) / Σ(daily_sample_count)`

Bobot `sample_count` dipilih karena merepresentasikan paparan operasional terukur; hari dengan sedikit pengamatan tidak diberi bobot sama dengan hari yang terukur penuh. Metadata API dan ekspor menyebut rumus, ambang 50%, jumlah hari disertakan, dan daftar hari dikeluarkan.

Untuk DC yang terdiri dari beberapa plant fisik, nilai per DC dibangun dari nilai plant dengan data valid. Nilai nasional adalah rata-rata nilai DC berbobot kapasitas kWp, hanya untuk DC dengan data suhu valid pada periode tersebut. Cakupan nasional menyebut jumlah DC/plant yang berkontribusi dan tidak menyembunyikan DC tanpa data.

Bulan berjalan tetap ditandai parsial dan dikeluarkan dari KPI serta korelasi.

## 9. Query bersama untuk dashboard dan ekspor

Satu service query kanonik menerima `scope`, `targetId`, `year`, `parameter`, dan `methodVersion`. Service ini menghasilkan:

- seri bulanan PR dan suhu inverter;
- seri suhu udara Open-Meteo yang terpisah;
- coverage dan catatan kualitas;
- jumlah plant dan inverter;
- daftar hari yang dikeluarkan;
- metadata metode;
- waktu run sukses terakhir dan status stale.

Endpoint dashboard dan endpoint ekspor hanya melakukan validasi, autentikasi/otorisasi, lalu memformat hasil service yang sama. Tidak ada perhitungan ulang khusus ekspor.

## 10. Korelasi

Pearson menggunakan pasangan bulan penuh yang memiliki PR, suhu inverter, dan coverage memadai. Korelasi hanya dihitung jika `n >= 6`.

Jika `n < 6`, API dan UI mengembalikan **data belum cukup untuk korelasi** tanpa angka `r`. Bila `n >= 6`, hasil menyertakan `r`, `n`, dan `p-value`. `p >= 0,05` diberi keterangan **tidak signifikan secara statistik**. UI tidak menyatakan kausalitas.

## 11. UI

Tab Performa Sistem menyediakan:

- suhu utama **Suhu Inverter**;
- opsi terpisah **Suhu Udara (Open-Meteo)** dengan garis putus-putus;
- cakupan aktif pada judul dan KPI;
- sumber, periode, jumlah plant/inverter, dan coverage;
- empty state **belum ada data suhu inverter** untuk periode forward-only yang kosong;
- peringatan coverage di bawah 80% pada bulan tertentu;
- indikator anomali spread;
- skeleton saat filter DC berubah agar data lama tidak berkedip;
- `terakhir diperbarui` dari `finished_at` run sukses terakhir;
- peringatan bila tidak ada run sukses lebih dari 30 menit pada jam produksi.

Pilihan DC tetap dapat dipilih saat tidak memiliki data suhu. Grafik PR tetap tampil tanpa garis suhu inverter.

Kartu PR terkoreksi STC tidak menggunakan suhu inverter. Versi pertama menghapus kartu tersebut dari jalur suhu inverter; estimasi berbasis Open-Meteo hanya boleh ditampilkan sebagai metrik terpisah dengan label estimasi yang eksplisit.

## 12. Ekspor dan audit unduhan

Ekspor mengikuti filter aktif DC dan tahun serta `method_version` aktif, kecuali versi lain diminta eksplisit.

Format utama adalah Excel `.xlsx`:

1. **Data**: `ps_id`, nama DC, periode, PR terbobot, `suhu_inverter_c`, `suhu_udara_openmeteo_c`, `coverage_pct`, jumlah inverter, dan flag kualitas;
2. **Metadata**: sumber, rumus, ketiga definisi coverage, filter kualitas, ambang, versi metode, waktu ekspor, dan filter;
3. **Catatan kualitas**: hari/DC dengan coverage rendah, sampling failure, waktu stale, tidak berproduksi, atau anomali spread.

Ekspor CSV berupa ZIP berisi `data.csv`, `metadata.csv`, dan `catatan-kualitas.csv`. Semua CSV memakai UTF-8 dengan BOM, pemisah koma, quoting RFC 4180, dan line ending CRLF.

Endpoint ekspor wajib terautentikasi dan mengotorisasi akses terhadap scope yang diminta. Setiap unduhan dicatat dalam tabel audit baru yang additive, sekurangnya memuat pengguna, format, filter, versi metode, waktu UTC, serta status. Log tidak memuat token atau data autentikasi.

Test membandingkan dataset terstruktur hasil service query dengan isi workbook/ZIP setelah diparsing, bukan hanya membandingkan teks tampilan.

## 13. Migrasi dan peluncuran

Migrasi membuat tabel berikut:

1. `inverter_temp_sampling_run`;
2. `inverter_temp_sample`;
3. `inverter_temp_daily`;
4. tabel audit unduhan ekspor suhu/PR.

Migrasi tidak menjalankan `ALTER TABLE` terhadap tabel legacy, tidak melakukan backfill, dan tidak mengaktifkan scheduler. SQL migrasi harus ditampilkan dan disetujui sebelum dieksekusi pada database mana pun.

Urutan aktivasi:

1. migrasi disetujui dan diterapkan;
2. sampler dapat dijalankan manual untuk validasi;
3. agregator diuji pada hari test tertutup;
4. API dan ekspor diverifikasi memakai query bersama;
5. UI diaktifkan;
6. scheduler hanya diaktifkan dengan persetujuan eksplisit terpisah.

## 14. Strategi pengujian

Semua test integrasi database memakai database test terpisah dan memiliki guard yang menolak URL produksi. Tidak ada test yang menulis ke database produksi.

Test wajib mencakup:

- run success, partial, failed, timeout, dan pencegahan overlap;
- sanitasi error termasuk object bersarang dan string bearer;
- `createMany` dengan `skipDuplicates`;
- filter p4/p24 nol, bukan angka, dan device time invalid/stale;
- parsing WIB ke UTC di sekitar pergantian hari;
- slot jadwal tanpa run sebagai `SAMPLING_FAILURE`;
- dampak run gagal terhadap coverage harian;
- perbedaan sampling failure dan inverter tidak berproduksi;
- agregasi antar-inverter dan spread lebih dari 10 ℃;
- ambang coverage harian 50% serta daftar hari dikeluarkan;
- pembobotan bulanan `sample_count`;
- pembobotan kapasitas nasional;
- null tanpa fallback Open-Meteo;
- method version aktif dan override eksplisit;
- filter DC/tahun mengubah seluruh KPI, grafik, korelasi, dan ekspor secara konsisten;
- korelasi `n < 6`, p-value, dan bulan parsial;
- stale-run UI lebih dari 30 menit;
- autentikasi dan audit ekspor;
- Excel dan ZIP CSV identik dengan dataset dashboard;
- label UI dan empty state;
- migrasi hanya membuat objek baru.

Suite akhir menjalankan `npm test` dan test baru secara eksplisit. Hasil dilaporkan apa adanya.

## 15. Kriteria penerimaan

Fitur diterima bila:

1. setiap suhu inverter yang ditampilkan dapat ditelusuri ke sampel, run, dan versi metode;
2. tidak ada Open-Meteo yang menyamar sebagai suhu inverter;
3. sampling failure menurunkan coverage meskipun tidak memiliki baris run;
4. data nol, stale, dan nonproduksi tidak masuk rata-rata;
5. dashboard dan ekspor identik untuk filter yang sama;
6. versi metode tidak tercampur;
7. UI jujur untuk periode sebelum sampling dan coverage rendah;
8. error dan log tidak membocorkan rahasia;
9. migrasi tidak menyentuh tabel legacy;
10. scheduler belum diaktifkan tanpa persetujuan eksplisit.

## 16. Keputusan dan konsekuensi

- Detail chunk memakai JSON dalam baris run: implementasi lebih sederhana, dengan konsekuensi query lintas-chunk tidak dioptimalkan.
- Bulanan berbobot `sample_count`: lebih mewakili paparan terukur, dengan konsekuensi hari dengan lebih banyak sampel memiliki bobot lebih besar.
- Ambang harian awal 50%: memungkinkan data forward-only tetap berguna sambil menandai kekurangan; ambang merupakan bagian versi metode dan perubahan memerlukan versi baru.
- Raw sample tidak dihapus otomatis: auditabilitas maksimal dengan konsekuensi pertumbuhan storage yang harus dipantau.
- Scheduler tetap nonaktif sampai persetujuan terpisah: data baru hanya bertambah lewat run manual selama validasi.
