/**
 * 30-Minute Snapshot Engine for PLTS Telemetry & Sustainability Dashboard
 * Persists point-in-time observations to PostgreSQL via Prisma.
 * 
 * Guarantees:
 * 1. 30-minute canonical slotting (e.g. 05:30, 06:00, 06:30, ..., 18:30 WIB)
 * 2. Idempotency: Retries or concurrent workers never duplicate snapshot rows (keyed by ps_id + slot_at)
 * 3. Power vs Energy Semantic Distinction:
 *    - currPowerKw: instantaneous power (kW)
 *    - todayEnergyKwh: cumulative daily counter (kWh) - NOT sum of snapshots
 *    - totalEnergyKwh: cumulative lifetime counter (kWh)
 * 4. Stale vs Fresh Quality Status tracking:
 *    - COMPLETE: Fresh observations (<15m from vendor)
 *    - STALE: Unchanged vendor timestamp (>15m from vendor)
 *    - PARTIAL: Telemetry incomplete
 *    - OFFLINE: Plant disconnected
 * 5. Server-side execution independent of client browser
 */

import prisma from '../prisma.js';
import { getWibTimeInfo, formatWibTime, isInSyncWindow } from './sync.js';
import { CANONICAL_DC_ENTITIES } from './plantMap.js';

// ─── Slot Calculation ────────────────────────────────────────────────────────

/**
 * Compute the canonical 30-minute boundary for a given timestamp
 * @param {Date} date 
 * @returns {{ slotAt: Date, slotWib: string, isSlotBoundary: boolean, nextSlotAt: Date }}
 */
export function get30mSlotInfo(date = new Date()) {
  const timeInfo = getWibTimeInfo(date);
  const wibMs = date.getTime() + 7 * 3600_000;
  const wib = new Date(wibMs);
  
  const hour = wib.getUTCHours();
  const minute = wib.getUTCMinutes();
  
  // Floor to nearest 30-minute boundary (:00 or :30)
  const slotMinute = minute >= 30 ? 30 : 0;
  
  // Create UTC date corresponding to this WIB slot
  // wibSlotYear-Month-Day Hour:slotMinute:00 in WIB (UTC+7)
  const slotWibStr = `${timeInfo.dateWib} ${String(hour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
  
  const slotAtUtc = new Date(Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate(),
    hour - 7, // Convert WIB hour back to UTC
    slotMinute,
    0,
    0
  ));

  // Calculate next 30m slot
  const nextSlotAtUtc = new Date(slotAtUtc.getTime() + 30 * 60_000);
  const isExactBoundary = minute === 0 || minute === 30;

  return {
    slotAt: slotAtUtc,
    slotWib: slotWibStr,
    hourWib: hour,
    minuteWib: minute,
    slotMinute,
    isExactBoundary,
    nextSlotAt: nextSlotAtUtc,
    dateWib: timeInfo.dateWib,
  };
}

// ─── Snapshot Capture Engine ────────────────────────────────────────────────

/**
 * Capture 30-Minute Snapshot of all plants from DB Latest Telemetry
 * Idempotent: Uses composite unique constraint (ps_id + slot_at)
 * 
 * @param {{ trigger?: 'cron'|'daemon'|'manual'|'fallback', forceSlot?: Date }} options 
 * @returns {Promise<object>}
 */
export async function captureSnapshot30m({ trigger = 'cron', forceSlot = null } = {}) {
  const now = new Date();
  const slotInfo = forceSlot ? get30mSlotInfo(forceSlot) : get30mSlotInfo(now);
  const { slotAt, slotWib } = slotInfo;
  const startTime = Date.now();

  let capturedCount = 0;
  let staleCount = 0;
  let missingCount = 0;
  let totalPowerKw = 0;
  let totalTodayEnergyKwh = 0;
  let status = 'SUCCESS';
  let errorMessage = null;

  try {
    // 1. Fetch latest plant telemetry from database
    const latestPlants = await prisma.plantLatest.findMany({
      orderBy: { psId: 'asc' }
    });

    if (!latestPlants || latestPlants.length === 0) {
      status = 'FAILED';
      errorMessage = 'Tidak ada data di PlantLatest (database kosong / belum ada sinkronisasi)';
      
      await logSnapshotRun({
        slotAt,
        slotWib,
        status,
        totalPlants: 0,
        capturedCount: 0,
        staleCount: 0,
        missingCount: 39,
        trigger,
        durationMs: Date.now() - startTime,
        errorMessage
      });

      return {
        success: false,
        slotWib,
        slotAt: slotAt.toISOString(),
        status,
        capturedCount: 0,
        totalPlants: 0,
        error: errorMessage
      };
    }

    // 2. Build dcId lookup map from canonical definitions
    const dcMap = new Map();
    CANONICAL_DC_ENTITIES.forEach(dc => {
      (dc.sungrowPsIds || []).forEach(id => {
        dcMap.set(Number(id), { dcId: dc.dcId, dcName: dc.canonicalName });
      });
    });

    // 3. Process and write each plant snapshot idempotently (sequential loop to prevent DB connection pool exhaustion)
    for (const plant of latestPlants) {
      const psId = Number(plant.psId);
      const dcInfo = dcMap.get(psId);
      const dcId = dcInfo?.dcId || `DC-${psId}`;
      const plantName = plant.name || dcInfo?.dcName || `Plant ${psId}`;

      const currPowerKw = plant.currPowerKw;
      const todayEnergyKwh = plant.todayEnergyKwh;
      const totalEnergyKwh = plant.totalEnergyKwh;
      const capacityKwp = plant.capacityKwp || 0;
      const equivalentHour = plant.equivalentHour;
      const co2ReduceKg = plant.co2ReduceKg;
      const psStatus = plant.psStatus;
      const psFaultStatus = plant.psFaultStatus;

      const sourceObservedAt = plant.vendorUpdateTime;
      const fetchedAt = plant.updatedAt || now;
      const savedAt = now;

      // Calculate data age in minutes
      let dataAgeMinutes = null;
      if (sourceObservedAt) {
        dataAgeMinutes = Math.max(0, Math.round((now.getTime() - new Date(sourceObservedAt).getTime()) / 60_000));
      }

      // Determine quality status
      let qualityStatus = 'COMPLETE';
      if (psStatus === 0 || psStatus === 2) {
        qualityStatus = 'OFFLINE';
      } else if (dataAgeMinutes !== null && dataAgeMinutes > 20) {
        qualityStatus = 'STALE';
        staleCount++;
      } else if (currPowerKw === null || todayEnergyKwh === null) {
        qualityStatus = 'PARTIAL';
      }

      if (currPowerKw !== null) totalPowerKw += currPowerKw;
      if (todayEnergyKwh !== null) totalTodayEnergyKwh += todayEnergyKwh;

      // Execute atomic raw query or Prisma upsert to guarantee idempotency across PostgreSQL instances
      try {
        await prisma.$executeRaw`
          INSERT INTO plant_snapshot_30m (
            id, slot_at, slot_wib, ps_id, dc_id, plant_name, capacity_kwp,
            curr_power_kw, today_energy_kwh, total_energy_kwh, equivalent_hour,
            co2_reduce_kg, ps_status, ps_fault_status, source_observed_at,
            fetched_at, saved_at, data_age_minutes, quality_status, sync_id,
            source, metadata
          ) VALUES (
            ${`sn-${psId}-${slotInfo.slotWib.replace(/[:\s]/g, '-')}`},
            ${slotAt}, ${slotWib}, ${psId}, ${dcId}, ${plantName}, ${capacityKwp},
            ${currPowerKw}, ${todayEnergyKwh}, ${totalEnergyKwh}, ${equivalentHour},
            ${co2ReduceKg}, ${psStatus}, ${psFaultStatus}, ${sourceObservedAt},
            ${fetchedAt}, ${savedAt}, ${dataAgeMinutes}, ${qualityStatus}, ${plant.syncId || 'sync-0'},
            ${'api_live'}, ${'{}'}::jsonb
          )
          ON CONFLICT (ps_id, slot_at) DO UPDATE SET
            curr_power_kw = EXCLUDED.curr_power_kw,
            today_energy_kwh = EXCLUDED.today_energy_kwh,
            total_energy_kwh = EXCLUDED.total_energy_kwh,
            equivalent_hour = EXCLUDED.equivalent_hour,
            co2_reduce_kg = EXCLUDED.co2_reduce_kg,
            ps_status = EXCLUDED.ps_status,
            ps_fault_status = EXCLUDED.ps_fault_status,
            source_observed_at = EXCLUDED.source_observed_at,
            fetched_at = EXCLUDED.fetched_at,
            saved_at = EXCLUDED.saved_at,
            data_age_minutes = EXCLUDED.data_age_minutes,
            quality_status = EXCLUDED.quality_status,
            sync_id = EXCLUDED.sync_id,
            metadata = EXCLUDED.metadata;
        `;
        capturedCount++;
      } catch (err) {
        console.warn(`[Snapshot30m] Error upserting plant ${psId}:`, err.message);
        missingCount++;
      }
    }

    if (capturedCount < latestPlants.length) {
      status = 'PARTIAL';
    }

    // 4. Log the snapshot cycle
    const durationMs = Date.now() - startTime;
    await logSnapshotRun({
      slotAt,
      slotWib,
      status,
      totalPlants: latestPlants.length,
      capturedCount,
      staleCount,
      missingCount,
      totalPowerKw: Number(totalPowerKw.toFixed(2)),
      totalTodayEnergyKwh: Number(totalTodayEnergyKwh.toFixed(2)),
      trigger,
      durationMs,
      errorMessage: status === 'PARTIAL' ? `${missingCount} plant gagal diupsert` : null
    });

    return {
      success: true,
      slotWib,
      slotAt: slotAt.toISOString(),
      status,
      totalPlants: latestPlants.length,
      capturedCount,
      staleCount,
      missingCount,
      totalPowerKw: Number(totalPowerKw.toFixed(2)),
      totalTodayEnergyKwh: Number(totalTodayEnergyKwh.toFixed(2)),
      durationMs,
      trigger
    };
  } catch (error) {
    console.error('[Snapshot30m] Fatal snapshot error:', error);
    status = 'FAILED';
    errorMessage = error.message;

    await logSnapshotRun({
      slotAt,
      slotWib,
      status,
      totalPlants: 0,
      capturedCount: 0,
      staleCount: 0,
      missingCount: 0,
      trigger,
      durationMs: Date.now() - startTime,
      errorMessage
    });

    return {
      success: false,
      slotWib,
      slotAt: slotAt.toISOString(),
      status: 'FAILED',
      error: error.message
    };
  }
}

/**
 * Log Snapshot Run execution
 */
async function logSnapshotRun(runData) {
  try {
    await prisma.$executeRaw`
      INSERT INTO snapshot_run_30m (
        id, slot_at, slot_wib, status, total_plants, captured_count,
        stale_count, missing_count, total_power_kw, total_today_energy_kwh,
        trigger, duration_ms, error_message, started_at, finished_at
      ) VALUES (
        ${`run-${runData.slotWib.replace(/[:\s]/g, '-')}`},
        ${runData.slotAt}, ${runData.slotWib}, ${runData.status}, ${runData.totalPlants},
        ${runData.capturedCount}, ${runData.staleCount}, ${runData.missingCount},
        ${runData.totalPowerKw || 0}, ${runData.totalTodayEnergyKwh || 0}, ${runData.trigger},
        ${runData.durationMs || 0}, ${runData.errorMessage || null}, ${new Date()}, ${new Date()}
      )
      ON CONFLICT (slot_at) DO UPDATE SET
        status = EXCLUDED.status,
        total_plants = EXCLUDED.total_plants,
        captured_count = EXCLUDED.captured_count,
        stale_count = EXCLUDED.stale_count,
        missing_count = EXCLUDED.missing_count,
        total_power_kw = EXCLUDED.total_power_kw,
        total_today_energy_kwh = EXCLUDED.total_today_energy_kwh,
        trigger = EXCLUDED.trigger,
        duration_ms = EXCLUDED.duration_ms,
        error_message = EXCLUDED.error_message,
        finished_at = EXCLUDED.finished_at;
    `;
  } catch (err) {
    console.warn('[Snapshot30m] Warning logging snapshot_run_30m:', err.message);
  }
}

// ─── Query & Inspection APIs ────────────────────────────────────────────────

/**
 * Get snapshot audit history for a given slot or date range
 */
export async function getSnapshotHistory({ slotWib = null, dateWib = null, limit = 48 } = {}) {
  try {
    let runs = [];
    if (slotWib) {
      runs = await prisma.$queryRaw`
        SELECT * FROM snapshot_run_30m WHERE slot_wib = ${slotWib} ORDER BY slot_at DESC LIMIT ${limit}
      `;
    } else if (dateWib) {
      runs = await prisma.$queryRaw`
        SELECT * FROM snapshot_run_30m WHERE slot_wib LIKE ${`${dateWib}%`} ORDER BY slot_at DESC LIMIT ${limit}
      `;
    } else {
      runs = await prisma.$queryRaw`
        SELECT * FROM snapshot_run_30m ORDER BY slot_at DESC LIMIT ${limit}
      `;
    }

    let snapshots = [];
    if (slotWib) {
      snapshots = await prisma.$queryRaw`
        SELECT * FROM plant_snapshot_30m WHERE slot_wib = ${slotWib} ORDER BY ps_id ASC
      `;
    }

    return {
      runs,
      snapshots,
      count: runs.length
    };
  } catch (err) {
    console.warn('[Snapshot30m] Error getting history:', err.message);
    return { runs: [], snapshots: [], count: 0, error: err.message };
  }
}

/**
 * Read snapshot status report
 */
export async function getSnapshotStatusReport() {
  const now = new Date();
  const timeInfo = getWibTimeInfo(now);
  const slotInfo = get30mSlotInfo(now);

  try {
    const [lastRun, lastSync, totalSnapshotsToday] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM snapshot_run_30m ORDER BY slot_at DESC LIMIT 1`.then(res => res[0] || null),
      prisma.syncRun.findFirst({ where: { status: 'success' }, orderBy: { startedAt: 'desc' } }),
      prisma.$queryRaw`SELECT COUNT(*) as count FROM plant_snapshot_30m WHERE slot_wib LIKE ${`${timeInfo.dateWib}%`}`.then(res => Number(res[0]?.count || 0))
    ]);

    const latestPlants = await prisma.plantLatest.findMany({ select: { vendorUpdateTime: true, psStatus: true } });
    const freshCount = latestPlants.filter(p => {
      if (!p.vendorUpdateTime) return false;
      const ageMin = (now.getTime() - new Date(p.vendorUpdateTime).getTime()) / 60_000;
      return ageMin <= 20;
    }).length;

    return {
      status: 'ONLINE',
      serverTimeWib: formatWibTime(now),
      currentSlotWib: slotInfo.slotWib,
      nextSlotWib: formatWibTime(slotInfo.nextSlotAt),
      isInSyncWindow: isInSyncWindow(now),
      polling: {
        intervalMinutes: 5,
        lastSuccessSyncAt: lastSync ? formatWibTime(lastSync.startedAt) : null,
        lastSyncStatus: lastSync?.status || 'NO_SYNC',
        freshPlantsCount: freshCount,
        totalPlantsTracked: latestPlants.length
      },
      snapshot30m: {
        intervalMinutes: 30,
        lastSnapshotSlot: lastRun ? lastRun.slot_wib : null,
        lastSnapshotStatus: lastRun?.status || 'NO_RUN',
        totalCapturedInLastSlot: lastRun?.captured_count || 0,
        totalSnapshotsToday,
        lastSnapshotPowerKw: lastRun?.total_power_kw || null,
        lastSnapshotTodayEnergyKwh: lastRun?.total_today_energy_kwh || null
      }
    };
  } catch (err) {
    return {
      status: 'DEGRADED',
      error: err.message,
      serverTimeWib: formatWibTime(now)
    };
  }
}
