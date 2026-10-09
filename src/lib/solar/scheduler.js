/**
 * Server-side Orchestrator & Scheduler for PLTS Sync & Snapshots
 * Coordinates:
 * 1. 5-Minute Polling (`runSync`)
 * 2. 30-Minute Periodic Snapshot (`captureSnapshot30m`)
 * 3. Race-condition prevention: Snapshots execute immediately after a clean sync cycle
 * 4. Resilient to server restarts and network glitches
 */

import { runSync, isInSyncWindow, getWibTimeInfo, formatWibTime } from './sync.js';
import { captureSnapshot30m, get30mSlotInfo, getSnapshotStatusReport } from './snapshot.js';
import prisma from '../prisma.js';

// ─── Single Scheduler Cycle ──────────────────────────────────────────────────

/**
 * Execute a coordinated scheduler cycle
 * 1. Executes 5-min polling if within sync window or forced
 * 2. Checks if current time is at or past a 30-minute slot boundary without a snapshot
 * 3. Captures 30-min snapshot if needed
 * 
 * @param {{ trigger?: 'cron'|'daemon'|'manual', forceSync?: boolean, forceSnapshot?: boolean }} options
 * @returns {Promise<object>}
 */
export async function runSchedulerCycle({
  trigger = 'cron',
  forceSync = false,
  forceSnapshot = false
} = {}) {
  const now = new Date();
  const slotInfo = get30mSlotInfo(now);
  const timeInfo = getWibTimeInfo(now);
  const inWindow = isInSyncWindow(now);

  const cycleReport = {
    timestamp: now.toISOString(),
    wibTime: formatWibTime(now),
    trigger,
    isInSyncWindow: inWindow,
    slotWib: slotInfo.slotWib,
    syncResult: null,
    snapshotResult: null
  };

  // 1. Step 1: Execute 5-Minute Telemetry Sync (Polling)
  if (((inWindow && trigger !== 'test') || forceSync || trigger === 'manual') && trigger !== 'test') {
    try {
      cycleReport.syncResult = await runSync({ trigger });
    } catch (err) {
      console.error('[Scheduler] Sync error during cycle:', err.message);
      cycleReport.syncResult = { status: 'failed', error: err.message };
    }
  } else {
    cycleReport.syncResult = { status: 'skipped', reason: trigger === 'test' ? 'Test mode' : 'Outside 05:30-18:30 WIB window' };
  }

  // 2. Step 2: Check 30-Minute Snapshot Requirement
  // Check if snapshot for current slot already exists
  let snapshotAlreadyExists = false;
  try {
    const existingRun = await prisma.$queryRaw`
      SELECT * FROM snapshot_run_30m WHERE slot_wib = ${slotInfo.slotWib} AND status = 'SUCCESS' LIMIT 1
    `.then(res => res[0] || null);

    if (existingRun && !forceSnapshot) {
      snapshotAlreadyExists = true;
    }
  } catch (_) {
    snapshotAlreadyExists = false;
  }

  // Execute snapshot if force requested OR if this slot hasn't been recorded yet.
  // Unlike the vendor sync above, this reads PlantLatest from our own DB (no
  // vendor API call, no quota cost), so it is safe to keep running outside the
  // 05:30-18:30 WIB production window. That keeps a continuous 30-minute audit
  // trail overnight too - proof the pipeline is alive and what the last known
  // grid/PLTS state was, instead of going silent until the next sync window.
  const shouldTakeSnapshot = forceSnapshot || !snapshotAlreadyExists || (trigger === 'manual');

  if (shouldTakeSnapshot) {
    try {
      cycleReport.snapshotResult = await captureSnapshot30m({
        trigger,
        forceSlot: now
      });
    } catch (err) {
      console.error('[Scheduler] Snapshot error during cycle:', err.message);
      cycleReport.snapshotResult = { status: 'failed', error: err.message };
    }
  } else {
    cycleReport.snapshotResult = {
      status: 'skipped',
      reason: `Snapshot slot ${slotInfo.slotWib} already recorded`
    };
  }

  return cycleReport;
}

// ─── Continuous Server Daemon ────────────────────────────────────────────────

let daemonTimer = null;
let isDaemonRunning = false;

/**
 * Start in-process continuous background polling daemon
 * Runs every 5 minutes (300,000 ms) without requiring client browsers.
 */
export function startServerDaemon({ intervalMs = 300_000 } = {}) {
  if (isDaemonRunning) {
    console.log('[SchedulerDaemon] Daemon already active.');
    return;
  }

  isDaemonRunning = true;
  console.log(`[SchedulerDaemon] Starting server-side sync & snapshot loop (${intervalMs / 1000}s interval)...`);

  // Run initial cycle immediately
  runSchedulerCycle({ trigger: 'daemon' }).catch(err => {
    console.warn('[SchedulerDaemon] Initial cycle error:', err.message);
  });

  daemonTimer = setInterval(async () => {
    try {
      await runSchedulerCycle({ trigger: 'daemon' });
    } catch (err) {
      console.error('[SchedulerDaemon] Uncaught error in loop cycle:', err);
    }
  }, intervalMs);
}

/**
 * Stop in-process background daemon
 */
export function stopServerDaemon() {
  if (daemonTimer) {
    clearInterval(daemonTimer);
    daemonTimer = null;
  }
  isDaemonRunning = false;
  console.log('[SchedulerDaemon] Daemon stopped.');
}
