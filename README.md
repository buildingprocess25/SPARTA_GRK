# SPARTA GRK

**Sustainability Performance And Reporting Tracking Application**  
Greenhouse Gas (GRK) Monitoring & Carbon Accounting Dashboard for PT Sumber Alfaria Trijaya Tbk (Alfamart)

---

## Tentang Proyek Ini

**SPARTA GRK** adalah platform enterprise monitoring keberlanjutan (*sustainability*) dan inventarisasi gas rumah kaca (GRK) untuk seluruh jaringan operasional Distribution Center (DC) Alfamart di Indonesia. 

Platform ini mengintegrasikan pemantauan emisi komprehensif:
- **Scope 1 (Emisi Langsung)**: Konsumsi solar genset stasioner dan bahan bakar armada kendaraan operasional.
- **Scope 2 (Emisi Tidak Langsung)**: Konsumsi listrik PLN pada 37 DC, rekonsiliasi energi beban vs listrik yang dibeli, dan faktor emisi grid regional ESDM.
- **Scope 3 (Emisi Rantai Nilai)**: Emisi perjalanan dinas (*business travel*) mencakup penerbangan, kereta api, hotel, dan transportasi darat.
- **Pengurangan Emisi**:
  - **PLTS Atap**: Integrasi telemetri live Sungrow iSolarCloud OpenAPI, telemetri inverter harian, analisis *Performance Ratio* (PR), dan integrasi radiasi cuaca Open-Meteo.
  - **Daur Ulang Air**: Pemantauan volume pemanfaatan air daur ulang di DC dan emisi terhindar dari pengolahan air bersih.

Perhitungan emisi mengacu pada standar resmi Kementerian ESDM, Pedoman Inventarisasi GRK Nasional (KLHK), IPCC 2006, serta standar internasional GHG Protocol Corporate Standard.

> **Penting Mengenai Entitas DC:**  
> **Total Distribution Center (DC) Alfamart selalu berjumlah 37.** Akun vendor iSolarCloud memuat 39 plant fisik karena mencakup 2 toko percontohan Drive Thru (tipe `STORE`), yang secara sistematis dikecualikan dari penghitungan DC oleh `isDcLocation()`. DC Gorontalo merupakan salah satu dari 37 DC, namun saat ini belum memiliki instalasi PLTS (berstatus "dalam pembangunan").

---

## Fitur Utama

1. **Executive Dashboard (Ringkasan Emisi)**
   - Ikhtisar emisi Scope 1, Scope 2, Scope 3, kontribusi pengurang emisi (PLTS & Air), dan Net Emission ($t\text{CO}_2\text{e}$).
   - Grafik tren bulanan emisi kumulatif (YTD) dan perbandingan year-over-year (YoY).
   - Indikator intensitas emisi per meter persegi luas fasilitas dan per karyawan.

2. **Scope 1: Emisi Langsung**
   - Pemantauan bahan bakar genset cadangan (Solar B35) di DC saat pemadaman.
   - Pemantauan armada kendaraan operasional (BBM Solar, Dex, B35).
   - Form input data aktivitas BBM dan kalkulasi otomatis emisi ton $\text{CO}_2\text{e}$.

3. **Scope 2: Emisi Listrik PLN**
   - Rekonsiliasi energi kanonikal (Beban Total vs Listrik Dibeli PLN vs Self-consumption PLTS).
   - Diagram alir waterfall interaktif (Beban $\rightarrow$ Dikurangi PLTS $\rightarrow$ Listrik Dibeli $\rightarrow$ Emisi).
   - Faktor emisi spesifik per sistem ketenagalistrikan (Jawa-Madura-Bali, Sumatera, Kalimantan, Sulawesi, Nusa Tenggara, Maluku, Papua).
   - Simulator dampak penambahan kapasitas PLTS dan penghematan biaya listrik.

4. **Scope 3: Perjalanan Dinas (Business Travel)**
   - Kalkulasi emisi tiket pesawat berdasarkan rute bandara (IATA code) dan kelas kabin (DEFRA / ICAO methodology).
   - Emisi perjalanan kereta api, armada sewa/operasional darat, dan penginapan hotel.
   - Fitur upload batch template Excel untuk rekonsiliasi data perjalanan bulanan.

5. **Pengurangan Emisi: PLTS & Daur Ulang Air**
   - **PLTS Atap**: Telemetri live 39 plant fisik (kapasitas terpasang ~5,87 MWp), status koneksi vendor (`ps_status`), status alarm & fault, ranking specific yield ($kWh/kWp$), dan equivalent hours.
   - **Analisis PR & Cuaca**: Integrasi data radiasi Global Horizontal Irradiation (GHI) dan temperatur ambient dari Open-Meteo API (lisensi CC BY 4.0) untuk koreksi termal panel silikon ($-0{,}45\%/^\circ\text{C}$).
   - **Daur Ulang Air**: Pelacakan volume air daur ulang ($m^3$) dan emisi pengolahan yang berhasil dihindari.

6. **Kalkulator Emisi & Alat Simulasi**
   - Alat hitung emisi interaktif untuk memudahkan simulasi skenario dekarbonisasi dan estimasi emisi kegiatan operasional baru.

---

## Tech Stack

| Layer | Komponen / Teknologi | Fungsi Utama |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 15 (App Router)** | Framework React 19 full-stack dengan Server & Client Components |
| | **TypeScript 5.x / 6.x** | Strict typing di seluruh `src/` (kode ditulis *erasable syntax*) |
| | **Tailwind CSS v4** | Sistem styling utilitas modern dengan dark mode adaptif |
| | **Recharts** | Visualisasi grafik tren emisi, komposisi energi, dan waterfall |
| | **Lucide React** | Ikonografi UI antarmuka sistem |
| **Backend** | **Next.js API Routes** | 20+ endpoint RESTful (auth, telemetri, kalkulasi, ekspor laporan) |
| | **Prisma ORM 5.22** | Relational data mapping, skema database, migrasi aman |
| | **PostgreSQL 15+** | Basis data relasional utama untuk data historis, kuota, & telemetri |
| | **Node.js 22 LTS** | Runtime eksekusi backend dan daemon otomatisasi |
| **Daemon & Cron** | **Solar Daemon (`solar-daemon.mjs`)** | Polling telemetri iSolarCloud per 5 menit pada jam operasional PLTS |
| | **PR Sync (`sync-isolar.mjs`)** | Sinkronisasi PR bulanan, pembacaan inverter, dan aggregasi cuaca |

---

## Memulai (Quick Start)

### 1. Prasyarat
- **Node.js**: Versi 22.x LTS atau lebih baru.
- **Package Manager**: `pnpm` (direkomendasikan) atau `npm`.
- **Database**: PostgreSQL 15+ yang sudah terpasang dan berjalan.

### 2. Instalasi Dependensi
```bash
# Clone repository
git clone <repository-url>
cd sparta-grk

# Install dependensi
pnpm install
```

### 3. Konfigurasi Environment Variable
Salin berkas `.env.example` menjadi `.env.local` atau `.env`:
```bash
cp .env.example .env.local
```

Lengkapi konfigurasi utama di `.env.local`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/sparta_grk?schema=public"
NEXTAUTH_SECRET="your-secure-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# Kredensial iSolarCloud OpenAPI (Sungrow)
ISOLAR_APP_KEY="your-app-key"
ISOLAR_ACCESS_KEY="your-access-key"
ISOLAR_SECRET_KEY="your-secret-key"
ISOLAR_EMAIL="your-account-email"
ISOLAR_PASSWORD="your-account-password"

# Keamanan Cron & Daemons
CRON_SECRET="your-cron-secret-token"
```

### 4. Setup Basis Data (Prisma)
```bash
# Generate Prisma Client
pnpm prisma generate

# Sinkronisasikan skema ke database
pnpm prisma db push

# (Opsional) Seeding data awal master DC & fasilitas
node scripts/data/seed-plant-master-status.mjs
```

### 5. Menjalankan Server Development
```bash
pnpm run dev
```
Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## Perintah Pengujian & Verifikasi

Proyek ini menerapkan standar kualitas kode yang ketat. Setiap perubahan wajib lulus pemeriksaan tipe data dan pengujian unit:

| Perintah | Deskripsi |
| :--- | :--- |
| `pnpm run typecheck` | Menjalankan `tsc --noEmit`. Wajib **0 error** untuk seluruh kode di `src/`. |
| `pnpm test` | Menjalankan unit test suite utama (`scripts/run-unit-tests.mjs`). |
| `pnpm run test:isolated-db` | Menjalankan tes integrasi yang memerlukan basis data terisolasi. |
| `pnpm run test:readonly` | Menjalankan tes verifikasi terhadap data kanonikal read-only. |
| `pnpm run test:all` | Menjalankan seluruh rangkaian tes (unit test + isolated DB test). |

---

## Struktur Folder Proyek

```text
├── src/                          # Seluruh kode sumber aplikasi (TypeScript)
│   ├── app/                      # Next.js App Router (Halaman & API Routes)
│   ├── components/               # Komponen UI React (Scope 1, 2, 3, PLTS, Resume, Charts)
│   ├── context/                  # React Context (SustainabilityContext)
│   ├── lib/                      # Business logic, engines emisi, solar client, Prisma client
│   └── types/                    # Definisi tipe global TypeScript
├── scripts/                      # Skrip automasi & daemon (Node.js ESM)
│   ├── tests/                    # Unit, integration, & regression test scripts
│   ├── audits/                   # Skrip diagnostik, inspeksi, & pemeriksaan rekonsiliasi data
│   ├── data/                     # Skrip migrasi data, backfill, & CSV/Excel importers
│   ├── tools/                    # Profiling, utility dev, & visual regression tools
│   ├── solar-daemon.mjs          # Daemon background polling telemetri iSolarCloud
│   └── sync-isolar.mjs           # Runner sinkronisasi vendor iSolarCloud
├── prisma/                       # Skema database & file migrasi Prisma
├── docs/                         # Dokumentasi teknis terinci
│   ├── SPARTA-GRK.md             # Dokumen arsitektur, metodologi emisi, & spesifikasi teknis
│   └── DEPLOY.md                 # Panduan deployment server produksi & Docker
└── public/                       # Aset statis, ikon, manifest PWA
```

---

## Aturan Pengembangan & Kontribusi

1. **Larangan Commit & Push Otomatis**: Seluruh perubahan kode harus ditinggalkan di *working tree* untuk ditinjau dan di-commit langsung oleh pengguna.
2. **Kanonikal 37 DC**: Total DC Alfamart wajib 37 di seluruh label, laporan, dan dokumen.
3. **Dokumentasi Selaras dengan Kode**: Setiap modifikasi perilaku, rumus emisi, atau variabel konfigurasi wajib memperbarui dokumen pendukung di [docs/SPARTA-GRK.md](docs/SPARTA-GRK.md).
4. **Organisasi Skrip**: Dilarang meletakkan skrip ad-hoc di root `scripts/`. Gunakan subdirektori sesuai fungsinya (`scripts/tests/`, `scripts/audits/`, `scripts/data/`, atau `scripts/tools/`).

---

## Lisensi & Atribusi Data

- **Hak Cipta**: © PT Sumber Alfaria Trijaya Tbk (Alfamart). Seluruh hak cipta dilindungi undang-undang.
- **Atribusi Data Cuaca**: Data radiasi matahari (GHI) dan parameter cuaca disediakan oleh [Open-Meteo.com](https://open-meteo.com/) di bawah lisensi **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
