# SPARTA GRK

**Sustainability Performance And Reporting Tracking Application**
Greenhouse Gas (GRK) Monitoring Dashboard for PT Sumber Alfaria Trijaya Tbk (Alfamart)

---

## Tentang Proyek Ini

SPARTA GRK adalah dashboard monitoring keberlanjutan (sustainability) untuk Alfamart yang menghitung dan melacak emisi gas rumah kaca (GRK) dari seluruh operasional Distribution Center (DC) Alfamart di Indonesia. Aplikasi ini mengintegrasikan data telemetri PLTS atap secara real-time dari **37 DC** (36 beroperasi; DC Gorontalo belum memiliki PLTS), menghitung emisi Scope 1, 2, dan 3, serta memantau program daur ulang air.

> **Jumlah DC selalu 37.** Akun iSolarCloud memuat 39 plant karena ikut berisi 2 toko percontohan Drive Thru (De Mansion dan Gading Serpong). Keduanya bukan DC, ditandai `facilityType: 'STORE'`, dan dikeluarkan dari semua hitungan, total, dan peringkat oleh `isDcLocation()`.

Seluruh perhitungan emisi mengacu pada regulasi resmi Indonesia: SK Dirjen Ketenagalistrikan Kementerian ESDM dan Pedoman Inventarisasi GRK Nasional, serta standar internasional IPCC 2006 dan GHG Protocol.

---

---

## Bahasa Pemrograman dan Bahasa Kueri yang Digunakan

Proyek ini dibangun menggunakan kombinasi beberapa bahasa pemrograman, bahasa kueri, dan markup sesuai dengan kebutuhan arsitektur dan fungsionalitasnya:

| Bahasa | Ekstensi Berkas | Area Penggunaan & Peran |
|:--|:--|:--|
| **TypeScript** | `.ts`, `.tsx` | **Bahasa utama aplikasi** (`src/`). Digunakan untuk frontend React 19, backend API Routes Next.js 15, modul kalkulasi emisi (`lib/carbon/`, `lib/calculator/`), service PLTS (`lib/solar/`), dan definisi tipe data (`types/`). Seluruh kode ditulis dengan strict mode dan menjaga sintaks tetap *erasable* agar kompatibel dengan Node.js type stripping. |
| **JavaScript (ESM)** | `.mjs`, `.js`, `.jsx` | **Otomatisasi, daemon, dan pengujian** (`scripts/`). Seluruh daemon background (`solar-daemon.mjs`), sinkronisasi vendor (`sync-isolar.mjs`), test runner (`scripts/tests/`), serta diagnostik audit database (`scripts/audits/`) berjalan di atas Node.js 22 LTS menggunakan native ES Modules. |
| **Prisma Schema & SQL** | `.prisma`, raw SQL | **Pemodelan dan manipulasi basis data** (`prisma/`). `schema.prisma` mendefinisikan 20+ entitas data relasional, indeks komposit, relasi foreign key, dan enum status. Kueri dijalankan melalui Prisma ORM dan PostgreSQL 15+ untuk transaksi performa tinggi. |
| **CSS (Tailwind CSS v4)** | `.css` | **Styling dan desain visual** (`src/app/globals.css`). Menggunakan Tailwind CSS v4 dengan CSS variables untuk kontrol tema, visualisasi grafik, palet indikator status operasional PLTS, dan layout responsif. |
| **HTML / JSX** | `.tsx`, `.jsx` | **Struktur antarmuka pengguna**. Komponen antarmuka pengguna semantik berbasis HTML5 dan JSX untuk dashboard, tabel analitik matriks, formulir kalkulator emisi, dan dialog modal. |
| **Shell / Bash** | CLI / `.sh` | **Automasi deployment dan proses sistem**. Konfigurasi service manager systemd pada server produksi, deployment kontainer Docker via Dokploy, dan pipeline script pnpm. |
| **JSON & YAML** | `.json`, `.yml`, `.yaml` | **Konfigurasi dan data pertukaran**. Konfigurasi proyek (`package.json`, `tsconfig.json`), manifest deployment Docker, dan payload pertukaran data REST API. |

---

## Tech Stack

### Frontend

| Teknologi | Versi | Fungsi |
|:--|:--|:--|
| **Next.js** | 15.3 | Framework React full-stack (App Router, API Routes, SSR) |
| **React** | 19.1 | Library UI komponen |
| **TypeScript** | 6.0 | Type safety untuk seluruh kode di `src/` |
| **Tailwind CSS** | 4.3 | Utility-first styling |
| **Recharts** | 3.10 | Grafik dan visualisasi data energi, emisi, dan performa |
| **Lucide React** | 0.460 | Icon set |
| **shadcn/ui** | 4.21 | Component library |

### Backend

| Teknologi | Versi | Fungsi |
|:--|:--|:--|
| **Next.js API Routes** | 15.3 | 20+ endpoint REST (auth, sync, import, emissions, PLTS, water, dll.) |
| **Prisma ORM** | 5.22 | ORM untuk PostgreSQL, migrasi schema, query builder |
| **PostgreSQL** | 15+ | Database relasional utama (847 baris schema, 20+ model) |
| **Node.js** | 22 LTS | Runtime server dan script tooling |

### Integrasi Eksternal

| Layanan | Fungsi |
|:--|:--|
| **Sungrow iSolarCloud OpenAPI** | Telemetri real-time PLTS 37 DC: daya, energi, status, alarm, inverter, energi bulanan, dan PR bulanan resmi |
| **Open-Meteo API** | Data cuaca historis dan forecast (GHI, suhu, kelembapan) untuk perhitungan Performance Ratio |
| **Web Push (VAPID)** | Notifikasi browser saat fault atau alarm terdeteksi pada PLTS |

### DevOps dan Tooling

| Teknologi | Fungsi |
|:--|:--|
| **Docker** | Multi-stage build, deployment ke Dokploy |
| **Nginx** | Reverse proxy dengan SSL/TLS termination |
| **systemd** | Process manager untuk daemon sinkronisasi |
| **pnpm** | Package manager |
| **ESLint** | Linter dengan konfigurasi Next.js |
| **ExcelJS / XLSX** | Parsing file CSV dan Excel untuk import data |
| **Puppeteer** | Screenshot dan reporting otomatis |

### Script dan Automation

| Script | Fungsi |
|:--|:--|
| `solar-daemon.mjs` | Daemon polling telemetri PLTS setiap 5 menit (05:30-18:30 WIB) |
| `sync-isolar.mjs` | Sinkronisasi data iSolarCloud ke database |
| `scripts/data/` | Import histori bulanan, backfill energy flow, import target RKAP |
| `scripts/tests/` | 40+ test script: unit, integrasi, stabilisasi |
| `scripts/audits/` | Audit dan inspeksi data, diagnostik discrepancy |

---

## Arsitektur Aplikasi

```
┌──────────────────────────────────────────────────────┐
│  Browser (React 19 + Next.js 15 App Router)          │
│  ┌──────────┬───────────┬───────────┬──────────────┐ │
│  │ Ringkasan│ Sumber    │ Pengurang │ Riwayat      │ │
│  │ Emisi    │ Emisi     │ Emisi     │ Audit        │ │
│  │          │ Scope 1-3 │ PLTS+Air  │              │ │
│  └──────────┴───────────┴───────────┴──────────────┘ │
└──────────────────┬───────────────────────────────────┘
                   │ fetch / API
┌──────────────────▼───────────────────────────────────┐
│  Next.js API Routes (20+ endpoint)                   │
│  /api/plts, /api/emissions, /api/scope1-3,           │
│  /api/sustainability, /api/water-recycle, /api/auth   │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│  Business Logic Layer                                │
│  ┌────────────┬──────────────┬──────────────────┐    │
│  │carbonEngine│ solar/sync   │ scope3/          │    │
│  │ Scope 1-2  │ performanceR │ travelLedger     │    │
│  │ calculation│ openMeteo    │ travelImport     │    │
│  │            │ snapshot     │ airports         │    │
│  │            │ status       │                  │    │
│  └────────────┴──────────────┴──────────────────┘    │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│  PostgreSQL (Prisma ORM)                             │
│  plant_latest, daily_yield, monthly_yield,           │
│  energy_flow_monthly, climate_monthly,               │
│  scope3_travel_entry, water_recycle_entry,            │
│  sync_run, alarm_event, push_subscription, ...       │
└──────────────────────────────────────────────────────┘
         ▲                              ▲
         │ polling 5 min                │ historical
┌────────┴────────┐            ┌────────┴────────┐
│ iSolarCloud API │            │ Open-Meteo API  │
│ (Sungrow)       │            │ (cuaca/GHI)     │
└─────────────────┘            └─────────────────┘
```

---

## Fitur Utama

### 1. Ringkasan Emisi (Dashboard)

Halaman utama yang menampilkan total emisi GRK Alfamart secara year-to-date:

- **Neraca karbon**: total emisi (Scope 1 + 2 + 3) dikurangi pengurangan emisi (PLTS + daur ulang air)
- **Breakdown per scope** dengan grafik tren bulanan
- **Kalkulator emisi interaktif**: simulasi emisi dari berbagai sumber (BBM, listrik, penerbangan, kendaraan, refrigeran, LPG, dll.) dengan 60+ faktor emisi dari IPCC dan ESDM
- **Saran pengurangan emisi** berdasarkan hasil kalkulasi

### 2. Sumber Emisi (Scope 1, 2, 3)

#### Scope 1: Emisi Langsung (BBM)
- Input konsumsi bahan bakar per DC: Solar/Biosolar, Pertalite, Pertamax
- Faktor emisi dari Pedoman Inventarisasi GRK ESDM:
  - Solar: 2,6685 kgCO2e/liter
  - Pertalite: 2,2951 kgCO2e/liter
  - Pertamax: 2,2868 kgCO2e/liter
- Validasi silang dengan workbook acuan `perhitungan emisi karbon.xlsx`
- **Genset dari jurnal BBM genset** (akun 612304 / 622304): `node --env-file=.env scripts/data/import-genset-fuel-journal.mjs "<file>.csv" [--apply]`. Jurnal hanya memuat Rupiah, jadi liter = Rp ÷ harga per liter: Solar Rp 15.000 (harga industri), Pertamax Rp 12.500, Pertalite/bensin Rp 10.000. Jenis BBM dibaca dari keterangan; Dex, Dexlite, dan Biosolar dihitung Solar, dan baris "BBM UNTUK GENSET" yang tidak menyebut jenis (kas kecil toko) juga dihitung Solar. Baris oli, aki, coolant, filter, dan suku cadang tidak dihitung emisinya. Data disimpan satu baris per KUU, bulan, dan jenis BBM (`source = JURNAL_BBM_GENSET`, `dcId` = kode KUU). Import dengan `--apply` mengganti semua data genset sebelumnya, termasuk input manual
- **Kendaraan dari rekap biaya kendaraan**: `scripts/data/import-vehicle-fuel-costs.mjs` (liter dan Rupiah per KUU per bulan, `source = CSV_BIAYA_KENDARAAN`)
- Data 2026 terisi Januari-September dari jurnal genset dan rekap kendaraan

#### Scope 2: Emisi Tidak Langsung (Listrik Grid PLN)
- 8 grid regional dengan faktor emisi resmi (SK Dirjen Ketenagalistrikan ESDM):
  - JAMALI: 0,870 kgCO2e/kWh
  - Sumatera: 0,761 kgCO2e/kWh
  - Kalbar, Kalselteng, Sulselrabar, Batam, Lombok, Sulutgo
- Rekonsiliasi data pemakaian listrik PLN terhadap tarif per golongan
- Analitik dan visualisasi beban tahunan per DC

#### Scope 3: Emisi Tidak Langsung Lainnya (Perjalanan Dinas, Kategori 6)
- **Empat jenis biaya**: Pesawat, Hotel, Kereta Api, dan Lainnya (uang saku, transport lokal)
- **Faktor emisi** mengikuti Buku Panduan Kalkulator Hijau Bank Indonesia 2026, Bab 5 (`Buku-Panduan-Hijau-2026-Update.pdf`)
- **Pesawat**: rute dibaca dari kode bandara IATA; jarak great-circle per segmen × faktor per penumpang-km. Domestik per kelompok jarak segmen (Tabel 10): ekonomi 0,120 (<926 km), 0,089 (926-1.852 km), 0,078 (>1.852 km); bisnis 0,216 / 0,160 / 0,140. Internasional DEFRA 2025 (Tabel 11): ekonomi 0,06449, ekonomi premium 0,10318, bisnis 0,18701, first 0,25794. Domestik ekonomi premium dihitung ekonomi dan first dihitung bisnis karena BI hanya punya dua kelas domestik
- **Hotel**: jumlah malam × jumlah kamar × faktor per kamar-malam menurut negara hotel (Tabel 15): Indonesia 49,37 (median 39 hotel mid-scale, BI), 37 negara lain dari DEFRA 2025. Negara kosong = Indonesia; kolom KELAS bintang dari template lama diabaikan
- **Kereta Api**: total jarak km × faktor per penumpang-km menurut kelas KAI 2025 (Tabel 13): Ekonomi 0,01219, Bisnis 0,01308, Eksekutif 0,01750, Panoramic 0,02469, Luxury 0,02804, Priority 0,03044, Compartment 0,04390. Kelas kosong = Ekonomi
- **Hitung ulang setelah faktor berubah**: `node --env-file=.env scripts/data/recalc-business-travel-emissions.mjs [--apply]` menghitung ulang semua baris tersimpan (biaya dan tanggal tidak berubah). Dengan faktor BI 2026, emisi pesawat Jan-Sep 2026 turun dari 633,4 menjadi 391,1 tCO2e
- **Input manual** lewat modal, atau **template Excel** satu file dengan sheet terpisah per jenis (Pesawat, Hotel, Kereta Api, Lainnya), lengkap dengan dropdown KELAS dan validasi angka. CSV satu tabel dengan kolom JENIS dan template versi lama tetap diterima
- **Import jurnal BPDL** (akun 611402 / 621402): baris yang menyebut hotel atau kereta diklasifikasikan ke jenisnya; uang saku BPDL tetap Lainnya. Untuk hotel, jumlah malam dibaca dari tanggal menginap di keterangan (`TGL 07/07/26 - 09/07/26`, `07-10/10/26`, `12-13 MEI 26`), satu baris = satu kamar, dan negara dari nama tempat (Jepang, Panglao/Manila/Davao, Vietnam, dll.; tanpa nama tempat = Indonesia; Bangladesh tidak ada di tabel BI sehingga tanpa emisi) lewat `hotelStayFromDescription`. Baris hotel tanpa tanggal menginap dan baris kereta (jurnal tidak memuat km) tetap hanya tercatat biayanya. Lewat modal atau `node --env-file=.env scripts/data/import-business-travel.mjs "<file>.csv" [--apply]`; bulan yang ada di file mengganti data bulan yang sama. Tanggal DD/MM/YYYY maupun MM/DD/YYYY diterima: urutannya ditentukan per file dari tanggal yang bagiannya lebih dari 12. Kode akun ber-nol depan (`0611402`) disamakan dengan `611402`. Kode bandara yang belum ada di `airports.ts` dilaporkan, tidak ditebak. Data 2026 terisi Januari-September
- Dashboard dengan filter jenis perjalanan, rincian per KUU dan per rute/kota, serta biaya yang dipecah per jenis
- **Grafik bulanan** punya tab Emisi dan Biaya serta filter sumber (Semua, Pesawat, Hotel, Kereta Api; Lainnya hanya di tab Biaya). Tab Emisi dengan "Semua sumber" memakai batang berdampingan per bulan (pesawat, hotel, kereta), dengan tinggi minimum 3 px untuk nilai di atas nol; sumber yang 0 sepanjang periode tidak digambar dan disebut di catatan. Tab Biaya memakai batang bertumpuk. Memilih satu sumber memberi skala sendiri. Tinggi grafik mengikuti kartu di sebelahnya. Di tab Biaya, Lainnya dipecah menjadi Uang saku & PJUM, Perjalanan luar negeri, dan Transport/klaim/dll. (gradasi abu-abu, data `monthlyTrend[].otherKinds`). Sumbu Y mulai dari 0; koreksi bernilai negatif tetap terlihat di tooltip. Bulan tanpa data impor dibiarkan kosong
- **Kartu "Emisi per sumber"** menampilkan seluruh Scope 3: Pesawat, Hotel, Kereta (emisi, porsi, jumlah tiket/malam/km, biaya) dan Lainnya (biaya, tanpa emisi, dirinci per jenis transaksi: uang saku & PJUM, luar negeri, transport, klaim, lain-lain). Di bawah Pesawat ada rincian kelompok jarak faktor BI (<926 km, 926-1.852 km, >1.852 km, internasional) yang dihitung per segmen, lengkap dengan jumlah segmen dan faktor ekonominya; filter "Kelompok jarak" di tabel tetap per tiket (rata-rata segmen)
- **Kartu "Biaya belum dihitung emisinya"** merinci dua kelompok Lainnya terbesar, sisanya digabung (termasuk tiket tanpa rute, hotel tanpa tanggal menginap, dan kereta tanpa km)
- **Rincian Lainnya**: biaya Lainnya dipecah dari keterangan jurnal saat halaman dimuat (`otherTravelKind` di `travelLedger.ts`), jadi aturan baru berlaku tanpa import ulang. Kelompoknya: Uang saku & PJUM, Perjalanan luar negeri (Bangladesh, Vietnam, Manila, dll.), Transport darat & laut (tunjangan transport, kapal, penyeberangan), Klaim kekurangan, Lewat payroll (jurnal tipe `PL` berketerangan "BPDL", nilainya Rp 0 di ekspor), dan Lain-lain. Saat filter Lainnya aktif muncul pilihan "Rincian lainnya", tampilan "Per rincian", urutan default berubah ke biaya, dan kolom Transaksi menghitung baris bernilai positif

### 3. Pengurangan Emisi: PLTS Atap

Monitoring real-time PLTS atap di 37 DC (5.778,8 kWp; 36 beroperasi, Gorontalo belum memiliki PLTS):

- **Telemetri langsung**: daya aktual (kW), energi harian (kWh), energi kumulatif (MWh)
- **Status plant**: Online/Offline, Normal/Alarm/Fault dengan push notification
- **Sinkronisasi otomatis**: polling setiap 5 menit pada jam produksi (05:30-18:30 WIB)
- **Manajemen kuota API**: guard untuk hourly (2.000), daily (48.000), dan monthly (100.000) call limit
- **Analitik performa**:
  - Specific Yield (kWh/kWp) per plant
  - Equivalent Hours dari API
  - Performance Ratio (PR) bulanan per plant langsung dari iSolarCloud (titik `p83023` mode bulanan, identik dengan Annual Report portal), dengan agregat setara cara portal; bulan dengan PR di luar 10-100% (sensor iradiasi bermasalah) tidak dihitung
  - Koreksi temperatur silikon (-0,45%/°C dari STC 25°C) menggunakan model Sandia/King
  - Analisis korelasi cuaca (GHI, suhu, kelembapan) dari Open-Meteo
- **Matriks bulanan**: tabel 37 DC x 12 bulan dengan yield, load, feed-in, dan PR
- **Target RKAP**: tracking realisasi terhadap target produksi perusahaan
- **Emisi terhindar**: energi PLTS x 0,997 kgCO2/kWh
- **Ekuivalen lingkungan**: batubara terhindar (0,4 kg/kWh), pohon setara (21,77 kgCO2/pohon/tahun)
- **Import data iSolar**: upload laporan bulanan dari portal iSolarCloud untuk validasi silang

### 4. Pengurangan Emisi: Daur Ulang Air

- Input data volume air daur ulang per DC per bulan
- Perhitungan kontribusi pengurangan beban lingkungan
- Tracking realisasi program daur ulang air

### 5. Riwayat Audit

- Riwayat file yang pernah di-upload (Scope 1, Scope 2, PLTS, air), dibaca dari database
- Bagian terpisah "Input di browser ini": catatan lokal per browser, berlabel jelas, tidak memengaruhi angka dashboard
- Seluruh angka bisnis (Scope 1/2, PLTS, air, daftar DC) selalu diambil dari server; browser tidak menyimpan salinan angka tersebut

### 6. Autentikasi dan Keamanan

- Akun disimpan di tabel `app_user` (password di-hash), session cookie bertanda tangan HMAC-SHA256
- Dua akun dari env (`AUTH_ADMIN_*`, `AUTH_VALENS_*`); Admin Super dapat menambah pengguna dengan password awal minimal 8 karakter (tombol "Buat acak" tersedia). Tidak ada password bawaan di kode; akun peran bawaan hanya dibuat bila `AUTH_DEFAULT_ACCOUNT_PASSWORD` diisi
- **Sesi berakhir otomatis setiap hari pukul 19.00 WIB** (peringatan 5 menit sebelumnya), paling lama 7 hari sejak login. Tidak ada logout karena tidak aktif
- Middleware Edge Runtime untuk route guard
- Pembatasan trafik per IP di middleware (`src/lib/server/ipGuard.ts`): halaman 600/menit, API 300/menit, route publik (`/api/health`, `/api/cron/*`, `/api/plts/revalidate`) 60/menit, login 60/menit; IP yang melewati batas 3 kali dalam 10 menit diblokir 2 menit (`429 IP_BLOCKED` + `Retry-After`), plus `RATE_LIMIT_ALLOWLIST` dan daftar blokir tetap `BLOCKED_IPS`. Login dan ganti password dikunci per akun: 5 kali gagal dalam 15 menit mengunci akun itu 2 menit, login berhasil me-reset hitungan. Proteksi DDoS sesungguhnya tetap di proxy/Cloudflare, lihat `docs/DEPLOY.md` bagian 7a
- `/api/health` tanpa login hanya memberi status singkat; detail sync hanya untuk user yang login
- CRON endpoint dilindungi bearer token terpisah (dibandingkan constant-time); `/api/plts/revalidate` menolak bila `REVALIDATE_SECRET_TOKEN`/`CRON_SECRET` kosong
- Credential API vendor (iSolarCloud, VAPID) hanya server-side

### 7. Push Notification

- Web Push via VAPID untuk alarm dan fault PLTS
- Subscription per-device tersimpan di database
- Cooldown untuk mencegah spam notifikasi

---

## Kelebihan dan Keunggulan Sistem

1. **Kepatuhan Regulasi Resmi dan Siap Audit (Audit-Ready)**
   - Perhitungan emisi tidak menggunakan estimasi kasar, melainkan terikat langsung pada regulasi resmi:
     - **Scope 1**: Pedoman Inventarisasi Gas Rumah Kaca Nasional (Kementerian ESDM).
     - **Scope 2**: SK Dirjen Ketenagalistrikan Kementerian ESDM No. 414.K/TL.04/DJL.4/2024 untuk 8 grid regional (JAMALI, Sumatera, Kalbar, Kalselteng, Sulselrabar, Batam, Lombok, Sulutgo).
     - **Scope 3**: Buku Panduan Kalkulator Hijau Bank Indonesia 2026: pesawat domestik per kelompok jarak (BI), internasional DEFRA 2025, hotel per negara, kereta per kelas KAI 2025; jarak great-circle antar bandara tanpa uplift.
   - Dilengkapi snapshot multi-sumber (`MonthlyYieldObservation`) dan riwayat import (`ImportBatch`) sehingga asal setiap angka dapat ditelusuri saat audit laporan keberlanjutan (ESG).

2. **Integrasi Telemetri PLTS Terdistribusi Real-Time**
   - Menghubungkan PLTS atap di 37 Distribution Center (DC) Alfamart dengan total kapasitas 5.778,8 kWp (36 beroperasi; Gorontalo belum memiliki PLTS).
   - Daemon sinkronisasi otomatis (`solar-daemon.mjs`) beroperasi secara terjadwal pada jam radiasi matahari (05:30 - 18:30 WIB) dengan interval 5 menit.
   - Memiliki proteksi kuota API (`QuotaCounter`) dengan pembatasan per jam, harian, dan bulanan untuk mencegah lonjakan pemanggilan API ke vendor Sungrow iSolarCloud.

3. **Perhitungan Fisika Energi dan Koreksi Temperatur Silikon**
   - Memakai PR bulanan resmi iSolarCloud bila tersedia; plant-bulan tanpa PR resmi dihitung dengan PR = E / (kWp × iradiasi) berbasis model standar industri Sandia/King.
   - Mengoreksi koefisien temperatur silikon fotovoltaik (-0,45%/°C dari kondisi uji standar 25°C STC) untuk mencerminkan performa nyata panel di iklim tropis Indonesia.
   - Mengintegrasikan data iradiansi matahari (GHI) dan suhu lingkungan dari Open-Meteo API secara otomatis tanpa perangkat sensor fisik tambahan di tiap DC.

4. **Ekstraksi Otomatis Data Scope 3 dari Jurnal Akuntansi**
   - Modul parser akuntansi CSV/XLSX mampu memproses transaksi akun perjalanan dinas (akun 611402 dan 621402).
   - Mendeteksi kode bandara IATA (misalnya CGK, SUB, KNO) dari teks deskripsi transaksi jurnal dan memetakan koordinat latitude/longitude bandara; baris hotel dan kereta diklasifikasikan otomatis.
   - Mengeliminasi kalkulasi jarak manual antarkota untuk ratusan tiket perjalanan dinas per bulan; hotel dan kereta dilengkapi lewat input manual atau template multi-sheet.

5. **Rekonsiliasi Data Ganda (Dual-Source Reconciliation)**
   - Mendukung dua jalur pencatatan yield bulanan: sinkronisasi otomatis melalui OpenAPI iSolarCloud dan import berkas laporan CSV/Excel bulanan dari portal web vendor.
   - Algoritma rekonsiliasi membandingkan kedua sumber untuk mendeteksi selisih data akibat gangguan jaringan telemetri, menjaga konsistensi neraca energi sebelum difinalisasi ke laporan tahunan.

6. **Arsitektur Modular dengan Verifikasi Pengujian Menyeluruh**
   - Seluruh logika bisnis di `src/` ditulis menggunakan TypeScript dengan *strict mode* dan terikat dengan Prisma ORM untuk menjamin integritas tipe dari basis data hingga antarmuka.
   - Dilengkapi lebih dari 40 skrip pengujian otomatis (`scripts/tests/`) mencakup unit test, isolated database test, readonly test, dan stabilization test, diverifikasi dengan `pnpm run typecheck` tanpa galat (0 errors).

---

## Database Schema (Model Utama)

Baris per plant mencakup 39 plant iSolarCloud (37 DC + 2 toko Drive Thru); toko Drive Thru tersaring di semua tampilan dan total DC.

| Model | Fungsi | Jumlah Baris Tipikal |
|:--|:--|:--|
| `PlantMaster` | Registry plant dan alias nama | 39 |
| `PlantLatest` | Telemetri terkini per plant PLTS | 39 |
| `DailyYield` | Snapshot energi harian per plant | 39 x 365 |
| `MonthlyYield` | Yield bulanan per plant (dari API atau import) | 39 x 12 |
| `MonthlyYieldObservation` | Multi-source audit trail yield bulanan | variabel |
| `EnergyFlowMonthly` | Neraca energi bulanan (yield, feed-in, purchased, load) | 39 x 12 |
| `PlantPrMonthly` | PR bulanan resmi per plant dari iSolarCloud (nilai mentah) | 39 x 12 |
| `PlantPr` | PR sesaat dari API (eksperimental, tidak dipakai di dashboard) | 39 |
| `ClimateMonthly` | Radiasi/suhu bulanan per plant | 39 x 12 |
| `LoadMonthly` | Beban listrik bulanan per plant | 39 x 12 |
| `TargetMonthly` | Target RKAP per bulan per metrik | variabel |
| `SyncRun` | Log setiap siklus sinkronisasi | ~5.000/bulan |
| `QuotaCounter` | Counter pemakaian kuota API per jam/hari/bulan | variabel |
| `FaultActive` / `FaultHistory` | Alarm dan fault PLTS aktif serta riwayatnya | variabel |
| `BusinessTravelEntry` | Transaksi perjalanan dinas Scope 3 (pesawat, hotel, kereta, lainnya) | variabel |
| `FuelActivity` | Konsumsi BBM Scope 1 | variabel |
| `WaterActivity` | Data daur ulang air per DC per bulan | variabel |
| `ImportBatch` | Riwayat file yang di-upload | variabel |
| `AppUser` | Akun login | variabel |
| `PushSubscription` | Subscription push notification per device | variabel |

---

## Metodologi Perhitungan Emisi

### Scope 1 (BBM)

```
Emisi (kgCO2e) = Volume BBM (liter) x Faktor Emisi (kgCO2e/liter)
```

Faktor emisi dari Pedoman Inventarisasi GRK ESDM. Fuel category mapping didefinisikan di `fuelCategory.ts`.

### Scope 2 (Listrik PLN)

```
Emisi (kgCO2e) = Konsumsi Listrik (kWh) x Faktor Emisi Grid Regional (kgCO2e/kWh)
```

8 grid regional dengan faktor berbeda dari SK Dirjen Ketenagalistrikan ESDM. Master registry di `emission-factors.ts`.

### Scope 3 Kategori 6 (Perjalanan Dinas)

```
Emisi Pesawat (kgCO2e) = Σ segmen [Jarak great-circle antar bandara (km) x Faktor per penumpang-km]
Emisi Hotel (kgCO2e)   = Malam x Kamar x Faktor per kamar-malam
Emisi Kereta (kgCO2e)  = Total jarak (km) x Faktor per penumpang-km
```

Jarak penerbangan adalah jarak lurus (Haversine) tanpa tambahan uplift. Segmen yang berangkat atau tiba di luar Indonesia memakai faktor internasional. Transaksi bernominal negatif (refund) mengurangi biaya tetapi tidak mengurangi emisi. Faktor dari katalog `factors.v1.ts`, bersumber dari Buku Panduan Kalkulator Hijau Bank Indonesia 2026 Bab 5 (status OFFICIAL). Pesawat domestik memilih faktor menurut jarak tiap segmen: <926 km, 926-1.852 km, >1.852 km. Detail di `travelLedger.ts`, `travelTemplate.ts`, dan `travelSummary.ts`.

### Pengurangan Emisi (PLTS)

```
Emisi Terhindar (kgCO2e) = Energi PLTS Self-consumed (kWh) x 0,997 (kgCO2/kWh)
```

Faktor tunggal nasional untuk semua grid, didefinisikan sekali di `conversionConfig.ts`.

### Performance Ratio

```
PR_plant      = PR bulanan iSolarCloud (p83023), bila tersedia dan 10% ≤ PR ≤ 100%
              = E_actual / (kWp x H_irradiation), bila tidak ada PR resmi
PR_agregat    = Σ E / Σ (E / PR_plant)        (setara Σ E / Σ (kWp x H), cara portal)
PR_corrected  = PR / (1 + gamma x (T_panel - 25))
T_panel       = T_day + (G / 800) x (NOCT - 20)
```

Portal iSolarCloud menampilkan angka tetap 90 (95 untuk Karawang) untuk PR yang tidak masuk akal; dashboard menyimpan nilai mentahnya dan menandai bulan di luar 10-100% sebagai sensor iradiasi bermasalah, bukan memakai 90. Sinkronisasi di `prMonthlySync.ts`, batas valid di `prValidity.ts`, agregasi di `dashboard.ts` (`calculateWeightedPr`). Koefisien gamma = -0,45%/°C, NOCT = 45°C (`performanceRatio.ts`).

### Deteksi Soiling (Soiling Alert / Washing Recommendation)

Jika PR suatu DC turun berturut-turut atau mengalami penurunan $\ge 10-15\%$ dibandingkan histori bulan sebelumnya pada kondisi cuaca cerah (iradiasi bulanan $\ge 80\text{ kWh/m}^2$ atau tidak mengalami penurunan iradiasi proporsional), sistem memicu **Soiling Alert** dengan rekomendasi *"Perlu Pembersihan Panel (Washing)"*.

### Laporan Ringkasan Harian (Daily Executive Digest 18:00 WIB)

Pada tab API iSolarCloud (`PLTSAnalyticsSection`), disediakan **Daily Executive Digest** dengan titik cut-off harian pukul 18:00 WIB (akhir jam produksi surya). Menampilkan:
1. Total produksi harian nasional (MWh & kWh), emisi $\text{CO}_2$ terhindar (ton), dan ekuivalen serapan pohon.
2. Top 3 DC performa terbaik harian berdasarkan *Specific Yield* ($\text{kWh/kWp}$).
3. Daftar DC yang membutuhkan atensi teknis / pemeliharaan (offline, alarm proteksi, atau suhu inverter tinggi).
4. Satu tombol salin cepat berformat rapi WhatsApp untuk kebutuhan memo manajemen / direksi.

---

## Struktur Direktori

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 20+ REST endpoint
│   │   ├── alarms/         # Alarm PLTS
│   │   ├── auth/           # Login, logout, session
│   │   ├── cron/           # Scheduled sync trigger
│   │   ├── emissions/      # Perhitungan emisi
│   │   ├── import/         # Import data CSV/Excel
│   │   ├── isolar/         # Integrasi iSolarCloud
│   │   ├── plts/           # Telemetri dan analitik PLTS
│   │   ├── scope1-3/       # Input emisi per scope
│   │   ├── sustainability/ # Aggregated sustainability data
│   │   ├── water-recycle/  # Data daur ulang air
│   │   └── ...
│   ├── login/              # Halaman login
│   └── page.tsx            # Dashboard utama (SPA)
├── components/             # Komponen React
│   ├── EmisiResumeTab      # Tab ringkasan emisi
│   ├── PenambahEmisiTab    # Tab sumber emisi (Scope 1-3)
│   ├── PengurangEmisiTab   # Tab pengurangan emisi
│   ├── HistoryTab          # Tab riwayat audit
│   ├── plts/               # 13+ komponen monitoring PLTS
│   ├── scope1-3/           # Form input emisi per scope
│   ├── calculator/         # Kalkulator emisi interaktif
│   ├── alarms/             # Badge dan panel alarm
│   └── water/              # Form daur ulang air
├── context/                # React Context (SustainabilityContext)
├── lib/                    # Business logic
│   ├── solar/              # 33 modul PLTS (sync, PR, weather, status, ...)
│   ├── carbon/             # Carbon accounting engine
│   ├── calculator/         # Emission calculator (60+ faktor)
│   ├── scope1-3/           # Scope-specific logic
│   ├── importers/          # CSV/Excel parser
│   ├── auth.ts             # Autentikasi HMAC-SHA256
│   └── emission-factors.ts # Master registry faktor emisi
├── services/               # Service layer (iSolarCloud client)
└── types/                  # TypeScript type definitions

scripts/
├── solar-daemon.mjs        # Daemon polling telemetri
├── sync-isolar.mjs         # Sinkronisasi iSolarCloud
├── data/                   # Import dan backfill data
├── tests/                  # 40+ test script
├── audits/                 # Audit dan diagnostik
└── tools/                  # Utilities (screenshot, benchmark)

prisma/
├── schema.prisma           # 20+ model, 847 baris
└── migrations/             # Database migration history

docs/
├── DEPLOY.md               # Panduan deployment produksi
├── EMISSION_CALCULATION_CANONICAL.md
├── reconciliation.md       # Rekonsiliasi data
└── ...
```

---

## Deployment

Aplikasi berjalan di server Linux (Ubuntu/Debian) via Docker atau langsung di Node.js:

- **Database**: PostgreSQL 15+ (Prisma migrate)
- **Runtime**: Node.js 22 LTS
- **Container**: Docker multi-stage build, output standalone Next.js
- **Reverse proxy**: Nginx dengan SSL
- **Sinkronisasi**: `solar-daemon.mjs` sebagai systemd service, polling setiap 5 menit pada jam matahari, sinkronisasi penuh pukul 20:00 WIB; energi bulanan dan PR bulanan ditarik setiap 3 jam
- **Migrasi**: `npx prisma migrate deploy`, lalu sekali `scripts/data/backfill-isolar-monthly-pr.mjs` setelah migrasi `plant_pr_monthly`

Detail lengkap ada di `DEPLOY.md`.

---

## Perintah Pengembangan

```bash
# Jalankan development server
pnpm run dev

# Type check
pnpm run typecheck

# Jalankan test suite
pnpm test                    # Unit tests
pnpm run test:db:isolated    # Isolated DB tests
pnpm run test:data:readonly  # Readonly endpoint tests
pnpm run test:all            # Semua test

# Daemon sinkronisasi
pnpm run daemon

# Import data
pnpm run import:isolar-history
pnpm run import:energy-flow
pnpm run import:rkap-targets

# Build produksi
pnpm run build
```

---

## Lisensi dan Atribusi Data

- **Data cuaca**: Open-Meteo.com, Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Faktor emisi**: SK Dirjen Ketenagalistrikan ESDM No. 414.K/TL.04/DJL.4/2024, Pedoman Inventarisasi GRK Nasional, IPCC 2006 Guidelines, Buku Panduan Kalkulator Hijau Bank Indonesia 2026 (Scope 3 perjalanan dinas)
- **API PLTS**: Sungrow iSolarCloud OpenAPI (lisensi vendor)
