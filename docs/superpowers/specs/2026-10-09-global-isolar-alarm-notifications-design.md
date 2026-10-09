# Desain Notifikasi Alarm Global iSolar

Tanggal: 9 Oktober 2026  
Status: menunggu tinjauan pengguna

## Tujuan

Menambahkan sistem alarm yang tetap aktif selama aplikasi dashboard terbuka, tanpa bergantung pada tab yang sedang dilihat. Versi pertama memakai data alarm iSolar untuk **Kelistrikan PLTS Atap**, menampilkan jumlah Alert dan Fault pada navigasi, menyediakan daftar alarm yang dapat ditandai sudah dibaca, serta memunculkan toast dan Browser Notification untuk alarm baru.

Sistem menggunakan polling. Tidak ada Web Push saat browser ditutup, service worker, VAPID, atau webhook pada lingkup ini.

## Keputusan Arsitektur

Alur data yang dipilih:

```text
iSolar getFaultAlarmInfo
        |
        | scheduler sinkronisasi server yang sudah ada
        v
FaultActive + FaultHistory + PlantMaster
        |
        v
GET /api/alarms
        |
        | polling ringan selama dashboard terbuka
        v
AlarmProvider di root dashboard
        +-- badge navigasi
        +-- ringkasan Alert/Fault PLTS
        +-- daftar alarm
        +-- toast global
        +-- Browser Notification API
```

Polling dipilih karena integrasi produksi yang tersedia sudah memakai `getFaultAlarmInfo` dan scheduler server. Tidak ada kontrak webhook iSolar dalam aplikasi saat ini. SSE tidak dipilih karena tidak diperlukan untuk target kesegaran data sekarang dan menambah koneksi server berumur panjang.

## Kesegaran Data

- Scheduler server tetap menjadi satu-satunya pihak yang meminta data ke iSolar. Siklus yang ada sekitar lima menit dan tunduk pada jendela produksi serta pembatas kuota.
- `AlarmProvider` membaca `/api/alarms` setiap 15 detik dengan `cache: 'no-store'`.
- Polling UI hanya membaca database dan tidak memanggil vendor, sehingga pergantian tab atau banyak komponen tidak menambah kuota iSolar.
- Istilah real-time pada fitur ini berarti alarm muncul otomatis tanpa refresh setelah tersedia di database. Latensi sumber tetap terutama ditentukan oleh siklus sinkronisasi iSolar.
- Polling berhenti ketika komponen root dilepas. Ketika dokumen tidak terlihat, interval boleh diperlambat untuk mengurangi beban, tetapi notifikasi tetap diperiksa selama dashboard masih terbuka.

## Kontrak Alarm Kanonis

Endpoint mengembalikan bentuk yang tidak mengikat UI pada nama kolom iSolar:

```text
alarm:
  id                 # faultCode; stabil untuk deduplikasi
  source             # ISOLAR_PLTS
  sourceTab          # plts
  dcId
  dcName
  kind               # ALERT | FAULT
  title              # faultName
  occurredAt
  status             # ACTIVE | RESOLVED
  vendorType
  vendorLevel
  updatedAt

summary:
  alertCount
  faultCount
  activeCount
  latestUpdatedAt
```

Untuk data aktif, `processStatus = 8` dinormalisasi menjadi `ACTIVE`. Data iSolar yang sudah ditutup dan dibaca dari riwayat dapat dinormalisasi sebagai `RESOLVED` bila kelak daftar riwayat ditampilkan.

Klasifikasi mengikuti aturan status yang sudah dipakai aplikasi: `faultType = 1` menjadi `FAULT`; entri aktif lainnya menjadi `ALERT`. Nilai vendor asli tetap dikirim sebagai metadata agar dapat diaudit dan agar pemetaan bisa disempurnakan tanpa kehilangan data.

Nama DC ditentukan melalui pemetaan `psId` ke `PlantMaster.sungrowPsIds`/registry DC kanonis. Bila pemetaan tidak ditemukan, endpoint memakai nama plant terakhir dan tidak membuang alarm.

## Endpoint Alarm

`GET /api/alarms` bersifat read-only dan menerima filter opsional seperti `source`, `status`, dan `limit`. Respons utama berisi alarm aktif terbaru dan summary per sumber/tab.

Karakteristik endpoint:

- mengurutkan Fault lebih dahulu, lalu waktu terbaru;
- tidak memicu sinkronisasi iSolar;
- tidak mengubah `FaultActive` atau `FaultHistory`;
- mengembalikan waktu ISO dan membiarkan UI memformatnya ke WIB;
- mengirim header tanpa cache agar polling tidak membaca respons lama;
- mengembalikan daftar kosong yang valid ketika tidak ada alarm;
- memakai batas jumlah baris untuk menjaga payload tetap kecil.

Status sudah dibaca tidak disimpan di database karena belum ada identitas pengguna. Read state adalah preferensi per browser.

## Provider Global dan State Klien

`AlarmProvider` ditempatkan bersama provider overlay pada root aplikasi, di luar cabang render tab. Dengan demikian polling, toast, dan Browser Notification terus berjalan ketika pengguna berada di Resume Emisi, Water Recycle, Scope 1, Scope 2, atau Riwayat Audit.

Provider menyimpan:

```text
alarms[]
summaryBySource
readIds
isPanelOpen
isLoading
lastSuccessfulPollAt
pollError
notificationPermission
initialSnapshotComplete
```

`readIds` disimpan di `localStorage` dengan versi skema dan dibatasi pada ID yang masih relevan agar penyimpanan tidak terus membesar. Perubahan `storage` menyelaraskan read state antartab browser.

Snapshot respons pertama menjadi baseline dan tidak menghasilkan toast maupun Browser Notification. Pada polling berikutnya, hanya ID aktif yang belum pernah terlihat yang dianggap alarm baru. ID dipakai untuk deduplikasi sehingga alarm yang sama tidak berbunyi berulang kali.

Kegagalan polling mempertahankan data terakhir yang berhasil. Kesalahan sementara tidak mengosongkan badge dan tidak menghasilkan notifikasi palsu.

## Browser Notification dan Toast

Toast memakai `ToastProvider` yang sudah tersedia dan muncul di seluruh tab aplikasi. Fault memakai varian error/merah, sedangkan Alert memakai warning/kuning.

Browser Notification memakai Web Notifications API tanpa service worker:

- izin hanya diminta melalui tombol eksplisit **Aktifkan notifikasi browser** di panel alarm;
- bila izin `granted`, alarm baru menampilkan notifikasi berisi jenis, nama DC, dan judul alarm;
- bila API tidak tersedia atau izin ditolak, badge, panel, dan toast tetap bekerja;
- tidak ada notifikasi saat dashboard sudah ditutup;
- notifikasi tidak dibuat untuk baseline awal atau alarm yang sudah pernah terlihat;
- banyak alarm dalam satu polling diringkas agar tidak membanjiri pengguna, dengan Fault sebagai prioritas tertinggi.

## UI dan Interaksi

### Navigasi

- Submenu **Kelistrikan PLTS Atap** menampilkan badge merah untuk jumlah Fault dan badge kuning untuk jumlah Alert.
- Badge bersumber dari `AlarmProvider`, sehingga tetap terlihat walaupun pengguna sedang membuka halaman lain.
- Struktur provider dan summary bersifat `sourceTab`-aware. Tab lain dapat memperoleh badge dari sumber alarm berikutnya tanpa membuat polling baru.
- Pada versi ini hanya `ISOLAR_PLTS` yang memiliki sumber alarm terbukti; tab tanpa data alarm tidak menampilkan badge kosong atau alarm buatan.

### Ringkasan PLTS

Blok **Plant offline: N** diganti menjadi ringkasan yang dapat diklik:

```text
Status alarm iSolar
[N Fault] [N Alert]
Lihat daftar alarm
```

Status offline tetap boleh tampil sebagai informasi operasional sekunder di daftar/status telemetri, tetapi bukan judul utama blok alarm.

### Daftar Alarm

Ringkasan atau badge membuka dialog berbasis `BaseModal` yang sudah ada. Daftar minimal menampilkan:

- nama DC;
- jenis `Alert` atau `Fault`;
- nama/keterangan alarm;
- waktu kejadian dalam WIB;
- status `Aktif` atau `Selesai`;
- indikator `Baru`/`Sudah dibaca`.

Daftar menyediakan filter Semua, Fault, Alert, dan Belum dibaca; tombol **Tandai dibaca** per baris; serta **Tandai semua sudah dibaca**. Membuka dialog tidak otomatis membaca seluruh alarm agar penanda tetap bermakna.

## Ekstensibilitas untuk Tab Lain

Provider tidak berisi logika khusus komponen PLTS. Setiap sumber alarm mendaftarkan `source`, `sourceTab`, label, dan warna severity melalui konfigurasi tunggal. Ketika Water Recycle atau sumber lain mempunyai API alarm nyata, endpoint dapat menggabungkan record ke kontrak kanonis yang sama dan navigasi cukup membaca summary untuk `sourceTab` terkait.

Lingkup versi ini tidak membuat alarm sintetis untuk tab yang belum mempunyai sumber data alarm.

## Error dan Empty State

- Tidak ada alarm: panel menampilkan kondisi normal dan waktu pemeriksaan terakhir.
- Polling gagal: data terakhir tetap terlihat bersama indikator bahwa pembaruan tertunda.
- Nama DC tidak ditemukan: tampilkan nama plant/vendor atau `DC tidak terpetakan`.
- Waktu vendor tidak valid: tampilkan waktu tidak tersedia tanpa menggagalkan seluruh respons.
- Notification API tidak didukung: kontrol aktivasi dinonaktifkan dengan keterangan singkat.
- Izin notifikasi ditolak: jangan meminta izin berulang otomatis; arahkan pengguna ke pengaturan browser.

## Keamanan dan Privasi

- Endpoint hanya mengekspos data operasional alarm yang dibutuhkan UI, bukan kredensial atau respons vendor mentah.
- Token iSolar tetap hanya digunakan oleh sinkronisasi server.
- `localStorage` hanya menyimpan ID alarm yang dibaca/dilihat dan versi skema, bukan token atau payload vendor.
- Judul Browser Notification dibatasi dan diperlakukan sebagai teks biasa.

## Strategi Pengujian

### Unit dan API

- normalisasi `faultType = 1` menjadi Fault dan tipe aktif lain menjadi Alert;
- pemetaan `psId` tunggal maupun multi-plant ke nama DC kanonis;
- status dan waktu terformat konsisten;
- summary Alert/Fault sama dengan isi daftar;
- urutan severity lalu waktu;
- respons kosong dan fallback plant yang tidak terpetakan;
- endpoint tidak menjalankan `runSync` atau mutasi database.

### Provider

- polling berjalan dari root saat tab selain PLTS aktif;
- baseline awal tidak mengirim notifikasi;
- ID baru mengirim satu toast dan paling banyak satu Browser Notification ringkasan;
- alarm yang sama tidak mengirim ulang;
- read state pulih dari `localStorage` dan tersinkron antartab;
- polling gagal mempertahankan state terakhir;
- timer dan event listener dibersihkan saat unmount.

### UI

- badge merah/kuning tampil pada submenu PLTS dengan angka yang benar;
- klik badge atau ringkasan membuka daftar alarm;
- daftar menampilkan DC, jenis, waktu, status, dan read state;
- filter dan tindakan tandai dibaca bekerja;
- ringkasan lama **Plant offline** tidak lagi menjadi judul blok;
- tampilan tetap dapat digunakan pada desktop dan mobile serta dialog dapat dioperasikan dengan keyboard.

## File yang Direncanakan

### Ditambahkan

- `src/app/api/alarms/route.js`
- `src/context/AlarmContext.jsx`
- `src/components/alarms/AlarmDialog.jsx`
- `src/components/alarms/AlarmBadges.jsx`
- `src/lib/alarms/normalize.js`
- `src/lib/alarms/config.js`
- unit test normalisasi, endpoint, provider, dan kontrak UI.

### Diubah

- `src/components/ui/OverlayProviders.jsx`: memasang `AlarmProvider` di root.
- `src/components/Sidebar.jsx`: menampilkan badge sumber alarm pada menu terkait dan membuka daftar.
- `src/app/page.js`: menghubungkan tindakan buka daftar bila diperlukan oleh navigasi root.
- `src/components/PLTSTab.jsx`: mengganti ringkasan Plant offline dengan ringkasan Alert/Fault yang dapat diklik.
- Bila diperlukan, `src/lib/solar/plantMap.js` atau helper yang sudah ada dipakai ulang untuk resolusi DC tanpa menduplikasi registry.

Tidak direncanakan perubahan skema Prisma karena tabel alarm aktif/riwayat sudah tersedia dan read state disimpan per browser.

## Kriteria Selesai

- Alarm iSolar baru muncul otomatis tanpa refresh selama dashboard terbuka.
- Pemantauan tetap aktif pada seluruh tab dashboard, bukan hanya tab PLTS/iSolar.
- Badge Alert/Fault, ringkasan PLTS, dan daftar alarm memakai sumber serta hitungan yang sama.
- Daftar menampilkan nama DC, jenis, waktu, status, dan penanda sudah dibaca.
- Toast dan Browser Notification tidak berulang untuk ID yang sama dan tidak menyala pada baseline awal.
- Status dibaca bertahan setelah refresh pada browser yang sama.
- Tab tanpa sumber alarm tidak menampilkan data palsu.
- Tidak ada panggilan tambahan langsung dari browser ke iSolar dan tidak ada perubahan layout lain di PLTS.
