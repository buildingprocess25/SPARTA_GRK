# Desain Arsitektur Suhu Inverter iSolarCloud

Tanggal: 2026-10-06
Status: Revisi 1 — menunggu tinjauan
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

Semua observasi perangkat yang berhasil diterima disimpan sebagai data mentah, termasuk nilai nol, nilai di luar batas, dan waktu stale. Validitas tidak ditentukan saat penyimpanan; agregator menerapkan aturan `method_version` dan menulis alasan pada `quality_flags`.

Untuk metode awal `isolar-inverter-temp-v1`, observasi valid untuk agregasi bila seluruh syarat berikut terpenuhi:

1. `p4` numerik, lebih besar dari 0 ℃, dan tidak lebih dari 100 ℃;
2. `p24` numerik dan sekurangnya 10% dari kapasitas nominal inverter;
3. `device_time` dapat diurai sebagai waktu WIB;
4. selisih absolut `device_time` terhadap `fetched_at` tidak lebih dari 15 menit.

`device_time` diurai sebagai UTC+7 tanpa mengikuti zona waktu mesin, lalu dikonversi dan disimpan sebagai UTC. Nilai mentah nol tetap tersimpan tetapi menjadi `null` pada hasil agregasi. Sampel dengan waktu terpaut lebih dari 15 menit diberi alasan `STALE_DEVICE_TIME` dan tidak masuk agregat.

Kapasitas nominal inverter harus berasal dari metadata vendor atau registry model/perangkat yang dapat diaudit; kapasitas plant tidak boleh dibagi rata sebagai tebakan. Perangkat tanpa kapasitas nominal terverifikasi diberi `MISSING_RATED_POWER` dan tidak masuk agregat v1 sampai registry dilengkapi. Ambang 10% tersimpan dalam konfigurasi metode, bukan hardcode di agregator.

## 3. Konfigurasi dan versi metode

Konfigurasi aktif memuat sekurangnya:

- `method_version`;
- zona waktu `Asia/Jakarta`;
- awal dan akhir jam produksi;
- interval siklus dalam menit;
- batas stale waktu perangkat 15 menit;
- ambang coverage harian 50%;
- ambang status lengkap 95%;
- ambang peringatan UI 80%;
- ambang numerik `LOW_DEVICE_COVERAGE` 80%;
- jumlah minimum slot valid harian;
- ambang bulan memadai 80% hari kalender valid;
- ambang anomali spread antar-inverter 10 ℃;
- rentang suhu valid `(0, 100]` ℃;
- daya minimum 10% kapasitas nominal inverter;
- batas keterlambatan pemetaan run ke slot;
- batas run tanpa selesai;
- versi rumus agregasi bulanan.

Nilai metode v1 ditetapkan: jam produksi 05:30–18:30 WIB, interval 5 menit (157 slot/hari inklusif), keterlambatan mulai maksimum 4 menit, timeout run 4 menit, minimum 79 slot valid/hari, stale device time 15 menit, lonjakan stale 10% observasi/hari, suhu valid `(0, 100]` ℃, daya minimum 10% rated power, `LOW_DEVICE_COVERAGE` 80%, status lengkap 95%, kelayakan harian 50%, dan kelayakan bulan 80% hari kalender. Aktivasi v1 mensyaratkan registry rated power yang bersumber resmi untuk perangkat yang hendak diagregasi.

Dashboard dan ekspor hanya membaca satu `method_version` aktif dari konfigurasi. Versi lain tidak digabung dan hanya dapat diminta melalui parameter eksplisit yang tervalidasi. Setiap run, sampel, agregat, respons API, dan ekspor membawa versi metode agar hasil dapat direproduksi.

Jadwal yang tersimpan dalam versi metode adalah sumber kebenaran penyebut coverage. Keberadaan baris run bukan penyebut. Slot terjadwal tanpa run dihitung sebagai kegagalan sampling. Nilai konkret jam produksi, interval, jumlah minimum slot valid, batas keterlambatan, timeout, dan seluruh ambang disimpan dalam artefak konfigurasi versi sehingga perubahan apa pun memerlukan `method_version` baru.

## 4. Model data baru

### 4.1 `inverter_temp_sampling_run`

Tabel operasional satu baris per siklus sampling:

| Kolom | Semantik |
|---|---|
| `id` | Identitas run |
| `started_at` | Awal run UTC |
| `finished_at` | Akhir run UTC; null saat running |
| `scheduled_slot_at` | Slot jadwal UTC yang diwakili run |
| `status` | `running`, `success`, `partial`, atau `failed` |
| `devices_expected` | Jumlah inverter yang hendak diminta |
| `expected_devices` | Snapshot JSON device SN, ps_id, dan kapasitas nominal yang menjadi penyebut run |
| `devices_ok` | Jumlah perangkat dengan respons yang dapat diproses |
| `devices_failed` | Jumlah perangkat dalam chunk gagal/tidak kembali |
| `devices_filtered` | Observasi diterima yang terindikasi invalid oleh pemeriksaan v1; tetap disimpan mentah |
| `devices_duplicate` | Sampel valid yang sudah pernah disimpan |
| `chunks_total` | Jumlah chunk yang direncanakan |
| `chunks_failed` | Jumlah chunk gagal |
| `error_summary` | Ringkasan error yang telah disanitasi |
| `chunk_details` | JSON terstruktur per chunk |
| `api_quota_used` | Delta kuota bila tersedia |
| `trigger` | `scheduler` atau `manual` |
| `method_version` | Versi metode sampling |

Indeks dibuat pada `started_at` dan `status`. Unique constraint `(scheduled_slot_at, method_version)` mencegah dua run mewakili slot yang sama. Partial unique index SQL `WHERE status = 'running'` memastikan paling banyak satu run aktif; mekanisme berbasis baris/index ini dipakai karena koneksi database berada di belakang pooler. Retensi minimum dua tahun. Tidak ada penghapusan otomatis dalam fitur ini.

`chunk_details` dipilih daripada tabel anak karena data hanya dipakai untuk audit satu run, volumenya kecil, dan tidak menjadi dimensi query analitik. Struktur setiap elemen dibatasi pada nomor chunk, jumlah device, sukses/gagal/filtered/duplicate, durasi, serta kode dan pesan error aman. Payload autentikasi dan header tidak disimpan.

### 4.2 `inverter_temp_sample`

Tabel append-only menyimpan seluruh observasi yang berhasil diterima, valid maupun invalid:

- `id`, `run_id`, `device_sn`, `ps_id`;
- `device_time` UTC bila dapat diurai, serta `device_time_raw`;
- `p4`, `p24` nullable serta `p4_raw`, `p24_raw` untuk preservasi nilai vendor;
- `quality_flags` fakta mentah terstruktur;
- `fetched_at` UTC;
- `method_version`.

`run_id` adalah foreign key ke `inverter_temp_sampling_run`. Unique constraint `(device_sn, device_time)` menjamin idempotensi lintas versi metode. Untuk waktu yang tidak dapat diurai, identitas deduplikasi deterministik dibentuk dari device SN, nilai waktu mentah, dan hash observasi vendor dalam kolom khusus agar retry tidak menggandakan baris. Penyimpanan batch menggunakan `createMany({ skipDuplicates: true })`; record lama tidak diperbarui.

Indeks dibuat pada `run_id`, `(ps_id, device_time)`, dan `(device_sn, device_time)`.

Observasi invalid tetap disimpan dengan `quality_flags`, tetapi tidak dimasukkan sebagai suhu valid oleh agregator. Observasi yang gagal diambil tidak memiliki baris. Tidak ada nilai pengganti.

`quality_flags` pada raw sample hanya merekam fakta yang tidak berubah, misalnya parse gagal, nilai nol, atau nilai mentah hilang. Flag dan keputusan yang bergantung ambang metode—termasuk stale 15 menit, rentang 100 ℃, minimum daya 10%, dan lonjakan stale—dihitung ulang oleh agregator serta disimpan pada agregat/versioned quality reasons. Raw sample tidak dimutasi saat metode berubah.

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
- `valid_slot_count`, `minimum_valid_slot_count`;
- `stale_device_time_count`, `stale_device_time_pct`;
- `fetched_at`.

Unique constraint `(ps_id, date_wib, method_version)` memungkinkan penghitungan ulang idempoten. Sampel mentah dan agregat tidak dihapus otomatis.

### 4.4 `inverter_temp_aggregation_run`

Tabel operasional mencatat setiap eksekusi agregator manual atau terjadwal: `id`, tanggal WIB sasaran, `method_version`, trigger, started/finished UTC, status, jumlah plant berhasil/gagal, ringkasan error tersanitasi, dan statistik hasil. Indeks dibuat pada waktu mulai, tanggal sasaran, dan status. Perintah manual menerima tanggal WIB dan versi metode eksplisit, menolak hari yang belum berakhir, serta tidak mengaktifkan scheduler.

## 5. Definisi slot, lifecycle run, dan pencegahan overlap

Slot adalah titik waktu jadwal tetap pada zona `Asia/Jakarta`, dimulai dari awal jam produksi dan bertambah sesuai interval siklus. Waktu pemicu scheduler dibulatkan ke slot terdekat ke bawah. Sebuah run scheduler hanya boleh dipetakan ke slot jika `started_at` tidak melewati `scheduled_slot_at + max_start_delay_minutes` dari konfigurasi metode. Run scheduler yang lebih terlambat dicatat untuk audit, tetapi tidak menutup slot yang sudah terlewat dan tidak meningkatkan coverage slot tersebut. Observasi unik yang diterima oleh run tersebut dipetakan ke `scheduled_slot_at` milik run; `device_time` digunakan untuk uji freshness, urutan, dan deduplikasi, bukan untuk memindahkan observasi ke slot run lain.

Run `trigger=manual` selalu memiliki `scheduled_slot_at=NULL`, termasuk saat dijalankan pada jam produksi. Run manual menyimpan observasi dan audit untuk validasi, tetapi seluruh observasinya dikeluarkan dari pembilang dan penyebut coverage produksi. Hanya run `trigger=scheduler` yang dapat mengisi slot coverage. Check constraint database menegakkan hubungan ini dua arah.

Sebelum memanggil vendor, sampler mencoba membuat baris `running` dengan `scheduled_slot_at`. Database menegakkan partial unique index yang hanya mengizinkan satu status `running`. Konflik unique dianggap `RUN_OVERLAP` dan pemanggil tidak mengakses vendor. Test konkurensi menjalankan dua upaya start serentak dan membuktikan tepat satu run memperoleh hak sampling.

Jika run `running` telah melewati timeout, pemanggil berikutnya menutupnya sebagai `failed`, mengisi `finished_at`, dan memberi alasan `RUN_TIMEOUT`, kemudian membuat run baru. Transisi status yang sah:

- `running → success` bila semua chunk selesai;
- `running → partial` bila sedikitnya satu chunk berhasil dan sedikitnya satu chunk gagal;
- `running → failed` bila tidak ada perangkat berhasil atau terjadi kegagalan fatal;
- `running → failed` oleh run berikutnya jika timeout.

Perangkat dalam chunk gagal dicatat sebagai gagal dan tidak diberi sampel pengganti. Filter kualitas tidak dengan sendirinya mengubah run menjadi partial; partial khusus kegagalan pengambilan chunk/perangkat. Semua observasi yang diterima tetap disimpan meskipun agregator kemudian menolaknya.

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

- **`sampling_coverage_pct`**: persentase pasangan inverter-slot yang menerima tepat satu observasi on-time dibanding seluruh pasangan inverter-slot yang diharapkan. Penyebut adalah snapshot `expected_devices` untuk plant pada setiap slot jadwal menurut `method_version`. Slot tanpa run, run failed, chunk gagal, perangkat hilang, dan observasi duplikat tetap berada dalam penyebut tetapi tidak menambah pembilang.
- **`production_coverage_pct`**: persentase observasi unik yang lolos semua filter suhu, daya, kapasitas, dan waktu dibanding observasi unik yang berhasil diterima untuk pasangan inverter-slot tercakup. Nilai rendah dapat berarti inverter tidak berproduksi atau data tidak valid, bukan selalu kegagalan API.
- **`coverage_pct`**: coverage resmi untuk kelayakan agregat, sama dengan `sampling_coverage_pct`. Pemisahan metrik produksi mencegah downtime sampling disamarkan sebagai inverter tidak berproduksi.

Sebuah pasangan inverter-slot dianggap tercakup hanya bila ada observasi unik dengan waktu yang memetakan ke slot itu, diterima dalam batas keterlambatan, dan device SN termasuk snapshot `expected_devices`. Pengulangan `device_time` yang sudah ada tidak dihitung sebagai cakupan baru. Snapshot perangkat harian dibekukan dari `expected_devices` run pertama yang berhasil membuat inventory pada hari tersebut; bila belum ada run, digunakan snapshot terakhir sebelum hari itu. Perubahan inventory di tengah hari dicatat tetapi baru efektif sebagai penyebut pada hari WIB berikutnya. `inverters_registered` berasal dari snapshot harian beku ini, bukan jumlah device live saat agregator dijalankan. `quality_reasons` membedakan:

- `SAMPLING_FAILURE` untuk slot tanpa run, run failed, atau chunk gagal;
- `INVERTER_NOT_PRODUCING` untuk `p24 <= 0`;
- `INVALID_TEMPERATURE` untuk `p4 <= 0`, `p4 > 100`, atau bukan angka pada metode v1;
- `STALE_DEVICE_TIME` untuk selisih waktu di atas 15 menit;
- `MISSING_RATED_POWER` bila kapasitas nominal inverter belum terverifikasi;
- `LOW_DEVICE_COVERAGE` untuk inverter tercakup yang tidak memenuhi ambang;
- `INVERTER_SPREAD_GT_10C` untuk spread suhu valid lebih dari 10 ℃.

Ambang `LOW_DEVICE_COVERAGE` v1 adalah coverage perangkat di bawah 80% dari pasangan inverter-slot yang diharapkan untuk plant/hari. Status kualitas harian:

- `lengkap` bila `coverage_pct >= 95%` dan ada sampel valid;
- `sebagian` bila `50% <= coverage_pct < 95%` dan jumlah slot valid memenuhi minimum konfigurasi;
- `tidak lengkap` bila `coverage_pct < 50%`, jumlah slot valid di bawah minimum, atau tanpa sampel valid.

Peringatan UI memakai ambang tersendiri 80%: hari/bulan dapat berstatus `sebagian` tetapi baru menampilkan peringatan coverage saat di bawah 80%. Adanya sampling failure selalu masuk `quality_reasons`, tetapi tidak otomatis menurunkan status menjadi `tidak lengkap` jika coverage keseluruhan masih memenuhi ambang. Nilai agregat yang tersedia tetap apa adanya; tidak diganti Open-Meteo atau nol.

### 7.2 Suhu dan anomali

Untuk setiap slot, suhu plant adalah rata-rata sederhana antar-inverter dengan sampel valid. Slot valid adalah slot dengan sedikitnya satu sampel valid dan coverage perangkat slot memenuhi minimum konfigurasi. Rata-rata harian dihitung dari suhu plant per slot sehingga plant dengan banyak inverter tidak mendapat bobot berlebih. `max_temp_c` adalah maksimum sampel valid hari tersebut. Hari hanya layak masuk agregat lanjutan bila `coverage_pct >= 50%` dan `valid_slot_count >= minimum_valid_slot_count`.

Spread dihitung antar-inverter valid pada slot yang sama. Hari diberi `has_spread_anomaly=true` jika ada spread lebih dari 10 ℃; nilai spread maksimum disimpan.

Agregator menghitung rasio `STALE_DEVICE_TIME` per run, plant, dan hari. Lonjakan melewati ambang metode menghasilkan quality reason dan alert operasional `STALE_DEVICE_TIME_SPIKE`; alert tidak mengubah nilai mentah.

Test pergantian hari mencakup sampel sebelum dan sesudah 00:00 WIB serta pembuktian bahwa penyimpanan UTC tetap masuk ke `date_wib` yang benar.

## 8. Agregasi bulanan dan nasional

Hari dengan `coverage_pct >= 50`, `valid_slot_count` yang memenuhi minimum konfigurasi, dan sedikitnya satu sampel valid dapat masuk agregat bulanan. Hari lain tidak dihapus: tanggal dan alasan eksklusinya ditampilkan pada metadata respons dan catatan kualitas ekspor.

Suhu bulanan plant dihitung sebagai rata-rata berbobot jumlah slot valid atas hari yang disertakan:

`monthly_avg = Σ(daily_avg_temp × daily_valid_slot_count) / Σ(daily_valid_slot_count)`

Bobot slot valid mencegah plant dengan banyak inverter mendapat bobot berlebih sekaligus memberi bobot lebih besar pada hari yang lebih lengkap. Metadata API dan ekspor menyebut rumus, ambang harian 50%, minimum slot, jumlah hari disertakan, dan daftar hari dikeluarkan.

Untuk DC yang terdiri dari beberapa plant fisik, suhu DC adalah rata-rata suhu bulanan plant berbobot kapasitas kWp terverifikasi. Nilai nasional adalah rata-rata nilai DC berbobot kapasitas kWp, hanya untuk DC dengan data suhu valid pada periode tersebut. Cakupan nasional menyebut jumlah DC/plant yang berkontribusi dan tidak menyembunyikan DC tanpa data.

Coverage bulanan memadai berarti sekurangnya 80% hari kalender pada bulan tersebut merupakan hari valid menurut aturan di atas. Bulan dengan coverage hari di bawah 80% tidak masuk KPI/korelasi, tetapi tetap tampil dengan status kualitas dan alasan. Bulan berjalan, bulan sebelum sampling dimulai, serta bulan ketika tanggal mulai forward-only jatuh setelah hari pertama selalu ditandai parsial dan dikeluarkan dari KPI/korelasi.

## 9. Query bersama untuk dashboard dan ekspor

Satu service query kanonik menerima `scope`, `targetId`, `year`, `parameter`, dan `methodVersion`. Service ini menghasilkan:

- seri bulanan PR dan suhu inverter;
- seri suhu udara Open-Meteo yang terpisah;
- coverage dan catatan kualitas;
- jumlah plant dan inverter;
- daftar hari yang dikeluarkan;
- metadata metode;
- waktu run sukses terakhir dan status stale.
- rasio stale serta alert `STALE_DEVICE_TIME_SPIKE`;
- kelayakan bulan berdasarkan 80% hari kalender valid.

Endpoint dashboard dan endpoint ekspor hanya melakukan validasi, autentikasi/otorisasi, lalu memformat hasil service yang sama. Tidak ada perhitungan ulang khusus ekspor. Agregator juga menyediakan perintah manual terautentikasi/CLI yang aman dan menulis `inverter_temp_aggregation_run` untuk setiap usaha.

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
- alert operasional bila rasio `STALE_DEVICE_TIME` melewati ambang metode;
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
3. **Catatan kualitas**: hari/DC dengan coverage rendah, sampling failure, waktu stale, tidak berproduksi, anomali spread, atau hari/bulan yang dikeluarkan.

Ekspor CSV berupa ZIP berisi `data.csv`, `metadata.csv`, dan `catatan-kualitas.csv`. Semua CSV memakai UTF-8 dengan BOM, pemisah koma, quoting RFC 4180, dan line ending CRLF. Nilai string yang setelah whitespace awal dimulai dengan `=`, `+`, `-`, atau `@` di-escape dengan awalan apostrof untuk mencegah formula injection; aturan yang sama diterapkan pada cell string Excel.

Sheet Metadata menjelaskan sumber, rumus slot/harian/bulanan/nasional, ketiga definisi coverage, ambang kualitas, hari dikeluarkan, versi metode, serta keterbatasan bahwa suhu internal inverter dipengaruhi model, beban, ventilasi, pemasangan, dan strategi kontrol sehingga perbandingan absolut antar-DC tidak sepenuhnya setara.

Endpoint ekspor wajib terautentikasi dan mengotorisasi akses terhadap scope yang diminta. Setiap unduhan dicatat dalam tabel audit baru yang additive, sekurangnya memuat pengguna, format, filter, versi metode, waktu UTC, serta status. Log tidak memuat token atau data autentikasi.

Test membandingkan dataset terstruktur hasil service query dengan isi workbook/ZIP setelah diparsing, bukan hanya membandingkan teks tampilan.

## 13. Migrasi dan peluncuran

Migrasi membuat tabel berikut:

1. `inverter_temp_sampling_run`;
2. `inverter_temp_sample`;
3. `inverter_temp_daily`;
4. `inverter_temp_aggregation_run`;
5. tabel audit unduhan ekspor suhu/PR.

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
- konkurensi dua start run dengan partial unique index: hanya satu menjadi `running`;
- sanitasi error termasuk object bersarang dan string bearer;
- `createMany` dengan `skipDuplicates`;
- penyimpanan seluruh observasi mentah termasuk p4/p24 nol, bukan angka, dan device time invalid/stale;
- unique sampel `(device_sn, device_time)` lintas versi metode dan deduplikasi waktu invalid;
- evaluasi quality flags oleh agregator per versi, bukan keputusan permanen saat ingest;
- parsing WIB ke UTC di sekitar pergantian hari;
- definisi slot, pembulatan waktu, keterlambatan maksimum, dan pemetaan run ke slot;
- slot jadwal tanpa run sebagai `SAMPLING_FAILURE`;
- dampak run gagal terhadap coverage harian;
- coverage per pasangan inverter-slot, duplikat tidak menambah coverage, dan snapshot `expected_devices`;
- perbedaan sampling failure dan inverter tidak berproduksi;
- batas suhu `(0, 100]` ℃, minimum daya 10% rated power, dan missing rated power;
- agregasi antar-inverter dan spread lebih dari 10 ℃;
- status lengkap/sebagian/tidak lengkap, ambang warning 80%, dan `LOW_DEVICE_COVERAGE` 80%;
- ambang coverage harian 50%, minimum slot valid, dan daftar hari dikeluarkan;
- pembobotan bulanan berdasarkan slot valid;
- kelayakan bulan 80% hari kalender dan bulan awal forward-only sebagai parsial;
- pembobotan kapasitas nasional;
- null tanpa fallback Open-Meteo;
- method version aktif dan override eksplisit;
- filter DC/tahun mengubah seluruh KPI, grafik, korelasi, dan ekspor secara konsisten;
- korelasi `n < 6`, p-value, dan bulan parsial;
- stale-run UI lebih dari 30 menit;
- lonjakan rasio stale dan alert operasional;
- perintah manual serta log sukses/gagal agregator;
- autentikasi dan audit ekspor;
- Excel dan ZIP CSV identik dengan dataset dashboard;
- formula-injection escaping pada Excel dan ketiga CSV;
- Metadata memuat definisi coverage dan keterbatasan perbandingan antar-DC;
- label UI dan empty state;
- migrasi hanya membuat objek baru.

Suite akhir menjalankan `npm test` dan test baru secara eksplisit. Hasil dilaporkan apa adanya.

## 15. Kriteria penerimaan

Fitur diterima bila:

1. setiap suhu inverter yang ditampilkan dapat ditelusuri ke observasi mentah, run, slot, dan versi metode agregasi;
2. tidak ada Open-Meteo yang menyamar sebagai suhu inverter;
3. sampling failure menurunkan coverage meskipun tidak memiliki baris run;
4. data nol, stale, out-of-range, dan nonproduksi tetap tersimpan tetapi tidak masuk rata-rata;
5. dashboard dan ekspor identik untuk filter yang sama;
6. versi metode tidak tercampur;
7. UI jujur untuk periode sebelum sampling dan coverage rendah;
8. error dan log tidak membocorkan rahasia;
9. migrasi tidak menyentuh tabel legacy;
10. scheduler belum diaktifkan tanpa persetujuan eksplisit.

## 16. Keputusan dan konsekuensi

- Detail chunk memakai JSON dalam baris run: implementasi lebih sederhana, dengan konsekuensi query lintas-chunk tidak dioptimalkan.
- Bulanan berbobot jumlah slot valid: merepresentasikan paparan waktu tanpa memberi bobot berlebih kepada plant yang memiliki lebih banyak inverter.
- Ambang harian awal 50%: memungkinkan data forward-only tetap berguna sambil menandai kekurangan; ambang merupakan bagian versi metode dan perubahan memerlukan versi baru.
- Bulan memadai memerlukan 80% hari kalender valid; konsekuensinya bulan awal forward-only dan bulan dengan banyak hari gagal tidak ikut KPI/korelasi.
- Raw sample tidak dihapus otomatis: auditabilitas maksimal dengan konsekuensi pertumbuhan storage yang harus dipantau.
- Scheduler tetap nonaktif sampai persetujuan terpisah: data baru hanya bertambah lewat run manual selama validasi.
