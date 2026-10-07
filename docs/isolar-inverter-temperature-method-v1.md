# Metode Suhu Inverter iSolarCloud v1

Metode dasar adalah `isolar-inverter-temp-v1`. Versi efektif berbentuk:

`isolar-inverter-temp-v1+rp-<12 karakter awal SHA-256 registry>`

Registry rated power berada di `config/inverter-rated-power.v1.json`. Hanya rating dari metadata vendor atau dokumen produsen resmi dengan `sourceRef` yang boleh ditambahkan. Kapasitas plant tidak boleh dibagi atau dipakai untuk menebak rating inverter.

## Perubahan registry

Setiap perubahan byte registry menghasilkan hash dan versi efektif baru. Raw sample tidak disalin atau dimutasi karena unique identity-nya tetap `(device_sn, device_time)`. Agregat harian dan bulanan dihitung ulang dari raw sample menggunakan versi efektif baru dan disimpan berdampingan dengan versi lama.

Dashboard membaca tepat satu versi efektif aktif dari konfigurasi server. Versi baru hanya boleh diaktifkan setelah:

1. registry dan sumbernya ditinjau;
2. agregat periode yang diperlukan selesai dihitung ulang;
3. coverage dan daftar `MISSING_RATED_POWER` dibandingkan;
4. operator mengganti versi aktif secara eksplisit.

Versi tidak pernah digabung otomatis. Menambah rating tidak mengubah hasil versi lama dan tidak langsung mengubah dashboard.

## Slot dan run manual

Hanya run `scheduler` yang memiliki `scheduled_slot_at` dan dapat memengaruhi coverage. Run `manual` selalu menyimpan `scheduled_slot_at=NULL`; observasinya tetap tersimpan untuk validasi tetapi dikeluarkan dari pembilang dan penyebut coverage produksi.

Scheduler belum diaktifkan oleh implementasi Fase 2.
