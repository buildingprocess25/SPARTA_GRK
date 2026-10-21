import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber
} from "docx";

const COLOR_PRIMARY = "1B365D";   // Navy Alfamart
const COLOR_ACCENT = "E31837";    // Merah Alfamart
const COLOR_DARK = "2D3748";      // Charcoal
const COLOR_MUTED = "718096";     // Slate
const COLOR_BG_LIGHT = "F7FAFC";  // Light Gray
const COLOR_BORDER = "E2E8F0";    // Border Gray

function createTitle(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    run: {
      size: 44, // 22pt
      bold: true,
      color: COLOR_PRIMARY,
      font: "Arial"
    }
  });
}

function createSubtitle(text) {
  return new Paragraph({
    text: text,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    run: {
      size: 24, // 12pt
      color: COLOR_ACCENT,
      bold: true,
      font: "Arial"
    }
  });
}

function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: {
      bottom: {
        color: COLOR_ACCENT,
        size: 12,
        style: BorderStyle.SINGLE,
        space: 4
      }
    },
    run: {
      size: 30, // 15pt
      bold: true,
      color: COLOR_PRIMARY,
      font: "Arial"
    }
  });
}

function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    run: {
      size: 24, // 12pt
      bold: true,
      color: COLOR_PRIMARY,
      font: "Arial"
    }
  });
}

function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    run: {
      size: 22, // 11pt
      bold: true,
      color: COLOR_DARK,
      font: "Arial"
    }
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 100, line: 276 },
    children: [
      new TextRun({
        text: text,
        size: 20, // 10pt
        color: options.color || COLOR_DARK,
        bold: options.bold || false,
        italics: options.italics || false,
        font: "Arial"
      })
    ]
  });
}

function createBullet(text, boldPrefix = "") {
  const children = [];
  if (boldPrefix) {
    children.push(
      new TextRun({
        text: boldPrefix + " ",
        bold: true,
        size: 20,
        color: COLOR_DARK,
        font: "Arial"
      })
    );
  }
  children.push(
    new TextRun({
      text: text,
      size: 20,
      color: COLOR_DARK,
      font: "Arial"
    })
  );

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 60, line: 260 },
    children
  });
}

function createCodeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_PRIMARY },
      right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLOR_BG_LIGHT, type: ShadingType.SOLID, color: COLOR_BG_LIGHT },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: lines.map(
              (line) =>
                new Paragraph({
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: line,
                      font: "Consolas",
                      size: 18,
                      color: "1A202C"
                    })
                  ]
                })
            )
          })
        ]
      })
    ]
  });
}

function createTable(headers, rows, colWidths = []) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => {
        return new TableCell({
          width: colWidths[i] ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
          shading: { fill: COLOR_PRIMARY, type: ShadingType.SOLID, color: COLOR_PRIMARY },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          borders: {
            top: borderStyle,
            bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_ACCENT },
            left: borderStyle,
            right: borderStyle
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  color: "FFFFFF",
                  size: 19,
                  font: "Arial"
                })
              ]
            })
          ]
        });
      })
    }),
    ...rows.map((row, rIdx) => {
      const isAlt = rIdx % 2 === 1;
      return new TableRow({
        children: row.map((cellText, cIdx) => {
          return new TableCell({
            width: colWidths[cIdx] ? { size: colWidths[cIdx], type: WidthType.PERCENTAGE } : undefined,
            shading: isAlt ? { fill: COLOR_BG_LIGHT, type: ShadingType.SOLID, color: COLOR_BG_LIGHT } : undefined,
            margins: { top: 80, bottom: 80, left: 140, right: 140 },
            borders: {
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle
            },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20, line: 240 },
                children: [
                  new TextRun({
                    text: cellText,
                    size: 18,
                    bold: cIdx === 0,
                    color: COLOR_DARK,
                    font: "Arial"
                  })
                ]
              })
            ]
          });
        })
      });
    })
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderStyle,
      bottom: borderStyle,
      left: borderStyle,
      right: borderStyle
    },
    rows: tableRows
  });
}

async function buildDocx() {
  const doc = new Document({
    creator: "Alfamart Sustainability & Engineering",
    title: "SPARTA GRK - Dokumentasi Teknis dan Sistem",
    description: "Dokumentasi Arsitektur, Bahasa Pemrograman, Fitur, dan Keunggulan Sistem SPARTA GRK",
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            color: COLOR_DARK
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: "SPARTA GRK — PT Sumber Alfaria Trijaya Tbk",
                    size: 16,
                    color: COLOR_MUTED,
                    font: "Arial"
                  })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.SPACE_BETWEEN,
                children: [
                  new TextRun({
                    text: "Dokumentasi Teknis dan Operasional",
                    size: 16,
                    color: COLOR_MUTED,
                    font: "Arial"
                  }),
                  new TextRun({
                    children: ["Halaman ", PageNumber.CURRENT, " dari ", PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLOR_MUTED,
                    font: "Arial"
                  })
                ]
              })
            ]
          })
        },
        children: [
          // Header / Title
          createTitle("SPARTA GRK"),
          createSubtitle("Sustainability Performance And Reporting Tracking Application\nGreenhouse Gas (GRK) Monitoring Dashboard — PT Sumber Alfaria Trijaya Tbk"),

          createParagraph(
            "SPARTA GRK adalah dashboard monitoring keberlanjutan (sustainability) resmi untuk Alfamart yang menghitung, merekonsiliasi, dan memantau emisi gas rumah kaca (GRK) dari seluruh operasional Distribution Center (DC) Alfamart di Indonesia. Sistem ini mengintegrasikan data telemetri PLTS atap real-time dari 39 plant surya di 36 lokasi (5.876 kWp), menghitung emisi Scope 1, Scope 2, dan Scope 3 secara terperinci, serta memantau program reduksi melalui daur ulang air."
          ),
          createParagraph(
            "Seluruh metodologi perhitungan emisi terikat langsung pada regulasi resmi pemerintah Indonesia: SK Dirjen Ketenagalistrikan Kementerian ESDM No. 414.K/TL.04/DJL.4/2024 dan Pedoman Inventarisasi GRK Nasional, serta standar internasional IPCC 2006 dan DEFRA/BEIS 2024."
          ),

          // 1. Bahasa Pemrograman dan Kueri
          createHeading1("1. Bahasa Pemrograman dan Bahasa Kueri yang Digunakan"),
          createParagraph("Sistem ini dibangun dengan memanfaatkan bahasa pemrograman dan teknologi yang terstruktur secara modular:"),
          createTable(
            ["Bahasa", "Ekstensi Berkas", "Area Penggunaan dan Peran Utama"],
            [
              [
                "TypeScript",
                ".ts, .tsx",
                "Bahasa utama aplikasi di src/. Digunakan untuk seluruh frontend React 19, API Routes Next.js 15, modul kalkulasi emisi (lib/carbon/, lib/calculator/), service PLTS (lib/solar/), dan definisi tipe data (types/). Dijalankan dengan strict mode dan mempertahankan sintaks erasable agar dapat diimpor langsung oleh Node.js type stripping."
              ],
              [
                "JavaScript (ESM)",
                ".mjs, .js, .jsx",
                "Automasi daemon latar belakang dan suite pengujian di scripts/. Daemon telemetri (solar-daemon.mjs), sinkronisasi vendor (sync-isolar.mjs), runner pengujian unit/integrasi (scripts/tests/), dan script audit database (scripts/audits/) dijalankan di atas Node.js 22 LTS."
              ],
              [
                "Prisma Schema & SQL",
                ".prisma, raw SQL",
                "Pemodelan dan manipulasi basis data di prisma/. schema.prisma mendefinisikan 20+ model relasional, indeks komposit, relasi foreign key, dan enum status. Kueri dijalankan melalui Prisma ORM dan PostgreSQL 15+ untuk kecepatan transaksi tinggi."
              ],
              [
                "CSS (Tailwind v4)",
                ".css",
                "Styling dan desain visual di src/app/globals.css. Memanfaatkan Tailwind CSS v4 dengan CSS variables untuk manajemen tema visual, palet warna indikator status inverter PLTS, dan grafik analitik responsif."
              ],
              [
                "HTML / JSX",
                ".tsx, .jsx",
                "Struktur antarmuka pengguna berbasis komponen modular React 19 dengan semantik HTML5 dan dukungan aksesibilitas ARIA."
              ],
              [
                "Shell / Bash",
                "CLI / .sh",
                "Automasi deployment Dokploy, manajemen service manager systemd di server produksi Linux Ubuntu/Debian, dan skrip runner pnpm."
              ],
              [
                "JSON & YAML",
                ".json, .yml",
                "Manajemen dependensi proyek (package.json, tsconfig.json), manifest kontainer Docker, dan format payload pertukaran data REST API."
              ]
            ],
            [20, 20, 60]
          ),

          // 2. Tech Stack Lengkap
          createHeading1("2. Rincian Tech Stack"),
          createHeading2("Frontend & Backend Core"),
          createTable(
            ["Komponen", "Teknologi & Versi", "Peran & Fungsi"],
            [
              ["Framework Frontend", "Next.js 15.3 (App Router)", "Framework React full-stack dengan SSR dan API routes"],
              ["UI Library", "React 19.1", "Komponen antarmuka pengguna berbasis komponen reaktif"],
              ["Sistem Bahasa", "TypeScript 6.0", "Type safety end-to-end dari database hingga tampilan"],
              ["Styling Framework", "Tailwind CSS 4.3", "Utility-first CSS styling dengan CSS custom properties"],
              ["Visualisasi Data", "Recharts 3.10", "Grafik tren emisi bulanan, kurva telemetri daya, dan beban energi"],
              ["Komponen UI", "shadcn/ui 4.21 & Lucide React", "Komponen dialog, dropdown, tabel, dan icon set"],
              ["ORM & Database", "Prisma 5.22 / PostgreSQL 15+", "Object-relational mapping dengan 20+ entitas data relasional"],
              ["Runtime Lingkungan", "Node.js 22 LTS", "Runtime server berkecepatan tinggi dengan native type stripping"]
            ],
            [25, 25, 50]
          ),

          createHeading2("Integrasi Eksternal dan Otomasi"),
          createTable(
            ["Layanan Eksternal", "Protokol / API", "Tujuan Penggunaan"],
            [
              ["Sungrow iSolarCloud OpenAPI", "REST API (HMAC SHA-256)", "Telemetri 39 plant: daya aktual, yield harian, alarm, dan inverter"],
              ["Open-Meteo Weather API", "REST API (Geocoding/Forecast)", "Data iradiansi matahari (GHI) dan suhu untuk Performance Ratio (PR)"],
              ["Web Push VAPID", "Web Push Protocol (RFC 8292)", "Pengiriman notifikasi instan browser saat terjadi fault PLTS"]
            ],
            [30, 25, 45]
          ),

          // 3. Arsitektur Aplikasi
          createHeading1("3. Arsitektur Aplikasi"),
          createParagraph(
            "SPARTA GRK menerapkan arsitektur modular berlapis (layered architecture) yang memisahkan presentasi antarmuka, business logic, integrasi telemetri, dan persistensi data:"
          ),
          createCodeBlock([
            "┌─────────────────────────────────────────────────────────────┐",
            "│  Lapisan Antarmuka Pengguna (Next.js 15 + React 19)         │",
            "│  • Ringkasan Emisi (Dashboard)   • Sumber Emisi (Scope 1-3) │",
            "│  • Pengurang Emisi (PLTS & Air)  • Riwayat Audit            │",
            "└──────────────────────────────┬──────────────────────────────┘",
            "                               │ fetch REST",
            "┌──────────────────────────────▼──────────────────────────────┐",
            "│  API Routes Layer (20+ REST Endpoints)                      │",
            "│  /api/plts, /api/emissions, /api/scope1-3, /api/auth, dll.  │",
            "└──────────────────────────────┬──────────────────────────────┘",
            "                               │",
            "┌──────────────────────────────▼──────────────────────────────┐",
            "│  Lapisan Logika Bisnis (lib/)                               │",
            "│  • carbonEngine (Kalkulasi Scope 1, 2, 3)                   │",
            "│  • solar/sync & performanceRatio (Model Sandia/King)        │",
            "│  • scope3/travelLedger & IATA Airport Locator               │",
            "└──────────────────────────────┬──────────────────────────────┘",
            "                               │ Prisma ORM",
            "┌──────────────────────────────▼──────────────────────────────┐",
            "│  Basis Data Relasional (PostgreSQL 15+)                     │",
            "│  plant_latest, daily_yield, monthly_yield, energy_flow, ... │",
            "└─────────────────────────────────────────────────────────────┘"
          ]),

          // 4. Fitur Utama
          createHeading1("4. Fitur-Fitur Utama Sistem"),
          createHeading2("4.1 Ringkasan Emisi dan Neraca Karbon"),
          createBullet("Menyajikan neraca emisi bersih (Net GHG Emissions): total emisi kotor (Scope 1 + 2 + 3) dikurangi emisi yang dihindarkan dari PLTS dan daur ulang air.", "Neraca Karbon Eksekutif:"),
          createBullet("Simulasi langsung emisi dari berbagai sumber operasional (BBM, listrik, bahan bakar, refrigeran, LPG) didukung 60+ faktor emisi standar IPCC.", "Kalkulator Emisi Interaktif:"),
          createBullet("Rekomendasi tindakan reduksi emisi otomatis berdasarkan proporsi emisi terbesar yang terdeteksi.", "Rekomendasi Reduksi:"),

          createHeading2("4.2 Sumber Emisi (Scope 1, 2, 3)"),
          createBullet("Pencatatan konsumsi bahan bakar (Solar/Biosolar, Pertalite, Pertamax) per DC dengan faktor emisi Pedoman Inventarisasi GRK ESDM (Solar: 2,6685, Pertalite: 2,2951, Pertamax: 2,2868 kgCO2e/liter).", "Scope 1 (Bahan Bakar Fosil):"),
          createBullet("Perhitungan konsumsi listrik grid PLN pada 8 regional dengan faktor emisi resmi ESDM 2024 (JAMALI: 0,870 kgCO2e/kWh, Sumatera: 0,761 kgCO2e/kWh, dll.). Dilengkapi rekonsiliasi tarif listrik per golongan pelanggan.", "Scope 2 (Listrik Grid PLN):"),
          createBullet("Import berkas jurnal perjalanan dinas akuntansi (akun 611402 & 621402), deteksi otomatis kode bandara IATA (misal: CGK, SUB, KNO), dan kalkulasi emisi penerbangan dengan faktor DEFRA 2024.", "Scope 3 (Perjalanan Dinas):"),

          createHeading2("4.3 Pengurangan Emisi: PLTS Atap (39 Plant / 5.876 kWp)"),
          createBullet("Daya aktual (kW), yield energi harian (kWh), dan total energi kumulatif (MWh) diperbarui setiap 5 menit pada jam matahari (05:30 - 18:30 WIB).", "Telemetri Real-Time:"),
          createBullet("Specific Yield (kWh/kWp), Equivalent Hours, dan Performance Ratio (PR) bulanan dengan koreksi temperatur silikon panel surya (-0,45%/°C dari STC 25°C).", "Analitik Kinerja PLTS:"),
          createBullet("Matriks kinerja 39 plant x 12 bulan yang memetakan yield, beban, ekspor, dan pencapaian terhadap target RKAP perusahaan.", "Matriks & Target RKAP:"),
          createBullet("Energi terhindar (faktor 0,997 kgCO2/kWh), setara batubara terhindar (0,4 kg/kWh), dan ekuivalen pohon tertanam (21,77 kgCO2/pohon/tahun).", "Metrik Keberlanjutan:"),

          createHeading2("4.4 Pengurangan Emisi: Daur Ulang Air"),
          createBullet("Input dan monitoring volume air hasil proses daur ulang per DC per bulan untuk mengurangi beban konsumsi air tanah dan emisi pengolahan limbah.", "Daur Ulang Air:"),

          createHeading2("4.5 Tata Kelola dan Keamanan"),
          createBullet("Log audit lengkap atas seluruh penginputan, perubahan, dan penghapusan data emisi untuk menjaga keandalan data pada saat audit.", "Audit Trail:"),
          createBullet("Autentikasi sesi menggunakan HMAC-SHA256 cookie, proteksi rute middleware Edge Runtime, dan pemisahan bearer token untuk jadwal CRON.", "Autentikasi & Otorisasi:"),
          createBullet("Notifikasi peramban berbasis Web Push VAPID untuk deteksi kegagalan inverter atau alarm plant secara seketika.", "Web Push Alarm:"),

          // 5. Kelebihan dan Keunggulan Sistem
          createHeading1("5. Kelebihan dan Keunggulan Sistem"),
          createParagraph("Dibandingkan metode pencatatan konvensional berbasis spreadsheet manual, SPARTA GRK memiliki keunggulan fundamental:"),
          createTable(
            ["Keunggulan", "Detail Implementasi Teknis & Manfaat Nyata"],
            [
              [
                "1. Kepatuhan Regulasi & Siap Audit",
                "Seluruh formula terikat pada regulasi resmi Kementerian ESDM No. 414.K/2024 dan Pedoman Inventarisasi GRK Nasional. Dilengkapi riwayat audit trail multi-sumber sehingga angka siap diaudit oleh auditor eksternal ESG tanpa keraguan integritas data."
              ],
              [
                "2. Otomasi IoT & Proteksi Kuota API",
                "Telemetri 39 plant PLTS atap berjalan secara otomatis menggunakan daemon terjadwal (solar-daemon.mjs). Dilengkapi mekanisme pelindung kuota API per jam, harian, dan bulanan agar tidak melampaui batas kuota API vendor Sungrow."
              ],
              [
                "3. Pemodelan Fisika Silikon yang Akurat",
                "Menghitung rasio performa (Performance Ratio) dengan koreksi temperatur silikon nyata (-0,45%/°C) berdasarkan model standar Sandia/King dan data iradiansi satelit Open-Meteo, memberikan angka akurasi performa PLTS di iklim tropis Indonesia."
              ],
              [
                "4. Otomatisasi Parsing Akuntansi Scope 3",
                "Parser cerdas mengekstrak data dari berkas transaksi jurnal keuangan akuntansi, membaca kode IATA bandara secara otomatis, dan menghitung jarak penerbangan Haversine + 50 km uplift tanpa entri manual."
              ],
              [
                "5. Rekonsiliasi Data Ganda (Dual-Source)",
                "Menghubungkan jalur sinkronisasi API OpenAPI dengan fitur import laporan bulanan resmi iSolarCloud. Sistem melakukan rekonsiliasi data silang untuk mendeteksi deviasi jika terjadi gangguan koneksi internet lokal di DC."
              ],
              [
                "6. Arsitektur Teruji & Bebas Galat Tipe",
                "Didukung TypeScript strict mode terintegrasi Prisma ORM dengan verifikasi pnpm run typecheck (0 errors) dan lebih dari 40 skrip pengujian otomatis (unit test, isolated DB test, stabilization test)."
              ]
            ],
            [30, 70]
          ),

          // 6. Skema Database
          createHeading1("6. Skema Basis Data (Model Utama)"),
          createTable(
            ["Nama Model", "Tipe Data & Fungsi Utama", "Volume Tipikal"],
            [
              ["PlantLatest", "Telemetri status dan daya terkini per plant PLTS", "39 baris"],
              ["DailyYield", "Snapshot yield energi harian per plant surya", "39 plant x 365 hari/thn"],
              ["MonthlyYield", "Yield bulanan per plant dari API atau berkas impor", "39 plant x 12 bulan/thn"],
              ["MonthlyYieldObservation", "Audit trail multi-sumber untuk rekonsiliasi yield", "Variabel (multi-source)"],
              ["EnergyFlowMonthly", "Neraca energi bulanan: yield, feed-in, purchased, load", "39 plant x 12 bulan/thn"],
              ["ClimateMonthly", "Data cuaca bulanan per lokasi plant (GHI, temperatur)", "36 lokasi x 12 bulan/thn"],
              ["LoadMonthly", "Beban konsumsi listrik bulanan per lokasi DC", "39 plant x 12 bulan/thn"],
              ["TargetMonthly", "Target realisasi produksi energi RKAP tahunan", "Variabel per metrik"],
              ["SyncRun", "Log audit riwayat setiap siklus sinkronisasi telemetri", "~5.000 entri / bulan"],
              ["QuotaCounter", "Pencatat pemakaian kuota API vendor per jam/hari/bulan", "Pelindung kuota API"],
              ["AlarmEvent", "Riwayat alarm operasional dan status fault inverter", "Perekam insiden"],
              ["Scope3TravelEntry", "Pencatatan emisi perjalanan dinas per tiket penerbangan", "Buku besar Scope 3"],
              ["WaterRecycleEntry", "Pencatatan volume air daur ulang per DC per bulan", "Pencatat reduksi air"],
              ["AppUser", "Manajemen kredensial login (role: admin, viewer)", "2 pengguna sistem"],
              ["PushSubscription", "Token langganan Web Push browser perangkat terdaftar", "Sistem notifikasi"]
            ],
            [28, 52, 20]
          ),

          // 7. Metodologi Formula Emisi
          createHeading1("7. Formula dan Metodologi Perhitungan Emisi"),
          createParagraph("Berikut ringkasan formula matematis yang diimplementasikan di dalam sistem:"),
          createHeading3("Scope 1 (BBM Fosil)"),
          createCodeBlock(["Emisi (kgCO2e) = Volume Bahan Bakar (liter) × Faktor Emisi (kgCO2e/liter)"]),
          createHeading3("Scope 2 (Listrik Grid PLN)"),
          createCodeBlock(["Emisi (kgCO2e) = Konsumsi Listrik (kWh) × Faktor Emisi Grid Regional (kgCO2e/kWh)"]),
          createHeading3("Scope 3 Kategori 6 (Penerbangan Dinas)"),
          createCodeBlock([
            "Emisi (kgCO2e) = Jarak Tempuh (km) × Faktor Emisi Penumpang-km (kgCO2e/pax-km)",
            "Jarak Tempuh = Great-Circle Distance (Haversine) + 50 km (Uplift Factor DEFRA)"
          ]),
          createHeading3("Pengurangan Emisi dari PLTS Atap"),
          createCodeBlock(["Emisi Terhindar (kgCO2e) = Energi Mandiri PLTS (kWh) × 0,997 kgCO2/kWh"]),
          createHeading3("Perhitungan Performance Ratio (PR) PLTS"),
          createCodeBlock([
            "PR_standar   = Energi Aktual (kWh) / [ Kapasitas Terpasang (kWp) × Iradiansi Matahari (kWh/m²) ]",
            "PR_terkoreksi = PR_standar / [ 1 + gamma × (Temperatur_Panel - 25°C) ]",
            "Temperatur_Panel = Suhu_Lingkungan + (Iradiansi / 800) × (NOCT - 20°C)",
            "Keterangan: gamma = -0,45%/°C, NOCT = 45°C."
          ]),

          // 8. Panduan Deployment dan Perintah Operasional
          createHeading1("8. Panduan Operasional dan Perintah Pengembangan"),
          createParagraph("Perintah utama yang digunakan dalam pengembangan dan pemeliharaan sistem:"),
          createCodeBlock([
            "# Menjalankan server pengembangan (Next.js)",
            "pnpm run dev",
            "",
            "# Verifikasi type safety TypeScript (harus 0 errors)",
            "pnpm run typecheck",
            "",
            "# Menjalankan suite pengujian",
            "pnpm test                     # Unit tests",
            "pnpm run test:db:isolated     # Isolated DB tests",
            "pnpm run test:data:readonly   # Readonly endpoint tests",
            "pnpm run test:all             # Seluruh suite pengujian",
            "",
            "# Menjalankan daemon telemetri PLTS",
            "pnpm run daemon",
            "",
            "# Import dan rekonsiliasi data historis",
            "pnpm run import:isolar-history",
            "pnpm run import:energy-flow",
            "pnpm run import:rkap-targets",
            "",
            "# Kompilasi produksi (Docker / Dokploy)",
            "pnpm run build"
          ]),

          // 9. Atribusi & Referensi Regulasi
          createHeading1("9. Referensi Regulasi dan Atribusi Data"),
          createBullet("Keputusan Dirjen Ketenagalistrikan Kementerian Energi dan Sumber Daya Mineral No. 414.K/TL.04/DJL.4/2024 tentang Nilai Faktor Emisi GRK Pembangkitan Listrik Sistem Ketenagalistrikan PT PLN (Persero).", "Regulasi Scope 2:"),
          createBullet("Pedoman Penyelenggaraan Inventarisasi Gas Rumah Kaca Nasional, Kementerian Lingkungan Hidup dan Kehutanan (KLHK) dan Kementerian ESDM.", "Regulasi Scope 1:"),
          createBullet("DEFRA (Department for Environment, Food & Rural Affairs) / BEIS 2024 Greenhouse Gas Reporting: Conversion Factors.", "Regulasi Scope 3:"),
          createBullet("Intergovernmental Panel on Climate Change (IPCC) 2006 Guidelines for National Greenhouse Gas Inventories.", "Standar Internasional:"),
          createBullet("Open-Meteo.com, berlisensi Creative Commons Attribution 4.0 International (CC BY 4.0).", "Data Cuaca Satelit:")
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.resolve("docs/SPARTA-GRK.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document successfully generated at: ${outputPath}`);
}

buildDocx().catch((err) => {
  console.error("Error generating docx:", err);
  process.exit(1);
});
