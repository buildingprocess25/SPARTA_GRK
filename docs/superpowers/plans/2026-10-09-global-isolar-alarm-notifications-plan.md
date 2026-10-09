# Rencana Implementasi Notifikasi Alarm Global iSolar

Spec: `docs/superpowers/specs/2026-10-09-global-isolar-alarm-notifications-design.md`

## Global Constraints

- Polling vendor tetap hanya dilakukan scheduler server; browser hanya membaca database.
- Provider alarm hidup pada root aplikasi dan tidak bergantung pada tab PLTS.
- Read state tersimpan per browser, tanpa migrasi Prisma.
- Snapshot awal tidak mengirim toast atau Browser Notification.
- Layout PLTS selain blok status operasional tidak diubah.
- Setiap task memakai RED→GREEN dan diakhiri commit terpisah.

## Task 1 — Kontrak alarm dan endpoint read-only

**Produces:** normalizer alarm kanonis, summary per sumber, dan `GET /api/alarms`.

1. Tambahkan unit test untuk klasifikasi Alert/Fault, resolusi DC, fallback DC, urutan, dan summary.
2. Jalankan test dan pastikan gagal karena modul belum tersedia.
3. Implementasikan konfigurasi serta pure normalizer di `src/lib/alarms`.
4. Implementasikan service query read-only dan route API tanpa memanggil `runSync`.
5. Tambahkan test kontrak route dan jalankan seluruh test task sampai lulus.
6. Commit task.

## Task 2 — Provider polling global dan daftar alarm

**Consumes:** kontrak API Task 1.  
**Produces:** `AlarmProvider`, hook global, deduplikasi, read state, toast, Browser Notification, badges, dan dialog.

1. Tambahkan test pure state/deduplikasi dan test kontrak provider/UI.
2. Jalankan test dan pastikan gagal.
3. Implementasikan helper state serta `AlarmProvider` dengan polling 15 detik.
4. Implementasikan `AlarmBadges` dan `AlarmDialog` berbasis `BaseModal`.
5. Pasang provider bersama overlay root dan jalankan test sampai lulus.
6. Commit task.

## Task 3 — Integrasi navigasi dan PLTS

**Consumes:** hook, badges, dan dialog Task 2.  
**Produces:** badge PLTS global dan ringkasan Alert/Fault yang dapat diklik.

1. Tambahkan test kontrak untuk badge sidebar dan penggantian judul `Plant offline`.
2. Jalankan test dan pastikan gagal.
3. Hubungkan Sidebar ke state alarm global dan tindakan buka dialog.
4. Ganti hanya blok status operasional PLTS dengan ringkasan Alert/Fault.
5. Jalankan test task, lint, dan build/test suite relevan sampai lulus.
6. Commit task.

## Task 4 — Review akhir dan perbaikan

1. Jalankan seluruh unit test dan lint.
2. Lakukan review seluruh diff terhadap spec, khususnya duplicate notification, cleanup timer, accessibility, data fallback, dan tidak adanya vendor call dari browser.
3. Perbaiki temuan Critical/Important dengan test RED→GREEN.
4. Jalankan kembali suite penuh dan commit perbaikan bila ada.

## Review Focus

- Alarm lama tidak boleh dianggap alarm baru saat mount atau reload.
- Pergantian tab tidak boleh menghentikan polling atau mereset baseline.
- Kegagalan API tidak boleh mengosongkan alarm terakhir.
- Pemetaan multi-plant harus menghasilkan satu nama DC kanonis.
- Permission browser tidak boleh diminta otomatis.
- API tidak boleh mengirim kredensial/raw vendor atau memicu sync.
- Badge, daftar, dan ringkasan harus memakai summary yang sama.
