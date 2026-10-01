# Alfamart Sustainability Dashboard — Integrasi PLTS iSolarCloud OpenAPI

Dokumentasi arsitektur, rekonsiliasi data, pemetaan status resmi, dan manajemen kuota telemetri PLTS Atap Alfamart.

---

## 1. Rekonsiliasi Entitas: 36 Lokasi (39 Plant) vs Baseline 41 Baris

| Sumber / Layer | Jumlah Baris/Entitas | Total Kapasitas | Keterangan |
| :--- | :---: | :---: | :--- |
| **Sungrow iSolarCloud OpenAPI (Live)** | **39 Plant Fisik** | **5.876,12 kWp** | Seluruh plant fisik yang terdaftar di akun OpenAPI Sungrow. |
| **Baseline Audit Unik (Baris 1–39)** | **39 Plant Fisik** | **5.748,35 kWp** | Baris 1 s.d. 39 pada file `monitorPltsApril2026.json`. |
| **Baseline Mentah + Roll-up (Baris 1–41)** | **41 Baris** | **6.039,35 kWp** | **Duplikasi:** Baris 40 (*Lombok* 86 kWp) dan Baris 41 (*Cilacap* 205 kWp) adalah baris agregat roll-up dari sub-plant yang sudah tercantum di baris sebelumnya. |
| **Entitas Kanonikal Dashboard (UI)** | **36 Lokasi (39 Plant)** | **5.876,12 kWp** | 34 lokasi tunggal + 2 lokasi gabungan multi-plant: Cilacap (1+2+3) dan Lombok (A+B). Sub-plant disajikan sebagai baris rincian tanpa penghitungan ganda. |

---

## 2. Pemetaan Status Resmi dari Dokumentasi Vendor (Sungrow OpenAPI)

Sesuai spesifikasi resmi Sungrow OpenAPI:

| Field API | Nilai | Definisi Resmi | Penurunan Badge Dashboard |
| :--- | :---: | :--- | :--- |
| **`ps_status`** | `1` | Online (Stasiun Terhubung) | Diturunkan menjadi **Online** |
| | `0` | Offline (Stasiun Terputus) | Diturunkan menjadi **Offline** (hanya jika `ps_status = 0`) |
| **`ps_fault_status`** | `3` | Normal | Diturunkan menjadi **Normal** jika tidak ada alarm |
| | `2` | Alarm | Diturunkan menjadi **Alarm** jika `alarm_count > 0` atau `ps_fault_status = 2` |
| | `1` | Fault | Diturunkan menjadi **Fault** jika `fault_count > 0` atau `ps_fault_status = 1` |
| **`alarm_count`** | Integer | Jumlah alarm aktif pada stasiun | Menampilkan jumlah alarm (misal: `Alarm (1)`) |
| **`fault_count`** | Integer | Jumlah fault/kerusakan aktif | Menampilkan jumlah fault (misal: `Fault (1)`) |

> **Catatan Status Level Perangkat ("Offline device: 1")**:  
> Pada beberapa lokasi (misal: Kotabumi dan Bogor), portal iSolarCloud dapat menampilkan catatan "Offline device: 1" meskipun stasiun tetap menghasilkan daya (>60 kW) dan `ps_status = 1`. Hal ini terjadi karena perangkat komunikasi/meter sekunder tidak melapor. Dashboard menerapkan badge *"perangkat tidak melapor"* pada tingkat perangkat jika umur `device_time` > 30 menit pada jam produksi, tanpa mengubah status stasiun menjadi offline.

---

## 3. Investigasi Titik Ukur PR (Performance Ratio) Vendor

### Hasil Pengujian Titik Ukur:
1. **Titik `83023` (PR Vendor Realtime)**: Berdasarkan pengujian empiris langsung pada 39 stasiun, titik `83023` mengembalikan rasio daya terhadap iradiasi sesaat (*instantaneous PR* $= P_{ac} / (P_{dc} \cdot G / 1000)$).
   - Pada kondisi iradiasi rendah (mis. Manado $G = 6\text{ W/m}^2$), nilai titik `83023` melonjak ke `13.87` (tidak valid).
   - Pada kondisi iradiasi tinggi (mis. Makassar $G = 748\text{ W/m}^2$), nilai titik `83023` adalah `0.8025` (setara 80,3%).
   - Titik `83023` **bukan** PR kumulatif harian pembangkit (*Daily Plant PR*).
2. **Titik `83010` & `83007`**: Mengembalikan nilai string kosong (`""`) atau `null` di seluruh stasiun.
3. **Kesimpulan**: Tidak ada titik ukur OpenAPI yang secara konsisten cocok dengan Plant PR portal resmi (Manado portal 90% vs raw 13.87; Makassar portal 83% vs raw 0.8025). Oleh karena itu, PR vendor berstatus **"tidak terbukti"** dan kolom PR vendor disembunyikan di UI.

### Status Metrik PR di Dashboard:
- **Metrik Ranking Utama**: Murni menggunakan **Specific Yield Hari Ini (kWh/kWp)** dan **Equivalent Hours (API Live)**.
- **Proxy PR**: Estimasi rasio performa bulanan berbasis audit April 2026 ($(\text{Yield April} / (\text{Kapasitas} \times 126\text{ PSH})) \times 100\%$) diberi label eksplisit *"Proxy PR (perkiraan, berbasis audit April 2026)"*.
- **PR Portal (Manual)**: Disimpan di tabel `portal_pr_reference` sebagai pembanding manual resmi.

---

## 4. Emisi Karbon & Penghasilan (Income)

- **Faktor Emisi Implisit Vendor**: Vendor menggunakan faktor implisit $0{,}997\text{ kg CO}_2\text{/kWh}$ (dihitung dari `co2_reduce / yield`).
- **Faktor Emisi Dashboard Proyek**: Proyek secara konsisten menggunakan standar faktor emisi jaringan listrik nasional sebesar **$0{,}83\text{ kg CO}_2\text{e/kWh}$**.
- **Mata Uang `today_income`**: Nilai `today_income` yang dikembalikan oleh API Sungrow menggunakan mata uang **INR (Indian Rupee)**, bukan Rupiah (IDR). Field ini **tidak digunakan** di dashboard sustainability.

---

## 5. Model Kuota & Rate Limiting (Hourly, Daily, & Monthly)

Sesuai spesifikasi resmi Sungrow OpenAPI:
- **Hourly Limit (`HOURLY_LIMIT`):** **2.000 Call / Jam** (Reset otomatis setiap jam UTC).
- **Daily Limit (`DAILY_LIMIT`):** **48.000 Call / Hari** (Reset otomatis pukul 00:00 UTC).
- **Monthly Limit (`MONTHLY_LIMIT`):** **100.000 Call / Bulan** (Reset otomatis tanggal 1 setiap bulan pukul 00:00 UTC).

> **Catatan Penghitungan Bulanan**:  
> Endpoint `getOpenApiCallInfo` hanya mengembalikan counter `curr_hour_accessed_times` dan `today_accessed_times`. Penghitungan kuota bulanan merupakan **perkiraan akumulasi lokal** dari tabel `quota_counter`.

### Ritme Sinkronisasi dan Kuota:
- Polling telemetri berjalan setiap **5 menit** pada jam produksi (05:30–18:30 WIB), sedangkan snapshot historis disimpan pada slot **30 menit**. Satu siklus dapat memakai lebih dari satu request karena data stasiun, perangkat, alarm, inverter, dan metrik eksperimental diambil dari endpoint berbeda. Karena itu pemakaian bulanan tidak dihitung sebagai `26 × 30`; gunakan counter aktual pada `quota_counter` dan guard kuota dashboard.

---

## 6. Validasi Telemetri: Inverter vs Plant

Pengujian dalam **satu siklus sampling serentak** membuktikan bahwa total daya dan energi dari seluruh inverter (`p24` current power dalam W dan `p1` daily yield dalam Wh; `p4` suhu internal inverter) **100% identik (selisih 0,0%)** dengan metrik stasiun (`curr_power` dan `today_energy`). Selisih 25–40% sebelumnya terjadi semata-mata karena perbedaan waktu pencatatan (asinkron) antar request.
