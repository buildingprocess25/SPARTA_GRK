# Panduan Deployment & Operasional Sinkronisasi PLTS Dashboard

Dokumen ini memuat panduan lengkap penerapan (deployment) aplikasi Dashboard PLTS dan otomatisasi sinkronisasi data harian iSolarCloud pada server produksi (Linux VPS / Biznet Gio / Ubuntu / Debian) serta lingkungan pengembangan (Windows).

---

## 1. Arsitektur & Kebutuhan Sistem

- **Runtime**: Node.js v20.x atau v22.x LTS, npm v10+
- **Database**: PostgreSQL 15+ (Prisma ORM)
- **Web Server**: Nginx Reverse Proxy (SSL/TLS Termination)
- **Process Manager**: systemd (disarankan) atau PM2
- **Jadwal Sync**: Pukul **20:00 WIB (Asia/Jakarta)** setiap malam (setelah matahari terbenam dan sebelum reset tengah malam iSolarCloud).

---

## 2. Variabel Lingkungan (`.env` / `.env.local`)

Pastikan file konfigurasi memiliki izin ketat (`chmod 600 .env`):

Daftar lengkap beserta penjelasannya ada di `.env.example`. Yang wajib untuk produksi:

```bash
# Runtime
NODE_ENV=production
TZ=Asia/Jakarta            # wajib: jadwal sync, logout 19.00 WIB, dan reset kuota memakai WIB
PORT=3001

# Database
DATABASE_URL="postgresql://user:password@host:5432/sparta_db?schema=public"

# iSolarCloud OpenAPI (server-side saja, JANGAN pakai prefix NEXT_PUBLIC_)
ISOLAR_MODE=live
ISOLAR_BASE_URL="https://gateway.isolarcloud.com.hk"
ISOLAR_APP_KEY=...
ISOLAR_SECRET_KEY=...
ISOLAR_USER_ACCOUNT=...
ISOLAR_USER_PASSWORD=...

# Autentikasi
AUTH_SESSION_SECRET=...            # openssl rand -hex 32
AUTH_ADMIN_PASSWORD_HASH=...       # node scripts/hash-password.mjs "password"
AUTH_VALENS_PASSWORD_HASH=...
AUTH_DEFAULT_ACCOUNT_PASSWORD=     # opsional; tanpa ini akun peran bawaan yang belum ada tidak dibuat

# Keamanan cron & revalidasi
CRON_SECRET=...
REVALIDATE_SECRET_TOKEN=...

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # juga sebagai Build Arg di Docker
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT="mailto:..."
```

Tidak ada lagi password bawaan di kode. Akun yang dibuat versi lama dengan password `ptsat123` tetap ada di database; ganti password akun tersebut lewat menu Profil > Akun.

---

## 3. Instalasi & Build Aplikasi

```bash
# 1. Masuk ke direktori proyek
cd /var/www/plts-dashboard

# 2. Pasang dependensi (Dockerfile juga memakai npm ci)
npm ci

# 3. Terapkan migrasi Prisma yang belum jalan (prisma/migrations)
npx prisma migrate deploy

# 4. Build aplikasi Next.js
npm run build
```

**Lockfile.** Pengembangan lokal memakai pnpm (`pnpm-lock.yaml`), sedangkan Dockerfile menjalankan `npm ci` dari `package-lock.json`. Setiap kali menambah atau mengubah dependency, perbarui keduanya (`pnpm install` lalu `npm install --package-lock-only --ignore-scripts`). Kalau tidak, build Docker gagal dengan `npm ci can only install packages when your package.json and package-lock.json are in sync`.

**Migrasi 2026-10-21: `plant_pr_monthly`.** Menyimpan PR bulanan resmi per plant dari iSolarCloud. Setelah `prisma migrate deploy`, isi data awal sekali (sekitar 2 permintaan API):

```bash
node --env-file=.env scripts/data/backfill-isolar-monthly-pr.mjs 202601
```

Selanjutnya scheduler menarik PR bulan berjalan dan bulan lalu setiap 3 jam, bersama data energi bulanan. Sebelum migrasi ini diterapkan, dashboard tetap jalan dan memakai PR hitungan lama.

---

## 4. Layanan Web Service (systemd)

Buat file `/etc/systemd/system/plts-web.service`:

```ini
[Unit]
Description=PLTS Dashboard Next.js Web App
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/plts-dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=plts-web

[Install]
WantedBy=multi-user.target
```

Aktifkan dan jalankan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable plts-web
sudo systemctl start plts-web
```

---

## 5. Otomatisasi Sinkronisasi iSolarCloud (systemd Service + Timer)

Sinkronisasi harian dijalankan setiap hari pukul 20:00 WIB.

### 5.1 Service Unit: `/etc/systemd/system/isolar-sync.service`

```ini
[Unit]
Description=iSolarCloud Daily Telemetry Sync
After=network.target plts-web.service

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/var/www/plts-dashboard
EnvironmentFile=/var/www/plts-dashboard/.env
ExecStart=/usr/bin/node scripts/sync-isolar.mjs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=isolar-sync
```

### 5.2 Timer Unit: `/etc/systemd/system/isolar-sync.timer`

```ini
[Unit]
Description=Run iSolarCloud Sync Daily at 20:00 WIB (Asia/Jakarta)

[Timer]
# 20:00 WIB (UTC+7) = 13:00 UTC
OnCalendar=*-*-* 13:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

Aktifkan timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable isolar-sync.timer
sudo systemctl start isolar-sync.timer

# Cek jadwal timer berikutnya
systemctl list-timers isolar-sync.timer
```

### 5.3 Opsi Alternatif: Crontab

Jika tidak menggunakan systemd timer, tambahkan baris berikut ke `crontab -e`:

```bash
# Menjalankan sync setiap pukul 20:00 WIB (13:00 UTC)
0 13 * * * cd /var/www/plts-dashboard && /usr/bin/node scripts/sync-isolar.mjs >> /var/log/isolar-sync.log 2>&1
```

---

## 6. Konfigurasi Windows Task Scheduler (Pengembangan Lokal)

Untuk menjalankan sync harian di laptop/server Windows:

1. Buka **Task Scheduler** (`taskschd.msc`).
2. Klik **Create Task**:
   - **General**: Beri nama `PLTS_iSolarCloud_Sync`, centang *Run with highest privileges*.
   - **Triggers**: *New* -> *Daily*, atur jam `20:00:00` (WIB).
   - **Actions**: *New* -> *Start a program*:
     - **Program/script**: `C:\Program Files\nodejs\node.exe`
     - **Add arguments**: `scripts\sync-isolar.mjs`
     - **Start in**: `C:\ALfa\Test`
3. Simpan dan uji coba dengan klik kanan -> **Run**.

---

## 7. Konfigurasi Nginx Reverse Proxy & Proteksi Endpoint Revalidasi

Buat atau perbarui `/etc/nginx/sites-available/plts.conf`:

```nginx
server {
    listen 80;
    server_name plts.internal.alfamart.co.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name plts.internal.alfamart.co.id;

    ssl_certificate /etc/ssl/certs/plts.crt;
    ssl_certificate_key /etc/ssl/private/plts.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Blokir akses publik ke endpoint revalidasi internal
    location /api/plts/revalidate {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Routing aplikasi utama
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Pemeliharaan & Monitoring

### Memeriksa Log Sinkronisasi
```bash
# Log Real-time Sync
journalctl -u isolar-sync -f

# Log Web Application
journalctl -u plts-web -f
```

### Manual Trigger / Simulasi Dry-Run
```bash
# Uji coba tanpa menulis ke DB
node scripts/sync-isolar.mjs --dry-run

# Eksekusi sync live manual
node scripts/sync-isolar.mjs
```

---

## 9. Prosedur Bulanan: Impor Laporan Resmi iSolarCloud (Closing Bulanan)

Sejak 19 Oktober 2026 scheduler menarik energi bulanan (listrik beli PLN, beban, produksi PLTS, ekspor) langsung dari API iSolarCloud setiap 3 jam pada jam sync, untuk bulan lalu dan bulan berjalan, dengan sumber `ISOLAR_API` (`src/lib/solar/energyFlowSync.js`). Angka API terbukti sama dengan Monthly Report portal; bulan berjalan tampil sebagai "sementara". Impor laporan di bawah tetap menjadi closing resmi dan otomatis mengalahkan angka API.

Pada awal setiap bulan (setelah bulan sebelumnya berakhir dan laporan resmi diunduh dari portal iSolarCloud):

1. **Unduh Laporan Resmi**:
   - Buka portal web iSolarCloud -> *Report Management* -> *Annual Report* / *Monthly Yield Report*.
   - Ekspor laporan dalam format CSV / Excel untuk 39 plant.
   - Simpan file CSV ke direktori root atau direktori import (mis. `Monthly Yield_Annual report_YYYYMMDD.csv`).

2. **Jalankan Skrip Impor Idempotent**:
   ```bash
   # Jalankan import dengan verifikasi hash otomatis
   node scripts/import-isolar-annual-reports.mjs
   ```

3. **Verifikasi Hash & Integritas Data**:
   - Skrip secara otomatis menghitung SHA-256 hash file untuk mencegah duplikasi impor.
   - Observasi baru disimpan dengan `source: 'ISOLAR_REPORT_IMPORT'` dan `quality_status: 'FINAL'`.
   - Data sementara (`api_live_partial`) untuk bulan tersebut secara otomatis digantikan oleh laporan resmi sesuai aturan precedence.

4. **Rekonsiliasi dengan Data Harian**:
   - Jalankan audit rekonsiliasi selisih akumulasi harian API vs laporan resmi:
     ```bash
     node scripts/audit-history-vs-baseline.mjs
     ```
   - Catat selisih persentase per plant untuk memastikan toleransi akurasi telemetri harian.

---

## 10. Keamanan Token OpenAPI & Lokasi Penyimpanan Cache

1. **Lokasi Penyimpanan**:
   - Token OpenAPI dan status rate limit disimpan secara lokal di file:
     ```
     /var/www/plts-dashboard/.data/solar_store.json
     ```
   - Direktori `.data/` dikecualikan dari Git tracking (`.gitignore`) dan **tidak pernah di-commit ke repository**.

2. **Pengamanan Hak Akses (Permissions)** di VPS:
   ```bash
   # Batasi akses direktori dan file token hanya untuk user web/service
   chmod 700 /var/www/plts-dashboard/.data
   chmod 600 /var/www/plts-dashboard/.data/solar_store.json
   ```

3. **Rotasi Token**:
   - Token kedaluwarsa secara otomatis diperbarui oleh `apiClient.js` sebelum waktu `expiresAt`.
   - Jika kredensial di `.env` diubah, hash kredensial akan berubah dan cache token lama akan dibersihkan secara aman.

