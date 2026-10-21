# SPARTA GRK

**Sustainability Performance And Reporting Tracking Application**
Greenhouse Gas (GRK) Monitoring Dashboard for PT Sumber Alfaria Trijaya Tbk (Alfamart)

---

## Tentang Proyek Ini

SPARTA GRK adalah dashboard monitoring keberlanjutan (sustainability) untuk Alfamart yang menghitung dan melacak emisi gas rumah kaca (GRK) dari seluruh operasional Distribution Center (DC) Alfamart di Indonesia. Aplikasi ini mengintegrasikan data telemetri PLTS atap secara real-time dari 39 plant surya di 36 lokasi, menghitung emisi Scope 1, 2, dan 3, serta memantau program daur ulang air.

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
| **Sungrow iSolarCloud OpenAPI** | Telemetri real-time 39 plant PLTS: daya, energi, status, alarm, inverter |
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

#### Scope 2: Emisi Tidak Langsung (Listrik Grid PLN)
- 8 grid regional dengan faktor emisi resmi (SK Dirjen Ketenagalistrikan ESDM):
  - JAMALI: 0,870 kgCO2e/kWh
  - Sumatera: 0,761 kgCO2e/kWh
  - Kalbar, Kalselteng, Sulselrabar, Batam, Lombok, Sulutgo
- Rekonsiliasi data pemakaian listrik PLN terhadap tarif per golongan
- Analitik dan visualisasi beban tahunan per DC

#### Scope 3: Emisi Tidak Langsung Lainnya (Perjalanan Dinas)
- **Import jurnal perjalanan dinas** dari file CSV/XLSX akuntansi (akun 611402 / 621402)
- Deteksi otomatis rute penerbangan dari deskripsi jurnal (parsing kode bandara IATA)
- Perhitungan jarak great-circle antar bandara
- Faktor emisi per km penumpang (ekonomi dan bisnis, domestik dan internasional, dari DEFRA 2024)
- **Template input manual** untuk entry yang tidak bisa diparsing otomatis

### 3. Pengurangan Emisi: PLTS Atap

Monitoring real-time 39 plant PLTS atap (total 5.876 kWp) di 36 lokasi DC:

- **Telemetri langsung**: daya aktual (kW), energi harian (kWh), energi kumulatif (MWh)
- **Status plant**: Online/Offline, Normal/Alarm/Fault dengan push notification
- **Sinkronisasi otomatis**: polling setiap 5 menit pada jam produksi (05:30-18:30 WIB)
- **Manajemen kuota API**: guard untuk hourly (2.000), daily (48.000), dan monthly (100.000) call limit
- **Analitik performa**:
  - Specific Yield (kWh/kWp) per plant
  - Equivalent Hours dari API
  - Performance Ratio (PR) bulanan per plant dan aggregate (capacity-weighted)
  - Koreksi temperatur silikon (-0,45%/°C dari STC 25°C) menggunakan model Sandia/King
  - Analisis korelasi cuaca (GHI, suhu, kelembapan) dari Open-Meteo
- **Matriks bulanan**: tabel 39 plant x 12 bulan dengan yield, load, feed-in, dan PR
- **Target RKAP**: tracking realisasi terhadap target produksi perusahaan
- **Emisi terhindar**: energi PLTS x 0,997 kgCO2/kWh
- **Ekuivalen lingkungan**: batubara terhindar (0,4 kg/kWh), pohon setara (21,77 kgCO2/pohon/tahun)
- **Import data iSolar**: upload laporan bulanan dari portal iSolarCloud untuk validasi silang

### 4. Pengurangan Emisi: Daur Ulang Air

- Input data volume air daur ulang per DC per bulan
- Perhitungan kontribusi pengurangan beban lingkungan
- Tracking realisasi program daur ulang air

### 5. Riwayat Audit

- Log seluruh input dan perubahan data emisi
- Setiap entry memiliki ID unik, timestamp, dan metadata sumber
- Fitur hapus per entry dan batch
- Persistensi state di localStorage dengan versioning (v4)

### 6. Autentikasi dan Keamanan

- Login 2 akun tetap (admin, viewer) dengan session cookie HMAC-SHA256
- Middleware Edge Runtime untuk route guard
- Session policy dengan idle timeout
- CRON endpoint dilindungi bearer token terpisah
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
     - **Scope 3**: Standar emisi penerbangan DEFRA/BEIS 2024 dengan diferensiasi kabin (ekonomi vs bisnis) dan jarak Haversine + uplift 50 km.
   - Dilengkapi tabel jejak audit (`AuditTrail`) dan snapshot multi-sumber (`MonthlyYieldObservation`) sehingga setiap angka dapat ditelusuri riwayat perubahannya saat audit laporan keberlanjutan (ESG).

2. **Integrasi Telemetri PLTS Terdistribusi Real-Time**
   - Menghubungkan 39 plant surya atap dengan total kapasitas 5.876 kWp di 36 Distribution Center (DC) Alfamart di seluruh Indonesia.
   - Daemon sinkronisasi otomatis (`solar-daemon.mjs`) beroperasi secara terjadwal pada jam radiasi matahari (05:30 - 18:30 WIB) dengan interval 5 menit.
   - Memiliki proteksi kuota API (`QuotaCounter`) dengan pembatasan per jam, harian, dan bulanan untuk mencegah lonjakan pemanggilan API ke vendor Sungrow iSolarCloud.

3. **Perhitungan Fisika Energi dan Koreksi Temperatur Silikon**
   - Menghitung Performance Ratio (PR) berbasis model standar industri Sandia/King.
   - Mengoreksi koefisien temperatur silikon fotovoltaik (-0,45%/°C dari kondisi uji standar 25°C STC) untuk mencerminkan performa nyata panel di iklim tropis Indonesia.
   - Mengintegrasikan data iradiansi matahari (GHI) dan suhu lingkungan dari Open-Meteo API secara otomatis tanpa perangkat sensor fisik tambahan di tiap DC.

4. **Ekstraksi Otomatis Data Scope 3 dari Jurnal Akuntansi**
   - Modul parser akuntansi CSV/XLSX mampu memproses transaksi akun perjalanan dinas (akun 611402 dan 621402).
   - Mendeteksi kode bandara IATA (misalnya CGK, SUB, KNO) dari teks deskripsi transaksi jurnal dan memetakan koordinat latitude/longitude bandara.
   - Mengeliminasi kalkulasi jarak manual antarkota untuk ratusan tiket perjalanan dinas per bulan.

5. **Rekonsiliasi Data Ganda (Dual-Source Reconciliation)**
   - Mendukung dua jalur pencatatan yield bulanan: sinkronisasi otomatis melalui OpenAPI iSolarCloud dan import berkas laporan CSV/Excel bulanan dari portal web vendor.
   - Algoritma rekonsiliasi membandingkan kedua sumber untuk mendeteksi selisih data akibat gangguan jaringan telemetri, menjaga konsistensi neraca energi sebelum difinalisasi ke laporan tahunan.

6. **Arsitektur Modular dengan Verifikasi Pengujian Menyeluruh**
   - Seluruh logika bisnis di `src/` ditulis menggunakan TypeScript dengan *strict mode* dan terikat dengan Prisma ORM untuk menjamin integritas tipe dari basis data hingga antarmuka.
   - Dilengkapi lebih dari 40 skrip pengujian otomatis (`scripts/tests/`) mencakup unit test, isolated database test, readonly test, dan stabilization test, diverifikasi dengan `pnpm run typecheck` tanpa galat (0 errors).

---

## Database Schema (Model Utama)

| Model | Fungsi | Jumlah Baris Tipikal |
|:--|:--|:--|
| `PlantLatest` | Telemetri terkini per plant PLTS | 39 |
| `DailyYield` | Snapshot energi harian per plant | 39 x 365 |
| `MonthlyYield` | Yield bulanan per plant (dari API atau import) | 39 x 12 |
| `MonthlyYieldObservation` | Multi-source audit trail yield bulanan | variabel |
| `EnergyFlowMonthly` | Neraca energi bulanan (yield, feed-in, purchased, load) | 39 x 12 |
| `ClimateMonthly` | Data cuaca bulanan per lokasi plant | 36 x 12 |
| `LoadMonthly` | Beban listrik bulanan per plant | 39 x 12 |
| `TargetMonthly` | Target RKAP per bulan per metrik | variabel |
| `SyncRun` | Log setiap siklus sinkronisasi | ~5.000/bulan |
| `QuotaCounter` | Counter pemakaian kuota API per jam/hari/bulan | variabel |
| `AlarmEvent` | Riwayat alarm dan fault PLTS | variabel |
| `Scope3TravelEntry` | Entry emisi perjalanan dinas | variabel |
| `WaterRecycleEntry` | Data daur ulang air per DC per bulan | variabel |
| `AppUser` | Akun login (admin, viewer) | 2 |
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
Emisi Penerbangan (kgCO2e) = Jarak (km) x Faktor per-km (kgCO2e/km)
Jarak = Great-circle distance (Haversine) + 50 km (uplift factor)
```

Faktor per-km dari DEFRA 2024, dibedakan domestik/internasional dan ekonomi/bisnis. Detail di `travelLedger.ts` dan `scope3-perjalanan-dinas.md`.

### Pengurangan Emisi (PLTS)

```
Emisi Terhindar (kgCO2e) = Energi PLTS Self-consumed (kWh) x 0,997 (kgCO2/kWh)
```

Faktor tunggal nasional untuk semua grid, didefinisikan sekali di `conversionConfig.ts`.

### Performance Ratio

```
PR_plant = E_actual / (kWp x H_irradiation)
PR_corrected = PR / (1 + gamma x (T_panel - 25))
T_panel = T_day + (G / 800) x (NOCT - 20)
```

Koefisien gamma = -0,45%/°C, NOCT = 45°C. Implementasi di `performanceRatio.ts`.

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
├── scope3-perjalanan-dinas.md
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
- **Sinkronisasi**: `solar-daemon.mjs` sebagai systemd service, polling setiap 5 menit pada jam matahari, sinkronisasi penuh pukul 20:00 WIB

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
- **Faktor emisi**: SK Dirjen Ketenagalistrikan ESDM No. 414.K/TL.04/DJL.4/2024, Pedoman Inventarisasi GRK Nasional, IPCC 2006 Guidelines, DEFRA 2024
- **API PLTS**: Sungrow iSolarCloud OpenAPI (lisensi vendor)
