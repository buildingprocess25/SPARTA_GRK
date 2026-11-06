---
name: SPARTA GRK
kind: Dashboard internal pemantauan emisi GRK Alfamart
dial: ENERGY 1 / RHYTHM 1 / MOTION 1
theme: terang dan gelap (class .dark di html, ThemeToggle)
font: Plus Jakarta Sans, cadangan Inter
colors:
  brand-blue: "#005697"
  brand-blue-hover: "#004880"
  page-light: "#F8FAFC"
  page-dark: "#0B1220"
  card-light: "#FFFFFF"
  card-dark: "#0F172A"
  text-light: "#0F172A"
  text-dark: "#E2E8F0"
data-colors:
  emission: "#E11D48"
  pln: "#94A3B8"
  plts: "#F59E0B"
  feed-in: "#FDE68A"
  genset: "#EA580C"
  water: "#0EA5E9"
  savings: "#10B981"
  calc: "#6366F1"
  target: "#8B5CF6"
entity-colors-light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
entity-colors-dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]
radius:
  control: 0.75rem
  card: 0.75rem
  kpi-card: 1rem
  modal: 1rem
---

# DESIGN.md: SPARTA GRK

Acuan tampilan untuk halaman dan fitur baru. Isinya diambil dari kode yang berjalan per 6 November 2026, bukan dari gaya yang diinginkan. Kalau file ini berbeda dengan kode, cek kodenya, lalu perbaiki salah satunya dalam perubahan yang sama.

Yang tidak ditulis ulang di sini:
- Istilah UI: `docs/SPARTA-GRK.md`, bagian "Istilah di Tampilan".
- Rumus dan faktor emisi: `docs/EMISSION_CALCULATION_CANONICAL.md` dan `src/lib/emission-factors.ts`.
- Filter anti slop: `.claude/skills/antislop/`.

## Karakter

Alat kerja untuk tim energi dan pelapor ESG. Pembacanya datang untuk mencari angka, membandingkan, lalu menelusuri asalnya. Tampilannya tenang dan padat, dan asal setiap angka harus bisa ditelusuri.

- **Angka paling menonjol.** Warna dan ukuran besar dipakai untuk data, bukan dekorasi.
- **Status data selalu jujur.** Bulan berjalan, data sebagian, faktor sementara, dan estimasi selalu ditandai. Data kosong ditampilkan kosong, bukan 0.
- **Bahasa Indonesia yang lugas.** Label kalimat biasa, tanpa kata promosi.

Motif identitas: **kategori data punya warna tetap di semua halaman.** Emisi selalu rose, PLN slate, PLTS amber.

## Warna

Satu-satunya warna aksi adalah biru Alfa `#005697` (`Button variant="default"`). Permukaan memakai skala Tailwind `slate`.

| Peran | Terang | Gelap |
|---|---|---|
| Halaman | `#F8FAFC` | `#0B1220` |
| Kartu | `bg-white` | `dark:bg-slate-900` |
| Garis kartu | `border-slate-200/90` | `dark:border-slate-800/80` |
| Pemisah halus | `border-slate-100` | `dark:border-slate-800` |
| Teks utama | `text-slate-900` | `dark:text-slate-100` |
| Teks pendukung | `text-slate-600` | `dark:text-slate-400` |
| Teks redup | `text-slate-500` | `dark:text-slate-400` |
| Header tabel | `bg-slate-900 text-white` | `dark:bg-slate-950` |
| Baris total | `bg-slate-100` | `dark:bg-slate-800` |

Aturan:
- Pakai class Tailwind di atas. Token di `globals.css` seperti `--card-bg`, `--radius-card`, dan `--color-semantic-*` tidak dipakai komponen, jadi jangan dijadikan acuan.
- Warna data diambil dari `CHART_PALETTE` di `src/components/ui/ChartTheme.tsx`. Jangan menulis hex baru di komponen.
- Sumbu dan garis grafik memakai `CHART_GRID_PROPS` dan `CHART_AXIS_PROPS` supaya ikut berganti tema.
- Tanpa gradien, glow, atau glassmorphism di komponen baru.

Warna status: berhasil `emerald`, peringatan `amber`, gagal `rose`. Selalu disertai teks atau ikon.

**Angka emisi di tabel:** `font-bold text-rose-700 dark:text-rose-300`. Kode lama masih campur rose, amber, dan red. Ikuti aturan ini untuk kode baru.

## Tipografi

| Elemen | Class |
|---|---|
| Judul halaman | `text-2xl lg:text-3xl font-bold tracking-tight` (`PageHeader`) |
| Judul kartu | `text-base font-bold` |
| Label KPI | `text-xs sm:text-sm font-semibold` |
| Angka KPI | `text-[21px]` sampai `text-[28px] font-extrabold tabular-nums` (`KpiCard`) |
| Isi tabel dan kontrol | `text-xs` |
| Catatan kecil | `text-[11px]` |

- Semua angka memakai `tabular-nums` dan format `id-ID` (`formatNum`).
- Satuan ditulis setelah angka dan lebih kecil: `tCO₂e`, `MWh`, `kWh`.
- Ukuran paling kecil untuk kode baru 11px. Kode lama masih punya `text-[9px]` dan `text-[10px]`.

## Susunan halaman

Isi berada di dalam `main` (`max-w-screen-2xl`, `px-4 sm:px-6 lg:px-8`). Akar halaman: `<div className="space-y-6 animate-in">`.

Urutan standar, mengikuti Scope 1, Scope 3, dan PLTS:

1. **`PageHeader`:** judul, `info` berisi metodologi, `actions` berisi pilihan periode dan `InputDataButton`.
2. **`SegmentedTabs`:** bila satu halaman punya beberapa kategori yang dipisah total, seperti Genset dan Kendaraan.
3. **Baris KPI:** `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40`, maksimal 4 `KpiCard`.
4. **Baris grafik:** `grid grid-cols-1 lg:grid-cols-5 gap-5`, grafik utama `lg:col-span-3`, komposisi `lg:col-span-2`. Boleh lebih dari satu baris bila tiap grafik menjawab pertanyaan berbeda.
5. **Kartu rincian:** tabel dengan filter dan pencarian.
6. **`<details>` "Cara ... dihitung":** penjelasan metode untuk pembaca yang ingin menelusuri.

Bagian yang tidak punya isi nyata dibuang, jangan diisi hanya supaya lengkap.

## Komponen

Pakai yang sudah ada sebelum membuat yang baru.

| Kebutuhan | Komponen | Catatan |
|---|---|---|
| Judul halaman | `ui/PageHeader` | `info` memakai `InfoHint` |
| Kartu | `ui/CardBox` atau `ui/card` | `rounded-xl`, `p-4 lg:p-5` |
| Angka utama | `ui/KpiCard` | `theme`: emission, pln, plts, genset, water, savings, calc, blue, default |
| Tab dan pilihan tampilan | `ui/SegmentedTabs` | `fullWidthOnMobile={false}` untuk tab di dalam kartu |
| Pilihan | `ui/select` (`CustomSelect`) | wajib `ariaLabel` |
| Tombol | `ui/button` | `default` hanya untuk aksi utama, sisanya `outline` |
| Input data | `ui/InputDataButton` | otomatis nonaktif di mode hanya-baca |
| Tabel | `ui/table` | jangan menulis `<table>` manual di kode baru |
| Dialog | `ui/BaseModal` | Escape sudah tertangani |
| Penjelasan singkat | `ui/InfoHint`, `ui/MetricInfoIcon` | teks metrik di `src/data/metricExplanations.ts` |
| Tooltip dan legenda grafik | `ChartTooltipCard`, `ChartPillLegend` | dari `ui/ChartTheme` |
| Kerangka muat | `plts/PLTSDashboardSkeletons` | `TabContentSkeleton`, `TableSkeleton` |

`ui/DataTable`, `ui/data-table`, `ui/ActionButton`, `ui/SectionCard`, dan `ui/ChartWrapper` tidak terpakai saat ini. Jangan dijadikan acuan.

### Pola filter halaman

Untuk halaman dengan banyak dimensi, seperti Scope 2 tab Toko:

- Satu kartu "Pilihan data" di atas KPI: 5 kolom di desktop, 3 di tablet, 2 di HP.
- Filter berlaku untuk semua KPI, grafik, dan tabel di halaman itu.
- Pilihan bertingkat saling menyesuaikan. Memilih Wilayah PLN mempersempit daftar Cabang.
- Filter aktif tampil sebagai tombol kecil yang bisa dihapus satu per satu, ditambah "Hapus filter".
- Grafik komposisi seperti Emisi per Wilayah PLN boleh memakai batang yang bisa diklik sebagai filter, dengan tombol asli dan `aria-pressed`.
- Agregasi dihitung di server. Browser tidak memuat data per baris.

### Pola daftar dan garis

Untuk membandingkan banyak entitas sekaligus. Mengacu ke "Perbandingan antar DC" di PLTS, dipakai juga untuk Peringkat cabang di Scope 2 tab Toko.

- Kartu kiri (`lg:col-span-2`): judul dengan jumlah, "Pilih semua", "Kosongkan", pilihan ukuran, pencarian, daftar berperingkat dengan centang, dan ringkasan rata-rata.
- Kartu kanan (`lg:col-span-3`): grafik garis dengan pilihan "Semua", "Rata-rata", dan "Terendah-tertinggi", serta "Lihat tabel".
- Lebih dari 8 terpilih: semua garis abu-abu dan garis rata-rata biru. 8 atau kurang: tiap entitas punya warna tetap, rata-rata putus-putus.
- Warna garis memakai palet kategori tervalidasi, bukan `CHART_PALETTE`, dan menempel pada entitasnya selama masih dipilih.
- Arahkan kursor atau fokus ke baris daftar untuk menyorot garisnya.
- Centang adalah `input type="checkbox"` asli di dalam `label`, tinggi baris minimal 44 px.
- Rata-rata harus jujur soal cara hitungnya: sebut "per cabang" atau "menurut jumlah toko".
- Tanpa pilihan, tampilkan ajakan untuk memilih, bukan grafik kosong tanpa penjelasan.
- Bila entitasnya ribuan, seperti toko, daftar dipaginasi dari server, pilihan dibatasi (Scope 2: 30 toko), dan yang dipilih otomatis di awal hanya 8 teratas. Komponen grafiknya sama: `scope2/Scope2CompareChart`.
- Tombol "Hapus filter" diulang di kartu yang jauh dari kartu "Pilihan data", supaya pengguna tidak perlu scroll ke atas.

### Pola tabel rincian

Mengacu ke "Rincian perjalanan dinas" di Scope 3:

- Di atas tabel: `SegmentedTabs` untuk tampilan, filter `CustomSelect`, pencarian dengan ikon `Search`, jumlah baris, dan tombol "Hapus filter (n)".
- Pembungkus `rounded-xl border overflow-hidden`, tinggi maksimal `max-h-[560px]`.
- Header gelap dan menempel di atas. Kolom pertama menempel di kiri. Angka rata kanan.
- Baris total menempel di bawah.
- Data ribuan baris dipaginasi dari server, jangan dikirim semua ke browser.
- Baris yang bisa diklik harus punya tombol asli di sel pertama, dengan fokus yang terlihat.

### Tiga kondisi wajib

Mengacu ke Scope 3:

| Kondisi | Tampilan |
|---|---|
| Memuat | `role="status"`, `animate-pulse`, tinggi sama dengan isi akhirnya |
| Kosong | ikon, satu kalimat yang menjelaskan, dan langkah berikutnya |
| Gagal | ikon `AlertCircle`, "Data ... belum bisa dimuat: ...", tombol "Coba lagi" |

## Grafik

Pakai Recharts. Tinggi `h-72`, `h-80`, atau `h-96`.

Aturan untuk grafik baru:
- **Satu sumbu Y.** Dua ukuran berbeda skala dibuat dua grafik. Empat file lama masih memakai dua sumbu (`PenambahEmisiTab`, `PLTSMonthlyEnergyCharts`, `ResumeTrendChart`, `Scope2AnnualLoadDashboard`), jangan ditiru.
- **Warna mengikuti kategori data, bukan urutan.** `CHART_PALETTE` tidak aman dipakai berurutan sebagai warna kategori. Hasil `validate_palette.js`: `calc` dan `target` hanya berjarak ΔE 6,3 untuk mata normal dan 0,8 untuk buta warna protan. Jangan pasang keduanya bersebelahan.
- **Warna terang butuh label.** `pln`, `plts`, `water`, dan `savings` di bawah 3:1 terhadap kartu putih, jadi wajib ada label angka atau tabel.
- **Satu seri tidak perlu legenda.** Judul kartu sudah menyebut isinya. Dua seri atau lebih wajib `ChartPillLegend`.
- **Teks tooltip memakai warna teks biasa.** Warna seri hanya di titik penanda.
- **Bulan sebagian:** tanda `*` dan `PARTIAL_OPACITY`. Bulan tanpa data adalah celah, bukan 0.
- **Tren butuh cukup titik waktu.** Tren bulanan minimal 2 bulan. Kalau baru satu bulan, pakai tren harian atau peringkat.
- **Peringkat banyak kategori:** batang mendatar satu warna, diurutkan, dengan label nilai.
- **Sebaran:** histogram satu warna dengan jumlah di atas batang. Bagus untuk menangkap data janggal.
- **Sumbu Y mulai dari 0** untuk batang dan garis jumlah.
- **Tooltip wajib di grafik garis,** dengan garis bantu vertikal, dan bisa dipakai dengan tombol panah saat grafik fokus.
- **Sediakan versi tabel** untuk grafik yang nilainya tidak semua tertulis ("Lihat tabel").

## Bentuk dan kedalaman

- `rounded-xl`: kartu, tombol, input.
- `rounded-2xl`: `KpiCard` dan modal.
- `rounded-lg`, `rounded-md`: elemen kecil.
- `rounded-full`: hanya titik status dan legenda.
- Kartu `shadow-2xs`, mode gelap tanpa bayangan. Bayangan besar hanya untuk tooltip dan modal.

## Gerak

MOTION 1. Hanya yang sudah ada:
- Masuk halaman: `animate-in` (0,22 detik).
- Hover KPI: `interactive-card`.
- Tombol: `active:scale-[0.98]`.
- Grafik: animasi masuk 800 ms ease-out, sama dengan grafik lain. Grafik yang digambar ulang saat hover atau berisi banyak garis memakai `isAnimationActive={false}`.

`prefers-reduced-motion` sudah ditangani di `globals.css` untuk animasi CSS. Tanpa animasi lain kecuali ada alasan tertulis.

## Layar HP dan aksesibilitas

- KPI 1 kolom, lalu 2 di `sm`, lalu 4 di `xl`. Periksa juga rentang 600 sampai 1024 px.
- Tidak ada scroll samping di halaman. Tabel lebar scroll di dalam pembungkusnya.
- Target sentuh minimal 44 px di HP (`min-h-11`). `Button` standar hanya 36 px, jadi kontrol utama di HP perlu ditambah.
- Semua kontrol bisa dipakai dengan keyboard dan fokusnya terlihat: `focus-visible:ring-2 focus-visible:ring-blue-500`. Jangan `focus:outline-none` tanpa pengganti.
- Teks memenuhi WCAG AA. Periksa dengan skrip di skill `antislop-human`, jangan hanya dilihat.
- Setiap fitur baru diperiksa di mode terang dan gelap.

## Penulisan

- Tanpa em dash di teks baru. Nilai kosong ditulis `-`. Kode lama masih memakai em dash sebagai penanda kosong.
- Tombol menyebut aksinya: "Input data Scope 3", "Unduh rincian", "Hapus filter".
- Pesan kosong menjelaskan langkah berikutnya, bukan sekadar "Tidak ada data".
- Jangan menulis klaim atau angka tanpa sumber. Estimasi diberi label estimasi.
- Jangan membuat avatar, logo, atau nama orang tanpa arahan.

## Checklist fitur baru

1. Baca file ini dan istilah di `docs/SPARTA-GRK.md`.
2. Tulis satu baris Design Read: jenis halaman, pembaca, gaya, dial.
3. Susun mengikuti urutan halaman dan pakai komponen yang ada.
4. Lengkapi kondisi memuat, kosong, dan gagal.
5. Periksa grafik: satu sumbu, warna sesuai data, ada tabel atau label.
6. Periksa terang, gelap, HP, dan keyboard.
7. Jalankan `pnpm run typecheck` dan tes terkait.
8. Jalankan Delivery Gate antislop, perbarui dokumen, lalu `graphify update .`.

## Utang desain yang sudah diketahui

Dicatat supaya tidak ditiru. Perbaikannya terpisah dari fitur baru.

| Kondisi di kode lama | Aturan untuk kode baru |
|---|---|
| 4 file memakai grafik dua sumbu | Satu sumbu |
| Warna angka emisi campur rose, amber, red | Rose |
| 180 pemakaian `text-[9px]` dan `text-[10px]` | Minimal 11px |
| Tabel manual di Scope 1 dan Scope 2, dan baris tabel Scope 2 tanpa fokus terlihat | `ui/table`, fokus terlihat |
| Token `globals.css` tidak terpakai | Class Tailwind sesuai tabel warna |
| Tooltip lama memakai warna seri pada teks | Warna teks biasa |
| Banyak hex langsung di komponen | `CHART_PALETTE` dan props `ChartTheme` |
