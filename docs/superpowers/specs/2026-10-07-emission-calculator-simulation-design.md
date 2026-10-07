# Desain Kalkulator Emisi GRK — Simulasi Murni

Tanggal: 7 Oktober 2026  
Status: menunggu tinjauan pengguna

## Tujuan

Menambahkan halaman **Kalkulator Emisi (GRK)** pada grup sidebar **INPUT & AUDIT**. Halaman ini menjadi ruang simulasi mandiri untuk menghitung sumber penambah emisi, sumber pengurangan emisi, dan emisi bersih. Kalkulator tidak membaca atau menulis angka dashboard utama, tidak menyimpan record audit, dan tidak mengubah database.

## Batas Lingkup

### Termasuk

- Menu baru pada sidebar dan render tab baru pada halaman utama.
- Beranda kalkulator berisi kartu sumber penambah dan pengurangan emisi.
- Formulir multi-entri untuk setiap kategori.
- Engine kalkulasi pure function dengan satuan internal kgCO2e.
- Rekapitulasi live, rincian per kategori, dan komposisi hasil.
- Registry faktor read-only dalam artefak konfigurasi lokal, dengan nilai, satuan, sumber, tahun, versi, dan status verifikasi.
- Format angka Indonesia dengan pembulatan dua desimal hanya pada presentasi.
- State loading, empty, validasi inline, konfirmasi hapus/reset, dan aksesibilitas keyboard.
- Unit test engine dan test kontrak navigasi/UI.

### Tidak termasuk

- Migrasi atau perubahan skema Prisma.
- API penulisan, penyimpanan database, atau integrasi Riwayat Audit.
- Perubahan angka atau data pada Resume Emisi GRK, Scope 1, Scope 2, PLTS Atap, Water Recycle, Audit, dan Riwayat Audit.
- Prefill dari data DC.
- Autosave ke server atau localStorage.
- Tombol Simpan ke Riwayat Audit.
- Ekspor PDF/Excel pada versi awal.
- Perubahan faktor resmi yang sudah digunakan halaman lain.

State kalkulator hanya berada di memori React dan hilang ketika halaman dimuat ulang. Hal ini disengaja agar versi pertama benar-benar tidak memiliki efek samping terhadap data.

## Navigasi dan Struktur Halaman

Sidebar memperoleh satu item baru pada grup **INPUT & AUDIT**:

- `calculator`: Kalkulator Emisi (GRK)

`src/app/page.js` merender komponen kalkulator hanya ketika tab tersebut aktif. Mekanisme tab yang sudah ada dipertahankan; routing dan halaman lain tidak diubah.

Halaman kalkulator memiliki empat mode internal:

1. **Beranda** — kartu seluruh kategori.
2. **Form kategori** — formulir, daftar entri, subtotal, dan navigasi kembali.
3. **Rekapitulasi** — total, komposisi, persentase, dan rincian yang dapat diperluas.
4. **Faktor Emisi** — daftar faktor read-only yang dapat dicari.

## Kategori

### Sumber Penambah Emisi

1. Scope 1A — Mesin Bakar Statis.
2. Scope 1B — Mesin Bakar Bergerak: Pemakaian BBM dan Jarak Tempuh.
3. Scope 2 — Listrik PLN.
4. Scope 3 — Perjalanan Dinas: Pesawat, Hotel, dan Kereta Api.
5. Scope 3 — Emisi yang Dibiayai, ditandai opsional.

### Sumber Pengurangan Emisi

1. Carbon Offset.
2. Pemanfaatan Kendaraan Listrik.
3. Pemanfaatan Energi Baru dan Terbarukan.
4. Kredit Kendaraan Bermotor Listrik.
5. Surat Berharga Hijau.

Setiap kartu menampilkan ikon, nama, deskripsi singkat, status `Belum dimulai` atau `N entri`, dan tombol `Mulai` atau `Edit`.

## Arsitektur Komponen

- `EmissionCalculatorPage`: pemilik state sesi dan navigasi internal.
- `CalculatorHome`: kelompok kartu penambah dan pengurangan.
- `CalculatorCategoryCard`: presentasi status kategori.
- `CalculatorEntryForm`: memilih form berdasarkan kategori dan mode.
- `CalculatorEntryList`: edit/hapus entri dan subtotal.
- `CalculatorLiveSummary`: panel sticky berisi total penambah, pengurangan, dan bersih.
- `CalculatorRecap`: KPI, ringkasan periode, progress bar, dan rincian kategori.
- `EmissionFactorsReference`: tabel faktor read-only dan pencarian.
- `SearchableSelect`: dropdown jenis aktivitas yang dapat dicari.

Form kategori dapat dipecah lagi bila kompleksitas JSX menuntut, tetapi setiap form mengembalikan objek input standar kepada engine dan tidak menghitung emisi sendiri.

## Model State Sesi

```text
profile:
  organizationName
  unitName?
  periodStart
  periodEnd

entries[]:
  id
  category
  mode?
  label
  activityData
  factorCode
  factorSnapshot
  result
  createdAt
```

`factorSnapshot` berada dalam state entri agar perubahan pilihan faktor selama sesi tidak mengubah entri lama secara diam-diam. Tidak ada state ini yang dikirim ke server.

## Registry Faktor Read-only

Registry lokal menyediakan struktur seragam:

```text
code, category, label, value, unit, source, year, version,
status, locationOrGrid?, gasFactors?, conversions?, defaults?
```

Nilai seed `2,31 kgCO2e/L` dan `0,87 kgCO2e/kWh` diberi status `REFERENCE_UNVERIFIED` sampai dokumen resmi diverifikasi. UI menampilkan badge sumber belum terverifikasi. Faktor yang tidak tersedia menghasilkan status `Perlu faktor` dan tidak dihitung sebagai nol.

Registry kalkulator terisolasi dari `EmissionFactorRegistry` dan konfigurasi halaman lain pada versi awal.

## Engine Kalkulasi

Engine berada dalam satu modul pure function dan tidak mengakses React, browser, database, atau jaringan.

### Aturan umum

- Nilai internal menggunakan kgCO2e.
- Semua input angka harus finite dan lebih besar atau sama dengan nol.
- Faktor wajib tersedia sebelum entri dapat ditambahkan, kecuali Surat Berharga Hijau yang boleh berstatus `Perlu faktor` tanpa masuk total.
- Pembulatan hanya dilakukan oleh formatter UI.
- Nilai pengurangan disimpan positif dan baru dikurangkan pada rekapitulasi.
- Tanggal akhir tidak boleh mendahului tanggal mulai.
- Jumlah hari periode bersifat inklusif.

### Rumus

- Dasar: `E = aktivitas × faktor emisi`.
- Faktor per gas: jumlah `aktivitas × EF_gas × GWP_gas`.
- Scope 1A: aktivitas dikonversi ke satuan faktor, lalu dikalikan faktor bahan bakar.
- Scope 1B pemakaian: liter dikalikan faktor bahan bakar.
- Scope 1B jarak: memakai faktor per km bila tersedia; jika tidak, liter = km / km-per-liter.
- Scope 2: kWh dikalikan faktor grid.
- Pesawat/kereta: penumpang × km × faktor per passenger-km.
- Hotel: kamar × malam × faktor per kamar-malam.
- Emisi dibiayai: `(outstanding / nilai perusahaan) × emisi investee`, dengan faktor atribusi antara 0 dan 1.
- Offset: nominal tahunan × proporsi hari kepemilikan yang beririsan dengan periode; tahun kabisat dihitung sesuai tahun terkait.
- EBT: kWh EBT × faktor grid.
- Kendaraan listrik: `max(0, emisi baseline BBM − emisi listrik)`.
- KKB listrik: rumus kendaraan listrik × jumlah unit.
- Surat berharga hijau: nilai kepemilikan × faktor per rupiah; tanpa faktor diberi status `Perlu faktor`.

### Rekapitulasi

- Total Penambah = seluruh hasil kategori penambah yang valid.
- Total Pengurangan = seluruh hasil kategori pengurangan yang valid.
- Emisi Bersih = Total Penambah − Total Pengurangan.
- Persentase pengurangan = Total Pengurangan / Total Penambah × 100.
- Proporsi baris = nilai absolut / (Total Penambah + Total Pengurangan) × 100.
- Pembagian dengan nol menghasilkan nilai kosong yang ditampilkan `—`, bukan NaN atau Infinity.
- Intensitas opsional = emisi bersih / jumlah hari periode.

## Desain Visual

- Mengikuti font, header, sidebar, kartu, radius, spacing, dan palet dashboard Alfamart.
- Biru untuk energi/informasi, merah-oranye untuk penambah, hijau untuk pengurangan, dan abu untuk penjelasan.
- Desktop: konten/form di kiri dan ringkasan sticky di kanan.
- Tablet/mobile: ringkasan turun setelah form.
- Beranda memakai kartu besar seperti alur referensi, tetapi bukan tema hijau penuh.
- Status tidak bergantung pada warna: label, tanda `+`/`−`, ikon, dan teks selalu tersedia.
- Rekap menonjolkan Emisi Bersih, lalu Total Penambah dan Total Pengurangan.
- Angka besar menampilkan kgCO2e dan padanan tCO2e.

## Error dan Empty State

- Field wajib menampilkan pesan tepat di bawah input.
- Entri tidak dapat ditambahkan bila angka tidak valid atau faktor hilang.
- Penghapusan entri dan reset seluruh kalkulator meminta konfirmasi.
- Daftar kosong menjelaskan bahwa belum ada aktivitas.
- Faktor yang belum tersedia tidak menghasilkan angka nol palsu.
- Kesalahan komponen tidak boleh memengaruhi halaman dashboard lain.

## Strategi Pengujian

### Unit engine

Toleransi numerik `0,005` untuk seluruh contoh wajib:

- RON90 5 L × 2,31 = 11,55 kgCO2e.
- RON98 20 L × 2,31 = 46,20 kgCO2e.
- Listrik Jamali 250.000 kWh × 0,87 = 217.500,00 kgCO2e.
- Offset penuh = 2.000,00 kgCO2e.
- Kendaraan listrik = 6,09 kgCO2e.
- PLTS 2.500 kWh × 0,87 = 2.175,00 kgCO2e.
- Total Penambah = 217.557,75 kgCO2e.
- Total Pengurangan = 4.181,09 kgCO2e.
- Emisi Bersih = 213.376,66 kgCO2e.
- Scope 2 share = 98,1%; Offset = 0,9%; EBT = 1,0%.

Tambahan test mencakup tanggal inklusif, tahun kabisat, irisan tanggal offset, PCAF 0–1, pembagian nol, faktor hilang, nilai negatif, nilai non-finite, snapshot faktor, dan pembulatan hanya pada formatter.

### UI dan integrasi lokal

- Menu kalkulator membuka tab baru tanpa mengubah tab lain.
- Menambah, mengedit, dan menghapus entri memperbarui subtotal dan ringkasan live.
- Reset meminta konfirmasi dan membersihkan hanya state kalkulator.
- Refresh tidak menulis atau memulihkan data.
- Halaman Faktor Emisi read-only dan dapat dicari.
- Tidak ada request mutasi jaringan dari kalkulator.

## File yang Direncanakan

### Diubah

- `src/components/Sidebar.jsx`: satu item navigasi baru.
- `src/app/page.js`: satu import dan satu cabang render tab kalkulator.

### Ditambahkan

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
- unit test engine dan test kontrak UI/navigasi.

Tidak ada file Prisma, API, komponen halaman lain, atau konfigurasi faktor halaman lain yang diubah.

## Kriteria Selesai

- Kalkulator dapat menyelesaikan seluruh kategori dan rekap dalam satu sesi browser.
- Semua test case wajib lulus dalam toleransi yang ditetapkan.
- Tidak ada database write, API mutation, migrasi, atau perubahan angka dashboard.
- Faktor yang belum terverifikasi diberi label jelas.
- Tampilan konsisten dengan dashboard Alfamart dan tetap usable pada desktop, tablet, dan mobile.
