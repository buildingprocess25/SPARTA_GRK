import prisma from '../prisma.ts';
import { executeIsolarRequest } from './apiClient.ts';
import { upsertEnergyFlowRows, wibYearMonth } from '../importers/energyFlowImport.ts';
import { ENERGY_FLOW_SOURCE } from './energyFlowSources.ts';

// Plant-level (device type 11) points; verified 2026-10-19 to equal the portal Monthly Report to the 0.01 kWh.
const POINTS = { p83022: 'yieldKwh', p83072: 'feedInKwh', p83102: 'purchasedKwh', p83118: 'loadKwh' };
const KEYS_PER_REQUEST = 20;
export const ENERGY_FLOW_SYNC_INTERVAL_MS = 3 * 60 * 60_000;

const plantKey = (psId) => `${psId}_11_0_0`;

function previousYearMonth(ym) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return month === 1 ? `${year - 1}12` : `${year}${String(month - 1).padStart(2, '0')}`;
}

/**
 * Turns a getDevicePointsDayMonthYearDataList monthly response (values in Wh under data_type "4") into
 * energy_flow_monthly rows. A plant with no reading for a point keeps that field null instead of zero.
 */
export function energyFlowRowsFromPoints(resultData = {}, psIds = []) {
  const rows = new Map();
  for (const psId of psIds) {
    const points = resultData[plantKey(psId)] || {};
    for (const [point, field] of Object.entries(POINTS)) {
      for (const entry of points[point] || []) {
        const wh = Number(entry['4']);
        if (!entry.time_stamp || !Number.isFinite(wh)) continue;
        const key = `${entry.time_stamp}|${psId}`;
        if (!rows.has(key)) {
          rows.set(key, { yearMonth: entry.time_stamp, psId, yieldKwh: null, feedInKwh: null, purchasedKwh: null, loadKwh: null, source: ENERGY_FLOW_SOURCE.API });
        }
        rows.get(key)[field] = Number((wh / 1000).toFixed(3));
      }
    }
  }
  return [...rows.values()];
}

/**
 * The PLTS page reads production from monthly_yield_observation, not energy_flow_monthly. Mirror each pulled yield
 * there: a closed month as api_history (final, beaten only by an imported report), the running month as
 * api_live_partial. Without this the PLTS page kept whatever partial figure the standalone daemon last wrote.
 */
export function yieldObservationsFromRows(rows = [], currentYm) {
  return rows
    .filter((row) => row.yieldKwh !== null && row.yieldKwh !== undefined)
    .map((row) => {
      const closed = row.yearMonth < currentYm;
      return {
        yearMonth: row.yearMonth,
        psId: Number(row.psId),
        energyKwh: Number(row.yieldKwh),
        source: closed ? 'api_history' : 'api_live_partial',
        qualityStatus: closed ? 'FINAL' : 'PARTIAL',
      };
    });
}

async function upsertYieldObservations(db, observations, now) {
  for (const o of observations) {
    await db.$executeRaw`
      INSERT INTO monthly_yield_observation (id, year_month, ps_id, energy_kwh, measurement_type, source, quality_status, metadata, observed_at, updated_at)
      VALUES (${`myo_${o.yearMonth}_${o.psId}_${o.source}`}, ${o.yearMonth}, ${o.psId}, ${o.energyKwh}, 'MONTHLY_YIELD', ${o.source}, ${o.qualityStatus},
              '{"origin":"energy_flow_sync"}'::jsonb, ${now}, ${now})
      ON CONFLICT (year_month, ps_id, measurement_type, source) DO UPDATE
      SET energy_kwh = EXCLUDED.energy_kwh,
          quality_status = EXCLUDED.quality_status,
          updated_at = EXCLUDED.updated_at;
    `;
  }
  return observations.length;
}

/**
 * Pulls last month and this month (WIB) for every plant and stores them as ISOLAR_API rows, plus the yield as
 * monthly observations for the PLTS page. Last month is included so its final days land once the month closes.
 */
export async function syncEnergyFlowFromApi({ db = prisma, now = new Date(), request = executeIsolarRequest, force = false } = {}) {
  if (!force) {
    const [{ last } = {}] = await db.$queryRaw`
      SELECT max(updated_at) AS last FROM energy_flow_monthly WHERE source = ${ENERGY_FLOW_SOURCE.API}
    `;
    if (last && now.getTime() - new Date(last).getTime() < ENERGY_FLOW_SYNC_INTERVAL_MS) {
      return { status: 'skipped', reason: 'Ditarik kurang dari 3 jam lalu', lastSyncedAt: new Date(last).toISOString() };
    }
  }

  const plants = await db.plantMaster.findMany({ select: { sungrowPsIds: true } });
  const psIds = [...new Set(plants.flatMap((plant) => plant.sungrowPsIds || []).map(Number))];
  if (!psIds.length) return { status: 'skipped', reason: 'plant_master kosong' };

  const endYm = wibYearMonth(now);
  const startYm = previousYearMonth(endYm);
  const resultData = {};
  for (let i = 0; i < psIds.length; i += KEYS_PER_REQUEST) {
    const res = await request('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: psIds.slice(i, i + KEYS_PER_REQUEST).map(plantKey),
      data_point: Object.keys(POINTS).join(','),
      query_type: '2',
      data_type: '4',
      start_time: startYm,
      end_time: endYm,
      order: 0,
    }, { isLive: true, category: 'Energy Flow' });
    if (res?.data?.result_code !== '1') {
      throw new Error(`iSolarCloud menolak permintaan energi bulanan: ${res?.data?.result_msg || 'tanpa pesan'}`);
    }
    Object.assign(resultData, res.data.result_data || {});
  }

  const rows = energyFlowRowsFromPoints(resultData, psIds);
  await upsertEnergyFlowRows(db, rows, now);
  const yieldObservations = await upsertYieldObservations(db, yieldObservationsFromRows(rows, endYm), now);
  return { status: 'success', months: [startYm, endYm], plants: new Set(rows.map((r) => r.psId)).size, rows: rows.length, yieldObservations };
}
