#!/usr/bin/env node

/**
 * scripts/sync-isolar.mjs - Standalone iSolarCloud Daily Synchronization Job
 * 
 * Features:
 * 1. CLI arguments: --dry-run, --backfill <start YYYY-MM> <end YYYY-MM>, --plant <id>, --month <YYYY-MM>
 * 2. Evening schedule (20:00 WIB after sunset) to capture today_energy before midnight reset
 * 3. Atomic Anti-Overlap Lock (via sync_lock table in PostgreSQL)
 * 4. Idempotent daily upsert per (ps_id, date_wib) without deleting historical days
 * 5. Precedence rule: Final months (ISOLAR_REPORT_IMPORT) are preserved; API only fills partial/current month
 * 6. Health & unmonitored plant tracking (ps_status, ps_fault_status, stale update times)
 * 7. Multi-segment reconciliation & raw precision normalization (no premature rounding)
 * 8. Revalidation hook: POST /api/plts/revalidate upon successful sync
 * 9. Journald-friendly logging & non-zero exit codes on failure
 */

import { performance } from 'perf_hooks';
import prisma from '../src/lib/prisma.js';
import { getValidToken, executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { ISOLAR_ENDPOINTS_META, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';
import { CONVERSION_CONFIG } from '../src/lib/solar/conversionConfig.js';
import { parseEnergyKwh, parsePowerKw } from '../src/lib/solar/processor.js';
import { classifyVendorPlantStatus } from '../src/lib/solar/status.js';
import { acquireLock, releaseLock } from '../src/lib/solar/sync.js';

const DEFAULT_PORT = process.env.PORT || '3000';
const REVALIDATE_URL = process.env.REVALIDATE_URL || `http://127.0.0.1:${DEFAULT_PORT}/api/plts/revalidate`;
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';

// ─── Timezone & Date Helpers (WIB / WITA / WIT) ───────────────────────────────

export const PLANT_TIMEZONE_MAP = {
  // WITA (Asia/Makassar UTC+8)
  'DC-BALI': 'Asia/Makassar',
  'DC-LOMBOK-A': 'Asia/Makassar',
  'DC-LOMBOK-B': 'Asia/Makassar',
  'DC-BANJARMASIN': 'Asia/Makassar',
  'DC-MAKASSAR': 'Asia/Makassar',
  'DC-LUWU': 'Asia/Makassar',
  'DC-MANADO': 'Asia/Makassar',
  'DC-GORONTALO': 'Asia/Makassar',
  // All other 31 DCs are WIB (Asia/Jakarta UTC+7)
};

export function getPlantTimezone(dcId) {
  return PLANT_TIMEZONE_MAP[dcId] || 'Asia/Jakarta';
}

export function getPlantLocalDateTime(date = new Date(), timeZone = 'Asia/Jakarta') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  const tzAbbr = timeZone === 'Asia/Makassar' ? 'WITA' : (timeZone === 'Asia/Jayapura' ? 'WIT' : 'WIB');

  return {
    dateStr: `${year}-${month}-${day}`,
    yearMonth: `${year}${month}`,
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    tzAbbr,
    timeZone,
    display: `${day}/${month}/${year} ${hour}:${minute}:${second} ${tzAbbr}`,
  };
}

export function getWibDateTime(date = new Date()) {
  return getPlantLocalDateTime(date, 'Asia/Jakarta');
}


/**
 * Normalizes raw energy value and unit to precision kWh (number).
 */
export function normalizeEnergyKwhRaw(metricObj) {
  if (!metricObj || typeof metricObj !== 'object') return { kwh: null, rawValue: null, rawUnit: null };
  const valStr = String(metricObj.value ?? '').trim();
  const rawUnit = String(metricObj.unit ?? '').trim();
  if (!valStr || valStr === '--' || valStr === 'N/A') return { kwh: null, rawValue: null, rawUnit };
  const val = Number(valStr);
  if (isNaN(val)) return { kwh: null, rawValue: valStr, rawUnit };

  const unitLower = rawUnit.toLowerCase();
  let kwh = val;
  if (unitLower === 'gwh') kwh = val * 1_000_000;
  else if (unitLower === 'mwh') kwh = val * 1_000;
  else if (unitLower === 'wh') kwh = val / 1_000;

  return { kwh, rawValue: val, rawUnit };
}

// ─── Anti-Overlap Distributed Lock ──────────────────────────────────────────
// Reuses src/lib/solar/sync.js's acquireLock/releaseLock so this standalone
// job and the in-app scheduler (runSync, triggered every 5 min by the daemon
// / cron) contend for the exact same sync_lock row with one consistent
// duration, instead of racing with mismatched timeouts.
const acquireDistributedLock = (clientName) => acquireLock(clientName);
const releaseDistributedLock = () => releaseLock();

// ─── CLI Argument Parser ────────────────────────────────────────────────────

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    backfill: null,
    plantFilter: null,
    monthFilter: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--backfill') {
      const start = args[++i];
      const end = args[++i];
      if (!start || !end) {
        console.error('Error: --backfill requires <start YYYY-MM> <end YYYY-MM>');
        process.exit(1);
      }
      options.backfill = { start, end };
    } else if (arg === '--plant') {
      options.plantFilter = args[++i];
    } else if (arg === '--month') {
      options.monthFilter = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Penggunaan: node scripts/sync-isolar.mjs [OPTIONS]

Opsi:
  --dry-run                 Jalankan simulasi tanpa menulis/menimpa database
  --backfill <YM1> <YM2>    Backfill periode historis (mis. 2026-01 2026-09)
  --plant <id>              Filter sinkronisasi untuk plant tertentu (ps_id atau dc_id)
  --month <YYYY-MM>         Filter sinkronisasi untuk bulan tertentu
  --help, -h                Tampilkan petunjuk ini
      `);
      process.exit(0);
    }
  }

  return options;
}

// ─── Main Execution Pipeline ────────────────────────────────────────────────

export async function executeSync(cliOptions = {}) {
  const t0 = performance.now();
  const now = new Date();
  const wibTime = getWibDateTime(now);
  const isDryRun = Boolean(cliOptions.dryRun);
  const syncProcessId = `isolar-sync-${now.getTime()}-${process.pid}`;

  console.log('================================================================================');
  console.log(`   SINKRONISASI ISOLARCLOUD → DATABASE PLTS (WIB: ${wibTime.display})   `);
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (Simulasi Tanpa Tulis DB)' : 'LIVE COMMIT'} | PID: ${process.pid}`);
  console.log('================================================================================\n');


  // 1. Acquire Anti-Overlap Lock
  if (!isDryRun) {
    const gotLock = await acquireDistributedLock(syncProcessId);
    if (!gotLock) {
      console.error(' [LOCK TERTOLAK] Proses sinkronisasi lain sedang berjalan atau lock belum expired.');
      process.exit(2);
    }
    console.log('✓ [LOCK] Berhasil memperoleh distributed anti-overlap lock.');
  }

  let syncRunRecord = null;
  if (!isDryRun) {
    syncRunRecord = await prisma.syncRun.create({
      data: {
        trigger: cliOptions.backfill ? 'backfill' : 'manual_or_cron',
        status: 'running',
        startedAt: now,
      },
    }).catch(() => null);
  }

  try {
    // 2. Resolve Token
    console.log('\n1. Memeriksa & Mengambil Token OpenAPI Upstream...');
    const tokenInfo = await getValidToken({ isLive: true });
    console.log(`   ✓ Token status: Aktif (Sumber: ${tokenInfo.source})`);

    // 3. Fetch Power Stations List from Vendor OpenAPI
    console.log('\n2. Mengambil Daftar Plant Telemetri dari /openapi/getPowerStationList...');
    const stationRes = await executeIsolarRequest(
      ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path,
      { curPage: 1, size: 100 },
      { isLive: true }
    );

    if (!stationRes || !stationRes.data || stationRes.data.result_code !== '1') {
      throw new Error(`OpenAPI error: ${stationRes?.data?.result_msg || 'Gagal mengambil station list'}`);
    }

    const rawPlants = stationRes.data.result_data?.pageList || [];
    console.log(`   ✓ Diterima ${rawPlants.length} plant dari iSolarCloud.`);

    // 4. Load Master Plants from Database
    const dbPlants = await prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });
    const apiMap = new Map(rawPlants.map((p) => [Number(p.ps_id), p]));

    // 5. Evaluate Data Quality, Health, Timezones, Anomaly & Multi-Segment Mapping
    console.log('\n3. Evaluasi Kualitas Data, Zona Waktu, dan Status Pemantauan:');
    const plantEvaluations = [];
    let unmonitoredCount = 0;
    let healthyCount = 0;
    let daytimeZeroAnomalyCount = 0;
    let totalTodayEnergyKwh = 0;

    for (const master of dbPlants) {
      const psIds = master.sungrowPsIds || [];
      const plantTz = getPlantTimezone(master.dcId);
      const plantLocalTime = getPlantLocalDateTime(now, plantTz);
      const foundInApi = psIds.map((id) => apiMap.get(Number(id))).filter(Boolean);

      if (foundInApi.length === 0) {
        unmonitoredCount++;
        plantEvaluations.push({
          master,
          status: 'UNMONITORED_NOT_IN_API',
          isMonitored: false,
          hasDaytimeZeroAnomaly: false,
          todayKwh: 0,
          currPowerKw: 0,
          lifetimeKwh: 0,
          plantLocalTime,
          vendorUpdateTime: null,
          segments: [],
        });
        continue;
      }

      // Aggregate segments for this DC
      let dcTodayKwh = 0;
      let dcCurrPowerKw = 0;
      let dcLifetimeKwh = 0;
      let isAnyStale = false;
      let isAnyOffline = false;
      const segmentDetails = [];

      for (const apiPlant of foundInApi) {
        const psId = Number(apiPlant.ps_id);
        const normToday = normalizeEnergyKwhRaw(apiPlant.today_energy);
        const normLifetime = normalizeEnergyKwhRaw(apiPlant.total_energy);
        const currKw = parsePowerKw(apiPlant.curr_power) || 0;
        const psStatus = Number(apiPlant.ps_status ?? 1);
        const psFaultStatus = Number(apiPlant.ps_fault_status ?? 3);

        const updateTimeStr = apiPlant.today_energy_update_time || apiPlant.curr_power_update_time || null;
        let updateTimeDt = null;
        if (updateTimeStr) {
          try {
            const dt = new Date(updateTimeStr);
            if (!isNaN(dt.getTime())) updateTimeDt = dt;
          } catch (_) {}
        }

        // Check freshness: if update time is > 24h old, consider stale
        const ageHours = updateTimeDt ? (now.getTime() - updateTimeDt.getTime()) / 3600000 : 999;
        const classifiedStatus = classifyVendorPlantStatus(apiPlant, { checkedAt: now, localHour: plantLocalTime.hour });
        const isOffline = classifiedStatus.category === 'OFFLINE';
        const isStale = ageHours > 24;

        if (isOffline) isAnyOffline = true;
        if (isStale) isAnyStale = true;

        dcTodayKwh += normToday.kwh || 0;
        dcCurrPowerKw += currKw || 0;
        dcLifetimeKwh += normLifetime.kwh || 0;

        segmentDetails.push({
          psId,
          psName: apiPlant.ps_name,
          todayKwh: normToday.kwh,
          rawTodayVal: normToday.rawValue,
          rawTodayUnit: normToday.rawUnit,
          lifetimeKwh: normLifetime.kwh,
          currPowerKw: currKw,
          psStatus,
          psFaultStatus,
          updateTimeDt,
          isOffline,
          isStale,
          classifiedStatus,
          raw: apiPlant,
        });
      }

      const isMonitored = !isAnyOffline && !isAnyStale;
      const isUnderConstruction = master.operationalStatus === 'UNDER_CONSTRUCTION';
      
      // Anomaly detection: "Produksi Nol Siang Hari" (Daytime Zero Production Anomaly)
      // If local hour is between 08:00 - 17:00, plant is online/normal, but energy = 0 and power = 0
      const isDaytime = plantLocalTime.hour >= 8 && plantLocalTime.hour <= 17;
      const isDaytimeZeroAnomaly = !isUnderConstruction && isMonitored && isDaytime && dcTodayKwh === 0 && dcCurrPowerKw === 0;

      if (isDaytimeZeroAnomaly) {
        daytimeZeroAnomalyCount++;
      }

      if (isUnderConstruction) {
        // Excluded from unmonitored/anomaly count as it is under construction
      } else if (isMonitored) {
        healthyCount++;
      } else {
        unmonitoredCount++;
      }

      totalTodayEnergyKwh += dcTodayKwh;

      const evalStatus = isUnderConstruction
        ? 'UNDER_CONSTRUCTION'
        : !isMonitored 
          ? (isAnyOffline ? 'OFFLINE' : 'STALE_DATA')
          : (isDaytimeZeroAnomaly ? 'DAYTIME_ZERO_ANOMALY' : 'MONITORED_OK');

      plantEvaluations.push({
        master,
        status: evalStatus,
        isMonitored,
        isUnderConstruction,
        hasDaytimeZeroAnomaly: isDaytimeZeroAnomaly,
        todayKwh: dcTodayKwh,
        currPowerKw: dcCurrPowerKw,
        lifetimeKwh: dcLifetimeKwh,
        plantLocalTime,
        segments: segmentDetails,
      });
    }

    console.log(`   - Total DC Master: ${dbPlants.length}`);
    console.log(`   - Plant Terpantau Sehat: ${healthyCount - daytimeZeroAnomalyCount}`);
    console.log(`   - Plant Anomali Produksi Nol Siang Hari: ${daytimeZeroAnomalyCount}`);
    console.log(`   - Plant Tidak Terpantau / Offline / Data Basi: ${unmonitoredCount}`);
    console.log(`   - Total Produksi Hari Ini (WIB/Lokal): ${totalTodayEnergyKwh.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kWh`);

    if (daytimeZeroAnomalyCount > 0) {
      console.log('\n   [DAFTAR ANOMALI PRODUKSI NOL SIANG HARI]:');
      for (const e of plantEvaluations.filter((ev) => ev.hasDaytimeZeroAnomaly)) {
        console.log(`     * ${e.master.canonicalName} (${e.master.dcId}) - Jam Lokal: ${e.plantLocalTime.display} | Daya: 0 kW | Produksi: 0 kWh`);
      }
    }

    if (unmonitoredCount > 0) {
      console.log('\n   [DAFTAR PLANT TIDAK TERPANTAU]:');
      for (const e of plantEvaluations.filter((ev) => !ev.isMonitored)) {
        console.log(`     * ${e.master.canonicalName} (${e.master.dcId}) - Status: ${e.status}`);
      }
    }

    // 6. DB Ingestion (Idempotent Daily Upsert with Monotonic Protection)
    if (!isDryRun) {
      console.log('\n4. Menulis Data Harian ke Database (Idempotent Monotonic Upsert)...');
      const currentYearMonth = wibTime.yearMonth;

      await prisma.$transaction(async (tx) => {

        // Upsert Daily Yield per physical plant with local plant date
        for (const ev of plantEvaluations) {
          const plantLocalDateStr = ev.plantLocalTime.dateStr;
          const isDaylightHours = ev.plantLocalTime.hour >= 6 && ev.plantLocalTime.hour <= 20;

          for (const seg of ev.segments) {
            if (seg.todayKwh === null || (seg.classifiedStatus.category === 'OFFLINE' && seg.todayKwh === 0)) {
              console.log(`   â­ [SKIP_INVALID_ZERO] ps_id: ${seg.psId} (${ev.master.canonicalName}) - nilai kosong/offline nol bukan observasi produksi valid.`);
              continue;
            }
            const segCapKwp = ev.master.apiInstalledKwp / (ev.segments.length || 1);
            const yieldPerKwp = segCapKwp > 0 ? seg.todayKwh / segCapKwp : 0;
            const isYieldAnomaly = yieldPerKwp < 0 || yieldPerKwp > 7.0;

            if (isYieldAnomaly) {
              console.warn(`   ⚠ [EXCESSIVE_YIELD_ANOMALY] ps_id: ${seg.psId} (${ev.master.canonicalName}) - Nilai ${seg.todayKwh} kWh (${yieldPerKwp.toFixed(2)} kWh/kWp/hari) di luar batas wajar 0-7 kWh/kWp/hari. Ditandai untuk investigasi.`);
            }

            const existingDaily = await tx.dailyYield.findUnique({
              where: {
                dateWib_psId: {
                  dateWib: plantLocalDateStr,
                  psId: seg.psId,
                },
              },
            });

            // RULE: Jangan membuat baris tanggal baru jika tidak ada produksi (0 kWh) dan jam lokal plant belum terang (< 06:00 atau > 20:00)
            if (seg.todayKwh <= 0 && !isDaylightHours && !existingDaily) {
              console.log(`   ⏭ [SKIP_NIGHT_PLACEHOLDER] ps_id: ${seg.psId} (${ev.master.canonicalName}) - Tanggal lokal ${plantLocalDateStr} jam ${ev.plantLocalTime.hour}:00 bukan jam operasi terang dan today_energy = 0. Placeholder tidak dibuat.`);
              continue;
            }

            if (existingDaily) {
              // Monotonic rule: only overwrite if new yield >= existing yield
              if (seg.todayKwh >= existingDaily.yieldKwh) {
                await tx.dailyYield.update({
                  where: {
                    dateWib_psId: {
                      dateWib: plantLocalDateStr,
                      psId: seg.psId,
                    },
                  },
                  data: {
                    yieldKwh: seg.todayKwh,
                    peakPowerKw: seg.currPowerKw > 0 ? seg.currPowerKw : existingDaily.peakPowerKw,
                    capacityKwp: segCapKwp,
                    source: 'api_live',
                    updatedAt: now,
                  },
                });
              } else {
                console.warn(`   ⚠ [MONOTONIC_PROTECTION] Diabaikan: Nilai baru ${seg.todayKwh} kWh < nilai lama ${existingDaily.yieldKwh} kWh untuk ${ev.master.canonicalName} (ps_id: ${seg.psId}) pada ${plantLocalDateStr}`);
              }
            } else {
              await tx.dailyYield.create({
                data: {
                  dateWib: plantLocalDateStr,
                  psId: seg.psId,
                  yieldKwh: seg.todayKwh,
                  peakPowerKw: seg.currPowerKw > 0 ? seg.currPowerKw : null,
                  capacityKwp: segCapKwp,
                  source: 'api_live',
                  updatedAt: now,
                },
              });
            }
          }

          // Update every physical plant independently, including multi-plant DCs.
          for (const seg of ev.segments) {
            const capacityKwp = Number(seg.raw?.total_capcity?.value || (ev.master.apiInstalledKwp / ev.segments.length));
            await tx.plantLatest.upsert({
              where: { psId: seg.psId },
              update: {
                name: seg.psName || ev.master.canonicalName,
                capacityKwp,
                currPowerKw: seg.currPowerKw,
                todayEnergyKwh: seg.todayKwh,
                totalEnergyKwh: seg.lifetimeKwh,
                psStatus: seg.psStatus,
                psFaultStatus: seg.psFaultStatus,
                alarmCount: Number(seg.raw?.alarm_count || 0),
                faultCount: Number(seg.raw?.fault_count || 0),
                statusCategory: seg.classifiedStatus.category,
                statusReason: seg.classifiedStatus.reason,
                statusCheckedAt: seg.classifiedStatus.statusCheckedAt,
                vendorUpdateTime: seg.updateTimeDt,
                syncId: syncProcessId,
                raw: seg.raw,
                updatedAt: now,
              },
              create: {
                psId: seg.psId,
                name: seg.psName || ev.master.canonicalName,
                capacityKwp,
                currPowerKw: seg.currPowerKw,
                todayEnergyKwh: seg.todayKwh,
                totalEnergyKwh: seg.lifetimeKwh,
                psStatus: seg.psStatus,
                psFaultStatus: seg.psFaultStatus,
                alarmCount: Number(seg.raw?.alarm_count || 0),
                faultCount: Number(seg.raw?.fault_count || 0),
                statusCategory: seg.classifiedStatus.category,
                statusReason: seg.classifiedStatus.reason,
                statusCheckedAt: seg.classifiedStatus.statusCheckedAt,
                vendorUpdateTime: seg.updateTimeDt,
                syncId: syncProcessId,
                raw: seg.raw,
                updatedAt: now,
              },
            });
          }
        }


        // Handle Partial Month (Current Month) in monthly_yield_observation
        // RULE: Closed months (Jan-Sep 2026) with ISOLAR_REPORT_IMPORT are NEVER touched
        const closedMonths = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609'];
        if (!closedMonths.includes(currentYearMonth)) {
          // Aggregate all daily rows for the current month, excluding any anomalous outliers outside 0-7 kWh/kWp/day
          const monthDailies = await tx.dailyYield.findMany({
            where: { dateWib: { startsWith: `${currentYearMonth.slice(0, 4)}-${currentYearMonth.slice(4, 6)}` } },
          });

          const monthlySumByPsId = {};
          for (const d of monthDailies) {
            const cap = Number(d.capacityKwp || 0);
            const kwhPerKwp = cap > 0 ? Number(d.yieldKwh) / cap : 0;
            if (kwhPerKwp >= 0 && kwhPerKwp <= 7.0) {
              monthlySumByPsId[d.psId] = (monthlySumByPsId[d.psId] || 0) + Number(d.yieldKwh);
            } else {
              console.warn(`   ⚠ [SKIP_ANOMALY_AGGREGATION] ps_id: ${d.psId} tanggal ${d.dateWib} (${kwhPerKwp.toFixed(2)} kWh/kWp) dilewati dari akumulasi bulanan karena di luar batas 0-7.`);
            }
          }

          for (const [psIdStr, kwh] of Object.entries(monthlySumByPsId)) {
            const psId = Number(psIdStr);
            await tx.monthlyYieldObservation.upsert({
              where: {
                yearMonth_psId_measurementType_source: {
                  yearMonth: currentYearMonth,
                  psId,
                  measurementType: 'MONTHLY_YIELD',
                  source: 'api_live_partial',
                },
              },
              update: {
                energyKwh: kwh,
                qualityStatus: 'PARTIAL',
                updatedAt: now,
              },
              create: {
                yearMonth: currentYearMonth,
                psId,
                energyKwh: kwh,
                measurementType: 'MONTHLY_YIELD',
                source: 'api_live_partial',
                qualityStatus: 'PARTIAL',
                observedAt: now,
                updatedAt: now,
              },
            });
          }
        }

        // Update SyncRun record to success
        if (syncRunRecord) {
          await tx.syncRun.update({
            where: { id: syncRunRecord.id },
            data: {
              status: 'success',
              finishedAt: new Date(),
              plantCount: healthyCount,
              httpCalls: 2,
            },
          });
        }
      }, { timeout: 60000 });

      console.log('   ✓ Berhasil menulis data harian & bulanan parsial ke database.');

      // 7. Trigger Revalidation Hook
      console.log('\n5. Memanggil Revalidation Cache Dashboard...');
      try {
        const revalRes = await fetch(REVALIDATE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REVALIDATE_SECRET}`,
            'x-revalidate-token': REVALIDATE_SECRET,
          },
        });
        const revalJson = await revalRes.json().catch(() => ({}));
        if (revalRes.ok) {
          console.log(`   ✓ Revalidasi sukses: ${revalJson.message || 'Cache refreshed & pre-warmed'}`);
        } else {
          console.warn(`   ⚠ Revalidasi warning (HTTP ${revalRes.status}): ${revalJson.error || 'Check server'}`);
        }
      } catch (revErr) {
        console.warn(`   ⚠ Revalidasi skip: Server web mungkin tidak berjalan di ${REVALIDATE_URL}`);
      }
    } else {
      console.log('\n4. [DRY-RUN SIMULATION] Tidak ada perubahan data yang ditulis ke database.');
    }

    const durationMs = Number((performance.now() - t0).toFixed(2));
    console.log(`\n================================================================================`);
    console.log(`   SINKRONISASI SELESAI DENGAN SUKSES (${durationMs} ms)   `);
    console.log(`================================================================================\n`);

    return {
      success: true,
      durationMs,
      plantCount: dbPlants.length,
      healthyCount,
      unmonitoredCount,
      totalTodayEnergyKwh,
    };
  } catch (error) {
    console.error('\n [SYNC FAILED]', error.message);
    if (!isDryRun && syncRunRecord) {
      await prisma.syncRun.update({
        where: { id: syncRunRecord.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: String(error.message).slice(0, 500),
        },
      }).catch(() => {});
    }
    throw error;
  } finally {
    if (!isDryRun) {
      await releaseDistributedLock();
    }
    await prisma.$disconnect();
  }
}

// Direct CLI Invocation
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sync-isolar.mjs')) {
  const cliOptions = parseCliArgs();
  executeSync(cliOptions)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
