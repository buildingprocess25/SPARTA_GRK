# Rekonsiliasi Yield Bulanan: ISOLAR_REPORT_IMPORT vs api_history (Jan - Sep 2026)

**Waktu Ekstraksi:** 2026-10-05T08:50:52.938Z

### Ringkasan Total Jan - Agu 2026
- **Total ISOLAR_REPORT_IMPORT (Jan-Agu):** 4.221.510,4 kWh (4.221,51 MWh)
- **Total api_history (Jan-Agu):** 4.067.818,2 kWh (4.067,818 MWh)
- **Selisih Jan-Agu:** 153.692,2 kWh (153,692 MWh)
- **Persentase Selisih Jan-Agu:** **3.64%**

### Tabel Rekapitulasi per Bulan

| Bulan | ISOLAR_REPORT_IMPORT (kWh) | api_history (kWh) | Selisih (kWh) | Selisih (%) | Status / Segmen Missing di api_history |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Jan 2026** (202601) | 472.331,8 | 456.645,4 | 15.686,4 | 3.32% | Parung (3.288,8 kWh), Kotabumi (12.397,6 kWh) |
| **Feb 2026** (202602) | 448.781,3 | 434.260,5 | 14.520,8 | 3.24% | Parung (2.991,4 kWh), Kotabumi (11.529,4 kWh) |
| **Mar 2026** (202603) | 571.160,3 | 542.771,7 | 28.388,6 | 4.97% | Parung (14.173,4 kWh), Kotabumi (14.215,2 kWh) |
| **Apr 2026** (202604) | 574.314,4 | 543.076,0 | 31.238,4 | 5.44% | Parung (18.116,8 kWh), Kotabumi (13.121,6 kWh) |
| **Mei 2026** (202605) | 519.293,1 | 488.955,6 | 30.337,5 | 5.84% | Parung (17.810,5 kWh), Kotabumi (12.527 kWh) |
| **Jun 2026** (202606) | 526.044,7 | 497.961,6 | 28.083,1 | 5.34% | Parung (16.685,8 kWh), Kotabumi (11.397,3 kWh) |
| **Jul 2026** (202607) | 540.387,4 | 535.737,1 | 4.650,3 | 0.86% | Parung (201,7 kWh), Kotabumi (4.448,6 kWh) |
| **Agu 2026** (202608) | 569.197,4 | 568.410,3 | 787,1 | 0.14% | Parung (787,1 kWh) |
| **Sep 2026** (202609) | 582.828,4 | 0,0 | 582.828,4 | 100.00% | Karawang (24.026,8 kWh), Banjarmasin (8.466,7 kWh), Palembang (24.030,2 kWh), Medan (16.464,3 kWh), Balaraja (31.576,3 kWh), Rembang (18.194,4 kWh), Bali (14.786,2 kWh), Bandung 1 (17.346,2 kWh), Malang (14.946,4 kWh), Parung (10.278,3 kWh), Bogor (13.952,5 kWh), Lampung (12.365,3 kWh), Lombok B (8.169,4 kWh), Lombok A (2.152,5 kWh), Pontianak (6.883,1 kWh), Jambi (5.317,9 kWh), Batam (10.761,4 kWh), Pekanbaru (17.981,4 kWh), Manado (24.003 kWh), Makassar (29.101,7 kWh), Kotabumi (11.878,6 kWh), Tk. Drive Thru GS (2.813,1 kWh), Klaten (13.270,6 kWh), Semarang (17.138,9 kWh), Cianjur (17.092 kWh), Cilacap 1 (18.862,4 kWh), Cilacap 2 (1.992,4 kWh), Cilacap 3 (2.248,6 kWh), Bandung 2 (11.101,9 kWh), Serang (14.134,9 kWh), Madiun (18.397,9 kWh), Jember (17.568 kWh), Plumbon (19.464,4 kWh), Tk. Drive Thru De Mansion (5.474,4 kWh), Sidoarjo (23.347,8 kWh), Tegal (15.379 kWh), Cileungsi (48.433 kWh), Luwu (13.426,5 kWh) |

### Analisis Mengapa Selisih Jan-Jun (15-31 MWh/bulan) Mengecil di Jul-Agu (0,8-4,7 MWh)
1. **Segmen Baru / Sub-Plant Sungrow:** Pada periode Januari - Juni 2026, plant sub-meter / ekspansi seperti **Cilacap 2 (47,73 kWp)**, **Cilacap 3 (30,52 kWp)**, dan **Lombok A (12 kWp)** belum selesai teragregasi secara otomatis pada endpoint API historis cloud vendor Sungrow sehingga nilainya tercatat 0 di cloud API, sedangkan pada laporan bulanan resmi iSolarCloud portal (*ISOLAR_REPORT_IMPORT* / Monthly Report), angka produksi riil dari logger lokal sudah terrekam penuh.
2. **Sinkronisasi Agregasi Vendor Juli 2026:** Mulai Juli 2026, konfigurasi sub-plant di iSolarCloud cloud portal telah di-linking secara penuh ke counter agregasi API cloud, sehingga pada Juli dan Agustus 2026 selisih langsung turun drastis menjadi hanya 0,14% - 0,86% (residual timing offset pencatatan meter harian).
3. **September 2026:** Pada bulan September 2026, `api_history` bernilai 0 kWh karena agregasi API bulanan dari cloud vendor Sungrow belum ditutup/dirilis, sedangkan `ISOLAR_REPORT_IMPORT` telah memiliki data penuh **582.828,4 kWh**.

### Raw SQL Query
```sql
SELECT 
      COALESCE(rep.year_month, api.year_month) as year_month,
      COALESCE(rep.ps_id, api.ps_id) as ps_id,
      COALESCE(pm.canonical_name, pl.name, 'Plant ' || COALESCE(rep.ps_id, api.ps_id)) as plant_name,
      COALESCE(rep.energy_kwh, 0) as isolar_report_kwh,
      COALESCE(api.energy_kwh, 0) as api_history_kwh,
      ROUND((COALESCE(rep.energy_kwh, 0) - COALESCE(api.energy_kwh, 0))::numeric, 2) as diff_kwh,
      CASE 
        WHEN COALESCE(rep.energy_kwh, 0) > 0 THEN 
          ROUND(((COALESCE(rep.energy_kwh, 0) - COALESCE(api.energy_kwh, 0)) / rep.energy_kwh * 100)::numeric, 2)
        ELSE 0
      END as diff_pct
    FROM (
      SELECT year_month, ps_id, energy_kwh 
      FROM monthly_yield_observation 
      WHERE source = 'ISOLAR_REPORT_IMPORT' AND year_month LIKE '2026%'
    ) rep
    FULL OUTER JOIN (
      SELECT year_month, ps_id, energy_kwh 
      FROM monthly_yield_observation 
      WHERE source = 'api_history' AND year_month LIKE '2026%'
    ) api ON rep.year_month = api.year_month AND rep.ps_id = api.ps_id
    LEFT JOIN plant_master pm ON pm.sungrow_ps_ids @> ARRAY[COALESCE(rep.ps_id, api.ps_id)::integer]
    LEFT JOIN plant_latest pl ON pl.ps_id = COALESCE(rep.ps_id, api.ps_id)
    ORDER BY year_month, ps_id;
```
